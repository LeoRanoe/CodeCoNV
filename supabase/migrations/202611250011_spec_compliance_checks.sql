-- Developer package v5 (25-11-2026), Word 10.1: Rapid Verify spec compliance check.
-- A supervisor compares a submittal (or a delivery / inspection with its attachments) with a clause of the
-- bestek, one row per requirement, and signs the overall result. The result, both document revisions and the
-- table are stored as a verification record that cannot be edited afterwards; a failed check can start an NCR.

create table if not exists public.spec_compliance_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  check_number text not null,
  subject_kind text not null check (subject_kind in ('document','delivery','inspection')),
  subject_file_id uuid references public.files(id),
  subject_record_id uuid,
  subject_label text not null check (char_length(btrim(subject_label)) between 2 and 240),
  requirement_file_id uuid references public.files(id),
  requirement_label text not null check (char_length(btrim(requirement_label)) between 2 and 240),
  clause text not null check (char_length(btrim(clause)) between 1 and 240),
  material_group text check (material_group is null or char_length(material_group) <= 120),
  rows jsonb not null check (jsonb_typeof(rows) = 'array' and jsonb_array_length(rows) between 1 and 200),
  overall_result text not null check (overall_result in ('complies','complies_with_comments','does_not_comply')),
  comments text check (comments is null or char_length(comments) <= 2000),
  proposed_by_assistant boolean not null default false,
  signed_by text not null check (char_length(btrim(signed_by)) >= 2),
  signed_at timestamptz not null default now(),
  signature_image text,
  follow_up_finding_id uuid references public.findings(id),
  idempotency_key text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, check_number),
  unique (created_by, idempotency_key)
);

create index if not exists spec_compliance_checks_project_idx on public.spec_compliance_checks (project_id, created_at desc);
create index if not exists spec_compliance_checks_subject_idx on public.spec_compliance_checks (subject_file_id, requirement_file_id);

alter table public.spec_compliance_checks enable row level security;

drop policy if exists spec_compliance_checks_select on public.spec_compliance_checks;
create policy spec_compliance_checks_select on public.spec_compliance_checks for select to authenticated
  using (app_private.has_project_permission(project_id, 'findings.read') or app_private.has_project_permission(project_id, 'findings.verify'));

grant select on public.spec_compliance_checks to authenticated;

