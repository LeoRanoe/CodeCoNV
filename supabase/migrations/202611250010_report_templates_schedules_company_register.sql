-- Developer package v5 (25-11-2026).
--  * Word 11.1: the report builder saves its settings as a template and schedules a report
--    (every working day, weekly, monthly) for selected users.
--  * Word 13: Project Company Register - contacts per contractor, supplier, consultant or client.
--  * Word 14: notifications for scheduled reports and for Change Orders that await the Project Manager.

-- 1. Notification types ------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check check (notification_type in (
  'action_due','action_overdue','action_assigned','finding_critical','finding_due','finding_assigned',
  'hse_critical','review_requested','signature_requested','backup_failed','inspection_scheduled',
  'report_scheduled','report_published','change_order_pending','system'
));

-- 2. Report templates and schedules -------------------------------------------------------------
create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid references public.report_templates(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  frequency text not null check (frequency in ('workdays','weekly','monthly')),
  weekday integer check (weekday between 1 and 7),
  day_of_month integer check (day_of_month between 1 and 28),
  run_time time not null default '18:00',
  recipient_user_ids uuid[] not null default '{}',
  publish_to_client boolean not null default false,
  active boolean not null default true,
  last_run_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, name),
  check (frequency <> 'weekly' or weekday is not null),
  check (frequency <> 'monthly' or day_of_month is not null)
);

alter table public.report_templates enable row level security;
alter table public.report_schedules enable row level security;

drop policy if exists report_templates_select on public.report_templates;
create policy report_templates_select on public.report_templates for select to authenticated
  using (app_private.has_project_permission(project_id, 'reports.read'));
drop policy if exists report_templates_write on public.report_templates;
create policy report_templates_write on public.report_templates for all to authenticated
  using (app_private.has_project_permission(project_id, 'reports.edit'))
  with check (app_private.has_project_permission(project_id, 'reports.edit'));

drop policy if exists report_schedules_select on public.report_schedules;
create policy report_schedules_select on public.report_schedules for select to authenticated
  using (app_private.has_project_permission(project_id, 'reports.read'));
drop policy if exists report_schedules_write on public.report_schedules;
create policy report_schedules_write on public.report_schedules for all to authenticated
  using (app_private.has_project_permission(project_id, 'reports.edit'))
  with check (
    app_private.has_project_permission(project_id, 'reports.edit')
    -- Only an authorized CODECO user may let a schedule publish to the Client Portal.
    and (not publish_to_client or app_private.has_project_permission(project_id, 'reports.distribute'))
  );

grant select, insert, update, delete on public.report_templates, public.report_schedules to authenticated;

-- The organization and the author come from the project and the session, not from the app.
create or replace function public.stamp_report_setup()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select project.organization_id into new.organization_id from public.projects project where project.id = new.project_id;
  if new.organization_id is null then raise exception 'Unknown project' using errcode = '22023'; end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, (select auth.uid())); end if;
  if tg_table_name = 'report_templates' then new.updated_at := now(); end if;
  return new;
end;
$$;
revoke all on function public.stamp_report_setup() from public, anon, authenticated;
drop trigger if exists stamp_report_setup on public.report_templates;
create trigger stamp_report_setup before insert or update on public.report_templates for each row execute function public.stamp_report_setup();
drop trigger if exists stamp_report_setup on public.report_schedules;
create trigger stamp_report_setup before insert or update on public.report_schedules for each row execute function public.stamp_report_setup();

-- The cron job calls this: every schedule that has come due writes a notification to each recipient
-- (an e-mail follows through the notification queue), pointing at the report that is ready to be generated.
create or replace function public.run_due_report_schedules(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_schedule public.report_schedules;
  v_local timestamp;
  v_due timestamp;
  v_due_at timestamptz;
  v_count integer := 0;
  v_user uuid;
begin
  if (select auth.role()) is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only the scheduler may run report schedules' using errcode = '42501';
  end if;
  v_local := timezone('America/Paramaribo', p_now);
  for v_schedule in select * from public.report_schedules where active order by created_at loop
    v_due := date_trunc('day', v_local) + v_schedule.run_time;
    if v_local < v_due then continue; end if;
    if v_schedule.frequency = 'workdays' and extract(isodow from v_local) > 5 then continue; end if;
    if v_schedule.frequency = 'weekly' and extract(isodow from v_local)::integer <> v_schedule.weekday then continue; end if;
    if v_schedule.frequency = 'monthly' and extract(day from v_local)::integer <> v_schedule.day_of_month then continue; end if;
    v_due_at := timezone('America/Paramaribo', v_due);
    if v_schedule.last_run_at is not null and v_schedule.last_run_at >= v_due_at then continue; end if;
    foreach v_user in array v_schedule.recipient_user_ids loop
      insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, dedupe_key)
      values (
        v_schedule.organization_id, v_schedule.project_id, v_user, 'report_scheduled',
        'Rapport klaar om te maken: ' || v_schedule.name,
        'Het geplande rapport "' || v_schedule.name || '" is aan de beurt. Open Rapporten, kies het sjabloon en maak het rapport.'
          || case when v_schedule.publish_to_client then ' Na controle kan het naar het Client Portal.' else '' end,
        'report_schedule', v_schedule.id, 'report-schedule:' || v_schedule.id || ':' || to_char(v_due, 'YYYY-MM-DD')
      ) on conflict do nothing;
    end loop;
    update public.report_schedules set last_run_at = p_now where id = v_schedule.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.run_due_report_schedules(timestamptz) from public, anon, authenticated;
