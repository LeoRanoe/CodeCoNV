-- Photo stacks and photo descriptions could not be saved.
--
-- Signed-in users may only read public.visual_captures: the table has a select policy and no
-- update policy, and a fresh database grants `authenticated` nothing but select on it
-- (202607180020). The app wrote stack_id, title and description with a plain table update, so:
--   * on a fresh database the update was refused ("permission denied for table
--     visual_captures") and a saved photo stack stayed "Sending failed" on the device although
--     its files were already stored;
--   * where the role still has the table privilege (the hosted project) row-level security
--     matched no row, so a stack never formed (no visual capture there has a stack_id) and
--     "describe" on a stored photo failed.
--
-- Both writes now go through functions with the same files.manage check as
-- create_visual_capture. No table privilege or policy is widened.
-- Rollback: drop the two functions; the app then reports the old refusal again.

create or replace function public.update_visual_capture_details(
  p_capture_id uuid,
  p_title text,
  p_description text
)
returns public.visual_captures
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_capture public.visual_captures;
begin
  select capture.* into v_capture
  from public.visual_captures capture
  where capture.id = p_capture_id
  for update;
  if not found or (select auth.uid()) is null
    or not app_private.has_project_permission(v_capture.project_id, 'files.manage') then
    raise exception 'Visual capture not found or not accessible' using errcode = 'P0002';
  end if;
  if v_capture.status <> 'active' then
    raise exception 'This photo is no longer active' using errcode = '55000';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 3 then
    raise exception 'Title is required' using errcode = '22023';
  end if;

  update public.visual_captures
  set title = btrim(p_title),
      description = nullif(btrim(coalesce(p_description, '')), '')
  where id = v_capture.id
  returning * into v_capture;
  return v_capture;
end;
$$;

create or replace function public.set_visual_capture_stack(
  p_capture_id uuid,
  p_stack_id uuid,
  p_building_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_captured_at timestamptz default null
)
returns public.visual_captures
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_capture public.visual_captures;
begin
  select capture.* into v_capture
  from public.visual_captures capture
  where capture.id = p_capture_id
  for update;
  if not found or (select auth.uid()) is null
    or not app_private.has_project_permission(v_capture.project_id, 'files.manage') then
    raise exception 'Visual capture not found or not accessible' using errcode = 'P0002';
  end if;
  if v_capture.status <> 'active' then
    raise exception 'This photo is no longer active' using errcode = '55000';
  end if;
  if p_stack_id is null then
    raise exception 'A stack is required' using errcode = '22023';
  end if;
  if p_building_id is not null and not exists (
    select 1 from public.buildings building
    where building.id = p_building_id and building.project_id = v_capture.project_id
  ) then
    raise exception 'The building does not belong to this project' using errcode = '22023';
  end if;
  if p_title is not null and char_length(btrim(p_title)) < 3 then
    raise exception 'Title is required' using errcode = '22023';
  end if;

  update public.visual_captures
  set stack_id = p_stack_id,
      building_id = coalesce(p_building_id, building_id),
      title = coalesce(nullif(btrim(p_title), ''), title),
      description = case when p_title is null then description else nullif(btrim(coalesce(p_description, '')), '') end,
      captured_at = coalesce(p_captured_at, captured_at)
  where id = v_capture.id
  returning * into v_capture;
  return v_capture;
end;
$$;

revoke all on function public.update_visual_capture_details(uuid, text, text) from public, anon;
revoke all on function public.set_visual_capture_stack(uuid, uuid, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.update_visual_capture_details(uuid, text, text) to authenticated;
grant execute on function public.set_visual_capture_stack(uuid, uuid, uuid, text, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
