import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { ENTRY_ENRICHMENT_SYSTEM } from "@/lib/prompts";
import { generateText } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`enrich:${user.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!success) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: { entry_id: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.entry_id) {
    return Response.json({ error: "Missing entry_id" }, { status: 400 });
  }

  try {
    // Fetch entry
    const { data: entry, error: entryErr } = await supabase
      .from("entries")
      .select("*")
      .eq("id", body.entry_id)
      .single();

    if (entryErr || !entry) {
      return Response.json({ error: "Entry not found" }, { status: 404 });
    }

    // Fetch project context
    const { data: project } = await supabase
      .from("projects")
      .select("name, description, ai_context")
      .eq("id", entry.project_id)
      .single();

    // Fetch 20 recent entries from same project for context
    const { data: recentEntries } = await supabase
      .from("entries")
      .select("entry_type, content, tags, created_at")
      .eq("project_id", entry.project_id)
      .neq("id", body.entry_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Build user prompt
    let userPrompt = "";

    if (project) {
      userPrompt += `## Project: ${project.name}\n`;
      if (project.description) userPrompt += `Description: ${project.description}\n`;
      if (project.ai_context) userPrompt += `Research context: ${project.ai_context}\n`;
      userPrompt += "\n";
    }

    if (recentEntries && recentEntries.length > 0) {
      userPrompt += `## Recent project entries (for context)\n`;
      for (const e of recentEntries) {
        userPrompt += `- [${e.entry_type}] (${(e.created_at as string).slice(0, 10)}) ${((e.content as string) || "").slice(0, 150)} [tags: ${(e.tags as string[]).join(", ") || "none"}]\n`;
      }
      userPrompt += "\n";
    }

    userPrompt += `## Entry to enrich\n`;
    userPrompt += `Type: ${entry.entry_type}\n`;
    userPrompt += `Tags: ${(entry.tags as string[]).join(", ") || "none"}\n`;
    userPrompt += `Content: ${entry.content || "(empty)"}\n`;

    const responseText = await generateText(
      ENTRY_ENRICHMENT_SYSTEM,
      userPrompt,
      1024
    );

    // Parse JSON — handle markdown fences gracefully
    let enrichment;
    try {
      enrichment = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        enrichment = JSON.parse(match[1]);
      } else {
        return Response.json(
          { error: "AI returned invalid response" },
          { status: 502 }
        );
      }
    }

    return Response.json(enrichment);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Enrichment failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
