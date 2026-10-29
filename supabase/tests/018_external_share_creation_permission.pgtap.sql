begin;
set local search_path = extensions, pgtap, public;

-- Creating a contractor share link is a write-level act: a read-only member (the client) and a
-- stranger must be refused by the database itself, whatever the screen shows, and a supervisor
-- must still be able to do it for each kind of source.
-- Isolation: only the first organization can be created without an administrator, so the file
-- starts from an empty tenant table; the rollback at the end puts any existing data back.
truncate public.organizations, auth.users cascade;

select plan(9);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000018a1', 'authenticated', 'authenticated', 'share-admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000018a2', 'authenticated', 'authenticated', 'share-client@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000018a3', 'authenticated', 'authenticated', 'share-supervisor@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000018a4', 'authenticated', 'authenticated', 'share-stranger@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Share Org', 'share-org', 'Share Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'share-org'),
  'SHARE-1', 'Share project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
select public.provision_internal_user(
  (select id from public.organizations where slug = 'share-org'),
  '00000000-0000-0000-0000-0000000018a2'::uuid, 'Share Client', 'client',
  (select id from public.projects where code = 'SHARE-1')
);
select public.provision_internal_user(
  (select id from public.organizations where slug = 'share-org'),
  '00000000-0000-0000-0000-0000000018a3'::uuid, 'Share Supervisor', 'supervisor',
  (select id from public.projects where code = 'SHARE-1')
);
select public.create_project_finding(
  (select id from public.projects where code = 'SHARE-1'),
  (select id from public.buildings where project_id = (select id from public.projects where code = 'SHARE-1')),
  null, null, null, 'ncr', 'Share boundary NCR', 'Used to prove who may create a link.', 'high', null, null,
  'share-permission-finding', '{}'::jsonb
);

create temporary table finding_ref (id uuid) on commit drop;
grant select, insert on finding_ref to authenticated;
insert into finding_ref select id from public.findings where idempotency_key = 'share-permission-finding';

-- A client reads the finding but may not hand it to anyone outside.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000018a2","role":"authenticated"}';
select throws_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'finding', %L::uuid, 14)$q$,
    (select id from public.projects where code = 'SHARE-1'), (select id from finding_ref)),
  '42501', null, 'a client (read-only) cannot create a share link for a finding'
);
select throws_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'action', gen_random_uuid(), 14)$q$,
    (select id from public.projects where code = 'SHARE-1')),
  '42501', null, 'a client cannot create a share link for an action'
);
select throws_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'inspection', gen_random_uuid(), 14)$q$,
    (select id from public.projects where code = 'SHARE-1')),
  '42501', null, 'a client cannot create a share link for an inspection'
);
select throws_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'visual', gen_random_uuid(), 14)$q$,
    (select id from public.projects where code = 'SHARE-1')),
  '42501', null, 'a client cannot create a share link for a photo marker'
);

-- A stranger holds nothing on the project.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000018a4","role":"authenticated"}';
select throws_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'finding', %L::uuid, 14)$q$,
    (select id from public.projects where code = 'SHARE-1'), (select id from finding_ref)),
  '42501', null, 'a user outside the project cannot create a share link'
);

-- A supervisor can: the permission check passes, the nonexistent source is what is refused.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000018a3","role":"authenticated"}';
select lives_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'finding', %L::uuid, 14)$q$,
    (select id from public.projects where code = 'SHARE-1'), (select id from finding_ref)),
  'a supervisor can create a share link for a finding'
);
select throws_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'action', gen_random_uuid(), 14)$q$,
    (select id from public.projects where code = 'SHARE-1')),
  'P0002', null, 'a supervisor passes the permission check for an action (only the missing source is refused)'
);
select throws_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'inspection', gen_random_uuid(), 14)$q$,
    (select id from public.projects where code = 'SHARE-1')),
  'P0002', null, 'a supervisor passes the permission check for an inspection'
);
select throws_ok(
  format($q$select public.create_external_share_link(%L::uuid, 'visual', gen_random_uuid(), 14)$q$,
    (select id from public.projects where code = 'SHARE-1')),
  'P0002', null, 'a supervisor passes the permission check for a photo marker'
);

select * from finish();
rollback;
