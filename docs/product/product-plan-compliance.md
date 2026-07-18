# Productplan-compliance — CODECO Supervisie

Laatst bijgewerkt: 18-07-2026  
Bron: `docs/productplan-constructiesupervisie-webapp.md`  
Klantverfijning: `docs/product/client-profile-codeco.md`

## Werkwijze

Deze lijst is de levende controle op de klantwensen. Een eis krijgt pas **Conform** wanneer zij is geïmplementeerd én aantoonbaar gecontroleerd.

Statussen:

- **Conform** — gebouwd en gecontroleerd;
- **Gedeeltelijk** — zichtbaar of werkend, maar nog niet volledig volgens alle regels;
- **Niet gestart** — nog niet gebouwd;
- **Geblokkeerd** — vereist een klantbesluit, account, contractgegeven of externe configuratie;
- **Tijdelijke afwijking** — bewust afwijkend en voorzien van herstelactie.

Bij iedere functionele wijziging worden de betrokken regels en de verificatie in deze lijst bijgewerkt.

## Productprincipes

| ID | Eis | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| PP-01 | Mobile-first, bruikbaar op telefoon en tablet | Conform | Responsieve cockpit, mobiele ondernavigatie, grote tikdoelen en modal-sheets; productiebuild en broncontrole aanwezig |
| PP-02 | Online-first; Supabase/Postgres is de enige actuele gegevensbron | Gedeeltelijk | Migration-first Supabase-schema, browserclient en RLS-fundering staan in code; de interface meldt expliciet dat demo-invoer niet centraal wordt opgeslagen. Hosted projectconfiguratie en echte query-/mutatiekoppeling ontbreken nog |
| PP-03 | Eenmaal invoeren, overal hergebruiken | Gedeeltelijk | Snelregistratie verschijnt direct in tijdlijn en rapportsamenvatting; centrale databasekoppelingen ontbreken nog |
| PP-04 | Veelgebruikte registratie binnen enkele tikken | Gedeeltelijk | Centrale knop, typekeuze en compact formulier werken; 30-seconden-test met echte supervisors moet nog plaatsvinden |
| PP-05 | Alleen zichtbare, regelgestuurde automatisering | Gedeeltelijk | Rapportnummer, context, tijd en vaste samenvattingregels zijn zichtbaar; regels zijn nog niet beheerbaar of geaudit |
| PP-06 | Formulieren, checklists, categorieën en rapporten configureerbaar | Niet gestart | Sjabloonmodel en beheerportaal volgen na centrale datalaag |
| PP-07 | Wijzigingen, goedkeuringen en versies traceerbaar | Gedeeltelijk | Append-only audit-events, actor/tijd/old/new-waarden, immutable rapportversies en database-statusovergangen zijn gemigreerd in code; uitvoering tegen een lokale en hosted Postgres volgt |
| PP-08 | Reuse-first UI met onderhouden open-sourcecomponenten | Tijdelijke afwijking | React en Lucide worden hergebruikt, maar maatwerkdialogen/formuliervelden moeten worden vervangen door MUI-wrappers |
| PP-09 | Gratis pilot met gebruiksmeters en limietwaarschuwingen | Gedeeltelijk | Gratis hosting actief; Supabase- en Drive-meters nog niet gebouwd |

## Navigatie en dagelijkse hoofdflow

