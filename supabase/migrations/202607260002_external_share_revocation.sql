begin;

-- External links are intentionally revocable, but browsers must not receive a
-- general UPDATE capability on the share table. Route every revocation through
-- one audited, idempotent operation that can change only revoked_at.
create or replace function public.revoke_external_share_link(
  p_share_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_share public.external_share_links;
  v_already_revoked boolean;
begin
  if v_actor is null or p_share_id is null then
    raise exception 'Authentication and a share link are required'
      using errcode = '42501';
  end if;

  select share.* into v_share
  from public.external_share_links share
  where share.id = p_share_id
  for update;

  if not found then
    raise exception 'External share link not found'
      using errcode = 'P0002';
  end if;

  if v_share.created_by <> v_actor
    and not app_private.has_project_permission(v_share.project_id, 'project.configure') then
    raise exception 'External share link revocation is not allowed'
      using errcode = '42501';
  end if;

  v_already_revoked := v_share.revoked_at is not null;
  if not v_already_revoked then
    update public.external_share_links
    set revoked_at = now()
    where id = v_share.id
    returning * into v_share;
  end if;

  return jsonb_build_object(
    'share_id', v_share.id,
    'revoked_at', v_share.revoked_at,
    'already_revoked', v_already_revoked
  );
end;
$$;

revoke update on table public.external_share_links from authenticated;
revoke all on function public.revoke_external_share_link(uuid) from public, anon, authenticated;
grant execute on function public.revoke_external_share_link(uuid) to authenticated;

comment on function public.revoke_external_share_link(uuid) is
  'Idempotently revokes one external share link. Only its creator or a project.configure member may revoke it.';

commit;
