begin;

-- Production MVP permissions. Existing organization administrators receive every
-- new permission; project roles receive only the operational capabilities that
-- match the product-plan role matrix.
insert into public.permissions (code, description) values
  ('templates.manage', 'Formulier- en checklistsjablonen beheren'),
  ('inspections.read', 'Inspecties en checklistresultaten bekijken'),
  ('inspections.manage', 'Inspecties plannen en uitvoeren'),
  ('inspections.review', 'Inspecties beoordelen en herinspectie vrijgeven'),
  ('findings.read', 'Kwaliteitsbevindingen en NCR-dossiers bekijken'),
  ('findings.create', 'Kwaliteitsbevindingen en NCR-dossiers aanmaken'),
  ('findings.manage', 'Bevindingen toewijzen en opvolgen'),
  ('findings.verify', 'Herstel van bevindingen onafhankelijk verifiëren'),
  ('hse.read', 'HSE-observaties en incidenten bekijken'),
  ('hse.manage', 'HSE-observaties en incidenten registreren en opvolgen'),
  ('files.read', 'Bestandsmetadata en geautoriseerde bestanden bekijken'),
  ('files.manage', 'Bestanden uploaden, reviseren en archiveren'),
  ('reports.sign', 'Formele rapportverklaring vastleggen'),
  ('reports.distribute', 'Goedgekeurde rapporten distribueren'),
  ('notifications.manage', 'Meldings- en escalatieregels beheren'),
  ('backup.manage', 'Back-ups exporteren, verifiëren en hersteltests uitvoeren')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (organization_id, role_id, permission_code)
select role.organization_id, role.id, permission.code
from public.roles role
cross join public.permissions permission
where role.scope = 'organization'
  and role.code = 'organization_admin'
  and permission.code in (
    'templates.manage','inspections.read','inspections.manage','inspections.review',
    'findings.read','findings.create','findings.manage','findings.verify',
    'hse.read','hse.manage','files.read','files.manage','reports.sign',
    'reports.distribute','notifications.manage','backup.manage'
  )
on conflict do nothing;

insert into public.role_permissions (organization_id, role_id, permission_code)
select role.organization_id, role.id, permission_code
from public.roles role
cross join lateral unnest(
  case role.code
    when 'supervisor' then array[
      'inspections.read','inspections.manage','findings.read','findings.create',
      'hse.read','hse.manage','files.read','files.manage','reports.sign'
    ]
    when 'lead_supervisor' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign','reports.distribute'
    ]
    when 'contractor' then array['files.manage','reports.sign']
    when 'project_manager' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign','reports.distribute',
      'notifications.manage'
    ]
    when 'client' then array['reports.sign']
    when 'quality_hse_manager' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign'
    ]
    else array[]::text[]
  end
) permission_code
where role.scope = 'project'
on conflict do nothing;

create table public.project_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  report_prefix text not null default 'DR' check (report_prefix ~ '^[A-Z0-9-]{1,12}$'),
  default_language text not null default 'nl-SR',
  default_shift_start time not null default '07:00',
  default_shift_end time not null default '16:00',
  max_file_size_mb integer not null default 25 check (max_file_size_mb between 1 and 100),
  notification_lead_hours integer not null default 24 check (notification_lead_hours between 1 and 720),
  retention_days integer check (retention_days is null or retention_days >= 30),
  branding jsonb not null default '{}'::jsonb check (jsonb_typeof(branding) = 'object'),
  modules jsonb not null default '{"attendance":true,"inspections":true,"quality":true,"hse":true,"actions":true,"documents":true}'::jsonb check (jsonb_typeof(modules) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id)
);

