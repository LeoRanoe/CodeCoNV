begin;
set local search_path = extensions, pgtap, public;

-- The account-free contractor flow on an NCR: what the contractor may write through the
-- secure link, and everything it must never be able to change. CODECO keeps verification.
select plan(28);

select ok(
  not has_function_privilege('authenticated', 'public.submit_external_share_response(text,text,text,text,uuid,text,text,text)', 'execute'),
  'a signed-in browser session cannot call the contractor response routine directly'
);
select ok(
  not has_function_privilege('anon', 'public.submit_external_share_response(text,text,text,text,uuid,text,text,text)', 'execute'),
  'an anonymous visitor cannot call the contractor response routine directly'
);

create temporary table ncr_share (payload jsonb) on commit drop;
grant select, insert on ncr_share to authenticated, service_role;

create function pg_temp.rows_changed(p_sql text)
returns bigint
language plpgsql
as $fn$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
exception when insufficient_privilege then
  return 0;
end;
$fn$;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000015a1', 'authenticated', 'authenticated', 'ncr-engineer@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000015a2', 'authenticated', 'authenticated', 'ncr-contractor@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}';
set local role authenticated;

select lives_ok(
  $$select public.bootstrap_organization('NCR Boundary Org', 'ncr-boundary-org', 'NCR Engineer')$$,
  'organization can be bootstrapped'
);
select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'NCR-001', 'NCR grenzen', 'Paramaribo', 'Opdrachtgever', 'HOOFD', 'Hoofdgebouw', 'Hoofdaannemer')$query$,
    (select id from public.organizations where slug = 'ncr-boundary-org')
  ),
  'project workspace can be created'
);
select lives_ok(
  format(
    $query$select public.create_project_finding(
      %L::uuid, %L::uuid, null, null, null, 'ncr',
      'Wapening te weinig dekking', 'Betondekking op kolom K4 is 15 mm in plaats van 35 mm.',
      'high', null, null, 'ncr-boundary-finding',
      '{"recommended_action":"Kolom K4 aanhelen met krimparme mortel na goedkeuring constructeur.","issue_type":"quality"}'::jsonb
    )$query$,
    (select id from public.projects where code = 'NCR-001'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'NCR-001'))
  ),
  'an NCR with the engineer recommendation can be raised'
);
select lives_ok(
  format(
    $query$insert into ncr_share(payload) select public.create_external_share_link(%L::uuid, 'finding', %L::uuid, 14)$query$,
    (select id from public.projects where code = 'NCR-001'),
    (select id from public.findings where idempotency_key = 'ncr-boundary-finding')
  ),
  'a contractor link can be created for the NCR'
);

reset role;

