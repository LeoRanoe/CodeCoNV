begin;
set local search_path = extensions, pgtap, public;

-- Isolation: only the first organization can be created without an administrator, so the file
-- starts from an empty tenant table; the rollback at the end puts any existing data back.
truncate public.organizations, auth.users cascade;

-- public.my_project_permissions answers what the role matrix says, per project, for the
-- caller and nobody else, and says nothing to a stranger.
select plan(7);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000017a1', 'authenticated', 'authenticated', 'perm-admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000017a2', 'authenticated', 'authenticated', 'perm-client@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000017a3', 'authenticated', 'authenticated', 'perm-stranger@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Permission Org', 'permission-org', 'Permission Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'permission-org'),
  'PERM-1', 'Permission project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
select public.provision_internal_user(
  (select id from public.organizations where slug = 'permission-org'),
  '00000000-0000-0000-0000-0000000017a2'::uuid, 'Perm Client', 'client',
  (select id from public.projects where code = 'PERM-1')
);

select is(
  (select count(*)::integer from unnest(public.my_project_permissions((select id from public.projects where code = 'PERM-1'))) as code),
  (select count(*)::integer from public.permissions),
  'an organization administrator holds every permission on the project'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000017a2","role":"authenticated"}';
select ok(
  'findings.read' = any(public.my_project_permissions((select id from public.projects where code = 'PERM-1'))),
  'a client can read findings'
);
select ok(
  not ('findings.create' = any(public.my_project_permissions((select id from public.projects where code = 'PERM-1')))),
  'a client cannot create findings'
);
select ok(
  not ('records.create' = any(public.my_project_permissions((select id from public.projects where code = 'PERM-1')))),
  'a client cannot create records'
);
select ok(
  'reports.sign' = any(public.my_project_permissions((select id from public.projects where code = 'PERM-1'))),
  'a client can sign a report'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000017a3","role":"authenticated"}';
select is(
  public.my_project_permissions((select id from public.projects where code = 'PERM-1')),
  array[]::text[],
  'a user outside the project holds nothing on it'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.my_project_permissions('00000000-0000-0000-0000-000000000000')$$,
  '42501',
  null,
  'an anonymous caller cannot ask'
);

select * from finish();
rollback;
