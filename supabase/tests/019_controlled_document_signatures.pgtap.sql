begin;
set local search_path = extensions, pgtap, public;

-- Controlled documents keep their signatures, a CODECO-issued document is signed under the
-- account's own name, and the recipient signs the formal response as a different person.
select plan(20);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000019a1', 'authenticated', 'authenticated', 'sig-admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000019a2', 'authenticated', 'authenticated', 'sig-client@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Signature Org', 'signature-org', 'Issuer Ivo');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'signature-org'),
  'SIG-1', 'Signature project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);
select public.provision_internal_user(
  (select id from public.organizations where slug = 'signature-org'),
  '00000000-0000-0000-0000-0000000019a2'::uuid, 'Client Carla', 'client',
  (select id from public.projects where code = 'SIG-1')
);
select public.create_day_report((select id from public.projects where code = 'SIG-1'), current_date, 'sig-report');

create temporary table ref (name text primary key, id uuid) on commit drop;
grant select, insert on ref to authenticated;

create function pg_temp.make_document(p_type text, p_key text, p_signed_by text, p_extra jsonb default '{}'::jsonb)
returns uuid
language plpgsql
as $fn$
declare
  v_id uuid;
begin
  select (public.create_project_register_entry(
    (select id from public.projects where code = 'SIG-1'),
    (select id from public.buildings where project_id = (select id from public.projects where code = 'SIG-1')),
    (select id from public.day_reports where project_id = (select id from public.projects where code = 'SIG-1')),
    p_type, 'Signature test ' || p_key, now(), null, null,
    jsonb_build_object(
      'schema', 'codeco.controlled-document.v1', 'document_type', p_type,
      'project_name', 'Signature project', 'project_number', 'SIG-1', 'building_name', 'Building 1',
      'subject', 'Signature test ' || p_key, 'description', 'Used to prove signature rules.',
      'issue_date', to_char(current_date, 'YYYY-MM-DD'), 'requested_to', 'Contractor',
      'reason', 'Because the test says so', 'required_action', 'proceed',
      'response', '{}'::jsonb
    ) || p_extra,
    p_key
  )).id into v_id;
  if p_signed_by is not null then
    update public.project_register_entries
    set signed_by = p_signed_by, signed_at = now() - interval '1 minute',
        signature_image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
    where id = v_id;
  end if;
  return v_id;
end;
$fn$;
grant execute on function pg_temp.make_document(text, text, text, jsonb) to authenticated;

insert into ref values
  ('ti', pg_temp.make_document('technical_instruction', 'sig-ti-signed', 'Somebody Else')),
  ('ti_unsigned', pg_temp.make_document('technical_instruction', 'sig-ti-unsigned', null)),
  ('rfi', pg_temp.make_document('rfi', 'sig-rfi-signed', 'Contractor Cees')),
  ('co', pg_temp.make_document('change_order', 'sig-co-signed', null, jsonb_build_object(
    'supervision_signed_by', 'Fake Supervisor',
    'supervision_signature_image', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'contractor_signed_by', 'Contractor Cees',
    'contractor_signature_image', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
  )));

-- 1. who signed
select is(
  (select signed_by from public.project_register_entries where id = (select id from ref where name = 'ti')),
  'Issuer Ivo',
  'a technical instruction is signed under the account''s own name, not the name typed on the form'
);
select is(
  (select details ->> 'signed_by' from public.project_register_entries where id = (select id from ref where name = 'ti')),
  'Issuer Ivo',
  'the copy of the signature in details carries the same name'
);
select is(
  (select signed_by from public.project_register_entries where id = (select id from ref where name = 'rfi')),
  'Contractor Cees',
  'a form received from a contractor keeps the submitting person''s name'
);

select is(
  (select details ->> 'supervision_signed_by' from public.project_register_entries where id = (select id from ref where name = 'co')),
  'Issuer Ivo',
  'the supervision approval on a change order is signed under the account''s own name'
);
select throws_ok(
  format($q$update public.project_register_entries set details = details || '{"contractor_signed_by":"Somebody Else"}'::jsonb where id = %L$q$, (select id from ref where name = 'co')),
  '23514', null, 'the contractor signature on a change order cannot be replaced'
);

-- 2. a signed document keeps its signature
select throws_ok(
  format($q$update public.project_register_entries set signature_image = null where id = %L$q$, (select id from ref where name = 'ti')),
  '23514', null, 'the signature cannot be removed from a signed document'
);
select throws_ok(
  format($q$update public.project_register_entries set signed_by = 'Another Person' where id = %L$q$, (select id from ref where name = 'ti')),
  '23514', null, 'the signatory cannot be changed on a signed document'
);
select lives_ok(
  format($q$update public.project_register_entries set title = 'Signature test sig-ti (edited)' where id = %L$q$, (select id from ref where name = 'ti')),
  'an ordinary edit of a signed document still works'
);
select throws_ok(
  format($q$update public.project_register_entries set details = details || '{"response_history":[{"decision":"approved"}]}'::jsonb where id = %L$q$, (select id from ref where name = 'ti')),
  '23514', null, 'the response log cannot be rewritten by editing the record'
);

