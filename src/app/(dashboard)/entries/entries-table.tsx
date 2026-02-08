"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import type { Entry, EntryType, Session, Collection } from "@/lib/types";
import {
  fetchEntries,
  deleteEntries,
  addToCollection,
  type FetchEntriesResult,
  type FetchEntriesParams,
  type SortField,
} from "./actions";
import {
  Search,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FolderPlus,
  Download,
  X,
  Mic,
  Eye,
  Ruler,
  ClipboardList,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────

const ENTRY_TYPE_CONFIG: Record<
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

const ALL_TYPES: EntryType[] = [
  "voice_note",
  "observation",
  "measurement",
  "protocol_step",
  "annotation",
  "hypothesis",
  "anomaly",
  "idea",
];

// ── Props ────────────────────────────────────────────────────────────────

interface EntriesTableProps {
  initialData: FetchEntriesResult;
  sessions: Pick<Session, "id" | "title">[];
  allTags: string[];
  collections: Pick<Collection, "id" | "name">[];
}

// ── Component ────────────────────────────────────────────────────────────

export function EntriesTable({
  initialData,
  sessions,
  allTags,
  collections,
}: EntriesTableProps) {
  // Data state
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<EntryType[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk action modals
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Search debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(
    async (params: Partial<FetchEntriesParams> = {}) => {
      setLoading(true);
      try {
        const result = await fetchEntries({
          page,
          perPage: 20,
          search: search || undefined,
          types: selectedTypes.length > 0 ? selectedTypes : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          sessionId: selectedSession || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortBy,
          sortOrder,
          ...params,
        });
        setData(result);
        setSelected(new Set());
      } finally {
        setLoading(false);
      }
    },
    [page, search, selectedTypes, selectedTags, selectedSession, dateFrom, dateTo, sortBy, sortOrder]
  );

  // Refetch when filters/sort/page change (except search which is debounced)
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedTypes, selectedTags, selectedSession, dateFrom, dateTo, sortBy, sortOrder]);

  // Debounced search
  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      reload({ search: value || undefined, page: 1 });
    }, 300);
  }

  // Sort toggle
  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  }

  // Type filter toggle
  function toggleType(type: EntryType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setPage(1);
  }

  // Tag filter toggle
  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPage(1);
  }

  // Selection
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === data.entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.entries.map((e) => e.id)));
    }
  }

  // Bulk delete
  async function handleBulkDelete() {
    const ids = Array.from(selected);
    const result = await deleteEntries(ids);
    if (result.success) {
      setShowDeleteConfirm(false);
      reload();
    }
  }

  // Bulk add to collection
  async function handleAddToCollection(collectionId: string) {
    const ids = Array.from(selected);
    const result = await addToCollection(ids, collectionId);
    if (result.success) {
      setShowCollectionPicker(false);
      setSelected(new Set());
    }
  }

  // Export selected as JSON
  function handleExport() {
    const ids = new Set(selected);
    const entries = data.entries.filter((e) => ids.has(e.id));
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entries-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Pagination
  const totalPages = Math.ceil(data.total / data.perPage);
  const hasFilters =
    selectedTypes.length > 0 ||
    selectedTags.length > 0 ||
    selectedSession ||
    dateFrom ||
    dateTo;

  function clearFilters() {
    setSelectedTypes([]);
    setSelectedTags([]);
    setSelectedSession("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  // Helpers
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function truncate(text: string | null, length: number) {
    if (!text) return "—";
    return text.length > length ? text.slice(0, length) + "..." : text;
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field)
      return <ChevronsUpDown className="w-3.5 h-3.5 text-muted/50" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5" />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search entry content..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-white text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
            filtersOpen || hasFilters
              ? "border-primary/40 bg-primary-light text-primary"
              : "border-border bg-white text-muted hover:text-foreground hover:border-border"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-semibold">
              {selectedTypes.length +
                selectedTags.length +
                (selectedSession ? 1 : 0) +
                (dateFrom ? 1 : 0) +
                (dateTo ? 1 : 0)}
            </span>
          )}
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}

        {/* Bulk action toolbar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted">
              {selected.size} selected
            </span>
            <button
              onClick={() => setShowCollectionPicker(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white text-xs font-medium text-foreground hover:bg-primary-light transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Add to Collection
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white text-xs font-medium text-foreground hover:bg-primary-light transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 bg-white text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* ── Filter Panel ─────────────────────────────────────────────── */}
      {filtersOpen && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-4">
          {/* Type filter */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">
              Entry Type
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((type) => {
                const cfg = ENTRY_TYPE_CONFIG[type];
                const active = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? `${cfg.bg} ${cfg.color} ring-1 ring-current/20`
                        : "bg-surface text-muted hover:text-foreground"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? "bg-primary text-white"
                          : "bg-surface text-muted hover:text-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            {/* Session filter */}
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-muted mb-2">
                Session
              </label>
              <select
                value={selectedSession}
                onChange={(e) => {
                  setSelectedSession(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              >
                <option value="">All sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs font-medium text-muted mb-2">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-2">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-white text-left">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      data.entries.length > 0 &&
                      selected.size === data.entries.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded accent-white"
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    onClick={() => handleSort("content")}
                    className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    Entry
                    <SortIcon field="content" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium w-32">
                  <button
                    onClick={() => handleSort("entry_type")}
                    className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    Type
                    <SortIcon field="entry_type" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium w-48">Tags</th>
                <th className="px-4 py-3 font-medium w-40">
                  <button
                    onClick={() => handleSort("session_id")}
                    className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    Session
                    <SortIcon field="session_id" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium w-44">
                  <button
                    onClick={() => handleSort("created_at")}
                    className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    Created
                    <SortIcon field="created_at" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading && data.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted">
                    Loading...
                  </td>
                </tr>
              ) : data.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="space-y-2">
                      <p className="text-muted font-medium">No entries found</p>
                      <p className="text-xs text-muted/70">
                        {hasFilters || search
                          ? "Try adjusting your filters or search query."
                          : "Start a lab session to create your first entry."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.entries.map((entry) => {
                  const cfg = ENTRY_TYPE_CONFIG[entry.entry_type];
                  const Icon = cfg.icon;

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        selected.has(entry.id)
                          ? "bg-primary-light/50"
                          : "hover:bg-surface/50"
                      } ${loading ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          className="rounded accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/entries/${entry.id}`}
                          className="text-foreground font-medium hover:text-primary transition-colors"
                        >
                          {truncate(entry.content, 72)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.length === 0 ? (
                            <span className="text-xs text-muted/50">—</span>
                          ) : (
                            entry.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-light text-primary"
                              >
                                {tag}
                              </span>
                            ))
                          )}
                          {entry.tags.length > 3 && (
                            <span className="text-[11px] text-muted">
                              +{entry.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted truncate block max-w-[120px]">
                          {entry.session_title || entry.session_id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted tabular-nums">
                          {formatDate(entry.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-surface/30">
            <p className="text-xs text-muted">
              Showing {(page - 1) * data.perPage + 1}–
              {Math.min(page * data.perPage, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      page === pageNum
                        ? "bg-primary text-white"
                        : "hover:bg-white text-muted"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold font-heading">Delete Entries</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1 rounded-md hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted">
              Are you sure you want to delete {selected.size} entr
              {selected.size === 1 ? "y" : "ies"}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Collection Picker Modal ──────────────────────────────────── */}
      {showCollectionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold font-heading">Add to Collection</h3>
              <button
                onClick={() => setShowCollectionPicker(false)}
                className="p-1 rounded-md hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {collections.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">
                No collections yet. Create one first.
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => handleAddToCollection(col.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-primary-light transition-colors cursor-pointer"
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
