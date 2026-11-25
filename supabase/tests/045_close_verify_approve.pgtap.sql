begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Developer package v5 (25-11-2026), Word 3.1: the closure note, the NCR verification result and the
-- approved amount and days are entered in the Close / Verify / Approve dialog and stored in the sign-off log.
select plan(23);

select has_column('public', 'record_signoff_events', 'details', 'the sign-off log keeps what the dialog carried');

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000045a1', 'authenticated', 'authenticated', 'admin45@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000045b1', 'authenticated', 'authenticated', 'super45@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000045b2', 'authenticated', 'authenticated', 'pm45@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000045c1', 'authenticated', 'authenticated', 'cont45@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000045b1', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000045b2', 'Pia Manager'),
  ('00000000-0000-0000-0000-0000000045c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Org Forty-Five', 'dialog-org-45', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'dialog-org-45'),
  'DG-45', 'Dialog project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'DG-45';
grant select on ids to authenticated;

insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000045a1' from ids;
insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000045c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000045b1'::uuid), ('00000000-0000-0000-0000-0000000045b2'::uuid), ('00000000-0000-0000-0000-0000000045c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000045b1' then 'supervisor'
    when '00000000-0000-0000-0000-0000000045b2' then 'project_manager'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
select organization_id, project_id, building_id, 'ISS-45-1', 'deficiency', 'Sleeve out of line', 'Out of line', 'medium', 'normal', 'open', '00000000-0000-0000-0000-0000000045b1'::uuid, 'dg45-iss-1', '{"spec":{"workflow_status":"Open","responsible_party":"Supervision"}}'::jsonb from ids
union all
select organization_id, project_id, building_id, 'NCR-45-1', 'ncr', 'Honeycombing column C4', 'Poor vibration', 'high', 'high', 'open', '00000000-0000-0000-0000-0000000045b1'::uuid, 'dg45-ncr-1', '{"spec":{"workflow_status":"Open"}}'::jsonb from ids;
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'agreement', 'AG-45-1', 'Curing agreed', 'open', '{"spec":{"workflow_status":"Open"}}'::jsonb, '00000000-0000-0000-0000-0000000045b1'::uuid, 'dg45-ag-1' from ids
union all
select organization_id, project_id, building_id, 'change_order', 'CO-45-1', 'Bigger footing', 'open',
  '{"spec":{"request_date":"2026-11-25","change_type":"Scope Change","change_category":"Addition of Work","change_reason":"Client Request","originator":"Sam Supervisor","cost_currency":"SRD","cost_impact":"800","time_impact":"2","time_impact_unit":"Calendar Days","approval_status":"Draft","instruction_to_proceed":"Not Issued"}}'::jsonb, '00000000-0000-0000-0000-0000000045b1'::uuid, 'dg45-co-1' from ids;

-- A contractor representative (no account of their own) acknowledges the Issue, the NCR and the Agreement; Supervision submits the Change Order.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045b1","role":"authenticated"}';
set local role authenticated;
select public.record_signoff_action((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'ISS-45-1'), 'ISSUE-CLOSEOUT', 2, 'acknowledge', 'Contractor', 'external_representative', 'Alex Contractor', null, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
select public.record_signoff_action((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'NCR-45-1'), 'NCR-CORRECTIVE', 2, 'acknowledge', 'Contractor', 'external_representative', 'Alex Contractor', null, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'AG-45-1'), 'AGREEMENT-ACK', 2, 'acknowledge', 'Contractor', 'external_representative', 'Alex Contractor', null, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045b1","role":"authenticated"}';
set local role authenticated;
select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'CO-45-1'), 'CHANGE-APPROVAL', 1, 'submit', 'Supervision');
reset role;

-- Issue: the closure note is part of the action.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045a1","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'ISS-45-1'), 'ISSUE-CLOSEOUT', 3, 'verify', 'Supervision')$$,
  '22023', null, 'an Issue is not closed without a closure note');
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'ISS-45-1'), 'ISSUE-CLOSEOUT', 3, 'verify', 'Supervision', 'account', null, null, null, null, null, null, null, null, null, '{"verification_result":"Effective"}'::jsonb)$$,
  '22023', null, 'an action refuses a detail it does not take');
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'ISS-45-1'), 'ISSUE-CLOSEOUT', 3, 'verify', 'Supervision', 'account', null, null, null, null, null, null, null, null, null, '{"closure_note":"  Sleeve realigned and re-measured  "}'::jsonb)$$,
  'the closure note is entered with the close action');
reset role;
select is(
  (select issue_management #>> '{spec,closure_note}' || '|' || (issue_management #>> '{spec,workflow_status}') || '|' || status from public.findings where finding_number = 'ISS-45-1'),
  'Sleeve realigned and re-measured|Closed|closed',
  'the note is written to the closed Issue');
select is(
  (select details ->> 'closure_note' from public.record_signoff_events where action = 'verify' and record_id = (select id from public.findings where finding_number = 'ISS-45-1')),
  'Sleeve realigned and re-measured', 'and stored in the sign-off log');

-- NCR: Effective closes, anything else is returned.
set local role authenticated;
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'NCR-45-1'), 'NCR-CORRECTIVE', 3, 'verify', 'Supervision', 'account', null, null, null, null, null, null, null, null, null, '{"verification_result":"Not Effective"}'::jsonb)$$,
  '22023', null, 'an NCR is not closed on a result that is not Effective');
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'NCR-45-1'), 'NCR-CORRECTIVE', 3, 'return', 'Supervision', 'account', null, null, null, null, 'Cover still too thin', null, 'Alex Contractor', null, null, '{"verification_result":"Rework Required"}'::jsonb)$$,
  'a return records the result');
