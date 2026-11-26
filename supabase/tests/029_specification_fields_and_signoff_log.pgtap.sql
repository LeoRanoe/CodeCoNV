begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- The client's developer specification (FINAL v2): works records per activity, specification
-- fields per record, and the append-only sign-off event log of the Sign-off Workflow sheet.
select plan(16);

select has_column('public', 'hse_events', 'spec', 'HSE records keep their specification fields');
select has_column('public', 'visual_captures', 'spec', 'photos keep their specification fields');
select has_column('public', 'attendance_entries', 'spec', 'attendance lines keep their specification fields');
select has_table('public', 'record_signoff_events', 'the sign-off event log exists');
select has_function('public', 'record_signoff_action', 'sign-off actions go through one checked function');
select has_function('public', 'set_visual_capture_spec', 'photo specification fields are written through a function');
select has_column('public', 'record_signoff_events', 'sequence_number', 'sign-off events keep the order they were written in');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000029a1', 'authenticated', 'authenticated', 'signoff@example.test', now(), now());
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000029a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Signoff Org', 'signoff-org', 'Signoff Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'signoff-org'),
  'SO-29', 'Signoff project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);

-- A Works Ongoing record is a register entry of its own type, numbered WO-0001.
select matches(
  (select entry_number from public.create_project_register_entry(
    (select id from public.projects where code = 'SO-29'),
    (select building.id from public.buildings building join public.projects project on project.id = building.project_id where project.code = 'SO-29' limit 1),
    null, 'works_ongoing', 'Slab S1 pour', now(), null, null,
    '{"spec":{"weather":"Dry / sunny","discipline":"Concrete & Reinforced Concrete","activity":"Concrete Pouring","report_date":"2026-11-20","exact_location":"Level 1, grids A-D","work_item":"Slab S1","progress_status":"In Progress","crew":"Concrete crew A","quantity":"42","quantity_unit":"m³","element_type":"Slab","element_id":"S1","concrete_grade":"C30/37","concrete_volume":"42"}}'::jsonb, 'so-29-wo'
  )),
  '^SO-29-WO-[0-9]{4}-0001$',
  'a works ongoing record is numbered WO'
);

select lives_ok(
  $$select public.record_signoff_action(
    (select id from public.projects where code = 'SO-29'), 'register_entry',
    (select id from public.project_register_entries where entry_number like 'SO-29-WO-%-0001'),
    'WO-DAILY', 1, 'submit', 'Foreman')$$,
  'the contractor submits the daily progress'
);

select matches(
  (select submitted_version ->> 'entry_number' from public.record_signoff_events where action = 'submit'),
  '^SO-29-WO-[0-9]{4}-0001$',
  'the submitted version of the record is frozen with the event'
);

select throws_ok(
  $$select public.record_signoff_action(
    (select id from public.projects where code = 'SO-29'), 'register_entry',
    (select id from public.project_register_entries where entry_number like 'SO-29-WO-%-0001'),
    'WO-DAILY', 1, 'submit', 'Foreman')$$,
  '22023', null,
  'a record is submitted once; later rounds are resubmissions'
);

-- v5.0 (25-11-2026): there is no Supervision reviewer; a daily progress submission is final.
select throws_ok(
  $$select public.record_signoff_action(
    (select id from public.projects where code = 'SO-29'), 'register_entry',
    (select id from public.project_register_entries where entry_number like 'SO-29-WO-%-0001'),
    'WO-DAILY', 2, 'review', 'Supervisor')$$,
  '22023', null,
  'there is no review step: a submission by Supervision is final'
);

select throws_ok(
  $$select public.record_signoff_action(
    (select id from public.projects where code = 'SO-29'), 'register_entry',
    (select id from public.project_register_entries where entry_number like 'SO-29-WO-%-0001'),
    'WO-DAILY', 3, 'accept', 'Supervisor')$$,
  '22023', null,
  'there is no accept step either'
);

select throws_ok(
  $$select public.record_signoff_action(
    (select id from public.projects where code = 'SO-29'), 'register_entry',
    (select id from public.project_register_entries where entry_number like 'SO-29-WO-%-0001'),
    'WO-DAILY', 3, 'return', 'Supervisor')$$,
  '22023', null,
  'a final record is not returned; a correction is a new version'
);

select throws_ok(
  $$update public.record_signoff_events set comments = 'changed'$$,
  null, null,
  'sign-off events are never edited'
);

select throws_ok(
  $$insert into public.record_signoff_events (organization_id, project_id, record_kind, record_id, workflow_profile, round_number, stage_number, action, actor_user_id, actor_name, actor_role, attestation_method, new_status)
    select organization_id, project_id, record_kind, record_id, workflow_profile, 9, 1, 'close', actor_user_id, 'Forged', 'Forged', 'account', 'Closed'
    from public.record_signoff_events limit 1$$,
  '42501', null,
  'events are only written through the checked function'
);

reset role;

select * from finish();
rollback;
