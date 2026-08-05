-- Re-assert signature storage for installations that were deployed while PostgREST was
-- still serving an older schema cache. All additions are nullable and safe to repeat.

alter table public.report_signatures
  add column if not exists signature_image text
  check (signature_image is null or char_length(signature_image) between 40 and 200000);

alter table public.inspections
  add column if not exists signed_by text
  check (signed_by is null or char_length(signed_by) between 2 and 120);
alter table public.inspections
  add column if not exists signed_at timestamptz;
alter table public.inspections
  add column if not exists signature_image text
  check (signature_image is null or char_length(signature_image) between 40 and 200000);

-- The signature-on-record and contractor-signature migrations store their values in the
-- existing findings.issue_management jsonb column, so they need no physical columns to
-- re-assert. This final notification also refreshes every earlier migration that created
-- client-readable tables or columns without notifying PostgREST itself.
notify pgrst, 'reload schema';