create table public.location_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  parent_id uuid,
  node_type text not null check (node_type in ('zone','floor','room','element','work_package')),
  code text not null check (char_length(code) between 1 and 40),
  name text not null check (char_length(name) between 2 and 160),
  description text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, building_id, code),
  unique (id, project_id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  foreign key (parent_id, project_id, organization_id) references public.location_nodes(id, project_id, organization_id)
);

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid,
  module text not null check (module in ('inspection','hse','delivery','test')),
  code text not null check (char_length(code) between 2 and 40),
  name text not null check (char_length(name) between 3 and 180),
  description text,
  version_number integer not null default 1 check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (organization_id, project_id, module, code, version_number),
  unique (id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null,
  section text not null check (char_length(section) between 2 and 120),
  prompt text not null check (char_length(prompt) between 3 and 500),
  response_type text not null check (response_type in ('yes_no_na','pass_fail_na','number','text')),
  required boolean not null default true,
  sort_order integer not null,
  unit text,
  minimum_value numeric,
  maximum_value numeric,
  failure_severity text not null default 'medium' check (failure_severity in ('low','medium','high','critical')),
  guidance text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (template_id, sort_order),
  unique (id, organization_id),
  foreign key (template_id, organization_id) references public.checklist_templates(id, organization_id) on delete cascade,
  check (minimum_value is null or maximum_value is null or minimum_value <= maximum_value)
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  location_node_id uuid,
  day_report_id uuid,
  template_id uuid not null,
  inspection_number text not null check (char_length(inspection_number) between 5 and 60),
  title text not null check (char_length(title) between 3 and 240),
  status text not null default 'planned' check (status in ('planned','in_progress','passed','failed','ready_for_reinspection','cancelled')),
  planned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  executed_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  cancellation_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, inspection_number),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  foreign key (location_node_id, project_id, organization_id) references public.location_nodes(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id) references public.day_reports(id, project_id, organization_id),
  foreign key (template_id, organization_id) references public.checklist_templates(id, organization_id),
  check (status <> 'cancelled' or char_length(cancellation_reason) >= 5)
);

create table public.inspection_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  inspection_id uuid not null,
  checklist_item_id uuid not null,
  result text not null check (result in ('yes','no','na','pass','fail','value','text')),
  numeric_value numeric,
  text_value text,
  notes text,
  is_nonconforming boolean not null default false,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (inspection_id, checklist_item_id),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (inspection_id, project_id, organization_id) references public.inspections(id, project_id, organization_id) on delete cascade,
  foreign key (checklist_item_id, organization_id) references public.checklist_items(id, organization_id),
  check ((result = 'value' and numeric_value is not null) or result <> 'value'),
  check ((result = 'text' and char_length(text_value) > 0) or result <> 'text')
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  location_node_id uuid,
  day_report_id uuid,
  inspection_id uuid,
  inspection_response_id uuid,
  finding_number text not null check (char_length(finding_number) between 5 and 60),
  finding_type text not null check (finding_type in ('observation','deficiency','deviation','ncr','improvement')),
  title text not null check (char_length(title) between 3 and 240),
  description text not null check (char_length(description) between 3 and 4000),
  severity text not null check (severity in ('low','medium','high','critical')),
  priority text not null check (priority in ('low','normal','high','critical')),
  status text not null default 'open' check (status in ('draft','open','assigned','in_progress','ready_for_verification','closed','rejected','reopened','cancelled')),
  responsible_party_id uuid,
  assigned_user_id uuid references auth.users(id),
  due_at timestamptz,
  cause text,
  proposed_correction text,
  final_measure text,
  reference_text text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  closed_at timestamptz,
  status_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, finding_number),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  foreign key (location_node_id, project_id, organization_id) references public.location_nodes(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id) references public.day_reports(id, project_id, organization_id),
  foreign key (inspection_id, project_id, organization_id) references public.inspections(id, project_id, organization_id),
  foreign key (inspection_response_id, project_id, organization_id) references public.inspection_responses(id, project_id, organization_id),
  foreign key (responsible_party_id, project_id, organization_id) references public.parties(id, project_id, organization_id),
  check (status <> 'closed' or (verified_by is not null and verified_at is not null and closed_at is not null)),
  check (status not in ('rejected','reopened','cancelled') or char_length(status_reason) >= 5)
);

create table public.finding_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  finding_id uuid not null,
  update_type text not null check (update_type in ('created','status','comment','correction','evidence','verification')),
  message text not null check (char_length(message) between 2 and 4000),
  from_status text,
  to_status text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, project_id, organization_id),
  foreign key (finding_id, project_id, organization_id) references public.findings(id, project_id, organization_id) on delete cascade
);

