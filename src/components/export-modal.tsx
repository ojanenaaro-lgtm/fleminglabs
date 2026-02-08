"use client";

import { useState } from "react";
import type { ExportFormat, ExportScope } from "@/lib/types";
import {
  X,
  Download,
  FileText,
  FileJson,
  Table,
  FileType,
  Loader2,
} from "lucide-react";

const formats: { value: ExportFormat; label: string; desc: string; icon: typeof FileText }[] = [
  { value: "markdown", label: "Markdown", desc: "For sharing, GitHub", icon: FileText },
  { value: "json", label: "JSON", desc: "Data portability", icon: FileJson },
  { value: "csv", label: "CSV", desc: "Spreadsheets", icon: Table },
  { value: "pdf", label: "PDF", desc: "Formal lab notebook", icon: FileType },
];

const scopes: { value: ExportScope; label: string }[] = [
  { value: "entry", label: "Single Entry" },
  { value: "session", label: "Session" },
  { value: "collection", label: "Collection" },
  { value: "project", label: "Entire Project" },
];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  defaultScope?: ExportScope;
  defaultId?: string;
  availableScopes?: { scope: ExportScope; id: string; label: string }[];
}

export function ExportModal({
  open,
  onClose,
  defaultScope = "session",
  defaultId = "",
  availableScopes,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [scope, setScope] = useState<ExportScope>(defaultScope);
  const [scopeId, setScopeId] = useState(defaultId);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleExport() {
    if (!scopeId) {
      setError("Please select what to export.");
      return;
    }

    setExporting(true);
    setError("");

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, scope, id: scopeId }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Export failed");
      }

      // Download the file
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      const filename =
        contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] ||
        `fleminglabs-export.${format === "markdown" ? "md" : format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-border/60">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold font-heading">Export Data</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Format selector */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {formats.map((f) => {
                  const Icon = f.icon;
                  const selected = format === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? "border-primary bg-primary-light"
                          : "border-border/60 hover:border-border hover:bg-sidebar-hover"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          selected ? "text-primary" : "text-muted"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{f.label}</p>
                        <p className="text-[11px] text-muted">{f.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scope selector */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Scope
              </label>
              {availableScopes ? (
                <select
                  value={scopeId}
                  onChange={(e) => {
                    const selected = availableScopes.find(
                      (s) => s.id === e.target.value
                    );
                    if (selected) {
                      setScope(selected.scope);
                      setScopeId(selected.id);
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                >
                  <option value="">Select what to export...</option>
                  {availableScopes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {scopes.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setScope(s.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                        scope === s.value
                          ? "bg-primary text-white"
                          : "bg-surface text-muted hover:text-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border/40">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
