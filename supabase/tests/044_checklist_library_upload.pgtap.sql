begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Developer package v5 (25-11-2026), Word 3 / 13: the Project Admin uploads own checklists, versioned.
select plan(10);

select has_function('public', 'upload_project_checklist', 'a checklist is uploaded through one function');

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000044a1', 'authenticated', 'authenticated', 'admin44@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000044c1', 'authenticated', 'authenticated', 'cont44@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000044c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000044a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Checklist Org 44', 'checklist-org-44', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'checklist-org-44'),
  'CL-44', 'Checklist project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id from public.projects project where project.code = 'CL-44';
grant select on ids to authenticated;

insert into public.project_memberships (organization_id, project_id, user_id, status)
select ids.organization_id, ids.project_id, '00000000-0000-0000-0000-0000000044c1'::uuid, 'active' from ids;
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = 'contractor_representative'
where membership.project_id = (select project_id from ids) and membership.user_id = '00000000-0000-0000-0000-0000000044c1';

-- The administrator uploads version 1.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000044a1","role":"authenticated"}';
set local role authenticated;
create temporary table uploaded (id uuid, version integer, status text);
grant all on uploaded to authenticated;
insert into uploaded
select template.id, template.version_number, template.status
from public.upload_project_checklist((select project_id from ids), 'inspection', ' cl-rebar ', 'Rebar check',
  '[{"section":"Before pour","prompt":"Cover blocks are in place","required":true,"guidance":"Minimum 40 mm"},
    {"section":"Before pour","prompt":"Lap length is checked","response_type":"pass_fail_na"}]'::jsonb) template;
select is((select version || '/' || status from uploaded), '1/published', 'a new code starts at version 1, published');
select is((select count(*)::integer from public.checklist_items where template_id = (select id from uploaded)), 2, 'every uploaded row becomes an item');
select is(
  (select code from public.checklist_templates where id = (select id from uploaded)),
  'CL-REBAR', 'the code is stored in capitals');

-- Version 2 of the same code retires version 1; version 1 keeps its items.
create temporary table second (id uuid, version integer);
grant all on second to authenticated;
insert into second
select template.id, template.version_number
from public.upload_project_checklist((select project_id from ids), 'inspection', 'CL-REBAR', 'Rebar check',
  '[{"section":"Before pour","prompt":"Cover blocks are in place"},{"section":"After pour","prompt":"Surface is closed"},{"section":"After pour","prompt":"No honeycombing"}]'::jsonb) template;
select is((select version from second), 2, 'the next upload of the same code is version 2');
select is((select status from public.checklist_templates where id = (select id from uploaded)), 'retired', 'the previous version is retired');
select is((select count(*)::integer from public.checklist_items where template_id = (select id from uploaded)), 2, 'the retired version keeps its items');

-- Bad uploads are refused.
select throws_ok(
  $$select public.upload_project_checklist((select project_id from ids), 'weather', 'CL-X', 'Bad module', '[{"prompt":"Some prompt"}]'::jsonb)$$,
  '22023', null, 'an unknown module is refused');
select throws_ok(
  $$select public.upload_project_checklist((select project_id from ids), 'inspection', 'CL-X', 'Empty', '[]'::jsonb)$$,
  '22023', null, 'a checklist without items is refused');
reset role;

-- A contractor cannot upload checklists.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000044c1","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.upload_project_checklist((select project_id from ids), 'inspection', 'CL-Y', 'Not allowed', '[{"prompt":"Some prompt"}]'::jsonb)$$,
  '42501', null, 'a contractor representative cannot upload a checklist');
reset role;

select * from finish();
rollback;
