"use client";

import { useState, useRef, useCallback } from "react";
import type { CompanionMessage, CompanionResponse } from "@/lib/types";

interface UseAICompanionOptions {
  sessionId: string;
  projectId: string;
  /** Minimum seconds between AI requests */
  intervalSeconds?: number;
}

export interface UseAICompanionResult {
  messages: CompanionMessage[];
  isThinking: boolean;
  /** Send the current transcript buffer to the AI */
  sendChunk: (chunk: string, fullTranscript: string) => Promise<void>;
  /** Manually trigger a check (e.g. when user tags something or pauses) */
  triggerCheck: (chunk: string, fullTranscript: string) => Promise<void>;
  clearMessages: () => void;
}

let msgIdCounter = 0;

export function useAICompanion({
  sessionId,
  projectId,
  intervalSeconds = 30,
}: UseAICompanionOptions): UseAICompanionResult {
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const lastSentRef = useRef<number>(0);
  const bufferRef = useRef<string>("");
  const pendingRef = useRef(false);

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
          }),
        });

        if (!res.ok) {
          // Silently ignore errors — companion is non-critical
          return;
        }

        const data: CompanionResponse = await res.json();

        if (!data.skip && data.message) {
          const msg: CompanionMessage = {
            id: `companion-${++msgIdCounter}`,
            message: data.message,
            detected_type: data.detected_type,
            timestamp: Date.now(),
            suggested_connections: data.suggested_connections,
          };
          setMessages((prev) => [...prev, msg]);
        }
      } catch {
        // Silent fail — don't interrupt the researcher
      } finally {
        pendingRef.current = false;
        setIsThinking(false);
        lastSentRef.current = Date.now();
        bufferRef.current = "";
      }
    },
    [sessionId, projectId]
  );

  const sendChunk = useCallback(
    async (chunk: string, fullTranscript: string) => {
      bufferRef.current += " " + chunk;

      const elapsed = Date.now() - lastSentRef.current;
      if (elapsed < intervalSeconds * 1000) {
        return; // Not enough time has passed
      }

      await callCompanion(bufferRef.current, fullTranscript);
    },
    [callCompanion, intervalSeconds]
  );

  const triggerCheck = useCallback(
    async (chunk: string, fullTranscript: string) => {
      // Force a check regardless of timing (e.g. on tag, pause)
      const combined = bufferRef.current + " " + chunk;
      await callCompanion(combined, fullTranscript);
    },
    [callCompanion]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    bufferRef.current = "";
    lastSentRef.current = 0;
  }, []);

  return {
    messages,
    isThinking,
    sendChunk,
    triggerCheck,
    clearMessages,
  };
}
