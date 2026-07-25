begin;

-- Revised client decision: browser push is the primary notification channel.
-- Email remains available as an optional later fallback, but is disabled by
-- default and is not required for the field workflow.
alter table public.project_settings
  add column if not exists push_notifications_enabled boolean not null default true;

alter table public.project_settings
  alter column email_notifications_enabled set default false;

update public.project_settings
set email_notifications_enabled = false;

update public.notifications
set email_status = 'skipped', email_last_error = null
where email_status in ('pending','sending','failed');

alter table public.notifications
  add column if not exists push_status text not null default 'pending',
  add column if not exists push_attempts integer not null default 0,
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_last_error text;

alter table public.notifications
  drop constraint if exists notifications_push_status_check;
alter table public.notifications
  add constraint notifications_push_status_check
    check (push_status in ('pending','sending','sent','failed','skipped'));
alter table public.notifications
  drop constraint if exists notifications_push_attempts_check;
alter table public.notifications
  add constraint notifications_push_attempts_check
    check (push_attempts between 0 and 20);

create index if not exists notifications_push_queue_idx
  on public.notifications (push_status, created_at)
  where push_status in ('pending','failed','sending');

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 20 and 2000),
  p256dh text not null check (char_length(p256dh) between 20 and 500),
  auth_secret text not null check (char_length(auth_secret) between 8 and 250),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  status text not null default 'active' check (status in ('active','revoked')),
  failure_count integer not null default 0 check (failure_count between 0 and 100),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (endpoint)
);

create index push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, status, updated_at desc);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select_self on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_self on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update_self on public.push_subscriptions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_self on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create trigger push_subscriptions_touch
  before update on public.push_subscriptions
  for each row execute function app_private.touch_versioned_row();

-- Project media folders remain central records; the image or drawing body may
-- be queued in IndexedDB while offline and is attached to its chosen folder
-- when the device reconnects.
create table public.media_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid,
  parent_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  folder_type text not null default 'images' check (folder_type in ('images','drawings','mixed')),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id),
  foreign key (parent_id, project_id, organization_id) references public.media_folders(id, project_id, organization_id),
  check (parent_id is null or parent_id <> id)
);

create unique index media_folders_unique_active_name_idx
  on public.media_folders (project_id, coalesce(building_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where status = 'active';
create index media_folders_project_building_idx
  on public.media_folders (project_id, building_id, status, name);

alter table public.files add column if not exists folder_id uuid;
alter table public.files
  add constraint files_folder_project_fk
  foreign key (folder_id, project_id, organization_id)
  references public.media_folders(id, project_id, organization_id);
create index if not exists files_project_folder_idx
  on public.files (project_id, folder_id, category, created_at desc)
  where status <> 'deleted';

create or replace function app_private.guard_file_folder()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_folder public.media_folders;
begin
  if new.folder_id is null then return new; end if;
  select folder.* into v_folder from public.media_folders folder where folder.id = new.folder_id;
  if not found or v_folder.status <> 'active'
    or v_folder.project_id <> new.project_id
    or v_folder.organization_id <> new.organization_id
    or (v_folder.building_id is not null and v_folder.building_id is distinct from new.building_id) then
    raise exception 'The selected media folder does not belong to this project/building' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger files_folder_guard
  before insert or update of folder_id, project_id, building_id, organization_id on public.files
  for each row execute function app_private.guard_file_folder();

alter table public.media_folders enable row level security;
create policy media_folders_select on public.media_folders
  for select to authenticated using (app_private.has_project_permission(project_id, 'files.read'));
create policy media_folders_manage on public.media_folders
  for all to authenticated using (app_private.has_project_permission(project_id, 'files.manage'))
  with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'files.manage'));

revoke all on public.media_folders from public, anon, authenticated;
grant select, insert, update on public.media_folders to authenticated;

create trigger media_folders_touch before update on public.media_folders
  for each row execute function app_private.touch_versioned_row();
create trigger media_folders_audit after insert or update or delete on public.media_folders
  for each row execute function app_private.capture_audit_event();

