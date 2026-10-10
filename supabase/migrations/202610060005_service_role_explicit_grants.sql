-- The hosted project was created when Supabase's default privileges still gave service_role
-- full table access to every new public table. Databases created today (local CLI, CI, a
-- disaster-recovery restore into a new project) no longer do, so several trusted server
-- routes worked in production only because of that implicit grant and failed with
-- "permission denied" anywhere else:
--
--   /api/backups/ensure-daily          memberships, member roles, role permissions
--   /api/admin/project-role            projects, roles, project memberships/roles, audit
--   push / e-mail notification dispatch notifications, push subscriptions
--
-- Each grant below is exactly what that server code reads or writes, nothing broader, so a
-- database rebuilt from migrations behaves like production. On the hosted project these are
-- no-ops: it already holds these privileges (and more; see
-- docs/operations/production-readiness.md, "Grant drift").

begin;

-- Daily backup self-check (backup.manage authorization).
grant select on public.organization_memberships to service_role;
grant select on public.organization_member_roles to service_role;
grant select on public.role_permissions to service_role;

-- Project-role administration.
grant select on public.projects to service_role;
grant select on public.roles to service_role;
grant select on public.project_memberships to service_role;
grant select, update on public.project_member_roles to service_role;
grant insert on public.audit_events to service_role;

-- Notification delivery state.
grant select, update on public.notifications to service_role;
grant select, update on public.push_subscriptions to service_role;

commit;
