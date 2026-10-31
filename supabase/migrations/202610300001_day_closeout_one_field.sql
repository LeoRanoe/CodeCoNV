-- Client feedback 30-10-2026 13:31-13:32: "Works ongoing" is one input box ("What is in progress,
-- and where?") plus the buildings it takes place in. Nothing else may stand in the way of saving it.
--
-- A day closeout used to refuse a row without a weather line (5+ characters), a "work completed"
-- text (10+), a plan for tomorrow (10+) and a day summary of 20+ characters. The first entry of
-- the day from the Works ongoing tile therefore could not be saved with the one field the client
-- asked for, and the form asked for four other things instead.
--
-- The four columns stay NOT NULL and keep their upper limits; only the lower limits go, so an
-- unanswered question is stored as an empty string and the report says nothing about it (the
-- daily report model already skips empty values). Submitting the day for review keeps its own
-- gates (project start check and a closeout per building), which this migration does not touch.
--
-- Widening only: every existing row still satisfies the new checks.
--
-- Rollback: put the old checks back with
--   alter table public.day_closeouts drop constraint day_closeouts_day_summary_check,
--     add constraint day_closeouts_day_summary_check check (char_length(day_summary) between 20 and 700);
--   (same for weather_summary 5..180, work_performed 10..1200, tomorrow_plan 10..1000)
-- after the rows saved through the new form have been completed: the add fails while a row is
-- shorter than the old minimum.
alter table public.day_closeouts
  drop constraint if exists day_closeouts_day_summary_check,
  drop constraint if exists day_closeouts_weather_summary_check,
  drop constraint if exists day_closeouts_work_performed_check,
  drop constraint if exists day_closeouts_tomorrow_plan_check;

alter table public.day_closeouts
  add constraint day_closeouts_day_summary_check check (char_length(day_summary) between 3 and 700),
  add constraint day_closeouts_weather_summary_check check (char_length(weather_summary) <= 180),
  add constraint day_closeouts_work_performed_check check (char_length(work_performed) <= 1200),
  add constraint day_closeouts_tomorrow_plan_check check (char_length(tomorrow_plan) <= 1000);
