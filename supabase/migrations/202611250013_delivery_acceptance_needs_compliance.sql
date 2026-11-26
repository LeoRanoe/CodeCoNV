-- Developer package v5, Word 10.1: "A Materials Delivery may only be 'Accepted' when a linked compliance check
-- Complies." A delivery whose latest linked compliance check does not comply cannot be recorded as accepted.

create or replace function public.guard_delivery_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_latest text;
begin
  if new.register_type <> 'delivery' then return new; end if;
  if coalesce(new.details #>> '{spec,inspection_result}', '') not in ('Accepted', 'Accepted with Comments') then return new; end if;
  select check_row.overall_result into v_latest
  from public.spec_compliance_checks check_row
  where check_row.subject_record_id = new.id
  order by check_row.signed_at desc, check_row.created_at desc
  limit 1;
  if v_latest = 'does_not_comply' then
    raise exception 'Not accepted: the compliance check of this delivery does not comply with the specification' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_delivery_acceptance() from public, anon, authenticated;

drop trigger if exists guard_delivery_acceptance on public.project_register_entries;
create trigger guard_delivery_acceptance before insert or update on public.project_register_entries
  for each row execute function public.guard_delivery_acceptance();
