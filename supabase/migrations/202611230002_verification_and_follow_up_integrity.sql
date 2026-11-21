-- F02 and F08 (client-spec audit).
--
-- F02: Rapid Verify decides a Works Completed record. record_verification now moves
-- spec.inspection_status (the field the form writes) on Pass/Fail, keeps it awaiting inspection on
-- Partially complete / Further action required, and links every optional follow-up action to its
-- exact source record (including register entries, actions and the record behind contractor evidence).
--
-- F08: follow-up actions of an HSE incident (corrective_actions rows) and of an agreement (action
-- required + action owner) are created by the database in the same transaction as the record save,
-- so an offline replay or a retried save creates them exactly once. Each row has a stable row_id;
-- the action key is source + field + row_id, so two rows with identical wording stay two actions.
-- The created action id is written back into the row (action_id). Rows saved before this change
-- keep the action created under the old text-based key instead of getting a second one.

alter table public.actions drop constraint if exists actions_source_type_check;
alter table public.actions add constraint actions_source_type_check
  check (source_type in ('manual','registration','inspection','finding','hse','report','meeting','register_entry','action'));

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
  v_register_type text;
  v_inspection text;
  v_source_type text;
  v_source_id uuid;
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
    select entry_number, building_id, responsible_party_id, status, register_type, details #>> '{spec,inspection_status}'
      into v_code, v_building, v_party, v_status, v_register_type, v_inspection
    from public.project_register_entries where id = p_record_id and project_id = p_project_id for update;
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
  elsif p_record_type = 'register_entry' and v_register_type in ('works_completed','wcr')
      and coalesce(v_inspection, '') not in ('Inspected - Accepted','Inspected - Rejected') then
    -- F02: Works Completed carries its inspection decision in spec.inspection_status (workbook row 13).
    -- Pass accepts, Fail rejects; Partially complete and Further action required keep it awaiting
    -- inspection. The record's spec guard checks the reviewer's authority and stamps who and when.
    if p_result in ('pass','fail') then
      update public.project_register_entries
        set details = jsonb_set(coalesce(details, '{}'::jsonb), '{spec}',
          coalesce(details -> 'spec', '{}'::jsonb) || jsonb_build_object('inspection_status',
            case when p_result = 'pass' then 'Inspected - Accepted' else 'Inspected - Rejected' end))
      where id = p_record_id;
    end if;
    v_status := coalesce(v_inspection, 'Completed - Awaiting Inspection');
    v_next := case p_result when 'pass' then 'Inspected - Accepted' when 'fail' then 'Inspected - Rejected' else v_status end;
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
    -- F02: every follow-up is linked to its exact source; a contractor's evidence links to the record it answers.
    if p_record_type = 'portal_share' then
      v_source_type := case when v_share.record_type in ('finding','inspection','hse','register_entry','action') then v_share.record_type end;
      v_source_id := case when v_source_type is not null then v_share.record_id end;
    else
      v_source_type := p_record_type;
      v_source_id := p_record_id;
    end if;
    perform set_config('app.record_follow_up', 'on', true);
    update public.actions set
      source_type = coalesce(v_source_type, source_type),
      source_id = coalesce(v_source_id, source_id),
      action_category = 'corrective'
    where id = v_follow_id;
    perform set_config('app.record_follow_up', 'off', true);
  end if;

  insert into public.verifications (organization_id, project_id, record_type, record_id, record_code, result, comment, file_ids,
    latitude, longitude, location_label, previous_status, resulting_status, follow_up_action_id, verified_by)
  values (v_project.organization_id, p_project_id, p_record_type, p_record_id, v_code, p_result, v_comment, v_files,
    p_latitude, p_longitude, nullif(trim(coalesce(p_location_label, '')), ''), v_status, v_next, v_follow_id, v_actor)
  returning id into v_id;
  return v_id;
end;
$$;


