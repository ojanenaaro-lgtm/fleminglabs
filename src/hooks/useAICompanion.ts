"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { CompanionMessage, CompanionResponse, CompanionUrgency } from "@/lib/types";

// ── Trigger word detection ──────────────────────────────────────────────

const TRIGGER_WORDS = [
  "weird", "unexpected", "strange", "wrong", "contamination", "error",
  "interesting", "huh", "different from", "not what i expected",
  "wonder if", "maybe we should", "anomal",
  // Finnish equivalents
  "outo", "odottamaton", "virhe", "kontaminaatio", "erilainen",
  "ei ole mitä odotin", "mietin jos", "poikkeama",
];

function hasTriggerWords(text: string): boolean {
  const lower = text.toLowerCase();
  return TRIGGER_WORDS.some((t) => lower.includes(t));
}

// ── Rolling buffer helpers ──────────────────────────────────────────────

const BUFFER_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const COOLDOWN_MS = 45_000; // 45 seconds
const COOLDOWN_HIGH_MS = 10_000; // 10 seconds after high-urgency
const PAUSE_THRESHOLD_MS = 3_000; // 3 seconds of silence to trigger

interface BufferEntry {
  text: string;
  timestamp: number;
}

// ── Hook ────────────────────────────────────────────────────────────────

interface UseAICompanionOptions {
  sessionId: string;
  projectId: string;
}

export interface UseAICompanionResult {
  messages: CompanionMessage[];
  isThinking: boolean;
  /** Feed transcript text as it comes in — triggers are evaluated internally */
  sendChunk: (chunk: string, fullTranscript: string) => void;
  /** Force a check (e.g. when user tags something) */
  triggerCheck: (chunk: string, fullTranscript: string) => Promise<void>;
  clearMessages: () => void;
  /** Number of times the companion actually spoke */
  insightCount: number;
}

let msgIdCounter = 0;

export function useAICompanion({
  sessionId,
  projectId,
}: UseAICompanionOptions): UseAICompanionResult {
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const pendingRef = useRef(false);
  const lastSentRef = useRef<number>(0);
  const lastUrgencyRef = useRef<CompanionUrgency>("low");
  const bufferRef = useRef<BufferEntry[]>([]);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFullTranscriptRef = useRef<string>("");
  const previousMessagesRef = useRef<string[]>([]);

  // Prune buffer to last 3 minutes
  const pruneBuffer = useCallback(() => {
    const cutoff = Date.now() - BUFFER_DURATION_MS;
    bufferRef.current = bufferRef.current.filter((e) => e.timestamp > cutoff);
  }, []);

  // Get rolling buffer text
  const getBufferText = useCallback(() => {
    pruneBuffer();
    return bufferRef.current.map((e) => e.text).join(" ");
  }, [pruneBuffer]);

  // Check cooldown
  const isCoolingDown = useCallback(() => {
    const elapsed = Date.now() - lastSentRef.current;
    const cooldown =
      lastUrgencyRef.current === "high" ? COOLDOWN_HIGH_MS : COOLDOWN_MS;
    return elapsed < cooldown;
  }, []);

  // Core API call
  const callCompanion = useCallback(
    async (chunk: string, fullTranscript: string) => {
      if (pendingRef.current) return;
      if (!chunk.trim()) return;

      pendingRef.current = true;
      setIsThinking(true);

      try {
        const res = await fetch("/api/ai/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript_chunk: chunk,
            session_id: sessionId,
            project_id: projectId,
            full_transcript: fullTranscript,
            previous_messages: previousMessagesRef.current,
          }),
        });

        if (!res.ok) return;

        const data: CompanionResponse = await res.json();

        if (!data.skip && data.message) {
          const msg: CompanionMessage = {
            id: `companion-${++msgIdCounter}`,
            message: data.message,
            detected_type: data.detected_type,
            urgency: data.urgency,
            timestamp: Date.now(),
            referenced_entries: data.referenced_entries,
          };
          setMessages((prev) => [...prev, msg]);
          previousMessagesRef.current.push(data.message);
          lastUrgencyRef.current = data.urgency || "low";
        }
      } catch {
        // Silent fail — don't interrupt the researcher
      } finally {
        pendingRef.current = false;
        setIsThinking(false);
        lastSentRef.current = Date.now();
      }
    },
    [sessionId, projectId]
  );

  // ── sendChunk — called on every new transcript segment ────────────────

  const sendChunk = useCallback(
    (chunk: string, fullTranscript: string) => {
      if (!chunk.trim()) return;

      // Add to rolling buffer
      bufferRef.current.push({ text: chunk, timestamp: Date.now() });
      latestFullTranscriptRef.current = fullTranscript;

      // Clear any existing pause timer
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }

      // Immediate send on trigger words (respects cooldown)
      if (hasTriggerWords(chunk) && !isCoolingDown()) {
        const bufferText = getBufferText();
        callCompanion(bufferText, fullTranscript);
        return;
      }

      // Set a pause timer — if no new chunk arrives in 3s, send
      pauseTimerRef.current = setTimeout(() => {
        if (!isCoolingDown()) {
          const bufferText = getBufferText();
          if (bufferText.trim()) {
            callCompanion(bufferText, latestFullTranscriptRef.current);
          }
        }
      }, PAUSE_THRESHOLD_MS);
    },
    [callCompanion, isCoolingDown, getBufferText]
  );

  // ── triggerCheck — force a check (tag applied, pause button, etc.) ────

  const triggerCheck = useCallback(
    async (chunk: string, fullTranscript: string) => {
      // Clear pause timer
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }

      const bufferText = getBufferText() + " " + chunk;
      await callCompanion(bufferText, fullTranscript);
    },
    [callCompanion, getBufferText]
  );

  // ── clearMessages ─────────────────────────────────────────────────────

  const clearMessages = useCallback(() => {
    setMessages([]);
    bufferRef.current = [];
    lastSentRef.current = 0;
    lastUrgencyRef.current = "low";
    previousMessagesRef.current = [];
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  return {
    messages,
    isThinking,
    sendChunk,
    triggerCheck,
    clearMessages,
    insightCount: messages.length,
  };
}
