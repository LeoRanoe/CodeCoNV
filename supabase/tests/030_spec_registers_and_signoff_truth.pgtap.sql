begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Third round of the client's developer specification: people from the live register, one
-- status driven by the sign-off log, reviewer-only decisions, restricted incident data, a new
-- round after an edit, the project's own workflow settings and lessons shared across projects.
select plan(29);

select has_function('public', 'list_project_people', 'the project''s people come from one function');
select has_table('public', 'hse_event_sensitive', 'restricted incident data has its own table');
select has_column('public', 'project_settings', 'spec_configuration', 'workflow settings, lists and the risk matrix are project settings');
select has_function('public', 'list_shared_lessons', 'shared lessons are listed across projects');

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000030a1', 'authenticated', 'authenticated', 'admin30@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000030b1', 'authenticated', 'authenticated', 'super30@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000030c1', 'authenticated', 'authenticated', 'client30@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000030d1', 'authenticated', 'authenticated', 'outsider30@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000030b1', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000030c1', 'Cleo Client'),
  ('00000000-0000-0000-0000-0000000030d1', 'Otto Outsider')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Spec Org 30', 'spec-org-30', 'Ada Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'spec-org-30'),
  'SP-30', 'Spec project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
reset role;

-- A supervisor (no approvals) and a client (reads, no HSE management) join the project.
insert into public.project_memberships (organization_id, project_id, user_id, status)
select project.organization_id, project.id, member.id, 'active'
from public.projects project, (values ('00000000-0000-0000-0000-0000000030b1'::uuid), ('00000000-0000-0000-0000-0000000030c1'::uuid)) member(id)
where project.code = 'SP-30';
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id
  and role.code = case membership.user_id when '00000000-0000-0000-0000-0000000030b1' then 'supervisor' else 'client' end
where membership.user_id in ('00000000-0000-0000-0000-0000000030b1', '00000000-0000-0000-0000-0000000030c1');

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'SP-30';
grant select on ids to authenticated;

-- 1. People
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030b1","role":"authenticated"}';
set local role authenticated;
select is(
  (select count(*) from public.list_project_people((select project_id from ids)) where display_name in ('Sam Supervisor', 'Cleo Client', 'Ada Admin')),
  3::bigint,
  'a project member sees the project''s people by name'
);

-- 3. Reviewer-only decisions
select throws_ok(
  $$select public.create_project_register_entry((select project_id from ids), (select building_id from ids), null, 'equipment',
    'Extra footing', now(), null, null, '{"spec":{"change_type":"Scope Change","approval_status":"Approved","cost_impact":"10"}}'::jsonb, 'sp30-co-1')$$,
  '42501', null,
  'a supervisor without approval rights cannot record a change as approved'
);
select lives_ok(
  $$select public.create_project_register_entry((select project_id from ids), (select building_id from ids), null, 'equipment',
    'Extra footing', now(), null, null, '{"spec":{"change_type":"Scope Change","approval_status":"Draft","cost_impact":"5000"}}'::jsonb, 'sp30-co-2')$$,
  'a draft change order is recorded'
);

-- 2. The workbook status is not typed
select public.create_project_register_entry((select project_id from ids), (select building_id from ids), null, 'equipment',
  'Move sleeve', now(), null, null, '{"spec":{"instruction_type":"Clarification","workflow_status":"Closed"}}'::jsonb, 'sp30-ti-1');
