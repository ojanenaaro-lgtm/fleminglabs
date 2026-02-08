"use client";

import { useState, useMemo } from "react";
import { Sparkles, Plus, Search } from "lucide-react";
import { ConnectionCard } from "./connection-card";
import type {
  ConnectionStatus,
  ConnectionType,
  ConnectionWithEntries,
} from "@/lib/types";

/* ── props ────────────────────────────────────────────────────────────── */

interface ConnectionFeedProps {
  connections: ConnectionWithEntries[];
  activeTypes: ConnectionType[];
  minConfidence: number;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onExplore: (connection: ConnectionWithEntries) => void;
  onManualCreate?: () => void;
}

/* ── component ───────────────────────────────────────────────────────── */

export function ConnectionFeed({
  connections,
  activeTypes,
  minConfidence,
  onConfirm,
  onDismiss,
  onExplore,
  onManualCreate,
}: ConnectionFeedProps) {
  const [statusFilter, setStatusFilter] = useState<
    "all" | ConnectionStatus
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  /* filtered connections --------------------------------------------- */

  const filtered = useMemo(() => {
    let result = connections.filter(
      (c) =>
        activeTypes.includes(c.connection_type) &&
        (c.confidence ?? 0) >= minConfidence
    );

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.reasoning?.toLowerCase().includes(q) ||
          c.source_entry.content?.toLowerCase().includes(q) ||
          c.target_entry.content?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [connections, activeTypes, minConfidence, statusFilter, searchQuery]);

  /* counts ----------------------------------------------------------- */

  const counts = useMemo(() => {
    const base = connections.filter(
      (c) =>
        activeTypes.includes(c.connection_type) &&
        (c.confidence ?? 0) >= minConfidence
    );
    return {
      all: base.length,
      pending: base.filter((c) => c.status === "pending").length,
      confirmed: base.filter((c) => c.status === "confirmed").length,
      dismissed: base.filter((c) => c.status === "dismissed").length,
    };
  }, [connections, activeTypes, minConfidence]);

  /* detect "new" connections (< 1 hour old) -------------------------- */

  const oneHourAgo = Date.now() - 3600000;
  const isNew = (c: ConnectionWithEntries) =>
    new Date(c.created_at).getTime() > oneHourAgo;

  /* status tabs ------------------------------------------------------ */

  const tabs: { key: "all" | ConnectionStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "dismissed", label: "Dismissed" },
  ];

  return (
    <div className="space-y-4">
      {/* search + tabs row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connections..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border/60 bg-white
              placeholder:text-muted/50 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        {/* status tabs */}
        <div className="flex items-center gap-1 bg-surface/60 rounded-lg p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`
                px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer
                ${
                  statusFilter === tab.key
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }
              `}
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-60">
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* manual connection prompt */}
      <button
        onClick={onManualCreate}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border/60
          bg-white/50 hover:bg-primary-light/30 hover:border-primary/30 transition-colors group cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center
          group-hover:bg-primary/10 transition-colors">
          <Plus className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
        </div>
        <div className="text-left">
          <p className="text-xs font-medium text-foreground">
            &ldquo;This reminds me of...&rdquo;
          </p>
          <p className="text-[10px] text-muted">
            Manually create a connection between two entries
          </p>
        </div>
      </button>

      {/* connection list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-8 h-8 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">
            {statusFilter === "all"
              ? "No connections match your filters"
              : `No ${statusFilter} connections`}
          </p>
          <p className="text-xs text-muted/60 mt-1">
            Try adjusting your filters or recording more entries
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((connection, i) => (
            <div key={connection.id} style={{ animationDelay: `${i * 50}ms` }}>
              <ConnectionCard
                connection={connection}
                isNew={isNew(connection)}
                onConfirm={onConfirm}
                onDismiss={onDismiss}
                onExplore={onExplore}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
