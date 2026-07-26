begin;

-- A secure account-free trade link is itself a deliberate assignment from a
-- CODECO project member. The trade may therefore submit an otherwise open
-- finding directly for CODECO verification. Final verification/closure stays
-- protected by the existing findings.verify permission.
create or replace function app_private.validate_finding_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if (to_jsonb(new) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version'])
    <> (to_jsonb(old) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version'])
    and not app_private.has_project_permission(old.project_id, 'findings.manage') then
    raise exception 'Only a finding manager may change the original observation' using errcode = '42501';
  end if;

  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'draft' and new.status in ('open','cancelled'))
    or (old.status = 'open' and new.status in ('assigned','in_progress','ready_for_verification','rejected','cancelled'))
    or (old.status = 'assigned' and new.status in ('in_progress','ready_for_verification','rejected','cancelled'))
    or (old.status = 'in_progress' and new.status in ('ready_for_verification','cancelled'))
    or (old.status = 'ready_for_verification' and new.status in ('closed','reopened'))
    or (old.status = 'reopened' and new.status in ('in_progress','ready_for_verification','cancelled'))
  ) then
    raise exception 'Invalid finding transition: % -> %', old.status, new.status using errcode = '23514';
  end if;

  if new.status in ('closed','reopened') and not app_private.has_project_permission(old.project_id, 'findings.verify') then
    raise exception 'Only an authorized verifier may close or reopen a finding' using errcode = '42501';
  end if;
  if new.status = 'closed' then
    new.verified_by := (select auth.uid());
    new.verified_at := now();
    new.closed_at := now();
  end if;
  return new;
end;
$$;

commit;
