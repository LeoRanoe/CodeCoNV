-- Developer package v5 (25-11-2026), Word section 3.1: the Close / Verify / Approve dialog.
--
-- "Close / verify fields (Issue closure note, NCR verification result and verifier, Agreement closure
-- note, CO approved amount / days) are entered in the Close / Verify / Approve action dialog and stored
-- in the sign-off log, not in the form."
--
-- * record_signoff_events.details holds what the action carried. app_private.signoff_outcome_fields lists,
--   per workflow profile and action, which details the action takes and which it requires; the client
--   (lib/forms/signoff.ts, outcomeFields) mirrors that list and a node test keeps the two identical.
-- * record_signoff_action takes p_details, refuses a missing or invalid detail (22023) and writes the
--   details to the record's spec together with the status the action sets.
-- * An NCR is closed only on an Effective result; a return may record Not Effective / Rework Required /
--   Pending, which reopens the corrective action (the same rule the form had).
-- * The approval limit of a Change Order is checked against the approved amount of the action.
-- * These details are written by a sign-off action only: a trigger keeps them as they were on any other
--   write, because the forms no longer carry them.
-- * spec_form_rules no longer requires the moved fields (regenerated from lib/forms/spec-forms.ts).

alter table public.record_signoff_events add column if not exists details jsonb not null default '{}'::jsonb;
comment on column public.record_signoff_events.details is
  'What the Close / Verify / Approve dialog carried: closure note, verification result, approved amount and days.';

create or replace function app_private.signoff_outcome_fields()
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $f$
  select '{
    "ISSUE-CLOSEOUT": {
      "verify": [{"key": "closure_note", "required": true, "kind": "textarea", "max": 4000}],
      "close": [{"key": "closure_note", "required": true, "kind": "textarea", "max": 4000}]
    },
    "NCR-CORRECTIVE": {
      "verify": [{"key": "verification_result", "required": true, "kind": "select", "options": ["Effective"]}],
      "close": [{"key": "verification_result", "required": true, "kind": "select", "options": ["Effective"]}],
      "return": [{"key": "verification_result", "required": false, "kind": "select", "options": ["Not Effective", "Rework Required", "Pending"]}]
    },
    "AGREEMENT-ACK": {
      "close": [{"key": "closure_note", "required": false, "kind": "text", "max": 250}]
    },
    "CHANGE-APPROVAL": {
      "approve": [
        {"key": "approved_amount", "required": true, "kind": "number"},
        {"key": "approved_days", "required": true, "kind": "number"}
      ]
    }
  }'::jsonb;
$f$;

create or replace function app_private.signoff_outcome(p_profile text, p_action text, p_details jsonb)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, app_private
as $f$
declare
  v_fields jsonb := app_private.signoff_outcome_fields() #> array[p_profile, p_action];
  v_field jsonb;
  v_key text;
  v_value text;
  v_out jsonb := '{}'::jsonb;
begin
  if p_details is not null and jsonb_typeof(p_details) <> 'object' then
    raise exception 'The details of an action are an object' using errcode = '22023';
  end if;
  for v_key in select detail.key from jsonb_object_keys(coalesce(p_details, '{}'::jsonb)) detail(key) loop
    if v_fields is null or not exists (select 1 from jsonb_array_elements(v_fields) field where field ->> 'key' = v_key) then
      raise exception 'The action % does not take %', p_action, replace(v_key, '_', ' ') using errcode = '22023';
    end if;
  end loop;
  for v_field in select value from jsonb_array_elements(coalesce(v_fields, '[]'::jsonb)) loop
    v_key := v_field ->> 'key';
    v_value := btrim(coalesce(p_details ->> v_key, ''));
    if v_value = '' then
      if (v_field ->> 'required')::boolean then
        raise exception '% is required to % this record', initcap(replace(v_key, '_', ' ')), p_action using errcode = '22023';
      end if;
      continue;
    end if;
    case v_field ->> 'kind'
      when 'number' then
        if v_value !~ '^-?[0-9]{1,12}([.][0-9]{1,4})?$' then
          raise exception '% must be a number', initcap(replace(v_key, '_', ' ')) using errcode = '22023';
        end if;
      when 'select' then
        if not (v_field -> 'options') ? v_value then
          raise exception '% is not an allowed value for % when you %', v_value, replace(v_key, '_', ' '), p_action using errcode = '22023';
        end if;
      else
        if char_length(v_value) < 3 and (v_field ->> 'required')::boolean then
          raise exception '% needs at least 3 characters', initcap(replace(v_key, '_', ' ')) using errcode = '22023';
        end if;
        if char_length(v_value) > coalesce((v_field ->> 'max')::integer, 4000) then
          raise exception '% is too long', initcap(replace(v_key, '_', ' ')) using errcode = '22023';
        end if;
    end case;
    v_out := v_out || jsonb_build_object(v_key, v_value);
  end loop;
  return v_out;
end;
$f$;

