-- Client feedback of 19-11-2026 on the HSE screen.
--
-- 1. "Responsible person" is first a party — client, contractor or supervision — and then a
--    name. The name already had a column; the party gets one.
-- 2. "Contractor ook tekenen!": the contractor's representative signs the HSE record at the end
--    of the form, next to the supervisor. Signing records receipt only, not acceptance of fault.
--
-- Additive only: every column is nullable, nothing existing is rewritten, and an app version
-- that does not send these columns keeps working. Issues and NCRs keep the same two facts in
-- their existing issue_management object and need no change here.

begin;

alter table public.hse_events
  add column if not exists responsible_role text
  check (responsible_role is null or responsible_role in ('client', 'contractor', 'supervision'));

alter table public.hse_events
  add column if not exists contractor_signed_by text
  check (contractor_signed_by is null or char_length(contractor_signed_by) <= 120);
alter table public.hse_events
  add column if not exists contractor_signed_at timestamptz;
alter table public.hse_events
  add column if not exists contractor_signature_image text
  check (contractor_signature_image is null or char_length(contractor_signature_image) between 40 and 200000);
alter table public.hse_events
  add column if not exists contractor_signed_position text
  check (contractor_signed_position is null or char_length(contractor_signed_position) <= 120);

comment on column public.hse_events.responsible_role is
  'Who has to act: client, contractor or supervision. The name is in responsible_person.';
comment on column public.hse_events.contractor_signature_image is
  'Handwritten signature of the contractor representative, captured on the supervisor''s device. Receipt only.';

-- A contractor signature, once written, stays as it was signed.
create or replace function app_private.hse_contractor_signature_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.contractor_signature_image is not null and (
    new.contractor_signature_image is distinct from old.contractor_signature_image
    or new.contractor_signed_by is distinct from old.contractor_signed_by
    or new.contractor_signed_at is distinct from old.contractor_signed_at
  ) then
    raise exception 'A signed record keeps its contractor signature' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists hse_events_contractor_signature_guard on public.hse_events;
create trigger hse_events_contractor_signature_guard
  before update on public.hse_events
  for each row execute function app_private.hse_contractor_signature_guard();

commit;
