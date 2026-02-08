"use client";

import { useState, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EntryType } from "@/lib/types";
import type { EntryWithRelations } from "../actions";
import { updateEntry, deleteEntries } from "../actions";
import {
  ArrowLeft,
  Mic,
  Eye,
  Ruler,
  ClipboardList,
  MessageSquare,
  Play,
  Pause,
  Tag,
  X,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Link2,
  BookOpen,
  Clock,
  Lightbulb,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

// ── Entry type config ────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  EntryType,
  { label: string; color: string; bg: string; icon: typeof Mic }
> = {
  voice_note: {
    label: "Voice Note",
    color: "text-green-700",
    bg: "bg-green-50",
    icon: Mic,
  },
  observation: {
    label: "Observation",
    color: "text-blue-700",
    bg: "bg-blue-50",
    icon: Eye,
  },
  measurement: {
    label: "Measurement",
    color: "text-amber-700",
    bg: "bg-amber-50",
    icon: Ruler,
  },
  protocol_step: {
    label: "Protocol",
    color: "text-gray-700",
    bg: "bg-gray-100",
    icon: ClipboardList,
  },
  annotation: {
    label: "Annotation",
    color: "text-purple-700",
    bg: "bg-purple-50",
    icon: MessageSquare,
  },
  hypothesis: {
    label: "Hypothesis",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    icon: Lightbulb,
  },
  anomaly: {
    label: "Anomaly",
    color: "text-red-700",
    bg: "bg-red-50",
    icon: AlertTriangle,
  },
  idea: {
    label: "Idea",
    color: "text-teal-700",
    bg: "bg-teal-50",
    icon: Sparkles,
  },
};

// ── Transcript Section (extracted to avoid type-widening in JSX) ──────────

function TranscriptSection({
  transcript,
  open,
  onToggle,
}: {
  transcript: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold font-heading cursor-pointer hover:bg-surface/50 transition-colors rounded-xl"
      >
        <span>Raw Transcript</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted" />
        )}
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-border/50">
          <pre className="mt-4 text-xs text-muted leading-relaxed whitespace-pre-wrap font-body bg-surface rounded-lg p-4 max-h-80 overflow-y-auto">
            {transcript}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────

interface EntryDetailProps {
  entry: EntryWithRelations;
}

// ── Component ────────────────────────────────────────────────────────────

export function EntryDetail({ entry }: EntryDetailProps) {
  const router = useRouter();
  const cfg = TYPE_CONFIG[entry.entry_type];
  const Icon = cfg.icon;

  // Derive typed values for JSX (server action boundary may widen types)
  const rawTranscript: string | null = typeof entry.raw_transcript === "string" ? entry.raw_transcript : null;
  const audioUrl: string | null = typeof entry.audio_url === "string" ? entry.audio_url : null;
  const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
  const hasMetadata = Object.keys(metadata).length > 0;

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(entry.content ?? "");
  const [saving, setSaving] = useState(false);

  // Tags state
  const [tags, setTags] = useState<string[]>(entry.tags);
  const [tagInput, setTagInput] = useState("");
  const [editingTags, setEditingTags] = useState(false);

  // Transcript collapse
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  // Audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const result = await updateEntry(entry.id, { content: editContent });
    if (result.success) {
      setEditing(false);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleAddTag() {
    const newTag = tagInput.trim().toLowerCase();
    if (!newTag || tags.includes(newTag)) {
      setTagInput("");
      return;
    }
    const updated = [...tags, newTag];
    setTags(updated);
    setTagInput("");
    await updateEntry(entry.id, { tags: updated });
  }

  async function handleRemoveTag(tag: string) {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    await updateEntry(entry.id, { tags: updated });
  }

  async function handleDelete() {
    const result = await deleteEntries([entry.id]);
    if (result.success) {
      router.push("/entries");
    }
  }

  function toggleAudio() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Pre-compute conditional sections with explicit ReactNode type
  const transcriptBlock: ReactNode = rawTranscript ? (
    <TranscriptSection
      transcript={rawTranscript}
      open={transcriptOpen}
      onToggle={() => setTranscriptOpen(!transcriptOpen)}
    />
  ) : null;

  const audioBlock: ReactNode = audioUrl ? (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleAudio}
          className="w-12 h-12 rounded-full bg-primary flex items-center justify-center hover:bg-primary-hover transition-colors cursor-pointer shrink-0"
        >
          {playing ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>
        <div className="flex-1 space-y-2">
          <div
            className="relative h-2 bg-surface rounded-full cursor-pointer"
            onClick={(e) => {
              if (!audioRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              audioRef.current.currentTime = ratio * audioDuration;
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
              style={{
                width: `${audioDuration > 0 ? (audioTime / audioDuration) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex items-end gap-[2px] h-8">
            {Array.from({ length: 60 }, (_, i) => {
              const progress = audioDuration > 0 ? audioTime / audioDuration : 0;
              const barProgress = i / 60;
              const active = barProgress <= progress;
              const h = 20 + ((i * 7 + 3) % 80);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-colors ${active ? "bg-primary" : "bg-border"}`}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-muted tabular-nums">
            <span>{formatTime(audioTime)}</span>
            <span>{formatTime(audioDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Link
          href="/entries"
          className="p-2 rounded-lg hover:bg-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
            <span className="text-xs text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(entry.created_at)}
            </span>
          </div>
          <p className="text-xs text-muted">
            Session:{" "}
            <span className="text-foreground font-medium">
              {String(entry.session_title || entry.session_id).slice(0, entry.session_title ? undefined : 8)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-white text-sm font-medium hover:bg-surface transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* ── Audio Player (voice entries only) ────────────────────────── */}
      {audioBlock}
      {audioUrl !== null ? (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() =>
            setAudioTime(audioRef.current?.currentTime ?? 0)
          }
          onLoadedMetadata={() =>
            setAudioDuration(audioRef.current?.duration ?? 0)
          }
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      ) : null}

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="text-sm font-semibold font-heading mb-4">Content</h2>
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditContent(entry.content ?? "");
                }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="prose-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {(entry.content as string | null) ?? (
              <span className="text-muted italic">No content</span>
            )}
          </div>
        )}
      </div>

      {/* ── Raw Transcript (collapsible) ─────────────────────────────── */}
      {transcriptBlock}

      {/* ── Tags ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold font-heading flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted" />
            Tags
          </h2>
          <button
            onClick={() => setEditingTags(!editingTags)}
            className="text-xs text-muted hover:text-primary transition-colors cursor-pointer"
          >
            {editingTags ? "Done" : "Edit"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary-light text-primary"
            >
              {tag}
              {editingTags && (
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {tags.length === 0 && !editingTags && (
            <span className="text-xs text-muted italic">No tags</span>
          )}
          {editingTags && (
            <div className="inline-flex items-center gap-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag..."
                className="w-28 px-2.5 py-1.5 rounded-full text-xs border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleAddTag}
                className="p-1 rounded-full hover:bg-primary-light text-muted hover:text-primary transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Metadata ─────────────────────────────────────────────────── */}
      {hasMetadata && (
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="text-sm font-semibold font-heading mb-4">Metadata</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {Object.entries(metadata).map(([key, value]) => (
              <div key={key}>
                <dt className="text-[11px] uppercase tracking-wider text-muted mb-0.5">
                  {key.replace(/_/g, " ")}
                </dt>
                <dd className="text-sm font-medium">
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* ── Connections ──────────────────────────────────────────────── */}
      {entry.connections.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="text-sm font-semibold font-heading flex items-center gap-2 mb-4">
            <Link2 className="w-4 h-4 text-muted" />
            Connections
            <span className="text-xs font-normal text-muted">
              ({entry.connections.length})
            </span>
          </h2>
          <div className="space-y-3">
            {entry.connections.map((conn) => {
              const linked = conn.linked_entry;
              const linkedCfg = TYPE_CONFIG[linked.entry_type];
              const LinkedIcon = linkedCfg.icon;

              return (
                <Link
                  key={conn.id}
                  href={`/entries/${linked.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary-light/30 transition-all"
                >
                  <div
                    className={`shrink-0 w-8 h-8 rounded-lg ${linkedCfg.bg} flex items-center justify-center mt-0.5`}
                  >
                    <LinkedIcon className={`w-3.5 h-3.5 ${linkedCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${linkedCfg.bg} ${linkedCfg.color}`}
                      >
                        {linkedCfg.label}
                      </span>
                      <span className="text-[11px] text-muted capitalize">
                        {conn.connection_type.replace(/_/g, " ")}
                      </span>
                      {conn.confidence != null && (
                        <span className="text-[10px] text-muted ml-auto">
                          {Math.round(conn.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">
                      {linked.content || "No content"}
                    </p>
                    {conn.reasoning && (
                      <p className="text-xs text-muted mt-1 italic">
                        {conn.reasoning}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Related Literature (AI-found) ────────────────────────────── */}
      {Array.isArray(metadata.related_papers) &&
        (metadata.related_papers as unknown[]).length > 0 ? (
          <div className="bg-white rounded-xl border border-border p-6">
            <h2 className="text-sm font-semibold font-heading flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-muted" />
              Related Literature
            </h2>
            <div className="space-y-3">
              {(
                metadata.related_papers as {
                  title: string;
                  authors?: string;
                  url?: string;
                  summary?: string;
                }[]
              ).map((paper, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-border/50 space-y-1"
                >
                  {paper.url ? (
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {paper.title}
                    </a>
                  ) : (
                    <p className="text-sm font-medium">{paper.title}</p>
                  )}
                  {paper.authors && (
                    <p className="text-xs text-muted">{paper.authors}</p>
                  )}
                  {paper.summary && (
                    <p className="text-xs text-muted leading-relaxed">
                      {paper.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

      {/* ── Delete Confirmation Modal ────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold font-heading">Delete Entry</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1 rounded-md hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted">
              Are you sure you want to delete this entry? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
