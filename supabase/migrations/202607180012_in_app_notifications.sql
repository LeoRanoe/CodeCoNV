begin;

alter table public.notifications
  add column dedupe_key text;
create unique index notifications_recipient_dedupe_idx
  on public.notifications (recipient_user_id, dedupe_key)
  where dedupe_key is not null;

create or replace function public.refresh_project_notifications(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
  v_rows integer := 0;
begin
  if (select auth.uid()) is null or not app_private.can_access_project(p_project_id) then
    raise exception 'Project not found or not accessible' using errcode = '42501';
  end if;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, due_at, dedupe_key
  )
  select action.organization_id, action.project_id, action.owner_user_id,
    case when action.due_at < now() then 'action_overdue' else 'action_due' end,
    case when action.due_at < now() then 'Actie verlopen: ' else 'Actie nadert deadline: ' end || action.action_number,
    action.title, 'action', action.id, action.due_at,
    'action:' || action.id::text || ':' || case when action.due_at < now() then 'overdue' else 'due' end
  from public.actions action
  where action.project_id = p_project_id and action.owner_user_id is not null
    and action.status not in ('verified','cancelled')
    and action.due_at <= now() + interval '24 hours'
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, due_at, dedupe_key
  )
  select finding.organization_id, finding.project_id, finding.assigned_user_id,
    'finding_due', 'Bevinding nadert deadline: ' || finding.finding_number,
    finding.title, 'finding', finding.id, finding.due_at,
    'finding:' || finding.id::text || ':due'
  from public.findings finding
  where finding.project_id = p_project_id and finding.assigned_user_id is not null
    and finding.status not in ('closed','cancelled','rejected')
    and finding.due_at <= now() + interval '24 hours'
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, dedupe_key
  )
  select distinct report.organization_id, report.project_id, membership.user_id,
    'review_requested', 'Dagrapport wacht op review', report.report_number,
    'report', report.id, 'report:' || report.id::text || ':review'
  from public.day_reports report
  join public.project_memberships membership on membership.project_id = report.project_id and membership.status = 'active'
  join public.project_member_roles member_role on member_role.membership_id = membership.id
  join public.role_permissions permission on permission.role_id = member_role.role_id and permission.permission_code = 'reports.review'
  where report.project_id = p_project_id and report.status in ('ready_for_review','in_review')
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  return v_count;
end;
$$;

revoke all on function public.refresh_project_notifications(uuid) from public, anon;
grant execute on function public.refresh_project_notifications(uuid) to authenticated;

commit;
