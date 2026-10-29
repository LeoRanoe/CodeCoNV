-- QA sweep 2026-10-28, L14. Every member of a project could read the name, telephone number and
-- language of every other member, the contractor and the client included. The app never reads
-- the telephone number; names are what the screens show ("Opgemaakt door", responsible person).
-- Reading the phone column is taken away from signed-in users; server routes use the service role.
revoke select on public.profiles from authenticated;
grant select (id, display_name, locale, created_at, updated_at, version) on public.profiles to authenticated;
