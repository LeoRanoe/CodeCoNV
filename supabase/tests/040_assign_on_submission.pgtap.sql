begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Word §3.1, §7.1 step 2 and §17.1; workbook NCR row 19 and Technical Instructions rows 11-13:
-- a submitted NCR or TI goes to the responsible contractor's portal, once.
select plan(11);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000040a1', 'authenticated', 'authenticated', 'admin40@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000040b1', 'authenticated', 'authenticated', 'lead40@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000040b2', 'authenticated', 'authenticated', 'super40@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000040c1', 'authenticated', 'authenticated', 'cont40@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000040b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000040b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000040c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Assign Org 40', 'assign-org-40', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'assign-org-40'),
  'AS-40', 'Assign project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'AS-40';
grant select on ids to authenticated;
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, code, name, party_type, '00000000-0000-0000-0000-0000000040a1'
from ids, (values ('CA', 'Contractor A NV', 'contractor'), ('CL', 'Employer NV', 'client')) party(code, name, party_type);
alter table ids add column party_a uuid, add column party_client uuid;
update ids set party_a = (select id from public.parties where code = 'CA' and project_id = ids.project_id),
  party_client = (select id from public.parties where code = 'CL' and project_id = ids.project_id);

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000040c1'::uuid then ids.party_a end
from ids, (values ('00000000-0000-0000-0000-0000000040b1'::uuid), ('00000000-0000-0000-0000-0000000040b2'::uuid), ('00000000-0000-0000-0000-0000000040c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000040b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000040b2' then 'supervisor'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

-- NCR submitted with Contractor A as action owner.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040b1","role":"authenticated"}';
set local role authenticated;
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
select organization_id, project_id, building_id, 'NCR-40-1', 'ncr', 'Honeycombing column C4', 'Voids at the base', 'high', 'high', 'open',
  '00000000-0000-0000-0000-0000000040b1', 'as40-ncr-0001',
  jsonb_build_object('spec', jsonb_build_object('action_owner', 'Contractor A NV', 'action_owner_ref', 'party:' || party_a, 'target_date', '2026-12-04'))
from ids;
reset role;
select is((select count(*) from public.portal_shares where record_type = 'finding' and record_id = (select id from public.findings where finding_number = 'NCR-40-1')
    and party_id = (select party_a from ids) and audience = 'contractor' and status = 'assigned'), 1::bigint,
  'a submitted NCR is assigned to the action owner''s contractor portal');
select is((select to_char(due_at at time zone 'America/Paramaribo', 'YYYY-MM-DD HH24:MI') || ' ' || requested_action from public.portal_shares
    where record_id = (select id from public.findings where finding_number = 'NCR-40-1')), '2026-12-04 17:00 implement',
  'the target completion date is the response due date and the contractor is asked to implement');
select is((select array_agg(action) from public.portal_events where share_id = (select id from public.portal_shares where record_id = (select id from public.findings where finding_number = 'NCR-40-1'))),
  array['assign'], 'the assignment is logged as the first portal round');
select ok(exists (select 1 from public.notifications where project_id = (select project_id from ids) and recipient_user_id = '00000000-0000-0000-0000-0000000040c1'),
  'the contractor''s portal user is notified');

-- Saving again does not assign a second time.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040b1","role":"authenticated"}';
set local role authenticated;
update public.findings set title = 'Honeycombing column C4 (base)' where finding_number = 'NCR-40-1';
reset role;
select is((select count(*) from public.portal_shares where record_id = (select id from public.findings where finding_number = 'NCR-40-1')), 1::bigint,
  'a repeated save does not create a second assignment');

-- A draft is not assigned; submitting it is.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040b1","role":"authenticated"}';
set local role authenticated;
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
select organization_id, project_id, building_id, 'NCR-40-2', 'ncr', 'Cover short', 'Cover 20 mm', 'high', 'high', 'draft',
  '00000000-0000-0000-0000-0000000040b1', 'as40-ncr-0002',
  jsonb_build_object('spec', jsonb_build_object('action_owner_ref', 'party:' || party_a))
from ids;
reset role;
select is((select count(*) from public.portal_shares where record_id = (select id from public.findings where finding_number = 'NCR-40-2')), 0::bigint,
  'a draft NCR is not assigned');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040b1","role":"authenticated"}';
set local role authenticated;
update public.findings set status = 'open' where finding_number = 'NCR-40-2';
reset role;
select is((select count(*) from public.portal_shares where record_id = (select id from public.findings where finding_number = 'NCR-40-2')), 1::bigint,
  'submitting the draft assigns it');

-- An NCR owned by an internal user or the client is not sent to a contractor portal.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040b1","role":"authenticated"}';
set local role authenticated;
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
select organization_id, project_id, building_id, 'NCR-40-3', 'ncr', 'Client scope', 'Owner item', 'low', 'low', 'open',
  '00000000-0000-0000-0000-0000000040b1', 'as40-ncr-0003',
  jsonb_build_object('spec', jsonb_build_object('action_owner_ref', 'party:' || party_client))
from ids;
reset role;
select is((select count(*) from public.portal_shares where record_id = (select id from public.findings where finding_number = 'NCR-40-3')), 0::bigint,
  'an NCR owned by the client organisation is not put in a contractor portal');

-- TI issued to a contractor portal user: that organisation, with the user as contact.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040b1","role":"authenticated"}';
set local role authenticated;
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'technical_instruction', 'TI-40-1', 'Extra stirrups', 'open',
  jsonb_build_object('spec', jsonb_build_object('issued_to', 'Alex Contractor', 'issued_to_ref', 'user:00000000-0000-0000-0000-0000000040c1',
    'response_required_by', '2026-12-05', 'workflow_status', 'Open')),
  '00000000-0000-0000-0000-0000000040b1', 'as40-ti-0001' from ids;
reset role;
select is((select party_id::text || ' ' || contact_user_id::text || ' ' || requested_action from public.portal_shares
    where record_type = 'register_entry' and record_id = (select id from public.project_register_entries where entry_number = 'TI-40-1')),
  (select party_a::text from ids) || ' 00000000-0000-0000-0000-0000000040c1 acknowledge',
  'a TI is assigned to the issued-to organisation with the named portal user as contact, asking for acknowledgement');

-- Without portal.share the record is saved and nothing is assigned. (Supervisors hold it since
-- 202611240011, image 15; a custom role may not.)
delete from public.role_permissions where permission_code = 'portal.share'
  and role_id = (select id from public.roles where organization_id = (select organization_id from ids) and scope = 'project' and code = 'supervisor');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040b2","role":"authenticated"}';
set local role authenticated;
select ok(not app_private.has_project_permission((select project_id from ids), 'portal.share'), 'a role without portal.share');
reset role;
select lives_ok($$
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000040b2","role":"authenticated"}', true);
  insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
  select organization_id, project_id, building_id, 'technical_instruction', 'TI-40-2', 'Sleeve position', 'open',
    jsonb_build_object('spec', jsonb_build_object('issued_to_ref', 'party:' || party_a)),
    '00000000-0000-0000-0000-0000000040b2', 'as40-ti-0002' from ids;
$$, 'a user without portal.share still saves the TI (the assignment is left to an authorised user)');

select * from finish();
rollback;
