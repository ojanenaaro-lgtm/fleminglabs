// POST /api/transcribe — Send audio to OpenAI Whisper for high-quality transcription

import { NextRequest, NextResponse } from "next/server";

// ── Basic in-memory rate limiter ─────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // requests per window

const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  requestLog.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) return true;

  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestLog) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) requestLog.delete(ip);
    else requestLog.set(ip, recent);
  }
}, 5 * 60_000);

// ── Route handler ────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHISPER_MODEL = "whisper-1";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (Whisper limit)

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("audio");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing "audio" field in form data' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    // Build request to OpenAI Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", file, "recording.webm");
    whisperForm.append("model", WHISPER_MODEL);
    whisperForm.append("response_format", "verbose_json");
    whisperForm.append("timestamp_granularities[]", "segment");

    // Optional language hint from client
    const languageHint = formData.get("language");
    if (typeof languageHint === "string" && languageHint) {
      whisperForm.append("language", languageHint);
    }

    const whisperRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: whisperForm,
      }
    );

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text();
      console.error("Whisper API error:", whisperRes.status, errBody);
      return NextResponse.json(
        { error: "Transcription failed", detail: errBody },
        { status: 502 }
      );
    }

    const result = await whisperRes.json();

    return NextResponse.json({
      text: result.text ?? "",
      language: result.language ?? "unknown",
      segments: (result.segments ?? []).map(
        (seg: { id: number; start: number; end: number; text: string }) => ({
          id: seg.id,
          start: seg.start,
          end: seg.end,
          text: seg.text?.trim() ?? "",
        })
      ),
    });
  } catch (err) {
    console.error("Transcribe route error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
