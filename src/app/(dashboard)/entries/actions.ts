"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Entry, EntryType, Session, Collection, Connection } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────

export type SortField =
  | "content"
  | "entry_type"
  | "tags"
  | "session_id"
  | "created_at";

export type FetchEntriesParams = {
  page?: number;
  perPage?: number;
  search?: string;
  types?: EntryType[];
  tags?: string[];
  sessionId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: SortField;
  sortOrder?: "asc" | "desc";
};

export type FetchEntriesResult = {
  entries: (Entry & { session_title: string | null })[];
  total: number;
  page: number;
  perPage: number;
};

export type EntryWithRelations = Entry & {
  session_title: string | null;
  connections: (Connection & {
    linked_entry: Pick<Entry, "id" | "content" | "entry_type" | "tags" | "created_at">;
  })[];
};

// ── Fetch entries (list) ─────────────────────────────────────────────────

export async function fetchEntries(
  params: FetchEntriesParams = {}
): Promise<FetchEntriesResult> {
  const supabase = await createServerSupabaseClient();
  const {
    page = 1,
    perPage = 20,
    search,
    types,
    tags,
    sessionId,
    dateFrom,
    dateTo,
    sortBy = "created_at",
    sortOrder = "desc",
  } = params;

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("entries")
    .select("*, sessions!inner(title)", { count: "exact" });

  if (search) {
    query = query.ilike("content", `%${search}%`);
  }

  if (types && types.length > 0) {
    query = query.in("entry_type", types);
  }

  if (tags && tags.length > 0) {
    query = query.overlaps("tags", tags);
  }

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  const ascending = sortOrder === "asc";
  query = query.order(sortBy, { ascending }).range(from, to);

  const { data, count, error } = await query;

  if (error) throw new Error(error.message);

  const entries = (data ?? []).map((row: Record<string, unknown>) => {
    const { sessions, ...entry } = row as Record<string, unknown> & {
      sessions: { title: string | null };
    };
    return {
      ...entry,
      session_title: sessions?.title ?? null,
    } as Entry & { session_title: string | null };
  });

  return { entries, total: count ?? 0, page, perPage };
}

// ── Fetch single entry ───────────────────────────────────────────────────

export async function fetchEntry(
  id: string
): Promise<EntryWithRelations | null> {
  const supabase = await createServerSupabaseClient();

  const { data: entry, error } = await supabase
    .from("entries")
    .select("*, sessions!inner(title)")
    .eq("id", id)
    .single();

  if (error || !entry) return null;

  const { data: outgoing } = await supabase
    .from("connections")
    .select(
      "*, entries!connections_target_entry_id_fkey(id, content, entry_type, tags, created_at)"
    )
    .eq("source_entry_id", id);

  const { data: incoming } = await supabase
    .from("connections")
    .select(
      "*, entries!connections_source_entry_id_fkey(id, content, entry_type, tags, created_at)"
    )
    .eq("target_entry_id", id);

  const connections = [
    ...(outgoing ?? []).map((c: Record<string, unknown>) => {
      const { entries: linked, ...conn } = c as Record<string, unknown> & {
        entries: Pick<Entry, "id" | "content" | "entry_type" | "tags" | "created_at">;
      };
      return { ...conn, linked_entry: linked } as Connection & {
        linked_entry: Pick<Entry, "id" | "content" | "entry_type" | "tags" | "created_at">;
      };
    }),
    ...(incoming ?? []).map((c: Record<string, unknown>) => {
      const { entries: linked, ...conn } = c as Record<string, unknown> & {
        entries: Pick<Entry, "id" | "content" | "entry_type" | "tags" | "created_at">;
      };
      return { ...conn, linked_entry: linked } as Connection & {
        linked_entry: Pick<Entry, "id" | "content" | "entry_type" | "tags" | "created_at">;
      };
    }),
  ];

  const { sessions, ...rest } = entry as Record<string, unknown> & {
    sessions: { title: string | null };
  };

  return {
    ...rest,
    session_title: sessions?.title ?? null,
    connections,
  } as EntryWithRelations;
}

// ── Create entry ─────────────────────────────────────────────────────────

export async function createEntry(
  formData: FormData
): Promise<{ id: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const entryType = formData.get("entry_type") as EntryType;
  const content = formData.get("content") as string;
  const sessionId = formData.get("session_id") as string;
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const { data, error } = await supabase
    .from("entries")
    .insert({
      user_id: user.id,
      session_id: sessionId,
      entry_type: entryType,
      content,
      tags,
      metadata: {},
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

// ── Update entry ─────────────────────────────────────────────────────────

export async function updateEntry(
  id: string,
  updates: { content?: string; tags?: string[]; entry_type?: EntryType }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("entries")
    .update(updates)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Delete entries ───────────────────────────────────────────────────────

export async function deleteEntries(
  ids: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("entries").delete().in("id", ids);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Add entries to collection ────────────────────────────────────────────

export async function addToCollection(
  entryIds: string[],
  collectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const rows = entryIds.map((entryId) => ({
    entry_id: entryId,
    collection_id: collectionId,
  }));

  const { error } = await supabase
    .from("collection_entries")
    .upsert(rows, { onConflict: "collection_id,entry_id" });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Fetch sessions for filter dropdown ───────────────────────────────────

export async function fetchSessions(): Promise<
  Pick<Session, "id" | "title">[]
> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("sessions")
    .select("id, title")
    .order("started_at", { ascending: false })
    .limit(100);

  return (data ?? []) as Pick<Session, "id" | "title">[];
}

// ── Fetch collections ────────────────────────────────────────────────────

export async function fetchCollections(): Promise<
  Pick<Collection, "id" | "name">[]
> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("collections")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []) as Pick<Collection, "id" | "name">[];
}

// ── Fetch all unique tags ────────────────────────────────────────────────

export async function fetchAllTags(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase.from("entries").select("tags");

  if (!data) return [];

  const tagSet = new Set<string>();
  for (const row of data) {
    for (const tag of (row as { tags: string[] }).tags ?? []) {
      tagSet.add(tag);
    }
  }

  return Array.from(tagSet).sort();
}