-- Every row of the table: parameter, required value, submitted value, result, comment, page reference.
create or replace function public.record_spec_compliance_check(
  p_project_id uuid,
  p_subject_kind text,
  p_subject_file_id uuid,
  p_subject_record_id uuid,
  p_subject_label text,
  p_requirement_file_id uuid,
  p_requirement_label text,
  p_clause text,
  p_material_group text,
  p_rows jsonb,
  p_comments text,
  p_proposed_by_assistant boolean,
  p_signed_by text,
  p_signature_image text,
  p_idempotency_key text
)
returns public.spec_compliance_checks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_row jsonb;
  v_results text[] := '{}';
  v_overall text;
  v_sequence integer;
  v_check public.spec_compliance_checks;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'findings.verify') then
    raise exception 'Only a verifier of this project may record a compliance check' using errcode = '42501';
  end if;
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null then raise exception 'Unknown project' using errcode = '22023'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Add at least one requirement to the comparison' using errcode = '22023';
  end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    if coalesce(btrim(v_row ->> 'parameter'), '') = '' then
      raise exception 'Every requirement needs a parameter' using errcode = '22023';
    end if;
    if coalesce(v_row ->> 'result', '') not in ('complies', 'does_not_comply', 'not_stated', 'not_applicable') then
      raise exception 'Choose a result for every requirement' using errcode = '22023';
    end if;
    v_results := v_results || (v_row ->> 'result');
  end loop;
  -- The overall result follows from the rows: any failure fails the check; a missing statement or a
  -- comment makes it "complies with comments".
  v_overall := case
    when 'does_not_comply' = any (v_results) then 'does_not_comply'
    when 'not_stated' = any (v_results) or coalesce(btrim(p_comments), '') <> '' then 'complies_with_comments'
    else 'complies' end;
  if coalesce(btrim(p_signed_by), '') = '' or coalesce(p_signature_image, '') = '' then
    raise exception 'The check is signed by the verifier' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('spec-check:' || p_project_id::text, 0));
  -- A retry of the same request returns the check that was already stored.
  select * into v_check from public.spec_compliance_checks
    where created_by = v_actor and idempotency_key = left(p_idempotency_key, 120);
  if v_check.id is not null then return v_check; end if;
  select coalesce(max(substring(x.check_number from '([0-9]+)$')::integer), 0) + 1 into v_sequence
    from public.spec_compliance_checks x where x.project_id = p_project_id and x.check_number ~ '[0-9]+$';

  insert into public.spec_compliance_checks (
    organization_id, project_id, check_number, subject_kind, subject_file_id, subject_record_id, subject_label,
    requirement_file_id, requirement_label, clause, material_group, rows, overall_result, comments,
    proposed_by_assistant, signed_by, signature_image, created_by, idempotency_key
  ) values (
    v_project.organization_id, p_project_id,
    upper(btrim(v_project.code)) || '-SPC-' || to_char(timezone('America/Paramaribo', now()), 'YYYY') || '-' || lpad(v_sequence::text, 4, '0'),
    p_subject_kind, p_subject_file_id, p_subject_record_id, btrim(p_subject_label),
    p_requirement_file_id, btrim(p_requirement_label), btrim(p_clause), nullif(btrim(coalesce(p_material_group, '')), ''),
    p_rows, v_overall, nullif(btrim(coalesce(p_comments, '')), ''),
    coalesce(p_proposed_by_assistant, false), btrim(p_signed_by), p_signature_image, v_actor, left(p_idempotency_key, 120)
  ) returning * into v_check;
  return v_check;
end;
$$;

revoke all on function public.record_spec_compliance_check(uuid, text, uuid, uuid, text, uuid, text, text, text, jsonb, text, boolean, text, text, text) from public, anon;
grant execute on function public.record_spec_compliance_check(uuid, text, uuid, uuid, text, uuid, text, text, text, jsonb, text, boolean, text, text, text) to authenticated;

-- A failed check starts an NCR: the check keeps the link to the finding that follows from it.
create or replace function public.link_spec_check_follow_up(p_check_id uuid, p_finding_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_check public.spec_compliance_checks;
begin
  select * into v_check from public.spec_compliance_checks where id = p_check_id;
  if v_check.id is null or not app_private.has_project_permission(v_check.project_id, 'findings.verify') then
    raise exception 'Only a verifier of this project may link a follow-up' using errcode = '42501';
  end if;
  if v_check.follow_up_finding_id is not null then return; end if;
  if not exists (select 1 from public.findings finding where finding.id = p_finding_id and finding.project_id = v_check.project_id) then
    raise exception 'The follow-up belongs to another project' using errcode = '22023';
  end if;
  update public.spec_compliance_checks set follow_up_finding_id = p_finding_id where id = p_check_id;
end;
$$;
revoke all on function public.link_spec_check_follow_up(uuid, uuid) from public, anon;
grant execute on function public.link_spec_check_follow_up(uuid, uuid) to authenticated;

-- Stored checks cannot be changed or removed; the only later write is the follow-up link above.
create or replace function public.spec_compliance_checks_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then raise exception 'A compliance check cannot be deleted' using errcode = '42501'; end if;
  if (to_jsonb(new) - 'follow_up_finding_id') is distinct from (to_jsonb(old) - 'follow_up_finding_id') then
    raise exception 'A compliance check cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists spec_compliance_checks_immutable on public.spec_compliance_checks;
create trigger spec_compliance_checks_immutable before update or delete on public.spec_compliance_checks
  for each row execute function public.spec_compliance_checks_immutable();
