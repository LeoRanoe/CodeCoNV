begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  phone text,
  locale text not null default 'nl-SR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/Paramaribo',
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);

create table public.permissions (
  code text primary key check (code ~ '^[a-z]+(?:\.[a-z]+)*$'),
  description text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  scope text not null check (scope in ('organization', 'project')),
  code text not null check (code ~ '^[a-z]+(?:_[a-z]+)*$'),
  name text not null check (char_length(name) between 2 and 100),
  is_system boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (organization_id, scope, code),
  unique (id, organization_id)
);

create table public.role_permissions (
  organization_id uuid not null references public.organizations(id),
  role_id uuid not null,
  permission_code text not null references public.permissions(code),
  created_at timestamptz not null default now(),
  primary key (role_id, permission_code),
  foreign key (role_id, organization_id)
    references public.roles(id, organization_id) on delete cascade
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (organization_id, user_id),
  unique (id, organization_id)
);

create table public.organization_member_roles (
  organization_id uuid not null references public.organizations(id),
  membership_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, role_id),
  foreign key (membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete cascade,
  foreign key (role_id, organization_id)
    references public.roles(id, organization_id) on delete cascade
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null check (char_length(code) between 2 and 40),
  name text not null check (char_length(name) between 2 and 180),
  location text not null,
  timezone text not null default 'America/Paramaribo',
  status text not null default 'active' check (status in ('draft', 'active', 'on_hold', 'completed', 'archived')),
  client_name text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (organization_id, code),
  unique (id, organization_id),
  check ((cancelled_at is null and cancellation_reason is null) or (cancelled_at is not null and char_length(cancellation_reason) >= 5))
);

create table public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  user_id uuid not null references auth.users(id),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, user_id),
  unique (id, organization_id, project_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.project_member_roles (
  organization_id uuid not null,
  project_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, role_id),
  foreign key (membership_id, organization_id, project_id)
    references public.project_memberships(id, organization_id, project_id) on delete cascade,
  foreign key (role_id, organization_id)
    references public.roles(id, organization_id) on delete cascade
);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  code text not null check (char_length(code) between 1 and 40),
  name text not null check (char_length(name) between 2 and 160),
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, code),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
);

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  code text not null check (char_length(code) between 1 and 40),
  name text not null check (char_length(name) between 2 and 180),
  party_type text not null check (party_type in ('client', 'supervisor', 'contractor', 'subcontractor', 'supplier', 'consultant', 'other')),
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, code),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
);

create table public.day_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  report_date date not null,
  report_number text not null check (char_length(report_number) between 3 and 60),
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'ready_for_review', 'in_review', 'approved', 'returned', 'cancelled')),
  completeness_percent smallint not null default 0 check (completeness_percent between 0 and 100),
  cancellation_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, report_date),
  unique (project_id, report_number),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id),
  check (status <> 'cancelled' or char_length(cancellation_reason) >= 5)
);

create table public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid not null,
  day_report_id uuid not null,
  party_id uuid not null,
  discipline text not null check (char_length(discipline) between 2 and 100),
  shift_start time not null,
  shift_end time not null,
  headcount integer not null check (headcount >= 0 and headcount <= 10000),
  notes text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, created_by, idempotency_key),
  foreign key (building_id, project_id, organization_id)
    references public.buildings(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id)
    references public.day_reports(id, project_id, organization_id),
  foreign key (party_id, project_id, organization_id)
    references public.parties(id, project_id, organization_id),
  check (shift_end > shift_start)
);

