-- Developer package v5 (25-11-2026), START HERE "Record IDs": every new record gets
-- <PROJECT CODE>-<FORM CODE>-<YYYY>-<NNNN>, for example CDC01-ISS-2026-0001. The number is assigned by
-- the database when the record is created, one sequence per project, form and year, and is never reused.
-- Records that already exist keep the number they were given: links, shares and printed copies refer to it.

create or replace function public.v5_form_code(p_table text, p_type text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_table = 'findings' then case when p_type = 'ncr' then 'NCR' else 'ISS' end
    when p_table = 'hse_events' then case when p_type = 'incident' then 'INC' else 'HSE' end
    when p_table = 'inspections' then 'INS'
    when p_table = 'project_register_entries' then case p_type
      when 'delivery' then 'MAT'
      when 'technical_instruction' then 'TI'
      when 'change_order' then 'CO'
      when 'delay_report' then 'PDR'
      when 'lessons_learned' then 'LL'
      when 'agreement' then 'AGR'
      when 'works_ongoing' then 'WO'
      when 'works_completed' then 'WC'
      else null end
    else null end
$$;

create or replace function public.assign_v5_record_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_type text;
  v_code text;
  v_project text;
  v_year text;
  v_prefix text;
  v_next integer;
  v_number text;
  v_supplied text;
begin
  if tg_table_name = 'findings' then v_type := new.finding_type; v_supplied := new.finding_number;
  elsif tg_table_name = 'hse_events' then v_type := new.event_type; v_supplied := new.event_number;
  elsif tg_table_name = 'project_register_entries' then v_type := new.register_type; v_supplied := new.entry_number;
  else v_type := null; v_supplied := new.inspection_number;
  end if;
  -- The creation functions of earlier releases hand in a number of the old shape (Q-2026-0001, WO-0001); that
  -- number is replaced by the v5 one. A row written without a session (a restore, an import, a seed), and
  -- a number that is not of the old shape, is kept as it is, so existing references stay valid.
  if coalesce(btrim(v_supplied), '') <> '' then
    if (select auth.uid()) is null or v_supplied !~ '^[A-Z]{1,4}-([0-9]{4}-)?[0-9]{4}$' then
      return new;
    end if;
  end if;
  v_code := public.v5_form_code(tg_table_name, v_type);
  if v_code is null then
    return new;
  end if;

  select upper(btrim(project.code)) into v_project from public.projects project where project.id = new.project_id;
  if coalesce(v_project, '') = '' then
    return new;
  end if;
  v_year := to_char(timezone('America/Paramaribo', now()), 'YYYY');
  v_prefix := v_project || '-' || v_code || '-' || v_year || '-';
  perform pg_advisory_xact_lock(hashtextextended('v5-record-id:' || v_prefix, 0));

  if tg_table_name = 'findings' then
    select coalesce(max(substring(x.finding_number from '([0-9]+)$')::integer), 0) + 1 into v_next
      from public.findings x
      where x.project_id = new.project_id and left(x.finding_number, length(v_prefix)) = v_prefix;
    v_number := v_prefix || lpad(v_next::text, 4, '0');
    new.finding_number := v_number;
  elsif tg_table_name = 'hse_events' then
    select coalesce(max(substring(x.event_number from '([0-9]+)$')::integer), 0) + 1 into v_next
      from public.hse_events x
      where x.project_id = new.project_id and left(x.event_number, length(v_prefix)) = v_prefix;
    v_number := v_prefix || lpad(v_next::text, 4, '0');
    new.event_number := v_number;
  elsif tg_table_name = 'inspections' then
    select coalesce(max(substring(x.inspection_number from '([0-9]+)$')::integer), 0) + 1 into v_next
      from public.inspections x
      where x.project_id = new.project_id and left(x.inspection_number, length(v_prefix)) = v_prefix;
    v_number := v_prefix || lpad(v_next::text, 4, '0');
    new.inspection_number := v_number;
  else
    select coalesce(max(substring(x.entry_number from '([0-9]+)$')::integer), 0) + 1 into v_next
      from public.project_register_entries x
      where x.project_id = new.project_id and left(x.entry_number, length(v_prefix)) = v_prefix;
    v_number := v_prefix || lpad(v_next::text, 4, '0');
    new.entry_number := v_number;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_v5_record_id() from public, anon, authenticated;

drop trigger if exists assign_v5_record_id on public.findings;
create trigger assign_v5_record_id before insert on public.findings
  for each row execute function public.assign_v5_record_id();
drop trigger if exists assign_v5_record_id on public.hse_events;
create trigger assign_v5_record_id before insert on public.hse_events
  for each row execute function public.assign_v5_record_id();
drop trigger if exists assign_v5_record_id on public.inspections;
create trigger assign_v5_record_id before insert on public.inspections
  for each row execute function public.assign_v5_record_id();
drop trigger if exists assign_v5_record_id on public.project_register_entries;
create trigger assign_v5_record_id before insert on public.project_register_entries
  for each row execute function public.assign_v5_record_id();
