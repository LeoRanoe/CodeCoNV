begin;

create table public.drawing_pins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  drawing_file_id uuid not null,
  page_number integer not null default 1 check (page_number between 1 and 10000),
  x_ratio numeric(8,7) not null check (x_ratio between 0 and 1),
  y_ratio numeric(8,7) not null check (y_ratio between 0 and 1),
  linked_record_type text not null check (linked_record_type in ('rfi','submittal','document','observation','inspection','visual')),
  linked_record_id uuid not null,
  linked_record_number text not null check (char_length(linked_record_number) between 1 and 120),
  linked_record_title text not null check (char_length(linked_record_title) between 1 and 240),
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'active' check (status in ('active','void')),
  void_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  foreign key (drawing_file_id, project_id, organization_id) references public.files(id, project_id, organization_id),
  check ((status = 'void' and char_length(void_reason) >= 5) or (status = 'active' and void_reason is null))
);

create index drawing_pins_drawing_page_idx
  on public.drawing_pins (drawing_file_id, page_number, status, created_at);
create index drawing_pins_linked_record_idx
  on public.drawing_pins (project_id, linked_record_type, linked_record_id);

alter table public.drawing_pins enable row level security;

create policy drawing_pins_select on public.drawing_pins
  for select to authenticated
  using (
    (app_private.has_project_permission(project_id, 'files.read')
      or app_private.has_project_permission(project_id, 'files.manage'))
    and case linked_record_type
      when 'rfi' then app_private.has_project_permission(project_id, 'records.read') or app_private.has_project_permission(project_id, 'records.edit')
      when 'submittal' then app_private.has_project_permission(project_id, 'records.read') or app_private.has_project_permission(project_id, 'records.edit')
      when 'document' then app_private.has_project_permission(project_id, 'records.read') or app_private.has_project_permission(project_id, 'records.edit') or app_private.has_project_permission(project_id, 'files.read')
      when 'observation' then app_private.has_project_permission(project_id, 'findings.read') or app_private.has_project_permission(project_id, 'findings.manage') or app_private.has_project_permission(project_id, 'findings.verify')
      when 'inspection' then app_private.has_project_permission(project_id, 'inspections.read') or app_private.has_project_permission(project_id, 'inspections.manage')
      when 'visual' then app_private.has_project_permission(project_id, 'files.read') or app_private.has_project_permission(project_id, 'files.manage')
      else false
    end
  );

grant select on public.drawing_pins to authenticated;

create trigger drawing_pins_touch before update on public.drawing_pins
  for each row execute function app_private.touch_versioned_row();
create trigger drawing_pins_audit after insert or update or delete on public.drawing_pins
  for each row execute function app_private.capture_audit_event();

create or replace function public.create_drawing_pin(
  p_drawing_file_id uuid,
  p_page_number integer,
  p_x_ratio numeric,
  p_y_ratio numeric,
  p_linked_record_type text,
  p_linked_record_id uuid,
  p_note text,
  p_idempotency_key text
)
returns public.drawing_pins
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_file public.files;
  v_pin public.drawing_pins;
  v_number text;
  v_title text;
  v_allowed boolean := false;
