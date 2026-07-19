begin;

alter table public.backup_runs alter column created_by drop not null;
alter table public.backup_runs drop constraint backup_runs_status_check;
alter table public.backup_runs add constraint backup_runs_status_check
  check (status in ('queued','exporting','uploading','verified','failed','rotated','dry_run_passed','restored'));
alter table public.backup_runs add column retention_tier text;
alter table public.backup_runs add constraint backup_runs_retention_tier_check
  check (retention_tier is null or retention_tier in ('daily','weekly','monthly'));

comment on column public.backup_runs.created_by is
  'Null for authenticated scheduled system jobs; a user id is required for interactive jobs.';
comment on column public.backup_runs.retention_tier is
  'Current grandfather-father-son retention tier for a verified scheduled backup.';

create or replace function app_private.build_organization_backup_manifest(
  p_organization_id uuid,
  p_project_id uuid,
  p_backup_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, information_schema
as $$
declare
  v_data jsonb := '{}'::jsonb;
  v_counts jsonb;
  v_rows jsonb;
  v_table text;
  v_has_organization_id boolean;
  v_has_project_id boolean;
begin
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects
    where id = p_project_id and organization_id = p_organization_id
  ) then
    raise exception 'Project does not belong to organization' using errcode = '23503';
  end if;

  for v_table in
    select tables.table_name
    from information_schema.tables
    where tables.table_schema = 'public'
      and tables.table_type = 'BASE TABLE'
    order by tables.table_name
  loop
    if v_table = 'organizations' then
      select coalesce(jsonb_agg(to_jsonb(entry) order by entry.id), '[]'::jsonb)
      into v_rows
      from public.organizations entry
      where entry.id = p_organization_id;
    elsif v_table = 'profiles' then
      select coalesce(jsonb_agg(to_jsonb(entry) order by entry.id), '[]'::jsonb)
      into v_rows
      from public.profiles entry
      where entry.id in (
        select membership.user_id
        from public.organization_memberships membership
        where membership.organization_id = p_organization_id
      );
    elsif v_table = 'permissions' then
      select coalesce(jsonb_agg(to_jsonb(entry) order by entry.code), '[]'::jsonb)
      into v_rows
      from public.permissions entry;
    elsif v_table = 'projects' then
      select coalesce(jsonb_agg(to_jsonb(entry) order by entry.id), '[]'::jsonb)
      into v_rows
      from public.projects entry
      where entry.organization_id = p_organization_id
        and (p_project_id is null or entry.id = p_project_id);
    else
      select exists (
        select 1 from information_schema.columns
        where columns.table_schema = 'public'
          and columns.table_name = v_table
          and columns.column_name = 'organization_id'
      ) into v_has_organization_id;
      if not v_has_organization_id then
        continue;
      end if;

      select exists (
        select 1 from information_schema.columns
        where columns.table_schema = 'public'
          and columns.table_name = v_table
          and columns.column_name = 'project_id'
      ) into v_has_project_id;

      if v_has_project_id and p_project_id is not null then
        execute format(
          'select coalesce(jsonb_agg(to_jsonb(entry) order by to_jsonb(entry)->>''id''), ''[]''::jsonb) from public.%I entry where entry.organization_id = $1 and entry.project_id = $2',
          v_table
        ) into v_rows using p_organization_id, p_project_id;
      else
        execute format(
          'select coalesce(jsonb_agg(to_jsonb(entry) order by to_jsonb(entry)->>''id''), ''[]''::jsonb) from public.%I entry where entry.organization_id = $1',
          v_table
        ) into v_rows using p_organization_id;
      end if;
    end if;

    v_data := v_data || jsonb_build_object(v_table, coalesce(v_rows, '[]'::jsonb));
  end loop;

  select jsonb_object_agg(entry.key, jsonb_array_length(entry.value))
  into v_counts
  from jsonb_each(v_data) entry;

  return jsonb_build_object(
    'schema_version', '202607190003',
    'application', 'CODECO Supervisie',
    'created_at', now(),
    'timezone', 'America/Paramaribo',
    'organization_id', p_organization_id,
    'project_id', p_project_id,
    'backup_run_id', p_backup_run_id,
    'record_counts', v_counts,
    'data', v_data,
    'file_manifest_note', 'Bestandsbytes staan uitsluitend in private Vercel Blob; de files-tabel bevat het controleerbare manifest.'
  );
