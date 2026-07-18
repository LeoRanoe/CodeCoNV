begin;

alter table public.project_settings
  add column signing_workflow jsonb not null default '[{"role":"supervisor","required":true},{"role":"project_manager","required":true}]'::jsonb
    check (jsonb_typeof(signing_workflow) = 'array');

alter table public.day_reports drop constraint day_reports_status_check;
alter table public.day_reports add constraint day_reports_status_check
  check (status in ('draft','in_progress','ready_for_review','in_review','approved','signed','sent','revised','returned','cancelled'));

create or replace function app_private.validate_day_report_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'draft' and new.status in ('in_progress','cancelled'))
    or (old.status = 'in_progress' and new.status in ('ready_for_review','cancelled'))
    or (old.status = 'ready_for_review' and new.status in ('in_review','returned'))
    or (old.status = 'in_review' and new.status in ('approved','returned'))
    or (old.status = 'approved' and new.status in ('signed','revised'))
    or (old.status = 'signed' and new.status in ('sent','revised'))
    or (old.status = 'sent' and new.status = 'revised')
    or (old.status = 'revised' and new.status = 'in_progress')
    or (old.status = 'returned' and new.status in ('in_progress','cancelled'))
  ) then
    raise exception 'Invalid day report transition: % -> %', old.status, new.status using errcode = '23514';
  end if;

  if new.status in ('in_review','returned','approved')
    and not app_private.has_project_permission(old.project_id, 'reports.review') then
    raise exception 'Missing reports.review permission' using errcode = '42501';
  end if;
  if new.status = 'approved' and not exists (
    select 1 from public.report_versions version where version.day_report_id = old.id
  ) then
    raise exception 'A report version must be frozen before approval' using errcode = '23514';
  end if;
  if new.status = 'signed' and not app_private.has_project_permission(old.project_id, 'reports.sign') then
    raise exception 'Missing reports.sign permission' using errcode = '42501';
  end if;
  if new.status = 'sent' and not app_private.has_project_permission(old.project_id, 'reports.distribute') then
    raise exception 'Missing reports.distribute permission' using errcode = '42501';
  end if;
  if new.status = 'revised' and not app_private.has_project_permission(old.project_id, 'reports.review') then
    raise exception 'Missing reports.review permission' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function app_private.initialize_project_operations()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inspection_template uuid;
  v_hse_template uuid;
begin
  insert into public.project_settings (organization_id, project_id, created_by)
  values (new.organization_id, new.id, new.created_by)
  on conflict (project_id) do nothing;

  insert into public.checklist_templates (
    organization_id, project_id, module, code, name, description,
    version_number, status, published_at, created_by
  ) values (
    new.organization_id, new.id, 'inspection', 'INS-DAILY',
    'Dagelijkse bouwinspectie',
    'CODECO-basiscontrole voor werk, kwaliteit, tekeningen en bewijs.',
    1, 'published', now(), new.created_by
  ) on conflict (organization_id, project_id, module, code, version_number)
  do update set name = excluded.name
  returning id into v_inspection_template;

  insert into public.checklist_items (
    organization_id, template_id, section, prompt, response_type, required,
    sort_order, failure_severity, guidance, created_by
  ) values
    (new.organization_id, v_inspection_template, 'Werkvoorbereiding', 'Is de actuele goedgekeurde tekening op de werkplek aanwezig?', 'pass_fail_na', true, 10, 'high', 'Leg een afwijking vast wanneer een verouderde revisie wordt gebruikt.', new.created_by),
    (new.organization_id, v_inspection_template, 'Materiaal', 'Zijn de toegepaste materialen visueel gecontroleerd en conform specificatie?', 'pass_fail_na', true, 20, 'high', null, new.created_by),
    (new.organization_id, v_inspection_template, 'Uitvoering', 'Voldoet het uitgevoerde werk aan tekening, norm en werkwijze?', 'pass_fail_na', true, 30, 'high', null, new.created_by),
    (new.organization_id, v_inspection_template, 'Maatvoering', 'Zijn relevante maatvoering en toleranties gecontroleerd?', 'pass_fail_na', true, 40, 'medium', null, new.created_by),
    (new.organization_id, v_inspection_template, 'Bewijs', 'Zijn foto''s, meetgegevens en opmerkingen volledig vastgelegd?', 'pass_fail_na', true, 50, 'medium', null, new.created_by)
  on conflict (template_id, sort_order) do nothing;

  insert into public.checklist_templates (
    organization_id, project_id, module, code, name, description,
    version_number, status, published_at, created_by
  ) values (
    new.organization_id, new.id, 'hse', 'HSE-DAILY',
    'Dagelijkse HSE-startcontrole',
    'CODECO-basiscontrole voor PBM, toegang, hoogtewerk, elektriciteit, brand en vergunningen.',
    1, 'published', now(), new.created_by
  ) on conflict (organization_id, project_id, module, code, version_number)
  do update set name = excluded.name
  returning id into v_hse_template;

  insert into public.checklist_items (
    organization_id, template_id, section, prompt, response_type, required,
    sort_order, failure_severity, guidance, created_by
  ) values
    (new.organization_id, v_hse_template, 'PBM', 'Dragen alle aanwezigen de vereiste persoonlijke beschermingsmiddelen?', 'yes_no_na', true, 10, 'high', null, new.created_by),
    (new.organization_id, v_hse_template, 'Toegang', 'Zijn toegangen, looproutes en werkzones veilig en vrij?', 'yes_no_na', true, 20, 'medium', null, new.created_by),
    (new.organization_id, v_hse_template, 'Hoogtewerk', 'Zijn steigers, ladders en valbeveiliging gecontroleerd?', 'yes_no_na', true, 30, 'critical', 'Stop werk bij direct valgevaar.', new.created_by),
    (new.organization_id, v_hse_template, 'Energie', 'Zijn tijdelijke elektra, gereedschap en kabels veilig?', 'yes_no_na', true, 40, 'high', null, new.created_by),
    (new.organization_id, v_hse_template, 'Vergunningen', 'Zijn vereiste werkvergunningen en toolboxafspraken geldig?', 'yes_no_na', true, 50, 'critical', null, new.created_by)
  on conflict (template_id, sort_order) do nothing;
  return new;
