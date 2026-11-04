-- Retrieval for the Compare tab (CECS491-88). match_document_chunks takes the top
-- chunks across the whole project, so one long source can crowd a short one out of a
-- comparison. This takes the best few from each chosen source instead.
-- Runs as the caller, so RLS limits it to the caller's own projects, and like
-- match_document_chunks it searches only sources that finished processing.

create function public.match_source_chunks (
  project_id uuid,
  source_ids uuid[],
  query_embedding extensions.vector(1536),
  match_count_per_source integer default 6
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
  select m.id, m.source_id, m.content, m.page_number, m.similarity
  from public.sources s
  cross join lateral (
    select
      c.id,
      c.source_id,
      c.content,
      c.page_number,
      1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.document_chunks c
    where c.source_id = s.id
      and c.embedding is not null
    order by c.embedding operator(extensions.<=>) query_embedding
    limit greatest(match_count_per_source, 0)
  ) m
  where s.project_id = match_source_chunks.project_id
    and s.id = any (source_ids)
    and s.status = 'ready'
  order by m.source_id, m.similarity desc;
$$;

revoke execute on function public.match_source_chunks from public, anon;
grant execute on function public.match_source_chunks to authenticated, service_role;