create table public.site_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid,
  day_report_id uuid not null,
  registration_type text not null check (registration_type in ('activity', 'inspection', 'finding', 'photo', 'action', 'note', 'hse', 'delivery', 'test', 'delay')),
  is_physical boolean not null default true,
  title text not null check (char_length(title) between 2 and 240),
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  occurred_at timestamptz not null,
  status text not null default 'recorded' check (status in ('draft', 'recorded', 'confirmed', 'cancelled')),
  cancellation_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, created_by, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (building_id, project_id, organization_id)
    references public.buildings(id, project_id, organization_id),
  foreign key (day_report_id, project_id, organization_id)
    references public.day_reports(id, project_id, organization_id),
  check (not is_physical or building_id is not null),
  check (status <> 'cancelled' or char_length(cancellation_reason) >= 5)
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  building_id uuid,
  action_number text not null check (char_length(action_number) between 3 and 60),
  title text not null check (char_length(title) between 2 and 240),
  description text,
  source_type text not null check (source_type in ('manual', 'registration', 'inspection', 'finding', 'hse', 'report', 'meeting')),
  source_id uuid,
  owner_user_id uuid references auth.users(id),
  owner_party_id uuid,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'accepted', 'in_progress', 'ready_for_verification', 'verified', 'cancelled')),
  closed_at timestamptz,
  closure_reason text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, action_number),
  unique (project_id, created_by, idempotency_key),
  foreign key (building_id, project_id, organization_id)
    references public.buildings(id, project_id, organization_id),
  foreign key (owner_party_id, project_id, organization_id)
    references public.parties(id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id),
  check ((status not in ('verified', 'cancelled')) or (closed_at is not null and char_length(closure_reason) >= 5))
);

create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  day_report_id uuid not null,
  revision integer not null check (revision >= 0),
  template_version text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  signed_at timestamptz,
  signature_metadata jsonb,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (day_report_id, revision),
  unique (project_id, created_by, idempotency_key),
  foreign key (day_report_id, project_id, organization_id)
    references public.day_reports(id, project_id, organization_id),
  check ((signed_at is null and signature_metadata is null) or (signed_at is not null and signature_metadata is not null))
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  project_id uuid references public.projects(id),
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE', 'STATUS', 'SIGN', 'REVIEW', 'DISTRIBUTE')),
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  request_id text,
  check (old_values is not null or new_values is not null)
);

insert into public.permissions (code, description) values
  ('organization.manage', 'Organisatie, rollen en instellingen beheren'),
  ('members.manage', 'Organisatie- en projectleden beheren'),
  ('projects.create', 'Projecten aanmaken'),
  ('projects.manage', 'Alle projecten binnen de organisatie beheren'),
  ('project.configure', 'Projectinstellingen, gebouwen en partijen beheren'),
  ('records.read', 'Interne bouwplaatsregistraties bekijken'),
  ('records.create', 'Bouwplaatsregistraties aanmaken'),
  ('records.edit', 'Bouwplaatsregistraties corrigeren of annuleren'),
  ('attendance.read', 'Aanwezigheidsgegevens bekijken'),
  ('attendance.manage', 'Aanwezigheid registreren en corrigeren'),
  ('actions.read', 'Alle projectactiepunten bekijken'),
  ('actions.create', 'Actiepunten aanmaken'),
  ('actions.manage', 'Actiepunten toewijzen, wijzigen en verifiëren'),
  ('reports.read', 'Interne dagrapporten en rapportversies bekijken'),
  ('reports.readapproved', 'Uitsluitend goedgekeurde rapporten bekijken'),
  ('reports.create', 'Dagrapporten starten'),
  ('reports.edit', 'Dagrapporten in uitvoering wijzigen'),
  ('reports.review', 'Dagrapporten reviewen of terugsturen'),
  ('reports.freeze', 'Immutable rapportversies vastzetten'),
  ('audit.read', 'Projectaudittrail bekijken')
on conflict (code) do update set description = excluded.description;

create index organization_memberships_user_idx on public.organization_memberships (user_id, organization_id) where status = 'active';
create index organization_member_roles_org_idx on public.organization_member_roles (organization_id, membership_id, role_id);
create index role_permissions_lookup_idx on public.role_permissions (role_id, permission_code);
create index project_memberships_user_idx on public.project_memberships (user_id, project_id) where status = 'active';
create index project_member_roles_project_idx on public.project_member_roles (project_id, membership_id, role_id);
create index buildings_project_idx on public.buildings (project_id, id);
create index parties_project_idx on public.parties (project_id, id) where active;
create index day_reports_project_date_idx on public.day_reports (project_id, report_date desc);
create index attendance_report_idx on public.attendance_entries (day_report_id, party_id);
create index site_registrations_report_time_idx on public.site_registrations (day_report_id, occurred_at desc);
create index site_registrations_project_status_idx on public.site_registrations (project_id, status, registration_type);
create index actions_project_status_due_idx on public.actions (project_id, status, due_at);
create index report_versions_report_idx on public.report_versions (day_report_id, revision desc);
create index audit_events_project_time_idx on public.audit_events (project_id, occurred_at desc);
create index audit_events_record_idx on public.audit_events (table_name, record_id, occurred_at desc);

