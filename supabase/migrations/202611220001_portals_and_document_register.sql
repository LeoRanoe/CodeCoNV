-- CODECO Construction Supervision App: functional requirements FINAL (with Client Portal).
-- Closes the gaps between the existing application and the developer requirements:
--
--  1. Project Documents register (sections 4.1-4.4, journey 17.2): one canonical document
--     record per document number, revisions that are never overwritten, a review status that
--     only an authorised reviewer changes, superseded revisions marked and linked, links to
--     related records, and an append-only event log per document.
--  2. Contractor Portal and Client Portal (sections 6, 7, 21-23): a record is not copied into
--     the portal. CODECO assigns (contractor) or routes/publishes (client) an existing record to
--     one party with a requested action, due date, priority, a contractor/client-visible summary
--     and the files chosen for that party. Every acknowledgement, response, resubmission,
--     review, approval, verification and closure is an append-only portal event with actor,
--     organisation, role, round, previous and resulting status.
--  3. Portal roles (6.4, 21.4): Contractor Admin / Representative / Read-only and Client
--     Viewer / Reviewer / Approver / Administrator. A portal user is linked to exactly one
--     party (contractor or client organisation) of the project.
--  4. Data separation (8, 8.1, 19, 23): every portal read is scoped by the user's own party
--     in row-level security, not by the screen. Contractor A never reads contractor B's
--     shares, events, files or submissions, also not by guessing ids; a client never reads a
--     contractor share and the other way round.
--     The legacy contractor role loses files.read and files.manage (it could read and edit
--     every project file) and its submission read is limited to its own and its party's
--     submissions. External share-link responses are no longer readable by any member.
--
-- Additive except for the contractor revocations in step 4 and the replaced policies, which
-- are listed per statement. Rollback: drop the new tables and functions, restore the policies
-- files_select/files_insert (202607180023), file_links_insert (202607180006),
-- project_register_entries_select (202607300001), external_share_links_select and
-- external_share_responses_select (can_access_project), can_manage_project_files
-- (202607190001) and default_operational_role_permissions (202610060003), and re-grant
-- files.read / files.manage to the contractor roles.

begin;

-- 0. Permissions -----------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('documents.read', 'Read the project document register and revisions'),
  ('documents.manage', 'Register project documents, upload revisions and link records'),
  ('documents.review', 'Set the review status of a document revision'),
  ('portal.share', 'Assign records to the contractor portal and route or publish to the client portal'),
  ('portal.contractor', 'Open the contractor portal for the own contractor organisation'),
  ('portal.contractor.respond', 'Acknowledge, respond, resubmit and submit evidence in the contractor portal'),
  ('portal.client', 'Open the client portal for the own client organisation'),
  ('portal.client.review', 'Comment, acknowledge and ask for clarification in the client portal'),
  ('portal.client.approve', 'Approve or reject items routed to the client'),
  ('portal.members', 'Manage the users of the own organisation (only when CODECO enables it)')
on conflict (code) do nothing;

-- The organisation administrator holds every permission (016_role_permission_matrix).
insert into public.role_permissions (organization_id, role_id, permission_code)
select role.organization_id, role.id, permission.code
from public.roles role
cross join public.permissions permission
where role.code = 'organization_admin' and role.scope = 'organization'
  and permission.code in ('documents.read','documents.manage','documents.review','portal.share',
    'portal.contractor','portal.contractor.respond','portal.client','portal.client.review',
    'portal.client.approve','portal.members')
on conflict do nothing;

-- 1. Role defaults ----------------------------------------------------------------------
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
      'documents.read','documents.manage'
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

-- The portal roles exist in every organisation: created next to the system roles of a new
-- organisation (bootstrap_organization inserts external_guest last) and added to existing ones.
create or replace function app_private.create_portal_roles()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.scope = 'project' and new.code = 'external_guest' and new.is_system then
    insert into public.roles (organization_id, scope, code, name, is_system, created_by)
    select new.organization_id, 'project', role_row.code, role_row.name, true, new.created_by
    from (values
      ('contractor_admin', 'Aannemer · beheerder'),
      ('contractor_representative', 'Aannemer · vertegenwoordiger'),
      ('contractor_readonly', 'Aannemer · alleen lezen'),
      ('client_viewer', 'Opdrachtgever · lezer'),
      ('client_reviewer', 'Opdrachtgever · beoordelaar'),
      ('client_approver', 'Opdrachtgever · goedkeurder'),
      ('client_admin', 'Opdrachtgever · beheerder')
    ) as role_row(code, name)
    on conflict (organization_id, scope, code) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function app_private.create_portal_roles() from public, anon, authenticated;
drop trigger if exists roles_create_portal_roles on public.roles;
create trigger roles_create_portal_roles after insert on public.roles
  for each row execute function app_private.create_portal_roles();

insert into public.roles (organization_id, scope, code, name, is_system, created_by)
select organization.id, 'project', role_row.code, role_row.name, true, organization.created_by
from public.organizations organization
cross join (values
  ('contractor_admin', 'Aannemer · beheerder'),
  ('contractor_representative', 'Aannemer · vertegenwoordiger'),
  ('contractor_readonly', 'Aannemer · alleen lezen'),
  ('client_viewer', 'Opdrachtgever · lezer'),
  ('client_reviewer', 'Opdrachtgever · beoordelaar'),
  ('client_approver', 'Opdrachtgever · goedkeurder'),
  ('client_admin', 'Opdrachtgever · beheerder')
) as role_row(code, name)
on conflict (organization_id, scope, code) do nothing;

-- Existing roles get the new defaults (grants only; the trigger covers new roles).
insert into public.role_permissions (organization_id, role_id, permission_code)
select role.organization_id, role.id, permission_code
from public.roles role
cross join lateral unnest(app_private.default_operational_role_permissions(role.code)) permission_code
where role.scope = 'project'
  and exists (select 1 from public.permissions permission where permission.code = permission_code)
on conflict do nothing;

-- Step 4 revocation: a contractor read and could edit every file of the project.
delete from public.role_permissions grant_row
using public.roles role
where role.id = grant_row.role_id
  and role.scope = 'project'
  and role.code = 'contractor'
  and grant_row.permission_code in ('files.read', 'files.manage');

-- 2. Portal organisation of a project member ------------------------------------------
alter table public.project_memberships
  add column if not exists portal_party_id uuid;
alter table public.project_memberships drop constraint if exists project_memberships_portal_party_fk;
alter table public.project_memberships
  add constraint project_memberships_portal_party_fk
  foreign key (portal_party_id, project_id, organization_id)
  references public.parties(id, project_id, organization_id);
comment on column public.project_memberships.portal_party_id is
  'The contractor or client organisation (party) a portal user acts for. Every portal read is scoped to it.';

