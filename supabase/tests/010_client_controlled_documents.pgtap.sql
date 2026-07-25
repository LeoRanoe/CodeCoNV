begin;
set local search_path = extensions, pgtap, public;

select plan(31);

select has_column('public', 'findings', 'issue_management', 'findings retain the client issue-management fields');
select has_table('public', 'finding_progress_updates', 'dated issue progress is stored append-only');
select has_function(
  'public',
  'create_project_finding',
  array['uuid','uuid','uuid','uuid','uuid','text','text','text','text','uuid','uuid','text','jsonb'],
  'managed finding overload exists'
);
select has_function(
  'public',
  'respond_to_controlled_project_document',
  array['uuid','jsonb','text'],
  'controlled documents have a formal response workflow'
);
select has_function(
  'public',
  'record_finding_progress',
  array['uuid','numeric','text','text','timestamp with time zone','text'],
  'issue progress can be recorded at each inspection'
);
select has_function(
  'public',
  'build_client_period_report_snapshot',
  array['uuid','date','date'],
  'client period reports have an enriched server snapshot'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_project_finding(uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text,jsonb)',
    'execute'
  ),
  'authenticated supervisors can create managed issues'
);
select ok(
  has_function_privilege('authenticated', 'public.respond_to_controlled_project_document(uuid,jsonb,text)', 'execute'),
  'authenticated document controllers can respond through the RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.record_finding_progress(uuid,numeric,text,text,timestamp with time zone,text)', 'execute'),
  'authenticated issue managers can record progress through the RPC'
);
select ok(
  not has_table_privilege('anon', 'public.finding_progress_updates', 'select'),
  'anonymous users cannot enumerate issue progress'
);
select ok(
  has_table_privilege('authenticated', 'public.finding_progress_updates', 'select'),
  'authenticated users receive table select and remain filtered by RLS'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'client-docs@example.test', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO Client Documents', 'codeco-client-documents', 'Document Controller')$$,
  'test organization can be bootstrapped'
);
select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'SU-L1054', 'Client document project', 'Paramaribo', 'Client', 'B1', 'Building B1', 'Main Contractor')$query$,
    (select id from public.organizations where slug = 'codeco-client-documents')
  ),
  'client project workspace can be created'
);
select lives_ok(
  format(
    $query$select public.create_day_report(%L::uuid, current_date, 'client-doc-report')$query$,
    (select id from public.projects where code = 'SU-L1054')
  ),
  'document issue day has a report'
);

select lives_ok(
  format(
    $query$select public.create_project_register_entry(
      %L::uuid, %L::uuid, %L::uuid, 'rfi', 'Server room detailed specification',
      now(), current_date + interval '7 days', %L::uuid,
      jsonb_build_object(
        'schema', 'codeco.controlled-document.v1',
        'document_type', 'rfi',
        'project_name', 'Client document project',
        'project_number', 'SU-L1054',
        'building_name', 'Building B1',
        'subject', 'Server room detailed specification',
        'description', 'Provide the detailed specification for the second-floor server room.',
        'issue_date', to_char(current_date, 'YYYY-MM-DD'),
        'requested_to', 'Main Contractor',
        'response', '{}'::jsonb
      ),
      'client-rfi-create'
    )$query$,
    (select id from public.projects where code = 'SU-L1054'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'SU-L1054')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'SU-L1054')),
    (select id from public.parties where project_id = (select id from public.projects where code = 'SU-L1054') and party_type = 'contractor')
  ),
  'a complete RFI is created from the client form schema'
);
select matches(
  (select entry_number from public.project_register_entries where register_type = 'rfi'),
  '^RFI-SU-L1054-[0-9]{3}$',
  'RFI numbering contains the document family and project code'
);
select is(
  (select details ->> 'schema' from public.project_register_entries where register_type = 'rfi'),
  'codeco.controlled-document.v1',
  'controlled form data is retained without flattening'
);
select throws_ok(
  format(
    $query$select public.create_project_register_entry(
      %L::uuid, %L::uuid, %L::uuid, 'rfa', 'Incomplete approval request',
      now(), null, null, '{}'::jsonb, 'client-invalid-rfa'
    )$query$,
    (select id from public.projects where code = 'SU-L1054'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'SU-L1054')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'SU-L1054'))
  ),
  '22023',
  'Controlled document fields are incomplete or invalid',
  'an incomplete controlled form is rejected atomically'
);
select lives_ok(
  format(
    $query$select public.respond_to_controlled_project_document(
      %L::uuid,
      jsonb_build_object(
        'decision', 'approved_with_comments',
        'comments', 'Approved subject to the attached coordination comments.',
        'respondent_name', 'Document Controller',
        'respondent_position', 'Lead Supervisor',
        'respondent_company', 'CODECO N.V.'
      ),
      'client-rfi-response'
    )$query$,
    (select id from public.project_register_entries where register_type = 'rfi')
  ),
  'the formal RFI response is stored'
);
select is(
  (select status from public.project_register_entries where register_type = 'rfi'),
  'approved',
  'an approved-with-comments response maps to the approved register state'
);
select is(
  (select details -> 'response' ->> 'decision' from public.project_register_entries where register_type = 'rfi'),
  'approved_with_comments',
  'the exact client response code remains available for PDF output'
);

