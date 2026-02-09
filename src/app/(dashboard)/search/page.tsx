"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { SearchResult, SearchResultType } from "@/lib/types";
import {
  Search,
  FileText,
  Mic,
  FolderOpen,
  GitBranch,
  SlidersHorizontal,
  ArrowUpDown,
  Calendar,
  X,
} from "lucide-react";

const typeIcons: Record<SearchResultType, typeof FileText> = {
  entry: FileText,
  session: Mic,
  project: FolderOpen,
  connection: GitBranch,
};

const typeLabels: Record<SearchResultType, string> = {
  entry: "Entry",
  session: "Session",
  project: "Project",
  connection: "Connection",
};

const typeHrefs: Record<SearchResultType, (id: string) => string> = {
  entry: (id) => `/entries/${id}`,
  session: (id) => `/sessions/${id}`,
  project: (id) => `/projects/${id}`,
  connection: (id) => `/connections/${id}`,
};

type SortBy = "relevance" | "date";
type TypeFilter = SearchResultType | "all";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("relevance");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data, error } = await supabase.rpc("search_all", {
          search_query: q,
          user_id_param: user.id,
          result_limit: 50,
        });

        if (error) throw error;
        setResults((data as SearchResult[]) || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (initialQuery) {
      search(initialQuery);
    }
  }, [initialQuery, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.replace(`/search?q=${encodeURIComponent(query)}`);
      search(query);
    }
  }

  // Filter & sort results
  const filtered = results
    .filter((r) => typeFilter === "all" || r.result_type === typeFilter)
    .filter((r) => {
      if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(r.created_at) > new Date(dateTo + "T23:59:59"))
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "relevance") return b.relevance - a.relevance;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Count by type for facets
  const typeCounts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.result_type] = (acc[r.result_type] || 0) + 1;
    return acc;
  }, {});

  function clearFilters() {
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("relevance");
  }

  const hasActiveFilters =
    typeFilter !== "all" || dateFrom || dateTo || sortBy !== "relevance";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold font-heading tracking-tight">
          Search
        </h1>
        <p className="text-muted text-sm mt-1">
          Search across all your entries, sessions, projects, and connections.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entries, sessions, projects, connections..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-white text-sm placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-[var(--card-shadow)]"
            autoFocus
          />
        </div>
      </form>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              showFilters || hasActiveFilters
                ? "bg-primary-light text-primary"
                : "text-muted hover:bg-sidebar-hover hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>

          {/* Quick type filters */}
          <div className="flex gap-1">
            {(["all", "entry", "session", "project", "connection"] as const).map(
              (type) => {
                const active = typeFilter === type;
                const count =
                  type === "all"
                    ? results.length
                    : typeCounts[type] || 0;
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? "bg-primary text-white"
                        : "bg-surface text-muted hover:text-foreground"
                    }`}
                  >
                    {type === "all" ? "All" : typeLabels[type]}{" "}
                    {count > 0 && (
                      <span className={active ? "opacity-80" : "opacity-60"}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setSortBy(sortBy === "relevance" ? "date" : "relevance")
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortBy === "relevance" ? "By relevance" : "By date"}
          </button>
        </div>
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white rounded-xl shadow-[var(--card-shadow)] border border-border/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">
                From date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">
                To date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {loading && (
          <div className="py-12 text-center text-sm text-muted">
            Searching...
          </div>
        )}

        {!loading && query && filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted">
              No results found for &ldquo;{query}&rdquo;
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-xs text-primary hover:underline cursor-pointer"
              >
                Try clearing filters
              </button>
            )}
          </div>
        )}

        {!loading && !query && (
          <div className="py-12 text-center text-sm text-muted">
            Enter a search query to find entries, sessions, projects, and
            connections.
          </div>
        )}

        {!loading &&
          filtered.map((result) => {
            const Icon = typeIcons[result.result_type];
            return (
              <a
                key={`${result.result_type}-${result.id}`}
                href={typeHrefs[result.result_type](result.id)}
                className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-[var(--card-shadow)] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface text-muted font-medium">
                      {typeLabels[result.result_type]}
                    </span>
                    <span className="text-[11px] text-muted/60">
                      {new Date(result.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p
                    className="text-sm font-medium text-foreground group-hover:text-primary transition-colors"
                    dangerouslySetInnerHTML={{
                      __html:
                        result.title.length > 100
                          ? result.title.slice(0, 100) + "..."
                          : result.title,
                    }}
                  />

                  {result.snippet && result.snippet !== result.title && (
                    <p
                      className="text-xs text-muted mt-1 line-clamp-2 [&_mark]:bg-yellow-100 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />
                  )}
                </div>
              </a>
            );
          })}

        {/* Result count */}
        {!loading && filtered.length > 0 && (
          <div className="pt-4 text-center text-xs text-muted">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {hasActiveFilters && " (filtered)"}
          </div>
        )}
      </div>
    </div>
  );
}
