begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Rapid Verify (section 10), action categories (section 9) and reminders (section 14).
select plan(26);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000032a1', 'authenticated', 'authenticated', 'admin32@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000032b1', 'authenticated', 'authenticated', 'lead32@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000032b2', 'authenticated', 'authenticated', 'super32@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000032c1', 'authenticated', 'authenticated', 'cont32@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000032b1', 'Lena Lead'),
  ('00000000-0000-0000-0000-0000000032b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000032c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000032a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Verify Org 32', 'verify-org-32', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'verify-org-32'),
  'VF-32', 'Verify project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code = 'VF-32';
grant select on ids to authenticated;
insert into public.parties (organization_id, project_id, code, name, party_type, created_by)
select organization_id, project_id, 'CA', 'Contractor A NV', 'contractor', '00000000-0000-0000-0000-0000000032a1' from ids;

insert into public.project_memberships (organization_id, project_id, user_id, status, portal_party_id)
select ids.organization_id, ids.project_id, member.id, 'active',
  case when member.id = '00000000-0000-0000-0000-0000000032c1'::uuid then (select id from public.parties where code = 'CA' and project_id = ids.project_id) end
from ids, (values ('00000000-0000-0000-0000-0000000032b1'::uuid), ('00000000-0000-0000-0000-0000000032b2'::uuid), ('00000000-0000-0000-0000-0000000032c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id
    when '00000000-0000-0000-0000-0000000032b1' then 'lead_supervisor'
    when '00000000-0000-0000-0000-0000000032b2' then 'supervisor'
    else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

-- Records waiting for verification.
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key)
select organization_id, project_id, building_id, 'NCR-32-1', 'ncr', 'Cover too small', 'Cover 20 mm instead of 40 mm', 'high', 'high', 'ready_for_verification', '00000000-0000-0000-0000-0000000032b1', 'vf32-finding-0001' from ids;
insert into public.findings (organization_id, project_id, building_id, finding_number, finding_type, title, description, severity, priority, status, created_by, idempotency_key)
select organization_id, project_id, building_id, 'NCR-32-2', 'ncr', 'Crack in wall', 'Crack at window corner', 'medium', 'normal', 'ready_for_verification', '00000000-0000-0000-0000-0000000032b1', 'vf32-finding-0002' from ids;
insert into public.actions (organization_id, project_id, building_id, action_number, title, source_type, priority, status, created_by, idempotency_key)
select organization_id, project_id, building_id, 'ACT-32-1', 'Clean slab', 'manual', 'normal', 'ready_for_verification', '00000000-0000-0000-0000-0000000032b1', 'vf32-action-0001' from ids;
insert into public.actions (organization_id, project_id, building_id, action_number, title, source_type, source_id, priority, status, created_by, idempotency_key)
select organization_id, project_id, building_id, 'ACT-32-2', 'Repair crack', 'finding', (select id from public.findings where finding_number = 'NCR-32-2'), 'normal', 'open', '00000000-0000-0000-0000-0000000032b1', 'vf32-action-0002' from ids;

-- 2. Categories
select is((select action_category from public.actions where action_number = 'ACT-32-1'), 'follow_up', 'a manual action is a follow-up by default');
select is((select action_category from public.actions where action_number = 'ACT-32-2'), 'corrective', 'an action from a finding is corrective by default');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000032b2","role":"authenticated"}';
set local role authenticated;
select throws_ok($$select public.set_project_action_category((select id from public.actions where action_number = 'ACT-32-1'), 'preventive')$$,
  '42501', null, 'a supervisor without action management cannot change the category');
select throws_ok($$select public.record_verification((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'NCR-32-1'), 'pass', null, null, null, null, null, null)$$,
  '42501', null, 'a supervisor without verification rights cannot close an NCR by verifying it');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000032b1","role":"authenticated"}';
set local role authenticated;
select lives_ok($$select public.set_project_action_category((select id from public.actions where action_number = 'ACT-32-1'), 'preventive')$$, 'a manager sets the category');
select is((select action_category from public.actions where action_number = 'ACT-32-1'), 'preventive', 'the category is stored');

-- 1. Verification
select throws_ok($$select public.record_verification((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'NCR-32-2'), 'fail', '', null, null, null, null, null)$$,
  '22023', null, 'a failed verification needs a description');
select lives_ok($$select public.record_verification((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'NCR-32-1'), 'pass', 'Cover 40 mm measured', null, 5.85, -55.20, 'Grid C4', null)$$,
  'the lead supervisor verifies the NCR on site');
select is((select status from public.findings where finding_number = 'NCR-32-1'), 'closed', 'a passed NCR is closed');
select is((select verified_by from public.findings where finding_number = 'NCR-32-1'), '00000000-0000-0000-0000-0000000032b1'::uuid, 'the verifier is recorded on the NCR');
select is((select location_label || ' ' || latitude from public.verifications where record_code = 'NCR-32-1'), 'Grid C4 5.850000', 'time, verifier and location are kept');
select lives_ok($$select public.record_verification((select project_id from ids), 'finding', (select id from public.findings where finding_number = 'NCR-32-2'), 'partial', 'Crack sealed, paint missing',
  null, null, null, null, jsonb_build_object('title', 'Paint repaired wall', 'priority', 'high', 'owner_party_id', (select id from public.parties where code = 'CA')))$$,
  'a partial result with a follow-up action');
select is((select status from public.findings where finding_number = 'NCR-32-2'), 'reopened', 'a failed or partial NCR is reopened');
select is((select count(*) from public.actions where title = 'Paint repaired wall' and source_type = 'finding' and action_category = 'corrective'
  and source_id = (select id from public.findings where finding_number = 'NCR-32-2')), 1::bigint, 'the follow-up action is linked to the NCR and corrective');
select is((select follow_up_action_id is not null from public.verifications where record_code = 'NCR-32-2'), true, 'the verification links its follow-up action');
select lives_ok($$select public.record_verification((select project_id from ids), 'action', (select id from public.actions where action_number = 'ACT-32-1'), 'pass', null, null, null, null, null, null)$$,
  'an action is verified');
select is((select status from public.actions where action_number = 'ACT-32-1'), 'verified', 'a passed action is verified and closed');
reset role;
select throws_ok($$update public.verifications set comment = 'x'$$, '55000', null, 'verifications are append-only');

-- A contractor portal item: verify on site sends it back when it fails.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000032b1","role":"authenticated"}';
set local role authenticated;
select public.share_to_portal((select project_id from ids), 'contractor', (select id from public.parties where code = 'CA'), 'action',
  (select id from public.actions where action_number = 'ACT-32-2'), 'Repair crack', null, 'implement', 'normal', now() - interval '1 day', null, null);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000032c1","role":"authenticated"}';
set local role authenticated;
select public.respond_in_portal((select id from public.portal_shares), 'mark_complete', 'Done', null, null);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000032b1","role":"authenticated"}';
set local role authenticated;
select public.record_verification((select project_id from ids), 'portal_share', (select id from public.portal_shares), 'fail', 'Crack still visible at the corner', null, null, null, null, null);
select is((select status from public.portal_shares), 'returned', 'a failed portal verification returns the item to the contractor');
select is((select action from public.portal_events order by sequence desc limit 1), 'return', 'the contractor sees the verification in its portal history');
reset role;

-- 3. Reminders
update public.portal_shares set due_at = now() - interval '1 hour', status = 'assigned';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000032b1","role":"authenticated"}';
set local role authenticated;
select ok(public.refresh_project_notifications((select project_id from ids)) >= 2, 'the notification refresh includes portal reminders');
reset role;
select is((select count(*) from public.notifications where recipient_user_id = '00000000-0000-0000-0000-0000000032c1' and dedupe_key like 'portal-due:%overdue%'),
  1::bigint, 'the contractor user is reminded of the overdue item');
select is((select count(*) from public.notifications where recipient_user_id = '00000000-0000-0000-0000-0000000032b1' and dedupe_key like 'portal-escalate:%'),
  1::bigint, 'the overdue item is escalated to the CODECO user who assigned it');


-- 4. Regression (21-11-2026): a contractor answering an NCR with a workbook status through a
-- share link was refused, because the derived spec.workflow_status counted as an edit.
create temporary table vf_share (payload jsonb) on commit drop;
grant insert, select on vf_share to authenticated, service_role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000032b1","role":"authenticated"}';
set local role authenticated;
select public.create_project_finding((select project_id from ids), (select building_id from ids), null, null, null, 'ncr',
  'Cover too small at C7', 'Cover 20 mm instead of 40 mm.', 'high', null, null, 'vf32-share-finding',
  '{"spec":{"workflow_status":"Open"},"issue_type":"quality"}'::jsonb);
insert into vf_share(payload) select public.create_external_share_link((select project_id from ids), 'finding',
  (select id from public.findings where idempotency_key = 'vf32-share-finding'), 14);
reset role;
set local request.jwt.claims = '{}';
set local role service_role;
select lives_ok(
  $$select public.submit_external_share_response((select payload ->> 'token' from vf_share), 'proposed_correction',
    'Break out and recast the cover.', 'P. Contractor', null, 'vf32-share-correction', 'data:image/png;base64,iVBORw0KGgo=', 'Foreman')$$,
  'a contractor can answer an NCR with a workbook status through its share link'
);
select lives_ok(
  $$select public.submit_external_share_response((select payload ->> 'token' from vf_share), 'ready_for_verification',
    'Recast, cover measured 42 mm.', 'P. Contractor', null, 'vf32-share-ready', 'data:image/png;base64,iVBORw0KGgo=', 'Foreman')$$,
  'and report it ready for verification'
);
reset role;
select is((select status || ' / ' || (issue_management #>> '{spec,workflow_status}') from public.findings where idempotency_key = 'vf32-share-finding'),
  'ready_for_verification / Pending Verification', 'the workbook status follows the record status');

select * from finish();
rollback;
