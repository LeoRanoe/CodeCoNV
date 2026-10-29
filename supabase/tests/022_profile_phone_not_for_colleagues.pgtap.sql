begin;
set local search_path = extensions, pgtap, public;

select plan(4);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000022a1', 'authenticated', 'authenticated', 'phone-supervisor@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000022a2', 'authenticated', 'authenticated', 'phone-contractor@example.test', now(), now());

insert into public.profiles (id, display_name, phone) values
  ('00000000-0000-0000-0000-0000000022a1', 'Supervisor Telefoon', '+597 811 1111'),
  ('00000000-0000-0000-0000-0000000022a2', 'Aannemer Telefoon', '+597 822 2222')
on conflict (id) do update set display_name = excluded.display_name, phone = excluded.phone;

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-0000-0000-000000000022', 'Phone Org', 'phone-org', '00000000-0000-0000-0000-0000000022a1');
insert into public.organization_memberships (id, organization_id, user_id, status) values
  ('12000000-0000-0000-0000-000000000221', '10000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-0000000022a1', 'active'),
  ('12000000-0000-0000-0000-000000000222', '10000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-0000000022a2', 'active');
insert into public.projects (id, organization_id, code, name, location, created_by)
values ('20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000022', 'PH-01', 'Phone project', 'Paramaribo', '00000000-0000-0000-0000-0000000022a1');
insert into public.project_memberships (id, organization_id, project_id, user_id, status) values
  ('21000000-0000-0000-0000-000000000221', '10000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-0000000022a1', 'active'),
  ('21000000-0000-0000-0000-000000000222', '10000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-0000000022a2', 'active');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000022a2","role":"authenticated"}';
set local role authenticated;

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000022a1'),
  'Supervisor Telefoon',
  'a colleague can still read the name of a project member'
);
select throws_ok(
  $$select phone from public.profiles where id = '00000000-0000-0000-0000-0000000022a1'$$,
  '42501', null, 'a colleague cannot read the telephone number of a project member'
);
select throws_ok(
  $$select phone from public.profiles where id = '00000000-0000-0000-0000-0000000022a2'$$,
  '42501', null, 'the telephone column is closed to signed-in users, whoever the row is'
);
select throws_ok(
  $$select * from public.profiles$$,
  '42501', null, 'select * is refused too, so nobody gets the number by accident'
);

select * from finish();
rollback;
