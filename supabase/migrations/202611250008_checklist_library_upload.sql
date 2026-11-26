-- Developer package v5 (25-11-2026), Word section 3 / 13: Checklist Library.
-- "The Project Admin uploads own checklists (xlsx / csv, versioned); the inspector picks a checklist and
-- answers Pass / Fail / N/A per item."
--
-- upload_project_checklist creates the next version of a checklist code of the project (version 1 when the
-- code is new), publishes it and retires the previous published version. Inspections already started on an
-- older version keep that version: items and templates are never rewritten. The items come from the
-- uploaded sheet (section, prompt, answer type, required, guidance, unit).

create or replace function public.upload_project_checklist(
  p_project_id uuid,
  p_module text,
  p_code text,
  p_name text,
  p_items jsonb
)
returns public.checklist_templates
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_template public.checklist_templates;
  v_item jsonb;
  v_position integer := 0;
  v_version integer;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_prompt text;
  v_type text;
begin
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'templates.manage') then
    raise exception 'Missing templates.manage permission' using errcode = '42501';
  end if;
  if p_module not in ('inspection', 'hse', 'delivery', 'test') then
    raise exception 'Invalid checklist module' using errcode = '22023';
  end if;
  if char_length(v_code) < 2 or char_length(v_code) > 40 or nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Checklist code and name are required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 300 then
    raise exception 'A checklist requires between 1 and 300 items' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('checklist:' || p_project_id::text || ':' || p_module || ':' || v_code, 0));
  select coalesce(max(template.version_number), 0) + 1 into v_version
  from public.checklist_templates template
  where template.project_id = p_project_id and template.module = p_module and template.code = v_code;

  insert into public.checklist_templates (
    organization_id, project_id, module, code, name, version_number, status, published_at, created_by
  ) values (
    v_project.organization_id, p_project_id, p_module, v_code, btrim(p_name), v_version, 'draft', null, v_actor
  ) returning * into v_template;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_prompt := btrim(coalesce(v_item ->> 'prompt', ''));
    if char_length(v_prompt) < 3 or char_length(v_prompt) > 500 then
      raise exception 'Checklist item % needs a prompt of 3 to 500 characters', v_position using errcode = '22023';
    end if;
    v_type := coalesce(nullif(v_item ->> 'response_type', ''), case when p_module = 'hse' then 'yes_no_na' else 'pass_fail_na' end);
    if v_type not in ('yes_no_na', 'pass_fail_na', 'number', 'text') then
      raise exception 'Checklist item % has an unknown answer type', v_position using errcode = '22023';
    end if;
    insert into public.checklist_items (
      organization_id, template_id, section, prompt, response_type, required,
      sort_order, unit, guidance, failure_severity, created_by
    ) values (
      v_project.organization_id, v_template.id,
      coalesce(nullif(left(btrim(coalesce(v_item ->> 'section', '')), 120), '') , 'Projectcontrole'),
      v_prompt, v_type,
      coalesce((v_item ->> 'required')::boolean, true),
      v_position * 10,
      nullif(left(btrim(coalesce(v_item ->> 'unit', '')), 40), ''),
      nullif(left(btrim(coalesce(v_item ->> 'guidance', '')), 1000), ''),
      'high', v_actor
    );
  end loop;

  update public.checklist_templates
  set status = 'retired', updated_at = now()
  where project_id = p_project_id and module = p_module and code = v_code
    and status = 'published' and id <> v_template.id;

  update public.checklist_templates
  set status = 'published', published_at = now()
  where id = v_template.id
  returning * into v_template;

  return v_template;
end;
$$;

revoke all on function public.upload_project_checklist(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.upload_project_checklist(uuid, text, text, text, jsonb) to authenticated;
