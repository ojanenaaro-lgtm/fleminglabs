"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { AudioWaveform } from "@/components/audio-waveform";
import TranscriptView from "@/components/transcript-view";
import type { TranscriptSegment, TranscriptTag } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

let segId = 0;
function nextSegId() {
  return `seg-${++segId}`;
}

// ── Tag quick-select config ─────────────────────────────────────────────

const QUICK_TAGS: { tag: TranscriptTag; label: string; color: string; activeColor: string }[] = [
  { tag: "observation", label: "Observation", color: "border-green-300 text-green-700", activeColor: "bg-green-100 border-green-500 text-green-800" },
  { tag: "measurement", label: "Measurement", color: "border-blue-300 text-blue-700", activeColor: "bg-blue-100 border-blue-500 text-blue-800" },
  { tag: "protocol_step", label: "Protocol Step", color: "border-amber-300 text-amber-700", activeColor: "bg-amber-100 border-amber-500 text-amber-800" },
  { tag: "idea", label: "Idea", color: "border-purple-300 text-purple-700", activeColor: "bg-purple-100 border-purple-500 text-purple-800" },
];

// ── Simulated live transcript (placeholder for real STT) ────────────────

const SIMULATED_PHRASES = [
  "Beginning experiment observation…",
  "Sample appears to have changed color slightly.",
  "Temperature holding steady at 37.2 degrees.",
  "Adding reagent B to the mixture now.",
  "Noting a slight exothermic reaction occurring.",
  "pH level reading is approximately 7.4.",
  "Interesting — the precipitate is forming faster than expected.",
  "Need to check the protocol for the next centrifuge step.",
  "Adjusting the microscope focus for better resolution.",
  "This pattern reminds me of the results from last Tuesday.",
];

// ── Page Component ──────────────────────────────────────────────────────

type ViewMode = "recording" | "summary";

