begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- F03 second step: conditional requirements, required row columns, "Other" explanations and number bounds.
select plan(15);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000037a1', 'authenticated', 'authenticated', 'admin37@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000037b1', 'authenticated', 'authenticated', 'lead37@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000037b2', 'authenticated', 'authenticated', 'super37@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000037c1', 'authenticated', 'authenticated', 'cont37@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000037b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000037b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000037c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000037a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Rules Org 37', 'rules-org-37', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'rules-org-37'),
  'RU-37', 'Verify project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'RU-37';
grant select on ids to authenticated;
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000037a1' from ids;

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000037c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000037b1'::uuid), ('00000000-0000-0000-0000-0000000037b2'::uuid), ('00000000-0000-0000-0000-0000000037c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000037b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000037b2' then 'supervisor'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

create temporary table specs on commit drop as select
  jsonb_build_object('_rules', '1', 'agreement_at', '2026-11-24T09:00', 'agreement_type', 'Action / Task Commitment',
    'agreement_category', 'Submission / Information Required', 'agreed_by', jsonb_build_array('Lena Lead', 'Contractor A NV'),
    'action_required', 'Yes') as agreement,
  jsonb_build_object('_rules', '1', 'report_date', '2026-11-24', 'discipline', 'Surveying & Setting Out', 'activity', 'Building / Grid Setting Out',
    'exact_location', 'Grid A-3', 'work_item', 'Grid lines', 'progress_status', 'In Progress', 'crew', jsonb_build_array('Contractor A NV'),
    'quantity_na', 'yes') as works,
  '{"_rules":"1","incident_at":"2026-11-24T09:00","incident_type":"Injury / Illness","incident_category":"First Aid Case",
    "immediate_response":"Provide first aid","incident_severity":"Minor","investigation_required":"No","hse_reviewer":"Lena Lead",
    "corrective_actions":[{"action":"Remove obstruction","owner":"Lena Lead","due":"2026-11-30"}]}'::jsonb as incident;
grant select on specs to authenticated;

create or replace function pg_temp.save_entry(p_type text, p_number text, p_spec jsonb) returns void language sql as $f$
  insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
  select organization_id, project_id, building_id, p_type, p_number, p_number, 'open', jsonb_build_object('spec', p_spec),
    '00000000-0000-0000-0000-0000000037b1', 'c37-' || lower(p_number) from ids;
$f$;

create or replace function pg_temp.save_incident(p_number text, p_spec jsonb) returns void language sql as $f$
  insert into public.hse_events (organization_id, project_id, building_id, event_number, event_type, title, description, severity, occurred_at, idempotency_key, created_by, spec)
  select organization_id, project_id, building_id, p_number, 'incident', p_number, 'Incident report', 'low', now(),
    'c37-' || lower(p_number), '00000000-0000-0000-0000-0000000037b1', p_spec from ids;
$f$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000037b1","role":"authenticated"}';
set local role authenticated;

-- Agreements: "Action required = Yes" makes Action owner and Due date required.
select throws_ok($$select pg_temp.save_entry('agreement', 'AGR-37-1', (select agreement from specs))$$,
  '22023', 'The form cannot be saved: Required: Action owner; Required: Due date',
  'an agreement that needs an action is refused without its owner and due date');
select lives_ok($$select pg_temp.save_entry('agreement', 'AGR-37-2', (select agreement from specs) || '{"action_owner":"Lena Lead","due_date":"2026-11-30"}')$$,
  'with owner and due date it is saved');
select lives_ok($$select pg_temp.save_entry('agreement', 'AGR-37-3', (select agreement from specs) || '{"action_required":"No"}')$$,
  'an agreement without an action needs no owner');
-- "Other" needs its explanation.
select throws_ok($$select pg_temp.save_entry('agreement', 'AGR-37-4', (select agreement from specs) || '{"action_required":"No","meeting_source":"Other"}')$$,
  '22023', 'The form cannot be saved: Required: Meeting / source · explanation for Other',
  'Other without its explanation is refused');

-- Works Ongoing: a quantity needs its unit, a finish before the start needs "crosses midnight".
select throws_ok($$select pg_temp.save_entry('works_ongoing', 'WO-37-1', (select works from specs) - 'quantity_na' || '{"quantity":"12"}')$$,
  '22023', 'The form cannot be saved: Required: Unit', 'a quantity without its unit is refused');
select throws_ok($$select pg_temp.save_entry('works_ongoing', 'WO-37-2', (select works from specs) || '{"start_time":"22:00","finish_time":"02:00"}')$$,
  '22023', 'The form cannot be saved: Required: Work crosses midnight', 'a finish before the start is refused unless it crosses midnight');
select lives_ok($$select pg_temp.save_entry('works_ongoing', 'WO-37-3', (select works from specs) || '{"start_time":"22:00","finish_time":"02:00","crosses_midnight":"yes"}')$$,
  'a night shift that crosses midnight is saved');
reset role;

-- Bounds hold for every save; required fields only for current-form saves and formal submission.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000037b1","role":"authenticated"}';
set local role authenticated;
select throws_ok($$select pg_temp.save_entry('works_ongoing', 'WO-37-4', '{"progress_percent":"140"}'::jsonb)$$,
  '22023', 'The form cannot be saved: Progress percentage: 140 is out of range', 'a percentage above 100 is refused, also from an older payload');
select lives_ok($$select pg_temp.save_entry('agreement', 'AGR-37-5', (select agreement from specs) - '_rules')$$,
  'an older offline payload without the marker is kept');
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'AGR-37-5'),
    'AGREEMENT-ACK', 1, 'submit', 'Originator')$$,
  '22023', 'Complete the form before submitting: Required: Action owner; Required: Due date',
  'its formal submission names the conditional fields still missing');

select throws_ok($$select pg_temp.save_incident('HSE-37-1', (select incident from specs))$$,
  '22023', 'Complete the restricted HSE fields: Injury classification', 'a current injury report needs its restricted details');
select throws_ok($$select pg_temp.save_incident('HSE-37-2', (select incident from specs) || '{"injury_classification":"First Aid","injury_nature":"Other","body_part":"Hand"}')$$,
  '22023', 'Complete the restricted HSE fields: Nature of injury / illness', 'Other requires an explanation without exposing it in the error');
select lives_ok($$select pg_temp.save_incident('HSE-37-3', (select incident from specs) || '{"injury_classification":"First Aid","injury_nature":"Cut","body_part":"Hand"}')$$,
  'a complete injury report is saved');
select lives_ok($$select pg_temp.save_incident('HSE-37-4', (select incident from specs) - '_rules')$$,
  'a legacy injury report can be recovered for completion');
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'hse_event', (select id from public.hse_events where event_number = 'HSE-37-4'),
    'HSE-INCIDENT', 1, 'submit', 'Reporter')$$,
  '22023', 'Complete the restricted HSE fields: Injury classification', 'legacy injury cannot be formally submitted without the restricted data');
reset role;

select * from finish();
rollback;
