begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Client feedback of 19-11-2026: an HSE record names the responsible party (client, contractor or
-- supervision) and can carry the contractor's own signature, which stays as it was signed.
select plan(9);

select has_column('public', 'hse_events', 'responsible_role', 'the HSE record keeps the responsible party');
select has_column('public', 'hse_events', 'contractor_signed_by', 'the contractor signatory is stored');
select has_column('public', 'hse_events', 'contractor_signed_at', 'the moment of the contractor signature is stored');
select has_column('public', 'hse_events', 'contractor_signature_image', 'the contractor ink is stored');
select has_column('public', 'hse_events', 'contractor_signed_position', 'the contractor position is stored');
select has_trigger('public', 'hse_events', 'hse_events_contractor_signature_guard', 'a contractor signature is guarded');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000028a1', 'authenticated', 'authenticated', 'hse-sign@example.test', now(), now());
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000028a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('HSE Sign Org', 'hse-sign-org', 'HSE Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'hse-sign-org'),
  'HSE-28', 'HSE sign project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
reset role;

-- A record written by the database's own rights, the way the RPC writes one.
set local session_replication_role = replica;
insert into public.hse_events (organization_id, project_id, building_id, event_number, event_type, title, description, severity, occurred_at, idempotency_key, created_by)
select project.organization_id, project.id, building.id, 'HSE-28-0001', 'observation', 'Open edge', 'Open edge at level 2.', 'high', now(), 'hse-28-sign', '00000000-0000-0000-0000-0000000028a1'
from public.projects project join public.buildings building on building.project_id = project.id
where project.code = 'HSE-28' limit 1;
set local session_replication_role = origin;

select throws_ok(
  $$update public.hse_events set responsible_role = 'architect' where event_number = 'HSE-28-0001'$$,
  '23514',
  null,
  'only client, contractor or supervision can be responsible'
);

update public.hse_events
set responsible_role = 'contractor',
    contractor_signed_by = 'Jan Aannemer',
    contractor_signed_at = now(),
    contractor_signature_image = 'data:image/png;base64,' || repeat('A', 60)
where event_number = 'HSE-28-0001';

select throws_ok(
  $$update public.hse_events set contractor_signature_image = 'data:image/png;base64,' || repeat('B', 60) where event_number = 'HSE-28-0001'$$,
  '23514',
  'A signed record keeps its contractor signature',
  'a stored contractor signature cannot be replaced'
);

select lives_ok(
  $$update public.hse_events set contractor_signed_position = 'Uitvoerder', notes = 'Railing placed.' where event_number = 'HSE-28-0001'$$,
  'the rest of a signed record can still be completed'
);

select * from finish();
rollback;
