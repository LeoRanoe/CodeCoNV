begin;

alter table public.attendance_entries
  add constraint attendance_entries_report_party_discipline_key
  unique (day_report_id, party_id, discipline);

create or replace function public.create_project_workspace(
  p_organization_id uuid,
  p_code text,
  p_name text,
  p_location text,
  p_client_name text,
  p_building_code text,
  p_building_name text,
  p_contractor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_building public.buildings;
  v_membership public.project_memberships;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not app_private.has_organization_permission(p_organization_id, 'projects.create') then
    raise exception 'Missing projects.create permission' using errcode = '42501';
  end if;

  select project.* into v_project
  from public.projects project
  where project.organization_id = p_organization_id
    and project.code = upper(trim(p_code));

  if found then
    select building.* into v_building
    from public.buildings building
    where building.project_id = v_project.id
    order by building.created_at
    limit 1;

    return jsonb_build_object(
      'project_id', v_project.id,
      'building_id', v_building.id,
      'created', false
    );
  end if;

  insert into public.projects (
    organization_id,
    code,
    name,
    location,
    client_name,
    status,
    created_by
  ) values (
    p_organization_id,
    upper(trim(p_code)),
    trim(p_name),
    trim(p_location),
    nullif(trim(p_client_name), ''),
    'active',
    v_actor
  )
  returning * into v_project;

  insert into public.project_memberships (
    organization_id,
    project_id,
    user_id,
    status,
    invited_by
  ) values (
    p_organization_id,
    v_project.id,
    v_actor,
    'active',
    v_actor
  )
  returning * into v_membership;

  insert into public.project_member_roles (
    organization_id,
    project_id,
    membership_id,
    role_id
  )
  select
    p_organization_id,
    v_project.id,
    v_membership.id,
    role.id
  from public.roles role
  where role.organization_id = p_organization_id
    and role.scope = 'project'
    and role.code in ('project_manager', 'supervisor');

  insert into public.buildings (
    organization_id,
    project_id,
    code,
    name,
    description,
    created_by
  ) values (
    p_organization_id,
    v_project.id,
    upper(trim(p_building_code)),
    trim(p_building_name),
    'Eerste projectgebouw',
    v_actor
  )
  returning * into v_building;

  insert into public.parties (
    organization_id,
    project_id,
    code,
    name,
    party_type,
    created_by
  ) values
    (p_organization_id, v_project.id, 'CODECO', 'CODECO N.V.', 'supervisor', v_actor),
    (p_organization_id, v_project.id, 'CLIENT', coalesce(nullif(trim(p_client_name), ''), 'Opdrachtgever'), 'client', v_actor),
    (p_organization_id, v_project.id, 'CONTRACTOR', coalesce(nullif(trim(p_contractor_name), ''), 'Hoofdaannemer'), 'contractor', v_actor);

  return jsonb_build_object(
    'project_id', v_project.id,
    'building_id', v_building.id,
    'created', true
  );
end;
$$;

create or replace function public.submit_day_report_for_review(
  p_day_report_id uuid
)
returns public.day_reports
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_report public.day_reports;
begin
  select report.* into v_report
  from public.day_reports report
  where report.id = p_day_report_id
  for update;

  if not found then
    raise exception 'Day report not found or not accessible' using errcode = 'P0002';
  end if;

  if not app_private.has_project_permission(v_report.project_id, 'reports.edit') then
    raise exception 'Missing reports.edit permission' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.day_start_checks start_check
    where start_check.day_report_id = v_report.id
  ) then
    raise exception 'Project start check is required' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.day_closeouts closeout
    where closeout.day_report_id = v_report.id
  ) then
    raise exception 'Daily closeout is required' using errcode = '23514';
  end if;

  if v_report.status = 'draft' then
    update public.day_reports
    set status = 'in_progress', completeness_percent = greatest(completeness_percent, 35)
    where id = v_report.id
    returning * into v_report;
  elsif v_report.status = 'returned' then
    update public.day_reports
    set status = 'in_progress', completeness_percent = greatest(completeness_percent, 35)
    where id = v_report.id
    returning * into v_report;
  end if;

  if v_report.status = 'in_progress' then
    update public.day_reports
    set status = 'ready_for_review', completeness_percent = 100
    where id = v_report.id
    returning * into v_report;
  elsif v_report.status <> 'ready_for_review' then
    raise exception 'Report cannot be submitted from status %', v_report.status using errcode = '23514';
  end if;

  return v_report;
end;
$$;

revoke all on function public.create_project_workspace(uuid, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.submit_day_report_for_review(uuid) from public, anon;
grant execute on function public.create_project_workspace(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.submit_day_report_for_review(uuid) to authenticated;

commit;