grant execute on function public.run_due_report_schedules(timestamptz) to service_role;

-- 3. Project Company Register: contacts per company -----------------------------------------------
create table if not exists public.party_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  email text check (email is null or email ~* '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists party_contacts_party_idx on public.party_contacts (party_id);
alter table public.party_contacts enable row level security;
drop policy if exists party_contacts_select on public.party_contacts;
create policy party_contacts_select on public.party_contacts for select to authenticated
  using (app_private.has_project_permission(project_id, 'records.read') or app_private.has_project_permission(project_id, 'project.configure'));
drop policy if exists party_contacts_write on public.party_contacts;
create policy party_contacts_write on public.party_contacts for all to authenticated
  using (app_private.has_project_permission(project_id, 'project.configure'))
  with check (app_private.has_project_permission(project_id, 'project.configure'));
grant select, insert, update, delete on public.party_contacts to authenticated;

create or replace function public.stamp_party_contact()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_project uuid;
begin
  select party.project_id, party.organization_id into v_project, new.organization_id from public.parties party where party.id = new.party_id;
  if v_project is null or v_project <> new.project_id then raise exception 'The company belongs to another project' using errcode = '22023'; end if;
  return new;
end;
$$;
revoke all on function public.stamp_party_contact() from public, anon, authenticated;
drop trigger if exists stamp_party_contact on public.party_contacts;
create trigger stamp_party_contact before insert or update on public.party_contacts for each row execute function public.stamp_party_contact();

-- 4. Change Order awaiting the Project Manager (Word 14) ------------------------------------------
-- A submitted Change Order is open until the Project Manager approves, rejects or returns it; the
-- Project Managers of the project are told when it is submitted.
create or replace function public.notify_change_order_pending()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;
begin
  if new.register_type <> 'change_order' or new.status <> 'open' then return new; end if;
  for v_user in
    select distinct membership.user_id
    from public.project_memberships membership
    join public.project_member_roles member_role on member_role.membership_id = membership.id and member_role.project_id = membership.project_id
    join public.roles role on role.id = member_role.role_id
    where membership.project_id = new.project_id and membership.status = 'active' and role.code = 'project_manager'
      and membership.user_id is distinct from new.created_by
  loop
    insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, dedupe_key)
    values (new.organization_id, new.project_id, v_user, 'change_order_pending',
      'Wijzigingsopdracht wacht op goedkeuring: ' || coalesce(new.entry_number, ''),
      left(coalesce(new.title, 'Wijzigingsopdracht'), 200) || ' wacht op goedkeuring van de Project Manager.',
      'register_entry', new.id, 'co-pending:' || new.id)
    on conflict do nothing;
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_change_order_pending() from public, anon, authenticated;
drop trigger if exists notify_change_order_pending on public.project_register_entries;
create trigger notify_change_order_pending after insert on public.project_register_entries
  for each row execute function public.notify_change_order_pending();

-- 5. "Send to app" (Word 14): a portal item that asks for a signature notifies as a signature request.
create or replace function public.mark_signature_requests()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.source_type = 'portal_share' and new.notification_type = 'review_requested' and exists (
    select 1 from public.portal_shares share where share.id = new.source_id and share.requested_action = 'sign'
  ) then
    new.notification_type := 'signature_requested';
    new.title := replace(replace(new.title, 'new item', 'signature requested'), 'nieuw item', 'handtekening gevraagd');
  end if;
  return new;
end;
$$;
revoke all on function public.mark_signature_requests() from public, anon, authenticated;
drop trigger if exists mark_signature_requests on public.notifications;
create trigger mark_signature_requests before insert on public.notifications
  for each row execute function public.mark_signature_requests();
