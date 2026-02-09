import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { CONNECTIONS_SYSTEM, buildConnectionsUserPrompt } from "@/lib/prompts";
import { generateText } from "@/lib/ai";
import type { ConnectionType } from "@/lib/types";

const VALID_TYPES = new Set<string>([
  "pattern", "contradiction", "supports", "reminds_of",
  "same_phenomenon", "literature_link", "causal", "methodological",
]);

type AIConnection = {
  source_entry_id: string;
  target_entry_id: string;
  type: string;
  headline?: string;
  reasoning: string;
  investigation?: string;
  confidence: number;
};

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`auto-connect:${user.id}`);
  if (!success) {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: { entry_id: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.entry_id) {
    return Response.json({ error: "Missing entry_id" }, { status: 400 });
  }

  // Fetch the entry
  const { data: entry } = await supabase
    .from("entries")
    .select("id, content, entry_type, tags, project_id, created_at")
    .eq("id", body.entry_id)
    .single();

  if (!entry || !entry.content) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  // Fetch 30 most recent other entries from the same project
  const { data: otherEntries } = await supabase
    .from("entries")
    .select("id, content, entry_type, tags, created_at")
    .eq("project_id", entry.project_id)
    .neq("id", body.entry_id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!otherEntries || otherEntries.length === 0) {
    return Response.json({ connections_found: 0 });
  }

  // Cluster entries by shared tags with the new entry
  const entryTags = new Set(entry.tags || []);
  const tagMatched: typeof otherEntries = [];
  const general: typeof otherEntries = [];

  for (const e of otherEntries) {
    const shares = (e.tags || []).some((t: string) => entryTags.has(t));
    if (shares && entryTags.size > 0) {
      tagMatched.push(e);
    } else {
      general.push(e);
    }
  }

  // Build clusters (skip empty ones)
  const clusters: (typeof otherEntries)[] = [];
  if (tagMatched.length > 0) clusters.push(tagMatched);
  if (general.length > 0) clusters.push(general);
  if (clusters.length === 0) clusters.push(otherEntries);

  // Call AI for each cluster in parallel
  const clusterResults = await Promise.all(
    clusters.map(async (cluster) => {
      const userPrompt = buildConnectionsUserPrompt(
        entry.id,
        entry.content!,
        cluster.map((e) => ({
          id: e.id,
          content: e.content,
          entry_type: e.entry_type,
          tags: e.tags,
          created_at: e.created_at,
        }))
      );

      try {
        const raw = await generateText(CONNECTIONS_SYSTEM, userPrompt, 2048);
        // Strip markdown fences if present
        const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return (parsed.connections || []) as AIConnection[];
      } catch {
        return [] as AIConnection[];
      }
    })
  );

  // Merge and deduplicate
  const allConnections = clusterResults.flat();
  const seen = new Set<string>();
  const unique: AIConnection[] = [];

  for (const conn of allConnections) {
    if (conn.confidence < 0.4) continue;
    const key = [conn.source_entry_id, conn.target_entry_id].sort().join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(conn);
  }

  if (unique.length === 0) {
    return Response.json({ connections_found: 0 });
  }

  // Check which pairs already exist in DB
  const pairsToCheck = unique.map((c) => ({
    source: c.source_entry_id,
    target: c.target_entry_id,
  }));

  const { data: existing } = await supabase
    .from("connections")
    .select("source_entry_id, target_entry_id")
    .or(
      pairsToCheck
        .map(
          (p) =>
            `and(source_entry_id.eq.${p.source},target_entry_id.eq.${p.target}),and(source_entry_id.eq.${p.target},target_entry_id.eq.${p.source})`
        )
        .join(",")
    );

  const existingPairs = new Set(
    (existing || []).map((e) =>
      [e.source_entry_id, e.target_entry_id].sort().join(":")
    )
  );

  // Filter to only new connections
  const toInsert = unique
    .filter((c) => {
      const key = [c.source_entry_id, c.target_entry_id].sort().join(":");
      return !existingPairs.has(key);
    })
    .map((c) => ({
      source_entry_id: c.source_entry_id,
      target_entry_id: c.target_entry_id,
      connection_type: VALID_TYPES.has(c.type) ? c.type as ConnectionType : "pattern" as ConnectionType,
      reasoning: c.headline
        ? `${c.headline}\n\n${c.reasoning}${c.investigation ? `\n\nNext step: ${c.investigation}` : ""}`
        : c.reasoning,
      confidence: Math.max(0, Math.min(1, c.confidence)),
      status: "pending",
    }));

  if (toInsert.length > 0) {
    await supabase.from("connections").insert(toInsert);
  }

  return Response.json({ connections_found: toInsert.length });
}
