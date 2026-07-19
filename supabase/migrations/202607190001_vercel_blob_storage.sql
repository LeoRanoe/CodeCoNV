begin;

alter table public.files add column storage_provider text;
update public.files
set storage_provider = case when drive_file_id is null then 'vercel_blob' else 'google_drive' end;
alter table public.files alter column storage_provider set default 'vercel_blob';
alter table public.files alter column storage_provider set not null;
alter table public.files add constraint files_storage_provider_check
  check (storage_provider in ('vercel_blob', 'google_drive'));
alter table public.files rename column drive_file_id to storage_object_key;
alter table public.files rename column drive_parent_id to storage_parent_key;

comment on column public.files.storage_provider is 'Private object-storage provider; new uploads use vercel_blob.';
comment on column public.files.storage_object_key is 'Provider object pathname, never a public authorization URL.';
comment on column public.files.storage_parent_key is 'Optional legacy provider parent key.';

alter table public.backup_runs add column storage_provider text;
update public.backup_runs
set storage_provider = case when drive_file_id is null then 'vercel_blob' else 'google_drive' end;
alter table public.backup_runs alter column storage_provider set default 'vercel_blob';
alter table public.backup_runs alter column storage_provider set not null;
alter table public.backup_runs add constraint backup_runs_storage_provider_check
  check (storage_provider in ('vercel_blob', 'google_drive'));
alter table public.backup_runs rename column drive_file_id to storage_object_key;

alter table app_private.security_rate_limits
  drop constraint security_rate_limits_action_code_check;
alter table app_private.security_rate_limits
  add constraint security_rate_limits_action_code_check
  check (action_code in ('admin_invite','manual_backup','restore_dry_run','blob_upload'));

create or replace function app_private.validate_browser_file_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' and (
      new.status <> 'pending' or new.storage_object_key is not null or new.storage_parent_key is not null
      or new.sha256 is not null or new.size_bytes <> 0
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
    ) then
      raise exception 'Only the storage service may change file storage state' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.can_manage_project_files(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select (select auth.uid()) is not null
    and app_private.has_project_permission(p_project_id, 'files.manage');
$$;

revoke all on function public.can_manage_project_files(uuid) from public, anon;
grant execute on function public.can_manage_project_files(uuid) to authenticated;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.create_manual_backup_export(uuid,uuid,text)'::regprocedure)
    into function_definition;
  execute replace(
    function_definition,
    'Bestandsbytes staan uitsluitend in private Google Drive; deze export bevat alleen het manifest.',
    'Bestandsbytes staan uitsluitend in private Vercel Blob; deze export bevat alleen het manifest.'
  );
end;
$migration$;

update public.production_readiness_items set
  code = 'ACC-VERCEL-STORAGE',
  title = 'Vercel Blob onder CODECO-beheer',
  description = 'Gebruik een CODECO-beheerd Vercel-team en koppel een private Blob-store aan het productieproject.',
  owner_hint = 'CODECO IT / Vercel-beheerder'
where code = 'ACC-CLOUDFLARE';

update public.production_readiness_items set
  code = 'CFG-BLOB-PRIVATE',
  title = 'Private Blob-store',
  description = 'Controleer dat de Blob-store private is en uitsluitend met de productie- en noodzakelijke previewomgevingen is verbonden.',
  owner_hint = 'CODECO IT / ontwikkelaar'
where code = 'ACC-GOOGLE-STORAGE';

update public.production_readiness_items set
  code = 'CFG-BLOB-PROJECT',
  title = 'Vercel Blob-projectkoppeling',
  description = 'Koppel de private Blob-store aan de webapp zodat Vercel de korte OIDC-rechten en store-ID automatisch beheert.',
  owner_hint = 'Vercel-beheerder / ontwikkelaar'
where code = 'CFG-GOOGLE-OAUTH';

update public.production_readiness_items set
  code = 'CFG-BLOB-ROUTES',
  title = 'Private upload en download testen',
  description = 'Test een geautoriseerde upload en download en bevestig dat een gebruiker zonder projectrecht geen bestandsbytes kan openen.',
  owner_hint = 'Ontwikkelaar / CODECO IT'
where code = 'CFG-GATEWAY-SECRETS';

update public.production_readiness_items set
  code = 'OPS-BLOB-QUOTA',
  title = 'Blob-gebruik en kostenlimiet',
  description = 'Controleer Blob-opslag en dataverkeer in Vercel en leg waarschuwingen en een verantwoordelijke vast.',
  owner_hint = 'CODECO IT / Vercel-beheerder'
where code = 'OPS-DRIVE-QUOTA';

commit;
