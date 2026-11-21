-- Supabase security advisor 0011 (function_search_path_mutable): four pure helper functions from
-- 202611210001 had no fixed search_path. They reference no tables, so pg_catalog is enough.
alter function app_private.spec_status_from_record(text, text) set search_path = pg_catalog;
alter function app_private.spec_path(text) set search_path = pg_catalog;
alter function app_private.spec_kind(text) set search_path = pg_catalog;
alter function app_private.spec_sensitive_key(text) set search_path = pg_catalog;