create or replace function public.create_media_folder(
  p_project_id uuid,
  p_building_id uuid,
  p_parent_id uuid,
  p_name text,
  p_folder_type text default 'images'
)
returns public.media_folders
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid;
  v_folder public.media_folders;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'files.manage') then
    raise exception 'Missing files.manage permission' using errcode = '42501';
  end if;
  if p_folder_type not in ('images','drawings','mixed') or char_length(btrim(p_name)) not between 1 and 120 then
    raise exception 'Invalid media folder' using errcode = '22023';
  end if;
  select project.organization_id into v_organization_id from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if p_building_id is not null and not exists (
    select 1 from public.buildings building where building.id = p_building_id and building.project_id = p_project_id
  ) then raise exception 'Building not found in project' using errcode = '23503'; end if;
  if p_parent_id is not null and not exists (
    select 1 from public.media_folders parent where parent.id = p_parent_id and parent.project_id = p_project_id and parent.status = 'active'
  ) then raise exception 'Parent folder not found in project' using errcode = '23503'; end if;

  insert into public.media_folders (
    organization_id, project_id, building_id, parent_id, name, folder_type, created_by
  ) values (
    v_organization_id, p_project_id, p_building_id, p_parent_id, btrim(p_name), p_folder_type, v_actor
  ) returning * into v_folder;
  return v_folder;
end;
$$;

create or replace function public.move_file_to_media_folder(p_file_id uuid, p_folder_id uuid)
returns public.files
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_file public.files;
begin
  select file.* into v_file from public.files file where file.id = p_file_id for update;
  if not found then raise exception 'File not found' using errcode = 'P0002'; end if;
  if v_actor is null or not app_private.has_project_permission(v_file.project_id, 'files.manage') then
    raise exception 'Missing files.manage permission' using errcode = '42501';
  end if;
  update public.files set folder_id = p_folder_id where id = v_file.id returning * into v_file;
  return v_file;
end;
$$;

-- A WhatsApp share contains only an opaque, revocable, expiring public link.
-- External trades never receive an application account or direct project access.
create table public.external_share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid,
  source_type text not null check (source_type in ('finding','action','inspection','visual')),
  source_id uuid not null,
  source_number text not null check (char_length(source_number) between 1 and 80),
  title text not null check (char_length(title) between 1 and 240),
  summary text not null check (char_length(summary) between 1 and 4000),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (building_id, project_id, organization_id) references public.buildings(id, project_id, organization_id)
);

create index external_share_links_project_active_idx
  on public.external_share_links (project_id, expires_at desc)
  where revoked_at is null;

alter table public.external_share_links enable row level security;
create policy external_share_links_select on public.external_share_links
  for select to authenticated using (app_private.can_access_project(project_id));
create policy external_share_links_update on public.external_share_links
  for update to authenticated using (created_by = (select auth.uid()) or app_private.has_project_permission(project_id, 'project.configure'))
  with check (created_by = (select auth.uid()) or app_private.has_project_permission(project_id, 'project.configure'));

revoke all on public.external_share_links from public, anon, authenticated;
grant select, update on public.external_share_links to authenticated;

create trigger external_share_links_audit after insert or update or delete on public.external_share_links
  for each row execute function app_private.capture_audit_event();

