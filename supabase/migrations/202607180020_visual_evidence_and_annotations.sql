begin;

create table public.visual_captures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  location_node_id uuid,
  day_report_id uuid,
  file_id uuid not null,
  capture_type text not null default 'photo' check (capture_type in ('photo','panorama')),
  title text not null check (char_length(title) between 3 and 180),
  description text check (description is null or char_length(description) <= 2000),
  location_label text not null check (char_length(location_label) between 2 and 180),
  tour_name text check (tour_name is null or char_length(tour_name) between 2 and 120),
  tour_order integer check (tour_order is null or tour_order between 1 and 10000),
  captured_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (file_id),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  foreign key (location_node_id, project_id, organization_id) references public.location_nodes(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id) references public.day_reports(id, project_id, organization_id),
  foreign key (file_id, project_id, organization_id) references public.files(id, project_id, organization_id),
  check (capture_type = 'panorama' or (tour_name is null and tour_order is null)),
  check ((tour_name is null and tour_order is null) or (tour_name is not null and tour_order is not null))
);

create table public.visual_annotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  capture_id uuid not null,
  finding_id uuid not null,
  coordinate_mode text not null check (coordinate_mode in ('photo','spherical')),
  x_ratio numeric(8,7),
  y_ratio numeric(8,7),
  yaw numeric(12,9),
  pitch numeric(12,9),
  title text not null check (char_length(title) between 3 and 240),
  description text not null check (char_length(description) between 3 and 4000),
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'active' check (status in ('active','void')),
  void_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (finding_id),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (capture_id, project_id, organization_id) references public.visual_captures(id, project_id, organization_id),
  foreign key (finding_id, project_id, organization_id) references public.findings(id, project_id, organization_id),
  check (
    (coordinate_mode = 'photo' and x_ratio between 0 and 1 and y_ratio between 0 and 1 and yaw is null and pitch is null)
    or
    (coordinate_mode = 'spherical' and x_ratio is null and y_ratio is null and yaw between -3.141592654 and 3.141592654 and pitch between -1.570796327 and 1.570796327)
  ),
  check ((status = 'void' and char_length(void_reason) >= 5) or (status = 'active' and void_reason is null))
);

create index visual_captures_project_type_idx on public.visual_captures (project_id, capture_type, status, captured_at desc);
create index visual_captures_tour_idx on public.visual_captures (project_id, tour_name, tour_order) where tour_name is not null;
create index visual_annotations_capture_idx on public.visual_annotations (capture_id, status, created_at);

alter table public.visual_captures enable row level security;
alter table public.visual_annotations enable row level security;

create policy visual_captures_select on public.visual_captures
  for select to authenticated
  using (created_by = (select auth.uid()) or app_private.has_project_permission(project_id, 'files.read'));
create policy visual_annotations_select on public.visual_annotations
  for select to authenticated
  using (created_by = (select auth.uid()) or app_private.has_project_permission(project_id, 'findings.read'));

grant select on public.visual_captures, public.visual_annotations to authenticated;

create trigger visual_captures_touch before update on public.visual_captures
  for each row execute function app_private.touch_versioned_row();
create trigger visual_captures_audit after insert or update or delete on public.visual_captures
  for each row execute function app_private.capture_audit_event();
create trigger visual_annotations_touch before update on public.visual_annotations
  for each row execute function app_private.touch_versioned_row();
create trigger visual_annotations_audit after insert or update or delete on public.visual_annotations
  for each row execute function app_private.capture_audit_event();

