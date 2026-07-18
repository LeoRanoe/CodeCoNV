begin;
set local search_path = extensions, public;

select plan(19);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'internal-admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'internal-supervisor@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'internal-outsider@example.test', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select ok(public.can_bootstrap_organization(), 'the first authenticated account may perform the one-time bootstrap');
select lives_ok(
  $$select public.bootstrap_organization('CODECO Internal', 'codeco-internal', 'Internal Admin')$$,
  'the first account can create the organization'
);
select ok(
  public.can_manage_organization_members((select id from public.organizations where slug = 'codeco-internal')),
  'the organization administrator can manage accounts'
);

select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'INT-001', 'Intern project', 'Paramaribo', 'Interne klant', 'HOOFD', 'Hoofdgebouw', 'Aannemer')$query$,
    (select id from public.organizations where slug = 'codeco-internal')
  ),
  'the administrator can create the project used for role assignment'
);

select lives_ok(
  format(
    $query$select public.provision_internal_user(%L::uuid, '00000000-0000-0000-0000-0000000000c2'::uuid, 'Internal Supervisor', 'supervisor', %L::uuid)$query$,
    (select id from public.organizations where slug = 'codeco-internal'),
    (select id from public.projects where code = 'INT-001')
  ),
  'the administrator can provision an invited supervisor'
);
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c2'), 1::bigint, 'provisioning creates the profile');
select is((select count(*) from public.organization_memberships where user_id = '00000000-0000-0000-0000-0000000000c2'), 1::bigint, 'provisioning creates the organization membership');
select is((select count(*) from public.project_memberships where user_id = '00000000-0000-0000-0000-0000000000c2'), 1::bigint, 'provisioning creates the project membership');
select is((select count(*) from public.project_member_roles where membership_id = (select id from public.project_memberships where user_id = '00000000-0000-0000-0000-0000000000c2')), 1::bigint, 'provisioning assigns the selected project role');
select is(jsonb_array_length(public.list_internal_access((select id from public.organizations where slug = 'codeco-internal')) -> 'members'), 2, 'the administrator can list internal accounts');
select is(jsonb_array_length(public.list_internal_access((select id from public.organizations where slug = 'codeco-internal')) -> 'roles'), 8, 'the account list includes data-driven roles');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select is(public.can_bootstrap_organization(), false, 'a project member cannot create another organization');
select is(
  public.can_manage_organization_members((select id from public.organizations where slug = 'codeco-internal')),
  false,
  'a supervisor cannot manage accounts'
);
select throws_ok(
  format(
    $query$select public.provision_internal_user(%L::uuid, '00000000-0000-0000-0000-0000000000c3'::uuid, 'Internal Outsider', 'supervisor', %L::uuid)$query$,
    (select id from public.organizations where slug = 'codeco-internal'),
    (select id from public.projects where code = 'INT-001')
  ),
  '42501',
  'Missing members.manage permission',
  'a supervisor cannot provision another account'
);
select throws_ok(
  $$select public.bootstrap_organization('Unauthorized', 'unauthorized-org', 'Internal Supervisor')$$,
  '42501',
  'Only an organization administrator can create another organization',
  'a non-admin cannot bypass the internal bootstrap rule'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select is(public.can_bootstrap_organization(), false, 'an unassigned existing account cannot bootstrap after setup');
select throws_ok(
  format(
    $query$select public.list_internal_access(%L::uuid)$query$,
    (select id from public.organizations where slug = 'codeco-internal')
  ),
  '42501',
  'Missing members.manage permission',
  'an outsider cannot list internal accounts'
);
select is((select count(*) from public.organization_memberships where user_id = '00000000-0000-0000-0000-0000000000c3'), 0::bigint, 'failed provisioning leaves no membership behind');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select cmp_ok((select count(*) from public.audit_events where table_name in ('organization_memberships', 'project_memberships', 'project_member_roles')), '>', 0::bigint, 'account provisioning is represented in the audit trail');

reset role;
select * from finish();
rollback;
