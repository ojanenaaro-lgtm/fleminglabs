"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { updateProject } from "@/lib/queries";
import { ENTRY_TYPE_LABELS } from "@/lib/types";
import type { Project, Session, Entry, Collection } from "@/lib/types";
import { SessionList } from "@/components/session-list";
import {
  FileText,
  GitBranch,
  Clock,
  Mic,
  Pencil,
  Check,
  X,
  FolderOpen,
  Settings,
} from "lucide-react";

type Tab = "sessions" | "entries" | "collections" | "connections" | "settings";

interface ProjectDetailProps {
  project: Project;
  stats: {
    totalEntries: number;
    totalConnections: number;
    hoursRecorded: number;
    totalSessions: number;
  };
  sessions: Session[];
  entries: (Entry & { sessions: { project_id: string } })[];
  collections: Collection[];
}

const entryTypeColors: Record<string, string> = {
  observation: "bg-emerald-50 text-emerald-700",
  protocol_step: "bg-amber-50 text-amber-700",
  voice_note: "bg-sky-50 text-sky-700",
  measurement: "bg-violet-50 text-violet-700",
  annotation: "bg-gray-100 text-gray-600",
};

export function ProjectDetail({
  project,
  stats,
  sessions,
  entries,
  collections,
}: ProjectDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("sessions");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      await updateProject(supabase, project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setEditing(false);
      router.refresh();
    } catch {
      // revert on error
      setName(project.name);
      setDescription(project.description ?? "");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "sessions", label: "Sessions", icon: Mic },
    { id: "entries", label: "Entries", icon: FileText },
    { id: "collections", label: "Collections", icon: FolderOpen },
    { id: "connections", label: "Connections", icon: GitBranch },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-[var(--card-shadow)]">
        {editing ? (
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xl font-semibold font-heading w-full px-3 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={2}
              className="w-full px-3 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
              <button
                onClick={() => {
                  setName(project.name);
                  setDescription(project.description ?? "");
                  setEditing(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted hover:bg-sidebar-hover transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold font-heading tracking-tight">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-sm text-muted mt-1">{project.description}</p>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
              title="Edit project"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/30">
          <div className="text-center">
            <p className="text-lg font-semibold font-heading">{stats.totalEntries}</p>
            <p className="text-xs text-muted">Entries</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold font-heading">{stats.totalSessions}</p>
            <p className="text-xs text-muted">Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold font-heading">{stats.totalConnections}</p>
            <p className="text-xs text-muted">Connections</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold font-heading">{stats.hoursRecorded}h</p>
            <p className="text-xs text-muted">Recorded</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/40 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl shadow-[var(--card-shadow)] overflow-hidden">
        {activeTab === "sessions" && (
          <SessionList sessions={sessions} projectId={project.id} />
        )}

        {activeTab === "entries" && (
          <EntriesTab entries={entries} />
        )}

        {activeTab === "collections" && (
          <CollectionsTab collections={collections} projectId={project.id} />
        )}

        {activeTab === "connections" && (
          <div className="p-8 text-center">
            <GitBranch className="w-8 h-8 text-muted/40 mx-auto mb-2" />
            <p className="text-sm text-muted">
              Connections between entries will appear here as you add more data.
            </p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-semibold font-heading">Project Settings</h3>
            <p className="text-sm text-muted">
              Project ID: <code className="text-xs bg-surface px-1.5 py-0.5 rounded">{project.id}</code>
            </p>
            <p className="text-sm text-muted">
              Created: {new Date(project.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-tabs ──────────────────────────────────────────────────────────

function EntriesTab({
  entries,
}: {
  entries: (Entry & { sessions: { project_id: string } })[];
}) {
  if (entries.length === 0) {
    return (
      <div className="p-8 text-center">
        <FileText className="w-8 h-8 text-muted/40 mx-auto mb-2" />
        <p className="text-sm text-muted">
          No entries yet. Start a recording session to capture observations.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {entries.map((entry) => {
        const badge = entryTypeColors[entry.entry_type] ?? "bg-gray-100 text-gray-600";
        return (
          <div key={entry.id} className="px-5 py-4 hover:bg-sidebar-hover/50 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium truncate flex-1">
                {entry.content?.slice(0, 80) || "Empty entry"}
                {(entry.content?.length ?? 0) > 80 ? "..." : ""}
              </p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badge}`}>
                {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{new Date(entry.created_at).toLocaleDateString()}</span>
              {entry.tags.length > 0 && (
                <div className="flex gap-1">
                  {entry.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-primary-light text-primary rounded text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                  {entry.tags.length > 3 && (
                    <span className="text-[10px] text-muted">+{entry.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollectionsTab({
  collections,
  projectId,
}: {
  collections: Collection[];
  projectId: string;
}) {
  if (collections.length === 0) {
    return (
      <div className="p-8 text-center">
        <FolderOpen className="w-8 h-8 text-muted/40 mx-auto mb-2" />
        <p className="text-sm text-muted">
          No collections yet. Create one to group related entries.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {collections.map((collection) => (
        <div
          key={collection.id}
          className="flex items-center gap-3 px-5 py-3 hover:bg-sidebar-hover/50 transition-colors"
        >
          <FolderOpen className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{collection.name}</p>
            {collection.description && (
              <p className="text-xs text-muted truncate">{collection.description}</p>
            )}
          </div>
          <span className="text-xs text-muted">
            {new Date(collection.created_at).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}
