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
| PP-02 | Online-first; Supabase/Postgres is de enige actuele gegevensbron | Conform | Hosted Supabase is gekoppeld; login, organisatie/projectinrichting, projectstart, dagvragen, aanwezigheid, registraties en reviewstatus lezen en schrijven centraal. De UI bevestigt pas na serverrespons |
| PP-03 | Eenmaal invoeren, overal hergebruiken | Conform | Centrale projectstart, dagafsluiting, aanwezigheid en registraties voeden context, cockpit, tijdlijn, KPI's, review en PDF-concept zonder tweede invoer |
| PP-04 | Veelgebruikte registratie binnen enkele tikken | Gedeeltelijk | Centrale knop, typekeuze en compact formulier werken; 30-seconden-test met echte supervisors moet nog plaatsvinden |
| PP-05 | Alleen zichtbare, regelgestuurde automatisering | Gedeeltelijk | Projectstart toont per deterministische regel de aanleiding, actie en regel-ID; de database bewaart de gebruikte rulesnapshot voor audit. Beheer en versiebeheer door bevoegde gebruikers ontbreken nog |
| PP-06 | Formulieren, checklists, categorieën en rapporten configureerbaar | Gedeeltelijk | Vraaggroepen, schema's en conditioneel verplichte velden zijn gestructureerd gebouwd; een beheerportaal en geversioneerde projectsjablonen ontbreken nog |
| PP-07 | Wijzigingen, goedkeuringen en versies traceerbaar | Gedeeltelijk | Append-only audit-events, actor/tijd/old/new-waarden, immutable rapportversies, vragenlijstversies, accounttoewijzingen en statusovergangen zijn lokaal gemigreerd en getest; formele review-/ondertekenings- en distributie-UI ontbreekt nog |
| PP-08 | Reuse-first UI met onderhouden open-sourcecomponenten | Tijdelijke afwijking | React en Lucide worden hergebruikt, maar maatwerkdialogen/formuliervelden moeten worden vervangen door MUI-wrappers |
| PP-09 | Gratis pilot met gebruiksmeters en limietwaarschuwingen | Gedeeltelijk | Gratis hosting actief; Supabase- en Drive-meters nog niet gebouwd |

## Navigatie en dagelijkse hoofdflow

| ID | Eis | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| WF-01 | Mijn projecten → Gebouwen → Projectstart | Conform | Verplichte driestapsflow gebouwd en door server-rendercontrole afgedekt |
| WF-02 | Gekozen project en gebouw blijven zichtbaar | Conform | Context staat in kop en zijbalk; contextwissel keert terug naar de projectkeuze |
| WF-03 | Fysieke registratie heeft verplicht een gebouw | Conform | De live invoer vereist een gekozen gebouw; samengestelde foreign keys en databaseconstraints blokkeren fysieke registraties zonder geldig projectgebouw |
| WF-04 | Maximaal vijf primaire navigatiekeuzes | Conform | Vandaag, Project, Snel toevoegen, Acties en Meer op mobiel; desktop gebruikt dezelfde informatiestructuur |
| WF-05 | Dagcockpit beantwoordt planning, controles, problemen, ontbrekende informatie en rapportgereedheid | Gedeeltelijk | Live centrale projectstart en dagvragen verzamelen weer, planning, bezetting, inspecties, risico's en voortgang; projectspecifieke externe planning ontbreekt nog |
| WF-06 | Dagrapport automatisch per project en datum | Conform | De live cockpit roept de atomische RPC aan; unieke beperking `(project_id, report_date)` en idempotency voorkomen dubbele dagrapporten |
| WF-07 | Rapportcontrole blokkeert bij ontbrekende verplichte informatie | Conform | Alle vier dagvraaggroepen, inclusief conditionele kwaliteit-/HSE-toelichting, plan voor morgen en bijlagenbevestiging, blokkeren “Gereed voor review” zolang informatie ontbreekt |
| WF-08 | Open zaken gaan mee naar de volgende dag | Gedeeltelijk | Open centrale acties blijven projectbreed zichtbaar en worden realtime bijgewerkt; expliciete dagoverdracht en bevestiging zijn nog niet gebouwd |

## MVP-modules

