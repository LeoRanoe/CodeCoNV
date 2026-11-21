-- F10 / F15 (client-spec audit): read-only inventory of external access, for authorised staff.
--
-- Run in the production SQL editor as a database owner, inside a read-only transaction. Nothing here
-- changes data, roles or grants. Each result is a list to approve, migrate or revoke under the
-- project's approved role matrix (Word section 20, item 1). Export the results with the review notes.

begin transaction read only;

-- 1. Every active project member with a role that reaches outside CODECO supervision, by project.
--    Legacy `client` holds internal daily-work read access (migration 202607300006); the new
--    client_* roles see only what is deliberately shared.
select organization.name as organization, project.code as project, profile.display_name as member, auth_user.email,
  role.code as role, membership.status, party.name as portal_party, membership.created_at as member_since
from public.project_memberships membership
join public.projects project on project.id = membership.project_id
join public.organizations organization on organization.id = project.organization_id
join public.project_member_roles member_role on member_role.membership_id = membership.id
join public.roles role on role.id = member_role.role_id
left join public.parties party on party.id = membership.portal_party_id
left join public.profiles profile on profile.id = membership.user_id
left join auth.users auth_user on auth_user.id = membership.user_id
where role.code in ('client', 'contractor', 'contractor_admin', 'contractor_representative', 'contractor_readonly',
  'client_viewer', 'client_reviewer', 'client_approver', 'client_admin')
order by organization.name, project.code, role.code, profile.display_name;

-- 2. Portal roles without a linked organisation (they see nothing in the portal, and should be
--    linked or removed).
select project.code as project, profile.display_name as member, role.code as role
from public.project_memberships membership
join public.projects project on project.id = membership.project_id
join public.project_member_roles member_role on member_role.membership_id = membership.id
join public.roles role on role.id = member_role.role_id
left join public.profiles profile on profile.id = membership.user_id
where membership.status = 'active' and membership.portal_party_id is null
  and (role.code like 'contractor\_%' or role.code like 'client\_%');

-- 3. Revoked or inactive members who still have open portal items addressed to them by name.
select project.code as project, share.record_code, share.title, share.status, profile.display_name as contact, membership.status as membership_status
from public.portal_shares share
join public.projects project on project.id = share.project_id
join public.project_memberships membership on membership.project_id = share.project_id and membership.user_id = share.contact_user_id
left join public.profiles profile on profile.id = share.contact_user_id
where membership.status <> 'active' and share.status not in ('closed', 'withdrawn', 'superseded');

-- 4. Account-free share links that are still usable.
select project.code as project, link.source_type, link.source_number, link.title, link.expires_at, link.view_count, link.last_viewed_at, link.created_at
from public.external_share_links link
join public.projects project on project.id = link.project_id
where link.revoked_at is null and (link.expires_at is null or link.expires_at > now())
order by link.expires_at nulls first;

-- 5. F15: document files attached to a portal share before deliberate release, outside any live
--    release. After migration 202611230001 they are no longer readable by the portal party; review
--    whether each was intended, and release the approved revision where it was.
select * from app_private.legacy_unreleased_document_files order by added_at;

-- 6. F15: what each portal party can read of each shared document now.
select project.code as project, share.audience, party.name as party, share.record_code, revision.revision, revision.review_status,
  release.released_at, release.withdrawn_at, release.withdraw_reason
from public.portal_document_releases release
join public.portal_shares share on share.id = release.share_id
join public.parties party on party.id = share.party_id
join public.projects project on project.id = share.project_id
join public.project_document_revisions revision on revision.id = release.revision_id
order by project.code, share.record_code, release.released_at;

rollback;