select is(
  (select details #>> '{spec,workflow_status}' from public.project_register_entries where idempotency_key = 'sp30-ti-1'),
  'Open',
  'a new record starts Open whatever was typed'
);
update public.project_register_entries set details = jsonb_set(details, '{spec,workflow_status}', '"Closed"') where idempotency_key = 'sp30-ti-1';
select is(
  (select details #>> '{spec,workflow_status}' from public.project_register_entries where idempotency_key = 'sp30-ti-1'),
  'Open',
  'a typed status is put back'
);

-- 6. Sign-off drives the status and tells the next person
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry',
    (select id from public.project_register_entries where idempotency_key = 'sp30-ti-1'), 'TECH-INSTRUCTION', 1, 'submit', 'Supervision')$$,
  'the supervisor submits the instruction'
);
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry',
    (select id from public.project_register_entries where idempotency_key = 'sp30-ti-1'), 'TECH-INSTRUCTION', 4, 'return', 'Supervision',
    'account', null, null, null, null, 'Wrong sleeve size.', null, null, '00000000-0000-0000-0000-0000000030d1')$$,
  '22023', null,
  'the next responsible person must be on the project'
);
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry',
    (select id from public.project_register_entries where idempotency_key = 'sp30-ti-1'), 'TECH-INSTRUCTION', 2, 'acknowledge', 'Contractor',
    'signed_document', 'Jan Aannemer', 'Bouw NV')$$,
  '22023', null,
  'a signed document is an uploaded project file'
);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry',
    (select id from public.project_register_entries where idempotency_key = 'sp30-ti-1'), 'TECH-INSTRUCTION', 4, 'return', 'Supervision',
    'account', null, null, null, null, 'Wrong sleeve size.', null, null, '00000000-0000-0000-0000-0000000030b1')$$,
  'the reviewer returns it to a named project member'
);
reset role;
select is(
  (select next_actor from public.record_signoff_events order by sequence_number desc limit 1),
  'Sam Supervisor',
  'the next actor is stored by name'
);
select is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-0000-0000-0000000030b1' and source_type = 'signoff'),
  1::bigint,
  'the next responsible person is notified'
);
select is(
  (select details #>> '{spec,workflow_status}' from public.project_register_entries where idempotency_key = 'sp30-ti-1'),
  'In Progress',
  'a return puts the workbook status to In Progress'
);

-- Verification closes the record and its status.
set local role authenticated;
select public.record_signoff_action((select project_id from ids), 'register_entry',
  (select id from public.project_register_entries where idempotency_key = 'sp30-ti-1'), 'TECH-INSTRUCTION', 4, 'verify', 'Supervision');
reset role;
select is(
  (select status || '/' || (details #>> '{spec,workflow_status}') from public.project_register_entries where idempotency_key = 'sp30-ti-1'),
  'closed/Closed',
  'a verification closes the record and the workbook status together'
);

-- 3. The reviewer's decision is signed by the database; the project's approval limit holds.
set local role authenticated;
update public.project_register_entries set details = jsonb_set(details, '{spec,approval_status}', '"Approved"') where idempotency_key = 'sp30-co-2';
reset role;
select is(
  (select details #>> '{spec,approved_by_user_id}' from public.project_register_entries where idempotency_key = 'sp30-co-2'),
  '00000000-0000-0000-0000-0000000030a1',
  'the approver is recorded automatically'
);
update public.project_settings set spec_configuration = '{"workflows":{"CHANGE-APPROVAL":{"approval_limit":1000,"stages":{"3":{"required_approvals":2}}}}}'::jsonb
where project_id = (select project_id from ids);
set local role authenticated;
select public.create_project_register_entry((select project_id from ids), (select building_id from ids), null, 'equipment',
  'Bigger footing', now(), null, null, '{"spec":{"change_type":"Scope Change","approval_status":"Draft","cost_impact":"5000"}}'::jsonb, 'sp30-co-3');
select throws_ok(
  $$update public.project_register_entries set details = jsonb_set(details, '{spec,approval_status}', '"Approved"') where idempotency_key = 'sp30-co-3'$$,
  '42501', null,
  'an amount above the project''s limit needs an approver above the limit'
);
reset role;
update public.project_settings set spec_configuration = '{"workflows":{"CHANGE-APPROVAL":{"stages":{"3":{"required_approvals":2}}}}}'::jsonb
where project_id = (select project_id from ids);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030b1","role":"authenticated"}';
set local role authenticated;
select public.record_signoff_action((select project_id from ids), 'register_entry',
  (select id from public.project_register_entries where idempotency_key = 'sp30-co-3'), 'CHANGE-APPROVAL', 1, 'submit', 'Originator');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}';
set local role authenticated;
select is(
  (select new_status from public.record_signoff_action((select project_id from ids), 'register_entry',
    (select id from public.project_register_entries where idempotency_key = 'sp30-co-3'), 'CHANGE-APPROVAL', 3, 'approve', 'Approver')),
  'Partially Approved (1/2)',
  'a stage that needs two approvals waits for the second'
);
reset role;

-- 5. An edit after submission opens a new version
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030b1","role":"authenticated"}';
set local role authenticated;
update public.project_register_entries set title = 'Bigger footing, revised' where idempotency_key = 'sp30-co-3';
reset role;
select is(
  (select action || '/' || new_status from public.record_signoff_events
   where record_id = (select id from public.project_register_entries where idempotency_key = 'sp30-co-3')
   order by sequence_number desc limit 1),
  'reopen/Reopened',
  'a material edit after submission reopens the sign-off'
);

-- 6. Overdue steps remind the next person
insert into public.record_signoff_events (organization_id, project_id, record_kind, record_id, workflow_profile, round_number, stage_number,
  action, actor_user_id, actor_name, actor_role, attestation_method, next_actor, next_actor_user_id, due_at, previous_status, new_status)
select organization_id, project_id, 'register_entry', (select id from public.project_register_entries where idempotency_key = 'sp30-co-2'),
  'CHANGE-APPROVAL', 1, 1, 'submit', '00000000-0000-0000-0000-0000000030a1', 'Ada Admin', 'Originator', 'account',
  'Sam Supervisor', '00000000-0000-0000-0000-0000000030b1', now() - interval '3 days', null, 'Submitted'
from ids;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030b1","role":"authenticated"}';
set local role authenticated;
select public.refresh_project_notifications((select project_id from ids));
reset role;
select is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-0000-0000-0000000030b1' and dedupe_key like 'signoff-overdue:%'),
  1::bigint,
  'an overdue sign-off step reminds the next person'
);
select ok(
  exists (select 1 from public.notifications where recipient_user_id = '00000000-0000-0000-0000-0000000030a1' and dedupe_key like 'signoff-escalated:%'),
  'and is escalated to the project''s reviewers a day later'
);

-- 4. Restricted incident data
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}';
insert into public.hse_events (organization_id, project_id, building_id, event_number, event_type, title, description, severity, occurred_at, idempotency_key, created_by, spec)
select organization_id, project_id, building_id, 'HSE-30-0001', 'incident', 'Fall from ladder', 'Worker fell.', 'high', now(), 'sp30-hse', '00000000-0000-0000-0000-0000000030a1',
  '{"incident_type":"Injury / Illness","people_involved":"P. Jansen","body_part":"Hand","witnesses":"K. de Vries"}'::jsonb
from ids;
select ok(
  not ((select spec from public.hse_events where idempotency_key = 'sp30-hse') ?| array['people_involved', 'body_part', 'witnesses']),
  'people involved, witnesses and injuries leave the HSE record'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030c1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.hse_event_sensitive), 0::bigint, 'a reader without HSE management does not see them');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030b1","role":"authenticated"}';
