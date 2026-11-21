begin;
set local search_path = extensions, pgtap, public;

-- F15 (client-spec audit): approved document revisions reach a portal only through a deliberate,
-- audited release; drafts, submitted and rejected revisions, notes and review comments stay internal.
set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;
select plan(28);

-- Functional requirements FINAL: Project Documents register, Contractor Portal, Client Portal
-- and the data separation of sections 8, 19 and 23.

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000033a1', 'authenticated', 'authenticated', 'admin33@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000033b1', 'authenticated', 'authenticated', 'lead33@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000033b2', 'authenticated', 'authenticated', 'super33@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000033c1', 'authenticated', 'authenticated', 'conta33@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000033c2', 'authenticated', 'authenticated', 'contb33@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000033c3', 'authenticated', 'authenticated', 'contro33@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000033d1', 'authenticated', 'authenticated', 'clientv33@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000033d2', 'authenticated', 'authenticated', 'clienta33@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000033b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000033b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000033c1', 'Alex Contractor A'),
  ('00000000-0000-0000-0000-0000000033c2', 'Bo Contractor B'),
  ('00000000-0000-0000-0000-0000000033c3', 'Rory Read-only A'),
  ('00000000-0000-0000-0000-0000000033d1', 'Vera Client Viewer'),
  ('00000000-0000-0000-0000-0000000033d2', 'Arno Client Approver')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Release Org 33', 'release-org-33', 'Ada Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'release-org-33'),
  'RO-33', 'Portal project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
reset role;

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'RO-33';
grant select on ids to authenticated;

-- Parties: two contractors and the client organisation.
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, code, name, party_type, '00000000-0000-0000-0000-0000000033a1'
from ids, (values ('CA', 'Contractor A NV', 'contractor'), ('CB', 'Contractor B NV', 'contractor'), ('CL', 'Employer NV', 'client')) party(code, name, party_type);
alter table ids add column party_a uuid, add column party_b uuid, add column party_client uuid;
update ids set
  party_a = (select id from public.parties where code = 'CA' and project_id = ids.project_id),
  party_b = (select id from public.parties where code = 'CB' and project_id = ids.project_id),
  party_client = (select id from public.parties where code = 'CL' and project_id = ids.project_id);

