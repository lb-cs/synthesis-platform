-- Passages for Summaries (CECS491-81). Summaries reads only the sources the user picked,
-- so sample_source_chunks takes an optional list of source ids. Without it, a big
-- project would sample every ready source and could pass PostgREST's row cap before
-- reaching the chosen ones. Null keeps the old behavior (Themes reads every ready source).
-- Runs as the caller, so RLS limits it to the caller's own projects.

drop function public.sample_source_chunks (uuid, integer);

create function public.sample_source_chunks (
  project_id uuid,
  chunks_per_source integer default 8,
  source_ids uuid[] default null
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  page_number integer,
  chunk_index integer
)
language sql
stable
set search_path = ''
as $$
  with tiled as (
    select
      c.id,
      c.source_id,
      c.content,
      c.page_number,
      c.chunk_index,
      -- Split each source's chunks into N equal runs, in reading order.
      ntile(greatest(chunks_per_source, 1)) over (
        partition by c.source_id order by c.chunk_index
      ) as tile
    from public.document_chunks c
    join public.sources s on s.id = c.source_id
    where s.project_id = sample_source_chunks.project_id
      and s.status = 'ready'
      and (
        sample_source_chunks.source_ids is null
        or s.id = any (sample_source_chunks.source_ids)
      )
  ),
  firsts as (
    -- The first chunk of each run represents it.
    select
      t.*,
      row_number() over (partition by t.source_id, t.tile order by t.chunk_index) as rank
    from tiled t
  )
  select f.id, f.source_id, f.content, f.page_number, f.chunk_index
  from firsts f
  where f.rank = 1
    and chunks_per_source > 0
  order by f.source_id, f.chunk_index;
$$;

revoke execute on function public.sample_source_chunks from public, anon;
grant execute on function public.sample_source_chunks to authenticated, service_role;
