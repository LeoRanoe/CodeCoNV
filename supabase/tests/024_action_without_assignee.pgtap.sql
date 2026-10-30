begin;
set local search_path = extensions, pgtap, public;

-- Isolation: only the first organization can be created without an administrator, so the file
-- starts from an empty tenant table; the rollback at the end puts any existing data back.
set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- QA M4: a manager creates an action before choosing an employee; a contractor still cannot.
select plan(8);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000024a1', 'authenticated', 'authenticated', 'action-admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000024a2', 'authenticated', 'authenticated', 'action-contractor@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Action Org', 'action-org', 'Action Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'action-org'),
  'ACT-24', 'Unassigned action project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
select public.provision_internal_user(
  (select id from public.organizations where slug = 'action-org'),
  '00000000-0000-0000-0000-0000000024a2'::uuid, 'Action Contractor', 'contractor',
  (select id from public.projects where code = 'ACT-24')
);

select lives_ok(
  $$select public.create_project_action(
      (select id from public.projects where code = 'ACT-24'),
      (select id from public.buildings where project_id = (select id from public.projects where code = 'ACT-24') limit 1),
      (select id from public.parties where project_id = (select id from public.projects where code = 'ACT-24') and party_type = 'contractor'),
      null::uuid, 'Herstel de dekking', 'Herstel de dekking en meld de maatregel.', now() + interval '3 days', 'normal', 'm4-unassigned-1', null::uuid)$$,
  'a manager creates an action without choosing an employee'
);
select is(
  (select owner_user_id from public.actions where idempotency_key = 'm4-unassigned-1'),
  '00000000-0000-0000-0000-0000000024a1'::uuid,
  'the action stays with the manager who created it'
);
select is(
  (select count(*)::integer from public.action_updates update where update.action_id = (select id from public.actions where idempotency_key = 'm4-unassigned-1') and update.message = 'Actie toegewezen aan bedrijfsmedewerker.'),
  0,
  'no assignment is recorded in the history'
);
select is(
  (select owner_party_id is not null from public.actions where idempotency_key = 'm4-unassigned-1'),
  true,
  'the action belongs to its party'
);
select lives_ok(
  $$select public.assign_project_action(
      (select id from public.actions where idempotency_key = 'm4-unassigned-1'),
      '00000000-0000-0000-0000-0000000024a1'::uuid, 'Toegewezen aan de projectleider')$$,
  'the action can be assigned afterwards'
);
select is(
  (select owner_user_id from public.actions where idempotency_key = 'm4-unassigned-1'),
  '00000000-0000-0000-0000-0000000024a1'::uuid,
  'the owner is the chosen employee'
);
select throws_ok(
  $$select public.create_project_action(
      (select id from public.projects where code = 'ACT-24'),
      (select id from public.buildings where project_id = (select id from public.projects where code = 'ACT-24') limit 1),
      (select id from public.parties where project_id = (select id from public.projects where code = 'ACT-24') and party_type = 'contractor'),
      '00000000-0000-0000-0000-0000000024a2'::uuid, 'Titel', 'Omschrijving hier.', now() + interval '3 days', 'normal', 'm4-contractor-assignee', null::uuid)$$,
  '42501',
  'Assignee is not an active company employee for this project',
  'a contractor is still no valid assignee'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000024a2","role":"authenticated"}';
select throws_ok(
  $$select public.create_project_action(
      (select id from public.projects where code = 'ACT-24'),
      (select id from public.buildings where project_id = (select id from public.projects where code = 'ACT-24') limit 1),
      (select id from public.parties where project_id = (select id from public.projects where code = 'ACT-24') and party_type = 'contractor'),
      null::uuid, 'Titel', 'Omschrijving hier.', now() + interval '3 days', 'normal', 'm4-contractor-create', null::uuid)$$,
  '42501',
  'Missing actions.manage permission',
  'a contractor cannot create a central action'
);

select * from finish();
rollback;
