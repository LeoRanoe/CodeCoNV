begin;
set local search_path = extensions, pgtap, public;

select plan(8);

select has_column('public', 'files', 'document_code', 'every file carries the unique code it is looked up by');
select has_function(
  'app_private',
  'assign_file_document_code',
  'the database numbers a file itself, so no upload path can create one without a code'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-0000-0000-0000000000e1',
  'authenticated',
  'authenticated',
  'document-codes@example.test',
  now(),
  now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

insert into public.organizations (id, name, slug, created_by)
values ('00000000-0000-0000-0000-0000000000e2', 'Document Code Org', 'document-code-org', auth.uid());
insert into public.roles (id, organization_id, scope, code, name, is_system, created_by)
values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e2', 'project', 'supervisor', 'Supervisor', true, auth.uid());
insert into public.role_permissions (organization_id, role_id, permission_code)
select '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3', code
from public.permissions;
insert into public.projects (id, organization_id, code, name, location, created_by)
values ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e2', 'COD-DOC-01', 'Document code project', 'Paramaribo', auth.uid());
insert into public.project_memberships (id, organization_id, project_id, user_id, created_by)
values ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e4', auth.uid(), auth.uid());
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000e3');
insert into public.buildings (id, organization_id, project_id, code, name, created_by)
values ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e4', 'BLOK-A', 'Blok A', auth.uid());

-- Only the storage service may write a completed file; the browser role may reserve
-- pending metadata. The numbering has to happen on the row the storage service writes,
-- so these four are inserted exactly as the upload route does it.
reset role;
set local request.jwt.claims = '{"role":"service_role"}';

insert into public.files (
  organization_id, project_id, building_id, storage_object_key, original_name,
  mime_type, size_bytes, sha256, status, category, created_by
) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e6', 'projects/doc/photo-1', 'gevel.jpg', 'image/jpeg', 900000, repeat('a', 64), 'available', 'photo', '00000000-0000-0000-0000-0000000000e1'::uuid),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e6', 'projects/doc/photo-2', 'kolom.jpg', 'image/jpeg', 800000, repeat('b', 64), 'available', 'photo', '00000000-0000-0000-0000-0000000000e1'::uuid),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e6', 'projects/doc/drawing-1', 'A112.pdf', 'application/pdf', 2100000, repeat('c', 64), 'available', 'drawing', '00000000-0000-0000-0000-0000000000e1'::uuid),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e6', 'projects/doc/spec-1', 'bestek.pdf', 'application/pdf', 400000, repeat('d', 64), 'available', 'document', '00000000-0000-0000-0000-0000000000e1'::uuid);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

-- Photos, drawings and other documents are numbered in their own series, so a code says
-- what kind of document it is before anything is opened.
select is(
  (select document_code from public.files where storage_object_key = 'projects/doc/photo-1'),
  'PHO-' || extract(year from (now() at time zone 'America/Paramaribo'))::text || '-0001',
  'the first photo of a project is numbered PHO-<year>-0001'
);
select is(
  (select document_code from public.files where storage_object_key = 'projects/doc/photo-2'),
  'PHO-' || extract(year from (now() at time zone 'America/Paramaribo'))::text || '-0002',
  'the next photo continues the same series'
);
select is(
  (select document_code from public.files where storage_object_key = 'projects/doc/drawing-1'),
  'DWG-' || extract(year from (now() at time zone 'America/Paramaribo'))::text || '-0001',
  'a drawing is numbered in its own series'
);
select is(
  (select document_code from public.files where storage_object_key = 'projects/doc/spec-1'),
  'DOC-' || extract(year from (now() at time zone 'America/Paramaribo'))::text || '-0001',
  'any other uploaded document is numbered as a document'
);
select is(
  (select count(*) from public.files where project_id = '00000000-0000-0000-0000-0000000000e4' and document_code is null),
  0::bigint,
  'no file in the project can exist without a code'
);

-- Two documents in one project may never share a code: the search has to land on one record.
select throws_ok(
  $$update public.files set document_code = (select document_code from public.files where storage_object_key = 'projects/doc/photo-1')
    where storage_object_key = 'projects/doc/photo-2'$$,
  '23505',
  null,
  'a duplicate document code inside one project is rejected'
);

reset role;
select * from finish();
rollback;