create or replace function app_private.portal_party(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select membership.portal_party_id
  from public.project_memberships membership
  where membership.project_id = p_project_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
  limit 1;
$$;

-- Whether the signed-in user may see a share of this audience and party.
create or replace function app_private.portal_audience_allowed(p_project_id uuid, p_audience text, p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_party_id is not null
    and p_party_id = app_private.portal_party(p_project_id)
    and app_private.has_project_permission(p_project_id, case p_audience when 'contractor' then 'portal.contractor' else 'portal.client' end);
$$;

-- CODECO's own view of the portals: who assigns, and the project staff who edit records.
create or replace function app_private.portal_internal(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select app_private.has_project_permission(p_project_id, 'portal.share')
    or app_private.has_project_permission(p_project_id, 'records.edit');
$$;

-- A permission of another user, for choosing notification recipients.
create or replace function app_private.user_has_project_permission(p_user_id uuid, p_project_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_memberships membership
    join public.project_member_roles member_role
      on member_role.membership_id = membership.id
     and member_role.project_id = membership.project_id
     and member_role.organization_id = membership.organization_id
    join public.roles role on role.id = member_role.role_id and role.scope = 'project'
    join public.role_permissions grant_row on grant_row.role_id = role.id and grant_row.permission_code = p_code
    where membership.project_id = p_project_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
  );
$$;

revoke all on function app_private.portal_party(uuid) from public, anon;
revoke all on function app_private.portal_audience_allowed(uuid, text, uuid) from public, anon;
revoke all on function app_private.portal_internal(uuid) from public, anon;
revoke all on function app_private.user_has_project_permission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function app_private.portal_party(uuid) to authenticated;
grant execute on function app_private.portal_audience_allowed(uuid, text, uuid) to authenticated;
grant execute on function app_private.portal_internal(uuid) to authenticated;

-- 3. Project document register ----------------------------------------------------------
create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  document_number text check (document_number is null or char_length(document_number) between 1 and 80),
  title text not null check (char_length(title) between 2 and 240),
  folder_code text not null check (folder_code ~ '^[0-9A-Za-z][0-9A-Za-z_-]{0,15}$'),
  discipline text check (discipline is null or char_length(discipline) <= 80),
  document_type text check (document_type is null or char_length(document_type) <= 80),
  originator_party_id uuid,
  originator_name text check (originator_name is null or char_length(originator_name) <= 180),
  building_ids uuid[] not null default '{}',
  work_package text check (work_package is null or char_length(work_package) <= 120),
  current_revision_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (originator_party_id, project_id, organization_id) references public.parties(id, project_id, organization_id)
);
create unique index if not exists project_documents_number_key
  on public.project_documents (project_id, lower(document_number)) where document_number is not null;
create index if not exists project_documents_folder_idx on public.project_documents (project_id, folder_code, updated_at desc);

create table if not exists public.project_document_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  document_id uuid not null,
  revision text not null check (char_length(revision) between 1 and 20),
  file_id uuid not null,
  review_status text not null check (review_status in ('draft','submitted','under_review','approved',
    'approved_with_comments','revise_resubmit','rejected','for_information','for_construction','superseded','withdrawn')),
  issue_date date,
  transmittal_ref text check (transmittal_ref is null or char_length(transmittal_ref) <= 80),
  notes text check (notes is null or char_length(notes) <= 2000),
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_comment text check (review_comment is null or char_length(review_comment) <= 2000),
  superseded_by uuid,
  superseded_at timestamptz,
  unique (document_id, revision),
  unique (id, project_id, organization_id),
  foreign key (document_id, project_id, organization_id) references public.project_documents(id, project_id, organization_id),
  foreign key (file_id, project_id, organization_id) references public.files(id, project_id, organization_id)
);
create index if not exists project_document_revisions_document_idx on public.project_document_revisions (document_id, uploaded_at desc);

alter table public.project_documents drop constraint if exists project_documents_current_revision_fk;
alter table public.project_documents add constraint project_documents_current_revision_fk
  foreign key (current_revision_id, project_id, organization_id)
  references public.project_document_revisions(id, project_id, organization_id);

create table if not exists public.project_document_events (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity,
  organization_id uuid not null,
  project_id uuid not null,
  document_id uuid not null,
  revision_id uuid,
  action text not null check (action in ('register','revision','status','supersede','update','link','unlink','share')),
  from_status text,
  to_status text,
  comment text check (comment is null or char_length(comment) <= 2000),
  details jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (document_id, project_id, organization_id) references public.project_documents(id, project_id, organization_id)
);
create index if not exists project_document_events_document_idx on public.project_document_events (document_id, sequence);

create table if not exists public.project_document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  document_id uuid not null,
  record_type text not null check (record_type in ('finding','action','hse','inspection','register_entry','report')),
  record_id uuid not null,
  record_code text check (record_code is null or char_length(record_code) <= 80),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (document_id, record_type, record_id),
  foreign key (document_id, project_id, organization_id) references public.project_documents(id, project_id, organization_id)
);
create index if not exists project_document_links_record_idx on public.project_document_links (project_id, record_type, record_id);

-- 4. Portal shares ----------------------------------------------------------------------
create table if not exists public.portal_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  audience text not null check (audience in ('contractor','client')),
  party_id uuid not null,
  record_type text not null check (record_type in ('finding','action','hse','inspection','register_entry','document','publication','file')),
  record_id uuid not null,
  record_code text check (record_code is null or char_length(record_code) <= 80),
  building_id uuid,
  title text not null check (char_length(title) between 2 and 240),
  visible_summary text check (visible_summary is null or char_length(visible_summary) <= 4000),
  requested_action text not null check (requested_action in ('acknowledge','comment','propose','submit_evidence','implement','sign','attend','review','approve','information')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  due_at timestamptz,
  contact_user_id uuid references auth.users(id),
  publication_type text check (publication_type is null or publication_type in ('daily','weekly','monthly','quality','hse','inspection','delay','contractor_performance','progress','schedule','other')),
  period_start date,
  period_end date,
  publication_key text,
  publication_version integer not null default 1 check (publication_version > 0),
  status text not null check (status in ('assigned','acknowledged','responded','returned','submitted_for_verification',
    'accepted','verified','approved','rejected','clarification_requested','published','closed','withdrawn','superseded')),
  round integer not null default 1 check (round > 0),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, project_id, organization_id),
  check (period_end is null or period_start is null or period_end >= period_start),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (party_id, project_id, organization_id) references public.parties(id, project_id, organization_id)
);
create index if not exists portal_shares_party_idx on public.portal_shares (project_id, audience, party_id, status);
create index if not exists portal_shares_record_idx on public.portal_shares (project_id, record_type, record_id);

create table if not exists public.portal_share_files (
  share_id uuid not null,
  organization_id uuid not null,
  project_id uuid not null,
  file_id uuid not null,
  source text not null check (source in ('shared','response')),
  added_by uuid not null references auth.users(id),
  added_at timestamptz not null default now(),
  primary key (share_id, file_id),
  foreign key (share_id, project_id, organization_id) references public.portal_shares(id, project_id, organization_id),
  foreign key (file_id, project_id, organization_id) references public.files(id, project_id, organization_id)
);
create index if not exists portal_share_files_file_idx on public.portal_share_files (file_id);

create table if not exists public.portal_events (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity,
  organization_id uuid not null,
  project_id uuid not null,
  share_id uuid not null,
  round integer not null,
  action text not null check (action in ('assign','publish','acknowledge','comment','respond','resubmit','submit_evidence',
    'mark_complete','approve','reject','request_clarification','accept','return','verify','close','withdraw','reopen',
    'supersede','add_files','view','download')),
  actor_user_id uuid not null references auth.users(id),
  actor_name text,
  actor_side text not null check (actor_side in ('codeco','contractor','client')),
  actor_party_id uuid,
  actor_roles text,
  comment text check (comment is null or char_length(comment) <= 4000),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 32768),
  file_ids uuid[] not null default '{}',
  previous_status text,
  resulting_status text,
  created_at timestamptz not null default now(),
  foreign key (share_id, project_id, organization_id) references public.portal_shares(id, project_id, organization_id)
);
create index if not exists portal_events_share_idx on public.portal_events (share_id, sequence);

