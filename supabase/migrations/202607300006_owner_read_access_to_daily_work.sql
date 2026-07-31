-- The owner must be able to see what is going on, not only sign the result.
--
-- The 'client' project role (the company owner / opdrachtgever) only carried
-- reports.readapproved, reports.sign and the submission-review rights. That left the
-- owner unable to read day closeouts, findings, inspections, HSE events and registers,
-- so the workspace views built for them were silently empty.
--
-- This grants read-only visibility. No create, edit, verify or manage right is added:
-- the owner observes and decides on submissions; supervision still records the facts.

begin;

insert into public.role_permissions (organization_id, role_id, permission_code)
select role.organization_id, role.id, permission_code
from public.roles role
cross join lateral unnest(array[
  'records.read',
  'reports.read',
  'attendance.read',
  'actions.read',
  'inspections.read',
  'findings.read',
  'hse.read',
  'files.read',
  'audit.read'
]) permission_code
where role.scope = 'project'
  and role.code = 'client'
  and exists (select 1 from public.permissions permission where permission.code = permission_code)
on conflict do nothing;

-- Keep newly created project roles consistent with the grant above.
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
    from unnest(
      case new.code
        when 'supervisor' then array[
          'inspections.read','inspections.manage','findings.read','findings.create',
          'hse.read','hse.manage','files.read','files.manage','reports.sign'
        ]
        when 'lead_supervisor' then array[
          'templates.manage','inspections.read','inspections.manage','inspections.review',
          'findings.read','findings.create','findings.manage','findings.verify',
          'hse.read','hse.manage','files.read','files.manage','reports.sign','reports.distribute'
        ]
        when 'contractor' then array['files.manage','reports.sign']
        when 'project_manager' then array[
          'templates.manage','inspections.read','inspections.manage','inspections.review',
          'findings.read','findings.create','findings.manage','findings.verify',
          'hse.read','hse.manage','files.read','files.manage','reports.sign','reports.distribute',
          'notifications.manage'
        ]
        -- Read-only observation for the owner, plus the signing right they already had.
        when 'client' then array[
          'reports.sign','records.read','reports.read','attendance.read','actions.read',
          'inspections.read','findings.read','hse.read','files.read','audit.read'
        ]
        when 'quality_hse_manager' then array[
          'templates.manage','inspections.read','inspections.manage','inspections.review',
          'findings.read','findings.create','findings.manage','findings.verify',
          'hse.read','hse.manage','files.read','files.manage','reports.sign'
        ]
        else array[]::text[]
      end
    ) permission_code
    where exists (select 1 from public.permissions permission where permission.code = permission_code)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

commit;
