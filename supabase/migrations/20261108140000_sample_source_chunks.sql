-- Passages for the Themes tab (CECS491-90). Themes has no query to embed, so instead of
-- a similarity search this takes up to N chunks spread evenly through each ready source
-- (start, middle, end), so a theme can come from anywhere in a document.
-- Runs as the caller, so RLS limits it to the caller's own projects.

create function public.sample_source_chunks (
  project_id uuid,
  chunks_per_source integer default 8
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
