-- The client's own HSE observation / issue screen, section by section.
--
-- The screen the client drew has twelve numbered boxes: issue type, category, severity,
-- description, location, photos, immediate action taken, responsible person, due date,
-- root cause, corrective action and notes. The event already carried the type, the
-- severity, the description and the immediate measure; everything else was written
-- nowhere, so the boxes on the screen had no column to land in.
--
-- One record per screen, so what the supervisor fills in is what the report reads back.

-- 1. "Issue type" on the client's screen mixes the discipline (Safety, Health,
--    Environment) with the kind of event (near miss, incident, unsafe act, unsafe
--    condition). The app keeps storing both — the heading in hse_category, the kind in
--    event_type — so a Safety observation is an observation and not a made-up unsafe
--    condition. That needs two kinds the enum did not have yet.
alter table public.hse_events drop constraint if exists hse_events_event_type_check;
alter table public.hse_events add constraint hse_events_event_type_check
  check (event_type in (
    'positive_observation','observation','unsafe_act','unsafe_condition',
    'near_miss','incident','stop_work','toolbox','other'
  ));

-- 2. The tile that was tapped, in the client's own words. The derived heading and event
--    kind stay in their own columns; this one says which of the nine tiles it was.
alter table public.hse_events
  add column if not exists issue_type text
  check (issue_type is null or issue_type in (
    'safety','health','environment','near_miss','incident',
    'unsafe_act','unsafe_condition','other'
  ));

-- 3. Section 2: the category behind the issue — PPE, housekeeping, work at height.
alter table public.hse_events
  add column if not exists issue_category text
  check (issue_category is null or char_length(issue_category) between 2 and 120);

-- 4. Section 7: what was done on the spot, ticked instead of typed. The free text next to
--    "Other" is kept apart, because it is written and the rest is chosen.
alter table public.hse_events
  add column if not exists immediate_actions text[] not null default '{}';
alter table public.hse_events
  add column if not exists immediate_action_other text
  check (immediate_action_other is null or char_length(immediate_action_other) <= 240);

-- 5. Sections 8 and 9: who has to act and by when, with the priority the severity implies.
--    The name is stored next to the user id: the person who has to act is often on site
--    without an account yet, and a report that has to say who owns the issue cannot wait
--    for one.
alter table public.hse_events
  add column if not exists responsible_person text
  check (responsible_person is null or char_length(responsible_person) between 2 and 160);
alter table public.hse_events
  add column if not exists responsible_user_id uuid references auth.users(id);
alter table public.hse_events
  add column if not exists due_at timestamptz;
alter table public.hse_events
  add column if not exists priority text
  check (priority is null or priority in ('low','normal','high','critical'));

-- 6. Sections 10, 11 and 12: why it happened, what has to be corrected, and the rest.
alter table public.hse_events
  add column if not exists root_cause text
  check (root_cause is null or char_length(root_cause) between 2 and 160);
alter table public.hse_events
  add column if not exists corrective_action text
  check (corrective_action is null or char_length(corrective_action) <= 4000);
alter table public.hse_events
  add column if not exists notes text
  check (notes is null or char_length(notes) <= 2000);

-- 7. Section 5: the spot itself. The building and the location node say where in the works
--    it happened; these say where on earth, as the phone read it.
alter table public.hse_events
  add column if not exists latitude double precision
  check (latitude is null or (latitude >= -90 and latitude <= 90));
alter table public.hse_events
  add column if not exists longitude double precision
  check (longitude is null or (longitude >= -180 and longitude <= 180));
alter table public.hse_events
  add column if not exists location_label text
  check (location_label is null or char_length(location_label) <= 240);

comment on column public.hse_events.issue_type is
  'Section 1 of the client''s HSE screen: the tile that was tapped.';
comment on column public.hse_events.immediate_actions is
  'Section 7: the measures that were ticked as already taken on the spot.';
comment on column public.hse_events.due_at is
  'Section 9: when the issue has to be resolved; derived from the severity unless changed.';

