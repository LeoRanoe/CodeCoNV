-- External submission portal hardening.
-- Contractors can submit and read controlled submissions; clients/owners can
-- review those submissions without receiving broad records.edit privileges.

insert into public.permissions (code, description) values
  ('submissions.read', 'Controlled external project submissions bekijken'),
  ('submissions.review', 'Controlled external project submissions beoordelen')
on conflict (code) do nothing;

insert into public.role_permissions (organization_id, role_id, permission_code)
select role.organization_id, role.id, permission_code
from public.roles role
cross join lateral unnest(
  case role.code
    when 'contractor' then array['submissions.read','files.read']
    when 'client' then array['submissions.read','submissions.review','files.read','actions.read']
    when 'lead_supervisor' then array['submissions.read','submissions.review']
    when 'project_manager' then array['submissions.read','submissions.review']
    when 'quality_hse_manager' then array['submissions.read','submissions.review']
    else array[]::text[]
  end
) permission_code
where role.scope = 'project'
on conflict do nothing;

alter table public.project_register_entries
  drop constraint if exists project_register_entries_register_type_check;

alter table public.project_register_entries
  add constraint project_register_entries_register_type_check check (
    register_type in (
      'equipment','delivery','test','variation','delay','communication','risk',
      'document','drawing','wcr','rfi','submittal','site_instruction','meeting',
      'correspondence','cost','declaration','rfa','inspection_request','boq',
      'punch_list','notepad','agreement','technical_instruction','change_order',
      'contract','specification','environmental_report'
    )
  );

create or replace function app_private.valid_controlled_register_details(
  p_register_type text,
  p_details jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_register_type not in (
      'wcr','rfi','rfa','inspection_request','technical_instruction',
      'change_order','environmental_report'
    ) then true
    else jsonb_typeof(p_details) = 'object'
      and p_details ->> 'schema' = 'codeco.controlled-document.v1'
      and p_details ->> 'document_type' = p_register_type
      and char_length(btrim(coalesce(p_details ->> 'project_name', ''))) >= 2
      and char_length(btrim(coalesce(p_details ->> 'project_number', ''))) >= 2
      and char_length(btrim(coalesce(p_details ->> 'subject', ''))) >= 3
      and char_length(btrim(coalesce(p_details ->> 'description', ''))) >= 3
      and coalesce(p_details ->> 'issue_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and jsonb_typeof(coalesce(p_details -> 'response', '{}'::jsonb)) = 'object'
      and case p_register_type
        when 'wcr' then char_length(btrim(coalesce(p_details ->> 'requested_to', ''))) >= 2
        when 'rfi' then char_length(btrim(coalesce(p_details ->> 'requested_to', ''))) >= 2
        when 'rfa' then char_length(btrim(coalesce(p_details ->> 'requested_to', ''))) >= 2
        when 'inspection_request' then
          char_length(btrim(coalesce(p_details ->> 'requested_to', ''))) >= 2
          and coalesce(p_details ->> 'ready_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        when 'technical_instruction' then
          char_length(btrim(coalesce(p_details ->> 'requested_to', ''))) >= 2
          and char_length(btrim(coalesce(p_details ->> 'reason', ''))) >= 3
          and char_length(btrim(coalesce(p_details ->> 'required_action', ''))) >= 3
        when 'change_order' then char_length(btrim(coalesce(p_details ->> 'requested_to', ''))) >= 2
        when 'environmental_report' then
          coalesce(p_details ->> 'period_start', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          and coalesce(p_details ->> 'period_end', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          and (p_details ->> 'period_end')::date >= (p_details ->> 'period_start')::date
        else true
      end
  end;
$$;

drop policy if exists project_register_entries_select on public.project_register_entries;
create policy project_register_entries_select on public.project_register_entries
  for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'records.read')
    or (
      register_type in ('wcr','rfi','rfa','inspection_request')
      and app_private.has_project_permission(project_id, 'submissions.read')
    )
  );

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
  if v_entry.details -> 'response' ->> 'idempotency_key' = p_idempotency_key then
    return v_entry;
  end if;

  v_decision := p_response ->> 'decision';
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

  update public.project_register_entries
  set status = v_status,
      details = jsonb_set(
        v_entry.details,
        '{response}',
        p_response || jsonb_build_object(
          'responded_at', now(),
          'responded_by', v_actor,
          'idempotency_key', p_idempotency_key
        ),
        true
      )
  where id = v_entry.id
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.respond_to_controlled_project_document(uuid, jsonb, text)
  from public, anon;
grant execute on function public.respond_to_controlled_project_document(uuid, jsonb, text)
  to authenticated;
