-- The worker fetches link sources (CECS491-85), so a claim returns the link's url too.
-- A function's result columns can't change in place: drop and recreate it, then
-- re-apply the grants from 20261020120000_worker_claim.sql.

drop function public.claim_pending_sources (integer);

-- Claims up to max_count pending sources, oldest first, and marks them 'processing'.
-- Returns only what the worker needs: the file to download, or the page to fetch.
create function public.claim_pending_sources (max_count integer default 1)
returns table (
  id uuid,
  project_id uuid,
  kind text,
  storage_path text,
  url text
)
language sql
volatile
set search_path = ''
as $$
  -- A CTE with FOR UPDATE is always materialized, so the LIMIT holds under concurrency.
  with picked as (
    select s.id
    from public.sources s
    where s.status = 'pending'
    order by s.created_at
    limit greatest(max_count, 0)
    for update skip locked
  )
  update public.sources s
  set
    status = 'processing',
    processing_error = null,
    processing_started_at = now()
  from picked
  where s.id = picked.id
  returning s.id, s.project_id, s.kind, s.storage_path, s.url;
$$;

-- Worker only. Supabase's default privileges grant new functions to anon and
-- authenticated, so revoke from them explicitly.
revoke execute on function public.claim_pending_sources from public, anon, authenticated;
grant execute on function public.claim_pending_sources to service_role;