create index if not exists hse_events_due_idx
  on public.hse_events (project_id, due_at)
  where status not in ('closed','cancelled') and due_at is not null;

-- The event is still created by the function that owns the numbering, the status rules and
-- the notification. This wrapper only writes the boxes of the screen onto that same row,
-- so a caller that does not send them keeps working through the existing signature.
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
  p_hse_category text,
  p_issue_type text,
  p_issue_category text,
  p_immediate_actions text[],
  p_immediate_action_other text,
  p_responsible_person text,
  p_responsible_user_id uuid,
  p_due_at timestamptz,
  p_root_cause text,
  p_corrective_action text,
  p_notes text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_label text
)
returns public.hse_events
language plpgsql
-- Definer, like the function it wraps: the permission to record the event is checked
-- there, and writing the rest of that same brand-new row must not need a second one.
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.hse_events;
  v_priority text;
  v_base_type text;
begin
  if p_issue_type is not null and p_issue_type not in (
    'safety','health','environment','near_miss','incident',
    'unsafe_act','unsafe_condition','other'
  ) then
    raise exception 'Invalid HSE issue type' using errcode = '22023';
  end if;
  if p_event_type not in (
    'positive_observation','observation','unsafe_act','unsafe_condition',
    'near_miss','incident','stop_work','toolbox','other'
  ) then
    raise exception 'Invalid HSE classification' using errcode = '22023';
  end if;
  -- The function that numbers the event, decides its status and sends the urgent
  -- notification knows the seven kinds it was written with. A plain observation and an
  -- "other" are new on the client's screen and carry no rule of their own, so the row is
  -- created as an observation and gets its own kind back in the same transaction.
  v_base_type := case when p_event_type in ('observation','other')
    then 'positive_observation' else p_event_type end;
  v_event := public.create_project_hse_event(
    p_project_id, p_building_id, p_day_report_id, v_base_type, p_title, p_description,
    p_severity, p_immediate_measure, p_confidential, p_occurred_at, p_idempotency_key,
    p_location_node_id, p_hse_category
  );
  -- The priority follows the severity by the same ladder as a finding, so the two lists
  -- cannot disagree about how urgent the same severity is.
  v_priority := case v_event.severity
    when 'critical' then 'critical' when 'high' then 'high'
    when 'medium' then 'normal' else 'low' end;
  update public.hse_events set
    event_type = p_event_type,
    issue_type = p_issue_type,
    issue_category = nullif(trim(coalesce(p_issue_category, '')), ''),
    immediate_actions = coalesce(p_immediate_actions, '{}'),
    immediate_action_other = nullif(trim(coalesce(p_immediate_action_other, '')), ''),
    responsible_person = nullif(trim(coalesce(p_responsible_person, '')), ''),
    responsible_user_id = p_responsible_user_id,
    due_at = coalesce(p_due_at, now() + case v_event.severity
      when 'critical' then interval '1 day' when 'high' then interval '3 days'
      when 'medium' then interval '7 days' else interval '14 days' end),
    priority = v_priority,
    root_cause = nullif(trim(coalesce(p_root_cause, '')), ''),
    corrective_action = nullif(trim(coalesce(p_corrective_action, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    latitude = p_latitude,
    longitude = p_longitude,
    location_label = nullif(trim(coalesce(p_location_label, '')), '')
  where id = v_event.id
  returning * into v_event;
  return v_event;
end;
$$;

revoke all on function public.create_project_hse_event(
  uuid,uuid,uuid,text,text,text,text,text,boolean,timestamptz,text,uuid,text,
  text,text,text[],text,text,uuid,timestamptz,text,text,text,
  double precision,double precision,text
) from public, anon;
grant execute on function public.create_project_hse_event(
  uuid,uuid,uuid,text,text,text,text,text,boolean,timestamptz,text,uuid,text,
  text,text,text[],text,text,uuid,timestamptz,text,text,text,
  double precision,double precision,text
) to authenticated;

notify pgrst, 'reload schema';
