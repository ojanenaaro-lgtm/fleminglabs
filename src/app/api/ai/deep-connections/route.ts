import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { CONNECTIONS_SYSTEM, buildBulkConnectionsUserPrompt } from "@/lib/prompts";
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

  // Stricter rate limit for deep analysis: 3 per minute
  const { success } = rateLimit(`deep-connections:${user.id}`, { maxRequests: 3, windowMs: 60_000 });
  if (!success) {
    return Response.json({ error: "Rate limited. Deep analysis is resource-intensive — try again in a minute." }, { status: 429 });
  }

  let body: { project_id: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.project_id) {
    return Response.json({ error: "Missing project_id" }, { status: 400 });
  }

  // Verify user owns this project
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", body.project_id)
    .eq("owner_id", user.id)
    .single();

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch all entries for the project (up to 100)
  const { data: entries } = await supabase
    .from("entries")
    .select("id, content, entry_type, tags, created_at")
    .eq("project_id", body.project_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!entries || entries.length < 2) {
    return Response.json({ connections_found: 0 });
  }

  // Cluster by shared tags — group entries that share tags, remainder is general
  const tagGroups = new Map<string, typeof entries>();
  const assigned = new Set<string>();

  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      if (!tagGroups.has(tag)) tagGroups.set(tag, []);
      tagGroups.get(tag)!.push(entry);
      assigned.add(entry.id);
    }
  }

  // Pick the top 2-3 largest tag groups as clusters
  const sortedGroups = Array.from(tagGroups.entries())
    .filter(([, group]) => group.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  const clusters: (typeof entries)[] = [];
  const clusteredIds = new Set<string>();

  for (const [, group] of sortedGroups) {
    // Deduplicate within cluster and cap at 30
    const deduped = group.filter((e) => !clusteredIds.has(e.id)).slice(0, 30);
    if (deduped.length >= 2) {
      clusters.push(deduped);
      deduped.forEach((e) => clusteredIds.add(e.id));
    }
  }

  // General cluster: everything not in a tag cluster
  const general = entries.filter((e) => !clusteredIds.has(e.id)).slice(0, 30);
  if (general.length >= 2) {
    clusters.push(general);
  }

  // Fallback: if no clusters formed, just use all entries
  if (clusters.length === 0) {
    clusters.push(entries.slice(0, 30));
  }

  // Call AI for each cluster in parallel
  const clusterResults = await Promise.all(
    clusters.map(async (cluster) => {
      const userPrompt = buildBulkConnectionsUserPrompt(
        cluster.map((e) => ({
          id: e.id,
          content: e.content,
          entry_type: e.entry_type,
          tags: e.tags,
          created_at: e.created_at,
        }))
      );

      try {
        const raw = await generateText(CONNECTIONS_SYSTEM, userPrompt, 3072);
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

  // Check existing connections
  const { data: existing } = await supabase
    .from("connections")
    .select("source_entry_id, target_entry_id");

  const existingPairs = new Set(
    (existing || []).map((e) =>
      [e.source_entry_id, e.target_entry_id].sort().join(":")
    )
  );

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
