begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Functional requirements FINAL: Project Documents register, Contractor Portal, Client Portal
-- and the data separation of sections 8, 19 and 23.
select plan(55);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000031a1', 'authenticated', 'authenticated', 'admin31@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000031b1', 'authenticated', 'authenticated', 'lead31@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000031b2', 'authenticated', 'authenticated', 'super31@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000031c1', 'authenticated', 'authenticated', 'conta31@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000031c2', 'authenticated', 'authenticated', 'contb31@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000031c3', 'authenticated', 'authenticated', 'contro31@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000031d1', 'authenticated', 'authenticated', 'clientv31@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000031d2', 'authenticated', 'authenticated', 'clienta31@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000031b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000031b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000031c1', 'Alex Contractor A'),
  ('00000000-0000-0000-0000-0000000031c2', 'Bo Contractor B'),
  ('00000000-0000-0000-0000-0000000031c3', 'Rory Read-only A'),
  ('00000000-0000-0000-0000-0000000031d1', 'Vera Client Viewer'),
  ('00000000-0000-0000-0000-0000000031d2', 'Arno Client Approver')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Portal Org 31', 'portal-org-31', 'Ada Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'portal-org-31'),
  'PO-31', 'Portal project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
reset role;

select is(
  (select count(*) from public.roles where organization_id = (select id from public.organizations where slug = 'portal-org-31')
    and code in ('contractor_admin','contractor_representative','contractor_readonly','client_viewer','client_reviewer','client_approver','client_admin')),
  7::bigint,
  'a new organisation has the seven portal roles'
);
select is(
  (select array_agg(grant_row.permission_code::text order by grant_row.permission_code) from public.role_permissions grant_row
   join public.roles role on role.id = grant_row.role_id
   where role.code = 'client_approver' and role.organization_id = (select id from public.organizations where slug = 'portal-org-31')),
  array['portal.client','portal.client.approve','portal.client.review'],
  'a client approver holds the client portal, review and approval only'
);
select ok(
  not exists (select 1 from public.role_permissions grant_row join public.roles role on role.id = grant_row.role_id
    where role.code = 'contractor' and grant_row.permission_code in ('files.read','files.manage')),
  'the legacy contractor role no longer reads or edits every project file'
);

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'PO-31';
grant select on ids to authenticated;

-- Parties: two contractors and the client organisation.
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, code, name, party_type, '00000000-0000-0000-0000-0000000031a1'
from ids, (values ('CA', 'Contractor A NV', 'contractor'), ('CB', 'Contractor B NV', 'contractor'), ('CL', 'Employer NV', 'client')) party(code, name, party_type);
alter table ids add column party_a uuid, add column party_b uuid, add column party_client uuid;
update ids set
  party_a = (select id from public.parties where code = 'CA' and project_id = ids.project_id),
  party_b = (select id from public.parties where code = 'CB' and project_id = ids.project_id),
  party_client = (select id from public.parties where code = 'CL' and project_id = ids.project_id);

