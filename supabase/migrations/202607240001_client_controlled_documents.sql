begin;

-- The late client reference set contains six controlled document families that
-- share one project source but have different formal fields and response codes.
alter table public.project_register_entries
  drop constraint if exists project_register_entries_register_type_check;

alter table public.project_register_entries
  add constraint project_register_entries_register_type_check check (
    register_type in (
      'equipment','delivery','test','variation','delay','communication','risk',
      'document','drawing','rfi','submittal','site_instruction','meeting',
      'correspondence','cost','declaration','rfa','inspection_request','boq',
      'punch_list','notepad','agreement','technical_instruction','change_order',
      'contract','specification','environmental_report'
    )
  );

alter table public.findings
  add column if not exists issue_management jsonb not null default '{}'::jsonb;

alter table public.findings
  drop constraint if exists findings_issue_management_object_check;
alter table public.findings
  add constraint findings_issue_management_object_check
  check (jsonb_typeof(issue_management) = 'object');

create table public.finding_progress_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  finding_id uuid not null,
  progress_percent numeric(5,2) not null check (progress_percent between 0 and 100),
  disposition text not null default 'to_be_corrected'
    check (disposition in ('validated','to_be_corrected','alternative_solution')),
  note text not null check (char_length(note) between 2 and 2000),
  inspected_at timestamptz not null default now(),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (finding_id, project_id, organization_id)
    references public.findings(id, project_id, organization_id) on delete cascade
);

create index finding_progress_updates_finding_time_idx
  on public.finding_progress_updates (finding_id, inspected_at desc);

alter table public.finding_progress_updates enable row level security;

create policy finding_progress_updates_select on public.finding_progress_updates
  for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'findings.read')
    or app_private.has_project_permission(project_id, 'findings.manage')
    or app_private.has_project_permission(project_id, 'findings.verify')
  );

create policy finding_progress_updates_insert on public.finding_progress_updates
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      app_private.has_project_permission(project_id, 'findings.manage')
      or exists (
        select 1
        from public.findings finding
        where finding.id = finding_id
          and finding.assigned_user_id = (select auth.uid())
      )
    )
  );

create trigger finding_progress_updates_immutable
  before update or delete on public.finding_progress_updates
  for each row execute function app_private.reject_immutable_mutation();
create trigger finding_progress_updates_audit
  after insert or update or delete on public.finding_progress_updates
  for each row execute function app_private.capture_audit_event();

revoke all on public.finding_progress_updates from public, anon, authenticated;
grant select, insert on public.finding_progress_updates to authenticated;

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
      'rfi','rfa','inspection_request','technical_instruction',
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

revoke all on function app_private.valid_controlled_register_details(text,jsonb) from public, anon;
grant execute on function app_private.valid_controlled_register_details(text,jsonb)
  to authenticated, service_role;