-- Workflow events and document events are append-only (7.2).
create or replace function app_private.reject_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Workflow events are append-only' using errcode = '55000';
end;
$$;
drop trigger if exists portal_events_append_only on public.portal_events;
create trigger portal_events_append_only before update or delete on public.portal_events
  for each row execute function app_private.reject_event_mutation();
drop trigger if exists project_document_events_append_only on public.project_document_events;
create trigger project_document_events_append_only before update or delete on public.project_document_events
  for each row execute function app_private.reject_event_mutation();

-- 5. Row-level security -------------------------------------------------------------------
alter table public.project_documents enable row level security;
alter table public.project_document_revisions enable row level security;
alter table public.project_document_events enable row level security;
alter table public.project_document_links enable row level security;
alter table public.portal_shares enable row level security;
alter table public.portal_share_files enable row level security;
alter table public.portal_events enable row level security;

revoke all on public.project_documents, public.project_document_revisions, public.project_document_events,
  public.project_document_links, public.portal_shares, public.portal_share_files, public.portal_events
  from anon, authenticated;
grant select on public.project_documents, public.project_document_revisions, public.project_document_events,
  public.project_document_links, public.portal_shares, public.portal_share_files, public.portal_events
  to authenticated;

drop policy if exists portal_shares_select on public.portal_shares;
create policy portal_shares_select on public.portal_shares for select to authenticated using (
  app_private.portal_internal(project_id)
  or (status <> 'withdrawn' and app_private.portal_audience_allowed(project_id, audience, party_id))
);
drop policy if exists portal_share_files_select on public.portal_share_files;
create policy portal_share_files_select on public.portal_share_files for select to authenticated using (
  exists (select 1 from public.portal_shares share where share.id = share_id)
);
drop policy if exists portal_events_select on public.portal_events;
create policy portal_events_select on public.portal_events for select to authenticated using (
  exists (select 1 from public.portal_shares share where share.id = share_id)
);

drop policy if exists project_documents_select on public.project_documents;
create policy project_documents_select on public.project_documents for select to authenticated using (
  app_private.has_project_permission(project_id, 'documents.read')
  or exists (select 1 from public.portal_shares share
    where share.project_id = project_documents.project_id and share.record_type = 'document' and share.record_id = project_documents.id)
);
drop policy if exists project_document_revisions_select on public.project_document_revisions;
create policy project_document_revisions_select on public.project_document_revisions for select to authenticated using (
  app_private.has_project_permission(project_id, 'documents.read')
  or exists (select 1 from public.portal_shares share
    where share.project_id = project_document_revisions.project_id and share.record_type = 'document' and share.record_id = project_document_revisions.document_id)
);
drop policy if exists project_document_events_select on public.project_document_events;
create policy project_document_events_select on public.project_document_events for select to authenticated using (
  app_private.has_project_permission(project_id, 'documents.read')
);
drop policy if exists project_document_links_select on public.project_document_links;
create policy project_document_links_select on public.project_document_links for select to authenticated using (
  app_private.has_project_permission(project_id, 'documents.read')
);

-- Files: own uploads, and files deliberately shared with the user's party (8.1 file-level).
drop policy if exists files_select on public.files;
create policy files_select on public.files for select to authenticated using (
  app_private.has_project_permission(project_id, 'files.read')
  or app_private.has_project_permission(project_id, 'files.manage')
  -- A portal user's own upload, readable while the portal right is active (never after revocation).
  or (created_by = (select auth.uid()) and app_private.has_project_permission(project_id, 'portal.contractor.respond'))
  or exists (select 1 from public.portal_share_files shared where shared.file_id = files.id)
);
drop policy if exists files_insert on public.files;
create policy files_insert on public.files for insert to authenticated with check (
  created_by = (select auth.uid())
  and (
    app_private.has_project_permission(project_id, 'files.manage')
    or (category in ('document','evidence','photo','certificate')
      and app_private.has_project_permission(project_id, 'portal.contractor.respond')
      and app_private.portal_party(project_id) is not null)
  )
);

-- A contractor attaches its own upload to its own controlled submission.
drop policy if exists file_links_insert on public.file_links;
create policy file_links_insert on public.file_links for insert to authenticated with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.files file
    where file.id = file_id
      and (
        app_private.has_project_permission(file.project_id, 'files.manage')
        or (file.created_by = (select auth.uid())
          and record_type = 'register_entry'
          and app_private.has_project_permission(file.project_id, 'portal.contractor.respond')
          and exists (select 1 from public.project_register_entries entry
            where entry.id = record_id and entry.project_id = file.project_id and entry.created_by = (select auth.uid())))
      )
  )
);

