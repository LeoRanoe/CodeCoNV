begin;

alter table public.project_settings
  add column if not exists configuration_status text not null default 'active'
    check (configuration_status in ('setup','ready','active')),
  add column if not exists default_shift_start time not null default '07:00',
  add column if not exists default_shift_end time not null default '16:00',
  add column if not exists disciplines jsonb not null default
    '["Carpenters","Electricians","HVAC","Painters","Facade","Rebar / concrete workers","Tiler","Sanitary","General"]'::jsonb
    check (jsonb_typeof(disciplines) = 'array'),
  add column if not exists finding_deadlines jsonb not null default
    '{"low":14,"medium":7,"high":3,"critical":1}'::jsonb
    check (jsonb_typeof(finding_deadlines) = 'object'),
  add column if not exists report_sections jsonb not null default
    '["management","workforce","work","logistics","quality","hse","documents","visual","boq"]'::jsonb
    check (jsonb_typeof(report_sections) = 'array'),
  add column if not exists default_units jsonb not null default
    '{"length":"m","area":"m2","volume":"m3","weight":"kg","temperature":"C"}'::jsonb
    check (jsonb_typeof(default_units) = 'object'),
  add column if not exists required_location_depth text not null default 'building'
    check (required_location_depth in ('building','floor','room','element')),
  add column if not exists report_header text,
  add column if not exists report_footer text;

alter table public.project_register_entries
  add column if not exists location_node_id uuid;

alter table public.project_register_entries
  drop constraint if exists project_register_entries_location_node_fkey;
alter table public.project_register_entries
  add constraint project_register_entries_location_node_fkey
  foreign key (location_node_id, project_id, organization_id)
  references public.location_nodes(id, project_id, organization_id);

alter table public.actions
  add column if not exists location_node_id uuid;

alter table public.site_registrations
  add column if not exists location_node_id uuid;

alter table public.site_registrations
  drop constraint if exists site_registrations_location_node_fkey;
alter table public.site_registrations
  add constraint site_registrations_location_node_fkey
  foreign key (location_node_id, project_id, organization_id)
  references public.location_nodes(id, project_id, organization_id);

alter table public.actions
  drop constraint if exists actions_location_node_fkey;
alter table public.actions
  add constraint actions_location_node_fkey
  foreign key (location_node_id, project_id, organization_id)
  references public.location_nodes(id, project_id, organization_id);

create or replace function app_private.validate_record_location()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_location public.location_nodes;
begin
  if new.location_node_id is null then return new; end if;
  select location.* into v_location
  from public.location_nodes location
  where location.id = new.location_node_id;
  if not found
    or v_location.project_id <> new.project_id
    or v_location.organization_id <> new.organization_id
    or v_location.building_id <> new.building_id then
    raise exception 'Location must belong to the selected project and building'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists inspections_validate_location on public.inspections;
create trigger inspections_validate_location
  before insert or update of building_id, location_node_id on public.inspections
  for each row execute function app_private.validate_record_location();

drop trigger if exists findings_validate_location on public.findings;
create trigger findings_validate_location
  before insert or update of building_id, location_node_id on public.findings
  for each row execute function app_private.validate_record_location();

drop trigger if exists hse_events_validate_location on public.hse_events;
create trigger hse_events_validate_location
  before insert or update of building_id, location_node_id on public.hse_events
  for each row execute function app_private.validate_record_location();

drop trigger if exists register_entries_validate_location on public.project_register_entries;
create trigger register_entries_validate_location
  before insert or update of building_id, location_node_id on public.project_register_entries
  for each row execute function app_private.validate_record_location();

drop trigger if exists actions_validate_location on public.actions;
create trigger actions_validate_location
  before insert or update of building_id, location_node_id on public.actions
  for each row execute function app_private.validate_record_location();

drop trigger if exists site_registrations_validate_location on public.site_registrations;
create trigger site_registrations_validate_location
  before insert or update of building_id, location_node_id on public.site_registrations
  for each row execute function app_private.validate_record_location();

create or replace function app_private.apply_finding_configuration()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_days integer;
begin
  if new.location_node_id is null
    and coalesce(new.issue_management ->> 'location_node_id', '') <> '' then
    new.location_node_id := (new.issue_management ->> 'location_node_id')::uuid;
  end if;

  if coalesce(new.issue_management ->> 'expected_resolution_date', '') = '' then
    select coalesce((settings.finding_deadlines ->> new.severity)::integer,
      case new.severity when 'critical' then 1 when 'high' then 3 when 'medium' then 7 else 14 end)
    into v_days
    from public.project_settings settings
    where settings.project_id = new.project_id;
    new.due_at := now() + make_interval(days => coalesce(v_days,
      case new.severity when 'critical' then 1 when 'high' then 3 when 'medium' then 7 else 14 end));
  end if;
  return new;
end;
$$;

