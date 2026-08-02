-- Repair project-role assignment after the original function referenced a column that
-- does not exist on public.roles. Role availability is governed by the centrally managed
-- role records; membership activation remains a property of project_memberships.
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
    and role.code = p_role_code;
  if not found then
    raise exception 'Project role not found' using errcode = 'P0002';
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