create or replace function public.create_visual_capture(
  p_project_id uuid,
  p_building_id uuid,
  p_location_node_id uuid,
  p_day_report_id uuid,
  p_file_id uuid,
  p_capture_type text,
  p_title text,
  p_description text,
  p_location_label text,
  p_tour_name text,
  p_tour_order integer,
  p_captured_at timestamptz
)
returns public.visual_captures
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_file public.files;
  v_capture public.visual_captures;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'files.manage') then
    raise exception 'Missing files.manage permission' using errcode = '42501';
  end if;
  if p_capture_type not in ('photo','panorama') then
    raise exception 'Invalid visual capture type' using errcode = '22023';
  end if;
  if char_length(btrim(p_title)) < 3 or char_length(btrim(p_location_label)) < 2 then
    raise exception 'Title and location are required' using errcode = '22023';
  end if;
  if p_capture_type = 'photo' and (nullif(btrim(p_tour_name), '') is not null or p_tour_order is not null) then
    raise exception 'Only panoramas can be assigned to a tour' using errcode = '22023';
  end if;
  if (nullif(btrim(p_tour_name), '') is null) <> (p_tour_order is null) then
    raise exception 'Tour name and order must be supplied together' using errcode = '22023';
  end if;

  select file.* into v_file
  from public.files file
  where file.id = p_file_id and file.project_id = p_project_id and file.building_id = p_building_id
  for update;
  if not found or v_file.status <> 'available' or v_file.category <> 'photo'
    or v_file.mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'An available JPEG, PNG or WebP project image is required' using errcode = '23514';
  end if;

  select capture.* into v_capture from public.visual_captures capture where capture.file_id = v_file.id;
  if found then return v_capture; end if;

  insert into public.visual_captures (
    organization_id, project_id, building_id, location_node_id, day_report_id,
    file_id, capture_type, title, description, location_label, tour_name,
    tour_order, captured_at, created_by
  ) values (
    v_file.organization_id, v_file.project_id, p_building_id, p_location_node_id,
    p_day_report_id, v_file.id, p_capture_type, btrim(p_title),
    nullif(btrim(p_description), ''), btrim(p_location_label),
    nullif(btrim(p_tour_name), ''), p_tour_order, coalesce(p_captured_at, now()), v_actor
  ) returning * into v_capture;
  return v_capture;
end;
$$;

create or replace function public.create_visual_annotation_finding(
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

  v_finding := public.create_project_finding(
    v_capture.project_id, v_capture.building_id, v_capture.day_report_id,
    null, null, p_finding_type, p_title, p_description, p_severity,
    p_responsible_party_id, null, 'visual-finding:' || p_idempotency_key
  );
  update public.findings set
    location_node_id = v_capture.location_node_id,
    reference_text = 'Visual evidence: ' || v_capture.title || ' · ' || v_capture.location_label
  where id = v_finding.id returning * into v_finding;

  insert into public.visual_annotations (
    organization_id, project_id, capture_id, finding_id, coordinate_mode,
    x_ratio, y_ratio, yaw, pitch, title, description, severity,
    idempotency_key, created_by
  ) values (
    v_capture.organization_id, v_capture.project_id, v_capture.id, v_finding.id,
    p_coordinate_mode, p_x_ratio, p_y_ratio, p_yaw, p_pitch,
    btrim(p_title), btrim(p_description), p_severity, p_idempotency_key, v_actor
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

create or replace function public.void_visual_annotation(p_annotation_id uuid, p_reason text)
returns public.visual_annotations
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare v_annotation public.visual_annotations;
begin
  select annotation.* into v_annotation from public.visual_annotations annotation
    where annotation.id = p_annotation_id for update;
  if not found then raise exception 'Visual annotation not found' using errcode = 'P0002'; end if;
  if not app_private.has_project_permission(v_annotation.project_id, 'findings.manage') then
    raise exception 'Missing findings.manage permission' using errcode = '42501';
  end if;
  if char_length(btrim(p_reason)) < 5 then
    raise exception 'A void reason is required' using errcode = '22023';
  end if;
  update public.visual_annotations set status = 'void', void_reason = btrim(p_reason)
    where id = v_annotation.id returning * into v_annotation;
  return v_annotation;
end;
$$;

create or replace function public.create_manual_backup_export(
  p_organization_id uuid,
  p_project_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_run public.backup_runs;
  v_data jsonb;
  v_counts jsonb;
begin
  if v_actor is null or not app_private.has_organization_permission(p_organization_id, 'backup.manage') then
    raise exception 'Missing backup.manage permission' using errcode = '42501';
  end if;
  select run.* into v_run from public.backup_runs run
    where run.organization_id = p_organization_id and run.idempotency_key = p_idempotency_key;
  if not found then
    insert into public.backup_runs (organization_id, project_id, run_type, status, schema_version, idempotency_key, created_by)
      values (p_organization_id, p_project_id, 'manual', 'exporting', '202607180020', p_idempotency_key, v_actor)
      returning * into v_run;
  end if;
  v_data := jsonb_build_object(
    'organization', (select to_jsonb(entry) from public.organizations entry where entry.id = p_organization_id),
    'projects', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.projects entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.id = p_project_id)), '[]'::jsonb),
    'buildings', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.buildings entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'parties', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.parties entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'day_reports', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.day_reports entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'attendance_entries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.attendance_entries entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'site_registrations', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.site_registrations entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.actions entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'action_updates', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.action_updates entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'report_versions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.report_versions entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.inspections entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'inspection_responses', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.inspection_responses entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.findings entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'finding_updates', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.finding_updates entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'hse_events', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.hse_events entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'project_register_entries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.project_register_entries entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.files entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'file_links', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.file_links entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'visual_captures', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.visual_captures entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'visual_annotations', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.visual_annotations entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'report_reviews', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.report_reviews entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'report_signatures', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.report_signatures entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'report_distributions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.report_distributions entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'audit_events', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.audit_events entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb)
  );
  select jsonb_object_agg(key, jsonb_array_length(value)) into v_counts
    from jsonb_each(v_data) where jsonb_typeof(value) = 'array';
  update public.backup_runs set record_counts = v_counts, schema_version = '202607180020'
    where id = v_run.id returning * into v_run;
  return jsonb_build_object(
    'schema_version', '202607180020', 'application', 'CODECO Supervisie',
    'created_at', now(), 'organization_id', p_organization_id,
    'project_id', p_project_id, 'backup_run_id', v_run.id,
    'record_counts', v_counts, 'data', v_data,
    'file_manifest_note', 'Bestandsbytes staan uitsluitend in private Google Drive; deze export bevat alleen het manifest.'
  );
