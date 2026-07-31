-- Punch-list alignment for visual issue markers.
--
-- The client's punch list (B1-MOH) classifies every item as Validate (green),
-- To be corrected (orange) or Need an alternative solution (red). The app already
-- offered that choice in the marker form, but it was only smuggled into the finding
-- description text and the marker on the image was coloured by severity instead.
--
-- This migration makes the classification real data on the annotation, and lets a
-- marker record the building it belongs to instead of always inheriting the
-- building of the photo.

begin;

alter table public.visual_annotations
  add column if not exists disposition text not null default 'to_be_corrected';

alter table public.visual_annotations
  drop constraint if exists visual_annotations_disposition_check;

alter table public.visual_annotations
  add constraint visual_annotations_disposition_check
  check (disposition in ('validated', 'to_be_corrected', 'alternative_solution'));

-- Backfill from the finding so existing markers keep their meaning.
update public.visual_annotations annotation
set disposition = coalesce(
  nullif(finding.issue_management ->> 'disposition', ''),
  'to_be_corrected'
)
from public.findings finding
where finding.id = annotation.finding_id
  and annotation.disposition = 'to_be_corrected';

-- The old signature had no building or disposition parameter. Drop it so PostgREST
-- resolves exactly one candidate instead of an ambiguous overload.
drop function if exists public.create_visual_annotation_finding(
  uuid, text, numeric, numeric, numeric, numeric, text, text, text, text, uuid, text
);

create function public.create_visual_annotation_finding(
  p_capture_id uuid,
  p_coordinate_mode text,
  p_x_ratio numeric,
  p_y_ratio numeric,
  p_yaw numeric,
  p_pitch numeric,
  p_finding_type text,
  p_title text,
  p_description text,
  p_severity text,
  p_responsible_party_id uuid,
  p_idempotency_key text,
  p_building_id uuid,
  p_disposition text
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
  v_building_id uuid;
begin
  select annotation.* into v_annotation
  from public.visual_annotations annotation
  where annotation.created_by = v_actor and annotation.idempotency_key = p_idempotency_key;
  if found then return v_annotation; end if;

  select capture.* into v_capture from public.visual_captures capture
  where capture.id = p_capture_id and capture.status = 'active';
  if not found then raise exception 'Visual capture not found or inactive' using errcode = 'P0002'; end if;
  if v_actor is null or not app_private.has_project_permission(v_capture.project_id, 'findings.create') then
    raise exception 'Missing findings.create permission' using errcode = '42501';
  end if;
  if (v_capture.capture_type = 'photo' and p_coordinate_mode <> 'photo')
    or (v_capture.capture_type = 'panorama' and p_coordinate_mode <> 'spherical') then
    raise exception 'Annotation coordinates do not match the visual type' using errcode = '22023';
  end if;
  if (p_coordinate_mode = 'photo' and (p_x_ratio not between 0 and 1 or p_y_ratio not between 0 and 1 or p_yaw is not null or p_pitch is not null))
    or (p_coordinate_mode = 'spherical' and (p_x_ratio is not null or p_y_ratio is not null or p_yaw not between -3.141592654 and 3.141592654 or p_pitch not between -1.570796327 and 1.570796327)) then
    raise exception 'Invalid visual annotation coordinates' using errcode = '22023';
  end if;
  if coalesce(p_disposition, '') not in ('validated', 'to_be_corrected', 'alternative_solution') then
    raise exception 'Invalid marker classification' using errcode = '22023';
  end if;

  -- A marker may sit in a different building than the photo was filed under, but it
  -- must stay inside the same project.
  v_building_id := coalesce(p_building_id, v_capture.building_id);
  if not exists (
    select 1 from public.buildings building
    where building.id = v_building_id and building.project_id = v_capture.project_id
  ) then
    raise exception 'Building does not belong to this project' using errcode = '22023';
  end if;

  v_finding := public.create_project_finding(
    v_capture.project_id, v_building_id, v_capture.day_report_id,
    null, null, p_finding_type, p_title, p_description, p_severity,
    p_responsible_party_id, null, 'visual-finding:' || p_idempotency_key,
    jsonb_build_object(
      'issue_type', 'quality',
      'impact_summary', '',
      'action_steps', '',
      'escalation_required', false,
      'disposition', p_disposition,
      'expected_resolution_date', null,
      'source_catalog_subject', null,
      'location_node_id', null
    )
  );
  update public.findings set
    location_node_id = v_capture.location_node_id,
    reference_text = 'Visual evidence: ' || v_capture.title || ' · ' || v_capture.location_label
  where id = v_finding.id returning * into v_finding;

  insert into public.visual_annotations (
    organization_id, project_id, capture_id, finding_id, coordinate_mode,
    x_ratio, y_ratio, yaw, pitch, title, description, severity, disposition,
    idempotency_key, created_by
  ) values (
    v_capture.organization_id, v_capture.project_id, v_capture.id, v_finding.id,
    p_coordinate_mode, p_x_ratio, p_y_ratio, p_yaw, p_pitch,
    p_title, p_description, p_severity, p_disposition,
    p_idempotency_key, v_actor
  ) returning * into v_annotation;

  return v_annotation;
end;
$$;

revoke all on function public.create_visual_annotation_finding(
  uuid, text, numeric, numeric, numeric, numeric, text, text, text, text, uuid, text, uuid, text
) from public, anon;
grant execute on function public.create_visual_annotation_finding(
  uuid, text, numeric, numeric, numeric, numeric, text, text, text, text, uuid, text, uuid, text
) to authenticated;

-- Linking a marker to an existing finding must copy that finding's classification,
-- otherwise the same issue would show two different colours.
create or replace function public.sync_visual_annotation_disposition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.disposition is null or new.disposition = 'to_be_corrected' then
    select coalesce(nullif(finding.issue_management ->> 'disposition', ''), 'to_be_corrected')
    into new.disposition
    from public.findings finding
    where finding.id = new.finding_id;
  end if;
  return new;
end;
$$;

drop trigger if exists visual_annotations_disposition_sync on public.visual_annotations;
create trigger visual_annotations_disposition_sync
  before insert on public.visual_annotations
  for each row execute function public.sync_visual_annotation_disposition();

commit;
