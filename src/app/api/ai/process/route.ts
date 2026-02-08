import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import {
  PROCESS_TRANSCRIPT_SYSTEM,
  buildProcessUserPrompt,
} from "@/lib/prompts";
import type { ProcessRequest, ProcessResponse } from "@/lib/types";

const anthropic = new Anthropic();

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
  const { success } = rateLimit(`process:${user.id}`);
  if (!success) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  // Validate body
  let body: ProcessRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.transcript || typeof body.transcript !== "string") {
    return Response.json(
      { error: "Missing required field: transcript" },
      { status: 400 }
    );
  }

  if (body.transcript.length > 50_000) {
    return Response.json(
      { error: "Transcript too long (max 50,000 characters)" },
      { status: 400 }
    );
  }

  const tags = body.tags ?? [];
  const userPrompt = buildProcessUserPrompt(
    body.transcript,
    tags,
    body.projectContext
  );

  // Stream response from Claude
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullText = "";

        const messageStream = anthropic.messages.stream({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          system: PROCESS_TRANSCRIPT_SYSTEM,
          messages: [{ role: "user", content: userPrompt }],
        });

        messageStream.on("text", (text) => {
          fullText += text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`)
          );
        });

        await messageStream.finalMessage();

        // Parse and validate the final JSON
        let parsed: ProcessResponse;
        try {
          parsed = JSON.parse(fullText);
        } catch {
          // If Claude wrapped in markdown fences, try to extract
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
          err instanceof Error ? err.message : "AI processing failed";
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
