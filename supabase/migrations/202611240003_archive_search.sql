-- F04/F11 (client-spec audit): Submitted Forms reads the archive page by page from the server.
--
-- public.search_project_archive returns one page of the project's submitted forms (NCRs, issues,
-- inspections, HSE observations and incidents, every register form, Workforce per day report and
-- building, day reports and day logs) with the archive's filters applied in the database, newest
-- first, with a stable keyset cursor (at, id) and the total number of matches. It runs as the
-- caller (security invoker), so row-level security decides what each user can see: the archive
-- never lists a record the user could not open.
-- The Records & Photos screen uses it when online and falls back to the cached snapshot offline.

create or replace function public.search_project_archive(
  p_project_id uuid,
  p_query text default null,
  p_kind text default null,
  p_status text default null,
  p_building_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_discipline text default null,
  p_party_id uuid default null,
  p_responsible text default null,
  p_linked_action boolean default null,
  p_before_at timestamptz default null,
  p_before_id text default null,
  p_limit integer default 100
)
returns table (
  kind text,
  form_type text,
  record_id text,
  code text,
  title text,
  status text,
  at timestamptz,
  building_ids uuid[],
  discipline text,
  party_id uuid,
  responsible text,
  has_action boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with buildings as (
    select rb.record_type, rb.record_id, array_agg(distinct rb.building_id) as ids
    from public.record_buildings rb where rb.project_id = p_project_id group by rb.record_type, rb.record_id
  ),
  sourced as (
    select distinct a.source_id from public.actions a where a.project_id = p_project_id and a.source_id is not null
  ),
  spec_records as (
    select case when f.finding_type = 'ncr' then 'ncr' else 'finding' end as kind,
      case when f.finding_type = 'ncr' then 'ncr' else 'finding' end as form_type,
      f.id::text as record_id, f.finding_number as code, f.title, f.status, f.created_at as at,
      coalesce(b.ids, case when f.building_id is null then '{}'::uuid[] else array[f.building_id] end) as building_ids,
      f.issue_management -> 'spec' as spec, (to_jsonb(f) ->> 'responsible_party_id')::uuid as party_id
    from public.findings f left join buildings b on b.record_type = 'finding' and b.record_id = f.id
    where f.project_id = p_project_id
    union all
    select 'inspection', 'inspection', i.id::text, i.inspection_number, i.title, i.status, coalesce(i.completed_at, i.started_at, i.planned_at, i.created_at),
      coalesce(b.ids, case when i.building_id is null then '{}'::uuid[] else array[i.building_id] end), i.spec, null::uuid
    from public.inspections i left join buildings b on b.record_type = 'inspection' and b.record_id = i.id
    where i.project_id = p_project_id
    union all
    select 'hse', case when h.event_type in ('incident', 'near_miss') then 'hse:incident' else 'hse:observation' end,
      h.id::text, h.event_number, h.title, h.status, coalesce(h.occurred_at, h.created_at),
      coalesce(b.ids, case when h.building_id is null then '{}'::uuid[] else array[h.building_id] end), h.spec, (to_jsonb(h) ->> 'responsible_party_id')::uuid
    from public.hse_events h left join buildings b on b.record_type = 'hse' and b.record_id = h.id
    where h.project_id = p_project_id
    union all
    select 'register', 'register:' || r.register_type, r.id::text, r.entry_number, r.title, r.status, coalesce(r.occurred_at, r.created_at),
      coalesce(b.ids, case when r.building_id is null then '{}'::uuid[] else array[r.building_id] end), r.details -> 'spec', (to_jsonb(r) ->> 'responsible_party_id')::uuid
    from public.project_register_entries r left join buildings b on b.record_type = 'register_entry' and b.record_id = r.id
    where r.project_id = p_project_id
  ),
  workforce as (
    -- Workspace page 03: one archive entry per day report and building.
    select 'workforce' as kind, 'workforce' as form_type,
      coalesce(e.day_report_id::text, '') || ':' || coalesce(e.building_id::text, '') as record_id,
      coalesce(d.report_number, '') as code, trim('Workforce ' || coalesce(d.report_date::text, '')) as title,
      case when bool_or(e.signed_by is not null) then 'signed' else 'recorded' end as status,
      coalesce(d.report_date::timestamptz, max(e.created_at)) as at,
      case when e.building_id is null then '{}'::uuid[] else array[e.building_id] end as building_ids,
      null::jsonb as spec,
      case when count(distinct e.party_id) = 1 then (array_agg(e.party_id))[1] end as party_id
    from public.attendance_entries e left join public.day_reports d on d.id = e.day_report_id
    where e.project_id = p_project_id and coalesce(to_jsonb(e) ->> 'entry_type', '') <> 'visitor'
    group by e.day_report_id, e.building_id, d.report_number, d.report_date
  ),
  days as (
    select 'report', 'report', d.id::text, d.report_number, d.report_date::text, d.status, d.report_date::timestamptz, '{}'::uuid[], null::jsonb, null::uuid
    from public.day_reports d where d.project_id = p_project_id
    union all
    select case when coalesce(c.delay_hours, 0) > 0 then 'delay' else 'daily_work' end, case when coalesce(c.delay_hours, 0) > 0 then 'delay' else 'daily_work' end,
      c.id::text, '', coalesce(nullif(c.day_summary, ''), c.work_performed, ''), case when coalesce(c.delay_hours, 0) > 0 then 'delayed' else 'recorded' end, c.created_at,
      case when c.building_id is null then '{}'::uuid[] else array[c.building_id] end, null::jsonb, null::uuid
    from public.day_closeouts c where c.project_id = p_project_id
  ),
  everything as (
    select s.kind, s.form_type, s.record_id, coalesce(s.code, '') as code, coalesce(s.title, '') as title, coalesce(s.status, '') as status, s.at, s.building_ids,
      nullif(btrim(s.spec ->> 'discipline'), '') as discipline, s.party_id,
      coalesce(nullif(btrim(s.spec ->> 'responsible_person'), ''), nullif(btrim(s.spec ->> 'responsible_name'), ''), nullif(btrim(s.spec ->> 'action_owner'), ''),
        nullif(btrim(s.spec ->> 'owner'), ''), nullif(btrim(s.spec ->> 'responsible_party'), ''), '') as responsible
    from spec_records s
    union all
    select w.kind, w.form_type, w.record_id, w.code, w.title, w.status, w.at, w.building_ids, null, w.party_id, '' from workforce w
    union all
    select x.kind, x.form_type, x.record_id, coalesce(x.code, ''), coalesce(x.title, ''), coalesce(x.status, ''), x.at, x.building_ids, null, x.party_id, ''
    from days x(kind, form_type, record_id, code, title, status, at, building_ids, spec, party_id)
  ),
  matched as (
    select e.*, (e.record_id in (select source_id::text from sourced)) as has_action
    from everything e
    where (p_kind is null or e.form_type = p_kind or e.kind = p_kind)
      and (p_status is null or e.status = p_status)
      and (p_building_id is null or p_building_id = any (e.building_ids))
      and (p_from is null or (e.at at time zone 'America/Paramaribo')::date >= p_from)
      and (p_to is null or (e.at at time zone 'America/Paramaribo')::date <= p_to)
      and (p_discipline is null or e.discipline = p_discipline)
      and (p_party_id is null or e.party_id = p_party_id)
      and (nullif(btrim(p_responsible), '') is null or e.responsible ilike '%' || btrim(p_responsible) || '%')
      and (nullif(btrim(p_query), '') is null
        or e.code ilike '%' || btrim(p_query) || '%' or e.title ilike '%' || btrim(p_query) || '%'
        or regexp_replace(upper(e.code), '[^A-Z0-9]', '', 'g') like '%' || regexp_replace(upper(btrim(p_query)), '[^A-Z0-9]', '', 'g') || '%')
  ),
  filtered as (
    select m.*, count(*) over () as total_count from matched m
    where p_linked_action is null or m.has_action = p_linked_action
  )
  select f.kind, f.form_type, f.record_id, f.code, f.title, f.status, f.at, f.building_ids, f.discipline, f.party_id, f.responsible, f.has_action, f.total_count
  from filtered f
  where p_before_at is null or (f.at, f.record_id) < (p_before_at, coalesce(p_before_id, ''))
  order by f.at desc nulls last, f.record_id desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.search_project_archive(uuid, text, text, text, uuid, date, date, text, uuid, text, boolean, timestamptz, text, integer) from public, anon;
grant execute on function public.search_project_archive(uuid, text, text, text, uuid, date, date, text, uuid, text, boolean, timestamptz, text, integer) to authenticated;
