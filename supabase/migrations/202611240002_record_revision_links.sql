-- F11 (client-spec audit): records link to an exact document revision.
--
-- A Technical Instruction or Change Order chooses its drawing/document from the Project Documents
-- register; the spec stores the readable reference ("DWG-101 rev A") in the field and
-- "revision:<id>" in <field>_ref. This migration:
-- * refuses a reference to a revision of another project (or one that does not exist);
-- * keeps project_document_links in step with the record, with the exact revision, so the register
--   lists the records written against each revision;
-- * leaves links added by hand in the register (source_field is null) and all older text
--   references as they are.
-- Whether a referenced revision is stale (retired, or a later revision approved) is derived when
-- it is shown; the stored reference never changes.

alter table public.project_document_links add column if not exists revision_id uuid;
alter table public.project_document_links add column if not exists source_field text
  check (source_field is null or char_length(source_field) <= 80);
alter table public.project_document_links drop constraint if exists project_document_links_revision_fk;
alter table public.project_document_links add constraint project_document_links_revision_fk
  foreign key (revision_id, project_id, organization_id)
  references public.project_document_revisions(id, project_id, organization_id);

-- The revision references of a spec object: field key -> revision id.
create or replace function app_private.spec_revision_refs(p_spec jsonb)
returns table (field text, revision_id uuid)
language sql
immutable
set search_path = pg_catalog
as $$
  select left(item.key, -4), substring(item.value #>> '{}' from 10)::uuid
  from jsonb_each(case when jsonb_typeof(p_spec) = 'object' then p_spec else '{}'::jsonb end) item
  where item.key like '%\_ref' and jsonb_typeof(item.value) = 'string'
    and (item.value #>> '{}') ~* '^revision:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function app_private.sync_record_revision_links()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_spec jsonb := new.details -> 'spec';
  v_ref record;
  v_revision public.project_document_revisions;
  v_actor uuid := coalesce((select auth.uid()), new.created_by);
  v_kept uuid[] := '{}';
begin
  if tg_op = 'UPDATE' and (new.details -> 'spec') is not distinct from (old.details -> 'spec') then
    return new;
  end if;
  for v_ref in select * from app_private.spec_revision_refs(v_spec) loop
    select revision.* into v_revision from public.project_document_revisions revision
    where revision.id = v_ref.revision_id and revision.project_id = new.project_id;
    if not found then
      raise exception 'The document revision referenced in % is not in this project', v_ref.field using errcode = '22023';
    end if;
    insert into public.project_document_links as link (organization_id, project_id, document_id, record_type, record_id, record_code, created_by, revision_id, source_field)
    values (new.organization_id, new.project_id, v_revision.document_id, 'register_entry', new.id, new.entry_number, v_actor, v_revision.id, v_ref.field)
    on conflict (document_id, record_type, record_id) do update
      set revision_id = excluded.revision_id, source_field = excluded.source_field, record_code = excluded.record_code;
    v_kept := v_kept || v_revision.document_id;
  end loop;
  -- A reference that was removed or changed to another document drops its link (hand-made links stay).
  delete from public.project_document_links link
  where link.record_type = 'register_entry' and link.record_id = new.id and link.source_field is not null
    and not link.document_id = any (v_kept);
  return new;
end;
$$;

drop trigger if exists project_register_entries_revision_links on public.project_register_entries;
create trigger project_register_entries_revision_links after insert or update of details on public.project_register_entries
  for each row execute function app_private.sync_record_revision_links();
