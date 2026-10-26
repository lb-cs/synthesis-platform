-- The Python worker's side of the sources queue (CECS491-68). The worker polls
-- claim_pending_sources(); FOR UPDATE SKIP LOCKED means two workers never take the same
-- row. fail_stale_sources() fails rows a crashed worker left in 'processing'.
-- Why polling: docs/adr/0001-worker-polls-for-pending-sources.md.

-- When the current claim started. Null unless a worker has picked the source up.
alter table public.sources add column processing_started_at timestamptz;

-- Keeps the claim query cheap however many ready/failed rows pile up.
create index sources_pending_created_at_idx
  on public.sources (created_at)
  where status = 'pending';

-- Claims up to max_count pending sources, oldest first, and marks them 'processing'.
-- Returns only what the worker needs to fetch and process the file.
create function public.claim_pending_sources (max_count integer default 1)
returns table (
  id uuid,
  project_id uuid,
  kind text,
  storage_path text
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
  returning s.id, s.project_id, s.kind, s.storage_path;
$$;

-- Fails sources stuck in 'processing' longer than stale_after_minutes (a worker died
-- mid-run). Returns how many it failed.
create function public.fail_stale_sources (stale_after_minutes integer default 15)
returns integer
language sql
volatile
set search_path = ''
as $$
  with failed as (
    update public.sources s
    set
      status = 'failed',
      processing_error = 'Processing took too long and was stopped. Try uploading the file again.'
    where s.status = 'processing'
      and s.processing_started_at < now() - make_interval(mins => stale_after_minutes)
    returning s.id
  )
  select count(*)::integer from failed;
$$;

-- Worker only. Supabase's default privileges grant new functions to anon and
-- authenticated, so revoke from them explicitly.
revoke execute on function public.claim_pending_sources from public, anon, authenticated;
revoke execute on function public.fail_stale_sources from public, anon, authenticated;
grant execute on function public.claim_pending_sources to service_role;
grant execute on function public.fail_stale_sources to service_role;
