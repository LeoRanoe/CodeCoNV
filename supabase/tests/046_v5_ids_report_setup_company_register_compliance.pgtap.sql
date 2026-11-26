begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Developer package v5: record IDs, report templates and schedules, the company register with contacts,
-- the Change Order and signature-request notifications, and the Rapid Verify spec compliance check.
select plan(26);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000046a1', 'authenticated', 'authenticated', 'admin46@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000046b1', 'authenticated', 'authenticated', 'lead46@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000046b2', 'authenticated', 'authenticated', 'pm46@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000046c1', 'authenticated', 'authenticated', 'cont46@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000046b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000046b2', 'Pim Manager'),
  ('00000000-0000-0000-0000-0000000046c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000046a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Setup Org 46', 'setup-org-46', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'setup-org-46'),
  'V46', 'Setup project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'V46';
grant select on ids to authenticated;

insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000046a1' from ids;

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000046c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000046b1'::uuid), ('00000000-0000-0000-0000-0000000046b2'::uuid), ('00000000-0000-0000-0000-0000000046c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000046b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000046b2' then 'project_manager'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

-- Record IDs -------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000046b1","role":"authenticated"}';
set local role authenticated;
create temporary table made (label text, number text) on commit drop;
grant all on made to authenticated;
insert into made select 'first', (public.create_project_register_entry(
  (select project_id from ids), (select building_id from ids), null, 'works_ongoing', 'Slab S1', now(), null, null, '{}'::jsonb, 'v46-wo-1')).entry_number;
insert into made select 'second', (public.create_project_register_entry(
  (select project_id from ids), (select building_id from ids), null, 'works_ongoing', 'Slab S2', now(), null, null, '{}'::jsonb, 'v46-wo-2')).entry_number;
select matches((select number from made where label = 'first'), '^V46-WO-[0-9]{4}-0001$', 'a new record is numbered project-form-year-sequence');
select matches((select number from made where label = 'second'), '^V46-WO-[0-9]{4}-0002$', 'the sequence continues without reuse');
reset role;
set local request.jwt.claims = '{}';

insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'works_ongoing', 'IMPORTED-46-1', 'Imported', 'open', '{}'::jsonb,
  '00000000-0000-0000-0000-0000000046b1', 'v46-imported-1' from ids;
select is((select entry_number from public.project_register_entries where idempotency_key = 'v46-imported-1'), 'IMPORTED-46-1',
  'a row written without a session keeps the number it brings');

-- Report templates and schedules ----------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000046b1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$insert into public.report_templates (organization_id, project_id, name, settings)
    select organization_id, project_id, 'Weekly status', '{"type":"weekly"}'::jsonb from ids$$,
  'a report author saves a template');
select throws_ok(
  $$insert into public.report_schedules (organization_id, project_id, name, frequency, recipient_user_ids)
    select organization_id, project_id, 'Weekly without a day', 'weekly', '{}' from ids$$,
  '23514', null, 'a weekly schedule needs a weekday');
select lives_ok(
  $$insert into public.report_schedules (organization_id, project_id, template_id, name, frequency, run_time, recipient_user_ids)
    select ids.organization_id, ids.project_id, (select id from public.report_templates where name = 'Weekly status'), 'Daily 18:00', 'workdays', '18:00',
      array['00000000-0000-0000-0000-0000000046b2'::uuid] from ids$$,
  'a report author saves a schedule');
select throws_ok($$select public.run_due_report_schedules(now())$$, '42501', null,
  'a signed-in user cannot run the scheduler');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000046c1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.report_templates), 0::bigint, 'a contractor does not see the report templates');
select throws_ok(
  $$insert into public.report_templates (organization_id, project_id, name, settings)
    select organization_id, project_id, 'Sneaky', '{}'::jsonb from ids$$,
  '42501', null, 'a contractor cannot save a template');
reset role;
set local request.jwt.claims = '{}';

-- A Tuesday after 18:00 in Paramaribo (UTC-3): the schedule is due once.
select is(public.run_due_report_schedules('2026-11-24 22:30:00+00'::timestamptz), 1, 'the scheduler finds the due schedule');
select is((select count(*) from public.notifications where notification_type = 'report_scheduled'), 1::bigint,
  'the recipient is told that the report is ready to make');
select is(public.run_due_report_schedules('2026-11-24 23:30:00+00'::timestamptz), 0, 'the same day it does not run twice');
select is(public.run_due_report_schedules('2026-11-24 20:00:00+00'::timestamptz), 0, 'before the set time nothing runs');

-- Company register contacts ----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000046b2","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$insert into public.party_contacts (organization_id, project_id, party_id, name, email, is_primary)
    select ids.organization_id, ids.project_id, (select id from public.parties where code = 'CA'), 'Joan Foreman', 'joan@example.test', true from ids$$,
  'the Project Manager adds a contact to a company');
