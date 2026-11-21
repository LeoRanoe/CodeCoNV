-- Word §4.3: "An uploaded drawing is not automatically approved for construction. Formal status and
-- transmittal determine permitted use." "Only authorized roles may change review status or designate
-- a revision as current/approved." "Show the current/active revision prominently."
--
-- Until now an upload made the new revision current and marked every earlier revision superseded,
-- even while the new one was only submitted. A rejected successor then left the approved revision
-- superseded and unchangeable. From this migration:
--   * project_documents.latest_revision_id is the newest uploaded revision;
--   * project_documents.current_revision_id is the newest approved revision (Approved, Approved with
--     comments, Issued for construction), or the newest live revision while none is approved;
--   * earlier revisions become superseded when a reviewer approves a later one, not on upload.
-- Decision list #4 (first part) is resolved by these sentences.

-- Upload order. uploaded_at is the transaction time and does not order two uploads made together.
create sequence if not exists public.project_document_revision_upload_seq;
alter table public.project_document_revisions add column if not exists upload_seq bigint;
update public.project_document_revisions revision set upload_seq = ordered.n
from (select id, row_number() over (order by uploaded_at, id) as n from public.project_document_revisions) ordered
where ordered.id = revision.id and revision.upload_seq is null;
select setval('public.project_document_revision_upload_seq', greatest(1, coalesce((select max(upload_seq) from public.project_document_revisions), 0)));
alter table public.project_document_revisions alter column upload_seq set default nextval('public.project_document_revision_upload_seq');
alter table public.project_document_revisions alter column upload_seq set not null;
grant usage on sequence public.project_document_revision_upload_seq to authenticated;

alter table public.project_documents add column if not exists latest_revision_id uuid;
alter table public.project_documents drop constraint if exists project_documents_latest_revision_fk;
alter table public.project_documents add constraint project_documents_latest_revision_fk
  foreign key (latest_revision_id, project_id, organization_id)
  references public.project_document_revisions(id, project_id, organization_id) deferrable initially deferred;

alter table public.project_document_events drop constraint if exists project_document_events_action_check;
alter table public.project_document_events add constraint project_document_events_action_check check (action in ('register','revision',
  'status','supersede','update','link','unlink','share','release','withdraw_release','reinstate'));

-- Recomputes both pointers of one document from its revisions.
create or replace function app_private.refresh_document_revision_pointers(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_latest uuid;
  v_current uuid;
begin
  select id into v_latest from public.project_document_revisions
  where document_id = p_document_id order by upload_seq desc limit 1;
  select id into v_current from public.project_document_revisions
  where document_id = p_document_id and superseded_at is null and app_private.document_revision_releasable(review_status)
  order by upload_seq desc limit 1;
  if v_current is null then
    select id into v_current from public.project_document_revisions
    where document_id = p_document_id and superseded_at is null and review_status not in ('withdrawn')
    order by upload_seq desc limit 1;
  end if;
  update public.project_documents
    set latest_revision_id = v_latest, current_revision_id = coalesce(v_current, v_latest)
    where id = p_document_id
      and (latest_revision_id is distinct from v_latest or current_revision_id is distinct from coalesce(v_current, v_latest));
end;
$$;
revoke all on function app_private.refresh_document_revision_pointers(uuid) from public, anon, authenticated;

-- Supersedes the live revisions uploaded before an approved one.
create or replace function app_private.supersede_earlier_revisions(p_revision public.project_document_revisions, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_previous public.project_document_revisions;
begin
  for v_previous in
    select * from public.project_document_revisions
    where document_id = p_revision.document_id and id <> p_revision.id and superseded_at is null
      and review_status <> 'withdrawn' and upload_seq < p_revision.upload_seq
    for update
  loop
    update public.project_document_revisions
      set review_status = 'superseded', superseded_by = p_revision.id, superseded_at = now()
      where id = v_previous.id;
    insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, from_status, to_status, details, actor_user_id)
    values (v_previous.organization_id, v_previous.project_id, v_previous.document_id, v_previous.id, 'supersede', v_previous.review_status, 'superseded',
      jsonb_build_object('revision', v_previous.revision, 'superseded_by', p_revision.revision), p_actor);
  end loop;
end;
$$;
revoke all on function app_private.supersede_earlier_revisions(public.project_document_revisions, uuid) from public, anon, authenticated;

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

  insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, to_status, details, actor_user_id)
  values (v_document.organization_id, v_document.project_id, p_document_id, v_revision.id, 'revision', v_status,
    jsonb_build_object('revision', v_revision.revision, 'transmittal', v_revision.transmittal_ref, 'file_id', p_file_id), v_actor);

  -- Never overwrite. Earlier revisions stay as they are until a reviewer approves a later one; an
  -- authorised reviewer who uploads directly as approved supersedes them now.
  if app_private.document_revision_releasable(v_status) then
    perform app_private.supersede_earlier_revisions(v_revision, v_actor);
  end if;
  perform app_private.refresh_document_revision_pointers(p_document_id);
  update public.project_documents set updated_at = now() where id = p_document_id;

  -- F15: a new revision is never distributed automatically.
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
  v_from text;
begin
  select * into v_revision from public.project_document_revisions where id = p_revision_id for update;
  v_from := v_revision.review_status;
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
    where id = p_revision_id
    returning * into v_revision;
  select * into v_document from public.project_documents where id = v_revision.document_id;
  insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, from_status, to_status, comment, details, actor_user_id)
  values (v_revision.organization_id, v_revision.project_id, v_revision.document_id, v_revision.id, 'status',
    v_from, p_status,
    nullif(trim(p_comment), ''), jsonb_build_object('revision', v_revision.revision), v_actor);
  if app_private.document_revision_releasable(p_status) then
    perform app_private.supersede_earlier_revisions(v_revision, v_actor);
  end if;
  perform app_private.refresh_document_revision_pointers(v_revision.document_id);
  update public.project_documents set updated_at = now() where id = v_document.id;
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

-- Existing data: a revision superseded by an upload that was never approved gets its earlier status
-- back (from its own supersede event), with a "reinstate" event; nothing is deleted.
do $$
declare
  v_row record;
begin
  for v_row in
    select revision.*, successor.review_status as successor_status,
      (select event.from_status from public.project_document_events event
        where event.revision_id = revision.id and event.action = 'supersede' order by event.sequence desc limit 1) as earlier_status
    from public.project_document_revisions revision
    join public.project_document_revisions successor on successor.id = revision.superseded_by
    where revision.superseded_at is not null and revision.review_status = 'superseded'
      and not app_private.document_revision_releasable(successor.review_status)
      and successor.review_status <> 'superseded'
  loop
    if v_row.earlier_status is null or v_row.earlier_status = 'superseded' then
      continue;
    end if;
    update public.project_document_revisions
      set review_status = v_row.earlier_status, superseded_by = null, superseded_at = null
      where id = v_row.id;
    insert into public.project_document_events (organization_id, project_id, document_id, revision_id, action, from_status, to_status, details, actor_user_id)
    values (v_row.organization_id, v_row.project_id, v_row.document_id, v_row.id, 'reinstate', 'superseded', v_row.earlier_status,
      jsonb_build_object('revision', v_row.revision, 'reason', 'later revision not approved (Word 4.3)'), v_row.uploaded_by);
  end loop;
end;
$$;

select app_private.refresh_document_revision_pointers(id) from public.project_documents;

-- Register reads can show "rev C under review" next to the current approved revision.
grant select (latest_revision_id) on public.project_documents to authenticated;
