"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import { ProjectModal } from "@/components/project-modal";
import { Plus, FileText, Clock, FolderOpen } from "lucide-react";

interface ProjectWithMeta extends Project {
  entryCount: number;
  sessionCount: number;
  lastActivity: string;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProjectsGrid({
  projects,
  userId,
}: {
  projects: ProjectWithMeta[];
  userId: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Existing projects */}
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="bg-white rounded-xl p-5 shadow-[var(--card-shadow)] hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[11px] text-muted">
                {timeAgo(project.lastActivity)}
              </span>
            </div>

            <h3 className="text-sm font-semibold font-heading group-hover:text-primary transition-colors truncate">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-muted mt-1 line-clamp-2">
                {project.description}
              </p>
            )}

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
              <span className="flex items-center gap-1 text-xs text-muted">
                <FileText className="w-3 h-3" />
                {project.entryCount} {project.entryCount === 1 ? "entry" : "entries"}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted">
                <Clock className="w-3 h-3" />
                {project.sessionCount} {project.sessionCount === 1 ? "session" : "sessions"}
              </span>
            </div>
          </Link>
        ))}

        {/* New Project card */}
        <button
          onClick={() => setModalOpen(true)}
          className="bg-white rounded-xl p-5 shadow-[var(--card-shadow)] hover:shadow-md transition-shadow border-2 border-dashed border-border/60 hover:border-primary/40 flex flex-col items-center justify-center min-h-[160px] cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center mb-2 group-hover:bg-primary/10 transition-colors">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted group-hover:text-primary transition-colors">
            New Project
          </span>
        </button>
      </div>

      <ProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={userId}
      />
    </>
  );
}
