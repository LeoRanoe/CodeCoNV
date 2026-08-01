-- The client's own non-conformance report has a box the contractor fills in:
-- "Proposed Corrective Action by Contractor". A supervisor raises the NCR, the
-- contractor receives it through a narrow external link, writes the correction and
-- sends it back. Until now the link only accepted "work is ready" or "there is a
-- problem", so that box could never be filled in by the party that has to fill it.
--
-- The web app tolerates a database without this migration: it falls back to an
-- ordinary reported problem with the same text.

alter table public.external_share_responses
  drop constraint if exists external_share_responses_response_type_check;

alter table public.external_share_responses
  add constraint external_share_responses_response_type_check
  check (response_type in ('ready_for_verification', 'issue', 'proposed_correction'));

-- The shared record now also says whether it is an NCR and what the engineer asked
-- for, so the external page can show the right form instead of a generic work point.
create or replace function public.resolve_external_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_share public.external_share_links;
  v_project public.projects;
  v_building_name text;
  v_status text;
  v_severity text;
  v_due_at timestamptz;
  v_response_count integer;
  v_record_kind text;
  v_recommended_action text;
  v_recommended_action_detail text;
  v_proposed_correction text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{48}$' then return null; end if;
  select share.* into v_share
  from public.external_share_links share
  where share.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and share.revoked_at is null and share.expires_at > now()
  for update;
  if not found then return null; end if;

  select project.* into v_project from public.projects project where project.id = v_share.project_id;
  select building.name into v_building_name from public.buildings building where building.id = v_share.building_id;
  if v_share.source_type = 'finding' then
    select finding.status, finding.severity, finding.due_at, finding.finding_type,
           nullif(finding.issue_management ->> 'recommended_action', ''),
           coalesce(
             nullif(finding.issue_management ->> 'recommended_action_detail', ''),
             nullif(finding.issue_management ->> 'action_steps', '')
           ),
           finding.proposed_correction
      into v_status, v_severity, v_due_at, v_record_kind,
           v_recommended_action, v_recommended_action_detail, v_proposed_correction
      from public.findings finding where finding.id = v_share.source_id;
  elsif v_share.source_type = 'action' then
    select action.status, action.priority, action.due_at into v_status, v_severity, v_due_at from public.actions action where action.id = v_share.source_id;
  elsif v_share.source_type = 'inspection' then
    select inspection.status, null::text, inspection.planned_at into v_status, v_severity, v_due_at from public.inspections inspection where inspection.id = v_share.source_id;
  else
    select capture.status, null::text, null::timestamptz into v_status, v_severity, v_due_at from public.visual_captures capture where capture.id = v_share.source_id;
  end if;
  select count(*)::integer into v_response_count from public.external_share_responses response where response.share_id = v_share.id;

  update public.external_share_links set view_count = view_count + 1, last_viewed_at = now() where id = v_share.id;
  return jsonb_build_object(
    'share_id', v_share.id,
    'project_name', v_project.name,
    'project_code', v_project.code,
    'building_name', v_building_name,
    'source_type', v_share.source_type,
    'source_number', v_share.source_number,
    'title', v_share.title,
    'summary', v_share.summary,
    'status', v_status,
    'severity', v_severity,
    'due_at', v_due_at,
    'expires_at', v_share.expires_at,
    'has_source_image', v_share.source_file_id is not null,
    'response_count', v_response_count,
    'record_kind', v_record_kind,
    'recommended_action', v_recommended_action,
    'recommended_action_detail', v_recommended_action_detail,
    'proposed_correction', v_proposed_correction
  );
end;
$$;

