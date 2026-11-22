-- Decision #3 (21-11-2026; Word 16 and 20 item 8, Photos workbook row 8 "retain original file"):
-- every project accepts files up to 100 MB (the ceiling the upload route already enforces), so a
-- 360 degree source, a HEIC original or a large drawing set is stored untouched instead of being
-- reduced or refused. Projects still on the old 25 MB default move to 100 MB; a project that chose
-- another limit keeps it.
alter table public.project_settings alter column max_file_size_mb set default 100;
update public.project_settings set max_file_size_mb = 100 where max_file_size_mb = 25;
