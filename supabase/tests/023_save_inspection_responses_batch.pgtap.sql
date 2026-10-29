begin;
set local search_path = extensions, pgtap, public;

select plan(6);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000023a1', 'authenticated', 'authenticated', 'batch-inspector@example.test', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}';

select lives_ok($$select public.bootstrap_organization('Batch Org', 'batch-org', 'Batch Inspector')$$, 'organization is bootstrapped');
select lives_ok(
  format($q$select public.create_project_workspace(%L::uuid, 'BATCH-1', 'Batch project', 'Paramaribo', 'Opdrachtgever', 'HOOFD', 'Hoofdgebouw', 'Hoofdaannemer')$q$,
    (select id from public.organizations where slug = 'batch-org')),
  'project workspace is created'
);
select lives_ok(
  format($q$select public.create_day_report(%L::uuid, current_date, 'batch-report')$q$, (select id from public.projects where code = 'BATCH-1')),
  'a day report exists'
);
select lives_ok(
  format($q$select public.start_project_inspection(%L::uuid, %L::uuid, %L::uuid, %L::uuid, 'Batch controle', 'batch-inspection')$q$,
    (select id from public.projects where code = 'BATCH-1'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'BATCH-1')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'BATCH-1')),
    (select id from public.checklist_templates where project_id = (select id from public.projects where code = 'BATCH-1') and code = 'INS-DAILY')),
  'an inspection is started'
);

select is(
  (select public.save_inspection_responses(
    (select id from public.inspections),
    (select jsonb_agg(jsonb_build_object('checklist_item_id', item.id, 'result', 'pass', 'notes', 'akkoord'))
       from public.checklist_items item where item.template_id = (select template_id from public.inspections))
  )),
  5,
  'one call stores every answer of the checklist'
);

select throws_ok(
  format($q$select public.save_inspection_responses(%L::uuid, '[{"checklist_item_id":"00000000-0000-0000-0000-00000000dead","result":"pass","notes":""}]'::jsonb)$q$,
    (select id from public.inspections)),
  '23514', null,
  'an item that is not part of the checklist is refused, with the same guard as a single answer'
);

select * from finish();
rollback;
