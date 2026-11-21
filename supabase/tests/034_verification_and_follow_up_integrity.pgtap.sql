begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- F02 (Rapid Verify decides Works Completed) and F08 (follow-up actions created with the record, once per row).
select plan(22);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000034a1', 'authenticated', 'authenticated', 'admin34@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000034b1', 'authenticated', 'authenticated', 'lead34@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000034b2', 'authenticated', 'authenticated', 'super34@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000034c1', 'authenticated', 'authenticated', 'cont34@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000034b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000034b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000034c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Follow Org 34', 'follow-org-34', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'follow-org-34'),
  'FU-34', 'Verify project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'FU-34';
grant select on ids to authenticated;
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000034a1' from ids;

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000034c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000034b1'::uuid), ('00000000-0000-0000-0000-0000000034b2'::uuid), ('00000000-0000-0000-0000-0000000034c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000034b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000034b2' then 'supervisor'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);


-- F02: Works Completed in Rapid Verify ------------------------------------------------------
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'works_completed', 'WC-34-' || n, 'Slab pour ' || n, 'open',
  jsonb_build_object('spec', jsonb_build_object('inspection_status', 'Completed - Awaiting Inspection')),
  '00000000-0000-0000-0000-0000000034b1', 'wc34-entry-000' || n
from ids, generate_series(1, 4) n;
-- An older record that stored its decision as completion_status keeps working.
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'works_completed', 'WC-34-L', 'Legacy slab', 'open',
  jsonb_build_object('spec', jsonb_build_object('completion_status', 'Inspected - Accepted')), '00000000-0000-0000-0000-0000000034b1', 'wc34-entry-legacy' from ids;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034b2","role":"authenticated"}';
set local role authenticated;
select throws_ok($$select public.record_verification((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'WC-34-1'), 'pass', null, null, null, null, null, null)$$,
  '42501', null, 'a role without reviewer authority cannot accept completed work by verifying it');
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034b1","role":"authenticated"}';
set local role authenticated;
select lives_ok($$select public.record_verification((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'WC-34-1'), 'pass', 'Checked on site', null, 5.85, -55.2, 'Grid B2', null)$$,
  'the lead supervisor passes completed work');