-- 3. the recipient signs the formal response
select lives_ok(
  format($q$select public.respond_to_controlled_project_document(%L::uuid, jsonb_build_object(
    'decision','acknowledged','comments','Received and understood.','respondent_name','Contractor Cees',
    'respondent_position','Site manager','respondent_company','Contractor',
    'signed_at','2020-01-01T00:00:00Z','signature_image','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
  ), 'sig-response-1')$q$, (select id from ref where name = 'ti')),
  'the recipient can sign the formal response by hand'
);
select is(
  (select details -> 'response' ->> 'signature_capture' from public.project_register_entries where id = (select id from ref where name = 'ti')),
  'on_device',
  'a recipient who is not the signed-in account is recorded as signing on the capturing user''s device'
);
select ok(
  (select (details -> 'response' ->> 'signed_at')::timestamptz > now() - interval '1 hour' from public.project_register_entries where id = (select id from ref where name = 'ti')),
  'the moment of signing is the server''s, not the one the caller sent'
);
select throws_ok(
  format($q$select public.respond_to_controlled_project_document(%L::uuid, jsonb_build_object(
    'decision','acknowledged','comments','Same person.','respondent_name','issuer ivo','respondent_position','Supervisor',
    'signature_image','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
  ), 'sig-response-2')$q$, (select id from ref where name = 'ti')),
  '42501', null, 'the recipient cannot be the issuer'
);
select throws_ok(
  format($q$select public.respond_to_controlled_project_document(%L::uuid, jsonb_build_object(
    'decision','acknowledged','comments','Not issued yet.','respondent_name','Contractor Cees','respondent_position','Site manager',
    'signature_image','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
  ), 'sig-response-3')$q$, (select id from ref where name = 'ti_unsigned')),
  '23514', null, 'a document the issuer has not signed cannot be countersigned'
);
select throws_ok(
  format($q$select public.respond_to_controlled_project_document(%L::uuid, jsonb_build_object(
    'decision','acknowledged','comments','Bad image.','respondent_name','Contractor Cees','respondent_position','Site manager',
    'signature_image','not-an-image'
  ), 'sig-response-4')$q$, (select id from ref where name = 'ti')),
  '22023', null, 'a signature that is not an image is refused'
);
select lives_ok(
  format($q$select public.respond_to_controlled_project_document(%L::uuid, jsonb_build_object(
    'decision','approved','comments','Approved without a signature.','respondent_name','Issuer Ivo'
  ), 'sig-response-5')$q$, (select id from ref where name = 'rfi')),
  'a response without a signature still works for older app versions'
);

-- 4. an inspection is signed by the person who stood there
select public.create_project_checklist((select id from public.projects where code = 'SIG-1'), 'inspection', 'SIG-CHK', 'Signature checklist', array['Check one']);
select public.start_project_inspection(
  (select id from public.projects where code = 'SIG-1'),
  (select id from public.buildings where project_id = (select id from public.projects where code = 'SIG-1')),
  (select id from public.day_reports where project_id = (select id from public.projects where code = 'SIG-1')),
  (select id from public.checklist_templates where project_id = (select id from public.projects where code = 'SIG-1') and code = 'SIG-CHK'),
  'Signature inspection', 'sig-inspection-key'
);
update public.inspections
set signed_by = 'Imposter', signed_at = now() + interval '1 day',
    signature_image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
where title = 'Signature inspection';
select is(
  (select signed_by from public.inspections where title = 'Signature inspection'),
  'Issuer Ivo',
  'an inspection is signed under the account''s own name'
);
select ok(
  (select signed_at <= now() from public.inspections where title = 'Signature inspection'),
  'an inspection signature is never dated in the future'
);
select throws_ok(
  $q$update public.inspections set signature_image = null where title = 'Signature inspection'$q$,
  '23514', null, 'a signed inspection keeps its signature'
);

-- 5. the client's own account
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000019a2","role":"authenticated"}';
select lives_ok(
  format($q$select public.respond_to_controlled_project_document(%L::uuid, jsonb_build_object(
    'decision','acknowledged','comments','Seen by the client.','respondent_name','Client Carla','respondent_position','Owner representative',
    'signature_image','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
  ), 'sig-response-6')$q$, (select id from ref where name = 'ti')),
  'the client can sign under their own account'
);

select * from finish();
rollback;