create or replace function public.create_external_share_link(
  p_project_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_expires_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid;
  v_building_id uuid;
  v_number text;
  v_title text;
  v_summary text;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_share public.external_share_links;
begin
  if v_actor is null or p_source_type not in ('finding','action','inspection','visual') or p_expires_days not between 1 and 30 then
    raise exception 'Invalid external share request' using errcode = '22023';
  end if;

  if p_source_type = 'finding' then
    if not app_private.has_project_permission(p_project_id, 'findings.read') then raise exception 'Missing findings.read permission' using errcode = '42501'; end if;
    select finding.organization_id, finding.building_id, finding.finding_number, finding.title, finding.description
      into v_organization_id, v_building_id, v_number, v_title, v_summary
      from public.findings finding where finding.id = p_source_id and finding.project_id = p_project_id;
  elsif p_source_type = 'action' then
    if not app_private.has_project_permission(p_project_id, 'actions.read') then raise exception 'Missing actions.read permission' using errcode = '42501'; end if;
    select action.organization_id, action.building_id, action.action_number, action.title, coalesce(action.description, action.title)
      into v_organization_id, v_building_id, v_number, v_title, v_summary
      from public.actions action where action.id = p_source_id and action.project_id = p_project_id;
  elsif p_source_type = 'inspection' then
    if not app_private.has_project_permission(p_project_id, 'inspections.read') then raise exception 'Missing inspections.read permission' using errcode = '42501'; end if;
    select inspection.organization_id, inspection.building_id, inspection.inspection_number, inspection.title, 'Inspectie: ' || inspection.status
      into v_organization_id, v_building_id, v_number, v_title, v_summary
      from public.inspections inspection where inspection.id = p_source_id and inspection.project_id = p_project_id;
  else
    if not app_private.has_project_permission(p_project_id, 'files.read') then raise exception 'Missing files.read permission' using errcode = '42501'; end if;
    select capture.organization_id, capture.building_id, 'PHOTO', capture.title, coalesce(capture.description, capture.location_label)
      into v_organization_id, v_building_id, v_number, v_title, v_summary
      from public.visual_captures capture where capture.id = p_source_id and capture.project_id = p_project_id and capture.status = 'active';
  end if;
  if not found then raise exception 'Share source not found' using errcode = 'P0002'; end if;

  insert into public.external_share_links (
    organization_id, project_id, building_id, source_type, source_id,
    source_number, title, summary, token_hash, expires_at, created_by
  ) values (
    v_organization_id, p_project_id, v_building_id, p_source_type, p_source_id,
    v_number, v_title, v_summary, encode(extensions.digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(days => p_expires_days), v_actor
  ) returning * into v_share;

  return jsonb_build_object('share_id', v_share.id, 'token', v_token, 'expires_at', v_share.expires_at);
end;
$$;

create or replace function public.resolve_external_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_share public.external_share_links;
  v_project public.projects;
  v_building_name text;
  v_status text;
  v_severity text;
  v_due_at timestamptz;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{48}$' then return null; end if;
  select share.* into v_share
  from public.external_share_links share
  where share.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and share.revoked_at is null and share.expires_at > now()
  for update;
  if not found then return null; end if;

  select project.* into v_project from public.projects project where project.id = v_share.project_id;
  select building.name into v_building_name from public.buildings building where building.id = v_share.building_id;
  if v_share.source_type = 'finding' then
    select finding.status, finding.severity, finding.due_at into v_status, v_severity, v_due_at from public.findings finding where finding.id = v_share.source_id;
  elsif v_share.source_type = 'action' then
    select action.status, action.priority, action.due_at into v_status, v_severity, v_due_at from public.actions action where action.id = v_share.source_id;
  elsif v_share.source_type = 'inspection' then
    select inspection.status, null::text, inspection.planned_at into v_status, v_severity, v_due_at from public.inspections inspection where inspection.id = v_share.source_id;
  else
    select capture.status, null::text, null::timestamptz into v_status, v_severity, v_due_at from public.visual_captures capture where capture.id = v_share.source_id;
  end if;

  update public.external_share_links set view_count = view_count + 1, last_viewed_at = now() where id = v_share.id;
  return jsonb_build_object(
    'project_name', v_project.name,
    'project_code', v_project.code,
    'building_name', v_building_name,
    'source_type', v_share.source_type,
    'source_number', v_share.source_number,
    'title', v_share.title,
    'summary', v_share.summary,
    'status', v_status,
    'severity', v_severity,
    'due_at', v_due_at,
    'expires_at', v_share.expires_at
  );
end;
$$;

revoke all on function public.create_media_folder(uuid,uuid,uuid,text,text) from public, anon;
revoke all on function public.move_file_to_media_folder(uuid,uuid) from public, anon;
revoke all on function public.create_external_share_link(uuid,text,uuid,integer) from public, anon;
revoke all on function public.resolve_external_share_link(text) from public, anon, authenticated;
grant execute on function public.create_media_folder(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.move_file_to_media_folder(uuid,uuid) to authenticated;
grant execute on function public.create_external_share_link(uuid,text,uuid,integer) to authenticated;
grant execute on function public.resolve_external_share_link(text) to service_role;

alter table public.media_folders replica identity full;
alter table public.external_share_links replica identity full;
do $migration$
begin
  begin alter publication supabase_realtime add table public.media_folders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.external_share_links; exception when duplicate_object then null; end;
end;
$migration$;

commit;
