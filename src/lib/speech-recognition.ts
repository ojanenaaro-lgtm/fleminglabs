// Web Speech API wrapper for real-time transcription
// Falls back to showing a message when unavailable (non-Chrome browsers)

import type { TranscriptSegment } from "./types";

// ── Web Speech API type declarations ─────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

// ── Availability check ───────────────────────────────────────────────────

export function isSpeechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function getUnavailableMessage(): string {
  return (
    "Web Speech API is not available in this browser. " +
    "Please use Chrome (desktop) for live transcription, " +
    "or upload audio for Whisper-based transcription."
  );
}

// ── Callbacks ────────────────────────────────────────────────────────────

export type SpeechCallbacks = {
  onInterimResult: (segment: TranscriptSegment) => void;
  onFinalResult: (segment: TranscriptSegment) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onStart: () => void;
};

// ── Manager class ────────────────────────────────────────────────────────

export class SpeechRecognitionManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private callbacks: SpeechCallbacks;
  private recordingStartTime = 0;
  private segmentCounter = 0;
  private isRunning = false;
  private shouldRestart = false;
  private lang: string;

  constructor(callbacks: SpeechCallbacks, lang = "en-US") {
    this.callbacks = callbacks;
    this.lang = lang;
  }

  start(): boolean {
    if (!isSpeechRecognitionAvailable()) {
      this.callbacks.onError(getUnavailableMessage());
      return false;
    }

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new Ctor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.lang;
    this.recognition.maxAlternatives = 1;

    this.recordingStartTime = Date.now();
    this.segmentCounter = 0;
    this.shouldRestart = true;

    this.recognition.onstart = () => {
      this.isRunning = true;
      this.callbacks.onStart();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        const segment: TranscriptSegment = {
          id: `seg-${this.segmentCounter}`,
          text: alt.transcript.trim(),
          timestamp: Date.now() - this.recordingStartTime,
          isFinal: result.isFinal,
          confidence: alt.confidence,
        };

        if (result.isFinal) {
          this.segmentCounter++;
          this.callbacks.onFinalResult(segment);
        } else {
          this.callbacks.onInterimResult(segment);
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are benign — don't surface them
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.callbacks.onError(`Speech recognition error: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.isRunning = false;
      // Web Speech API auto-stops after silence; restart if we haven't called stop()
      if (this.shouldRestart && this.recognition) {
        try {
          this.recognition.start();
        } catch {
          // Already running or disposed — ignore
        }
        return;
      }
      this.callbacks.onEnd();
    };

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      this.callbacks.onError(
        `Failed to start speech recognition: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }

  stop() {
    this.shouldRestart = false;
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.isRunning = false;
  }

  get running(): boolean {
    return this.isRunning;
  }

  setLanguage(lang: string) {
    this.lang = lang;
    // If already running, restart with new language
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}