create or replace function app_private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function app_private.has_organization_permission(p_organization_id uuid, p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.organization_member_roles member_role
      on member_role.membership_id = membership.id
     and member_role.organization_id = membership.organization_id
    join public.roles role
      on role.id = member_role.role_id
     and role.organization_id = member_role.organization_id
     and role.scope = 'organization'
    join public.role_permissions permission
      on permission.role_id = role.id
     and permission.permission_code = p_permission_code
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function app_private.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_memberships membership
    where membership.project_id = p_project_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function app_private.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select app_private.is_project_member(p_project_id)
    or exists (
      select 1
      from public.projects project
      where project.id = p_project_id
        and app_private.has_organization_permission(project.organization_id, 'projects.manage')
    );
$$;

create or replace function app_private.has_project_permission(p_project_id uuid, p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = p_project_id
      and (
        app_private.has_organization_permission(project.organization_id, p_permission_code)
        or app_private.has_organization_permission(project.organization_id, 'projects.manage')
        or exists (
          select 1
          from public.project_memberships membership
          join public.project_member_roles member_role
            on member_role.membership_id = membership.id
           and member_role.project_id = membership.project_id
           and member_role.organization_id = membership.organization_id
          join public.roles role
            on role.id = member_role.role_id
           and role.organization_id = member_role.organization_id
           and role.scope = 'project'
          join public.role_permissions permission
            on permission.role_id = role.id
           and permission.permission_code = p_permission_code
          where membership.project_id = project.id
            and membership.user_id = (select auth.uid())
            and membership.status = 'active'
        )
      )
  );
$$;

create or replace function app_private.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.project_memberships mine
      join public.project_memberships theirs on theirs.project_id = mine.project_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = p_user_id
        and theirs.status = 'active'
    );
$$;

create or replace function app_private.touch_versioned_row()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function app_private.preserve_record_creator()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' and (select auth.uid()) is not null and new.created_by <> (select auth.uid()) then
    raise exception 'created_by must match the authenticated user' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.created_by <> old.created_by then
    raise exception 'created_by is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function app_private.validate_day_report_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('in_progress', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('ready_for_review', 'cancelled'))
    or (old.status = 'ready_for_review' and new.status in ('in_review', 'returned'))
    or (old.status = 'in_review' and new.status in ('approved', 'returned'))
    or (old.status = 'returned' and new.status in ('in_progress', 'cancelled'))
  ) then
    raise exception 'Invalid day report transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if new.status in ('in_review', 'returned', 'approved')
    and not app_private.has_project_permission(old.project_id, 'reports.review') then
    raise exception 'Missing reports.review permission' using errcode = '42501';
  end if;

  if new.status = 'approved' and not exists (
    select 1 from public.report_versions version where version.day_report_id = old.id
  ) then
    raise exception 'A report version must be frozen before approval' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function app_private.validate_action_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not app_private.has_project_permission(old.project_id, 'actions.manage') then
    if new.status = 'cancelled' then
      raise exception 'Only an authorized manager can cancel an action' using errcode = '42501';
    end if;
    if (to_jsonb(new) - array['status', 'closed_at', 'closure_reason', 'updated_at', 'version'])
      <> (to_jsonb(old) - array['status', 'closed_at', 'closure_reason', 'updated_at', 'version']) then
      raise exception 'An assignee may only update action execution status' using errcode = '42501';
    end if;
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'open' and new.status in ('accepted', 'in_progress', 'cancelled'))
    or (old.status = 'accepted' and new.status in ('in_progress', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('ready_for_verification', 'cancelled'))
    or (old.status = 'ready_for_verification' and new.status in ('in_progress', 'verified', 'cancelled'))
  ) then
    raise exception 'Invalid action transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if new.status = 'verified'
    and not app_private.has_project_permission(old.project_id, 'actions.manage') then
    raise exception 'Only an authorized reviewer can verify an action' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function app_private.reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception '% is append-only and cannot be %', tg_table_name, lower(tg_op)
    using errcode = '55000';
end;
$$;

