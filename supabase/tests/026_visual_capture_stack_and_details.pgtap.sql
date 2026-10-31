begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Photo stacks and photo descriptions are written through functions: signed-in users only read
-- visual_captures, and a direct update was refused (or matched no row) before 202610310001.
select plan(9);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000026a1', 'authenticated', 'authenticated', 'stack-admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000026a2', 'authenticated', 'authenticated', 'stack-outsider@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000026a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Stack Org', 'stack-org', 'Stack Admin');
select public.create_project_workspace(
  (select id from public.organizations where slug = 'stack-org'),
  'STK-26', 'Photo stack project', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor'
);

-- Two stored photos and their captures, as the storage service and create_visual_capture leave them.
reset role;
set local request.jwt.claims = '{"role":"service_role"}';
insert into public.files (id, organization_id, project_id, building_id, original_name, mime_type, size_bytes, status, category, created_by, storage_provider, storage_object_key, sha256)
select ('00000000-0000-0000-0000-00000000260' || n)::uuid, project.organization_id, project.id,
  (select id from public.buildings where project_id = project.id limit 1),
  'frame-' || n || '.jpg', 'image/jpeg', 1000, 'available', 'photo',
  '00000000-0000-0000-0000-0000000026a1', 'vercel_blob', 'projects/stack/frame-' || n, repeat('a', 64)
from public.projects project, generate_series(1, 2) n
where project.code = 'STK-26';
insert into public.visual_captures (id, organization_id, project_id, building_id, file_id, capture_type, title, location_label, created_by)
select ('00000000-0000-0000-0000-00000000261' || n)::uuid, file.organization_id, file.project_id, file.building_id, file.id, 'photo', 'Frame ' || n, 'Building 1', file.created_by
from public.files file, generate_series(1, 2) n
where file.id = ('00000000-0000-0000-0000-00000000260' || n)::uuid;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000026a1","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$update public.visual_captures set stack_id = gen_random_uuid() where id = '00000000-0000-0000-0000-000000002611' returning id$$,
  '42501',
  null,
  'a signed-in user still cannot update visual_captures directly'
);

select lives_ok(
  $$select public.set_visual_capture_stack('00000000-0000-0000-0000-000000002611', '00000000-0000-0000-0000-0000000026ff')$$,
  'a manager puts the first frame in a stack'
);
select lives_ok(
  $$select public.set_visual_capture_stack('00000000-0000-0000-0000-000000002612', '00000000-0000-0000-0000-0000000026ff', null, 'Scheur in kolom', 'Twee beelden van dezelfde scheur', '2026-10-31 10:00+00')$$,
  'a manager puts the second frame in the same stack with a shared title'
);
select is(
  (select count(*)::integer from public.visual_captures where stack_id = '00000000-0000-0000-0000-0000000026ff'),
  2,
  'both frames form one stack'
);
select is(
  (select title || ' / ' || description from public.visual_captures where id = '00000000-0000-0000-0000-000000002612'),
  'Scheur in kolom / Twee beelden van dezelfde scheur',
  'the shared title and description are stored'
);
select lives_ok(
  $$select public.update_visual_capture_details('00000000-0000-0000-0000-000000002611', '  Nieuwe titel  ', '')$$,
  'a manager edits the description of a stored photo'
);
select is(
  (select title || '|' || coalesce(description, '<null>') from public.visual_captures where id = '00000000-0000-0000-0000-000000002611'),
  'Nieuwe titel|<null>',
  'the title is trimmed and an empty description is cleared'
);
select throws_ok(
  $$select public.update_visual_capture_details('00000000-0000-0000-0000-000000002611', 'x', '')$$,
  '22023',
  'Title is required',
  'a title shorter than three characters is refused'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000026a2","role":"authenticated"}';
select throws_ok(
  $$select public.set_visual_capture_stack('00000000-0000-0000-0000-000000002611', gen_random_uuid())$$,
  'P0002',
  'Visual capture not found or not accessible',
  'someone outside the project cannot move a photo into a stack'
);

reset role;
select * from finish();
rollback;
