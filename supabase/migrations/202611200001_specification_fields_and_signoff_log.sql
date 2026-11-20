-- The client's developer specification (workbook FINAL v2), second round of 19-11-2026.
--
-- 1. Works Ongoing and Works Completed become records of their own, one per activity, with
--    the workbook's discipline → activity lists. They live in the project register, which
--    already numbers, versions, audits and exports its entries: WO-0001, WC-0001.
-- 2. The workbook fields that the screens did not have are stored per record: in `details`
--    for register entries, in `issue_management` for issues and NCRs (no change needed), and
--    in a new `spec` object on HSE events, photos, attendance entries and inspections.
-- 3. The Sign-off Workflow sheet: "Do NOT create only one Contractor Signature and one
--    Supervision Signature field. Use a repeatable, append-only Sign-off Event Log." Every
--    submit, acknowledgement, review, return, resubmission, approval and verification is a
--    row of its own, never updated or deleted, written only through record_signoff_action(),
--    which checks the actor's role, mandatory comments, self-approval and the record itself.
--
-- Additive only. Rollback: drop the function and the table, drop the four spec columns, and
-- restore the previous register type check and register function (202608090003).

begin;

alter table public.project_register_entries
  drop constraint if exists project_register_entries_register_type_check;
alter table public.project_register_entries
  add constraint project_register_entries_register_type_check check (
    register_type in (
      'equipment','delivery','test','variation','delay','communication','risk',
      'document','drawing','wcr','rfi','submittal','site_instruction','meeting',
      'correspondence','cost','declaration','rfa','inspection_request','boq',
      'punch_list','notepad','agreement','technical_instruction','change_order',
      'contract','specification','environmental_report','lessons_learned',
      'delay_report','works_ongoing','works_completed'
    )
  );

alter table public.hse_events add column if not exists spec jsonb not null default '{}'::jsonb;
alter table public.visual_captures add column if not exists spec jsonb not null default '{}'::jsonb;
alter table public.attendance_entries add column if not exists spec jsonb not null default '{}'::jsonb;
alter table public.inspections add column if not exists spec jsonb not null default '{}'::jsonb;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['hse_events', 'visual_captures', 'attendance_entries', 'inspections'] loop
    execute format('alter table public.%I drop constraint if exists %I', v_table, v_table || '_spec_object');
    execute format(
      'alter table public.%I add constraint %I check (jsonb_typeof(spec) = ''object'' and pg_column_size(spec) <= 65536)',
      v_table, v_table || '_spec_object'
    );
    execute format('comment on column public.%I.spec is %L', v_table,
      'Fields of the client''s developer specification (FINAL v2) for this form, keyed as in lib/forms/spec-forms.ts.');
  end loop;
end;
$$;

-- WO-0001 and WC-0001. The register function is patched in place, like 202610280002 did, so
-- this migration cannot drift from the definition that is live.
do $patch$
declare
  v_oid oid;
  v_definition text;
  v_patched text;
begin
  select procedure.oid into v_oid
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'create_project_register_entry';

  v_definition := pg_get_functiondef(v_oid);
  if v_definition ~ 'works_ongoing' then
    return;
  end if;
  v_patched := regexp_replace(
    v_definition,
    $re$when 'environmental_report' then 'ER'$re$,
    $new$when 'environmental_report' then 'ER'
    when 'works_ongoing' then 'WO'
    when 'works_completed' then 'WC'$new$
  );
  if v_patched = v_definition then
    raise exception 'create_project_register_entry no longer contains the expected prefix list';
  end if;
  execute v_patched;
