begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- F16: the server derives the signer's role and organisation and checks the profile and stage action.
select plan(8);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000035a1', 'authenticated', 'authenticated', 'admin35@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000035b1', 'authenticated', 'authenticated', 'lead35@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000035b2', 'authenticated', 'authenticated', 'super35@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000035c1', 'authenticated', 'authenticated', 'cont35@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000035b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000035b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000035c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000035a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Org Thirty-Five', 'sign-org-35', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'sign-org-35'),
  'SG-35', 'Verify project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'SG-35';
grant select on ids to authenticated;
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000035a1' from ids;

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000035c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000035b1'::uuid), ('00000000-0000-0000-0000-0000000035b2'::uuid), ('00000000-0000-0000-0000-0000000035c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000035b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000035b2' then 'supervisor'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);


insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'technical_instruction', 'TI-35-1', 'Sleeve size at grid 4', 'open', '{"spec":{"instruction_date":"2026-11-23","instruction_type":"Site Instruction","discipline":"Preliminaries & Site Establishment","instruction_category":"Site access, hoarding & fencing","issued_to":"Contractor A NV","action_owner":"Contractor A NV"}}'::jsonb,
  '00000000-0000-0000-0000-0000000035b2', 'ti35-entry-0001' from ids;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000035b2","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'TI-35-1'),
    'LESSON-REVIEW', 1, 'submit', 'Supervision')$$,
  '22023', null, 'a record cannot be signed under another form''s workflow profile');
select throws_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'TI-35-1'),
    'TECH-INSTRUCTION', 2, 'submit', 'Supervision')$$,
  '22023', null, 'an action the stage does not offer is refused (out-of-sequence input)');
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'TI-35-1'),
    'TECH-INSTRUCTION', 1, 'submit', 'Chief Engineer of the Universe')$$,
  'the supervisor submits the instruction');
reset role;
select is((select actor_role from public.record_signoff_events where action = 'submit'),
  (select string_agg(role.name, ', ') from public.roles role where role.code = 'supervisor' and role.organization_id = (select organization_id from ids)),
  'an account sign-off records the server''s project role, not the typed label');
select is((select stage_role from public.record_signoff_events where action = 'submit'), 'Chief Engineer of the Universe',
  'the role chosen in the screen is kept apart as the stage role');
select is((select actor_organization from public.record_signoff_events where action = 'submit'), 'Org Thirty-Five',
  'an internal account signs for the project''s organisation');

-- An external representative's statement is recorded as their attestation, by the account that entered it.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000035b2","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.record_signoff_action((select project_id from ids), 'register_entry', (select id from public.project_register_entries where entry_number = 'TI-35-1'),
    'TECH-INSTRUCTION', 2, 'acknowledge', 'Contractor', 'external_representative', 'Jan Aannemer', 'Bouw NV',
    'data:image/png;base64,' || repeat('A', 80))$$,
  'a contractor representative acknowledges on the supervisor''s device');
reset role;
select is((select actor_name || ' / ' || actor_organization || ' / ' || actor_role || ' / ' || attestation_method || ' / ' || actor_user_id::text
  from public.record_signoff_events where action = 'acknowledge'),
  'Jan Aannemer / Bouw NV / Contractor / external_representative / 00000000-0000-0000-0000-0000000035b2',
  'the external attestation keeps the stated name and organisation and who entered it');

select * from finish();
rollback;
