begin;

-- The handwritten client PDF is the acceptance specification. Extend the central
-- register with the exact logs named by the client instead of hiding them in a
-- generic note field.
alter table public.project_register_entries
  drop constraint if exists project_register_entries_register_type_check;

alter table public.project_register_entries
  add constraint project_register_entries_register_type_check check (
    register_type in (
      'equipment','delivery','test','variation','delay','communication','risk',
      'document','drawing','rfi','submittal','site_instruction','meeting',
      'correspondence','cost','declaration','rfa','inspection_request','boq',
      'punch_list','notepad','agreement','technical_instruction','change_order',
      'contract','specification'
    )
  );

-- Email is the required notification channel. Existing in-app notifications are
-- retained as an audit-friendly inbox, while every new notification starts in a
-- service-only email delivery queue.
alter table public.project_settings
  add column if not exists email_notifications_enabled boolean not null default true;

alter table public.notifications
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_message_id text,
  add column if not exists email_last_error text;

update public.notifications
set email_status = 'skipped'
where email_attempts = 0 and email_sent_at is null;

alter table public.notifications
  drop constraint if exists notifications_email_status_check;
alter table public.notifications
  add constraint notifications_email_status_check
    check (email_status in ('pending','sending','sent','failed','skipped'));
alter table public.notifications
  drop constraint if exists notifications_email_attempts_check;
alter table public.notifications
  add constraint notifications_email_attempts_check
    check (email_attempts between 0 and 20);

create index if not exists notifications_email_queue_idx
  on public.notifications (email_status, created_at)
  where email_status in ('pending','failed','sending');