| ID | Module | Status | Opmerking |
| --- | --- | --- | --- |
| MVP-01 | Organisatie, gebruikers, rollen en projectinrichting | Gedeeltelijk | Openbare registratie is verwijderd en databasebreed geblokkeerd. Alleen een organisatiebeheerder kan via het beheerportaal een intern account per gegevensgestuurde organisatie-/projectrol uitnodigen; eerste inrichting, accountopsomming en projectinrichting werken. Opschorten/intrekken en fijnmazig rolbeheer volgen |
| MVP-02 | Projectlocaties, partijen en basisdocumenten | Gedeeltelijk | Project-, gebouw- en partijencontext werken; locatieboom, centrale opslag en documentenregister volgen |
| MVP-03 | Dagrapportmotor | Gedeeltelijk | De 19 klantonderdelen zijn gemapt naar centrale vraaggroepen, reviewgate en professioneel client-side PDF-concept; immutable formele snapshot, revisies en distributie ontbreken |
| MVP-04 | Dagcockpit en Snel toevoegen | Conform | Eerste gecontroleerde vertical slice |
| MVP-05 | Aanwezigheid | Gedeeltelijk | Partijen, disciplines, diensten, aantallen en totalen worden idempotent centraal opgeslagen; bezoekersregistratie en vorige-dagbevestiging ontbreken |
| MVP-06 | Werkzaamheden en voortgang | Gedeeltelijk | Projectstart vraagt gepland werk; dagafsluiting vraagt uitvoering en voortgangspercentage. Planningkoppeling en formele bevestiging ontbreken |
| MVP-07 | Inspecties met configureerbare checklists | Gedeeltelijk | Projectstart activeert inspectie-opvolging en dagafsluiting vraagt het resultaat; volledige checklistuitvoering en sjabloonversie ontbreken |
| MVP-08 | Bevinding → actie → herstel → verificatie | Gedeeltelijk | Centrale actieflow `open → geaccepteerd → in uitvoering → gereed voor verificatie → geverifieerd` werkt met verplichte notities en immutable historie; formele koppeling vanuit een gestructureerde NCR/bevinding en bestandsbewijs volgen |
| MVP-09 | Basis-HSE en incident/near miss | Gedeeltelijk | Hoog-risicowerk activeert een zichtbare HSE-regel en de dagvragen eisen een toelichting bij incident/near miss; formele checklist- en incidentflow ontbreken |
| MVP-10 | Actiepunten en herinneringen | Gedeeltelijk | Uniek actienummer, verantwoordelijke partij, deadline, prioriteit, realtime lijst, statusflow en verificatie werken centraal; notificaties, escalatieregels en bulkbeheer ontbreken |
| MVP-11 | Foto's en bijlagen | Gedeeltelijk | Dagafsluiting vraagt fotoaantal en expliciete bijlagencontrole; daadwerkelijke upload, metadata en Drive-gateway ontbreken |
| MVP-12 | Vertraging en handmatig weer | Gedeeltelijk | Projectstart en dagafsluiting vragen werkelijk weer; vertraging vraagt oorzaak en uren. Automatische weerbron en tijdblokberekening ontbreken |
| MVP-13 | Review, PDF, ondertekening en revisies | Gedeeltelijk | Database-reviewgate, volledigheidscontrole, statusovergang en professioneel PDF-concept werken; formele ondertekening, immutable freeze, revisie-review en distributie ontbreken |
| MVP-14 | Basisdashboard en registers | Gedeeltelijk | KPI's en moduleoverzicht aanwezig; bronfilters en registers ontbreken |
| MVP-15 | Audit, rechten en back-up | Gedeeltelijk | Project-/rol-RLS en append-only audit zijn actief; 150 pgTAP-tests dekken structuur, alle acht productrollen, buitenstaanders, admin-only accountprovisioning, workspace/review en actie-verificatie. Drive-back-up en hersteltest ontbreken |
| MVP-16 | Online verwerking, idempotency en hervatbare uploads | Gedeeltelijk | Live mutaties wachten op centrale bevestiging; unieke keys en atomische RPC's beschermen dagrapport, registratie, aanwezigheid, workspace, review en actiecreatie. Drive resumable uploads ontbreken |
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
| CDR-01 | Projectinformatie, weer en werkuren | Gedeeltelijk | Context, rapportdatum, handmatig weer en werkuren worden centraal opgeslagen en verschijnen in het PDF-concept; aanvullende contractmetadata volgt |
| CDR-02 | Samenvatting van het verloop | Gedeeltelijk | De centrale dagvraag “Hoe is het project vandaag gegaan?” voedt samenvatting en PDF-concept; formele immutable snapshot volgt |
| CDR-03 | Aanwezigheid en partijen | Gedeeltelijk | Aanwezigheidsmodule slaat partijen, disciplines, diensten en aantallen centraal op en hergebruikt die in het rapport; bezoekersregister ontbreekt |
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
| CDR-18 | Bijlagen | Gedeeltelijk | Expliciete bijlagencontrole is verplicht en blokkeert review; Drive-opslag en documentregister volgen |
| CDR-19 | Controle en ondertekening | Gedeeltelijk | Centrale reviewgate en status `ready_for_review` werken; naam/functie, digitale ondertekening en formele distributie vereisen nog implementatie en klantbesluit |

