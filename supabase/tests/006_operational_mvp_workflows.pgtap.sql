begin;
set local search_path = extensions, pgtap, public;

select plan(80);

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
select ok(not (select email_notifications_enabled from public.project_settings), 'project email notifications are disabled by default');
select ok((select push_notifications_enabled from public.project_settings), 'project push notifications are enabled by default');

select lives_ok(
  format(
    $query$select public.install_checklist_library_template(%L::uuid, 'LIB-021')$query$,
    (select id from public.projects where code = 'OPS-001')
  ),
  'a standard checklist can be installed from the 100-template client library'
);
select is((select count(*) from public.checklist_templates where code = 'LIB-021' and status = 'published'), 1::bigint, 'library installation creates a published project version');
select is((select count(*) from public.checklist_items item join public.checklist_templates template on template.id = item.template_id where template.code = 'LIB-021'), 5::bigint, 'installed library checklist contains its five mandatory controls');

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

select lives_ok(
  format(
    $query$select public.import_project_boq(%L::uuid,%L::uuid,%L::uuid,'[{"code":"B001","description":"Betonnen funderingsbalk","quantity":12,"unit":"m3","unit_rate":650,"contract_value":7800,"progress_percent":25},{"code":"B002","description":"Wapening fundering","quantity":1800,"unit":"kg","unit_rate":2.5,"contract_value":4500,"progress_percent":40}]'::jsonb,'ops-boq-import-1')$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001'))
  ),
  'a validated BOQ is imported atomically'
);
select is((select count(*) from public.project_register_entries where register_type = 'boq'), 2::bigint, 'every BOQ row becomes a controlled progress record');
select ok((select (details ->> 'progress_percent')::numeric = 25 and (details ->> 'contract_value')::numeric = 7800 from public.project_register_entries where register_type = 'boq' and details ->> 'code' = 'B001'), 'BOQ quantity, contract value and progress are retained');
select lives_ok(
  format(
    $query$select public.import_project_boq(%L::uuid,%L::uuid,%L::uuid,'[{"code":"B001","description":"Betonnen funderingsbalk","progress_percent":25},{"code":"B002","description":"Wapening fundering","progress_percent":40}]'::jsonb,'ops-boq-import-1')$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001'))
  ),
  'a repeated BOQ import request is idempotent'
);
select is((select count(*) from public.project_register_entries where register_type = 'boq'), 2::bigint, 'the repeated BOQ import creates no duplicate rows');

select lives_ok(
  format(
    $query$select public.create_project_register_entry(%L::uuid, %L::uuid, %L::uuid, 'rfi', 'Detail aansluiting gevel', now(), null, null, '{"question":"Bevestig het constructieve aansluitdetail."}'::jsonb, 'ops-rfi-idempotency')$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001'))
  ),
  'an RFI exists for the drawing link workflow'
);

reset role;
set local request.jwt.claims = '{"role":"service_role"}';
select lives_ok(
  format(
    $query$
      insert into public.files (
        organization_id, project_id, building_id, storage_object_key, original_name,
        mime_type, size_bytes, sha256, status, category, created_by
      ) values
        (%1$L::uuid, %2$L::uuid, %3$L::uuid, 'projects/test/photo-1', 'room-1-wall.jpg', 'image/jpeg', 1200000, repeat('a', 64), 'available', 'photo', '00000000-0000-0000-0000-0000000000d1'::uuid),
        (%1$L::uuid, %2$L::uuid, %3$L::uuid, 'projects/test/panorama-1', 'room-1-360.jpg', 'image/jpeg', 4200000, repeat('b', 64), 'available', 'photo', '00000000-0000-0000-0000-0000000000d1'::uuid),
        (%1$L::uuid, %2$L::uuid, %3$L::uuid, 'projects/test/drawing-1', 'A112-rev-2.pdf', 'application/pdf', 2100000, repeat('c', 64), 'available', 'drawing', '00000000-0000-0000-0000-0000000000d1'::uuid)
    $query$,
    (select id from public.organizations where slug = 'codeco-operations'),
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001'))
  ),
  'private image metadata can be prepared for visual evidence tests'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select lives_ok(
  format(
    $query$select public.create_visual_capture(%L::uuid,%L::uuid,null,%L::uuid,%L::uuid,'photo','Kamer 1 noordwand','Controle pleisterwerk','Kamer 1 · noordwand',null,null,now())$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.files where storage_object_key = 'projects/test/photo-1')
  ),
  'a standard project photo is registered as the default visual type'
);

