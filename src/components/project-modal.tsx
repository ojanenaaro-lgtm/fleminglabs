"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { createProject } from "@/lib/queries";
import { X, FlaskConical, BookOpen, ClipboardList, File } from "lucide-react";
import { useRouter } from "next/navigation";

const templates = [
  {
    id: "blank",
    label: "Blank",
    description: "Start from scratch",
    icon: File,
  },
  {
    id: "experiment",
    label: "Experiment",
    description: "Hypothesis, methods, results",
    icon: FlaskConical,
  },
  {
    id: "literature",
    label: "Literature Review",
    description: "Papers, notes, synthesis",
    icon: BookOpen,
  },
  {
    id: "protocol",
    label: "Protocol Development",
    description: "Step-by-step procedures",
    icon: ClipboardList,
  },
] as const;

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export function ProjectModal({ open, onClose, userId }: ProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [template, setTemplate] = useState<string>("blank");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const project = await createProject(supabase, {
        name: name.trim(),
        description: description.trim() || undefined,
        owner_id: userId,
      });
      onClose();
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch {
      setError("Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <h2 className="text-lg font-semibold font-heading">New Project</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label
              htmlFor="project-name"
              className="block text-sm font-medium mb-1.5"
            >
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CRISPR Efficiency Study"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="project-desc"
              className="block text-sm font-medium mb-1.5"
            >
              Description
              <span className="text-muted font-normal ml-1">(optional)</span>
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="project-tags"
              className="block text-sm font-medium mb-1.5"
            >
              Tags
              <span className="text-muted font-normal ml-1">
                (comma-separated, optional)
              </span>
            </label>
            <input
              id="project-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. genomics, CRISPR, mammalian-cells"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* Templates */}
          <div>
            <p className="text-sm font-medium mb-2">Template</p>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((t) => {
                const Icon = t.icon;
                const selected = template === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-colors cursor-pointer ${
                      selected
                        ? "border-primary bg-primary-light/50 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-sidebar-hover"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-medium leading-tight">{t.label}</p>
                      <p className="text-[11px] text-muted leading-tight mt-0.5">
                        {t.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
