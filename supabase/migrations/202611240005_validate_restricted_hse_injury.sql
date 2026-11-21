-- Validate the restricted fields after the existing HSE guard moves them into
-- hse_event_sensitive. Keep both the failure message and the event snapshot free of health data.
create function app_private.validate_stored_hse_injury(
  p_project_id uuid,
  p_event_id uuid,
  p_spec jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  restricted jsonb;
begin
  if (p_spec ->> 'incident_type') is distinct from 'Injury / Illness' then return; end if;
  select data into restricted
  from public.hse_event_sensitive
  where project_id = p_project_id and event_id = p_event_id;

  if coalesce(restricted ->> 'injury_classification', '') not in (
    'No Injury', 'First Aid', 'Medical Treatment', 'Restricted Work', 'Lost Time', 'Fatality'
  ) then
    raise exception 'Complete the restricted HSE fields: Injury classification' using errcode = '22023';
  end if;
  if coalesce(restricted ->> 'injury_nature', '') not in (
    'Cut', 'Bruise', 'Fracture', 'Burn', 'Sprain', 'Respiratory', 'Eye', 'Other'
  ) or (restricted ->> 'injury_nature' = 'Other' and btrim(coalesce(restricted ->> 'injury_nature_other', '')) = '') then
    raise exception 'Complete the restricted HSE fields: Nature of injury / illness' using errcode = '22023';
  end if;
  if coalesce(restricted ->> 'body_part', '') not in (
    'Head', 'Eye', 'Face', 'Hand', 'Arm', 'Back', 'Leg', 'Foot', 'Multiple', 'Other'
  ) or (restricted ->> 'body_part' = 'Other' and btrim(coalesce(restricted ->> 'body_part_other', '')) = '') then
    raise exception 'Complete the restricted HSE fields: Body part affected' using errcode = '22023';
  end if;
end;
$$;

create function app_private.check_hse_injury_on_current_save()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select auth.uid()) is not null and new.event_type = 'incident' and new.spec ? '_rules' then
    perform app_private.validate_stored_hse_injury(new.project_id, new.id, new.spec);
  end if;
  return new;
end;
$$;

create trigger hse_events_zzz_injury_validate
before insert or update of spec on public.hse_events
for each row execute function app_private.check_hse_injury_on_current_save();

create function app_private.check_hse_injury_on_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  incident_spec jsonb;
begin
  select spec into incident_spec
  from public.hse_events
  where project_id = new.project_id and id = new.record_id and event_type = 'incident';
  perform app_private.validate_stored_hse_injury(new.project_id, new.record_id, incident_spec);
  return new;
end;
$$;

create trigger record_signoff_events_validate_injury
before insert on public.record_signoff_events
for each row
when (new.record_kind = 'hse_event' and new.action in ('submit', 'resubmit'))
execute function app_private.check_hse_injury_on_submission();

revoke all on function app_private.validate_stored_hse_injury(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function app_private.check_hse_injury_on_current_save() from public, anon, authenticated;
revoke all on function app_private.check_hse_injury_on_submission() from public, anon, authenticated;
