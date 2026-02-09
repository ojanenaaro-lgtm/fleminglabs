-- FlemingLabs Initial Database Setup
-- Applied to Supabase project: aoorimdmitncovkeftnh (Fleming)
-- Date: 2026-02-08
--
-- This migration creates the complete database schema including:
-- - 7 tables with proper constraints and foreign keys
-- - 15 RLS policies (optimized with (select auth.uid()))
-- - 6 functions (inc. 2 SECURITY DEFINER helpers to avoid RLS recursion) + 5 triggers
-- - 15 indexes (including GIN for tags, metadata, full-text search)
-- - 2 storage buckets (recordings, avatars) with 8 policies
-- - Unified search_all() RPC function

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  lab_name text,
  institution text,
  research_focus text,
  language text default 'en',
  role text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Projects
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  ai_context text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Sessions (lab notebook sessions)
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  duration_seconds integer default 0,
  started_at timestamptz default now() not null,
  ended_at timestamptz,
  status text default 'active' not null check (status in ('active', 'paused', 'completed', 'processing'))
);

-- Entries (the atomic unit of knowledge)
create table if not exists public.entries (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.sessions(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_type text not null check (entry_type in ('voice_note', 'observation', 'measurement', 'protocol_step', 'annotation', 'hypothesis', 'anomaly', 'idea')),
  title text,
  content text not null,
  raw_transcript text,
  audio_url text,
  metadata jsonb default '{}'::jsonb,
  tags text[] default '{}',
  search_vector tsvector,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Connections between entries (the serendipity engine output)
create table if not exists public.connections (
  id uuid primary key default uuid_generate_v4(),
  source_entry_id uuid not null references public.entries(id) on delete cascade,
  target_entry_id uuid not null references public.entries(id) on delete cascade,
  connection_type text not null check (connection_type in ('pattern', 'contradiction', 'supports', 'reminds_of', 'same_phenomenon', 'literature_link')),
  reasoning text not null,
  confidence float default 0.5 check (confidence >= 0 and confidence <= 1),
  status text default 'pending' check (status in ('pending', 'suggested', 'confirmed', 'dismissed')),
  created_at timestamptz default now() not null
);

-- Collections (user-curated groupings of entries)
create table if not exists public.collections (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now() not null
);

-- Collection <-> Entry join table
create table if not exists public.collection_entries (
  collection_id uuid not null references public.collections(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  primary key (collection_id, entry_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_projects_owner on public.projects(owner_id);
create index if not exists idx_sessions_project on public.sessions(project_id);
create index if not exists idx_sessions_user on public.sessions(user_id);
create index if not exists idx_entries_session on public.entries(session_id);
create index if not exists idx_entries_project on public.entries(project_id);
create index if not exists idx_entries_user on public.entries(user_id);
create index if not exists idx_entries_type on public.entries(entry_type);
create index if not exists idx_entries_created on public.entries(created_at);
create index if not exists idx_entries_tags on public.entries using gin(tags);
create index if not exists idx_entries_metadata on public.entries using gin(metadata);
create index if not exists idx_entries_search on public.entries using gin(search_vector);
create index if not exists idx_connections_source on public.connections(source_entry_id);
create index if not exists idx_connections_target on public.connections(target_entry_id);
create index if not exists idx_collections_project on public.collections(project_id);
create index if not exists idx_collection_entries_entry on public.collection_entries(entry_id);

-- ============================================================================
-- ROW LEVEL SECURITY (optimized with (select auth.uid()) for performance)
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.sessions enable row level security;
alter table public.entries enable row level security;
alter table public.connections enable row level security;
alter table public.collections enable row level security;
alter table public.collection_entries enable row level security;

-- Helper functions to avoid circular RLS recursion between sessions <-> projects
-- These use SECURITY DEFINER to bypass RLS when checking cross-references.
create or replace function public.is_project_owner(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = (select auth.uid())
  );
$$ language sql security definer stable set search_path = '';

create or replace function public.is_project_member(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.sessions
    where project_id = p_project_id and user_id = (select auth.uid())
  );
$$ language sql security definer stable set search_path = '';

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select using ((select auth.uid()) = id);
create policy "Users can update own profile"
  on public.profiles for update using ((select auth.uid()) = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check ((select auth.uid()) = id);

-- Projects
create policy "Owners can do everything with own projects"
  on public.projects for all using ((select auth.uid()) = owner_id);
create policy "Project members can read projects"
  on public.projects for select using (
    public.is_project_member(projects.id)
  );

-- Sessions
create policy "Users can manage own sessions"
  on public.sessions for all using ((select auth.uid()) = user_id);
create policy "Project owners can read all project sessions"
  on public.sessions for select using (
    public.is_project_owner(sessions.project_id)
  );

-- Entries
create policy "Users can manage own entries"
  on public.entries for all using ((select auth.uid()) = user_id);
create policy "Project owners can read project entries"
  on public.entries for select using (
    public.is_project_owner(entries.project_id)
  );

-- Connections
create policy "Users can manage connections on own entries"
  on public.connections for all using (
    exists (select 1 from public.entries e where e.id = connections.source_entry_id and e.user_id = (select auth.uid()))
  );
create policy "Users can read connections for accessible entries"
  on public.connections for select using (
    exists (
      select 1 from public.entries e
      where (e.id = connections.source_entry_id or e.id = connections.target_entry_id)
        and (e.user_id = (select auth.uid()) or public.is_project_owner(e.project_id))
    )
  );

-- Collections
create policy "Project owners can manage collections"
  on public.collections for all using (
    public.is_project_owner(collections.project_id)
  );
create policy "Project members can read collections"
  on public.collections for select using (
    public.is_project_member(collections.project_id)
  );

-- Collection entries
create policy "Users can manage collection entries for own collections"
  on public.collection_entries for all using (
    exists (
      select 1 from public.collections c
      where c.id = collection_entries.collection_id and public.is_project_owner(c.project_id)
    )
  );
create policy "Users can read collection entries for accessible collections"
  on public.collection_entries for select using (
    exists (
      select 1 from public.collections c
      where c.id = collection_entries.collection_id and public.is_project_member(c.project_id)
    )
  );

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at timestamps
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();
create trigger set_entries_updated_at
  before update on public.entries
  for each row execute function public.update_updated_at();

-- ============================================================================
-- FULL-TEXT SEARCH
-- ============================================================================

create or replace function public.entries_search_vector_update()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.content, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.raw_transcript, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'C');
  return new;
end;
$$ language plpgsql set search_path = '';

create trigger entries_search_vector_trigger
  before insert or update of content, raw_transcript, tags on public.entries
  for each row execute function public.entries_search_vector_update();

-- Unified search function
create or replace function public.search_all(
  search_query text, user_id_param uuid, result_limit int default 20
)
returns table (
  id uuid, result_type text, title text, snippet text,
  relevance float, created_at timestamptz, parent_id uuid
) as $$
begin
  return query
  select e.id, 'entry'::text,
    coalesce(e.content, '')::text,
    ts_headline('english', coalesce(e.content, ''), plainto_tsquery('english', search_query),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=20'),
    ts_rank(e.search_vector, plainto_tsquery('english', search_query))::float,
    e.created_at, e.session_id
  from public.entries e
  where e.user_id = user_id_param and e.search_vector @@ plainto_tsquery('english', search_query)
  union all
  select s.id, 'session'::text, coalesce(s.title, 'Untitled Session')::text, coalesce(s.title, '')::text,
    case when s.title ilike '%' || search_query || '%' then 1.0 else 0.5 end, s.started_at, s.project_id
  from public.sessions s
  where s.user_id = user_id_param and s.title ilike '%' || search_query || '%'
  union all
  select p.id, 'project'::text, p.name::text, coalesce(p.description, p.name)::text,
    case when p.name ilike '%' || search_query || '%' then 1.0 else 0.5 end, p.created_at, null::uuid
  from public.projects p
  where p.owner_id = user_id_param
    and (p.name ilike '%' || search_query || '%' or p.description ilike '%' || search_query || '%')
  union all
  select c.id, 'connection'::text, coalesce(c.connection_type, 'Connection')::text, coalesce(c.reasoning, '')::text,
    case when c.reasoning ilike '%' || search_query || '%' then 0.8 else 0.3 end, c.created_at, c.source_entry_id
  from public.connections c join public.entries e on e.id = c.source_entry_id
  where e.user_id = user_id_param and c.reasoning ilike '%' || search_query || '%'
  order by relevance desc limit result_limit;
end;
$$ language plpgsql security definer set search_path = '';

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recordings', 'recordings', false, 52428800, array['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

-- Storage policies
create policy "Authenticated users can upload recordings"
  on storage.objects for insert with check (bucket_id = 'recordings' and auth.role() = 'authenticated');
create policy "Authenticated users can read recordings"
  on storage.objects for select using (bucket_id = 'recordings' and auth.role() = 'authenticated');
create policy "Authenticated users can update recordings"
  on storage.objects for update using (bucket_id = 'recordings' and auth.role() = 'authenticated');
create policy "Authenticated users can delete recordings"
  on storage.objects for delete using (bucket_id = 'recordings' and auth.role() = 'authenticated');
create policy "Anyone can view avatars"
  on storage.objects for select using (bucket_id = 'avatars');
create policy "Authenticated users can upload avatars"
  on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "Authenticated users can update avatars"
  on storage.objects for update using (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "Authenticated users can delete avatars"
  on storage.objects for delete using (bucket_id = 'avatars' and auth.role() = 'authenticated');
