begin;

create policy day_reports_sign on public.day_reports for update to authenticated
  using (status in ('approved','signed') and app_private.has_project_permission(project_id, 'reports.sign'))
  with check (app_private.has_project_permission(project_id, 'reports.sign'));
create policy day_reports_distribute on public.day_reports for update to authenticated
  using (status in ('signed','sent') and app_private.has_project_permission(project_id, 'reports.distribute'))
  with check (app_private.has_project_permission(project_id, 'reports.distribute'));
create policy day_reports_revise on public.day_reports for update to authenticated
  using (status in ('approved','signed','sent','revised') and app_private.has_project_permission(project_id, 'reports.review'))
  with check (app_private.has_project_permission(project_id, 'reports.review'));

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
  p_idempotency_key text
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

  select finding.* into v_finding from public.findings finding
  where finding.project_id = p_project_id and finding.created_by = v_actor
    and finding.idempotency_key = p_idempotency_key;
  if found then return v_finding; end if;

  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found or not accessible' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':findings', 0));
  v_year := extract(year from (now() at time zone v_project.timezone))::integer;
  select coalesce(max(substring(finding.finding_number from '([0-9]+)$')::integer), 0) + 1
    into v_sequence from public.findings finding
    where finding.project_id = p_project_id and finding.finding_number ~ ('^Q-' || v_year || '-[0-9]+$');
  v_priority := case p_severity when 'critical' then 'critical' when 'high' then 'high' when 'medium' then 'normal' else 'low' end;
  v_due_at := now() + case p_severity when 'critical' then interval '1 day' when 'high' then interval '3 days' when 'medium' then interval '7 days' else interval '14 days' end;

  insert into public.findings (
    organization_id, project_id, building_id, day_report_id, inspection_id,
    inspection_response_id, finding_number, finding_type, title, description,
    severity, priority, status, responsible_party_id, assigned_user_id, due_at,
    idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id, p_day_report_id,
    p_inspection_id, p_inspection_response_id,
    'Q-' || v_year || '-' || lpad(v_sequence::text, 4, '0'), p_finding_type,
    trim(p_title), trim(p_description), p_severity, v_priority,
    case when p_responsible_party_id is not null or p_assigned_user_id is not null then 'assigned' else 'open' end,
    p_responsible_party_id, p_assigned_user_id, v_due_at, p_idempotency_key, v_actor
  ) returning * into v_finding;

  insert into public.finding_updates (
    organization_id, project_id, finding_id, update_type, message, to_status, created_by
  ) values (
    v_finding.organization_id, v_finding.project_id, v_finding.id, 'created',
    'Bevinding centraal aangemaakt; deadline is regelgestuurd afgeleid van ernst ' || p_severity || '.',
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
    where membership.project_id = v_finding.project_id and membership.status = 'active'
      and permission.permission_code in ('findings.manage','findings.verify');
  end if;
  return v_finding;
end;
$$;

create or replace function public.transition_project_finding(
  p_finding_id uuid,
  p_next_status text,
  p_note text,
  p_cause text default null,
  p_correction text default null,
  p_final_measure text default null
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
  v_from_status := v_finding.status;
  update public.findings set
    status = p_next_status,
    status_reason = case when p_next_status in ('rejected','reopened','cancelled') then trim(p_note) else null end,
    cause = coalesce(nullif(trim(p_cause), ''), cause),
    proposed_correction = coalesce(nullif(trim(p_correction), ''), proposed_correction),
    final_measure = coalesce(nullif(trim(p_final_measure), ''), final_measure)
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

create or replace function public.start_project_inspection(
  p_project_id uuid,
  p_building_id uuid,
  p_day_report_id uuid,
  p_template_id uuid,
  p_title text,
  p_idempotency_key text
)
returns public.inspections
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_template public.checklist_templates;
  v_inspection public.inspections;
  v_year integer;
  v_sequence integer;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not app_private.has_project_permission(p_project_id, 'inspections.manage') then
    raise exception 'Missing inspections.manage permission' using errcode = '42501';
  end if;
  select inspection.* into v_inspection from public.inspections inspection
  where inspection.project_id = p_project_id and inspection.created_by = v_actor
    and inspection.idempotency_key = p_idempotency_key;
  if found then return v_inspection; end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  select template.* into v_template from public.checklist_templates template
    where template.id = p_template_id and template.organization_id = v_project.organization_id
      and template.module = 'inspection' and template.status = 'published'
      and (template.project_id is null or template.project_id = p_project_id);
  if not found then raise exception 'Published inspection template not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':inspections', 0));
  v_year := extract(year from (now() at time zone v_project.timezone))::integer;
  select coalesce(max(substring(inspection.inspection_number from '([0-9]+)$')::integer), 0) + 1
    into v_sequence from public.inspections inspection
    where inspection.project_id = p_project_id and inspection.inspection_number ~ ('^INS-' || v_year || '-[0-9]+$');
  insert into public.inspections (
    organization_id, project_id, building_id, day_report_id, template_id,
    inspection_number, title, status, planned_at, started_at, executed_by,
    idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id, p_day_report_id,
    v_template.id, 'INS-' || v_year || '-' || lpad(v_sequence::text, 4, '0'),
    trim(p_title), 'in_progress', now(), now(), v_actor, p_idempotency_key, v_actor
  ) returning * into v_inspection;
  return v_inspection;
end;
$$;

create or replace function public.save_inspection_response(
  p_inspection_id uuid,
  p_checklist_item_id uuid,
  p_result text,
  p_numeric_value numeric,
  p_text_value text,
  p_notes text,
  p_idempotency_key text
)
returns public.inspection_responses
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_inspection public.inspections;
  v_item public.checklist_items;
  v_response public.inspection_responses;
begin
  select inspection.* into v_inspection from public.inspections inspection where inspection.id = p_inspection_id for update;
  if not found or not app_private.has_project_permission(v_inspection.project_id, 'inspections.manage') then
    raise exception 'Inspection not found or not editable' using errcode = '42501';
  end if;
  if v_inspection.status not in ('planned','in_progress') then
    raise exception 'Inspection is not editable in status %', v_inspection.status using errcode = '23514';
  end if;
  select item.* into v_item from public.checklist_items item
    where item.id = p_checklist_item_id and item.template_id = v_inspection.template_id;
  if not found then raise exception 'Checklist item is not part of this inspection' using errcode = '23514'; end if;
  insert into public.inspection_responses (
    organization_id, project_id, inspection_id, checklist_item_id, result,
    numeric_value, text_value, notes, idempotency_key, created_by
  ) values (
    v_inspection.organization_id, v_inspection.project_id, v_inspection.id,
    v_item.id, p_result, p_numeric_value, nullif(trim(p_text_value), ''),
    nullif(trim(p_notes), ''), p_idempotency_key, v_actor
  ) on conflict (inspection_id, checklist_item_id) do update set
    result = excluded.result, numeric_value = excluded.numeric_value,
    text_value = excluded.text_value, notes = excluded.notes
  returning * into v_response;
  return v_response;
end;
$$;

create or replace function public.complete_project_inspection(p_inspection_id uuid)
returns public.inspections
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_inspection public.inspections;
  v_response record;
  v_missing integer;
  v_failed integer;
begin
  select inspection.* into v_inspection from public.inspections inspection where inspection.id = p_inspection_id for update;
  if not found or not app_private.has_project_permission(v_inspection.project_id, 'inspections.manage') then
    raise exception 'Inspection not found or not editable' using errcode = '42501';
  end if;
  select count(*) into v_missing from public.checklist_items item
    where item.template_id = v_inspection.template_id and item.required
      and not exists (select 1 from public.inspection_responses response where response.inspection_id = v_inspection.id and response.checklist_item_id = item.id);
  if v_missing > 0 then raise exception '% required inspection answers are missing', v_missing using errcode = '23514'; end if;
  select count(*) into v_failed from public.inspection_responses response
    where response.inspection_id = v_inspection.id and response.is_nonconforming;

  for v_response in
    select response.*, item.prompt, item.failure_severity
    from public.inspection_responses response
    join public.checklist_items item on item.id = response.checklist_item_id
    where response.inspection_id = v_inspection.id and response.is_nonconforming
      and not exists (select 1 from public.findings finding where finding.inspection_response_id = response.id)
  loop
    perform public.create_project_finding(
      v_inspection.project_id, v_inspection.building_id, v_inspection.day_report_id,
      v_inspection.id, v_response.id, 'deficiency',
      'Afgekeurd controlepunt: ' || left(v_response.prompt, 180),
      coalesce(v_response.notes, v_response.prompt), v_response.failure_severity,
      null, null, 'inspection-finding:' || v_response.id::text
    );
  end loop;

  update public.inspections set
    status = case when v_failed > 0 then 'failed' else 'passed' end,
    completed_at = now(), executed_by = coalesce(executed_by, v_actor)
  where id = v_inspection.id returning * into v_inspection;
  return v_inspection;
end;
$$;

create or replace function public.create_project_hse_event(
  p_project_id uuid,
  p_building_id uuid,
  p_day_report_id uuid,
  p_event_type text,
  p_title text,
  p_description text,
  p_severity text,
  p_immediate_measure text,
  p_confidential boolean,
  p_occurred_at timestamptz,
  p_idempotency_key text
)
returns public.hse_events
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_event public.hse_events;
  v_year integer;
  v_sequence integer;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'hse.manage') then
    raise exception 'Missing hse.manage permission' using errcode = '42501';
  end if;
  select event.* into v_event from public.hse_events event
    where event.project_id = p_project_id and event.created_by = v_actor and event.idempotency_key = p_idempotency_key;
  if found then return v_event; end if;
  if p_event_type not in ('positive_observation','unsafe_act','unsafe_condition','near_miss','incident','stop_work','toolbox')
    or p_severity not in ('low','medium','high','critical') then
    raise exception 'Invalid HSE classification' using errcode = '22023';
  end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':hse', 0));
  v_year := extract(year from (now() at time zone v_project.timezone))::integer;
  select coalesce(max(substring(event.event_number from '([0-9]+)$')::integer), 0) + 1 into v_sequence
    from public.hse_events event where event.project_id = p_project_id and event.event_number ~ ('^HSE-' || v_year || '-[0-9]+$');
  insert into public.hse_events (
    organization_id, project_id, building_id, day_report_id, event_number,
    event_type, title, description, severity, immediate_measure, confidential,
    occurred_at, status, idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id, p_day_report_id,
    'HSE-' || v_year || '-' || lpad(v_sequence::text, 4, '0'), p_event_type,
    trim(p_title), trim(p_description), p_severity, nullif(trim(p_immediate_measure), ''),
    p_confidential, p_occurred_at, case when p_severity in ('high','critical') then 'action_required' else 'open' end,
    p_idempotency_key, v_actor
  ) returning * into v_event;
  if p_severity = 'critical' or p_event_type in ('incident','stop_work') then
    insert into public.notifications (
      organization_id, project_id, recipient_user_id, notification_type,
      title, body, source_type, source_id
    )
    select distinct v_event.organization_id, v_event.project_id, membership.user_id,
      'hse_critical', 'Urgente HSE-melding ' || v_event.event_number,
      v_event.title, 'hse', v_event.id
    from public.project_memberships membership
    join public.project_member_roles member_role on member_role.membership_id = membership.id
    join public.role_permissions permission on permission.role_id = member_role.role_id
    where membership.project_id = v_event.project_id and membership.status = 'active'
      and permission.permission_code = 'hse.manage';
  end if;
  return v_event;
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
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'records.create') then
    raise exception 'Missing records.create permission' using errcode = '42501';
  end if;
  select entry.* into v_entry from public.project_register_entries entry
    where entry.project_id = p_project_id and entry.created_by = v_actor and entry.idempotency_key = p_idempotency_key;
  if found then return v_entry; end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  v_prefix := upper(left(replace(p_register_type, '_', ''), 4));
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':register:' || p_register_type, 0));
  select count(*) + 1 into v_sequence from public.project_register_entries entry
    where entry.project_id = p_project_id and entry.register_type = p_register_type;
  insert into public.project_register_entries (
    organization_id, project_id, building_id, day_report_id, register_type,
    entry_number, title, occurred_at, due_at, responsible_party_id, details,
    idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id, p_day_report_id,
    p_register_type, v_prefix || '-' || lpad(v_sequence::text, 4, '0'), trim(p_title),
    p_occurred_at, p_due_at, p_responsible_party_id, coalesce(p_details, '{}'::jsonb),
    p_idempotency_key, v_actor
  ) returning * into v_entry;
  return v_entry;
