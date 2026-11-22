-- Word 14 / WD-192: an inspection can be planned for someone, so the notification has something to
-- announce.
--
-- Until now the app only started an inspection for the person standing there (executor = the
-- signed-in user), so "inspection scheduled or updated" could never reach a second person. These two
-- functions plan an inspection for a named colleague at a given time, and move it later:
--
--   plan_project_inspection        new inspection, status planned, executor and planned time set
--   reschedule_project_inspection  change the planned time and/or the executor of a planned one
--
-- Both need inspections.manage for the caller, and the executor must hold inspections.manage on the
-- project too (a person who could not open the checklist is not given the job). The executor is
-- notified by the trigger of migration 202611250002 (never the person making the change, once per
-- executor, time and status). Rollback: drop the three functions.

create or replace function public.plan_project_inspection(
  p_project_id uuid,
  p_building_id uuid,
  p_template_id uuid,
  p_title text,
  p_planned_at timestamptz,
  p_executed_by uuid,
  p_idempotency_key text,
  p_location_node_id uuid default null
)
returns public.inspections
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_template public.checklist_templates;
  v_inspection public.inspections;
  v_year integer;
  v_sequence integer;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_project_permission(p_project_id, 'inspections.manage') then
    raise exception 'Missing inspections.manage permission' using errcode = '42501';
  end if;
  if p_planned_at is null then raise exception 'A planned date and time is required' using errcode = '22023'; end if;
  if p_executed_by is null or not app_private.user_has_project_permission(p_executed_by, p_project_id, 'inspections.manage') then
    raise exception 'The person who carries out the inspection must be able to manage inspections on this project' using errcode = '22023';
  end if;
  select inspection.* into v_inspection from public.inspections inspection
  where inspection.project_id = p_project_id and inspection.created_by = v_actor and inspection.idempotency_key = p_idempotency_key;
  if found then return v_inspection; end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not exists (select 1 from public.buildings building where building.id = p_building_id and building.project_id = p_project_id) then
    raise exception 'The building is not part of this project' using errcode = '22023';
  end if;
  if p_location_node_id is not null and not exists (select 1 from public.location_nodes node where node.id = p_location_node_id and node.project_id = p_project_id) then
    raise exception 'The location is not part of this project' using errcode = '22023';
  end if;
  select template.* into v_template from public.checklist_templates template
    where template.id = p_template_id and template.organization_id = v_project.organization_id
      and template.module = 'inspection' and template.status = 'published'
      and (template.project_id is null or template.project_id = p_project_id);
  if not found then raise exception 'Published inspection template not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':inspections', 0));
  v_year := extract(year from (now() at time zone v_project.timezone))::integer;
  select coalesce(max(substring(inspection.inspection_number from '([0-9]+)$')::integer), 0) + 1
    into v_sequence from public.inspections inspection
    where inspection.project_id = p_project_id and inspection.inspection_number ~ ('^INS-' || v_year || '-[0-9]+$');
  insert into public.inspections (
    organization_id, project_id, building_id, location_node_id, template_id, inspection_number, title,
    status, planned_at, executed_by, idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id, p_location_node_id, v_template.id,
    'INS-' || v_year || '-' || lpad(v_sequence::text, 4, '0'), btrim(p_title),
    'planned', p_planned_at, p_executed_by, p_idempotency_key, v_actor
  ) returning * into v_inspection;
  return v_inspection;
end;
$$;

create or replace function public.reschedule_project_inspection(
  p_inspection_id uuid,
  p_planned_at timestamptz,
  p_executed_by uuid
)
returns public.inspections
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inspection public.inspections;
begin
  select inspection.* into v_inspection from public.inspections inspection where inspection.id = p_inspection_id for update;
  if not found or not app_private.has_project_permission(v_inspection.project_id, 'inspections.manage') then
    raise exception 'Inspection not found or not editable' using errcode = '42501';
  end if;
  if v_inspection.status <> 'planned' then
    raise exception 'Only a planned inspection can be rescheduled (status %)', v_inspection.status using errcode = '23514';
  end if;
  if p_planned_at is null then raise exception 'A planned date and time is required' using errcode = '22023'; end if;
  if p_executed_by is null or not app_private.user_has_project_permission(p_executed_by, v_inspection.project_id, 'inspections.manage') then
    raise exception 'The person who carries out the inspection must be able to manage inspections on this project' using errcode = '22023';
  end if;
  update public.inspections set planned_at = p_planned_at, executed_by = p_executed_by
  where id = p_inspection_id returning * into v_inspection;
  return v_inspection;
end;
$$;

revoke all on function public.plan_project_inspection(uuid, uuid, uuid, text, timestamptz, uuid, text, uuid) from public, anon;
revoke all on function public.reschedule_project_inspection(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.plan_project_inspection(uuid, uuid, uuid, text, timestamptz, uuid, text, uuid) to authenticated;
grant execute on function public.reschedule_project_inspection(uuid, timestamptz, uuid) to authenticated;

-- The people an inspection can be planned for: project people who can manage inspections.
create or replace function public.list_inspection_executors(p_project_id uuid)
returns table(user_id uuid, display_name text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select person.user_id, person.display_name
  from public.list_project_people(p_project_id) person
  where (select auth.uid()) is not null
    and app_private.has_project_permission(p_project_id, 'inspections.manage')
    and app_private.user_has_project_permission(person.user_id, p_project_id, 'inspections.manage')
  order by person.display_name;
$$;
revoke all on function public.list_inspection_executors(uuid) from public, anon;
grant execute on function public.list_inspection_executors(uuid) to authenticated;
