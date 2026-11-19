-- The sign-off log is read in the order the actions happened. 202611200001 ordered it by
-- created_at and then by the random event id; created_at defaulted to now(), which is the same
-- for every action written in one transaction, so "the latest event" could be any of them.
--
-- Each event now carries a sequence number that only grows, its timestamp is the moment it was
-- written (clock_timestamp), and the function and the app order by that sequence.
-- Additive. Rollback: drop the column and restore record_signoff_action from 202611200001.

begin;

alter table public.record_signoff_events
  add column if not exists sequence_number bigint generated always as identity;
alter table public.record_signoff_events
  alter column created_at set default clock_timestamp();

create index if not exists record_signoff_events_record_sequence_idx
  on public.record_signoff_events (record_kind, record_id, sequence_number);

do $patch$
declare
  v_oid oid;
  v_definition text;
  v_patched text;
begin
  select procedure.oid into v_oid
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'record_signoff_action';

  v_definition := pg_get_functiondef(v_oid);
  v_patched := replace(v_definition, 'order by event.created_at desc, event.id desc', 'order by event.sequence_number desc');
  if v_patched = v_definition then
    if v_definition ~ 'sequence_number desc' then return; end if;
    raise exception 'record_signoff_action no longer contains the expected ordering';
  end if;
  execute v_patched;
end;
$patch$;

notify pgrst, 'reload schema';

commit;