-- Reusable library requested in the client sketch. Projects install an audited
-- copy, so later library improvements never rewrite completed inspections.
create table public.checklist_library_templates (
  code text primary key check (code ~ '^LIB-[0-9]{3}$'),
  module text not null check (module in ('inspection','hse','delivery','test')),
  category text not null check (char_length(category) between 3 and 100),
  name text not null check (char_length(name) between 3 and 180),
  description text not null check (char_length(description) between 10 and 500),
  prompts jsonb not null check (jsonb_typeof(prompts) = 'array' and jsonb_array_length(prompts) between 3 and 20),
  sort_order integer not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

with library_names(name, sort_order) as (
  select name, ordinality::integer
  from unnest(array[
    'Projectstart en dossieroverdracht','Bouwplaatsinrichting','Maatvoering en referentiepunten','Goedgekeurde tekeningen op de werkplek','Vergunningen en toestemmingen','Werkmethode en taakplan','Materiaalgoedkeuring','Monster en mock-up','Bestaande toestand voor start','Milieu- en omgevingsbescherming',
    'Verwijderen begroeiing en terreinvoorbereiding','Ontgraving','Sleuf en talud','Bemaling','Ondergrond en draagkracht','Aanvulling','Laagverdichting','Grondverbetering','Funderingsput','Ondergrondse kabels en leidingen',
    'Wapening fundering','Wapening kolommen','Wapening balken','Wapening vloeren','Bekisting fundering','Bekisting kolommen','Bekisting balken en vloeren','Instortvoorzieningen en sparingen','Controle voor betonstort','Betonlevering','Slump en betontemperatuur','Kubus- en proefmonstername','Betonstort en verdichting','Nabehandeling beton','Betonreparatie',
    'Levering constructiestaal','Ankerbouten','Montage staalconstructie','Boutverbindingen','Lasverbindingen','Niet-destructief lasonderzoek','Brandwerende bescherming staal','Corrosiebescherming staal','Stalen vloerplaten','Metalen trappen en leuningen',
    'Levering metselblokken','Uitzetten metselwerk','Mortel en voegwerk','Spouwankers en verbindingen','Lateien en ondersteuningen','Pleister- en stucwerk','Ondergrond gevelafwerking','Kozijnen en deuren','Beglazing','Gevelkit en aansluitvoegen',
    'Dakconstructie','Dakbedekking en membranen','Waterdichting natte ruimten','Kelderwaterdichting','Afschot en afvoer','Dakdoorvoeren','Waterdichtheidsproef',
    'MEP-sparingen en instortdelen','Ruwbouw leidingwerk','Sanitaire afvoer','Drukproef waterleiding','Sanitaire toestellen','Elektrische kabelgoten en buizen','Bekabeling','Aarding en vereffening','Verdeelkasten','Verlichting','Brandmeldinstallatie','Brandbestrijdingsinstallatie','HVAC-kanalen','HVAC-leidingwerk','Installatie technische apparatuur','MEP-inbedrijfstelling',
    'Dekvloer','Vloertegels','Wandtegels','Plafonds','Gipswanden','Deuren en hang- en sluitwerk','Ondergrond schilderwerk','Eindafwerking schilderwerk','Vast meubilair','Eindschoonmaak',
    'Dagelijkse HSE-startcontrole','Persoonlijke beschermingsmiddelen','Werken op hoogte','Steigers','Ladders en trappen','Hijs- en hefwerk','Veilig ontgraven','Elektrische veiligheid','Heetwerk','Besloten ruimten','Orde en netheid','Noodorganisatie en brandveiligheid'
  ]::text[]) with ordinality as source(name, ordinality)
)
insert into public.checklist_library_templates (code, module, category, name, description, prompts, sort_order)
select
  'LIB-' || lpad(sort_order::text, 3, '0'),
  case
    when sort_order >= 89 then 'hse'
    when sort_order in (30, 36, 46) then 'delivery'
    when sort_order in (31, 32, 41, 62, 66, 78) then 'test'
    else 'inspection'
  end,
  case
    when sort_order <= 10 then 'Projectvoorbereiding'
    when sort_order <= 20 then 'Grondwerk'
    when sort_order <= 35 then 'Betonwerk'
    when sort_order <= 45 then 'Staalconstructie'
    when sort_order <= 55 then 'Metselwerk en gevel'
    when sort_order <= 62 then 'Dak en waterdichting'
    when sort_order <= 78 then 'Installaties'
    when sort_order <= 88 then 'Afbouw'
    else 'HSE'
  end,
  name,
  'CODECO-basiscontrole voor ' || lower(name) || '. De projectspecifieke versie kan vóór gebruik worden aangevuld.',
  case
    when sort_order >= 89 then jsonb_build_array(
      'Zijn de taakrisicoanalyse, vergunningen en verantwoordelijkheden voor ' || lower(name) || ' bevestigd?',
      'Zijn gevaren afgeschermd en zijn collectieve beheersmaatregelen aantoonbaar actief?',
      'Dragen alle betrokkenen de juiste en gekeurde persoonlijke beschermingsmiddelen?',
      'Zijn werkplek, toegang, gereedschappen en noodvoorzieningen veilig en bruikbaar?',
      'Zijn afwijkingen, stop-workbesluiten, incidenten en opvolgmaatregelen volledig vastgelegd?'
    )
    when sort_order in (30, 36, 46) then jsonb_build_array(
      'Komen product, hoeveelheid en leveringsreferentie overeen met de bestelling?',
      'Is de levering onbeschadigd en visueel conform de goedgekeurde specificatie?',
      'Zijn certificaten, batchnummers, keuringsbewijzen en andere documenten aanwezig?',
      'Zijn opslag, bescherming en traceerbaarheid op de bouwplaats geborgd?',
      'Is de levering geaccepteerd of is een afwijking met eigenaar en deadline aangemaakt?'
    )
    when sort_order in (31, 32, 41, 62, 66, 78) then jsonb_build_array(
      'Zijn goedgekeurde testprocedure, acceptatiecriteria en verantwoordelijkheden beschikbaar?',
      'Zijn meetmiddelen gekalibreerd en zijn uitgangscondities vóór de test bevestigd?',
      'Zijn alle meetwaarden, monsters en testresultaten volledig en herleidbaar vastgelegd?',
      'Vallen de resultaten binnen de voorgeschreven toleranties en acceptatiegrenzen?',
      'Zijn bewijs, ondertekening en eventuele afwijking of hertest aan het dossier gekoppeld?'
    )
    else jsonb_build_array(
      'Zijn de actuele goedgekeurde tekening, specificatie en werkmethode voor ' || lower(name) || ' beschikbaar?',
      'Zijn materialen, certificaten, monsters en voorafgaande goedkeuringen gecontroleerd?',
      'Zijn maatvoering, ondergrond, aansluitingen, toleranties en overige randvoorwaarden akkoord?',
      'Voldoet de uitvoering van ' || lower(name) || ' aan tekening, specificatie, kwaliteit en veiligheid?',
      'Zijn foto''s, meetgegevens, hold points en eventuele afwijkingen volledig vastgelegd?'
    )
  end,
  sort_order
from library_names;

alter table public.checklist_library_templates enable row level security;
create policy checklist_library_templates_select on public.checklist_library_templates
for select to authenticated using (active);

create or replace function public.install_checklist_library_template(
  p_project_id uuid,
  p_library_code text
)
returns public.checklist_templates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_library public.checklist_library_templates;
  v_template public.checklist_templates;
  v_version integer;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'templates.manage') then
    raise exception 'Missing templates.manage permission' using errcode = '42501';
  end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  select library.* into v_library from public.checklist_library_templates library
  where library.code = p_library_code and library.active;
  if not found then raise exception 'Checklist library item not found' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':checklist:' || v_library.code, 0));
  select coalesce(max(template.version_number), 0) + 1 into v_version
  from public.checklist_templates template
  where template.project_id = p_project_id and template.module = v_library.module and template.code = v_library.code;

  insert into public.checklist_templates (
    organization_id, project_id, module, code, name, description,
    version_number, status, published_at, created_by
  ) values (
    v_project.organization_id, v_project.id, v_library.module, v_library.code,
    v_library.name, v_library.description, v_version, 'published', now(), v_actor
  ) returning * into v_template;

  insert into public.checklist_items (
    organization_id, template_id, section, prompt, response_type, required,
    sort_order, failure_severity, guidance, created_by
  )
  select v_project.organization_id, v_template.id, v_library.category, prompt.value #>> '{}',
    case when v_library.module = 'hse' then 'yes_no_na' else 'pass_fail_na' end,
    true, prompt.ordinality::integer * 10,
    case when prompt.ordinality <= 2 then 'high' else 'medium' end,
    'Leg bij afkeur direct een traceerbare bevinding met bewijs en deadline vast.', v_actor
  from jsonb_array_elements(v_library.prompts) with ordinality as prompt(value, ordinality);
  return v_template;
