-- Existing delay closeouts remain valid. New forms require this acknowledgement before
-- writing, while these nullable columns keep historical reports readable.

alter table public.day_closeouts
  add column if not exists delay_reason text,
  add column if not exists contractor_company text,
  add column if not exists contractor_signed_by text,
  add column if not exists contractor_signed_at timestamptz,
  add column if not exists contractor_signature_image text;

alter table public.day_closeouts
  drop constraint if exists day_closeouts_delay_reason_length_check,
  add constraint day_closeouts_delay_reason_length_check
    check (delay_reason is null or char_length(delay_reason) <= 1500),
  drop constraint if exists day_closeouts_contractor_company_length_check,
  add constraint day_closeouts_contractor_company_length_check
    check (contractor_company is null or char_length(contractor_company) between 2 and 240),
  drop constraint if exists day_closeouts_contractor_signed_by_length_check,
  add constraint day_closeouts_contractor_signed_by_length_check
    check (contractor_signed_by is null or char_length(contractor_signed_by) between 2 and 240),
  drop constraint if exists day_closeouts_contractor_signature_image_length_check,
  add constraint day_closeouts_contractor_signature_image_length_check
    check (contractor_signature_image is null or char_length(contractor_signature_image) between 32 and 300000),
  drop constraint if exists day_closeouts_contractor_signature_complete_check,
  add constraint day_closeouts_contractor_signature_complete_check
    check (
      (contractor_signed_by is null and contractor_signed_at is null and contractor_signature_image is null)
      or (contractor_signed_by is not null and contractor_signed_at is not null and contractor_signature_image is not null)
    );

notify pgrst, 'reload schema';
