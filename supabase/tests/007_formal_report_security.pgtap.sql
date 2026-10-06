begin;
set local search_path = extensions, pgtap, public;

select plan(41);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', 'formal-admin@example.test', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO Formal', 'codeco-formal', 'Formal Admin')$$,
  'formal workflow organization can be bootstrapped'
);
select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'FORM-001', 'Formele rapportage', 'Paramaribo', 'Opdrachtgever', 'HOOFD', 'Hoofdgebouw', 'Aannemer')$query$,
    (select id from public.organizations where slug = 'codeco-formal')
  ),
  'formal workflow project can be created'
);
select lives_ok(
  format($query$select public.create_day_report(%L::uuid, current_date, 'formal-report-idempotency')$query$, (select id from public.projects where code = 'FORM-001')),
  'formal report can be created'
);

insert into public.day_start_checks (
  organization_id, project_id, building_id, day_report_id, weather_condition,
  temperature_c, wind_condition, shift_start, shift_end, planned_work,
  expected_workers, inspection_planned, high_risk_work, concrete_work,
  work_permit_status, drawing_status, drawing_issue_reported,
  automation_rules_snapshot, idempotency_key, created_by
)
select project.organization_id, project.id, building.id, report.id, 'sunny', 32,
  'calm', '07:00', '16:00', 'Inspectie en voortgangscontrole', 18, true,
  false, false, 'not_required', 'approved', false, '[{"id":"AUTO-DR-01"}]'::jsonb,
  'formal-start-idempotency', auth.uid()
from public.projects project
join public.buildings building on building.project_id = project.id
join public.day_reports report on report.project_id = project.id
where project.code = 'FORM-001';

insert into public.day_closeouts (
  organization_id, project_id, building_id, day_report_id, day_summary,
  weather_summary, work_performed, progress_percent, inspection_result,
  quality_issues, hse_event, variation_work_status, delay_cause, delay_hours,
  tomorrow_plan, photo_count, attachments_confirmed, idempotency_key, created_by
)
select project.organization_id, project.id, building.id, report.id,
  'Werk volgens planning uitgevoerd.', 'Zonnig, 32 graden',
  'Inspecties en voortgang zijn bevestigd.', 45, 'all_ok', false, 'none',
  'none', 'none', 0, 'Bekisting en maatvoering controleren.', 0, true,
  'formal-closeout-idempotency', auth.uid()
from public.projects project
join public.buildings building on building.project_id = project.id
join public.day_reports report on report.project_id = project.id
where project.code = 'FORM-001';

select is((select count(*) from public.day_start_checks), 1::bigint, 'project-start facts are present');
select is((select count(*) from public.day_closeouts), 1::bigint, 'daily closeout facts are present');
select lives_ok(
  format($query$select public.submit_day_report_for_review(%L::uuid)$query$, (select id from public.day_reports)),
  'complete report can be submitted'
);
select is((select status::text from public.day_reports), 'ready_for_review', 'report is ready for review');

select lives_ok(
  format($query$select public.review_day_report(%L::uuid, 'approved', 'Feiten, volledigheid en rapportopbouw gecontroleerd.', 'formal-review-idempotency')$query$, (select id from public.day_reports)),
  'authorized review freezes and approves the report atomically'
);
select is((select status::text from public.day_reports), 'approved', 'approved status is persisted');
select is((select count(*) from public.report_versions), 1::bigint, 'one immutable report version is created');
select matches((select sha256 from public.report_versions), '^[a-f0-9]{64}$', 'report version contains a valid SHA-256');
-- Snapshot contract: a 12-digit migration version, never older than the first multi-building
-- shape (202607260005) that the PDF/DOCX renderers require for new reports.
select ok(
  (select snapshot ->> 'schema_version' ~ '^\d{12}$' and snapshot ->> 'schema_version' >= '202607260005' from public.report_versions),
  'snapshot records a multi-building schema version'
);
select ok(
  (select snapshot -> 'buildings' @> '[{"name":"Hoofdgebouw"}]'::jsonb
      and jsonb_typeof(snapshot -> 'start_checks') = 'array'
      and jsonb_typeof(snapshot -> 'closeouts') = 'array'
   from public.report_versions),
  'immutable snapshot contains every project building with per-building start and closeout data'
);
select is((select snapshot -> 'created_by_profile' ->> 'display_name' from public.report_versions), 'Formal Admin', 'immutable snapshot contains the authenticated report author');
select is((select count(*) from public.report_reviews where decision = 'approved'), 1::bigint, 'approval is retained in append-only review history');

