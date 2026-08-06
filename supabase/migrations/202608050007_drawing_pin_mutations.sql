-- Stable drawing pins can be repositioned without changing their record identity. The
-- operation is deliberately idempotent: replaying the same normalized coordinate after
-- an offline reconnect returns the same logical result.

create or replace function public.move_drawing_pin(
  p_pin_id uuid,
  p_x_ratio numeric,
  p_y_ratio numeric
)
returns public.drawing_pins
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare v_pin public.drawing_pins;
begin
  select pin.* into v_pin
  from public.drawing_pins pin
  where pin.id = p_pin_id
  for update;

  if not found then
    raise exception 'Drawing pin not found' using errcode = 'P0002';
  end if;
  if not app_private.has_project_permission(v_pin.project_id, 'files.manage') then
    raise exception 'Missing files.manage permission' using errcode = '42501';
  end if;
  if v_pin.status <> 'active' then
    raise exception 'Only an active drawing pin can be moved' using errcode = '23514';
  end if;
  if p_x_ratio not between 0 and 1 or p_y_ratio not between 0 and 1 then
    raise exception 'Invalid drawing pin coordinates' using errcode = '22023';
  end if;

  if v_pin.x_ratio = p_x_ratio and v_pin.y_ratio = p_y_ratio then
    return v_pin;
  end if;

  update public.drawing_pins
  set x_ratio = p_x_ratio, y_ratio = p_y_ratio
  where id = v_pin.id
  returning * into v_pin;
  return v_pin;
end;
$$;

revoke all on function public.move_drawing_pin(uuid,numeric,numeric) from public, anon;
grant execute on function public.move_drawing_pin(uuid,numeric,numeric) to authenticated;

notify pgrst, 'reload schema';
