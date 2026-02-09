import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import {
  RESEARCH_COMPANION_PROMPT,
  buildCompanionUserPrompt,
} from "@/lib/prompts";
import { generateText } from "@/lib/ai";
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
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`companion:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
  if (!rl.success) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const body = await request.json();
  const {
    transcript_chunk,
    project_id,
    session_id,
    full_transcript,
    previous_messages,
  } = body as {
    transcript_chunk: string;
    project_id: string;
    session_id?: string;
    full_transcript?: string;
    previous_messages?: string[];
  };

  if (!transcript_chunk) {
    return Response.json(
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
        project.name && `Project: ${project.name}`,
        project.description && `Description: ${project.description}`,
        project.ai_context && `AI Context: ${project.ai_context}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  // ── Fetch context entries in parallel ──────────────────────────────────

  type EntryRow = {
    id: string;
    content: string | null;
    entry_type: string;
    tags: string[];
    created_at: string;
  };

  // 1. Current session entries (last 5)
  const sessionEntriesPromise =
    session_id && session_id !== "live"
      ? supabase
          .from("entries")
          .select("id, content, entry_type, tags, created_at")
          .eq("session_id", session_id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null });

  // 2. Recent project entries (last 15)
  const recentEntriesPromise = project_id
    ? supabase
        .from("entries")
        .select("id, content, entry_type, tags, created_at")
        .eq("project_id", project_id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15)
    : Promise.resolve({ data: null });

  // 3. Recent anomaly entries (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const anomalyEntriesPromise = project_id
    ? supabase
        .from("entries")
        .select("id, content, entry_type, tags, created_at")
        .eq("project_id", project_id)
        .eq("user_id", user.id)
        .eq("entry_type", "anomaly")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(10)
    : Promise.resolve({ data: null });

  const [sessionResult, recentResult, anomalyResult] = await Promise.all([
    sessionEntriesPromise,
    recentEntriesPromise,
    anomalyEntriesPromise,
  ]);

  const sessionEntries: EntryRow[] = sessionResult.data || [];
  const recentEntries: EntryRow[] = recentResult.data || [];
  const anomalyEntries: EntryRow[] = anomalyResult.data || [];

  // Build prompt with all context
  const userPrompt = buildCompanionUserPrompt(
    transcript_chunk,
    full_transcript || "",
    projectContext,
    recentEntries,
    {
      previousMessages: previous_messages,
      sessionEntries,
      anomalyEntries,
    }
  );

  try {
    const text = await generateText(RESEARCH_COMPANION_PROMPT, userPrompt, 600);

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
        urgency: "low",
        referenced_entries: [],
      };
    }

    return Response.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI request failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
