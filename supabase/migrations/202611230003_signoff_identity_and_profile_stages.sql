-- F16 (client-spec audit): sign-off identity, profile and stage/action are decided by the server.
--
-- * For an account sign-off, actor_role is the signer's project role(s) and actor_organization the
--   organisation of the membership (the portal party, else the project's organisation). The role the
--   screen offered for the step is kept separately as stage_role.
-- * An external representative's name and organisation remain their stated attestation, marked by
--   attestation_method and recorded by the signed-in user who entered it (actor_user_id).
-- * The workflow profile must be the record's own, and the action one that the profile's stage
--   offers (withdraw and reopen at any stage). The stage/action table is the approved profiles of
--   apps/web/lib/forms/signoff.ts; a node test keeps the two identical.
-- * Strict stage ordering is not enforced: the profiles keep later stages reachable for parallel
--   reviews, and the legal meaning of each step is a client decision (Word section 20, item 6).
-- Existing events are unchanged.

alter table public.record_signoff_events add column if not exists stage_role text
  check (stage_role is null or char_length(stage_role) <= 120);
comment on column public.record_signoff_events.stage_role is
  'The step role the signer acted as (from the workflow profile); actor_role is the server-derived project role.';

create or replace function app_private.signoff_profile_stages(p_profile text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $sp$
  select ('{"WO-DAILY":{"1":["submit"],"2":["review"],"3":["accept","return"],"4":["resubmit"]},"WC-COMPLETION":{"1":["submit"],"2":["review","witness"],"3":["accept","reject","return"],"4":["resubmit"]},"WF-ATTENDANCE":{"1":["submit"],"2":["verify","return"],"4":["resubmit"]},"PDR-REVIEW":{"1":["submit"],"2":["review","respond"],"3":["accept","return","reject"],"4":["resubmit"]},"ISSUE-CLOSEOUT":{"1":["submit"],"2":["acknowledge","respond"],"3":["verify","close","return"],"4":["resubmit"]},"HSE-OBSERVATION":{"1":["submit"],"2":["acknowledge","respond"],"3":["verify","close","return"],"4":["resubmit"]},"MAT-RECEIPT":{"1":["submit","acknowledge"],"2":["acknowledge","review"],"3":["accept","reject","return"],"4":["resubmit"]},"INSPECTION-WITNESS":{"1":["submit"],"2":["witness","acknowledge"],"3":["accept","return"],"4":["resubmit"]},"TECH-INSTRUCTION":{"1":["submit"],"2":["acknowledge"],"3":["respond"],"4":["return","resubmit","verify","close"]},"CHANGE-APPROVAL":{"1":["submit"],"2":["review","return"],"3":["review","approve","reject","return"],"4":["resubmit","withdraw"]},"NCR-CORRECTIVE":{"1":["submit"],"2":["acknowledge","respond"],"3":["review","return","verify","close"],"4":["resubmit"]},"AGREEMENT-ACK":{"1":["submit"],"2":["acknowledge"],"3":["accept"],"4":["return","resubmit","close"]},"LESSON-REVIEW":{"1":["submit"],"2":["review"],"3":["approve","return"],"4":["resubmit"]},"HSE-INCIDENT":{"1":["submit"],"2":["review","return"],"3":["respond","acknowledge"],"4":["resubmit","verify","close","return"]}}'::jsonb) -> p_profile;
$sp$;

create or replace function public.record_signoff_action(
  p_project_id uuid,
  p_record_kind text,
  p_record_id uuid,
  p_workflow_profile text,
  p_stage_number integer,
  p_action text,
  p_actor_role text,
  p_attestation_method text default 'account',
  p_actor_name text default null,
  p_actor_organization text default null,
  p_signature_image text default null,
  p_evidence_file_id uuid default null,
  p_comments text default null,
  p_return_reason text default null,
  p_next_actor text default null,
  p_next_actor_user_id uuid default null,
  p_due_at timestamptz default null
)
returns public.record_signoff_events
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_record jsonb;
  v_last public.record_signoff_events;
  v_last_submit public.record_signoff_events;
  v_round integer := 1;
  v_status text;
  v_name text;
  v_event public.record_signoff_events;
  v_authority boolean;
  v_config jsonb;
  v_stage_config jsonb;
  v_approvers jsonb;
  v_required integer;
  v_count integer;
  v_due timestamptz := p_due_at;
  v_limit numeric;
  v_amount numeric;
  v_delegate boolean := false;
  v_number text;
  v_creator uuid;
  v_recipient uuid;
  v_member_roles text;
  v_member_organization text;
  v_stage integer := greatest(1, least(coalesce(p_stage_number, 1), 9));
  v_expected_profile text;
  v_stage_actions jsonb;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'records.read') then
    raise exception 'Not a member of this project' using errcode = '42501';
  end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;

  -- The record must exist in this project; its current content is frozen with a submission.
  v_record := case p_record_kind
    when 'finding' then (select to_jsonb(item) from public.findings item where item.id = p_record_id and item.project_id = p_project_id)
    when 'hse_event' then (select to_jsonb(item) from public.hse_events item where item.id = p_record_id and item.project_id = p_project_id)
    when 'register_entry' then (select to_jsonb(item) from public.project_register_entries item where item.id = p_record_id and item.project_id = p_project_id)
    when 'inspection' then (select to_jsonb(item) from public.inspections item where item.id = p_record_id and item.project_id = p_project_id)
    when 'day_report' then (select to_jsonb(item) from public.day_reports item where item.id = p_record_id and item.project_id = p_project_id)
  end;
  if v_record is null then raise exception 'Record not found in project' using errcode = 'P0002'; end if;
  v_number := coalesce(v_record ->> 'finding_number', v_record ->> 'event_number', v_record ->> 'entry_number', v_record ->> 'inspection_number', v_record ->> 'report_number', 'record');
  v_creator := nullif(v_record ->> 'created_by', '')::uuid;
  -- Confidential HSE details stay with HSE: the frozen copy of such a record keeps no narrative,
  -- and no HSE copy ever holds the people involved, witnesses or injuries.
  if p_record_kind = 'hse_event' then
    if coalesce((v_record ->> 'confidential')::boolean, false) then
      v_record := v_record - 'description' - 'root_cause' - 'notes' - 'immediate_measure';
    end if;
    v_record := jsonb_set(v_record, '{spec}', coalesce((
      select jsonb_object_agg(item.key, item.value) from jsonb_each(coalesce(v_record -> 'spec', '{}'::jsonb)) item
      where not app_private.spec_sensitive_key(item.key)), '{}'::jsonb));
  end if;

  -- Approving, accepting, rejecting, verifying, closing and reopening are role-restricted.
  v_authority := app_private.has_project_permission(p_project_id, 'findings.verify')
    or app_private.has_project_permission(p_project_id, 'reports.review')
    or (p_record_kind = 'hse_event' and app_private.has_project_permission(p_project_id, 'hse.manage'))
    or (p_record_kind = 'inspection' and app_private.has_project_permission(p_project_id, 'inspections.manage'));
  if p_action in ('approve', 'accept', 'reject', 'verify', 'close', 'reopen') and not v_authority then
    raise exception 'Only an authorised reviewer can % this record', p_action using errcode = '42501';
  end if;
  if p_action not in ('approve', 'accept', 'reject', 'verify', 'close', 'reopen', 'witness', 'acknowledge')
    and not app_private.has_project_permission(p_project_id, 'records.create') then
    raise exception 'Missing records.create permission' using errcode = '42501';
  end if;

  -- F16: the workflow profile is the record's own, and the stage offers the action (the approved
  -- profiles, app_private.signoff_profile_stages). Withdraw and reopen apply at any stage.
  v_expected_profile := case p_record_kind
    when 'finding' then case when v_record ->> 'finding_type' = 'ncr' then 'NCR-CORRECTIVE' else 'ISSUE-CLOSEOUT' end
    when 'hse_event' then case when v_record ->> 'event_type' in ('incident', 'near_miss') then 'HSE-INCIDENT' else 'HSE-OBSERVATION' end
    when 'inspection' then 'INSPECTION-WITNESS'
    when 'day_report' then 'WF-ATTENDANCE'
    when 'register_entry' then case v_record ->> 'register_type'
      when 'works_ongoing' then 'WO-DAILY' when 'works_completed' then 'WC-COMPLETION' when 'delay_report' then 'PDR-REVIEW'
      when 'delivery' then 'MAT-RECEIPT' when 'technical_instruction' then 'TECH-INSTRUCTION' when 'change_order' then 'CHANGE-APPROVAL'
      when 'agreement' then 'AGREEMENT-ACK' when 'lessons_learned' then 'LESSON-REVIEW' end
  end;
  if v_expected_profile is not null and p_workflow_profile is distinct from v_expected_profile then
    raise exception 'This record follows the % workflow', v_expected_profile using errcode = '22023';
  end if;
  v_stage_actions := app_private.signoff_profile_stages(p_workflow_profile);
  if v_stage_actions is not null and p_action not in ('withdraw', 'reopen')
      and not coalesce(v_stage_actions -> v_stage::text, '[]'::jsonb) ? p_action then
    raise exception 'Stage % of % does not offer %', v_stage, p_workflow_profile, p_action using errcode = '22023';
  end if;

  -- Mandatory comments for a return, a rejection, a withdrawal and a reopening.
  if p_action in ('return', 'reject', 'withdraw', 'reopen') and char_length(btrim(coalesce(p_comments, ''))) < 3 then
    raise exception 'A comment is required to % a record', p_action using errcode = '22023';
  end if;
  if p_action = 'return' and char_length(btrim(coalesce(p_next_actor, ''))) < 2 and p_next_actor_user_id is null then
    raise exception 'A return names who acts next' using errcode = '22023';
  end if;
  if p_attestation_method <> 'account' and char_length(btrim(coalesce(p_actor_name, ''))) < 2 then
    raise exception 'An external representative is recorded by name' using errcode = '22023';
  end if;
  -- A signed document is a file of this project.
  if p_attestation_method = 'signed_document' and (p_evidence_file_id is null or not exists (
    select 1 from public.files file where file.id = p_evidence_file_id and file.project_id = p_project_id and file.status <> 'deleted')) then
    raise exception 'A signed document is a file uploaded to this project' using errcode = '22023';
  end if;
  if p_evidence_file_id is not null and not exists (
    select 1 from public.files file where file.id = p_evidence_file_id and file.project_id = p_project_id) then
    raise exception 'Evidence file not found in project' using errcode = 'P0002';
  end if;
  -- The next responsible person is someone on this project.
  if p_next_actor_user_id is not null and not exists (
    select 1 from public.list_project_people(p_project_id) person where person.user_id = p_next_actor_user_id) then
    raise exception 'The next responsible person is not on this project' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_record_kind || ':' || p_record_id::text || ':signoff', 0));
  select event.* into v_last from public.record_signoff_events event
  where event.record_kind = p_record_kind and event.record_id = p_record_id
  order by event.sequence_number desc limit 1;

  if found then
    v_round := v_last.round_number + case when p_action = 'resubmit' then 1 else 0 end;
    if v_last.new_status in ('Closed', 'Withdrawn') and p_action <> 'reopen' then
      raise exception 'This record is %; reopen it first', lower(v_last.new_status) using errcode = '22023';
    end if;
    if p_action = 'submit' then
      raise exception 'This record was already submitted; resubmit it after a return' using errcode = '22023';
    end if;
  elsif p_action not in ('submit', 'acknowledge', 'witness') then
    raise exception 'The first sign-off action on a record is a submission' using errcode = '22023';
  end if;
  if p_action = 'resubmit' and (v_last.id is null or v_last.new_status not in ('Returned for Correction', 'Rejected', 'Reopened')) then
    raise exception 'Only a returned record is resubmitted' using errcode = '22023';
  end if;

  -- A user does not approve their own submission.
  if p_action in ('approve', 'accept', 'verify', 'close') and p_attestation_method = 'account' then
    select event.* into v_last_submit from public.record_signoff_events event
    where event.record_kind = p_record_kind and event.record_id = p_record_id
      and event.round_number = v_round and event.action in ('submit', 'resubmit', 'respond')
      and event.attestation_method = 'account'
    order by event.sequence_number desc limit 1;
    if found and v_last_submit.actor_user_id = v_actor and v_last_submit.action <> 'submit' then
      raise exception 'You cannot approve your own response' using errcode = '42501';
    end if;
    if found and v_last_submit.actor_user_id = v_actor and v_last_submit.action = 'submit'
      and p_workflow_profile in ('WO-DAILY', 'WC-COMPLETION', 'WF-ATTENDANCE', 'PDR-REVIEW', 'CHANGE-APPROVAL', 'LESSON-REVIEW') then
      raise exception 'You cannot approve your own submission' using errcode = '42501';
    end if;
  end if;

  -- The project's own settings for this workflow: approvers, delegation, limits, due days.
  v_config := app_private.spec_configuration(p_project_id) #> array['workflows', p_workflow_profile];
  v_stage_config := v_config #> array['stages', greatest(1, least(coalesce(p_stage_number, 1), 9))::text];
  if p_action in ('approve', 'accept', 'verify', 'close', 'reject') and p_attestation_method = 'account' then
    v_approvers := coalesce(v_stage_config -> 'approver_user_ids', '[]'::jsonb);
    if jsonb_array_length(v_approvers) > 0 and not v_approvers ? v_actor::text then
      select exists (
        select 1 from jsonb_array_elements(coalesce(v_config -> 'delegations', '[]'::jsonb)) delegation
        where delegation ->> 'to' = v_actor::text and v_approvers ? (delegation ->> 'from')
          and coalesce(nullif(delegation ->> 'until', '')::date, current_date) >= (now() at time zone 'America/Paramaribo')::date
      ) into v_delegate;
      if not v_delegate then
        raise exception 'Only the approvers this project named for this step can %', p_action using errcode = '42501';
      end if;
    end if;
    if p_workflow_profile = 'CHANGE-APPROVAL' and p_action = 'approve' then
      v_limit := nullif(v_config ->> 'approval_limit', '')::numeric;
      v_amount := greatest(
        coalesce(nullif(v_record #>> '{details,spec,approved_amount}', '')::numeric, 0),
        coalesce(nullif(v_record #>> '{details,spec,cost_impact}', '')::numeric, 0));
      if v_limit is not null and v_amount > v_limit and not coalesce(v_config -> 'above_limit_user_ids', '[]'::jsonb) ? v_actor::text then
        raise exception 'This change exceeds the approval limit of %; an approver above the limit decides', v_limit using errcode = '42501';
      end if;
    end if;
  end if;
  if v_due is null and nullif(v_stage_config ->> 'due_days', '') is not null and p_action not in ('close', 'withdraw') then
    v_due := now() + make_interval(days => (v_stage_config ->> 'due_days')::integer);
  end if;

  v_status := case p_action
    when 'submit' then 'Submitted'
    when 'acknowledge' then 'Acknowledged'
    when 'review' then 'Under Review'
    when 'approve' then 'Approved'
    when 'accept' then 'Accepted'
    when 'reject' then 'Rejected'
    when 'return' then 'Returned for Correction'
    when 'respond' then 'Responded'
    when 'resubmit' then 'Resubmitted'
    when 'verify' then 'Verified'
    when 'close' then 'Closed'
    when 'withdraw' then 'Withdrawn'
    when 'reopen' then 'Reopened'
    when 'witness' then coalesce(v_last.new_status, 'Witnessed')
  end;

  -- Parallel review: every designated approval before the record moves on.
  v_required := coalesce(nullif(v_stage_config ->> 'required_approvals', '')::integer, 1);
  if p_action in ('approve', 'accept', 'verify') and v_required > 1 then
    select count(distinct coalesce(event.actor_user_id::text || ':' || event.actor_name, '')) + 1 into v_count
    from public.record_signoff_events event
    where event.record_kind = p_record_kind and event.record_id = p_record_id and event.round_number = v_round
      and event.action = p_action and event.stage_number = greatest(1, least(coalesce(p_stage_number, 1), 9))
      and not (event.actor_user_id = v_actor and event.attestation_method = 'account' and p_attestation_method = 'account');
    if exists (
      select 1 from public.record_signoff_events event
      where event.record_kind = p_record_kind and event.record_id = p_record_id and event.round_number = v_round
        and event.action = p_action and event.actor_user_id = v_actor and event.attestation_method = 'account' and p_attestation_method = 'account'
    ) then
      raise exception 'You already recorded this approval in this round' using errcode = '22023';
    end if;
    if v_count < v_required then
      v_status := 'Partially Approved (' || v_count || '/' || v_required || ')';
    end if;
  end if;

  select nullif(btrim(profile.display_name), '') into v_name
  from public.profiles profile where profile.id = v_actor;
  -- F16: who signs with an account is described by the server: the project roles and the
  -- organisation of the membership. The role chosen in the screen is kept as the stage role.
  select string_agg(distinct role.name, ', ' order by role.name) into v_member_roles
  from public.project_memberships membership
  join public.project_member_roles member_role on member_role.membership_id = membership.id and member_role.project_id = membership.project_id
  join public.roles role on role.id = member_role.role_id
  where membership.project_id = p_project_id and membership.user_id = v_actor and membership.status = 'active';
  select coalesce(party.name, organization.name) into v_member_organization
  from public.projects project
  join public.organizations organization on organization.id = project.organization_id
  left join public.project_memberships membership on membership.project_id = project.id and membership.user_id = v_actor and membership.status = 'active'
  left join public.parties party on party.id = membership.portal_party_id
  where project.id = p_project_id
  limit 1;

  insert into public.record_signoff_events (
    organization_id, project_id, record_kind, record_id, workflow_profile, round_number,
    stage_number, action, actor_user_id, actor_name, actor_organization, actor_role, stage_role,
    attestation_method, signature_image, evidence_file_id, comments, return_reason,
    next_actor, next_actor_user_id, due_at, submitted_version, previous_status, new_status
  ) values (
    v_project.organization_id, p_project_id, p_record_kind, p_record_id, p_workflow_profile, v_round,
    v_stage, p_action, v_actor,
    case when p_attestation_method = 'account' then coalesce(v_name, 'User') else btrim(p_actor_name) end,
    -- An external representative's name and organisation are their stated attestation; an account's are the server's.
    case when p_attestation_method = 'account' then v_member_organization else nullif(btrim(coalesce(p_actor_organization, '')), '') end,
    case when p_attestation_method = 'account' then left(coalesce(v_member_roles, 'Project member'), 108) else btrim(p_actor_role) end
      || case when v_delegate then ' (delegate)' else '' end,
    nullif(btrim(coalesce(p_actor_role, '')), ''),
    p_attestation_method, p_signature_image, p_evidence_file_id,
    nullif(btrim(coalesce(p_comments, '')), ''), nullif(btrim(coalesce(p_return_reason, '')), ''),
    coalesce(nullif(btrim(coalesce(p_next_actor, '')), ''), (select person.display_name from public.list_project_people(p_project_id) person where person.user_id = p_next_actor_user_id)),
    p_next_actor_user_id, v_due,
    case when p_action in ('submit', 'resubmit', 'respond') then v_record end,
    v_last.new_status, v_status
  ) returning * into v_event;

  -- The record's own status follows the action (one status, set by the workflow).
  if v_status not like 'Partially Approved%' and p_action <> 'witness' then
    perform app_private.signoff_move_record(p_record_kind, p_record_id, p_action, p_workflow_profile, coalesce(v_name, 'User'));
  end if;

  -- The next responsible person hears about it; after a decision, so does the author.
  v_recipient := coalesce(p_next_actor_user_id,
    case when p_action in ('approve', 'accept', 'reject', 'return', 'verify', 'close', 'reopen') then v_creator end);
  if v_recipient is not null and v_recipient <> v_actor then
    insert into public.notifications (
      organization_id, project_id, recipient_user_id, notification_type,
      title, body, source_type, source_id, due_at, dedupe_key
    ) values (
      v_project.organization_id, p_project_id, v_recipient, 'review_requested',
      left(v_status || ': ' || v_number, 240),
      left(coalesce(v_record ->> 'title', 'Sign-off') || ' — ' || coalesce(nullif(btrim(p_comments), ''), v_status), 2000),
      'signoff', p_record_id, v_due,
      'signoff:' || v_event.id::text
    )
    on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return v_event;
end;
$$;
