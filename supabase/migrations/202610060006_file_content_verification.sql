-- files.sha256 was recorded from the browser and compared only with the browser's own
-- reservation, so it was a client claim rather than proof of what is stored. Upload
-- completion now hashes the stored object server-side and refuses a mismatch; this column
-- records when that verification happened. Rows created before it stay null: their hash is
-- the value the uploading device declared, not a server-verified digest.

begin;

alter table public.files
  add column if not exists content_verified_at timestamptz;

comment on column public.files.sha256 is
  'SHA-256 of the file content. Server-verified against the stored object when content_verified_at is set; otherwise the value declared by the uploading device.';
comment on column public.files.content_verified_at is
  'When trusted server code hashed the stored object and confirmed it matches sha256. Null for files completed before server-side verification existed.';

-- A browser session can neither claim nor clear that verification.
create or replace function app_private.validate_browser_file_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' and (
      new.status <> 'pending' or new.storage_object_key is not null or new.storage_parent_key is not null
      or new.sha256 is not null or new.size_bytes <> 0 or new.content_verified_at is not null
    ) then
      raise exception 'Browser may only reserve pending file metadata' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.storage_provider is distinct from old.storage_provider
      or new.storage_object_key is distinct from old.storage_object_key
      or new.storage_parent_key is distinct from old.storage_parent_key
      or new.sha256 is distinct from old.sha256
      or new.size_bytes is distinct from old.size_bytes
      or new.status is distinct from old.status
      or new.content_verified_at is distinct from old.content_verified_at
    ) then
      raise exception 'Only the storage service may change file storage state' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

commit;
