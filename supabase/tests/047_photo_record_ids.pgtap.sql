begin;
set local search_path = extensions, pgtap, public;

set local client_min_messages = warning;
truncate public.organizations, auth.users cascade;
set local client_min_messages = notice;

-- Developer package v5: a photo has a Record ID, <PROJECT>-PH-<YYYY>-<NNNN>, one sequence per project and year,
-- assigned by the database, unique per project and never changed.
select plan(11);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000047a1', 'authenticated', 'authenticated', 'admin47@example.test', now(), now());

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000047a1","role":"authenticated"}';
set local role authenticated;
select public.bootstrap_organization('Photo Org 47', 'photo-org-47', 'Ada Admin');
select public.create_project_workspace((select id from public.organizations where slug = 'photo-org-47'),
  'P47', 'Photo project one', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
select public.create_project_workspace((select id from public.organizations where slug = 'photo-org-47'),
  'Q47', 'Photo project two', 'Paramaribo', 'Client', 'B1', 'Building 1', 'Contractor');
reset role;
set local request.jwt.claims = '{}';

create temporary table ids on commit drop as
select project.id as project_id, project.code, project.organization_id,
  (select building.id from public.buildings building where building.project_id = project.id limit 1) as building_id
from public.projects project where project.code in ('P47', 'Q47');

create or replace function pg_temp.add_photo(p_code text, p_label text, p_number text default null)
returns text
language plpgsql
as $$
declare
  v_ids ids;
  v_file uuid;
  v_number text;
begin
  select * into v_ids from ids where code = p_code;
  insert into public.files (organization_id, project_id, building_id, storage_object_key, original_name, mime_type, size_bytes, sha256, status, category, created_by)
  values (v_ids.organization_id, v_ids.project_id, v_ids.building_id, 'projects/test/' || p_label, p_label || '.jpg', 'image/jpeg', 1000, md5(p_label) || md5(p_label), 'available', 'photo', '00000000-0000-0000-0000-0000000047a1')
  returning id into v_file;
  insert into public.visual_captures (organization_id, project_id, building_id, file_id, capture_type, title, location_label, created_by, capture_number)
  values (v_ids.organization_id, v_ids.project_id, v_ids.building_id, v_file, 'photo', 'Photo ' || p_label, 'Building 1', '00000000-0000-0000-0000-0000000047a1', p_number)
  returning capture_number into v_number;
  return v_number;
end;
$$;

create temporary table made (label text, number text) on commit drop;
insert into made values
  ('p1', pg_temp.add_photo('P47', 'one')),
  ('p2', pg_temp.add_photo('P47', 'two')),
  ('q1', pg_temp.add_photo('Q47', 'three'));

select is((select number from made where label = 'p1'),
  'P47-PH-' || to_char(timezone('America/Paramaribo', now()), 'YYYY') || '-0001', 'the first photo of a project is numbered 0001');
select is((select number from made where label = 'p2'),
  'P47-PH-' || to_char(timezone('America/Paramaribo', now()), 'YYYY') || '-0002', 'the second photo continues the sequence');
select is((select number from made where label = 'q1'),
  'Q47-PH-' || to_char(timezone('America/Paramaribo', now()), 'YYYY') || '-0001', 'another project has its own sequence');
select matches((select number from made where label = 'p1'), '^[A-Z0-9]+-PH-[0-9]{4}-[0-9]{4}$', 'the number has the v5 shape');

-- A deleted gap is never reused: the next number follows the highest.
delete from public.visual_captures where capture_number like 'P47-PH-%-0001';
select is(pg_temp.add_photo('P47', 'four'),
  'P47-PH-' || to_char(timezone('America/Paramaribo', now()), 'YYYY') || '-0003', 'a number is not reused after the photo is removed');

-- A supplied number (a restore) is kept and still unique per project.
select is(pg_temp.add_photo('Q47', 'five', 'Q47-PH-2025-0099'), 'Q47-PH-2025-0099', 'a number that was supplied is kept');
select throws_ok($$select pg_temp.add_photo('Q47', 'six', 'Q47-PH-2025-0099')$$, '23505', null, 'a number is unique per project');

-- The number does not change afterwards.
select throws_ok(
  $$update public.visual_captures set capture_number = 'P47-PH-2030-0001' where capture_number like 'P47-PH-%-0002'$$,
  '22023', 'The record ID of a photo does not change', 'the record ID cannot be edited');
select lives_ok($$update public.visual_captures set title = 'Renamed photo' where capture_number like 'P47-PH-%-0002'$$, 'the rest of the photo can still be edited');

-- Every stored photo of the migration has a number and the index is unique.
select is((select count(*)::integer from public.visual_captures where capture_number is null), 0, 'no photo is left without a number');
select ok(exists (select 1 from pg_indexes where indexname = 'visual_captures_capture_number_key'), 'the number is unique per project');

select * from finish();
rollback;
