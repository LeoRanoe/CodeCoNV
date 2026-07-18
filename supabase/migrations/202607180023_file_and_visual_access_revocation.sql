begin;

drop policy if exists files_select on public.files;
drop policy if exists files_manage on public.files;

create policy files_select on public.files
  for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'files.read')
    or app_private.has_project_permission(project_id, 'files.manage')
  );

create policy files_insert on public.files
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and app_private.has_project_permission(project_id, 'files.manage')
  );

create policy files_update on public.files
  for update to authenticated
  using (app_private.has_project_permission(project_id, 'files.manage'))
  with check (app_private.has_project_permission(project_id, 'files.manage'));

create or replace function app_private.protect_file_ownership()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.project_id is distinct from old.project_id
    or new.building_id is distinct from old.building_id
    or new.created_by is distinct from old.created_by then
    raise exception 'File ownership and project scope are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists files_ownership_guard on public.files;
create trigger files_ownership_guard before update on public.files
  for each row execute function app_private.protect_file_ownership();

drop policy if exists visual_captures_select on public.visual_captures;
create policy visual_captures_select on public.visual_captures
  for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'files.read')
    or app_private.has_project_permission(project_id, 'files.manage')
  );

drop policy if exists visual_annotations_select on public.visual_annotations;
create policy visual_annotations_select on public.visual_annotations
  for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'findings.read')
    or app_private.has_project_permission(project_id, 'findings.manage')
    or app_private.has_project_permission(project_id, 'findings.verify')
  );

commit;
