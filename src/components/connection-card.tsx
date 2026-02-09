"use client";

import { useState } from "react";
import {
  ArrowDown,
  Check,
  X,
  Compass,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  ConnectionType,
  ConnectionStatus,
  ConnectionWithEntries,
} from "@/lib/types";

/* ── colour & label maps ─────────────────────────────────────────────── */

const TYPE_STYLES: Record<
  ConnectionType,
  { bg: string; text: string; label: string }
> = {
  pattern: { bg: "bg-[#e8f0eb]", text: "text-[#2D5A3D]", label: "Pattern" },
  contradiction: {
    bg: "bg-red-50",
    text: "text-red-700",
    label: "Contradiction",
  },
  supports: { bg: "bg-blue-50", text: "text-blue-700", label: "Supports" },
  reminds_of: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: "Reminds of",
  },
  same_phenomenon: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Same phenomenon",
  },
  literature_link: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    label: "Literature link",
  },
  causal: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    label: "Causal",
  },
  methodological: {
    bg: "bg-lime-50",
    text: "text-lime-700",
    label: "Methodological",
  },
};

/* ── props ────────────────────────────────────────────────────────────── */

interface ConnectionCardProps {
  connection: ConnectionWithEntries;
  isNew?: boolean;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onExplore: (connection: ConnectionWithEntries) => void;
}

/* ── component ───────────────────────────────────────────────────────── */

export function ConnectionCard({
  connection,
  isNew,
  onConfirm,
  onDismiss,
  onExplore,
}: ConnectionCardProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  const c = connection;
  const style = TYPE_STYLES[c.connection_type] || TYPE_STYLES.reminds_of;
  const confidence = Math.round((c.confidence ?? 0) * 100);
  const isConfirmed = c.status === "confirmed";
  const isDismissed = c.status === "dismissed";

  return (
    <div
      className={`
        bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)]
        transition-all duration-200 connection-card-enter
        ${isNew ? "connection-new" : ""}
        ${isDismissed ? "opacity-50" : ""}
      `}
    >
      {/* header: type badge + confidence */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
        <div className="flex items-center gap-2">
          {isConfirmed && (
            <span className="text-[10px] font-medium text-primary flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Confirmed
            </span>
          )}
          <span className="text-[11px] text-muted tabular-nums">
            {confidence}%
          </span>
        </div>
      </div>

      {/* entries: source → target */}
      <div className="px-4 pb-3 space-y-2">
        {/* source */}
        <div className="bg-surface/60 rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
            {c.source_entry.content || "Untitled entry"}
          </p>
          <span className="text-[10px] text-muted capitalize mt-0.5 block">
            {c.source_entry.entry_type.replace("_", " ")}
          </span>
        </div>

        {/* arrow */}
        <div className="flex justify-center">
          <ArrowDown className="w-3.5 h-3.5 text-muted/50" />
        </div>

        {/* target */}
        <div className="bg-surface/60 rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
            {c.target_entry.content || "Untitled entry"}
          </p>
          <span className="text-[10px] text-muted capitalize mt-0.5 block">
            {c.target_entry.entry_type.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* reasoning */}
      {c.reasoning && (
        <div className="px-4 pb-3">
          <button
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
            className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            Why this connection?
            {reasoningExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          {reasoningExpanded && (
            <p className="text-xs text-muted leading-relaxed mt-1.5 pl-0.5">
              {c.reasoning}
            </p>
          )}
        </div>
      )}

      {/* confidence bar */}
      <div className="px-4 pb-3">
        <div className="w-full h-1 rounded-full bg-surface overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${confidence}%`,
              backgroundColor:
                confidence >= 70
                  ? "#2D5A3D"
                  : confidence >= 40
                    ? "#d97706"
                    : "#9ca3af",
            }}
          />
        </div>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={() => onConfirm(c.id)}
          disabled={isConfirmed}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
            transition-colors cursor-pointer
            ${
              isConfirmed
                ? "bg-primary/10 text-primary"
                : "bg-surface hover:bg-primary-light text-muted hover:text-primary"
            }
          `}
        >
          <Check className="w-3 h-3" />
          {isConfirmed ? "Confirmed" : "Confirm"}
        </button>

        <button
          onClick={() => onDismiss(c.id)}
          disabled={isDismissed}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
            bg-surface hover:bg-red-50 text-muted hover:text-red-600 transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
          Dismiss
        </button>

        <button
          onClick={() => onExplore(c)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
            bg-surface hover:bg-primary-light text-muted hover:text-primary transition-colors cursor-pointer ml-auto"
        >
          <Compass className="w-3 h-3" />
          Explore
        </button>
      </div>
    </div>
  );
}
