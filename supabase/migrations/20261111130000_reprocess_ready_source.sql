-- A ready source can be sent through the worker again by its owner: to pick up
-- something processing has since learned to do (a summary in metadata), or to re-fetch
-- a link whose page changed. Like retry_failed_source, this moves only the status, so
-- users still can't write worker-owned columns.
-- The worker replaces the source's chunks when it runs, and citations cascade from
-- chunks, so earlier answers lose their links into this source.
create function public.reprocess_ready_source (p_project_id uuid, p_source_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  update public.sources as s
  set
    status = 'pending',
    processing_error = null,
    processing_started_at = null
  where s.id = p_source_id
    and s.project_id = p_project_id
    and s.status = 'ready'
    and exists (
      select 1
      from public.projects as p
      where p.id = s.project_id
        and p.user_id = (select auth.uid())
    );

  get diagnostics changed_rows = row_count;

  return changed_rows = 1;
end;
$$;

-- SECURITY DEFINER bypasses RLS, so the function checks ownership itself above.
revoke all on function public.reprocess_ready_source (uuid, uuid) from public, anon;
grant execute on function public.reprocess_ready_source (uuid, uuid) to authenticated;
