begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Developer package v5, Word 10.1: a delivery of a traceable material group is accepted only after a compliance check that complies.
select plan(7);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000048a1', 'authenticated', 'authenticated', 'admin48@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000048a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Delivery Org 48', 'delivery-org-48', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'delivery-org-48'),
  'V48', 'Delivery project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'V48';

insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'delivery', 'DEL-48-' || n, 'Delivery ' || n, 'open',
  jsonb_build_object('spec', jsonb_build_object('material_group', grp, 'inspection_result', 'Not Ready for Inspection')),
  '00000000-0000-0000-0000-0000000048a1', 'v48-del-' || n
from ids, (values (1, 'Reinforcement & Structural Steel'), (2, 'Insulation')) as g(n, grp);

create or replace function pg_temp.accept(p_key text, p_group text, p_result text default 'Accepted') returns void language sql as $$
  update public.project_register_entries
  set details = jsonb_build_object('spec', jsonb_build_object('material_group', p_group, 'inspection_result', p_result))
  where idempotency_key = p_key;
$$;

select throws_ok($$select pg_temp.accept('v48-del-1', 'Reinforcement & Structural Steel')$$, '22023', null,
  'a traceable delivery without a compliance check cannot be accepted');
select throws_ok($$select pg_temp.accept('v48-del-1', 'Reinforcement & Structural Steel', 'Accepted with Comments')$$, '22023', null,
  'nor accepted with comments');
select lives_ok($$select pg_temp.accept('v48-del-1', 'Reinforcement & Structural Steel', 'Rejected')$$, 'it can be rejected');
select lives_ok($$select pg_temp.accept('v48-del-2', 'Insulation')$$, 'a delivery of another group is accepted as before');

insert into public.spec_compliance_checks (organization_id, project_id, check_number, subject_kind, subject_record_id, subject_label,
  requirement_label, clause, rows, overall_result, signed_by, signed_at, signature_image, created_by, idempotency_key)
select organization_id, project_id, 'V48-SPC-0001', 'delivery', (select id from public.project_register_entries where idempotency_key = 'v48-del-1'),
  'Rebar', 'Bestek 05.1', '5.1.2', '[{"parameter":"Yield","result":"complies"}]'::jsonb, 'complies', 'Ada Admin', now(), 'data:image/png;base64,AAAA',
  '00000000-0000-0000-0000-0000000048a1', 'v48-check-1'
from ids;
select lives_ok($$select pg_temp.accept('v48-del-1', 'Reinforcement & Structural Steel')$$, 'after a check that complies the delivery is accepted');

insert into public.spec_compliance_checks (organization_id, project_id, check_number, subject_kind, subject_record_id, subject_label,
  requirement_label, clause, rows, overall_result, signed_by, signed_at, signature_image, created_by, idempotency_key)
select organization_id, project_id, 'V48-SPC-0002', 'delivery', (select id from public.project_register_entries where idempotency_key = 'v48-del-1'),
  'Rebar', 'Bestek 05.1', '5.1.2', '[{"parameter":"Yield","result":"does_not_comply"}]'::jsonb, 'does_not_comply', 'Ada Admin', now() + interval '1 minute', 'data:image/png;base64,AAAA',
  '00000000-0000-0000-0000-0000000048a1', 'v48-check-2'
from ids;
select throws_ok($$select pg_temp.accept('v48-del-1', 'Reinforcement & Structural Steel')$$, '22023', null,
  'a later check that does not comply blocks the acceptance again');
select is((select details #>> '{spec,inspection_result}' from public.project_register_entries where idempotency_key = 'v48-del-1'), 'Accepted',
  'the earlier acceptance stays on record (the rule guards the change, history is not rewritten)');

select * from finish();
rollback;
