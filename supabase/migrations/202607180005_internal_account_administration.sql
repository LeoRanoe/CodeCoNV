begin;

create or replace function app_private.current_user_can_create_organization()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and (
      not exists (select 1 from public.organizations)
      or exists (
        select 1
        from public.organization_memberships membership
        join public.organization_member_roles member_role
          on member_role.membership_id = membership.id
         and member_role.organization_id = membership.organization_id
        join public.roles role
          on role.id = member_role.role_id
         and role.organization_id = member_role.organization_id
         and role.scope = 'organization'
        join public.role_permissions permission
          on permission.role_id = role.id
         and permission.permission_code = 'organization.manage'
        where membership.user_id = (select auth.uid())
          and membership.status = 'active'
      )
    );
$$;

create or replace function app_private.guard_organization_creation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if not app_private.current_user_can_create_organization() then
    raise exception 'Only an organization administrator can create another organization'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_creation_guard on public.organizations;
create trigger organizations_creation_guard
before insert on public.organizations
for each row execute function app_private.guard_organization_creation();

create or replace function public.can_bootstrap_organization()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select app_private.current_user_can_create_organization();
$$;

create or replace function public.can_manage_organization_members(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(app_private.has_organization_permission(p_organization_id, 'members.manage'), false);
$$;

create or replace function public.provision_internal_user(
  p_organization_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_role_code text,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.roles;
  v_organization_membership public.organization_memberships;
  v_project_membership public.project_memberships;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not app_private.has_organization_permission(p_organization_id, 'members.manage') then
    raise exception 'Missing members.manage permission' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users user_account where user_account.id = p_user_id) then
    raise exception 'Auth user does not exist' using errcode = 'P0002';
  end if;
  if char_length(trim(p_display_name)) not between 2 and 120 then
    raise exception 'Display name must contain 2 to 120 characters' using errcode = '22023';
  end if;

  select role.* into v_role
  from public.roles role
  where role.organization_id = p_organization_id
    and role.code = p_role_code;

  if not found then
    raise exception 'Role does not exist in this organization' using errcode = 'P0002';
  end if;
  if v_role.scope = 'project' and p_project_id is null then
    raise exception 'A project is required for a project role' using errcode = '22023';
  end if;
  if v_role.scope = 'organization' and p_project_id is not null then
    raise exception 'An organization role cannot be limited to a project' using errcode = '22023';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects project
    where project.id = p_project_id
      and project.organization_id = p_organization_id
  ) then
    raise exception 'Project does not belong to this organization' using errcode = '23503';
  end if;

  insert into public.profiles (id, display_name)
  values (p_user_id, trim(p_display_name))
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.organization_memberships (organization_id, user_id, status, invited_by)
  values (p_organization_id, p_user_id, 'active', v_actor)
  on conflict (organization_id, user_id) do update
    set status = 'active', invited_by = v_actor
  returning * into v_organization_membership;

  if v_role.scope = 'organization' then
    insert into public.organization_member_roles (organization_id, membership_id, role_id)
    values (p_organization_id, v_organization_membership.id, v_role.id)
    on conflict (membership_id, role_id) do nothing;
  else
    insert into public.project_memberships (
      organization_id,
      project_id,
      user_id,
      status,
      invited_by
    ) values (
      p_organization_id,
      p_project_id,
      p_user_id,
      'active',
      v_actor
    )
    on conflict (project_id, user_id) do update
      set status = 'active', invited_by = v_actor
    returning * into v_project_membership;

    insert into public.project_member_roles (
      organization_id,
      project_id,
      membership_id,
      role_id
    ) values (
      p_organization_id,
      p_project_id,
      v_project_membership.id,
      v_role.id
    )
    on conflict (membership_id, role_id) do nothing;
  end if;

  return jsonb_build_object(
    'userId', p_user_id,
    'organizationId', p_organization_id,
    'projectId', p_project_id,
    'roleCode', v_role.code,
    'roleScope', v_role.scope
  );
end;
$$;

create or replace function public.list_internal_access(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  if not app_private.has_organization_permission(p_organization_id, 'members.manage') then
    raise exception 'Missing members.manage permission' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', role.id,
        'code', role.code,
        'name', role.name,
        'scope', role.scope
      ) order by role.scope, role.name)
      from public.roles role
      where role.organization_id = p_organization_id
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', membership.user_id,
        'email', user_account.email,
        'displayName', profile.display_name,
        'membershipStatus', membership.status,
        'accessStatus', case when user_account.last_sign_in_at is null then 'invited' else 'active' end,
        'organizationRoles', coalesce(organization_roles.items, '[]'::jsonb),
        'projectRoles', coalesce(project_roles.items, '[]'::jsonb)
      ) order by profile.display_name, user_account.email)
      from public.organization_memberships membership
      join auth.users user_account on user_account.id = membership.user_id
      left join public.profiles profile on profile.id = membership.user_id
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'code', role.code,
          'name', role.name
        ) order by role.name) as items
        from public.organization_member_roles member_role
        join public.roles role
          on role.id = member_role.role_id
         and role.organization_id = member_role.organization_id
        where member_role.membership_id = membership.id
      ) organization_roles on true
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'projectId', project.id,
          'projectName', project.name,
          'roleCode', role.code,
          'roleName', role.name
        ) order by project.name, role.name) as items
        from public.project_memberships project_membership
        join public.projects project on project.id = project_membership.project_id
        join public.project_member_roles member_role
          on member_role.membership_id = project_membership.id
         and member_role.project_id = project_membership.project_id
        join public.roles role on role.id = member_role.role_id
        where project_membership.organization_id = membership.organization_id
          and project_membership.user_id = membership.user_id
          and project_membership.status = 'active'
      ) project_roles on true
      where membership.organization_id = p_organization_id
        and membership.status <> 'revoked'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function app_private.current_user_can_create_organization() from public, anon, authenticated;
revoke all on function app_private.guard_organization_creation() from public, anon, authenticated;

revoke all on function public.can_bootstrap_organization() from public, anon;
revoke all on function public.can_manage_organization_members(uuid) from public, anon;
revoke all on function public.provision_internal_user(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.list_internal_access(uuid) from public, anon;

grant execute on function public.can_bootstrap_organization() to authenticated;
grant execute on function public.can_manage_organization_members(uuid) to authenticated;
grant execute on function public.provision_internal_user(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.list_internal_access(uuid) to authenticated;

commit;
