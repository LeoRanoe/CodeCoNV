-- 202607300001 granted the controlled-submission rights (RFI / RFA / WCR / inspection
-- request / technical instruction) to every *existing* project role, but never added them
-- to app_private.assign_operational_role_permissions(), and 202607300006 then replaced
-- that function without them. Every organization bootstrapped after 30 July therefore
-- created roles where the contractor could not see its own submissions and the owner,
-- lead supervisor, project manager and quality/HSE manager could not review them.
--
-- This restores one canonical default per project role (see
-- docs/operations/role-permission-matrix.md) and re-applies it idempotently to existing
-- roles. Only grants are added; nothing is revoked from any existing role.

begin;

create or replace function app_private.assign_operational_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.scope = 'project' then
    insert into public.role_permissions (organization_id, role_id, permission_code)
    select new.organization_id, new.id, permission_code
    from unnest(app_private.default_operational_role_permissions(new.code)) permission_code
    where exists (select 1 from public.permissions permission where permission.code = permission_code)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- The operational defaults per project role. The bootstrap function seeds the base
-- record/report rights; this list is what the trigger adds on top.
create or replace function app_private.default_operational_role_permissions(p_role_code text)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_role_code
    when 'supervisor' then array[
      'inspections.read','inspections.manage','findings.read','findings.create',
      'hse.read','hse.manage','files.read','files.manage','reports.sign'
    ]
    when 'lead_supervisor' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign','reports.distribute',
      'submissions.read','submissions.review'
    ]
    -- External contractor: submits its own controlled documents and evidence, reads what
    -- is shared with it. No internal records, no findings management, no verification.
    when 'contractor' then array[
      'files.read','files.manage','reports.sign','submissions.read'
    ]
    when 'project_manager' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign','reports.distribute',
      'notifications.manage','submissions.read','submissions.review'
    ]
    -- Owner / opdrachtgever: read-only visibility (202607300006), signs reports and
    -- decides on submissions. Never creates, edits, verifies or manages.
    when 'client' then array[
      'reports.sign','records.read','reports.read','attendance.read','actions.read',
      'inspections.read','findings.read','hse.read','files.read','audit.read',
      'submissions.read','submissions.review'
    ]
    when 'quality_hse_manager' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign',
      'submissions.read','submissions.review'
    ]
    else array[]::text[]
  end;
$$;

revoke all on function app_private.default_operational_role_permissions(text) from public, anon, authenticated;

insert into public.role_permissions (organization_id, role_id, permission_code)
select role.organization_id, role.id, permission_code
from public.roles role
cross join lateral unnest(app_private.default_operational_role_permissions(role.code)) permission_code
where role.scope = 'project'
  and exists (select 1 from public.permissions permission where permission.code = permission_code)
on conflict do nothing;

commit;
