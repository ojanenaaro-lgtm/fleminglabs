"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type {
  Tag,
  StructuredEntry,
  ProcessResponse,
  ConnectionSuggestion,
  LiteratureResult,
} from "@/lib/types";

// ── Entry type styling ──────────────────────────────────────────────────

const ENTRY_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  observation:    { bg: "bg-green-100",  text: "text-green-800",  label: "Observation" },
  measurement:    { bg: "bg-blue-100",   text: "text-blue-800",   label: "Measurement" },
  protocol_step:  { bg: "bg-amber-100",  text: "text-amber-800",  label: "Protocol Step" },
  annotation:     { bg: "bg-purple-100", text: "text-purple-800", label: "Annotation" },
  voice_note:     { bg: "bg-gray-100",   text: "text-gray-800",   label: "Voice Note" },
};

const CONNECTION_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pattern:       { bg: "bg-indigo-100",  text: "text-indigo-800",  label: "Pattern" },
  contradiction: { bg: "bg-red-100",     text: "text-red-800",     label: "Contradiction" },
  supports:      { bg: "bg-green-100",   text: "text-green-800",   label: "Supports" },
  reminds_of:    { bg: "bg-amber-100",   text: "text-amber-800",   label: "Reminds Of" },
};

// ── SSE stream reader ───────────────────────────────────────────────────

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "result"; data: unknown }
  | { type: "error"; error: string };

async function readSSEStream(
  url: string,
  body: unknown,
  onDelta: (text: string) => void,
  onResult: (data: unknown) => void,
  onError: (error: string) => void
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    onError(err.error ?? `Request failed (${res.status})`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;

      try {
        const event: StreamEvent = JSON.parse(payload);
        if (event.type === "delta") onDelta(event.text);
        else if (event.type === "result") onResult(event.data);
        else if (event.type === "error") onError(event.error);
      } catch {
        // skip unparseable lines
      }
    }
  }
}

// ── Props ───────────────────────────────────────────────────────────────

type AiProcessingPanelProps = {
  transcript: string;
  tags: Tag[];
  sessionId: string;
  projectId?: string;
  projectContext?: string;
  entryId?: string; // if processing an existing entry (for connections)
};

// ── Component ───────────────────────────────────────────────────────────

