-- QA sweep 2026-10-28, H4 / M13 / M17.
--
-- 1. The expected workforce and the progress of a building were mandatory numbers, so the form
--    filled in 42 persons and the report showed progress for a building nobody had measured.
--    Both may now stay empty; the report says "Niet geregistreerd".
-- 2. The frozen day report carries what the formal report needs for its tables: the project's
--    parties (organisation per attendance line, client / contractor / supervisor in the head)
--    and the visual captures (photo list with title, place and time). They are added to the
--    snapshot builder in place, so the rest of its definition is unchanged.
alter table public.day_start_checks alter column expected_workers drop not null;
alter table public.day_closeouts alter column progress_percent drop not null;

do $patch$
declare
  v_oid oid;
  v_definition text;
  v_patched text;
begin
  select procedure.oid into v_oid
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'build_day_report_snapshot';

  v_definition := pg_get_functiondef(v_oid);
  v_patched := regexp_replace(
    v_definition,
    '''report'', to_jsonb\(v_report\),',
    $new$'report', to_jsonb(v_report),
    'parties', coalesce((select jsonb_agg(jsonb_build_object('id', party.id, 'code', party.code, 'name', party.name, 'party_type', party.party_type) order by party.name) from public.parties party where party.project_id = v_report.project_id), '[]'::jsonb),
    'visual_captures', coalesce((select jsonb_agg(jsonb_build_object('id', capture.id, 'file_id', capture.file_id, 'building_id', capture.building_id, 'capture_type', capture.capture_type, 'title', capture.title, 'description', capture.description, 'location_label', capture.location_label, 'captured_at', capture.captured_at) order by capture.captured_at) from public.visual_captures capture where capture.project_id = v_report.project_id and capture.status = 'active' and (capture.day_report_id = v_report.id or capture.captured_at::date = v_report.report_date)), '[]'::jsonb),$new$
  );
  if v_patched = v_definition then
    raise exception 'build_day_report_snapshot no longer contains the expected report key';
  end if;
  execute v_patched;
end;
$patch$;
