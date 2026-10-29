begin;
set local search_path = extensions, pgtap, public;

-- The contractor link answers only while the record is the contractor's to answer. A second
-- proposal after the NCR went to verification, or after it was closed, used to replace the
-- signed corrective action; the written signature of the first proposal was then lost.
-- Isolation: only the first organization can be created without an administrator, so the file
-- starts from an empty tenant table; the rollback at the end puts any existing data back.
set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

select plan(20);

create temporary table ext_share (payload jsonb) on commit drop;
grant select, insert on ext_share to authenticated, service_role;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000020a1', 'authenticated', 'authenticated', 'ext-status-engineer@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}';
set local role authenticated;

select lives_ok(
  $$select public.bootstrap_organization('External Status Org', 'ext-status-org', 'Status Engineer')$$,
  'organization can be bootstrapped'
);
select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'EXT-001', 'Externe status', 'Paramaribo', 'Opdrachtgever', 'HOOFD', 'Hoofdgebouw', 'Hoofdaannemer')$query$,
    (select id from public.organizations where slug = 'ext-status-org')
  ),
  'project workspace can be created'
);
select lives_ok(
  format(
    $query$select public.create_project_finding(
      %L::uuid, %L::uuid, null, null, null, 'ncr',
      'Wapening te weinig dekking', 'Betondekking 15 mm in plaats van 35 mm.',
      'high', null, null, 'ext-status-finding', '{"issue_type":"quality"}'::jsonb
    )$query$,
    (select id from public.projects where code = 'EXT-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'EXT-001'))
  ),
  'an NCR can be raised'
);
select lives_ok(
  format(
    $query$insert into ext_share(payload) select public.create_external_share_link(%L::uuid, 'finding', %L::uuid, 14)$query$,
    (select id from public.projects where code = 'EXT-001'),
    (select id from public.findings where idempotency_key = 'ext-status-finding')
  ),
  'a contractor link can be created'
);
reset role;

-- A. The contractor's turn: two proposals, and the history keeps both signatures.
set local role service_role;
select lives_ok(
  format($query$select public.submit_external_share_response(%L, 'proposed_correction', 'Eerste voorstel.', 'P. Aannemer', null, 'ext-status-first', 'data:image/png;base64,AAAA', 'Uitvoerder')$query$, (select payload ->> 'token' from ext_share)),
  'the first proposal is accepted'
);
select lives_ok(
  format($query$select public.submit_external_share_response(%L, 'proposed_correction', 'Aangepast voorstel.', 'P. Aannemer', null, 'ext-status-second', 'data:image/png;base64,BBBB', 'Uitvoerder')$query$, (select payload ->> 'token' from ext_share)),
  'a revised proposal is accepted while the NCR is still the contractor''s to answer'
);
reset role;
select is(
  (select proposed_correction from public.findings where idempotency_key = 'ext-status-finding'),
  'Aangepast voorstel.',
  'the NCR shows the latest proposal'
);
select results_eq(
  $$select signature_image, contact_position from public.external_share_responses where idempotency_key in ('ext-status-first','ext-status-second') order by idempotency_key$$,
  $$values ('data:image/png;base64,AAAA'::text, 'Uitvoerder'::text), ('data:image/png;base64,BBBB'::text, 'Uitvoerder'::text)$$,
  'every answer keeps its own written signature and position in the history'
);

-- B. Waiting for verification: no new proposal, a problem report and a repeated ready are fine.
set local role service_role;
select lives_ok(
  format($query$select public.submit_external_share_response(%L, 'ready_for_verification', 'Werk hersteld.', 'P. Aannemer', null, 'ext-status-ready', 'data:image/png;base64,CCCC', 'Uitvoerder')$query$, (select payload ->> 'token' from ext_share)),
  'the contractor reports the work ready'
);
select throws_ok(
  format($query$select public.submit_external_share_response(%L, 'proposed_correction', 'Vervangend voorstel na gereedmelding.', 'Iemand anders', null, 'ext-status-late-proposal', 'data:image/png;base64,DDDD', 'Onbekend')$query$, (select payload ->> 'token' from ext_share)),
  '55000',
  'This record is waiting for verification by CODECO',
  'a new proposal is refused while the NCR waits for verification'
);
select lives_ok(
  format($query$select public.submit_external_share_response(%L, 'issue', 'Er is nog een scheur zichtbaar.', 'P. Aannemer', null, 'ext-status-late-issue', null, null)$query$, (select payload ->> 'token' from ext_share)),
  'a reported problem is still accepted while the NCR waits for verification'
);
select lives_ok(
  format($query$select public.submit_external_share_response(%L, 'ready_for_verification', 'Nogmaals gereed.', 'P. Aannemer', null, 'ext-status-ready-again', null, null)$query$, (select payload ->> 'token' from ext_share)),
  'a repeated ready report is still accepted'
);
reset role;
select ok(
  (select proposed_correction = 'Aangepast voorstel.'
      and issue_management ->> 'correction_signature_image' = 'data:image/png;base64,BBBB'
      and issue_management ->> 'correction_signed_by' = 'P. Aannemer'
   from public.findings where idempotency_key = 'ext-status-finding'),
  'the signed corrective action is untouched by everything that came after "ready"'
);
select is(
  (select count(*) from public.external_share_responses where idempotency_key = 'ext-status-late-proposal'),
  0::bigint,
  'a refused proposal leaves no response row behind'
);

-- C. Closed: nothing is accepted, the link is as good as finished.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  format(
    $query$select public.transition_project_finding(
      %L::uuid, 'closed', 'Hersteld en nagemeten.', null, null, null,
      'Q. Controle', 'data:image/png;base64,iVBORw0KGgo=',
      '{"verification_signed_position":"QC engineer","qc_inspection_date":"2026-10-06","qc_issue_resolved":true}'::jsonb
    )$query$,
    (select id from public.findings where idempotency_key = 'ext-status-finding')
  ),
  'CODECO closes the NCR'
);
reset role;
set local role service_role;
select throws_ok(
  format($query$select public.submit_external_share_response(%L, 'proposed_correction', 'Voorstel na afsluiting.', 'Laat', null, 'ext-status-closed-proposal', 'data:image/png;base64,EEEE', 'Laat')$query$, (select payload ->> 'token' from ext_share)),
  '55000',
  'This record is closed to external answers',
  'a proposal is refused once the NCR is closed'
);
select throws_ok(
  format($query$select public.submit_external_share_response(%L, 'issue', 'Probleem na afsluiting.', 'Laat', null, 'ext-status-closed-issue', null, null)$query$, (select payload ->> 'token' from ext_share)),
  '55000',
  'This record is closed to external answers',
  'a problem report is refused once the NCR is closed'
);
select throws_ok(
  format($query$select public.submit_external_share_response(%L, 'ready_for_verification', 'Gereed na afsluiting.', 'Laat', null, 'ext-status-closed-ready', null, null)$query$, (select payload ->> 'token' from ext_share)),
  '55000',
  'This record is closed to external answers',
  'a ready report is refused once the NCR is closed'
);
select lives_ok(
  format($query$select public.submit_external_share_response(%L, 'proposed_correction', 'Eerste voorstel.', 'P. Aannemer', null, 'ext-status-first', 'data:image/png;base64,AAAA', 'Uitvoerder')$query$, (select payload ->> 'token' from ext_share)),
  'a retry of an answer that was already received is still acknowledged, not refused'
);
reset role;
select ok(
  (select status = 'closed' and proposed_correction = 'Aangepast voorstel.'
      and issue_management ->> 'correction_signature_image' = 'data:image/png;base64,BBBB'
      and issue_management ->> 'verification_signed_by' = 'Q. Controle'
   from public.findings where idempotency_key = 'ext-status-finding'),
  'the closed NCR keeps the contractor''s signed proposal and the quality-control signature'
);

select * from finish();
rollback;