create or replace function public.can_manage_project_files(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select (select auth.uid()) is not null
    and (
      app_private.has_project_permission(p_project_id, 'files.manage')
      or (app_private.has_project_permission(p_project_id, 'portal.contractor.respond')
        and app_private.portal_party(p_project_id) is not null)
    );
$$;

-- Controlled submissions: a contractor reads its own and its organisation's, not everyone's.
drop policy if exists project_register_entries_select on public.project_register_entries;
create policy project_register_entries_select on public.project_register_entries for select to authenticated using (
  app_private.has_project_permission(project_id, 'records.read')
  or (
    register_type in ('wcr','rfi','rfa','inspection_request')
    and app_private.has_project_permission(project_id, 'submissions.read')
    and (
      app_private.has_project_permission(project_id, 'submissions.review')
      or created_by = (select auth.uid())
      or (responsible_party_id is not null and responsible_party_id = app_private.portal_party(project_id))
    )
  )
);

-- Share links and their responses (names, signatures, notes) are CODECO's working data.
drop policy if exists external_share_links_select on public.external_share_links;
create policy external_share_links_select on public.external_share_links for select to authenticated using (
  app_private.has_project_permission(project_id, 'records.read') or created_by = (select auth.uid())
);
drop policy if exists external_share_responses_select on public.external_share_responses;
create policy external_share_responses_select on public.external_share_responses for select to authenticated using (
  app_private.has_project_permission(project_id, 'records.read')
);

-- 6. Helpers ----------------------------------------------------------------------------
create or replace function app_private.portal_actor_roles(p_project_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select string_agg(distinct role.code, ',' order by role.code)
  from public.project_memberships membership
  join public.project_member_roles member_role on member_role.membership_id = membership.id and member_role.project_id = membership.project_id
  join public.roles role on role.id = member_role.role_id
  where membership.project_id = p_project_id and membership.user_id = p_user_id and membership.status = 'active';
$$;

-- Portal users of one party who may open that portal. Previews never carry record content (8.1).
create or replace function app_private.notify_portal_party(p_share public.portal_shares, p_title text, p_body text, p_type text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, due_at, dedupe_key)
  select p_share.organization_id, p_share.project_id, membership.user_id, p_type, p_title, p_body, 'portal_share', p_share.id, p_share.due_at,
    'portal:' || p_share.id || ':' || p_share.round || ':' || p_share.status || ':' || membership.user_id
  from public.project_memberships membership
  where membership.project_id = p_share.project_id
    and membership.portal_party_id = p_share.party_id
    and membership.status = 'active'
    and membership.user_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
    and app_private.user_has_project_permission(membership.user_id, p_share.project_id,
      case p_share.audience when 'contractor' then 'portal.contractor' else 'portal.client' end)
  on conflict do nothing;
end;
$$;

create or replace function app_private.notify_user(p_share public.portal_shares, p_user_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_user_id is null or p_user_id = (select auth.uid()) then return; end if;
  insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, due_at, dedupe_key)
  values (p_share.organization_id, p_share.project_id, p_user_id, 'review_requested', p_title, p_body, 'portal_share', p_share.id, p_share.due_at,
    'portal-review:' || p_share.id || ':' || p_share.round || ':' || p_share.status || ':' || p_user_id)
  on conflict do nothing;
end;
$$;

revoke all on function app_private.portal_actor_roles(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.notify_portal_party(public.portal_shares, text, text, text) from public, anon, authenticated;
revoke all on function app_private.notify_user(public.portal_shares, uuid, text, text) from public, anon, authenticated;

-- A party's portal user: link (or unlink) a project member to the contractor/client party.
create or replace function public.set_project_member_portal_party(p_project_id uuid, p_user_id uuid, p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_membership public.project_memberships;
  v_party public.parties;
begin
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not (app_private.has_organization_permission(v_project.organization_id, 'members.manage')
      or app_private.has_project_permission(p_project_id, 'members.manage')) then
    raise exception 'Only an administrator links portal users to an organisation' using errcode = '42501';
  end if;
  select * into v_membership from public.project_memberships where project_id = p_project_id and user_id = p_user_id for update;
  if v_membership.id is null then raise exception 'This user is not on the project' using errcode = 'P0002'; end if;
  if p_party_id is not null then
    select * into v_party from public.parties where id = p_party_id and project_id = p_project_id;
    if v_party.id is null then raise exception 'The organisation is not a party of this project' using errcode = '22023'; end if;
    if v_party.party_type = 'supervisor' then raise exception 'A portal user acts for a contractor or client organisation' using errcode = '22023'; end if;
  end if;
  update public.project_memberships set portal_party_id = p_party_id, updated_at = now() where id = v_membership.id;
  insert into public.audit_events (organization_id, project_id, actor_user_id, operation, table_name, record_id, old_values, new_values)
  values (v_project.organization_id, p_project_id, v_actor, 'STATUS', 'project_memberships', v_membership.id,
    jsonb_build_object('portal_party_id', v_membership.portal_party_id),
    jsonb_build_object('portal_party_id', p_party_id, 'user_id', p_user_id));
end;
$$;

-- 7. Document register functions --------------------------------------------------------
create or replace function app_private.document_status_allowed(p_project_id uuid, p_status text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  -- An uploaded drawing is not approved for construction by being uploaded (4.3).
  select p_status in ('draft','submitted','for_information')
    or (app_private.has_project_permission(p_project_id, 'documents.review')
      and p_status in ('under_review','approved','approved_with_comments','revise_resubmit','rejected','for_construction','withdrawn'));
$$;
revoke all on function app_private.document_status_allowed(uuid, text) from public, anon, authenticated;

create or replace function app_private.check_document_file(p_project_id uuid, p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (select 1 from public.files file where file.id = p_file_id and file.project_id = p_project_id and file.status = 'available') then
    raise exception 'The file is not an available file of this project' using errcode = '22023';
  end if;
end;
$$;
revoke all on function app_private.check_document_file(uuid, uuid) from public, anon, authenticated;

create or replace function app_private.notify_document_reviewers(p_document public.project_documents, p_revision public.project_document_revisions, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, dedupe_key)
  select p_document.organization_id, p_document.project_id, membership.user_id, 'review_requested', p_title, p_body, 'project_document', p_document.id,
    'document:' || p_revision.id || ':' || p_revision.review_status || ':' || membership.user_id
  from public.project_memberships membership
  where membership.project_id = p_document.project_id and membership.status = 'active'
    and membership.user_id <> (select auth.uid())
    and app_private.user_has_project_permission(membership.user_id, p_document.project_id, 'documents.review')
  on conflict do nothing;
end;
$$;
revoke all on function app_private.notify_document_reviewers(public.project_documents, public.project_document_revisions, text, text) from public, anon, authenticated;

create or replace function public.register_project_document(
  p_project_id uuid,
  p_document_number text,
  p_title text,
  p_folder_code text,
  p_discipline text,
  p_document_type text,
  p_originator_party_id uuid,
  p_originator_name text,
  p_building_ids uuid[],
  p_work_package text,
  p_revision text,
  p_review_status text,
  p_issue_date date,
  p_transmittal_ref text,
  p_notes text,
  p_file_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_document public.project_documents;
  v_revision public.project_document_revisions;
  v_status text := coalesce(nullif(trim(p_review_status), ''), 'submitted');
begin
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null or not app_private.has_project_permission(p_project_id, 'documents.manage') then
    raise exception 'No right to register project documents' using errcode = '42501';
  end if;
  if not app_private.document_status_allowed(p_project_id, v_status) then
    raise exception 'Only an authorised reviewer sets this document status' using errcode = '42501';
  end if;
  perform app_private.check_document_file(p_project_id, p_file_id);
  if exists (select 1 from unnest(coalesce(p_building_ids, '{}')) building_id
      where not exists (select 1 from public.buildings building where building.id = building_id and building.project_id = p_project_id)) then
    raise exception 'A building is not part of this project' using errcode = '22023';
  end if;

  insert into public.project_documents (organization_id, project_id, document_number, title, folder_code, discipline, document_type,
    originator_party_id, originator_name, building_ids, work_package, created_by)
  values (v_project.organization_id, p_project_id, nullif(trim(p_document_number), ''), trim(p_title), trim(p_folder_code),
    nullif(trim(p_discipline), ''), nullif(trim(p_document_type), ''), p_originator_party_id, nullif(trim(p_originator_name), ''),
    coalesce(p_building_ids, '{}'), nullif(trim(p_work_package), ''), v_actor)
  returning * into v_document;

  insert into public.project_document_revisions (organization_id, project_id, document_id, revision, file_id, review_status,
    issue_date, transmittal_ref, notes, uploaded_by)
  values (v_project.organization_id, p_project_id, v_document.id, coalesce(nullif(trim(p_revision), ''), '0'), p_file_id, v_status,
    p_issue_date, nullif(trim(p_transmittal_ref), ''), nullif(trim(p_notes), ''), v_actor)
  returning * into v_revision;

  update public.project_documents set current_revision_id = v_revision.id where id = v_document.id returning * into v_document;

  insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, to_status, details, actor_user_id)
  values (v_project.organization_id, p_project_id, v_document.id, v_revision.id, 'register', v_status,
    jsonb_build_object('revision', v_revision.revision, 'transmittal', v_revision.transmittal_ref, 'file_id', p_file_id), v_actor);

  if v_status in ('submitted','under_review') then
    perform app_private.notify_document_reviewers(v_document, v_revision,
      'Document review: ' || coalesce(v_document.document_number, left(v_document.title, 60)),
      'Revision ' || v_revision.revision || ' is waiting for review.');
  end if;
  return v_document.id;
end;
$$;

create or replace function public.add_project_document_revision(
  p_document_id uuid,
  p_revision text,
  p_file_id uuid,
  p_review_status text,
  p_issue_date date,
  p_transmittal_ref text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.project_documents;
  v_revision public.project_document_revisions;
  v_previous public.project_document_revisions;
  v_share public.portal_shares;
  v_status text := coalesce(nullif(trim(p_review_status), ''), 'submitted');
begin
  select * into v_document from public.project_documents where id = p_document_id for update;
  if v_document.id is null or not app_private.has_project_permission(v_document.project_id, 'documents.manage') then
    raise exception 'No right to upload document revisions' using errcode = '42501';
  end if;
  if not app_private.document_status_allowed(v_document.project_id, v_status) then
    raise exception 'Only an authorised reviewer sets this document status' using errcode = '42501';
  end if;
  if exists (select 1 from public.project_document_revisions where document_id = p_document_id and lower(revision) = lower(trim(p_revision))) then
    raise exception 'This revision already exists; a new revision needs its own revision mark' using errcode = '23505';
  end if;
  perform app_private.check_document_file(v_document.project_id, p_file_id);

  insert into public.project_document_revisions (organization_id, project_id, document_id, revision, file_id, review_status,
    issue_date, transmittal_ref, notes, uploaded_by)
  values (v_document.organization_id, v_document.project_id, p_document_id, trim(p_revision), p_file_id, v_status,
    p_issue_date, nullif(trim(p_transmittal_ref), ''), nullif(trim(p_notes), ''), v_actor)
  returning * into v_revision;

  -- Never overwrite: the earlier revisions stay, marked superseded and linked to the new one.
  for v_previous in
    select * from public.project_document_revisions
    where document_id = p_document_id and id <> v_revision.id and superseded_at is null and review_status <> 'withdrawn'
    for update
  loop
    update public.project_document_revisions
      set review_status = 'superseded', superseded_by = v_revision.id, superseded_at = now()
      where id = v_previous.id;
    insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, from_status, to_status, details, actor_user_id)
    values (v_document.organization_id, v_document.project_id, p_document_id, v_previous.id, 'supersede', v_previous.review_status, 'superseded',
      jsonb_build_object('revision', v_previous.revision, 'superseded_by', v_revision.revision), v_actor);
  end loop;

  update public.project_documents set current_revision_id = v_revision.id, updated_at = now() where id = p_document_id returning * into v_document;
  insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, to_status, details, actor_user_id)
  values (v_document.organization_id, v_document.project_id, p_document_id, v_revision.id, 'revision', v_status,
    jsonb_build_object('revision', v_revision.revision, 'transmittal', v_revision.transmittal_ref, 'file_id', p_file_id), v_actor);

  -- Parties the document is shared with get the new revision and a notification (4.3).
  for v_share in
    select * from public.portal_shares
    where project_id = v_document.project_id and record_type = 'document' and record_id = p_document_id
      and status not in ('withdrawn','closed','superseded')
  loop
    insert into public.portal_share_files (share_id, organization_id, project_id, file_id, source, added_by)
    values (v_share.id, v_share.organization_id, v_share.project_id, p_file_id, 'shared', v_actor)
    on conflict do nothing;
    insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side,
      comment, file_ids, previous_status, resulting_status)
    values (v_share.organization_id, v_share.project_id, v_share.id, v_share.round, 'add_files', v_actor,
      (select display_name from public.profiles where id = v_actor), 'codeco',
      'Revision ' || v_revision.revision, array[p_file_id], v_share.status, v_share.status);
    perform app_private.notify_portal_party(v_share, 'Document revised: ' || coalesce(v_share.record_code, 'shared document'),
      'A new revision is available in the portal.', 'system');
  end loop;

  if v_status in ('submitted','under_review') then
    perform app_private.notify_document_reviewers(v_document, v_revision,
      'Document review: ' || coalesce(v_document.document_number, left(v_document.title, 60)),
      'Revision ' || v_revision.revision || ' is waiting for review.');
  end if;
  return v_revision.id;
end;
$$;

create or replace function public.set_project_document_revision_status(p_revision_id uuid, p_status text, p_comment text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_revision public.project_document_revisions;
  v_document public.project_documents;
begin
  select * into v_revision from public.project_document_revisions where id = p_revision_id for update;
  if v_revision.id is null or not app_private.has_project_permission(v_revision.project_id, 'documents.review') then
    raise exception 'Only an authorised reviewer changes the review status' using errcode = '42501';
  end if;
  if p_status not in ('under_review','approved','approved_with_comments','revise_resubmit','rejected','for_information','for_construction','withdrawn') then
    raise exception 'Unknown review status' using errcode = '22023';
  end if;
  if v_revision.superseded_at is not null and p_status <> 'withdrawn' then
    raise exception 'A superseded revision keeps its status' using errcode = '55000';
  end if;
  if p_status in ('rejected','revise_resubmit','withdrawn') and char_length(trim(coalesce(p_comment, ''))) < 3 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  update public.project_document_revisions
    set review_status = p_status, reviewed_by = v_actor, reviewed_at = now(), review_comment = nullif(trim(p_comment), '')
    where id = p_revision_id;
  select * into v_document from public.project_documents where id = v_revision.document_id;
  update public.project_documents set updated_at = now() where id = v_document.id;
  insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, from_status, to_status, comment, details, actor_user_id)
  values (v_revision.organization_id, v_revision.project_id, v_revision.document_id, v_revision.id, 'status', v_revision.review_status, p_status,
    nullif(trim(p_comment), ''), jsonb_build_object('revision', v_revision.revision), v_actor);
  if v_revision.uploaded_by <> v_actor then
    insert into public.notifications (organization_id, project_id, recipient_user_id, notification_type, title, body, source_type, source_id, dedupe_key)
    values (v_revision.organization_id, v_revision.project_id, v_revision.uploaded_by, 'system',
      'Document status: ' || coalesce(v_document.document_number, left(v_document.title, 60)),
      'Revision ' || v_revision.revision || ' has a new review status.', 'project_document', v_document.id,
      'document-status:' || v_revision.id || ':' || p_status)
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.update_project_document(
  p_document_id uuid,
  p_document_number text,
  p_title text,
  p_folder_code text,
  p_discipline text,
  p_document_type text,
  p_originator_party_id uuid,
  p_originator_name text,
  p_building_ids uuid[],
  p_work_package text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old public.project_documents;
  v_new public.project_documents;
begin
  select * into v_old from public.project_documents where id = p_document_id for update;
  if v_old.id is null or not app_private.has_project_permission(v_old.project_id, 'documents.manage') then
    raise exception 'No right to change the document register' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_building_ids, '{}')) building_id
      where not exists (select 1 from public.buildings building where building.id = building_id and building.project_id = v_old.project_id)) then
    raise exception 'A building is not part of this project' using errcode = '22023';
  end if;
  update public.project_documents set
    document_number = nullif(trim(p_document_number), ''), title = trim(p_title), folder_code = trim(p_folder_code),
    discipline = nullif(trim(p_discipline), ''), document_type = nullif(trim(p_document_type), ''),
    originator_party_id = p_originator_party_id, originator_name = nullif(trim(p_originator_name), ''),
    building_ids = coalesce(p_building_ids, '{}'), work_package = nullif(trim(p_work_package), ''),
    updated_at = now(), version = version + 1
  where id = p_document_id returning * into v_new;
  insert into public.project_document_events (organization_id, project_id, document_id, action, details, actor_user_id)
  values (v_old.organization_id, v_old.project_id, p_document_id, 'update',
    jsonb_build_object('before', to_jsonb(v_old) - array['current_revision_id','updated_at','version','created_at','created_by'],
      'after', to_jsonb(v_new) - array['current_revision_id','updated_at','version','created_at','created_by']), (select auth.uid()));
end;
$$;

create or replace function public.link_project_document(p_document_id uuid, p_record_type text, p_record_id uuid, p_record_code text, p_unlink boolean default false)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_document public.project_documents;
begin
  select * into v_document from public.project_documents where id = p_document_id;
  if v_document.id is null or not (app_private.has_project_permission(v_document.project_id, 'documents.manage')
      or app_private.has_project_permission(v_document.project_id, 'records.edit')) then
    raise exception 'No right to link documents' using errcode = '42501';
  end if;
  if p_unlink then
    delete from public.project_document_links where document_id = p_document_id and record_type = p_record_type and record_id = p_record_id;
  else
    insert into public.project_document_links (organization_id, project_id, document_id, record_type, record_id, record_code, created_by)
    values (v_document.organization_id, v_document.project_id, p_document_id, p_record_type, p_record_id, nullif(trim(p_record_code), ''), (select auth.uid()))
    on conflict (document_id, record_type, record_id) do nothing;
  end if;
  insert into public.project_document_events (organization_id, project_id, document_id, action, details, actor_user_id)
  values (v_document.organization_id, v_document.project_id, p_document_id, case when p_unlink then 'unlink' else 'link' end,
    jsonb_build_object('record_type', p_record_type, 'record_id', p_record_id, 'record_code', p_record_code), (select auth.uid()));
end;
$$;

-- 8. Portal workflow functions ----------------------------------------------------------
create or replace function public.share_to_portal(
  p_project_id uuid,
  p_audience text,
  p_party_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_title text,
  p_summary text,
  p_requested_action text,
  p_priority text,
  p_due_at timestamptz,
  p_file_ids uuid[],
  p_contact_user_id uuid,
  p_publication_type text default null,
  p_period_start date default null,
  p_period_end date default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_party public.parties;
  v_code text;
  v_building uuid;
  v_found boolean := false;
  v_share public.portal_shares;
  v_previous public.portal_shares;
  v_key text;
  v_version integer := 1;
  v_files uuid[] := coalesce(p_file_ids, '{}');
  v_document_file uuid;
  v_status text;
begin
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null or not app_private.has_project_permission(p_project_id, 'portal.share') then
    raise exception 'Only an authorised CODECO role assigns or publishes to a portal' using errcode = '42501';
  end if;
  if p_audience not in ('contractor','client') then raise exception 'Unknown portal' using errcode = '22023'; end if;
  select * into v_party from public.parties where id = p_party_id and project_id = p_project_id and active;
  if v_party.id is null then raise exception 'The organisation is not an active party of this project' using errcode = '22023'; end if;
  if p_audience = 'client' and v_party.party_type <> 'client' then
    raise exception 'The client portal is for a client organisation' using errcode = '22023';
  end if;
  if p_audience = 'contractor' and v_party.party_type in ('client','supervisor') then
    raise exception 'The contractor portal is for a contractor, supplier or consultant' using errcode = '22023';
  end if;
  if p_audience = 'contractor' and p_requested_action = 'approve' then
    raise exception 'A contractor is not asked to approve; a submission is not authorisation' using errcode = '22023';
  end if;
  if p_contact_user_id is not null and not exists (select 1 from public.project_memberships membership
      where membership.project_id = p_project_id and membership.user_id = p_contact_user_id
        and membership.portal_party_id = p_party_id and membership.status = 'active') then
    raise exception 'The contact is not a portal user of this organisation' using errcode = '22023';
  end if;

  -- The record itself stays where it is; the share points at it (section 1).
  if p_record_type = 'finding' then
    select true, finding_number, building_id into v_found, v_code, v_building from public.findings where id = p_record_id and project_id = p_project_id;
  elsif p_record_type = 'action' then
    select true, action_number, building_id into v_found, v_code, v_building from public.actions where id = p_record_id and project_id = p_project_id;
  elsif p_record_type = 'hse' then
    select true, event_number, building_id into v_found, v_code, v_building from public.hse_events where id = p_record_id and project_id = p_project_id;
  elsif p_record_type = 'inspection' then
    select true, inspection_number, building_id into v_found, v_code, v_building from public.inspections where id = p_record_id and project_id = p_project_id;
  elsif p_record_type = 'register_entry' then
    select true, entry_number, building_id into v_found, v_code, v_building from public.project_register_entries where id = p_record_id and project_id = p_project_id;
  elsif p_record_type = 'document' then
    select true, coalesce(document.document_number, document.title), revision.file_id
      into v_found, v_code, v_document_file
    from public.project_documents document
    left join public.project_document_revisions revision on revision.id = document.current_revision_id
    where document.id = p_record_id and document.project_id = p_project_id;
    v_files := array(select distinct unnest(array[v_document_file] || coalesce(p_file_ids, '{}')));
  elsif p_record_type in ('publication','file') then
    select true, document_code, building_id into v_found, v_code, v_building from public.files where id = p_record_id and project_id = p_project_id and status = 'available';
    v_files := array(select distinct unnest(array[p_record_id] || coalesce(p_file_ids, '{}')));
  else
    raise exception 'Unknown record type' using errcode = '22023';
  end if;
  if not coalesce(v_found, false) then raise exception 'The record is not part of this project' using errcode = 'P0002'; end if;
  v_files := array(select file_id from unnest(v_files) file_id where file_id is not null);
  if exists (select 1 from unnest(v_files) file_id
      where not exists (select 1 from public.files file where file.id = file_id and file.project_id = p_project_id and file.status = 'available')) then
    raise exception 'A file is not an available file of this project' using errcode = '22023';
  end if;

  if p_record_type = 'publication' then
    if p_audience <> 'client' then raise exception 'Reports are published to the client portal' using errcode = '22023'; end if;
    v_key := coalesce(p_publication_type, 'other') || ':' || coalesce(p_period_start::text, '') || ':' || coalesce(p_period_end::text, '') || ':' || lower(trim(p_title));
    -- A reissued report keeps the earlier issue, marked superseded (21.2).
    for v_previous in
      select * from public.portal_shares where project_id = p_project_id and party_id = p_party_id and record_type = 'publication'
        and publication_key = v_key and status = 'published' for update
    loop
      v_version := greatest(v_version, v_previous.publication_version + 1);
      update public.portal_shares set status = 'superseded', updated_at = now() where id = v_previous.id;
      insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side, previous_status, resulting_status)
      values (v_previous.organization_id, p_project_id, v_previous.id, v_previous.round, 'supersede', v_actor,
        (select display_name from public.profiles where id = v_actor), 'codeco', 'published', 'superseded');
    end loop;
    v_status := 'published';
  else
    if exists (select 1 from public.portal_shares where project_id = p_project_id and party_id = p_party_id and audience = p_audience
        and record_type = p_record_type and record_id = p_record_id and status not in ('closed','withdrawn','superseded')) then
      raise exception 'This record is already open for this organisation in the portal' using errcode = '23505';
    end if;
    v_status := 'assigned';
  end if;

  insert into public.portal_shares (organization_id, project_id, audience, party_id, record_type, record_id, record_code, building_id,
    title, visible_summary, requested_action, priority, due_at, contact_user_id, publication_type, period_start, period_end,
    publication_key, publication_version, status, assigned_by)
  values (v_project.organization_id, p_project_id, p_audience, p_party_id, p_record_type, p_record_id, v_code, v_building,
    trim(p_title), nullif(trim(p_summary), ''), coalesce(p_requested_action, 'information'), coalesce(nullif(p_priority, ''), 'normal'),
    p_due_at, p_contact_user_id, p_publication_type, p_period_start, p_period_end, v_key, v_version, v_status, v_actor)
  returning * into v_share;

  insert into public.portal_share_files (share_id, organization_id, project_id, file_id, source, added_by)
  select v_share.id, v_share.organization_id, p_project_id, file_id, 'shared', v_actor from unnest(v_files) file_id
  on conflict do nothing;

  insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side,
    comment, payload, file_ids, previous_status, resulting_status)
  values (v_share.organization_id, p_project_id, v_share.id, 1, case when v_status = 'published' then 'publish' else 'assign' end, v_actor,
    (select display_name from public.profiles where id = v_actor), 'codeco', nullif(trim(p_summary), ''),
    jsonb_build_object('requested_action', v_share.requested_action, 'due_at', v_share.due_at, 'priority', v_share.priority,
      'publication_version', v_share.publication_version),
    v_files, null, v_status);

  perform app_private.notify_portal_party(v_share,
    case when p_audience = 'client' then 'Client portal: new item' else 'Contractor portal: new item' end
      || coalesce(' ' || v_code, ''),
    'Sign in to the portal to open it.',
    case when v_share.requested_action in ('approve','review','sign') then 'review_requested' else 'system' end);
  return v_share.id;
end;
$$;

-- The portal user's own step (6.2, 21.3). Never closes, verifies or edits the source record.
create or replace function public.respond_in_portal(
  p_share_id uuid,
  p_action text,
  p_comment text,
  p_payload jsonb,
  p_file_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_share public.portal_shares;
  v_next text;
  v_round integer;
  v_action text := p_action;
  v_files uuid[] := array(select distinct file_id from unnest(coalesce(p_file_ids, '{}')) file_id where file_id is not null);
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_action_row public.actions;
  v_previous text;
begin
  select * into v_share from public.portal_shares where id = p_share_id for update;
  if v_share.id is null or not app_private.portal_audience_allowed(v_share.project_id, v_share.audience, v_share.party_id) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if v_share.status in ('closed','withdrawn','superseded') then
    raise exception 'This item is closed' using errcode = '55000';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then raise exception 'Invalid response' using errcode = '22023'; end if;
  v_round := v_share.round;
  v_next := v_share.status;
  v_previous := v_share.status;

  if v_share.audience = 'contractor' then
    if not app_private.has_project_permission(v_share.project_id, 'portal.contractor.respond') then
      raise exception 'Your portal role is read-only' using errcode = '42501';
    end if;
    if v_action not in ('acknowledge','comment','respond','submit_evidence','mark_complete') then
      raise exception 'This step is not available in the contractor portal' using errcode = '22023';
    end if;
    if v_action <> 'acknowledge' and v_comment is null and v_payload = '{}'::jsonb and cardinality(v_files) = 0 then
      raise exception 'Add a response, details or a file' using errcode = '22023';
    end if;
    if v_share.status in ('accepted','verified') and v_action not in ('comment') then
      raise exception 'CODECO has accepted this item' using errcode = '55000';
    end if;
    -- A returned item is answered by a new round; the earlier round stays in the log (7.1 step 6).
    if v_share.status = 'returned' and v_action in ('respond','submit_evidence','mark_complete') then
      v_round := v_share.round + 1;
      if v_action = 'respond' then v_action := 'resubmit'; end if;
    end if;
    v_next := case v_action
      when 'acknowledge' then case when v_share.status = 'assigned' then 'acknowledged' else v_share.status end
      when 'comment' then v_share.status
      when 'mark_complete' then 'submitted_for_verification'
      else 'responded'
    end;
  else
    if v_action not in ('acknowledge','comment','request_clarification','approve','reject') then
      raise exception 'This step is not available in the client portal' using errcode = '22023';
    end if;
    if not app_private.has_project_permission(v_share.project_id, 'portal.client.review') then
      raise exception 'Your portal role can view only' using errcode = '42501';
    end if;
    if v_action in ('approve','reject') then
      if not app_private.has_project_permission(v_share.project_id, 'portal.client.approve') then
        raise exception 'Approval needs the client approver role' using errcode = '42501';
      end if;
      if v_share.requested_action <> 'approve' then
        raise exception 'This item was not routed for approval' using errcode = '22023';
      end if;
    end if;
    if v_share.status in ('approved','rejected') and v_action <> 'comment' then
      raise exception 'A decision is already recorded' using errcode = '55000';
    end if;
    if v_action in ('reject','request_clarification','comment') and v_comment is null then
      raise exception 'A comment is required' using errcode = '22023';
    end if;
    v_next := case v_action
      when 'acknowledge' then case when v_share.status in ('assigned','published') then 'acknowledged' else v_share.status end
      when 'comment' then v_share.status
      when 'request_clarification' then 'clarification_requested'
      when 'approve' then 'approved'
      else 'rejected'
    end;
    -- A publication stays published; the acknowledgement is an event, not a new state.
    if v_share.record_type = 'publication' then v_next := v_share.status; end if;
  end if;

  if exists (select 1 from unnest(v_files) file_id
      where not exists (select 1 from public.files file where file.id = file_id and file.project_id = v_share.project_id
        and file.created_by = v_actor and file.status = 'available')) then
    raise exception 'Only your own uploaded files can be attached' using errcode = '22023';
  end if;
  insert into public.portal_share_files (share_id, organization_id, project_id, file_id, source, added_by)
  select v_share.id, v_share.organization_id, v_share.project_id, file_id, 'response', v_actor from unnest(v_files) file_id
  on conflict do nothing;

  update public.portal_shares set status = v_next, round = v_round, updated_at = now() where id = v_share.id returning * into v_share;
  insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side,
    actor_party_id, actor_roles, comment, payload, file_ids, previous_status, resulting_status)
  values (v_share.organization_id, v_share.project_id, v_share.id, v_round, v_action, v_actor,
    (select display_name from public.profiles where id = v_actor), v_share.audience, v_share.party_id,
    app_private.portal_actor_roles(v_share.project_id, v_actor), v_comment, v_payload, v_files,
    v_previous, v_next);

  -- A contractor marking an action complete sends it to verification, never to closed (9).
  if v_share.record_type = 'action' and v_action = 'mark_complete' then
    select * into v_action_row from public.actions where id = v_share.record_id for update;
    if v_action_row.status in ('open','accepted') then
      update public.actions set status = 'in_progress' where id = v_action_row.id;
      v_action_row.status := 'in_progress';
    end if;
    if v_action_row.status = 'in_progress' then
      update public.actions set status = 'ready_for_verification' where id = v_action_row.id;
    end if;
  end if;

  perform app_private.notify_user(v_share, v_share.assigned_by,
    'Portal ' || replace(v_action, '_', ' ') || ': ' || coalesce(v_share.record_code, left(v_share.title, 60)),
    (select name from public.parties where id = v_share.party_id) || ' answered in the ' || v_share.audience || ' portal.');
  return v_next;
end;
$$;

-- CODECO's review step (7.1 steps 5, 7, 8; 21.3 step 5).
create or replace function public.review_portal_share(p_share_id uuid, p_action text, p_comment text, p_file_ids uuid[])
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_share public.portal_shares;
  v_previous text;
  v_next text;
  v_round integer;
  v_files uuid[] := array(select distinct file_id from unnest(coalesce(p_file_ids, '{}')) file_id where file_id is not null);
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  select * into v_share from public.portal_shares where id = p_share_id for update;
  if v_share.id is null or not app_private.has_project_permission(v_share.project_id, 'portal.share') then
    raise exception 'Only an authorised CODECO role reviews portal items' using errcode = '42501';
  end if;
  if p_action not in ('accept','return','verify','close','withdraw','reopen','comment','add_files') then
    raise exception 'Unknown review step' using errcode = '22023';
  end if;
  v_previous := v_share.status;
  v_round := v_share.round;
  if v_share.status in ('withdrawn','superseded') and p_action <> 'reopen' then
    raise exception 'This item is withdrawn' using errcode = '55000';
  end if;
  if v_share.status = 'closed' and p_action not in ('reopen','comment') then
    raise exception 'This item is closed' using errcode = '55000';
  end if;
  if p_action in ('return','withdraw','reopen') and v_comment is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if v_share.audience = 'client' and p_action in ('accept','return','verify') then
    raise exception 'A client decision is not reviewed like a contractor response' using errcode = '22023';
  end if;
  if p_action = 'close' and v_share.audience = 'contractor'
      and v_share.requested_action in ('propose','submit_evidence','implement')
      and v_share.status not in ('accepted','verified') then
    -- Close only when the configured acceptance/verification requirement is met (7.1 step 8).
    raise exception 'Accept or verify the response before closing' using errcode = '55000';
  end if;
  if p_action = 'verify' and v_share.status not in ('responded','submitted_for_verification','accepted') then
    raise exception 'There is no submitted work to verify' using errcode = '55000';
  end if;
  if p_action = 'accept' and v_share.status not in ('responded','submitted_for_verification','acknowledged') then
    raise exception 'There is no response to accept' using errcode = '55000';
  end if;
  if p_action = 'return' and v_share.status not in ('responded','submitted_for_verification','acknowledged') then
    raise exception 'There is no response to return' using errcode = '55000';
  end if;
  if exists (select 1 from unnest(v_files) file_id
      where not exists (select 1 from public.files file where file.id = file_id and file.project_id = v_share.project_id and file.status = 'available')) then
    raise exception 'A file is not an available file of this project' using errcode = '22023';
  end if;

  v_next := case p_action
    when 'accept' then 'accepted'
    when 'return' then 'returned'
    when 'verify' then 'verified'
    when 'close' then 'closed'
    when 'withdraw' then 'withdrawn'
    when 'reopen' then case when v_share.record_type = 'publication' then 'published' else 'assigned' end
    else v_share.status
  end;
  if p_action = 'reopen' then v_round := v_share.round + 1; end if;

  insert into public.portal_share_files (share_id, organization_id, project_id, file_id, source, added_by)
  select v_share.id, v_share.organization_id, v_share.project_id, file_id, 'shared', v_actor from unnest(v_files) file_id
  on conflict do nothing;
  update public.portal_shares set status = v_next, round = v_round, updated_at = now(),
    closed_at = case when v_next = 'closed' then now() when p_action = 'reopen' then null else closed_at end
  where id = v_share.id returning * into v_share;
  insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side,
    actor_roles, comment, file_ids, previous_status, resulting_status)
  values (v_share.organization_id, v_share.project_id, v_share.id, v_round, p_action, v_actor,
    (select display_name from public.profiles where id = v_actor), 'codeco', app_private.portal_actor_roles(v_share.project_id, v_actor),
    v_comment, v_files, v_previous, v_next);

  if p_action <> 'withdraw' then
    perform app_private.notify_portal_party(v_share,
      'Portal update' || coalesce(': ' || v_share.record_code, ''),
      'Sign in to the portal to see the update.',
      case when p_action = 'return' then 'review_requested' else 'system' end);
  end if;
  return v_next;
