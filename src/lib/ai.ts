import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

// ── Provider detection ──────────────────────────────────────────────────

type Provider = "gemini" | "anthropic";

function getProvider(): Provider {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  throw new Error(
    "No AI API key configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env.local"
  );
}

// ── generateText (non-streaming) ────────────────────────────────────────

export async function generateText(
  system: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: system,
      generationConfig: { maxOutputTokens: maxTokens },
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  }

  // Anthropic
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });
  return msg.content[0].type === "text" ? msg.content[0].text : "";
}

// ── generateTextStream (streaming) ──────────────────────────────────────

export async function* generateTextStream(
  system: string,
  userPrompt: string,
  maxTokens: number
): AsyncGenerator<string> {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: system,
      generationConfig: { maxOutputTokens: maxTokens },
    });
    const result = await model.generateContentStream(userPrompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
    return;
  }

  // Anthropic
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
