# Productplan-compliance — CODECO Supervisie

Laatst bijgewerkt: 18-07-2026  
Bron: `docs/productplan-constructiesupervisie-webapp.md`  
Klantverfijning: `docs/product/client-profile-codeco.md`
Klantbrief dagrapport: `docs/product/client-day-report-brief.md`

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
| PP-03 | Eenmaal invoeren, overal hergebruiken | Gedeeltelijk | Snelregistratie en antwoorden uit projectstart/dagafsluiting voeden tijdlijn, dagcockpit en rapportconcept; centrale databasekoppeling met de interface ontbreekt nog |
| PP-04 | Veelgebruikte registratie binnen enkele tikken | Gedeeltelijk | Centrale knop, typekeuze en compact formulier werken; 30-seconden-test met echte supervisors moet nog plaatsvinden |
| PP-05 | Alleen zichtbare, regelgestuurde automatisering | Gedeeltelijk | Projectstart toont per deterministische regel de aanleiding, actie en regel-ID; de database bewaart de gebruikte rulesnapshot voor audit. Beheer en versiebeheer door bevoegde gebruikers ontbreken nog |
| PP-06 | Formulieren, checklists, categorieën en rapporten configureerbaar | Gedeeltelijk | Vraaggroepen, schema's en conditioneel verplichte velden zijn gestructureerd gebouwd; een beheerportaal en geversioneerde projectsjablonen ontbreken nog |
| PP-07 | Wijzigingen, goedkeuringen en versies traceerbaar | Gedeeltelijk | Append-only audit-events, actor/tijd/old/new-waarden, immutable rapportversies, vragenlijstversies en database-statusovergangen zijn lokaal gemigreerd en getest; hosted uitvoering volgt |
| PP-08 | Reuse-first UI met onderhouden open-sourcecomponenten | Tijdelijke afwijking | React en Lucide worden hergebruikt, maar maatwerkdialogen/formuliervelden moeten worden vervangen door MUI-wrappers |
| PP-09 | Gratis pilot met gebruiksmeters en limietwaarschuwingen | Gedeeltelijk | Gratis hosting actief; Supabase- en Drive-meters nog niet gebouwd |

## Navigatie en dagelijkse hoofdflow

| ID | Eis | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| WF-01 | Mijn projecten → Gebouwen → Projectstart | Conform | Verplichte driestapsflow gebouwd en door server-rendercontrole afgedekt |
| WF-02 | Gekozen project en gebouw blijven zichtbaar | Conform | Context staat in kop en zijbalk; contextwissel keert terug naar de projectkeuze |
| WF-03 | Fysieke registratie heeft verplicht een gebouw | Gedeeltelijk | Gebouw en locatie worden in de invoer getoond en de migration bevat een samengestelde foreign key plus `building_id`-constraint; database-uitvoering en live formulierkoppeling ontbreken nog |
| WF-04 | Maximaal vijf primaire navigatiekeuzes | Conform | Vandaag, Project, Snel toevoegen, Acties en Meer op mobiel; desktop gebruikt dezelfde informatiestructuur |
| WF-05 | Dagcockpit beantwoordt planning, controles, problemen, ontbrekende informatie en rapportgereedheid | Gedeeltelijk | Projectstart en dagvragen verzamelen weer, planning, bezetting, inspecties, risico's, voortgang en ontbrekende rapportinformatie; centrale serverdata en projectspecifieke planning ontbreken nog |
| WF-06 | Dagrapport automatisch per project en datum | Gedeeltelijk | Atomische, idempotente databasefunctie en unieke beperking `(project_id, report_date)` zijn gebouwd; de cockpit roept deze RPC nog niet aan |
| WF-07 | Rapportcontrole blokkeert bij ontbrekende verplichte informatie | Conform | Alle vier dagvraaggroepen, inclusief conditionele kwaliteit-/HSE-toelichting, plan voor morgen en bijlagenbevestiging, blokkeren “Gereed voor review” zolang informatie ontbreekt |
| WF-08 | Open zaken gaan mee naar de volgende dag | Niet gestart | Vereist centrale status- en rapportquery |

## MVP-modules

