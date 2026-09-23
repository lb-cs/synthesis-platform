-- Initial schema for the MVP path: a user creates a project, uploads sources, the
-- worker splits each source into embedded chunks, and the project's chat answers
-- questions with citations back to those chunks.
--
-- Not here, on purpose:
--   * Users, sessions, OAuth tokens: Supabase Auth owns them (auth.users).
--   * Account deletion: every table cascades from auth.users, so deleting the
--     auth user deletes their rows. Their Storage files are NOT cascaded.
--   * Summaries, comparisons, insights: stretch goals, their own migration later.
--
-- Who writes what: the app writes as the signed-in user, so RLS applies. The
-- Python worker (CECS491-11/12) writes processing status and chunks with the
-- service role, which bypasses RLS. Users can read those, never write them.

create extension if not exists vector with schema extensions;
create extension if not exists moddatetime with schema extensions;

-- Projects ------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute procedure extensions.moddatetime (updated_at);

-- Sources -------------------------------------------------------------------

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('pdf', 'text')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- Object path in the `sources` bucket: {user_id}/{project_id}/{file}.
  storage_path text not null unique,
  -- The worker's queue: it picks up 'pending' and moves the row forward.
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  processing_error text,
  -- Whatever the parser extracts: author, page count, and so on.
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  -- Target for document_chunks' composite foreign key.
  unique (id, project_id)
);

create index sources_project_id_idx on public.sources (project_id);

-- Document chunks -----------------------------------------------------------

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  -- Copied from the source so retrieval can filter by project without a join.
  project_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  page_number integer check (page_number > 0),
  -- OpenAI text-embedding-3-small. Null until the embedding step runs.
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index),
  -- Guarantees project_id matches the source's project.
  foreign key (source_id, project_id)
    references public.sources (id, project_id) on delete cascade
);

create index document_chunks_project_id_idx on public.document_chunks (project_id);

create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Chat ----------------------------------------------------------------------

-- One running conversation per project. Retrieval sends the model the matching
-- chunks and the last few messages, never the whole history.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  status text not null default 'complete'
    check (status in ('streaming', 'complete', 'failed')),
  created_at timestamptz not null default now()
);

create index chat_messages_project_id_created_at_idx
  on public.chat_messages (project_id, created_at);

-- Links an assistant answer to a chunk that supports it. The chunk gives the
-- source and page; deleting the source deletes its citations too.
create table public.citations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  chunk_id uuid not null references public.document_chunks (id) on delete cascade,
  -- The passage the answer leans on, when the model quotes one.
  anchor_text text,
  created_at timestamptz not null default now()
);

create index citations_message_id_idx on public.citations (message_id);
create index citations_chunk_id_idx on public.citations (chunk_id);

-- Retrieval -----------------------------------------------------------------

-- Nearest chunks to a query embedding within one project. Runs as the caller, so
-- RLS limits it to the caller's own projects.
create function public.match_document_chunks (
  project_id uuid,
  query_embedding extensions.vector(1536),
  match_count integer default 8
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  page_number integer,
  similarity double precision
)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    c.source_id,
    c.content,
    c.page_number,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.document_chunks c
  where c.project_id = match_document_chunks.project_id
    and c.embedding is not null
  order by c.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

-- Grants --------------------------------------------------------------------

-- Explicit, so behaviour doesn't depend on the project's default privileges.
-- anon gets nothing: every table is signed-in only.
revoke all on table
  public.projects, public.sources, public.document_chunks,
  public.chat_messages, public.citations
  from anon, authenticated;

grant select, insert, update, delete on table
  public.projects, public.chat_messages, public.citations
  to authenticated;

-- Users add and rename sources; status, errors, and metadata belong to the worker.
grant select, delete on table public.sources to authenticated;
grant insert (project_id, kind, title, storage_path) on table public.sources to authenticated;
grant update (title) on table public.sources to authenticated;

-- Chunks are written only by the worker.
grant select on table public.document_chunks to authenticated;

grant select, insert, update, delete on table
  public.projects, public.sources, public.document_chunks,
  public.chat_messages, public.citations
  to service_role;

revoke execute on function public.match_document_chunks from public, anon;
grant execute on function public.match_document_chunks to authenticated, service_role;

-- Row level security --------------------------------------------------------

alter table public.projects enable row level security;
alter table public.sources enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_messages enable row level security;
alter table public.citations enable row level security;

-- projects: the owner does everything.

create policy "Users can view their own projects"
  on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own projects"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own projects"
  on public.projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Everything below belongs to a project; access follows project ownership.

create policy "Users can view sources in their projects"
  on public.sources for select to authenticated
  using (project_id in (select id from public.projects where user_id = (select auth.uid())));

create policy "Users can add sources to their projects"
  on public.sources for insert to authenticated
  with check (project_id in (select id from public.projects where user_id = (select auth.uid())));

create policy "Users can rename sources in their projects"
  on public.sources for update to authenticated
  using (project_id in (select id from public.projects where user_id = (select auth.uid())))
  with check (project_id in (select id from public.projects where user_id = (select auth.uid())));

create policy "Users can delete sources in their projects"
  on public.sources for delete to authenticated
  using (project_id in (select id from public.projects where user_id = (select auth.uid())));

create policy "Users can view chunks in their projects"
  on public.document_chunks for select to authenticated
  using (project_id in (select id from public.projects where user_id = (select auth.uid())));

create policy "Users can view messages in their projects"
  on public.chat_messages for select to authenticated
  using (project_id in (select id from public.projects where user_id = (select auth.uid())));

create policy "Users can add messages to their projects"
  on public.chat_messages for insert to authenticated
  with check (project_id in (select id from public.projects where user_id = (select auth.uid())));

create policy "Users can update messages in their projects"
  on public.chat_messages for update to authenticated
  using (project_id in (select id from public.projects where user_id = (select auth.uid())))
  with check (project_id in (select id from public.projects where user_id = (select auth.uid())));

create policy "Users can delete messages in their projects"
  on public.chat_messages for delete to authenticated
  using (project_id in (select id from public.projects where user_id = (select auth.uid())));

-- citations: access follows the message they belong to. Both sides must be in
-- the caller's projects, so an answer can't cite someone else's chunk.

create policy "Users can view citations in their projects"
  on public.citations for select to authenticated
  using (message_id in (
    select m.id from public.chat_messages m
    where m.project_id in (select id from public.projects where user_id = (select auth.uid()))
  ));

create policy "Users can add citations in their projects"
  on public.citations for insert to authenticated
  with check (
    message_id in (
      select m.id from public.chat_messages m
      where m.project_id in (select id from public.projects where user_id = (select auth.uid()))
    )
    and chunk_id in (
      select c.id from public.document_chunks c
      where c.project_id in (select id from public.projects where user_id = (select auth.uid()))
    )
  );

create policy "Users can delete citations in their projects"
  on public.citations for delete to authenticated
  using (message_id in (
    select m.id from public.chat_messages m
    where m.project_id in (select id from public.projects where user_id = (select auth.uid()))
  ));

-- Storage -------------------------------------------------------------------

-- Private bucket for uploaded source files. Paths start with the owner's user id:
-- {user_id}/{project_id}/{file}. Deleting a source row does not delete its file;
-- the app removes it through the Storage API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sources',
  'sources',
  false,
  52428800, -- 50 MiB
  array['application/pdf', 'text/plain', 'text/markdown']
);

create policy "Users can upload source files to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

create policy "Users can read their own source files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

create policy "Users can delete their own source files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );
