begin;

-- The client reference forms contain more than twenty checkpoints. Keep the
-- reusable library compact, but allow a complete controlled trade checklist.
alter table public.checklist_library_templates
  drop constraint if exists checklist_library_templates_prompts_check;
alter table public.checklist_library_templates
  add constraint checklist_library_templates_prompts_check
  check (jsonb_typeof(prompts) = 'array' and jsonb_array_length(prompts) between 3 and 60);

insert into public.checklist_library_templates (
  code, module, category, name, description, prompts, sort_order, active
) values
(
  'LIB-101',
  'inspection',
  'Anchors / Ankers',
  'Cast-in anchors · installation',
  'CODECO project checklist distilled from the client cast-in anchor reference form. Sections and answer order remain versioned per project.',
  jsonb_build_array(
    'General|Approved construction drawings and the anchor layout are available on site.',
    'General|The latest Issued for Construction revision is available; obsolete revisions are removed and changes communicated.',
    'General|Approved documents are stored protected and organized on site.',
    'General|The approved work method statement and Engineer approval are available before installation.',
    'General|Anchor type, diameter, grade, embedment depth and projection match the approved documents.',
    'General|[AUTO_WEATHER] Ambient weather conditions are suitable for anchor installation and concrete work.',
    'Safety|All personnel wear the required PPE.',
    'Safety|Safety harnesses are used for work above 1.80 m.',
    'Safety|The work area is properly barricaded and access is controlled.',
    'Safety|Nearby structures and existing services are adequately protected.',
    'Safety|Electrical and mechanical hazards are identified and controlled.',
    'Anchor placement|Anchor locations are marked according to the approved shop drawings.',
    'Anchor placement|Lines, levels and reference points are verified.',
    'Anchor placement|The correct anchor type, size and quantity are available.',
    'Anchor placement|Anchors are free from damage, rust and contamination.',
    'Anchor placement|Installation templates are dimensionally accurate and securely fixed.',
    'Anchor placement|Threads are protected against concrete contamination.',
    'Anchor placement|Alignment, spacing, embedment depth and projection comply with the approved documents.',
    'Anchor placement|Concrete cover around anchors complies with the approved shop drawings.'
  ),
  101,
  true
),
(
  'LIB-102',
  'inspection',
  'Anchors / Ankers',
  'Cast-in anchors · before and during concrete casting',
  'CODECO project checklist distilled from the client anchor concrete-casting reference form, including safety, pre-pour and casting controls.',
  jsonb_build_array(
    'Safety|All personnel wear the required PPE.',
    'Safety|Safety harnesses are used for work above 1.80 m.',
    'Safety|The work area is properly barricaded and access is controlled.',
    'Safety|Nearby structures and existing services are adequately protected.',
    'Safety|Electrical and mechanical hazards are identified and controlled.',
    'Before concrete casting|Anchor type, diameter, grade, embedment depth and projection match the approved documents.',
    'Before concrete casting|Anchor locations are verified.',
    'Before concrete casting|Alignment, spacing and projection are verified.',
    'Before concrete casting|Embedment depth is verified.',
    'Before concrete casting|Anchor type and grade are verified.',
    'Before concrete casting|Templates are securely fixed.',
    'Before concrete casting|Anchors are rigidly secured.',
    'Before concrete casting|Threads are protected.',
    'Before concrete casting|Required concrete cover is maintained.',
    'Before concrete casting|Engineer inspection is completed before pouring.',
    'Concrete casting|Anchors remain securely fixed during concrete placement.',
    'Concrete casting|No movement or rotation occurs during vibration.',
    'Concrete casting|Anchor threads remain protected from concrete contamination.',
    'Concrete casting|Concrete is placed without disturbing anchor positions.',
    'Concrete casting|Vibrators do not contact anchors or templates.',
    'Concrete casting|No segregation is observed around anchor assemblies.'
  ),
  102,
  true
),
(
  'LIB-103',
  'inspection',
  'Anchors / Ankers',
  'Cast-in anchors · after concrete casting',
  'CODECO project checklist distilled from the client post-casting anchor reference form, with duplicate source rows removed.',
  jsonb_build_array(
    'Safety|All personnel wear the required PPE.',
    'Safety|Safety harnesses are used for work above 1.80 m.',
    'Safety|The work area is properly barricaded and access is controlled.',
    'Safety|Nearby structures and existing services are adequately protected.',
    'Safety|Electrical and mechanical hazards are identified and controlled.',
    'After concrete casting|Anchor type, diameter, grade, embedment depth and projection match the approved documents.',
    'After concrete casting|The required curing period is complete before templates are removed or loads are applied.',
    'After concrete casting|Anchor positions are verified after formwork removal.',
    'After concrete casting|Projection height is within the specified tolerance.',
    'After concrete casting|Anchor verticality is verified.',
    'After concrete casting|Threads are clean and free from concrete contamination.',
    'After concrete casting|No honeycombing, voids or cracks are present around anchors.',
    'After concrete casting|Concrete cover complies with the approved drawings.',
    'After concrete casting|Corrosion protection is intact where applicable.',
    'After concrete casting|Inspection records are complete and approved.'
  ),
  103,
  true
)
on conflict (code) do update set
  module = excluded.module,
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  prompts = excluded.prompts,
  sort_order = excluded.sort_order,
  active = excluded.active;