end;
$$;

-- PDF and drawing markup is a separate, auditable overlay. The source drawing is
-- never modified, which preserves its contractual evidential value.
create table public.drawing_markups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  drawing_file_id uuid not null,
  page_number integer not null check (page_number between 1 and 10000),
  markup_type text not null check (markup_type in ('freehand','cloud','arrow','text')),
  geometry jsonb not null check (jsonb_typeof(geometry) = 'object'),
  color text not null default '#D92D20' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  stroke_width numeric(4,1) not null default 3 check (stroke_width between 1 and 20),
  text_content text check (text_content is null or char_length(text_content) between 1 and 500),
  status text not null default 'active' check (status in ('active','void')),
  void_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (building_id, project_id, organization_id)
    references public.buildings(id, project_id, organization_id),
  foreign key (drawing_file_id, project_id, organization_id)
    references public.files(id, project_id, organization_id),
  check (markup_type = 'text' or text_content is null),
  check (status <> 'void' or char_length(void_reason) >= 5)
);

create index drawing_markups_file_page_idx
  on public.drawing_markups (drawing_file_id, page_number, created_at)
  where status = 'active';

create or replace function app_private.valid_normalized_point(p_point jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_typeof(p_point) = 'object'
    and jsonb_typeof(p_point -> 'x') = 'number'
    and jsonb_typeof(p_point -> 'y') = 'number'
    and (p_point ->> 'x')::numeric between 0 and 1
    and (p_point ->> 'y')::numeric between 0 and 1, false);
$$;

