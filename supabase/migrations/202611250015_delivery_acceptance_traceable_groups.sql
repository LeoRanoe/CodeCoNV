-- Developer package v5, Word 10.1: "A Materials Delivery may only be 'Accepted' when a linked compliance check Complies."
--
-- Decision (V5-DECISION-REGISTER D-09, inferred from the workbook): the check is required for the material groups the
-- workbook itself marks as traceable (row 9.1: Cement & Binders, Concrete & Precast, Reinforcement & Structural Steel,
-- Piles & Foundation Products; lib/forms/spec-forms.ts traceableMaterialGroups, kept identical by a unit test). For those
-- groups a delivery can only be recorded as Accepted / Accepted with Comments when its latest signed compliance check
-- Complies (or Complies with comments). For every other group the rule of 202611250013 stays: a delivery whose latest
-- check does not comply cannot be accepted. A delivery is first registered with another result, checked in Rapid Verify,
-- and accepted afterwards.

create or replace function public.guard_delivery_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_latest text;
  v_traceable boolean;
begin
  if new.register_type <> 'delivery' then return new; end if;
  if coalesce(new.details #>> '{spec,inspection_result}', '') not in ('Accepted', 'Accepted with Comments') then return new; end if;
  v_traceable := coalesce(new.details #>> '{spec,material_group}', '') in (
    'Cement & Binders', 'Concrete & Precast', 'Reinforcement & Structural Steel', 'Piles & Foundation Products');
  select check_row.overall_result into v_latest
  from public.spec_compliance_checks check_row
  where check_row.subject_record_id = new.id
  order by check_row.signed_at desc, check_row.created_at desc
  limit 1;
  if v_latest = 'does_not_comply' then
    raise exception 'Not accepted: the compliance check of this delivery does not comply with the specification' using errcode = '22023';
  end if;
  if v_traceable and v_latest is distinct from 'complies' and v_latest is distinct from 'complies_with_comments' then
    raise exception 'Not accepted: a delivery of this material group is accepted only after a compliance check that complies' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_delivery_acceptance() from public, anon, authenticated;
