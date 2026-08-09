-- Two register types the app writes but the database does not accept yet.
--
-- 1. lessons_learned. The Lessons Learned tile and form were added on 7 August, but the
--    register_type check constraint was never widened, so every attempt to save a lesson
--    learned fails on project_register_entries_register_type_check. This fixes that.
--
-- 2. delay_report. The client's own Project Delay Report (PDR): the delay that moves the
--    finish date of the works, as opposed to the hours lost in a day, which stay in the
--    daily closeout. It carries its own baseline and revised finish dates, the status of
--    the works on the day they should have been finished, the contractor's acknowledgement
--    and a completion box — each of the two status boxes evidenced by a photo.
--
-- Both are ordinary project registers, not controlled documents: they are drawn up by
-- CODECO on site, not exchanged as a numbered contract document with a formal response
-- code, so valid_controlled_register_details deliberately does not apply to them.

begin;

alter table public.project_register_entries
  drop constraint if exists project_register_entries_register_type_check;

alter table public.project_register_entries
  add constraint project_register_entries_register_type_check check (
    register_type in (
      'equipment','delivery','test','variation','delay','communication','risk',
      'document','drawing','wcr','rfi','submittal','site_instruction','meeting',
      'correspondence','cost','declaration','rfa','inspection_request','boq',
      'punch_list','notepad','agreement','technical_instruction','change_order',
      'contract','specification','environmental_report','lessons_learned',
      'delay_report'
    )
  );

-- The number each of these carries on the client's own paper form. Without this they fall
-- through to the generic prefix and come out as DELA-0001 and LESS-0001, which is not what
-- anyone on site is holding.
create or replace function public.create_project_register_entry(
  p_project_id uuid,
  p_building_id uuid,
  p_day_report_id uuid,
  p_register_type text,
  p_title text,
  p_occurred_at timestamptz,
  p_due_at timestamptz,
  p_responsible_party_id uuid,
  p_details jsonb,
  p_idempotency_key text
)
returns public.project_register_entries
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_entry public.project_register_entries;
  v_sequence integer;
  v_prefix text;
  v_project_code text;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'records.create') then
    raise exception 'Missing records.create permission' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 3 then
    raise exception 'A register title is required' using errcode = '22023';
  end if;
  if not app_private.valid_controlled_register_details(p_register_type, coalesce(p_details, '{}'::jsonb)) then
    raise exception 'Controlled document fields are incomplete or invalid' using errcode = '22023';
  end if;

  select entry.* into v_entry
  from public.project_register_entries entry
  where entry.project_id = p_project_id
    and entry.created_by = v_actor
    and entry.idempotency_key = p_idempotency_key;
  if found then return v_entry; end if;

  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if p_building_id is not null and not exists (
    select 1 from public.buildings building
    where building.id = p_building_id and building.project_id = p_project_id
  ) then raise exception 'Building not found in project' using errcode = '23503'; end if;
  if p_day_report_id is not null and not exists (
    select 1 from public.day_reports report
    where report.id = p_day_report_id and report.project_id = p_project_id
  ) then raise exception 'Day report not found in project' using errcode = '23503'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':register:' || p_register_type, 0));
  select count(*) + 1 into v_sequence
  from public.project_register_entries entry
  where entry.project_id = p_project_id and entry.register_type = p_register_type;

  v_project_code := regexp_replace(upper(v_project.code), '[^A-Z0-9-]+', '', 'g');
  v_prefix := case p_register_type
    when 'rfi' then 'RFI-' || v_project_code
    when 'rfa' then 'RFA-' || v_project_code
    when 'inspection_request' then 'WIR-' || v_project_code
    when 'technical_instruction' then 'TI-' || v_project_code
    when 'change_order' then 'CO'
    -- The numbers the client writes on their own forms: PDR-0001, LL-0001.
    when 'delay_report' then 'PDR'
    when 'lessons_learned' then 'LL'
    when 'environmental_report' then 'ER'
    else upper(left(replace(p_register_type, '_', ''), 4))
  end;

  insert into public.project_register_entries (
    organization_id, project_id, building_id, day_report_id, register_type,
    entry_number, title, occurred_at, due_at, responsible_party_id, details,
    idempotency_key, created_by
  ) values (
    v_project.organization_id, v_project.id, p_building_id, p_day_report_id,
    p_register_type,
    v_prefix || '-' || lpad(
      v_sequence::text,
      case when p_register_type in (
        'rfi','rfa','inspection_request','technical_instruction',
        'change_order','environmental_report'
      ) then 3 else 4 end,
      '0'
    ),
    trim(p_title),
    coalesce(p_occurred_at, now()), p_due_at, p_responsible_party_id,
    coalesce(p_details, '{}'::jsonb), p_idempotency_key, v_actor
  ) returning * into v_entry;
  return v_entry;
end;
$$;

notify pgrst, 'reload schema';

commit;