drop trigger if exists findings_apply_project_configuration on public.findings;
create trigger findings_apply_project_configuration
  before insert on public.findings
  for each row execute function app_private.apply_finding_configuration();

create or replace function app_private.apply_register_location()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.location_node_id is null
    and coalesce(new.details ->> 'location_node_id', '') <> '' then
    new.location_node_id := (new.details ->> 'location_node_id')::uuid;
  end if;
  return new;
end;
$$;

drop trigger if exists register_entries_apply_location on public.project_register_entries;
create trigger register_entries_apply_location
  before insert on public.project_register_entries
  for each row execute function app_private.apply_register_location();

create or replace function public.start_project_inspection(
  p_project_id uuid,
  p_building_id uuid,
  p_day_report_id uuid,
  p_template_id uuid,
  p_title text,
  p_idempotency_key text,
  p_location_node_id uuid
)
returns public.inspections
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inspection public.inspections;
begin
  v_inspection := public.start_project_inspection(
    p_project_id, p_building_id, p_day_report_id, p_template_id, p_title, p_idempotency_key
  );
  update public.inspections
  set location_node_id = p_location_node_id
  where id = v_inspection.id
  returning * into v_inspection;
  return v_inspection;
end;
$$;

create or replace function public.create_project_hse_event(
  p_project_id uuid,
  p_building_id uuid,
  p_day_report_id uuid,
  p_event_type text,
  p_title text,
  p_description text,
  p_severity text,
  p_immediate_measure text,
  p_confidential boolean,
  p_occurred_at timestamptz,
  p_idempotency_key text,
  p_location_node_id uuid
)
returns public.hse_events
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.hse_events;
begin
  v_event := public.create_project_hse_event(
    p_project_id, p_building_id, p_day_report_id, p_event_type, p_title,
    p_description, p_severity, p_immediate_measure, p_confidential,
    p_occurred_at, p_idempotency_key
  );
  update public.hse_events
  set location_node_id = p_location_node_id
  where id = v_event.id
  returning * into v_event;
  return v_event;
end;
$$;

revoke all on function public.start_project_inspection(uuid,uuid,uuid,uuid,text,text,uuid)
  from public, anon;
grant execute on function public.start_project_inspection(uuid,uuid,uuid,uuid,text,text,uuid)
  to authenticated;
revoke all on function public.create_project_hse_event(uuid,uuid,uuid,text,text,text,text,text,boolean,timestamptz,text,uuid)
  from public, anon;
grant execute on function public.create_project_hse_event(uuid,uuid,uuid,text,text,text,text,text,boolean,timestamptz,text,uuid)
  to authenticated;

create or replace function public.create_site_registration(
  p_project_id uuid,
  p_building_id uuid,
  p_report_date date,
  p_registration_type text,
  p_title text,
  p_description text,
  p_priority text,
  p_occurred_at timestamptz,
  p_idempotency_key text,
  p_location_node_id uuid
)
returns public.site_registrations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_registration public.site_registrations;
begin
  v_registration := public.create_site_registration(
    p_project_id, p_building_id, p_report_date, p_registration_type,
    p_title, p_description, p_priority, p_occurred_at, p_idempotency_key
  );
  update public.site_registrations
  set location_node_id = p_location_node_id
  where id = v_registration.id
  returning * into v_registration;
  return v_registration;
end;
$$;

revoke all on function public.create_site_registration(uuid,uuid,date,text,text,text,text,timestamptz,text,uuid)
  from public, anon;
grant execute on function public.create_site_registration(uuid,uuid,date,text,text,text,text,timestamptz,text,uuid)
  to authenticated;

create or replace function public.create_project_action(
  p_project_id uuid,
  p_building_id uuid,
  p_owner_party_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_priority text,
  p_idempotency_key text,
  p_location_node_id uuid
)
returns public.actions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_action public.actions;
begin
  v_action := public.create_project_action(
    p_project_id, p_building_id, p_owner_party_id, p_title, p_description,
    p_due_at, p_priority, p_idempotency_key
  );
  update public.actions
  set location_node_id = p_location_node_id
  where id = v_action.id
  returning * into v_action;
  return v_action;
end;
$$;

revoke all on function public.create_project_action(uuid,uuid,uuid,text,text,timestamptz,text,text,uuid)
  from public, anon;
grant execute on function public.create_project_action(uuid,uuid,uuid,text,text,timestamptz,text,text,uuid)
  to authenticated;

create table if not exists public.boq_progress_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  register_entry_id uuid not null,
  progress_percent numeric(5,2) not null check (progress_percent between 0 and 100),
  quantity_completed numeric,
  note text not null check (char_length(note) between 2 and 1000),
  recorded_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (register_entry_id, recorded_at),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id)
    references public.buildings(id, project_id, organization_id),
  foreign key (register_entry_id, project_id, organization_id)
    references public.project_register_entries(id, project_id, organization_id)
);

