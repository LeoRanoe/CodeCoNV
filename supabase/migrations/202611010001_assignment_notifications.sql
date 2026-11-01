-- A person hears about work given to them when it is given, not only a day before it is due.
--
-- Until now a notification was created for an action or issue only when its due date came
-- within 24 hours (refresh_project_notifications), so assigning an issue to someone on Monday
-- that is due on Friday told them nothing until Thursday. In production 6 notifications had
-- ever been created against 56 issues.
--
-- An action that gets an owner, or an issue that gets an assignee, now creates one notification
-- for that person straight away, unless they assigned it to themselves. The app already asks the
-- server to send pending pushes after every save, so the push follows within seconds.
-- Rollback: drop the two triggers and the three functions, and restore the previous type check.

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check check (notification_type in (
  'action_due','action_overdue','action_assigned','finding_critical','finding_due','finding_assigned',
  'hse_critical','review_requested','signature_requested','backup_failed','system'
));

-- One function per table: PL/pgSQL cannot name a column the other table does not have.
create or replace function app_private.insert_assignment_notification(
  p_kind text, p_record_id uuid, p_organization_id uuid, p_project_id uuid,
  p_recipient uuid, p_number text, p_title text, p_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if p_recipient is null or p_recipient = (select auth.uid()) then return; end if;
  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, due_at, dedupe_key
  ) values (
    p_organization_id, p_project_id, p_recipient, p_kind || '_assigned',
    case when p_kind = 'action' then 'Actie aan jou toegewezen: ' else 'Issue aan jou toegewezen: ' end || coalesce(p_number, ''),
    p_title, p_kind, p_record_id, p_due_at,
    p_kind || ':' || p_record_id::text || ':assigned:' || p_recipient::text
  )
  on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

create or replace function app_private.notify_action_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if new.status in ('verified','cancelled') then return new; end if;
  if tg_op = 'UPDATE' and new.owner_user_id is not distinct from old.owner_user_id then return new; end if;
  perform app_private.insert_assignment_notification('action', new.id, new.organization_id, new.project_id,
    new.owner_user_id, new.action_number, new.title, new.due_at);
  return new;
end;
$$;

create or replace function app_private.notify_finding_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if new.status in ('draft','closed','cancelled','rejected') then return new; end if;
  if tg_op = 'UPDATE' and new.assigned_user_id is not distinct from old.assigned_user_id then return new; end if;
  perform app_private.insert_assignment_notification('finding', new.id, new.organization_id, new.project_id,
    new.assigned_user_id, new.finding_number, new.title, new.due_at);
  return new;
end;
$$;

revoke all on function app_private.insert_assignment_notification(text, uuid, uuid, uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function app_private.notify_action_assignment() from public, anon, authenticated;
revoke all on function app_private.notify_finding_assignment() from public, anon, authenticated;

drop trigger if exists actions_notify_assignment on public.actions;
create trigger actions_notify_assignment
  after insert or update of owner_user_id on public.actions
  for each row execute function app_private.notify_action_assignment();

drop trigger if exists findings_notify_assignment on public.findings;
create trigger findings_notify_assignment
  after insert or update of assigned_user_id on public.findings
  for each row execute function app_private.notify_finding_assignment();
