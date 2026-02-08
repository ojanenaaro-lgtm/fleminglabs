import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getProjects, getProjectSessions, getProjectEntries } from "@/lib/queries";
import { ProjectsGrid } from "./projects-grid";

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const projects = await getProjects(supabase, user.id);

  // Fetch entry counts and last activity for each project
  const projectsWithMeta = await Promise.all(
    projects.map(async (project) => {
      const [entries, sessions] = await Promise.all([
        getProjectEntries(supabase, project.id, { limit: 1 }),
        getProjectSessions(supabase, project.id),
      ]);

      // Count entries via a separate count query
      const { count } = await supabase
        .from("entries")
        .select("id, sessions!inner(project_id)", { count: "exact", head: true })
        .eq("sessions.project_id", project.id);

      return {
        ...project,
        entryCount: count ?? 0,
        sessionCount: sessions.length,
        lastActivity: project.updated_at,
      };
    })
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-tight">
          Projects
        </h1>
        <p className="text-muted text-sm mt-1">
          Organize your research into focused projects.
        </p>
      </div>

      <ProjectsGrid projects={projectsWithMeta} userId={user.id} />
    </div>
  );
}
