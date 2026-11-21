begin;
set local search_path = extensions, pgtap, public;

-- The canonical role matrix (docs/operations/role-permission-matrix.md) for an organization
-- bootstrapped today. A change here is a deliberate authorization change and must update
-- that document in the same commit.
-- Isolation: only the first organization can be created without an administrator, so the file
-- starts from an empty tenant table; the rollback at the end puts any existing data back.
set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

select plan(10);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000016a1', 'authenticated', 'authenticated', 'matrix@example.test', now(), now());
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.bootstrap_organization('Matrix Org', 'matrix-org', 'Matrix Admin')$$,
  'a new organization can be bootstrapped'
);
reset role;

create temporary table matrix on commit drop as
select role.code, array_agg(grant_row.permission_code::text order by grant_row.permission_code) as permissions
from public.roles role
left join public.role_permissions grant_row on grant_row.role_id = role.id
where role.organization_id = (select id from public.organizations where slug = 'matrix-org')
group by role.code;

select is(
  (select permissions from matrix where code = 'organization_admin'),
  (select array_agg(code::text order by code) from public.permissions),
  'organization admin holds every permission'
);
select is(
  (select permissions from matrix where code = 'supervisor'),
  array['actions.create','actions.read','attendance.manage','attendance.read','documents.manage','documents.read','files.manage','files.read','findings.create','findings.read','hse.manage','hse.read','inspections.manage','inspections.read','records.create','records.edit','records.read','reports.create','reports.edit','reports.read','reports.sign'],
  'supervisor records the day but cannot manage, verify, freeze or administer'
);
select is(
  (select permissions from matrix where code = 'lead_supervisor'),
  array['actions.create','actions.manage','actions.read','attendance.manage','attendance.read','audit.read','documents.manage','documents.read','documents.review','files.manage','files.read','findings.create','findings.manage','findings.read','findings.verify','hse.manage','hse.read','inspections.manage','inspections.read','inspections.review','portal.share','records.create','records.edit','records.read','reports.create','reports.distribute','reports.edit','reports.freeze','reports.read','reports.review','reports.sign','submissions.read','submissions.review','templates.manage'],
  'lead supervisor manages and verifies findings and freezes reports'
);
select is(
  (select permissions from matrix where code = 'project_manager'),
  array['actions.create','actions.manage','actions.read','attendance.manage','attendance.read','audit.read','documents.manage','documents.read','documents.review','files.manage','files.read','findings.create','findings.manage','findings.read','findings.verify','hse.manage','hse.read','inspections.manage','inspections.read','inspections.review','notifications.manage','portal.share','project.configure','records.create','records.edit','records.read','reports.create','reports.distribute','reports.edit','reports.freeze','reports.read','reports.review','reports.sign','submissions.read','submissions.review','templates.manage'],
  'project manager additionally configures the project and its notifications'
);
select is(
  (select permissions from matrix where code = 'quality_hse_manager'),
  array['actions.create','actions.manage','actions.read','attendance.read','audit.read','documents.manage','documents.read','documents.review','files.manage','files.read','findings.create','findings.manage','findings.read','findings.verify','hse.manage','hse.read','inspections.manage','inspections.read','inspections.review','portal.share','records.create','records.edit','records.read','reports.read','reports.review','reports.sign','submissions.read','submissions.review','templates.manage'],
  'quality/HSE manager verifies findings but does not author or freeze day reports'
);
select is(
  (select permissions from matrix where code = 'contractor'),
  array['actions.create','portal.contractor','portal.contractor.respond','records.create','reports.sign','submissions.read'],
  'contractor submits and signs in its portal, reads no internal records or project files and verifies nothing'
);
select is(
  (select permissions from matrix where code = 'client'),
  array['actions.read','attendance.read','audit.read','documents.read','files.read','findings.read','hse.read','inspections.read','records.read','reports.read','reports.readapproved','reports.sign','submissions.read','submissions.review'],
  'owner / opdrachtgever reads everything, signs reports and reviews submissions, writes nothing else'
);
select is(
  (select permissions from matrix where code = 'external_guest'),
  array[null]::text[],
  'an external guest holds no permission and sees only what is explicitly shared'
);

select is(
  (select array_agg(code || '=' || array_to_string(permissions, '+') order by code) from matrix
   where code in ('client_admin','client_approver','client_reviewer','client_viewer','contractor_admin','contractor_readonly','contractor_representative')),
  array['client_admin=portal.client+portal.client.review','client_approver=portal.client+portal.client.approve+portal.client.review',
    'client_reviewer=portal.client+portal.client.review','client_viewer=portal.client',
    'contractor_admin=portal.contractor+portal.contractor.respond','contractor_readonly=portal.contractor',
    'contractor_representative=portal.contractor+portal.contractor.respond'],
  'portal roles hold portal rights only; managing own-organisation users is never a default'
);

select * from finish();
rollback;
