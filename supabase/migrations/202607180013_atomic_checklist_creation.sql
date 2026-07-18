begin;

create or replace function public.create_project_checklist(
  p_project_id uuid,
  p_module text,
  p_code text,
  p_name text,
  p_prompts text[]
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
  v_prompt text;
  v_position integer := 0;
begin
  select project.* into v_project
  from public.projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'templates.manage') then
    raise exception 'Missing templates.manage permission' using errcode = '42501';
  end if;
  if p_module not in ('inspection','hse','delivery','test') then
    raise exception 'Invalid checklist module' using errcode = '22023';
  end if;
  if cardinality(p_prompts) is null or cardinality(p_prompts) < 1 or cardinality(p_prompts) > 100 then
    raise exception 'A checklist requires between 1 and 100 prompts' using errcode = '22023';
  end if;
  if nullif(btrim(p_code), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'Checklist code and name are required' using errcode = '22023';
  end if;

  insert into public.checklist_templates (
    organization_id, project_id, module, code, name, version_number,
    status, published_at, created_by
  ) values (
    v_project.organization_id, p_project_id, p_module, upper(btrim(p_code)),
    btrim(p_name), 1, 'draft', null, v_actor
  ) returning * into v_template;

  foreach v_prompt in array p_prompts loop
    v_position := v_position + 1;
    if nullif(btrim(v_prompt), '') is null then
      raise exception 'Checklist prompts cannot be empty' using errcode = '22023';
    end if;
    insert into public.checklist_items (
      organization_id, template_id, section, prompt, response_type,
      required, sort_order, failure_severity, created_by
    ) values (
      v_project.organization_id, v_template.id, 'Projectcontrole', btrim(v_prompt),
      case when p_module = 'hse' then 'yes_no_na' else 'pass_fail_na' end,
      true, v_position * 10, 'high', v_actor
    );
  end loop;

  update public.checklist_templates
  set status = 'published', published_at = now()
  where id = v_template.id
  returning * into v_template;

  return v_template;
end;
$$;

revoke all on function public.create_project_checklist(uuid,text,text,text,text[]) from public, anon;
grant execute on function public.create_project_checklist(uuid,text,text,text,text[]) to authenticated;

commit;
