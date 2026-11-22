begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Word 14 / WD-192: the trigger that notifies an inspection's executor. Self-contained fixture; everything rolls back.
select plan(10);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000041a1', 'authenticated', 'authenticated', 'admin41@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000041b2', 'authenticated', 'authenticated', 'super41@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000041c1', 'authenticated', 'authenticated', 'cont41@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000041b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000041c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000041a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Notify Org 41', 'notify-org-41', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'notify-org-41'),
  'NT-41', 'Notify project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id,
  (select template.id from public.checklist_templates template where template.module = 'inspection' and template.status = 'published'
     and template.organization_id = project.organization_id and (template.project_id is null or template.project_id = project.id) limit 1) as template_id
from public.projects project where project.code = 'NT-41';
grant select on ids to authenticated;

insert into public.project_memberships (organization_id, project_id, user_id, status)
select ids.organization_id, ids.project_id, member.id, 'active'
from ids, (values ('00000000-0000-0000-0000-0000000041b2'::uuid), ('00000000-0000-0000-0000-0000000041c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id when '00000000-0000-0000-0000-0000000041b2' then 'supervisor' else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

-- The administrator plans an inspection for the supervisor.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000041a1","role":"authenticated"}';
set local role authenticated;
create temporary table planned (id uuid);
grant all on planned to authenticated;
insert into planned select (p).id from (select public.plan_project_inspection((select project_id from ids), (select building_id from ids), (select template_id from ids),
  'Notify test', '2027-05-01T12:00:00Z', '00000000-0000-0000-0000-0000000041b2', 'notify-key-41-0001') as p) planned_row;
reset role;
set local request.jwt.claims = '{}';

create function pg_temp.sent() returns integer language sql as $$
  select count(*)::integer from public.notifications
  where notification_type = 'inspection_scheduled' and source_id = (select id from planned)
    and recipient_user_id = '00000000-0000-0000-0000-0000000041b2'
$$;

select is(pg_temp.sent(), 1, 'planning an inspection notifies its executor once');

update public.inspections set planned_at = '2027-05-02T12:00:00Z' where id = (select id from planned);
select is(pg_temp.sent(), 2, 'moving it to time B notifies once more');
update public.inspections set planned_at = '2027-05-01T12:00:00Z' where id = (select id from planned);
select is(pg_temp.sent(), 3, 'moving it back to time A notifies again (A to B to A is two changes)');
update public.inspections set planned_at = planned_at where id = (select id from planned);
select is(pg_temp.sent(), 3, 'a save with nothing changed sends nothing');
update public.inspections set title = 'Notify test (renamed)' where id = (select id from planned);
select is(pg_temp.sent(), 3, 'a change that is not about who, when or status sends nothing');
update public.inspections set status = 'in_progress' where id = (select id from planned);
select is(pg_temp.sent(), 4, 'a status change notifies the executor');

-- The executor changing their own inspection does not notify themselves.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000041b2","role":"authenticated"}';
set local role authenticated;
select lives_ok($$update public.inspections set planned_at = '2027-05-03T12:00:00Z' where id = (select id from planned)$$, 'the executor can move their own inspection');
reset role;
set local request.jwt.claims = '{}';
select is(pg_temp.sent(), 4, 'the executor is not notified of their own change');

-- A contractor cannot change it, and a refused change sends nothing.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000041c1","role":"authenticated"}';
set local role authenticated;
update public.inspections set planned_at = '2027-05-09T12:00:00Z' where id = (select id from planned);
reset role;
set local request.jwt.claims = '{}';
select is((select planned_at::text from public.inspections where id = (select id from planned)), '2027-05-03 12:00:00+00', 'a contractor cannot move it');
select is(pg_temp.sent(), 4, 'the refused change sent nothing');

select * from finish();
rollback;