end;
$$;

create or replace function public.dry_run_backup_restore(p_manifest jsonb)
returns public.backup_runs
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid;
  v_run public.backup_runs;
begin
  if jsonb_typeof(p_manifest) <> 'object'
    or p_manifest ->> 'schema_version' not in ('202607180008','202607180020')
    or jsonb_typeof(p_manifest -> 'data') <> 'object' then
    raise exception 'Unsupported or incomplete backup manifest' using errcode = '22023';
  end if;
  v_organization_id := (p_manifest ->> 'organization_id')::uuid;
  if not app_private.has_organization_permission(v_organization_id, 'backup.manage') then
    raise exception 'Missing backup.manage permission' using errcode = '42501';
  end if;
  if p_manifest -> 'data' -> 'organization' ->> 'id' <> v_organization_id::text then
    raise exception 'Backup organization does not match manifest' using errcode = '23514';
  end if;
  if p_manifest ->> 'schema_version' = '202607180020'
    and (jsonb_typeof(p_manifest -> 'data' -> 'visual_captures') <> 'array'
      or jsonb_typeof(p_manifest -> 'data' -> 'visual_annotations') <> 'array') then
    raise exception 'Visual evidence backup data is incomplete' using errcode = '23514';
  end if;
  insert into public.backup_runs (
    organization_id, project_id, run_type, status, schema_version, idempotency_key,
    record_counts, created_by, verified_at
  ) values (
    v_organization_id, nullif(p_manifest ->> 'project_id', '')::uuid,
    'restore_test', 'dry_run_passed', p_manifest ->> 'schema_version',
    'dry-run:' || gen_random_uuid()::text, p_manifest -> 'record_counts', v_actor, now()
  ) returning * into v_run;
  return v_run;
end;
$$;

revoke all on function public.create_visual_capture(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,integer,timestamptz) from public, anon;
revoke all on function public.create_visual_annotation_finding(uuid,text,numeric,numeric,numeric,numeric,text,text,text,text,uuid,text) from public, anon;
revoke all on function public.void_visual_annotation(uuid,text) from public, anon;
grant execute on function public.create_visual_capture(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,integer,timestamptz) to authenticated;
grant execute on function public.create_visual_annotation_finding(uuid,text,numeric,numeric,numeric,numeric,text,text,text,text,uuid,text) to authenticated;
grant execute on function public.void_visual_annotation(uuid,text) to authenticated;

commit;