export default function NewSessionPage() {
  const router = useRouter();
  const recorder = useVoiceRecorder();
  const [view, setView] = useState<ViewMode>("recording");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeTag, setActiveTag] = useState<TranscriptTag | undefined>();
  const [selectedProject, setSelectedProject] = useState("");
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phraseIndexRef = useRef(0);

  // Simulate live transcription while recording
  useEffect(() => {
    if (recorder.state === "recording") {
      simulationRef.current = setInterval(() => {
        const phrase = SIMULATED_PHRASES[phraseIndexRef.current % SIMULATED_PHRASES.length];
        phraseIndexRef.current++;

        setSegments((prev) => {
          // Finalize the last segment if it exists
          const finalized = prev.length > 0
            ? prev.map((s, i) => (i === prev.length - 1 ? { ...s, isFinal: true } : s))
            : prev;

          return [
            ...finalized,
            {
              id: nextSegId(),
              text: phrase,
              timestamp: recorder.duration * 1000,
              isFinal: false,
              confidence: 0.85 + Math.random() * 0.15,
              tag: undefined,
            },
          ];
        });
      }, 3000 + Math.random() * 2000);
    } else {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
    }
    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
    };
  }, [recorder.state, recorder.duration]);

  // When a quick-tag button is pressed, tag the most recent segment
  const applyQuickTag = useCallback(
    (tag: TranscriptTag) => {
      if (activeTag === tag) {
        setActiveTag(undefined);
        return;
      }
      setActiveTag(tag);

      setSegments((prev) => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], tag };
        return copy;
      });
    },
    [activeTag],
  );

  const handleSegmentUpdate = useCallback((id: string, text: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text } : s)),
    );
  }, []);

  const handleTagChange = useCallback((id: string, tag: TranscriptTag | undefined) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, tag } : s)),
    );
  }, []);

  const handleStart = useCallback(async () => {
    setSegments([]);
    phraseIndexRef.current = 0;
    await recorder.start();
  }, [recorder]);

  const handleStop = useCallback(async () => {
    await recorder.stop();
    // Finalize all segments
    setSegments((prev) => prev.map((s) => ({ ...s, isFinal: true })));
    setView("summary");
  }, [recorder]);

  const handleDiscard = useCallback(() => {
    setSegments([]);
    setView("recording");
  }, []);

  // ── Recording View ──────────────────────────────────────────────────

  if (view === "recording") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            &larr; Back
          </button>
          <h1 className="font-heading text-lg font-semibold text-foreground">
            New Recording
          </h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </header>

        {/* Main recording area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-4 min-h-0">
          {/* Mic icon with pulse rings */}
          <div className="relative mb-8">
            {recorder.state === "recording" && (
              <>
                <div
                  className="absolute inset-0 rounded-full bg-primary"
                  style={{ animation: "pulse-ring 2s ease-out infinite" }}
                />
                <div
                  className="absolute inset-0 rounded-full bg-primary"
                  style={{ animation: "pulse-ring 2s ease-out infinite 0.6s" }}
                />
                <div
                  className="absolute inset-0 rounded-full bg-primary"
                  style={{ animation: "pulse-ring 2s ease-out infinite 1.2s" }}
                />
              </>
            )}
            <div
              className={`relative z-10 flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500 ${
                recorder.state === "recording"
                  ? "bg-primary shadow-lg"
                  : recorder.state === "paused"
                    ? "bg-sage"
                    : "bg-border"
              }`}
              style={
                recorder.state === "recording"
                  ? { animation: "breathe 3s ease-in-out infinite" }
                  : undefined
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-10 h-10"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
          </div>

          {/* Duration */}
          <p className="font-heading text-5xl font-light tabular-nums text-foreground mb-2 tracking-tight">
            {formatDuration(recorder.duration)}
          </p>
          <p className="text-sm text-muted mb-6">
            {recorder.state === "idle" && "Ready to record"}
            {recorder.state === "recording" && "Recording"}
            {recorder.state === "paused" && "Paused"}
            {recorder.state === "processing" && "Processing…"}
          </p>

          {/* Waveform */}
          <div className="w-full max-w-xl h-20 mb-8">
            <AudioWaveform
              analyserNode={recorder.analyserNode}
              state={recorder.state}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6 mb-8">
            {recorder.state === "idle" ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-white font-heading font-semibold text-lg hover:bg-primary-hover transition-colors shadow-md"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <circle cx="12" cy="12" r="6" />
                </svg>
                Start Recording
              </button>
            ) : (
              <>
                {recorder.state === "recording" ? (
                  <button
                    onClick={recorder.pause}
                    className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-sage text-sage font-heading font-medium hover:bg-sage/10 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                    Pause
                  </button>
                ) : recorder.state === "paused" ? (
                  <button
                    onClick={recorder.resume}
                    className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-heading font-medium hover:bg-primary-light transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <polygon points="6,4 20,12 6,20" />
                    </svg>
                    Resume
                  </button>
                ) : null}

                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-red-600 text-white font-heading font-semibold hover:bg-red-700 transition-colors shadow-md"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  Stop
                </button>
              </>
            )}
          </div>

          {/* Quick tag buttons — only visible while recording/paused */}
          {(recorder.state === "recording" || recorder.state === "paused") && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <span className="text-xs text-muted mr-1">Tag:</span>
              {QUICK_TAGS.map((qt) => (
                <button
                  key={qt.tag}
                  onClick={() => applyQuickTag(qt.tag)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    activeTag === qt.tag ? qt.activeColor : qt.color
                  }`}
                >
                  {qt.label}
                </button>
              ))}
            </div>
          )}

          {/* Error message */}
          {recorder.error && (
            <p className="text-sm text-error bg-red-50 px-4 py-2 rounded-lg">
              {recorder.error}
            </p>
          )}
        </div>

        {/* Live transcript panel — slides up from bottom */}
        {segments.length > 0 && (
          <div className="border-t border-border bg-input-bg h-[35vh] min-h-[180px] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <h2 className="text-xs font-heading font-semibold text-muted uppercase tracking-wider">
                Live Transcript
              </h2>
              <span className="text-xs text-muted tabular-nums">
                {segments.length} segment{segments.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <TranscriptView
                segments={segments}
                isRecording={recorder.state === "recording"}
                onTagChange={handleTagChange}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Summary View ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          Session Summary
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDiscard}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground border border-border rounded-lg hover:bg-surface transition-colors"
          >
            Discard
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors"
          >
            Save Session
          </button>
        </div>
      </header>

      {/* Summary content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-input-bg rounded-xl p-4 text-center">
              <p className="text-2xl font-heading font-semibold text-foreground">
                {formatDuration(recorder.duration)}
              </p>
              <p className="text-xs text-muted mt-1">Duration</p>
            </div>
            <div className="bg-input-bg rounded-xl p-4 text-center">
              <p className="text-2xl font-heading font-semibold text-foreground">
                {segments.length}
              </p>
              <p className="text-xs text-muted mt-1">Segments</p>
            </div>
            <div className="bg-input-bg rounded-xl p-4 text-center">
              <p className="text-2xl font-heading font-semibold text-foreground">
                {segments.filter((s) => s.tag).length}
              </p>
              <p className="text-xs text-muted mt-1">Tagged</p>
            </div>
          </div>

          {/* Audio playback placeholder */}
          {recorder.audioBlob && (
            <div className="bg-input-bg rounded-xl p-4">
              <h2 className="text-sm font-heading font-semibold text-foreground mb-3">
                Audio Recording
              </h2>
              <audio
                controls
                src={URL.createObjectURL(recorder.audioBlob)}
                className="w-full"
              />
            </div>
          )}

          {/* Process with AI button */}
          <button
            onClick={() => {
              /* placeholder — will integrate AI processing pipeline */
            }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border-2 border-dashed border-primary/30 text-primary font-heading font-semibold hover:bg-primary-light/50 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
              <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Process with AI
          </button>

          {/* Save to project selector */}
          <div className="bg-input-bg rounded-xl p-4">
            <label
              htmlFor="project-select"
              className="block text-sm font-heading font-semibold text-foreground mb-2"
            >
              Save to Project
            </label>
            <select
              id="project-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select a project…</option>
              <option value="demo-1">Enzyme Kinetics Study</option>
              <option value="demo-2">Cell Culture Protocol</option>
              <option value="demo-3">Spectroscopy Analysis</option>
            </select>
          </div>

          {/* Full transcript with edit capability */}
          <div>
            <h2 className="text-sm font-heading font-semibold text-foreground mb-3">
              Full Transcript
            </h2>
            <div className="border border-border rounded-xl overflow-hidden bg-input-bg h-[400px]">
              <TranscriptView
                segments={segments}
                isRecording={false}
                onSegmentUpdate={handleSegmentUpdate}
                onTagChange={handleTagChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