-- Extra-argument overload used by the issue-management screen. The original
-- twelve-argument RPC remains available to inspections and offline queues.
create or replace function public.create_project_finding(
  p_project_id uuid,
  p_building_id uuid,
  p_day_report_id uuid,
  p_inspection_id uuid,
  p_inspection_response_id uuid,
  p_finding_type text,
  p_title text,
  p_description text,
  p_severity text,
  p_responsible_party_id uuid,
  p_assigned_user_id uuid,
  p_idempotency_key text,
  p_issue_management jsonb
)
returns public.findings
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_finding public.findings;
  v_year integer;
  v_sequence integer;
  v_priority text;
  v_due_at timestamptz;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_project_permission(p_project_id, 'findings.create') then
    raise exception 'Missing findings.create permission' using errcode = '42501';
  end if;
  if p_finding_type not in ('observation','deficiency','deviation','ncr','improvement') then
    raise exception 'Invalid finding type' using errcode = '22023';
  end if;
  if p_severity not in ('low','medium','high','critical') then
    raise exception 'Invalid finding severity' using errcode = '22023';
  end if;
  if char_length(trim(p_title)) < 3 or char_length(trim(p_description)) < 3 then
    raise exception 'Finding title and description are required' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_issue_management, '{}'::jsonb)) <> 'object' then
    raise exception 'Issue management fields must be an object' using errcode = '22023';
  end if;

  select finding.* into v_finding
  from public.findings finding
  where finding.project_id = p_project_id
    and finding.created_by = v_actor
    and finding.idempotency_key = p_idempotency_key;
  if found then return v_finding; end if;

  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;
  if not found then raise exception 'Project not found or not accessible' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':findings', 0));
  v_year := extract(year from (now() at time zone v_project.timezone))::integer;
  select coalesce(max(substring(finding.finding_number from '([0-9]+)$')::integer), 0) + 1
    into v_sequence
  from public.findings finding
  where finding.project_id = p_project_id
    and finding.finding_number ~ ('^Q-' || v_year || '-[0-9]+$');

  v_priority := case p_severity
    when 'critical' then 'critical'
    when 'high' then 'high'
    when 'medium' then 'normal'
    else 'low'
  end;
  v_due_at := coalesce(
    nullif(p_issue_management ->> 'expected_resolution_date', '')::date::timestamptz,
    now() + case p_severity
      when 'critical' then interval '1 day'
      when 'high' then interval '3 days'
      when 'medium' then interval '7 days'
      else interval '14 days'
    end
  );

  insert into public.findings (
    organization_id, project_id, building_id, day_report_id, inspection_id,
    inspection_response_id, finding_number, finding_type, title, description,
    severity, priority, status, responsible_party_id, assigned_user_id, due_at,
    issue_management, idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id, p_day_report_id,
    p_inspection_id, p_inspection_response_id,
    'Q-' || v_year || '-' || lpad(v_sequence::text, 4, '0'), p_finding_type,
    trim(p_title), trim(p_description), p_severity, v_priority,
    case when p_responsible_party_id is not null or p_assigned_user_id is not null
      then 'assigned' else 'open' end,
    p_responsible_party_id, p_assigned_user_id, v_due_at,
    coalesce(p_issue_management, '{}'::jsonb), p_idempotency_key, v_actor
  ) returning * into v_finding;

  insert into public.finding_updates (
    organization_id, project_id, finding_id, update_type, message, to_status, created_by
  ) values (
    v_finding.organization_id, v_finding.project_id, v_finding.id, 'created',
    'Issue created from the controlled client issue-management format; deadline is rule-driven or explicitly supplied.',
    v_finding.status, v_actor
  );

  if p_severity = 'critical' then
    insert into public.notifications (
      organization_id, project_id, recipient_user_id, notification_type,
      title, body, source_type, source_id, due_at
    )
    select distinct
      v_finding.organization_id, v_finding.project_id, membership.user_id,
      'finding_critical', 'Kritieke bevinding ' || v_finding.finding_number,
      v_finding.title, 'finding', v_finding.id, v_finding.due_at
    from public.project_memberships membership
    join public.project_member_roles member_role on member_role.membership_id = membership.id
    join public.role_permissions permission on permission.role_id = member_role.role_id
    where membership.project_id = v_finding.project_id
      and membership.status = 'active'
      and permission.permission_code in ('findings.manage','findings.verify');
  end if;
  return v_finding;
end;
$$;

