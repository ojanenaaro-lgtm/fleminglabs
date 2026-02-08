"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  GitBranch,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { ConnectionGraph } from "@/components/connection-graph";
import { ConnectionFeed } from "@/components/connection-feed";
import type {
  Entry,
  ConnectionType,
  ConnectionStatus,
  ConnectionWithEntries,
} from "@/lib/types";

/* ── demo data ───────────────────────────────────────────────────────── */

const now = Date.now();
const day = 86_400_000;

const DEMO_ENTRIES: Entry[] = [
  {
    id: "d1",
    session_id: "s1",
    project_id: "p1",
    user_id: "u1",
    entry_type: "observation",
    title: "Unusual crystallization in A3",
    content:
      "Unusual crystallization pattern in sample A3 — needle-like structures forming at the meniscus rather than the expected plate crystals. Temperature was 4\u00b0C.",
    raw_transcript: null,
    audio_url: null,
    metadata: {},
    tags: ["crystallization", "anomaly"],
    created_at: new Date(now - day * 3).toISOString(),
    updated_at: new Date(now - day * 3).toISOString(),
  },
  {
    id: "d2",
    session_id: "s1",
    project_id: "p1",
    user_id: "u1",
    entry_type: "measurement",
    title: "Elevated pH in fermentation",
    content:
      "pH levels elevated during fermentation \u2014 reading 7.8 where expected 6.2. Possible contamination or buffer miscalculation.",
    raw_transcript: null,
    audio_url: null,
    metadata: {},
    tags: ["pH", "fermentation"],
    created_at: new Date(now - day * 2).toISOString(),
    updated_at: new Date(now - day * 2).toISOString(),
  },
  {
    id: "d3",
    session_id: "s2",
    project_id: "p1",
    user_id: "u1",
    entry_type: "protocol_step",
    title: "Centrifuge speed adjustment",
    content:
      "Modified centrifuge protocol: increased speed from 3000 to 4500 RPM for 10 minutes. Pellet formation improved significantly.",
    raw_transcript: null,
    audio_url: null,
    metadata: {},
    tags: ["centrifuge", "protocol"],
    created_at: new Date(now - day * 2).toISOString(),
    updated_at: new Date(now - day * 2).toISOString(),
  },
  {
    id: "d4",
    session_id: "s2",
    project_id: "p1",
    user_id: "u1",
    entry_type: "voice_note",
    title: "Enzyme activity patterns",
    content:
      "Thinking about the enzyme activity patterns we\u2019ve been seeing \u2014 the kinetics don\u2019t match the published Km values. Could be a different isoform.",
    raw_transcript:
      "Thinking about the enzyme activity patterns we've been seeing...",
    audio_url: null,
    metadata: {},
    tags: ["enzyme", "kinetics"],
    created_at: new Date(now - day * 1.5).toISOString(),
    updated_at: new Date(now - day * 1.5).toISOString(),
  },
  {
    id: "d5",
    session_id: "s3",
    project_id: "p1",
    user_id: "u1",
    entry_type: "observation",
    title: "Temperature fluctuation correlation",
    content:
      "Temperature fluctuations in incubator correlate with crystallization anomalies noted earlier. 2\u00b0C drift between 2\u20134am.",
    raw_transcript: null,
    audio_url: null,
    metadata: {},
    tags: ["temperature", "incubator"],
    created_at: new Date(now - day).toISOString(),
    updated_at: new Date(now - day).toISOString(),
  },
  {
    id: "d6",
    session_id: "s3",
    project_id: "p1",
    user_id: "u1",
    entry_type: "observation",
    title: "Protein folding anomaly batch 7",
    content:
      "Protein folding anomaly in batch 7 \u2014 unexpected beta-sheet formation where alpha-helix was predicted. Running CD spectroscopy to confirm.",
    raw_transcript: null,
    audio_url: null,
    metadata: {},
    tags: ["protein", "folding", "anomaly"],
    created_at: new Date(now - day * 0.5).toISOString(),
    updated_at: new Date(now - day * 0.5).toISOString(),
  },
  {
    id: "d7",
    session_id: "s3",
    project_id: "p1",
    user_id: "u1",
    entry_type: "protocol_step",
    title: "Buffer switch to HEPES",
    content:
      "New buffer solution preparation: switched from Tris-HCl to HEPES at 25mM, pH 7.4. Better stability at room temperature.",
    raw_transcript: null,
    audio_url: null,
    metadata: {},
    tags: ["buffer", "HEPES"],
    created_at: new Date(now - day * 0.3).toISOString(),
    updated_at: new Date(now - day * 0.3).toISOString(),
  },
  {
    id: "d8",
    session_id: "s3",
    project_id: "p1",
    user_id: "u1",
    entry_type: "measurement",
    title: "Spectroscopy readings Feb 5",
    content:
      "Spectroscopy readings from Feb 5 show absorption peak shift at 280nm \u2014 consistent with conformational change in the protein sample.",
    raw_transcript: null,
    audio_url: null,
    metadata: {},
    tags: ["spectroscopy", "absorption"],
    created_at: new Date(now - 3600000).toISOString(),
    updated_at: new Date(now - 3600000).toISOString(),
  },
];

