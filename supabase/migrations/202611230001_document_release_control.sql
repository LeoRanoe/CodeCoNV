-- F15 (client-spec audit): external release of document revisions.
--
-- Before this migration, adding a revision attached its file to every active document share and the
-- shared-document read policy let portal users read every revision row of the document, including
-- draft/submitted/rejected revisions, internal notes and review comments.
--
-- After it:
--   * uploading a revision never distributes it;
--   * an authorised user (portal.share) releases one approved revision to one share, deliberately,
--     with an audit event in both the portal and document histories;
--   * a release can be withdrawn with a reason; the file stops being readable for that party while the
--     release row and both event histories are kept (Word 19: revocation blocks future access and
--     preserves history);
--   * portal users read revisions only through portal_document_revisions(), which returns released
--     revisions with portal-safe columns (no notes, review comment or reviewer);
--   * any file attached to a document share outside a live release is not readable by the portal party.
--     Legacy auto-distributed files of revisions that were never approved therefore stop being readable
--     externally on deployment; they are listed by app_private.legacy_unreleased_document_files for
--     review by authorised staff. No rows are deleted.
--
-- Which statuses count as "approved for release" is one function, document_revision_releasable, so the
-- project decision on review statuses (Word section 20 item 3) changes one place.

alter table public.portal_events drop constraint if exists portal_events_action_check;
alter table public.portal_events add constraint portal_events_action_check check (action in ('assign','publish','acknowledge','comment',
  'respond','resubmit','submit_evidence','mark_complete','approve','reject','request_clarification','accept','return','verify','close',
  'withdraw','reopen','supersede','add_files','view','download','release','withdraw_release'));
alter table public.project_document_events drop constraint if exists project_document_events_action_check;
alter table public.project_document_events add constraint project_document_events_action_check check (action in ('register','revision',
  'status','supersede','update','link','unlink','share','release','withdraw_release'));

create or replace function app_private.document_revision_releasable(p_status text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_status in ('approved','approved_with_comments','for_construction');
$$;
grant execute on function app_private.document_revision_releasable(text) to authenticated;

create table if not exists public.portal_document_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  share_id uuid not null,
  document_id uuid not null,
  revision_id uuid not null,
  file_id uuid not null,
  released_by uuid not null references auth.users(id),
  released_at timestamptz not null default now(),
  withdrawn_by uuid references auth.users(id),
  withdrawn_at timestamptz,
  withdraw_reason text check (withdraw_reason is null or char_length(withdraw_reason) between 3 and 2000),
  check ((withdrawn_at is null) = (withdrawn_by is null)),
  check (withdrawn_at is null or withdraw_reason is not null),
  foreign key (share_id, project_id, organization_id) references public.portal_shares(id, project_id, organization_id),
  foreign key (document_id, project_id, organization_id) references public.project_documents(id, project_id, organization_id),
  foreign key (revision_id, project_id, organization_id) references public.project_document_revisions(id, project_id, organization_id),
  foreign key (file_id, project_id, organization_id) references public.files(id, project_id, organization_id)
);
create unique index if not exists portal_document_releases_live_key
  on public.portal_document_releases (share_id, revision_id) where withdrawn_at is null;
create index if not exists portal_document_releases_share_idx on public.portal_document_releases (share_id, file_id) where withdrawn_at is null;

alter table public.portal_document_releases enable row level security;
revoke all on public.portal_document_releases from anon, authenticated;
grant select on public.portal_document_releases to authenticated;
drop policy if exists portal_document_releases_select on public.portal_document_releases;
create policy portal_document_releases_select on public.portal_document_releases for select to authenticated using (
  app_private.portal_internal(project_id)
  or (withdrawn_at is null and exists (select 1 from public.portal_shares share where share.id = share_id))
);

-- Release rows only change through the functions below; the withdrawal is the one permitted update.
create or replace function app_private.guard_document_release_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Document releases are kept for the audit trail' using errcode = '55000';
  end if;
  if old.withdrawn_at is not null
      or (to_jsonb(new) - array['withdrawn_by','withdrawn_at','withdraw_reason']) <> (to_jsonb(old) - array['withdrawn_by','withdrawn_at','withdraw_reason']) then
    raise exception 'A document release is only withdrawn, never edited' using errcode = '55000';
  end if;
  return new;