reset role;
select is(
  (select (issue_management #>> '{spec,verification_result}') || '|' || (issue_management #>> '{spec,workflow_status}') || '|' || (issue_management #>> '{spec,corrective_action_reopened}') from public.findings where finding_number = 'NCR-45-1'),
  'Rework Required|In Progress|yes', 'Rework Required reopens the corrective action');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045a1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'NCR-45-1'), 'NCR-CORRECTIVE', 3, 'close', 'Supervision', 'account', null, null, null, null, null, null, null, null, null, '{"verification_result":"Effective"}'::jsonb)$$,
  'an Effective result closes the NCR');
reset role;
select is(
  (select (issue_management #>> '{spec,verification_result}') || '|' || (issue_management #>> '{spec,verified_by}') || '|' || (issue_management #>> '{spec,workflow_status}') from public.findings where finding_number = 'NCR-45-1'),
  'Effective|Ada Admin|Closed', 'the verifier is the person who acted, written by the database');
select is(
  (select (issue_management #>> '{spec,verified_on}') = to_char((now() at time zone 'America/Paramaribo')::date, 'YYYY-MM-DD') from public.findings where finding_number = 'NCR-45-1'),
  true, 'and the date is today');

-- Agreement: the closure note is optional.
set local role authenticated;
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'AG-45-1'), 'AGREEMENT-ACK', 3, 'close', 'Supervision', 'account', null, null, null, null, null, null, null, null, null, '{"closure_note":"All parties confirmed"}'::jsonb)$$,
  'an Agreement is closed with a note');
reset role;
select is((select details #>> '{spec,closure_note}' from public.project_register_entries where entry_number = 'AG-45-1'), 'All parties confirmed', 'the note is written to the Agreement');

-- Change Order: the approved amount and days, and the project's approval limit.
update public.project_settings set spec_configuration = '{"workflows":{"CHANGE-APPROVAL":{"approval_limit":1000}}}'::jsonb
where project_id = (select project_id from ids);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045b2","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'CO-45-1'), 'CHANGE-APPROVAL', 3, 'approve', 'Project Manager')$$,
  '22023', null, 'a Change Order is not approved without an approved amount and days');
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'CO-45-1'), 'CHANGE-APPROVAL', 3, 'approve', 'Project Manager', 'account', null, null, null, null, null, null, null, null, null, '{"approved_amount":"5000","approved_days":"3"}'::jsonb)$$,
  '42501', null, 'the approved amount is held against the project''s approval limit');
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'CO-45-1'), 'CHANGE-APPROVAL', 3, 'approve', 'Project Manager', 'account', null, null, null, null, null, null, null, null, null, '{"approved_amount":"nine hundred","approved_days":"3"}'::jsonb)$$,
  '22023', null, 'an amount that is not a number is refused');
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'CO-45-1'), 'CHANGE-APPROVAL', 3, 'approve', 'Project Manager', 'account', null, null, null, null, null, null, null, null, null, '{"approved_amount":"900.5","approved_days":"3"}'::jsonb)$$,
  'the Project Manager approves with the amount and days');
reset role;
select is(
  (select (details #>> '{spec,approved_amount}') || '|' || (details #>> '{spec,approved_days}') || '|' || (details #>> '{spec,approval_status}') || '|' || (details #>> '{spec,approved_by}') from public.project_register_entries where entry_number = 'CO-45-1'),
  '900.5|3|Approved|Pia Manager', 'the Change Order carries the approval');

-- The outcomes are written by the action only: an edit through the table cannot change them.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045a1","role":"authenticated"}';
set local role authenticated;
update public.project_register_entries set details = jsonb_set(details, '{spec,approved_amount}', '"1"') where entry_number = 'CO-45-1';
update public.project_register_entries set details = (details #- '{spec,closure_note}') where entry_number = 'AG-45-1';
reset role;
select is((select details #>> '{spec,approved_amount}' from public.project_register_entries where entry_number = 'CO-45-1'), '900.5', 'an edit cannot change the approved amount');
select is((select details #>> '{spec,closure_note}' from public.project_register_entries where entry_number = 'AG-45-1'), 'All parties confirmed', 'an edit cannot remove the closure note');

-- v5.0 Lessons Learned: a submitted lesson is shared at once, there is no review step.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045b1","role":"authenticated"}';
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, occurred_at, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'lessons_learned', 'LL-45-1', 'Order sleeves early', 'open', now(),
  jsonb_build_object('spec', jsonb_build_object('_rules', '1', 'recorded_on', '2026-11-25', 'project_phase', 'Planning & Design',
    'lesson_category', 'Scope Definition & Work Breakdown', 'situation', 'Slab pour', 'what_happened', 'Sleeves forgotten',
    'impact_types', jsonb_build_array('Cost'), 'impact_detail', 'Core drilling', 'lesson_learned', 'Order sleeves early',
    'recommendation', 'Check the sleeve list', 'applicability', 'Future Projects', 'review_status', 'Draft')),
  '00000000-0000-0000-0000-0000000045b1'::uuid, 'dg45-ll-1' from ids;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000045b1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'LL-45-1'), 'LESSON-REVIEW', 1, 'submit', 'Author')$$,
  'the author submits the lesson');
select is((select count(*) from public.list_shared_lessons((select organization_id from ids)) where entry_number = 'LL-45-1'), 1::bigint,
  'the submitted lesson is shared with the organisation without a review step');
reset role;

select * from finish();
rollback;
