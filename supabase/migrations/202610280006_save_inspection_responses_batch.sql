-- QA sweep L25: finishing an inspection sent one request per checklist answer (15 for a
-- 15-point checklist) before the completion call. A dropped connection half-way left some
-- answers stored and some not. One call stores the whole set in one transaction; every answer
-- still goes through save_inspection_response, so the permission, status and item checks are the
-- same ones.

create or replace function public.save_inspection_responses(
  p_inspection_id uuid,
  p_responses jsonb
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_answer jsonb;
  v_count integer := 0;
begin
  if p_responses is null or jsonb_typeof(p_responses) <> 'array' then
    raise exception 'Responses must be a list' using errcode = '22023';
  end if;
  for v_answer in select value from jsonb_array_elements(p_responses) loop
    perform public.save_inspection_response(
      p_inspection_id,
      (v_answer ->> 'checklist_item_id')::uuid,
      v_answer ->> 'result',
      nullif(v_answer ->> 'numeric_value', '')::numeric,
      nullif(v_answer ->> 'text_value', ''),
      coalesce(v_answer ->> 'notes', ''),
      'inspection-response:' || p_inspection_id::text || ':' || (v_answer ->> 'checklist_item_id')
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.save_inspection_responses(uuid, jsonb) from public, anon;
grant execute on function public.save_inspection_responses(uuid, jsonb) to authenticated;
