-- Client feedback 9 augustus 2026, on the NCR form mockups. The Quality Control /
-- Verification box is more than a signature and a note: the client's own form asks for
-- the day the re-inspection was actually carried out, what was observed, whether the
-- issue is resolved, and the job the verifier holds. "Closed" as a status is not the same
-- statement as "the corrective action was inspected on this date and found acceptable",
-- and an NCR that is disputed a year later is settled by the second sentence, not the
-- first.
--
-- Everything lands in issue_management, which is already the home of the other two boxes
-- of that form, so no column is added. What changes is who may write these keys during a
-- status transition, and how they get in.

begin;

-- The transition trigger lets a non-manager write only the quality-control keys. That
-- list gains the rest of the box; the engineer's own recommendation, remarks and
-- signature stay manager-only, exactly as in 202608070002.
create or replace function app_private.validate_finding_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_verification_keys text[] := array[
    'verification_signed_by','verification_signed_at','verification_signature_image',
    'verification_signed_position','verification_comments',
    'qc_inspection_date','qc_issue_resolved','qc_remarks'
  ];
begin
  if (to_jsonb(new) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version','issue_management'])
    <> (to_jsonb(old) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version','issue_management'])
    and not app_private.has_project_permission(old.project_id, 'findings.manage') then
    raise exception 'Only a finding manager may change the original observation' using errcode = '42501';
  end if;

  -- Everything in issue_management except the quality-control box is the original
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

-- One extra argument rather than five: the rest of the box travels as a small object, and
-- the function copies across only the keys it knows. A caller cannot smuggle the
-- engineer's signature in through it.
--
-- As in 202608070002, the previous signature is dropped first so exactly one function
-- remains and every existing shorter call resolves to it through the defaults.
drop function if exists public.transition_project_finding(uuid,text,text,text,text,text,text,text);

create or replace function public.transition_project_finding(
  p_finding_id uuid,
  p_next_status text,
  p_note text,
  p_cause text default null,
  p_correction text default null,
  p_final_measure text default null,
  p_verification_signed_by text default null,
  p_verification_signature_image text default null,
  p_verification_details jsonb default null
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
  v_details jsonb := coalesce(p_verification_details, '{}'::jsonb);
  v_box jsonb := '{}'::jsonb;
  v_position text := nullif(btrim(coalesce(v_details->>'verification_signed_position', '')), '');
  v_comments text := nullif(btrim(coalesce(v_details->>'verification_comments', '')), '');
  v_remarks text := nullif(btrim(coalesce(v_details->>'qc_remarks', '')), '');
  v_inspection_date text := nullif(btrim(coalesce(v_details->>'qc_inspection_date', '')), '');
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
  if v_inspection_date is not null and v_inspection_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'The date of QC inspection must be a calendar date' using errcode = '22007';
  end if;
  if char_length(coalesce(v_position, '')) > 240
    or char_length(coalesce(v_comments, '')) > 1000
    or char_length(coalesce(v_remarks, '')) > 1000 then
    raise exception 'A quality-control entry is longer than the form allows' using errcode = '22001';
  end if;

  if v_signed_by is not null or v_signature_image is not null then
    v_box := jsonb_build_object(
      'verification_signed_by', coalesce(v_signed_by, ''),
      'verification_signed_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'verification_signature_image', coalesce(v_signature_image, '')
    );
  end if;
  -- Only the keys this box owns, and only the ones that were actually filled in.
  if v_position is not null then v_box := v_box || jsonb_build_object('verification_signed_position', v_position); end if;
  if v_comments is not null then v_box := v_box || jsonb_build_object('verification_comments', v_comments); end if;
  if v_remarks is not null then v_box := v_box || jsonb_build_object('qc_remarks', v_remarks); end if;
  if v_inspection_date is not null then v_box := v_box || jsonb_build_object('qc_inspection_date', v_inspection_date); end if;
  if v_details ? 'qc_issue_resolved' then
    v_box := v_box || jsonb_build_object('qc_issue_resolved', coalesce((v_details->>'qc_issue_resolved')::boolean, false));
  end if;

  v_from_status := v_finding.status;
  update public.findings set
    status = p_next_status,
    status_reason = case when p_next_status in ('rejected','reopened','cancelled') then trim(p_note) else null end,
    cause = coalesce(nullif(trim(p_cause), ''), cause),
    proposed_correction = coalesce(nullif(trim(p_correction), ''), proposed_correction),
    final_measure = coalesce(nullif(trim(p_final_measure), ''), final_measure),
    issue_management = case when v_box <> '{}'::jsonb
      then coalesce(issue_management, '{}'::jsonb) || v_box
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

revoke all on function public.transition_project_finding(uuid,text,text,text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.transition_project_finding(uuid,text,text,text,text,text,text,text,jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