end;
$$;

-- Client views and downloads are logged (21.5); a view is logged once per person per day.
create or replace function public.record_portal_access(p_share_id uuid, p_kind text, p_file_id uuid default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_share public.portal_shares;
begin
  select * into v_share from public.portal_shares where id = p_share_id;
  if v_share.id is null or not app_private.portal_audience_allowed(v_share.project_id, v_share.audience, v_share.party_id) then
    return;
  end if;
  if p_kind not in ('view','download') then raise exception 'Unknown access' using errcode = '22023'; end if;
  if p_kind = 'view' and exists (select 1 from public.portal_events where share_id = p_share_id and action = 'view'
      and actor_user_id = v_actor and created_at > now() - interval '1 day') then
    return;
  end if;
  insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side,
    actor_party_id, file_ids, previous_status, resulting_status)
  values (v_share.organization_id, v_share.project_id, v_share.id, v_share.round, p_kind, v_actor,
    (select display_name from public.profiles where id = v_actor), v_share.audience, v_share.party_id,
    case when p_file_id is null then '{}' else array[p_file_id] end, v_share.status, v_share.status);
end;
$$;

-- The portal user's own organisation, for the portal header.
create or replace function public.my_portal_context(p_project_id uuid)
returns table (party_id uuid, party_name text, party_type text, audience text, can_respond boolean, can_review boolean, can_approve boolean)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select party.id, party.name, party.party_type,
    case when app_private.has_project_permission(p_project_id, 'portal.client') then 'client'
         when app_private.has_project_permission(p_project_id, 'portal.contractor') then 'contractor' end,
    app_private.has_project_permission(p_project_id, 'portal.contractor.respond'),
    app_private.has_project_permission(p_project_id, 'portal.client.review'),
    app_private.has_project_permission(p_project_id, 'portal.client.approve')
  from public.parties party
  where party.id = app_private.portal_party(p_project_id);
