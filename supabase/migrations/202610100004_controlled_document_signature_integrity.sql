-- Two-party signing for controlled documents, with provenance the database enforces.
--
-- 1. A controlled document keeps its signature. Once the issuer has signed, the signature
--    (the columns and the copy inside details) cannot be replaced or removed by editing the
--    record, and the response log (details.response / response_history) can only change through
--    respond_to_controlled_project_document, never by rewriting details. Before this, any
--    member who could edit a record could overwrite a signature or erase a recorded decision.
-- 2. A document CODECO issues (TI, CO, ER) is signed under the name of the signed-in account, not
--    under a name typed on the form. Documents received from a contractor (WCR, RFI, RFA, WIR)
--    keep the typed name of the submitting person, as the paper form carries it.
-- 3. The recipient can sign the formal response by hand. The server stamps who captured it, when,
--    and whether the signatory used their own account or signed on the capturing user's device;
--    the recipient can never be the issuer, and an unissued document cannot be countersigned.
--
-- Nothing existing is rewritten: records and responses already stored are untouched, and an app
-- version that sends no signature keeps working.

begin;

create or replace function app_private.controlled_document_signature_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text;
begin
  if new.register_type not in (
    'wcr','rfi','rfa','inspection_request','technical_instruction','change_order','environmental_report'
  ) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.signature_image is not null and (
      new.signature_image is distinct from old.signature_image
      or new.signed_by is distinct from old.signed_by
      or new.signed_at is distinct from old.signed_at
    ) then
      raise exception 'A signed document keeps its signature' using errcode = '23514';
    end if;
    if nullif(old.details ->> 'signature_image', '') is not null and (
      (new.details ->> 'signature_image') is distinct from (old.details ->> 'signature_image')
      or (new.details ->> 'signed_by') is distinct from (old.details ->> 'signed_by')
    ) then
      raise exception 'A signed document keeps its signature' using errcode = '23514';
    end if;
    -- The change order's own contractor and supervision signatures are kept the same way.
    if (nullif(old.details ->> 'contractor_signature_image', '') is not null and (
        (new.details ->> 'contractor_signature_image') is distinct from (old.details ->> 'contractor_signature_image')
        or (new.details ->> 'contractor_signed_by') is distinct from (old.details ->> 'contractor_signed_by')))
      or (nullif(old.details ->> 'supervision_signature_image', '') is not null and (
        (new.details ->> 'supervision_signature_image') is distinct from (old.details ->> 'supervision_signature_image')
        or (new.details ->> 'supervision_signed_by') is distinct from (old.details ->> 'supervision_signed_by'))) then
      raise exception 'A signed document keeps its signature' using errcode = '23514';
    end if;
    if coalesce(current_setting('codeco.controlled_response', true), '') <> 'on' and (
      (new.details -> 'response') is distinct from (old.details -> 'response')
      or (new.details -> 'response_history') is distinct from (old.details -> 'response_history')
    ) then
      raise exception 'The recorded response can only change through a formal response' using errcode = '23514';
    end if;
  end if;

  -- The copy of the signature inside details follows the same rule as the columns.
  if nullif(new.details ->> 'signature_image', '') is not null
     and (tg_op = 'INSERT' or nullif(old.details ->> 'signature_image', '') is null)
     and new.register_type not in ('wcr','rfi','rfa','inspection_request') and v_actor is not null then
    select profile.display_name into v_name from public.profiles profile where profile.id = v_actor;
    if v_name is not null then
      new.details := new.details || jsonb_build_object('signed_by', v_name);
    end if;
  end if;
  -- The supervision approval on a change order is the account's own signature too.
  if nullif(new.details ->> 'supervision_signature_image', '') is not null
     and (tg_op = 'INSERT' or nullif(old.details ->> 'supervision_signature_image', '') is null)
     and v_actor is not null then
    select profile.display_name into v_name from public.profiles profile where profile.id = v_actor;
    if v_name is not null then
      new.details := new.details || jsonb_build_object('supervision_signed_by', v_name);
    end if;
  end if;

  if new.signature_image is not null and (tg_op = 'INSERT' or old.signature_image is null) then
    if new.register_type not in ('wcr','rfi','rfa','inspection_request') and v_actor is not null then
      select profile.display_name into v_name from public.profiles profile where profile.id = v_actor;
      if v_name is not null then
        new.signed_by := v_name;
        new.details := new.details || jsonb_build_object('signed_by', v_name);
      end if;
    end if;
    -- A signature made offline keeps its own moment, but never one in the future.
    new.signed_at := least(coalesce(new.signed_at, now()), now());
  end if;
  return new;
end;
$$;

drop trigger if exists project_register_entries_signature_guard on public.project_register_entries;
create trigger project_register_entries_signature_guard
  before insert or update on public.project_register_entries
  for each row execute function app_private.controlled_document_signature_guard();

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
  v_signature text;
  v_actor_name text;
  v_issuer_name text;
  v_capture text;
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

  -- A handwritten recipient signature is optional (an older app version sends none) but, when it
  -- comes, it must stand for a different person than the issuer and for an issued document.
  v_signature := nullif(p_response ->> 'signature_image', '');
  select profile.display_name into v_actor_name from public.profiles profile where profile.id = v_actor;
  if v_signature is not null then
    if char_length(v_signature) not between 40 and 200000 or v_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' then
      raise exception 'Invalid signature image' using errcode = '22023';
    end if;
    if char_length(btrim(coalesce(p_response ->> 'respondent_position', ''))) < 2 then
      raise exception 'The position of the signatory is required with a signature' using errcode = '22023';
    end if;
    if v_entry.signature_image is null and nullif(v_entry.details ->> 'signature_image', '') is null then
      raise exception 'The issuer has to sign the document before the recipient' using errcode = '23514';
    end if;
    v_issuer_name := lower(btrim(coalesce(v_entry.signed_by, v_entry.details ->> 'signed_by', '')));
    if v_issuer_name <> '' and lower(btrim(p_response ->> 'respondent_name')) = v_issuer_name then
      raise exception 'The recipient cannot be the issuer of the document' using errcode = '42501';
    end if;
    v_capture := case
      when lower(btrim(p_response ->> 'respondent_name')) = lower(btrim(coalesce(v_actor_name, ''))) then 'own_account'
      else 'on_device'
    end;
  end if;

  v_status := case
    when v_decision in ('approved','conditionally_approved','approved_with_comments') then 'approved'
    when v_decision in ('rejected','correct_and_resubmit') then 'rejected'
    when v_decision in ('completed','closed') then 'closed'
    when v_decision = 'acknowledged' then 'in_review'
    else 'in_review'
  end;

  -- The server owns who, when and how the response was captured; nothing the caller sends
  -- under those names is kept.
  v_response := (p_response - 'responded_at' - 'responded_by' - 'responded_by_name' - 'signed_at'
                 - 'signature_capture' - 'previous_status' - 'resulting_status' - 'idempotency_key')
    || jsonb_build_object(
    'responded_at', now(),
    'responded_by', v_actor,
    'responded_by_name', v_actor_name,
    'previous_status', v_entry.status,
    'resulting_status', v_status,
    'idempotency_key', p_idempotency_key
  ) || case when v_signature is null then '{}'::jsonb
            else jsonb_build_object('signed_at', now(), 'signature_capture', v_capture) end;

  -- The response log may only change through this function (see the guard above).
  perform set_config('codeco.controlled_response', 'on', true);

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
