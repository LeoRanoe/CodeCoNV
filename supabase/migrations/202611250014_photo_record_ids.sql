-- Developer package v5 (25-11-2026), START HERE "Record IDs" and the Photos form: a photo has a Record ID in the auto bar,
-- <PROJECT CODE>-PH-<YYYY>-<NNNN>, assigned by the database when the photo is registered, one sequence per project and year.
--
-- Decision (V5-DECISION-REGISTER D-07): the photo number lives on visual_captures, the table that already holds a photo's
-- title, place, purpose and date. Photos that exist get a number once, in the order they were registered (created_at, id),
-- so a restore of this migration gives the same numbers. A number is never reused or changed afterwards.

alter table public.visual_captures add column if not exists capture_number text;
comment on column public.visual_captures.capture_number is
  'Record ID of the photo: <PROJECT CODE>-PH-<YYYY>-<NNNN>, assigned on insert (assign_photo_record_id), unique per project.';

-- Existing photos: numbered in registration order, per project and year of registration (Paramaribo time).
with ranked as (
  select capture.id,
    upper(btrim(project.code)) as project_code,
    to_char(timezone('America/Paramaribo', capture.created_at), 'YYYY') as registered_year,
    row_number() over (
      partition by capture.project_id, to_char(timezone('America/Paramaribo', capture.created_at), 'YYYY')
      order by capture.created_at, capture.id
    ) as sequence_number
  from public.visual_captures capture
  join public.projects project on project.id = capture.project_id
  where capture.capture_number is null and coalesce(btrim(project.code), '') <> ''
)
update public.visual_captures capture
set capture_number = ranked.project_code || '-PH-' || ranked.registered_year || '-' || lpad(ranked.sequence_number::text, 4, '0')
from ranked
where capture.id = ranked.id;

create unique index if not exists visual_captures_capture_number_key
  on public.visual_captures (project_id, capture_number)
  where capture_number is not null;

create or replace function public.assign_photo_record_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project text;
  v_year text;
  v_prefix text;
  v_next integer;
begin
  -- A number that was supplied (a restore, an import) is kept; blank is the normal case.
  if coalesce(btrim(new.capture_number), '') <> '' then
    return new;
  end if;
  select upper(btrim(project.code)) into v_project from public.projects project where project.id = new.project_id;
  if coalesce(v_project, '') = '' then
    return new;
  end if;
  v_year := to_char(timezone('America/Paramaribo', coalesce(new.created_at, now())), 'YYYY');
  v_prefix := v_project || '-PH-' || v_year || '-';
  -- Two photos registered at the same moment (an offline replay) take turns: one sequence per project and year.
  perform pg_advisory_xact_lock(hashtextextended('v5-record-id:' || v_prefix, 0));
  select coalesce(max(substring(capture.capture_number from '([0-9]+)$')::integer), 0) + 1 into v_next
    from public.visual_captures capture
    where capture.project_id = new.project_id and left(capture.capture_number, length(v_prefix)) = v_prefix;
  new.capture_number := v_prefix || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

revoke all on function public.assign_photo_record_id() from public, anon, authenticated;

drop trigger if exists assign_photo_record_id on public.visual_captures;
create trigger assign_photo_record_id before insert on public.visual_captures
  for each row execute function public.assign_photo_record_id();

-- The number is part of the record and is not edited by anyone afterwards.
create or replace function public.protect_photo_record_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.capture_number is not null and new.capture_number is distinct from old.capture_number then
    raise exception 'The record ID of a photo does not change' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_photo_record_id on public.visual_captures;
create trigger protect_photo_record_id before update on public.visual_captures
  for each row execute function public.protect_photo_record_id();

notify pgrst, 'reload schema';