end;
$$;

drop trigger if exists projects_initialize_operations on public.projects;
create trigger projects_initialize_operations
  after insert on public.projects
  for each row execute function app_private.initialize_project_operations();

insert into public.project_settings (organization_id, project_id, created_by)
select project.organization_id, project.id, project.created_by
from public.projects project
on conflict (project_id) do nothing;

insert into public.checklist_templates (
  organization_id, project_id, module, code, name, description,
  version_number, status, published_at, created_by
)
select
  project.organization_id, project.id, definition.module, definition.code,
  definition.name, definition.description, 1, 'published', now(), project.created_by
from public.projects project
cross join (values
  ('inspection', 'INS-DAILY', 'Dagelijkse bouwinspectie', 'CODECO-basiscontrole voor werk, kwaliteit, tekeningen en bewijs.'),
  ('hse', 'HSE-DAILY', 'Dagelijkse HSE-startcontrole', 'CODECO-basiscontrole voor PBM, toegang, hoogtewerk, elektriciteit, brand en vergunningen.')
) definition(module, code, name, description)
on conflict (organization_id, project_id, module, code, version_number) do nothing;

insert into public.checklist_items (
  organization_id, template_id, section, prompt, response_type, required,
  sort_order, failure_severity, guidance, created_by
)
select
  template.organization_id, template.id, definition.section, definition.prompt,
  definition.response_type, true, definition.sort_order, definition.failure_severity,
  definition.guidance, template.created_by
from public.checklist_templates template
cross join lateral (
  select * from (values
    ('inspection', 'Werkvoorbereiding', 'Is de actuele goedgekeurde tekening op de werkplek aanwezig?', 'pass_fail_na', 10, 'high', 'Leg een afwijking vast wanneer een verouderde revisie wordt gebruikt.'),
    ('inspection', 'Materiaal', 'Zijn de toegepaste materialen visueel gecontroleerd en conform specificatie?', 'pass_fail_na', 20, 'high', null),
    ('inspection', 'Uitvoering', 'Voldoet het uitgevoerde werk aan tekening, norm en werkwijze?', 'pass_fail_na', 30, 'high', null),
    ('inspection', 'Maatvoering', 'Zijn relevante maatvoering en toleranties gecontroleerd?', 'pass_fail_na', 40, 'medium', null),
    ('inspection', 'Bewijs', 'Zijn foto''s, meetgegevens en opmerkingen volledig vastgelegd?', 'pass_fail_na', 50, 'medium', null),
    ('hse', 'PBM', 'Dragen alle aanwezigen de vereiste persoonlijke beschermingsmiddelen?', 'yes_no_na', 10, 'high', null),
    ('hse', 'Toegang', 'Zijn toegangen, looproutes en werkzones veilig en vrij?', 'yes_no_na', 20, 'medium', null),
    ('hse', 'Hoogtewerk', 'Zijn steigers, ladders en valbeveiliging gecontroleerd?', 'yes_no_na', 30, 'critical', 'Stop werk bij direct valgevaar.'),
    ('hse', 'Energie', 'Zijn tijdelijke elektra, gereedschap en kabels veilig?', 'yes_no_na', 40, 'high', null),
    ('hse', 'Vergunningen', 'Zijn vereiste werkvergunningen en toolboxafspraken geldig?', 'yes_no_na', 50, 'critical', null)
  ) item(module, section, prompt, response_type, sort_order, failure_severity, guidance)
  where item.module = template.module
) definition
where template.code in ('INS-DAILY', 'HSE-DAILY') and template.version_number = 1
on conflict (template_id, sort_order) do nothing;

commit;
