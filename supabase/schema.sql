-- FlemingLabs Database Schema
-- Run this against your Supabase project via the SQL Editor

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  lab_name text,
  institution text,
  research_context text, -- what they research, used as AI context
  language text default 'en',
  role text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Projects
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  ai_context text, -- persistent context the AI knows about this project
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Sessions (lab notebook sessions)
create table public.sessions (
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
create table public.entries (
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
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Connections between entries (the serendipity engine output)
create table public.connections (
  id uuid primary key default uuid_generate_v4(),
  source_entry_id uuid not null references public.entries(id) on delete cascade,
  target_entry_id uuid not null references public.entries(id) on delete cascade,
  connection_type text not null check (connection_type in ('pattern', 'contradiction', 'supports', 'reminds_of', 'same_phenomenon', 'literature_link')),
  reasoning text not null,
  confidence float default 0.5 check (confidence >= 0 and confidence <= 1),
  status text default 'suggested' check (status in ('suggested', 'confirmed', 'dismissed')),
  created_at timestamptz default now() not null
);

-- Collections (user-curated groupings of entries)
create table public.collections (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now() not null
);

-- Collection <-> Entry join table
create table public.collection_entries (
  collection_id uuid not null references public.collections(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  primary key (collection_id, entry_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_projects_owner on public.projects(owner_id);
create index idx_sessions_project on public.sessions(project_id);
create index idx_sessions_user on public.sessions(user_id);
create index idx_entries_session on public.entries(session_id);
create index idx_entries_project on public.entries(project_id);
create index idx_entries_user on public.entries(user_id);
create index idx_entries_type on public.entries(entry_type);
create index idx_entries_tags on public.entries using gin(tags);
create index idx_entries_metadata on public.entries using gin(metadata);
create index idx_connections_source on public.connections(source_entry_id);
create index idx_connections_target on public.connections(target_entry_id);
create index idx_collections_project on public.collections(project_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.sessions enable row level security;
alter table public.entries enable row level security;
alter table public.connections enable row level security;
alter table public.collections enable row level security;
alter table public.collection_entries enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Projects: owners have full access; project members can read
create policy "Owners can do everything with own projects"
  on public.projects for all
  using (auth.uid() = owner_id);

create policy "Project members can read projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.sessions s
      where s.project_id = projects.id
        and s.user_id = auth.uid()
    )
  );

-- Sessions: users can manage their own sessions, read sessions in their projects
create policy "Users can manage own sessions"
  on public.sessions for all
  using (auth.uid() = user_id);

create policy "Project owners can read all project sessions"
  on public.sessions for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = sessions.project_id
        and p.owner_id = auth.uid()
    )
  );

-- Entries: users can manage their own entries, read entries in shared projects
create policy "Users can manage own entries"
  on public.entries for all
  using (auth.uid() = user_id);

create policy "Project owners can read project entries"
  on public.entries for select
  using (
    exists (
      select 1 from public.sessions s
      join public.projects p on p.id = s.project_id
      where s.id = entries.session_id
        and p.owner_id = auth.uid()
    )
  );

-- Connections: users can manage connections on their own entries
create policy "Users can manage connections on own entries"
  on public.connections for all
  using (
    exists (
      select 1 from public.entries e
      where e.id = connections.source_entry_id
        and e.user_id = auth.uid()
    )
  );

create policy "Users can read connections for accessible entries"
  on public.connections for select
  using (
    exists (
      select 1 from public.entries e
      join public.sessions s on s.id = e.session_id
      join public.projects p on p.id = s.project_id
      where (e.id = connections.source_entry_id or e.id = connections.target_entry_id)
        and (e.user_id = auth.uid() or p.owner_id = auth.uid())
    )
  );

-- Collections: project owners can manage, members can read
create policy "Project owners can manage collections"
  on public.collections for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = collections.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Project members can read collections"
  on public.collections for select
  using (
    exists (
      select 1 from public.sessions s
      where s.project_id = collections.project_id
        and s.user_id = auth.uid()
    )
  );

-- Collection entries: same access as parent collection
create policy "Users can manage collection entries for own collections"
  on public.collection_entries for all
  using (
    exists (
      select 1 from public.collections c
      join public.projects p on p.id = c.project_id
      where c.id = collection_entries.collection_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Users can read collection entries for accessible collections"
  on public.collection_entries for select
  using (
    exists (
      select 1 from public.collections c
      join public.sessions s on s.project_id = c.project_id
      where c.id = collection_entries.collection_id
        and s.user_id = auth.uid()
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
$$ language plpgsql security definer;

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
$$ language plpgsql;

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();

create trigger set_entries_updated_at
  before update on public.entries
  for each row execute function public.update_updated_at();

-- ============================================================================
-- FULL-TEXT SEARCH
-- ============================================================================

-- Add tsvector column to entries for fast full-text search
alter table public.entries add column if not exists search_vector tsvector;

-- GIN index for fast full-text lookups
create index if not exists idx_entries_search on public.entries using gin(search_vector);

-- Auto-populate search_vector from content + raw_transcript + tags
create or replace function public.entries_search_vector_update()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.content, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.raw_transcript, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'C');
  return new;
end;
$$ language plpgsql;

create trigger entries_search_vector_trigger
  before insert or update of content, raw_transcript, tags on public.entries
  for each row execute function public.entries_search_vector_update();

-- Unified search function: searches entries, sessions, projects, connections
-- Returns results ordered by relevance with type discrimination
create or replace function public.search_all(
  search_query text,
  user_id_param uuid,
  result_limit int default 20
)
returns table (
  id uuid,
  result_type text,
  title text,
  snippet text,
  relevance float,
  created_at timestamptz,
  parent_id uuid
) as $$
begin
  return query
  -- Entries: full-text search on tsvector
  select
    e.id,
    'entry'::text as result_type,
    coalesce(e.content, '')::text as title,
    ts_headline('english', coalesce(e.content, ''), plainto_tsquery('english', search_query),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=20') as snippet,
    ts_rank(e.search_vector, plainto_tsquery('english', search_query))::float as relevance,
    e.created_at,
    e.session_id as parent_id
  from public.entries e
  where e.user_id = user_id_param
    and e.search_vector @@ plainto_tsquery('english', search_query)

  union all

  -- Sessions: ILIKE on title
  select
    s.id,
    'session'::text as result_type,
    coalesce(s.title, 'Untitled Session')::text as title,
    coalesce(s.title, '')::text as snippet,
    case when s.title ilike '%' || search_query || '%' then 1.0 else 0.5 end as relevance,
    s.started_at as created_at,
    s.project_id as parent_id
  from public.sessions s
  where s.user_id = user_id_param
    and s.title ilike '%' || search_query || '%'

  union all

  -- Projects: ILIKE on name and description
  select
    p.id,
    'project'::text as result_type,
    p.name::text as title,
    coalesce(p.description, p.name)::text as snippet,
    case when p.name ilike '%' || search_query || '%' then 1.0 else 0.5 end as relevance,
    p.created_at,
    null::uuid as parent_id
  from public.projects p
  where p.owner_id = user_id_param
    and (p.name ilike '%' || search_query || '%' or p.description ilike '%' || search_query || '%')

  union all

  -- Connections: ILIKE on reasoning
  select
    c.id,
    'connection'::text as result_type,
    coalesce(c.connection_type, 'Connection')::text as title,
    coalesce(c.reasoning, '')::text as snippet,
    case when c.reasoning ilike '%' || search_query || '%' then 0.8 else 0.3 end as relevance,
    c.created_at,
    c.source_entry_id as parent_id
  from public.connections c
  join public.entries e on e.id = c.source_entry_id
  where e.user_id = user_id_param
    and c.reasoning ilike '%' || search_query || '%'

  order by relevance desc
  limit result_limit;
end;
$$ language plpgsql security definer;
