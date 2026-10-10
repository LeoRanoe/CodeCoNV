-- Creating an external share link hands a person without an account a way into one record, and
-- (see 202610060002) lets that person respond to it. That is a write-level act, not a read.
--
-- Until now the function only asked for the read permission of the source, so a client or any
-- other read-only member could mint a link for a contractor by calling the RPC directly, whatever
-- the screen showed. The permission required now matches the one the screen asks for:
--   finding    -> findings.create
--   action     -> actions.create
--   inspection -> inspections.manage
--   visual     -> files.manage
-- Existing links, their tokens and their responses are not touched.

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
    if not app_private.has_project_permission(p_project_id, 'findings.create') then raise exception 'Missing findings.create permission' using errcode = '42501'; end if;
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
    if not app_private.has_project_permission(p_project_id, 'actions.create') then raise exception 'Missing actions.create permission' using errcode = '42501'; end if;
    select action.organization_id, action.building_id, action.action_number, action.title, coalesce(action.description, action.title)
      into v_organization_id, v_building_id, v_number, v_title, v_summary
      from public.actions action where action.id = p_source_id and action.project_id = p_project_id;
    select link.file_id into v_source_file_id
    from public.file_links link
    where link.project_id = p_project_id and link.record_type = 'action' and link.record_id = p_source_id
    order by link.created_at desc limit 1;
  elsif p_source_type = 'inspection' then
    if not app_private.has_project_permission(p_project_id, 'inspections.manage') then raise exception 'Missing inspections.manage permission' using errcode = '42501'; end if;
    select inspection.organization_id, inspection.building_id, inspection.inspection_number, inspection.title, 'Inspectie: ' || inspection.status
      into v_organization_id, v_building_id, v_number, v_title, v_summary
      from public.inspections inspection where inspection.id = p_source_id and inspection.project_id = p_project_id;
    select link.file_id into v_source_file_id
    from public.file_links link
    where link.project_id = p_project_id and link.record_type = 'inspection' and link.record_id = p_source_id
    order by link.created_at desc limit 1;
  else
    if not app_private.has_project_permission(p_project_id, 'files.manage') then raise exception 'Missing files.manage permission' using errcode = '42501'; end if;
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