| ID | Module | Status | Opmerking |
| --- | --- | --- | --- |
| MVP-01 | Organisatie, gebruikers, rollen en projectinrichting | Gedeeltelijk | Auth-profielen, organisaties, configureerbare rollen/rechten, organisatie- en projectmemberships, veilige standaardrollen en RLS zijn als migration gebouwd; login- en beheerschermen volgen |
| MVP-02 | Projectlocaties, partijen en basisdocumenten | Gedeeltelijk | Project-, gebouw- en partijencontext werken; locatieboom, centrale opslag en documentenregister volgen |
| MVP-03 | Dagrapportmotor | Gedeeltelijk | De 19 klantonderdelen zijn gemapt naar compacte modules en vier dagvraaggroepen; vaste samenvatting, volledigheid en rapportconcept werken. PDF, immutable snapshot en revisies ontbreken |
| MVP-04 | Dagcockpit en Snel toevoegen | Conform | Eerste gecontroleerde vertical slice |
| MVP-05 | Aanwezigheid | Gedeeltelijk | Partijen, disciplines, diensten, aantallen, totalen en vorige-dagvoorstel werken; centrale opslag en bezoekersregistratie ontbreken |
| MVP-06 | Werkzaamheden en voortgang | Gedeeltelijk | Projectstart vraagt gepland werk; dagafsluiting vraagt uitvoering en voortgangspercentage. Planningkoppeling en formele bevestiging ontbreken |
| MVP-07 | Inspecties met configureerbare checklists | Gedeeltelijk | Projectstart activeert inspectie-opvolging en dagafsluiting vraagt het resultaat; volledige checklistuitvoering en sjabloonversie ontbreken |
| MVP-08 | Bevinding → actie → herstel → verificatie | Gedeeltelijk | Kritieke bevinding en actieoverzicht aanwezig; statusflow en bewijsverificatie ontbreken |
| MVP-09 | Basis-HSE en incident/near miss | Gedeeltelijk | Hoog-risicowerk activeert een zichtbare HSE-regel en de dagvragen eisen een toelichting bij incident/near miss; formele checklist- en incidentflow ontbreken |
| MVP-10 | Actiepunten en herinneringen | Gedeeltelijk | Actielijst aanwezig; toewijzing, notificatie en escalatie ontbreken |
| MVP-11 | Foto's en bijlagen | Gedeeltelijk | Dagafsluiting vraagt fotoaantal en expliciete bijlagencontrole; daadwerkelijke upload, metadata en Drive-gateway ontbreken |
| MVP-12 | Vertraging en handmatig weer | Gedeeltelijk | Projectstart en dagafsluiting vragen werkelijk weer; vertraging vraagt oorzaak en uren. Automatische weerbron en tijdblokberekening ontbreken |
| MVP-13 | Review, PDF, ondertekening en revisies | Gedeeltelijk | Reviewgate aanwezig; PDF, audit en revisieflow ontbreken |
| MVP-14 | Basisdashboard en registers | Gedeeltelijk | KPI's en moduleoverzicht aanwezig; bronfilters en registers ontbreken |
| MVP-15 | Audit, rechten en back-up | Gedeeltelijk | Project-/rol-RLS en append-only audit zijn gebouwd; 80 pgTAP-tests dekken structuur en rijzichtbaarheid voor alle acht productrollen plus een buitenstaander, inclusief startchecks en dagafsluitingen. Drive-back-up, hosted policytests en hersteltest ontbreken |
| MVP-16 | Online verwerking, idempotency en hervatbare uploads | Gedeeltelijk | Unieke idempotency keys en atomische RPC's voor dagrapport/registratie/rapportversie zijn gebouwd; retry-UI en Drive resumable uploads ontbreken |
| MVP-17 | Beheer van secties, checklists, categorieën, deadlines en huisstijl | Gedeeltelijk | De klantsecties en conditionele formulieren hebben een expliciete codestructuur; beheer-UI, geversioneerde sjablonen en huisstijlbeheer ontbreken |
| MVP-18 | Dagelijkse JSON-back-up en hersteltest | Niet gestart | Na centrale datalaag en Drive-gateway |

## CODECO-specifieke eisen

