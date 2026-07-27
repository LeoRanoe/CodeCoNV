alter table public.day_closeouts
  add column if not exists work_ongoing text;

comment on column public.day_closeouts.work_ongoing is
  'Work started during the reporting day that was still ongoing at closeout.';
