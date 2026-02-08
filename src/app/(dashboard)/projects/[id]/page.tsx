import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  getProject,
  getProjectStats,
  getProjectSessions,
  getProjectEntries,
  getCollections,
} from "@/lib/queries";
import { ProjectDetail } from "./project-detail";
import { notFound } from "next/navigation";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  let project;
  try {
    project = await getProject(supabase, id);
  } catch {
    notFound();
  }

  const [stats, sessions, entries, collections] = await Promise.all([
    getProjectStats(supabase, id),
    getProjectSessions(supabase, id),
    getProjectEntries(supabase, id, { limit: 50 }),
    getCollections(supabase, id),
  ]);

  return (
    <ProjectDetail
      project={project}
      stats={stats}
      sessions={sessions}
      entries={entries}
      collections={collections}
    />
  );
}