insert into public.project_memberships (organization_id, project_id, user_id, status)
select ids.organization_id, ids.project_id, member.id, 'active'
from ids, (values ('00000000-0000-0000-0000-0000000033b1'::uuid), ('00000000-0000-0000-0000-0000000033b2'::uuid),
  ('00000000-0000-0000-0000-0000000033c1'::uuid), ('00000000-0000-0000-0000-0000000033c2'::uuid), ('00000000-0000-0000-0000-0000000033c3'::uuid),
  ('00000000-0000-0000-0000-0000000033d1'::uuid), ('00000000-0000-0000-0000-0000000033d2'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000033b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000033b2' then 'supervisor'
    when '00000000-0000-0000-0000-0000000033c1' then 'contractor_representative'
    when '00000000-0000-0000-0000-0000000033c2' then 'contractor_representative'
    when '00000000-0000-0000-0000-0000000033c3' then 'contractor_readonly'
    when '00000000-0000-0000-0000-0000000033d1' then 'client_viewer'
    else 'client_approver' end
where membership.project_id = (select project_id from ids);

-- Only an administrator links a portal user to an organisation.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033b1","role":"authenticated"}';
set local role authenticated;
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033a1","role":"authenticated"}';
set local role authenticated;
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000033c1', (select party_a from ids));
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000033c2', (select party_b from ids));
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000033c3', (select party_a from ids));
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000033d1', (select party_client from ids));
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000033d2', (select party_client from ids));
reset role;

set local request.jwt.claims = '{}';
-- Files: a drawing, an internal photo, a report PDF (all CODECO's).
insert into public.files (id, organization_id, project_id, original_name, mime_type, size_bytes, sha256, status, category, storage_provider, storage_object_key, created_by)
select file.id, ids.organization_id, ids.project_id, file.name, 'application/pdf', 100, repeat('a', 64), 'available', file.category, 'vercel_blob', 'test/' || file.id, '00000000-0000-0000-0000-0000000033b1'
from ids, (values
  ('00000000-0000-0000-0000-00000033f001'::uuid, 'A-101 rev A.pdf', 'drawing'),
  ('00000000-0000-0000-0000-00000033f002'::uuid, 'A-101 rev B.pdf', 'drawing'),
  ('00000000-0000-0000-0000-00000033f003'::uuid, 'A-201 rev C.pdf', 'drawing'),
  ('00000000-0000-0000-0000-00000033f004'::uuid, 'Weekly report W47.pdf', 'report'),
  ('00000000-0000-0000-0000-00000033f005'::uuid, 'Weekly report W47 reissue.pdf', 'report'),
  ('00000000-0000-0000-0000-00000033f006'::uuid, 'NCR photo.jpg', 'photo')
) file(id, name, category);
-- Contractor A's own evidence upload.
insert into public.files (id, organization_id, project_id, original_name, mime_type, size_bytes, sha256, status, category, storage_provider, storage_object_key, created_by)
select '00000000-0000-0000-0000-00000033f0a1', organization_id, project_id, 'repair.jpg', 'image/jpeg', 100, repeat('b', 64), 'available', 'evidence', 'vercel_blob', 'test/a1', '00000000-0000-0000-0000-0000000033c1'
from ids;


-- Document A-201: revision A approved, then B submitted, B rejected, C approved (F09/F15 scenario).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033b1","role":"authenticated"}';
set local role authenticated;
select public.register_project_document((select project_id from ids), 'A-201', 'Roof plan', '01', 'Architectural', 'drawing',
  null, 'Designer BV', array[(select building_id from ids)], null, 'A', 'submitted', current_date, 'TR-001', 'internal note A', '00000000-0000-0000-0000-00000033f001');
select public.set_project_document_revision_status((select current_revision_id from public.project_documents where document_number = 'A-201'), 'approved', 'internal comment A');
select lives_ok(
  $$select public.share_to_portal((select project_id from ids), 'contractor', (select party_a from ids), 'document',
    (select id from public.project_documents where document_number = 'A-201'), 'Roof plan', null, 'information', 'normal', null, null, null)$$,
  'sharing a document with an approved current revision releases that revision');
select is((select count(*) from public.portal_document_releases where withdrawn_at is null), 1::bigint, 'the share creates exactly one release');
select is((select array_agg(action order by sequence) from public.project_document_events where action = 'release'), array['release'],
  'the release is in the document history');
select public.add_project_document_revision((select id from public.project_documents where document_number = 'A-201'), 'B',
  '00000000-0000-0000-0000-00000033f002', 'submitted', current_date, 'TR-002', 'internal note B');
select is((select count(*) from public.portal_share_files where file_id = '00000000-0000-0000-0000-00000033f002'), 0::bigint,
  'uploading a revision does not attach it to the existing share');
select throws_ok(
  $$select public.release_document_revision((select id from public.portal_shares where record_type = 'document'),
    (select id from public.project_document_revisions where revision = 'B'))$$,
  '55000', null, 'a submitted revision cannot be released');
select throws_ok(
  $$select public.review_portal_share((select id from public.portal_shares where record_type = 'document'), 'add_files', null,
    array['00000000-0000-0000-0000-00000033f002'::uuid])$$,
  '42501', null, 'the generic add-files step cannot attach an unreleased revision file to a document share');
select throws_ok(
  $$select public.share_to_portal((select project_id from ids), 'contractor', (select party_b from ids), 'document',
    (select id from public.project_documents where document_number = 'A-201'), 'Roof plan', null, 'information', 'normal', null, null, null)$$,
  '55000', null, 'with the only approved revision superseded by one under review, there is nothing to release to a new party');
reset role;

-- Contractor A while B is under review.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033c1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.project_document_revisions), 0::bigint,
  'a portal user cannot read revision rows directly, so notes and review comments stay internal');
select is((select array_agg(revision) from public.portal_document_revisions((select project_id from ids))), array['A'],
  'the portal shows only the released revision');
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000033f001'), 1::bigint, 'contractor A reads the released file');
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000033f002'), 0::bigint, 'contractor A cannot read the submitted revision file');
reset role;

-- Contractor B (unrelated party) sees nothing.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033c2","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.portal_document_revisions((select project_id from ids))), 0::bigint, 'an unrelated contractor sees no released revision');
select is((select count(*) from public.files where id in ('00000000-0000-0000-0000-00000033f001','00000000-0000-0000-0000-00000033f002')), 0::bigint,
  'an unrelated contractor reads no document file');
