begin;
set local search_path = extensions, pgtap, public;

-- Isolation: only the first organization can be created without an administrator, so the file
-- starts from an empty tenant table; the rollback at the end puts any existing data back.
truncate public.organizations, auth.users cascade;

select plan(17);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-0000-0000-0000000000b1',
  'authenticated',
  'authenticated',
  'live-flow@example.test',
  now(),
  now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO Live Flow', 'codeco-live-flow', 'Live Supervisor')$$,
  'an authenticated user can bootstrap the first organization'
);
select is((select count(*) from public.organizations where slug = 'codeco-live-flow'), 1::bigint, 'organization is created once');
select is((select count(*) from public.roles where organization_id = (select id from public.organizations where slug = 'codeco-live-flow')), 8::bigint, 'standard organization and project roles are seeded');

select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'COD-LIVE-01', 'Live project', 'Paramaribo', 'Test client', 'HOOFD', 'Hoofdgebouw', 'Test contractor')$query$,
    (select id from public.organizations where slug = 'codeco-live-flow')
  ),
  'organization admin can atomically create a project workspace'
);
select is((select count(*) from public.projects where code = 'COD-LIVE-01'), 1::bigint, 'project is created once');
select is((select count(*) from public.buildings where project_id = (select id from public.projects where code = 'COD-LIVE-01')), 1::bigint, 'first building is created');
select is((select count(*) from public.parties where project_id = (select id from public.projects where code = 'COD-LIVE-01')), 3::bigint, 'standard CODECO, client and contractor parties are created');
select is((select count(*) from public.project_memberships where project_id = (select id from public.projects where code = 'COD-LIVE-01')), 1::bigint, 'creator receives project membership');
select is((select count(*) from public.project_member_roles where project_id = (select id from public.projects where code = 'COD-LIVE-01')), 2::bigint, 'creator receives supervisor and project manager roles');
select is(
  (
    public.create_project_workspace(
      (select id from public.organizations where slug = 'codeco-live-flow'),
      'COD-LIVE-01',
      'Live project',
      'Paramaribo',
      'Test client',
      'HOOFD',
      'Hoofdgebouw',
      'Test contractor'
    ) ->> 'created'
  )::boolean,
  false,
  'retrying workspace creation is idempotent'
);

select lives_ok(
  format(
    $query$select public.create_day_report(%L::uuid, '2026-07-18'::date, 'live-flow-report-20260718')$query$,
    (select id from public.projects where code = 'COD-LIVE-01')
  ),
  'the central day report can be created'
);
select throws_ok(
  format(
    $query$select public.submit_day_report_for_review(%L::uuid)$query$,
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'COD-LIVE-01'))
  ),
  '23514',
  'Project start check is required',
  'review submission is blocked while required answers are missing'
);

insert into public.day_start_checks (
  organization_id, project_id, building_id, day_report_id, weather_condition,
  temperature_c, wind_condition, shift_start, shift_end, planned_work,
  expected_workers, inspection_planned, high_risk_work, concrete_work,
  work_permit_status, drawing_status, drawing_issue_reported,
  automation_rules_snapshot, idempotency_key, created_by
)
select
  project.organization_id, project.id, building.id, report.id, 'partly_cloudy',
  31, 'moderate', '07:00', '16:00', 'Wapeningscontrole en bekisting',
  24, true, false, false, 'not_required', 'approved', false,
  '[{"id":"AUTO-DR-01"}]'::jsonb, 'live-flow-start-20260718', auth.uid()
from public.projects project
join public.buildings building on building.project_id = project.id
join public.day_reports report on report.project_id = project.id
where project.code = 'COD-LIVE-01';

insert into public.day_closeouts (
  organization_id, project_id, building_id, day_report_id, day_summary,
  weather_summary, work_performed, progress_percent, inspection_result,
  quality_issues, hse_event, variation_work_status, delay_cause, delay_hours,
  tomorrow_plan, photo_count, attachments_confirmed, idempotency_key, created_by
)
select
  project.organization_id, project.id, building.id, report.id,
  'De geplande controle is uitgevoerd.', 'Licht bewolkt, 31 graden',
  'Wapening en bekisting gecontroleerd.', 30, 'all_ok', false, 'none',
  'none', 'none', 0, 'Werkzaamheden volgens planning voortzetten.', 0, true,
  'live-flow-closeout-20260718', auth.uid()
from public.projects project
join public.buildings building on building.project_id = project.id
join public.day_reports report on report.project_id = project.id
where project.code = 'COD-LIVE-01';

select lives_ok(
  format(
    $query$select public.submit_day_report_for_review(%L::uuid)$query$,
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'COD-LIVE-01'))
  ),
  'complete report can be submitted for review'
);
select is((select status::text from public.day_reports where project_id = (select id from public.projects where code = 'COD-LIVE-01')), 'ready_for_review', 'report reaches ready-for-review state');
select is((select completeness_percent from public.day_reports where project_id = (select id from public.projects where code = 'COD-LIVE-01')), 100::smallint, 'submitted report is marked complete');
select lives_ok(
  format(
    $query$select public.submit_day_report_for_review(%L::uuid)$query$,
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'COD-LIVE-01'))
  ),
  'review submission retry is safe'
);
select cmp_ok((select count(*) from public.audit_events), '>', 0::bigint, 'workspace flow produces an audit trail');

reset role;
select * from finish();
rollback;
