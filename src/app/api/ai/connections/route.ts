import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import {
  CONNECTIONS_SYSTEM,
  buildConnectionsUserPrompt,
} from "@/lib/prompts";
import { generateTextStream } from "@/lib/ai";
import type { ConnectionsRequest, ConnectionsResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 requests per minute per user
  const { success } = rateLimit(`connections:${user.id}`);
  if (!success) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  // Validate body
  let body: ConnectionsRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.entry_id || !body.content) {
    return Response.json(
      { error: "Missing required fields: entry_id, content" },
      { status: 400 }
    );
  }

  // Fetch the entry to find its project
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("id, session_id, sessions(project_id)")
    .eq("id", body.entry_id)
    .single();

  if (entryError || !entry) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  const projectId = (entry.sessions as unknown as { project_id: string })
    ?.project_id;

  if (!projectId) {
    return Response.json(
      { error: "Could not determine project for entry" },
      { status: 400 }
    );
  }

  // Fetch existing entries from the same project (exclude the current entry)
  const { data: existingEntries } = await supabase
    .from("entries")
    .select("id, content, entry_type, tags, session_id, sessions(project_id)")
    .neq("id", body.entry_id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Filter to same project (join filter)
  const projectEntries = (existingEntries ?? []).filter(
    (e) =>
      (e.sessions as unknown as { project_id: string })?.project_id ===
      projectId
  );

  if (projectEntries.length === 0) {
    return Response.json({
      connections: [],
    } satisfies ConnectionsResponse);
  }

  // Send for connection discovery
  const userPrompt = buildConnectionsUserPrompt(
    body.entry_id,
    body.content,
    projectEntries.map((e) => ({
      id: e.id,
      content: e.content,
      entry_type: e.entry_type,
      tags: e.tags,
    }))
  );

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullText = "";

        for await (const chunk of generateTextStream(
          CONNECTIONS_SYSTEM,
          userPrompt,
          2048
        )) {
          fullText += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`)
          );
        }

        let parsed: ConnectionsResponse;
        try {
          parsed = JSON.parse(fullText);
        } catch {
          const match = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (match) {
            parsed = JSON.parse(match[1]);
          } else {
            throw new Error("Failed to parse AI response as JSON");
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "result", data: parsed })}\n\n`
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Connection analysis failed";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: message })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
