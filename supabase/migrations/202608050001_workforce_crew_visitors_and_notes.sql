-- §4.3 of the product plan asks more of the workforce register than the app recorded.
--
-- "Aanwezige partijen en mankracht" wants organisation, crew, discipline and headcount, the
-- shift, a visitor registration, and an explanation whenever the manning deviates. The table
-- carried organisation, discipline, shift and headcount, plus a `notes` column nothing ever
-- wrote to. Crew and visitors had nowhere to go at all.
--
-- Three nullable additions to the existing table, deliberately not a second table: row level
-- security, the creator guard, the touch trigger and the audit capture already cover
-- attendance_entries, and a visitor is an attendance fact of the same day report.

begin;

alter table public.attendance_entries
  add column if not exists entry_type text not null default 'workforce'
    check (entry_type in ('workforce', 'visitor')),
  -- The gang or crew within an organisation: "ploeg 2", "night shift", "team Ramdin".
  add column if not exists crew text
    check (crew is null or char_length(crew) between 1 and 100),
  -- Who visited. Only meaningful on a visitor row; a workforce row counts people instead.
  add column if not exists visitor_name text
    check (visitor_name is null or char_length(visitor_name) between 2 and 160);

comment on column public.attendance_entries.entry_type is
  'workforce = people working on site; visitor = a recorded site visit (product plan 4.3).';
comment on column public.attendance_entries.crew is
  'Optional gang or crew within the organisation (product plan 4.3).';
comment on column public.attendance_entries.notes is
  'Explanation when the manning deviates from what was planned (product plan 4.3).';

-- A visitor is registered by name; the crew that is counted is not.
alter table public.attendance_entries
  drop constraint if exists attendance_entries_visitor_named;
alter table public.attendance_entries
  add constraint attendance_entries_visitor_named
  check (entry_type <> 'visitor' or visitor_name is not null);

-- Reading a day's visitors separately from its workforce has to stay cheap.
create index if not exists attendance_entry_type_idx
  on public.attendance_entries (day_report_id, entry_type);

commit;