create table public.hse_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  location_node_id uuid,
  day_report_id uuid,
  event_number text not null check (char_length(event_number) between 5 and 60),
  event_type text not null check (event_type in ('positive_observation','unsafe_act','unsafe_condition','near_miss','incident','stop_work','toolbox')),
  title text not null check (char_length(title) between 3 and 240),
  description text not null check (char_length(description) between 3 and 4000),
  severity text not null check (severity in ('low','medium','high','critical')),
  occurred_at timestamptz not null,
  immediate_measure text,
  injury_details text,
  confidential boolean not null default false,
  status text not null default 'open' check (status in ('open','investigating','action_required','closed','cancelled')),
  closed_at timestamptz,
  closure_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, event_number),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  foreign key (location_node_id, project_id, organization_id) references public.location_nodes(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id) references public.day_reports(id, project_id, organization_id),
  check (status not in ('closed','cancelled') or (closed_at is not null and char_length(closure_reason) >= 5))
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid,
  drive_file_id text,
  drive_parent_id text,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 3 and 150),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  file_version integer not null default 1 check (file_version > 0),
  status text not null default 'pending' check (status in ('pending','uploading','available','failed','archived','deleted')),
  category text not null default 'document' check (category in ('photo','document','certificate','drawing','report','evidence','backup','export')),
  captured_at timestamptz,
  gps_lat numeric(9,6),
  gps_lng numeric(9,6),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (drive_file_id),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  check ((status in ('available','archived') and drive_file_id is not null and sha256 is not null) or status not in ('available','archived')),
  check ((status = 'deleted' and deleted_at is not null and deleted_by is not null) or status <> 'deleted')
);

create table public.file_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  file_id uuid not null,
  record_type text not null check (record_type in ('registration','inspection','inspection_response','finding','finding_update','hse','action','report','document','register_entry')),
  record_id uuid not null,
  relationship text not null default 'attachment' check (relationship in ('attachment','before','after','evidence','original','annotation','certificate','preview')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (file_id, record_type, record_id, relationship),
  unique (id, project_id, organization_id),
  foreign key (file_id, project_id, organization_id) references public.files(id, project_id, organization_id) on delete cascade
);

create table public.report_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  day_report_id uuid not null,
  report_version_id uuid,
  decision text not null check (decision in ('started','approved','returned','rejected')),
  section_code text,
  comment text not null check (char_length(comment) between 2 and 4000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id) references public.day_reports(id, project_id, organization_id),
  foreign key (report_version_id) references public.report_versions(id)
);

create table public.report_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  day_report_id uuid not null,
  report_version_id uuid not null references public.report_versions(id),
  signer_user_id uuid not null references auth.users(id),
  signer_name text not null check (char_length(signer_name) between 2 and 160),
  signer_role text not null check (char_length(signer_role) between 2 and 120),
  signature_method text not null default 'authenticated_acknowledgement' check (signature_method in ('authenticated_acknowledgement','qualified_external')),
  declaration text not null check (char_length(declaration) between 10 and 1000),
  legal_level text not null default 'contract_pending' check (legal_level in ('contract_pending','standard','advanced','qualified')),
  signed_at timestamptz not null default now(),
  ip_hash text,
  user_agent_hash text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (report_version_id, signer_user_id, signer_role),
  unique (id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id) references public.day_reports(id, project_id, organization_id),
  check (signer_user_id = created_by)
);

create table public.report_distributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  day_report_id uuid not null,
  report_version_id uuid not null references public.report_versions(id),
  recipient_name text not null check (char_length(recipient_name) between 2 and 160),
  recipient_address text not null check (char_length(recipient_address) between 3 and 320),
  channel text not null check (channel in ('email','download','external_link','manual')),
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','acknowledged')),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  failure_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id) references public.day_reports(id, project_id, organization_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  recipient_user_id uuid not null references auth.users(id),
  notification_type text not null check (notification_type in ('action_due','action_overdue','finding_critical','finding_due','hse_critical','review_requested','signature_requested','backup_failed','system')),
  title text not null check (char_length(title) between 2 and 240),
  body text not null check (char_length(body) between 2 and 2000),
  source_type text,
  source_id uuid,
  due_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id)
);

