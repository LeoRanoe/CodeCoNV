begin;

create table public.day_start_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  day_report_id uuid not null,
  weather_condition text not null check (weather_condition in ('sunny', 'partly_cloudy', 'cloudy', 'rain', 'heavy_rain')),
  temperature_c numeric(4, 1) not null check (temperature_c between 15 and 50),
  wind_condition text not null check (wind_condition in ('calm', 'moderate', 'strong')),
  shift_start time not null,
  shift_end time not null,
  planned_work text not null check (char_length(planned_work) >= 10),
  expected_workers integer not null check (expected_workers between 0 and 10000),
  inspection_planned boolean not null,
  high_risk_work boolean not null,
  concrete_work boolean not null,
  work_permit_status text not null check (work_permit_status in ('available', 'missing', 'not_required')),
  drawing_status text not null check (drawing_status in ('approved', 'missing', 'not_required')),
  drawing_issue_reported boolean not null default false,
  risk_notes text,
  automation_rules_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(automation_rules_snapshot) = 'array'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (day_report_id),
  unique (project_id, created_by, idempotency_key),
  foreign key (building_id, project_id, organization_id)
    references public.buildings(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id)
    references public.day_reports(id, project_id, organization_id),
  check (shift_end > shift_start),
  check (drawing_status <> 'missing' or drawing_issue_reported)
);

create table public.day_closeouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  day_report_id uuid not null,
  day_summary text not null check (char_length(day_summary) between 20 and 700),
  weather_summary text not null check (char_length(weather_summary) between 5 and 180),
  work_performed text not null check (char_length(work_performed) between 10 and 1200),
  progress_percent numeric(5, 2) not null check (progress_percent between 0 and 100),
  inspection_result text not null check (inspection_result in ('none', 'all_ok', 'issues')),
  quality_issues boolean not null,
  quality_details text,
  hse_event text not null check (hse_event in ('none', 'near_miss', 'incident')),
  hse_details text,
  equipment_status text,
  deliveries text,
  tests_measurements text,
  variation_work_status text not null check (variation_work_status in ('none', 'pending', 'approved', 'rejected')),
  delay_cause text not null check (delay_cause in ('none', 'weather', 'delivery', 'material', 'equipment', 'other')),
  delay_hours numeric(5, 2) not null default 0 check (delay_hours between 0 and 24),
  communication text,
  risks text,
  tomorrow_plan text not null check (char_length(tomorrow_plan) between 10 and 1000),
  photo_count integer not null default 0 check (photo_count between 0 and 10000),
  attachments_confirmed boolean not null default false,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (day_report_id),
  unique (project_id, created_by, idempotency_key),
  foreign key (building_id, project_id, organization_id)
    references public.buildings(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id)
    references public.day_reports(id, project_id, organization_id),
  check (not quality_issues or char_length(quality_details) >= 10),
  check (hse_event = 'none' or char_length(hse_details) >= 10),
  check (delay_cause = 'none' or delay_hours > 0)
);

create index day_start_checks_project_report_idx on public.day_start_checks (project_id, day_report_id);
create index day_closeouts_project_report_idx on public.day_closeouts (project_id, day_report_id);

create trigger day_start_checks_creator_guard before insert or update on public.day_start_checks for each row execute function app_private.preserve_record_creator();
create trigger day_start_checks_touch before update on public.day_start_checks for each row execute function app_private.touch_versioned_row();
create trigger day_start_checks_audit after insert or update or delete on public.day_start_checks for each row execute function app_private.capture_audit_event();

create trigger day_closeouts_creator_guard before insert or update on public.day_closeouts for each row execute function app_private.preserve_record_creator();
create trigger day_closeouts_touch before update on public.day_closeouts for each row execute function app_private.touch_versioned_row();
create trigger day_closeouts_audit after insert or update or delete on public.day_closeouts for each row execute function app_private.capture_audit_event();

alter table public.day_start_checks enable row level security;
alter table public.day_closeouts enable row level security;

create policy day_start_checks_select on public.day_start_checks for select to authenticated
  using (app_private.has_project_permission(project_id, 'reports.read'));
create policy day_start_checks_insert on public.day_start_checks for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'reports.edit'));
create policy day_start_checks_update on public.day_start_checks for update to authenticated
  using (app_private.has_project_permission(project_id, 'reports.edit'))
  with check (app_private.has_project_permission(project_id, 'reports.edit'));

create policy day_closeouts_select on public.day_closeouts for select to authenticated
  using (app_private.has_project_permission(project_id, 'reports.read'));
create policy day_closeouts_insert on public.day_closeouts for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'reports.edit'));
create policy day_closeouts_update on public.day_closeouts for update to authenticated
  using (app_private.has_project_permission(project_id, 'reports.edit'))
  with check (app_private.has_project_permission(project_id, 'reports.edit'));

grant select, insert, update on public.day_start_checks to authenticated;
grant select, insert, update on public.day_closeouts to authenticated;

commit;