end;
$$;

create or replace function public.build_scheduled_backup_export(
  p_organization_id uuid,
  p_backup_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_manifest jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Scheduled backup export requires the service role' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.backup_runs
    where id = p_backup_run_id
      and organization_id = p_organization_id
      and run_type = 'scheduled'
  ) then
    raise exception 'Scheduled backup run not found' using errcode = 'P0002';
  end if;

  v_manifest := app_private.build_organization_backup_manifest(
    p_organization_id,
    null,
    p_backup_run_id
  );
  update public.backup_runs
  set schema_version = v_manifest ->> 'schema_version',
      record_counts = v_manifest -> 'record_counts'
  where id = p_backup_run_id;
  return v_manifest;
end;
$$;

create or replace function public.create_manual_backup_export(
  p_organization_id uuid,
  p_project_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_run public.backup_runs;
  v_manifest jsonb;
begin
  if v_actor is null or not app_private.has_organization_permission(p_organization_id, 'backup.manage') then
    raise exception 'Missing backup.manage permission' using errcode = '42501';
  end if;
  select run.* into v_run
  from public.backup_runs run
  where run.organization_id = p_organization_id
    and run.idempotency_key = p_idempotency_key;
  if not found then
    insert into public.backup_runs (
      organization_id, project_id, run_type, status, idempotency_key, created_by,
      schema_version
    ) values (
      p_organization_id, p_project_id, 'manual', 'exporting', p_idempotency_key,
      v_actor, '202607190003'
    ) returning * into v_run;
  end if;

  v_manifest := app_private.build_organization_backup_manifest(
    p_organization_id,
    p_project_id,
    v_run.id
  );
  update public.backup_runs
  set schema_version = v_manifest ->> 'schema_version',
      record_counts = v_manifest -> 'record_counts'
  where id = v_run.id;
  return v_manifest;
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
  v_schema_version text := p_manifest ->> 'schema_version';
  v_manifest_organization_id text;
begin
  if jsonb_typeof(p_manifest) <> 'object'
    or v_schema_version not in ('202607180008','202607190003')
    or jsonb_typeof(p_manifest -> 'data') <> 'object' then
    raise exception 'Unsupported or incomplete backup manifest' using errcode = '22023';
  end if;
  v_organization_id := (p_manifest ->> 'organization_id')::uuid;
  if not app_private.has_organization_permission(v_organization_id, 'backup.manage') then
    raise exception 'Missing backup.manage permission' using errcode = '42501';
  end if;
  v_manifest_organization_id := case
    when v_schema_version = '202607190003'
      then p_manifest -> 'data' -> 'organizations' -> 0 ->> 'id'
    else p_manifest -> 'data' -> 'organization' ->> 'id'
  end;
  if v_manifest_organization_id <> v_organization_id::text then
    raise exception 'Backup organization does not match manifest' using errcode = '23514';
  end if;
  insert into public.backup_runs (
    organization_id, project_id, run_type, status, idempotency_key,
    record_counts, created_by, verified_at, schema_version
  ) values (
    v_organization_id, nullif(p_manifest ->> 'project_id', '')::uuid,
    'restore_test', 'dry_run_passed', 'dry-run:' || gen_random_uuid()::text,
    p_manifest -> 'record_counts', v_actor, now(), v_schema_version
  ) returning * into v_run;
  return v_run;
end;
$$;

create or replace function public.refresh_all_project_notifications()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
  v_rows integer := 0;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Notification schedule requires the service role' using errcode = '42501';
  end if;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, due_at, dedupe_key
  )
  select action.organization_id, action.project_id, action.owner_user_id,
    case when action.due_at < now() then 'action_overdue' else 'action_due' end,
    case when action.due_at < now() then 'Actie verlopen: ' else 'Actie nadert deadline: ' end || action.action_number,
    action.title, 'action', action.id, action.due_at,
    'action:' || action.id::text || ':' || case when action.due_at < now() then 'overdue' else 'due' end
  from public.actions action
  join public.projects project on project.id = action.project_id and project.status in ('draft','active','on_hold')
  where action.owner_user_id is not null
    and action.status not in ('verified','cancelled')
    and action.due_at <= now() + interval '24 hours'
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, due_at, dedupe_key
  )
  select finding.organization_id, finding.project_id, finding.assigned_user_id,
    'finding_due', 'Bevinding nadert deadline: ' || finding.finding_number,
    finding.title, 'finding', finding.id, finding.due_at,
    'finding:' || finding.id::text || ':due'
  from public.findings finding
  join public.projects project on project.id = finding.project_id and project.status in ('draft','active','on_hold')
  where finding.assigned_user_id is not null
    and finding.status not in ('closed','cancelled','rejected')
    and finding.due_at <= now() + interval '24 hours'
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, dedupe_key
  )
  select distinct report.organization_id, report.project_id, membership.user_id,
    'review_requested', 'Dagrapport wacht op review', report.report_number,
    'report', report.id, 'report:' || report.id::text || ':review'
  from public.day_reports report
  join public.projects project on project.id = report.project_id and project.status in ('draft','active','on_hold')
  join public.project_memberships membership on membership.project_id = report.project_id and membership.status = 'active'
  join public.project_member_roles member_role on member_role.membership_id = membership.id
  join public.role_permissions permission on permission.role_id = member_role.role_id and permission.permission_code = 'reports.review'
  where report.status in ('ready_for_review','in_review')
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count;
  return v_count + v_rows;
