begin;

-- Keep the storage table constraint and the guarded RPC on one explicit
-- allowlist. Both actions below are invoked by authenticated, same-origin
-- server routes and still use the caller-supplied limits bounded below.
alter table app_private.security_rate_limits
  drop constraint if exists security_rate_limits_action_code_check;
alter table app_private.security_rate_limits
  add constraint security_rate_limits_action_code_check
  check (
    action_code in (
      'admin_invite',
      'manual_backup',
      'restore_dry_run',
      'blob_upload',
      'notification_push_dispatch'
    )
  );

create or replace function public.consume_security_rate_limit(
  p_action_code text,
  p_max_requests integer,
  p_window_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_window timestamptz;
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_action_code not in (
      'admin_invite',
      'manual_backup',
      'restore_dry_run',
      'blob_upload',
      'notification_push_dispatch'
    )
    or p_max_requests < 1 or p_max_requests > 100
    or p_window_minutes < 1 or p_window_minutes > 1440 then
    raise exception 'Invalid rate-limit configuration' using errcode = '22023';
  end if;

  v_window := date_bin(
    make_interval(mins => p_window_minutes),
    now(),
    '2000-01-01 00:00:00+00'::timestamptz
  );

  insert into app_private.security_rate_limits (
    actor_user_id,
    action_code,
    window_started_at,
    request_count
  ) values (
    v_actor,
    p_action_code,
    v_window,
    1
  )
  on conflict (actor_user_id, action_code, window_started_at)
  do update set request_count = app_private.security_rate_limits.request_count + 1
  returning request_count into v_count;

  delete from app_private.security_rate_limits
  where window_started_at < now() - interval '2 days';

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_security_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, integer, integer)
  to authenticated;

comment on function public.consume_security_rate_limit(text, integer, integer) is
  'Consumes an authenticated per-action rate-limit slot for a fixed production action allowlist.';

commit;
