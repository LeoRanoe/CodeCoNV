-- Shared form storage: optional handwritten signatures for forms that did not have a
-- dedicated place yet, plus one association table that lets a single numbered record
-- belong to several buildings without cloning the record or changing its number.

alter table public.hse_events
  add column if not exists signed_by text
  check (signed_by is null or char_length(signed_by) between 2 and 120);
alter table public.hse_events
  add column if not exists signed_at timestamptz;
alter table public.hse_events
  add column if not exists signature_image text
  check (signature_image is null or char_length(signature_image) between 40 and 200000);

alter table public.project_register_entries
  add column if not exists signed_by text
  check (signed_by is null or char_length(signed_by) between 2 and 120);
alter table public.project_register_entries
  add column if not exists signed_at timestamptz;
alter table public.project_register_entries
  add column if not exists signature_image text
  check (signature_image is null or char_length(signature_image) between 40 and 200000);

create table if not exists public.record_buildings (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  record_type text not null check (record_type in (
    'inspection', 'finding', 'hse', 'register_entry', 'daily_work',
    'attendance', 'visual', 'file', 'action'
  )),
  record_id uuid not null,
  building_id uuid not null references public.buildings(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (record_type, record_id, building_id)
);

create index if not exists record_buildings_project_record_idx
  on public.record_buildings (project_id, record_type, record_id);
create index if not exists record_buildings_project_building_idx
  on public.record_buildings (project_id, building_id, record_type);

alter table public.record_buildings enable row level security;

drop policy if exists record_buildings_select on public.record_buildings;
create policy record_buildings_select on public.record_buildings
  for select to authenticated
  using (app_private.can_access_project(project_id));

drop policy if exists record_buildings_manage on public.record_buildings;
create policy record_buildings_manage on public.record_buildings
  for all to authenticated
  using (
    (case record_type
      when 'inspection' then app_private.has_project_permission(project_id, 'inspections.manage')
      when 'finding' then app_private.has_project_permission(project_id, 'findings.manage')
      when 'hse' then app_private.has_project_permission(project_id, 'hse.manage')
      when 'daily_work' then app_private.has_project_permission(project_id, 'reports.edit')
      when 'attendance' then app_private.has_project_permission(project_id, 'attendance.manage')
      when 'visual' then app_private.has_project_permission(project_id, 'files.manage')
      when 'file' then app_private.has_project_permission(project_id, 'files.manage')
      when 'action' then app_private.has_project_permission(project_id, 'actions.manage')
      else app_private.has_project_permission(project_id, 'records.edit')
    end)
    and exists (
      select 1 from public.buildings building
      where building.id = record_buildings.building_id and building.project_id = record_buildings.project_id
    )
  )
  with check (
    created_by = (select auth.uid())
    and (case record_type
      when 'inspection' then app_private.has_project_permission(project_id, 'inspections.manage')
      when 'finding' then app_private.has_project_permission(project_id, 'findings.manage')
      when 'hse' then app_private.has_project_permission(project_id, 'hse.manage')
      when 'daily_work' then app_private.has_project_permission(project_id, 'reports.edit')
      when 'attendance' then app_private.has_project_permission(project_id, 'attendance.manage')
      when 'visual' then app_private.has_project_permission(project_id, 'files.manage')
      when 'file' then app_private.has_project_permission(project_id, 'files.manage')
      when 'action' then app_private.has_project_permission(project_id, 'actions.manage')
      else app_private.has_project_permission(project_id, 'records.edit')
    end)
    and exists (
      select 1 from public.buildings building
      where building.id = record_buildings.building_id and building.project_id = record_buildings.project_id
    )
  );

grant select, insert, update, delete on public.record_buildings to authenticated;

create or replace function public.set_record_buildings(
  p_project_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_building_ids uuid[]
)
returns setof public.record_buildings
language plpgsql
security invoker
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid;
  v_building_ids uuid[];
  v_record_exists boolean := false;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_record_type not in ('inspection','finding','hse','register_entry','daily_work','attendance','visual','file','action') then
    raise exception 'Unsupported record type' using errcode = '22023';
  end if;
  if not (case p_record_type
    when 'inspection' then app_private.has_project_permission(p_project_id, 'inspections.manage')
    when 'finding' then app_private.has_project_permission(p_project_id, 'findings.manage')
    when 'hse' then app_private.has_project_permission(p_project_id, 'hse.manage')
    when 'daily_work' then app_private.has_project_permission(p_project_id, 'reports.edit')
    when 'attendance' then app_private.has_project_permission(p_project_id, 'attendance.manage')
    when 'visual' then app_private.has_project_permission(p_project_id, 'files.manage')
    when 'file' then app_private.has_project_permission(p_project_id, 'files.manage')
    when 'action' then app_private.has_project_permission(p_project_id, 'actions.manage')
    else app_private.has_project_permission(p_project_id, 'records.edit')
  end) then
    raise exception 'Missing record edit permission' using errcode = '42501';
  end if;

  select project.organization_id into v_organization_id
  from public.projects project where project.id = p_project_id;
  if v_organization_id is null then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(building_id order by building_id), '{}'::uuid[])
  into v_building_ids
  from (
    select distinct unnest(coalesce(p_building_ids, '{}'::uuid[])) as building_id
  ) selected;
  if cardinality(v_building_ids) = 0 then
    raise exception 'At least one building is required' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(v_building_ids) selected(building_id)
    where not exists (
      select 1 from public.buildings building
      where building.id = selected.building_id and building.project_id = p_project_id
    )
  ) then
    raise exception 'Building does not belong to this project' using errcode = '23503';
  end if;

  v_record_exists := case p_record_type
    when 'inspection' then exists (select 1 from public.inspections record where record.id = p_record_id and record.project_id = p_project_id)
    when 'finding' then exists (select 1 from public.findings record where record.id = p_record_id and record.project_id = p_project_id)
    when 'hse' then exists (select 1 from public.hse_events record where record.id = p_record_id and record.project_id = p_project_id)
    when 'register_entry' then exists (select 1 from public.project_register_entries record where record.id = p_record_id and record.project_id = p_project_id)
    when 'daily_work' then exists (select 1 from public.day_closeouts record where record.id = p_record_id and record.project_id = p_project_id)
    when 'attendance' then exists (select 1 from public.attendance_entries record where record.id = p_record_id and record.project_id = p_project_id)
    when 'visual' then exists (select 1 from public.visual_captures record where record.id = p_record_id and record.project_id = p_project_id)
    when 'file' then exists (select 1 from public.files record where record.id = p_record_id and record.project_id = p_project_id)
    when 'action' then exists (select 1 from public.actions record where record.id = p_record_id and record.project_id = p_project_id)
    else false
  end;
  if not v_record_exists then
    raise exception 'Record not found in this project' using errcode = 'P0002';
  end if;

  delete from public.record_buildings association
  where association.project_id = p_project_id
    and association.record_type = p_record_type
    and association.record_id = p_record_id
    and not (association.building_id = any(v_building_ids));

  insert into public.record_buildings (
    organization_id, project_id, record_type, record_id, building_id, created_by
  )
  select v_organization_id, p_project_id, p_record_type, p_record_id, building_id, v_actor
  from unnest(v_building_ids) selected(building_id)
  on conflict (record_type, record_id, building_id) do nothing;

  return query
    select association.* from public.record_buildings association
    where association.project_id = p_project_id
      and association.record_type = p_record_type
      and association.record_id = p_record_id
    order by association.created_at, association.building_id;
end;
$$;

revoke all on function public.set_record_buildings(uuid,text,uuid,uuid[]) from public, anon;
grant execute on function public.set_record_buildings(uuid,text,uuid,uuid[]) to authenticated;

notify pgrst, 'reload schema';
