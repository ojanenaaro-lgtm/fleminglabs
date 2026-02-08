"use client";

import Link from "next/link";
import type { Entry, EntryType } from "@/lib/types";
import {
  Mic,
  Eye,
  Ruler,
  ClipboardList,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

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

interface EntryCardProps {
  entry: Pick<Entry, "id" | "entry_type" | "content" | "tags" | "created_at">;
}

export function EntryCard({ entry }: EntryCardProps) {
  const cfg = TYPE_CONFIG[entry.entry_type];
  const Icon = cfg.icon;

  const preview = entry.content
    ? entry.content.length > 100
      ? entry.content.slice(0, 100) + "..."
      : entry.content
    : "No content";

  const date = new Date(entry.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/entries/${entry.id}`}
      className="block bg-white rounded-xl border border-border p-4 shadow-[var(--card-shadow)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center`}
        >
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
            >
              {cfg.label}
            </span>
            <span className="text-[11px] text-muted tabular-nums ml-auto shrink-0">
              {date}
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed line-clamp-2">
            {preview}
          </p>
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-light text-primary"
                >
                  {tag}
                </span>
              ))}
              {entry.tags.length > 4 && (
                <span className="text-[10px] text-muted self-center">
                  +{entry.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