create or replace function app_private.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_organization_id uuid;
  v_project_id uuid;
  v_record_id uuid;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_record_id := nullif(coalesce(v_new ->> 'id', v_old ->> 'id'), '')::uuid;
  v_organization_id := nullif(coalesce(
    v_new ->> 'organization_id',
    v_old ->> 'organization_id',
    case when tg_table_name = 'organizations' then v_new ->> 'id' else null end,
    case when tg_table_name = 'organizations' then v_old ->> 'id' else null end
  ), '')::uuid;
  v_project_id := nullif(coalesce(
    v_new ->> 'project_id',
    v_old ->> 'project_id',
    case when tg_table_name = 'projects' then v_new ->> 'id' else null end,
    case when tg_table_name = 'projects' then v_old ->> 'id' else null end
  ), '')::uuid;

  insert into public.audit_events (
    organization_id,
    project_id,
    actor_user_id,
    operation,
    table_name,
    record_id,
    old_values,
    new_values,
    request_id
  ) values (
    v_organization_id,
    v_project_id,
    (select auth.uid()),
    tg_op,
    tg_table_name,
    v_record_id,
    v_old,
    v_new,
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function app_private.touch_versioned_row();
create trigger organizations_creator_guard before insert or update on public.organizations for each row execute function app_private.preserve_record_creator();
create trigger organizations_touch before update on public.organizations for each row execute function app_private.touch_versioned_row();
create trigger roles_creator_guard before insert or update on public.roles for each row execute function app_private.preserve_record_creator();
create trigger roles_touch before update on public.roles for each row execute function app_private.touch_versioned_row();
create trigger organization_memberships_touch before update on public.organization_memberships for each row execute function app_private.touch_versioned_row();
create trigger projects_creator_guard before insert or update on public.projects for each row execute function app_private.preserve_record_creator();
create trigger projects_touch before update on public.projects for each row execute function app_private.touch_versioned_row();
create trigger project_memberships_touch before update on public.project_memberships for each row execute function app_private.touch_versioned_row();
create trigger buildings_creator_guard before insert or update on public.buildings for each row execute function app_private.preserve_record_creator();
create trigger buildings_touch before update on public.buildings for each row execute function app_private.touch_versioned_row();
create trigger parties_creator_guard before insert or update on public.parties for each row execute function app_private.preserve_record_creator();
create trigger parties_touch before update on public.parties for each row execute function app_private.touch_versioned_row();
create trigger day_reports_creator_guard before insert or update on public.day_reports for each row execute function app_private.preserve_record_creator();
create trigger day_reports_status_guard before update on public.day_reports for each row execute function app_private.validate_day_report_transition();
create trigger day_reports_touch before update on public.day_reports for each row execute function app_private.touch_versioned_row();
create trigger attendance_entries_creator_guard before insert or update on public.attendance_entries for each row execute function app_private.preserve_record_creator();
create trigger attendance_entries_touch before update on public.attendance_entries for each row execute function app_private.touch_versioned_row();
create trigger site_registrations_creator_guard before insert or update on public.site_registrations for each row execute function app_private.preserve_record_creator();
create trigger site_registrations_touch before update on public.site_registrations for each row execute function app_private.touch_versioned_row();
create trigger actions_creator_guard before insert or update on public.actions for each row execute function app_private.preserve_record_creator();
create trigger actions_status_guard before update on public.actions for each row execute function app_private.validate_action_transition();
create trigger actions_touch before update on public.actions for each row execute function app_private.touch_versioned_row();
create trigger report_versions_creator_guard before insert or update on public.report_versions for each row execute function app_private.preserve_record_creator();

create trigger report_versions_immutable before update or delete on public.report_versions for each row execute function app_private.reject_immutable_mutation();
create trigger audit_events_immutable before update or delete on public.audit_events for each row execute function app_private.reject_immutable_mutation();

create trigger organizations_audit after insert or update or delete on public.organizations for each row execute function app_private.capture_audit_event();
create trigger roles_audit after insert or update or delete on public.roles for each row execute function app_private.capture_audit_event();
create trigger role_permissions_audit after insert or update or delete on public.role_permissions for each row execute function app_private.capture_audit_event();
create trigger organization_memberships_audit after insert or update or delete on public.organization_memberships for each row execute function app_private.capture_audit_event();
create trigger organization_member_roles_audit after insert or update or delete on public.organization_member_roles for each row execute function app_private.capture_audit_event();
create trigger projects_audit after insert or update or delete on public.projects for each row execute function app_private.capture_audit_event();
create trigger project_memberships_audit after insert or update or delete on public.project_memberships for each row execute function app_private.capture_audit_event();
create trigger project_member_roles_audit after insert or update or delete on public.project_member_roles for each row execute function app_private.capture_audit_event();
create trigger buildings_audit after insert or update or delete on public.buildings for each row execute function app_private.capture_audit_event();
create trigger parties_audit after insert or update or delete on public.parties for each row execute function app_private.capture_audit_event();
create trigger day_reports_audit after insert or update or delete on public.day_reports for each row execute function app_private.capture_audit_event();
create trigger attendance_entries_audit after insert or update or delete on public.attendance_entries for each row execute function app_private.capture_audit_event();
create trigger site_registrations_audit after insert or update or delete on public.site_registrations for each row execute function app_private.capture_audit_event();
create trigger actions_audit after insert or update or delete on public.actions for each row execute function app_private.capture_audit_event();
create trigger report_versions_audit after insert on public.report_versions for each row execute function app_private.capture_audit_event();

create or replace function public.bootstrap_organization(
  p_name text,
  p_slug text,
  p_display_name text
)
returns public.organizations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization public.organizations;
  v_membership public.organization_memberships;
  v_admin_role public.roles;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if exists (select 1 from public.organizations organization where organization.slug = lower(trim(p_slug))) then
    raise exception 'Organization slug already exists' using errcode = '23505';
  end if;

  insert into public.profiles (id, display_name)
  values (v_actor, trim(p_display_name))
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), v_actor)
  returning * into v_organization;

  insert into public.organization_memberships (organization_id, user_id, status, invited_by)
  values (v_organization.id, v_actor, 'active', v_actor)
  returning * into v_membership;

  insert into public.roles (organization_id, scope, code, name, is_system, created_by)
  values (v_organization.id, 'organization', 'organization_admin', 'Organisatiebeheerder', true, v_actor)
  returning * into v_admin_role;

  insert into public.roles (organization_id, scope, code, name, is_system, created_by) values
    (v_organization.id, 'project', 'supervisor', 'Supervisor / inspecteur', true, v_actor),
    (v_organization.id, 'project', 'lead_supervisor', 'Lead supervisor', true, v_actor),
    (v_organization.id, 'project', 'contractor', 'Uitvoerder / aannemer', true, v_actor),
    (v_organization.id, 'project', 'project_manager', 'Projectleider', true, v_actor),
    (v_organization.id, 'project', 'client', 'Opdrachtgever', true, v_actor),
    (v_organization.id, 'project', 'quality_hse_manager', 'HSE- of kwaliteitsmanager', true, v_actor),
    (v_organization.id, 'project', 'external_guest', 'Externe gast', true, v_actor);

  insert into public.organization_member_roles (organization_id, membership_id, role_id)
  values (v_organization.id, v_membership.id, v_admin_role.id);

  insert into public.role_permissions (organization_id, role_id, permission_code)
  select v_organization.id, v_admin_role.id, permission.code
  from public.permissions permission;

  insert into public.role_permissions (organization_id, role_id, permission_code)
  select role.organization_id, role.id, permission.permission_code
  from public.roles role
  cross join lateral unnest(
    case role.code
      when 'supervisor' then array['records.read','records.create','records.edit','attendance.read','attendance.manage','actions.read','actions.create','reports.read','reports.create','reports.edit']
      when 'lead_supervisor' then array['records.read','records.create','records.edit','attendance.read','attendance.manage','actions.read','actions.create','actions.manage','reports.read','reports.create','reports.edit','reports.review','reports.freeze','audit.read']
      when 'contractor' then array['records.create','actions.create']
      when 'project_manager' then array['project.configure','records.read','records.create','records.edit','attendance.read','attendance.manage','actions.read','actions.create','actions.manage','reports.read','reports.create','reports.edit','reports.review','reports.freeze','audit.read']
      when 'client' then array['reports.readapproved']
      when 'quality_hse_manager' then array['records.read','records.create','records.edit','attendance.read','actions.read','actions.create','actions.manage','reports.read','reports.review','audit.read']
      when 'external_guest' then array[]::text[]
      else array[]::text[]
    end
  ) as permission(permission_code)
  where role.organization_id = v_organization.id
    and role.scope = 'project';

  return v_organization;
