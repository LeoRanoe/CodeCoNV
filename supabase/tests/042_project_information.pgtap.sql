begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Word 13 / WD-181-02: Project information (client, site address, dates, currency, status) is
-- editable by a role with project.configure and by nobody else; bad values are refused.
select plan(11);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000042a1', 'authenticated', 'authenticated', 'admin42@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000042b2', 'authenticated', 'authenticated', 'super42@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000042c1', 'authenticated', 'authenticated', 'cont42@example.test', now(), now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-0000000042b2', 'Sam Supervisor'),
  ('00000000-0000-0000-0000-0000000042c1', 'Alex Contractor')
on conflict (id) do update set display_name = excluded.display_name;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000042a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Info Org 42', 'info-org-42', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'info-org-42'),
  'IN-42', 'Information project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.organization_id from public.projects project where project.code = 'IN-42';
grant select on ids to authenticated;

insert into public.project_memberships (organization_id, project_id, user_id, status)
select ids.organization_id, ids.project_id, member.id, 'active'
from ids, (values ('00000000-0000-0000-0000-0000000042b2'::uuid), ('00000000-0000-0000-0000-0000000042c1'::uuid)) member(id);
insert into public.project_member_roles (organization_id, project_id, membership_id, role_id)
select membership.organization_id, membership.project_id, membership.id, role.id
from public.project_memberships membership
join public.roles role on role.organization_id = membership.organization_id and role.scope = 'project'
  and role.code = case membership.user_id when '00000000-0000-0000-0000-0000000042b2' then 'supervisor' else 'contractor_representative' end
where membership.project_id = (select project_id from ids);

-- An administrator saves the project information.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000042a1","role":"authenticated"}';
set local role authenticated;
create temporary table saved (n integer);
grant all on saved to authenticated;
with changed as (
  update public.projects set client_name = '  Ministerie van Openbare Werken ', location = 'Gravenstraat 12, Paramaribo',
    start_date = '2027-01-11', end_date = '2027-12-17', currency = ' srd ', status = 'on_hold'
  where id = (select project_id from ids) returning 1)
insert into saved select count(*) from changed;
select is((select n from saved), 1, 'an administrator can change the project information');
select is((select client_name || '|' || location || '|' || start_date || '|' || end_date || '|' || currency || '|' || status from public.projects where id = (select project_id from ids)),
  'Ministerie van Openbare Werken|Gravenstraat 12, Paramaribo|2027-01-11|2027-12-17|SRD|on_hold',
  'the values are stored trimmed, the currency in capitals');
select is((select version from public.projects where id = (select project_id from ids)) > 1, true, 'the save raises the version');
select throws_ok($$update public.projects set end_date = '2026-12-31' where id = (select project_id from ids)$$, '23514', null, 'a completion date before the start date is refused');
select throws_ok($$update public.projects set currency = 'US' where id = (select project_id from ids)$$, '23514', null, 'a currency that is not a three-letter code is refused');
select throws_ok($$update public.projects set timezone = 'Mars/Olympus' where id = (select project_id from ids)$$, '22023', null, 'an unknown time zone is refused');
select throws_ok($$update public.projects set status = 'finished' where id = (select project_id from ids)$$, '23514', null, 'a status outside the project statuses is refused');
reset role;

-- A supervisor and a contractor cannot change it: the update touches no row.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000042b2","role":"authenticated"}';
set local role authenticated;
delete from saved;
with changed as (update public.projects set client_name = 'Changed by supervisor' where id = (select project_id from ids) returning 1)
insert into saved select count(*) from changed;
select is((select n from saved), 0, 'a supervisor cannot change the project information');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000042c1","role":"authenticated"}';
set local role authenticated;
delete from saved;
with changed as (update public.projects set currency = 'USD' where id = (select project_id from ids) returning 1)
insert into saved select count(*) from changed;
select is((select n from saved), 0, 'a contractor cannot change the project information');
reset role;
select is((select client_name || '|' || currency from public.projects where id = (select project_id from ids)), 'Ministerie van Openbare Werken|SRD', 'the stored values are unchanged by the refused saves');
select is((select count(*)::integer from public.audit_events where table_name = 'projects' and record_id = (select project_id from ids) and operation = 'UPDATE') >= 1, true, 'the change is in the audit log');

select * from finish();
rollback;
