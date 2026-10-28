-- Every record the app writes hangs on the day report of its date. create_day_report is
-- security invoker, so a role without reports.create (the contractor) was refused by row-level
-- security before the actual record could be saved (QA sweep 2026-10-28, H1).
--
-- ensure_day_report_for_record returns the id of the day report of a date and creates the
-- report when it does not exist yet. It is available to every active project member who may
-- write at least one kind of record in that project. It returns only the id: ensuring a report
-- does not give read access to its content (day_reports_select is unchanged).
create or replace function public.ensure_day_report_for_record(
  p_project_id uuid,
  p_report_date date,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_report_id uuid;
  v_may_write boolean;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_project_id is null or p_report_date is null then
    raise exception 'Project and date are required' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'Idempotency key must contain at least 8 characters' using errcode = '22023';
  end if;

  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;

  -- Same answer for "does not exist" and "not yours": no project enumeration.
  v_may_write := found and exists (
    select 1
    from unnest(array[
      'records.create', 'actions.create', 'findings.create',
      'hse.manage', 'inspections.manage', 'files.manage'
    ]) as write_permission(code)
    where app_private.has_project_permission(p_project_id, write_permission.code)
  );
  if not v_may_write then
    raise exception 'Project not found or not accessible' using errcode = 'P0002';
  end if;

  select report.id into v_report_id
  from public.day_reports report
  where report.project_id = p_project_id
    and report.report_date = p_report_date;
  if found then
    return v_report_id;
  end if;

  begin
    insert into public.day_reports (
      organization_id, project_id, report_date, report_number, idempotency_key, created_by
    ) values (
      v_project.organization_id,
      v_project.id,
      p_report_date,
      'DR-' || to_char(p_report_date, 'YYYYMMDD'),
      p_idempotency_key,
      v_actor
    )
    returning id into v_report_id;
  exception when unique_violation then
    select report.id into v_report_id
    from public.day_reports report
    where report.project_id = p_project_id
      and (report.report_date = p_report_date
        or (report.created_by = v_actor and report.idempotency_key = p_idempotency_key))
    order by (report.report_date = p_report_date) desc
    limit 1;
  end;

  return v_report_id;
end;
$$;

revoke all on function public.ensure_day_report_for_record(uuid, date, text) from public, anon;
grant execute on function public.ensure_day_report_for_record(uuid, date, text) to authenticated;
