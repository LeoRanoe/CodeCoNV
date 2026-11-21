-- Requirements FINAL, second pass (audit of 20-11-2026 against the document and the client's
-- menu mind map):
--
--  1. Rapid Verify (section 10): one verification log for every record type. A verifier records
--     pass / fail / partially complete / further action required with comment, photos, time,
--     verifier and location. A pass closes what is waiting for verification (an NCR, an action,
--     a contractor portal item); a fail sends it back and can create a linked follow-up action.
--     The result stays in the record's history (verifications, and the portal log for portal items).
--  2. Actions (section 9 and the mind map): a category, corrective / preventive / follow-up, set
--     from the source by default and changeable by a manager.
--  3. Reminders (section 14): portal items due soon or overdue (to the organisation's portal users,
--     escalated to CODECO when overdue), portal answers waiting for CODECO, and document reviews
--     pending longer than the project's review period. Added to refresh_project_notifications().
--
-- Additive. Rollback: drop the new table, functions, trigger and column; restore
-- refresh_project_notifications from its previous definition (202611210001).

begin;

-- 2. Action category ----------------------------------------------------------------------
alter table public.actions add column if not exists action_category text;
alter table public.actions drop constraint if exists actions_action_category_check;
alter table public.actions add constraint actions_action_category_check
  check (action_category is null or action_category in ('corrective','preventive','follow_up'));
update public.actions set action_category = case when source_type in ('finding','inspection','hse') then 'corrective' else 'follow_up' end
where action_category is null;

create or replace function app_private.default_action_category()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.action_category is null then
    new.action_category := case when new.source_type in ('finding','inspection','hse') then 'corrective' else 'follow_up' end;
  end if;
  return new;
end;
$$;
drop trigger if exists actions_default_category on public.actions;
create trigger actions_default_category before insert on public.actions
  for each row execute function app_private.default_action_category();

create or replace function public.set_project_action_category(p_action_id uuid, p_category text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_action public.actions;
begin
  select * into v_action from public.actions where id = p_action_id;
  if v_action.id is null or not app_private.has_project_permission(v_action.project_id, 'actions.manage') then
    raise exception 'Only an action manager sets the category' using errcode = '42501';
  end if;
  if p_category not in ('corrective','preventive','follow_up') then
    raise exception 'Unknown category' using errcode = '22023';
  end if;
  update public.actions set action_category = p_category where id = p_action_id;
end;
$$;
revoke all on function public.set_project_action_category(uuid, text) from public, anon;
grant execute on function public.set_project_action_category(uuid, text) to authenticated;

-- 1. Verification log ----------------------------------------------------------------------
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  record_type text not null check (record_type in ('finding','action','inspection','register_entry','hse','portal_share')),
  record_id uuid not null,
  record_code text check (record_code is null or char_length(record_code) <= 80),
  result text not null check (result in ('pass','fail','partial','further_action')),
  comment text check (comment is null or char_length(comment) <= 4000),
  file_ids uuid[] not null default '{}',
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_label text check (location_label is null or char_length(location_label) <= 240),
  previous_status text,
  resulting_status text,
  follow_up_action_id uuid,
  verified_by uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects(id, organization_id)
);
create index if not exists verifications_record_idx on public.verifications (project_id, record_type, record_id, verified_at desc);
create index if not exists verifications_project_idx on public.verifications (project_id, verified_at desc);

drop trigger if exists verifications_append_only on public.verifications;
create trigger verifications_append_only before update or delete on public.verifications
  for each row execute function app_private.reject_event_mutation();

alter table public.verifications enable row level security;
revoke all on public.verifications from anon, authenticated;
grant select on public.verifications to authenticated;
grant select on public.verifications to service_role;
drop policy if exists verifications_select on public.verifications;
create policy verifications_select on public.verifications for select to authenticated using (
  app_private.has_project_permission(project_id, 'records.read')
  or app_private.has_project_permission(project_id, 'actions.read')
  or app_private.has_project_permission(project_id, 'findings.read')
  or app_private.portal_internal(project_id)
);

