begin;

-- A day report stays one record per project per calendar day, but a project
-- start check, daily closeout and attendance entry must exist once PER
-- BUILDING, not once for the whole project. Until now each table only
-- allowed a single row per day report, so recording a second building's
-- start check or closeout silently overwrote the first building's answers.

do $$
declare
  v_constraint_name text;
begin
  select constraint_.conname into v_constraint_name
  from pg_constraint constraint_
  where constraint_.conrelid = 'public.day_start_checks'::regclass
    and constraint_.contype = 'u'
    and constraint_.conkey = array[
      (select attribute.attnum from pg_attribute attribute
       where attribute.attrelid = 'public.day_start_checks'::regclass and attribute.attname = 'day_report_id')
    ];
  if v_constraint_name is not null then
    execute format('alter table public.day_start_checks drop constraint %I', v_constraint_name);
  end if;
end;
$$;

alter table public.day_start_checks
  add constraint day_start_checks_report_building_key unique (day_report_id, building_id);

do $$
declare
  v_constraint_name text;
begin
  select constraint_.conname into v_constraint_name
  from pg_constraint constraint_
  where constraint_.conrelid = 'public.day_closeouts'::regclass
    and constraint_.contype = 'u'
    and constraint_.conkey = array[
      (select attribute.attnum from pg_attribute attribute
       where attribute.attrelid = 'public.day_closeouts'::regclass and attribute.attname = 'day_report_id')
    ];
  if v_constraint_name is not null then
    execute format('alter table public.day_closeouts drop constraint %I', v_constraint_name);
  end if;
end;
$$;

alter table public.day_closeouts
  add constraint day_closeouts_report_building_key unique (day_report_id, building_id);

-- Attendance faced the same defect: the same party/discipline combination
-- could not be recorded in two different buildings on the same day.
alter table public.attendance_entries
  drop constraint if exists attendance_entries_report_party_discipline_key;

alter table public.attendance_entries
  add constraint attendance_entries_report_building_party_key
  unique (day_report_id, building_id, party_id, discipline);

-- Projects could never gain a second building: the only place that inserted
-- into public.buildings was the one-time project bootstrap. This RPC lets an
-- authorized project member add further buildings; RLS (buildings_manage)
-- enforces the project.configure permission on the insert itself.
create or replace function public.create_building(
  p_project_id uuid,
  p_code text,
  p_name text,
  p_description text default null
)
returns public.buildings
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_building public.buildings;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Project not found or not accessible' using errcode = 'P0002';
  end if;

  begin
    insert into public.buildings (
      organization_id,
      project_id,
      code,
      name,
      description,
      created_by
    ) values (
      v_project.organization_id,
      v_project.id,
      upper(trim(p_code)),
      trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      v_actor
    )
    returning * into v_building;
  exception when unique_violation then
    select building.* into v_building
    from public.buildings building
    where building.project_id = p_project_id
      and building.code = upper(trim(p_code));
  end;

  return v_building;
end;
$$;

revoke all on function public.create_building(uuid, text, text, text) from public, anon;
grant execute on function public.create_building(uuid, text, text, text) to authenticated;

-- Review submission must gate on every active building having its own start
-- check and closeout, not merely on any single row existing anywhere.
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

  if exists (
    select 1
    from public.buildings building
    where building.project_id = v_report.project_id
      and building.status = 'active'
      and not exists (
        select 1 from public.day_start_checks start_check
        where start_check.day_report_id = v_report.id
          and start_check.building_id = building.id
      )
  ) then
    raise exception 'Project start check is required' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.buildings building
    where building.project_id = v_report.project_id
      and building.status = 'active'
      and not exists (
        select 1 from public.day_closeouts closeout
        where closeout.day_report_id = v_report.id
          and closeout.building_id = building.id
      )
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

-- The formal snapshot must describe every building's start check and
-- closeout instead of assuming a single one exists for the whole report.
create or replace function public.build_day_report_snapshot(p_day_report_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare v_report public.day_reports;
begin
  select report.* into v_report from public.day_reports report where report.id = p_day_report_id;
  if not found then raise exception 'Day report not found or not accessible' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'schema_version', '202607260005',
    'frozen_at', now(),
    'report', to_jsonb(v_report),
    'project', (select to_jsonb(project) from public.projects project where project.id = v_report.project_id),
    'buildings', coalesce((select jsonb_agg(to_jsonb(building) order by building.name) from public.buildings building where building.project_id = v_report.project_id), '[]'::jsonb),
    'created_by_profile', (select jsonb_build_object('id', profile.id, 'display_name', profile.display_name) from public.profiles profile where profile.id = v_report.created_by),
    'start_checks', coalesce((select jsonb_agg(to_jsonb(start_check) order by start_check.building_id) from public.day_start_checks start_check where start_check.day_report_id = v_report.id), '[]'::jsonb),
    'closeouts', coalesce((select jsonb_agg(to_jsonb(closeout) order by closeout.building_id) from public.day_closeouts closeout where closeout.day_report_id = v_report.id), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.attendance_entries entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'registrations', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.site_registrations entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.inspections entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.findings entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'hse_events', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.hse_events entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'register_entries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.project_register_entries entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'open_actions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.due_at nulls last) from public.actions entry where entry.project_id = v_report.project_id and entry.status not in ('verified','cancelled')), '[]'::jsonb),
    'file_manifest', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.files entry where entry.project_id = v_report.project_id and entry.status <> 'deleted'), '[]'::jsonb)
  );
end;
$$;

commit;