create table public.project_register_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid,
  day_report_id uuid,
  register_type text not null check (register_type in ('equipment','delivery','test','variation','delay','communication','risk','document','drawing','rfi','submittal','site_instruction','meeting','correspondence','cost','declaration')),
  entry_number text not null check (char_length(entry_number) between 3 and 60),
  title text not null check (char_length(title) between 3 and 240),
  status text not null default 'open' check (status in ('draft','open','in_review','approved','rejected','closed','cancelled')),
  occurred_at timestamptz not null default now(),
  due_at timestamptz,
  responsible_party_id uuid,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, register_type, entry_number),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id) references public.day_reports(id, project_id, organization_id),
  foreign key (responsible_party_id, project_id, organization_id) references public.parties(id, project_id, organization_id)
);

create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid references public.projects(id),
  run_type text not null check (run_type in ('scheduled','manual','pre_restore','restore_test')),
  status text not null default 'queued' check (status in ('queued','exporting','uploading','verified','failed','dry_run_passed','restored')),
  schema_version text not null default '202607180006',
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  drive_file_id text,
  record_counts jsonb,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  error_summary text,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (organization_id, idempotency_key),
  unique (id, organization_id)
);

create index location_nodes_project_parent_idx on public.location_nodes (project_id, parent_id, sort_order);
create index checklist_templates_project_status_idx on public.checklist_templates (project_id, module, status);
create index checklist_items_template_order_idx on public.checklist_items (template_id, sort_order);
create index inspections_project_status_date_idx on public.inspections (project_id, status, planned_at);
create index inspection_responses_inspection_idx on public.inspection_responses (inspection_id, checklist_item_id);
create index findings_project_open_idx on public.findings (project_id, severity, due_at) where status not in ('closed','cancelled','rejected');
create index findings_assignee_open_idx on public.findings (assigned_user_id, due_at) where status not in ('closed','cancelled','rejected');
create index finding_updates_finding_time_idx on public.finding_updates (finding_id, created_at desc);
create index hse_events_project_open_idx on public.hse_events (project_id, severity, occurred_at desc) where status not in ('closed','cancelled');
create index files_project_status_idx on public.files (project_id, status, category, created_at desc);
create index file_links_record_idx on public.file_links (record_type, record_id);
create index report_reviews_report_time_idx on public.report_reviews (day_report_id, created_at desc);
create index report_signatures_version_idx on public.report_signatures (report_version_id, signed_at);
create index report_distributions_version_status_idx on public.report_distributions (report_version_id, status);
create index notifications_recipient_unread_idx on public.notifications (recipient_user_id, created_at desc) where read_at is null;
create index project_register_entries_type_status_idx on public.project_register_entries (project_id, register_type, status, occurred_at desc);
create index backup_runs_org_time_idx on public.backup_runs (organization_id, created_at desc);

-- Data-derived nonconformance flag. This never closes or verifies a legal or
-- safety record; it only applies the visible checklist rule.
create or replace function app_private.set_inspection_nonconformance()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_item public.checklist_items;
begin
  select item.* into v_item from public.checklist_items item where item.id = new.checklist_item_id;
  if not found then
    raise exception 'Checklist item not found' using errcode = 'P0002';
  end if;

  new.is_nonconforming := new.result in ('no','fail')
    or (new.result = 'value' and (
      (v_item.minimum_value is not null and new.numeric_value < v_item.minimum_value)
      or (v_item.maximum_value is not null and new.numeric_value > v_item.maximum_value)
    ));
  return new;
end;
$$;

