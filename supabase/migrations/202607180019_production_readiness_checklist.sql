begin;

create table public.production_readiness_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9-]{4,50}$'),
  category text not null check (category in ('accounts','configuration','operations','legal','acceptance')),
  title text not null check (char_length(title) between 5 and 180),
  description text not null check (char_length(description) between 10 and 1000),
  owner_hint text not null check (char_length(owner_hint) between 2 and 120),
  blocking boolean not null default true,
  status text not null default 'todo' check (status in ('todo','in_progress','done','not_applicable')),
  evidence text check (evidence is null or char_length(evidence) between 5 and 1000),
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (organization_id, code),
  check (
    (status in ('done','not_applicable') and completed_by is not null and completed_at is not null and evidence is not null)
    or (status in ('todo','in_progress') and completed_by is null and completed_at is null)
  )
);

create index production_readiness_items_org_status_idx
  on public.production_readiness_items (organization_id, blocking, status, sort_order);

alter table public.production_readiness_items enable row level security;

create policy production_readiness_items_select on public.production_readiness_items
  for select to authenticated
  using (app_private.is_organization_member(organization_id));

grant select on public.production_readiness_items to authenticated;

create trigger production_readiness_items_touch before update on public.production_readiness_items
  for each row execute function app_private.touch_versioned_row();
create trigger production_readiness_items_audit after insert or update or delete on public.production_readiness_items
  for each row execute function app_private.capture_audit_event();

create or replace function app_private.seed_production_readiness_items(p_organization_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.production_readiness_items (
    organization_id, code, category, title, description, owner_hint, blocking, sort_order
  )
  select p_organization_id, item.code, item.category, item.title, item.description, item.owner_hint, item.blocking, item.sort_order
  from (values
    ('ACC-CODECO-OWNERS','accounts','CODECO-eigenaar en back-upbeheerder','Maak minimaal twee persoonlijke CODECO-beheeraccounts aan. Gebruik geen gedeeld account; beide beheerders activeren MFA en bewaren herstelcodes afzonderlijk.','CODECO directie / IT',true,10),
    ('ACC-SUPABASE','accounts','Supabase onder CODECO-beheer','Nodig een CODECO-zakelijk eigenaar en back-upbeheerder uit voor het productieproject, activeer MFA en leg facturatie- en herstelcontact vast.','CODECO IT',true,20),
    ('ACC-CLOUDFLARE','accounts','Cloudflare Worker-account','Gebruik een CODECO-beheerd Cloudflare-account met primaire en back-upbeheerder voor de private Drive-gateway.','CODECO IT',true,30),
    ('ACC-GOOGLE-STORAGE','accounts','Dedicated Google-opslagaccount','Maak één niet-persoonlijk CODECO Google-account uitsluitend voor applicatiebestanden en back-ups; activeer MFA, herstelmail en hersteltelefoon.','CODECO IT',true,40),
    ('CFG-GOOGLE-OAUTH','configuration','Google Cloud en Drive OAuth','Maak een CODECO Google Cloud-project, activeer Drive API en configureer een OAuth-client met uitsluitend drive.file en de vastgestelde redirect-URL.','CODECO IT / ontwikkelaar',true,50),
    ('CFG-GATEWAY-SECRETS','configuration','Drive-gateway publiceren','Plaats Supabase-, Google OAuth- en uploadsessie-secrets in Cloudflare Worker secrets, publiceer de gateway en configureer de gateway-URL in de webapp.','Ontwikkelaar / CODECO IT',true,60),
    ('CFG-SMTP','configuration','Productie e-mail en SMTP','Koppel een CODECO-afzenderdomein en productie-SMTP voor uitnodigingen, wachtwoordherstel en beveiligingsmeldingen; controleer SPF, DKIM en DMARC.','CODECO IT',true,70),
    ('ACC-INTERNAL-USERS','accounts','Interne gebruikers en rollen','Maak persoonlijke accounts voor primaire/back-upadmin, projectleider, lead supervisor, supervisors en Kwaliteit/HSE. Test opschorten en intrekken met een niet-productieaccount.','Organisatiebeheerder',true,80),
    ('OPS-DRIVE-QUOTA','operations','Drive-quota en limietwaarschuwing','Controleer actuele Drive-opslag, test de quotameter en leg vast wie reageert bij 80 procent gebruik.','CODECO IT',true,90),
    ('OPS-BACKUP-RESTORE','operations','Dagelijkse back-up en herstelproef','Activeer de dagelijkse JSON-back-up, download een geverifieerde kopie buiten het opslagaccount en voer een aantoonbare restore-dry-run uit.','Back-upbeheerder',true,100),
    ('LEGAL-PRODUCT-RULES','legal','Formulieren, retentie en ondertekening','CODECO keurt definitieve dagrapport-, inspectie-, HSE- en NCR-formulieren, bewaartermijnen, externe zichtbaarheid en juridisch ondertekenniveau schriftelijk goed.','CODECO directie / contractbeheer',true,110),
    ('CFG-BRANDING','configuration','Productnaam en huisstijl','Bevestig officiële productnaam, logo, kleuren en rapportvoettekst voor de formele productie-uitvoer.','CODECO directie',false,120),
    ('ACCEPT-UAT','acceptance','Gebruikersacceptatietest op locatie','Voer met minimaal één projectleider en twee supervisors een volledige werkdag uit: start, inspectie, bevinding, HSE, rapport, review, PDF en revisie.','CODECO projectteam',true,130),
    ('OPS-GOLIVE-OWNER','operations','Go-live eigenaar en incidentroute','Leg een eigenaar, vervanger, supportcontact en procedure vast voor accountverlies, datalek, storing, quota-alarm en herstel.','CODECO directie / IT',true,140)
  ) as item(code,category,title,description,owner_hint,blocking,sort_order)
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
  return new;
end;
$$;

create trigger organizations_initialize_production_readiness
  after insert on public.organizations
  for each row execute function app_private.initialize_production_readiness_items();

select app_private.seed_production_readiness_items(organization.id)
from public.organizations organization;

create or replace function public.update_production_readiness_item(
  p_item_id uuid,
  p_status text,
  p_evidence text
)
returns public.production_readiness_items
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.production_readiness_items;
  v_evidence text := nullif(btrim(p_evidence), '');
begin
  select item.* into v_item
  from public.production_readiness_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception 'Readiness item not found' using errcode = 'P0002';
  end if;
  if v_actor is null or not app_private.has_organization_permission(v_item.organization_id, 'organization.manage') then
    raise exception 'Missing organization.manage permission' using errcode = '42501';
  end if;
  if p_status not in ('todo','in_progress','done','not_applicable') then
    raise exception 'Invalid readiness status' using errcode = '22023';
  end if;
  if p_status in ('done','not_applicable') and (v_evidence is null or char_length(v_evidence) < 5) then
    raise exception 'Completion evidence is required' using errcode = '22023';
  end if;

  update public.production_readiness_items
  set status = p_status,
      evidence = v_evidence,
      completed_by = case when p_status in ('done','not_applicable') then v_actor else null end,
      completed_at = case when p_status in ('done','not_applicable') then now() else null end
  where id = p_item_id
  returning * into v_item;

  return v_item;
end;
$$;

revoke all on function app_private.seed_production_readiness_items(uuid) from public, anon, authenticated;
revoke all on function app_private.initialize_production_readiness_items() from public, anon, authenticated;
revoke all on function public.update_production_readiness_item(uuid,text,text) from public, anon;
grant execute on function public.update_production_readiness_item(uuid,text,text) to authenticated;

commit;
