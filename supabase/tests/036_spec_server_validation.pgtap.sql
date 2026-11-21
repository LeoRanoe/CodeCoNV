begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- F03: the server enforces the workbook forms' always-required fields and fixed lists (six workbook decisions included).
select plan(11);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000036a1', 'authenticated', 'authenticated', 'admin36@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000036b1', 'authenticated', 'authenticated', 'lead36@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000036b2', 'authenticated', 'authenticated', 'super36@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000036c1', 'authenticated', 'authenticated', 'cont36@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000036b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000036b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000036c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000036a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Rules Org 36', 'rules-org-36', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'rules-org-36'),
  'RU-36', 'Verify project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'RU-36';
grant select on ids to authenticated;
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000036a1' from ids;

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000036c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000036b1'::uuid), ('00000000-0000-0000-0000-0000000036b2'::uuid), ('00000000-0000-0000-0000-0000000036c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000036b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000036b2' then 'supervisor'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);


create temporary table co_spec on commit drop as select jsonb_build_object(
  '_rules', '1', 'request_date', '2026-11-23', 'change_type', 'Scope Change', 'change_category', 'Addition of Work',
  'change_reason', 'Client Request', 'originator', 'Lena Lead', 'cost_currency', 'SRD', 'cost_impact', '1000',
  'time_impact', '2', 'time_impact_unit', 'Working Days', 'approval_status', 'Draft', 'instruction_to_proceed', 'Not Issued') as spec;
grant select on co_spec to authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000036b1","role":"authenticated"}';
set local role authenticated;

-- Workbook decision: Change Order "Reason for change" is required.
select throws_ok(
  $$insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
    select organization_id, project_id, building_id, 'change_order', 'CO-36-0', 'Extra column', 'open', jsonb_build_object('spec', (select spec from co_spec) - 'change_reason'),
      '00000000-0000-0000-0000-0000000036b1', 'co36-entry-0000' from ids$$,
  '22023', 'The form cannot be saved: Required: Reason for change',
  'a Change Order from the current form is refused without Reason for change');
select lives_ok(
  $$insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
    select organization_id, project_id, building_id, 'change_order', 'CO-36-1', 'Extra column', 'open', jsonb_build_object('spec', (select spec from co_spec)),
      '00000000-0000-0000-0000-0000000036b1', 'co36-entry-0001' from ids$$,
  'a complete Change Order is saved');
select throws_ok(
  $$update public.project_register_entries set details = jsonb_set(details, '{spec,change_category}', '"Design Error"') where entry_number = 'CO-36-1'$$,
  '22023', null, 'a category outside its type''s list is refused');
select throws_ok(
  $$update public.project_register_entries set details = jsonb_set(details, '{spec,time_impact_unit}', '"Fortnights"') where entry_number = 'CO-36-1'$$,
  '22023', null, 'a value outside a fixed list is refused');

-- Workbook decision: the ten Issue responsible parties.
select throws_ok(
  $$insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
    select organization_id, project_id, building_id, 'ISS-36-1', 'deficiency', 'Loose rebar', 'Loose rebar at grid 4', 'medium', 'normal', 'open', '00000000-0000-0000-0000-0000000036b1', 'is36-finding-0001',
      jsonb_build_object('spec', jsonb_build_object('_rules', '1', 'identified_at', '2026-11-23T08:00', 'issue_type', 'Quality', 'issue_category', 'Workmanship',
        'responsible_party', 'Supervision', 'priority', 'Medium', 'corrective_action', 'Fix rebar', 'target_date', '2026-11-30')) from ids$$,
  '22023', null, 'Supervision is not one of the workbook''s responsible parties');
select lives_ok(
  $$insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
    select organization_id, project_id, building_id, 'ISS-36-2', 'deficiency', 'Loose rebar', 'Loose rebar at grid 4', 'medium', 'normal', 'open', '00000000-0000-0000-0000-0000000036b1', 'is36-finding-0002',
      jsonb_build_object('spec', jsonb_build_object('_rules', '1', 'identified_at', '2026-11-23T08:00', 'issue_type', 'Quality', 'issue_category', 'Workmanship',
        'responsible_party', 'Main Contractor', 'priority', 'Medium', 'corrective_action', 'Fix rebar', 'target_date', '2026-11-30')) from ids$$,
  'Main Contractor is accepted');

-- Workbook decision: an HSE observation needs its Action owner.
select throws_ok(
  $$insert into public.hse_events (organization_id, project_id, building_id, event_number, event_type, title, description, severity, occurred_at, idempotency_key, created_by, spec)
    select organization_id, project_id, building_id, 'HSE-36-1', 'unsafe_condition', 'Open edge', 'Open edge at level 2', 'medium', now(), 'hse36-event-0001', '00000000-0000-0000-0000-0000000036b1',
      jsonb_build_object('_rules', '1', 'observed_at', '2026-11-23T08:00', 'hse_type', 'Safety', 'hse_category', 'Working at Heights', 'potential_consequences', jsonb_build_array('Injury'),
        'risk_likelihood', 'Possible', 'risk_severity', 'Major', 'corrective_action', 'Install barrier', 'due_date', '2026-11-24') from ids$$,
  '22023', 'The form cannot be saved: Required: Action owner',
  'an HSE observation is refused without an Action owner');
reset role;

-- Older payloads and records: no marker, so the save goes through; the formal submission checks all.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000036b1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
    select organization_id, project_id, building_id, 'change_order', 'CO-36-2', 'Old payload', 'open', jsonb_build_object('spec', jsonb_build_object('change_type', 'Scope Change')),
      '00000000-0000-0000-0000-0000000036b1', 'co36-entry-0002' from ids$$,
  'an older offline payload without the marker is not stopped in the queue');
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'CO-36-2'),
    'CHANGE-APPROVAL', 1, 'submit', 'Originator')$$,
  '22023', null, 'its formal submission is refused until the form is complete');
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'CO-36-1'),
    'CHANGE-APPROVAL', 1, 'submit', 'Originator')$$,
  'a complete Change Order is submitted');
reset role;

-- A stored value from an older list stays editable when it is not changed.
set local request.jwt.claims = '{}';
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
select organization_id, project_id, building_id, 'ISS-36-3', 'deficiency', 'Old issue', 'Recorded before the workbook list', 'medium', 'normal', 'open', '00000000-0000-0000-0000-0000000036b1', 'is36-finding-0003',
  jsonb_build_object('spec', jsonb_build_object('responsible_party', 'Supervision', 'corrective_action', 'Old text')) from ids;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000036b1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$update public.findings set issue_management = jsonb_set(issue_management, '{spec,corrective_action}', '"Updated text"') where finding_number = 'ISS-36-3'$$,
  'an older record keeps its stored list value when another field is edited');
reset role;

select * from finish();
rollback;
