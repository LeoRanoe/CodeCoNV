begin;
set local search_path = extensions, pgtap, public;

select plan(18);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-0000-0000-0000000000c1',
  'authenticated',
  'authenticated',
  'action-flow@example.test',
  now(),
  now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO Action Flow', 'codeco-action-flow', 'Action Supervisor')$$,
  'action workflow starts with an authorized organization'
);

select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'ACT-FLOW-01', 'Action flow project', 'Paramaribo', 'Test client', 'HOOFD', 'Hoofdgebouw', 'Test contractor')$query$,
    (select id from public.organizations where slug = 'codeco-action-flow')
  ),
  'authorized admin creates the project workspace'
);

select lives_ok(
  format(
    $query$select public.create_project_action(%L::uuid, %L::uuid, %L::uuid, 'Herstel de gecontroleerde dekking', 'Corrigeer de dekking en meld de maatregel aantoonbaar gereed.', now() + interval '1 day', 'high', 'action-flow-idempotency')$query$,
    (select id from public.projects where code = 'ACT-FLOW-01'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'ACT-FLOW-01')),
    (select id from public.parties where project_id = (select id from public.projects where code = 'ACT-FLOW-01') and party_type = 'contractor')
  ),
  'action is created through the central RPC'
);

select is((select count(*) from public.actions), 1::bigint, 'one action is stored');
select matches((select action_number from public.actions), '^ACT-[0-9]{4}-[0-9]{4}$', 'action receives a project sequence number');
select ok((select owner_party_id is not null from public.actions), 'responsible party is stored');
select is((select count(*) from public.action_updates where update_type = 'created'), 1::bigint, 'creation is written to immutable history');

select is(
  (
    public.create_project_action(
      (select id from public.projects where code = 'ACT-FLOW-01'),
      (select id from public.buildings where project_id = (select id from public.projects where code = 'ACT-FLOW-01')),
      (select id from public.parties where project_id = (select id from public.projects where code = 'ACT-FLOW-01') and party_type = 'contractor'),
      'Herstel de gecontroleerde dekking',
      'Corrigeer de dekking en meld de maatregel aantoonbaar gereed.',
      now() + interval '1 day',
      'high',
      'action-flow-idempotency'
    )
  ).id,
  (select id from public.actions),
  'retrying action creation returns the same record'
);

select throws_ok(
  format($query$select public.transition_project_action(%L::uuid, 'verified', 'Te vroeg geverifieerd')$query$, (select id from public.actions)),
  '23514',
  'Invalid action transition: open -> verified',
  'invalid status jumps are blocked in the database'
);

select lives_ok(
  format($query$select public.transition_project_action(%L::uuid, 'accepted', 'Actie door verantwoordelijke geaccepteerd.')$query$, (select id from public.actions)),
  'open action can be accepted'
);
select is((select status::text from public.actions), 'accepted', 'accepted status is persisted');

select lives_ok(
  format($query$select public.transition_project_action(%L::uuid, 'in_progress', 'Herstelwerk is aantoonbaar gestart.')$query$, (select id from public.actions)),
  'accepted action can enter execution'
);
select lives_ok(
  format($query$select public.transition_project_action(%L::uuid, 'ready_for_verification', 'Herstel gereed; controle op locatie gevraagd.')$query$, (select id from public.actions)),
  'completed work can be submitted for verification'
);
select lives_ok(
  format($query$select public.transition_project_action(%L::uuid, 'verified', 'Herstel op locatie gecontroleerd en akkoord.')$query$, (select id from public.actions)),
  'authorized reviewer can verify the action'
);
select is((select status::text from public.actions), 'verified', 'verified status is persisted');
select is((select closure_reason from public.actions), 'Herstel op locatie gecontroleerd en akkoord.', 'verification reason is retained');
select is((select count(*) from public.action_updates), 5::bigint, 'every workflow step is retained in history');
select throws_ok(
  $$update public.action_updates set message = 'Gewijzigd'$$,
  '42501',
  'permission denied for table action_updates',
  'browser users cannot rewrite action history'
);

reset role;
select * from finish();
rollback;