select throws_ok(
  $$insert into public.report_versions (organization_id, project_id, day_report_id, revision, template_version, snapshot, sha256, idempotency_key, created_by)
    select organization_id, project_id, id, 99, 'forged', '{}'::jsonb, repeat('a', 64), 'forged-version', auth.uid() from public.day_reports$$,
  '42501',
  'permission denied for table report_versions',
  'browser cannot bypass the validated freeze RPC'
);

select lives_ok(
  format($query$select public.sign_report_version(%L::uuid, 'supervisor', 'Formal Admin', 'Ik bevestig deze vastgezette rapportversie als supervisor.', 'contract_pending')$query$, (select id from public.day_reports)),
  'supervisor declaration can be attached to the frozen version'
);
select is((select status::text from public.day_reports), 'approved', 'report waits for all required signing roles');
select lives_ok(
  format($query$select public.sign_report_version(%L::uuid, 'project_manager', 'Formal Admin', 'Ik bevestig deze vastgezette rapportversie als projectleider.', 'contract_pending')$query$, (select id from public.day_reports)),
  'project-manager declaration can be attached'
);
select is((select status::text from public.day_reports), 'signed', 'configured required roles move report to signed');
select is((select count(*) from public.report_signatures), 2::bigint, 'two append-only signer declarations are retained');

select throws_ok(
  $$insert into public.report_signatures (organization_id, project_id, day_report_id, report_version_id, signer_user_id, signer_name, signer_role, declaration, created_by)
    select report.organization_id, report.project_id, report.id, version.id, auth.uid(), 'Vals', 'client', 'Een ongeldige directe verklaring.', auth.uid()
    from public.day_reports report join public.report_versions version on version.day_report_id = report.id$$,
  '42501',
  'permission denied for table report_signatures',
  'browser cannot forge a direct signer record'
);

select lives_ok(
  format($query$select public.record_report_distribution(%L::uuid, 'Opdrachtgever', 'contractdossier@example.test', 'manual', false)$query$, (select id from public.day_reports)),
  'actual manual distribution can be recorded'
);
select is((select status::text from public.day_reports), 'sent', 'distribution advances report to sent');
select is((select count(*) from public.report_distributions), 1::bigint, 'distribution history is retained');

select lives_ok(
  format($query$select public.start_report_revision(%L::uuid, 'Contractpartij vroeg om een feitelijke correctie.')$query$, (select id from public.day_reports)),
  'authorized reviewer can start a revision'
);
select is((select status::text from public.day_reports), 'in_progress', 'revision returns report to controlled editing');
select is((select count(*) from public.report_versions), 1::bigint, 'original frozen version remains intact during revision');

select is(public.consume_security_rate_limit('admin_invite', 10, 60), true, 'first protected request is allowed');
select is((select bool_and(public.consume_security_rate_limit('admin_invite', 10, 60)) from generate_series(1, 9)), true, 'requests through the configured hourly limit are allowed');
select is(public.consume_security_rate_limit('admin_invite', 10, 60), false, 'request above the hourly limit is rejected');
select is(public.consume_security_rate_limit('blob_upload', 2, 60), true, 'the first protected Blob upload is allowed');
select is(public.consume_security_rate_limit('blob_upload', 2, 60), true, 'Blob uploads remain allowed through their configured limit');
select is(public.consume_security_rate_limit('blob_upload', 2, 60), false, 'a Blob upload above its configured limit is rejected');
select is(public.consume_security_rate_limit('notification_push_dispatch', 1, 10), true, 'the first protected push dispatch is allowed');
select is(public.consume_security_rate_limit('notification_push_dispatch', 1, 10), false, 'a push dispatch above its configured limit is rejected');
select throws_ok(
  $$select public.consume_security_rate_limit('unknown_action', 1, 60)$$,
  '22023',
  'Invalid rate-limit configuration',
  'an action outside the fixed production allowlist is rejected'
);
select throws_ok(
  $$select public.consume_security_rate_limit('blob_upload', 101, 60)$$,
  '22023',
  'Invalid rate-limit configuration',
  'a caller cannot raise the maximum request guard above one hundred'
);
select throws_ok(
  $$select public.consume_security_rate_limit('blob_upload', 1, 1441)$$,
  '22023',
  'Invalid rate-limit configuration',
  'a caller cannot raise the rate-limit window guard above one day'
);
select has_trigger('public', 'files', 'files_storage_state_guard', 'browser file-state changes are guarded by the database');
select has_trigger('public', 'report_versions', 'report_versions_snapshot_guard', 'formal snapshot integrity is database-enforced');

reset role;
select * from finish();
rollback;
