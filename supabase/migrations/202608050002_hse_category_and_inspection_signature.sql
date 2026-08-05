-- Two boxes the client's own forms have and the app did not.
--
-- 1. "Kan ik hier kiezen tussen Health, Safety, Environmental?" — an HSE record is filed
--    under one of those three headings on the client's forms. The type of event (unsafe
--    act, near miss, stop work) says what happened; the heading says which discipline it
--    belongs to, and the two are not the same thing.
--
-- 2. "Geen optie om te ondertekenen!" — an inspection is signed by the person who carried
--    it out. It was the last record that could be completed without a signature.

alter table public.hse_events
  add column if not exists hse_category text
  check (hse_category is null or hse_category in ('health','safety','environmental'));

comment on column public.hse_events.hse_category is
  'Health, Safety or Environmental: the heading of the client''s own HSE form.';

alter table public.inspections
  add column if not exists signed_by text
  check (signed_by is null or char_length(signed_by) between 2 and 120);
alter table public.inspections
  add column if not exists signed_at timestamptz;
alter table public.inspections
  add column if not exists signature_image text
  check (signature_image is null or char_length(signature_image) between 40 and 200000);

comment on column public.inspections.signature_image is
  'The signature the inspector wrote in the app when the checklist was completed.';

-- The event keeps everything it already recorded; only the heading is new, and a caller
-- that does not send one keeps working through the existing function.
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
  p_idempotency_key text,
  p_location_node_id uuid,
  p_hse_category text
)
returns public.hse_events
language plpgsql
-- Definer, like the function it wraps: the permission to record the event is checked
-- there, and writing the heading of that same brand-new row must not need a second one.
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.hse_events;
begin
  if p_hse_category is not null and p_hse_category not in ('health','safety','environmental') then
    raise exception 'Invalid HSE category' using errcode = '22023';
  end if;
  v_event := public.create_project_hse_event(
    p_project_id, p_building_id, p_day_report_id, p_event_type, p_title, p_description,
    p_severity, p_immediate_measure, p_confidential, p_occurred_at, p_idempotency_key,
    p_location_node_id
  );
  if p_hse_category is not null and v_event.hse_category is distinct from p_hse_category then
    update public.hse_events set hse_category = p_hse_category
    where id = v_event.id
    returning * into v_event;
  end if;
  return v_event;
end;
$$;

revoke all on function public.create_project_hse_event(uuid,uuid,uuid,text,text,text,text,text,boolean,timestamptz,text,uuid,text) from public, anon;
grant execute on function public.create_project_hse_event(uuid,uuid,uuid,text,text,text,text,text,boolean,timestamptz,text,uuid,text) to authenticated;

notify pgrst, 'reload schema';