## Technische architectuur

| ID | Keuze uit productplan | Status | Afwijking / herstelactie |
| --- | --- | --- | --- |
| TA-01 | React 19.2 + TypeScript strict | Conform | React 19.2.6 en strict TypeScript |
| TA-02 | Vite 8.1 + React Router 8, geen Next.js-applicatielaag | Tijdelijke afwijking | Huidige Sites-prototype gebruikt vinext. Migratie naar Vite SPA + React Router wordt vóór backendimplementatie gepland |
| TA-03 | MUI + Emotion en MUI X Community | Niet gestart | Thema en componentwrappers moeten de maatwerkprimitieven vervangen |
| TA-04 | TanStack Query 5 | Conform | Centrale workspace- en dagdata gebruiken querycaching en gerichte invalidatie na bevestigde mutaties |
| TA-05 | React Hook Form + Zod 4 | Conform | Projectstart en dagafsluiting gebruiken React Hook Form met Zod 4, schemaresolvers en conditionele validatie |
| TA-06 | Supabase Auth/Postgres/Realtime met RLS | Gedeeltelijk | Hosted Auth/Postgres, vijf versioned migrations, RLS en live query-/mutatielaag zijn actief. Zeven operationele tabellen publiceren selectief naar Realtime en de app invalideert de geopende projectdag en het toegangsbeheer gericht; bredere meldingskanalen volgen |
| TA-07 | Google Drive als enige bestandsopslag via Worker-gateway | Niet gestart | Geen bestanden in andere productopslag plaatsen |
| TA-08 | Bun workspaces + Turborepo + Biome | Tijdelijke afwijking | Starter gebruikt npm; monorepo- en toolmigratie vóór CI-inrichting |
| TA-09 | Client-side PDF uit immutable snapshot | Gedeeltelijk | `@react-pdf/renderer` genereert een professioneel concept uit centrale rapportdata; genereren uit een immutable rapportversie volgt bij formele freeze |
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
| SEC-02 | Service keys, Vault-secrets en Google-tokens nooit in de React-app | Conform | De browserconfiguratie accepteert uitsluitend de publieke Supabase URL + publishable key. De nieuwe `SUPABASE_SECRET_KEY` wordt alleen door de Cloudflare-serverroute gelezen; bron- en env-tests blokkeren publieke serversecrets |
| SEC-03 | Kritieke mutaties atomisch en idempotent | Gedeeltelijk | Dagrapport, workspace, bouwplaatsregistratie, aanwezigheid, startcheck, dagafsluiting, reviewsubmit, actiecreatie/statusflow en rapportversie hebben databasebescherming; uploads en achtergrondjobs volgen |
| SEC-04 | Append-only audit en immutable formele versies | Gedeeltelijk | Database-triggers blokkeren update/delete en de tests slagen; hosted toepassing en volledige status-/distributie-events volgen |
| SEC-05 | Geldige statusovergangen en bevoegde verificatie in de database | Gedeeltelijk | Dagrapport- en actietransities zijn database-enforced; overige procesobjecten en klantgoedgekeurde matrices volgen |
| SEC-06 | Dependencycontrole zonder open productierisico's | Tijdelijke afwijking | `npm audit --omit=dev` meldt twee moderate PostCSS-advisories via de tijdelijke Next/vinext-laag. De aangeboden force-fix is een brekende downgrade; oplossen via veilige upstream-update of de geplande Vite/React Router-migratie |
| SEC-07 | MFA, veilige headers, rate limits en foutmeldingen zonder gevoelige data | Niet gestart | Wordt gebouwd bij de hosted Auth- en Cloudflare-gatewayconfiguratie |
| SEC-08 | Dagelijkse back-up, checksums en periodieke restoretest | Niet gestart | Vereist hosted Supabase, dedicated CODECO Drive-account en storage-gateway |
| SEC-09 | Alleen beheerders maken interne accounts en wijzen rollen toe | Conform | Geen `signUp`-actie of registratiescherm; Supabase self-signup staat uit. De uitnodigingsroute verifieert het gebruikers-JWT, eist `members.manage`, bewaart organisatie-/projectmembership en rol via een beveiligde RPC en zet de serversecret nooit in de browser |

