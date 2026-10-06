-- The NCR quality-control guard of 202608070002 / 202608090001 treats every
-- issue_management key outside the quality-control box as part of the engineer's original
-- observation. The account-free contractor flow (submit_external_share_response) writes its
-- own box into the same object — completion_* when the work is reported ready and
-- correction_* for a proposed corrective action — and runs without a CODECO session, so the
-- guard rejected it with "Only a finding manager may change the original observation" and
-- external completion stopped working entirely.
--
-- The fix keeps the guard and adds one narrowly scoped exception: the contractor's own keys
-- may be written by a non-manager only when the statement runs as a trusted database role,
-- i.e. inside the service-role-only SECURITY DEFINER share workflow. A signed-in browser
-- session (authenticated/anon) still cannot touch those keys, the engineer's
-- recommendation, the quality-control box beyond what transition_project_finding allows, or
-- any other column. Closing and reopening remain findings.verify-only.

begin;

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
  -- The contractor's boxes on the NCR form. Only the trusted share workflow writes them.
  v_contractor_keys text[] := array[
    'completion_signed_by','completion_signed_at','completion_signature_image','completion_signed_position',
    'correction_signed_by','correction_signed_at','correction_signature_image','correction_signed_position'
  ];
  -- Browser sessions always run as authenticated or anon. Anything else is server-side code
  -- that already passed its own token/authorization checks (the share RPC runs as its owner).
  v_trusted_writer boolean := current_user not in ('authenticated', 'anon');
  v_allowed_keys text[];
begin
  v_allowed_keys := case when v_trusted_writer
    then v_verification_keys || v_contractor_keys
    else v_verification_keys
  end;

  if (to_jsonb(new) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version','issue_management'])
    <> (to_jsonb(old) - array['status','status_reason','cause','proposed_correction','final_measure','verified_by','verified_at','closed_at','updated_at','version','issue_management'])
    and not app_private.has_project_permission(old.project_id, 'findings.manage') then
    raise exception 'Only a finding manager may change the original observation' using errcode = '42501';
  end if;

  -- Everything in issue_management except the quality-control box (and, for the trusted
  -- share workflow, the contractor's box) is the original observation.
  if coalesce(new.issue_management, '{}'::jsonb) is distinct from coalesce(old.issue_management, '{}'::jsonb)
    and (coalesce(new.issue_management, '{}'::jsonb) - v_allowed_keys)
      is distinct from (coalesce(old.issue_management, '{}'::jsonb) - v_allowed_keys)
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

  -- Verification stays a CODECO decision: the share workflow has no CODECO identity, so it
  -- can never satisfy this check.
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

-- Three overloads of the share response had drifted into three copies of the same body.
-- The eight-argument function of 202608090002 is the canonical implementation; the older
-- signatures stay callable (deployments mid-rollout) but now delegate to it, so a fix in
-- one place applies to every caller.
create or replace function public.submit_external_share_response(
  p_token text,
  p_response_type text,
  p_note text,
  p_contact_name text,
  p_evidence_file_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, app_private
as $$
  select public.submit_external_share_response(
    p_token, p_response_type, p_note, p_contact_name, p_evidence_file_id, p_idempotency_key,
    null::text, null::text
  );
$$;

create or replace function public.submit_external_share_response(
  p_token text,
  p_response_type text,
  p_note text,
  p_contact_name text,
  p_evidence_file_id uuid,
  p_idempotency_key text,
  p_signature_image text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, app_private
as $$
  select public.submit_external_share_response(
    p_token, p_response_type, p_note, p_contact_name, p_evidence_file_id, p_idempotency_key,
    p_signature_image, null::text
  );
$$;

revoke all on function public.submit_external_share_response(text,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.submit_external_share_response(text,text,text,text,uuid,text) to service_role;
revoke all on function public.submit_external_share_response(text,text,text,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.submit_external_share_response(text,text,text,text,uuid,text,text) to service_role;
revoke all on function public.submit_external_share_response(text,text,text,text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_external_share_response(text,text,text,text,uuid,text,text,text) to service_role;

-- Security advisor: trigger functions do not need to be reachable through /rest/v1/rpc.
revoke all on function public.sync_visual_annotation_disposition() from public, anon, authenticated;

-- The hosted project has Supabase's platform "ensure RLS" event trigger, which is not part
-- of this repository. It cannot do anything useful over RPC, but it should not be listed as
-- anonymously executable either. Local and CI databases do not have it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
