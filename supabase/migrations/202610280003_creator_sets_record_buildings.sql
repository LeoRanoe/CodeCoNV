-- A contractor saves an RFI, RFA, WCR or WIR: create_project_register_entry succeeds, and the
-- app then files the record under its buildings with set_record_buildings. That function asked
-- for records.edit, which the contractor does not have (it only creates records), so the save
-- ended in a 403 after the record already existed (QA sweep 2026-10-28, H1, third layer).
--
-- The person who created a register entry may set its buildings, with records.create. Nobody
-- else gains anything: other roles and other people's records are checked as before. The
-- function becomes security definer so the record_buildings policy, which needs records.edit,
-- does not undo the explicit check at the top of the function. It is patched in place so this
-- migration cannot drift from the 202608050005 definition.
do $patch$
declare
  v_oid oid;
  v_definition text;
  v_patched text;
begin
  select procedure.oid into v_oid
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'set_record_buildings';

  v_definition := pg_get_functiondef(v_oid);

  v_patched := regexp_replace(
    v_definition,
    'else app_private\.has_project_permission\(p_project_id, ''records\.edit''\)',
    $new$when 'register_entry' then (
      app_private.has_project_permission(p_project_id, 'records.edit')
      or (
        app_private.has_project_permission(p_project_id, 'records.create')
        and exists (
          select 1 from public.project_register_entries own
          where own.id = p_record_id and own.project_id = p_project_id and own.created_by = v_actor
        )
      )
    )
    else app_private.has_project_permission(p_project_id, 'records.edit')$new$
  );
  if v_patched = v_definition then
    raise exception 'set_record_buildings no longer contains the expected permission check';
  end if;

  v_definition := v_patched;
  v_patched := regexp_replace(v_definition, 'LANGUAGE plpgsql', 'LANGUAGE plpgsql SECURITY DEFINER');
  if v_patched = v_definition then
    raise exception 'set_record_buildings could not be made security definer';
  end if;

  execute v_patched;
end;
$patch$;

revoke all on function public.set_record_buildings(uuid, text, uuid, uuid[]) from public, anon;
grant execute on function public.set_record_buildings(uuid, text, uuid, uuid[]) to authenticated;
