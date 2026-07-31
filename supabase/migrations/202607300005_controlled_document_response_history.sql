-- Append-only response history for controlled external submissions.
--
-- The previous version wrote every decision to details->'response' with jsonb_set,
-- which silently destroyed the earlier decision. The client needs to see the full
-- history of a WCR/RFI/RFA/WIR: who responded, when, with which code and comment.
--
-- details->'response' stays as the current decision so existing readers keep working;
-- details->'response_history' becomes the append-only log.

begin;

create or replace function public.respond_to_controlled_project_document(
  p_entry_id uuid,
  p_response jsonb,
  p_idempotency_key text
)
returns public.project_register_entries
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_entry public.project_register_entries;
  v_decision text;
  v_status text;
  v_response jsonb;
  v_history jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select entry.* into v_entry
  from public.project_register_entries entry
  where entry.id = p_entry_id
  for update;
  if not found then
    raise exception 'Controlled document not found' using errcode = 'P0002';
  end if;

  if not (
    app_private.has_project_permission(v_entry.project_id, 'records.edit')
    or app_private.has_project_permission(v_entry.project_id, 'submissions.review')
  ) then
    raise exception 'Missing submission review permission' using errcode = '42501';
  end if;

  if v_entry.register_type not in (
    'wcr','rfi','rfa','inspection_request','technical_instruction',
    'change_order','environmental_report'
  ) then
    raise exception 'Record is not a controlled document' using errcode = '22023';
  end if;
  if v_entry.status in ('closed','cancelled') then
    raise exception 'Closed controlled documents cannot be changed' using errcode = '23514';
  end if;
  if jsonb_typeof(p_response) <> 'object' then
    raise exception 'Response must be an object' using errcode = '22023';
  end if;

  -- Normalize the log first: jsonb_array_elements raises on a non-array value, and a
  -- record written before this migration has no history key at all.
  v_history := v_entry.details -> 'response_history';
  if v_history is null or jsonb_typeof(v_history) <> 'array' then
    v_history := case
      when jsonb_typeof(v_entry.details -> 'response') = 'object' and (v_entry.details -> 'response') ? 'decision'
        then jsonb_build_array(v_entry.details -> 'response')
      else '[]'::jsonb
    end;
  end if;

  -- Idempotency checks the whole log, not just the newest entry, so a retry can never
  -- append a duplicate decision.
  if exists (
    select 1
    from jsonb_array_elements(v_history) previous
    where previous ->> 'idempotency_key' = p_idempotency_key
  ) then
    return v_entry;
  end if;

  -- coalesce keeps a missing decision from slipping through the NOT IN comparison as NULL.
  v_decision := coalesce(p_response ->> 'decision', '');
  if v_decision not in (
    'approved','conditionally_approved','approved_with_comments','rejected',
    'clarification_needed','correct_and_resubmit','acknowledged','completed','closed'
  ) then
    raise exception 'Invalid controlled document decision' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_response ->> 'respondent_name', ''))) < 2
    or char_length(btrim(coalesce(p_response ->> 'comments', ''))) < 2 then
    raise exception 'Respondent name and comments are required' using errcode = '22023';
  end if;

  v_status := case
    when v_decision in ('approved','conditionally_approved','approved_with_comments') then 'approved'
    when v_decision in ('rejected','correct_and_resubmit') then 'rejected'
    when v_decision in ('completed','closed') then 'closed'
    when v_decision = 'acknowledged' then 'in_review'
    else 'in_review'
  end;

  v_response := p_response || jsonb_build_object(
    'responded_at', now(),
    'responded_by', v_actor,
    'previous_status', v_entry.status,
    'resulting_status', v_status,
    'idempotency_key', p_idempotency_key
  );

  update public.project_register_entries
  set status = v_status,
      details = v_entry.details
        || jsonb_build_object('response', v_response)
        || jsonb_build_object('response_history', v_history || jsonb_build_array(v_response))
  where id = v_entry.id
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.respond_to_controlled_project_document(uuid, jsonb, text)
  from public, anon;
grant execute on function public.respond_to_controlled_project_document(uuid, jsonb, text)
  to authenticated;

commit;
