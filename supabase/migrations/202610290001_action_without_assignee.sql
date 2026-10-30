-- QA M4. A new action could not be created while the project had no company employee to give
-- it to, and the Action center already knows an action nobody owns yet ("Wijs toe wie dit moet
-- doen", assign_project_action). The assignee is optional on creation: with one the old checks
-- and history line apply unchanged; without one the action stays with the manager who created it
-- (the base function makes the creator the owner) until it is assigned.

create or replace function public.create_project_action(
  p_project_id uuid,
  p_building_id uuid,
  p_owner_party_id uuid,
  p_owner_user_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_priority text,
  p_idempotency_key text,
  p_location_node_id uuid
)
returns public.actions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_action public.actions;
begin
  if not app_private.has_project_permission(p_project_id, 'actions.manage') then
    raise exception 'Missing actions.manage permission' using errcode = '42501';
  end if;
  if p_owner_user_id is not null
     and not app_private.is_company_project_employee(p_project_id, p_owner_user_id) then
    raise exception 'Assignee is not an active company employee for this project'
      using errcode = '42501';
  end if;

  v_action := public.create_project_action(
    p_project_id,
    p_building_id,
    p_owner_party_id,
    p_title,
    p_description,
    p_due_at,
    p_priority,
    p_idempotency_key,
    p_location_node_id
  );

  if p_owner_user_id is null then
    return v_action;
  end if;

  update public.actions
  set owner_user_id = p_owner_user_id
  where id = v_action.id
  returning * into v_action;

  insert into public.action_updates (
    organization_id,
    project_id,
    action_id,
    update_type,
    message,
    created_by
  ) values (
    v_action.organization_id,
    v_action.project_id,
    v_action.id,
    'comment',
    'Actie toegewezen aan bedrijfsmedewerker.',
    (select auth.uid())
  );

  return v_action;
end;
$$;

revoke all on function public.create_project_action(
  uuid, uuid, uuid, uuid, text, text, timestamptz, text, text, uuid
) from public, anon;
grant execute on function public.create_project_action(
  uuid, uuid, uuid, uuid, text, text, timestamptz, text, text, uuid
) to authenticated;
