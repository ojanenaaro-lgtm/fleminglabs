"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { SearchResult, SearchResultType } from "@/lib/types";
import {
  Search,
  X,
  FileText,
  Mic,
  FolderOpen,
  GitBranch,
  Clock,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";

const RECENT_SEARCHES_KEY = "fleminglabs_recent_searches";
const MAX_RECENT = 5;

const typeIcons: Record<SearchResultType, typeof FileText> = {
  entry: FileText,
  session: Mic,
  project: FolderOpen,
  connection: GitBranch,
};

const typeLabels: Record<SearchResultType, string> = {
  entry: "Entries",
  session: "Sessions",
  project: "Projects",
  connection: "Connections",
};

const typeHrefs: Record<SearchResultType, (id: string) => string> = {
  entry: (id) => `/entries/${id}`,
  session: (id) => `/sessions/${id}`,
  project: (id) => `/projects/${id}`,
  connection: (id) => `/connections/${id}`,
};

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();

  // Flatten results into ordered list for keyboard nav
  const groupedResults = results.reduce<Record<string, SearchResult[]>>(
    (acc, r) => {
      (acc[r.result_type] ??= []).push(r);
      return acc;
    },
    {}
  );
  const flatResults = Object.entries(groupedResults).flatMap(
    ([, items]) => items
  );

  // Open/close with Cmd+K or custom event from TopBar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function handleOpenSearch() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("fleminglabs:open-search", handleOpenSearch);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("fleminglabs:open-search", handleOpenSearch);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
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
        result_limit: 20,
      });

      if (error) throw error;
      setResults((data as SearchResult[]) || []);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults[selectedIndex]) {
        navigateTo(flatResults[selectedIndex]);
      } else if (query.trim()) {
        goToFullSearch();
      }
    }
  }

  function navigateTo(result: SearchResult) {
    saveRecentSearch(query);
    setOpen(false);
    router.push(typeHrefs[result.result_type](result.id));
  }

  function goToFullSearch() {
    saveRecentSearch(query);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function handleRecentClick(q: string) {
    setQuery(q);
  }

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected=true]");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-border/60 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
            <Search className="w-5 h-5 text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search entries, sessions, projects, connections..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted/70"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-0.5 rounded text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface text-[11px] text-muted font-medium border border-border/40">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[400px] overflow-y-auto">
            {/* Loading */}
            {loading && query.trim().length >= 2 && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                Searching...
              </div>
            )}

            {/* Empty state */}
            {!loading && query.trim().length >= 2 && flatResults.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted">
                  No results for &ldquo;{query}&rdquo;
                </p>
                <button
                  onClick={goToFullSearch}
                  className="mt-2 text-xs text-primary hover:underline cursor-pointer"
                >
                  Try advanced search
                </button>
              </div>
            )}

            {/* Grouped results */}
            {!loading &&
              Object.entries(groupedResults).map(([type, items]) => {
                const Icon = typeIcons[type as SearchResultType];
                return (
                  <div key={type}>
                    <div className="px-4 py-2 text-[11px] font-semibold text-muted uppercase tracking-wider bg-surface/50">
                      {typeLabels[type as SearchResultType]}
                    </div>
                    {items.map((result) => {
                      flatIndex++;
                      const isSelected = flatIndex === selectedIndex;
                      const currentIndex = flatIndex;
                      return (
                        <button
                          key={result.id}
                          data-selected={isSelected}
                          onClick={() => navigateTo(result)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-primary-light"
                              : "hover:bg-sidebar-hover"
                          }`}
                        >
                          <Icon className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              dangerouslySetInnerHTML={{
                                __html: result.title.length > 80
                                  ? result.title.slice(0, 80) + "..."
                                  : result.title,
                              }}
                            />
                            {result.snippet && result.snippet !== result.title && (
                              <p
                                className="text-xs text-muted line-clamp-1 mt-0.5"
                                dangerouslySetInnerHTML={{
                                  __html: result.snippet.length > 120
                                    ? result.snippet.slice(0, 120) + "..."
                                    : result.snippet,
                                }}
                              />
                            )}
                          </div>
                          {isSelected && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

            {/* Recent searches (when no query) */}
            {!query && recentSearches.length > 0 && (
              <div>
                <div className="px-4 py-2 text-[11px] font-semibold text-muted uppercase tracking-wider bg-surface/50">
                  Recent Searches
                </div>
                {recentSearches.map((recent) => (
                  <button
                    key={recent}
                    onClick={() => handleRecentClick(recent)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-sidebar-hover transition-colors cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-muted" />
                    <span className="text-sm">{recent}</span>
                  </button>
                ))}
              </div>
            )}

            {/* No query, no recent */}
            {!query && recentSearches.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                Start typing to search across your lab notebook
              </div>
            )}
          </div>

          {/* Footer */}
          {flatResults.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-surface/30">
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface border border-border/40 text-[10px]">
                    &uarr;&darr;
                  </kbd>{" "}
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface border border-border/40 text-[10px]">
                    &crarr;
                  </kbd>{" "}
                  open
                </span>
              </div>
              <button
                onClick={goToFullSearch}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                All results
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
