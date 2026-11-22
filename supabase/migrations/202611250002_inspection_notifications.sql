-- Word 14 / WD-192: "Inspection scheduled or updated" notifies the people concerned.
--
-- An inspection that is planned for someone, or whose planned time, executor or status changes,
-- now tells its executor straight away (unless they made the change themselves). The row
-- transition itself determines whether to notify, including a return to a previous time.
-- Rollback: drop the trigger and its function, and restore the previous type check.

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check check (notification_type in (
  'action_due','action_overdue','action_assigned','finding_critical','finding_due','finding_assigned',
  'hse_critical','review_requested','signature_requested','backup_failed','inspection_scheduled','system'
));

create or replace function app_private.notify_inspection_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_changed boolean;
begin
  if new.executed_by is null or new.executed_by = (select auth.uid()) then return new; end if;
  if new.status in ('passed','failed','cancelled') then return new; end if;
  v_changed := tg_op = 'INSERT'
    or new.executed_by is distinct from old.executed_by
    or new.planned_at is distinct from old.planned_at
    or new.status is distinct from old.status;
  if not v_changed then return new; end if;
  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id, due_at
  ) values (
    new.organization_id, new.project_id, new.executed_by, 'inspection_scheduled',
    case when tg_op = 'INSERT' then 'Inspectie ingepland: ' else 'Inspectie bijgewerkt: ' end || coalesce(new.inspection_number, ''),
    coalesce(new.title, 'Inspectie'), 'inspection', new.id, new.planned_at
  );
  return new;
end;
$$;

revoke all on function app_private.notify_inspection_change() from public, anon, authenticated;

drop trigger if exists inspections_notify_change on public.inspections;
create trigger inspections_notify_change
  after insert or update of executed_by, planned_at, status on public.inspections
  for each row execute function app_private.notify_inspection_change();