create or replace function public.install_checklist_library_template(
  p_project_id uuid,
  p_library_code text
)
returns public.checklist_templates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_library public.checklist_library_templates;
  v_template public.checklist_templates;
  v_version integer;
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'templates.manage') then
    raise exception 'Missing templates.manage permission' using errcode = '42501';
  end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  select library.* into v_library from public.checklist_library_templates library
  where library.code = p_library_code and library.active;
  if not found then raise exception 'Checklist library item not found' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':checklist:' || v_library.code, 0));
  select coalesce(max(template.version_number), 0) + 1 into v_version
  from public.checklist_templates template
  where template.project_id = p_project_id and template.module = v_library.module and template.code = v_library.code;

  insert into public.checklist_templates (
    organization_id, project_id, module, code, name, description,
    version_number, status, published_at, created_by
  ) values (
    v_project.organization_id, v_project.id, v_library.module, v_library.code,
    v_library.name, v_library.description, v_version, 'published', now(), v_actor
  ) returning * into v_template;

  insert into public.checklist_items (
    organization_id, template_id, section, prompt, response_type, required,
    sort_order, failure_severity, guidance, created_by
  )
  select
    v_project.organization_id,
    v_template.id,
    case when position('|' in prompt.value) > 0 then btrim(split_part(prompt.value, '|', 1)) else v_library.category end,
    regexp_replace(
      case when position('|' in prompt.value) > 0 then btrim(split_part(prompt.value, '|', 2)) else btrim(prompt.value) end,
      '^\[AUTO_WEATHER\][[:space:]]*',
      ''
    ),
    case when v_library.code in ('LIB-101','LIB-102','LIB-103') or v_library.module = 'hse' then 'yes_no_na' else 'pass_fail_na' end,
    true,
    prompt.ordinality::integer * 10,
    case when prompt.ordinality <= 2 then 'high' else 'medium' end,
    case
      when prompt.value like '%|[AUTO_WEATHER] %'
        then 'AUTO_WEATHER|Suggested automatically from today''s project weather. The supervisor must confirm or correct it.'
      else 'Choose the result. Add a short remark only for an exception or evidence reference.'
    end,
    v_actor
  from jsonb_array_elements_text(v_library.prompts) with ordinality as prompt(value, ordinality);
  return v_template;
end;
$$;

create or replace function app_private.ensure_codeco_anchor_checklists(
  p_project_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_project public.projects;
  v_library public.checklist_library_templates;
  v_template public.checklist_templates;
  v_version integer;
begin
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then return; end if;

  for v_library in
    select library.* from public.checklist_library_templates library
    where library.code in ('LIB-101','LIB-102','LIB-103') and library.active
    order by library.sort_order
  loop
    if exists (
      select 1 from public.checklist_templates template
      where template.project_id = v_project.id
        and template.code = v_library.code
        and template.status = 'published'
    ) then
      continue;
    end if;

    select coalesce(max(template.version_number), 0) + 1 into v_version
    from public.checklist_templates template
    where template.project_id = v_project.id
      and template.module = v_library.module
      and template.code = v_library.code;

    insert into public.checklist_templates (
      organization_id, project_id, module, code, name, description,
      version_number, status, published_at, created_by
    ) values (
      v_project.organization_id, v_project.id, v_library.module, v_library.code,
      v_library.name, v_library.description, v_version, 'published', now(), p_actor
    ) returning * into v_template;

    insert into public.checklist_items (
      organization_id, template_id, section, prompt, response_type, required,
      sort_order, failure_severity, guidance, created_by
    )
    select
      v_project.organization_id,
      v_template.id,
      btrim(split_part(prompt.value, '|', 1)),
      regexp_replace(btrim(split_part(prompt.value, '|', 2)), '^\[AUTO_WEATHER\][[:space:]]*', ''),
      'yes_no_na',
      true,
      prompt.ordinality::integer * 10,
      case when prompt.ordinality <= 2 then 'high' else 'medium' end,
      case
        when prompt.value like '%|[AUTO_WEATHER] %'
          then 'AUTO_WEATHER|Suggested automatically from today''s project weather. The supervisor must confirm or correct it.'
        else 'Choose Yes, No or N/A. Add a short remark only for an exception or evidence reference.'
      end,
      p_actor
    from jsonb_array_elements_text(v_library.prompts) with ordinality as prompt(value, ordinality);
  end loop;
end;
$$;

create or replace function app_private.install_codeco_anchor_checklists_after_project()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform app_private.ensure_codeco_anchor_checklists(new.id, new.created_by);
  return new;
end;
$$;

drop trigger if exists projects_install_codeco_anchor_checklists on public.projects;
create trigger projects_install_codeco_anchor_checklists
after insert on public.projects
for each row execute function app_private.install_codeco_anchor_checklists_after_project();

do $$
declare
  v_project public.projects;
begin
  for v_project in select project.* from public.projects project where project.status in ('draft','active','on_hold')
  loop
    perform app_private.ensure_codeco_anchor_checklists(v_project.id, v_project.created_by);
  end loop;
end;
$$;

revoke all on function app_private.ensure_codeco_anchor_checklists(uuid,uuid) from public, anon, authenticated;
revoke all on function app_private.install_codeco_anchor_checklists_after_project() from public, anon, authenticated;

commit;
