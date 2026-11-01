begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Work given to someone tells them at once, not only a day before it is due. Counts run with the
-- database's own rights (reset role): a manager may not read another person's notifications.
select plan(6);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000027a1', 'authenticated', 'authenticated', 'notify-admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000027a2', 'authenticated', 'authenticated', 'notify-lead@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000027a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Notify Org', 'notify-org', 'Notify Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'notify-org'),
  'NTF-27', 'Notification project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
select public.provision_internal_user(
  (select id from public.organizations where slug = 'notify-org'),
  '00000000-0000-0000-0000-0000000027a2'::uuid, 'Notify Lead', 'lead_supervisor',
  (select id from public.projects where code = 'NTF-27')
);

-- An action the manager keeps for themselves tells nobody.
select public.create_project_action(
  (select id from public.projects where code = 'NTF-27'),
  (select id from public.buildings where project_id = (select id from public.projects where code = 'NTF-27') limit 1),
  (select id from public.parties where project_id = (select id from public.projects where code = 'NTF-27') and party_type = 'contractor'),
  null::uuid, 'Eigen actie', 'Actie voor de manager zelf.', now() + interval '5 days', 'normal', 'ntf-own-27', null::uuid);
reset role;
select is(
  (select count(*)::integer from public.notifications where notification_type = 'action_assigned'),
  0,
  'assigning work to yourself creates no notification'
);
set local role authenticated;

select public.create_project_action(
  (select id from public.projects where code = 'NTF-27'),
  (select id from public.buildings where project_id = (select id from public.projects where code = 'NTF-27') limit 1),
  (select id from public.parties where project_id = (select id from public.projects where code = 'NTF-27') and party_type = 'contractor'),
  '00000000-0000-0000-0000-0000000027a2'::uuid, 'Controleer de bekisting', 'Controleer de bekisting voor de stort.', now() + interval '5 days', 'normal', 'ntf-lead-27', null::uuid);
reset role;
select is(
  (select count(*)::integer from public.notifications
    where notification_type = 'action_assigned' and recipient_user_id = '00000000-0000-0000-0000-0000000027a2'),
  1,
  'an action due in five days notifies its owner at once'
);
select is(
  (select push_status from public.notifications where notification_type = 'action_assigned'),
  'pending',
  'the push waits for the next dispatch'
);
set local role authenticated;

select public.assign_project_action(
  (select id from public.actions where idempotency_key = 'ntf-own-27'),
  '00000000-0000-0000-0000-0000000027a2'::uuid, 'Overgedragen');
reset role;
select is(
  (select count(*)::integer from public.notifications
    where notification_type = 'action_assigned' and recipient_user_id = '00000000-0000-0000-0000-0000000027a2'),
  2,
  'reassigning an action notifies the new owner'
);
set local role authenticated;

select public.assign_project_action(
  (select id from public.actions where idempotency_key = 'ntf-own-27'),
  '00000000-0000-0000-0000-0000000027a2'::uuid, 'Nogmaals');
reset role;
select is(
  (select count(*)::integer from public.notifications where notification_type = 'action_assigned'),
  2,
  'saving the same owner again does not notify twice'
);
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000027a2","role":"authenticated"}';
select is(
  (select count(*)::integer from public.notifications where notification_type = 'action_assigned'),
  2,
  'the owner can read the notifications addressed to them'
);

select * from finish();
rollback;