select throws_ok(
  $$insert into public.party_contacts (organization_id, project_id, party_id, name, email)
    select ids.organization_id, ids.project_id, (select id from public.parties where code = 'CA'), 'Bad Mail', 'not-an-address' from ids$$,
  '23514', null, 'a contact needs a valid e-mail address');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000046c1","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$insert into public.party_contacts (organization_id, project_id, party_id, name)
    select ids.organization_id, ids.project_id, (select id from public.parties where code = 'CA'), 'Self Added' from ids$$,
  '42501', null, 'a contractor cannot change the company register');
reset role;
set local request.jwt.claims = '{}';

-- Change Order awaiting the Project Manager ------------------------------------------------------
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'change_order', 'CO-46-1', 'Extra column', 'open', '{}'::jsonb,
  '00000000-0000-0000-0000-0000000046b1', 'v46-co-1' from ids;
select is((select count(*) from public.notifications where notification_type = 'change_order_pending'
  and recipient_user_id = '00000000-0000-0000-0000-0000000046b2'), 1::bigint,
  'a submitted Change Order tells the Project Manager');

-- Spec compliance check --------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000046b1","role":"authenticated"}';
set local role authenticated;
create temporary table checks (label text, id uuid, number text, overall text) on commit drop;
grant all on checks to authenticated;
insert into checks
select 'first', (c).id, (c).check_number, (c).overall_result from (select public.record_spec_compliance_check(
  (select project_id from ids), 'document', null, null, 'Rebar submittal R-12', null, 'Bestek 05.1', '5.1.2', 'Rebar',
  '[{"parameter":"Yield strength","required":"B500B","submitted":"B500B","result":"complies"},{"parameter":"Cover","required":"40 mm","submitted":"","result":"not_stated"}]'::jsonb,
  null, false, 'Lena Lead', 'data:image/png;base64,AAAA', 'v46-check-1') as c) q;
select is((select overall from checks where label = 'first'), 'complies_with_comments', 'a requirement that is not stated gives complies with comments');
select matches((select number from checks where label = 'first'), '^V46-SPC-[0-9]{4}-0001$', 'the check carries its own number');
select is((public.record_spec_compliance_check(
  (select project_id from ids), 'document', null, null, 'Rebar submittal R-12', null, 'Bestek 05.1', '5.1.2', 'Rebar',
  '[{"parameter":"Yield strength","required":"B500B","submitted":"B500B","result":"complies"}]'::jsonb,
  null, false, 'Lena Lead', 'data:image/png;base64,AAAA', 'v46-check-1')).id,
  (select id from checks where label = 'first'), 'a repeated request returns the stored check');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000046c1","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.record_spec_compliance_check((select project_id from ids), 'document', null, null, 'Submittal', null, 'Bestek', '1', null,
    '[{"parameter":"A","result":"complies"}]'::jsonb, null, false, 'Alex Contractor', 'data:image/png;base64,AAAA', 'v46-check-2')$$,
  '42501', null, 'a contractor cannot record a compliance check');
reset role;
set local request.jwt.claims = '{}';
select throws_ok($$update public.spec_compliance_checks set overall_result = 'complies'$$, '42501', null, 'a stored check cannot be changed');
select throws_ok($$delete from public.spec_compliance_checks$$, '42501', null, 'a stored check cannot be deleted');

-- Delivery acceptance (Word 10.1) ----------------------------------------------------------------
insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
select organization_id, project_id, building_id, 'delivery', 'DEL-46-1', 'Rebar delivery', 'open', '{}'::jsonb,
  '00000000-0000-0000-0000-0000000046b1', 'v46-del-1' from ids;
insert into public.spec_compliance_checks (organization_id, project_id, check_number, subject_kind, subject_record_id, subject_label,
  requirement_label, clause, rows, overall_result, signed_by, signed_at, signature_image, created_by, idempotency_key)
select organization_id, project_id, 'V46-SPC-9999', 'delivery', (select id from public.project_register_entries where idempotency_key = 'v46-del-1'),
  'Rebar delivery', 'Bestek 05.1', '5.1.2', '[{"parameter":"Yield","result":"does_not_comply"}]'::jsonb, 'does_not_comply', 'Lena Lead', now(), 'data:image/png;base64,AAAA',
  '00000000-0000-0000-0000-0000000046b1', 'v46-del-check'
from ids;
select throws_ok(
  $$update public.project_register_entries set details = '{"spec":{"inspection_result":"Accepted"}}'::jsonb where idempotency_key = 'v46-del-1'$$,
  '22023', null, 'a delivery whose compliance check does not comply cannot be accepted');
select lives_ok(
  $$update public.project_register_entries set details = '{"spec":{"inspection_result":"Rejected"}}'::jsonb where idempotency_key = 'v46-del-1'$$,
  'the same delivery can be rejected');
select lives_ok(
  $$insert into public.project_register_entries (organization_id, project_id, building_id, register_type, entry_number, title, status, details, created_by, idempotency_key)
    select organization_id, project_id, building_id, 'delivery', 'DEL-46-2', 'Cement delivery', 'open', '{"spec":{"inspection_result":"Accepted"}}'::jsonb,
      '00000000-0000-0000-0000-0000000046b1', 'v46-del-2' from ids$$,
  'a delivery without a compliance check can be accepted by the database (the form requires one where the project does)');

select * from finish();
rollback;
