begin;
set local search_path = extensions, pgtap, public;
select plan(2);
-- Uses any inspection that already has an executor; everything rolls back.
select id as inspection_id, executed_by from public.inspections where executed_by is not null limit 1 \gset
select count(*) as before from public.notifications where notification_type = 'inspection_scheduled' \gset
update public.inspections set planned_at = now() + interval '2 days', status = 'planned' where id = :'inspection_id';
select is((select count(*)::integer from public.notifications where notification_type = 'inspection_scheduled') - :before, 1,
  'planning or rescheduling an inspection notifies its executor');
update public.inspections set planned_at = planned_at where id = :'inspection_id';
select is((select count(*)::integer from public.notifications where notification_type = 'inspection_scheduled') - :before, 1,
  'a repeated save sends nothing twice');
select * from finish();
rollback;
