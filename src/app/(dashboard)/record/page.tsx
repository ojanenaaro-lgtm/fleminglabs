"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAICompanion } from "@/hooks/useAICompanion";
import { AudioWaveform } from "@/components/audio-waveform";
import TranscriptView from "@/components/transcript-view";
import { AICompanionPanel } from "@/components/ai-companion-panel";
import AiProcessingPanel from "@/components/ai-processing-panel";
import { createClient } from "@/lib/supabase";
import type { TranscriptSegment, TranscriptTag } from "@/lib/types";
import {
  Mic,
  Pause,
  Play,
  Square,
  ChevronLeft,
  Clock,
  Folder,
  Sparkles,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Quick tag config ────────────────────────────────────────────────────

const QUICK_TAGS: {
  tag: TranscriptTag;
  label: string;
  color: string;
  activeColor: string;
}[] = [
  {
    tag: "observation",
    label: "Observation",
    color: "border-primary/30 text-primary/70",
    activeColor: "bg-primary-light border-primary text-primary",
  },
  {
    tag: "measurement",
    label: "Measurement",
    color: "border-amber-300/60 text-amber-700/70",
    activeColor: "bg-amber-50 border-amber-500 text-amber-800",
  },
  {
    tag: "hypothesis",
    label: "Hypothesis",
    color: "border-violet-300/60 text-violet-700/70",
    activeColor: "bg-violet-50 border-violet-500 text-violet-800",
  },
  {
    tag: "anomaly",
    label: "Anomaly",
    color: "border-red-300/60 text-red-700/70",
    activeColor: "bg-red-50 border-red-500 text-red-800",
  },
  {
    tag: "idea",
    label: "Idea",
    color: "border-blue-300/60 text-blue-700/70",
    activeColor: "bg-blue-50 border-blue-500 text-blue-800",
  },
  {
    tag: "protocol_step",
    label: "Protocol",
    color: "border-gray-300/60 text-gray-600/70",
    activeColor: "bg-gray-50 border-gray-500 text-gray-800",
  },
];

// ── Types ───────────────────────────────────────────────────────────────

type ViewMode = "recording" | "summary";
type ProjectOption = { id: string; name: string };

// ── Page ────────────────────────────────────────────────────────────────

export default function RecordPage() {
  const router = useRouter();
  const recorder = useVoiceRecorder();
  const speech = useSpeechRecognition("fi-FI");

  const [view, setView] = useState<ViewMode>("recording");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeTag, setActiveTag] = useState<TranscriptTag | undefined>();
  const [selectedProject, setSelectedProject] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [showAIProcessing, setShowAIProcessing] = useState(false);

  const companion = useAICompanion({
    sessionId: "live",
    projectId: selectedProject,
    intervalSeconds: 30,
  });

  // Track last processed segment index for companion
  const lastCompanionIdx = useRef(0);

  // Load projects on mount
  useEffect(() => {
    async function loadProjects() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });

      if (data) setProjects(data);
    }
    loadProjects();
  }, []);

  // Sync speech recognition segments into our segments state
  useEffect(() => {
    if (speech.segments.length === 0) return;

    const latest = speech.segments[speech.segments.length - 1];
    setSegments((prev) => {
      // Check if this segment already exists
      const exists = prev.some((s) => s.id === latest.id);
      if (exists) return prev;

      const newSeg = { ...latest, tag: activeTag };
      return [...prev, newSeg];
    });

    // Auto-generate session title from first words
    if (!sessionTitle && speech.segments.length >= 1) {
      const firstText = speech.segments[0].text.slice(0, 60);
      setSessionTitle(firstText + (speech.segments[0].text.length > 60 ? "..." : ""));
    }

    // Feed new segments to the AI companion
    const newSegments = speech.segments.slice(lastCompanionIdx.current);
    if (newSegments.length > 0) {
      const chunk = newSegments.map((s) => s.text).join(" ");
      companion.sendChunk(chunk, speech.fullTranscript);
      lastCompanionIdx.current = speech.segments.length;
    }
  }, [speech.segments, activeTag, sessionTitle, speech.fullTranscript, companion]);

  // Also show interim text as a live segment
  const displaySegments: TranscriptSegment[] = speech.interimSegment
    ? [...segments, { ...speech.interimSegment, tag: activeTag }]
    : segments;

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    setSegments([]);
    companion.clearMessages();
    lastCompanionIdx.current = 0;
    speech.clearSegments();

    await recorder.start();

    // Start speech recognition; detect browser speech API support
    if (speech.isAvailable) {
      speech.start();
    }
  }, [recorder, speech, companion]);

  const handlePause = useCallback(() => {
    recorder.pause();
    speech.stop();

    // Trigger a companion check on pause
    if (segments.length > 0) {
      const recentChunk = segments
        .slice(-3)
        .map((s) => s.text)
        .join(" ");
      companion.triggerCheck(recentChunk, speech.fullTranscript);
    }
  }, [recorder, speech, segments, companion]);

  const handleResume = useCallback(() => {
    recorder.resume();
    if (speech.isAvailable) {
      speech.start();
    }
  }, [recorder, speech]);

  const handleStop = useCallback(async () => {
    speech.stop();
    await recorder.stop();
    setSegments((prev) => prev.map((s) => ({ ...s, isFinal: true })));
    setView("summary");
  }, [recorder, speech]);

  const handleDiscard = useCallback(() => {
    if (!confirm("Discard this recording? This cannot be undone.")) return;
    setSegments([]);
    companion.clearMessages();
    setSessionTitle("");
    setView("recording");
  }, [companion]);

  const handleSaveSession = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!selectedProject) {
      alert("Please select a project first.");
      return;
    }

    // Create session
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        project_id: selectedProject,
        user_id: user.id,
        title: sessionTitle || "Untitled Session",
        duration_seconds: recorder.duration,
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sessionErr || !session) {
      alert("Failed to save session: " + (sessionErr?.message || "Unknown error"));
      return;
    }

    // Create a single voice_note entry with the full transcript
    const fullText = segments.map((s) => s.text).join("\n");

    await supabase.from("entries").insert({
      session_id: session.id,
      project_id: selectedProject,
      user_id: user.id,
      entry_type: "voice_note",
      title: sessionTitle || "Recording transcript",
      content: fullText,
      raw_transcript: fullText,
      tags: [...new Set(segments.filter((s) => s.tag).map((s) => s.tag!))],
    });

    router.push("/entries");
  }, [selectedProject, sessionTitle, recorder.duration, segments, router]);

  const applyQuickTag = useCallback(
    (tag: TranscriptTag) => {
      if (activeTag === tag) {
        setActiveTag(undefined);
        return;
      }
      setActiveTag(tag);

      // Tag the most recent segment
      setSegments((prev) => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], tag };
        return copy;
      });

      // Trigger companion check on tag
      const recentChunk = segments
        .slice(-2)
        .map((s) => s.text)
        .join(" ");
      companion.triggerCheck(
        `[Tagged as ${tag}] ${recentChunk}`,
        speech.fullTranscript
      );
    },
    [activeTag, segments, companion, speech.fullTranscript]
  );

  const handleSegmentUpdate = useCallback(
    (id: string, text: string) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, text } : s))
      );
    },
    []
  );

  const handleTagChange = useCallback(
    (id: string, tag: TranscriptTag | undefined) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, tag } : s))
      );
    },
    []
  );

  // ── RECORDING VIEW ────────────────────────────────────────────────────

  if (view === "recording") {
    const isRecording = recorder.state === "recording";
    const isPaused = recorder.state === "paused";
    const isIdle = recorder.state === "idle";

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 h-14 border-b border-border/40 bg-white shrink-0">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-heading text-base font-semibold text-foreground">
            {isIdle ? "New Recording" : sessionTitle || "Recording..."}
          </h1>
          <div className="w-16" />
        </header>

        {/* 3-column layout */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT — Session Info */}
          <aside className="w-56 border-r border-border/30 bg-white p-4 flex flex-col gap-5 shrink-0 overflow-y-auto">
            {/* Project selector */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
                <Folder className="w-3 h-3" />
                Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Session title */}
            <div>
              <label className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2 block">
                Session Title
              </label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Auto-generated..."
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted/50"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted uppercase tracking-wider mb-1">
                <Clock className="w-3 h-3" />
                Duration
              </label>
              <p className="text-3xl font-heading font-light tabular-nums text-foreground tracking-tight">
                {formatDuration(recorder.duration)}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {isIdle && "Ready"}
                {isRecording && "Recording"}
                {isPaused && "Paused"}
                {recorder.state === "processing" && "Processing..."}
              </p>
            </div>

            {/* Quick tags */}
            {(isRecording || isPaused) && (
              <div>
                <label className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2 block">
                  Quick Tag
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TAGS.map((qt) => (
                    <button
                      key={qt.tag}
                      onClick={() => applyQuickTag(qt.tag)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all cursor-pointer ${
                        activeTag === qt.tag ? qt.activeColor : qt.color
                      }`}
                    >
                      {qt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Speech API status */}
            {!speech.isAvailable && (isRecording || isPaused) && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                Live transcription requires Chrome. Recording audio only.
              </div>
            )}

            {recorder.error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {recorder.error}
              </div>
            )}
          </aside>

          {/* CENTER — Voice & Transcript */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mic area */}
            <div className="flex flex-col items-center justify-center py-8 shrink-0">
              {/* Mic button with pulse */}
              <div className="relative mb-4">
                {isRecording && (
                  <>
                    <div
                      className="absolute inset-0 rounded-full bg-primary"
                      style={{
                        animation: "pulse-ring 2s ease-out infinite",
                      }}
                    />
                    <div
                      className="absolute inset-0 rounded-full bg-primary"
                      style={{
                        animation: "pulse-ring 2s ease-out infinite 0.7s",
                      }}
                    />
                  </>
                )}
                <button
                  onClick={
                    isIdle
                      ? handleStart
                      : isRecording
                        ? handlePause
                        : isPaused
                          ? handleResume
                          : undefined
                  }
                  className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 cursor-pointer ${
                    isRecording
                      ? "bg-primary shadow-lg"
                      : isPaused
                        ? "bg-sidebar-active shadow-md"
                        : "bg-border hover:bg-muted/30"
                  }`}
                  style={
                    isRecording
                      ? { animation: "breathe 3s ease-in-out infinite" }
                      : undefined
                  }
                >
                  {isIdle && <Mic className="w-8 h-8 text-white" />}
                  {isRecording && <Mic className="w-8 h-8 text-white" />}
                  {isPaused && <Play className="w-8 h-8 text-white ml-1" />}
                </button>
              </div>

              <p className="text-xs text-muted mb-4">
                {isIdle && "Tap to start recording"}
                {isRecording && "Tap to pause"}
                {isPaused && "Tap to resume"}
              </p>

              {/* Waveform */}
              <div className="w-full max-w-md h-16 px-8">
                <AudioWaveform
                  analyserNode={recorder.analyserNode}
                  state={recorder.state}
                />
              </div>

              {/* Stop button */}
              {(isRecording || isPaused) && (
                <button
                  onClick={handleStop}
                  className="mt-4 flex items-center gap-2 px-5 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop Recording
                </button>
              )}
            </div>

            {/* Transcript area */}
            <div className="flex-1 min-h-0 border-t border-border/30">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 bg-white">
                <h2 className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Transcript
                </h2>
                <span className="text-[11px] text-muted tabular-nums">
                  {segments.length} segment{segments.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-[calc(100%-32px)] overflow-y-auto">
                {displaySegments.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted">
                    {isIdle
                      ? "Start recording to see the transcript here"
                      : "Listening..."}
                  </div>
                ) : (
                  <TranscriptView
                    segments={displaySegments}
                    isRecording={isRecording}
                    onSegmentUpdate={handleSegmentUpdate}
                    onTagChange={handleTagChange}
                  />
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — AI Companion */}
          <aside className="w-80 border-l border-border/30 shrink-0 overflow-hidden">
            <AICompanionPanel
              messages={companion.messages}
              isThinking={companion.isThinking}
              isRecording={isRecording || isPaused}
            />
          </aside>
        </div>
      </div>
    );
  }

  // ── SUMMARY VIEW ──────────────────────────────────────────────────────

  const fullTranscriptText = segments.map((s) => s.text).join("\n");
  const taggedSegments = segments.filter((s) => s.tag);
  const tags = [...new Set(taggedSegments.map((s) => s.tag!))].map((t) => ({
    label: t,
  }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-border/40 bg-white shrink-0">
        <h1 className="font-heading text-lg font-semibold text-foreground">
          Session Summary
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDiscard}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground border border-border rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button
            onClick={handleSaveSession}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Save Session
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 text-center shadow-[var(--card-shadow)]">
              <p className="text-2xl font-heading font-semibold">
                {formatDuration(recorder.duration)}
              </p>
              <p className="text-xs text-muted mt-1">Duration</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-[var(--card-shadow)]">
              <p className="text-2xl font-heading font-semibold">
                {segments.length}
              </p>
              <p className="text-xs text-muted mt-1">Segments</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-[var(--card-shadow)]">
              <p className="text-2xl font-heading font-semibold">
                {taggedSegments.length}
              </p>
              <p className="text-xs text-muted mt-1">Tagged</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-[var(--card-shadow)]">
              <p className="text-2xl font-heading font-semibold">
                {companion.messages.length}
              </p>
              <p className="text-xs text-muted mt-1">AI Insights</p>
            </div>
          </div>

          {/* Audio playback */}
          {recorder.audioBlob && (
            <div className="bg-white rounded-xl p-4 shadow-[var(--card-shadow)]">
              <h2 className="text-sm font-heading font-semibold mb-3">
                Audio Recording
              </h2>
              <audio
                controls
                src={URL.createObjectURL(recorder.audioBlob)}
                className="w-full"
              />
            </div>
          )}

          {/* AI Companion insights from this session */}
          {companion.messages.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-[var(--card-shadow)]">
              <h2 className="flex items-center gap-2 text-sm font-heading font-semibold mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Insights During Session
              </h2>
              <div className="space-y-2">
                {companion.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="px-3 py-2 rounded-lg bg-background border border-border/30 text-sm"
                  >
                    {msg.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Processing */}
          <div className="bg-white rounded-xl shadow-[var(--card-shadow)]">
            <button
              onClick={() => setShowAIProcessing(!showAIProcessing)}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border-2 border-dashed border-primary/30 text-primary font-heading font-semibold hover:bg-primary-light/50 transition-colors cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              {showAIProcessing
                ? "Hide AI Processing"
                : "Process with AI — Extract Entries & Find Connections"}
            </button>

            {showAIProcessing && (
              <div className="p-4 border-t border-border/30">
                <AiProcessingPanel
                  transcript={fullTranscriptText}
                  tags={tags}
                  sessionId="new"
                  projectContext=""
                />
              </div>
            )}
          </div>

          {/* Save to project */}
          <div className="bg-white rounded-xl p-4 shadow-[var(--card-shadow)]">
            <label className="block text-sm font-heading font-semibold mb-2">
              Save to Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select a project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Full transcript */}
          <div className="bg-white rounded-xl shadow-[var(--card-shadow)]">
            <div className="px-4 py-3 border-b border-border/30">
              <h2 className="text-sm font-heading font-semibold">
                Full Transcript
              </h2>
            </div>
            <div className="h-[400px]">
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
