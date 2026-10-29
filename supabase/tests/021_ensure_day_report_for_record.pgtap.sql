begin;
set local search_path = extensions, pgtap, public;

-- QA sweep H1: the contractor could not save any record because every save first created the
-- day report with a function that needs reports.create. ensure_day_report_for_record hands out
-- the id of the report of a date to every active member with a write permission, without
-- opening the report for reading.
select plan(19);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000021a1', 'authenticated', 'authenticated', 'ensure-admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000021a2', 'authenticated', 'authenticated', 'ensure-supervisor@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000021a3', 'authenticated', 'authenticated', 'ensure-contractor@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000021a4', 'authenticated', 'authenticated', 'ensure-guest@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000021a5', 'authenticated', 'authenticated', 'ensure-suspended@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000021a6', 'authenticated', 'authenticated', 'ensure-outsider@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000021a7', 'authenticated', 'authenticated', 'ensure-client@example.test', now(), now());

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-0000-0000-000000000021', 'Ensure Org', 'ensure-org', '00000000-0000-0000-0000-0000000021a1');

insert into public.roles (id, organization_id, scope, code, name, is_system, created_by) values
  ('11000000-0000-0000-0000-000000000211', '10000000-0000-0000-0000-000000000021', 'project', 'supervisor', 'Supervisor', true, '00000000-0000-0000-0000-0000000021a1'),
  ('11000000-0000-0000-0000-000000000212', '10000000-0000-0000-0000-000000000021', 'project', 'contractor', 'Aannemer', true, '00000000-0000-0000-0000-0000000021a1'),
  ('11000000-0000-0000-0000-000000000213', '10000000-0000-0000-0000-000000000021', 'project', 'external_guest', 'Externe gast', true, '00000000-0000-0000-0000-0000000021a1'),
  ('11000000-0000-0000-0000-000000000214', '10000000-0000-0000-0000-000000000021', 'project', 'client', 'Opdrachtgever', true, '00000000-0000-0000-0000-0000000021a1');

-- Role permissions come from the system defaults that are seeded when a role is inserted; the
-- bootstrap function adds the base record right the contractor works with.
insert into public.role_permissions (organization_id, role_id, permission_code) values
  ('10000000-0000-0000-0000-000000000021', '11000000-0000-0000-0000-000000000212', 'records.create'),
  ('10000000-0000-0000-0000-000000000021', '11000000-0000-0000-0000-000000000211', 'records.create'),
  ('10000000-0000-0000-0000-000000000021', '11000000-0000-0000-0000-000000000211', 'reports.read')
on conflict do nothing;

insert into public.organization_memberships (id, organization_id, user_id, status) values
  ('12000000-0000-0000-0000-000000000211', '10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000021a1', 'active'),
  ('12000000-0000-0000-0000-000000000212', '10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000021a2', 'active'),
  ('12000000-0000-0000-0000-000000000213', '10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000021a3', 'active'),
  ('12000000-0000-0000-0000-000000000214', '10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000021a4', 'active'),
  ('12000000-0000-0000-0000-000000000215', '10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000021a5', 'active'),
  ('12000000-0000-0000-0000-000000000216', '10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000021a6', 'active'),
  ('12000000-0000-0000-0000-000000000217', '10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000021a7', 'active');

insert into public.projects (id, organization_id, code, name, location, created_by) values
  ('20000000-0000-0000-0000-000000000211', '10000000-0000-0000-0000-000000000021', 'ENS-01', 'Ensure project', 'Paramaribo', '00000000-0000-0000-0000-0000000021a1'),
  ('20000000-0000-0000-0000-000000000212', '10000000-0000-0000-0000-000000000021', 'ENS-02', 'Ander project', 'Paramaribo', '00000000-0000-0000-0000-0000000021a1');

