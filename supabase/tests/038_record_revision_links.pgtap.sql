begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- F11: Technical Instructions and Change Orders link to an exact document revision.
select plan(9);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000038a1', 'authenticated', 'authenticated', 'admin38@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000038b1', 'authenticated', 'authenticated', 'lead38@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000038b2', 'authenticated', 'authenticated', 'super38@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000038c1', 'authenticated', 'authenticated', 'cont38@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000038b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000038b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000038c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000038a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Links Org 38', 'links-org-38', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'links-org-38'),
  'RL-38', 'Verify project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'RL-38';
grant select on ids to authenticated;
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000038a1' from ids;

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000038c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000038b1'::uuid), ('00000000-0000-0000-0000-0000000038b2'::uuid), ('00000000-0000-0000-0000-0000000038c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000038b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000038b2' then 'supervisor'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

set local request.jwt.claims = '{}';
-- Files for three revisions in this project and one in another project of the organisation.
insert into public.files (id, organization_id, project_id, original_name, mime_type, size_bytes, sha256, status, category, storage_provider, storage_object_key, created_by)
select file.id, ids.organization_id, ids.project_id, file.name, 'application/pdf', 100, repeat('c', 64), 'available', 'drawing', 'vercel_blob', 'test/' || file.id, '00000000-0000-0000-0000-0000000038b1'
from ids, (values
  ('00000000-0000-0000-0000-00000038f001'::uuid, 'S-101 rev A.pdf'),
  ('00000000-0000-0000-0000-00000038f002'::uuid, 'S-101 rev B.pdf'),
  ('00000000-0000-0000-0000-00000038f003'::uuid, 'S-102 rev A.pdf')
) file(id, name);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000038a1","role":"authenticated"}';
set local role authenticated;
select public.create_project_workspace((select organization_id from ids), 'RL-38B', 'Other project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';
insert into public.files (id, organization_id, project_id, original_name, mime_type, size_bytes, sha256, status, category, storage_provider, storage_object_key, created_by)
select '00000000-0000-0000-0000-00000038f009', organization_id, id, 'X-1 rev A.pdf', 'application/pdf', 100, repeat('d', 64), 'available', 'drawing', 'vercel_blob', 'test/x1', '00000000-0000-0000-0000-0000000038a1'
from public.projects where code = 'RL-38B';

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000038a1","role":"authenticated"}';
set local role authenticated;
select public.register_project_document((select id from public.projects where code = 'RL-38B'), 'X-1', 'Other plan', '01', 'Structural', 'drawing',
  null, 'Designer BV', array[]::uuid[], null, 'A', 'submitted', current_date, null, null, '00000000-0000-0000-0000-00000038f009');
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000038b1","role":"authenticated"}';
set local role authenticated;
select public.register_project_document((select project_id from ids), 'S-101', 'Foundation plan', '01', 'Structural', 'drawing',
  null, 'Designer BV', array[(select building_id from ids)], null, 'A', 'submitted', current_date, null, null, '00000000-0000-0000-0000-00000038f001');
select public.set_project_document_revision_status((select current_revision_id from public.project_documents where document_number = 'S-101'), 'approved', 'ok');
select public.add_project_document_revision((select id from public.project_documents where document_number = 'S-101'), 'B',
  '00000000-0000-0000-0000-00000038f002', 'submitted', current_date, null, null);
select public.register_project_document((select project_id from ids), 'S-102', 'Column schedule', '01', 'Structural', 'drawing',
  null, 'Designer BV', array[(select building_id from ids)], null, 'A', 'submitted', current_date, null, null, '00000000-0000-0000-0000-00000038f003');
reset role;

create temporary table revs on commit drop as
select (select id from public.project_document_revisions where revision = 'A' and document_id = (select id from public.project_documents where document_number = 'S-101')) as s101_a,
       (select id from public.project_document_revisions where revision = 'B' and document_id = (select id from public.project_documents where document_number = 'S-101')) as s101_b;
grant select on revs to authenticated;
create temporary table foreign_rev on commit drop as
select revision.id from public.project_document_revisions revision join public.project_documents document on document.id = revision.document_id where document.document_number = 'X-1';
grant select on foreign_rev to authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000038b1","role":"authenticated"}';
set local role authenticated;
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'technical_instruction', 'TI-38-1', 'Extra stirrups', 'open',
  jsonb_build_object('spec', jsonb_build_object('drawing_reference', 'S-101 rev A', 'drawing_reference_ref', 'revision:' || (select s101_a from revs))),
  '00000000-0000-0000-0000-0000000038b1', 'ti38-entry-0001' from ids;

select is((select array[record_code, source_field, revision_id::text] from public.project_document_links where record_id = (select id from public.project_register_entries where entry_number = 'TI-38-1')),
  array['TI-38-1', 'drawing_reference', (select s101_a::text from revs)],
  'the instruction is linked to the exact revision it refers to');

update public.project_register_entries set details = jsonb_set(jsonb_set(details, '{spec,drawing_reference}', '"S-101 rev B"'),
  '{spec,drawing_reference_ref}', to_jsonb('revision:' || (select s101_b from revs))) where entry_number = 'TI-38-1';
select is((select array_agg(revision_id::text) from public.project_document_links where record_id = (select id from public.project_register_entries where entry_number = 'TI-38-1')),
  array[(select s101_b::text from revs)], 'choosing revision B moves the one link to B');

select public.link_project_document((select id from public.project_documents where document_number = 'S-102'), 'register_entry',
  (select id from public.project_register_entries where entry_number = 'TI-38-1'), 'TI-38-1');
update public.project_register_entries set details = details #- '{spec,drawing_reference_ref}' #- '{spec,drawing_reference}' where entry_number = 'TI-38-1';
select is((select array_agg(document_id) from public.project_document_links where record_id = (select id from public.project_register_entries where entry_number = 'TI-38-1')),
  array[(select id from public.project_documents where document_number = 'S-102')],
  'removing the reference drops its link; a link made by hand in the register stays');

select throws_ok(
  $$insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
    select organization_id, project_id, building_id, 'change_order', 'CO-38-1', 'Wrong project', 'open',
      jsonb_build_object('spec', jsonb_build_object('drawing_reference', 'X-1 rev A', 'drawing_reference_ref', 'revision:' || (select id from foreign_rev))),
      '00000000-0000-0000-0000-0000000038b1', 'co38-entry-0001' from ids$$,
  '22023', 'The document revision referenced in drawing_reference is not in this project',
  'a revision of another project cannot be referenced');

select lives_ok(
  $$insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
    select organization_id, project_id, building_id, 'change_order', 'CO-38-2', 'Typed reference', 'open',
      jsonb_build_object('spec', jsonb_build_object('drawing_reference', 'Consultant sketch SK-4 rev 2')), '00000000-0000-0000-0000-0000000038b1', 'co38-entry-0002' from ids$$,
  'a reference typed by hand (not in the register) is kept as text');
select is((select count(*) from public.project_document_links where record_code = 'CO-38-2'), 0::bigint, 'and has no register link');
select is((select count(*) from public.project_document_revisions where document_id = (select id from public.project_documents where document_number = 'S-101')), 2::bigint,
  'both revisions stay in the register');

-- Workbook NCR row 10 / Word 15: an NCR's requirement reference links to the exact revision.
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
select organization_id, project_id, building_id, 'NCR-38-1', 'ncr', 'Cover too small', 'Cover 20 mm where S-101 requires 35 mm', 'high', 'high', 'open',
  '00000000-0000-0000-0000-0000000038b1', 'ncr38-0001',
  jsonb_build_object('spec', jsonb_build_object('requirement_reference', 'S-101 rev A', 'requirement_reference_ref', 'revision:' || (select s101_a from revs)))
from ids;
select is((select array[record_type, record_code, source_field, revision_id::text] from public.project_document_links where record_id = (select id from public.findings where finding_number = 'NCR-38-1')),
  array['finding', 'NCR-38-1', 'requirement_reference', (select s101_a::text from revs)],
  'an NCR requirement reference is linked to the exact revision');
select throws_ok(
  $$insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key, issue_management)
    select organization_id, project_id, building_id, 'NCR-38-2', 'ncr', 'Wrong project', 'Cover measured against another project', 'low', 'low', 'open', '00000000-0000-0000-0000-0000000038b1', 'ncr38-0002',
      jsonb_build_object('spec', jsonb_build_object('requirement_reference_ref', 'revision:' || (select id from foreign_rev))) from ids$$,
  '22023', 'The document revision referenced in requirement_reference is not in this project',
  'an NCR cannot reference a revision of another project');
reset role;

select * from finish();
rollback;