export default function AiProcessingPanel({
  transcript,
  tags,
  sessionId,
  projectId,
  projectContext,
  entryId,
}: AiProcessingPanelProps) {
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResponse | null>(null);
  const [streamText, setStreamText] = useState("");

  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connections, setConnections] = useState<ConnectionSuggestion[]>([]);
  const [dismissedConnections, setDismissedConnections] = useState<Set<string>>(new Set());

  // Literature state
  const [isSearchingLit, setIsSearchingLit] = useState(false);
  const [papers, setPapers] = useState<LiteratureResult[]>([]);

  // Editing state for structured entries
  const [editedEntries, setEditedEntries] = useState<Map<number, StructuredEntry>>(new Map());
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Error state
  const [error, setError] = useState("");

  // ── Process transcript ──────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    setIsProcessing(true);
    setStreamText("");
    setProcessResult(null);
    setError("");
    setEditedEntries(new Map());
    setSelectedEntries(new Set());

    await readSSEStream(
      "/api/ai/process",
      { transcript, tags, projectContext },
      (text) => setStreamText((prev) => prev + text),
      (data) => {
        const result = data as ProcessResponse;
        setProcessResult(result);
        // Select all entries by default
        setSelectedEntries(new Set(result.structured_entries.map((_, i) => i)));
      },
      (err) => setError(err)
    );

    setIsProcessing(false);
  }, [transcript, tags, projectContext]);

  // ── Find connections ────────────────────────────────────────────────

  const handleFindConnections = useCallback(async () => {
    if (!entryId) return;
    setIsConnecting(true);
    setConnections([]);
    setError("");

    await readSSEStream(
      "/api/ai/connections",
      { entry_id: entryId, content: transcript },
      () => {}, // we don't show streaming text for connections
      (data) => {
        const result = data as { connections: ConnectionSuggestion[] };
        setConnections(result.connections);
      },
      (err) => setError(err)
    );

    setIsConnecting(false);
  }, [entryId, transcript]);

  // ── Search literature ───────────────────────────────────────────────

  const handleSearchLiterature = useCallback(async () => {
    if (!processResult) return;
    setIsSearchingLit(true);
    setPapers([]);
    setError("");

    // Build query from summary and suggested tags
    const query = processResult.suggested_tags
      .map((t) => t.label)
      .slice(0, 3)
      .join(" ");

    try {
      const res = await fetch("/api/ai/literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query || processResult.summary.slice(0, 100),
          context: processResult.summary,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Search failed" }));
        setError(err.error);
        setIsSearchingLit(false);
        return;
      }

      const data = await res.json();
      setPapers(data.papers ?? []);
    } catch {
      setError("Literature search failed");
    }

    setIsSearchingLit(false);
  }, [processResult]);

  // ── Save entries to Supabase ────────────────────────────────────────

  const handleSave = useCallback(
    async (saveAll: boolean) => {
      if (!processResult) return;
      setIsSaving(true);
      setSaveMessage("");
      setError("");

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Not authenticated");
        setIsSaving(false);
        return;
      }

      const entriesToSave = processResult.structured_entries
        .map((entry, i) => ({ entry: editedEntries.get(i) ?? entry, index: i }))
        .filter(({ index }) => saveAll || selectedEntries.has(index));

      if (entriesToSave.length === 0) {
        setError("No entries selected");
        setIsSaving(false);
        return;
      }

      const rows = entriesToSave.map(({ entry }) => ({
        session_id: sessionId,
        project_id: projectId,
        user_id: user.id,
        entry_type: entry.entry_type,
        content: entry.content,
        raw_transcript: transcript,
        tags: entry.tags,
        metadata: entry.metadata,
      }));

      const { error: insertError } = await supabase
        .from("entries")
        .insert(rows);

      if (insertError) {
        setError(insertError.message);
      } else {
        setSaveMessage(`Saved ${rows.length} ${rows.length === 1 ? "entry" : "entries"}`);
      }

      // Save accepted connections
      const acceptedConnections = connections.filter(
        (c) => !dismissedConnections.has(`${c.source_entry_id}-${c.target_entry_id}`)
      );

      if (acceptedConnections.length > 0) {
        const connRows = acceptedConnections.map((c) => ({
          source_entry_id: c.source_entry_id,
          target_entry_id: c.target_entry_id,
          connection_type: c.type,
          reasoning: c.reasoning,
          confidence: c.confidence,
        }));

        await supabase.from("connections").insert(connRows);
      }

      setIsSaving(false);
    },
    [
      processResult,
      editedEntries,
      selectedEntries,
      sessionId,
      projectId,
      transcript,
      connections,
      dismissedConnections,
    ]
  );

  // ── Entry editing ───────────────────────────────────────────────────

  const updateEntry = useCallback(
    (index: number, field: keyof StructuredEntry, value: unknown) => {
      setEditedEntries((prev) => {
        const next = new Map(prev);
        const current =
          next.get(index) ?? { ...processResult!.structured_entries[index] };
        next.set(index, { ...current, [field]: value });
        return next;
      });
    },
    [processResult]
  );

  const toggleEntrySelection = useCallback((index: number) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const dismissConnection = useCallback(
    (sourceId: string, targetId: string) => {
      setDismissedConnections((prev) => {
        const next = new Set(prev);
        next.add(`${sourceId}-${targetId}`);
        return next;
      });
    },
    []
  );

  // ── Render ──────────────────────────────────────────────────────────

  const entries = processResult?.structured_entries ?? [];

  return (
    <div className="flex flex-col gap-4 font-body">
      {/* ── Action bar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleProcess}
          disabled={isProcessing || !transcript}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5v1h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-3v1.5c1.2.7 2 2 2 3.5a4 4 0 0 1-8 0c0-1.5.8-2.8 2-3.5V15.5H6a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h3v-1C7.8 8.8 7 7.5 7 6a4 4 0 0 1 5-3.9" />
              </svg>
              Process with AI
            </>
          )}
        </button>

        {entryId && (
          <button
            onClick={handleFindConnections}
            disabled={isConnecting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Finding connections…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Find Connections
              </>
            )}
          </button>
        )}

        {processResult && (
          <button
            onClick={handleSearchLiterature}
            disabled={isSearchingLit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearchingLit ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Searching PubMed…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Search Literature
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Error display ────────────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* ── Streaming indicator ──────────────────────────────────────── */}
      {isProcessing && streamText && (
        <div className="px-4 py-3 rounded-lg border border-border bg-primary-light/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-muted">AI is thinking…</span>
          </div>
          <pre className="text-xs text-muted font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
            {streamText.slice(-500)}
          </pre>
        </div>
      )}

      {/* ── Summary ──────────────────────────────────────────────────── */}
      {processResult && (
        <div className="px-4 py-3 rounded-lg border border-border bg-input-bg">
          <h3 className="text-sm font-semibold font-heading text-foreground mb-1">
            Summary
          </h3>
          <p className="text-sm text-muted">{processResult.summary}</p>

          {/* Suggested tags */}
          {processResult.suggested_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {processResult.suggested_tags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary-light text-primary"
                >
                  {tag.label}
                  {tag.category && (
                    <span className="text-primary/50">({tag.category})</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Structured entries ───────────────────────────────────────── */}
      {entries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold font-heading text-foreground">
              Structured Entries ({entries.length})
            </h3>
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEntries.size === entries.length}
                onChange={() => {
                  if (selectedEntries.size === entries.length) {
                    setSelectedEntries(new Set());
                  } else {
                    setSelectedEntries(new Set(entries.map((_, i) => i)));
                  }
                }}
                className="rounded border-border text-primary focus:ring-primary/30"
              />
              Select all
            </label>
          </div>

          <div className="space-y-2">
            {entries.map((entry, index) => {
              const edited = editedEntries.get(index);
              const current = edited ?? entry;
              const style = ENTRY_TYPE_STYLES[current.entry_type] ?? ENTRY_TYPE_STYLES.voice_note;
              const isSelected = selectedEntries.has(index);

              return (
                <div
                  key={index}
                  className={`rounded-lg border transition-colors ${
                    isSelected
                      ? "border-primary/40 bg-input-bg"
                      : "border-border/50 bg-background opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEntrySelection(index)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary/30"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                        >
                          {style.label}
                        </span>
                        {current.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <textarea
                        value={current.content}
                        onChange={(e) =>
                          updateEntry(index, "content", e.target.value)
                        }
                        rows={2}
                        className="w-full text-sm rounded-md border border-border/50 bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y"
                      />

                      {Object.keys(current.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Object.entries(current.metadata).map(
                            ([key, val]) => (
                              <span
                                key={key}
                                className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700"
                              >
                                {key}: {String(val)}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Connection suggestions ───────────────────────────────────── */}
      {connections.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold font-heading text-foreground mb-2">
            Connection Suggestions
          </h3>
          <div className="space-y-2">
            {connections.map((conn) => {
              const key = `${conn.source_entry_id}-${conn.target_entry_id}`;
              if (dismissedConnections.has(key)) return null;

              const style =
                CONNECTION_TYPE_STYLES[conn.type] ??
                CONNECTION_TYPE_STYLES.reminds_of;

              return (
                <div
                  key={key}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-input-bg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                      >
                        {style.label}
                      </span>
                      <span className="text-xs text-muted">
                        Confidence: {Math.round(conn.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{conn.reasoning}</p>
                    <p className="text-xs text-muted mt-1">
                      Links to entry {conn.target_entry_id.slice(0, 8)}…
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      dismissConnection(
                        conn.source_entry_id,
                        conn.target_entry_id
                      )
                    }
                    className="shrink-0 p-1 rounded hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
                    title="Dismiss"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Related literature ───────────────────────────────────────── */}
      {papers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold font-heading text-foreground mb-2">
            Related Literature
          </h3>
          <div className="space-y-2">
            {papers.map((paper) => (
              <div
                key={paper.pmid}
                className="p-3 rounded-lg border border-border bg-input-bg"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-foreground leading-snug">
                    {paper.title}
                  </h4>
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-primary-light text-primary hover:bg-primary/10 transition-colors"
                  >
                    PMID: {paper.pmid}
                  </a>
                </div>
                <p className="text-xs text-muted mt-1">
                  {paper.authors.slice(0, 3).join(", ")}
                  {paper.authors.length > 3 && " et al."}
                </p>
                <p className="text-xs text-muted mt-1.5 line-clamp-3">
                  {paper.abstract.slice(0, 300)}
                  {paper.abstract.length > 300 && "…"}
                </p>
                <div className="mt-2 px-2 py-1.5 rounded bg-primary-light/50 text-xs text-foreground">
                  <span className="font-medium">Relevance:</span>{" "}
                  {paper.relevance_reasoning}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Potential connections from processing ────────────────────── */}
      {processResult &&
        processResult.potential_connections.length > 0 &&
        connections.length === 0 && (
          <div>
            <h3 className="text-sm font-semibold font-heading text-foreground mb-2">
              Potential Cross-References
            </h3>
            <div className="space-y-1.5">
              {processResult.potential_connections.map((conn, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border/50 bg-primary-light/20"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 mt-0.5 text-primary"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <div>
                    <span className="text-xs font-medium text-primary">
                      {conn.related_concept}
                    </span>
                    <p className="text-xs text-muted">{conn.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ── Save bar ─────────────────────────────────────────────────── */}
      {processResult && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving || selectedEntries.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              `Save Selected (${selectedEntries.size})`
            )}
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save All
          </button>

          {saveMessage && (
            <span className="text-sm text-primary font-medium">
              {saveMessage}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
