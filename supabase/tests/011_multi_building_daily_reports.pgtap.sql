begin;
set local search_path = extensions, pgtap, public;

select plan(19);

select has_function(
  'public',
  'create_building',
  array['uuid', 'text', 'text', 'text'],
  'building creation function exists so a project can grow beyond its first building'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-0000-0000-0000000000c1',
  'authenticated',
  'authenticated',
  'multi-building@example.test',
  now(),
  now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

insert into public.organizations (id, name, slug, created_by)
values ('00000000-0000-0000-0000-0000000000c2', 'Multi Building Org', 'multi-building-org', auth.uid());
insert into public.roles (id, organization_id, scope, code, name, is_system, created_by)
values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c2', 'project', 'supervisor', 'Supervisor', true, auth.uid());
insert into public.role_permissions (organization_id, role_id, permission_code)
select '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3', code
from public.permissions;
insert into public.projects (id, organization_id, code, name, location, created_by)
values ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c2', 'COD-MULTI-01', 'Multi-building project', 'Paramaribo', auth.uid());
insert into public.project_memberships (id, organization_id, project_id, user_id, created_by)
values ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', auth.uid(), auth.uid());
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000c3');
insert into public.buildings (id, organization_id, project_id, code, name, description, created_by)
values ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', 'TOWER-A', 'Tower A', 'First tower', auth.uid());

select is((select count(*) from public.buildings where project_id = '00000000-0000-0000-0000-0000000000c4'), 1::bigint, 'the project starts with exactly one building');

select lives_ok(
  $$select public.create_building('00000000-0000-0000-0000-0000000000c4'::uuid, 'tower-b', 'Tower B', 'Second tower on the same site')$$,
  'a project member with project.configure can add a second building'
);
select is((select count(*) from public.buildings where project_id = '00000000-0000-0000-0000-0000000000c4'), 2::bigint, 'the project now has two buildings');
select is((select code from public.buildings where project_id = '00000000-0000-0000-0000-0000000000c4' and name = 'Tower B'), 'TOWER-B', 'the new building code is normalized to uppercase');

select is(
  (select (public.create_building('00000000-0000-0000-0000-0000000000c4'::uuid, 'tower-b', 'Tower B duplicate attempt', null)).id),
  (select id from public.buildings where project_id = '00000000-0000-0000-0000-0000000000c4' and code = 'TOWER-B'),
  'retrying create_building with the same code is idempotent and returns the existing building'
);
select is((select count(*) from public.buildings where project_id = '00000000-0000-0000-0000-0000000000c4' and code = 'TOWER-B'), 1::bigint, 'the idempotent retry did not create a duplicate building row');

insert into public.day_reports (id, organization_id, project_id, report_date, report_number, idempotency_key, created_by)
values ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', '2026-07-26', 'DR-20260726', 'multi-building-report-20260726', auth.uid());

select is((select count(*) from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4'), 1::bigint, 'the single project-wide day report exists (create_day_report itself is covered by 003_live_workspace_flow)');

select throws_ok(
  $$select public.submit_day_report_for_review((select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4'))$$,
  '23514',
  'Project start check is required',
  'submission is blocked while neither building has a start check'
);

insert into public.day_start_checks (
  organization_id, project_id, building_id, day_report_id, weather_condition,
  temperature_c, wind_condition, shift_start, shift_end, planned_work,
  expected_workers, inspection_planned, high_risk_work, concrete_work,
  work_permit_status, drawing_status, drawing_issue_reported,
  automation_rules_snapshot, idempotency_key, created_by
)
select
  '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', building.id, report.id, 'partly_cloudy',
  31, 'moderate', '07:00', '16:00', 'Wapeningscontrole Tower A',
  24, true, false, false, 'not_required', 'approved', false,
  '[]'::jsonb, 'multi-building-start-a-20260726', auth.uid()
from public.buildings building, public.day_reports report
where building.project_id = '00000000-0000-0000-0000-0000000000c4' and building.code = 'TOWER-A'
  and report.project_id = '00000000-0000-0000-0000-0000000000c4';

select throws_ok(
  $$select public.submit_day_report_for_review((select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4'))$$,
  '23514',
  'Project start check is required',
  'submission stays blocked while Tower B still has no start check, even though Tower A does'
);

insert into public.day_start_checks (
  organization_id, project_id, building_id, day_report_id, weather_condition,
  temperature_c, wind_condition, shift_start, shift_end, planned_work,
  expected_workers, inspection_planned, high_risk_work, concrete_work,
  work_permit_status, drawing_status, drawing_issue_reported,
  automation_rules_snapshot, idempotency_key, created_by
)
select
  '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', building.id, report.id, 'sunny',
  33, 'calm', '07:00', '16:00', 'Bekisting Tower B',
  18, false, false, true, 'not_required', 'approved', false,
  '[]'::jsonb, 'multi-building-start-b-20260726', auth.uid()
from public.buildings building, public.day_reports report
where building.project_id = '00000000-0000-0000-0000-0000000000c4' and building.code = 'TOWER-B'
  and report.project_id = '00000000-0000-0000-0000-0000000000c4';

select is((select count(*) from public.day_start_checks where day_report_id = (select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4')), 2::bigint, 'both buildings now have their own independent start check row on the same day report');

select throws_ok(
  $$select public.submit_day_report_for_review((select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4'))$$,
  '23514',
  'Daily closeout is required',
  'submission is blocked on the closeout gate once both start checks exist'
);

insert into public.day_closeouts (
  organization_id, project_id, building_id, day_report_id, day_summary,
  weather_summary, work_performed, progress_percent, inspection_result,
  quality_issues, hse_event, variation_work_status, delay_cause, delay_hours,
  tomorrow_plan, photo_count, attachments_confirmed, idempotency_key, created_by
)
select
  '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', building.id, report.id,
  'Tower A voortgang volgens planning.', 'Licht bewolkt, 31 graden',
  'Wapening gecontroleerd.', 40, 'all_ok', false, 'none',
  'none', 'none', 0, 'Bekisting voorbereiden.', 0, true,
  'multi-building-closeout-a-20260726', auth.uid()
from public.buildings building, public.day_reports report
where building.project_id = '00000000-0000-0000-0000-0000000000c4' and building.code = 'TOWER-A'
  and report.project_id = '00000000-0000-0000-0000-0000000000c4';

select throws_ok(
  $$select public.submit_day_report_for_review((select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4'))$$,
  '23514',
  'Daily closeout is required',
  'submission stays blocked while Tower B still has no closeout, even though Tower A does'
);

insert into public.day_closeouts (
  organization_id, project_id, building_id, day_report_id, day_summary,
  weather_summary, work_performed, progress_percent, inspection_result,
  quality_issues, hse_event, variation_work_status, delay_cause, delay_hours,
  tomorrow_plan, photo_count, attachments_confirmed, idempotency_key, created_by
)
select
  '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', building.id, report.id,
  'Tower B bekisting gestart.', 'Zonnig, 33 graden',
  'Bekisting geplaatst.', 15, 'none', false, 'none',
  'none', 'none', 0, 'Wapening plaatsen.', 0, true,
  'multi-building-closeout-b-20260726', auth.uid()
from public.buildings building, public.day_reports report
where building.project_id = '00000000-0000-0000-0000-0000000000c4' and building.code = 'TOWER-B'
  and report.project_id = '00000000-0000-0000-0000-0000000000c4';

select lives_ok(
  $$select public.submit_day_report_for_review((select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4'))$$,
  'the single day report can be submitted once every active building has its own start check and closeout'
);
select is((select status::text from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4'), 'ready_for_review', 'the project-wide report reaches ready-for-review covering both buildings at once');

select throws_ok(
  $$insert into public.day_start_checks (organization_id, project_id, building_id, day_report_id, planned_work, expected_workers, inspection_planned, high_risk_work, concrete_work, work_permit_status, drawing_status, idempotency_key, created_by)
    select '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', building.id, report.id, 'Duplicate attempt', 1, false, false, false, 'not_required', 'approved', 'multi-building-start-a-duplicate', auth.uid()
    from public.buildings building, public.day_reports report
    where building.project_id = '00000000-0000-0000-0000-0000000000c4' and building.code = 'TOWER-A'
      and report.project_id = '00000000-0000-0000-0000-0000000000c4'$$,
  '23505',
  'duplicate key value violates unique constraint "day_start_checks_report_building_key"',
  'inserting a second start check for the SAME building on the SAME report is a genuine conflict, not a silent overwrite of a different building'
);

select is(
  (select jsonb_array_length(public.build_day_report_snapshot((select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4')) -> 'buildings')),
  2,
  'the formal snapshot lists every building on the project'
);
select is(
  (select jsonb_array_length(public.build_day_report_snapshot((select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4')) -> 'start_checks')),
  2,
  'the formal snapshot lists one start check per building instead of a single one for the whole report'
);
select is(
  (select jsonb_array_length(public.build_day_report_snapshot((select id from public.day_reports where project_id = '00000000-0000-0000-0000-0000000000c4')) -> 'closeouts')),
  2,
  'the formal snapshot lists one closeout per building instead of a single one for the whole report'
);

reset role;
select * from finish();
rollback;