create or replace function public.record_verification(
  p_project_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_result text,
  p_comment text,
  p_file_ids uuid[],
  p_latitude numeric,
  p_longitude numeric,
  p_location_label text,
  p_follow_up jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_code text;
  v_building uuid;
  v_party uuid;
  v_status text;
  v_next text;
  v_required text;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_files uuid[] := array(select distinct file_id from unnest(coalesce(p_file_ids, '{}')) file_id where file_id is not null);
  v_follow public.actions;
  v_follow_id uuid;
  v_share public.portal_shares;
  v_id uuid;
begin
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if p_result not in ('pass','fail','partial','further_action') then
    raise exception 'Unknown verification result' using errcode = '22023';
  end if;
  if p_result <> 'pass' and v_comment is null then
    raise exception 'Describe what is not in order' using errcode = '22023';
  end if;

  v_required := case p_record_type
    when 'finding' then 'findings.verify'
    when 'action' then 'actions.manage'
    when 'inspection' then 'inspections.manage'
    when 'hse' then 'hse.manage'
    when 'register_entry' then 'records.edit'
    when 'portal_share' then 'portal.share'
  end;
  if v_required is null then raise exception 'Unknown record type' using errcode = '22023'; end if;
  if not app_private.has_project_permission(p_project_id, v_required) then
    raise exception 'No right to verify this record' using errcode = '42501';
  end if;

  if p_record_type = 'finding' then
    select finding_number, building_id, responsible_party_id, status into v_code, v_building, v_party, v_status
    from public.findings where id = p_record_id and project_id = p_project_id for update;
  elsif p_record_type = 'action' then
    select action_number, building_id, owner_party_id, status into v_code, v_building, v_party, v_status
    from public.actions where id = p_record_id and project_id = p_project_id for update;
  elsif p_record_type = 'inspection' then
    select inspection_number, building_id, status into v_code, v_building, v_status
    from public.inspections where id = p_record_id and project_id = p_project_id;
  elsif p_record_type = 'hse' then
    select event_number, building_id, status into v_code, v_building, v_status
    from public.hse_events where id = p_record_id and project_id = p_project_id;
  elsif p_record_type = 'register_entry' then
    select entry_number, building_id, responsible_party_id, status into v_code, v_building, v_party, v_status
    from public.project_register_entries where id = p_record_id and project_id = p_project_id;
  else
    select * into v_share from public.portal_shares where id = p_record_id and project_id = p_project_id for update;
    v_code := coalesce(v_share.record_code, left(v_share.title, 80));
    v_building := v_share.building_id;
    v_party := case when v_share.audience = 'contractor' then v_share.party_id end;
    v_status := v_share.status;
  end if;
  if v_status is null then raise exception 'The record is not part of this project' using errcode = 'P0002'; end if;
  if exists (select 1 from unnest(v_files) file_id
      where not exists (select 1 from public.files file where file.id = file_id and file.project_id = p_project_id and file.status in ('available','pending','uploading'))) then
    raise exception 'A photo is not a file of this project' using errcode = '22023';
  end if;
  v_next := v_status;

  -- The source moves only from "waiting for verification"; anything else is recorded as is.
  if p_record_type = 'finding' and v_status = 'ready_for_verification' then
    v_next := case when p_result = 'pass' then 'closed' else 'reopened' end;
    update public.findings set status = v_next,
      status_reason = coalesce(v_comment, 'Verified on site')
    where id = p_record_id;
  elsif p_record_type = 'action' and v_status = 'ready_for_verification' then
    if p_result = 'pass' then
      v_next := 'verified';
      update public.actions set status = 'verified', closed_at = now(), closure_reason = coalesce(v_comment, 'Verified on site') where id = p_record_id;
    else
      v_next := 'in_progress';
      update public.actions set status = 'in_progress' where id = p_record_id;
    end if;
  elsif p_record_type = 'inspection' and v_status in ('failed','ready_for_reinspection') then
    -- Inspection follow-up: the re-inspection decides.
    v_next := case when p_result = 'pass' then 'passed' else 'failed' end;
    update public.inspections set status = v_next,
      completed_at = case when p_result = 'pass' then coalesce(completed_at, now()) else completed_at end
    where id = p_record_id;
  elsif p_record_type = 'portal_share' and v_share.status in ('responded','submitted_for_verification','accepted') and v_share.audience = 'contractor' then
    v_next := case when p_result = 'pass' then 'verified' else 'returned' end;
    update public.portal_shares set status = v_next, updated_at = now() where id = v_share.id;
    insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side,
      actor_roles, comment, file_ids, previous_status, resulting_status, payload)
    values (v_share.organization_id, p_project_id, v_share.id, v_share.round, case when p_result = 'pass' then 'verify' else 'return' end, v_actor,
      (select display_name from public.profiles where id = v_actor), 'codeco', app_private.portal_actor_roles(p_project_id, v_actor),
      coalesce(v_comment, 'Verified on site'), v_files, v_share.status, v_next, jsonb_build_object('verification', p_result));
    insert into public.portal_share_files (share_id, organization_id, project_id, file_id, source, added_by)
    select v_share.id, v_share.organization_id, p_project_id, file_id, 'shared', v_actor from unnest(v_files) file_id
    where exists (select 1 from public.files file where file.id = file_id and file.status = 'available')
    on conflict do nothing;
    select * into v_share from public.portal_shares where id = v_share.id;
    perform app_private.notify_portal_party(v_share, 'Portal update' || coalesce(': ' || v_share.record_code, ''),
      'Sign in to the portal to see the verification.', case when p_result = 'pass' then 'system' else 'review_requested' end);
  end if;

  -- A failed verification can leave a linked follow-up action (section 10).
  if p_result <> 'pass' and p_follow_up is not null and nullif(trim(coalesce(p_follow_up ->> 'title', '')), '') is not null then
    if not app_private.has_project_permission(p_project_id, 'actions.manage') then
      raise exception 'Creating a follow-up action needs the action manager right' using errcode = '42501';
    end if;
    v_follow := public.create_project_action(
      p_project_id,
      coalesce(v_building, (select id from public.buildings where project_id = p_project_id order by created_at limit 1)),
      coalesce(nullif(p_follow_up ->> 'owner_party_id', '')::uuid, v_party),
      null,
      trim(p_follow_up ->> 'title'),
      coalesce(v_comment, '') || case when v_code is not null then ' (' || v_code || ')' else '' end,
      nullif(p_follow_up ->> 'due_at', '')::timestamptz,
      coalesce(nullif(p_follow_up ->> 'priority', ''), 'normal'),
      'verify:' || p_record_id || ':' || extract(epoch from clock_timestamp())::text,
      null::uuid);
    v_follow_id := v_follow.id;
    update public.actions set
      source_type = case p_record_type when 'finding' then 'finding' when 'inspection' then 'inspection' when 'hse' then 'hse' else source_type end,
      source_id = case when p_record_type in ('finding','inspection','hse') then p_record_id else source_id end,
      action_category = 'corrective'
    where id = v_follow_id;
  end if;

  insert into public.verifications (organization_id, project_id, record_type, record_id, record_code, result, comment, file_ids,
    latitude, longitude, location_label, previous_status, resulting_status, follow_up_action_id, verified_by)
  values (v_project.organization_id, p_project_id, p_record_type, p_record_id, v_code, p_result, v_comment, v_files,
    p_latitude, p_longitude, nullif(trim(coalesce(p_location_label, '')), ''), v_status, v_next, v_follow_id, v_actor)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_verification(uuid, text, uuid, text, text, uuid[], numeric, numeric, text, jsonb) from public, anon;
