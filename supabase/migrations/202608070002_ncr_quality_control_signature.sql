-- Client feedback 7 augustus 2026, on the NCR form mockups: the Quality Control /
-- Verification box marks its signature line required ("Signature *"), exactly like the
-- engineer's recommendation and the contractor's correction already are. Closing an NCR
-- only recorded a text note; this adds the same written signature the rest of the form
-- already uses.

begin;

-- issue_management already carries the recommendation and correction signatures, but the
-- transition trigger never let it change during a status transition — only the internal
-- external-share flow touched it, as a security-definer function. transition_project_finding
-- runs as the calling user (security invoker), so the quality-control signature it writes
-- has to be allowed through here.
--
-- Only that signature, though. issue_management also holds the engineer's own recommended
-- action, remarks and written signature; those are the original observation and stay
-- manager-only. Excluding the whole column would let anyone the findings_update policy
-- lets through — an assigned user who is not a manager — overwrite the engineer's
-- signature, so the column is excluded from the blanket check and then re-checked key by
-- key against the three verification fields.
create or replace function app_private.validate_finding_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_verification_keys text[] := array['verification_signed_by','verification_signed_at','verification_signature_image'];
begin
  if (to_jsonb(new) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version','issue_management'])
    <> (to_jsonb(old) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version','issue_management'])
    and not app_private.has_project_permission(old.project_id, 'findings.manage') then
    raise exception 'Only a finding manager may change the original observation' using errcode = '42501';
  end if;

  -- Everything in issue_management except the quality-control signature is the original
  -- observation, and changing it stays a finding manager's right.
  if coalesce(new.issue_management, '{}'::jsonb) is distinct from coalesce(old.issue_management, '{}'::jsonb)
    and (coalesce(new.issue_management, '{}'::jsonb) - v_verification_keys)
      is distinct from (coalesce(old.issue_management, '{}'::jsonb) - v_verification_keys)
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

-- transition_project_finding gains two arguments for the written verification signature,
-- required only when an NCR (not a plain issue) closes.
--
-- The two new arguments have defaults, so this REPLACES the six-argument function of
-- 202607180008 rather than sitting beside it. Keeping both would make every existing
-- six-argument call ambiguous ("function ... is not unique") — including the internal
-- calls record_issue_progress makes in 202607240001, which would break recording
-- inspection progress. Dropping the old signature first leaves exactly one function, and
-- every existing six-argument caller resolves to it through the defaults.
drop function if exists public.transition_project_finding(uuid,text,text,text,text,text);

create or replace function public.transition_project_finding(
  p_finding_id uuid,
  p_next_status text,
  p_note text,
  p_cause text default null,
  p_correction text default null,
  p_final_measure text default null,
  p_verification_signed_by text default null,
  p_verification_signature_image text default null
)
returns public.findings
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_finding public.findings;
  v_from_status text;
  v_signed_by text := nullif(btrim(coalesce(p_verification_signed_by, '')), '');
  v_signature_image text := nullif(btrim(coalesce(p_verification_signature_image, '')), '');
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(trim(p_note)) < 2 then raise exception 'A transition note is required' using errcode = '22023'; end if;
  select finding.* into v_finding from public.findings finding where finding.id = p_finding_id for update;
  if not found then raise exception 'Finding not found or not accessible' using errcode = 'P0002'; end if;
  if v_finding.assigned_user_id is distinct from v_actor
    and not app_private.has_project_permission(v_finding.project_id, 'findings.manage')
    and not (p_next_status in ('closed','reopened') and app_private.has_project_permission(v_finding.project_id, 'findings.verify')) then
    raise exception 'You may not transition this finding' using errcode = '42501';
  end if;
  if p_next_status = 'ready_for_verification' and char_length(coalesce(trim(p_final_measure), trim(v_finding.final_measure), '')) < 3 then
    raise exception 'A final corrective measure is required before verification' using errcode = '23514';
  end if;
  -- The Quality Control / Verification box is on the client's own NCR form only; a
  -- plain issue may still be verified without a written signature.
  if p_next_status = 'closed' and v_finding.finding_type = 'ncr' and (v_signed_by is null or v_signature_image is null) then
    raise exception 'The quality-control signature is required to close an NCR' using errcode = '23514';
  end if;
  if v_signature_image is not null and (
    v_signature_image !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'
    or char_length(v_signature_image) > 200000
  ) then
    raise exception 'A written signature must be a small inline image' using errcode = '22023';
  end if;
  v_from_status := v_finding.status;
  update public.findings set
    status = p_next_status,
    status_reason = case when p_next_status in ('rejected','reopened','cancelled') then trim(p_note) else null end,
    cause = coalesce(nullif(trim(p_cause), ''), cause),
    proposed_correction = coalesce(nullif(trim(p_correction), ''), proposed_correction),
    final_measure = coalesce(nullif(trim(p_final_measure), ''), final_measure),
    issue_management = case when v_signed_by is not null or v_signature_image is not null
      then coalesce(issue_management, '{}'::jsonb) || jsonb_build_object(
        'verification_signed_by', coalesce(v_signed_by, ''),
        'verification_signed_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'verification_signature_image', coalesce(v_signature_image, '')
      )
      else issue_management
    end
  where id = v_finding.id
  returning * into v_finding;
  insert into public.finding_updates (
    organization_id, project_id, finding_id, update_type, message,
    from_status, to_status, created_by
  ) values (
    v_finding.organization_id, v_finding.project_id, v_finding.id,
    case when p_next_status = 'closed' then 'verification' else 'status' end,
    trim(p_note), v_from_status, v_finding.status, v_actor
  );
  return v_finding;
end;
$$;

revoke all on function public.transition_project_finding(uuid,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.transition_project_finding(uuid,text,text,text,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';

commit;
