"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { TranscriptSegment, TranscriptTag } from "@/lib/types";

// ── Tag styling ──────────────────────────────────────────────────────────

const TAG_COLORS: Record<TranscriptTag, { border: string; bg: string; text: string }> = {
  observation:    { border: "border-l-green-600",  bg: "bg-green-100",  text: "text-green-800"  },
  measurement:    { border: "border-l-blue-600",   bg: "bg-blue-100",   text: "text-blue-800"   },
  protocol_step:  { border: "border-l-amber-500",  bg: "bg-amber-100",  text: "text-amber-800"  },
  hypothesis:     { border: "border-l-indigo-500", bg: "bg-indigo-100", text: "text-indigo-800" },
  anomaly:        { border: "border-l-red-500",    bg: "bg-red-100",    text: "text-red-800"    },
  idea:           { border: "border-l-purple-600", bg: "bg-purple-100", text: "text-purple-800" },
};

const TAG_LABELS: Record<TranscriptTag, string> = {
  observation: "Observation",
  measurement: "Measurement",
  protocol_step: "Protocol Step",
  hypothesis: "Hypothesis",
  anomaly: "Anomaly",
  idea: "Idea",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ── Props ────────────────────────────────────────────────────────────────

type TranscriptViewProps = {
  segments: TranscriptSegment[];
  isRecording?: boolean;
  onSegmentUpdate?: (id: string, text: string) => void;
  onTagChange?: (id: string, tag: TranscriptTag | undefined) => void;
  onExportText?: () => void;
  onExportJSON?: () => void;
};

// ── Component ────────────────────────────────────────────────────────────

export default function TranscriptView({
  segments,
  isRecording = false,
  onSegmentUpdate,
  onTagChange,
  onExportText,
  onExportJSON,
}: TranscriptViewProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when recording
  useEffect(() => {
    if (isRecording && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [segments, isRecording]);

  // Filter segments by search
  const filteredSegments = search
    ? segments.filter((s) =>
        s.text.toLowerCase().includes(search.toLowerCase())
      )
    : segments;

  // Start inline edit
  const startEdit = useCallback(
    (segment: TranscriptSegment) => {
      if (!onSegmentUpdate) return;
      setEditingId(segment.id);
      setEditText(segment.text);
    },
    [onSegmentUpdate]
  );

  // Commit inline edit
  const commitEdit = useCallback(() => {
    if (editingId && onSegmentUpdate && editText.trim()) {
      onSegmentUpdate(editingId, editText.trim());
    }
    setEditingId(null);
    setEditText("");
  }, [editingId, editText, onSegmentUpdate]);

  // Cancel inline edit on Escape
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        setEditingId(null);
        setEditText("");
      }
    },
    [commitEdit]
  );

  return (
    <div className="flex flex-col h-full font-body">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-input-bg">
        <input
          type="text"
          placeholder="Search transcript…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        {(onExportText || onExportJSON) && (
          <div className="flex gap-1">
            {onExportText && (
              <button
                onClick={onExportText}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-primary-light transition-colors"
              >
                Export .txt
              </button>
            )}
            {onExportJSON && (
              <button
                onClick={onExportJSON}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-primary-light transition-colors"
              >
                Export .json
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Segment list ────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2">
        {filteredSegments.length === 0 ? (
          <p className="text-center text-muted text-sm py-8">
            {search
              ? "No segments match your search."
              : isRecording
                ? "Listening…"
                : "No transcript segments yet."}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredSegments.map((segment) => {
              const tagStyle = segment.tag
                ? TAG_COLORS[segment.tag]
                : null;

              return (
                <li
                  key={segment.id}
                  className={`flex items-start gap-3 px-3 py-2 rounded-md border-l-4 transition-colors ${
                    tagStyle
                      ? `${tagStyle.border} bg-input-bg`
                      : "border-l-transparent hover:bg-primary-light/40"
                  } ${!segment.isFinal ? "opacity-60" : ""}`}
                >
                  {/* Timestamp */}
                  <span className="shrink-0 text-xs text-muted tabular-nums pt-0.5 select-none">
                    {formatTimestamp(segment.timestamp)}
                  </span>

                  {/* Text (editable) */}
                  <div className="flex-1 min-w-0">
                    {editingId === segment.id ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleEditKeyDown}
                        className="w-full text-sm px-1 py-0.5 rounded border border-primary bg-background focus:outline-none"
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(segment)}
                        className={`text-sm leading-relaxed ${
                          onSegmentUpdate ? "cursor-text" : ""
                        }`}
                      >
                        {segment.text}
                      </span>
                    )}
                  </div>

                  {/* Tag badge / picker */}
                  <div className="shrink-0 pt-0.5">
                    {onTagChange ? (
                      <select
                        value={segment.tag ?? ""}
                        onChange={(e) =>
                          onTagChange(
                            segment.id,
                            (e.target.value as TranscriptTag) || undefined
                          )
                        }
                        className={`text-xs rounded-full px-2 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                          tagStyle
                            ? `${tagStyle.bg} ${tagStyle.text}`
                            : "bg-background text-muted"
                        }`}
                      >
                        <option value="">—</option>
                        {(
                          Object.entries(TAG_LABELS) as [TranscriptTag, string][]
                        ).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : segment.tag ? (
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${tagStyle?.bg} ${tagStyle?.text}`}
                      >
                        {TAG_LABELS[segment.tag]}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Auto-scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      {isRecording && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-border text-xs text-muted">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording — {segments.length} segment{segments.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
