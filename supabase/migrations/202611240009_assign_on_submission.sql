-- Word §3.1 ("Trigger configured workflow, notifications and contractor assignment, if applicable"),
-- §7.1 step 2 ("Submit record and assign contractor if response/action is required") and §17.1
-- ("Supervisor selects responsible contractor ... Supervisor submits; NCR appears in ... Contractor
-- Portal → Assigned to Me. System notifies contractor").
-- Workbook: NCR row 19 "Action owner" (User / contractor register), workflow profile NCR-CORRECTIVE
-- ("contractor acknowledges receipt, submits ... response"); Technical Instructions row 11 "Issued to"
-- (contractor / recipient register, required), row 12 "Action owner", row 13 "Response required by",
-- profile TECH-INSTRUCTION ("contractor acknowledges receipt ... responds/implements").
--
-- When an NCR or a Technical Instruction is saved outside draft with a contractor organisation (or
-- a portal user of one) as its responsible party, the record is assigned to that organisation's
-- Contractor Portal through public.share_to_portal, which checks portal.share, logs the assign round
-- and notifies the organisation. The named portal user becomes the contact. A record already open for
-- that organisation is not assigned again, so retries and re-saves create nothing extra. A failed
-- assignment never blocks the save; the manual "Assign or share" step stays available.
-- Decision list #6 (routing part) is resolved by these sources. Which forms contractors may initiate
-- (Word §20 item 2) stays open.

create or replace function app_private.portal_party_of_ref(p_project_id uuid, p_ref text, out party_id uuid, out contact_user_id uuid)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(p_ref, '') ~ '^party:[0-9a-f-]{36}$' then
    select party.id into party_id from public.parties party
    where party.id = substr(p_ref, 7)::uuid and party.project_id = p_project_id and party.active
      and party.party_type not in ('client', 'supervisor');
  elsif coalesce(p_ref, '') ~ '^user:[0-9a-f-]{36}$' then
    select membership.portal_party_id, membership.user_id into party_id, contact_user_id
    from public.project_memberships membership
    join public.parties party on party.id = membership.portal_party_id and party.active and party.party_type not in ('client', 'supervisor')
    where membership.project_id = p_project_id and membership.user_id = substr(p_ref, 6)::uuid and membership.status = 'active';
  end if;
end;
$$;
revoke all on function app_private.portal_party_of_ref(uuid, text) from public, anon, authenticated;

create or replace function app_private.assign_record_on_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_spec jsonb;
  v_target record;
  v_contact record;
  v_record_type text;
  v_requested text;
  v_due_text text;
  v_due timestamptz;
  v_contact_user uuid;
begin
  if (select auth.uid()) is null or not app_private.has_project_permission(new.project_id, 'portal.share') then
    return null;
  end if;

  if tg_table_name = 'findings' then
    if new.finding_type <> 'ncr' or new.status in ('draft', 'closed', 'cancelled', 'rejected') then return null; end if;
    v_spec := coalesce(new.issue_management -> 'spec', '{}'::jsonb);
    select * into v_target from app_private.portal_party_of_ref(new.project_id, v_spec ->> 'action_owner_ref');
    if v_target.party_id is null and new.responsible_party_id is not null then
      select * into v_target from app_private.portal_party_of_ref(new.project_id, 'party:' || new.responsible_party_id);
    end if;
    v_record_type := 'finding';
    v_requested := 'implement';
    v_due_text := v_spec ->> 'target_date';
  else
    if new.register_type <> 'technical_instruction' or new.status in ('draft', 'closed', 'cancelled', 'rejected') then return null; end if;
    v_spec := coalesce(new.details -> 'spec', '{}'::jsonb);
    if v_spec ->> 'workflow_status' in ('Closed', 'Cancelled') then return null; end if;
    select * into v_target from app_private.portal_party_of_ref(new.project_id, v_spec ->> 'issued_to_ref');
    v_record_type := 'register_entry';
    v_requested := 'acknowledge';
    v_due_text := v_spec ->> 'response_required_by';
  end if;

  if v_target.party_id is null then return null; end if;
  v_contact_user := v_target.contact_user_id;
  if v_contact_user is null then
    select * into v_contact from app_private.portal_party_of_ref(new.project_id, v_spec ->> 'action_owner_ref');
    if v_contact.party_id = v_target.party_id then v_contact_user := v_contact.contact_user_id; end if;
  end if;
  if exists (select 1 from public.portal_shares share
      where share.project_id = new.project_id and share.party_id = v_target.party_id and share.audience = 'contractor'
        and share.record_type = v_record_type and share.record_id = new.id and share.status not in ('closed', 'withdrawn', 'superseded')) then
    return null;
  end if;
  if coalesce(v_due_text, '') ~ '^\d{4}-\d{2}-\d{2}' then
    v_due := (left(v_due_text, 10) || ' 17:00')::timestamp at time zone 'America/Paramaribo';
  end if;

  begin
    perform public.share_to_portal(new.project_id, 'contractor', v_target.party_id, v_record_type, new.id,
      left(coalesce(nullif(trim(new.title), ''), 'Record'), 240), null, v_requested, 'normal', v_due, '{}'::uuid[], v_contact_user);
  exception when others then
    -- The record is saved either way; the assignment can still be made by hand.
    raise warning 'Automatic portal assignment skipped: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function app_private.assign_record_on_submission() from public, anon, authenticated;

drop trigger if exists findings_zz_assign_on_submission on public.findings;
create trigger findings_zz_assign_on_submission after insert or update of status, issue_management, responsible_party_id on public.findings
  for each row execute function app_private.assign_record_on_submission();
drop trigger if exists project_register_entries_zz_assign_on_submission on public.project_register_entries;
create trigger project_register_entries_zz_assign_on_submission after insert or update of status, details on public.project_register_entries
  for each row execute function app_private.assign_record_on_submission();
