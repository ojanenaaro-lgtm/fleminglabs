import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Project,
  Session,
  Entry,
  Collection,
  CollectionEntry,
  Connection,
} from "./types";

// ── Projects ────────────────────────────────────────────────────────────

export async function getProjects(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data as Project[];
}

export async function getProject(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error) throw error;
  return data as Project;
}

export async function createProject(
  supabase: SupabaseClient,
  project: { name: string; description?: string; owner_id: string }
) {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  updates: { name?: string; description?: string }
) {
  const { data, error } = await supabase
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(
  supabase: SupabaseClient,
  projectId: string
) {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) throw error;
}

// ── Sessions ────────────────────────────────────────────────────────────

export async function getProjectSessions(
  supabase: SupabaseClient,
  projectId: string
) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false });

  if (error) throw error;
  return data as Session[];
}

// ── Entries ─────────────────────────────────────────────────────────────

export async function getProjectEntries(
  supabase: SupabaseClient,
  projectId: string,
  filters?: {
    entry_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  let query = supabase
    .from("entries")
    .select("*, sessions!inner(project_id)")
    .eq("sessions.project_id", projectId)
    .order("created_at", { ascending: false });

  if (filters?.entry_type) {
    query = query.eq("entry_type", filters.entry_type);
  }
  if (filters?.search) {
    query = query.ilike("content", `%${filters.search}%`);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters?.limit ?? 20) - 1
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (Entry & { sessions: { project_id: string } })[];
}

// ── Connections ─────────────────────────────────────────────────────────

export async function getProjectConnections(
  supabase: SupabaseClient,
  projectId: string
) {
  // Get connections where source entry belongs to this project
  const { data, error } = await supabase
    .from("connections")
    .select("*, source:entries!source_entry_id(session_id, sessions!inner(project_id))")
    .eq("source.sessions.project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Connection[];
}

// ── Collections ─────────────────────────────────────────────────────────

export async function getCollections(
  supabase: SupabaseClient,
  projectId: string
) {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Collection[];
}

export async function getAllUserCollections(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("collections")
    .select("*, projects!inner(owner_id)")
    .eq("projects.owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as (Collection & { projects: { owner_id: string } })[];
}

export async function createCollection(
  supabase: SupabaseClient,
  collection: { project_id: string; name: string; description?: string }
) {
  const { data, error } = await supabase
    .from("collections")
    .insert(collection)
    .select()
    .single();

  if (error) throw error;
  return data as Collection;
}

export async function getCollectionEntries(
  supabase: SupabaseClient,
  collectionId: string
) {
  const { data, error } = await supabase
    .from("collection_entries")
    .select("*, entries(*)")
    .eq("collection_id", collectionId)
    .order("entries(created_at)", { ascending: false });

  if (error) throw error;
  return data as (CollectionEntry & { entries: Entry })[];
}

export async function addToCollection(
  supabase: SupabaseClient,
  collectionId: string,
  entryId: string
) {
  const { error } = await supabase
    .from("collection_entries")
    .insert({ collection_id: collectionId, entry_id: entryId });

  if (error) throw error;
}

export async function removeFromCollection(
  supabase: SupabaseClient,
  collectionId: string,
  entryId: string
) {
  const { error } = await supabase
    .from("collection_entries")
    .delete()
    .eq("collection_id", collectionId)
    .eq("entry_id", entryId);

  if (error) throw error;
}

// ── Aggregations ────────────────────────────────────────────────────────

export async function getProjectStats(
  supabase: SupabaseClient,
  projectId: string
) {
  const [entries, sessions, connections] = await Promise.all([
    supabase
      .from("entries")
      .select("id, sessions!inner(project_id)", { count: "exact", head: true })
      .eq("sessions.project_id", projectId),
    supabase
      .from("sessions")
      .select("started_at, ended_at")
      .eq("project_id", projectId),
    getProjectConnections(supabase, projectId),
  ]);

  const totalEntries = entries.count ?? 0;
  const totalConnections = connections.length;

  // Calculate total hours from sessions
  let totalSeconds = 0;
  for (const s of sessions.data ?? []) {
    if (s.started_at && s.ended_at) {
      totalSeconds +=
        (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
        1000;
    }
  }
  const hoursRecorded = Math.round((totalSeconds / 3600) * 10) / 10;

  return { totalEntries, totalConnections, hoursRecorded, totalSessions: (sessions.data ?? []).length };
}