create or replace function public.submit_external_share_response(
  p_token text,
  p_response_type text,
  p_note text,
  p_contact_name text,
  p_evidence_file_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_share public.external_share_links;
  v_response public.external_share_responses;
  v_finding public.findings;
  v_contact text := nullif(btrim(coalesce(p_contact_name, '')), '');
begin
  if p_token is null or p_token !~ '^[a-f0-9]{48}$'
    or p_response_type not in ('ready_for_verification','issue','proposed_correction')
    or char_length(btrim(coalesce(p_note, ''))) not between 3 and 2000
    or char_length(coalesce(v_contact, '')) > 120
    or char_length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'Invalid external response' using errcode = '22023';
  end if;

  select share.* into v_share
  from public.external_share_links share
  where share.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and share.revoked_at is null and share.expires_at > now()
  for update;
  if not found then raise exception 'Share link expired or revoked' using errcode = 'P0002'; end if;

  -- A proposed correction only means something for a finding; anywhere else it is an
  -- ordinary reported problem.
  if p_response_type = 'proposed_correction' and v_share.source_type <> 'finding' then
    p_response_type := 'issue';
  end if;

  select response.* into v_response
  from public.external_share_responses response
  where response.share_id = v_share.id and response.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('response_id', v_response.id, 'status', 'already_received');
  end if;

  if (
    select count(*)
    from public.external_share_responses response
    where response.share_id = v_share.id and response.submitted_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'External response rate limit reached' using errcode = 'P0001';
  end if;

  if p_evidence_file_id is not null and not exists (
    select 1 from public.files file
    where file.id = p_evidence_file_id
      and file.project_id = v_share.project_id
      and file.submitted_via_share_id = v_share.id
      and file.status = 'available'
  ) then
    raise exception 'Evidence file does not belong to this share link' using errcode = '23503';
  end if;

  insert into public.external_share_responses (
    organization_id, project_id, share_id, source_type, source_id,
    response_type, contact_name, note, evidence_file_id, idempotency_key
  ) values (
    v_share.organization_id, v_share.project_id, v_share.id, v_share.source_type, v_share.source_id,
    p_response_type, v_contact, btrim(p_note), p_evidence_file_id, p_idempotency_key
  ) returning * into v_response;

  if p_response_type = 'ready_for_verification' and v_share.source_type = 'finding' then
    select finding.* into v_finding from public.findings finding where finding.id = v_share.source_id for update;
    if found and v_finding.status in ('open','assigned','in_progress','reopened') then
      update public.findings
      set status = 'ready_for_verification',
          final_measure = btrim(p_note)
      where id = v_finding.id;

      insert into public.finding_updates (
        organization_id, project_id, finding_id, update_type, message,
        from_status, to_status, created_by
      ) values (
        v_finding.organization_id, v_finding.project_id, v_finding.id, 'status',
        'Extern gereedgemeld via beveiligde link'
          || case when v_contact is not null then ' door ' || v_contact else '' end
          || ': ' || btrim(p_note),
        v_finding.status, 'ready_for_verification', v_share.created_by
      );
    end if;
  end if;

  -- The contractor's own box on the NCR form. The work itself has not been done yet,
  -- so the record only moves from "open" to "in progress"; closing stays with CODECO.
  if p_response_type = 'proposed_correction' and v_share.source_type = 'finding' then
    select finding.* into v_finding from public.findings finding where finding.id = v_share.source_id for update;
    if found then
      update public.findings
      set proposed_correction = btrim(p_note),
          status = case when v_finding.status in ('open','assigned') then 'in_progress' else v_finding.status end
      where id = v_finding.id;

      insert into public.finding_updates (
        organization_id, project_id, finding_id, update_type, message,
        from_status, to_status, created_by
      ) values (
        v_finding.organization_id, v_finding.project_id, v_finding.id, 'status',
        'Voorgestelde correctieve actie ontvangen via beveiligde link'
          || case when v_contact is not null then ' van ' || v_contact else '' end
          || ': ' || btrim(p_note),
        v_finding.status,
        case when v_finding.status in ('open','assigned') then 'in_progress' else v_finding.status end,
        v_share.created_by
      );
    end if;
  end if;

  if p_evidence_file_id is not null and v_share.source_type in ('finding','action','inspection') then
    insert into public.file_links (
      organization_id, project_id, file_id, record_type, record_id, relationship, created_by
    ) values (
      v_share.organization_id, v_share.project_id, p_evidence_file_id,
      v_share.source_type, v_share.source_id,
      case when p_response_type = 'ready_for_verification' then 'after' else 'evidence' end,
      v_share.created_by
    ) on conflict do nothing;
  end if;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id
  ) values (
    v_share.organization_id, v_share.project_id, v_share.created_by, 'system',
    case p_response_type
      when 'ready_for_verification' then 'Extern werk gereed voor verificatie'
      when 'proposed_correction' then 'Voorgestelde correctieve actie ontvangen'
      else 'Extern probleem teruggemeld'
    end,
    v_share.source_number || ' · ' || v_share.title || ': ' || left(btrim(p_note), 1200),
    'external_share_response', v_response.id
  );

  return jsonb_build_object(
    'response_id', v_response.id,
    'status', case p_response_type
      when 'ready_for_verification' then 'ready_for_verification'
      when 'proposed_correction' then 'correction_received'
      else 'issue_received'
    end
  );
end;
$$;

revoke all on function public.resolve_external_share_link(text) from public, anon, authenticated;
grant execute on function public.resolve_external_share_link(text) to service_role;
revoke all on function public.submit_external_share_response(text,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.submit_external_share_response(text,text,text,text,uuid,text) to service_role;

notify pgrst, 'reload schema';
