-- Word 13 / WD-181-02: Management keeps the project information.
--
-- "Project name/code, client, site address, dates, timezone, currency and status". The project row
-- already holds name, code, location (the site address), client, time zone and status; this adds
-- the two dates and the currency. Editing stays under the existing projects_update policy
-- (project.configure): nothing here widens who may change a project.
--
--   start_date / end_date   planned start and planned completion (end not before start)
--   currency                ISO 4217 code of the project's contract currency, e.g. SRD, USD, EUR
--
-- The time zone is checked against the database's zone list whenever it changes, so a typo cannot
-- reach the reports. Existing rows keep their values; the new columns start empty.
-- Rollback: drop trigger projects_validate_information on public.projects, drop function
-- app_private.validate_project_information(), then drop the constraints and the three columns.

alter table public.projects
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists currency text;

alter table public.projects drop constraint if exists projects_dates_check;
alter table public.projects add constraint projects_dates_check
  check (start_date is null or end_date is null or end_date >= start_date);
alter table public.projects drop constraint if exists projects_currency_check;
alter table public.projects add constraint projects_currency_check
  check (currency is null or currency ~ '^[A-Z]{3}$');

create or replace function app_private.validate_project_information()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.timezone is distinct from old.timezone
      and not exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = new.timezone) then
    raise exception 'Unknown time zone: %', new.timezone using errcode = '22023';
  end if;
  new.name := btrim(new.name);
  new.location := btrim(coalesce(new.location, ''));
  new.client_name := nullif(btrim(coalesce(new.client_name, '')), '');
  new.currency := nullif(upper(btrim(coalesce(new.currency, ''))), '');
  return new;
end;
$$;

drop trigger if exists projects_validate_information on public.projects;
create trigger projects_validate_information before update on public.projects
  for each row execute function app_private.validate_project_information();
