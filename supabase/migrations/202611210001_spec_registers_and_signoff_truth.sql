-- The client's developer specification (workbook FINAL v2), third round of 20/21-11-2026.
-- Closes the gaps left after 202611200001:
--
--  1. list_project_people(): the project's own people, so "action owner", "issued to",
--     "verified by" and the other person fields are chosen from the live register instead of
--     typed (START HERE: "user … selections must come from live app registers").
--  2. One status. The workbook Status (spec.workflow_status) follows the record's own status and
--     the sign-off actions; it is never typed. record_signoff_action() moves both, and a typed
--     change is put back ("Update only from workflow actions; retain prior states in the log").
--  3. Role-restricted decisions. Approved/Rejected (change order), Approved for Sharing (lesson),
--     Inspected - Accepted/Rejected (works completed), Accepted (delivery), a verification
--     result and Closed are set only by a reviewer; who and when are recorded by the database.
--     An NCR verified as Not Effective / Rework Required reopens its corrective action.
--  4. Sensitive incident data (people involved, witnesses, injury, body part) leaves the HSE
--     record for hse_event_sensitive, readable with hse.manage only, and never enters a frozen
--     sign-off copy.
--  5. A submitted record that is edited afterwards gets a "Reopened" event: the approvals are
--     required again (Sign-off sheet: "create a new version and require the relevant approvals").
--  6. Sign-off: a signed document as evidence, the next actor must be on the project, the
--     project's own workflow settings (stages, required approvals, approvers, delegation, due
--     days, approval limit), notifications after approval, rejection and return, and overdue
--     reminders with escalation in refresh_project_notifications().
--  7. project_settings.spec_configuration: workflow settings, project lists and the HSE risk
--     matrix, edited in Management · Project rules.
--  8. list_shared_lessons(): lessons approved for sharing, across the organisation's projects.
--
-- Additive only. Rollback: drop the new triggers, functions, table and column, restore
-- record_signoff_action from 202611200002, refresh_project_notifications from
-- 202607180012 and validate_finding_transition from 202610060002; then move the rows of
-- hse_event_sensitive back into hse_events.spec.

begin;

-- 7. Project configuration of the specification -----------------------------------------
alter table public.project_settings
  add column if not exists spec_configuration jsonb not null default '{}'::jsonb;
alter table public.project_settings drop constraint if exists project_settings_spec_configuration_object;
alter table public.project_settings add constraint project_settings_spec_configuration_object
  check (jsonb_typeof(spec_configuration) = 'object' and pg_column_size(spec_configuration) <= 262144);
comment on column public.project_settings.spec_configuration is
  'Project-configurable parts of the client specification: workflows (per profile: stages with required approvals, approvers, due days; approval limit; delegations), lists (added/retired values per list) and risk_matrix.';