end;
$$;

create or replace function public.record_scheduled_backup_failure(
  p_organization_id uuid,
  p_error_summary text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Backup failure notification requires the service role' using errcode = '42501';
  end if;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, dedupe_key
  )
  select distinct membership.organization_id, notification_project.id, membership.user_id,
    'backup_failed', 'Automatische back-up mislukt',
    left(coalesce(nullif(trim(p_error_summary), ''), 'Controleer de dagelijkse back-up in Beheer.'), 1000),
    'organization', p_organization_id,
    'backup:' || p_organization_id::text || ':' || current_date::text
  from public.organization_memberships membership
  join public.organization_member_roles member_role on member_role.membership_id = membership.id
  join public.role_permissions permission on permission.role_id = member_role.role_id
    and permission.permission_code = 'backup.manage'
  join lateral (
    select project.id
    from public.projects project
    where project.organization_id = membership.organization_id
      and project.status in ('draft','active','on_hold')
    order by project.created_at
    limit 1
  ) notification_project on true
  where membership.organization_id = p_organization_id and membership.status = 'active'
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function app_private.build_organization_backup_manifest(uuid,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.build_scheduled_backup_export(uuid,uuid) from public, anon, authenticated;
grant execute on function public.build_scheduled_backup_export(uuid,uuid) to service_role;
revoke all on function public.create_manual_backup_export(uuid,uuid,text) from public, anon;
grant execute on function public.create_manual_backup_export(uuid,uuid,text) to authenticated;
revoke all on function public.dry_run_backup_restore(jsonb) from public, anon;
grant execute on function public.dry_run_backup_restore(jsonb) to authenticated;
revoke all on function public.refresh_all_project_notifications() from public, anon, authenticated;
grant execute on function public.refresh_all_project_notifications() to service_role;
revoke all on function public.record_scheduled_backup_failure(uuid,text) from public, anon, authenticated;
grant execute on function public.record_scheduled_backup_failure(uuid,text) to service_role;
grant select on public.organizations to service_role;
grant select, insert, update on public.backup_runs to service_role;

commit;