insert into public.project_memberships (organization_id, project_id, user_id, status)
select ids.organization_id, ids.project_id, member.id, 'active'
from ids, (values ('00000000-0000-0000-0000-0000000031b1'::uuid), ('00000000-0000-0000-0000-0000000031b2'::uuid),
  ('00000000-0000-0000-0000-0000000031c1'::uuid), ('00000000-0000-0000-0000-0000000031c2'::uuid), ('00000000-0000-0000-0000-0000000031c3'::uuid),
  ('00000000-0000-0000-0000-0000000031d1'::uuid), ('00000000-0000-0000-0000-0000000031d2'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000031b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000031b2' then 'supervisor'
    when '00000000-0000-0000-0000-0000000031c1' then 'contractor_representative'
    when '00000000-0000-0000-0000-0000000031c2' then 'contractor_representative'
    when '00000000-0000-0000-0000-0000000031c3' then 'contractor_readonly'
    when '00000000-0000-0000-0000-0000000031d1' then 'client_viewer'
    else 'client_approver' end
where membership.project_id = (select project_id from ids);

-- Only an administrator links a portal user to an organisation.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031b1","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000031c1', (select party_a from ids))$$,
  '42501', null,
  'a lead supervisor cannot link portal users'
);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($$select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000031c1', (select party_a from ids))$$,
  'the administrator links contractor A''s user');
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000031c2', (select party_b from ids));
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000031c3', (select party_a from ids));
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000031d1', (select party_client from ids));
select public.set_project_member_portal_party((select project_id from ids), '00000000-0000-0000-0000-0000000031d2', (select party_client from ids));
reset role;

set local request.jwt.claims = '{}';
-- Files: a drawing, an internal photo, a report PDF (all CODECO's).
insert into public.files (id, organization_id, project_id, original_name, mime_type, size_bytes, sha256, status, category, storage_provider, storage_object_key, created_by)
select file.id, ids.organization_id, ids.project_id, file.name, 'application/pdf', 100, repeat('a', 64), 'available', file.category, 'vercel_blob', 'test/' || file.id, '00000000-0000-0000-0000-0000000031b1'
from ids, (values
  ('00000000-0000-0000-0000-00000031f001'::uuid, 'A-101 rev A.pdf', 'drawing'),
  ('00000000-0000-0000-0000-00000031f002'::uuid, 'A-101 rev B.pdf', 'drawing'),
  ('00000000-0000-0000-0000-00000031f003'::uuid, 'internal photo.jpg', 'photo'),
  ('00000000-0000-0000-0000-00000031f004'::uuid, 'Weekly report W47.pdf', 'report'),
  ('00000000-0000-0000-0000-00000031f005'::uuid, 'Weekly report W47 reissue.pdf', 'report'),
  ('00000000-0000-0000-0000-00000031f006'::uuid, 'NCR photo.jpg', 'photo')
) file(id, name, category);
-- Contractor A's own evidence upload.
insert into public.files (id, organization_id, project_id, original_name, mime_type, size_bytes, sha256, status, category, storage_provider, storage_object_key, created_by)
select '00000000-0000-0000-0000-00000031f0a1', organization_id, project_id, 'repair.jpg', 'image/jpeg', 100, repeat('b', 64), 'available', 'evidence', 'vercel_blob', 'test/a1', '00000000-0000-0000-0000-0000000031c1'
from ids;

-- An NCR in the workspace.
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key)
select organization_id, project_id, building_id, 'NCR-31-001', 'ncr', 'Honeycombing column C4', 'Internal assessment: likely poor vibration', 'high', 'high', 'open', '00000000-0000-0000-0000-0000000031b1', 'po31-ncr-1'
from ids;

-- 1. Project Documents register ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031b2","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.register_project_document((select project_id from ids), 'A-101', 'Ground floor plan', '01', 'Architectural', 'drawing',
    null, null, array[(select building_id from ids)], null, 'A', 'for_construction', current_date, 'TR-001', null, '00000000-0000-0000-0000-00000031f001')$$,
  '42501', null,
  'an uploaded drawing is not issued for construction by a supervisor without review rights'
);
select lives_ok(
  $$select public.register_project_document((select project_id from ids), 'A-101', 'Ground floor plan', '01', 'Architectural', 'drawing',
    null, 'Designer BV', array[(select building_id from ids)], null, 'A', 'submitted', current_date, 'TR-001', null, '00000000-0000-0000-0000-00000031f001')$$,
  'a supervisor registers a drawing as submitted'
);
select throws_ok(
  $$select public.register_project_document((select project_id from ids), 'a-101', 'Duplicate', '01', null, null, null, null, null, null, 'A', 'submitted', null, null, null, '00000000-0000-0000-0000-00000031f002')$$,
  '23505', null,
  'a document number is unique within the project'
);
select throws_ok(
  $$select public.set_project_document_revision_status((select current_revision_id from public.project_documents where document_number = 'A-101'), 'approved', null)$$,
  '42501', null,
  'only an authorised reviewer changes the review status'
);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031b1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.set_project_document_revision_status((select current_revision_id from public.project_documents where document_number = 'A-101'), 'for_construction', null)$$,
  'the lead supervisor issues revision A for construction'
);
select lives_ok(
  $$select public.add_project_document_revision((select id from public.project_documents where document_number = 'A-101'), 'B', '00000000-0000-0000-0000-00000031f002', 'submitted', current_date, 'TR-002', 'Grid 4 revised')$$,
  'a new revision is uploaded'
);
select is(
  (select count(*) from public.project_document_revisions where document_id = (select id from public.project_documents where document_number = 'A-101')),
  2::bigint,
  'uploading a revision does not delete or overwrite the earlier one'
);
select is(
  (select review_status from public.project_document_revisions where revision = 'A'),
  'superseded',
  'the earlier revision is marked superseded'
);
select is(
  (select superseded_by from public.project_document_revisions where revision = 'A'),
  (select id from public.project_document_revisions where revision = 'B'),
  'the superseded revision links to the revision that replaces it'
);
select is(
  (select current_revision_id from public.project_documents where document_number = 'A-101'),
  (select id from public.project_document_revisions where revision = 'B'),
  'the new revision is the current one'
);
select throws_ok(
  $$select public.add_project_document_revision((select id from public.project_documents where document_number = 'A-101'), 'b', '00000000-0000-0000-0000-00000031f002', 'submitted', null, null, null)$$,
  '23505', null,
  'a revision mark is not reused'
);
select is(
  (select array_agg(action order by sequence) from public.project_document_events where document_id = (select id from public.project_documents where document_number = 'A-101')),
  array['register','status','supersede','revision'],
  'every register step is in the document history'
);
reset role;
select throws_ok(
  $$update public.project_document_events set comment = 'changed'$$,
  '55000', null,
  'document events are append-only'
);

