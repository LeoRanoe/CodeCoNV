begin;
set local search_path = extensions, pgtap, public;

select plan(58);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'supervisor@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'contractor@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', 'client@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', 'outsider@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', 'lead@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a7', 'authenticated', 'authenticated', 'manager@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a8', 'authenticated', 'authenticated', 'quality@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', 'guest@example.test', now(), now());

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-0000-0000-000000000001', 'CODECO Test', 'codeco-test', '00000000-0000-0000-0000-0000000000a1');

insert into public.roles (id, organization_id, scope, code, name, is_system, created_by) values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'organization', 'organization_admin', 'Organisatiebeheerder', true, '00000000-0000-0000-0000-0000000000a1'),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'project', 'supervisor', 'Supervisor', true, '00000000-0000-0000-0000-0000000000a1'),
  ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'project', 'contractor', 'Aannemer', true, '00000000-0000-0000-0000-0000000000a1'),
  ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'project', 'client', 'Opdrachtgever', true, '00000000-0000-0000-0000-0000000000a1'),
  ('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'project', 'lead_supervisor', 'Lead supervisor', true, '00000000-0000-0000-0000-0000000000a1'),
  ('11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'project', 'project_manager', 'Projectleider', true, '00000000-0000-0000-0000-0000000000a1'),
  ('11000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'project', 'quality_hse_manager', 'Kwaliteit en HSE', true, '00000000-0000-0000-0000-0000000000a1'),
  ('11000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'project', 'external_guest', 'Externe gast', true, '00000000-0000-0000-0000-0000000000a1');

insert into public.role_permissions (organization_id, role_id, permission_code)
select '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', code
from public.permissions;

insert into public.role_permissions (organization_id, role_id, permission_code) values
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'records.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'attendance.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'actions.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'reports.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'actions.create'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000004', 'reports.readapproved'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000005', 'records.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000005', 'attendance.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000005', 'actions.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000005', 'reports.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000005', 'audit.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000006', 'records.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000006', 'attendance.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000006', 'actions.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000006', 'reports.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000006', 'audit.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000007', 'records.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000007', 'attendance.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000007', 'actions.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000007', 'reports.read'),
  ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000007', 'audit.read');

insert into public.organization_memberships (id, organization_id, user_id, status) values
  ('12000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'active'),
  ('12000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'active'),
  ('12000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'active'),
  ('12000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 'active'),
  ('12000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a6', 'active'),
  ('12000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a7', 'active'),
  ('12000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a8', 'active'),
  ('12000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a9', 'active');

insert into public.organization_member_roles (organization_id, membership_id, role_id)
values ('10000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001');

insert into public.projects (id, organization_id, code, name, location, created_by)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'TEST-01', 'Testproject', 'Paramaribo', '00000000-0000-0000-0000-0000000000a1');

insert into public.project_memberships (id, organization_id, project_id, user_id, status) values
  ('21000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'active'),
  ('21000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'active'),
  ('21000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 'active'),
  ('21000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a6', 'active'),
  ('21000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a7', 'active'),
  ('21000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a8', 'active'),
  ('21000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a9', 'active');

insert into public.project_member_roles (organization_id, project_id, membership_id, role_id) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000007', '11000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000008', '11000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000009', '11000000-0000-0000-0000-000000000008');

insert into public.buildings (id, organization_id, project_id, code, name, created_by)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'B01', 'Hoofdgebouw', '00000000-0000-0000-0000-0000000000a1');

insert into public.parties (id, organization_id, project_id, code, name, party_type, created_by)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CON', 'Testaannemer', 'contractor', '00000000-0000-0000-0000-0000000000a1');

insert into public.day_reports (id, organization_id, project_id, report_date, report_number, status, idempotency_key, created_by) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-07-17', 'DR-20260717', 'draft', 'test-draft-report', '00000000-0000-0000-0000-0000000000a1'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-07-18', 'DR-20260718', 'approved', 'test-approved-report', '00000000-0000-0000-0000-0000000000a1');

with frozen as (
  select public.build_day_report_snapshot('50000000-0000-0000-0000-000000000002') as snapshot
)
insert into public.report_versions (id, organization_id, project_id, day_report_id, revision, template_version, snapshot, sha256, idempotency_key, created_by)
select '90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 0, 'test-v1', snapshot,
  encode(extensions.digest(convert_to(snapshot::text, 'UTF8'), 'sha256'), 'hex'),
  'test-report-version', '00000000-0000-0000-0000-0000000000a1'
from frozen;

insert into public.site_registrations (id, organization_id, project_id, building_id, day_report_id, registration_type, title, occurred_at, idempotency_key, created_by)
values ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'inspection', 'Testinspectie', now(), 'test-registration', '00000000-0000-0000-0000-0000000000a1');

insert into public.attendance_entries (id, organization_id, project_id, building_id, day_report_id, party_id, discipline, shift_start, shift_end, headcount, idempotency_key, created_by)
values ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Ruwbouw', '07:00', '16:00', 12, 'test-attendance', '00000000-0000-0000-0000-0000000000a1');

insert into public.actions (id, organization_id, project_id, building_id, action_number, title, source_type, owner_user_id, status, idempotency_key, created_by)
values ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'ACT-001', 'Herstel testpunt', 'manual', '00000000-0000-0000-0000-0000000000a3', 'open', 'test-action', '00000000-0000-0000-0000-0000000000a1');

insert into public.action_updates (id, organization_id, project_id, action_id, update_type, message, created_by)
values ('81000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'created', 'Testactie centraal aangemaakt.', '00000000-0000-0000-0000-0000000000a1');

insert into public.day_start_checks (
  id, organization_id, project_id, building_id, day_report_id, weather_condition,
  temperature_c, wind_condition, shift_start, shift_end, planned_work,
  expected_workers, inspection_planned, high_risk_work, concrete_work,
  work_permit_status, drawing_status, drawing_issue_reported,
  automation_rules_snapshot, idempotency_key, created_by
) values (
  'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', 'partly_cloudy', 31, 'moderate', '07:00', '16:00',
  'Bekisting en wapeningscontrole', 42, true, false, true, 'not_required', 'approved', false,
  '[{"id":"AUTO-DR-01"}]'::jsonb, 'test-day-start', '00000000-0000-0000-0000-0000000000a1'
);

insert into public.day_closeouts (
  id, organization_id, project_id, building_id, day_report_id, day_summary,
  weather_summary, work_performed, progress_percent, inspection_result,
  quality_issues, hse_event, variation_work_status, delay_cause, delay_hours,
  tomorrow_plan, photo_count, attachments_confirmed, idempotency_key, created_by
) values (
  'a1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'De geplande bekisting en wapeningscontrole zijn volgens dagplan uitgevoerd.',
  'Licht bewolkt, 31 graden', 'Bekisting kernwand en wapeningscontrole vloer V3',
  67, 'all_ok', false, 'none', 'none', 'none', 0,
  'Betonstort voorbereiden en kolommen uitzetten', 12, true, 'test-day-closeout',
  '00000000-0000-0000-0000-0000000000a1'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select count(*) from public.projects), 1::bigint, 'organization admin sees the project without project membership');
select is((select count(*) from public.site_registrations), 1::bigint, 'organization admin sees internal registrations');
select cmp_ok((select count(*) from public.audit_events), '>', 0::bigint, 'organization admin sees the audit trail');
select is((select count(*) from public.day_start_checks), 1::bigint, 'organization admin sees the project-start answers');
select is((select count(*) from public.day_closeouts), 1::bigint, 'organization admin sees the daily closeout');
select is((select count(*) from public.action_updates), 1::bigint, 'organization admin sees action history');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is((select count(*) from public.site_registrations), 1::bigint, 'supervisor sees internal registrations');
select is((select count(*) from public.attendance_entries), 1::bigint, 'supervisor sees attendance');
select is((select count(*) from public.day_reports), 2::bigint, 'supervisor sees draft and approved reports');
select is((select count(*) from public.actions), 1::bigint, 'supervisor sees project actions');
select is((select count(*) from public.day_start_checks), 1::bigint, 'supervisor sees the project-start answers');
select is((select count(*) from public.day_closeouts), 1::bigint, 'supervisor sees the daily closeout');
select is((select count(*) from public.action_updates), 1::bigint, 'supervisor sees action history');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is((select count(*) from public.site_registrations), 0::bigint, 'contractor cannot see internal registrations');
select is((select count(*) from public.attendance_entries), 0::bigint, 'contractor cannot see attendance');
select is((select count(*) from public.day_reports), 0::bigint, 'contractor cannot see reports without permission');
select is((select count(*) from public.actions), 1::bigint, 'contractor sees its assigned action');
select is((select count(*) from public.day_start_checks), 0::bigint, 'contractor cannot see internal project-start answers');
select is((select count(*) from public.day_closeouts), 0::bigint, 'contractor cannot see the internal daily closeout');
select is((select count(*) from public.action_updates), 1::bigint, 'assigned contractor sees action history');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select is((select count(*) from public.site_registrations), 0::bigint, 'client cannot see internal registrations');
select is((select count(*) from public.day_reports), 1::bigint, 'client sees only the approved report');
select is((select count(*) from public.report_versions), 1::bigint, 'client sees the immutable version of the approved report');
select is((select count(*) from public.audit_events), 0::bigint, 'client cannot see the internal audit trail');
select is((select count(*) from public.day_start_checks), 0::bigint, 'client cannot see internal project-start answers');
select is((select count(*) from public.day_closeouts), 0::bigint, 'client cannot see the editable daily closeout');
select is((select count(*) from public.action_updates), 0::bigint, 'client cannot see internal action history');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
select is((select count(*) from public.site_registrations), 1::bigint, 'lead supervisor sees internal registrations');
select is((select count(*) from public.day_reports), 2::bigint, 'lead supervisor sees all reports');
select cmp_ok((select count(*) from public.audit_events), '>', 0::bigint, 'lead supervisor sees the audit trail');
select is((select count(*) from public.day_start_checks), 1::bigint, 'lead supervisor sees the project-start answers');
select is((select count(*) from public.day_closeouts), 1::bigint, 'lead supervisor sees the daily closeout');
select is((select count(*) from public.action_updates), 1::bigint, 'lead supervisor sees action history');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select is((select count(*) from public.site_registrations), 1::bigint, 'project manager sees internal registrations');
select is((select count(*) from public.actions), 1::bigint, 'project manager sees all actions');
select is((select count(*) from public.day_reports), 2::bigint, 'project manager sees all reports');
select is((select count(*) from public.day_start_checks), 1::bigint, 'project manager sees the project-start answers');
select is((select count(*) from public.day_closeouts), 1::bigint, 'project manager sees the daily closeout');
select is((select count(*) from public.action_updates), 1::bigint, 'project manager sees action history');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}';
select is((select count(*) from public.site_registrations), 1::bigint, 'quality and HSE manager sees internal registrations');
select is((select count(*) from public.attendance_entries), 1::bigint, 'quality and HSE manager sees attendance');
select cmp_ok((select count(*) from public.audit_events), '>', 0::bigint, 'quality and HSE manager sees the audit trail');
select is((select count(*) from public.day_start_checks), 1::bigint, 'quality and HSE manager sees project-start answers');
select is((select count(*) from public.day_closeouts), 1::bigint, 'quality and HSE manager sees the daily closeout');
select is((select count(*) from public.action_updates), 1::bigint, 'quality and HSE manager sees action history');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}';
select is((select count(*) from public.projects), 1::bigint, 'explicitly invited guest sees the project shell');
select is((select count(*) from public.site_registrations), 0::bigint, 'guest cannot see internal registrations');
select is((select count(*) from public.actions), 0::bigint, 'guest sees no unshared actions');
select is((select count(*) from public.day_reports), 0::bigint, 'guest sees no unshared reports');
select is((select count(*) from public.day_start_checks), 0::bigint, 'guest sees no unshared project-start answers');
select is((select count(*) from public.day_closeouts), 0::bigint, 'guest sees no unshared daily closeout');
select is((select count(*) from public.action_updates), 0::bigint, 'guest sees no unshared action history');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
select is((select count(*) from public.projects), 0::bigint, 'outsider sees no projects');
select is((select count(*) from public.actions), 0::bigint, 'outsider sees no actions');
select is((select count(*) from public.day_reports), 0::bigint, 'outsider sees no approved reports');
select is((select count(*) from public.day_start_checks), 0::bigint, 'outsider sees no project-start answers');
select is((select count(*) from public.day_closeouts), 0::bigint, 'outsider sees no daily closeout');
select is((select count(*) from public.action_updates), 0::bigint, 'outsider sees no action history');

reset role;
select * from finish();
rollback;
