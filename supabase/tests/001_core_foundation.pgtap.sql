begin;
set local search_path = extensions, pgtap, public;

select plan(40);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'buildings', 'buildings table exists');
select has_table('public', 'day_reports', 'day_reports table exists');
select has_table('public', 'attendance_entries', 'attendance_entries table exists');
select has_table('public', 'site_registrations', 'site_registrations table exists');
select has_table('public', 'actions', 'actions table exists');
select has_table('public', 'action_updates', 'append-only action history table exists');
select has_table('public', 'report_versions', 'report_versions table exists');
select has_table('public', 'audit_events', 'audit_events table exists');
select has_table('public', 'day_start_checks', 'day_start_checks table exists');
select has_table('public', 'day_closeouts', 'day_closeouts table exists');
select has_table('public', 'production_readiness_items', 'production readiness checklist exists');

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
select has_function(
  'public',
  'create_project_workspace',
  array['uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'text'],
  'atomic project workspace function exists'
);
select has_function(
  'public',
  'submit_day_report_for_review',
  array['uuid'],
  'validated report submission function exists'
);
select has_function(
  'public',
  'create_project_action',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'timestamp with time zone', 'text', 'text'],
  'atomic action creation function exists'
);
select has_function(
  'public',
  'transition_project_action',
  array['uuid', 'text', 'text'],
  'controlled action transition function exists'
);
select has_trigger('public', 'action_updates', 'action_updates_immutable', 'action history is immutable');
select is_definer('app_private', 'has_project_permission', array['uuid', 'text'], 'project permission helper is security definer');

select has_index('public', 'day_reports', 'day_reports_project_date_idx', 'day report lookup is indexed');
select has_index('public', 'audit_events', 'audit_events_project_time_idx', 'audit timeline is indexed');

select policies_are(
  'public',
  'day_reports',
  array[
    'day_reports_distribute', 'day_reports_insert', 'day_reports_revise',
    'day_reports_review', 'day_reports_select', 'day_reports_sign',
    'day_reports_update'
  ],
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
select policies_are(
  'public',
  'day_start_checks',
  array['day_start_checks_insert', 'day_start_checks_select', 'day_start_checks_update'],
  'project-start answers expose only the intended RLS policies'
);
select policies_are(
  'public',
  'day_closeouts',
  array['day_closeouts_insert', 'day_closeouts_select', 'day_closeouts_update'],
  'daily closeout answers expose only the intended RLS policies'
);
select policies_are(
  'public',
  'production_readiness_items',
  array['production_readiness_items_select'],
  'production readiness exposes read-only browser access and controlled RPC updates'
);

select has_trigger('public', 'report_versions', 'report_versions_immutable', 'report versions reject mutation');
select has_trigger('public', 'audit_events', 'audit_events_immutable', 'audit events reject mutation');
select has_trigger('public', 'day_reports', 'day_reports_status_guard', 'report status transitions are database-enforced');
select has_trigger('public', 'actions', 'actions_status_guard', 'action verification is database-enforced');
select has_trigger('public', 'day_start_checks', 'day_start_checks_audit', 'project-start answers are audited');
select has_trigger('public', 'day_closeouts', 'day_closeouts_audit', 'daily closeout answers are audited');

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
        'report_versions', 'audit_events', 'day_start_checks', 'day_closeouts',
        'action_updates', 'project_settings', 'location_nodes',
        'checklist_templates', 'checklist_items', 'inspections',
        'inspection_responses', 'findings', 'finding_updates', 'hse_events',
        'files', 'file_links', 'report_reviews', 'report_signatures',
        'report_distributions', 'notifications', 'project_register_entries',
        'backup_runs', 'production_readiness_items'
      ])
      and relation.relrowsecurity
  $$,
  $$ values (39::bigint) $$,
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

select ok(
  exists (
    select 1
    from pg_constraint constraint_record
    join pg_class relation on relation.oid = constraint_record.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'attendance_entries'
      and constraint_record.contype = 'u'
      and pg_get_constraintdef(constraint_record.oid) = 'UNIQUE (day_report_id, party_id, discipline)'
  ),
  'attendance can be safely retried per report, party and discipline'
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
        'site_registrations', 'actions', 'action_updates', 'report_versions', 'audit_events'
      )
  ),
  0::bigint,
  'the browser role has no physical-delete grants on project records'
);

select * from finish();
rollback;
