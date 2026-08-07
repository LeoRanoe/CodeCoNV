-- Every form the client fills in is signed by the person who wrote it. The day closeout
-- already carried the contractor's acknowledgement of a delay; this adds the signature of
-- the supervisor who closed the day, and the same for the workforce register.
--
-- All columns are nullable, so every record written before today stays valid, readable and
-- printable. Nothing is dropped or renamed.

alter table public.day_closeouts
  add column if not exists signed_by text,
  add column if not exists signed_at timestamptz,
  add column if not exists signature_image text;

alter table public.day_closeouts
  drop constraint if exists day_closeouts_signed_by_length_check,
  add constraint day_closeouts_signed_by_length_check
    check (signed_by is null or char_length(signed_by) between 2 and 240),
  drop constraint if exists day_closeouts_signature_image_length_check,
  add constraint day_closeouts_signature_image_length_check
    check (signature_image is null or char_length(signature_image) between 32 and 300000),
  drop constraint if exists day_closeouts_signature_complete_check,
  add constraint day_closeouts_signature_complete_check
    check (
      (signed_by is null and signed_at is null and signature_image is null)
      or (signed_by is not null and signed_at is not null and signature_image is not null)
    );

alter table public.attendance_entries
  add column if not exists signed_by text,
  add column if not exists signed_at timestamptz,
  add column if not exists signature_image text;

alter table public.attendance_entries
  drop constraint if exists attendance_entries_signed_by_length_check,
  add constraint attendance_entries_signed_by_length_check
    check (signed_by is null or char_length(signed_by) between 2 and 240),
  drop constraint if exists attendance_entries_signature_image_length_check,
  add constraint attendance_entries_signature_image_length_check
    check (signature_image is null or char_length(signature_image) between 32 and 300000),
  drop constraint if exists attendance_entries_signature_complete_check,
  add constraint attendance_entries_signature_complete_check
    check (
      (signed_by is null and signed_at is null and signature_image is null)
      or (signed_by is not null and signed_at is not null and signature_image is not null)
    );

-- Without this the client reads a schema cache that has never heard of these columns,
-- which is the "column does not exist" error the app used to show.
notify pgrst, 'reload schema';
