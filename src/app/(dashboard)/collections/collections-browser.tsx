"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { createCollection, getCollectionEntries } from "@/lib/queries";
import { ENTRY_TYPE_LABELS } from "@/lib/types";
import type { Project, Collection, Entry } from "@/lib/types";
import {
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  X,
} from "lucide-react";

interface ProjectWithCollections {
  project: Project;
  collections: Collection[];
}

export function CollectionsBrowser({
  projectsWithCollections,
  userId,
}: {
  projectsWithCollections: ProjectWithCollections[];
  userId: string;
}) {
  const router = useRouter();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(projectsWithCollections.map((p) => p.project.id))
  );
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionEntries, setCollectionEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Inline create state
  const [creatingForProject, setCreatingForProject] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  function toggleProject(id: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSelectCollection(collectionId: string) {
    setSelectedCollection(collectionId);
    setLoadingEntries(true);
    try {
      const supabase = createClient();
      const data = await getCollectionEntries(supabase, collectionId);
      setCollectionEntries(data.map((ce) => ce.entries));
    } catch {
      setCollectionEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }

  async function handleCreate(projectId: string) {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const supabase = createClient();
      await createCollection(supabase, {
        project_id: projectId,
        name: newName.trim(),
      });
      setNewName("");
      setCreatingForProject(null);
      router.refresh();
    } catch {
      // silent fail
    } finally {
      setCreating(false);
    }
  }

  const selectedCollectionData = projectsWithCollections
    .flatMap((p) => p.collections)
    .find((c) => c.id === selectedCollection);

  if (projectsWithCollections.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-[var(--card-shadow)] p-12 text-center">
        <FolderOpen className="w-10 h-10 text-muted/30 mx-auto mb-3" />
        <p className="text-sm text-muted">No projects yet.</p>
        <p className="text-xs text-muted/70 mt-1">
          Create a project first, then organize entries into collections.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar: hierarchical browser */}
      <div className="w-72 shrink-0 bg-white rounded-xl shadow-[var(--card-shadow)] overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <h2 className="text-sm font-semibold font-heading">Browse</h2>
        </div>

        <div className="py-1">
          {projectsWithCollections.map(({ project, collections }) => {
            const expanded = expandedProjects.has(project.id);
            return (
              <div key={project.id}>
                {/* Project row */}
                <button
                  onClick={() => toggleProject(project.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
                >
                  {expanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted" />
                  )}
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <span className="truncate">{project.name}</span>
                  <span className="ml-auto text-[10px] text-muted">
                    {collections.length}
                  </span>
                </button>

                {/* Collections */}
                {expanded && (
                  <div className="ml-5 border-l border-border/30">
                    {collections.map((collection) => (
                      <button
                        key={collection.id}
                        onClick={() => handleSelectCollection(collection.id)}
                        className={`w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-sm transition-colors cursor-pointer ${
                          selectedCollection === collection.id
                            ? "bg-primary-light/60 text-primary font-medium"
                            : "text-muted hover:bg-sidebar-hover hover:text-foreground"
                        }`}
                      >
                        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{collection.name}</span>
                      </button>
                    ))}

                    {/* Inline create */}
                    {creatingForProject === project.id ? (
                      <div className="flex items-center gap-1 pl-4 pr-2 py-1">
                        <input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreate(project.id);
                            if (e.key === "Escape") setCreatingForProject(null);
                          }}
                          placeholder="Collection name"
                          className="flex-1 text-sm px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 min-w-0"
                          autoFocus
                          disabled={creating}
                        />
                        <button
                          onClick={() => setCreatingForProject(null)}
                          className="p-0.5 text-muted hover:text-foreground cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setCreatingForProject(project.id);
                          setNewName("");
                        }}
                        className="w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-xs text-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Add collection
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main: collection entries */}
      <div className="flex-1 bg-white rounded-xl shadow-[var(--card-shadow)] overflow-hidden min-h-[400px]">
        {selectedCollectionData ? (
          <>
            <div className="px-5 py-4 border-b border-border/40">
              <h2 className="text-sm font-semibold font-heading">
                {selectedCollectionData.name}
              </h2>
              {selectedCollectionData.description && (
                <p className="text-xs text-muted mt-0.5">
                  {selectedCollectionData.description}
                </p>
              )}
            </div>

            {loadingEntries ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted">Loading entries...</p>
              </div>
            ) : collectionEntries.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                <p className="text-sm text-muted">
                  No entries in this collection yet.
                </p>
                <p className="text-xs text-muted/70 mt-1">
                  Add entries from the project&apos;s entries tab.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {collectionEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="px-5 py-3 hover:bg-sidebar-hover/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium truncate flex-1">
                        {entry.content?.slice(0, 80) || "Empty entry"}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-primary-light text-primary shrink-0">
                        {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <FolderOpen className="w-10 h-10 text-muted/20 mx-auto mb-3" />
            <p className="text-sm text-muted">
              Select a collection to view its entries.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
