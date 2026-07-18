begin;
set local search_path = extensions, pgtap, public;

select plan(36);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-0000-0000-0000000000d1',
  'authenticated', 'authenticated', 'operations-admin@example.test', now(), now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO Operations', 'codeco-operations', 'Operations Admin')$$,
  'operations test organization can be bootstrapped'
);

select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'OPS-001', 'Operationele MVP', 'Paramaribo', 'Opdrachtgever', 'HOOFD', 'Hoofdgebouw', 'Hoofdaannemer')$query$,
    (select id from public.organizations where slug = 'codeco-operations')
  ),
  'project workspace can be created'
);

select is((select count(*) from public.project_settings), 1::bigint, 'project settings are initialized automatically');
select is((select count(*) from public.checklist_templates where status = 'published'), 2::bigint, 'inspection and HSE templates are published');
select is((select count(*) from public.checklist_items), 10::bigint, 'default templates contain ten explicit checks');
select is((select max_file_size_mb from public.project_settings), 25, 'free-pilot file limit defaults to 25 MB');

select lives_ok(
  format(
    $query$select public.create_project_checklist(%L::uuid, 'inspection', 'MAT-CERT', 'Materiaalcertificaten', array['Is het certificaat aanwezig?', 'Komt de heat number overeen?'])$query$,
    (select id from public.projects where code = 'OPS-001')
  ),
  'custom checklist and its questions are published atomically'
);
select is(
  (select count(*) from public.checklist_items item join public.checklist_templates template on template.id = item.template_id where template.code = 'MAT-CERT'),
  2::bigint,
  'atomic checklist creation persists every requested question'
);
select throws_ok(
  format(
    $query$select public.create_project_checklist(%L::uuid, 'inspection', 'BAD-CHECK', 'Ongeldige checklist', array['Geldige vraag', ''])$query$,
    (select id from public.projects where code = 'OPS-001')
  ),
  '22023',
  'Checklist prompts cannot be empty',
  'an invalid prompt rolls the entire checklist transaction back'
);
select is((select count(*) from public.checklist_templates where code = 'BAD-CHECK'), 0::bigint, 'failed atomic creation leaves no empty template behind');

select lives_ok(
  format(
    $query$select public.create_day_report(%L::uuid, current_date, 'ops-report-idempotency')$query$,
    (select id from public.projects where code = 'OPS-001')
  ),
  'a report is created for the inspection day'
);

select lives_ok(
  format(
    $query$select public.start_project_inspection(%L::uuid, %L::uuid, %L::uuid, %L::uuid, 'Dagelijkse controle fundering', 'ops-inspection-idempotency')$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.checklist_templates where project_id = (select id from public.projects where code = 'OPS-001') and code = 'INS-DAILY')
  ),
  'published checklist starts a central inspection'
);

select matches((select inspection_number from public.inspections), '^INS-[0-9]{4}-[0-9]{4}$', 'inspection receives a traceable number');
select is((select status::text from public.inspections), 'in_progress', 'inspection starts in progress');

select lives_ok(
  format(
    $query$
      select public.save_inspection_response(%1$L::uuid, item.id,
        case when item.sort_order = 20 then 'fail' else 'pass' end,
        null, null,
        case when item.sort_order = 20 then 'Materiaalcertificaat ontbreekt.' else 'Gecontroleerd en akkoord.' end,
        'ops-response-' || item.sort_order::text)
      from public.checklist_items item
      where item.template_id = %2$L::uuid
      order by item.sort_order
    $query$,
    (select id from public.inspections),
    (select template_id from public.inspections)
  ),
  'all checklist responses are stored through the guarded RPC'
);

select is((select count(*) from public.inspection_responses), 5::bigint, 'five inspection answers are stored');
select is((select count(*) from public.inspection_responses where is_nonconforming), 1::bigint, 'the deterministic failure rule marks one answer nonconforming');

select lives_ok(
  format($query$select public.complete_project_inspection(%L::uuid)$query$, (select id from public.inspections)),
  'complete inspection validates required questions and applies visible rules'
);
select is((select status::text from public.inspections), 'failed', 'inspection fails when one answer is nonconforming');
select is((select count(*) from public.findings), 1::bigint, 'failed answer creates exactly one finding');
select matches((select finding_number from public.findings), '^Q-[0-9]{4}-[0-9]{4}$', 'automatic finding receives a traceable number');
select ok((select due_at > now() from public.findings), 'severity rule assigns a future deadline');
select is((select count(*) from public.finding_updates where update_type = 'created'), 1::bigint, 'finding creation is retained in immutable history');

select lives_ok(
  format($query$select public.transition_project_finding(%L::uuid, 'in_progress', 'Herstel is gestart.', 'Ontbrekende documentcontrole', 'Certificaat opgevraagd', null)$query$, (select id from public.findings)),
  'finding can enter corrective execution'
);
select lives_ok(
  format($query$select public.transition_project_finding(%L::uuid, 'ready_for_verification', 'Herstelbewijs is gereed.', null, null, 'Certificaat ontvangen en materiaal opnieuw gecontroleerd.')$query$, (select id from public.findings)),
  'finding can be submitted with a final measure'
);
select lives_ok(
  format($query$select public.transition_project_finding(%L::uuid, 'closed', 'Onafhankelijke verificatie op locatie akkoord.', null, null, null)$query$, (select id from public.findings)),
  'authorized verifier closes the finding'
);
select is((select status::text from public.findings), 'closed', 'verified finding is closed');
select ok((select verified_by is not null and verified_at is not null from public.findings), 'verification actor and timestamp are retained');

select lives_ok(
  format(
    $query$select public.create_project_hse_event(%L::uuid, %L::uuid, %L::uuid, 'near_miss', 'Los materiaal boven looproute', 'Materiaal dreigde van hoogte te vallen.', 'critical', 'Zone afgezet en materiaal verwijderd.', true, now(), 'ops-hse-idempotency')$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001'))
  ),
  'critical HSE event is centrally registered'
);
select matches((select event_number from public.hse_events), '^HSE-[0-9]{4}-[0-9]{4}$', 'HSE event receives a traceable number');
select is((select status::text from public.hse_events), 'action_required', 'critical HSE event requires action');
select is((select count(*) from public.notifications where notification_type = 'hse_critical'), 1::bigint, 'urgent HSE notification is deduplicated per recipient');

select lives_ok(
  format(
    $query$select public.create_project_register_entry(%L::uuid, %L::uuid, %L::uuid, 'delivery', 'Levering wapeningsstaal', now(), null, %L::uuid, '{"quantity":12,"unit":"ton","status":"received"}'::jsonb, 'ops-delivery-idempotency')$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.parties where project_id = (select id from public.projects where code = 'OPS-001') and party_type = 'contractor')
  ),
  'specialized project register entry is saved centrally'
);
select is((select register_type::text from public.project_register_entries), 'delivery', 'delivery register classification is persisted');

select ok(
  (select (public.create_manual_backup_export(
    (select id from public.organizations where slug = 'codeco-operations'),
    (select id from public.projects where code = 'OPS-001'),
    'ops-backup-idempotency'
  ) ->> 'schema_version') = '202607180008'),
  'manual export contains the current schema version'
);
select is((select status::text from public.backup_runs where run_type = 'manual'), 'exporting', 'backup remains exporting until the browser checksum is confirmed');

reset role;
select * from finish();
rollback;