create or replace function app_private.validate_finding_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if (to_jsonb(new) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version'])
    <> (to_jsonb(old) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version'])
    and not app_private.has_project_permission(old.project_id, 'findings.manage') then
    raise exception 'Only a finding manager may change the original observation' using errcode = '42501';
  end if;

  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'draft' and new.status in ('open','cancelled'))
    or (old.status = 'open' and new.status in ('assigned','in_progress','rejected','cancelled'))
    or (old.status = 'assigned' and new.status in ('in_progress','ready_for_verification','rejected','cancelled'))
    or (old.status = 'in_progress' and new.status in ('ready_for_verification','cancelled'))
    or (old.status = 'ready_for_verification' and new.status in ('closed','reopened'))
    or (old.status = 'reopened' and new.status in ('in_progress','ready_for_verification','cancelled'))
  ) then
    raise exception 'Invalid finding transition: % -> %', old.status, new.status using errcode = '23514';
  end if;

  if new.status in ('closed','reopened') and not app_private.has_project_permission(old.project_id, 'findings.verify') then
    raise exception 'Only an authorized verifier may close or reopen a finding' using errcode = '42501';
  end if;
  if new.status = 'closed' then
    new.verified_by := (select auth.uid());
    new.verified_at := now();
    new.closed_at := now();
  end if;
  return new;
end;
$$;

create trigger project_settings_creator_guard before insert or update on public.project_settings for each row execute function app_private.preserve_record_creator();
create trigger project_settings_touch before update on public.project_settings for each row execute function app_private.touch_versioned_row();
create trigger location_nodes_creator_guard before insert or update on public.location_nodes for each row execute function app_private.preserve_record_creator();
create trigger location_nodes_touch before update on public.location_nodes for each row execute function app_private.touch_versioned_row();
create trigger checklist_templates_creator_guard before insert or update on public.checklist_templates for each row execute function app_private.preserve_record_creator();
create trigger checklist_templates_touch before update on public.checklist_templates for each row execute function app_private.touch_versioned_row();
create trigger checklist_items_creator_guard before insert or update on public.checklist_items for each row execute function app_private.preserve_record_creator();
create trigger checklist_items_touch before update on public.checklist_items for each row execute function app_private.touch_versioned_row();
create trigger inspections_creator_guard before insert or update on public.inspections for each row execute function app_private.preserve_record_creator();
create trigger inspections_touch before update on public.inspections for each row execute function app_private.touch_versioned_row();
create trigger inspection_responses_nonconformance before insert or update on public.inspection_responses for each row execute function app_private.set_inspection_nonconformance();
create trigger inspection_responses_creator_guard before insert or update on public.inspection_responses for each row execute function app_private.preserve_record_creator();
create trigger inspection_responses_touch before update on public.inspection_responses for each row execute function app_private.touch_versioned_row();
create trigger findings_creator_guard before insert or update on public.findings for each row execute function app_private.preserve_record_creator();
create trigger findings_status_guard before update on public.findings for each row execute function app_private.validate_finding_transition();
create trigger findings_touch before update on public.findings for each row execute function app_private.touch_versioned_row();
create trigger hse_events_creator_guard before insert or update on public.hse_events for each row execute function app_private.preserve_record_creator();
create trigger hse_events_touch before update on public.hse_events for each row execute function app_private.touch_versioned_row();
create trigger files_creator_guard before insert or update on public.files for each row execute function app_private.preserve_record_creator();
create trigger files_touch before update on public.files for each row execute function app_private.touch_versioned_row();
create trigger report_distributions_creator_guard before insert or update on public.report_distributions for each row execute function app_private.preserve_record_creator();
create trigger report_distributions_touch before update on public.report_distributions for each row execute function app_private.touch_versioned_row();
create trigger project_register_entries_creator_guard before insert or update on public.project_register_entries for each row execute function app_private.preserve_record_creator();
create trigger project_register_entries_touch before update on public.project_register_entries for each row execute function app_private.touch_versioned_row();
create trigger backup_runs_creator_guard before insert or update on public.backup_runs for each row execute function app_private.preserve_record_creator();
create trigger backup_runs_touch before update on public.backup_runs for each row execute function app_private.touch_versioned_row();

create trigger finding_updates_immutable before update or delete on public.finding_updates for each row execute function app_private.reject_immutable_mutation();
create trigger file_links_immutable before update or delete on public.file_links for each row execute function app_private.reject_immutable_mutation();
create trigger report_reviews_immutable before update or delete on public.report_reviews for each row execute function app_private.reject_immutable_mutation();
create trigger report_signatures_immutable before update or delete on public.report_signatures for each row execute function app_private.reject_immutable_mutation();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'project_settings','location_nodes','checklist_templates','checklist_items',
    'inspections','inspection_responses','findings','finding_updates','hse_events',
    'files','file_links','report_reviews','report_signatures','report_distributions',
    'project_register_entries','backup_runs'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function app_private.capture_audit_event()',
      v_table || '_audit', v_table
    );
  end loop;
