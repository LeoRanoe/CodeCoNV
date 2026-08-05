-- A pin for the record you are actually writing.
--
-- Placing a pin meant opening a list and picking a record that already existed. A
-- supervisor standing in Daily works has no such record yet: they are writing it. The
-- client asked for the obvious thing — "deze pin moet automatisch Dailyworks heten, met
-- mogelijk ook de datum & titel" — so a pin can now point at a site registration, and the
-- database fills its name from that record instead of from a dropdown.
--
-- Everything the pin already did stays: the number and the title come from the record, the
-- position is normalized, and the row is append-only in the audit trail.

alter table public.drawing_pins
  drop constraint if exists drawing_pins_linked_record_type_check;

alter table public.drawing_pins
  add constraint drawing_pins_linked_record_type_check
  check (linked_record_type in ('rfi','submittal','document','observation','inspection','visual','registration'));

drop policy if exists drawing_pins_select on public.drawing_pins;
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
      when 'registration' then app_private.has_project_permission(project_id, 'records.read') or app_private.has_project_permission(project_id, 'records.edit')
      else false
    end
  );

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
  elsif p_linked_record_type = 'registration' then
    -- The field record the supervisor is writing. The pin is named after the record type
    -- and the day it belongs to, exactly as it reads in the daily work register.
    v_allowed := app_private.has_project_permission(v_file.project_id, 'records.read')
      or app_private.has_project_permission(v_file.project_id, 'records.edit');
    select upper(registration.registration_type) || ' · '
        || to_char(coalesce(report.report_date, (registration.occurred_at at time zone 'America/Paramaribo')::date), 'DD-MM-YYYY'),
      registration.title
    into v_number, v_title
    from public.site_registrations registration
    left join public.day_reports report on report.id = registration.day_report_id
    where registration.id = p_linked_record_id
      and registration.project_id = v_file.project_id
      and registration.status <> 'cancelled';
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

revoke all on function public.create_drawing_pin(uuid,integer,numeric,numeric,text,uuid,text,text) from public, anon;
grant execute on function public.create_drawing_pin(uuid,integer,numeric,numeric,text,uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
