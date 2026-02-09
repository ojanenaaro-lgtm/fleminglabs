"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Eye,
  Ruler,
  ClipboardList,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import type { EntryType } from "@/lib/types";
import { createEntry, fetchSessions } from "../actions";

const ENTRY_TYPES: {
  value: EntryType;
  label: string;
  icon: typeof Mic;
  color: string;
  bg: string;
}[] = [
  { value: "voice_note", label: "Voice Note", icon: Mic, color: "text-green-700", bg: "bg-green-50" },
  { value: "observation", label: "Observation", icon: Eye, color: "text-blue-700", bg: "bg-blue-50" },
  { value: "measurement", label: "Measurement", icon: Ruler, color: "text-amber-700", bg: "bg-amber-50" },
  { value: "protocol_step", label: "Protocol", icon: ClipboardList, color: "text-gray-700", bg: "bg-gray-100" },
  { value: "annotation", label: "Annotation", icon: MessageSquare, color: "text-purple-700", bg: "bg-purple-50" },
  { value: "hypothesis", label: "Hypothesis", icon: Lightbulb, color: "text-indigo-700", bg: "bg-indigo-50" },
  { value: "anomaly", label: "Anomaly", icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50" },
  { value: "idea", label: "Idea", icon: Sparkles, color: "text-teal-700", bg: "bg-teal-50" },
];

export default function NewEntryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<{ id: string; title: string | null }[]>([]);
  const [selectedType, setSelectedType] = useState<EntryType>("observation");
  const [content, setContent] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions().then(setSessions);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sessionId) {
      setError("Please select a session.");
      return;
    }
    if (!content.trim()) {
      setError("Content cannot be empty.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("entry_type", selectedType);
      formData.set("content", content);
      formData.set("session_id", sessionId);
      formData.set("tags", tags);

      const result = await createEntry(formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        // Fire-and-forget: auto-discover connections for the new entry
        fetch("/api/ai/auto-connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entry_id: result.id }),
        }).catch(() => {});
        router.push(`/entries/${result.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted" />
        </button>
        <div>
          <h1 className="text-xl font-semibold font-heading tracking-tight">
            New Entry
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Add a new lab notebook entry
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Entry type selector */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Entry Type
          </label>
          <div className="flex flex-wrap gap-2">
            {ENTRY_TYPES.map((t) => {
              const Icon = t.icon;
              const active = selectedType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSelectedType(t.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                    active
                      ? `${t.bg} ${t.color} border-current/20 ring-1 ring-current/20`
                      : "bg-white border-border text-muted hover:text-foreground hover:border-border"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Session selector */}
        <div>
          <label
            htmlFor="session"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Session
          </label>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted">
              No sessions found. Create a session first before adding entries.
            </p>
          ) : (
            <select
              id="session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            >
              <option value="">Select a session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || s.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Content */}
        <div>
          <label
            htmlFor="content"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Write your entry content here..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-y"
          />
        </div>

        {/* Tags */}
        <div>
          <label
            htmlFor="tags"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Tags
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. enzyme, kinetics, pH (comma-separated)"
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          <p className="text-xs text-muted mt-1">
            Separate multiple tags with commas
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || sessions.length === 0}
            className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating..." : "Create Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
