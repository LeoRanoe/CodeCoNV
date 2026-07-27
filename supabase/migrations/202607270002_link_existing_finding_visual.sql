create or replace function public.create_visual_annotation_for_finding(
  p_capture_id uuid,
  p_finding_id uuid,
  p_coordinate_mode text,
  p_x_ratio numeric,
  p_y_ratio numeric,
  p_yaw numeric,
  p_pitch numeric,
  p_description text,
  p_idempotency_key text
)
returns public.visual_annotations
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_capture public.visual_captures;
  v_finding public.findings;
  v_annotation public.visual_annotations;
begin
  select annotation.* into v_annotation
  from public.visual_annotations annotation
  where annotation.created_by = v_actor
    and annotation.idempotency_key = p_idempotency_key;
  if found then return v_annotation; end if;

  select annotation.* into v_annotation
  from public.visual_annotations annotation
  where annotation.finding_id = p_finding_id
    and annotation.status = 'active';
  if found then return v_annotation; end if;

  select capture.* into v_capture
  from public.visual_captures capture
  where capture.id = p_capture_id and capture.status = 'active';
  if not found then
    raise exception 'Visual capture not found or inactive' using errcode = 'P0002';
  end if;

  select finding.* into v_finding
  from public.findings finding
  where finding.id = p_finding_id
    and finding.project_id = v_capture.project_id
    and finding.building_id = v_capture.building_id;
  if not found then
    raise exception 'Finding and visual evidence must belong to the same project and building' using errcode = '22023';
  end if;

  if v_actor is null or not app_private.has_project_permission(v_capture.project_id, 'findings.manage') then
    raise exception 'Missing findings.manage permission' using errcode = '42501';
  end if;
  if (v_capture.capture_type = 'photo' and p_coordinate_mode <> 'photo')
    or (v_capture.capture_type = 'panorama' and p_coordinate_mode <> 'spherical') then
    raise exception 'Annotation coordinates do not match the visual type' using errcode = '22023';
  end if;
  if (p_coordinate_mode = 'photo' and (p_x_ratio not between 0 and 1 or p_y_ratio not between 0 and 1 or p_yaw is not null or p_pitch is not null))
    or (p_coordinate_mode = 'spherical' and (p_x_ratio is not null or p_y_ratio is not null or p_yaw not between -3.141592654 and 3.141592654 or p_pitch not between -1.570796327 and 1.570796327)) then
    raise exception 'Invalid visual annotation coordinates' using errcode = '22023';
  end if;
  if char_length(btrim(p_description)) < 3 then
    raise exception 'Marker description is required' using errcode = '22023';
  end if;

  insert into public.visual_annotations (
    organization_id, project_id, capture_id, finding_id, coordinate_mode,
    x_ratio, y_ratio, yaw, pitch, title, description, severity,
    idempotency_key, created_by
  ) values (
    v_capture.organization_id, v_capture.project_id, v_capture.id, v_finding.id,
    p_coordinate_mode, p_x_ratio, p_y_ratio, p_yaw, p_pitch,
    v_finding.title, btrim(p_description), v_finding.severity,
    p_idempotency_key, v_actor
  ) returning * into v_annotation;

  insert into public.file_links (
    organization_id, project_id, file_id, record_type, record_id,
    relationship, created_by
  ) values (
    v_capture.organization_id, v_capture.project_id, v_capture.file_id,
    'finding', v_finding.id, 'annotation', v_actor
  ) on conflict do nothing;

  return v_annotation;
end;
$$;

revoke all on function public.create_visual_annotation_for_finding(
  uuid, uuid, text, numeric, numeric, numeric, numeric, text, text
) from public, anon;

grant execute on function public.create_visual_annotation_for_finding(
  uuid, uuid, text, numeric, numeric, numeric, numeric, text, text
) to authenticated;
