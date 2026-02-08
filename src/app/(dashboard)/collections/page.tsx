import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getProjects, getCollections } from "@/lib/queries";
import { CollectionsBrowser } from "./collections-browser";

export default async function CollectionsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const projects = await getProjects(supabase, user.id);

  // Fetch collections grouped by project
  const projectsWithCollections = await Promise.all(
    projects.map(async (project) => {
      const collections = await getCollections(supabase, project.id);
      return { project, collections };
    })
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-tight">
          Collections
        </h1>
        <p className="text-muted text-sm mt-1">
          Curated groups of entries across your projects.
        </p>
      </div>

      <CollectionsBrowser
        projectsWithCollections={projectsWithCollections}
        userId={user.id}
      />
    </div>
  );
}
