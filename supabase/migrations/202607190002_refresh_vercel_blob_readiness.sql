begin;

-- Organizations created after the Blob migration must receive the current
-- Vercel checklist, not the retired Cloudflare and Google Drive items.
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
    ('ACC-VERCEL-STORAGE','accounts','Vercel Blob onder CODECO-beheer','Gebruik een CODECO-beheerd Vercel-team en koppel een private Blob-store aan het productieproject.','CODECO IT / Vercel-beheerder',true,30),
    ('CFG-BLOB-PRIVATE','configuration','Private Blob-store','Controleer dat de Blob-store private is en uitsluitend met de productie- en noodzakelijke previewomgevingen is verbonden.','CODECO IT / ontwikkelaar',true,40),
    ('CFG-BLOB-PROJECT','configuration','Vercel Blob-projectkoppeling','Koppel de private Blob-store aan de webapp en beheer het Blob-token of Vercel OIDC uitsluitend aan de serverzijde.','Vercel-beheerder / ontwikkelaar',true,50),
    ('CFG-BLOB-ROUTES','configuration','Private upload en download testen','Test een geautoriseerde upload en download en bevestig dat een gebruiker zonder projectrecht geen bestandsbytes kan openen.','Ontwikkelaar / CODECO IT',true,60),
    ('CFG-SMTP','configuration','Productie e-mail en SMTP','Koppel een CODECO-afzenderdomein en productie-SMTP voor uitnodigingen, wachtwoordherstel en beveiligingsmeldingen; controleer SPF, DKIM en DMARC.','CODECO IT',true,70),
    ('ACC-INTERNAL-USERS','accounts','Interne gebruikers en rollen','Maak persoonlijke accounts voor primaire/back-upadmin, projectleider, lead supervisor, supervisors en Kwaliteit/HSE. Test opschorten en intrekken met een niet-productieaccount.','Organisatiebeheerder',true,80),
    ('OPS-BLOB-QUOTA','operations','Blob-gebruik en kostenlimiet','Controleer Blob-opslag en dataverkeer in Vercel en leg waarschuwingen en een verantwoordelijke vast.','CODECO IT / Vercel-beheerder',true,90),
    ('OPS-BACKUP-RESTORE','operations','Dagelijkse back-up en herstelproef','Activeer de dagelijkse JSON-back-up, download een geverifieerde kopie buiten het opslagaccount en voer een aantoonbare restore-dry-run uit.','Back-upbeheerder',true,100),
    ('LEGAL-PRODUCT-RULES','legal','Formulieren, retentie en ondertekening','CODECO keurt definitieve dagrapport-, inspectie-, HSE- en NCR-formulieren, bewaartermijnen, externe zichtbaarheid en juridisch ondertekenniveau schriftelijk goed.','CODECO directie / contractbeheer',true,110),
    ('CFG-BRANDING','configuration','Productnaam en huisstijl','Bevestig officiële productnaam, logo, kleuren en rapportvoettekst voor de formele productie-uitvoer.','CODECO directie',false,120),
    ('ACCEPT-UAT','acceptance','Gebruikersacceptatietest op locatie','Voer met minimaal één projectleider en twee supervisors een volledige werkdag uit: start, inspectie, bevinding, HSE, rapport, review, PDF en revisie.','CODECO projectteam',true,130),
    ('OPS-GOLIVE-OWNER','operations','Go-live eigenaar en incidentroute','Leg een eigenaar, vervanger, supportcontact en procedure vast voor accountverlies, datalek, storing, quota-alarm en herstel.','CODECO directie / IT',true,140)
  ) as item(code,category,title,description,owner_hint,blocking,sort_order)
  on conflict (organization_id, code) do nothing;
$$;

-- Avoid a unique-key collision if a checklist was manually corrected already.
delete from public.production_readiness_items legacy
where legacy.code in ('ACC-CLOUDFLARE','ACC-GOOGLE-STORAGE','CFG-GOOGLE-OAUTH','CFG-GATEWAY-SECRETS','OPS-DRIVE-QUOTA')
  and exists (
    select 1
    from public.production_readiness_items current_item
    where current_item.organization_id = legacy.organization_id
      and current_item.code = case legacy.code
        when 'ACC-CLOUDFLARE' then 'ACC-VERCEL-STORAGE'
        when 'ACC-GOOGLE-STORAGE' then 'CFG-BLOB-PRIVATE'
        when 'CFG-GOOGLE-OAUTH' then 'CFG-BLOB-PROJECT'
        when 'CFG-GATEWAY-SECRETS' then 'CFG-BLOB-ROUTES'
        when 'OPS-DRIVE-QUOTA' then 'OPS-BLOB-QUOTA'
      end
  );

update public.production_readiness_items set
  code = 'ACC-VERCEL-STORAGE',
  category = 'accounts',
  title = 'Vercel Blob onder CODECO-beheer',
  description = 'Gebruik een CODECO-beheerd Vercel-team en koppel een private Blob-store aan het productieproject.',
  owner_hint = 'CODECO IT / Vercel-beheerder'
where code = 'ACC-CLOUDFLARE';

update public.production_readiness_items set
  code = 'CFG-BLOB-PRIVATE',
  category = 'configuration',
  title = 'Private Blob-store',
  description = 'Controleer dat de Blob-store private is en uitsluitend met de productie- en noodzakelijke previewomgevingen is verbonden.',
  owner_hint = 'CODECO IT / ontwikkelaar'
where code = 'ACC-GOOGLE-STORAGE';

update public.production_readiness_items set
  code = 'CFG-BLOB-PROJECT',
  category = 'configuration',
  title = 'Vercel Blob-projectkoppeling',
  description = 'Koppel de private Blob-store aan de webapp en beheer het Blob-token of Vercel OIDC uitsluitend aan de serverzijde.',
  owner_hint = 'Vercel-beheerder / ontwikkelaar'
where code = 'CFG-GOOGLE-OAUTH';

update public.production_readiness_items set
  code = 'CFG-BLOB-ROUTES',
  category = 'configuration',
  title = 'Private upload en download testen',
  description = 'Test een geautoriseerde upload en download en bevestig dat een gebruiker zonder projectrecht geen bestandsbytes kan openen.',
  owner_hint = 'Ontwikkelaar / CODECO IT'
where code = 'CFG-GATEWAY-SECRETS';

update public.production_readiness_items set
  code = 'OPS-BLOB-QUOTA',
  category = 'operations',
  title = 'Blob-gebruik en kostenlimiet',
  description = 'Controleer Blob-opslag en dataverkeer in Vercel en leg waarschuwingen en een verantwoordelijke vast.',
  owner_hint = 'CODECO IT / Vercel-beheerder'
where code = 'OPS-DRIVE-QUOTA';

revoke all on function app_private.seed_production_readiness_items(uuid) from public, anon, authenticated;

commit;
