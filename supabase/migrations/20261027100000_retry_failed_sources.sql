-- A failed source can be retried by its owner without granting users general
-- permission to change worker-owned status, metadata, or errors.
create function public.retry_failed_source (p_project_id uuid, p_source_id uuid)
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
    and s.status = 'failed'
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
revoke all on function public.retry_failed_source (uuid, uuid) from public, anon;
grant execute on function public.retry_failed_source (uuid, uuid) to authenticated;