-- 2. Contractor Portal -----------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031b2","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.share_to_portal((select project_id from ids), 'contractor', (select party_a from ids), 'finding',
    (select id from public.findings where finding_number = 'NCR-31-001'), 'NCR honeycombing', 'Submit cause and corrective action',
    'propose', 'high', now() + interval '3 days', null, null)$$,
  '42501', null,
  'a supervisor without portal rights cannot assign to a contractor'
);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031b1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.share_to_portal((select project_id from ids), 'contractor', (select party_a from ids), 'finding',
    (select id from public.findings where finding_number = 'NCR-31-001'), 'NCR honeycombing column C4', 'Submit cause analysis and corrective action plan.',
    'propose', 'high', now() + interval '3 days', array['00000000-0000-0000-0000-00000031f006'::uuid], null)$$,
  'the lead supervisor assigns the NCR to contractor A with one photo'
);
select throws_ok(
  $$select public.share_to_portal((select project_id from ids), 'contractor', (select party_a from ids), 'finding',
    (select id from public.findings where finding_number = 'NCR-31-001'), 'Again', null, 'propose', 'high', null, null, null)$$,
  '23505', null,
  'one record is not assigned twice to the same organisation'
);
select throws_ok(
  $$select public.share_to_portal((select project_id from ids), 'client', (select party_a from ids), 'finding',
    (select id from public.findings where finding_number = 'NCR-31-001'), 'Wrong portal', null, 'information', 'normal', null, null, null)$$,
  '22023', null,
  'the client portal only takes a client organisation'
);
reset role;
select is(
  (select count(*) from public.notifications where source_type = 'portal_share' and recipient_user_id in ('00000000-0000-0000-0000-0000000031c1', '00000000-0000-0000-0000-0000000031c3')),
  2::bigint,
  'contractor A''s portal users are notified'
);
select ok(
  (select bool_and(position('Honeycombing' in title || body) = 0) from public.notifications where source_type = 'portal_share'),
  'the notification preview carries no record content'
);


-- Contractor A sees its item; B sees nothing of it, also not by id.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031c1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.portal_shares), 1::bigint, 'contractor A sees the item assigned to it');
select is((select count(*) from public.findings), 0::bigint, 'contractor A does not read the internal NCR record');
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000031f006'), 1::bigint, 'contractor A opens the photo shared with it');
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000031f003'), 0::bigint, 'contractor A does not open an internal photo');
select lives_ok($$select public.respond_in_portal((select id from public.portal_shares), 'acknowledge', null, null, null)$$, 'contractor A acknowledges receipt');
select is(
  public.respond_in_portal((select id from public.portal_shares), 'respond', 'Poor vibration at pour 3. Break out and recast.',
    '{"cause":"Poor vibration","corrective_action":"Break out and recast","target_date":"2026-12-01"}'::jsonb, array['00000000-0000-0000-0000-00000031f0a1'::uuid]),
  'responded',
  'contractor A submits cause analysis, corrective action and its own photo'
);
select throws_ok(
  $$select public.respond_in_portal((select id from public.portal_shares), 'comment', 'x', null, array['00000000-0000-0000-0000-00000031f003'::uuid])$$,
  '22023', null,
  'a contractor cannot attach a file that is not its own upload'
);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031c2","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.portal_shares), 0::bigint, 'contractor B does not see contractor A''s item');
select is((select count(*) from public.portal_events), 0::bigint, 'contractor B does not see contractor A''s responses');
select is((select count(*) from public.files where id in ('00000000-0000-0000-0000-00000031f006', '00000000-0000-0000-0000-00000031f0a1')), 0::bigint,
  'contractor B cannot open contractor A''s files by id');
select throws_ok(
  $$select public.respond_in_portal((select id from public.portal_shares where false union all select '00000000-0000-0000-0000-000000000000'::uuid limit 1), 'comment', 'x', null, null)$$,
  'P0002', null,
  'an unknown or foreign item answers not found'
);
reset role;
-- B tries A's share id directly.
create temporary table share_a on commit drop as select id from public.portal_shares;
grant select on share_a to authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031c2","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.respond_in_portal((select id from share_a), 'comment', 'I can see this', null, null)$$,
  'P0002', null,
  'contractor B cannot answer contractor A''s item by guessing its id'
);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031c3","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.respond_in_portal((select id from share_a), 'comment', 'Read-only', null, null)$$,
  '42501', null,
  'a read-only contractor user cannot respond'
);
reset role;

