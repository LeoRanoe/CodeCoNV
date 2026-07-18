begin;

alter table public.organization_memberships
  add column status_change_reason text
  check (status_change_reason is null or char_length(status_change_reason) between 5 and 500);

create or replace function public.set_internal_user_access_status(
  p_organization_id uuid,
  p_user_id uuid,
  p_next_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_membership public.organization_memberships;
begin
  if v_actor is null or not app_private.has_organization_permission(p_organization_id, 'members.manage') then
    raise exception 'Missing members.manage permission' using errcode = '42501';
  end if;
  if p_user_id = v_actor then
    raise exception 'Administrators cannot change their own access status' using errcode = '23514';
  end if;
  if p_next_status not in ('active','suspended','revoked') or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'A valid status and reason are required' using errcode = '22023';
  end if;

  select membership.* into v_membership
  from public.organization_memberships membership
  where membership.organization_id = p_organization_id and membership.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Internal membership not found' using errcode = 'P0002';
  end if;
  if v_membership.status = 'revoked' then
    raise exception 'Revoked access cannot be reactivated' using errcode = '23514';
  end if;
  if p_next_status = v_membership.status then
    raise exception 'Access already has the requested status' using errcode = '23514';
  end if;

  if p_next_status = 'suspended' then
    update public.project_memberships
    set status = 'suspended'
    where organization_id = p_organization_id and user_id = p_user_id and status in ('active','invited');
  elsif p_next_status = 'active' then
    if v_membership.status <> 'suspended' then
      raise exception 'Only suspended access can be reactivated' using errcode = '23514';
    end if;
    update public.project_memberships
    set status = 'active'
    where organization_id = p_organization_id and user_id = p_user_id and status = 'suspended';
  else
    update public.project_memberships
    set status = 'revoked'
    where organization_id = p_organization_id and user_id = p_user_id and status <> 'revoked';
  end if;

  update public.organization_memberships
  set status = p_next_status, status_change_reason = btrim(p_reason)
  where id = v_membership.id
  returning * into v_membership;

  return jsonb_build_object(
    'userId', v_membership.user_id,
    'organizationId', v_membership.organization_id,
    'status', v_membership.status,
    'reason', v_membership.status_change_reason
  );
end;
$$;

revoke update on public.organization_memberships, public.project_memberships from authenticated;
revoke all on function public.set_internal_user_access_status(uuid,uuid,text,text) from public, anon;
grant execute on function public.set_internal_user_access_status(uuid,uuid,text,text) to authenticated;

commit;
