-- Retrieval searches only sources that finished processing. The worker inserts a
-- source's chunks in batches before it marks the source ready, so a source that fails
-- part-way (a later batch errors, or it times out) keeps the chunks it already wrote
-- until it is retried or removed. Without this filter, chat could cite them.
-- Same signature as before, so the existing grants and generated types still apply.
create or replace function public.match_document_chunks (
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
  join public.sources s on s.id = c.source_id
  where c.project_id = match_document_chunks.project_id
    and s.status = 'ready'
    and c.embedding is not null
  order by c.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;