| ID | Klantwens | Status | Productplanrelatie |
| --- | --- | --- | --- |
| CC-01 | Projectspecifieke checklists | Gedeeltelijk | Projectstart bepaalt welke controles die dag nodig zijn; beheerbare projectsjablonen en volledige checklistuitvoering ontbreken |
| CC-02 | Dagelijkse, wekelijkse en tweewekelijkse rapporten | Gedeeltelijk | Dagrapportprototype volgt nu de 19 klantonderdelen; week/2-weekrapport nog niet |
| CC-03 | Rapporten met foto's en grafieken | Gedeeltelijk | Foto/KPI-presentatie aanwezig; formele PDF-output ontbreekt |
| CC-04 | Planning en deadlines bewaken | Gedeeltelijk | Actiedeadlines zichtbaar; planning- en escalatieregels ontbreken |
| CC-05 | Kosten en budgetten bewaken | Niet gestart | Alleen projectspecifiek toevoegen zonder algemeen ERP te worden |
| CC-06 | Aannemersdeclaraties controleren | Niet gestart | Opnemen als gespecialiseerde projectmanagementflow na MVP-kern |
| CC-07 | Meer-/minderwerk met bewijs en besluit | Gedeeltelijk | Dagafsluiting vraagt wijzigingen/meerwerk; formele bewijs-, prijs-, besluit- en goedkeuringsflow ontbreekt |
| CC-08 | Kwaliteit, veiligheid, efficiency en kostenbesparing adviseren | Gedeeltelijk | Kwaliteit/HSE zichtbaar; adviesregistratie en besluitspoor ontbreken |
| CC-09 | Kwaliteit, transparantie, klanttevredenheid en commitment zichtbaar maken | Gedeeltelijk | Transparante status en opvolging aanwezig; formele audit en klantportaal ontbreken |

## Klantdagrapport — 19 onderdelen

| ID | Klantonderdeel | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| CDR-01 | Projectinformatie, weer en werkuren | Gedeeltelijk | Context, rapportdatum, handmatig weer en werkuren zijn onderdeel van projectstart; centrale opslag en projectmetadata volgen |
| CDR-02 | Samenvatting van het verloop | Gedeeltelijk | Dagvraag “Hoe is het project vandaag gegaan?” voedt de vaste rapportsamenvatting; formele snapshot/PDF volgt |
| CDR-03 | Aanwezigheid en partijen | Gedeeltelijk | Aanwezigheidsmodule en verwachte bezetting bestaan; centrale opslag en bezoekersregister ontbreken |
| CDR-04 | Werkzaamheden en voortgang | Gedeeltelijk | Gepland en uitgevoerd werk plus voortgangspercentage worden gevraagd; planningkoppeling ontbreekt |
| CDR-05 | Inspecties en controles | Gedeeltelijk | Geplande inspectie activeert opvolging en het dagresultaat wordt gevraagd; checklistdetails ontbreken |
| CDR-06 | Kwaliteitsbevindingen | Gedeeltelijk | Afwijking ja/nee met conditioneel verplichte toelichting; NCR-statusflow ontbreekt |
| CDR-07 | HSE, incidenten en near misses | Gedeeltelijk | HSE-vraag en conditionele toelichting blokkeren onvolledige afsluiting; formele incidentflow ontbreekt |
| CDR-08 | Materieel en machines | Gedeeltelijk | Dagvraag legt materieelstatus vast; materieelregister en stilstandhistorie ontbreken |
| CDR-09 | Materialen en leveringen | Gedeeltelijk | Dagvraag legt leveringen vast; ontvangstcontrole en documentkoppeling ontbreken |
| CDR-10 | Proeven en metingen | Gedeeltelijk | Dagvraag legt tests en metingen vast; meetwaarden, toleranties en certificaten volgen |
| CDR-11 | Wijzigingen en meer-/minderwerk | Gedeeltelijk | Dagvraag legt wijzigingswerk vast; bewijs- en besluitflow ontbreekt |
| CDR-12 | Vertragingen | Gedeeltelijk | Oorzaak en duur worden conditioneel gevraagd; gevolg- en claimanalyse ontbreken |
| CDR-13 | Communicatie en besluiten | Gedeeltelijk | Dagvraag legt overleg/instructie/besluit vast; geadresseerden en documentreferenties volgen |
| CDR-14 | Openstaande acties | Gedeeltelijk | Actiemodule toont status en deadline; eigenaar, escalatie en overdracht volgen |
| CDR-15 | Risico's en maatregelen | Gedeeltelijk | Start- en eindvragen leggen dagrisico's vast; formeel risicoregister en beheersmaatregelen volgen |
| CDR-16 | Planning volgende werkdag | Gedeeltelijk | “Wat staat morgen gepland?” is verplicht voor rapportreview; centrale planningkoppeling ontbreekt |
| CDR-17 | Foto-overzicht | Gedeeltelijk | Fotoaantal wordt gecontroleerd; upload, locatie, tijd en bijschrift volgen |
| CDR-18 | Bijlagen | Gedeeltelijk | Expliciete bijlagencontrole is verplicht; Drive-opslag en documentregister volgen |
| CDR-19 | Controle en ondertekening | Niet gestart | Reviewgate bestaat, maar naam/functie, digitale ondertekening en formele distributie moeten nog worden gebouwd |

