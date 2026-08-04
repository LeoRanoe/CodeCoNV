-- Every document needs its own number, and that number has to be findable.
--
-- Findings, inspections, HSE events, register items and day reports were already numbered
-- by the database. Files were not: a photo, a drawing or an uploaded specification could
-- only be named, and two site photos taken a minute apart are named the same everywhere.
-- The client asked for one unique code per document, so that anything on paper or in an
-- e-mail can be typed into the app and lands on the record it belongs to.
--
-- The code is assigned by the database itself, in the project's own timezone, per project
-- and per year: PHO-2026-0001 for a photo, DWG-2026-0004 for a drawing, DOC-2026-0007 for
-- everything else. Every upload path — the app, the storage gateway and the external
-- share page — goes through this trigger, so no file can exist without one.

alter table public.files
  add column if not exists document_code text;

comment on column public.files.document_code is
  'Unique per project document code (PHO-/DWG-/DOC-YYYY-NNNN) used to look the file up in the app.';

create unique index if not exists files_project_document_code_key
  on public.files (project_id, document_code)
  where document_code is not null;

create or replace function app_private.assign_file_document_code()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_prefix text;
  v_year integer;
  v_sequence integer;
  v_timezone text;
begin
  if new.document_code is not null and btrim(new.document_code) <> '' then
    return new;
  end if;

  v_prefix := case new.category
    when 'photo' then 'PHO'
    when 'drawing' then 'DWG'
    when 'certificate' then 'CRT'
    when 'report' then 'RPT'
    when 'evidence' then 'EVD'
    when 'backup' then 'BAK'
    when 'export' then 'EXP'
    else 'DOC'
  end;

  select coalesce(project.timezone, 'America/Paramaribo') into v_timezone
  from public.projects project where project.id = new.project_id;
  v_year := extract(year from (now() at time zone coalesce(v_timezone, 'America/Paramaribo')))::integer;

  -- The same lock the other numbering uses, so two uploads at once cannot claim one code.
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text || ':files', 0));
  select coalesce(max(substring(file.document_code from '([0-9]+)$')::integer), 0) + 1
    into v_sequence
  from public.files file
  where file.project_id = new.project_id
    and file.document_code ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$');

  new.document_code := v_prefix || '-' || v_year || '-' || lpad(v_sequence::text, 4, '0');
  return new;
end;
$$;

revoke all on function app_private.assign_file_document_code() from public, anon, authenticated;

drop trigger if exists files_document_code on public.files;
create trigger files_document_code
  before insert on public.files
  for each row execute function app_private.assign_file_document_code();

-- The files that were uploaded before this migration get their code in upload order, so
-- the numbering of an existing project stays readable instead of starting at random.
do $$
declare
  v_file record;
  v_prefix text;
  v_year integer;
  v_sequence integer;
begin
  for v_file in
    select file.id, file.project_id, file.category, file.created_at,
      coalesce(project.timezone, 'America/Paramaribo') as timezone
    from public.files file
    join public.projects project on project.id = file.project_id
    where file.document_code is null
    order by file.project_id, file.created_at, file.id
  loop
    v_prefix := case v_file.category
      when 'photo' then 'PHO'
      when 'drawing' then 'DWG'
      when 'certificate' then 'CRT'
      when 'report' then 'RPT'
      when 'evidence' then 'EVD'
      when 'backup' then 'BAK'
      when 'export' then 'EXP'
      else 'DOC'
    end;
    v_year := extract(year from (v_file.created_at at time zone v_file.timezone))::integer;
    select coalesce(max(substring(file.document_code from '([0-9]+)$')::integer), 0) + 1
      into v_sequence
    from public.files file
    where file.project_id = v_file.project_id
      and file.document_code ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$');
    update public.files
      set document_code = v_prefix || '-' || v_year || '-' || lpad(v_sequence::text, 4, '0')
      where id = v_file.id;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
