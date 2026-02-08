import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import {
  RESEARCH_COMPANION_PROMPT,
  buildCompanionUserPrompt,
} from "@/lib/prompts";
import type { CompanionResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component context
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`companion:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const body = await request.json();
  const {
    transcript_chunk,
    project_id,
    full_transcript,
  } = body as {
    transcript_chunk: string;
    session_id: string;
    project_id: string;
    full_transcript?: string;
  };

  if (!transcript_chunk) {
    return NextResponse.json(
      { error: "transcript_chunk is required" },
      { status: 400 }
    );
  }

  // Fetch project context
  let projectContext = "";
  if (project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name, description, ai_context")
      .eq("id", project_id)
      .single();

    if (project) {
      projectContext = [
        project.name,
        project.description,
        project.ai_context,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  // Fetch recent entries from this project for context
  let recentEntries: {
    id: string;
    content: string | null;
    entry_type: string;
    tags: string[];
    created_at: string;
  }[] = [];

  if (project_id) {
    const { data: entries } = await supabase
      .from("entries")
      .select("id, content, entry_type, tags, created_at")
      .eq("project_id", project_id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (entries) {
      recentEntries = entries;
    }
  }

  // Build prompt
  const userPrompt = buildCompanionUserPrompt(
    transcript_chunk,
    full_transcript || "",
    projectContext,
    recentEntries
  );

  // Call Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      system: RESEARCH_COMPANION_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text
    const text =
      msg.content[0].type === "text" ? msg.content[0].text : "";

    // Parse JSON response
    let response: CompanionResponse;
    try {
      response = JSON.parse(text);
    } catch {
      // If the model didn't return valid JSON, treat the whole text as a message
      response = {
        skip: false,
        message: text,
        detected_type: null,
      };
    }

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
