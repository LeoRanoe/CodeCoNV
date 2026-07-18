begin;

-- Formal records are written only through the validated RPCs. Their SELECT
-- policies remain active; SECURITY DEFINER does not replace the explicit
-- permission checks already present in every workflow function.
alter function public.freeze_report_version(uuid,text,jsonb,text,jsonb,text) security definer;
alter function public.review_day_report(uuid,text,text,text) security definer;
alter function public.sign_report_version(uuid,text,text,text,text) security definer;
alter function public.record_report_distribution(uuid,text,text,text,boolean) security definer;
alter function public.start_report_revision(uuid,text) security definer;

revoke insert on public.report_versions from authenticated;
revoke insert on public.report_reviews from authenticated;
revoke insert on public.report_signatures from authenticated;
revoke insert, update on public.report_distributions from authenticated;

create or replace function app_private.validate_report_version_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_expected jsonb;
  v_expected_sha text;
begin
  v_expected := public.build_day_report_snapshot(new.day_report_id);
  if (new.snapshot - 'frozen_at') <> (v_expected - 'frozen_at') then
    raise exception 'Report snapshot does not match the current central report data' using errcode = '23514';
  end if;
  v_expected_sha := encode(extensions.digest(convert_to(new.snapshot::text, 'UTF8'), 'sha256'), 'hex');
  if new.sha256 <> v_expected_sha then
    raise exception 'Report snapshot checksum is invalid' using errcode = '23514';
  end if;
  if new.signature_metadata is not null or new.signed_at is not null then
    raise exception 'Signatures must be stored in the append-only report_signatures register' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function app_private.validate_report_review_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare v_status text;
begin
  if new.created_by <> (select auth.uid())
    or not app_private.has_project_permission(new.project_id, 'reports.review') then
    raise exception 'Invalid report reviewer' using errcode = '42501';
  end if;
  select report.status into v_status from public.day_reports report where report.id = new.day_report_id;
  if (new.decision = 'approved' and (v_status <> 'approved' or new.report_version_id is null))
    or (new.decision in ('returned','rejected') and v_status not in ('returned','revised','in_progress'))
    or (new.decision = 'started' and v_status <> 'in_review') then
    raise exception 'Review decision does not match the central report status' using errcode = '23514';
  end if;
  if new.report_version_id is not null and not exists (
    select 1 from public.report_versions version
    where version.id = new.report_version_id and version.day_report_id = new.day_report_id
  ) then
    raise exception 'Review version does not belong to this report' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function app_private.validate_report_signature_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare v_report public.day_reports;
begin
  select report.* into v_report from public.day_reports report where report.id = new.day_report_id;
  if not found or v_report.project_id <> new.project_id or v_report.organization_id <> new.organization_id
    or v_report.status not in ('approved','signed') then
    raise exception 'Report is not available for signing' using errcode = '23514';
  end if;
  if new.created_by <> (select auth.uid()) or new.signer_user_id <> (select auth.uid())
    or not app_private.has_project_permission(new.project_id, 'reports.sign') then
    raise exception 'Invalid report signer' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.report_versions version
    where version.id = new.report_version_id and version.day_report_id = new.day_report_id
      and version.revision = (select max(latest.revision) from public.report_versions latest where latest.day_report_id = new.day_report_id)
  ) then
    raise exception 'Only the latest frozen report version can be signed' using errcode = '23514';
  end if;
  if not app_private.has_organization_permission(new.organization_id, 'organization.manage') and not exists (
    select 1 from public.project_memberships membership
    join public.project_member_roles member_role on member_role.membership_id = membership.id
    join public.roles role on role.id = member_role.role_id
    where membership.project_id = new.project_id and membership.user_id = (select auth.uid())
      and membership.status = 'active' and role.code = new.signer_role
  ) then
    raise exception 'Signer role does not match project membership' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function app_private.validate_report_distribution_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare v_status text;
begin
  if new.created_by <> (select auth.uid())
    or not app_private.has_project_permission(new.project_id, 'reports.distribute') then
    raise exception 'Invalid report distributor' using errcode = '42501';
  end if;
  select report.status into v_status from public.day_reports report where report.id = new.day_report_id;
  if v_status not in ('signed','sent') then
    raise exception 'Only a signed report can be distributed' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.report_versions version
    where version.id = new.report_version_id and version.day_report_id = new.day_report_id
      and version.revision = (select max(latest.revision) from public.report_versions latest where latest.day_report_id = new.day_report_id)
  ) then
    raise exception 'Only the latest report version can be distributed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function app_private.validate_browser_file_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' and (
      new.status <> 'pending' or new.drive_file_id is not null or new.drive_parent_id is not null
      or new.sha256 is not null or new.size_bytes <> 0
    ) then
      raise exception 'Browser may only reserve pending file metadata' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.drive_file_id is distinct from old.drive_file_id
      or new.drive_parent_id is distinct from old.drive_parent_id
      or new.sha256 is distinct from old.sha256
      or new.size_bytes is distinct from old.size_bytes
      or new.status is distinct from old.status
    ) then
      raise exception 'Only the storage gateway may change file storage state' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists report_versions_snapshot_guard on public.report_versions;
create trigger report_versions_snapshot_guard before insert on public.report_versions
  for each row execute function app_private.validate_report_version_snapshot();
drop trigger if exists report_reviews_insert_guard on public.report_reviews;
create trigger report_reviews_insert_guard before insert on public.report_reviews
  for each row execute function app_private.validate_report_review_insert();
drop trigger if exists report_signatures_insert_guard on public.report_signatures;
create trigger report_signatures_insert_guard before insert on public.report_signatures
  for each row execute function app_private.validate_report_signature_insert();
drop trigger if exists report_distributions_insert_guard on public.report_distributions;
create trigger report_distributions_insert_guard before insert on public.report_distributions
  for each row execute function app_private.validate_report_distribution_insert();
drop trigger if exists files_storage_state_guard on public.files;
create trigger files_storage_state_guard before insert or update on public.files
  for each row execute function app_private.validate_browser_file_state();

commit;
