"use client";

import { useState, useEffect, useCallback } from "react";
import { Brain, ListChecks, Search, RefreshCw, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase";

type NextStep = {
  action: string;
  reasoning: string;
  priority: "high" | "medium" | "low";
};

type EnrichmentData = {
  interpretation: string;
  suggested_next_steps: NextStep[];
  related_search_terms: string[];
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-green-50 text-green-700 border-green-200",
};

export function EntryEnrichment({ entryId }: { entryId: string }) {
  const [data, setData] = useState<EnrichmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEnrichment = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);

      // Check cached enrichment in metadata first
      if (!forceRefresh) {
        try {
          const supabase = createClient();
          const { data: entry } = await supabase
            .from("entries")
            .select("metadata")
            .eq("id", entryId)
            .single();

          const meta = entry?.metadata as Record<string, unknown> | null;
          if (meta?.enrichment) {
            setData(meta.enrichment as EnrichmentData);
            setLoading(false);
            return;
          }
        } catch {
          // Continue to API call
        }
      }

      // Call enrichment API
      try {
        const res = await fetch("/api/ai/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entry_id: entryId }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Enrichment failed");
        }

        const enrichment: EnrichmentData = await res.json();
        setData(enrichment);

        // Cache in entry metadata
        const supabase = createClient();
        const { data: current } = await supabase
          .from("entries")
          .select("metadata")
          .eq("id", entryId)
          .single();

        const existingMeta = (current?.metadata as Record<string, unknown>) || {};
        await supabase
          .from("entries")
          .update({ metadata: { ...existingMeta, enrichment } })
          .eq("id", entryId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Enrichment failed");
      } finally {
        setLoading(false);
      }
    },
    [entryId]
  );

  useEffect(() => {
    fetchEnrichment();
  }, [fetchEnrichment]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-border/40 p-6"
          >
            <div className="h-4 bg-surface rounded w-1/3 mb-3" />
            <div className="h-3 bg-surface rounded w-full mb-2" />
            <div className="h-3 bg-surface rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)] p-5">
        <p className="text-sm text-muted">{error}</p>
        <button
          onClick={() => fetchEnrichment(true)}
          className="mt-2 text-xs text-primary hover:text-primary-hover transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold font-heading flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          AI Insights
        </h2>
        <button
          onClick={() => fetchEnrichment(true)}
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Interpretation */}
      <div className="bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-xs font-semibold font-heading uppercase tracking-wider text-muted">
            Interpretation
          </h3>
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          {data.interpretation}
        </p>
      </div>

      {/* Next Steps */}
      {data.suggested_next_steps.length > 0 && (
        <div className="bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs font-semibold font-heading uppercase tracking-wider text-muted">
              Suggested Next Steps
            </h3>
          </div>
          <div className="space-y-3">
            {data.suggested_next_steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PRIORITY_STYLES[step.priority] || PRIORITY_STYLES.medium}`}
                >
                  {step.priority}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {step.action}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {step.reasoning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Literature Search Terms */}
      {data.related_search_terms.length > 0 && (
        <div className="bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs font-semibold font-heading uppercase tracking-wider text-muted">
              Literature Search Terms
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.related_search_terms.map((term) => (
              <a
                key={term}
                href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary-light text-primary hover:bg-primary/10 transition-colors"
              >
                {term}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