end;
$patch$;
create table if not exists public.record_signoff_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  record_kind text not null check (record_kind in ('finding', 'hse_event', 'register_entry', 'inspection', 'day_report')),
  record_id uuid not null,
  workflow_profile text not null check (workflow_profile in (
    'WO-DAILY','WC-COMPLETION','WF-ATTENDANCE','PDR-REVIEW','ISSUE-CLOSEOUT','HSE-OBSERVATION',
    'MAT-RECEIPT','INSPECTION-WITNESS','TECH-INSTRUCTION','CHANGE-APPROVAL','NCR-CORRECTIVE',
    'AGREEMENT-ACK','LESSON-REVIEW','HSE-INCIDENT'
  )),
  round_number integer not null check (round_number between 1 and 999),
  stage_number integer not null check (stage_number between 1 and 9),
  action text not null check (action in (
    'submit','acknowledge','review','approve','accept','reject','return','respond',
    'resubmit','verify','close','withdraw','reopen','witness'
  )),
  actor_user_id uuid not null references auth.users(id),
  actor_name text not null check (char_length(btrim(actor_name)) between 2 and 120),
  actor_organization text check (actor_organization is null or char_length(actor_organization) <= 160),
  actor_role text not null check (char_length(btrim(actor_role)) between 2 and 120),
  attestation_method text not null check (attestation_method in ('account', 'external_representative', 'signed_document')),
  signature_image text check (signature_image is null or char_length(signature_image) between 40 and 200000),
  evidence_file_id uuid references public.files(id) on delete restrict,
  comments text check (comments is null or char_length(comments) <= 4000),
  return_reason text check (return_reason is null or char_length(return_reason) <= 400),
  next_actor text check (next_actor is null or char_length(next_actor) <= 160),
  next_actor_user_id uuid references auth.users(id),
  due_at timestamptz,
  submitted_version jsonb check (submitted_version is null or jsonb_typeof(submitted_version) = 'object'),
  previous_status text,
  new_status text not null,
  created_at timestamptz not null default now(),
  -- An external party without an account is recorded by name, organisation and a signature
  -- or signed document; a typed name alone is not a signature.
  constraint record_signoff_events_external_evidence check (
    attestation_method = 'account' or signature_image is not null or evidence_file_id is not null
  )
);

comment on table public.record_signoff_events is
  'Append-only sign-off event log of the Sign-off Workflow sheet. One row per action; rows are never updated or deleted. Acknowledge means receipt only.';

create index if not exists record_signoff_events_record_idx
  on public.record_signoff_events (record_kind, record_id, created_at);
create index if not exists record_signoff_events_project_idx
  on public.record_signoff_events (project_id, created_at desc);

alter table public.record_signoff_events enable row level security;

drop policy if exists record_signoff_events_read on public.record_signoff_events;
create policy record_signoff_events_read on public.record_signoff_events
  for select to authenticated
  using (app_private.has_project_permission(project_id, 'records.read'));

revoke insert, update, delete on public.record_signoff_events from authenticated, anon;
grant select on public.record_signoff_events to authenticated;