end;
$$;

create or replace function public.create_day_report(
  p_project_id uuid,
  p_report_date date,
  p_idempotency_key text
)
returns public.day_reports
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_report public.day_reports;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(p_idempotency_key) < 8 then
    raise exception 'Idempotency key must contain at least 8 characters' using errcode = '22023';
  end if;

  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Project not found or not accessible' using errcode = 'P0002';
  end if;

  select report.* into v_report
  from public.day_reports report
  where report.project_id = p_project_id
    and report.created_by = v_actor
    and report.idempotency_key = p_idempotency_key;

  if found then
    return v_report;
  end if;

  select report.* into v_report
  from public.day_reports report
  where report.project_id = p_project_id
    and report.report_date = p_report_date;

  if found then
    return v_report;
  end if;

  begin
    insert into public.day_reports (
      organization_id,
      project_id,
      report_date,
      report_number,
      idempotency_key,
      created_by
    ) values (
      v_project.organization_id,
      v_project.id,
      p_report_date,
      'DR-' || to_char(p_report_date, 'YYYYMMDD'),
      p_idempotency_key,
      v_actor
    )
    returning * into v_report;
  exception when unique_violation then
    select report.* into v_report
    from public.day_reports report
    where report.project_id = p_project_id
      and report.created_by = v_actor
      and report.idempotency_key = p_idempotency_key;
    if not found then
      select report.* into v_report
      from public.day_reports report
      where report.project_id = p_project_id
        and report.report_date = p_report_date;
    end if;
  end;

  return v_report;
