begin;

alter table public.actions
  add constraint actions_id_project_organization_key
  unique (id, project_id, organization_id);

create table public.action_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  action_id uuid not null,
  update_type text not null check (update_type in ('created', 'status', 'comment', 'evidence')),
  message text not null check (char_length(message) between 3 and 2000),
  from_status text,
  to_status text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (action_id, project_id, organization_id)
    references public.actions(id, project_id, organization_id),
  check (
    (update_type = 'status' and from_status is not null and to_status is not null)
    or (update_type <> 'status' and from_status is null and to_status is null)
  )
);

create index action_updates_action_created_idx
  on public.action_updates (action_id, created_at desc);
create index action_updates_project_created_idx
  on public.action_updates (project_id, created_at desc);

alter table public.action_updates enable row level security;

create policy action_updates_select on public.action_updates for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'actions.read')
    or exists (
      select 1
      from public.actions action
      where action.id = action_id
        and action.owner_user_id = (select auth.uid())
    )
  );

create policy action_updates_insert on public.action_updates for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      app_private.has_project_permission(project_id, 'actions.manage')
      or exists (
        select 1
        from public.actions action
        where action.id = action_id
          and action.owner_user_id = (select auth.uid())
      )
    )
  );

create trigger action_updates_immutable
  before update or delete on public.action_updates
  for each row execute function app_private.reject_immutable_mutation();
create trigger action_updates_audit
  after insert on public.action_updates
  for each row execute function app_private.capture_audit_event();

create or replace function public.create_project_action(
  p_project_id uuid,
  p_building_id uuid,
  p_owner_party_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_priority text,
  p_idempotency_key text
)
returns public.actions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_action public.actions;
  v_year integer;
  v_sequence integer;
  v_action_number text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(p_idempotency_key) < 8 then
    raise exception 'Idempotency key must contain at least 8 characters' using errcode = '22023';
  end if;
  if char_length(trim(p_title)) < 3 then
    raise exception 'Action title must contain at least 3 characters' using errcode = '22023';
  end if;
  if p_priority not in ('low', 'normal', 'high', 'critical') then
    raise exception 'Invalid action priority' using errcode = '22023';
  end if;

  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Project not found or not accessible' using errcode = 'P0002';
  end if;
  if not app_private.has_project_permission(p_project_id, 'actions.create') then
    raise exception 'Missing actions.create permission' using errcode = '42501';
  end if;

  select action.* into v_action
  from public.actions action
  where action.project_id = p_project_id
    and action.created_by = v_actor
    and action.idempotency_key = p_idempotency_key;

  if found then
    return v_action;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':actions', 0));
  v_year := extract(year from (now() at time zone 'America/Paramaribo'))::integer;

  select coalesce(max(substring(action.action_number from '([0-9]+)$')::integer), 0) + 1
  into v_sequence
  from public.actions action
  where action.project_id = p_project_id
    and action.action_number ~ ('^ACT-' || v_year || '-[0-9]+$');

  v_action_number := 'ACT-' || v_year || '-' || lpad(v_sequence::text, 4, '0');

  insert into public.actions (
    organization_id,
    project_id,
    building_id,
    action_number,
    title,
    description,
    source_type,
    owner_user_id,
    owner_party_id,
    due_at,
    priority,
    status,
    idempotency_key,
    created_by
  ) values (
    v_project.organization_id,
    v_project.id,
    p_building_id,
    v_action_number,
    trim(p_title),
    nullif(trim(p_description), ''),
    'manual',
    v_actor,
    p_owner_party_id,
    p_due_at,
    p_priority,
    'open',
    p_idempotency_key,
    v_actor
  )
  returning * into v_action;

  insert into public.action_updates (
    organization_id,
    project_id,
    action_id,
    update_type,
    message,
    created_by
  ) values (
    v_action.organization_id,
    v_action.project_id,
    v_action.id,
    'created',
    'Actie centraal aangemaakt en toegewezen.',
    v_actor
  );

  return v_action;
end;
$$;

create or replace function public.transition_project_action(
  p_action_id uuid,
  p_next_status text,
  p_note text
)
returns public.actions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_action public.actions;
  v_previous_status text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(trim(p_note)) < 5 then
    raise exception 'A transition note of at least 5 characters is required' using errcode = '22023';
  end if;

  select action.* into v_action
  from public.actions action
  where action.id = p_action_id
  for update;

  if not found then
    raise exception 'Action not found or not accessible' using errcode = 'P0002';
  end if;

  v_previous_status := v_action.status;

  update public.actions
  set
    status = p_next_status,
    closed_at = case when p_next_status in ('verified', 'cancelled') then now() else null end,
    closure_reason = case when p_next_status in ('verified', 'cancelled') then trim(p_note) else null end
  where id = v_action.id
  returning * into v_action;

  insert into public.action_updates (
    organization_id,
    project_id,
    action_id,
    update_type,
    message,
    from_status,
    to_status,
    created_by
  ) values (
    v_action.organization_id,
    v_action.project_id,
    v_action.id,
    'status',
    trim(p_note),
    v_previous_status,
    v_action.status,
    v_actor
  );

  return v_action;
end;
$$;

grant select, insert on public.action_updates to authenticated;
revoke all on function public.create_project_action(uuid, uuid, uuid, text, text, timestamptz, text, text) from public, anon;
revoke all on function public.transition_project_action(uuid, text, text) from public, anon;
grant execute on function public.create_project_action(uuid, uuid, uuid, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.transition_project_action(uuid, text, text) to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'actions',
    'action_updates',
    'attendance_entries',
    'day_closeouts',
    'day_reports',
    'day_start_checks',
    'site_registrations'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

commit;