end;
$$;

alter table public.project_settings enable row level security;
alter table public.location_nodes enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_responses enable row level security;
alter table public.findings enable row level security;
alter table public.finding_updates enable row level security;
alter table public.hse_events enable row level security;
alter table public.files enable row level security;
alter table public.file_links enable row level security;
alter table public.report_reviews enable row level security;
alter table public.report_signatures enable row level security;
alter table public.report_distributions enable row level security;
alter table public.notifications enable row level security;
alter table public.project_register_entries enable row level security;
alter table public.backup_runs enable row level security;

create policy project_settings_select on public.project_settings for select to authenticated using (app_private.can_access_project(project_id));
create policy project_settings_manage on public.project_settings for all to authenticated using (app_private.has_project_permission(project_id, 'project.configure')) with check (app_private.has_project_permission(project_id, 'project.configure'));
create policy location_nodes_select on public.location_nodes for select to authenticated using (app_private.can_access_project(project_id));
create policy location_nodes_manage on public.location_nodes for all to authenticated using (app_private.has_project_permission(project_id, 'project.configure')) with check (app_private.has_project_permission(project_id, 'project.configure'));

create policy checklist_templates_select on public.checklist_templates for select to authenticated using ((project_id is null and app_private.is_organization_member(organization_id)) or (project_id is not null and app_private.can_access_project(project_id)));
create policy checklist_templates_manage on public.checklist_templates for all to authenticated using ((project_id is null and app_private.has_organization_permission(organization_id, 'templates.manage')) or (project_id is not null and app_private.has_project_permission(project_id, 'templates.manage'))) with check ((project_id is null and app_private.has_organization_permission(organization_id, 'templates.manage')) or (project_id is not null and app_private.has_project_permission(project_id, 'templates.manage')));
create policy checklist_items_select on public.checklist_items for select to authenticated using (exists (select 1 from public.checklist_templates template where template.id = template_id));
create policy checklist_items_manage on public.checklist_items for all to authenticated using (exists (select 1 from public.checklist_templates template where template.id = template_id and ((template.project_id is null and app_private.has_organization_permission(template.organization_id, 'templates.manage')) or (template.project_id is not null and app_private.has_project_permission(template.project_id, 'templates.manage'))))) with check (exists (select 1 from public.checklist_templates template where template.id = template_id and ((template.project_id is null and app_private.has_organization_permission(template.organization_id, 'templates.manage')) or (template.project_id is not null and app_private.has_project_permission(template.project_id, 'templates.manage')))));

create policy inspections_select on public.inspections for select to authenticated using (app_private.has_project_permission(project_id, 'inspections.read'));
create policy inspections_manage on public.inspections for all to authenticated using (app_private.has_project_permission(project_id, 'inspections.manage')) with check (app_private.has_project_permission(project_id, 'inspections.manage'));
create policy inspection_responses_select on public.inspection_responses for select to authenticated using (app_private.has_project_permission(project_id, 'inspections.read'));
create policy inspection_responses_manage on public.inspection_responses for all to authenticated using (app_private.has_project_permission(project_id, 'inspections.manage')) with check (app_private.has_project_permission(project_id, 'inspections.manage'));

create policy findings_select on public.findings for select to authenticated using (assigned_user_id = (select auth.uid()) or app_private.has_project_permission(project_id, 'findings.read'));
create policy findings_insert on public.findings for insert to authenticated with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'findings.create'));
create policy findings_update on public.findings for update to authenticated using (assigned_user_id = (select auth.uid()) or app_private.has_project_permission(project_id, 'findings.manage')) with check (assigned_user_id = (select auth.uid()) or app_private.has_project_permission(project_id, 'findings.manage'));
create policy finding_updates_select on public.finding_updates for select to authenticated using (exists (select 1 from public.findings finding where finding.id = finding_id));
create policy finding_updates_insert on public.finding_updates for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.findings finding where finding.id = finding_id));