select lives_ok(
  format(
    $query$select public.create_visual_capture(%L::uuid,%L::uuid,null,%L::uuid,%L::uuid,'panorama','Kamer 1 rondgang','Equirectangulair 360 beeld','Kamer 1','Begane grond tour',1,now())$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.files where storage_object_key = 'projects/test/panorama-1')
  ),
  'an optional 360 panorama is registered in an ordered tour'
);
select is((select count(*) from public.visual_captures), 2::bigint, 'standard and 360 visual records coexist');
select ok(position('created_by' in (select qual from pg_policies where schemaname = 'public' and tablename = 'files' and policyname = 'files_select')) = 0, 'file reads never survive revoked project access through creator ownership');
select ok(position('created_by' in (select qual from pg_policies where schemaname = 'public' and tablename = 'visual_captures' and policyname = 'visual_captures_select')) = 0, 'visual capture reads always follow current project permissions');
select ok(position('created_by' in (select qual from pg_policies where schemaname = 'public' and tablename = 'visual_annotations' and policyname = 'visual_annotations_select')) = 0, 'visual annotation reads always follow current project permissions');
select ok((select capture_type = 'panorama' and tour_name = 'Begane grond tour' and tour_order = 1 from public.visual_captures where title = 'Kamer 1 rondgang'), 'panorama tour identity and order are retained');
select throws_ok(
  format(
    $query$select public.create_visual_capture(%L::uuid,%L::uuid,null,%L::uuid,%L::uuid,'photo','Ongeldige tourfoto',null,'Kamer 1','Tour',2,now())$query$,
    (select id from public.projects where code = 'OPS-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'OPS-001')),
    (select id from public.files where storage_object_key = 'projects/test/photo-1')
  ),
  '22023',
  'Only panoramas can be assigned to a tour',
  'ordinary photos cannot be mislabeled as tour scenes'
);

select lives_ok(
  format(
    $query$select public.create_visual_annotation_finding(%L::uuid,'photo',0.42,0.31,null,null,'deficiency','Beschadigd pleisterwerk','Scheur en afbrokkeling zichtbaar op de noordwand.','medium',%L::uuid,'visual-photo-issue-1')$query$,
    (select id from public.visual_captures where capture_type = 'photo'),
    (select id from public.parties where project_id = (select id from public.projects where code = 'OPS-001') and party_type = 'contractor')
  ),
  'clicking a standard photo creates an exact marker and finding atomically'
);
select is((select count(*) from public.visual_annotations), 1::bigint, 'the first photo issue has one marker');
select is((select count(*) from public.file_links where relationship = 'annotation'), 1::bigint, 'the original image is linked to the formal finding');
select throws_ok(
  format(
    $query$select public.create_visual_annotation_finding(%L::uuid,'photo',0.5,0.5,null,null,'observation','Verkeerde coördinaten','Mag niet op panorama worden geplaatst.','low',null,'visual-wrong-mode-1')$query$,
    (select id from public.visual_captures where capture_type = 'panorama')
  ),
  '22023',
  'Annotation coordinates do not match the visual type',
  'a panorama rejects ordinary photo coordinates'
);
select lives_ok(
  format(
    $query$select public.create_visual_annotation_finding(%L::uuid,'spherical',null,null,0.55,0.12,'deviation','Beschadiging in 360 beeld','Beschadiging exact op de westwand gemarkeerd.','high',null,'visual-panorama-issue-1')$query$,
    (select id from public.visual_captures where capture_type = 'panorama')
  ),
  'a panorama click stores spherical coordinates with a formal finding'
);
select is((select count(*) from public.visual_annotations), 2::bigint, 'photo and panorama issue markers are both retained');
select lives_ok(
  format($query$select public.void_visual_annotation(%L::uuid,'Marker was placed on the wrong surface.')$query$, (select id from public.visual_annotations where idempotency_key = 'visual-photo-issue-1')),
  'an authorized manager can void an incorrectly placed marker with a reason'
);
select ok((select status = 'void' and void_reason = 'Marker was placed on the wrong surface.' from public.visual_annotations where idempotency_key = 'visual-photo-issue-1'), 'void status and reason remain auditable');

select lives_ok(
  format(
    $query$select public.create_drawing_pin(%L::uuid,2,0.41,0.27,'rfi',%L::uuid,'Pin at the façade connection.','drawing-rfi-pin-1')$query$,
    (select id from public.files where storage_object_key = 'projects/test/drawing-1'),
    (select id from public.project_register_entries where register_type = 'rfi')
  ),
  'a PDF page location can be linked to an existing RFI'
);
select ok(
  (select page_number = 2 and x_ratio = 0.41 and y_ratio = 0.27 and linked_record_number like 'RFI-%' from public.drawing_pins),
  'drawing pin retains normalized coordinates, page and RFI identity'
);
select lives_ok(
  format(
    $query$select public.create_drawing_pin(%L::uuid,2,0.41,0.27,'rfi',%L::uuid,'Repeated client request.','drawing-rfi-pin-1')$query$,
    (select id from public.files where storage_object_key = 'projects/test/drawing-1'),
    (select id from public.project_register_entries where register_type = 'rfi')
  ),
  'drawing link creation is idempotent for a repeated request'
);
select is((select count(*) from public.drawing_pins), 1::bigint, 'idempotent drawing link creates only one pin');
select throws_ok(
  format(
    $query$select public.create_drawing_pin(%L::uuid,1,1.2,0.4,'rfi',%L::uuid,null,'drawing-rfi-invalid-1')$query$,
    (select id from public.files where storage_object_key = 'projects/test/drawing-1'),
    (select id from public.project_register_entries where register_type = 'rfi')
  ),
  '22023',
  'Invalid drawing page or pin coordinates',
  'drawing pins reject coordinates outside the page'
);
select ok(position('created_by' in (select qual from pg_policies where schemaname = 'public' and tablename = 'drawing_pins' and policyname = 'drawing_pins_select')) = 0, 'drawing pin reads always follow current project permissions');

select lives_ok(
  format(
    $query$select public.create_drawing_markup(%L::uuid,2,'freehand','{"points":[{"x":0.10,"y":0.20},{"x":0.18,"y":0.25},{"x":0.24,"y":0.21}]}'::jsonb,'#D92D20',3,null,'drawing-markup-freehand-1')$query$,
    (select id from public.files where storage_object_key = 'projects/test/drawing-1')
  ),
  'freehand markup is stored on the exact PDF page'
);
select ok((select page_number = 2 and markup_type = 'freehand' and jsonb_array_length(geometry -> 'points') = 3 from public.drawing_markups where idempotency_key = 'drawing-markup-freehand-1'), 'freehand normalized geometry and page are retained');
select lives_ok(
  format(
    $query$select public.create_drawing_markup(%L::uuid,2,'text','{"position":{"x":0.33,"y":0.44}}'::jsonb,'#216A99',2,'Controleer sparing','drawing-markup-text-1')$query$,
    (select id from public.files where storage_object_key = 'projects/test/drawing-1')
  ),
  'text markup is stored as a separate audited overlay'
);
select throws_ok(
  format(
    $query$select public.create_drawing_markup(%L::uuid,2,'arrow','{"start":{"x":0.2,"y":0.2},"end":{"x":1.2,"y":0.4}}'::jsonb,'#D92D20',3,null,'drawing-markup-invalid-1')$query$,
    (select id from public.files where storage_object_key = 'projects/test/drawing-1')
  ),
  '22023',
  'Invalid normalized markup geometry',
  'drawing markup rejects geometry outside the page'
);
select ok(position('created_by' in (select qual from pg_policies where schemaname = 'public' and tablename = 'drawing_markups' and policyname = 'drawing_markups_select')) = 0, 'drawing markup reads always follow current project permissions');

select lives_ok(
  format(
    $query$select public.build_period_report_snapshot(%L::uuid,current_date,current_date)$query$,
    (select id from public.projects where code = 'OPS-001')
  ),
  'a daily, weekly, monthly or free-period snapshot can be built from central records'
);
select ok(
  (select jsonb_array_length(public.build_period_report_snapshot(id,current_date,current_date) -> 'day_reports') = 1 from public.projects where code = 'OPS-001'),
  'period snapshot contains the report day in the selected range'
);
select is((select push_status::text from public.notifications where notification_type = 'hse_critical'), 'pending', 'new deadline and critical notifications enter the push queue');

select ok(
  (select (public.create_manual_backup_export(
    (select id from public.organizations where slug = 'codeco-operations'),
    (select id from public.projects where code = 'OPS-001'),
    'ops-backup-idempotency'
  ) ->> 'schema_version') = '202607190003'),
  'manual export contains the current schema version'
);
select ok((select (record_counts ->> 'visual_captures')::integer = 2 and (record_counts ->> 'visual_annotations')::integer = 2 and (record_counts ->> 'drawing_pins')::integer = 1 from public.backup_runs where run_type = 'manual'), 'manual backup includes visual captures, annotations and drawing pins');
select is((select (record_counts ->> 'drawing_markups')::integer from public.backup_runs where run_type = 'manual'), 2, 'manual backup includes drawing markup overlays');
select is((select status::text from public.backup_runs where run_type = 'manual'), 'exporting', 'backup remains exporting until the browser checksum is confirmed');

reset role;
select * from finish();
rollback;