drop function if exists app_private.signoff_move_record(text, uuid, text, text, text);
create or replace function app_private.signoff_move_record(
  p_kind text, p_record_id uuid, p_action text, p_profile text, p_actor_name text, p_outcome jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_workflow text;
  v_targets text[];
  v_target text;
  v_decision jsonb := '{}'::jsonb;
  v_today text := to_char((now() at time zone 'America/Paramaribo')::date, 'YYYY-MM-DD');
begin
  v_workflow := case p_action
    when 'submit' then 'Open' when 'acknowledge' then 'Assigned' when 'review' then 'In Progress'
    when 'respond' then 'Pending Verification' when 'resubmit' then 'Pending Verification'
    when 'return' then 'In Progress' when 'reject' then 'In Progress'
    when 'approve' then 'Closed' when 'accept' then 'Closed' when 'verify' then 'Closed' when 'close' then 'Closed'
    when 'withdraw' then 'Cancelled' when 'reopen' then 'Open'
  end;
  if v_workflow is null then return; end if;
  -- A change order is approved, not closed, and a lesson approved for sharing stays a lesson.
  if p_profile = 'CHANGE-APPROVAL' and p_action in ('approve', 'reject') then
    v_decision := jsonb_build_object('approval_status', case p_action when 'approve' then 'Approved' else 'Rejected' end,
      'approved_by', p_actor_name, 'approved_on', v_today, 'approved_by_user_id', (select auth.uid()));
  elsif p_profile = 'LESSON-REVIEW' and p_action = 'submit' then
    v_decision := jsonb_build_object('review_status', 'Submitted (shared)');
  elsif p_profile = 'LESSON-REVIEW' and p_action = 'approve' then
    v_decision := jsonb_build_object('review_status', 'Approved for Sharing', 'reviewed_by', p_actor_name, 'reviewed_on', v_today, 'reviewed_by_user_id', (select auth.uid()));
  elsif p_profile = 'LESSON-REVIEW' and p_action = 'review' then
    v_decision := jsonb_build_object('review_status', 'Reviewed', 'reviewed_by', p_actor_name, 'reviewed_on', v_today, 'reviewed_by_user_id', (select auth.uid()));
  end if;

  -- What was entered in the dialog is written to the record with the decision (v5.0).
  v_decision := v_decision || coalesce(p_outcome, '{}'::jsonb);
  if p_profile = 'NCR-CORRECTIVE' and p_action = 'return' and p_outcome ->> 'verification_result' in ('Not Effective', 'Rework Required') then
    v_decision := v_decision || '{"corrective_action_reopened": "yes"}'::jsonb;
  end if;

  v_targets := case p_kind
    when 'finding' then case p_action
      when 'acknowledge' then array['assigned'] when 'review' then array['in_progress']
      when 'respond' then array['ready_for_verification'] when 'resubmit' then array['ready_for_verification']
      when 'return' then array['reopened', 'in_progress'] when 'reject' then array['reopened', 'in_progress']
      when 'verify' then array['ready_for_verification', 'closed'] when 'close' then array['ready_for_verification', 'closed']
      when 'approve' then array['ready_for_verification', 'closed'] when 'accept' then array['ready_for_verification', 'closed']
      when 'withdraw' then array['cancelled'] when 'reopen' then array['reopened'] else array[]::text[] end
    when 'hse_event' then case p_action
      when 'acknowledge' then array['investigating'] when 'review' then array['investigating']
      when 'respond' then array['investigating'] when 'resubmit' then array['investigating']
      when 'return' then array['action_required'] when 'reject' then array['action_required']
      when 'verify' then array['closed'] when 'close' then array['closed'] when 'approve' then array['closed'] when 'accept' then array['closed']
      when 'withdraw' then array['cancelled'] when 'reopen' then array['open'] else array[]::text[] end
    when 'register_entry' then case p_action
      when 'submit' then array['open'] when 'acknowledge' then array['in_review'] when 'review' then array['in_review']
      when 'respond' then array['in_review'] when 'resubmit' then array['in_review']
      when 'return' then array['open'] when 'reject' then array['rejected']
      when 'approve' then array['approved'] when 'accept' then array['approved']
      when 'verify' then array['closed'] when 'close' then array['closed']
      when 'withdraw' then array['cancelled'] when 'reopen' then array['open'] else array[]::text[] end
    else array[]::text[]
  end;

  perform set_config('app.signoff_write', 'on', true);
  -- Each step is its own attempt: a status the record cannot take (a closed finding is never
  -- reopened) leaves the status, never the logged action.
  foreach v_target in array v_targets loop
    begin
      case p_kind
        when 'finding' then update public.findings set status = v_target where id = p_record_id and status <> v_target;
        when 'hse_event' then update public.hse_events set status = v_target where id = p_record_id and status <> v_target;
        when 'register_entry' then update public.project_register_entries set status = v_target where id = p_record_id and status <> v_target;
        else null;
      end case;
    exception when others then
      null;
    end;
  end loop;
  begin
    v_decision := v_decision || jsonb_build_object('workflow_status', v_workflow);
    case p_kind
      when 'finding' then
        update public.findings set issue_management = jsonb_set(coalesce(issue_management, '{}'::jsonb), '{spec}', coalesce(issue_management -> 'spec', '{}'::jsonb) || v_decision)
        where id = p_record_id and jsonb_typeof(issue_management -> 'spec') = 'object';
      when 'hse_event' then
        update public.hse_events set spec = spec || v_decision where id = p_record_id and spec <> '{}'::jsonb;
      when 'register_entry' then
        update public.project_register_entries set details = jsonb_set(coalesce(details, '{}'::jsonb), '{spec}', coalesce(details -> 'spec', '{}'::jsonb) || v_decision)
        where id = p_record_id and jsonb_typeof(details -> 'spec') = 'object';
      when 'inspection' then
        update public.inspections set spec = spec || v_decision where id = p_record_id and spec <> '{}'::jsonb;
      else null;
    end case;
  exception when others then
    null;
  end;
  perform set_config('app.signoff_write', 'off', true);
end;
$$;

revoke all on function app_private.signoff_move_record(text, uuid, text, text, text, jsonb) from public, anon, authenticated;

drop function if exists public.record_signoff_action(uuid, text, uuid, text, integer, text, text, text, text, text, text, uuid, text, text, text, uuid, timestamptz);
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
  p_due_at timestamptz default null,
  p_details jsonb default null
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
  v_violations text[];
  v_outcome jsonb := '{}'::jsonb;
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

  -- v5.0: what is entered in the Close / Verify / Approve dialog (closure note, verification result,
  -- approved amount and days) is checked here and stored in the sign-off log with the action.
  v_outcome := app_private.signoff_outcome(p_workflow_profile, p_action, p_details);

  -- F03: a formal submission is complete. The workbook's always-required fields and its fixed lists
  -- are checked on the stored record, whatever path wrote it (form, offline replay, older client).
  if p_action in ('submit', 'resubmit') then
    v_violations := app_private.spec_violations(
      app_private.spec_form_of(case p_record_kind when 'finding' then 'findings' when 'hse_event' then 'hse_events'
        when 'register_entry' then 'project_register_entries' else p_record_kind end, v_record),
      coalesce(v_record #> case p_record_kind when 'finding' then array['issue_management', 'spec'] when 'register_entry' then array['details', 'spec'] else array['spec'] end, '{}'::jsonb),
      null, true);
    if cardinality(v_violations) > 0 then
      raise exception 'Complete the form before submitting: %', array_to_string(v_violations, '; ') using errcode = '22023';
    end if;
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
        coalesce(nullif(v_outcome ->> 'approved_amount', '')::numeric, nullif(v_record #>> '{details,spec,approved_amount}', '')::numeric, 0),
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
  if p_workflow_profile = 'NCR-CORRECTIVE' and v_outcome ? 'verification_result' then
    v_outcome := v_outcome || jsonb_build_object('verified_by', coalesce(v_name, 'User'),
      'verified_on', to_char((now() at time zone 'America/Paramaribo')::date, 'YYYY-MM-DD'), 'verified_by_user_id', v_actor);
  end if;
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
    next_actor, next_actor_user_id, due_at, submitted_version, previous_status, new_status, details
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
    v_last.new_status, v_status, v_outcome
  ) returning * into v_event;

  -- The record's own status follows the action (one status, set by the workflow).
  if v_status not like 'Partially Approved%' and p_action <> 'witness' then
    perform app_private.signoff_move_record(p_record_kind, p_record_id, p_action, p_workflow_profile, coalesce(v_name, 'User'), v_outcome);
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

revoke all on function public.record_signoff_action(uuid, text, uuid, text, integer, text, text, text, text, text, text, uuid, text, text, text, uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.record_signoff_action(uuid, text, uuid, text, integer, text, text, text, text, text, text, uuid, text, text, text, uuid, timestamptz, jsonb) to authenticated;

-- The outcomes of a sign-off action are written by that action only.
create or replace function app_private.protect_signoff_outcomes()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $f$
declare
  v_row jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_column text;
  v_keys text[];
  v_key text;
  v_spec jsonb;
  v_old_spec jsonb;
begin
  if coalesce(current_setting('app.signoff_write', true), '') = 'on' then
    return new;
  end if;
  if tg_table_name = 'findings' then
    v_column := 'issue_management';
    v_keys := array['closure_note', 'verification_result', 'verified_by', 'verified_on', 'verified_by_user_id'];
  elsif v_row ->> 'register_type' = 'agreement' then
    v_column := 'details';
    v_keys := array['closure_note'];
  elsif v_row ->> 'register_type' = 'change_order' then
    v_column := 'details';
    v_keys := array['approved_amount', 'approved_days'];
  else
    return new;
  end if;
  v_spec := v_row #> array[v_column, 'spec'];
  if jsonb_typeof(v_spec) is distinct from 'object' then
    return new;
  end if;
  v_old_spec := coalesce(v_old #> array[v_column, 'spec'], '{}'::jsonb);
  if jsonb_typeof(v_old_spec) is distinct from 'object' then
    v_old_spec := '{}'::jsonb;
  end if;
  foreach v_key in array v_keys loop
    v_spec := v_spec - v_key;
    if v_old_spec ? v_key then
      v_spec := v_spec || jsonb_build_object(v_key, v_old_spec -> v_key);
    end if;
  end loop;
  if v_spec is distinct from (v_row #> array[v_column, 'spec']) then
    v_row := jsonb_set(v_row, array[v_column, 'spec'], v_spec);
    new := jsonb_populate_record(new, v_row);
  end if;
  return new;
end;
$f$;

drop trigger if exists findings_zzz_protect_outcomes on public.findings;
create trigger findings_zzz_protect_outcomes before insert or update on public.findings
  for each row execute function app_private.protect_signoff_outcomes();
drop trigger if exists project_register_entries_zzz_protect_outcomes on public.project_register_entries;
create trigger project_register_entries_zzz_protect_outcomes before insert or update on public.project_register_entries
  for each row execute function app_private.protect_signoff_outcomes();

create or replace function app_private.spec_form_rules()
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $rules$
  select '{"issue":{"required":["identified_at","issue_type","issue_category","responsible_party","priority","corrective_action","target_date"],"rows":[],"conditional":[],"columns":{},"other":["impact_types"],"numbers":{},"options":{"issue_type":["Quality","Equipment","Materials","Schedule","Operational","Technical / Design","Commercial / Contractual"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"],"responsible_party":["Client","Consultant","Main Contractor","Subcontractor","Supplier","Utility Provider","Authority","Weather","Shared","Undetermined"],"priority":["Low","Medium","High","Critical"],"impact_types":["Cost","Schedule","Quality","Scope","Resources","Client","Other"]},"dependent":{"issue_category":{"parent":"issue_type","groups":{"Quality":["Workmanship","Concrete Works","Reinforcement Works","Structural Works","Welding & Fabrication","Masonry Works","Waterproofing","Painting & Finishing","Dimensional Accuracy","Installation Works","Material Quality","Inspection / Testing Failure","Drawing / Specification Deviation","Non-Conformance (NCR)"],"Equipment":["Equipment Breakdown","Equipment Availability","Preventive Maintenance","Corrective Maintenance","Equipment Damage","Equipment Performance","Tools & Small Equipment","Calibration","Inspection / Certification","Spare Parts"],"Materials":["Material Shortage","Delayed Delivery","Incorrect Materials","Damaged Materials","Material Quality","Storage & Handling","Inventory Management","Material Wastage","Procurement / Ordering","Supplier Performance","Material Approval","Material Expiry"],"Schedule":["Activity Delay","Milestone Delay","Critical Path Delay","Manpower Shortage","Subcontractor Delay","Material Delivery Delay","Equipment Availability Delay","Weather Impact","Drawing / Information Delay","Approval / Permit Delay","Work Sequencing","Rework","Site Access Delay"],"Operational":["Manpower Allocation","Communication","Coordination","Site Logistics","Site Access","Utilities","Site Facilities","Documentation","Subcontractor Management","Client / Consultant Coordination","Resource Allocation","Decision Required"],"Technical / Design":["Drawing Discrepancy","Design Error / Omission","Technical Query (RFI)","Design Change","Interdisciplinary Clash","Specification Clarification","Constructability"],"Commercial / Contractual":["Variation / Change Order","Cost Impact","Payment / Certification","Contractual Notice / Claim","Scope Clarification","Budget / Cost Control"]}}},"labels":{"identified_at":"Date/time identified","issue_type":"Issue type","issue_category":"Category","discipline":"Discipline / work package","responsible_party":"Responsible party","priority":"Priority","impact_types":"Impact type","immediate_action":"Immediate action taken","corrective_action":"Corrective action required","target_date":"Target completion date","related_record":"Related record"},"clientOnly":[]},"ncr":{"required":["raised_at","ncr_type","ncr_category","discipline","requirement_reference","detected_during","severity","containment","disposition","corrective_action","action_owner","target_date"],"rows":[],"conditional":[{"key":"containment_justification","when":{"key":"containment","in":["Not applicable (justification required)"]}},{"key":"containment_details","rows":true,"when":{"key":"containment","match":"^(?!not applicable)"}}],"columns":{"containment_details":["person","implemented_at"]},"other":["detected_during","containment","root_cause_category"],"numbers":{},"options":{"ncr_type":["Workmanship","Materials & Products","Design & Drawings","Specifications & Standards","Installation & Assembly","Testing & Inspection","Process & Procedures","Survey & Dimensional Control","Documentation & Traceability","Equipment & Plant"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"],"detected_during":["Incoming Material Inspection","In-Process Inspection","Final Inspection","Testing","Site Observation","Audit","Other"],"severity":["Minor","Major","Critical"],"containment":["Stop affected work / suspend activity","Isolate or quarantine nonconforming materials","Segregate affected work or products","Prevent use or installation of affected materials","Remove defective work from service / restrict access","Provide temporary protection or safety measures","Implement temporary repair / make-safe measure","Increase inspection, testing or monitoring","Notify responsible supervisor / contractor / consultant","Other","Not applicable (justification required)"],"disposition":["Rework","Repair","Use As Is (with approved concession)","Reject / Replace","Scrap","Further Technical Evaluation Required"],"root_cause_category":["Method","People","Material","Equipment","Design","Measurement","Supplier","Other"]},"dependent":{"ncr_category":{"parent":"ncr_type","groups":{"Workmanship":["Poor Workmanship / Finish","Incorrect Work Method","Incomplete Work","Damage to Completed Work","Defective Joint / Connection","Poor Surface Preparation"],"Materials & Products":["Incorrect Material / Product","Material Outside Specification","Damaged Material / Product","Expired / Shelf-Life Exceeded","Missing Material Certification","Incorrect Storage / Handling"],"Design & Drawings":["Design Error / Omission","Work Not to Approved Drawing","Obsolete / Incorrect Drawing Revision","Unresolved Design Conflict","Unapproved Design Change"],"Specifications & Standards":["Specification Non-Compliance","Code / Standard Non-Compliance","Incorrect Acceptance Criteria","Unapproved Material / Substitution"],"Installation & Assembly":["Incorrect Installation","Incorrect Position / Orientation","Incomplete Installation","Incorrect Connection / Fixing","System Interface / Coordination Failure"],"Testing & Inspection":["Failed Inspection","Failed Test Result","Required Test Not Performed","Incorrect Test Method","Test Equipment / Calibration Issue","Inspection Hold Point Bypassed"],"Process & Procedures":["Method Statement Not Followed","Inspection & Test Plan Not Followed","Unapproved Procedure Used","Process Parameter Outside Limits","Required Quality Control Omitted"],"Survey & Dimensional Control":["Incorrect Setting Out","Level / Elevation Out of Tolerance","Alignment / Plumbness Out of Tolerance","Dimension / Geometry Out of Tolerance","Incorrect Coordinates / Grid Reference"],"Documentation & Traceability":["Missing Quality Record","Incomplete / Incorrect Record","Missing Traceability","Missing Approval / Authorization","Missing As-Built Information"],"Equipment & Plant":["Unsuitable Equipment Used","Equipment Condition Non-Compliance","Equipment Calibration / Certification Invalid","Equipment Setup / Configuration Incorrect"]}}},"labels":{"raised_at":"Date raised","ncr_type":"NCR type","ncr_category":"Category","discipline":"Discipline / work package","requirement_reference":"Requirement reference","detected_during":"Detected during","related_inspection":"Related inspection","severity":"Severity / classification","containment":"Immediate containment","containment_justification":"Why no containment applies","containment_details":"Containment carried out","containment_details.person":"Responsible person","containment_details.implemented_at":"Implemented at","disposition":"Disposition","root_cause_category":"Root cause category","root_cause_analysis":"Root cause analysis","corrective_action":"Corrective action","action_owner":"Action owner","target_date":"Target completion date"},"clientOnly":[]},"hse":{"required":["observed_at","hse_type","hse_category","potential_consequences","risk_likelihood","risk_severity","corrective_action","action_owner","due_date"],"rows":[],"conditional":[{"key":"risk_rating","when":{"all":[{"key":"risk_likelihood","filled":true},{"key":"risk_severity","filled":true}]}},{"key":"closure_note","when":{"all":[{"key":"workflow_status","in":["Pending Verification","Closed","Cancelled"]},{"key":"workflow_status","in":["Closed"]}]}}],"columns":{},"other":["potential_consequences"],"numbers":{},"options":{"hse_type":["Safety","Health","Environment","Unsafe Act","Unsafe Condition","HSE Observation"],"potential_consequences":["Injury","Illness","Property Damage","Fire","Environmental Harm","Public Impact","Other","Not Applicable"]},"dependent":{"hse_category":{"parent":"hse_type","groups":{"Safety":["Personal Protective Equipment (PPE)","Working at Heights","Scaffolding & Ladders","Fall Protection","Electrical Safety","Fire Prevention & Protection","Hot Work","Lifting Operations & Rigging","Excavation & Trenching","Confined Space","Tools & Machinery Safety","Traffic & Vehicle Safety","Housekeeping","Slips, Trips & Falls","Barricades & Safety Signage","Permit to Work","Emergency Preparedness"],"Health":["Heat Stress & Dehydration","Fatigue & Workload","Dust Exposure","Noise Exposure","Chemical Exposure","Respiratory Protection","Ergonomics & Manual Handling","Biological Hazards","Skin & Eye Protection","Sanitation & Hygiene","Drinking Water & Food Hygiene","First Aid & Medical Facilities","Vector-borne Disease Risk","Sun / UV Exposure"],"Environment":["Oil & Fuel Storage / Leakage","Chemical Storage & Handling","Hazardous Waste Management","General Waste Management","Wastewater Management","Soil Contamination","Water Pollution Prevention","Air Emissions & Dust Control","Noise & Vibration","Erosion & Sediment Control","Stormwater & Drainage","Vegetation & Habitat Protection","Wildlife Protection","Environmental Permits & Controls"],"Unsafe Act":["Failure to Wear PPE","Improper Use of Tools / Equipment","Unauthorized Equipment Operation","Working at Heights Without Protection","Failure to Follow Procedure","Unsafe Lifting Practice","Improper Manual Handling","Bypassing Safety Devices","Horseplay / Unsafe Behaviour","Working Without Permit","Unauthorized Access","Distracted Working","Unsafe Driving"],"Unsafe Condition":["Inadequate Fall Protection","Defective Scaffolding / Ladders","Exposed / Defective Electrical System","Damaged Tools / Equipment","Unprotected Openings / Edges","Poor Housekeeping","Inadequate Lighting","Missing Safety Signage","Inadequate Barricades","Unsafe Excavation","Fire Hazard / Inadequate Fire Equipment","Chemical Leak / Inadequate Containment","Poor Ventilation","Slippery / Uneven Surface","Falling Object Hazard","Inadequate Emergency Equipment"],"HSE Observation":["Positive Safety Practice","Positive Health Practice","Positive Environmental Practice","HSE Improvement Opportunity"]}}},"labels":{"observed_at":"Date/time observed","hse_type":"Issue type","hse_category":"Category","person_involved":"Person / contractor involved","potential_consequences":"Potential consequence","risk_likelihood":"Risk likelihood","risk_severity":"Potential severity","risk_rating":"Risk rating","immediate_action":"Immediate action taken","corrective_action":"Corrective / preventive action","action_owner":"Action owner","due_date":"Due date","related_record":"Related incident","closure_note":"Verification / closure note"},"clientOnly":[]},"hse_incident":{"required":["incident_at","incident_type","incident_category","immediate_response","incident_severity","investigation_required","hse_reviewer"],"rows":["corrective_actions"],"conditional":[{"key":"environmental_impact","when":{"key":"incident_type","in":["Environmental Incident"]}},{"key":"property_damage","when":{"all":[{"key":"incident_type","in":["Property / Equipment Damage","Fire / Explosion","Vehicle / Traffic Incident"]},{"key":"incident_type","in":["Property / Equipment Damage"]}]}},{"key":"notification_log","rows":true,"when":{"all":[{"key":"authorities_notified","in":["Notified","Pending"]},{"key":"authorities_notified","in":["Notified"]}]}},{"key":"investigation_findings","when":{"key":"investigation_required","in":["Yes"]}},{"key":"closure_note","when":{"all":[{"key":"workflow_status","in":["Pending Verification","Closed","Cancelled"]},{"key":"workflow_status","in":["Closed"]}]}}],"columns":{"notification_log":["authority","notified_at"],"corrective_actions":["action","owner","due"]},"other":["environmental_impact"],"numbers":{},"options":{"incident_type":["Near Miss","Injury / Illness","Property / Equipment Damage","Environmental Incident","Fire / Explosion","Vehicle / Traffic Incident","Other Event"],"environmental_impact":["None","Soil","Surface Water","Groundwater","Air","Waste","Wildlife","Vegetation","Other"],"property_damage":["None","Minor","Major","Total Loss","Under Assessment"],"authorities_notified":["Not Required","Pending","Notified"],"investigation_required":["Yes","No","To Be Determined"]},"dependent":{"incident_category":{"parent":"incident_type","groups":{"Near Miss":["Falling / Dropped Object Near Miss","Slip / Trip / Fall Near Miss","Vehicle / Equipment Near Collision","Electrical Near Miss","Lifting Operation Near Miss","Work-at-Height Near Miss","Excavation / Trenching Near Miss","Fire / Explosion Near Miss","Chemical Release Near Miss","Structural / Temporary Works Near Miss"],"Injury / Illness":["Struck by / against object","Fall from height","Slip / trip on same level","Caught in / between","Manual handling / strain","Electrical contact","Exposure (heat / chemical / biological)","Cut / puncture","Occupational illness","Other injury mechanism"],"Property / Equipment Damage":["Building / Structure Damage","Plant / Machinery Damage","Vehicle Accident / Damage","Material / Asset Damage"],"Environmental Incident":["Oil / Fuel Spill","Chemical Spill / Release","Waste Mismanagement Event","Wastewater / Sewage Release","Air Emission / Dust Event","Water / Soil Contamination","Wildlife / Vegetation Impact"],"Fire / Explosion":["Fire","Explosion","Smoke / Overheating Event"],"Vehicle / Traffic Incident":["Vehicle Collision","Vehicle Rollover","Pedestrian / Vehicle Contact","Reversing Incident","Load Shift / Falling Load"],"Other Event":["Security-Related Event","Public / Third-Party Incident","Other HSE Incident"]}}},"labels":{"incident_at":"Incident date/time","incident_type":"Incident type","incident_category":"Incident category","people_involved":"People involved / affected","injury_classification":"Injury classification","injury_nature":"Nature of injury / illness","body_part":"Body part affected","environmental_impact":"Environmental impact","property_damage":"Property / equipment damage","property_damage_detail":"Affected asset and estimated impact","immediate_response":"Immediate response","authorities_notified":"Authorities / client notified","notification_log":"Notification log","notification_log.authority":"Authority / party","notification_log.notified_at":"Notified at","witnesses":"Witnesses","incident_severity":"Potential / actual severity","investigation_required":"Investigation required","investigation_findings":"Investigation findings / root cause","corrective_actions":"Corrective / preventive actions","corrective_actions.action":"Action","corrective_actions.owner":"Owner","corrective_actions.due":"Due date","related_observation":"Related HSE observation","hse_reviewer":"HSE reviewer","closure_note":"Closure note"},"clientOnly":["injury_classification","injury_nature","body_part"]},"delivery":{"required":["delivery_at","supplier","purchase_order","material_group","material_category","material_specification","ordered_quantity","delivered_quantity","unit","delivery_status","arrival_condition","inspection_result","received_by"],"rows":[],"conditional":[{"key":"planned_delivery_at","when":{"all":[{"any":[{"key":"delivery_status","in":["Scheduled"]},{"key":"planned_delivery_at","filled":true}]},{"key":"delivery_status","in":["Scheduled"]}]}},{"key":"batch_number","when":{"key":"material_group","in":["Cement & Binders","Concrete & Precast","Reinforcement & Structural Steel","Piles & Foundation Products"]}},{"key":"ticket_number","when":{"key":"material_category","in":["Ready-mix concrete"]}},{"key":"concrete_class","when":{"key":"material_category","in":["Ready-mix concrete"]}},{"key":"batching_time","when":{"key":"material_category","in":["Ready-mix concrete"]}},{"key":"arrival_time","when":{"key":"material_category","in":["Ready-mix concrete"]}},{"key":"revised_delivery_date","when":{"key":"delivery_status","in":["Delayed","Partial Delivery"]}},{"key":"storage_location","when":{"all":[{"key":"inspection_result","in":["Accepted","Accepted with Comments"]},{"key":"stored_on_site","in":["yes"]}]}},{"key":"discrepancy_remarks","when":{"any":[{"key":"delivery_status","in":["Delayed","Partial Delivery"]},{"all":[{"key":"arrival_condition","filled":true},{"not":{"key":"arrival_condition","in":["Good"]}}]},{"key":"inspection_result","in":["Rejected","Quarantined"]},{"differ":["ordered_quantity","delivered_quantity"]}]}}],"columns":{},"other":["material_category","unit","arrival_condition","storage_location","discrepancy_type"],"numbers":{"slump_mm":{"min":0,"max":300},"concrete_temperature":{"min":0,"max":60},"cubes_taken":{"min":0,"max":99},"ordered_quantity":{"min":0,"max":null},"delivered_quantity":{"min":0,"max":null}},"options":{"material_group":["Cement & Binders","Sand, Aggregates & Fill","Concrete & Precast","Reinforcement & Structural Steel","Masonry Materials","Timber & Formwork","Roofing & Waterproofing","Doors, Windows & Glazing","Insulation","Electrical Materials","Plumbing & Sanitary Materials","Mechanical / HVAC Equipment","Finishes & Coatings","Piles & Foundation Products","Admixtures & Chemicals","Hardware & Consumables","Fuel & Lubricants","Other Material"],"water_added":["Yes","No"],"unit":["m","m²","m³","kg","tonne","pcs","set","lot","bags","trips / loads","litre (L)","sheets","rolls","days","hours","other"],"delivery_status":["Scheduled","Arrived On Time","Delayed","Partial Delivery","Not Delivered","Received with Discrepancy","Rejected","Cancelled"],"arrival_condition":["Good","Damaged","Wet","Contaminated","Incorrect","Mixed","Other"],"inspection_result":["Accepted","Accepted with Comments","Quarantined","Rejected","Pending Inspection"],"discrepancy_type":["Quantity Shortage","Excess Quantity","Wrong Specification","Damaged in Transit","Missing Documentation","Expired / Shelf-Life Concern","Packaging / Labelling Issue","Other"]},"dependent":{"material_category":{"parent":"material_group","groups":{"Cement & Binders":["Portland cement (bags)","Bulk cement","Lime","Grout / non-shrink grout","Masonry cement"],"Sand, Aggregates & Fill":["Concrete sand","Masonry / plaster sand","Fill sand (ophoogzand)","Crushed stone / gravel","Laterite / selected fill","Shell sand"],"Concrete & Precast":["Ready-mix concrete","Precast elements (beams, slabs, lintels)","Hollow-core / plank floor elements","Concrete blocks / pavers","Kerbs / pipes / manholes"],"Reinforcement & Structural Steel":["Reinforcing bars","Mesh / welded fabric","Structural sections","Plates / profiles","Bolts / anchors"],"Masonry Materials":["Concrete blocks","Clay bricks","AAC blocks","Mortar / ready-mix mortar","Wall ties / accessories"],"Timber & Formwork":["Surinamese hardwood (e.g. Basralocus, Wane, Kopi)","Treated softwood","Plywood / formwork panels","Props / formwork system","Wood preservative / anti-termite product"],"Roofing & Waterproofing":["Roof sheets (zinc / aluzinc / IBR)","Roof tiles","Membranes / bitumen","Liquid waterproofing","Flashings / gutters / downpipes"],"Doors, Windows & Glazing":["Doors / frames","Windows (aluminium / timber / PVC)","Glass","Ironmongery"],"Insulation":["Thermal insulation","Acoustic insulation","Pipe / duct insulation"],"Electrical Materials":["Cables","Conduits / trunking","Distribution boards","Fittings / luminaires","Earthing materials","Solar PV components"],"Plumbing & Sanitary Materials":["Pipes","Fittings / valves","Sanitary fixtures","Water tanks","Septic tanks","Pumps"],"Mechanical / HVAC Equipment":["AC units","Ductwork","Fans","Refrigerant piping"],"Finishes & Coatings":["Tiles","Paint / coatings","Plaster / skim products","Flooring","Ceiling boards / gypsum"],"Piles & Foundation Products":["Precast concrete piles","Timber piles","Steel piles","Geotextile / geogrid"],"Admixtures & Chemicals":["Concrete admixtures","Curing compound","Sealants / adhesives","Termiticide"],"Hardware & Consumables":["Fasteners","Tools","Adhesives","General consumables"],"Fuel & Lubricants":["Diesel","Petrol","Oils / lubricants"],"Other Material":["Other"]}}},"labels":{"delivery_at":"Delivery date/time","planned_delivery_at":"Planned delivery date/time","supplier":"Supplier","purchase_order":"Purchase order / requisition","delivery_note_number":"Delivery note number","material_group":"Material group","material_category":"Material category","batch_number":"Batch / lot / heat number","ticket_number":"Delivery ticket no.","truck_number":"Truck no.","concrete_class":"Concrete class","batching_time":"Batching time","arrival_time":"Arrival time","discharge_end_time":"Discharge end time","slump_mm":"Slump at site (mm)","concrete_temperature":"Concrete temperature (°C)","water_added":"Water added on site","cubes_taken":"Cubes / cylinders taken (pcs)","material_specification":"Material description / specification","ordered_quantity":"Ordered quantity","delivered_quantity":"Delivered quantity","unit":"Unit","delivery_status":"Delivery status","revised_delivery_date":"Revised delivery date","arrival_condition":"Condition on arrival","inspection_result":"Inspection result","storage_location":"Storage location","stored_on_site":"Stored on site","discrepancy_type":"Discrepancy type","discrepancy_remarks":"Discrepancy / remarks","received_by":"Received by"},"clientOnly":[]},"technical_instruction":{"required":["instruction_date","instruction_type","discipline","instruction_category","issued_to","action_owner"],"rows":[],"conditional":[],"columns":{},"other":["instruction_type","instruction_category","reason"],"numbers":{},"options":{"instruction_type":["Technical Clarification","Design / Drawing Clarification","Site Instruction","Corrective Technical Instruction","Construction Method / Sequence Instruction","Coordination / Interface Instruction","Inspection / Testing Instruction","Hold / Release Instruction","Technical Information / Document Request","Other"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"],"reason":["Design clarification","Site condition","Coordination","Specification conflict","Client request","Other"]},"dependent":{"instruction_category":{"parent":"discipline","groups":{"Preliminaries & Site Establishment":["Site access, hoarding & fencing","Temporary facilities & utilities","Site logistics, storage & laydown","Temporary works & protection","Mobilization / demobilization","Other – specify"],"Surveying & Setting Out":["Control points & benchmarks","Setting out / gridlines / coordinates","Levels, elevations & gradients","Survey tolerances & dimensional checks","As-built survey / record information","Other – specify"],"Earthworks & Ground Improvement":["Clearing, grubbing & stripping","Excavation, trenching & dewatering","Fill material & backfilling","Compaction & field density","Ground stabilization / improvement","Slope, embankment & formation level","Other – specify"],"Foundations & Substructure":["Foundation layout & dimensions","Piles, pile caps & pile testing","Footings, rafts & ground beams","Substructure concrete & reinforcement","Waterproofing / damp-proofing below grade","Backfill around foundations","Other – specify"],"Concrete & Reinforced Concrete":["Formwork & falsework","Reinforcement / rebar fixing","Concrete mix, grade & supply","Concrete placement, vibration & finishing","Curing, joints & surface treatment","Concrete testing / sampling","Embedded items, sleeves & cast-ins","Repair of defective concrete","Other – specify"],"Structural Steel & Metal Works":["Steel fabrication & material grade","Erection, alignment & tolerances","Bolted connections","Welds & welding procedures","Base plates, anchors & grouting","Protective coating / fireproofing","Inspection / testing of steelwork","Other – specify"],"Masonry & Wall Construction":["Block / brick type and specification","Wall layout, thickness & openings","Mortar, bonding & reinforcement","Lintels, ties & movement joints","Plumbness, line & level","Other – specify"],"Architectural & Interior Finishes":["Plastering, rendering & screed","Flooring, tiling & skirting","Ceilings & partitions","Doors, windows & glazing","Painting, coating & finishes","Joinery, fixtures & fittings","Other – specify"],"Waterproofing & Roofing":["Roof structure, sheets & coverings","Waterproofing membrane / application","Flashings, gutters & downpipes","Roof drainage & falls","Wet-area waterproofing","Waterproofing tests / leak investigation","Other – specify"],"Mechanical & HVAC Services":["HVAC equipment & capacity","Ductwork, insulation & supports","Refrigerant / chilled-water piping","Ventilation & air distribution","Equipment installation & alignment","Testing, balancing & commissioning","Other – specify"],"Plumbing, Sanitary & Drainage Services":["Water supply piping & fittings","Sanitary fixtures & connections","Soil, waste & vent piping","Stormwater / building drainage","Pumps, tanks & valves","Pressure, leakage & flow testing","Other – specify"],"Electrical & ELV Services":["Power distribution & switchgear","Cables, conduits & containment","Lighting & emergency lighting","Earthing & lightning protection","Data, communications & ELV systems","Testing, inspection & energization","Other – specify"],"Fire Protection & Life Safety":["Fire alarm & detection","Sprinkler / suppression systems","Fire pumps, tanks & hydrants","Fire stopping & compartmentation","Emergency systems & interfaces","Testing, cause-and-effect & commissioning","Other – specify"],"External Civil Works & Infrastructure":["Roads, pavements & hardstands","Kerbs, walkways & paving","Stormwater channels, culverts & drains","Retaining structures","Fencing, gates & barriers","Road marking & signage","Other – specify"],"Utilities & External Services":["Water supply / distribution","Sewerage / wastewater","Electrical utility connection","Telecommunications / data utility","Gas / fuel services where applicable","Utility crossings, protection & diversions","Other – specify"],"Landscaping & External Works":["Topsoil, grading & planting areas","Trees, shrubs & planting","Irrigation systems","Landscape edging & finishes","Erosion control & reinstatement","Other – specify"],"Testing, Commissioning & Handover":["Inspection & test plans / hold points","Pre-commissioning checks","Functional / performance testing","Integrated systems testing","Defect rectification / retesting","O&M manuals, training & handover records","Other – specify"],"Timber Structures & Carpentry":["Timber species & grade","Timber treatment & durability","Connections & fasteners","Moisture content & storage","Termite protection"]}}},"labels":{"instruction_date":"Instruction date","instruction_type":"Instruction type","discipline":"Discipline","instruction_category":"Category / subject","drawing_reference":"Drawing / document reference","reason":"Reason / background","reason_detail":"Supporting explanation","issued_to":"Issued to","action_owner":"Action owner","response_required_by":"Response required by","related_record":"Related record","closed_verified_by":"Closed / verified by"},"clientOnly":[]},"change_order":{"required":["request_date","change_type","change_category","change_reason","originator","cost_currency","cost_impact","time_impact","time_impact_unit","approval_status","instruction_to_proceed"],"rows":[],"conditional":[{"key":"quantity_unit","when":{"any":[{"key":"added_quantity","filled":true},{"key":"omitted_quantity","filled":true}]}}],"columns":{},"other":["change_reason","quantity_unit"],"numbers":{"added_quantity":{"min":0,"max":null},"omitted_quantity":{"min":0,"max":null},"cost_impact":{"min":null,"max":null},"time_impact":{"min":null,"max":null}},"options":{"change_type":["Scope Change","Design Change","Quantity Variation","Material / Equipment Change","Construction Method Change","Site Condition Change","Schedule / Time Change","Regulatory / Compliance Change","Coordination / Interface Change","Temporary Facilities / Site Infrastructure"],"change_reason":["Client Request","Consultant Instruction","Design Development","Design Error / Omission","Unforeseen Site Condition","Regulatory Requirement","Material Unavailability","Quality Improvement","Value Engineering","HSE Requirement","Contractor Proposal","Coordination Requirement","Other"],"cost_currency":["SRD","USD","EUR"],"time_impact_unit":["Hours","Calendar Days","Working Days"],"approval_status":["Draft","Submitted","Pending PM Approval","Approved","Rejected","Returned","Withdrawn","On Hold","Implemented","Closed"],"instruction_to_proceed":["Not Issued","Issued","Not Required"]},"dependent":{"change_category":{"parent":"change_type","groups":{"Scope Change":["Addition of Work","Omission of Work","Expansion of Scope","Reduction of Scope","Additional Deliverables"],"Design Change":["Architectural Modification","Structural Modification","MEP Design Modification","Drawing Revision","Design Correction"],"Quantity Variation":["Increase in Quantity","Decrease in Quantity","New BOQ Item","Removal of BOQ Item"],"Material / Equipment Change":["Material Substitution","Equipment Substitution","Material Specification Change","Alternative Product"],"Construction Method Change":["Change of Construction Method","Change of Installation Method","Change of Execution Sequence","Temporary Works Modification"],"Site Condition Change":["Unforeseen Ground Condition","Underground Utilities","Existing Structure Condition","Access Restriction","Environmental Site Condition"],"Schedule / Time Change":["Acceleration of Works","Work Resequencing","Change in Working Hours","Milestone / Completion Date Adjustment"],"Regulatory / Compliance Change":["Regulatory Requirement","Authority Requirement","Building Code Compliance","HSE Compliance Requirement"],"Coordination / Interface Change":["Design Coordination","Utility Coordination","Contractor Interface","Clash Resolution"],"Temporary Facilities / Site Infrastructure":["Site Office Modification","Storage Facility Modification","Temporary Utility Installation","Access Road Modification"]}}},"labels":{"request_date":"Request date","change_type":"Change type","change_category":"Change category","change_reason":"Reason for change","originator":"Originator / requester","drawing_reference":"Drawing / specification reference","added_quantity":"Added quantity","omitted_quantity":"Omitted quantity","quantity_unit":"Unit","cost_currency":"Currency","cost_impact":"Cost impact","time_impact":"Time impact","time_impact_unit":"Time unit","assessment":"Cost / schedule assessment","approval_status":"Approval status","instruction_to_proceed":"Instruction to proceed","related_record":"Related records"},"clientOnly":[]},"delay_report":{"required":["delay_start_at","delay_cause_type","delay_cause_category","detailed_cause","delay_duration","duration_unit","duration_basis","critical_path","recovery_action","action_owner"],"rows":[],"conditional":[{"key":"affected_activity_text","when":{"not":{"key":"affected_activity","filled":true}}},{"key":"closure_note","when":{"all":[{"key":"workflow_status","in":["Pending Verification","Closed","Cancelled"]},{"key":"workflow_status","in":["Closed"]}]}}],"columns":{},"other":["delay_cause_category"],"numbers":{"delay_duration":{"min":0,"max":null}},"options":{"delay_cause_type":["Labour","Materials & Procurement","Equipment","Design & Approvals","Site & External Conditions","Planning & Coordination","Quality & Rework","Other"],"responsible_party":["Client","Consultant","Main Contractor","Subcontractor","Supplier","Utility Provider","Authority","Weather","Shared","Undetermined"],"duration_unit":["Hours","Calendar Days","Working Days"],"duration_basis":["Actual","Estimated"],"critical_path":["Yes","No","Under Assessment"]},"dependent":{"delay_cause_category":{"parent":"delay_cause_type","groups":{"Labour":["Insufficient Manpower","Absenteeism","Low Productivity","Labour Dispute / Industrial Action"],"Materials & Procurement":["Late Material Delivery","Material Shortage","Incorrect / Rejected Material","Procurement / Supplier Delay","Import / Shipping / Customs Delay"],"Equipment":["Equipment Breakdown","Equipment Unavailable","Equipment Performance"],"Design & Approvals":["Late Drawings / Information","Design Change / Revision","Pending RFI / Technical Clarification","Pending Client / Consultant Approval","Permit / Authority Approval"],"Site & External Conditions":["Adverse Weather","Access Restriction","Ground / Site Conditions","Utility Interference","Third-Party Interference","Power Outage (EBS / grid)","Water Supply Interruption (SWM)","Flooding / Waterlogged Site"],"Planning & Coordination":["Poor Work Sequencing","Preceding Activity Incomplete","Subcontractor Delay","Coordination / Interface Issue","Insufficient Planning"],"Quality & Rework":["Failed Inspection / Test","Rework Required","NCR / Quality Hold"],"Other":["Other Delay Cause"]}}},"labels":{"delay_start_at":"Delay start date/time","affected_activity":"Affected activity","affected_activity_text":"Affected activity (not in the list)","delay_cause_type":"Delay cause type","delay_cause_category":"Delay cause category","detailed_cause":"Detailed cause","responsible_party":"Responsible party","delay_duration":"Delay duration","duration_unit":"Duration unit","duration_basis":"Duration is","critical_path":"Critical path impact","milestone_impact":"Schedule / milestone impact","recovery_action":"Mitigation / recovery action","action_owner":"Action owner","target_recovery_date":"Target recovery date","closure_note":"Closure note and reviewer"},"clientOnly":[]},"lessons_learned":{"required":["recorded_on","project_phase","lesson_category","situation","what_happened","impact_types","impact_detail","lesson_learned","recommendation","applicability"],"rows":[],"conditional":[],"columns":{},"other":["impact_types"],"numbers":{},"options":{"project_phase":["Initiation & Feasibility","Planning & Design","Procurement & Contracting","Mobilization & Site Establishment","Construction & Execution","Testing & Commissioning","Handover & Close-out","Post-Project Review"],"impact_types":["Cost","Schedule","Quality","Scope","Resources","Client","Other"],"applicability":["Current Project","Future Projects","Specific Discipline","Organization-wide"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"]},"dependent":{"lesson_category":{"parent":"project_phase","groups":{"Initiation & Feasibility":["Project Objectives & Requirements","Feasibility & Options Assessment","Site Selection & Due Diligence","Stakeholder Identification & Engagement","Risk Identification at Project Start"],"Planning & Design":["Scope Definition & Work Breakdown","Design Development & Completeness","Constructability & Buildability","Design Coordination & Clash Resolution","Permits, Codes & Authority Approvals","Cost Estimation & Budget Planning","Schedule Development & Sequencing","Risk Planning & Mitigation"],"Procurement & Contracting":["Tendering & Bid Evaluation","Contract Scope & Conditions","Supplier / Subcontractor Selection","Material & Equipment Submittals","Lead Times & Procurement Planning","Purchase Orders & Commercial Administration"],"Mobilization & Site Establishment":["Site Access & Possession","Temporary Facilities & Utilities","Site Layout & Logistics Setup","Workforce Mobilization & Induction","Plant, Equipment & Tools Readiness","Baseline Programme & Readiness"],"Construction & Execution":["Workmanship & Construction Methods","Productivity & Resource Utilization","Materials Delivery, Storage & Handling","Workfront & Contractor Coordination","Quality Control & Inspection","Health & Safety Management","Environmental Management","Site Supervision & Communication","Changes, Variations & Claims","Progress Monitoring & Recovery","Unexpected Site Conditions","Documentation & Record Keeping"],"Testing & Commissioning":["Testing & Inspection Planning","System Testing & Performance","Defect Identification & Rectification","Commissioning Coordination","Operational Readiness & Training"],"Handover & Close-out":["Handover Planning & Acceptance","As-Built Drawings & Technical Records","Certificates, Warranties & Compliance Records","Outstanding Works & Punch List Closure","Final Accounts & Contract Close-out","Client / End-User Handover"],"Post-Project Review":["Final Project Performance Review","Benefits & Outcomes Realization","Lessons Capture & Knowledge Transfer","Asset Performance Feedback"]}}},"labels":{"recorded_on":"Date recorded","project_phase":"Project phase","lesson_category":"Lesson category","situation":"Situation / context","what_happened":"What happened?","impact_types":"Impact / consequence","impact_detail":"Actual consequence","root_cause":"Root cause / contributing factors","lesson_learned":"Lesson learned","recommendation":"Recommendation / preventive action","applicability":"Applicability","discipline":"Discipline","action_owner":"Action owner"},"clientOnly":[]},"agreement":{"required":["agreement_at","agreement_type","agreement_category","agreed_by","action_required"],"rows":[],"conditional":[{"key":"action_owner","when":{"key":"action_required","in":["Yes"]}},{"key":"due_date","when":{"key":"action_required","in":["Yes"]}}],"columns":{},"other":["meeting_source"],"numbers":{},"options":{"meeting_source":["Site Meeting","Coordination Meeting","Technical Meeting","Client Meeting","Email","Site Discussion","Other"],"agreement_type":["Action / Task Commitment","Technical / Engineering Decision","Design / Drawing Decision","Scope / Work Execution Agreement","Schedule / Milestone Agreement","Coordination / Interface Agreement","Quality / Inspection Agreement","HSE / Environmental Agreement","Materials / Procurement Agreement","Site Access / Logistics Agreement","Resources / Responsibilities Agreement","Commercial / Contractual Agreement","Administrative / Documentation Agreement"],"action_required":["Yes","No"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"]},"dependent":{"agreement_category":{"parent":"agreement_type","groups":{"Action / Task Commitment":["Submission / Information Required","Investigation / Assessment","Corrective / Follow-up Action","Completion of Outstanding Work"],"Technical / Engineering Decision":["Technical Solution Agreed","Construction / Installation Method","Technical Clarification / Interpretation","Temporary Works / Engineering Control"],"Design / Drawing Decision":["Design Detail Agreed","Drawing Revision / Update","Design Coordination Resolution","Design Submission / Approval"],"Scope / Work Execution Agreement":["Inclusion of Work","Exclusion of Work","Work Boundary / Interface","Execution Responsibility","Sequence / Phasing of Work"],"Schedule / Milestone Agreement":["Start / Restart Date","Completion / Handover Date","Milestone / Target Date","Recovery / Acceleration Plan","Work Sequence / Lookahead Plan"],"Coordination / Interface Agreement":["Multi-Discipline Coordination","Contractor / Subcontractor Interface","Utility / Third-Party Coordination","Access / Workfront Coordination"],"Quality / Inspection Agreement":["Inspection / Test Arrangement","Acceptance Criteria","Mock-up / Sample Approval","Rework / Repair Approach","Quality Documentation"],"HSE / Environmental Agreement":["Safety Control / Precaution","Permit / Safe Work Arrangement","Environmental Protection Measure","Incident / Hazard Follow-up"],"Materials / Procurement Agreement":["Material / Product Selection","Material Substitution","Sample / Technical Submittal","Procurement / Purchase Action","Delivery / Supply Date"],"Site Access / Logistics Agreement":["Site / Area Access","Delivery / Lifting Arrangement","Storage / Laydown Arrangement","Traffic / Route Arrangement","Temporary Facilities / Utilities"],"Resources / Responsibilities Agreement":["Responsible Party Assigned","Action Owner Assigned","Labour / Crew Allocation","Plant / Equipment Allocation","Shared Responsibility"],"Commercial / Contractual Agreement":["Rate / Price Agreement","Payment / Valuation Matter","Variation / Change Evaluation","Contractual Clarification","Claim / Entitlement Review"],"Administrative / Documentation Agreement":["Document Submission / Revision","Record / Register Update","Meeting / Reporting Requirement","Approval / Sign-off Process"]}}},"labels":{"agreement_at":"Meeting / agreement date","meeting_source":"Meeting / source","meeting_reference":"Meeting number / reference","agreement_type":"Agreement type","agreement_category":"Agreement category","agreed_by":"Agreed by","action_required":"Action required","action_owner":"Action owner","due_date":"Due date","discipline":"Related discipline","related_location":"Related location","related_record":"Related record"},"clientOnly":[]},"works_ongoing":{"required":["report_date","weather","discipline","activity","exact_location","work_item","progress_status","crew"],"rows":[],"conditional":[{"key":"quantity","when":{"not":{"key":"quantity_na","in":["yes"]}}},{"key":"quantity_unit","when":{"all":[{"not":{"key":"quantity_na","in":["yes"]}},{"key":"quantity","filled":true}]}},{"key":"element_type","when":{"key":"activity","in":["Concrete Pouring"]}},{"key":"element_id","when":{"key":"activity","in":["Concrete Pouring"]}},{"key":"concrete_grade","when":{"key":"activity","in":["Concrete Pouring"]}},{"key":"concrete_volume","when":{"key":"activity","in":["Concrete Pouring"]}},{"key":"crosses_midnight","when":{"earlier":["finish_time","start_time"]}}],"columns":{},"other":["shift","quantity_unit","element_type","blocker"],"numbers":{"rainfall":{"min":0,"max":500},"weather_hours_lost":{"min":0,"max":24},"quantity":{"min":0,"max":null},"progress_percent":{"min":0,"max":100},"concrete_volume":{"min":0,"max":null}},"options":{"weather":["Dry / sunny","Cloudy","Light rain","Heavy rain","Thunderstorm"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"],"secondary_discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"],"progress_status":["Not Started","In Progress","On Hold","Completed"],"element_type":["Slab","Beam","Column","Footing","Wall","Other"],"blocker":["None","Materials","Equipment","Labour","Design","Access","Weather","Approval","Other"]},"dependent":{},"labels":{"report_date":"Report date","shift":"Shift","weather":"Weather","rainfall":"Rainfall (mm)","weather_hours_lost":"Working time lost due to weather (hours)","discipline":"Work discipline","secondary_discipline":"Secondary discipline","activity":"Activity","exact_location":"Exact location / grid / level","work_item":"What exactly is being worked on?","quantity_na":"Quantity not measurable (N/A)","quantity":"Quantity completed","quantity_unit":"Unit","progress_status":"Progress status","progress_percent":"Progress percentage","crew":"Crew / contractor","start_time":"Start time","finish_time":"Finish time","crosses_midnight":"Work crosses midnight","element_type":"Element","element_id":"Element ID","concrete_grade":"Concrete grade / mix","concrete_volume":"Volume (m³)","delivery_tickets":"Delivery ticket / batch references","slump_cube_refs":"Slump and cube sample references","activity_answers":"Activity details","activity_details":"Details for this activity","inspection_reference":"Inspection / test reference","blocker":"Blocker / issue","blocker_record":"Linked issue or delay report","remarks":"Remarks"},"clientOnly":[]},"works_completed":{"required":["based_on","completion_date","discipline","activity","exact_location","completed_items","inspection_status","crew"],"rows":[],"conditional":[{"key":"quantity","when":{"not":{"key":"quantity_na","in":["yes"]}}},{"key":"quantity_unit","when":{"all":[{"not":{"key":"quantity_na","in":["yes"]}},{"key":"quantity","filled":true}]}},{"key":"ncr_reference","when":{"all":[{"any":[{"key":"inspection_status","in":["Inspected - Rejected"]},{"key":"outstanding","filled":true}]},{"key":"inspection_status","in":["Inspected - Rejected"]}]}}],"columns":{},"other":["completed_items","element_type","quantity_unit"],"numbers":{"concrete_volume":{"min":0,"max":null},"quantity":{"min":0,"max":null}},"options":{"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"],"secondary_discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover","Timber Structures & Carpentry"],"element_type":["Slab","Beam","Column","Footing","Wall","Other"],"inspection_status":["Completed - Awaiting Inspection","Inspected - Accepted","Inspected - Rejected","Not Applicable"]},"dependent":{},"labels":{"based_on":"Based on Works Ongoing record","completion_date":"Completion date","discipline":"Work discipline","secondary_discipline":"Secondary discipline","activity":"Activity","exact_location":"Exact location / grid / level","completed_items":"What was completed?","element_type":"Element","element_id":"Element ID","concrete_grade":"Concrete grade / mix","concrete_volume":"Volume (m³)","delivery_tickets":"Delivery ticket / batch references","slump_cube_refs":"Slump and cube sample references","activity_answers":"Activity details","quantity_na":"Quantity not measurable (N/A)","quantity":"Quantity completed","quantity_unit":"Unit","inspection_status":"Completion / inspection status","inspection_reference":"Inspection reference","ncr_reference":"Linked NCR / issue","crew":"Contractor / crew","outstanding":"Outstanding work / defects","remarks":"Remarks"},"clientOnly":[]}}'::jsonb;
$rules$;

-- v5.0 Lessons Learned: a submitted lesson is shared with the organisation at once (no review step);
-- lessons approved for sharing before v5.0 stay shared.
create or replace function public.list_shared_lessons(p_organization_id uuid)
returns table (
  entry_id uuid, project_id uuid, project_name text, project_code text, entry_number text,
  title text, occurred_at timestamptz, details jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select entry.id, project.id, project.name, project.code, entry.entry_number, entry.title, entry.occurred_at,
    jsonb_build_object(
      'spec', coalesce(entry.details -> 'spec', '{}'::jsonb) - array['action_owner_ref', 'reviewed_by_user_id'],
      'issue', entry.details -> 'issue', 'cause', entry.details -> 'cause',
      'solution_improvement', entry.details -> 'solution_improvement', 'expected_results', entry.details -> 'expected_results',
      'project_phase', entry.details -> 'project_phase'
    )
  from public.project_register_entries entry
  join public.projects project on project.id = entry.project_id
  where project.organization_id = p_organization_id
    and entry.register_type = 'lessons_learned'
    and entry.status <> 'cancelled'
    and entry.details #>> '{spec,review_status}' in ('Submitted (shared)', 'Approved for Sharing')
    and (select auth.uid()) is not null
    and (
      exists (select 1 from public.organization_memberships membership
        where membership.organization_id = p_organization_id and membership.user_id = (select auth.uid()) and membership.status = 'active')
      or exists (select 1 from public.project_memberships membership
        where membership.organization_id = p_organization_id and membership.user_id = (select auth.uid()) and membership.status = 'active')
    )
  order by entry.occurred_at desc
  limit 500;
$$;