const DEMO_CONNECTIONS: ConnectionWithEntries[] = [
  {
    id: "c1",
    source_entry_id: "d1",
    target_entry_id: "d6",
    connection_type: "pattern",
    reasoning:
      "Both entries describe unexpected structural anomalies in separate experiments \u2014 needle-like crystal formation and unexpected beta-sheet folding. These may share a common environmental factor such as temperature instability or buffer composition.",
    confidence: 0.87,
    created_at: new Date(now - day * 0.4).toISOString(),
    status: "pending",
    source_entry: DEMO_ENTRIES[0],
    target_entry: DEMO_ENTRIES[5],
  },
  {
    id: "c2",
    source_entry_id: "d2",
    target_entry_id: "d5",
    connection_type: "supports",
    reasoning:
      "The elevated pH readings during fermentation may be explained by the temperature fluctuations in the incubator. Temperature drift could affect buffering capacity and microbial metabolism rates.",
    confidence: 0.74,
    created_at: new Date(now - day * 0.3).toISOString(),
    status: "pending",
    source_entry: DEMO_ENTRIES[1],
    target_entry: DEMO_ENTRIES[4],
  },
  {
    id: "c3",
    source_entry_id: "d1",
    target_entry_id: "d2",
    connection_type: "reminds_of",
    reasoning:
      "Crystal formation conditions are highly sensitive to pH. The unexpected pH elevation could directly influence crystallization morphology, potentially explaining the needle-like structures observed.",
    confidence: 0.61,
    created_at: new Date(now - day * 0.2).toISOString(),
    status: "confirmed",
    source_entry: DEMO_ENTRIES[0],
    target_entry: DEMO_ENTRIES[1],
  },
  {
    id: "c4",
    source_entry_id: "d3",
    target_entry_id: "d7",
    connection_type: "pattern",
    reasoning:
      "Both protocol modifications represent optimization efforts that improved experimental outcomes. The centrifuge adjustment and buffer switch may reflect a systematic improvement phase in the project.",
    confidence: 0.52,
    created_at: new Date(now - day * 0.15).toISOString(),
    status: "pending",
    source_entry: DEMO_ENTRIES[2],
    target_entry: DEMO_ENTRIES[6],
  },
  {
    id: "c5",
    source_entry_id: "d5",
    target_entry_id: "d8",
    connection_type: "supports",
    reasoning:
      "The temperature fluctuation data aligns with the absorption peak shift seen in spectroscopy. Conformational changes in proteins are temperature-sensitive, and the 2\u00b0C drift could be sufficient to cause the observed shift.",
    confidence: 0.82,
    created_at: new Date(now - 1800000).toISOString(),
    status: "pending",
    source_entry: DEMO_ENTRIES[4],
    target_entry: DEMO_ENTRIES[7],
  },
  {
    id: "c6",
    source_entry_id: "d4",
    target_entry_id: "d6",
    connection_type: "contradiction",
    reasoning:
      "The voice note describes enzyme kinetics that suggest protein stability, but the observation of unexpected beta-sheet formation indicates structural instability. This contradiction may point to different protein populations in the sample.",
    confidence: 0.68,
    created_at: new Date(now - 900000).toISOString(),
    status: "pending",
    source_entry: DEMO_ENTRIES[3],
    target_entry: DEMO_ENTRIES[5],
  },
  {
    id: "c7",
    source_entry_id: "d1",
    target_entry_id: "d5",
    connection_type: "supports",
    reasoning:
      "The temperature drift in the incubator directly explains the unusual crystallization patterns. Crystal nucleation and growth are extremely sensitive to temperature, and a 2\u00b0C overnight drift would alter morphology.",
    confidence: 0.91,
    created_at: new Date(now - 600000).toISOString(),
    status: "pending",
    source_entry: DEMO_ENTRIES[0],
    target_entry: DEMO_ENTRIES[4],
  },
];

