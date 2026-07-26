begin;
set local search_path = extensions, pgtap, public;

select plan(69);

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
select has_table('public', 'visual_captures', 'visual evidence capture records exist');
select has_table('public', 'visual_annotations', 'visual issue marker records exist');
select has_table('public', 'drawing_pins', 'drawing-to-record pin links exist');
select has_table('public', 'drawing_markups', 'audited drawing markup overlays exist');
select has_table('public', 'checklist_library_templates', 'the 100-template checklist library exists');
select has_table('public', 'push_subscriptions', 'device push subscriptions are stored per user');
select has_table('public', 'media_folders', 'project media folders exist');
select has_table('public', 'external_share_links', 'expiring external share links exist');
select has_column('public', 'project_settings', 'push_notifications_enabled', 'projects can enable automatic push delivery');
select has_column('public', 'notifications', 'push_status', 'notifications track push delivery');
select has_column('public', 'files', 'folder_id', 'files can be organized in project folders');

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
select has_function(
  'public',
  'create_drawing_pin',
  array['uuid', 'integer', 'numeric', 'numeric', 'text', 'uuid', 'text', 'text'],
  'guarded drawing pin function exists'
);
select has_function(
  'public',
  'create_drawing_markup',
  array['uuid', 'integer', 'text', 'jsonb', 'text', 'numeric', 'text', 'text'],
  'guarded drawing markup function exists'
);
select has_function(
  'public',
  'build_period_report_snapshot',
  array['uuid', 'date', 'date'],
  'permission-filtered period report snapshot function exists'
);
select has_function(
  'public',
  'import_project_boq',
  array['uuid', 'uuid', 'uuid', 'jsonb', 'text'],
  'atomic BOQ import function exists'
);
select has_function(
  'public',
  'install_checklist_library_template',
  array['uuid', 'text'],
  'versioned checklist library installer exists'
);
select has_function('public', 'create_media_folder', array['uuid', 'uuid', 'uuid', 'text', 'text'], 'guarded media folder creation exists');
select has_function('public', 'create_external_share_link', array['uuid', 'text', 'uuid', 'integer'], 'opaque external link creation exists');
select has_function('public', 'resolve_external_share_link', array['text'], 'server-only external link resolution exists');
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
select policies_are(
  'public',
  'visual_captures',
  array['visual_captures_select'],
  'visual capture mutations are restricted to guarded RPCs'
);
select policies_are(
  'public',
  'visual_annotations',
  array['visual_annotations_select'],
  'visual marker mutations are restricted to guarded RPCs'
);
select policies_are(
  'public',
  'drawing_pins',
  array['drawing_pins_select'],
  'drawing pin mutations are restricted to guarded RPCs'
);
select policies_are(
  'public',
  'drawing_markups',
  array['drawing_markups_select'],
  'drawing markup mutations are restricted to guarded RPCs'
);
select policies_are(
  'public',
  'checklist_library_templates',
  array['checklist_library_templates_select'],
  'the checklist catalog is authenticated read-only data'
);
select is(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('visual_captures','visual_annotations','drawing_pins','drawing_markups')),
  4::bigint,
  'visual evidence, drawing pins and markup publish authorized realtime changes'
);

select has_trigger('public', 'report_versions', 'report_versions_immutable', 'report versions reject mutation');
select has_trigger('public', 'audit_events', 'audit_events_immutable', 'audit events reject mutation');
select has_trigger('public', 'day_reports', 'day_reports_status_guard', 'report status transitions are database-enforced');
select has_trigger('public', 'actions', 'actions_status_guard', 'action verification is database-enforced');
select has_trigger('public', 'day_start_checks', 'day_start_checks_audit', 'project-start answers are audited');
select has_trigger('public', 'day_closeouts', 'day_closeouts_audit', 'daily closeout answers are audited');
select has_trigger('public', 'drawing_pins', 'drawing_pins_audit', 'drawing pin links are audited');
select has_trigger('public', 'drawing_markups', 'drawing_markups_audit', 'drawing markup overlays are audited');
select has_column('public', 'notifications', 'email_status', 'notifications track their email delivery status');
select is((select count(*) from public.checklist_library_templates), 103::bigint, 'the client checklist catalog contains exactly 103 standards');

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
        'backup_runs', 'production_readiness_items', 'visual_captures',
        'visual_annotations', 'drawing_pins', 'drawing_markups',
        'checklist_library_templates'
      ])
      and relation.relrowsecurity
  $$,
  $$ values (44::bigint) $$,
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