create policy hse_events_select on public.hse_events for select to authenticated using (app_private.has_project_permission(project_id, 'hse.read') and (not confidential or app_private.has_project_permission(project_id, 'hse.manage')));
create policy hse_events_manage on public.hse_events for all to authenticated using (app_private.has_project_permission(project_id, 'hse.manage')) with check (app_private.has_project_permission(project_id, 'hse.manage'));

create policy files_select on public.files for select to authenticated using (created_by = (select auth.uid()) or app_private.has_project_permission(project_id, 'files.read'));
create policy files_manage on public.files for all to authenticated using (created_by = (select auth.uid()) or app_private.has_project_permission(project_id, 'files.manage')) with check (created_by = (select auth.uid()) or app_private.has_project_permission(project_id, 'files.manage'));
create policy file_links_select on public.file_links for select to authenticated using (exists (select 1 from public.files file where file.id = file_id));
create policy file_links_insert on public.file_links for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.files file where file.id = file_id and app_private.has_project_permission(file.project_id, 'files.manage')));

create policy report_reviews_select on public.report_reviews for select to authenticated using (app_private.has_project_permission(project_id, 'reports.read') or app_private.has_project_permission(project_id, 'reports.readapproved'));
create policy report_reviews_insert on public.report_reviews for insert to authenticated with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'reports.review'));
create policy report_signatures_select on public.report_signatures for select to authenticated using (app_private.has_project_permission(project_id, 'reports.read') or app_private.has_project_permission(project_id, 'reports.readapproved'));
create policy report_signatures_insert on public.report_signatures for insert to authenticated with check (created_by = (select auth.uid()) and signer_user_id = (select auth.uid()) and app_private.has_project_permission(project_id, 'reports.sign'));
create policy report_distributions_select on public.report_distributions for select to authenticated using (app_private.has_project_permission(project_id, 'reports.read') or app_private.has_project_permission(project_id, 'reports.readapproved'));
create policy report_distributions_manage on public.report_distributions for all to authenticated using (app_private.has_project_permission(project_id, 'reports.distribute')) with check (app_private.has_project_permission(project_id, 'reports.distribute'));

create policy notifications_select on public.notifications for select to authenticated using (recipient_user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using (recipient_user_id = (select auth.uid())) with check (recipient_user_id = (select auth.uid()));
create policy project_register_entries_select on public.project_register_entries for select to authenticated using (app_private.has_project_permission(project_id, 'records.read'));
create policy project_register_entries_manage on public.project_register_entries for all to authenticated using (app_private.has_project_permission(project_id, 'records.edit')) with check ((created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'records.create')) or app_private.has_project_permission(project_id, 'records.edit'));
create policy backup_runs_select on public.backup_runs for select to authenticated using (app_private.has_organization_permission(organization_id, 'backup.manage'));
create policy backup_runs_manage on public.backup_runs for all to authenticated using (app_private.has_organization_permission(organization_id, 'backup.manage')) with check (created_by = (select auth.uid()) and app_private.has_organization_permission(organization_id, 'backup.manage'));

revoke all on public.project_settings, public.location_nodes, public.checklist_templates, public.checklist_items,
  public.inspections, public.inspection_responses, public.findings, public.finding_updates, public.hse_events,
  public.files, public.file_links, public.report_reviews, public.report_signatures, public.report_distributions,
  public.notifications, public.project_register_entries, public.backup_runs from anon, authenticated;

grant select, insert, update on public.project_settings, public.location_nodes, public.checklist_templates, public.checklist_items,
  public.inspections, public.inspection_responses, public.findings, public.hse_events, public.files,
  public.report_distributions, public.notifications, public.project_register_entries, public.backup_runs to authenticated;
grant select, insert on public.finding_updates, public.file_links, public.report_reviews, public.report_signatures to authenticated;

alter table public.inspections replica identity full;
alter table public.findings replica identity full;
alter table public.hse_events replica identity full;
alter table public.notifications replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table public.inspections; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.findings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.hse_events; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
end;
$$;

commit;
