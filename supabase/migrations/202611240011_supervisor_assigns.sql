-- Image 15 (client mind map, "Gebruikersrollen & Toegang"): Supervisor (CODECO) "Volledige toezicht-
-- en beheertoegang: formulieren aanmaken, toewijzen, beoordelen, verifiëren en rapporteren", and the
-- main process step 2 "Toewijzen aan aannemer / publiceren naar klant (waar nodig)".
-- The supervisor role therefore holds portal.share, so an NCR or TI a supervisor submits is assigned
-- to the responsible contractor (migration 202611240009) and the supervisor can assign by hand.
-- Applies to new organisations (defaults) and to the existing system supervisor roles.

create or replace function app_private.default_operational_role_permissions(p_role_code text)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_role_code
    when 'supervisor' then array[
      'inspections.read','inspections.manage','findings.read','findings.create',
      'hse.read','hse.manage','files.read','files.manage','reports.sign',
      'documents.read','documents.manage','portal.share'
    ]
    when 'lead_supervisor' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign','reports.distribute',
      'submissions.read','submissions.review',
      'documents.read','documents.manage','documents.review','portal.share'
    ]
    -- Legacy contractor role: the contractor portal, its own controlled submissions. No
    -- project-wide file access (that was every contractor's files and photos).
    when 'contractor' then array[
      'reports.sign','submissions.read','portal.contractor','portal.contractor.respond'
    ]
    when 'project_manager' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign','reports.distribute',
      'notifications.manage','submissions.read','submissions.review',
      'documents.read','documents.manage','documents.review','portal.share'
    ]
    -- Legacy owner role (202607300006): unchanged broad read access. The client portal roles
    -- below are the specification's client access; CODECO decides which one a client gets.
    when 'client' then array[
      'reports.sign','records.read','reports.read','attendance.read','actions.read',
      'inspections.read','findings.read','hse.read','files.read','audit.read',
      'submissions.read','submissions.review','documents.read'
    ]
    when 'quality_hse_manager' then array[
      'templates.manage','inspections.read','inspections.manage','inspections.review',
      'findings.read','findings.create','findings.manage','findings.verify',
      'hse.read','hse.manage','files.read','files.manage','reports.sign',
      'submissions.read','submissions.review',
      'documents.read','documents.manage','documents.review','portal.share'
    ]
    -- Contractor portal roles (6.4). portal.members is never a default: CODECO enables it.
    when 'contractor_admin' then array['portal.contractor','portal.contractor.respond']
    when 'contractor_representative' then array['portal.contractor','portal.contractor.respond']
    when 'contractor_readonly' then array['portal.contractor']
    -- Client portal roles (21.4).
    when 'client_viewer' then array['portal.client']
    when 'client_reviewer' then array['portal.client','portal.client.review']
    when 'client_approver' then array['portal.client','portal.client.review','portal.client.approve']
    when 'client_admin' then array['portal.client','portal.client.review']
    else array[]::text[]
  end;
$$;

revoke all on function app_private.default_operational_role_permissions(text) from public, anon, authenticated;

insert into public.role_permissions (organization_id, role_id, permission_code)
select role.organization_id, role.id, 'portal.share'
from public.roles role
where role.scope = 'project' and role.code = 'supervisor' and role.is_system
  and not exists (select 1 from public.role_permissions existing where existing.role_id = role.id and existing.permission_code = 'portal.share');