-- No silent overwrite: corrections are new events.
drop trigger if exists record_signoff_events_immutable on public.record_signoff_events;
create trigger record_signoff_events_immutable
  before update or delete on public.record_signoff_events
  for each row execute function app_private.reject_immutable_mutation();

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
  -- Confidential HSE details stay with HSE: the frozen copy of such a record keeps no narrative.
  if p_record_kind = 'hse_event' and coalesce((v_record ->> 'confidential')::boolean, false) then
    v_record := v_record - 'description' - 'root_cause' - 'notes' - 'immediate_measure';
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

  -- Mandatory comments for a return, a rejection, a withdrawal and a reopening.
  if p_action in ('return', 'reject', 'withdraw', 'reopen') and char_length(btrim(coalesce(p_comments, ''))) < 3 then
    raise exception 'A comment is required to % a record', p_action using errcode = '22023';
  end if;
  if p_action = 'return' and char_length(btrim(coalesce(p_next_actor, ''))) < 2 then
    raise exception 'A return names who acts next' using errcode = '22023';
  end if;
  if p_attestation_method <> 'account' and char_length(btrim(coalesce(p_actor_name, ''))) < 2 then
    raise exception 'An external representative is recorded by name' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_record_kind || ':' || p_record_id::text || ':signoff', 0));
  select event.* into v_last from public.record_signoff_events event
  where event.record_kind = p_record_kind and event.record_id = p_record_id
  order by event.created_at desc, event.id desc limit 1;

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
    order by event.created_at desc, event.id desc limit 1;
    if found and v_last_submit.actor_user_id = v_actor and v_last_submit.action <> 'submit' then
      raise exception 'You cannot approve your own response' using errcode = '42501';
    end if;
    if found and v_last_submit.actor_user_id = v_actor and v_last_submit.action = 'submit'
      and p_workflow_profile in ('WO-DAILY', 'WC-COMPLETION', 'WF-ATTENDANCE', 'PDR-REVIEW', 'CHANGE-APPROVAL', 'LESSON-REVIEW') then
      raise exception 'You cannot approve your own submission' using errcode = '42501';
    end if;
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

  select nullif(btrim(profile.display_name), '') into v_name
  from public.profiles profile where profile.id = v_actor;

  insert into public.record_signoff_events (
    organization_id, project_id, record_kind, record_id, workflow_profile, round_number,
    stage_number, action, actor_user_id, actor_name, actor_organization, actor_role,
    attestation_method, signature_image, evidence_file_id, comments, return_reason,
    next_actor, next_actor_user_id, due_at, submitted_version, previous_status, new_status
  ) values (
    v_project.organization_id, p_project_id, p_record_kind, p_record_id, p_workflow_profile, v_round,
    greatest(1, least(coalesce(p_stage_number, 1), 9)), p_action, v_actor,
    case when p_attestation_method = 'account' then coalesce(v_name, 'User') else btrim(p_actor_name) end,
    nullif(btrim(coalesce(p_actor_organization, '')), ''), btrim(p_actor_role),
    p_attestation_method, p_signature_image, p_evidence_file_id,
    nullif(btrim(coalesce(p_comments, '')), ''), nullif(btrim(coalesce(p_return_reason, '')), ''),
    nullif(btrim(coalesce(p_next_actor, '')), ''), p_next_actor_user_id, p_due_at,
    case when p_action in ('submit', 'resubmit', 'respond') then v_record end,
    v_last.new_status, v_status
  ) returning * into v_event;

  -- The next responsible person hears about it.
  if p_next_actor_user_id is not null and p_next_actor_user_id <> v_actor then
    insert into public.notifications (
      organization_id, project_id, recipient_user_id, notification_type,
      title, body, source_type, source_id, due_at, dedupe_key
    ) values (
      v_project.organization_id, p_project_id, p_next_actor_user_id, 'review_requested',
      left(v_status || ': ' || coalesce(v_record ->> 'finding_number', v_record ->> 'event_number', v_record ->> 'entry_number', v_record ->> 'inspection_number', v_record ->> 'report_number', 'record'), 240),
      left(coalesce(v_record ->> 'title', 'Sign-off') || ' — ' || coalesce(nullif(btrim(p_comments), ''), v_status), 2000),
      'signoff', p_record_id, p_due_at,
      'signoff:' || v_event.id::text
    )
    on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return v_event;
end;
$$;

revoke all on function public.record_signoff_action(uuid, text, uuid, text, integer, text, text, text, text, text, text, uuid, text, text, text, uuid, timestamptz) from public, anon;
grant execute on function public.record_signoff_action(uuid, text, uuid, text, integer, text, text, text, text, text, text, uuid, text, text, text, uuid, timestamptz) to authenticated;

-- Photos are read-only to signed-in users; their specification fields (purpose, discipline,
-- related record) are written through this function, like their title and description.
create or replace function public.set_visual_capture_spec(p_capture_id uuid, p_spec jsonb)
returns public.visual_captures
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_capture public.visual_captures;
begin
  select capture.* into v_capture from public.visual_captures capture where capture.id = p_capture_id for update;
  if not found or (select auth.uid()) is null
    or not app_private.has_project_permission(v_capture.project_id, 'files.manage') then
    raise exception 'Visual capture not found or not accessible' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_spec, '{}'::jsonb)) <> 'object' then
    raise exception 'Specification fields must be an object' using errcode = '22023';
  end if;
  update public.visual_captures set spec = coalesce(p_spec, '{}'::jsonb)
  where id = v_capture.id returning * into v_capture;
  return v_capture;
end;
$$;

revoke all on function public.set_visual_capture_spec(uuid, jsonb) from public, anon;
grant execute on function public.set_visual_capture_spec(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