/* ── helpers ─────────────────────────────────────────────────────────── */

const ALL_TYPES: ConnectionType[] = [
  "pattern",
  "contradiction",
  "supports",
  "reminds_of",
  "same_phenomenon",
  "literature_link",
];

const TYPE_LABELS: Record<ConnectionType, string> = {
  pattern: "Pattern",
  contradiction: "Contradiction",
  supports: "Supports",
  reminds_of: "Reminds of",
  same_phenomenon: "Same phenomenon",
  literature_link: "Literature link",
};

const TYPE_COLORS: Record<ConnectionType, string> = {
  pattern: "#2D5A3D",
  contradiction: "#dc2626",
  supports: "#2563eb",
  reminds_of: "#9ca3af",
  same_phenomenon: "#d97706",
  literature_link: "#7c3aed",
};

/* ════════════════════════════════════════════════════════════════════════
   Page Component
   ════════════════════════════════════════════════════════════════════ */

export default function ConnectionsPage() {
  /* ── state --------------------------------------------------------- */

  const [view, setView] = useState<"graph" | "list">("graph");
  const [entries, setEntries] = useState<Entry[]>(DEMO_ENTRIES);
  const [connections, setConnections] =
    useState<ConnectionWithEntries[]>(DEMO_CONNECTIONS);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(true);

  // filters
  const [activeTypes, setActiveTypes] = useState<ConnectionType[]>(ALL_TYPES);
  const [minConfidence, setMinConfidence] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // detail panels
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [selectedConnection, setSelectedConnection] =
    useState<ConnectionWithEntries | null>(null);

  /* ── fetch real data on mount -------------------------------------- */

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // fetch connections with joined entries
        const { data: conns } = await supabase
          .from("connections")
          .select(
            `
            *,
            source_entry:entries!connections_source_entry_id_fkey(*),
            target_entry:entries!connections_target_entry_id_fkey(*)
          `
          )
          .order("created_at", { ascending: false })
          .limit(100);

        if (conns && conns.length > 0) {
          const enriched: ConnectionWithEntries[] = conns.map((c) => ({
            ...c,
            connection_type: c.connection_type as ConnectionType,
            confidence: c.confidence ?? 0,
            status: "pending" as ConnectionStatus,
            source_entry: c.source_entry as Entry,
            target_entry: c.target_entry as Entry,
          }));
          setConnections(enriched);
          setIsDemo(false);

          // collect unique entries
          const entryMap = new Map<string, Entry>();
          enriched.forEach((c) => {
            entryMap.set(c.source_entry.id, c.source_entry);
            entryMap.set(c.target_entry.id, c.target_entry);
          });
          setEntries(Array.from(entryMap.values()));
        }
      } catch {
        // keep demo data
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── actions ------------------------------------------------------- */

  const handleConfirm = useCallback((id: string) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "confirmed" as const } : c))
    );
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "dismissed" as const } : c))
    );
  }, []);

  const handleNodeClick = useCallback((entry: Entry) => {
    setSelectedEntry(entry);
    setSelectedConnection(null);
  }, []);

  const handleEdgeClick = useCallback((connection: ConnectionWithEntries) => {
    setSelectedConnection(connection);
    setSelectedEntry(null);
  }, []);

  const handleExplore = useCallback((connection: ConnectionWithEntries) => {
    setSelectedConnection(connection);
    setSelectedEntry(null);
  }, []);

  const toggleType = useCallback((type: ConnectionType) => {
    setActiveTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }, []);

  /* ── related connections for selected entry ------------------------ */

  const entryConnections = useMemo(() => {
    if (!selectedEntry) return [];
    return connections.filter(
      (c) =>
        c.source_entry_id === selectedEntry.id ||
        c.target_entry_id === selectedEntry.id
    );
  }, [selectedEntry, connections]);

  /* ── stats --------------------------------------------------------- */

  const stats = useMemo(() => {
    return {
      total: connections.length,
      pending: connections.filter((c) => c.status === "pending").length,
      confirmed: connections.filter((c) => c.status === "confirmed").length,
      avgConfidence:
        connections.length > 0
          ? Math.round(
              (connections.reduce((s, c) => s + (c.confidence ?? 0), 0) /
                connections.length) *
                100
            )
          : 0,
    };
  }, [connections]);

  /* ── sidebar open? ------------------------------------------------- */

  const sidebarOpen = selectedEntry !== null || selectedConnection !== null;

  /* ── render -------------------------------------------------------- */

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-semibold font-heading tracking-tight">
              Serendipity Engine
            </h1>
          </div>
          <p className="text-sm text-muted mt-1 ml-[42px]">
            Unexpected connections between your research entries
          </p>
        </div>

        {/* view toggle */}
        <div className="flex items-center gap-1 bg-surface/60 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setView("graph")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              view === "graph"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Graph
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              view === "list"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Connections", value: stats.total },
          { label: "Pending Review", value: stats.pending },
          { label: "Confirmed", value: stats.confirmed },
          { label: "Avg. Confidence", value: `${stats.avgConfidence}%` },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl px-4 py-3 shadow-[var(--card-shadow)]"
          >
            <p className="text-[11px] text-muted">{s.label}</p>
            <p className="text-lg font-semibold font-heading mt-0.5">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* demo notice */}
      {isDemo && !loading && (
        <div className="flex items-center gap-2.5 bg-primary-light/50 border border-primary/10 rounded-lg px-4 py-2.5">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-medium">Showing example connections.</span>{" "}
            Start recording lab sessions to discover real connections between
            your entries.
          </p>
        </div>
      )}

      {/* filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* type toggles */}
        <div className="flex items-center gap-1.5">
          {ALL_TYPES.map((type) => {
            const active = activeTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
                  border transition-all cursor-pointer
                  ${
                    active
                      ? "border-current bg-white shadow-sm"
                      : "border-transparent bg-surface/50 text-muted hover:text-foreground"
                  }
                `}
                style={active ? { color: TYPE_COLORS[type] } : undefined}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: active ? TYPE_COLORS[type] : "#9ca3af",
                  }}
                />
                {TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>

        {/* confidence slider toggle */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
            border transition-colors cursor-pointer
            ${
              filtersOpen
                ? "border-primary/30 bg-primary-light/50 text-primary"
                : "border-transparent bg-surface/50 text-muted hover:text-foreground"
            }`}
        >
          <SlidersHorizontal className="w-3 h-3" />
          Confidence
          {minConfidence > 0 && (
            <span className="text-[10px] opacity-70">
              &ge;{Math.round(minConfidence * 100)}%
            </span>
          )}
        </button>
      </div>

      {/* confidence slider panel */}
      {filtersOpen && (
        <div className="bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)] px-4 py-3 max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-foreground">
              Minimum confidence
            </label>
            <span className="text-xs text-muted tabular-nums">
              {Math.round(minConfidence * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-full accent-primary h-1 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted mt-1">
            <span>Show all</span>
            <span>High only</span>
          </div>
        </div>
      )}

      {/* main content area (graph or feed) + sidebar */}
      <div className="flex gap-4">
        {/* main content */}
        <div
          className={`flex-1 min-w-0 transition-all ${
            sidebarOpen ? "lg:mr-0" : ""
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-[500px]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-muted">Loading connections...</p>
              </div>
            </div>
          ) : view === "graph" ? (
            <div className="bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)] overflow-hidden h-[600px]">
              <ConnectionGraph
                entries={entries}
                connections={connections}
                activeTypes={activeTypes}
                minConfidence={minConfidence}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
              />
            </div>
          ) : (
            <ConnectionFeed
              connections={connections}
              activeTypes={activeTypes}
              minConfidence={minConfidence}
              onConfirm={handleConfirm}
              onDismiss={handleDismiss}
              onExplore={handleExplore}
            />
          )}
        </div>

        {/* detail sidebar */}
        {sidebarOpen && (
          <div className="hidden lg:block w-80 shrink-0 detail-sidebar-enter">
            <div className="bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)] sticky top-4">
              {/* close button */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                  {selectedEntry ? "Entry Detail" : "Connection Detail"}
                </span>
                <button
                  onClick={() => {
                    setSelectedEntry(null);
                    setSelectedConnection(null);
                  }}
                  className="p-1 rounded-md text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* entry detail */}
              {selectedEntry && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-medium text-primary uppercase tracking-wide">
                      {selectedEntry.entry_type.replace("_", " ")}
                    </span>
                    <p className="text-sm font-medium text-foreground mt-1 leading-snug">
                      {selectedEntry.content || "Untitled entry"}
                    </p>
                  </div>

                  {selectedEntry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedEntry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-muted">
                    {new Date(selectedEntry.created_at).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </div>

                  {/* related connections */}
                  {entryConnections.length > 0 && (
                    <div className="pt-2 border-t border-border/30">
                      <p className="text-[11px] font-semibold text-muted mb-2">
                        {entryConnections.length} Connection
                        {entryConnections.length !== 1 ? "s" : ""}
                      </p>
                      <div className="space-y-2">
                        {entryConnections.map((c) => {
                          const other =
                            c.source_entry_id === selectedEntry.id
                              ? c.target_entry
                              : c.source_entry;
                          return (
                            <button
                              key={c.id}
                              onClick={() => handleEdgeClick(c)}
                              className="w-full text-left bg-surface/50 rounded-lg px-3 py-2
                                hover:bg-surface transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <div
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      TYPE_COLORS[c.connection_type],
                                  }}
                                />
                                <span className="text-[10px] font-medium capitalize">
                                  {c.connection_type.replace("_", " ")}
                                </span>
                                <span className="text-[10px] text-muted ml-auto">
                                  {Math.round((c.confidence ?? 0) * 100)}%
                                </span>
                              </div>
                              <p className="text-[11px] text-muted line-clamp-2">
                                {other.content || "Untitled"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* connection detail */}
              {selectedConnection && (
                <div className="px-4 pb-4 space-y-3">
                  {/* type badge */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          TYPE_COLORS[selectedConnection.connection_type],
                      }}
                    />
                    <span className="text-xs font-semibold capitalize">
                      {selectedConnection.connection_type.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted ml-auto tabular-nums">
                      {Math.round(
                        (selectedConnection.confidence ?? 0) * 100
                      )}
                      % confidence
                    </span>
                  </div>

                  {/* entries */}
                  <div className="space-y-2">
                    <div className="bg-surface/60 rounded-lg px-3 py-2">
                      <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
                        {selectedConnection.source_entry.entry_type.replace(
                          "_",
                          " "
                        )}
                      </span>
                      <p className="text-xs text-foreground leading-snug mt-0.5">
                        {selectedConnection.source_entry.content ||
                          "Untitled"}
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="w-3.5 h-3.5 text-muted/40 rotate-90" />
                    </div>
                    <div className="bg-surface/60 rounded-lg px-3 py-2">
                      <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
                        {selectedConnection.target_entry.entry_type.replace(
                          "_",
                          " "
                        )}
                      </span>
                      <p className="text-xs text-foreground leading-snug mt-0.5">
                        {selectedConnection.target_entry.content ||
                          "Untitled"}
                      </p>
                    </div>
                  </div>

                  {/* reasoning */}
                  {selectedConnection.reasoning && (
                    <div className="pt-2 border-t border-border/30">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Info className="w-3 h-3 text-muted" />
                        <span className="text-[11px] font-semibold text-muted">
                          AI Reasoning
                        </span>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">
                        {selectedConnection.reasoning}
                      </p>
                    </div>
                  )}

                  {/* confidence bar */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-muted">
                        Confidence
                      </span>
                      <span className="text-[10px] text-muted tabular-nums">
                        {Math.round(
                          (selectedConnection.confidence ?? 0) * 100
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((selectedConnection.confidence ?? 0) * 100)}%`,
                          backgroundColor:
                            TYPE_COLORS[selectedConnection.connection_type],
                        }}
                      />
                    </div>
                  </div>

                  {/* actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() =>
                        handleConfirm(selectedConnection.id)
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                        text-[11px] font-medium bg-primary text-white hover:bg-primary-hover
                        transition-colors cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() =>
                        handleDismiss(selectedConnection.id)
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                        text-[11px] font-medium bg-surface text-muted hover:bg-red-50 hover:text-red-600
                        transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