-- CODECO returns, the contractor resubmits in a new round, CODECO accepts, verifies and closes.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031b1","role":"authenticated"}';
set local role authenticated;
select throws_ok($$select public.review_portal_share((select id from share_a), 'close', null, null)$$, '55000', null,
  'a proposal is not closed before it is accepted or verified');
select throws_ok($$select public.review_portal_share((select id from share_a), 'return', null, null)$$, '22023', null,
  'returning needs a reason');
select is(public.review_portal_share((select id from share_a), 'return', 'Include the repair method statement.', null), 'returned', 'CODECO returns the response');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031c1","role":"authenticated"}';
set local role authenticated;
select is(public.respond_in_portal((select id from share_a), 'respond', 'Method statement attached.', '{"corrective_action":"Recast per MS-07"}'::jsonb, null),
  'responded', 'contractor A resubmits');
select is((select action from public.portal_events order by sequence desc limit 1), 'resubmit', 'the answer to a return is recorded as a resubmission');
select is((select round from public.portal_shares), 2, 'a resubmission is a new round');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031b1","role":"authenticated"}';
set local role authenticated;
select public.review_portal_share((select id from share_a), 'accept', null, null);
select public.review_portal_share((select id from share_a), 'verify', 'Recast checked on site.', null);
select is(public.review_portal_share((select id from share_a), 'close', null, null), 'closed', 'CODECO closes after verification');
select is(
  (select array_agg(action order by sequence) from public.portal_events where share_id = (select id from share_a)),
  array['assign','acknowledge','respond','return','resubmit','accept','verify','close'],
  'every workflow round stays in the log with its actor'
);
reset role;
select throws_ok($$delete from public.portal_events$$, '55000', null, 'portal events are append-only');

-- 3. Client Portal ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031b1","role":"authenticated"}';
set local role authenticated;
select public.share_to_portal((select project_id from ids), 'client', (select party_client from ids), 'publication',
  '00000000-0000-0000-0000-00000031f004', 'Weekly progress report', null, 'information', 'normal', null, null, null, 'weekly', '2026-11-16', '2026-11-22');
select public.share_to_portal((select project_id from ids), 'client', (select party_client from ids), 'publication',
  '00000000-0000-0000-0000-00000031f005', 'Weekly progress report', 'Corrected manpower figures', 'information', 'normal', null, null, null, 'weekly', '2026-11-16', '2026-11-22');
-- F15: only an approved revision is released; revision B is approved before the document is shared.
select public.set_project_document_revision_status((select id from public.project_document_revisions where revision = 'B'), 'approved', null);
select public.share_to_portal((select project_id from ids), 'client', (select party_client from ids), 'document',
  (select id from public.project_documents where document_number = 'A-101'), 'Ground floor plan', null, 'approve', 'normal', now() + interval '5 days', null, null);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031d1","role":"authenticated"}';
set local role authenticated;
select is(
  (select array_agg(status || ':' || publication_version order by publication_version) from public.portal_shares where record_type = 'publication'),
  array['superseded:1','published:2'],
  'a reissued report keeps the earlier issue as superseded and shows the current version'
);
select is((select count(*) from public.portal_shares where audience = 'contractor'), 0::bigint, 'the client does not see contractor items');
select is((select count(*) from public.portal_events where actor_side = 'contractor'), 0::bigint, 'the client does not see contractor responses');
select is((select count(*) from public.portal_document_revisions((select project_id from ids))), 1::bigint, 'the client sees the released revision and its status, not earlier or unreleased revisions');
select is((select count(*) from public.files where id = '00000000-0000-0000-0000-00000031f001'), 0::bigint, 'the client opens only the revision file that was shared');
select throws_ok(
  $$select public.respond_in_portal((select id from public.portal_shares where record_type = 'document'), 'approve', null, null, null)$$,
  '42501', null,
  'a client viewer cannot approve or comment'
);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031d2","role":"authenticated"}';
set local role authenticated;
select is(public.respond_in_portal((select id from public.portal_shares where record_type = 'document'), 'approve', 'Approved for the client.', null, null),
  'approved', 'a client approver approves the routed document');
reset role;

-- 4. Revoking access keeps the history ------------------------------------------------------
update public.project_memberships set status = 'revoked' where user_id = '00000000-0000-0000-0000-0000000031c1';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000031c1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.portal_shares), 0::bigint, 'a revoked contractor user sees nothing');
reset role;
select is((select count(*) from public.portal_events where actor_user_id = '00000000-0000-0000-0000-0000000031c1'), 3::bigint,
  'the revoked user''s responses remain in the audit trail');

select * from finish();
rollback;