create or replace function app_private.spec_configuration(p_project_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((select settings.spec_configuration from public.project_settings settings where settings.project_id = p_project_id), '{}'::jsonb);
$$;

-- 1. The project's people ---------------------------------------------------------------
create or replace function public.list_project_people(p_project_id uuid)
returns table (user_id uuid, display_name text, role_name text, company_staff boolean)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  with members as (
    select membership.user_id, string_agg(distinct role.name, ', ') as role_name, false as company_staff
    from public.project_memberships membership
    left join public.project_member_roles member_role on member_role.membership_id = membership.id
    left join public.roles role on role.id = member_role.role_id
    where membership.project_id = p_project_id and membership.status = 'active'
    group by membership.user_id
    union all
    select membership.user_id, string_agg(distinct role.name, ', '), true
    from public.projects project
    join public.organization_memberships membership on membership.organization_id = project.organization_id and membership.status = 'active'
    join public.organization_member_roles member_role on member_role.membership_id = membership.id
    join public.roles role on role.id = member_role.role_id
    where project.id = p_project_id
    group by membership.user_id
  )
  select member.user_id,
    coalesce(nullif(btrim(profile.display_name), ''), 'User') as display_name,
    string_agg(distinct member.role_name, ', ') as role_name,
    bool_or(member.company_staff) as company_staff
  from members member
  left join public.profiles profile on profile.id = member.user_id
  where (select auth.uid()) is not null and app_private.can_access_project(p_project_id)
  group by member.user_id, profile.display_name
  order by 2;
$$;

revoke all on function public.list_project_people(uuid) from public, anon;
grant execute on function public.list_project_people(uuid) to authenticated;

-- 2/3. One status and role-restricted decisions ------------------------------------------
create or replace function app_private.spec_status_from_record(p_kind text, p_status text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'finding' then case p_status
      when 'draft' then 'Open' when 'open' then 'Open' when 'assigned' then 'Assigned' when 'accepted' then 'Assigned'
      when 'in_progress' then 'In Progress' when 'reopened' then 'In Progress' when 'rejected' then 'In Progress'
      when 'ready_for_verification' then 'Pending Verification' when 'verified' then 'Closed' when 'closed' then 'Closed'
      when 'cancelled' then 'Cancelled' end
    when 'hse_event' then case p_status
      when 'open' then 'Open' when 'action_required' then 'Assigned' when 'investigating' then 'In Progress'
      when 'closed' then 'Closed' when 'cancelled' then 'Cancelled' end
    when 'register_entry' then case p_status
      when 'draft' then 'Open' when 'open' then 'Open' when 'in_review' then 'In Progress' when 'approved' then 'Closed'
      when 'rejected' then 'In Progress' when 'closed' then 'Closed' when 'cancelled' then 'Cancelled' end
    when 'inspection' then case p_status
      when 'planned' then 'Open' when 'in_progress' then 'In Progress' when 'ready_for_reinspection' then 'In Progress'
      when 'passed' then 'Closed' when 'failed' then 'In Progress' when 'cancelled' then 'Cancelled' end
  end;
$$;

create or replace function app_private.spec_path(p_table text)
returns text[]
language sql
immutable
as $$
  select case p_table
    when 'findings' then array['issue_management', 'spec']
    when 'project_register_entries' then array['details', 'spec']
    else array['spec']
  end;
$$;

create or replace function app_private.spec_kind(p_table text)
returns text
language sql
immutable
as $$
  select case p_table
    when 'findings' then 'finding' when 'hse_events' then 'hse_event'
    when 'project_register_entries' then 'register_entry' when 'inspections' then 'inspection'
  end;
$$;

/** Whether the signed-in user may take the reviewer's decisions on this kind of record. */
create or replace function app_private.spec_authority(p_project_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select app_private.has_project_permission(p_project_id, 'findings.verify')
    or app_private.has_project_permission(p_project_id, 'reports.review')
    or (p_kind = 'hse_event' and app_private.has_project_permission(p_project_id, 'hse.manage'))
    or (p_kind = 'inspection' and app_private.has_project_permission(p_project_id, 'inspections.manage'));
$$;

-- The specification's sensitive incident keys (workbook: "access is restricted").
create or replace function app_private.spec_sensitive_key(p_key text)
returns boolean
language sql
immutable
as $$
  select p_key in ('people_involved', 'people_involved_refs', 'people_involved_other', 'witnesses', 'witnesses_refs', 'witnesses_other')
    or p_key like 'injury\_%' or p_key like 'body\_part%';
$$;

create table if not exists public.hse_event_sensitive (
  event_id uuid primary key references public.hse_events(id) on delete cascade deferrable initially deferred,
  organization_id uuid not null,
  project_id uuid not null,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
comment on table public.hse_event_sensitive is
  'People involved, witnesses, injury and body part of an HSE incident (workbook: restricted). Readable with hse.manage only; written by the HSE record trigger.';
alter table public.hse_event_sensitive enable row level security;
drop policy if exists hse_event_sensitive_read on public.hse_event_sensitive;
create policy hse_event_sensitive_read on public.hse_event_sensitive
  for select to authenticated
  using (app_private.has_project_permission(project_id, 'hse.manage'));
revoke insert, update, delete on public.hse_event_sensitive from authenticated, anon;
grant select on public.hse_event_sensitive to authenticated;

create or replace function app_private.store_hse_sensitive(p_event_id uuid, p_organization_id uuid, p_project_id uuid, p_data jsonb, p_replace boolean)
returns void
language sql
security definer
set search_path = pg_catalog, public, app_private
as $$
  insert into public.hse_event_sensitive as stored (event_id, organization_id, project_id, data, updated_by)
  select p_event_id, p_organization_id, p_project_id, p_data, (select auth.uid())
  where (select auth.uid()) is null or app_private.has_project_permission(p_project_id, 'records.create')
  on conflict (event_id) do update set
    data = case when p_replace or app_private.has_project_permission(stored.project_id, 'hse.manage') then excluded.data else stored.data || excluded.data end,
    updated_by = excluded.updated_by, updated_at = now()
  where stored.project_id = p_project_id;
$$;

create or replace function app_private.guard_record_spec()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
declare
  v_kind text := app_private.spec_kind(tg_table_name);
  v_path text[] := app_private.spec_path(tg_table_name);
  v_row jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_spec jsonb;
  v_old_spec jsonb;
  v_signoff boolean := coalesce(current_setting('app.signoff_write', true), '') = 'on';
  -- Server-side code without a signed-in user (migrations, the service role, the contractor's
  -- share link) is trusted; a signed-in user is checked, also inside a definer RPC.
  v_actor uuid := (select auth.uid());
  v_trusted boolean := v_actor is null;
  v_actor_name text;
  v_today text := to_char((now() at time zone 'America/Paramaribo')::date, 'YYYY-MM-DD');
  v_authority boolean;
  v_rule record;
  v_value text;
  v_sensitive jsonb;
  v_status text := v_row ->> 'status';
  v_old_status text := v_old ->> 'status';
  v_project uuid := (v_row ->> 'project_id')::uuid;
  v_config jsonb;
  v_limit numeric;
  v_amount numeric;
begin
  if jsonb_typeof(v_row #> v_path) is distinct from 'object' and jsonb_typeof(v_old #> v_path) is distinct from 'object' then
    return new;
  end if;
  v_spec := coalesce(case when jsonb_typeof(v_row #> v_path) = 'object' then v_row #> v_path end, '{}'::jsonb);
  v_old_spec := coalesce(case when jsonb_typeof(v_old #> v_path) = 'object' then v_old #> v_path end, '{}'::jsonb);
  select nullif(btrim(profile.display_name), '') into v_actor_name from public.profiles profile where profile.id = v_actor;

  -- 4. Sensitive incident data lives apart from the record.
  if v_kind = 'hse_event' then
    select coalesce(jsonb_object_agg(item.key, item.value), '{}'::jsonb) into v_sensitive
    from jsonb_each(v_spec) item where app_private.spec_sensitive_key(item.key);
    if v_sensitive <> '{}'::jsonb then
      perform app_private.store_hse_sensitive(new.id, (v_row ->> 'organization_id')::uuid, v_project, v_sensitive, v_trusted);
      select coalesce(jsonb_object_agg(item.key, item.value), '{}'::jsonb) into v_spec
      from jsonb_each(v_spec) item where not app_private.spec_sensitive_key(item.key);
    end if;
  end if;

  -- 3. Decisions only a reviewer takes; who and when are recorded here, not typed.
  if not v_signoff and not v_trusted then
    v_authority := app_private.spec_authority(v_project, v_kind);
    for v_rule in
      select * from (values
        ('approval_status', array['Approved', 'Rejected'], 'approved_by', 'approved_on'),
        ('review_status', array['Approved for Sharing'], 'reviewed_by', 'reviewed_on'),
        ('inspection_status', array['Inspected - Accepted', 'Inspected - Rejected'], 'inspected_by', 'inspected_on'),
        ('inspection_result', array['Accepted', 'Accepted with Comments', 'Rejected'], 'accepted_by', 'accepted_on'),
        ('verification_result', null::text[], 'verified_by', 'verified_on')
      ) as rule(key, restricted, by_key, on_key)
    loop
      v_value := v_spec ->> v_rule.key;
      if coalesce(v_value, '') = '' or v_value is not distinct from (v_old_spec ->> v_rule.key) then
        -- Unchanged: the recorded decision maker stays as recorded.
        if v_old_spec ? (v_rule.by_key || '_user_id') and v_value is not distinct from (v_old_spec ->> v_rule.key) then
          v_spec := v_spec
            || jsonb_build_object(v_rule.by_key, v_old_spec -> v_rule.by_key, v_rule.on_key, v_old_spec -> v_rule.on_key,
                 v_rule.by_key || '_user_id', v_old_spec -> (v_rule.by_key || '_user_id'));
        end if;
        continue;
      end if;
      if v_rule.restricted is not null and not (v_value = any (v_rule.restricted)) then
        continue;
      end if;
      if not v_authority then
        raise exception 'Only an authorised reviewer can set % to %', replace(v_rule.key, '_', ' '), v_value using errcode = '42501';
      end if;
      v_spec := v_spec || jsonb_build_object(
        v_rule.by_key, coalesce(v_actor_name, 'User'), v_rule.on_key, v_today,
        v_rule.by_key || '_user_id', v_actor
      );
    end loop;

    -- An approval above the project's limit needs one of the named approvers.
    if v_spec ->> 'approval_status' = 'Approved' and (v_old_spec ->> 'approval_status') is distinct from 'Approved' then
      v_config := app_private.spec_configuration(v_project) #> '{workflows,CHANGE-APPROVAL}';
      v_limit := nullif(v_config ->> 'approval_limit', '')::numeric;
      v_amount := greatest(coalesce(nullif(v_spec ->> 'approved_amount', '')::numeric, 0), coalesce(nullif(v_spec ->> 'cost_impact', '')::numeric, 0));
      if v_limit is not null and v_amount > v_limit
        and not coalesce(v_config -> 'above_limit_user_ids', '[]'::jsonb) ? v_actor::text then
        raise exception 'This change exceeds the approval limit of %; an approver above the limit decides', v_limit using errcode = '42501';
      end if;
    end if;

    -- Closing by hand is a reviewer's decision too.
    if v_spec ->> 'workflow_status' in ('Closed') and (v_old_spec ->> 'workflow_status') is distinct from 'Closed'
      and not v_authority then
      v_spec := jsonb_set(v_spec, '{workflow_status}', coalesce(v_old_spec -> 'workflow_status', '"Open"'::jsonb));
    end if;
  end if;

  -- An NCR verified as not effective reopens its corrective action.
  if v_kind = 'finding' and v_spec ->> 'verification_result' in ('Not Effective', 'Rework Required')
    and (v_spec ->> 'verification_result') is distinct from (v_old_spec ->> 'verification_result') then
    if v_status = 'ready_for_verification' then
      v_status := 'reopened';
      v_row := jsonb_set(v_row, '{status}', to_jsonb(v_status));
    end if;
    v_spec := v_spec || '{"workflow_status": "In Progress", "corrective_action_reopened": "yes"}'::jsonb;
  end if;

  -- 2. The workbook status follows the record and the sign-off actions only.
  if not v_signoff and (v_spec ? 'workflow_status' or v_old_spec ? 'workflow_status') then
    if tg_op = 'INSERT' or v_status is distinct from v_old_status then
      v_spec := jsonb_set(v_spec, '{workflow_status}',
        to_jsonb(coalesce(app_private.spec_status_from_record(v_kind, v_status), v_spec ->> 'workflow_status', 'Open')));
    elsif not (v_spec ->> 'workflow_status' = 'In Progress' and v_spec ? 'corrective_action_reopened' and not v_old_spec ? 'corrective_action_reopened') then
      v_spec := jsonb_set(v_spec, '{workflow_status}',
        coalesce(v_old_spec -> 'workflow_status', to_jsonb(coalesce(app_private.spec_status_from_record(v_kind, v_status), 'Open'))));
    end if;
  end if;

  if v_spec is distinct from (v_row #> v_path) then
    if v_path = array['spec'] then
      v_row := jsonb_set(v_row, v_path, v_spec);
    else
      v_row := jsonb_set(v_row, v_path[1:1], coalesce(case when jsonb_typeof(v_row -> v_path[1]) = 'object' then v_row -> v_path[1] end, '{}'::jsonb) || jsonb_build_object('spec', v_spec));
    end if;
  end if;
  new := jsonb_populate_record(new, v_row);
  return new;
end;
$$;

drop trigger if exists findings_spec_guard on public.findings;
create trigger findings_spec_guard before insert or update on public.findings
  for each row execute function app_private.guard_record_spec();
drop trigger if exists hse_events_spec_guard on public.hse_events;
create trigger hse_events_spec_guard before insert or update on public.hse_events
  for each row execute function app_private.guard_record_spec();
drop trigger if exists project_register_entries_spec_guard on public.project_register_entries;
create trigger project_register_entries_spec_guard before insert or update on public.project_register_entries
  for each row execute function app_private.guard_record_spec();
drop trigger if exists inspections_spec_guard on public.inspections;
create trigger inspections_spec_guard before insert or update on public.inspections
  for each row execute function app_private.guard_record_spec();

-- Sensitive keys already stored move out of the HSE records (one time).
insert into public.hse_event_sensitive (event_id, organization_id, project_id, data)
select event.id, event.organization_id, event.project_id,
  (select jsonb_object_agg(item.key, item.value) from jsonb_each(event.spec) item where app_private.spec_sensitive_key(item.key))
from public.hse_events event
where exists (select 1 from jsonb_each(event.spec) item where app_private.spec_sensitive_key(item.key))
on conflict (event_id) do nothing;
alter table public.hse_events disable trigger user;
update public.hse_events event
set spec = (select coalesce(jsonb_object_agg(item.key, item.value), '{}'::jsonb) from jsonb_each(event.spec) item where not app_private.spec_sensitive_key(item.key))
where exists (select 1 from jsonb_each(event.spec) item where app_private.spec_sensitive_key(item.key));
alter table public.hse_events enable trigger user;

-- A sign-off moves the finding's status; the finding guard lets that through without asking
-- for findings.manage (the sign-off function checked the actor itself).
do $patch$
declare
  v_oid oid;
  v_definition text;
  v_patched text;
begin
  select procedure.oid into v_oid
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'app_private' and procedure.proname = 'validate_finding_transition';
  v_definition := pg_get_functiondef(v_oid);
  if v_definition ~ 'app.signoff_write' then return; end if;
  v_patched := replace(v_definition,
    'if coalesce(new.issue_management, ''{}''::jsonb) is distinct from coalesce(old.issue_management, ''{}''::jsonb)',
    'if coalesce(current_setting(''app.signoff_write'', true), '''') <> ''on''
    and coalesce(new.issue_management, ''{}''::jsonb) is distinct from coalesce(old.issue_management, ''{}''::jsonb)');
  if v_patched = v_definition then
    raise exception 'validate_finding_transition no longer contains the expected issue_management check';
  end if;
  execute v_patched;
end;
$patch$;

-- 5. Edited after submission: the approvals are required again ----------------------------
create or replace function app_private.reopen_signoff_after_edit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_kind text := app_private.spec_kind(tg_table_name);
  v_path text[] := app_private.spec_path(tg_table_name);
  v_last public.record_signoff_events;
  v_actor uuid := (select auth.uid());
  v_name text;
  v_fields text[];
  v_new jsonb;
  v_old jsonb;
begin
  if coalesce(current_setting('app.signoff_write', true), '') = 'on' or v_actor is null then
    return null;
  end if;
  v_fields := case tg_table_name
    when 'findings' then array['title', 'description', 'severity', 'finding_type', 'due_at', 'responsible_party_id']
    when 'hse_events' then array['title', 'description', 'severity', 'event_type', 'issue_type', 'issue_category', 'corrective_action', 'due_at']
    when 'project_register_entries' then array['title', 'due_at']
    else array['title']
  end;
  select jsonb_object_agg(field, to_jsonb(new) -> field), jsonb_object_agg(field, to_jsonb(old) -> field)
    into v_new, v_old from unnest(v_fields) field;
  v_new := v_new || jsonb_build_object('spec', coalesce(to_jsonb(new) #> v_path, '{}'::jsonb) - array['workflow_status', 'corrective_action_reopened']);
  v_old := v_old || jsonb_build_object('spec', coalesce(to_jsonb(old) #> v_path, '{}'::jsonb) - array['workflow_status', 'corrective_action_reopened']);
  if v_new = v_old then return null; end if;

  select event.* into v_last from public.record_signoff_events event
  where event.record_kind = v_kind and event.record_id = new.id
  order by event.sequence_number desc limit 1;
  if not found or v_last.new_status in ('Returned for Correction', 'Reopened', 'Withdrawn', 'Rejected') then
    return null;
  end if;

  select nullif(btrim(profile.display_name), '') into v_name from public.profiles profile where profile.id = v_actor;
  insert into public.record_signoff_events (
    organization_id, project_id, record_kind, record_id, workflow_profile, round_number, stage_number,
    action, actor_user_id, actor_name, actor_role, attestation_method, comments, previous_status, new_status
  ) values (
    v_last.organization_id, v_last.project_id, v_kind, new.id, v_last.workflow_profile, v_last.round_number, 1,
    'reopen', v_actor, coalesce(v_name, 'User'), 'Editor', 'account',
    'Edited after submission: material fields changed, so the approvals are required again. Resubmit the new version.',
    v_last.new_status, 'Reopened'
  );
  return null;
end;
$$;

drop trigger if exists findings_signoff_version on public.findings;
create trigger findings_signoff_version after update on public.findings
  for each row execute function app_private.reopen_signoff_after_edit();
drop trigger if exists hse_events_signoff_version on public.hse_events;
create trigger hse_events_signoff_version after update on public.hse_events
  for each row execute function app_private.reopen_signoff_after_edit();
drop trigger if exists project_register_entries_signoff_version on public.project_register_entries;
create trigger project_register_entries_signoff_version after update on public.project_register_entries
  for each row execute function app_private.reopen_signoff_after_edit();
drop trigger if exists inspections_signoff_version on public.inspections;
create trigger inspections_signoff_version after update on public.inspections
  for each row execute function app_private.reopen_signoff_after_edit();

-- 6. The sign-off function, with the project's workflow settings ----------------------------
create or replace function app_private.signoff_move_record(
  p_kind text, p_record_id uuid, p_action text, p_profile text, p_actor_name text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_workflow text;
  v_targets text[];
  v_target text;
  v_decision jsonb := '{}'::jsonb;
  v_today text := to_char((now() at time zone 'America/Paramaribo')::date, 'YYYY-MM-DD');
begin
  v_workflow := case p_action
    when 'submit' then 'Open' when 'acknowledge' then 'Assigned' when 'review' then 'In Progress'
    when 'respond' then 'Pending Verification' when 'resubmit' then 'Pending Verification'
    when 'return' then 'In Progress' when 'reject' then 'In Progress'
    when 'approve' then 'Closed' when 'accept' then 'Closed' when 'verify' then 'Closed' when 'close' then 'Closed'
    when 'withdraw' then 'Cancelled' when 'reopen' then 'Open'
  end;
  if v_workflow is null then return; end if;
  -- A change order is approved, not closed, and a lesson approved for sharing stays a lesson.
  if p_profile = 'CHANGE-APPROVAL' and p_action in ('approve', 'reject') then
    v_decision := jsonb_build_object('approval_status', case p_action when 'approve' then 'Approved' else 'Rejected' end,
      'approved_by', p_actor_name, 'approved_on', v_today, 'approved_by_user_id', (select auth.uid()));
  elsif p_profile = 'LESSON-REVIEW' and p_action = 'approve' then
    v_decision := jsonb_build_object('review_status', 'Approved for Sharing', 'reviewed_by', p_actor_name, 'reviewed_on', v_today, 'reviewed_by_user_id', (select auth.uid()));
  elsif p_profile = 'LESSON-REVIEW' and p_action = 'review' then
    v_decision := jsonb_build_object('review_status', 'Reviewed', 'reviewed_by', p_actor_name, 'reviewed_on', v_today, 'reviewed_by_user_id', (select auth.uid()));
  end if;

  v_targets := case p_kind
    when 'finding' then case p_action
      when 'acknowledge' then array['assigned'] when 'review' then array['in_progress']
      when 'respond' then array['ready_for_verification'] when 'resubmit' then array['ready_for_verification']
      when 'return' then array['reopened', 'in_progress'] when 'reject' then array['reopened', 'in_progress']
      when 'verify' then array['ready_for_verification', 'closed'] when 'close' then array['ready_for_verification', 'closed']
      when 'approve' then array['ready_for_verification', 'closed'] when 'accept' then array['ready_for_verification', 'closed']
      when 'withdraw' then array['cancelled'] when 'reopen' then array['reopened'] else array[]::text[] end
    when 'hse_event' then case p_action
      when 'acknowledge' then array['investigating'] when 'review' then array['investigating']
      when 'respond' then array['investigating'] when 'resubmit' then array['investigating']
      when 'return' then array['action_required'] when 'reject' then array['action_required']
      when 'verify' then array['closed'] when 'close' then array['closed'] when 'approve' then array['closed'] when 'accept' then array['closed']
      when 'withdraw' then array['cancelled'] when 'reopen' then array['open'] else array[]::text[] end
    when 'register_entry' then case p_action
      when 'submit' then array['open'] when 'acknowledge' then array['in_review'] when 'review' then array['in_review']
      when 'respond' then array['in_review'] when 'resubmit' then array['in_review']
      when 'return' then array['open'] when 'reject' then array['rejected']
      when 'approve' then array['approved'] when 'accept' then array['approved']
      when 'verify' then array['closed'] when 'close' then array['closed']
      when 'withdraw' then array['cancelled'] when 'reopen' then array['open'] else array[]::text[] end
    else array[]::text[]
  end;

  perform set_config('app.signoff_write', 'on', true);
  -- Each step is its own attempt: a status the record cannot take (a closed finding is never
  -- reopened) leaves the status, never the logged action.
  foreach v_target in array v_targets loop
    begin
      case p_kind
        when 'finding' then update public.findings set status = v_target where id = p_record_id and status <> v_target;
        when 'hse_event' then update public.hse_events set status = v_target where id = p_record_id and status <> v_target;
        when 'register_entry' then update public.project_register_entries set status = v_target where id = p_record_id and status <> v_target;
        else null;
      end case;
    exception when others then
      null;
    end;
  end loop;
  begin
    v_decision := v_decision || jsonb_build_object('workflow_status', v_workflow);
    case p_kind
      when 'finding' then
        update public.findings set issue_management = jsonb_set(coalesce(issue_management, '{}'::jsonb), '{spec}', coalesce(issue_management -> 'spec', '{}'::jsonb) || v_decision)
        where id = p_record_id and jsonb_typeof(issue_management -> 'spec') = 'object';
      when 'hse_event' then
        update public.hse_events set spec = spec || v_decision where id = p_record_id and spec <> '{}'::jsonb;
      when 'register_entry' then
        update public.project_register_entries set details = jsonb_set(coalesce(details, '{}'::jsonb), '{spec}', coalesce(details -> 'spec', '{}'::jsonb) || v_decision)
        where id = p_record_id and jsonb_typeof(details -> 'spec') = 'object';
      when 'inspection' then
        update public.inspections set spec = spec || v_decision where id = p_record_id and spec <> '{}'::jsonb;
      else null;
    end case;
  exception when others then
    null;
  end;
  perform set_config('app.signoff_write', 'off', true);
end;
$$;

create or replace function public.record_signoff_action(
  p_project_id uuid,
  p_record_kind text,
  p_record_id uuid,
  p_workflow_profile text,
  p_stage_number integer,
  p_action text,
  p_actor_role text,
  p_attestation_method text default 'account',
  p_actor_name text default null,
  p_actor_organization text default null,
  p_signature_image text default null,
  p_evidence_file_id uuid default null,
  p_comments text default null,
  p_return_reason text default null,
  p_next_actor text default null,
  p_next_actor_user_id uuid default null,
  p_due_at timestamptz default null
)
returns public.record_signoff_events
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_record jsonb;
  v_last public.record_signoff_events;
  v_last_submit public.record_signoff_events;
  v_round integer := 1;
  v_status text;
  v_name text;
  v_event public.record_signoff_events;
  v_authority boolean;
  v_config jsonb;
  v_stage_config jsonb;
  v_approvers jsonb;
  v_required integer;
  v_count integer;
  v_due timestamptz := p_due_at;
  v_limit numeric;
  v_amount numeric;
  v_delegate boolean := false;
  v_number text;
  v_creator uuid;
  v_recipient uuid;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'records.read') then
    raise exception 'Not a member of this project' using errcode = '42501';
  end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;

  -- The record must exist in this project; its current content is frozen with a submission.
  v_record := case p_record_kind
    when 'finding' then (select to_jsonb(item) from public.findings item where item.id = p_record_id and item.project_id = p_project_id)
    when 'hse_event' then (select to_jsonb(item) from public.hse_events item where item.id = p_record_id and item.project_id = p_project_id)
    when 'register_entry' then (select to_jsonb(item) from public.project_register_entries item where item.id = p_record_id and item.project_id = p_project_id)
    when 'inspection' then (select to_jsonb(item) from public.inspections item where item.id = p_record_id and item.project_id = p_project_id)
    when 'day_report' then (select to_jsonb(item) from public.day_reports item where item.id = p_record_id and item.project_id = p_project_id)
  end;
  if v_record is null then raise exception 'Record not found in project' using errcode = 'P0002'; end if;
  v_number := coalesce(v_record ->> 'finding_number', v_record ->> 'event_number', v_record ->> 'entry_number', v_record ->> 'inspection_number', v_record ->> 'report_number', 'record');
  v_creator := nullif(v_record ->> 'created_by', '')::uuid;
  -- Confidential HSE details stay with HSE: the frozen copy of such a record keeps no narrative,
  -- and no HSE copy ever holds the people involved, witnesses or injuries.
  if p_record_kind = 'hse_event' then
    if coalesce((v_record ->> 'confidential')::boolean, false) then
      v_record := v_record - 'description' - 'root_cause' - 'notes' - 'immediate_measure';
    end if;
    v_record := jsonb_set(v_record, '{spec}', coalesce((
      select jsonb_object_agg(item.key, item.value) from jsonb_each(coalesce(v_record -> 'spec', '{}'::jsonb)) item
      where not app_private.spec_sensitive_key(item.key)), '{}'::jsonb));
  end if;

  -- Approving, accepting, rejecting, verifying, closing and reopening are role-restricted.
  v_authority := app_private.has_project_permission(p_project_id, 'findings.verify')
    or app_private.has_project_permission(p_project_id, 'reports.review')
    or (p_record_kind = 'hse_event' and app_private.has_project_permission(p_project_id, 'hse.manage'))
    or (p_record_kind = 'inspection' and app_private.has_project_permission(p_project_id, 'inspections.manage'));
  if p_action in ('approve', 'accept', 'reject', 'verify', 'close', 'reopen') and not v_authority then
    raise exception 'Only an authorised reviewer can % this record', p_action using errcode = '42501';
  end if;
  if p_action not in ('approve', 'accept', 'reject', 'verify', 'close', 'reopen', 'witness', 'acknowledge')
    and not app_private.has_project_permission(p_project_id, 'records.create') then
    raise exception 'Missing records.create permission' using errcode = '42501';
  end if;

  -- Mandatory comments for a return, a rejection, a withdrawal and a reopening.
  if p_action in ('return', 'reject', 'withdraw', 'reopen') and char_length(btrim(coalesce(p_comments, ''))) < 3 then
    raise exception 'A comment is required to % a record', p_action using errcode = '22023';
  end if;
  if p_action = 'return' and char_length(btrim(coalesce(p_next_actor, ''))) < 2 and p_next_actor_user_id is null then
    raise exception 'A return names who acts next' using errcode = '22023';
  end if;
  if p_attestation_method <> 'account' and char_length(btrim(coalesce(p_actor_name, ''))) < 2 then
    raise exception 'An external representative is recorded by name' using errcode = '22023';
  end if;
  -- A signed document is a file of this project.
  if p_attestation_method = 'signed_document' and (p_evidence_file_id is null or not exists (
    select 1 from public.files file where file.id = p_evidence_file_id and file.project_id = p_project_id and file.status <> 'deleted')) then
    raise exception 'A signed document is a file uploaded to this project' using errcode = '22023';
  end if;
  if p_evidence_file_id is not null and not exists (
    select 1 from public.files file where file.id = p_evidence_file_id and file.project_id = p_project_id) then
    raise exception 'Evidence file not found in project' using errcode = 'P0002';
  end if;
  -- The next responsible person is someone on this project.
  if p_next_actor_user_id is not null and not exists (
    select 1 from public.list_project_people(p_project_id) person where person.user_id = p_next_actor_user_id) then
    raise exception 'The next responsible person is not on this project' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_record_kind || ':' || p_record_id::text || ':signoff', 0));
  select event.* into v_last from public.record_signoff_events event
  where event.record_kind = p_record_kind and event.record_id = p_record_id
  order by event.sequence_number desc limit 1;

  if found then
    v_round := v_last.round_number + case when p_action = 'resubmit' then 1 else 0 end;
    if v_last.new_status in ('Closed', 'Withdrawn') and p_action <> 'reopen' then
      raise exception 'This record is %; reopen it first', lower(v_last.new_status) using errcode = '22023';
    end if;
    if p_action = 'submit' then
      raise exception 'This record was already submitted; resubmit it after a return' using errcode = '22023';
    end if;
  elsif p_action not in ('submit', 'acknowledge', 'witness') then
    raise exception 'The first sign-off action on a record is a submission' using errcode = '22023';
  end if;
  if p_action = 'resubmit' and (v_last.id is null or v_last.new_status not in ('Returned for Correction', 'Rejected', 'Reopened')) then
    raise exception 'Only a returned record is resubmitted' using errcode = '22023';
  end if;

  -- A user does not approve their own submission.
  if p_action in ('approve', 'accept', 'verify', 'close') and p_attestation_method = 'account' then
    select event.* into v_last_submit from public.record_signoff_events event
    where event.record_kind = p_record_kind and event.record_id = p_record_id
      and event.round_number = v_round and event.action in ('submit', 'resubmit', 'respond')
      and event.attestation_method = 'account'
    order by event.sequence_number desc limit 1;
    if found and v_last_submit.actor_user_id = v_actor and v_last_submit.action <> 'submit' then
      raise exception 'You cannot approve your own response' using errcode = '42501';
    end if;
    if found and v_last_submit.actor_user_id = v_actor and v_last_submit.action = 'submit'
      and p_workflow_profile in ('WO-DAILY', 'WC-COMPLETION', 'WF-ATTENDANCE', 'PDR-REVIEW', 'CHANGE-APPROVAL', 'LESSON-REVIEW') then
      raise exception 'You cannot approve your own submission' using errcode = '42501';
    end if;
  end if;

  -- The project's own settings for this workflow: approvers, delegation, limits, due days.
  v_config := app_private.spec_configuration(p_project_id) #> array['workflows', p_workflow_profile];
  v_stage_config := v_config #> array['stages', greatest(1, least(coalesce(p_stage_number, 1), 9))::text];
  if p_action in ('approve', 'accept', 'verify', 'close', 'reject') and p_attestation_method = 'account' then
    v_approvers := coalesce(v_stage_config -> 'approver_user_ids', '[]'::jsonb);
    if jsonb_array_length(v_approvers) > 0 and not v_approvers ? v_actor::text then
      select exists (
        select 1 from jsonb_array_elements(coalesce(v_config -> 'delegations', '[]'::jsonb)) delegation
        where delegation ->> 'to' = v_actor::text and v_approvers ? (delegation ->> 'from')
          and coalesce(nullif(delegation ->> 'until', '')::date, current_date) >= (now() at time zone 'America/Paramaribo')::date
      ) into v_delegate;
      if not v_delegate then
        raise exception 'Only the approvers this project named for this step can %', p_action using errcode = '42501';
      end if;
    end if;
    if p_workflow_profile = 'CHANGE-APPROVAL' and p_action = 'approve' then
      v_limit := nullif(v_config ->> 'approval_limit', '')::numeric;
      v_amount := greatest(
        coalesce(nullif(v_record #>> '{details,spec,approved_amount}', '')::numeric, 0),
        coalesce(nullif(v_record #>> '{details,spec,cost_impact}', '')::numeric, 0));
      if v_limit is not null and v_amount > v_limit and not coalesce(v_config -> 'above_limit_user_ids', '[]'::jsonb) ? v_actor::text then
        raise exception 'This change exceeds the approval limit of %; an approver above the limit decides', v_limit using errcode = '42501';
      end if;
    end if;
  end if;
  if v_due is null and nullif(v_stage_config ->> 'due_days', '') is not null and p_action not in ('close', 'withdraw') then
    v_due := now() + make_interval(days => (v_stage_config ->> 'due_days')::integer);
  end if;

  v_status := case p_action
    when 'submit' then 'Submitted'
    when 'acknowledge' then 'Acknowledged'
    when 'review' then 'Under Review'
    when 'approve' then 'Approved'
    when 'accept' then 'Accepted'
    when 'reject' then 'Rejected'
    when 'return' then 'Returned for Correction'
    when 'respond' then 'Responded'
    when 'resubmit' then 'Resubmitted'
    when 'verify' then 'Verified'
    when 'close' then 'Closed'
    when 'withdraw' then 'Withdrawn'
    when 'reopen' then 'Reopened'
    when 'witness' then coalesce(v_last.new_status, 'Witnessed')
  end;

  -- Parallel review: every designated approval before the record moves on.
  v_required := coalesce(nullif(v_stage_config ->> 'required_approvals', '')::integer, 1);
  if p_action in ('approve', 'accept', 'verify') and v_required > 1 then
    select count(distinct coalesce(event.actor_user_id::text || ':' || event.actor_name, '')) + 1 into v_count
    from public.record_signoff_events event
    where event.record_kind = p_record_kind and event.record_id = p_record_id and event.round_number = v_round
      and event.action = p_action and event.stage_number = greatest(1, least(coalesce(p_stage_number, 1), 9))
      and not (event.actor_user_id = v_actor and event.attestation_method = 'account' and p_attestation_method = 'account');
    if exists (
      select 1 from public.record_signoff_events event
      where event.record_kind = p_record_kind and event.record_id = p_record_id and event.round_number = v_round
        and event.action = p_action and event.actor_user_id = v_actor and event.attestation_method = 'account' and p_attestation_method = 'account'
    ) then
      raise exception 'You already recorded this approval in this round' using errcode = '22023';
    end if;
    if v_count < v_required then
      v_status := 'Partially Approved (' || v_count || '/' || v_required || ')';
    end if;
  end if;

  select nullif(btrim(profile.display_name), '') into v_name
  from public.profiles profile where profile.id = v_actor;

  insert into public.record_signoff_events (
    organization_id, project_id, record_kind, record_id, workflow_profile, round_number,
    stage_number, action, actor_user_id, actor_name, actor_organization, actor_role,
    attestation_method, signature_image, evidence_file_id, comments, return_reason,
    next_actor, next_actor_user_id, due_at, submitted_version, previous_status, new_status
  ) values (
    v_project.organization_id, p_project_id, p_record_kind, p_record_id, p_workflow_profile, v_round,
    greatest(1, least(coalesce(p_stage_number, 1), 9)), p_action, v_actor,
    case when p_attestation_method = 'account' then coalesce(v_name, 'User') else btrim(p_actor_name) end,
    nullif(btrim(coalesce(p_actor_organization, '')), ''),
    btrim(p_actor_role) || case when v_delegate then ' (delegate)' else '' end,
    p_attestation_method, p_signature_image, p_evidence_file_id,
    nullif(btrim(coalesce(p_comments, '')), ''), nullif(btrim(coalesce(p_return_reason, '')), ''),
    coalesce(nullif(btrim(coalesce(p_next_actor, '')), ''), (select person.display_name from public.list_project_people(p_project_id) person where person.user_id = p_next_actor_user_id)),
    p_next_actor_user_id, v_due,
    case when p_action in ('submit', 'resubmit', 'respond') then v_record end,
    v_last.new_status, v_status
  ) returning * into v_event;

  -- The record's own status follows the action (one status, set by the workflow).
  if v_status not like 'Partially Approved%' and p_action <> 'witness' then
    perform app_private.signoff_move_record(p_record_kind, p_record_id, p_action, p_workflow_profile, coalesce(v_name, 'User'));
  end if;

  -- The next responsible person hears about it; after a decision, so does the author.
  v_recipient := coalesce(p_next_actor_user_id,
    case when p_action in ('approve', 'accept', 'reject', 'return', 'verify', 'close', 'reopen') then v_creator end);
  if v_recipient is not null and v_recipient <> v_actor then
    insert into public.notifications (
      organization_id, project_id, recipient_user_id, notification_type,
      title, body, source_type, source_id, due_at, dedupe_key
    ) values (
      v_project.organization_id, p_project_id, v_recipient, 'review_requested',
      left(v_status || ': ' || v_number, 240),
      left(coalesce(v_record ->> 'title', 'Sign-off') || ' — ' || coalesce(nullif(btrim(p_comments), ''), v_status), 2000),
      'signoff', p_record_id, v_due,
      'signoff:' || v_event.id::text
    )
    on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return v_event;
end;
$$;

revoke all on function public.record_signoff_action(uuid, text, uuid, text, integer, text, text, text, text, text, text, uuid, text, text, text, uuid, timestamptz) from public, anon;
grant execute on function public.record_signoff_action(uuid, text, uuid, text, integer, text, text, text, text, text, text, uuid, text, text, text, uuid, timestamptz) to authenticated;
revoke all on function app_private.signoff_move_record(text, uuid, text, text, text) from public, anon, authenticated;

-- Overdue sign-off steps remind the next person and, a day later, the project's reviewers.
do $patch$
declare
  v_oid oid;
  v_definition text;
  v_patched text;
begin
  select procedure.oid into v_oid
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'refresh_project_notifications';
  v_definition := pg_get_functiondef(v_oid);
  if v_definition ~ 'signoff-overdue' then return; end if;
  v_patched := regexp_replace(v_definition, '\n\s*return v_count;\s*\nend;', $new$

  -- Sign-off steps past their due date (Sign-off sheet: notify after an overdue action).
  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, due_at, dedupe_key
  )
  select latest.organization_id, latest.project_id, latest.next_actor_user_id, 'review_requested',
    left('Sign-off overdue: ' || latest.workflow_profile || ' · ' || latest.new_status, 240),
    left(coalesce(latest.comments, 'Waiting for your sign-off action.'), 2000),
    'signoff', latest.record_id, latest.due_at, 'signoff-overdue:' || latest.id::text
  from (
    select distinct on (event.record_kind, event.record_id) event.*
    from public.record_signoff_events event
    where event.project_id = p_project_id
    order by event.record_kind, event.record_id, event.sequence_number desc
  ) latest
  where latest.due_at < now() and latest.next_actor_user_id is not null
    and latest.new_status not in ('Closed', 'Withdrawn')
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, due_at, dedupe_key
  )
  select distinct latest.organization_id, latest.project_id, membership.user_id, 'review_requested',
    left('Sign-off escalated: ' || latest.workflow_profile || ' · ' || latest.new_status, 240),
    left('Overdue since ' || to_char(latest.due_at at time zone 'America/Paramaribo', 'YYYY-MM-DD HH24:MI') || coalesce(' · waiting for ' || latest.next_actor, ''), 2000),
    'signoff', latest.record_id, latest.due_at, 'signoff-escalated:' || latest.id::text
  from (
    select distinct on (event.record_kind, event.record_id) event.*
    from public.record_signoff_events event
    where event.project_id = p_project_id
    order by event.record_kind, event.record_id, event.sequence_number desc
  ) latest
  join public.project_memberships membership on membership.project_id = latest.project_id and membership.status = 'active'
  join public.project_member_roles member_role on member_role.membership_id = membership.id
  join public.role_permissions permission on permission.role_id = member_role.role_id and permission.permission_code = 'reports.review'
  where latest.due_at < now() - interval '1 day'
    and latest.new_status not in ('Closed', 'Withdrawn')
    and membership.user_id is distinct from latest.next_actor_user_id
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  return v_count;
end;$new$);
  if v_patched = v_definition then
    raise exception 'refresh_project_notifications no longer ends with return v_count';
  end if;
  execute v_patched;
end;
$patch$;

-- 8. Lessons approved for sharing, across the organisation's projects ---------------------
create or replace function public.list_shared_lessons(p_organization_id uuid)
returns table (
  entry_id uuid, project_id uuid, project_name text, project_code text, entry_number text,
  title text, occurred_at timestamptz, details jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select entry.id, project.id, project.name, project.code, entry.entry_number, entry.title, entry.occurred_at,
    jsonb_build_object(
      'spec', coalesce(entry.details -> 'spec', '{}'::jsonb) - array['action_owner_ref', 'reviewed_by_user_id'],
      'issue', entry.details -> 'issue', 'cause', entry.details -> 'cause',
      'solution', entry.details -> 'solution', 'expected_results', entry.details -> 'expected_results',
      'description', entry.details -> 'description'
    )
  from public.project_register_entries entry
  join public.projects project on project.id = entry.project_id
  where project.organization_id = p_organization_id
    and entry.register_type = 'lessons_learned'
    and entry.status <> 'cancelled'
    and entry.details #>> '{spec,review_status}' = 'Approved for Sharing'
    and (select auth.uid()) is not null
    and (
      exists (select 1 from public.organization_memberships membership
        where membership.organization_id = p_organization_id and membership.user_id = (select auth.uid()) and membership.status = 'active')
      or exists (select 1 from public.project_memberships membership
        where membership.organization_id = p_organization_id and membership.user_id = (select auth.uid()) and membership.status = 'active')
    )
  order by entry.occurred_at desc
  limit 500;
$$;

revoke all on function public.list_shared_lessons(uuid) from public, anon;
grant execute on function public.list_shared_lessons(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