| ID | Eis | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| WF-01 | Mijn projecten → Gebouwen → Projectstart | Conform | Verplichte driestapsflow gebouwd en door server-rendercontrole afgedekt |
| WF-02 | Gekozen project en gebouw blijven zichtbaar | Conform | Context staat in kop en zijbalk; contextwissel keert terug naar de projectkeuze |
| WF-03 | Fysieke registratie heeft verplicht een gebouw | Gedeeltelijk | Gebouw en locatie worden in de invoer getoond en de migration bevat een samengestelde foreign key plus `building_id`-constraint; database-uitvoering en live formulierkoppeling ontbreken nog |
| WF-04 | Maximaal vijf primaire navigatiekeuzes | Conform | Vandaag, Project, Snel toevoegen, Acties en Meer op mobiel; desktop gebruikt dezelfde informatiestructuur |
| WF-05 | Dagcockpit beantwoordt planning, controles, problemen, ontbrekende informatie en rapportgereedheid | Gedeeltelijk | Cockpit toont status, kritieke bevinding, volledigheid, tijdlijn, KPI's en eindcontrole; geplande werkzaamheden worden verder uitgebouwd |
| WF-06 | Dagrapport automatisch per project en datum | Gedeeltelijk | Atomische, idempotente databasefunctie en unieke beperking `(project_id, report_date)` zijn gebouwd; de cockpit roept deze RPC nog niet aan |
| WF-07 | Rapportcontrole blokkeert bij ontbrekende verplichte informatie | Conform | HSE en planning morgen blokkeren “Gereed voor review” in de prototypeflow |
| WF-08 | Open zaken gaan mee naar de volgende dag | Niet gestart | Vereist centrale status- en rapportquery |

## MVP-modules

| ID | Module | Status | Opmerking |
| --- | --- | --- | --- |
| MVP-01 | Organisatie, gebruikers, rollen en projectinrichting | Gedeeltelijk | Auth-profielen, organisaties, configureerbare rollen/rechten, organisatie- en projectmemberships, veilige standaardrollen en RLS zijn als migration gebouwd; login- en beheerschermen volgen |
| MVP-02 | Projectlocaties, partijen en basisdocumenten | Gedeeltelijk | Project-, gebouw- en partijencontext werken; locatieboom, centrale opslag en documentenregister volgen |
| MVP-03 | Dagrapportmotor | Gedeeltelijk | Concept, volledigheid en samenvatting aanwezig; PDF, immutable snapshot en revisies ontbreken |
| MVP-04 | Dagcockpit en Snel toevoegen | Conform | Eerste gecontroleerde vertical slice |
| MVP-05 | Aanwezigheid | Gedeeltelijk | Partijen, disciplines, diensten, aantallen, totalen en vorige-dagvoorstel werken; centrale opslag en bezoekersregistratie ontbreken |
| MVP-06 | Werkzaamheden en voortgang | Gedeeltelijk | Registratie en KPI aanwezig; planningkoppeling en formele bevestiging ontbreken |
| MVP-07 | Inspecties met configureerbare checklists | Gedeeltelijk | Type en tijdlijn aanwezig; checklistuitvoering en sjabloonversie ontbreken |
| MVP-08 | Bevinding → actie → herstel → verificatie | Gedeeltelijk | Kritieke bevinding en actieoverzicht aanwezig; statusflow en bewijsverificatie ontbreken |
| MVP-09 | Basis-HSE en incident/near miss | Gedeeltelijk | Registratietype en rapportblokkade aanwezig; checklist en incidentflow ontbreken |
| MVP-10 | Actiepunten en herinneringen | Gedeeltelijk | Actielijst aanwezig; toewijzing, notificatie en escalatie ontbreken |
| MVP-11 | Foto's en bijlagen | Gedeeltelijk | Registratiepunten aanwezig; Drive-gateway en hervatbare upload ontbreken |
| MVP-12 | Vertraging en handmatig weer | Gedeeltelijk | Weer en registratietype aanwezig; tijdblokberekening ontbreekt |
| MVP-13 | Review, PDF, ondertekening en revisies | Gedeeltelijk | Reviewgate aanwezig; PDF, audit en revisieflow ontbreken |
| MVP-14 | Basisdashboard en registers | Gedeeltelijk | KPI's en moduleoverzicht aanwezig; bronfilters en registers ontbreken |
| MVP-15 | Audit, rechten en back-up | Gedeeltelijk | Project-/rol-RLS en append-only audit zijn gebouwd; 56 pgTAP-tests controleren structuur én rijzichtbaarheid voor alle productrollen plus een buitenstaander. Drive-back-up, hosted policytests en hersteltest ontbreken |
| MVP-16 | Online verwerking, idempotency en hervatbare uploads | Gedeeltelijk | Unieke idempotency keys en atomische RPC's voor dagrapport/registratie/rapportversie zijn gebouwd; retry-UI en Drive resumable uploads ontbreken |
| MVP-17 | Beheer van secties, checklists, categorieën, deadlines en huisstijl | Niet gestart | Na schema- en sjabloonmodel |
| MVP-18 | Dagelijkse JSON-back-up en hersteltest | Niet gestart | Na centrale datalaag en Drive-gateway |