end;
$$;
drop trigger if exists portal_document_releases_guard on public.portal_document_releases;
create trigger portal_document_releases_guard before update or delete on public.portal_document_releases
  for each row execute function app_private.guard_document_release_update();

-- Whether a file on a document share is a live release (the portal party's only route to a document file).
create or replace function app_private.document_share_file_released(p_share_id uuid, p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.portal_document_releases release
    where release.share_id = p_share_id and release.file_id = p_file_id and release.withdrawn_at is null);
$$;
grant execute on function app_private.document_share_file_released(uuid, uuid) to authenticated;

-- Defence in depth: no code path attaches a document file to a document share without a live release.
create or replace function app_private.guard_document_share_file()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.source = 'shared'
      and exists (select 1 from public.portal_shares share where share.id = new.share_id and share.record_type = 'document')
      and not app_private.document_share_file_released(new.share_id, new.file_id) then
    raise exception 'Only a released approved revision is shared with a portal' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists portal_share_files_document_release on public.portal_share_files;
create trigger portal_share_files_document_release before insert on public.portal_share_files
  for each row execute function app_private.guard_document_share_file();

-- Legacy: files already attached to document shares. Approved revisions become explicit releases
-- (keeping today's access); anything else stays attached but unreadable and is listed for review.
insert into public.portal_document_releases (organization_id, project_id, share_id, document_id, revision_id, file_id, released_by, released_at)
select shared.organization_id, shared.project_id, shared.share_id, share.record_id, revision.id, shared.file_id, shared.added_by, shared.added_at
from public.portal_share_files shared
join public.portal_shares share on share.id = shared.share_id and share.record_type = 'document'
join public.project_document_revisions revision on revision.document_id = share.record_id and revision.file_id = shared.file_id
where shared.source = 'shared'
  and app_private.document_revision_releasable(revision.review_status)
  and revision.superseded_at is null
  and not exists (select 1 from public.portal_document_releases release
    where release.share_id = shared.share_id and release.revision_id = revision.id and release.withdrawn_at is null);

create or replace view app_private.legacy_unreleased_document_files as
select shared.share_id, share.project_id, share.audience, share.party_id, share.record_code, shared.file_id,
  revision.revision, revision.review_status, shared.added_at
from public.portal_share_files shared
join public.portal_shares share on share.id = shared.share_id and share.record_type = 'document'
left join public.project_document_revisions revision on revision.document_id = share.record_id and revision.file_id = shared.file_id
where shared.source = 'shared'
  and not exists (select 1 from public.portal_document_releases release
    where release.share_id = shared.share_id and release.file_id = shared.file_id and release.withdrawn_at is null);
revoke all on app_private.legacy_unreleased_document_files from public, anon, authenticated;

-- Read policies: the portal party sees a document share file only while it is released; revision rows
-- are internal (documents.read) and reach the portal through portal_document_revisions().
drop policy if exists portal_share_files_select on public.portal_share_files;
create policy portal_share_files_select on public.portal_share_files for select to authenticated using (
  exists (select 1 from public.portal_shares share where share.id = share_id
    and (share.record_type <> 'document'
      or source = 'response'
      or app_private.portal_internal(share.project_id)
      or app_private.document_share_file_released(share_id, file_id)))
);
drop policy if exists project_document_revisions_select on public.project_document_revisions;
create policy project_document_revisions_select on public.project_document_revisions for select to authenticated using (
  app_private.has_project_permission(project_id, 'documents.read')
);

create or replace function public.portal_document_revisions(p_project_id uuid)
returns table (
  id uuid, document_id uuid, revision text, review_status text, issue_date date, uploaded_at timestamptz,
  file_id uuid, superseded_at timestamptz, share_id uuid, released_at timestamptz, release_id uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select revision.id, revision.document_id, revision.revision, revision.review_status, revision.issue_date, revision.uploaded_at,
    revision.file_id, revision.superseded_at, release.share_id, release.released_at, release.id
  from public.portal_document_releases release
  join public.portal_shares share on share.id = release.share_id
  join public.project_document_revisions revision on revision.id = release.revision_id
  where release.project_id = p_project_id
    and release.withdrawn_at is null
    and share.status <> 'withdrawn'
    and (app_private.portal_internal(share.project_id)
      or app_private.portal_audience_allowed(share.project_id, share.audience, share.party_id))
  order by revision.uploaded_at desc;
$$;
revoke all on function public.portal_document_revisions(uuid) from public, anon;
grant execute on function public.portal_document_revisions(uuid) to authenticated;

-- Deliberate release of one approved revision to one share (F15).
create or replace function public.release_document_revision(p_share_id uuid, p_revision_id uuid, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_share public.portal_shares;
  v_revision public.project_document_revisions;
  v_release public.portal_document_releases;
begin
  select * into v_share from public.portal_shares where id = p_share_id for update;
  if v_share.id is null or not app_private.has_project_permission(v_share.project_id, 'portal.share') then
    raise exception 'Only an authorised CODECO role releases documents to a portal' using errcode = '42501';
  end if;
  if v_share.record_type <> 'document' then
    raise exception 'Only a document share receives document revisions' using errcode = '22023';
  end if;
  if v_share.status in ('withdrawn','closed','superseded') then
    raise exception 'This portal item is no longer open' using errcode = '55000';
  end if;
  select * into v_revision from public.project_document_revisions where id = p_revision_id and document_id = v_share.record_id;
  if v_revision.id is null then
    raise exception 'The revision is not a revision of the shared document' using errcode = '22023';
  end if;
  if v_revision.superseded_at is not null or not app_private.document_revision_releasable(v_revision.review_status) then
    raise exception 'Only a current approved revision is released' using errcode = '55000';
  end if;
  if exists (select 1 from public.portal_document_releases where share_id = p_share_id and revision_id = p_revision_id and withdrawn_at is null) then
    raise exception 'This revision is already released to this organisation' using errcode = '23505';
  end if;

  insert into public.portal_document_releases (organization_id, project_id, share_id, document_id, revision_id, file_id, released_by)
  values (v_share.organization_id, v_share.project_id, v_share.id, v_share.record_id, v_revision.id, v_revision.file_id, v_actor)
  returning * into v_release;
  insert into public.portal_share_files (share_id, organization_id, project_id, file_id, source, added_by)
  values (v_share.id, v_share.organization_id, v_share.project_id, v_revision.file_id, 'shared', v_actor)
  on conflict do nothing;
  insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side,
    actor_roles, comment, payload, file_ids, previous_status, resulting_status)
  values (v_share.organization_id, v_share.project_id, v_share.id, v_share.round, 'release', v_actor,
    (select display_name from public.profiles where id = v_actor), 'codeco', app_private.portal_actor_roles(v_share.project_id, v_actor),
    coalesce(nullif(trim(p_comment), ''), 'Revision ' || v_revision.revision),
    jsonb_build_object('revision_id', v_revision.id, 'revision', v_revision.revision, 'review_status', v_revision.review_status),
    array[v_revision.file_id], v_share.status, v_share.status);
  insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, comment, details, actor_user_id)
  values (v_share.organization_id, v_share.project_id, v_share.record_id, v_revision.id, 'release', nullif(trim(p_comment), ''),
    jsonb_build_object('share_id', v_share.id, 'audience', v_share.audience, 'party_id', v_share.party_id, 'release_id', v_release.id), v_actor);
  update public.portal_shares set updated_at = now() where id = v_share.id;
  perform app_private.notify_portal_party(v_share, 'Document released: ' || coalesce(v_share.record_code, 'shared document'),
    'Revision ' || v_revision.revision || ' is available in the portal.', 'system');
  return v_release.id;
end;
$$;

-- Withdrawal stops future reads of the file for that party; the release and both histories remain.
create or replace function public.withdraw_document_release(p_release_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_release public.portal_document_releases;
  v_share public.portal_shares;
  v_revision text;
begin
  select * into v_release from public.portal_document_releases where id = p_release_id for update;
  if v_release.id is null or not app_private.has_project_permission(v_release.project_id, 'portal.share') then
    raise exception 'Only an authorised CODECO role withdraws a document release' using errcode = '42501';
  end if;
  if v_release.withdrawn_at is not null then
    raise exception 'This release is already withdrawn' using errcode = '55000';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  update public.portal_document_releases set withdrawn_by = v_actor, withdrawn_at = now(), withdraw_reason = trim(p_reason)
    where id = p_release_id;
  select * into v_share from public.portal_shares where id = v_release.share_id;
  select revision into v_revision from public.project_document_revisions where id = v_release.revision_id;
  insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side,
    actor_roles, comment, payload, file_ids, previous_status, resulting_status)
  values (v_share.organization_id, v_share.project_id, v_share.id, v_share.round, 'withdraw_release', v_actor,
    (select display_name from public.profiles where id = v_actor), 'codeco', app_private.portal_actor_roles(v_share.project_id, v_actor),
    trim(p_reason), jsonb_build_object('revision_id', v_release.revision_id, 'revision', v_revision, 'release_id', v_release.id),
    array[v_release.file_id], v_share.status, v_share.status);
  insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, comment, details, actor_user_id)
  values (v_share.organization_id, v_share.project_id, v_release.document_id, v_release.revision_id, 'withdraw_release', trim(p_reason),
    jsonb_build_object('share_id', v_share.id, 'release_id', v_release.id), v_actor);
  update public.portal_shares set updated_at = now() where id = v_share.id;
end;
$$;

revoke all on function public.release_document_revision(uuid, uuid, text) from public, anon;
revoke all on function public.withdraw_document_release(uuid, text) from public, anon;
grant execute on function public.release_document_revision(uuid, uuid, text) to authenticated;
grant execute on function public.withdraw_document_release(uuid, text) to authenticated;

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

  -- F15: a new revision is never distributed automatically. Shared parties keep the revision that
  -- was deliberately released to them until an authorised user releases an approved successor.

  if v_status in ('submitted','under_review') then
    perform app_private.notify_document_reviewers(v_document, v_revision,
      'Document review: ' || coalesce(v_document.document_number, left(v_document.title, 60)),
      'Revision ' || v_revision.revision || ' is waiting for review.');
  end if;
  return v_revision.id;
end;
$$;


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
  v_release_revision uuid;
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
    -- F15: only an approved revision is released, and only that revision's file; never a draft or
    -- a revision under review. Extra files are released per revision with release_document_revision.
    if exists (select 1 from unnest(coalesce(p_file_ids, '{}')) extra_file where extra_file is not null) then
      raise exception 'Share a document by releasing an approved revision; other files are not attached to a document share' using errcode = '22023';
    end if;
    select true, coalesce(document.document_number, document.title)
      into v_found, v_code
    from public.project_documents document
    where document.id = p_record_id and document.project_id = p_project_id;
    select revision.id, revision.file_id into v_release_revision, v_document_file
    from public.project_document_revisions revision
    where revision.document_id = p_record_id and revision.superseded_at is null
      and app_private.document_revision_releasable(revision.review_status)
    order by revision.uploaded_at desc
    limit 1;
    if coalesce(v_found, false) and v_release_revision is null then
      raise exception 'This document has no approved revision to release' using errcode = '55000';
    end if;
    v_files := array[v_document_file];
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

  if v_release_revision is not null then
    insert into public.portal_document_releases (organization_id, project_id, share_id, document_id, revision_id, file_id, released_by)
    values (v_share.organization_id, p_project_id, v_share.id, p_record_id, v_release_revision, v_document_file, v_actor);
    insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, details, actor_user_id)
    values (v_share.organization_id, p_project_id, p_record_id, v_release_revision, 'release',
      jsonb_build_object('share_id', v_share.id, 'audience', p_audience, 'party_id', p_party_id), v_actor);
  end if;
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

