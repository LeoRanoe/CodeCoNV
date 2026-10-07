-- 202607180011 made report signing a SECURITY DEFINER routine and revoked direct INSERT on
-- report_signatures from signed-in users: the register is append-only and only reachable
-- through the checked routine. 202608040002 then added the six-argument overload (with the
-- written signature image) as SECURITY INVOKER, so every signature failed with
-- "permission denied for table report_signatures" — in production as well, where no report
-- has been signed yet.
--
-- The overload goes back to the intended model. Nothing is loosened: the routine still
-- requires reports.sign and the matching project role, and the report_signatures insert
-- trigger independently checks that the signer is the authenticated user, holds the role
-- and signs the latest frozen version.

begin;

alter function public.sign_report_version(uuid, text, text, text, text, text) security definer;

revoke all on function public.sign_report_version(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.sign_report_version(uuid, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