create or replace function app_private.follow_up_slug(p_text text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  -- Same as the browser's former key: lower case, non [a-z0-9] runs to "-", first 80 characters.
  select left(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'), 80);
$$;

-- Creates (or finds) the action of one follow-up row and returns its id; null when not allowed.
create or replace function app_private.ensure_follow_up_action(
  p_project_id uuid,
  p_building_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_field text,
  p_row_id text,
  p_legacy_text text,
  p_title text,
  p_description text,
  p_owner_ref text,
  p_due text,
  p_claimed uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_action public.actions;
  v_legacy uuid;
  v_key text := 'follow:' || p_source_id || ':' || p_field || ':' || p_row_id;
  v_owner_user uuid;
  v_owner_party uuid;
  v_due timestamptz;
  v_building uuid := coalesce(p_building_id, (select id from public.buildings where project_id = p_project_id order by created_at limit 1));
begin
  if (select auth.uid()) is null or not app_private.has_project_permission(p_project_id, 'actions.create') then
    return null;
  end if;
  -- A row saved before stable row ids kept the action created under its text key.
  if p_legacy_text is not null then
    select id into v_legacy from public.actions
    where project_id = p_project_id
      and idempotency_key = 'follow:' || p_source_id || ':' || p_field || ':' || app_private.follow_up_slug(p_legacy_text)
      and not (id = any (coalesce(p_claimed, '{}')));
    if v_legacy is not null then return v_legacy; end if;
  end if;
  if p_owner_ref like 'user:%' then
    v_owner_user := nullif(substr(p_owner_ref, 6), '')::uuid;
    if not exists (select 1 from public.list_project_people(p_project_id) person where person.user_id = v_owner_user) then
      v_owner_user := null;
    end if;
  elsif p_owner_ref like 'party:%' then
    select id into v_owner_party from public.parties where id = nullif(substr(p_owner_ref, 7), '')::uuid and project_id = p_project_id;
  end if;
  if coalesce(p_due, '') ~ '^\d{4}-\d{2}-\d{2}' then
    v_due := (left(p_due, 10) || ' 17:00')::timestamp at time zone 'America/Paramaribo';
  end if;
  v_action := public.create_project_action(p_project_id, v_building, v_owner_party, left(p_title, 240), left(p_description, 4000), v_due, 'normal', v_key, null::uuid);
  perform set_config('app.record_follow_up', 'on', true);
  update public.actions
    set source_type = p_source_type, source_id = p_source_id, owner_user_id = coalesce(v_owner_user, owner_user_id)
    where id = v_action.id and (source_id is null or source_id = p_source_id);
  perform set_config('app.record_follow_up', 'off', true);
  return v_action.id;
end;
$$;

create or replace function app_private.sync_spec_follow_up_actions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_hse boolean := tg_table_name = 'hse_events';
  v_spec jsonb;
  v_rows jsonb;
  v_out jsonb := '[]'::jsonb;
  v_row jsonb;
  v_action uuid;
  v_claimed uuid[] := '{}';
  v_label text;
  v_legacy_row boolean;
begin
  if new.status in ('cancelled') then return new; end if;
  if v_hse then
    v_spec := coalesce(new.spec, '{}'::jsonb);
    if jsonb_typeof(v_spec -> 'corrective_actions') <> 'array' then return new; end if;
    v_label := concat_ws(' · ', nullif(new.event_number, ''), new.title);
    -- Rows already linked keep their action; their ids are not offered to a legacy match again.
    select coalesce(array_agg((item ->> 'action_id')::uuid), '{}') into v_claimed
    from jsonb_array_elements(v_spec -> 'corrective_actions') item where coalesce(item ->> 'action_id', '') ~ '^[0-9a-f-]{36}$';
    for v_row in select value from jsonb_array_elements(v_spec -> 'corrective_actions')
    loop
      if jsonb_typeof(v_row) = 'object' and nullif(btrim(coalesce(v_row ->> 'action', '')), '') is not null then
        -- A row without an id on an update was stored before row ids existed.
        v_legacy_row := tg_op = 'UPDATE' and coalesce(v_row ->> 'row_id', '') = '';
        if coalesce(v_row ->> 'row_id', '') = '' then
          v_row := v_row || jsonb_build_object('row_id', gen_random_uuid()::text);
        end if;
        if coalesce(v_row ->> 'action_id', '') = '' then
          v_action := app_private.ensure_follow_up_action(new.project_id, new.building_id, 'hse', new.id, 'corrective_actions',
            v_row ->> 'row_id',
            -- Legacy text key only for rows that existed before row ids (no row_id in the stored record).
            case when v_legacy_row then v_row ->> 'action' end,
            v_row ->> 'action',
            v_label || coalesce(' · owner: ' || nullif(v_row ->> 'owner', ''), ''),
            v_row ->> 'owner_ref', v_row ->> 'due', v_claimed);
          if v_action is not null then
            v_row := v_row || jsonb_build_object('action_id', v_action::text);
            v_claimed := v_claimed || v_action;
          end if;
        end if;
      end if;
      v_out := v_out || jsonb_build_array(v_row);
    end loop;
    new.spec := jsonb_set(v_spec, '{corrective_actions}', v_out);
    return new;
  end if;

  -- Agreements: one action when "Action required" is Yes and an owner is named (workbook rows 10-12).
  if new.register_type <> 'agreement' then return new; end if;
  v_spec := coalesce(new.details -> 'spec', '{}'::jsonb);
  if v_spec ->> 'action_required' <> 'Yes' or nullif(btrim(coalesce(v_spec ->> 'action_owner', '')), '') is null
      or coalesce(v_spec ->> 'follow_up_action_id', '') <> '' then
    return new;
  end if;
  v_action := app_private.ensure_follow_up_action(new.project_id, new.building_id, 'meeting', new.id, 'action_owner', 'agreement',
    case when tg_op = 'UPDATE' then new.title end,
    new.title,
    concat_ws(' · ', nullif(new.entry_number, ''), new.title) || ' · owner: ' || (v_spec ->> 'action_owner'),
    v_spec ->> 'action_owner_ref', v_spec ->> 'due_date', '{}');
  if v_action is not null then
    new.details := jsonb_set(coalesce(new.details, '{}'::jsonb), '{spec}', v_spec || jsonb_build_object('follow_up_action_id', v_action::text));
  end if;
  return new;
end;
$$;

-- "aa" so the row ids and action ids are in place before the spec guard, versioning and audit triggers.
drop trigger if exists hse_events_aa_follow_up on public.hse_events;
create trigger hse_events_aa_follow_up before insert or update of spec, status on public.hse_events
  for each row execute function app_private.sync_spec_follow_up_actions();
drop trigger if exists project_register_entries_aa_follow_up on public.project_register_entries;
create trigger project_register_entries_aa_follow_up before insert or update of details, status, title on public.project_register_entries
  for each row execute function app_private.sync_spec_follow_up_actions();