end;
$$;

create or replace function public.build_day_report_snapshot(p_day_report_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare v_report public.day_reports;
begin
  select report.* into v_report from public.day_reports report where report.id = p_day_report_id;
  if not found then raise exception 'Day report not found or not accessible' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'schema_version', '202607180008',
    'frozen_at', now(),
    'report', to_jsonb(v_report),
    'project', (select to_jsonb(project) from public.projects project where project.id = v_report.project_id),
    'start_check', (select to_jsonb(start_check) from public.day_start_checks start_check where start_check.day_report_id = v_report.id),
    'closeout', (select to_jsonb(closeout) from public.day_closeouts closeout where closeout.day_report_id = v_report.id),
    'attendance', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.attendance_entries entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'registrations', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.site_registrations entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.inspections entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.findings entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'hse_events', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.hse_events entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'register_entries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.project_register_entries entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'open_actions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.due_at nulls last) from public.actions entry where entry.project_id = v_report.project_id and entry.status not in ('verified','cancelled')), '[]'::jsonb),
    'file_manifest', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.files entry where entry.project_id = v_report.project_id and entry.status <> 'deleted'), '[]'::jsonb)
  );
end;
$$;

create or replace function public.review_day_report(
  p_day_report_id uuid,
  p_decision text,
  p_comment text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_report public.day_reports;
  v_snapshot jsonb;
  v_sha256 text;
  v_version public.report_versions;
begin
  if p_decision not in ('approved','returned') or char_length(trim(p_comment)) < 2 then
    raise exception 'A valid review decision and comment are required' using errcode = '22023';
  end if;
  select report.* into v_report from public.day_reports report where report.id = p_day_report_id for update;
  if not found or not app_private.has_project_permission(v_report.project_id, 'reports.review') then
    raise exception 'Report not found or missing review permission' using errcode = '42501';
  end if;
  if v_report.status = 'ready_for_review' and p_decision = 'approved' then
    update public.day_reports set status = 'in_review' where id = v_report.id returning * into v_report;
  end if;
  if p_decision = 'approved' then
    if v_report.status <> 'in_review' then raise exception 'Report must be in review before approval' using errcode = '23514'; end if;
    if not app_private.has_project_permission(v_report.project_id, 'reports.freeze') then
      raise exception 'Missing reports.freeze permission' using errcode = '42501';
    end if;
    v_snapshot := public.build_day_report_snapshot(v_report.id);
    v_sha256 := encode(extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');
    v_version := public.freeze_report_version(
      v_report.id, 'daily-report-v1', v_snapshot, v_sha256, null,
      left('review:' || p_idempotency_key, 200)
    );
    update public.day_reports set status = 'approved' where id = v_report.id returning * into v_report;
  else
    if v_report.status not in ('ready_for_review','in_review') then
      raise exception 'Report cannot be returned from status %', v_report.status using errcode = '23514';
    end if;
    update public.day_reports set status = 'returned', completeness_percent = least(completeness_percent, 90)
      where id = v_report.id returning * into v_report;
  end if;
  insert into public.report_reviews (
    organization_id, project_id, day_report_id, report_version_id,
    decision, comment, created_by
  ) values (
    v_report.organization_id, v_report.project_id, v_report.id,
    case when p_decision = 'approved' then v_version.id else null end,
    p_decision, trim(p_comment), v_actor
  );
  return jsonb_build_object('report', to_jsonb(v_report), 'version', to_jsonb(v_version));
end;
$$;

create or replace function public.sign_report_version(
  p_day_report_id uuid,
  p_signer_role text,
  p_signer_name text,
  p_declaration text,
  p_legal_level text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_report public.day_reports;
  v_version public.report_versions;
  v_signature public.report_signatures;
  v_required integer;
  v_signed integer;
begin
  select report.* into v_report from public.day_reports report where report.id = p_day_report_id for update;
  if not found or v_report.status not in ('approved','signed')
    or not app_private.has_project_permission(v_report.project_id, 'reports.sign') then
    raise exception 'Report is not available for signing' using errcode = '42501';
  end if;
  if not app_private.has_organization_permission(v_report.organization_id, 'organization.manage') and not exists (
    select 1 from public.project_memberships membership
    join public.project_member_roles member_role on member_role.membership_id = membership.id
    join public.roles role on role.id = member_role.role_id
    where membership.project_id = v_report.project_id and membership.user_id = v_actor
      and membership.status = 'active' and role.code = p_signer_role
  ) then
    raise exception 'Signer role does not match the authenticated project role' using errcode = '42501';
  end if;
  select version.* into v_version from public.report_versions version
    where version.day_report_id = v_report.id order by version.revision desc limit 1;
  if not found then raise exception 'Frozen report version is required' using errcode = '23514'; end if;
  insert into public.report_signatures (
    organization_id, project_id, day_report_id, report_version_id,
    signer_user_id, signer_name, signer_role, declaration, legal_level,
    created_by
  ) values (
    v_report.organization_id, v_report.project_id, v_report.id, v_version.id,
    v_actor, trim(p_signer_name), p_signer_role, trim(p_declaration),
    p_legal_level, v_actor
  ) on conflict (report_version_id, signer_user_id, signer_role) do nothing
  returning * into v_signature;
  select count(*) into v_required
  from public.project_settings settings,
    jsonb_array_elements(settings.signing_workflow) rule
  where settings.project_id = v_report.project_id and coalesce((rule ->> 'required')::boolean, false);
  select count(distinct rule ->> 'role') into v_signed
  from public.project_settings settings,
    jsonb_array_elements(settings.signing_workflow) rule
  where settings.project_id = v_report.project_id and coalesce((rule ->> 'required')::boolean, false)
    and exists (select 1 from public.report_signatures signature where signature.report_version_id = v_version.id and signature.signer_role = rule ->> 'role');
  if v_required > 0 and v_signed = v_required and v_report.status = 'approved' then
    update public.day_reports set status = 'signed' where id = v_report.id returning * into v_report;
  end if;
  return jsonb_build_object('report', to_jsonb(v_report), 'version', to_jsonb(v_version), 'signature', to_jsonb(v_signature), 'required', v_required, 'signed', v_signed);
end;
$$;

create or replace function public.record_report_distribution(
  p_day_report_id uuid,
  p_recipient_name text,
  p_recipient_address text,
  p_channel text,
  p_delivery_confirmed boolean
)
returns public.report_distributions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_report public.day_reports;
  v_version public.report_versions;
  v_distribution public.report_distributions;
begin
  select report.* into v_report from public.day_reports report where report.id = p_day_report_id for update;
  if not found or v_report.status not in ('signed','sent')
    or not app_private.has_project_permission(v_report.project_id, 'reports.distribute') then
    raise exception 'Signed report or distribution permission missing' using errcode = '42501';
  end if;
  select version.* into v_version from public.report_versions version
    where version.day_report_id = v_report.id order by version.revision desc limit 1;
  insert into public.report_distributions (
    organization_id, project_id, day_report_id, report_version_id,
    recipient_name, recipient_address, channel, status, sent_at, created_by
  ) values (
    v_report.organization_id, v_report.project_id, v_report.id, v_version.id,
    trim(p_recipient_name), trim(p_recipient_address), p_channel,
    case when p_delivery_confirmed then 'delivered' else 'sent' end, now(), v_actor
  ) returning * into v_distribution;
  if v_report.status = 'signed' then update public.day_reports set status = 'sent' where id = v_report.id; end if;
  return v_distribution;
end;
$$;

create or replace function public.start_report_revision(p_day_report_id uuid, p_reason text)
returns public.day_reports
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare v_report public.day_reports;
begin
  if char_length(trim(p_reason)) < 5 then raise exception 'Revision reason is required' using errcode = '22023'; end if;
  select report.* into v_report from public.day_reports report where report.id = p_day_report_id for update;
  if not found or v_report.status not in ('approved','signed','sent')
    or not app_private.has_project_permission(v_report.project_id, 'reports.review') then
    raise exception 'Report cannot be revised' using errcode = '42501';
  end if;
  update public.day_reports set status = 'revised' where id = v_report.id returning * into v_report;
  insert into public.report_reviews (organization_id, project_id, day_report_id, decision, comment, created_by)
    values (v_report.organization_id, v_report.project_id, v_report.id, 'returned', 'Revisie gestart: ' || trim(p_reason), (select auth.uid()));
  update public.day_reports set status = 'in_progress', completeness_percent = least(completeness_percent, 90)
    where id = v_report.id returning * into v_report;
  return v_report;
end;
$$;

create or replace function public.create_manual_backup_export(
  p_organization_id uuid,
  p_project_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_run public.backup_runs;
  v_data jsonb;
  v_counts jsonb;
begin
  if v_actor is null or not app_private.has_organization_permission(p_organization_id, 'backup.manage') then
    raise exception 'Missing backup.manage permission' using errcode = '42501';
  end if;
  select run.* into v_run from public.backup_runs run
    where run.organization_id = p_organization_id and run.idempotency_key = p_idempotency_key;
  if not found then
    insert into public.backup_runs (organization_id, project_id, run_type, status, idempotency_key, created_by)
      values (p_organization_id, p_project_id, 'manual', 'exporting', p_idempotency_key, v_actor)
      returning * into v_run;
  end if;
  v_data := jsonb_build_object(
    'organization', (select to_jsonb(entry) from public.organizations entry where entry.id = p_organization_id),
    'projects', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.projects entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.id = p_project_id)), '[]'::jsonb),
    'buildings', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.buildings entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'parties', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.parties entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'day_reports', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.day_reports entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'attendance_entries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.attendance_entries entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'site_registrations', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.site_registrations entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.actions entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'action_updates', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.action_updates entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'report_versions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.report_versions entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.inspections entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'inspection_responses', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.inspection_responses entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.findings entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'finding_updates', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.finding_updates entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'hse_events', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.hse_events entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'project_register_entries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.project_register_entries entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.files entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'file_links', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.file_links entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'report_reviews', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.report_reviews entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'report_signatures', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.report_signatures entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'report_distributions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.report_distributions entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb),
    'audit_events', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.id) from public.audit_events entry where entry.organization_id = p_organization_id and (p_project_id is null or entry.project_id = p_project_id)), '[]'::jsonb)
  );
  select jsonb_object_agg(key, jsonb_array_length(value)) into v_counts
    from jsonb_each(v_data) where jsonb_typeof(value) = 'array';
  update public.backup_runs set record_counts = v_counts where id = v_run.id returning * into v_run;
  return jsonb_build_object(
    'schema_version', '202607180008', 'application', 'CODECO Supervisie',
    'created_at', now(), 'organization_id', p_organization_id,
    'project_id', p_project_id, 'backup_run_id', v_run.id,
    'record_counts', v_counts, 'data', v_data,
    'file_manifest_note', 'Bestandsbytes staan uitsluitend in private Google Drive; deze export bevat alleen het manifest.'
  );
