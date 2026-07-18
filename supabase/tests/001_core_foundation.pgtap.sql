begin;
set local search_path = extensions, public;

select plan(25);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'buildings', 'buildings table exists');
select has_table('public', 'day_reports', 'day_reports table exists');
select has_table('public', 'attendance_entries', 'attendance_entries table exists');
select has_table('public', 'site_registrations', 'site_registrations table exists');
select has_table('public', 'actions', 'actions table exists');
select has_table('public', 'report_versions', 'report_versions table exists');
select has_table('public', 'audit_events', 'audit_events table exists');

select has_function('public', 'create_day_report', array['uuid', 'date', 'text'], 'atomic day-report function exists');
select has_function(
  'public',
  'create_site_registration',
  array['uuid', 'uuid', 'date', 'text', 'text', 'text', 'text', 'timestamp with time zone', 'text'],
  'idempotent registration function exists'
);
select has_function(
  'public',
  'freeze_report_version',
  array['uuid', 'text', 'jsonb', 'text', 'jsonb', 'text'],
  'immutable report-snapshot function exists'
);
select is_definer('app_private', 'has_project_permission', array['uuid', 'text'], 'project permission helper is security definer');

select has_index('public', 'day_reports', 'day_reports_project_date_idx', 'day report lookup is indexed');
select has_index('public', 'audit_events', 'audit_events_project_time_idx', 'audit timeline is indexed');

select policies_are(
  'public',
  'day_reports',
  array['day_reports_insert', 'day_reports_review', 'day_reports_select', 'day_reports_update'],
  'day reports expose only the intended RLS policies'
);
select policies_are(
  'public',
  'site_registrations',
  array['site_registrations_insert', 'site_registrations_select', 'site_registrations_update'],
  'registrations expose only the intended RLS policies'
);
select policies_are(
  'public',
  'report_versions',
  array['report_versions_insert', 'report_versions_select'],
  'report versions expose no update or delete policy'
);

select has_trigger('public', 'report_versions', 'report_versions_immutable', 'report versions reject mutation');
select has_trigger('public', 'audit_events', 'audit_events_immutable', 'audit events reject mutation');
select has_trigger('public', 'day_reports', 'day_reports_status_guard', 'report status transitions are database-enforced');
select has_trigger('public', 'actions', 'actions_status_guard', 'action verification is database-enforced');

select results_eq(
  $$
    select count(*)::bigint
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any(array[
        'profiles', 'organizations', 'permissions', 'roles', 'role_permissions',
        'organization_memberships', 'organization_member_roles', 'projects',
        'project_memberships', 'project_member_roles', 'buildings', 'parties',
        'day_reports', 'attendance_entries', 'site_registrations', 'actions',
        'report_versions', 'audit_events'
      ])
      and relation.relrowsecurity
  $$,
  $$ values (18::bigint) $$,
  'RLS is enabled on every browser-reachable table'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_record
    join pg_class relation on relation.oid = constraint_record.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'day_reports'
      and constraint_record.contype = 'u'
      and pg_get_constraintdef(constraint_record.oid) = 'UNIQUE (project_id, report_date)'
  ),
  'a project can have only one report per date'
);

select is(
  (
    select count(*)::bigint
    from information_schema.role_table_grants grant_record
    where grant_record.grantee = 'authenticated'
      and grant_record.table_schema = 'public'
      and grant_record.privilege_type = 'DELETE'
      and grant_record.table_name in (
        'projects', 'buildings', 'parties', 'day_reports', 'attendance_entries',
        'site_registrations', 'actions', 'report_versions', 'audit_events'
      )
  ),
  0::bigint,
  'the browser role has no physical-delete grants on project records'
);

select * from finish();
rollback;
