begin;
set local search_path = extensions, pgtap, public;

-- Isolation: only the first organization can be created without an administrator, so the file
-- starts from an empty tenant table; the rollback at the end puts any existing data back.
set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Client feedback 30-10-2026: Works ongoing is one input box. A closeout must therefore be
-- storable with only that text, and the upper limits must still hold.
select plan(7);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000025a1', 'authenticated', 'authenticated', 'one-field@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000025a1","role":"authenticated"}';

insert into public.organizations (id, name, slug, created_by)
values ('00000000-0000-0000-0000-0000000025a2', 'One Field Org', 'one-field-org', auth.uid());
insert into public.organization_memberships (organization_id, user_id, status)
values ('00000000-0000-0000-0000-0000000025a2', auth.uid(), 'active');
insert into public.roles (id, organization_id, scope, code, name, is_system, created_by)
values ('00000000-0000-0000-0000-0000000025a3', '00000000-0000-0000-0000-0000000025a2', 'project', 'supervisor', 'Supervisor', true, auth.uid());
insert into public.role_permissions (organization_id, role_id, permission_code)
select '00000000-0000-0000-0000-0000000025a2', '00000000-0000-0000-0000-0000000025a3', code
from public.permissions
on conflict do nothing;
insert into public.projects (id, organization_id, code, name, location, created_by)
values ('00000000-0000-0000-0000-0000000025a4', '00000000-0000-0000-0000-0000000025a2', 'COD-ONE-01', 'One field project', 'Paramaribo', auth.uid());
insert into public.project_memberships (id, organization_id, project_id, user_id)
values ('00000000-0000-0000-0000-0000000025a5', '00000000-0000-0000-0000-0000000025a2', '00000000-0000-0000-0000-0000000025a4', auth.uid());
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
values ('00000000-0000-0000-0000-0000000025a2', '00000000-0000-0000-0000-0000000025a4', '00000000-0000-0000-0000-0000000025a5', '00000000-0000-0000-0000-0000000025a3');
insert into public.buildings (id, organization_id, project_id, code, name, description, created_by)
values ('00000000-0000-0000-0000-0000000025a6', '00000000-0000-0000-0000-0000000025a2', '00000000-0000-0000-0000-0000000025a4', 'MAIN', 'Main building', 'Only building', auth.uid());
insert into public.day_reports (id, organization_id, project_id, report_date, report_number, idempotency_key, created_by)
values ('00000000-0000-0000-0000-0000000025a7', '00000000-0000-0000-0000-0000000025a2', '00000000-0000-0000-0000-0000000025a4', '2026-10-30', 'DR-20261030', 'one-field-report-20261030', auth.uid());

set local role authenticated;

select lives_ok(
  $$insert into public.day_closeouts (
      organization_id, project_id, building_id, day_report_id, day_summary, work_ongoing,
      weather_summary, work_performed, progress_percent, inspection_result,
      quality_issues, hse_event, variation_work_status, delay_cause, delay_hours,
      tomorrow_plan, photo_count, attachments_confirmed, idempotency_key, created_by
    ) values (
      '00000000-0000-0000-0000-0000000025a2', '00000000-0000-0000-0000-0000000025a4', '00000000-0000-0000-0000-0000000025a6', '00000000-0000-0000-0000-0000000025a7',
      'Kolommen blok B', 'Kolommen blok B',
      '', '', null, 'none',
      false, 'none', 'none', 'none', 0,
      '', 0, false, 'one-field-closeout-20261030', auth.uid())$$,
  'a closeout is stored with only the works-ongoing text: no weather, no work completed, no plan for tomorrow'
);
select is(
  (select work_ongoing from public.day_closeouts where idempotency_key = 'one-field-closeout-20261030'),
  'Kolommen blok B',
  'the works-ongoing text is what was saved'
);
select is(
  (select work_performed || '|' || tomorrow_plan || '|' || weather_summary from public.day_closeouts where idempotency_key = 'one-field-closeout-20261030'),
  '||',
  'the unanswered questions are stored as empty text, not as invented text'
);
select throws_ok(
  $$update public.day_closeouts set day_summary = 'ab' where idempotency_key = 'one-field-closeout-20261030'$$,
  '23514',
  null,
  'the works-ongoing text still needs at least three characters'
);
select throws_ok(
  $$update public.day_closeouts set work_performed = repeat('x', 1201) where idempotency_key = 'one-field-closeout-20261030'$$,
  '23514',
  null,
  'the upper limit of work completed still holds'
);
select throws_ok(
  $$update public.day_closeouts set tomorrow_plan = repeat('x', 1001) where idempotency_key = 'one-field-closeout-20261030'$$,
  '23514',
  null,
  'the upper limit of the plan for tomorrow still holds'
);
select throws_ok(
  $$update public.day_closeouts set weather_summary = repeat('x', 181) where idempotency_key = 'one-field-closeout-20261030'$$,
  '23514',
  null,
  'the upper limit of the weather line still holds'
);

select * from finish();
rollback;
