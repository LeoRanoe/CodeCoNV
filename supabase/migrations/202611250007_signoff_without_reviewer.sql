-- Developer package v5 (25-11-2026): sign-off without a Supervision reviewer.
--
-- * "No reviewer": a submission by Supervision is final. The review and accept actions are no longer
--   offered by any stage; only the Change Order has an approval, by the Project Manager (stage 3, as
--   configured by existing projects). The stage/action table is the approved profiles of
--   apps/web/lib/forms/signoff.ts; a node test keeps the two identical.
-- * A Change Order is approved or rejected by a Project Manager of the project (project role
--   project_manager). Approving one's own submission stays refused by record_signoff_action.
-- * Existing events are unchanged.

create or replace function app_private.signoff_profile_stages(p_profile text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $sp$
  select ('{"WO-DAILY":{"1":["submit"]},"WC-COMPLETION":{"1":["submit"]},"WF-ATTENDANCE":{"1":["submit"]},"PDR-REVIEW":{"1":["submit"],"2":["acknowledge","respond"],"3":["verify","close","return"],"4":["resubmit"]},"ISSUE-CLOSEOUT":{"1":["submit"],"2":["acknowledge","respond"],"3":["verify","close","return"],"4":["resubmit"]},"HSE-OBSERVATION":{"1":["submit"],"2":["acknowledge","respond"],"3":["verify","close","return"],"4":["resubmit"]},"MAT-RECEIPT":{"1":["submit"]},"INSPECTION-WITNESS":{"1":["submit"],"2":["witness","acknowledge"]},"TECH-INSTRUCTION":{"1":["submit"],"2":["acknowledge"],"3":["respond"],"4":["return","resubmit","verify","close"]},"CHANGE-APPROVAL":{"1":["submit"],"3":["approve","reject","return"],"4":["resubmit","withdraw"]},"NCR-CORRECTIVE":{"1":["submit"],"2":["acknowledge","respond"],"3":["return","verify","close"],"4":["resubmit"]},"AGREEMENT-ACK":{"1":["submit"],"2":["acknowledge"],"3":["close"]},"LESSON-REVIEW":{"1":["submit"]},"HSE-INCIDENT":{"1":["submit"],"3":["respond","acknowledge"],"4":["resubmit","verify","close","return"]}}'::jsonb) -> p_profile;
$sp$;

create or replace function app_private.signoff_event_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $guard$
begin
  if new.action in ('review', 'accept') then
    raise exception 'There is no Supervision review step; a submission is final' using errcode = '22023';
  end if;
  if new.workflow_profile = 'CHANGE-APPROVAL' and new.action in ('approve', 'reject')
     and new.attestation_method = 'account' and new.actor_user_id is not null
     and not exists (
       select 1
       from public.project_memberships membership
       join public.project_member_roles member_role
         on member_role.membership_id = membership.id and member_role.project_id = membership.project_id
       join public.roles role on role.id = member_role.role_id
       where membership.project_id = new.project_id
         and membership.user_id = new.actor_user_id
         and membership.status = 'active'
         and role.code = 'project_manager') then
    raise exception 'Only the Project Manager approves or rejects a Change Order' using errcode = '42501';
  end if;
  return new;
end;
$guard$;

drop trigger if exists record_signoff_events_guard on public.record_signoff_events;
create trigger record_signoff_events_guard
  before insert on public.record_signoff_events
  for each row execute function app_private.signoff_event_guard();
