begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Word 14 / WD-192: planning and rescheduling an inspection for a colleague.
select plan(14);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000043a1', 'authenticated', 'authenticated', 'admin43@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000043b2', 'authenticated', 'authenticated', 'super43@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000043c1', 'authenticated', 'authenticated', 'cont43@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000043b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000043c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000043a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Plan Org 43', 'plan-org-43', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'plan-org-43'),
  'PL-43', 'Plan project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id,
  (select template.id from public.checklist_templates template where template.module = 'inspection' and template.status = 'published'
     and template.organization_id = project.organization_id and (template.project_id is null or template.project_id = project.id) limit 1) as template_id
from public.projects project where project.code = 'PL-43';
grant select on ids to authenticated;

insert into public.project_memberships (organization_id, project_id, user_id, status)
select ids.organization_id, ids.project_id, member.id, 'active'
from ids, (values ('00000000-0000-0000-0000-0000000043b2'::uuid), ('00000000-0000-0000-0000-0000000043c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id when '00000000-0000-0000-0000-0000000043b2' then 'supervisor' else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

select isnt((select template_id from ids), null, 'the project has a published inspection checklist');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000043a1","role":"authenticated"}';
set local role authenticated;
create temporary table planned (id uuid, status text, executed_by uuid);
grant all on planned to authenticated;
insert into planned select (p).id, (p).status, (p).executed_by from (select public.plan_project_inspection((select project_id from ids), (select building_id from ids), (select template_id from ids),
  'Planned for Sam', '2027-03-01T12:00:00Z', '00000000-0000-0000-0000-0000000043b2', 'plan-key-43-0001') as p) planned_row;
select is((select status from planned), 'planned', 'a planned inspection has status planned');
select is((select executed_by from planned), '00000000-0000-0000-0000-0000000043b2'::uuid, 'and the chosen executor');
select is((select count(*)::integer from public.list_inspection_executors((select project_id from ids))), 2, 'the executor list holds the people who can manage inspections (administrator and supervisor, not the contractor)');
-- The same key again returns the same inspection.
select is((select (public.plan_project_inspection((select project_id from ids), (select building_id from ids), (select template_id from ids),
  'Planned for Sam', '2027-03-01T12:00:00Z', '00000000-0000-0000-0000-0000000043b2', 'plan-key-43-0001')).id), (select id from planned), 'a repeated request returns the same inspection');
select throws_ok($$select public.plan_project_inspection((select project_id from ids), (select building_id from ids), (select template_id from ids),
  'For a contractor', '2027-03-01T12:00:00Z', '00000000-0000-0000-0000-0000000043c1', 'plan-key-43-0002')$$, '22023', null, 'an executor who cannot manage inspections is refused');
select throws_ok($$select public.plan_project_inspection((select project_id from ids), (select building_id from ids), (select template_id from ids),
  'No time', null, '00000000-0000-0000-0000-0000000043b2', 'plan-key-43-0003')$$, '22023', null, 'a planned time is required');
select is((select (public.reschedule_project_inspection((select id from planned), '2027-03-02T12:00:00Z', '00000000-0000-0000-0000-0000000043b2')).planned_at::text), '2027-03-02 12:00:00+00', 'a planned inspection can be moved');
reset role;
select is((select count(*)::integer from public.notifications where notification_type = 'inspection_scheduled' and source_id = (select id from planned)
  and recipient_user_id = '00000000-0000-0000-0000-0000000043b2'), 2, 'the executor is notified once when it is planned and once when it is moved');
select is((select count(*)::integer from public.notifications where notification_type = 'inspection_scheduled' and source_id = (select id from planned)
  and recipient_user_id = '00000000-0000-0000-0000-0000000043a1'), 0, 'the planner is not notified of their own changes');

-- A contractor cannot plan or move one.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000043c1","role":"authenticated"}';
set local role authenticated;
select throws_ok($$select public.reschedule_project_inspection((select id from planned), '2027-03-09T12:00:00Z', '00000000-0000-0000-0000-0000000043b2')$$, '42501', null, 'a contractor cannot reschedule an inspection');
select throws_ok($$select public.plan_project_inspection((select project_id from ids), (select building_id from ids), (select template_id from ids),
  'By a contractor', '2027-03-01T12:00:00Z', '00000000-0000-0000-0000-0000000043b2', 'plan-key-43-0004')$$, '42501', null, 'a contractor cannot plan an inspection');
reset role;
select is((select count(*)::integer from public.notifications where notification_type = 'inspection_scheduled' and source_id = (select id from planned)), 2, 'the refused calls sent nothing (planning and the one move)');

-- Returning to a previously used time is a new event, even if the same save is retried.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000043a1","role":"authenticated"}';
set local role authenticated;
select public.reschedule_project_inspection((select id from planned), '2027-03-01T12:00:00Z', '00000000-0000-0000-0000-0000000043b2');
select public.reschedule_project_inspection((select id from planned), '2027-03-01T12:00:00Z', '00000000-0000-0000-0000-0000000043b2');
reset role;
select is((select count(*)::integer from public.notifications where notification_type = 'inspection_scheduled' and source_id = (select id from planned)
  and recipient_user_id = '00000000-0000-0000-0000-0000000043b2'), 3, 'returning to the original time sends exactly one new notification');

select * from finish();
rollback;