## CODECO-specifieke eisen

| ID | Klantwens | Status | Productplanrelatie |
| --- | --- | --- | --- |
| CC-01 | Projectspecifieke checklists | Niet gestart | Inspecties en configureerbaarheid |
| CC-02 | Dagelijkse, wekelijkse en tweewekelijkse rapporten | Gedeeltelijk | Dagrapportprototype aanwezig; week/2-weekrapport nog niet |
| CC-03 | Rapporten met foto's en grafieken | Gedeeltelijk | Foto/KPI-presentatie aanwezig; formele PDF-output ontbreekt |
| CC-04 | Planning en deadlines bewaken | Gedeeltelijk | Actiedeadlines zichtbaar; planning- en escalatieregels ontbreken |
| CC-05 | Kosten en budgetten bewaken | Niet gestart | Alleen projectspecifiek toevoegen zonder algemeen ERP te worden |
| CC-06 | Aannemersdeclaraties controleren | Niet gestart | Opnemen als gespecialiseerde projectmanagementflow na MVP-kern |
| CC-07 | Meer-/minderwerk met bewijs en besluit | Niet gestart | Productplanmodule 4.11 |
| CC-08 | Kwaliteit, veiligheid, efficiency en kostenbesparing adviseren | Gedeeltelijk | Kwaliteit/HSE zichtbaar; adviesregistratie en besluitspoor ontbreken |
| CC-09 | Kwaliteit, transparantie, klanttevredenheid en commitment zichtbaar maken | Gedeeltelijk | Transparante status en opvolging aanwezig; formele audit en klantportaal ontbreken |

## Technische architectuur

| ID | Keuze uit productplan | Status | Afwijking / herstelactie |
| --- | --- | --- | --- |
| TA-01 | React 19.2 + TypeScript strict | Conform | React 19.2.6 en strict TypeScript |
| TA-02 | Vite 8.1 + React Router 8, geen Next.js-applicatielaag | Tijdelijke afwijking | Huidige Sites-prototype gebruikt vinext. Migratie naar Vite SPA + React Router wordt vóór backendimplementatie gepland |
| TA-03 | MUI + Emotion en MUI X Community | Niet gestart | Thema en componentwrappers moeten de maatwerkprimitieven vervangen |
| TA-04 | TanStack Query 5 | Niet gestart | Toevoegen bij Supabase server-state |
| TA-05 | React Hook Form + Zod 4 | Niet gestart | Toevoegen bij eerste databaseformulier |
| TA-06 | Supabase Auth/Postgres/Realtime met RLS | Gedeeltelijk | Supabase-client, lokale CLI-config, versioned migration, samengestelde foreign keys, indexen en RLS zijn aanwezig; `db reset`, database-lint en 56 pgTAP-tests slagen lokaal. Hosted pilotconfiguratie en Realtime volgen na de live querylaag |
| TA-07 | Google Drive als enige bestandsopslag via Worker-gateway | Niet gestart | Geen bestanden in andere productopslag plaatsen |
| TA-08 | Bun workspaces + Turborepo + Biome | Tijdelijke afwijking | Starter gebruikt npm; monorepo- en toolmigratie vóór CI-inrichting |
| TA-09 | Client-side PDF uit immutable snapshot | Niet gestart | `@react-pdf/renderer` pas toevoegen bij rapportversies |
| TA-10 | Cloudflare-compatible ESM-output | Conform | Productiebuild en privédeployment geslaagd |

## Open klantbesluiten

Deze onderwerpen blijven bewust **Geblokkeerd** totdat CODECO ze formeel bevestigt:

1. welke gegevens opdrachtgever en aannemer per object mogen zien;
2. definitieve dagrapport-, inspectie-, HSE- en NCR-formulieren;
3. contractuele bewaartermijnen;
4. vereist juridisch niveau van digitale ondertekening;
5. definitieve KPI-formules en eventuele contractuele betekenis;
6. officiële productnaam en aan te leveren logo-/huisstijlbestanden;
7. exacte werkwijze voor aannemersdeclaraties en budgetgoedkeuring.

## Beveiliging en betrouwbaarheid

| ID | Regel | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| SEC-01 | RLS op iedere browserbereikbare tabel, geïndexeerd en per rol getest | Conform | RLS staat op alle 18 browserbereikbare tabellen; policykolommen zijn geïndexeerd en de lokale rollenmatrix voor beheerder, supervisor, aannemer, opdrachtgever en buitenstaander slaagt |
| SEC-02 | Service keys, Vault-secrets en Google-tokens nooit in de React-app | Conform | Browserconfiguratie accepteert uitsluitend publieke Supabase URL + publishable/anon key; bron- en env-test blokkeren serversecrets |
| SEC-03 | Kritieke mutaties atomisch en idempotent | Gedeeltelijk | Dagrapport, bouwplaatsregistratie en immutable rapportversie hebben atomische RPC's en unieke idempotency constraints; acties, uploads en achtergrondjobs volgen |
| SEC-04 | Append-only audit en immutable formele versies | Gedeeltelijk | Database-triggers blokkeren update/delete en de tests slagen; hosted toepassing en volledige status-/distributie-events volgen |
| SEC-05 | Geldige statusovergangen en bevoegde verificatie in de database | Gedeeltelijk | Dagrapport- en actietransities zijn database-enforced; overige procesobjecten en klantgoedgekeurde matrices volgen |
| SEC-06 | Dependencycontrole zonder open productierisico's | Tijdelijke afwijking | `npm audit --omit=dev` meldt twee moderate PostCSS-advisories via de tijdelijke Next/vinext-laag. De aangeboden force-fix is een brekende downgrade; oplossen via veilige upstream-update of de geplande Vite/React Router-migratie |
| SEC-07 | MFA, veilige headers, rate limits en foutmeldingen zonder gevoelige data | Niet gestart | Wordt gebouwd bij de hosted Auth- en Cloudflare-gatewayconfiguratie |
| SEC-08 | Dagelijkse back-up, checksums en periodieke restoretest | Niet gestart | Vereist hosted Supabase, dedicated CODECO Drive-account en storage-gateway |

## Implementatielog

| Datum | Slice | Regels |
| --- | --- | --- |
| 18-07-2026 | Eerste responsive dagcockpit, snelle registratie, acties en rapportcontrole | PP-01, PP-03, PP-04, WF-04, WF-05, WF-07, MVP-04 |
| 18-07-2026 | CODECO-klantprofiel en formele compliance-administratie | CC-01 t/m CC-09, TA-01 t/m TA-10 |
| 18-07-2026 | CODECO-branding, project→gebouw→projectstart en interactieve aanwezigheid | WF-01, WF-02, WF-03, MVP-02, MVP-05, CC-09 |
| 18-07-2026 | Online-first Supabase-fundering met rollen, projectrechten, RLS, audit, unieke dagrapporten, idempotency en eerlijke demo-opslagstatus | PP-02, PP-07, WF-03, WF-06, MVP-01, MVP-15, MVP-16, TA-06 |

## Verificatie van deze slice

De migration is op 18-07-2026 vanaf een lege lokale Supabase/Postgres-database toegepast met `supabase db reset`. `supabase db lint --level error` rapporteert geen schemafouten. Twee pgTAP-bestanden met samen 56 tests slagen, inclusief rijzichtbaarheid voor alle acht productrollen plus een buitenstaander. De browserbuild, TypeScript, ESLint en de vier webtests slagen eveneens. De regels blijven **Gedeeltelijk** waar het afgescheiden hosted pilotproject, de echte login/querylaag, Google Drive of een klantbesluit nog ontbreekt.