insert into public.project_memberships (id, organization_id, project_id, user_id, status) values
  ('21000000-0000-0000-0000-000000000212', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-0000000021a2', 'active'),
  ('21000000-0000-0000-0000-000000000213', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-0000000021a3', 'active'),
  ('21000000-0000-0000-0000-000000000214', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-0000000021a4', 'active'),
  ('21000000-0000-0000-0000-000000000215', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-0000000021a5', 'suspended'),
  ('21000000-0000-0000-0000-000000000216', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-0000000021a6', 'active'),
  ('21000000-0000-0000-0000-000000000217', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-0000000021a7', 'active');

insert into public.project_member_roles (organization_id, project_id, membership_id, role_id) values
  ('10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '21000000-0000-0000-0000-000000000212', '11000000-0000-0000-0000-000000000211'),
  ('10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '21000000-0000-0000-0000-000000000213', '11000000-0000-0000-0000-000000000212'),
  ('10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '21000000-0000-0000-0000-000000000214', '11000000-0000-0000-0000-000000000213'),
  ('10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '21000000-0000-0000-0000-000000000215', '11000000-0000-0000-0000-000000000212'),
  ('10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000212', '21000000-0000-0000-0000-000000000216', '11000000-0000-0000-0000-000000000212'),
  ('10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '21000000-0000-0000-0000-000000000217', '11000000-0000-0000-0000-000000000214');

insert into public.buildings (id, organization_id, project_id, code, name, created_by)
values ('30000000-0000-0000-0000-000000000211', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', 'B01', 'Hoofdgebouw', '00000000-0000-0000-0000-0000000021a1');
insert into public.day_reports (id, organization_id, project_id, report_date, report_number, idempotency_key, created_by)
values ('50000000-0000-0000-0000-000000000212', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000212', '2026-10-27', 'DR-20261027', 'other-project-report', '00000000-0000-0000-0000-0000000021a1');

insert into public.project_register_entries (id, organization_id, project_id, building_id, day_report_id, register_type, entry_number, title, occurred_at, details, idempotency_key, created_by)
values ('60000000-0000-0000-0000-000000000211', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '30000000-0000-0000-0000-000000000211', null, 'rfi', 'RFI-ENS-0001', 'Supervisor RFI', now(), '{}'::jsonb, 'ensure-other-rfi', '00000000-0000-0000-0000-0000000021a2');

create temporary table ensured (who text, report_id uuid) on commit drop;
grant select, insert on ensured to authenticated;

-- The contractor creates the report of the day.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000021a3","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$insert into public.day_reports (organization_id, project_id, report_date, report_number, idempotency_key, created_by)
    values ('10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000211', '2026-10-28', 'DR-20261028', 'direct-insert-1', '00000000-0000-0000-0000-0000000021a3')$$,
  '42501',
  null,
  'the contractor still cannot insert a day report directly'
);
select lives_ok(
  $$insert into ensured select 'contractor', public.ensure_day_report_for_record('20000000-0000-0000-0000-000000000211', '2026-10-28', 'ensure:contractor:1')$$,
  'the contractor can ensure the day report of a date'
);
select is(
  (select count(*) from public.day_reports),
  0::bigint,
  'ensuring the report does not let the contractor read any report'
);

-- The ensured report is accepted by the record that hangs on it, which the contractor cannot read.
select lives_ok(
  format($query$select public.create_project_register_entry(
    '20000000-0000-0000-0000-000000000211'::uuid, '30000000-0000-0000-0000-000000000211'::uuid, %L::uuid,
    'rfi', 'Detail aansluiting gevel', now(), null, null,
    jsonb_build_object(
      'schema', 'codeco.controlled-document.v1', 'document_type', 'rfi',
      'project_name', 'Ensure project', 'project_number', 'ENS-01', 'building_name', 'Hoofdgebouw',
      'subject', 'Detail aansluiting gevel', 'description', 'Bevestig het aansluitdetail.',
      'issue_date', to_char(current_date, 'YYYY-MM-DD'), 'requested_to', 'Hoofdaannemer', 'response', '{}'::jsonb
    ),
    'ensure-contractor-rfi')$query$,
    (select report_id from ensured where who = 'contractor')
  ),
  'the contractor saves an RFI on the ensured day report'
);
select lives_ok(
  $$select public.set_record_buildings(
    '20000000-0000-0000-0000-000000000211'::uuid, 'register_entry',
    (select id from public.project_register_entries where idempotency_key = 'ensure-contractor-rfi'),
    array['30000000-0000-0000-0000-000000000211'::uuid])$$,
  'the contractor files its own RFI under a building'
);
select throws_ok(
  $$select public.create_project_register_entry(
    '20000000-0000-0000-0000-000000000211'::uuid, '30000000-0000-0000-0000-000000000211'::uuid, '50000000-0000-0000-0000-000000000212'::uuid,
    'rfi', 'Detail aansluiting gevel', now(), null, null, '{}'::jsonb, 'ensure-contractor-rfi-other')$$,
  null, null,
  'a report of another project is still refused'
);
select throws_ok(
  $$select public.set_record_buildings(
    '20000000-0000-0000-0000-000000000211'::uuid, 'register_entry', '60000000-0000-0000-0000-000000000211',
    array['30000000-0000-0000-0000-000000000211'::uuid])$$,
  '42501', null, 'the contractor cannot change the buildings of someone else''s record'
);
select throws_ok(
  $$select public.set_record_buildings(
    '20000000-0000-0000-0000-000000000211'::uuid, 'finding', '60000000-0000-0000-0000-000000000211',
    array['30000000-0000-0000-0000-000000000211'::uuid])$$,
  '42501', null, 'the contractor still cannot touch the buildings of other record types'
);
reset role;

select is(
  (select count(*) from public.day_reports where project_id = '20000000-0000-0000-0000-000000000211' and report_date = '2026-10-28'),
  1::bigint,
  'the report exists after the contractor ensured it'
);

-- The supervisor gets the same report back.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000021a2","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$insert into ensured select 'supervisor', public.ensure_day_report_for_record('20000000-0000-0000-0000-000000000211', '2026-10-28', 'ensure:supervisor:1')$$,
  'the supervisor can ensure the day report of the same date'
);
reset role;
select is(
  (select count(distinct report_id) from ensured),
  1::bigint,
  'the contractor and the supervisor receive the same report: ensuring is idempotent'
);
select is(
  (select count(*) from public.day_reports where project_id = '20000000-0000-0000-0000-000000000211'),
  1::bigint,
  'there is one report for the date'
);

-- Everyone else is refused with the same answer as for a project that does not exist.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000021a4","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.ensure_day_report_for_record('20000000-0000-0000-0000-000000000211', '2026-10-29', 'ensure:guest:1')$$,
  'P0002', null, 'an external guest without write rights is refused'
);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000021a5","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.ensure_day_report_for_record('20000000-0000-0000-0000-000000000211', '2026-10-29', 'ensure:suspended:1')$$,
  'P0002', null, 'a suspended member is refused'
);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000021a6","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.ensure_day_report_for_record('20000000-0000-0000-0000-000000000211', '2026-10-29', 'ensure:outsider:1')$$,
  'P0002', null, 'a member of another project is refused'
);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000021a7","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.ensure_day_report_for_record('20000000-0000-0000-0000-000000000211', '2026-10-29', 'ensure:client:1')$$,
  'P0002', null, 'the read-only client cannot create reports'
);
select throws_ok(
  $$select public.ensure_day_report_for_record('20000000-0000-0000-0000-000000000299', '2026-10-29', 'ensure:missing:1')$$,
  'P0002', null, 'an unknown project gives the same answer'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.ensure_day_report_for_record('20000000-0000-0000-0000-000000000211', '2026-10-29', 'ensure:anon:1')$$,
  '42501', null, 'an anonymous caller cannot run the function'
);
reset role;

select is(
  (select count(*) from public.day_reports where project_id = '20000000-0000-0000-0000-000000000211'),
  1::bigint,
  'refused callers created no reports'
);

select * from finish();
rollback;
