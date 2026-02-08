"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  SpeechRecognitionManager,
  isSpeechRecognitionAvailable,
  getUnavailableMessage,
} from "@/lib/speech-recognition";
import type { TranscriptSegment } from "@/lib/types";

export interface UseSpeechRecognitionResult {
  isAvailable: boolean;
  isListening: boolean;
  segments: TranscriptSegment[];
  interimSegment: TranscriptSegment | null;
  error: string | null;
  start: (lang?: string) => void;
  stop: () => void;
  clearSegments: () => void;
  fullTranscript: string;
}

export function useSpeechRecognition(
  defaultLang = "fi-FI"
): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimSegment, setInterimSegment] =
    useState<TranscriptSegment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<SpeechRecognitionManager | null>(null);
  const available = typeof window !== "undefined" && isSpeechRecognitionAvailable();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.stop();
    };
  }, []);

  const start = useCallback(
    (lang?: string) => {
      setError(null);

      if (!available) {
        setError(getUnavailableMessage());
        return;
      }

      // Stop existing if running
      managerRef.current?.stop();

      const manager = new SpeechRecognitionManager(
        {
          onInterimResult: (seg) => {
            setInterimSegment(seg);
          },
          onFinalResult: (seg) => {
            setInterimSegment(null);
            setSegments((prev) => [...prev, seg]);
          },
          onError: (err) => {
            setError(err);
          },
          onEnd: () => {
            setIsListening(false);
          },
          onStart: () => {
            setIsListening(true);
          },
        },
        lang || defaultLang
      );

      managerRef.current = manager;
      const ok = manager.start();

      if (!ok) {
        setIsListening(false);
      }
    },
    [available, defaultLang]
  );

  const stop = useCallback(() => {
    managerRef.current?.stop();
    managerRef.current = null;
    setIsListening(false);
    setInterimSegment(null);
  }, []);

  const clearSegments = useCallback(() => {
    setSegments([]);
    setInterimSegment(null);
  }, []);

  const fullTranscript = segments.map((s) => s.text).join(" ");

  return {
    isAvailable: available,
    isListening,
    segments,
    interimSegment,
    error,
    start,
    stop,
    clearSegments,
    fullTranscript,
  };
}
