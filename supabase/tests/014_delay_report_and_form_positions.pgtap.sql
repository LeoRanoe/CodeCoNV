begin;
set local search_path = extensions, pgtap, public;

select plan(11);

-- 202608090002: the contractor's box on the NCR form gains the position that stands under
-- the name. The seven-argument function stays, without a default on the new argument, so a
-- seven-name call from a deployment that has not been updated still resolves.
select has_function(
  'public',
  'submit_external_share_response',
  array['text','text','text','text','uuid','text','text','text'],
  'an external response can carry the signer''s position'
);
select has_function(
  'public',
  'submit_external_share_response',
  array['text','text','text','text','uuid','text','text'],
  'the seven-argument response stays, so an older deployment keeps working'
);
select ok(
  not has_function_privilege('anon', 'public.submit_external_share_response(text,text,text,text,uuid,text,text,text)', 'execute'),
  'an anonymous visitor never calls the response function directly'
);

-- 202608090003: two register types the app writes. lessons_learned was added to the app in
-- August without ever being added here, so saving one failed on the check constraint.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 'delay-supervisor@example.test', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO Delay Report', 'codeco-delay-report', 'Delay Supervisor')$$,
  'an organization can be bootstrapped for this scenario'
);
select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'PDR-TEST-001', 'Vertragingsrapport', 'Paramaribo', 'Opdrachtgever', 'B1', 'Gebouw 1', 'Hoofdaannemer')$query$,
    (select id from public.organizations where slug = 'codeco-delay-report')
  ),
  'a project workspace can be created for this scenario'
);

create temporary table delay_scenario (label text primary key, entry_number text) on commit drop;

insert into delay_scenario (label, entry_number)
select 'delay', (public.create_project_register_entry(
  project.id, building.id, null, 'delay_report',
  'Betonwerk · levering wapening te laat',
  now(), null, null,
  jsonb_build_object(
    'schema', 'codeco.delay-report.v1',
    'delay_duration_days', 5,
    'original_finish_date', '2026-08-31',
    'new_expected_finish_date', '2026-09-05'
  ),
  'delay-report-test-1'
)).entry_number
from public.projects project
join public.buildings building on building.project_id = project.id
where project.code = 'PDR-TEST-001';

select is(
  (select entry_number from delay_scenario where label = 'delay'),
  'PDR-0001',
  'a delay report carries the number the client writes on their own form'
);

insert into delay_scenario (label, entry_number)
select 'lesson', (public.create_project_register_entry(
  project.id, building.id, null, 'lessons_learned',
  'Wapening te laat besteld',
  now(), null, null,
  jsonb_build_object('issue', 'Wapening te laat besteld.', 'lesson_status', 'open'),
  'lessons-learned-test-1'
)).entry_number
from public.projects project
join public.buildings building on building.project_id = project.id
where project.code = 'PDR-TEST-001';

select is(
  (select entry_number from delay_scenario where label = 'lesson'),
  'LL-0001',
  'a lesson learned is accepted by the database and numbered LL, not LESS'
);

-- A delay report is not a controlled document: it is drawn up on site, not exchanged as a
-- numbered contract document with a formal response code, so the controlled-document
-- fields are deliberately not demanded of it.
select lives_ok(
  format(
    $query$select public.create_project_register_entry(
      %L::uuid, %L::uuid, null, 'delay_report', 'Tweede vertraging',
      now(), null, null, '{}'::jsonb, 'delay-report-test-2')$query$,
    (select project.id from public.projects project where project.code = 'PDR-TEST-001'),
    (select building.id from public.buildings building
     join public.projects project on project.id = building.project_id
     where project.code = 'PDR-TEST-001' limit 1)
  ),
  'a delay report is not held to the controlled-document fields'
);

-- A change order still is one, and still is.
select throws_ok(
  format(
    $query$select public.create_project_register_entry(
      %L::uuid, %L::uuid, null, 'change_order', 'Wijziging zonder velden',
      now(), null, null, '{}'::jsonb, 'change-order-test-1')$query$,
    (select project.id from public.projects project where project.code = 'PDR-TEST-001'),
    (select building.id from public.buildings building
     join public.projects project on project.id = building.project_id
     where project.code = 'PDR-TEST-001' limit 1)
  ),
  '22023',
  'Controlled document fields are incomplete or invalid',
  'a change order is still held to the controlled-document fields'
);

-- A register type nobody has defined stays refused, so the constraint is doing its job.
select throws_ok(
  format(
    $query$select public.create_project_register_entry(
      %L::uuid, %L::uuid, null, 'not_a_register_type', 'Onbekend type',
      now(), null, null, '{}'::jsonb, 'unknown-type-test-1')$query$,
    (select project.id from public.projects project where project.code = 'PDR-TEST-001'),
    (select building.id from public.buildings building
     join public.projects project on project.id = building.project_id
     where project.code = 'PDR-TEST-001' limit 1)
  ),
  '23514'
);

select is(
  (select count(*)::integer from public.project_register_entries entry
   join public.projects project on project.id = entry.project_id
   where project.code = 'PDR-TEST-001' and entry.register_type = 'delay_report'),
  2,
  'both delay reports are stored'
);

select * from finish();
rollback;