create or replace function public.create_project_register_entry(
  p_project_id uuid,
  p_building_id uuid,
  p_day_report_id uuid,
  p_register_type text,
  p_title text,
  p_occurred_at timestamptz,
  p_due_at timestamptz,
  p_responsible_party_id uuid,
  p_details jsonb,
  p_idempotency_key text
)
returns public.project_register_entries
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_entry public.project_register_entries;
  v_sequence integer;
  v_prefix text;
  v_project_code text;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'records.create') then
    raise exception 'Missing records.create permission' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 3 then
    raise exception 'A register title is required' using errcode = '22023';
  end if;
  if not app_private.valid_controlled_register_details(p_register_type, coalesce(p_details, '{}'::jsonb)) then
    raise exception 'Controlled document fields are incomplete or invalid' using errcode = '22023';
  end if;

  select entry.* into v_entry
  from public.project_register_entries entry
  where entry.project_id = p_project_id
    and entry.created_by = v_actor
    and entry.idempotency_key = p_idempotency_key;
  if found then return v_entry; end if;

  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if p_building_id is not null and not exists (
    select 1 from public.buildings building
    where building.id = p_building_id and building.project_id = p_project_id
  ) then raise exception 'Building not found in project' using errcode = '23503'; end if;
  if p_day_report_id is not null and not exists (
    select 1 from public.day_reports report
    where report.id = p_day_report_id and report.project_id = p_project_id
  ) then raise exception 'Day report not found in project' using errcode = '23503'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':register:' || p_register_type, 0));
  select count(*) + 1 into v_sequence
  from public.project_register_entries entry
  where entry.project_id = p_project_id and entry.register_type = p_register_type;

  v_project_code := regexp_replace(upper(v_project.code), '[^A-Z0-9-]+', '', 'g');
  v_prefix := case p_register_type
    when 'rfi' then 'RFI-' || v_project_code
    when 'rfa' then 'RFA-' || v_project_code
    when 'inspection_request' then 'WIR-' || v_project_code
    when 'technical_instruction' then 'TI-' || v_project_code
    when 'change_order' then 'CO'
    when 'environmental_report' then 'ER'
    else upper(left(replace(p_register_type, '_', ''), 4))
  end;

  insert into public.project_register_entries (
    organization_id, project_id, building_id, day_report_id, register_type,
    entry_number, title, occurred_at, due_at, responsible_party_id, details,
    idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id, p_day_report_id,
    p_register_type,
    v_prefix || '-' || lpad(
      v_sequence::text,
      case when p_register_type in (
        'rfi','rfa','inspection_request','technical_instruction',
        'change_order','environmental_report'
      ) then 3 else 4 end,
      '0'
    ),
    trim(p_title),
    coalesce(p_occurred_at, now()), p_due_at, p_responsible_party_id,
    coalesce(p_details, '{}'::jsonb), p_idempotency_key, v_actor
  ) returning * into v_entry;
  return v_entry;
end;
$$;

create or replace function public.respond_to_controlled_project_document(
  p_entry_id uuid,
  p_response jsonb,
  p_idempotency_key text
)
returns public.project_register_entries
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_entry public.project_register_entries;
  v_decision text;
  v_status text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select entry.* into v_entry
  from public.project_register_entries entry
  where entry.id = p_entry_id
  for update;
  if not found then raise exception 'Controlled document not found' using errcode = 'P0002'; end if;
  if not app_private.has_project_permission(v_entry.project_id, 'records.edit') then
    raise exception 'Missing records.edit permission' using errcode = '42501';
  end if;
  if v_entry.register_type not in (
    'rfi','rfa','inspection_request','technical_instruction',
    'change_order','environmental_report'
  ) then raise exception 'Record is not a controlled document' using errcode = '22023'; end if;
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
  ) then raise exception 'Invalid controlled document decision' using errcode = '22023'; end if;
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

create or replace function public.record_finding_progress(
  p_finding_id uuid,
  p_progress_percent numeric,
  p_disposition text,
  p_note text,
  p_inspected_at timestamptz,
  p_idempotency_key text
)
returns public.finding_progress_updates
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_finding public.findings;
  v_update public.finding_progress_updates;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select progress.* into v_update
  from public.finding_progress_updates progress
  where progress.created_by = v_actor and progress.idempotency_key = p_idempotency_key;
  if found then return v_update; end if;

  select finding.* into v_finding
  from public.findings finding
  where finding.id = p_finding_id
  for update;
  if not found then raise exception 'Finding not found' using errcode = 'P0002'; end if;
  if not app_private.has_project_permission(v_finding.project_id, 'findings.manage')
    and v_finding.assigned_user_id is distinct from v_actor then
    raise exception 'Missing permission to record issue progress' using errcode = '42501';
  end if;
  if p_progress_percent not between 0 and 100
    or p_disposition not in ('validated','to_be_corrected','alternative_solution')
    or char_length(btrim(coalesce(p_note, ''))) < 2 then
    raise exception 'Invalid issue progress update' using errcode = '22023';
  end if;
  if v_finding.status in ('closed','cancelled','rejected') then
    raise exception 'Final findings cannot receive progress updates' using errcode = '23514';
  end if;

  insert into public.finding_progress_updates (
    organization_id, project_id, finding_id, progress_percent, disposition,
    note, inspected_at, idempotency_key, created_by
  ) values (
    v_finding.organization_id, v_finding.project_id, v_finding.id,
    p_progress_percent, p_disposition, trim(p_note), coalesce(p_inspected_at, now()),
    p_idempotency_key, v_actor
  ) returning * into v_update;

  if p_progress_percent > 0 and v_finding.status in ('open','assigned','reopened') then
    perform public.transition_project_finding(
      v_finding.id, 'in_progress',
      'Issue progress recorded at ' || p_progress_percent || '%.',
      null, null, null
    );
    v_finding.status := 'in_progress';
  end if;
  if p_progress_percent = 100 and v_finding.status = 'in_progress' then
    perform public.transition_project_finding(
      v_finding.id, 'ready_for_verification',
      'Issue reported as 100% complete; independent verification is still required.',
      null, null, trim(p_note)
    );
  end if;
  return v_update;
