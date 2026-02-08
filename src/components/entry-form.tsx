"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EntryType, Session } from "@/lib/types";
import { createEntry } from "@/app/(dashboard)/entries/actions";
import {
  Mic,
  Eye,
  Ruler,
  ClipboardList,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";

// ── Entry type config ────────────────────────────────────────────────────

const TYPE_OPTIONS: {
  value: EntryType;
  label: string;
  color: string;
  bg: string;
  icon: typeof Mic;
}[] = [
  {
    value: "observation",
    label: "Observation",
    color: "text-blue-700",
    bg: "bg-blue-50",
    icon: Eye,
  },
  {
    value: "measurement",
    label: "Measurement",
    color: "text-amber-700",
    bg: "bg-amber-50",
    icon: Ruler,
  },
  {
    value: "protocol_step",
    label: "Protocol Step",
    color: "text-gray-700",
    bg: "bg-gray-100",
    icon: ClipboardList,
  },
  {
    value: "annotation",
    label: "Annotation",
    color: "text-purple-700",
    bg: "bg-purple-50",
    icon: MessageSquare,
  },
  {
    value: "voice_note",
    label: "Voice Note",
    color: "text-green-700",
    bg: "bg-green-50",
    icon: Mic,
  },
  {
    value: "hypothesis",
    label: "Hypothesis",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    icon: Lightbulb,
  },
  {
    value: "anomaly",
    label: "Anomaly",
    color: "text-red-700",
    bg: "bg-red-50",
    icon: AlertTriangle,
  },
  {
    value: "idea",
    label: "Idea",
    color: "text-teal-700",
    bg: "bg-teal-50",
    icon: Sparkles,
  },
];

// ── Props ────────────────────────────────────────────────────────────────

interface EntryFormProps {
  sessions: Pick<Session, "id" | "title">[];
  quickMode?: boolean;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function EntryForm({
  sessions,
  quickMode = false,
  onSuccess,
  onCancel,
}: EntryFormProps) {
  const router = useRouter();

  const [entryType, setEntryType] = useState<EntryType>("observation");
  const [content, setContent] = useState("");
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Content is required.");
      return;
    }
    if (!sessionId) {
      setError("Please select a session.");
      return;
    }

    setSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.set("entry_type", entryType);
    formData.set("content", content.trim());
    formData.set("session_id", sessionId);
    formData.set("tags", tags.join(","));

    const result = await createEntry(formData);

    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    if (onSuccess) {
      onSuccess(result.id);
    } else {
      router.push(`/entries/${result.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Type selector */}
      <div>
        <label className="block text-xs font-medium text-muted mb-2">
          Entry Type
        </label>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = entryType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEntryType(opt.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? `${opt.bg} ${opt.color} ring-2 ring-current/20`
                    : "bg-surface text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <Icon className="w-4 h-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div>
        <label
          htmlFor="entry-content"
          className="block text-xs font-medium text-muted mb-2"
        >
          Content
        </label>
        <textarea
          id="entry-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={quickMode ? 3 : 8}
          placeholder={
            entryType === "measurement"
              ? "e.g., pH measured at 7.2 in sample A-14 after 30 min incubation..."
              : entryType === "observation"
                ? "e.g., Noticed turbidity increase in control flask compared to treatment..."
                : "Write your entry content..."
          }
          className="w-full px-4 py-3 rounded-lg border border-border bg-white text-sm leading-relaxed placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-y"
        />
      </div>

      {/* Session */}
      {!quickMode && (
        <div>
          <label
            htmlFor="entry-session"
            className="block text-xs font-medium text-muted mb-2"
          >
            Attach to Session
          </label>
          <select
            id="entry-session"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          >
            <option value="" disabled>
              Select a session...
            </option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || `Session ${s.id.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tags */}
      {!quickMode && (
        <div>
          <label className="block text-xs font-medium text-muted mb-2">
            Tags
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-light text-primary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag and press Enter..."
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 py-2 rounded-lg border border-border bg-white text-sm font-medium hover:bg-primary-light transition-colors cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-surface transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors cursor-pointer"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {quickMode ? "Add Entry" : "Create Entry"}
        </button>
      </div>
    </form>
  );
}