end;
$$;

create or replace function public.verify_manual_backup_export(
  p_backup_run_id uuid,
  p_sha256 text,
  p_size_bytes bigint
)
returns public.backup_runs
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare v_run public.backup_runs;
begin
  select run.* into v_run from public.backup_runs run where run.id = p_backup_run_id for update;
  if not found or not app_private.has_organization_permission(v_run.organization_id, 'backup.manage') then
    raise exception 'Backup run not found or not manageable' using errcode = '42501';
  end if;
  if p_sha256 !~ '^[a-f0-9]{64}$' or p_size_bytes <= 0 then
    raise exception 'Valid SHA-256 and file size are required' using errcode = '22023';
  end if;
  update public.backup_runs set status = 'verified', sha256 = p_sha256,
    size_bytes = p_size_bytes, verified_at = now()
  where id = v_run.id returning * into v_run;
  return v_run;
end;
$$;

create or replace function public.dry_run_backup_restore(p_manifest jsonb)
returns public.backup_runs
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid;
  v_run public.backup_runs;
begin
  if jsonb_typeof(p_manifest) <> 'object' or p_manifest ->> 'schema_version' <> '202607180008'
    or jsonb_typeof(p_manifest -> 'data') <> 'object' then
    raise exception 'Unsupported or incomplete backup manifest' using errcode = '22023';
  end if;
  v_organization_id := (p_manifest ->> 'organization_id')::uuid;
  if not app_private.has_organization_permission(v_organization_id, 'backup.manage') then
    raise exception 'Missing backup.manage permission' using errcode = '42501';
  end if;
  if p_manifest -> 'data' -> 'organization' ->> 'id' <> v_organization_id::text then
    raise exception 'Backup organization does not match manifest' using errcode = '23514';
  end if;
  insert into public.backup_runs (
    organization_id, project_id, run_type, status, idempotency_key,
    record_counts, created_by, verified_at
  ) values (
    v_organization_id, nullif(p_manifest ->> 'project_id', '')::uuid,
    'restore_test', 'dry_run_passed', 'dry-run:' || gen_random_uuid()::text,
    p_manifest -> 'record_counts', v_actor, now()
  ) returning * into v_run;
  return v_run;