begin
  select pin.* into v_pin
  from public.drawing_pins pin
  where pin.created_by = v_actor and pin.idempotency_key = p_idempotency_key;
  if found then return v_pin; end if;

  select file.* into v_file
  from public.files file
  where file.id = p_drawing_file_id
  for update;
  if not found or v_file.building_id is null or v_file.status <> 'available' or v_file.category <> 'drawing'
    or v_file.mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'An available PDF, JPEG, PNG or WebP drawing is required' using errcode = '23514';
  end if;
  if v_actor is null or not app_private.has_project_permission(v_file.project_id, 'files.manage') then
    raise exception 'Missing files.manage permission' using errcode = '42501';
  end if;
  if p_page_number not between 1 and 10000 or p_x_ratio not between 0 and 1 or p_y_ratio not between 0 and 1 then
    raise exception 'Invalid drawing page or pin coordinates' using errcode = '22023';
  end if;
  if v_file.mime_type <> 'application/pdf' and p_page_number <> 1 then
    raise exception 'Image drawings only have page 1' using errcode = '22023';
  end if;

  if p_linked_record_type in ('rfi','submittal') then
    v_allowed := app_private.has_project_permission(v_file.project_id, 'records.read')
      or app_private.has_project_permission(v_file.project_id, 'records.edit');
    select entry.entry_number, entry.title into v_number, v_title
    from public.project_register_entries entry
    where entry.id = p_linked_record_id
      and entry.project_id = v_file.project_id
      and entry.register_type = p_linked_record_type;
  elsif p_linked_record_type = 'document' then
    select entry.entry_number, entry.title into v_number, v_title
    from public.project_register_entries entry
    where entry.id = p_linked_record_id
      and entry.project_id = v_file.project_id
      and entry.register_type = 'document';
    if found then
      v_allowed := app_private.has_project_permission(v_file.project_id, 'records.read')
        or app_private.has_project_permission(v_file.project_id, 'records.edit');
    else
      select 'FILE', file.original_name into v_number, v_title
      from public.files file
      where file.id = p_linked_record_id
        and file.project_id = v_file.project_id
        and file.status = 'available'
        and file.category in ('document','certificate');
      v_allowed := app_private.has_project_permission(v_file.project_id, 'files.read')
        or app_private.has_project_permission(v_file.project_id, 'files.manage');
    end if;
  elsif p_linked_record_type = 'observation' then
    v_allowed := app_private.has_project_permission(v_file.project_id, 'findings.read')
      or app_private.has_project_permission(v_file.project_id, 'findings.manage')
      or app_private.has_project_permission(v_file.project_id, 'findings.verify');
    select finding.finding_number, finding.title into v_number, v_title
    from public.findings finding
    where finding.id = p_linked_record_id and finding.project_id = v_file.project_id;
  elsif p_linked_record_type = 'inspection' then
    v_allowed := app_private.has_project_permission(v_file.project_id, 'inspections.read')
      or app_private.has_project_permission(v_file.project_id, 'inspections.manage');
    select inspection.inspection_number, inspection.title into v_number, v_title
    from public.inspections inspection
    where inspection.id = p_linked_record_id and inspection.project_id = v_file.project_id;
  elsif p_linked_record_type = 'visual' then
    v_allowed := app_private.has_project_permission(v_file.project_id, 'files.read')
      or app_private.has_project_permission(v_file.project_id, 'files.manage');
    select case when capture.capture_type = 'panorama' then '360' else 'PHOTO' end,
      capture.title into v_number, v_title
    from public.visual_captures capture
    where capture.id = p_linked_record_id
      and capture.project_id = v_file.project_id
      and capture.status = 'active';
  else
    raise exception 'Invalid linked record type' using errcode = '22023';
  end if;

  if not v_allowed then
    raise exception 'Missing permission for linked record' using errcode = '42501';
  end if;
  if v_number is null or v_title is null then
    raise exception 'Linked project record was not found' using errcode = 'P0002';
  end if;

  insert into public.drawing_pins (
    organization_id, project_id, building_id, drawing_file_id, page_number,
    x_ratio, y_ratio, linked_record_type, linked_record_id,
    linked_record_number, linked_record_title, note, idempotency_key, created_by
  ) values (
    v_file.organization_id, v_file.project_id, v_file.building_id,
    v_file.id, p_page_number, p_x_ratio, p_y_ratio, p_linked_record_type,
    p_linked_record_id, v_number, v_title, nullif(btrim(p_note), ''),
    p_idempotency_key, v_actor
  ) returning * into v_pin;
  return v_pin;
end;
$$;

create or replace function public.void_drawing_pin(p_pin_id uuid, p_reason text)
returns public.drawing_pins
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare v_pin public.drawing_pins;
begin
  select pin.* into v_pin from public.drawing_pins pin
  where pin.id = p_pin_id for update;
  if not found then raise exception 'Drawing pin not found' using errcode = 'P0002'; end if;
  if not app_private.has_project_permission(v_pin.project_id, 'files.manage') then
    raise exception 'Missing files.manage permission' using errcode = '42501';
  end if;
  if char_length(btrim(p_reason)) < 5 then
    raise exception 'A void reason is required' using errcode = '22023';
  end if;
  update public.drawing_pins
  set status = 'void', void_reason = btrim(p_reason)
  where id = v_pin.id returning * into v_pin;
  return v_pin;
end;
$$;

revoke all on function public.create_drawing_pin(uuid,integer,numeric,numeric,text,uuid,text,text) from public, anon;
revoke all on function public.void_drawing_pin(uuid,text) from public, anon;
grant execute on function public.create_drawing_pin(uuid,integer,numeric,numeric,text,uuid,text,text) to authenticated;
grant execute on function public.void_drawing_pin(uuid,text) to authenticated;

alter publication supabase_realtime add table public.drawing_pins;

commit;