select lives_ok(
  format(
    $query$select public.create_project_finding(
      %L::uuid, %L::uuid, %L::uuid, null, null, 'deficiency',
      'Curtain wall connection', 'Cracking is visible at the gypsum wall connection.',
      'medium', %L::uuid, null, 'client-managed-finding',
      jsonb_build_object(
        'issue_type', 'quality',
        'impact_summary', 'May delay room handover.',
        'action_steps', 'Caulk and finish the connection.',
        'escalation_required', false,
        'disposition', 'to_be_corrected',
        'expected_resolution_date', to_char(current_date + 7, 'YYYY-MM-DD'),
        'source_catalog_subject', 'Curtain wall'
      )
    )$query$,
    (select id from public.projects where code = 'SU-L1054'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'SU-L1054')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'SU-L1054')),
    (select id from public.parties where project_id = (select id from public.projects where code = 'SU-L1054') and party_type = 'contractor')
  ),
  'a managed B1 issue can be created from a catalog preset'
);
select is(
  (select issue_management ->> 'action_steps' from public.findings where title = 'Curtain wall connection'),
  'Caulk and finish the connection.',
  'the required action remains part of the issue record'
);
select lives_ok(
  format(
    $query$select public.record_finding_progress(
      %L::uuid, 40, 'to_be_corrected', 'Repair started and materials are on site.', now(), 'client-progress-40'
    )$query$,
    (select id from public.findings where title = 'Curtain wall connection')
  ),
  'a dated 40 percent inspection point can be stored'
);
select is(
  (select count(*) from public.finding_progress_updates),
  1::bigint,
  'the first progress point is append-only'
);
select is(
  (select status from public.findings where title = 'Curtain wall connection'),
  'in_progress',
  'positive progress automatically starts follow-up'
);
select lives_ok(
  format(
    $query$select public.record_finding_progress(
      %L::uuid, 100, 'validated', 'Repair is complete and ready for independent verification.', now(), 'client-progress-100'
    )$query$,
    (select id from public.findings where title = 'Curtain wall connection')
  ),
  'a dated 100 percent inspection point can be stored'
);
select is(
  (select status from public.findings where title = 'Curtain wall connection'),
  'ready_for_verification',
  '100 percent stops at ready for human verification'
);
select ok(
  (select verified_at is null from public.findings where title = 'Curtain wall connection'),
  'automatic progress never verifies or closes a finding'
);
select is(
  (public.build_client_period_report_snapshot(
    (select id from public.projects where code = 'SU-L1054'),
    current_date - 1,
    current_date + 1
  ) ->> 'schema_version'),
  '202607240001',
  'the enriched client snapshot is versioned'
);
select ok(
  public.build_client_period_report_snapshot(
    (select id from public.projects where code = 'SU-L1054'),
    current_date - 1,
    current_date + 1
  ) ?& array['buildings','parties','files','media_folders','finding_progress_updates'],
  'the report snapshot reuses all central context required by the client formats'
);

select * from finish();
rollback;
