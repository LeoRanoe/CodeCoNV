begin;

create or replace function public.build_day_report_snapshot(p_day_report_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare v_report public.day_reports;
begin
  select report.* into v_report from public.day_reports report where report.id = p_day_report_id;
  if not found then raise exception 'Day report not found or not accessible' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'schema_version', '202607180016',
    'frozen_at', now(),
    'report', to_jsonb(v_report),
    'project', (select to_jsonb(project) from public.projects project where project.id = v_report.project_id),
    'building', (
      select to_jsonb(building)
      from public.buildings building
      where building.id = (
        select start_check.building_id
        from public.day_start_checks start_check
        where start_check.day_report_id = v_report.id
      )
    ),
    'created_by_profile', (select jsonb_build_object('id', profile.id, 'display_name', profile.display_name) from public.profiles profile where profile.id = v_report.created_by),
    'start_check', (select to_jsonb(start_check) from public.day_start_checks start_check where start_check.day_report_id = v_report.id),
    'closeout', (select to_jsonb(closeout) from public.day_closeouts closeout where closeout.day_report_id = v_report.id),
    'attendance', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.attendance_entries entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'registrations', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.site_registrations entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.inspections entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.findings entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'hse_events', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.hse_events entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'register_entries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.occurred_at) from public.project_register_entries entry where entry.day_report_id = v_report.id), '[]'::jsonb),
    'open_actions', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.due_at nulls last) from public.actions entry where entry.project_id = v_report.project_id and entry.status not in ('verified','cancelled')), '[]'::jsonb),
    'file_manifest', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.created_at) from public.files entry where entry.project_id = v_report.project_id and entry.status <> 'deleted'), '[]'::jsonb)
  );
end;
$$;

commit;
