begin;

-- The customer video makes the external trade link an active, account-free
-- workflow. The link remains narrow, expiring and revocable; an external
-- completion means "ready for CODECO verification", never final approval.
alter table public.external_share_links
  add column if not exists source_file_id uuid;

alter table public.external_share_links
  add constraint external_share_links_source_file_project_fk
  foreign key (source_file_id, project_id, organization_id)
  references public.files(id, project_id, organization_id);

create index if not exists external_share_links_source_file_idx
  on public.external_share_links (source_file_id)
  where source_file_id is not null;

update public.external_share_links share
set source_file_id = coalesce(
  case
    when share.source_type = 'visual' then (
      select capture.file_id
      from public.visual_captures capture
      where capture.id = share.source_id
      limit 1
    )
  end,
  (
    select link.file_id
    from public.file_links link
    where link.project_id = share.project_id
      and link.record_id = share.source_id
      and link.record_type = share.source_type
    order by
      case link.relationship when 'before' then 0 when 'annotation' then 1 when 'evidence' then 2 else 3 end,
      link.created_at desc
    limit 1
  ),
  case
    when share.source_type = 'finding' then (
      select capture.file_id
      from public.visual_annotations annotation
      join public.visual_captures capture on capture.id = annotation.capture_id
      where annotation.finding_id = share.source_id
      order by annotation.created_at desc
      limit 1
    )
  end
)
where share.source_file_id is null;

alter table public.files
  add column if not exists submitted_via_share_id uuid;

alter table public.files
  add constraint files_submitted_via_share_project_fk
  foreign key (submitted_via_share_id, project_id, organization_id)
  references public.external_share_links(id, project_id, organization_id);

create index if not exists files_external_share_idx
  on public.files (submitted_via_share_id, status, created_at desc)
  where submitted_via_share_id is not null;

create table public.external_share_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  share_id uuid not null,
  source_type text not null check (source_type in ('finding','action','inspection','visual')),
  source_id uuid not null,
  response_type text not null check (response_type in ('ready_for_verification','issue')),
  contact_name text check (contact_name is null or char_length(btrim(contact_name)) between 2 and 120),
  note text not null check (char_length(btrim(note)) between 3 and 2000),
  evidence_file_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (share_id, idempotency_key),
  unique (id, project_id, organization_id),
  foreign key (share_id, project_id, organization_id)
    references public.external_share_links(id, project_id, organization_id),
  foreign key (evidence_file_id, project_id, organization_id)
    references public.files(id, project_id, organization_id)
);

create index external_share_responses_project_idx
  on public.external_share_responses (project_id, submitted_at desc);
create index external_share_responses_source_idx
  on public.external_share_responses (source_type, source_id, submitted_at desc);

alter table public.external_share_responses enable row level security;
create policy external_share_responses_select on public.external_share_responses
  for select to authenticated
  using (app_private.can_access_project(project_id));

revoke all on public.external_share_responses from public, anon, authenticated;
grant select on public.external_share_responses to authenticated;