end;
$$;

revoke all on function public.create_project_finding(uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text) from public, anon;
revoke all on function public.transition_project_finding(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.start_project_inspection(uuid,uuid,uuid,uuid,text,text) from public, anon;
revoke all on function public.save_inspection_response(uuid,uuid,text,numeric,text,text,text) from public, anon;
revoke all on function public.complete_project_inspection(uuid) from public, anon;
revoke all on function public.create_project_hse_event(uuid,uuid,uuid,text,text,text,text,text,boolean,timestamptz,text) from public, anon;
revoke all on function public.create_project_register_entry(uuid,uuid,uuid,text,text,timestamptz,timestamptz,uuid,jsonb,text) from public, anon;
revoke all on function public.build_day_report_snapshot(uuid) from public, anon;
revoke all on function public.review_day_report(uuid,text,text,text) from public, anon;
revoke all on function public.sign_report_version(uuid,text,text,text,text) from public, anon;
revoke all on function public.record_report_distribution(uuid,text,text,text,boolean) from public, anon;
revoke all on function public.start_report_revision(uuid,text) from public, anon;
revoke all on function public.create_manual_backup_export(uuid,uuid,text) from public, anon;
revoke all on function public.verify_manual_backup_export(uuid,text,bigint) from public, anon;
revoke all on function public.dry_run_backup_restore(jsonb) from public, anon;

grant execute on function public.create_project_finding(uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text) to authenticated;
grant execute on function public.transition_project_finding(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.start_project_inspection(uuid,uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.save_inspection_response(uuid,uuid,text,numeric,text,text,text) to authenticated;
grant execute on function public.complete_project_inspection(uuid) to authenticated;
grant execute on function public.create_project_hse_event(uuid,uuid,uuid,text,text,text,text,text,boolean,timestamptz,text) to authenticated;
grant execute on function public.create_project_register_entry(uuid,uuid,uuid,text,text,timestamptz,timestamptz,uuid,jsonb,text) to authenticated;
grant execute on function public.build_day_report_snapshot(uuid) to authenticated;
grant execute on function public.review_day_report(uuid,text,text,text) to authenticated;
grant execute on function public.sign_report_version(uuid,text,text,text,text) to authenticated;
grant execute on function public.record_report_distribution(uuid,text,text,text,boolean) to authenticated;
grant execute on function public.start_report_revision(uuid,text) to authenticated;
grant execute on function public.create_manual_backup_export(uuid,uuid,text) to authenticated;
grant execute on function public.verify_manual_backup_export(uuid,text,bigint) to authenticated;
grant execute on function public.dry_run_backup_restore(jsonb) to authenticated;

commit;
