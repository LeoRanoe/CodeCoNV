-- The permissions the signed-in user holds on one project, in one call.
--
-- The screens use this to hide what the user cannot do (a client does not get a "New issue"
-- button that always answers 403). It is advisory: every write is still checked by the
-- policies and functions in the database, and a missing or failing call leaves the screens
-- as they were.
--
-- It answers with exactly what has_project_permission() answers for each permission code, so
-- organization-level roles, project roles and the projects.manage override all count the
-- same way here as they do in row-level security.

create or replace function public.my_project_permissions(p_project_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select coalesce(
    array_agg(permission.code::text order by permission.code)
      filter (where app_private.has_project_permission(p_project_id, permission.code)),
    array[]::text[]
  )
  from public.permissions permission
  where (select auth.uid()) is not null
    and exists (select 1 from public.projects project where project.id = p_project_id);
$$;

revoke all on function public.my_project_permissions(uuid) from public, anon;
grant execute on function public.my_project_permissions(uuid) to authenticated;
