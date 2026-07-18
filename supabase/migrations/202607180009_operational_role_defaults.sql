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
        when 'client' then array['reports.sign']
        when 'quality_hse_manager' then array[
          'templates.manage','inspections.read','inspections.manage','inspections.review',
          'findings.read','findings.create','findings.manage','findings.verify',
          'hse.read','hse.manage','files.read','files.manage','reports.sign'
        ]
        else array[]::text[]
      end
    ) permission_code
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists roles_assign_operational_permissions on public.roles;
create trigger roles_assign_operational_permissions
  after insert on public.roles
  for each row execute function app_private.assign_operational_role_permissions();

create policy notifications_insert on public.notifications for insert to authenticated
  with check (
    exists (
      select 1 from public.project_memberships membership
      where membership.project_id = notifications.project_id
        and membership.user_id = notifications.recipient_user_id
        and membership.status = 'active'
    )
    and (
      app_private.has_project_permission(project_id, 'notifications.manage')
      or (notification_type = 'hse_critical' and app_private.has_project_permission(project_id, 'hse.manage'))
      or (notification_type = 'finding_critical' and app_private.has_project_permission(project_id, 'findings.manage'))
    )
  );

grant insert on public.notifications to authenticated;

commit;