create trigger external_share_responses_audit
  after insert or update or delete on public.external_share_responses
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
  v_source_file_id uuid;
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
    select coalesce(
      (
        select link.file_id
        from public.file_links link
        where link.project_id = p_project_id and link.record_type = 'finding' and link.record_id = p_source_id
        order by case link.relationship when 'before' then 0 when 'annotation' then 1 when 'evidence' then 2 else 3 end, link.created_at desc
        limit 1
      ),
      (
        select capture.file_id
        from public.visual_annotations annotation
        join public.visual_captures capture on capture.id = annotation.capture_id
        where annotation.finding_id = p_source_id
        order by annotation.created_at desc
        limit 1
      )
    ) into v_source_file_id;
  elsif p_source_type = 'action' then
    if not app_private.has_project_permission(p_project_id, 'actions.read') then raise exception 'Missing actions.read permission' using errcode = '42501'; end if;
    select action.organization_id, action.building_id, action.action_number, action.title, coalesce(action.description, action.title)
      into v_organization_id, v_building_id, v_number, v_title, v_summary
      from public.actions action where action.id = p_source_id and action.project_id = p_project_id;
    select link.file_id into v_source_file_id
    from public.file_links link
    where link.project_id = p_project_id and link.record_type = 'action' and link.record_id = p_source_id
    order by link.created_at desc limit 1;
  elsif p_source_type = 'inspection' then
    if not app_private.has_project_permission(p_project_id, 'inspections.read') then raise exception 'Missing inspections.read permission' using errcode = '42501'; end if;
    select inspection.organization_id, inspection.building_id, inspection.inspection_number, inspection.title, 'Inspectie: ' || inspection.status
      into v_organization_id, v_building_id, v_number, v_title, v_summary
      from public.inspections inspection where inspection.id = p_source_id and inspection.project_id = p_project_id;
    select link.file_id into v_source_file_id
    from public.file_links link
    where link.project_id = p_project_id and link.record_type = 'inspection' and link.record_id = p_source_id
    order by link.created_at desc limit 1;
  else
    if not app_private.has_project_permission(p_project_id, 'files.read') then raise exception 'Missing files.read permission' using errcode = '42501'; end if;
    select capture.organization_id, capture.building_id, 'PHOTO', capture.title, coalesce(capture.description, capture.location_label), capture.file_id
      into v_organization_id, v_building_id, v_number, v_title, v_summary, v_source_file_id
      from public.visual_captures capture where capture.id = p_source_id and capture.project_id = p_project_id and capture.status = 'active';
  end if;
  if not found then raise exception 'Share source not found' using errcode = 'P0002'; end if;

  insert into public.external_share_links (
    organization_id, project_id, building_id, source_type, source_id,
    source_number, title, summary, source_file_id, token_hash, expires_at, created_by
  ) values (
    v_organization_id, p_project_id, v_building_id, p_source_type, p_source_id,
    v_number, v_title, v_summary, v_source_file_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
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
  v_response_count integer;
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
  select count(*)::integer into v_response_count from public.external_share_responses response where response.share_id = v_share.id;

  update public.external_share_links set view_count = view_count + 1, last_viewed_at = now() where id = v_share.id;
  return jsonb_build_object(
    'share_id', v_share.id,
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
    'expires_at', v_share.expires_at,
    'has_source_image', v_share.source_file_id is not null,
    'response_count', v_response_count
  );
end;
$$;

create or replace function public.submit_external_share_response(
  p_token text,
  p_response_type text,
  p_note text,
  p_contact_name text,
  p_evidence_file_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_share public.external_share_links;
  v_response public.external_share_responses;
  v_finding public.findings;
  v_contact text := nullif(btrim(coalesce(p_contact_name, '')), '');
begin
  if p_token is null or p_token !~ '^[a-f0-9]{48}$'
    or p_response_type not in ('ready_for_verification','issue')
    or char_length(btrim(coalesce(p_note, ''))) not between 3 and 2000
    or char_length(coalesce(v_contact, '')) > 120
    or char_length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'Invalid external response' using errcode = '22023';
  end if;

  select share.* into v_share
  from public.external_share_links share
  where share.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and share.revoked_at is null and share.expires_at > now()
  for update;
  if not found then raise exception 'Share link expired or revoked' using errcode = 'P0002'; end if;

  select response.* into v_response
  from public.external_share_responses response
  where response.share_id = v_share.id and response.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('response_id', v_response.id, 'status', 'already_received');
  end if;

  if (
    select count(*)
    from public.external_share_responses response
    where response.share_id = v_share.id and response.submitted_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'External response rate limit reached' using errcode = 'P0001';
  end if;

  if p_evidence_file_id is not null and not exists (
    select 1 from public.files file
    where file.id = p_evidence_file_id
      and file.project_id = v_share.project_id
      and file.submitted_via_share_id = v_share.id
      and file.status = 'available'
  ) then
    raise exception 'Evidence file does not belong to this share link' using errcode = '23503';
  end if;

  insert into public.external_share_responses (
    organization_id, project_id, share_id, source_type, source_id,
    response_type, contact_name, note, evidence_file_id, idempotency_key
  ) values (
    v_share.organization_id, v_share.project_id, v_share.id, v_share.source_type, v_share.source_id,
    p_response_type, v_contact, btrim(p_note), p_evidence_file_id, p_idempotency_key
  ) returning * into v_response;

  if p_response_type = 'ready_for_verification' and v_share.source_type = 'finding' then
    select finding.* into v_finding from public.findings finding where finding.id = v_share.source_id for update;
    if found and v_finding.status in ('open','assigned','in_progress','reopened') then
      update public.findings
      set status = 'ready_for_verification',
          final_measure = btrim(p_note)
      where id = v_finding.id;

      insert into public.finding_updates (
        organization_id, project_id, finding_id, update_type, message,
        from_status, to_status, created_by
      ) values (
        v_finding.organization_id, v_finding.project_id, v_finding.id, 'status',
        'Extern gereedgemeld via beveiligde link'
          || case when v_contact is not null then ' door ' || v_contact else '' end
          || ': ' || btrim(p_note),
        v_finding.status, 'ready_for_verification', v_share.created_by
      );
    end if;
  end if;

  if p_evidence_file_id is not null and v_share.source_type in ('finding','action','inspection') then
    insert into public.file_links (
      organization_id, project_id, file_id, record_type, record_id, relationship, created_by
    ) values (
      v_share.organization_id, v_share.project_id, p_evidence_file_id,
      v_share.source_type, v_share.source_id,
      case when p_response_type = 'ready_for_verification' then 'after' else 'evidence' end,
      v_share.created_by
    ) on conflict do nothing;
  end if;

  insert into public.notifications (
    organization_id, project_id, recipient_user_id, notification_type,
    title, body, source_type, source_id
  ) values (
    v_share.organization_id, v_share.project_id, v_share.created_by, 'system',
    case p_response_type
      when 'ready_for_verification' then 'Extern werk gereed voor verificatie'
      else 'Extern probleem teruggemeld'
    end,
    v_share.source_number || ' · ' || v_share.title || ': ' || left(btrim(p_note), 1200),
    'external_share_response', v_response.id
  );

  return jsonb_build_object(
    'response_id', v_response.id,
    'status', case when p_response_type = 'ready_for_verification' then 'ready_for_verification' else 'issue_received' end
  );
end;
$$;

revoke all on function public.submit_external_share_response(text,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.submit_external_share_response(text,text,text,text,uuid,text) to service_role;

-- Server routes use the secret-key/service role only after validating the
-- opaque token. Bypass-RLS alone does not grant PostgreSQL table privileges,
-- so keep these grants explicit and limited to the required operations.
grant select on public.external_share_links, public.project_settings to service_role;
grant select, insert, update on public.files to service_role;

alter table public.external_share_responses replica identity full;
do $migration$
begin
  begin alter publication supabase_realtime add table public.external_share_responses; exception when duplicate_object then null; end;
end;
$migration$;

commit;