end;
$$;

create or replace function public.build_client_period_report_snapshot(
  p_project_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_snapshot jsonb;
begin
  v_snapshot := public.build_period_report_snapshot(p_project_id, p_start_date, p_end_date);
  return v_snapshot || jsonb_build_object(
    'schema_version', '202607240001',
    'buildings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', building.id,
        'code', building.code,
        'name', building.name,
        'description', building.description,
        'status', building.status
      ) order by building.code)
      from public.buildings building
      where building.project_id = p_project_id and building.status <> 'archived'
    ), '[]'::jsonb),
    'parties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', party.id,
        'code', party.code,
        'name', party.name,
        'party_type', party.party_type
      ) order by party.party_type, party.name)
      from public.parties party
      where party.project_id = p_project_id and party.active
    ), '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', file.id,
        'building_id', file.building_id,
        'folder_id', file.folder_id,
        'original_name', file.original_name,
        'mime_type', file.mime_type,
        'size_bytes', file.size_bytes,
        'category', file.category,
        'created_at', file.created_at
      ) order by file.created_at)
      from public.files file
      where file.project_id = p_project_id
        and file.status <> 'deleted'
        and (file.created_at at time zone 'America/Paramaribo')::date
          between p_start_date and p_end_date
    ), '[]'::jsonb),
    'media_folders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', folder.id,
        'building_id', folder.building_id,
        'parent_id', folder.parent_id,
        'name', folder.name,
        'folder_type', folder.folder_type
      ) order by folder.name)
      from public.media_folders folder
      where folder.project_id = p_project_id and folder.status = 'active'
    ), '[]'::jsonb),
    'finding_progress_updates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', progress.id,
        'finding_id', progress.finding_id,
        'progress_percent', progress.progress_percent,
        'disposition', progress.disposition,
        'note', progress.note,
        'inspected_at', progress.inspected_at
      ) order by progress.inspected_at)
      from public.finding_progress_updates progress
      where progress.project_id = p_project_id
        and (progress.inspected_at at time zone 'America/Paramaribo')::date
          between p_start_date and p_end_date
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_project_finding(
  uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text,jsonb
) from public, anon;
revoke all on function public.respond_to_controlled_project_document(uuid,jsonb,text)
  from public, anon;
revoke all on function public.record_finding_progress(uuid,numeric,text,text,timestamptz,text)
  from public, anon;
revoke all on function public.build_client_period_report_snapshot(uuid,date,date)
  from public, anon;

grant execute on function public.create_project_finding(
  uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text,jsonb
) to authenticated;
grant execute on function public.respond_to_controlled_project_document(uuid,jsonb,text)
  to authenticated;
grant execute on function public.record_finding_progress(uuid,numeric,text,text,timestamptz,text)
  to authenticated;
grant execute on function public.build_client_period_report_snapshot(uuid,date,date)
  to authenticated;

alter table public.finding_progress_updates replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table public.finding_progress_updates;
  exception when duplicate_object then null;
  end;
end;
$$;

commit;