end;
$$;

create or replace function public.create_site_registration(
  p_project_id uuid,
  p_building_id uuid,
  p_report_date date,
  p_registration_type text,
  p_title text,
  p_description text,
  p_priority text,
  p_occurred_at timestamptz,
  p_idempotency_key text
)
returns public.site_registrations
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_report public.day_reports;
  v_registration public.site_registrations;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select registration.* into v_registration
  from public.site_registrations registration
  where registration.project_id = p_project_id
    and registration.created_by = v_actor
    and registration.idempotency_key = p_idempotency_key;

  if found then
    return v_registration;
  end if;

  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;

  v_report := public.create_day_report(
    p_project_id,
    p_report_date,
    left(p_idempotency_key || ':report', 200)
  );

  begin
    insert into public.site_registrations (
      organization_id,
      project_id,
      building_id,
      day_report_id,
      registration_type,
      is_physical,
      title,
      description,
      priority,
      occurred_at,
      idempotency_key,
      created_by
    ) values (
      v_project.organization_id,
      v_project.id,
      p_building_id,
      v_report.id,
      p_registration_type,
      true,
      trim(p_title),
      nullif(trim(p_description), ''),
      p_priority,
      p_occurred_at,
      p_idempotency_key,
      v_actor
    )
    returning * into v_registration;
  exception when unique_violation then
    select registration.* into v_registration
    from public.site_registrations registration
    where registration.project_id = p_project_id
      and registration.created_by = v_actor
      and registration.idempotency_key = p_idempotency_key;
  end;

  return v_registration;
end;
$$;

