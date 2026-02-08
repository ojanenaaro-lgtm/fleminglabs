"use client";

import Link from "next/link";
import type { Session } from "@/lib/types";
import { Clock, FileText, Play, RotateCcw } from "lucide-react";

interface SessionListProps {
  sessions: Session[];
  projectId: string;
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
  paused: { bg: "bg-amber-50", text: "text-amber-700", label: "Paused" },
  completed: { bg: "bg-sky-50", text: "text-sky-700", label: "Completed" },
};

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function SessionList({ sessions, projectId }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-3">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm text-muted">No sessions yet.</p>
        <p className="text-xs text-muted/70 mt-1">
          Start a recording session to capture your lab work.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {sessions.map((session) => {
        const status = statusStyles[session.status] ?? statusStyles.completed;
        return (
          <div
            key={session.id}
            className="flex items-center gap-4 px-4 py-3 hover:bg-sidebar-hover/50 transition-colors group"
          >
            {/* Icon */}
            <div className="w-9 h-9 rounded-lg bg-primary-light/70 flex items-center justify-center shrink-0">
              <Play className="w-4 h-4 text-primary" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/projects/${projectId}/sessions/${session.id}`}
                  className="text-sm font-medium truncate hover:text-primary transition-colors"
                >
                  {session.title || "Untitled Session"}
                </Link>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.bg} ${status.text}`}
                >
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                <span>{formatDate(session.started_at)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(session.started_at, session.ended_at)}
                </span>
              </div>
            </div>

            {/* Resume button for active/paused */}
            {session.status !== "completed" && (
              <Link
                href={`/sessions/${session.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary-light hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <RotateCcw className="w-3 h-3" />
                Resume
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
