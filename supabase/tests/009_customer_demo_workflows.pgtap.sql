begin;
set local search_path = extensions, pgtap, public;

-- Isolation: only the first organization can be created without an administrator, so the file
-- starts from an empty tenant table; the rollback at the end puts any existing data back.
set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

select plan(29);

select has_table('public', 'external_share_responses', 'external subcontractor responses are stored centrally');
select has_column('public', 'external_share_links', 'source_file_id', 'share links can expose one controlled source image');
select has_column('public', 'files', 'submitted_via_share_id', 'external evidence files retain their share-link origin');
select has_function(
  'public',
  'submit_external_share_response',
  array['text','text','text','text','uuid','text'],
  'service-only external response workflow exists'
);
select ok(
  not has_function_privilege('authenticated', 'public.submit_external_share_response(text,text,text,text,uuid,text)', 'execute'),
  'authenticated browser sessions cannot bypass the external response route'
);
select ok(
  has_function_privilege('service_role', 'public.submit_external_share_response(text,text,text,text,uuid,text)', 'execute'),
  'the trusted server role can submit a validated external response'
);
select ok(
  not has_table_privilege('anon', 'public.external_share_responses', 'select'),
  'anonymous visitors cannot enumerate external responses'
);
select ok(
  has_table_privilege('authenticated', 'public.external_share_responses', 'select'),
  'authorized project members can read external responses through RLS'
);
select ok(
  has_table_privilege('service_role', 'public.external_share_links', 'select'),
  'the trusted server can validate an active opaque share token'
);
select ok(
  has_table_privilege('service_role', 'public.project_settings', 'select'),
  'the trusted upload route can enforce the project file-size setting'
);
select ok(
  has_table_privilege('service_role', 'public.files', 'select,insert,update'),
  'the trusted upload route has only the file operations it needs'
);

create temporary table demo_share (payload jsonb) on commit drop;
grant select, insert on demo_share to authenticated, service_role;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', 'demo-supervisor@example.test', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO Demo Workflow', 'codeco-demo-workflow', 'Demo Supervisor')$$,
  'demo organization can be bootstrapped'
);
select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'DEMO-001', 'Klantdemo', 'Paramaribo', 'Opdrachtgever', 'HOOFD', 'Hoofdgebouw', 'Hoofdaannemer')$query$,
    (select id from public.organizations where slug = 'codeco-demo-workflow')
  ),
  'demo project workspace can be created'
);
select lives_ok(
  format(
    $query$select public.create_day_report(%L::uuid, current_date, 'demo-report-idempotency')$query$,
    (select id from public.projects where code = 'DEMO-001')
  ),
  'demo day report can be created'
);
select lives_ok(
  format(
    $query$select public.create_project_finding(
      %L::uuid, %L::uuid, %L::uuid, null, null, 'deficiency',
      'Wandafwerking herstellen', 'Beschadigde wandhoek herstellen en gereedmelden.',
      'medium', null, null, 'demo-finding-idempotency'
    )$query$,
    (select id from public.projects where code = 'DEMO-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'DEMO-001')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'DEMO-001'))
  ),
  'an open finding can be created for the account-free link'
);
select lives_ok(
  format(
    $query$insert into demo_share(payload)
      select public.create_external_share_link(%L::uuid, 'finding', %L::uuid, 14)$query$,
    (select id from public.projects where code = 'DEMO-001'),
    (select id from public.findings where project_id = (select id from public.projects where code = 'DEMO-001'))
  ),
  'an authorized supervisor can create an expiring external task link'
);
select matches(
  (select payload ->> 'token' from demo_share),
  '^[a-f0-9]{48}$',
  'the external link uses an opaque 192-bit token'
);

reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select lives_ok(
  format(
    $query$select public.submit_external_share_response(
      %L, 'ready_for_verification', 'Herstel is volledig uitgevoerd en gereed voor controle.',
      'Test Onderaannemer', null, 'demo-response-complete'
    )$query$,
    (select payload ->> 'token' from demo_share)
  ),
  'the external trade can mark work ready without receiving an account'
);
reset role;
select is(
  (select status::text from public.findings where project_id = (select id from public.projects where code = 'DEMO-001')),
  'ready_for_verification',
  'external completion stops at ready for CODECO verification'
);
select is(
  (select final_measure from public.findings where project_id = (select id from public.projects where code = 'DEMO-001')),
  'Herstel is volledig uitgevoerd en gereed voor controle.',
  'the external corrective measure is retained on the finding'
);
select is(
  (select count(*) from public.external_share_responses),
  1::bigint,
  'the completion response is stored once'
);
select is(
  (select count(*) from public.notifications where notification_type = 'system' and source_type = 'external_share_response'),
  1::bigint,
  'the responsible internal user receives a notification'
);
select is(
  (select count(*) from public.finding_updates where message like 'Extern gereedgemeld via beveiligde link%'),
  1::bigint,
  'the account-free status change remains visible in finding history'
);
set local role service_role;
select lives_ok(
  format(
    $query$select public.submit_external_share_response(
      %L, 'ready_for_verification', 'Herstel is volledig uitgevoerd en gereed voor controle.',
      'Test Onderaannemer', null, 'demo-response-complete'
    )$query$,
    (select payload ->> 'token' from demo_share)
  ),
  'a repeated response request is idempotent'
);
reset role;
select is(
  (select count(*) from public.external_share_responses),
  1::bigint,
  'the repeated completion creates no duplicate response'
);
set local role service_role;
select lives_ok(
  format(
    $query$select public.submit_external_share_response(
      %L, 'issue', 'Materiaal voor het resterende herstel ontbreekt.',
      'Test Onderaannemer', null, 'demo-response-issue'
    )$query$,
    (select payload ->> 'token' from demo_share)
  ),
  'the external trade can report a problem through the same link'
);
reset role;
select is(
  (select count(*) from public.external_share_responses),
  2::bigint,
  'completion and problem responses are both retained'
);
select is(
  ((public.resolve_external_share_link((select payload ->> 'token' from demo_share)) ->> 'response_count')::integer),
  2,
  'the shared task view reports how many responses were received'
);
select ok(
  not ((public.resolve_external_share_link((select payload ->> 'token' from demo_share)) ->> 'has_source_image')::boolean),
  'a task without linked evidence does not claim to have a source image'
);

select * from finish();
rollback;