create or replace function public.freeze_report_version(
  p_day_report_id uuid,
  p_template_version text,
  p_snapshot jsonb,
  p_sha256 text,
  p_signature_metadata jsonb,
  p_idempotency_key text
)
returns public.report_versions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_report public.day_reports;
  v_version public.report_versions;
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select version.* into v_version
  from public.report_versions version
  where version.day_report_id = p_day_report_id
    and version.created_by = v_actor
    and version.idempotency_key = p_idempotency_key;

  if found then
    return v_version;
  end if;

  select report.* into v_report
  from public.day_reports report
  where report.id = p_day_report_id
  for update;

  if not found then
    raise exception 'Day report not found or not accessible' using errcode = 'P0002';
  end if;

  select version.* into v_version
  from public.report_versions version
  where version.day_report_id = p_day_report_id
    and version.created_by = v_actor
    and version.idempotency_key = p_idempotency_key;

  if found then
    return v_version;
  end if;

  if not app_private.has_project_permission(v_report.project_id, 'reports.freeze') then
    raise exception 'Missing reports.freeze permission' using errcode = '42501';
  end if;

  select coalesce(max(version.revision), -1) + 1 into v_revision
  from public.report_versions version
  where version.day_report_id = p_day_report_id;

  insert into public.report_versions (
    organization_id,
    project_id,
    day_report_id,
    revision,
    template_version,
    snapshot,
    sha256,
    signed_at,
    signature_metadata,
    idempotency_key,
    created_by
  ) values (
    v_report.organization_id,
    v_report.project_id,
    v_report.id,
    v_revision,
    p_template_version,
    p_snapshot,
    lower(p_sha256),
    case when p_signature_metadata is null then null else now() end,
    p_signature_metadata,
    p_idempotency_key,
    v_actor
  )
  returning * into v_version;

  return v_version;
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_member_roles enable row level security;
alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table public.project_member_roles enable row level security;
alter table public.buildings enable row level security;
alter table public.parties enable row level security;
alter table public.day_reports enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.site_registrations enable row level security;
alter table public.actions enable row level security;
alter table public.report_versions enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (app_private.can_view_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organizations_select on public.organizations for select to authenticated
  using (app_private.is_organization_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (app_private.has_organization_permission(id, 'organization.manage'))
  with check (app_private.has_organization_permission(id, 'organization.manage'));

create policy permissions_select on public.permissions for select to authenticated using (true);

create policy roles_select on public.roles for select to authenticated
  using (app_private.is_organization_member(organization_id));
create policy roles_manage on public.roles for all to authenticated
  using (app_private.has_organization_permission(organization_id, 'organization.manage'))
  with check (app_private.has_organization_permission(organization_id, 'organization.manage'));

create policy role_permissions_select on public.role_permissions for select to authenticated
  using (app_private.is_organization_member(organization_id));
create policy role_permissions_manage on public.role_permissions for all to authenticated
  using (app_private.has_organization_permission(organization_id, 'organization.manage'))
  with check (app_private.has_organization_permission(organization_id, 'organization.manage'));

create policy organization_memberships_select on public.organization_memberships for select to authenticated
  using (user_id = (select auth.uid()) or app_private.has_organization_permission(organization_id, 'members.manage'));
create policy organization_memberships_manage on public.organization_memberships for all to authenticated
  using (app_private.has_organization_permission(organization_id, 'members.manage'))
  with check (app_private.has_organization_permission(organization_id, 'members.manage'));

create policy organization_member_roles_select on public.organization_member_roles for select to authenticated
  using (app_private.is_organization_member(organization_id));
create policy organization_member_roles_manage on public.organization_member_roles for all to authenticated
  using (app_private.has_organization_permission(organization_id, 'members.manage'))
  with check (app_private.has_organization_permission(organization_id, 'members.manage'));

create policy projects_select on public.projects for select to authenticated
  using (app_private.can_access_project(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and app_private.has_organization_permission(organization_id, 'projects.create')
  );
create policy projects_update on public.projects for update to authenticated
  using (app_private.has_project_permission(id, 'project.configure'))
  with check (app_private.has_project_permission(id, 'project.configure'));

create policy project_memberships_select on public.project_memberships for select to authenticated
  using (app_private.can_access_project(project_id));
create policy project_memberships_manage on public.project_memberships for all to authenticated
  using (app_private.has_project_permission(project_id, 'members.manage'))
  with check (app_private.has_project_permission(project_id, 'members.manage'));

create policy project_member_roles_select on public.project_member_roles for select to authenticated
  using (app_private.can_access_project(project_id));
create policy project_member_roles_manage on public.project_member_roles for all to authenticated
  using (app_private.has_project_permission(project_id, 'members.manage'))
  with check (app_private.has_project_permission(project_id, 'members.manage'));

create policy buildings_select on public.buildings for select to authenticated
  using (app_private.can_access_project(project_id));
create policy buildings_manage on public.buildings for all to authenticated
  using (app_private.has_project_permission(project_id, 'project.configure'))
  with check (app_private.has_project_permission(project_id, 'project.configure'));

create policy parties_select on public.parties for select to authenticated
  using (app_private.can_access_project(project_id));
create policy parties_manage on public.parties for all to authenticated
  using (app_private.has_project_permission(project_id, 'project.configure'))
  with check (app_private.has_project_permission(project_id, 'project.configure'));

create policy day_reports_select on public.day_reports for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'reports.read')
    or (status = 'approved' and app_private.has_project_permission(project_id, 'reports.readapproved'))
  );
create policy day_reports_insert on public.day_reports for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'reports.create'));
create policy day_reports_update on public.day_reports for update to authenticated
  using (app_private.has_project_permission(project_id, 'reports.edit') and status in ('draft', 'in_progress', 'returned'))
  with check (app_private.has_project_permission(project_id, 'reports.edit'));