## Implementatielog

| Datum | Slice | Regels |
| --- | --- | --- |
| 18-07-2026 | Eerste responsive dagcockpit, snelle registratie, acties en rapportcontrole | PP-01, PP-03, PP-04, WF-04, WF-05, WF-07, MVP-04 |
| 18-07-2026 | CODECO-klantprofiel en formele compliance-administratie | CC-01 t/m CC-09, TA-01 t/m TA-10 |
| 18-07-2026 | CODECO-branding, project→gebouw→projectstart en interactieve aanwezigheid | WF-01, WF-02, WF-03, MVP-02, MVP-05, CC-09 |
| 18-07-2026 | Online-first Supabase-fundering met rollen, projectrechten, RLS, audit, unieke dagrapporten, idempotency en eerlijke demo-opslagstatus | PP-02, PP-07, WF-03, WF-06, MVP-01, MVP-15, MVP-16, TA-06 |
| 18-07-2026 | Modulaire projectstart- en dagvragen volgens de 19 klantonderdelen, met vaste zichtbare automatisatieregels en conditionele validatie | PP-03, PP-05, PP-06, WF-05, WF-07, MVP-03, MVP-06, MVP-09, MVP-11, MVP-12, CDR-01 t/m CDR-19, TA-05 |
| 18-07-2026 | Hosted Supabase live gekoppeld met Auth, centrale onboarding, projectwerkruimte, dagdata, aanwezigheid, registraties en reviewsubmit | PP-02, PP-03, WF-03, WF-06, MVP-01, MVP-04, MVP-05, MVP-15, MVP-16, TA-04, TA-06, SEC-03 |
| 18-07-2026 | Professioneel client-side dagrapportconcept volgens alle 19 klantonderdelen, zonder ongefundeerde democijfers | MVP-03, MVP-13, CDR-01 t/m CDR-19, TA-09 |
| 18-07-2026 | Post-MVP centrale actie-opvolging met nummering, toewijzing, deadline, statusflow, verificatie, immutable historie en selectieve Realtime-updates | WF-08, MVP-08, MVP-10, MVP-15, MVP-16, TA-06, SEC-03 |
| 18-07-2026 | Intern accountbeheer met geblokkeerde self-signup, admin-uitnodiging, wachtwoordinstelling, gegevensgestuurde organisatie-/projectrollen en geharde bootstrap | PP-07, MVP-01, MVP-15, TA-05, TA-06, SEC-02, SEC-09 |

## Verificatie van deze slice

Alle vijf migrations zijn op 18-07-2026 vanaf een lege lokale Supabase/Postgres-database toegepast en staan gelijk in het gekoppelde hosted project. Lokale en remote schema-lint rapporteren geen fouten. Vijf pgTAP-bestanden met samen 150 tests slagen, inclusief rijzichtbaarheid voor alle acht productrollen plus buitenstaanders, geharde organisatiebootstrap en admin-only accountprovisioning. Een lokale end-to-end proef blokkeerde openbare signup, verifieerde een organisatiebeheerder, verstuurde via de echte serverroute een uitnodiging en las de projectspecifieke supervisorrol centraal terug. Hosted Auth weigert self-signup met `signup_disabled`, houdt e-maillogin aan en gebruikt uitsluitend de private productie-URL voor uitnodigingsredirects. Productiebuild, vier webtests, strict TypeScript en ESLint slagen; de private Sites-productieversie gebruikt serversecret-revisie 2. Regels blijven **Gedeeltelijk** of **Geblokkeerd** waar Google Drive, formele ondertekening/distributie, overig configureerbaar beheer, declaraties/budgetten of een klantbesluit nog ontbreken.