create or replace function app_private.valid_drawing_markup_geometry(
  p_markup_type text,
  p_geometry jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_point jsonb;
  v_count integer;
begin
  if jsonb_typeof(p_geometry) <> 'object' then return false; end if;
  if p_markup_type in ('freehand','cloud') then
    if jsonb_typeof(p_geometry -> 'points') <> 'array' then return false; end if;
    v_count := jsonb_array_length(p_geometry -> 'points');
    if v_count < 2 or v_count > 2000 then return false; end if;
    for v_point in select value from jsonb_array_elements(p_geometry -> 'points') loop
      if not app_private.valid_normalized_point(v_point) then return false; end if;
    end loop;
    return true;
  elsif p_markup_type = 'arrow' then
    return app_private.valid_normalized_point(p_geometry -> 'start')
      and app_private.valid_normalized_point(p_geometry -> 'end');
  elsif p_markup_type = 'text' then
    return app_private.valid_normalized_point(p_geometry -> 'position');
  end if;
  return false;
exception when others then
  return false;
end;
$$;

create trigger drawing_markups_creator_guard
  before insert or update on public.drawing_markups
  for each row execute function app_private.preserve_record_creator();
create trigger drawing_markups_touch
  before update on public.drawing_markups
  for each row execute function app_private.touch_versioned_row();
create trigger drawing_markups_audit
  after insert or update or delete on public.drawing_markups
  for each row execute function app_private.capture_audit_event();

alter table public.drawing_markups enable row level security;

create policy drawing_markups_select on public.drawing_markups
for select to authenticated
using (
  app_private.has_project_permission(project_id, 'records.read')
  and exists (
    select 1 from public.files drawing
    where drawing.id = drawing_file_id
      and drawing.project_id = drawing_markups.project_id
      and drawing.status = 'available'
      and drawing.category = 'drawing'
  )
);

create or replace function public.create_drawing_markup(
  p_drawing_file_id uuid,
  p_page_number integer,
  p_markup_type text,
  p_geometry jsonb,
  p_color text,
  p_stroke_width numeric,
  p_text_content text,
  p_idempotency_key text
)
returns public.drawing_markups
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_file public.files;
  v_markup public.drawing_markups;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select file.* into v_file
  from public.files file
  where file.id = p_drawing_file_id
  for share;

  if not found or v_file.status <> 'available' or v_file.category <> 'drawing' then
    raise exception 'Available drawing file not found' using errcode = 'P0002';
  end if;
  if v_file.building_id is null then
    raise exception 'Drawing must belong to a building' using errcode = '23514';
  end if;
  if not app_private.has_project_permission(v_file.project_id, 'records.create') then
    raise exception 'Missing records.create permission' using errcode = '42501';
  end if;
  if p_page_number < 1 or p_page_number > 10000 then
    raise exception 'Invalid drawing page' using errcode = '22023';
  end if;
  if v_file.mime_type <> 'application/pdf' and p_page_number <> 1 then
    raise exception 'Image drawings only have page 1' using errcode = '22023';
  end if;
  if not app_private.valid_drawing_markup_geometry(p_markup_type, p_geometry) then
    raise exception 'Invalid normalized markup geometry' using errcode = '22023';
  end if;
  if p_color !~ '^#[0-9A-Fa-f]{6}$' or p_stroke_width < 1 or p_stroke_width > 20 then
    raise exception 'Invalid markup style' using errcode = '22023';
  end if;
  if p_markup_type = 'text' and char_length(trim(coalesce(p_text_content, ''))) < 1 then
    raise exception 'Text markup requires content' using errcode = '22023';
  end if;

  select markup.* into v_markup
  from public.drawing_markups markup
  where markup.project_id = v_file.project_id
    and markup.created_by = v_actor
    and markup.idempotency_key = p_idempotency_key;
  if found then return v_markup; end if;

  insert into public.drawing_markups (
    organization_id, project_id, building_id, drawing_file_id, page_number,
    markup_type, geometry, color, stroke_width, text_content,
    idempotency_key, created_by
  ) values (
    v_file.organization_id, v_file.project_id, v_file.building_id,
    v_file.id, p_page_number, p_markup_type, p_geometry, upper(p_color),
    p_stroke_width, nullif(trim(p_text_content), ''), p_idempotency_key, v_actor
  ) returning * into v_markup;
  return v_markup;
end;
$$;

create or replace function public.void_drawing_markup(
  p_markup_id uuid,
  p_reason text
)
returns public.drawing_markups
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_markup public.drawing_markups;
begin
  select markup.* into v_markup
  from public.drawing_markups markup
  where markup.id = p_markup_id
  for update;
  if not found then raise exception 'Drawing markup not found' using errcode = 'P0002'; end if;
  if not app_private.has_project_permission(v_markup.project_id, 'records.edit')
    and v_markup.created_by <> (select auth.uid()) then
    raise exception 'Missing permission to void drawing markup' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A void reason of at least five characters is required' using errcode = '22023';
  end if;
  update public.drawing_markups
  set status = 'void', void_reason = trim(p_reason)
  where id = v_markup.id
  returning * into v_markup;
  return v_markup;
end;
$$;

-- A period report is generated from one server-built, permission-filtered
-- snapshot. It covers any chosen period, including week and month ranges.
create or replace function public.build_period_report_snapshot(
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
  v_project public.projects;
begin
  if not app_private.has_project_permission(p_project_id, 'reports.read') then
    raise exception 'Missing reports.read permission' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid report period' using errcode = '22023';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'A period report may cover at most 367 days' using errcode = '22023';
  end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;

  return jsonb_build_object(
    'schema_version', '202607220002',
    'generated_at', now(),
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    'project', to_jsonb(v_project),
    'day_reports', coalesce((
      select jsonb_agg(to_jsonb(report) order by report.report_date)
      from public.day_reports report
      where report.project_id = p_project_id
        and report.report_date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'day_starts', coalesce((
      select jsonb_agg(to_jsonb(start_check) order by report.report_date)
      from public.day_start_checks start_check
      join public.day_reports report on report.id = start_check.day_report_id
      where report.project_id = p_project_id
        and report.report_date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'day_closeouts', coalesce((
      select jsonb_agg(to_jsonb(closeout) order by report.report_date)
      from public.day_closeouts closeout
      join public.day_reports report on report.id = closeout.day_report_id
      where report.project_id = p_project_id
        and report.report_date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(entry) order by report.report_date, entry.discipline)
      from public.attendance_entries entry
      join public.day_reports report on report.id = entry.day_report_id
      where report.project_id = p_project_id
        and report.report_date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'registrations', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.occurred_at)
      from public.site_registrations entry
      where entry.project_id = p_project_id
        and (entry.occurred_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'inspections', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.created_at)
      from public.inspections entry
      where entry.project_id = p_project_id
        and (entry.created_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.created_at)
      from public.findings entry
      where entry.project_id = p_project_id
        and (entry.created_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'hse_events', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.occurred_at)
      from public.hse_events entry
      where entry.project_id = p_project_id
        and (entry.occurred_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'register_entries', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.occurred_at)
      from public.project_register_entries entry
      where entry.project_id = p_project_id
        and (entry.occurred_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'visual_captures', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.captured_at)
      from public.visual_captures entry
      where entry.project_id = p_project_id
        and entry.status = 'active'
        and (entry.captured_at at time zone 'America/Paramaribo')::date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'open_actions', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.due_at nulls last)
      from public.actions entry
      where entry.project_id = p_project_id
        and entry.status not in ('verified','cancelled')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.import_project_boq(
  p_project_id uuid,
  p_building_id uuid,
  p_day_report_id uuid,
  p_items jsonb,
  p_idempotency_key text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_item jsonb;
  v_index bigint;
  v_start integer;
  v_inserted integer := 0;
  v_title text;
  v_progress numeric;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'records.create') then
    raise exception 'Missing records.create permission' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 5000 then
    raise exception 'BOQ import must contain between 1 and 5000 rows' using errcode = '22023';
  end if;
  if char_length(p_idempotency_key) < 8 or char_length(p_idempotency_key) > 150 then
    raise exception 'Invalid BOQ import key' using errcode = '22023';
  end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if p_building_id is not null and not exists (
    select 1 from public.buildings building
    where building.id = p_building_id and building.project_id = p_project_id
  ) then raise exception 'Building not found in project' using errcode = '23503'; end if;
  if p_day_report_id is not null and not exists (
    select 1 from public.day_reports report
    where report.id = p_day_report_id and report.project_id = p_project_id
  ) then raise exception 'Day report not found in project' using errcode = '23503'; end if;

  if exists (
    select 1 from public.project_register_entries entry
    where entry.project_id = p_project_id
      and entry.created_by = v_actor
      and entry.idempotency_key = p_idempotency_key || ':1'
  ) then
    return (select count(*)::integer from public.project_register_entries entry
      where entry.project_id = p_project_id and entry.created_by = v_actor
        and entry.idempotency_key like p_idempotency_key || ':%');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':register:boq', 0));
  select count(*) into v_start from public.project_register_entries entry
  where entry.project_id = p_project_id and entry.register_type = 'boq';

  for v_item, v_index in
    select value, ordinality from jsonb_array_elements(p_items) with ordinality
  loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Every BOQ row must be an object' using errcode = '22023'; end if;
    v_title := trim(coalesce(v_item ->> 'description', ''));
    if char_length(trim(coalesce(v_item ->> 'code', ''))) < 1 or char_length(v_title) < 3 then
      raise exception 'Every BOQ row requires a code and description' using errcode = '22023';
    end if;
    begin
      v_progress := coalesce(nullif(v_item ->> 'progress_percent', '')::numeric, 0);
    exception when invalid_text_representation then
      raise exception 'BOQ progress must be numeric' using errcode = '22023';
    end;
    if v_progress < 0 or v_progress > 100 then raise exception 'BOQ progress must be between 0 and 100' using errcode = '22023'; end if;

    insert into public.project_register_entries (
      organization_id, project_id, building_id, day_report_id, register_type,
      entry_number, title, status, occurred_at, details, idempotency_key, created_by
    ) values (
      v_project.organization_id, v_project.id, p_building_id, p_day_report_id, 'boq',
      'BOQ-' || lpad((v_start + v_index)::text, 4, '0'),
      left(trim(v_item ->> 'code') || ' - ' || v_title, 240),
      'open', now(), v_item, p_idempotency_key || ':' || v_index, v_actor
    );
    v_inserted := v_inserted + 1;
  end loop;
  return v_inserted;
end;
$$;

revoke all on public.drawing_markups from anon, authenticated;
grant select on public.drawing_markups to authenticated;
revoke all on public.checklist_library_templates from anon, authenticated;
grant select on public.checklist_library_templates to authenticated;

revoke all on function app_private.valid_normalized_point(jsonb) from public, anon;
revoke all on function app_private.valid_drawing_markup_geometry(text, jsonb) from public, anon;
grant execute on function app_private.valid_normalized_point(jsonb) to authenticated, service_role;
grant execute on function app_private.valid_drawing_markup_geometry(text, jsonb) to authenticated, service_role;

revoke all on function public.create_drawing_markup(uuid,integer,text,jsonb,text,numeric,text,text) from public, anon;
revoke all on function public.void_drawing_markup(uuid,text) from public, anon;
revoke all on function public.build_period_report_snapshot(uuid,date,date) from public, anon;
revoke all on function public.import_project_boq(uuid,uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.install_checklist_library_template(uuid,text) from public, anon;
grant execute on function public.create_drawing_markup(uuid,integer,text,jsonb,text,numeric,text,text) to authenticated;
grant execute on function public.void_drawing_markup(uuid,text) to authenticated;
grant execute on function public.build_period_report_snapshot(uuid,date,date) to authenticated;
grant execute on function public.import_project_boq(uuid,uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.install_checklist_library_template(uuid,text) to authenticated;

alter table public.drawing_markups replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table public.drawing_markups;
  exception when duplicate_object then null;
  end;
end;
$$;

commit;
