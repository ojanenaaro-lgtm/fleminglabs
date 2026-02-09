"use client";

import { useState } from "react";
import { GitBranch, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ConnectionType, ConnectionWithEntries } from "@/lib/types";

/* ── colour map ──────────────────────────────────────────────────────── */

const TYPE_DOT: Record<ConnectionType, string> = {
  pattern: "bg-[#2D5A3D]",
  contradiction: "bg-red-600",
  supports: "bg-blue-600",
  reminds_of: "bg-gray-400",
  same_phenomenon: "bg-amber-600",
  literature_link: "bg-purple-600",
  causal: "bg-orange-600",
  methodological: "bg-cyan-600",
};

/* ── props ────────────────────────────────────────────────────────────── */

interface ConnectionBadgeProps {
  entryId: string;
  connections: ConnectionWithEntries[];
}

/* ── component ───────────────────────────────────────────────────────── */

export function ConnectionBadge({
  entryId,
  connections,
}: ConnectionBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const related = connections.filter(
    (c) => c.source_entry_id === entryId || c.target_entry_id === entryId
  );

  if (related.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-white shadow-[var(--card-shadow)]">
      {/* summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <GitBranch className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">
            {related.length} connection{related.length !== 1 ? "s" : ""} found
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted" />
        )}
      </button>

      {/* expanded list */}
      {expanded && (
        <div className="border-t border-border/30 px-3.5 py-2 space-y-1.5">
          {related.slice(0, 5).map((c) => {
            const otherEntry =
              c.source_entry_id === entryId
                ? c.target_entry
                : c.source_entry;
            const dotClass =
              TYPE_DOT[c.connection_type] || "bg-gray-400";

            return (
              <div
                key={c.id}
                className="flex items-start gap-2 py-1.5 group"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotClass}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground line-clamp-1">
                    {otherEntry.content || "Untitled entry"}
                  </p>
                  <p className="text-[10px] text-muted capitalize">
                    {c.connection_type.replace("_", " ")} &middot;{" "}
                    {Math.round((c.confidence ?? 0) * 100)}%
                  </p>
                </div>
              </div>
            );
          })}

          {related.length > 5 && (
            <p className="text-[10px] text-muted pl-3.5">
              +{related.length - 5} more
            </p>
          )}

          <Link
            href="/connections"
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover
              transition-colors mt-1 pt-1.5 border-t border-border/20"
          >
            View all connections
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
