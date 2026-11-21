-- Word §3.1 "After submission": the system generates the linked actions where follow-up is required.
-- An incident's corrective rows and an agreement's action are therefore created by the database for
-- anyone allowed to save the source record (hse.manage for HSE, records.create/records.edit for
-- registers), not only for holders of actions.create. Decision list #9 (F08) is resolved by this rule.

-- The action insert of public.create_project_action without its actions.create check. Private: it is
-- reached only through ensure_follow_up_action, which is called by the record's own save trigger.
create or replace function app_private.create_follow_up_action(
  p_project_id uuid,
  p_building_id uuid,
  p_owner_party_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_idempotency_key text
)
returns public.actions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_action public.actions;
  v_year integer;
  v_sequence integer;
begin
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  select action.* into v_action from public.actions action
  where action.project_id = p_project_id and action.idempotency_key = p_idempotency_key
  order by action.created_at
  limit 1;
  if found then
    return v_action;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':actions', 0));
  v_year := extract(year from (now() at time zone 'America/Paramaribo'))::integer;
  select coalesce(max(substring(action.action_number from '([0-9]+)$')::integer), 0) + 1
  into v_sequence
  from public.actions action
  where action.project_id = p_project_id
    and action.action_number ~ ('^ACT-' || v_year || '-[0-9]+$');

  insert into public.actions (
    organization_id, project_id, building_id, action_number, title, description, source_type,
    owner_user_id, owner_party_id, due_at, priority, status, idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id,
    'ACT-' || v_year || '-' || lpad(v_sequence::text, 4, '0'),
    trim(p_title), nullif(trim(p_description), ''), 'manual',
    v_actor, p_owner_party_id, p_due_at, 'normal', 'open', p_idempotency_key, v_actor
  )
  returning * into v_action;

  insert into public.action_updates (organization_id, project_id, action_id, update_type, message, created_by)
  values (v_action.organization_id, v_action.project_id, v_action.id, 'created',
    'Vervolgactie aangemaakt bij het opslaan van het bronrecord.', v_actor);

  return v_action;
end;
$$;
revoke all on function app_private.create_follow_up_action(uuid, uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;

-- Creates (or finds) the action of one follow-up row and returns its id; null when the caller may not
-- save the source record.
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
  v_may_save boolean;
begin
  -- The same rights the source table's write policy checks.
  v_may_save := (select auth.uid()) is not null and (
    app_private.has_project_permission(p_project_id, 'actions.create')
    or (p_source_type = 'hse' and app_private.has_project_permission(p_project_id, 'hse.manage'))
    or (p_source_type = 'meeting' and (app_private.has_project_permission(p_project_id, 'records.create')
      or app_private.has_project_permission(p_project_id, 'records.edit'))));
  if not v_may_save then
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
  v_action := app_private.create_follow_up_action(p_project_id, v_building, v_owner_party, left(p_title, 240), left(p_description, 4000), v_due, v_key);
  perform set_config('app.record_follow_up', 'on', true);
  update public.actions
    set source_type = p_source_type, source_id = p_source_id, owner_user_id = coalesce(v_owner_user, owner_user_id)
    where id = v_action.id and (source_id is null or source_id = p_source_id);
  perform set_config('app.record_follow_up', 'off', true);
  return v_action.id;
end;
$$;
revoke all on function app_private.ensure_follow_up_action(uuid, uuid, text, uuid, text, text, text, text, text, text, text, uuid[]) from public, anon;
