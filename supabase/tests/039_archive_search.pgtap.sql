begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- F04/F11: Submitted Forms is searched and paged on the server, scoped by row-level security.
select plan(10);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000039a1', 'authenticated', 'authenticated', 'admin39@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000039b1', 'authenticated', 'authenticated', 'lead39@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000039b2', 'authenticated', 'authenticated', 'super39@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000039c1', 'authenticated', 'authenticated', 'cont39@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000039d1', 'authenticated', 'authenticated', 'outsider39@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000039b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000039b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000039c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Archive Org 39', 'archive-org-39', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'archive-org-39'),
  'AR-39', 'Verify project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'AR-39';
grant select on ids to authenticated;
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000039a1' from ids;

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000039c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000039b1'::uuid), ('00000000-0000-0000-0000-0000000039b2'::uuid), ('00000000-0000-0000-0000-0000000039c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000039b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000039b2' then 'supervisor'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

-- 1,205 register entries (more than the API's 1,000-row response cap), 3 NCRs, one with an action.
set local request.jwt.claims = '{}';
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, occurred_at, details, created_by, idempotency_key)
select organization_id, project_id, building_id, case when n % 5 = 0 then 'change_order' else 'works_ongoing' end, 'WO-39-' || lpad(n::text, 4, '0'),
  'Entry ' || n, 'open', timestamptz '2026-01-01 12:00' + (n || ' hours')::interval,
  jsonb_build_object('spec', jsonb_build_object('discipline', case when n % 2 = 0 then 'Surveying & Setting Out' else 'Concrete & Reinforced Concrete' end)),
  '00000000-0000-0000-0000-0000000039b1', 'wo39-entry-' || lpad(n::text, 6, '0')
from ids, generate_series(1, 1205) n;
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
select organization_id, project_id, building_id, 'NCR-39-' || n, 'ncr', 'Honeycombing ' || n, 'Column C' || n, 'medium', 'normal', 'open', '00000000-0000-0000-0000-0000000039b1', 'ncr39-entry-' || lpad(n::text, 6, '0'),
  jsonb_build_object('spec', jsonb_build_object('responsible_person', case when n = 1 then 'Mira Mason' else 'Other Person' end))
from ids, generate_series(1, 3) n;
insert into public.actions (organization_id, project_id, building_id, action_number, title, source_type, source_id, created_by, idempotency_key)
select organization_id, project_id, building_id, 'ACT-39-1', 'Repair honeycombing', 'finding', (select id from public.findings where finding_number = 'NCR-39-1'), '00000000-0000-0000-0000-0000000039b1', 'act39-entry-000001'
from ids;

create temporary table pages (page integer, record_id text, at timestamptz, total bigint);
grant all on pages to authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039b2","role":"authenticated"}';
set local role authenticated;

-- Page through all register entries 500 at a time with the keyset cursor.
insert into pages select 1, record_id, at, total_count from public.search_project_archive((select project_id from ids), p_kind => 'register', p_limit => 500);
insert into pages select 2, a.record_id, a.at, a.total_count from public.search_project_archive((select project_id from ids), p_kind => 'register', p_limit => 500,
  p_before_at => (select at from pages where page = 1 order by at, record_id limit 1), p_before_id => (select record_id from pages where page = 1 order by at, record_id limit 1)) a;
insert into pages select 3, a.record_id, a.at, a.total_count from public.search_project_archive((select project_id from ids), p_kind => 'register', p_limit => 500,
  p_before_at => (select at from pages where page = 2 order by at, record_id limit 1), p_before_id => (select record_id from pages where page = 2 order by at, record_id limit 1)) a;

select is((select max(total) from pages), 1205::bigint, 'the total counts every match past the 1,000-row API cap');
select is((select count(distinct record_id) from pages), 1205::bigint, 'three keyset pages return every register entry once');
select is((select count(*) from pages), 1205::bigint, 'no entry appears twice');
select is((select count(*) from public.search_project_archive((select project_id from ids), p_kind => 'register:change_order', p_limit => 500)), 241::bigint,
  'a register subtype filters on the server');
select is((select max(total_count) from public.search_project_archive((select project_id from ids), p_discipline => 'Surveying & Setting Out', p_limit => 1)), 602::bigint,
  'the discipline filter reads the form''s own discipline');
select is((select array_agg(code) from public.search_project_archive((select project_id from ids), p_linked_action => true)), array['NCR-39-1'],
  'the linked-action filter finds the record behind an action');
select is((select array_agg(code) from public.search_project_archive((select project_id from ids), p_responsible => 'mira')), array['NCR-39-1'],
  'the responsible-person filter');
select is((select array_agg(code) from public.search_project_archive((select project_id from ids), p_query => 'ncr392')), array['NCR-39-2'],
  'a record number typed without punctuation finds the record');
select is((select code from public.search_project_archive((select project_id from ids), p_kind => 'register', p_limit => 1)), 'WO-39-1205', 'newest first');
reset role;

-- Someone outside the project sees nothing.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000039d1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.search_project_archive((select project_id from ids))), 0::bigint, 'a user outside the project gets no archive rows');
reset role;

select * from finish();
rollback;