create index if not exists boq_progress_updates_project_date_idx
  on public.boq_progress_updates(project_id, recorded_at desc);

alter table public.boq_progress_updates enable row level security;
drop policy if exists boq_progress_updates_select on public.boq_progress_updates;
create policy boq_progress_updates_select on public.boq_progress_updates
  for select to authenticated
  using (app_private.has_project_permission(project_id, 'records.read'));

create or replace function public.record_boq_progress(
  p_register_entry_id uuid,
  p_progress_percent numeric,
  p_quantity_completed numeric,
  p_note text,
  p_recorded_at timestamptz default now()
)
returns public.boq_progress_updates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_entry public.project_register_entries;
  v_update public.boq_progress_updates;
begin
  select entry.* into v_entry
  from public.project_register_entries entry
  where entry.id = p_register_entry_id and entry.register_type = 'boq';
  if not found then raise exception 'BOQ line not found' using errcode = 'P0002'; end if;
  if v_actor is null or not (
    app_private.has_project_permission(v_entry.project_id, 'records.create')
    or app_private.has_project_permission(v_entry.project_id, 'records.edit')
  ) then raise exception 'Missing BOQ progress permission' using errcode = '42501'; end if;
  if p_progress_percent < 0 or p_progress_percent > 100
    or char_length(btrim(coalesce(p_note, ''))) < 2 then
    raise exception 'Progress must be 0-100 and include a note' using errcode = '22023';
  end if;

  insert into public.boq_progress_updates (
    organization_id, project_id, building_id, register_entry_id,
    progress_percent, quantity_completed, note, recorded_at, created_by
  ) values (
    v_entry.organization_id, v_entry.project_id, v_entry.building_id,
    v_entry.id, p_progress_percent, p_quantity_completed, btrim(p_note),
    coalesce(p_recorded_at, now()), v_actor
  ) returning * into v_update;

  update public.project_register_entries
  set details = details || jsonb_build_object(
    'progress_percent', p_progress_percent,
    'quantity_completed', p_quantity_completed,
    'progress_updated_at', v_update.recorded_at,
    'progress_note', btrim(p_note)
  )
  where id = v_entry.id;
  return v_update;
end;
$$;

revoke all on function public.record_boq_progress(uuid,numeric,numeric,text,timestamptz)
  from public, anon;
grant execute on function public.record_boq_progress(uuid,numeric,numeric,text,timestamptz)
  to authenticated;

grant select on public.boq_progress_updates to authenticated;
revoke insert, update, delete on public.boq_progress_updates from authenticated;

alter table public.boq_progress_updates replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'boq_progress_updates'
    ) then
    alter publication supabase_realtime add table public.boq_progress_updates;
  end if;
end;
$$;

create or replace function public.build_client_period_report_snapshot(
  p_project_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_snapshot jsonb;
begin
  v_snapshot := public.build_period_report_snapshot(p_project_id, p_start_date, p_end_date);
  return v_snapshot || jsonb_build_object(
    'schema_version', '202607270003',
    'buildings', coalesce((
      select jsonb_agg(to_jsonb(building) order by building.code)
      from public.buildings building
      where building.project_id = p_project_id and building.status <> 'archived'
    ), '[]'::jsonb),
    'parties', coalesce((
      select jsonb_agg(to_jsonb(party) order by party.party_type, party.name)
      from public.parties party
      where party.project_id = p_project_id and party.active
    ), '[]'::jsonb),
    'project_settings', (
      select to_jsonb(settings)
      from public.project_settings settings
      where settings.project_id = p_project_id
    ),
    'location_nodes', coalesce((
      select jsonb_agg(to_jsonb(location) order by location.building_id, location.sort_order, location.code)
      from public.location_nodes location
      where location.project_id = p_project_id and location.status <> 'archived'
    ), '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(to_jsonb(file) order by file.created_at)
      from public.files file
      where file.project_id = p_project_id
        and file.status <> 'deleted'
        and (file.created_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'media_folders', coalesce((
      select jsonb_agg(to_jsonb(folder) order by folder.name)
      from public.media_folders folder
      where folder.project_id = p_project_id and folder.status = 'active'
    ), '[]'::jsonb),
    'finding_progress_updates', coalesce((
      select jsonb_agg(to_jsonb(progress) order by progress.inspected_at)
      from public.finding_progress_updates progress
      where progress.project_id = p_project_id
        and (progress.inspected_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'boq_progress_updates', coalesce((
      select jsonb_agg(to_jsonb(progress) order by progress.recorded_at)
      from public.boq_progress_updates progress
      where progress.project_id = p_project_id
        and (progress.recorded_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.build_client_period_report_snapshot(uuid,date,date)
  from public, anon;
grant execute on function public.build_client_period_report_snapshot(uuid,date,date)
  to authenticated;

commit;