reset role;

-- B rejected; C uploaded and issued for construction; C released deliberately.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033b1","role":"authenticated"}';
set local role authenticated;
select public.set_project_document_revision_status((select id from public.project_document_revisions where revision = 'B'), 'rejected', 'Wrong grid');
select public.add_project_document_revision((select id from public.project_documents where document_number = 'A-201'), 'C',
  '00000000-0000-0000-0000-00000033f003', 'submitted', current_date, 'TR-003', null);
select public.set_project_document_revision_status((select id from public.project_document_revisions where revision = 'C'), 'for_construction', null);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033b2","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.release_document_revision((select id from public.portal_shares where record_type = 'document'),
    (select id from public.project_document_revisions where revision = 'C'))$$,
  '42501', null, 'a role without portal.share cannot release');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033b1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.release_document_revision((select id from public.portal_shares where record_type = 'document'),
    (select id from public.project_document_revisions where revision = 'C'), 'Issued for construction')$$,
  'the lead supervisor releases approved revision C');
select throws_ok(
  $$select public.release_document_revision((select id from public.portal_shares where record_type = 'document'),
    (select id from public.project_document_revisions where revision = 'C'))$$,
  '23505', null, 'a revision is released once per share');
select is(
  (select array_agg(action order by sequence) from public.portal_events where share_id = (select id from public.portal_shares where record_type = 'document')),
  array['assign','release'], 'the portal history records the deliberate release');
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033c1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000033f003'), 1::bigint, 'contractor A reads the released revision C');
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000033f002'), 0::bigint, 'the rejected revision stays private');
reset role;

-- Withdrawal: the file stops being readable, the history stays.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033b1","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.withdraw_document_release((select id from public.portal_document_releases where revision_id = (select id from public.project_document_revisions where revision = 'C')), '')$$,
  '22023', null, 'a withdrawal needs a reason');
select lives_ok(
  $$select public.withdraw_document_release((select id from public.portal_document_releases where revision_id = (select id from public.project_document_revisions where revision = 'C')), 'Issued in error')$$,
  'the lead supervisor withdraws the release of C');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033c1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000033f003'), 0::bigint, 'after withdrawal contractor A cannot read C');
select is((select count(*) from public.portal_events where action in ('release','withdraw_release')), 2::bigint,
  'contractor A still sees the release and the withdrawal in the history');
reset role;
select is((select count(*) from public.portal_document_releases), 2::bigint, 'withdrawn releases are kept');
select throws_ok($$delete from public.portal_document_releases$$, '55000', null, 'releases cannot be deleted');
select throws_ok($$update public.portal_document_releases set released_at = now()$$, '55000', null, 'a release is never edited');

-- Legacy: a file auto-distributed before this change, outside any release, is not readable externally.
alter table public.portal_share_files disable trigger portal_share_files_document_release;
insert into public.portal_share_files (share_id, organization_id, project_id, file_id, source, added_by)
select share.id, share.organization_id, share.project_id, '00000000-0000-0000-0000-00000033f002', 'shared', '00000000-0000-0000-0000-0000000033b1'
from public.portal_shares share where share.record_type = 'document';
alter table public.portal_share_files enable trigger portal_share_files_document_release;
select is((select count(*) from app_private.legacy_unreleased_document_files where file_id = '00000000-0000-0000-0000-00000033f002'), 1::bigint,
  'a legacy unreleased attachment is listed for review');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000033c1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000033f002'), 0::bigint,
  'a legacy unreleased attachment is not readable by the portal party');
reset role;

select * from finish();
rollback;