-- A. Proposed corrective action, signed with name and position.
set local role service_role;
select lives_ok(
  format(
    $query$select public.submit_external_share_response(
      %L, 'proposed_correction', 'Uitbreken tot gezond beton en opnieuw aanhelen volgens advies.',
      'P. Aannemer', null, 'ncr-boundary-correction', 'data:image/png;base64,iVBORw0KGgo=', 'Uitvoerder'
    )$query$,
    (select payload ->> 'token' from ncr_share)
  ),
  'the contractor can propose a corrective action through the secure link'
);
reset role;
select is(
  (select status from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'in_progress',
  'a proposed correction moves the NCR into progress'
);
select is(
  (select proposed_correction from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'Uitbreken tot gezond beton en opnieuw aanhelen volgens advies.',
  'the proposed corrective action is stored on the NCR'
);
select ok(
  (select issue_management ->> 'correction_signed_by' = 'P. Aannemer'
      and issue_management ->> 'correction_signed_position' = 'Uitvoerder'
      and issue_management ->> 'correction_signature_image' like 'data:image/png;base64,%'
   from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'the contractor box records name, position and written signature'
);

-- B. Ready for verification.
set local role service_role;
select lives_ok(
  format(
    $query$select public.submit_external_share_response(
      %L, 'ready_for_verification', 'Kolom K4 aangeheeld, dekking nagemeten 38 mm.',
      'P. Aannemer', null, 'ncr-boundary-ready', 'data:image/png;base64,iVBORw0KGgo=', 'Uitvoerder'
    )$query$,
    (select payload ->> 'token' from ncr_share)
  ),
  'the contractor can mark the NCR ready for verification'
);
reset role;
select ok(
  (select status = 'ready_for_verification' and verified_by is null and verified_at is null and closed_at is null
   from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'contractor completion stops at ready for verification and never verifies or closes'
);
select ok(
  (select issue_management ->> 'completion_signed_by' = 'P. Aannemer'
      and issue_management ->> 'completion_signed_position' = 'Uitvoerder'
   from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'the completion box records who reported the work ready'
);
select is(
  (select issue_management ->> 'recommended_action' from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'Kolom K4 aanhelen met krimparme mortel na goedkeuring constructeur.',
  'the engineer recommendation is untouched by the contractor flow'
);
select is(
  (select title || ' | ' || description from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'Wapening te weinig dekking | Betondekking op kolom K4 is 15 mm in plaats van 35 mm.',
  'the original observation is untouched by the contractor flow'
);
select ok(
  (select not (issue_management ? 'verification_signed_by') from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'the contractor flow cannot fill the quality-control box'
);

-- A second "ready" from the link cannot push the NCR any further.
set local role service_role;
select lives_ok(
  format(
    $query$select public.submit_external_share_response(
      %L, 'ready_for_verification', 'Nogmaals gereed, graag sluiten.', 'P. Aannemer', null, 'ncr-boundary-ready-again', null, null
    )$query$,
    (select payload ->> 'token' from ncr_share)
  ),
  'a repeated ready report is accepted as a response'
);
reset role;
select is(
  (select status from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'ready_for_verification',
  'the contractor can never close the NCR'
);

-- Invalid input through the link.
set local role service_role;
select throws_ok(
  $$select public.submit_external_share_response('not-a-token', 'issue', 'Iets mis.', null, null, 'ncr-boundary-bad-token', null, null)$$,
  '22023',
  'Invalid external response',
  'a malformed token is rejected'
);
select throws_ok(
  $$select public.submit_external_share_response(repeat('a', 48), 'issue', 'Iets mis.', null, null, 'ncr-boundary-unknown-token', null, null)$$,
  'P0002',
  'Share link expired or revoked',
  'an unknown token is rejected'
);
select throws_ok(
  format(
    $query$select public.submit_external_share_response(%L, 'issue', 'Bewijs uit een ander project.', null, %L::uuid, 'ncr-boundary-foreign-file', null, null)$query$,
    (select payload ->> 'token' from ncr_share),
    gen_random_uuid()
  ),
  '23503',
  'Evidence file does not belong to this share link',
  'evidence from outside this link cannot be attached'
);
reset role;

-- A signed-in session without findings.manage cannot write the contractor box itself.
insert into public.organization_memberships (organization_id, user_id, status)
values ((select id from public.organizations where slug = 'ncr-boundary-org'), '00000000-0000-0000-0000-0000000015a2', 'active');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000015a2","role":"authenticated"}';
set local role authenticated;
select is(
  pg_temp.rows_changed($$update public.findings set issue_management = issue_management || '{"completion_signed_by":"Vervalst"}'::jsonb where idempotency_key = 'ncr-boundary-finding'$$),
  0::bigint,
  'a signed-in non-manager cannot forge the contractor signature box'
);
select is(
  pg_temp.rows_changed($$update public.findings set status = 'closed' where idempotency_key = 'ncr-boundary-finding'$$),
  0::bigint,
  'a signed-in non-manager cannot close the NCR'
);
reset role;

-- C. CODECO verifies and closes with the quality-control signature.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  format(
    $query$select public.transition_project_finding(
      %L::uuid, 'closed', 'Hersteld en nagemeten op locatie.', null, null, null,
      'Q. Controle', 'data:image/png;base64,iVBORw0KGgo=',
      '{"verification_signed_position":"QC engineer","qc_inspection_date":"2026-10-06","qc_issue_resolved":true}'::jsonb
    )$query$,
    (select id from public.findings where idempotency_key = 'ncr-boundary-finding')
  ),
  'CODECO quality control can verify and close the NCR'
);
reset role;
select ok(
  (select status = 'closed' and verified_by = '00000000-0000-0000-0000-0000000015a1' and closed_at is not null
      and issue_management ->> 'completion_signed_by' = 'P. Aannemer'
      and issue_management ->> 'verification_signed_by' = 'Q. Controle'
   from public.findings where idempotency_key = 'ncr-boundary-finding'),
  'the closed NCR keeps both the contractor box and the quality-control box'
);
select cmp_ok(
  (select count(*) from public.finding_updates where finding_id = (select id from public.findings where idempotency_key = 'ncr-boundary-finding')),
  '>=',
  3::bigint,
  'correction, completion and verification all remain in the NCR history'
);

-- Revocation ends the link.
set local role authenticated;
select lives_ok(
  format($query$select public.revoke_external_share_link(%L::uuid)$query$, (select (payload ->> 'share_id')::uuid from ncr_share)),
  'the supervisor can revoke the contractor link'
);
reset role;
set local role service_role;
select throws_ok(
  format(
    $query$select public.submit_external_share_response(%L, 'issue', 'Na intrekking.', null, null, 'ncr-boundary-after-revoke', null, null)$query$,
    (select payload ->> 'token' from ncr_share)
  ),
  'P0002',
  'Share link expired or revoked',
  'a revoked link no longer accepts responses'
);
reset role;

select * from finish();
rollback;
