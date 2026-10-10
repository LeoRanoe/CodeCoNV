-- 202607300004 rewrote create_visual_annotation_finding (building + disposition) and the
-- rewrite dropped the step that links the source photo/panorama to the finding it creates
-- (relationship 'annotation'). A finding created by clicking a photo therefore no longer
-- carried that photo as evidence, and the formal report snapshot, which orders a finding's
-- images by relationship, lost it too.
--
-- The link is restored as a trigger on visual_annotations rather than inside the RPC, so
-- every path that places a marker on a finding (create_visual_annotation_finding,
-- create_visual_annotation_for_finding, any later rewrite) links the image the same way.
-- file_links is unique on (file_id, record_type, record_id, relationship), so a path that
-- still inserts the link itself is harmless.

begin;

create or replace function app_private.link_visual_annotation_source()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.finding_id is null then return new; end if;
  insert into public.file_links (
    organization_id, project_id, file_id, record_type, record_id, relationship, created_by
  )
  select new.organization_id, new.project_id, capture.file_id, 'finding', new.finding_id,
    'annotation', new.created_by
  from public.visual_captures capture
  where capture.id = new.capture_id
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function app_private.link_visual_annotation_source() from public, anon, authenticated;

drop trigger if exists visual_annotations_link_source on public.visual_annotations;
create trigger visual_annotations_link_source
  after insert on public.visual_annotations
  for each row execute function app_private.link_visual_annotation_source();

-- Repair any marker placed while the link was missing.
insert into public.file_links (
  organization_id, project_id, file_id, record_type, record_id, relationship, created_by
)
select annotation.organization_id, annotation.project_id, capture.file_id, 'finding',
  annotation.finding_id, 'annotation', annotation.created_by
from public.visual_annotations annotation
join public.visual_captures capture on capture.id = annotation.capture_id
where annotation.finding_id is not null
on conflict do nothing;

commit;