set local role authenticated;
select is((select data ->> 'people_involved' from public.hse_event_sensitive), 'P. Jansen', 'an HSE manager does');
select is(
  (select source_type || ':' || (owner_user_id = '00000000-0000-0000-0000-0000000030b1')::text from public.create_record_follow_up_action(
    (select project_id from ids), 'hse', (select id from public.hse_events where idempotency_key = 'sp30-hse'),
    (select building_id from ids), null, '00000000-0000-0000-0000-0000000030b1', 'Replace the ladder', 'From HSE-30-0001',
    now() + interval '2 days', 'sp30-follow-1')),
  'hse:true',
  'each corrective action becomes its own action, linked to the incident, with its owner'
);
reset role;

-- 8. Lessons shared across projects
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}';
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, occurred_at, details, idempotency_key, created_by)
select organization_id, project_id, building_id, 'lessons_learned', 'LL-0001', 'Order sleeves early', now(),
  '{"spec":{"review_status":"Approved for Sharing"}}'::jsonb, 'sp30-lesson-1', '00000000-0000-0000-0000-0000000030a1'
from ids;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030b1","role":"authenticated"}';
set local role authenticated;
select is(
  (select count(*) from public.list_shared_lessons((select organization_id from ids))),
  1::bigint,
  'a lesson approved for sharing is listed for the organisation'
);
select throws_ok(
  $$update public.project_register_entries set details = jsonb_set(details, '{spec,review_status}', '"Approved for Sharing"') where idempotency_key = 'sp30-co-2'$$,
  '42501', null,
  'only a reviewer approves a lesson for sharing'
);
reset role;

select * from finish();
rollback;