$$;

revoke all on function public.set_project_member_portal_party(uuid, uuid, uuid) from public, anon;
revoke all on function public.register_project_document(uuid, text, text, text, text, text, uuid, text, uuid[], text, text, text, date, text, text, uuid) from public, anon;
revoke all on function public.add_project_document_revision(uuid, text, uuid, text, date, text, text) from public, anon;
revoke all on function public.set_project_document_revision_status(uuid, text, text) from public, anon;
revoke all on function public.update_project_document(uuid, text, text, text, text, text, uuid, text, uuid[], text) from public, anon;
revoke all on function public.link_project_document(uuid, text, uuid, text, boolean) from public, anon;
revoke all on function public.share_to_portal(uuid, text, uuid, text, uuid, text, text, text, text, timestamptz, uuid[], uuid, text, date, date) from public, anon;
revoke all on function public.respond_in_portal(uuid, text, text, jsonb, uuid[]) from public, anon;
revoke all on function public.review_portal_share(uuid, text, text, uuid[]) from public, anon;
revoke all on function public.record_portal_access(uuid, text, uuid) from public, anon;
revoke all on function public.my_portal_context(uuid) from public, anon;
grant execute on function public.set_project_member_portal_party(uuid, uuid, uuid) to authenticated;
grant execute on function public.register_project_document(uuid, text, text, text, text, text, uuid, text, uuid[], text, text, text, date, text, text, uuid) to authenticated;
grant execute on function public.add_project_document_revision(uuid, text, uuid, text, date, text, text) to authenticated;
grant execute on function public.set_project_document_revision_status(uuid, text, text) to authenticated;
grant execute on function public.update_project_document(uuid, text, text, text, text, text, uuid, text, uuid[], text) to authenticated;
grant execute on function public.link_project_document(uuid, text, uuid, text, boolean) to authenticated;
grant execute on function public.share_to_portal(uuid, text, uuid, text, uuid, text, text, text, text, timestamptz, uuid[], uuid, text, date, date) to authenticated;
grant execute on function public.respond_in_portal(uuid, text, text, jsonb, uuid[]) to authenticated;
grant execute on function public.review_portal_share(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.record_portal_access(uuid, text, uuid) to authenticated;
grant execute on function public.my_portal_context(uuid) to authenticated;

-- The service role (cron, backups) reads the new tables like the others (202610060005).
grant select on public.project_documents, public.project_document_revisions, public.project_document_events,
  public.project_document_links, public.portal_shares, public.portal_share_files, public.portal_events to service_role;

commit;