grant execute on function public.record_verification(uuid, text, uuid, text, text, uuid[], numeric, numeric, text, jsonb) to authenticated;

-- 3. Reminders --------------------------------------------------------------------------
create or replace function app_private.refresh_portal_notifications(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
  v_rows integer := 0;
  v_lead interval := make_interval(hours => coalesce((select notification_lead_hours from public.project_settings where project_id = p_project_id), 24));
  v_review_days integer := coalesce(nullif((select spec_configuration ->> 'document_review_days' from public.project_settings where project_id = p_project_id), '')::integer, 7);
begin
  -- Due soon / overdue: to the organisation's portal users. Previews carry only the code (8.1).
  insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, due_at, dedupe_key)
  select share.organization_id, share.project_id, membership.user_id,
    case when share.due_at < now() then 'action_overdue' else 'action_due' end,
    case when share.due_at < now() then 'Portal item overdue' else 'Portal item due soon' end || coalesce(': ' || share.record_code, ''),
    'Sign in to the portal to open it.', 'portal_share', share.id, share.due_at,
    'portal-due:' || share.id || ':' || share.round || ':' || case when share.due_at < now() then 'overdue' else 'due' end || ':' || membership.user_id
  from public.portal_shares share
  join public.project_memberships membership
    on membership.project_id = share.project_id and membership.portal_party_id = share.party_id and membership.status = 'active'
  where share.project_id = p_project_id
    and share.due_at is not null and share.due_at <= now() + v_lead
    and share.status in ('assigned','acknowledged','returned','clarification_requested')
    and not (share.audience = 'client' and share.status = 'clarification_requested')
    and app_private.user_has_project_permission(membership.user_id, share.project_id, case share.audience when 'contractor' then 'portal.contractor' else 'portal.client' end)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Escalation: an overdue portal item is reported to the CODECO user who assigned it.
  insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, due_at, dedupe_key)
  select share.organization_id, share.project_id, share.assigned_by, 'action_overdue',
    'Overdue at ' || party.name || coalesce(': ' || share.record_code, ''), share.title, 'portal_share', share.id, share.due_at,
    'portal-escalate:' || share.id || ':' || share.round
  from public.portal_shares share
  join public.parties party on party.id = share.party_id
  where share.project_id = p_project_id and share.due_at < now()
    and share.status in ('assigned','acknowledged','returned')
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Answers waiting for CODECO longer than the lead time.
  insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, dedupe_key)
  select share.organization_id, share.project_id, share.assigned_by, 'review_requested',
    'Portal answer waiting for review' || coalesce(': ' || share.record_code, ''), share.title, 'portal_share', share.id,
    'portal-waiting:' || share.id || ':' || share.round || ':' || share.status
  from public.portal_shares share
  where share.project_id = p_project_id
    and share.status in ('responded','submitted_for_verification','approved','rejected','clarification_requested')
    and share.updated_at < now() - v_lead
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Document reviews pending longer than the review period (section 14).
  insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, dedupe_key)
  select document.organization_id, document.project_id, membership.user_id, 'review_requested',
    'Document review overdue: ' || coalesce(document.document_number, left(document.title, 60)),
    'Revision ' || revision.revision || ' is waiting for review.', 'project_document', document.id,
    'document-overdue:' || revision.id || ':' || membership.user_id
  from public.project_document_revisions revision
  join public.project_documents document on document.id = revision.document_id
  join public.project_memberships membership on membership.project_id = document.project_id and membership.status = 'active'
  where document.project_id = p_project_id
    and revision.review_status in ('submitted','under_review')
    and revision.superseded_at is null
    and revision.uploaded_at < now() - make_interval(days => v_review_days)
    and app_private.user_has_project_permission(membership.user_id, document.project_id, 'documents.review')
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  return v_count;
end;
$$;
revoke all on function app_private.refresh_portal_notifications(uuid) from public, anon, authenticated;

do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.refresh_project_notifications(uuid)'::regprocedure) into v_definition;
  if position('refresh_portal_notifications' in v_definition) = 0 then
    -- One "return v_count;" in the body: the only exit of the function.
    if (length(v_definition) - length(replace(v_definition, 'return v_count;', ''))) <> length('return v_count;') then
      raise exception 'refresh_project_notifications no longer ends as expected';
    end if;
    execute replace(v_definition, 'return v_count;',
      'v_count := v_count + app_private.refresh_portal_notifications(p_project_id); return v_count;');
  end if;
end;
$migration$;

commit;
