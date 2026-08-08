begin;
set local search_path = extensions, pgtap, public;

select plan(13);

-- The two arguments of 202608070002 exist, and the six-argument function they replace is
-- gone. Both signatures side by side would make every existing six-argument call
-- ambiguous, including the ones record_issue_progress makes internally.
select has_function(
  'public',
  'transition_project_finding',
  array['uuid','text','text','text','text','text','text','text'],
  'a finding transition can carry the written quality-control signature'
);
select hasnt_function(
  'public',
  'transition_project_finding',
  array['uuid','text','text','text','text','text'],
  'the six-argument transition is replaced, not shadowed, so no call is ambiguous'
);
select ok(
  has_function_privilege('authenticated', 'public.transition_project_finding(uuid,text,text,text,text,text,text,text)', 'execute'),
  'a signed-in supervisor may transition a finding'
);
select ok(
  not has_function_privilege('anon', 'public.transition_project_finding(uuid,text,text,text,text,text,text,text)', 'execute'),
  'an anonymous visitor may not transition a finding'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'ncr-supervisor@example.test', now(), now()),
       ('00000000-0000-0000-0000-0000000000f8', 'authenticated', 'authenticated', 'ncr-worker@example.test', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select lives_ok(
  $$select public.bootstrap_organization('CODECO NCR Signature', 'codeco-ncr-signature', 'NCR Supervisor')$$,
  'an organization can be bootstrapped for this scenario'
);
select lives_ok(
  format(
    $query$select public.create_project_workspace(%L::uuid, 'NCR-SIG-001', 'NCR handtekening', 'Paramaribo', 'Opdrachtgever', 'B1', 'Gebouw 1', 'Hoofdaannemer')$query$,
    (select id from public.organizations where slug = 'codeco-ncr-signature')
  ),
  'a project workspace can be created for this scenario'
);

-- One NCR and one ordinary issue, both carried to the point where they can be closed.
create temporary table ncr_scenario (label text primary key, finding_id uuid) on commit drop;

insert into ncr_scenario (label, finding_id)
select 'ncr', (public.create_project_finding(
  project.id, building.id, null, null, null,
  'ncr', 'Honingraat in kolom C-12', 'Honingraat waargenomen op het betonoppervlak.',
  'high', null, null, 'ncr-signature-test-1'
)).id
from public.projects project
join public.buildings building on building.project_id = project.id
where project.code = 'NCR-SIG-001';

insert into ncr_scenario (label, finding_id)
select 'issue', (public.create_project_finding(
  project.id, building.id, null, null, null,
  'deficiency', 'Afwerking niet gereed', 'De afwerking voldoet nog niet aan de eis.',
  'medium', null, null, 'ncr-signature-test-2'
)).id
from public.projects project
join public.buildings building on building.project_id = project.id
where project.code = 'NCR-SIG-001';

select lives_ok(
  $$select public.transition_project_finding(
      (select finding_id from ncr_scenario where label = 'ncr'),
      'ready_for_verification', 'Herstel uitgevoerd.', null, null,
      'Kolomoppervlak hersteld volgens de goedgekeurde methode.')$$,
  'an NCR reaches verification on the six-argument call, which still resolves'
);

-- The Quality Control / Verification box on the client's own NCR form marks its
-- signature line required, so an NCR cannot close without it.
select throws_ok(
  $$select public.transition_project_finding(
      (select finding_id from ncr_scenario where label = 'ncr'),
      'closed', 'Herstel geverifieerd en akkoord.')$$,
  '23514',
  'The quality-control signature is required to close an NCR',
  'an NCR does not close without the written quality-control signature'
);

select lives_ok(
  $$select public.transition_project_finding(
      (select finding_id from ncr_scenario where label = 'ncr'),
      'closed', 'Herstel geverifieerd en akkoord.', null, null, null,
      'Ratan Jagesar', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')$$,
  'an NCR closes once the quality-control signature is written'
);

select is(
  (select issue_management ->> 'verification_signed_by'
   from public.findings
   where id = (select finding_id from ncr_scenario where label = 'ncr')),
  'Ratan Jagesar',
  'the signature is stored on the record itself, not only on the person who closed it'
);

-- An ordinary issue is not the client's NCR form and keeps closing without a signature.
select lives_ok(
  $$select public.transition_project_finding(
      (select finding_id from ncr_scenario where label = 'issue'),
      'ready_for_verification', 'Werk gereed.', null, null, 'Afwerking afgerond.');
    select public.transition_project_finding(
      (select finding_id from ncr_scenario where label = 'issue'),
      'closed', 'Geverifieerd en akkoord.')$$,
  'a plain issue still closes without a written signature'
);

-- issue_management holds the engineer's own recommendation, remarks and written
-- signature next to the quality-control one. Letting a status transition write the whole
-- column would let anyone the findings_update policy admits — an assigned user who is not
-- a finding manager — forge the engineer's signature, so only the verification keys open.
insert into ncr_scenario (label, finding_id)
select 'assigned', (public.create_project_finding(
  project.id, building.id, null, null, null,
  'ncr', 'Toegewezen NCR', 'Een afwijking die aan een uitvoerder is toegewezen.',
  'high', null, '00000000-0000-0000-0000-0000000000f8'::uuid, 'ncr-signature-test-3'
)).id
from public.projects project
join public.buildings building on building.project_id = project.id
where project.code = 'NCR-SIG-001';

update public.findings
set issue_management = jsonb_build_object(
  'signed_by', 'Ingenieur',
  'signature_image', 'data:image/png;base64,ENGINEER')
where id = (select finding_id from ncr_scenario where label = 'assigned');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f8","role":"authenticated"}';

select throws_ok(
  $$update public.findings
      set issue_management = issue_management || jsonb_build_object('signature_image', 'data:image/png;base64,FORGED')
    where id = (select finding_id from ncr_scenario where label = 'assigned')$$,
  '42501',
  'Only a finding manager may change the original observation',
  'an assigned non-manager cannot overwrite the engineer''s written signature'
);
select lives_ok(
  $$update public.findings
      set issue_management = issue_management || jsonb_build_object('verification_signed_by', 'QC')
    where id = (select finding_id from ncr_scenario where label = 'assigned')$$,
  'the quality-control signature keys stay writable during a close-out'
);

select * from finish();
rollback;