create policy day_reports_review on public.day_reports for update to authenticated
  using (app_private.has_project_permission(project_id, 'reports.review') and status in ('ready_for_review', 'in_review'))
  with check (app_private.has_project_permission(project_id, 'reports.review'));

create policy attendance_entries_select on public.attendance_entries for select to authenticated
  using (app_private.has_project_permission(project_id, 'attendance.read'));
create policy attendance_entries_insert on public.attendance_entries for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'attendance.manage'));
create policy attendance_entries_update on public.attendance_entries for update to authenticated
  using (app_private.has_project_permission(project_id, 'attendance.manage'))
  with check (app_private.has_project_permission(project_id, 'attendance.manage'));

create policy site_registrations_select on public.site_registrations for select to authenticated
  using (app_private.has_project_permission(project_id, 'records.read'));
create policy site_registrations_insert on public.site_registrations for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'records.create'));
create policy site_registrations_update on public.site_registrations for update to authenticated
  using (app_private.has_project_permission(project_id, 'records.edit'))
  with check (app_private.has_project_permission(project_id, 'records.edit'));

create policy actions_select on public.actions for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'actions.read')
    or owner_user_id = (select auth.uid())
  );
create policy actions_insert on public.actions for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'actions.create'));
create policy actions_update on public.actions for update to authenticated
  using (owner_user_id = (select auth.uid()) or app_private.has_project_permission(project_id, 'actions.manage'))
  with check (owner_user_id = (select auth.uid()) or app_private.has_project_permission(project_id, 'actions.manage'));

create policy report_versions_select on public.report_versions for select to authenticated
  using (
    app_private.has_project_permission(project_id, 'reports.read')
    or (
      app_private.has_project_permission(project_id, 'reports.readapproved')
      and exists (
        select 1
        from public.day_reports report
        where report.id = day_report_id
          and report.status = 'approved'
      )
    )
  );
create policy report_versions_insert on public.report_versions for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'reports.freeze'));

create policy audit_events_select on public.audit_events for select to authenticated
  using (
    (project_id is not null and app_private.has_project_permission(project_id, 'audit.read'))
    or (project_id is null and app_private.has_organization_permission(organization_id, 'audit.read'))
  );

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.permissions to authenticated;
grant select, insert, update on public.roles to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant select, insert, update on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.organization_member_roles to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert, update on public.project_memberships to authenticated;
grant select, insert, update, delete on public.project_member_roles to authenticated;
grant select, insert, update on public.buildings to authenticated;
grant select, insert, update on public.parties to authenticated;
grant select, insert, update on public.day_reports to authenticated;
grant select, insert, update on public.attendance_entries to authenticated;
grant select, insert, update on public.site_registrations to authenticated;
grant select, insert, update on public.actions to authenticated;
grant select, insert on public.report_versions to authenticated;
grant select on public.audit_events to authenticated;

grant usage on schema app_private to authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.is_organization_member(uuid) to authenticated;
grant execute on function app_private.has_organization_permission(uuid, text) to authenticated;
grant execute on function app_private.is_project_member(uuid) to authenticated;
grant execute on function app_private.can_access_project(uuid) to authenticated;
grant execute on function app_private.has_project_permission(uuid, text) to authenticated;
grant execute on function app_private.can_view_profile(uuid) to authenticated;

revoke all on function public.bootstrap_organization(text, text, text) from public, anon;
revoke all on function public.create_day_report(uuid, date, text) from public, anon;
revoke all on function public.create_site_registration(uuid, uuid, date, text, text, text, text, timestamptz, text) from public, anon;
revoke all on function public.freeze_report_version(uuid, text, jsonb, text, jsonb, text) from public, anon;
grant execute on function public.bootstrap_organization(text, text, text) to authenticated;
grant execute on function public.create_day_report(uuid, date, text) to authenticated;
grant execute on function public.create_site_registration(uuid, uuid, date, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.freeze_report_version(uuid, text, jsonb, text, jsonb, text) to authenticated;

commit;
