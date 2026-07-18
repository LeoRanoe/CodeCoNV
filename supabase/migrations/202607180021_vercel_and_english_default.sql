begin;

alter table public.project_settings
  alter column default_language set default 'en';

update public.project_settings
set default_language = 'en',
    modules = modules || '{"visual_evidence":true}'::jsonb
where default_language = 'nl-SR'
   or not (modules ? 'visual_evidence');

alter table public.project_settings
  alter column modules set default '{"attendance":true,"inspections":true,"quality":true,"hse":true,"actions":true,"documents":true,"visual_evidence":true}'::jsonb;

create or replace function app_private.seed_vercel_readiness_items(p_organization_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.production_readiness_items (
    organization_id, code, category, title, description, owner_hint, blocking, sort_order
  )
  values
    (p_organization_id,'ACC-VERCEL','accounts','Vercel onder CODECO-beheer','Importeer de Git-repository in een CODECO-beheerd Vercel-team. Wijs een primaire en back-upbeheerder aan, activeer MFA en leg facturatie en herstelcontact vast.','CODECO IT',true,35),
    (p_organization_id,'CFG-VERCEL-DEPLOY','configuration','Vercel-productieomgeving en domein','Stel apps/web in als Root Directory, gebruik Node.js 22, configureer alle productie-environmentvariabelen, koppel het definitieve domein en werk Supabase redirect-URL en gateway-origin bij.','Ontwikkelaar / CODECO IT',true,65)
  on conflict (organization_id, code) do nothing;
$$;

create or replace function app_private.initialize_production_readiness_items()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.seed_production_readiness_items(new.id);
  perform app_private.seed_vercel_readiness_items(new.id);
  return new;
end;
$$;

select app_private.seed_vercel_readiness_items(organization.id)
from public.organizations organization;

revoke all on function app_private.seed_vercel_readiness_items(uuid) from public, anon, authenticated;

commit;
