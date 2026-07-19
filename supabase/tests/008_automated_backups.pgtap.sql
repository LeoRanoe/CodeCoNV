begin;
set local search_path = extensions, pgtap, public;

select plan(23);

select has_column('public', 'backup_runs', 'retention_tier', 'scheduled backups expose a retention tier');
select col_is_null('public', 'backup_runs', 'created_by', 'scheduled system jobs may omit a browser actor');
select has_function(
  'public', 'build_scheduled_backup_export', array['uuid', 'uuid'],
  'service-only scheduled backup export exists'
);
select has_function(
  'public', 'refresh_all_project_notifications', array[]::text[],
  'service-only daily notification refresh exists'
);
select has_function(
  'public', 'record_scheduled_backup_failure', array['uuid', 'text'],
  'service-only backup failure notifier exists'
);

create temporary table scheduled_backup_manifest (value jsonb) on commit drop;
grant select, insert on scheduled_backup_manifest to authenticated, service_role;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'backup-admin@example.test', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO Backup', 'codeco-backup', 'Backup Admin')$$,
  'backup test organization can be bootstrapped'
);
select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'BACK-001', 'Backup project', 'Paramaribo', 'Opdrachtgever', 'HOOFD', 'Hoofdgebouw', 'Aannemer')$query$,
    (select id from public.organizations where slug = 'codeco-backup')
  ),
  'backup test project can be created'
);
select lives_ok(
  format(
    $query$select public.create_day_report(%L::uuid, current_date, 'backup-report-idempotency')$query$,
    (select id from public.projects where code = 'BACK-001')
  ),
  'backup source report can be created'
);
select ok(
  not has_function_privilege('authenticated', 'public.build_scheduled_backup_export(uuid,uuid)', 'execute'),
  'authenticated browsers cannot execute a scheduled export'
);

reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select lives_ok(
  format(
    $query$insert into public.backup_runs (
      organization_id, run_type, status, schema_version, idempotency_key, created_by
    ) values (%L::uuid, 'scheduled', 'exporting', '202607190003', 'scheduled:test:organization', null)$query$,
    (select id from public.organizations where slug = 'codeco-backup')
  ),
  'service role can reserve a scheduled backup without a browser actor'
);
select lives_ok(
  format(
    $query$insert into scheduled_backup_manifest (value)
      select public.build_scheduled_backup_export(%L::uuid, %L::uuid)$query$,
    (select id from public.organizations where slug = 'codeco-backup'),
    (select id from public.backup_runs where idempotency_key = 'scheduled:test:organization')
  ),
  'service role can build the complete organization manifest'
);
select is(
  (select value ->> 'schema_version' from scheduled_backup_manifest),
  '202607190003',
  'scheduled manifest records the current schema version'
);
select is(
  (select jsonb_array_length(value -> 'data' -> 'organizations') from scheduled_backup_manifest),
  1,
  'scheduled manifest contains its organization'
);
select is(
  (select jsonb_array_length(value -> 'data' -> 'projects') from scheduled_backup_manifest),
  1,
  'scheduled manifest contains organization projects'
);
select is(
  (select jsonb_array_length(value -> 'data' -> 'day_reports') from scheduled_backup_manifest),
  1,
  'scheduled manifest contains project records'
);
select is(
  (select jsonb_array_length(value -> 'data' -> 'backup_runs') from scheduled_backup_manifest),
  1,
  'scheduled manifest contains backup audit metadata'
);
select is(
  (select (value -> 'record_counts' ->> 'backup_runs')::integer from scheduled_backup_manifest),
  1,
  'record counts match the exported backup rows'
);
select ok(
  not ((select value -> 'data' from scheduled_backup_manifest) ? 'users'),
  'Supabase Auth users and credentials are not exported'
);
select lives_ok(
  $$select public.refresh_all_project_notifications()$$,
  'service role can run the daily notification refresh'
);
select lives_ok(
  format(
    $query$select public.record_scheduled_backup_failure(%L::uuid, 'Testback-up kon niet worden geverifieerd.')$query$,
    (select id from public.organizations where slug = 'codeco-backup')
  ),
  'service role can warn an organization administrator about a failed backup'
);
reset role;
select is(
  (select count(*) from public.notifications where notification_type = 'backup_failed'),
  1::bigint,
  'a failed backup creates one deduplicated administrator notification'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select lives_ok(
  $$select public.dry_run_backup_restore(value) from scheduled_backup_manifest$$,
  'an authorized administrator can validate the scheduled manifest without overwriting data'
);
select is(
  (select count(*) from public.backup_runs where run_type = 'restore_test' and status = 'dry_run_passed'),
  1::bigint,
  'restore integrity test is auditable'
);

reset role;
select * from finish();
rollback;
