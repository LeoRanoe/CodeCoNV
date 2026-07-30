-- Managers must be able to assign and reassign controlled project actions to
-- an actual company employee, not only to a contractor/project party.

create or replace function app_private.is_company_project_employee(
  p_project_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.projects project
    join public.organization_memberships organization_membership
      on organization_membership.organization_id = project.organization_id
     and organization_membership.user_id = p_user_id
     and organization_membership.status = 'active'
    where project.id = p_project_id
      and (
        exists (
          select 1
          from public.organization_member_roles member_role
          join public.roles role
            on role.id = member_role.role_id
           and role.organization_id = member_role.organization_id
          where member_role.membership_id = organization_membership.id
            and role.scope = 'organization'
        )
        or exists (
          select 1
          from public.project_memberships project_membership
          join public.project_member_roles member_role
            on member_role.membership_id = project_membership.id
           and member_role.project_id = project_membership.project_id
          join public.roles role
            on role.id = member_role.role_id
           and role.organization_id = member_role.organization_id
          where project_membership.project_id = project.id
            and project_membership.user_id = p_user_id
            and project_membership.status = 'active'
            and role.code in (
              'supervisor',
              'lead_supervisor',
              'project_manager',
              'quality_hse_manager'
            )
        )
      )
  );
$$;

revoke all on function app_private.is_company_project_employee(uuid, uuid)
  from public, anon, authenticated;

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
  if not app_private.is_company_project_employee(p_project_id, p_owner_user_id) then
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

create or replace function public.assign_project_action(
  p_action_id uuid,
  p_owner_user_id uuid,
  p_note text
)
returns public.actions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_action public.actions;
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Assignment note is required' using errcode = '22023';
  end if;

  select action.* into v_action
  from public.actions action
  where action.id = p_action_id
  for update;
  if not found then
    raise exception 'Action not found' using errcode = 'P0002';
  end if;
  if not app_private.has_project_permission(v_action.project_id, 'actions.manage') then
    raise exception 'Missing actions.manage permission' using errcode = '42501';
  end if;
  if not app_private.is_company_project_employee(v_action.project_id, p_owner_user_id) then
    raise exception 'Assignee is not an active company employee for this project'
      using errcode = '42501';
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
    btrim(p_note),
    v_actor
  );

  return v_action;
end;
$$;

revoke all on function public.assign_project_action(uuid, uuid, text)
  from public, anon;
grant execute on function public.assign_project_action(uuid, uuid, text)
  to authenticated;

-- Owners can reduce or change an existing external user's role per project.
-- The role remains one of the centrally controlled least-privilege profiles.
create or replace function public.set_user_project_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_role_code text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role public.roles;
  v_membership public.project_memberships;
  v_previous_roles jsonb;
begin
  if not app_private.has_organization_permission(p_organization_id, 'members.manage') then
    raise exception 'Missing members.manage permission' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason of at least 5 characters is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.projects project
    where project.id = p_project_id
      and project.organization_id = p_organization_id
  ) then
    raise exception 'Project does not belong to organization' using errcode = '23503';
  end if;

  select role.* into v_role
  from public.roles role
  where role.organization_id = p_organization_id
    and role.scope = 'project'
    and role.code = p_role_code
    and role.active = true;
  if not found then
    raise exception 'Active project role not found' using errcode = 'P0002';
  end if;

  select membership.* into v_membership
  from public.project_memberships membership
  where membership.project_id = p_project_id
    and membership.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Project membership not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(role.code order by role.code), '[]'::jsonb)
  into v_previous_roles
  from public.project_member_roles member_role
  join public.roles role on role.id = member_role.role_id
  where member_role.membership_id = v_membership.id;

  delete from public.project_member_roles
  where membership_id = v_membership.id;

  insert into public.project_member_roles (
    organization_id,
    project_id,
    membership_id,
    role_id
  ) values (
    p_organization_id,
    p_project_id,
    v_membership.id,
    v_role.id
  );

  update public.project_memberships
  set status = 'active'
  where id = v_membership.id;

  insert into public.audit_events (
    organization_id,
    project_id,
    actor_user_id,
    operation,
    table_name,
    record_id,
    old_values,
    new_values
  ) values (
    p_organization_id,
    p_project_id,
    (select auth.uid()),
    'STATUS',
    'project_member_roles',
    v_membership.id,
    jsonb_build_object('roles', v_previous_roles),
    jsonb_build_object('role', v_role.code, 'reason', btrim(p_reason), 'user_id', p_user_id)
  );

  return jsonb_build_object(
    'userId', p_user_id,
    'projectId', p_project_id,
    'roleCode', v_role.code
  );
end;
$$;

revoke all on function public.set_user_project_role(uuid, uuid, uuid, text, text)
  from public, anon;
grant execute on function public.set_user_project_role(uuid, uuid, uuid, text, text)
  to authenticated;
