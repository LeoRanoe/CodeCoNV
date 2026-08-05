-- The signing declaration on a formal report is signed, not ticked.
--
-- The record forms now capture the signature somebody actually writes. The formal daily
-- report was the last document that recorded only a name, a role and a typed declaration,
-- so a signed revision could not show a signature at all. This adds the written signature
-- to the append-only signature row, and a signing function that accepts it.
--
-- The five-argument function stays exactly as it was, so an app that has not been
-- deployed yet keeps working against this database.

alter table public.report_signatures
  add column if not exists signature_image text
  check (signature_image is null or char_length(signature_image) between 40 and 200000);

comment on column public.report_signatures.signature_image is
  'The signature the signer wrote in the app, as a small PNG data URL. Append-only, like the row itself.';

create or replace function public.sign_report_version(
  p_day_report_id uuid,
  p_signer_role text,
  p_signer_name text,
  p_declaration text,
  p_legal_level text,
  p_signature_image text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_report public.day_reports;
  v_version public.report_versions;
  v_signature public.report_signatures;
  v_required integer;
  v_signed integer;
  v_image text := nullif(btrim(coalesce(p_signature_image, '')), '');
begin
  if v_image is not null and v_image !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' then
    raise exception 'A written signature must be an inline image' using errcode = '22023';
  end if;
  select report.* into v_report from public.day_reports report where report.id = p_day_report_id for update;
  if not found or v_report.status not in ('approved','signed')
    or not app_private.has_project_permission(v_report.project_id, 'reports.sign') then
    raise exception 'Report is not available for signing' using errcode = '42501';
  end if;
  if not app_private.has_organization_permission(v_report.organization_id, 'organization.manage') and not exists (
    select 1 from public.project_memberships membership
    join public.project_member_roles member_role on member_role.membership_id = membership.id
    join public.roles role on role.id = member_role.role_id
    where membership.project_id = v_report.project_id and membership.user_id = v_actor
      and membership.status = 'active' and role.code = p_signer_role
  ) then
    raise exception 'Signer role does not match the authenticated project role' using errcode = '42501';
  end if;
  select version.* into v_version from public.report_versions version
    where version.day_report_id = v_report.id order by version.revision desc limit 1;
  if not found then raise exception 'Frozen report version is required' using errcode = '23514'; end if;
  insert into public.report_signatures (
    organization_id, project_id, day_report_id, report_version_id,
    signer_user_id, signer_name, signer_role, declaration, legal_level,
    signature_image, created_by
  ) values (
    v_report.organization_id, v_report.project_id, v_report.id, v_version.id,
    v_actor, trim(p_signer_name), p_signer_role, trim(p_declaration),
    p_legal_level, v_image, v_actor
  ) on conflict (report_version_id, signer_user_id, signer_role) do nothing
  returning * into v_signature;
  select count(*) into v_required
  from public.project_settings settings,
    jsonb_array_elements(settings.signing_workflow) rule
  where settings.project_id = v_report.project_id and coalesce((rule ->> 'required')::boolean, false);
  select count(distinct rule ->> 'role') into v_signed
  from public.project_settings settings,
    jsonb_array_elements(settings.signing_workflow) rule
  where settings.project_id = v_report.project_id and coalesce((rule ->> 'required')::boolean, false)
    and exists (select 1 from public.report_signatures signature where signature.report_version_id = v_version.id and signature.signer_role = rule ->> 'role');
  if v_required > 0 and v_signed = v_required and v_report.status = 'approved' then
    update public.day_reports set status = 'signed' where id = v_report.id returning * into v_report;
  end if;
  return jsonb_build_object('report', to_jsonb(v_report), 'version', to_jsonb(v_version), 'signature', to_jsonb(v_signature), 'required', v_required, 'signed', v_signed);
end;
$$;

revoke all on function public.sign_report_version(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.sign_report_version(uuid,text,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
