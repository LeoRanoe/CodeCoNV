-- Workbook NCR row 10 "Requirement reference": input control "Short text / linked document",
-- "Record document number, revision and clause/section where possible". Word §15: "Support Project
-- Document → Revision → Transmittal → Related Technical Instruction / NCR / Inspection" and §4.3
-- "Warn users when a record links to a superseded document".
-- The NCR form now picks the exact revision from Project Documents (typed text only when the document
-- is not in the register), like TI and CO. This keeps project_document_links in step for NCRs, which
-- are stored as findings with their workbook fields in issue_management.spec. Decision list #15 is
-- resolved for the NCR by the workbook.

create or replace function app_private.sync_finding_revision_links()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_spec jsonb := new.issue_management -> 'spec';
  v_ref record;
  v_revision public.project_document_revisions;
  v_actor uuid := coalesce((select auth.uid()), new.created_by);
  v_kept uuid[] := '{}';
begin
  if tg_op = 'UPDATE' and (new.issue_management -> 'spec') is not distinct from (old.issue_management -> 'spec') then
    return new;
  end if;
  for v_ref in select * from app_private.spec_revision_refs(v_spec) loop
    select revision.* into v_revision from public.project_document_revisions revision
    where revision.id = v_ref.revision_id and revision.project_id = new.project_id;
    if not found then
      raise exception 'The document revision referenced in % is not in this project', v_ref.field using errcode = '22023';
    end if;
    insert into public.project_document_links as link (organization_id, project_id, document_id, record_type, record_id, record_code, created_by, revision_id, source_field)
    values (new.organization_id, new.project_id, v_revision.document_id, 'finding', new.id, new.finding_number, v_actor, v_revision.id, v_ref.field)
    on conflict (document_id, record_type, record_id) do update
      set revision_id = excluded.revision_id, source_field = excluded.source_field, record_code = excluded.record_code;
    v_kept := v_kept || v_revision.document_id;
  end loop;
  delete from public.project_document_links link
  where link.record_type = 'finding' and link.record_id = new.id and link.source_field is not null
    and not link.document_id = any (v_kept);
  return new;
end;
$$;
revoke all on function app_private.sync_finding_revision_links() from public, anon, authenticated;

drop trigger if exists findings_revision_links on public.findings;
create trigger findings_revision_links after insert or update of issue_management on public.findings
  for each row execute function app_private.sync_finding_revision_links();
