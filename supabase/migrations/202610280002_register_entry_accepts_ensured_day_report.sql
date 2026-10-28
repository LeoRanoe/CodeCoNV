-- ensure_day_report_for_record (202610280001) gives a contractor the id of the day report
-- without letting them read it. create_project_register_entry is security invoker and checked
-- that id with a plain select on day_reports, which row-level security hides from the
-- contractor: "Day report not found in project" (QA sweep 2026-10-28, H1, second half).
--
-- The check is moved to a definer helper that answers only "does this report belong to this
-- project", for a caller who may write records there. The function body is otherwise
-- unchanged: it is patched in place so this migration cannot drift from the 202608090003
-- definition it replaces.
create or replace function app_private.day_report_in_project(p_day_report_id uuid, p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.day_reports report
    where report.id = p_day_report_id
      and report.project_id = p_project_id
  )
  and (select auth.uid()) is not null
  and app_private.has_project_permission(p_project_id, 'records.create');
$$;

revoke all on function app_private.day_report_in_project(uuid, uuid) from public, anon;
grant execute on function app_private.day_report_in_project(uuid, uuid) to authenticated;

do $patch$
declare
  v_oid oid;
  v_definition text;
  v_patched text;
  -- \s+ because the stored source keeps the line endings of the file it was applied from.
  v_old constant text := 'select 1 from public\.day_reports report\s+where report\.id = p_day_report_id and report\.project_id = p_project_id';
  v_new constant text := E'select 1 where app_private.day_report_in_project(p_day_report_id, p_project_id)';
begin
  select procedure.oid into v_oid
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'create_project_register_entry';

  v_definition := pg_get_functiondef(v_oid);
  v_patched := regexp_replace(v_definition, v_old, v_new);
  if v_patched = v_definition then
    raise exception 'create_project_register_entry no longer contains the expected day report check';
  end if;
  execute v_patched;
end;
$patch$;