## Technische architectuur

| ID | Keuze uit productplan | Status | Afwijking / herstelactie |
| --- | --- | --- | --- |
| TA-01 | React 19.2 + TypeScript strict | Conform | React 19.2.6 en strict TypeScript |
| TA-02 | Vite 8.1 + React Router 8, geen Next.js-applicatielaag | Tijdelijke afwijking | Huidige Sites-prototype gebruikt vinext. Migratie naar Vite SPA + React Router wordt vóór backendimplementatie gepland |
| TA-03 | MUI + Emotion en MUI X Community | Niet gestart | Thema en componentwrappers moeten de maatwerkprimitieven vervangen |
| TA-04 | TanStack Query 5 | Niet gestart | Toevoegen bij Supabase server-state |
| TA-05 | React Hook Form + Zod 4 | Conform | Projectstart en dagafsluiting gebruiken React Hook Form met Zod 4, schemaresolvers en conditionele validatie |
| TA-06 | Supabase Auth/Postgres/Realtime met RLS | Gedeeltelijk | Supabase-client, versioned migrations, samengestelde foreign keys, indexen en RLS zijn aanwezig; startcheck en dagafsluiting hebben eigen projectgebonden tabellen. Schone database-reset, schema-lint en 80 pgTAP-tests slagen; hosted pilotconfiguratie en Realtime volgen na de live querylaag |
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
| SEC-01 | RLS op iedere browserbereikbare tabel, geïndexeerd en per rol getest | Conform | RLS staat op alle 20 browserbereikbare tabellen; policykolommen zijn geïndexeerd en de lokale zichtbaarheidsmatrix dekt alle acht productrollen plus een buitenstaander |
| SEC-02 | Service keys, Vault-secrets en Google-tokens nooit in de React-app | Conform | Browserconfiguratie accepteert uitsluitend publieke Supabase URL + publishable/anon key; bron- en env-test blokkeren serversecrets |
| SEC-03 | Kritieke mutaties atomisch en idempotent | Gedeeltelijk | Dagrapport, bouwplaatsregistratie, startcheck, dagafsluiting en immutable rapportversie hebben unieke idempotencybescherming; acties, uploads en achtergrondjobs volgen |
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
| 18-07-2026 | Modulaire projectstart- en dagvragen volgens de 19 klantonderdelen, met vaste zichtbare automatisatieregels en conditionele validatie | PP-03, PP-05, PP-06, WF-05, WF-07, MVP-03, MVP-06, MVP-09, MVP-11, MVP-12, CDR-01 t/m CDR-19, TA-05 |

## Verificatie van deze slice

De nieuwe vragenlijstmigration is op 18-07-2026 vanaf een lege lokale Supabase/Postgres-database toegepast met `supabase db reset`. `supabase db lint --level error` rapporteert geen schemafouten. Twee pgTAP-bestanden met samen 80 tests slagen, inclusief rijzichtbaarheid voor alle acht productrollen plus een buitenstaander. De productiebuild, TypeScript, ESLint en alle vier webtests slagen eveneens. De regels blijven **Gedeeltelijk** waar het afgescheiden hosted pilotproject, de echte login/querylaag, Google Drive of een klantbesluit nog ontbreekt.