select is((select details #>> '{spec,inspection_status}' from public.project_register_entries where entry_number = 'WC-34-1'), 'Inspected - Accepted',
  'Pass sets the Works Completed inspection status to accepted');
select is((select details #>> '{spec,inspected_by_user_id}' from public.project_register_entries where entry_number = 'WC-34-1'), '00000000-0000-0000-0000-0000000034b1',
  'the inspector is stamped by the server');
select is((select previous_status || ' -> ' || resulting_status from public.verifications where record_code = 'WC-34-1'),
  'Completed - Awaiting Inspection -> Inspected - Accepted', 'the verification log records the inspection transition');
select lives_ok($$select public.record_verification((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'WC-34-2'), 'fail', 'Honeycombing at edge',
  null, null, null, null, jsonb_build_object('title', 'Repair slab edge'))$$, 'a failed verification with a corrective action');
select is((select details #>> '{spec,inspection_status}' from public.project_register_entries where entry_number = 'WC-34-2'), 'Inspected - Rejected',
  'Fail rejects the completed work');
select is((select count(*) from public.actions where title = 'Repair slab edge' and source_type = 'register_entry' and action_category = 'corrective'
  and source_id = (select id from public.project_register_entries where entry_number = 'WC-34-2')), 1::bigint,
  'the corrective action is linked to the exact Works Completed record');
select lives_ok($$select public.record_verification((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'WC-34-3'), 'partial', 'Two bays left', null, null, null, null, null)$$,
  'a partial result');
select is((select details #>> '{spec,inspection_status}' from public.project_register_entries where entry_number = 'WC-34-3'), 'Completed - Awaiting Inspection',
  'Partially complete keeps the work awaiting inspection');
select lives_ok($$select public.record_verification((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'WC-34-4'), 'further_action', 'Cube results pending', null, null, null, null, null)$$,
  'a further-action result');
select is((select details #>> '{spec,inspection_status}' from public.project_register_entries where entry_number = 'WC-34-4'), 'Completed - Awaiting Inspection',
  'Further action required keeps the work awaiting inspection');
select lives_ok($$select public.record_verification((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'WC-34-1'), 'fail', 'Second look', null, null, null, null, null)$$,
  'a later verification of decided work is logged');
select is((select details #>> '{spec,inspection_status}' from public.project_register_entries where entry_number = 'WC-34-1'), 'Inspected - Accepted',
  'already decided work keeps its decision');
reset role;

-- F08: incident and agreement follow-ups ---------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034b1","role":"authenticated"}';
set local role authenticated;
insert into public.hse_events (organization_id, project_id, building_id, event_number, event_type, title, description, severity, occurred_at, idempotency_key, created_by, spec)
select organization_id, project_id, building_id, 'HSE-34-1', 'incident', 'Fall from ladder', 'Worker slipped from ladder', 'medium', now(), 'hse34-event-0001', '00000000-0000-0000-0000-0000000034b1',
  jsonb_build_object('corrective_actions', jsonb_build_array(
    jsonb_build_object('row_id', 'r1', 'action', 'Toolbox talk ladders', 'owner', 'Contractor A NV', 'owner_ref', 'party:' || (select id from public.parties where code = 'CA' and project_id = ids.project_id), 'due', '2026-12-01'),
    jsonb_build_object('row_id', 'r2', 'action', 'Toolbox talk ladders', 'owner', 'Sam Supervisor', 'owner_ref', 'user:00000000-0000-0000-0000-0000000034b2', 'due', '2026-12-05'),
    jsonb_build_object('action', 'Replace ladder feet', 'owner', 'Contractor A NV', 'due', '2026-12-03')))
from ids;
reset role;
select is((select count(*) from public.actions where source_type = 'hse' and source_id = (select id from public.hse_events where event_number = 'HSE-34-1')), 3::bigint,
  'each incident follow-up row becomes its own action in the same save, identical wording included');
select is((select count(*) from public.actions where source_id = (select id from public.hse_events where event_number = 'HSE-34-1') and title = 'Toolbox talk ladders'
  and ((owner_party_id is not null and due_at::date = '2026-12-01') or (owner_user_id = '00000000-0000-0000-0000-0000000034b2' and due_at::date = '2026-12-05'))), 2::bigint,
  'two identical descriptions keep their own owner and due date');
select is((select count(*) from jsonb_array_elements((select spec -> 'corrective_actions' from public.hse_events where event_number = 'HSE-34-1')) item
  where item ? 'action_id' and item ? 'row_id'), 3::bigint, 'every row carries its row id and its action id');

-- Replaying the same save (an offline retry) and editing the record add nothing.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034b1","role":"authenticated"}';
set local role authenticated;
update public.hse_events set spec = spec where event_number = 'HSE-34-1';
update public.hse_events set spec = jsonb_set(spec, '{corrective_actions}', (spec -> 'corrective_actions') || jsonb_build_array(jsonb_build_object('row_id', 'r4', 'action', 'Inspect all ladders', 'due', '2026-12-10')))
  where event_number = 'HSE-34-1';
reset role;
select is((select count(*) from public.actions where source_type = 'hse' and source_id = (select id from public.hse_events where event_number = 'HSE-34-1')), 4::bigint,
  'a repeated save creates nothing twice; an added row adds one action');

-- A row stored before row ids keeps the action created under the former text key.
set local request.jwt.claims = '{}';
alter table public.hse_events disable trigger hse_events_aa_follow_up;
insert into public.hse_events (organization_id, project_id, building_id, event_number, event_type, title, description, severity, occurred_at, idempotency_key, created_by, spec)
select organization_id, project_id, building_id, 'HSE-34-2', 'incident', 'Old incident', 'Stored before row ids', 'low', now(), 'hse34-event-0002', '00000000-0000-0000-0000-0000000034b1',
  jsonb_build_object('corrective_actions', jsonb_build_array(jsonb_build_object('action', 'Barrier at edge', 'due', '2026-12-01'))) from ids;
alter table public.hse_events enable trigger hse_events_aa_follow_up;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034b1","role":"authenticated"}';
set local role authenticated;
select public.create_record_follow_up_action((select project_id from ids), 'hse', (select id from public.hse_events where event_number = 'HSE-34-2'),
  (select building_id from ids), null, null, 'Barrier at edge', 'legacy', null,
  'follow:' || (select id from public.hse_events where event_number = 'HSE-34-2') || ':corrective_actions:barrier-at-edge');
update public.hse_events set spec = spec where event_number = 'HSE-34-2';
reset role;
select is((select count(*) from public.actions where source_id = (select id from public.hse_events where event_number = 'HSE-34-2')), 1::bigint,
  'a legacy row is linked to its existing action, not given a second one');

-- An agreement with an action owner gets one action, also when saved again.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034b1","role":"authenticated"}';
set local role authenticated;
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'agreement', 'AGR-34-1', 'Concrete pour sequence', 'open',
  jsonb_build_object('spec', jsonb_build_object('action_required', 'Yes', 'action_owner', 'Contractor A NV',
    'action_owner_ref', 'party:' || (select id from public.parties where code = 'CA' and project_id = ids.project_id), 'due_date', '2026-12-02')),
  '00000000-0000-0000-0000-0000000034b1', 'agr34-entry-0001' from ids;
update public.project_register_entries set title = 'Concrete pour sequence agreed' where entry_number = 'AGR-34-1';
reset role;
select is((select count(*) from public.actions where source_type = 'meeting' and source_id = (select id from public.project_register_entries where entry_number = 'AGR-34-1')), 1::bigint,
  'an agreement creates exactly one linked action');
select is((select details #>> '{spec,follow_up_action_id}' from public.project_register_entries where entry_number = 'AGR-34-1'),
  (select id::text from public.actions where source_id = (select id from public.project_register_entries where entry_number = 'AGR-34-1')),
  'the agreement stores the id of its action');

-- A user without actions.create still saves the record; the action waits for a permitted save.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034c1","role":"authenticated"}';
select is((select app_private.ensure_follow_up_action((select project_id from ids), null, 'hse', gen_random_uuid(), 'corrective_actions', 'x', null, 'Not allowed', '', null, null, '{}')), null::uuid,
  'no action is created for a user without actions.create');

select * from finish();
rollback;
