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
| PP-02 | Online-first; Supabase/Postgres is de enige actuele gegevensbron | Niet gestart | Prototype gebruikt uitsluitend sessiestatus en doet geen onterechte opslagbelofte. Volgende backendstap: Supabase Auth, Postgres en RLS |
| PP-03 | Eenmaal invoeren, overal hergebruiken | Gedeeltelijk | Snelregistratie verschijnt direct in tijdlijn en rapportsamenvatting; centrale databasekoppelingen ontbreken nog |
| PP-04 | Veelgebruikte registratie binnen enkele tikken | Gedeeltelijk | Centrale knop, typekeuze en compact formulier werken; 30-seconden-test met echte supervisors moet nog plaatsvinden |
| PP-05 | Alleen zichtbare, regelgestuurde automatisering | Gedeeltelijk | Rapportnummer, context, tijd en vaste samenvattingregels zijn zichtbaar; regels zijn nog niet beheerbaar of geaudit |
| PP-06 | Formulieren, checklists, categorieën en rapporten configureerbaar | Niet gestart | Sjabloonmodel en beheerportaal volgen na centrale datalaag |
| PP-07 | Wijzigingen, goedkeuringen en versies traceerbaar | Niet gestart | UI toont statussen; append-only audit en immutable rapportversies vereisen Postgres |
| PP-08 | Reuse-first UI met onderhouden open-sourcecomponenten | Tijdelijke afwijking | React en Lucide worden hergebruikt, maar maatwerkdialogen/formuliervelden moeten worden vervangen door MUI-wrappers |
| PP-09 | Gratis pilot met gebruiksmeters en limietwaarschuwingen | Gedeeltelijk | Gratis hosting actief; Supabase- en Drive-meters nog niet gebouwd |

## Navigatie en dagelijkse hoofdflow

| ID | Eis | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| WF-01 | Mijn projecten → Gebouwen → Projectstart | Conform | Verplichte driestapsflow gebouwd en door server-rendercontrole afgedekt |
| WF-02 | Gekozen project en gebouw blijven zichtbaar | Conform | Context staat in kop en zijbalk; contextwissel keert terug naar de projectkeuze |
| WF-03 | Fysieke registratie heeft verplicht een gebouw | Gedeeltelijk | Gebouw en locatie worden in snelle invoer getoond; databaseconstraint ontbreekt |
| WF-04 | Maximaal vijf primaire navigatiekeuzes | Conform | Vandaag, Project, Snel toevoegen, Acties en Meer op mobiel; desktop gebruikt dezelfde informatiestructuur |
| WF-05 | Dagcockpit beantwoordt planning, controles, problemen, ontbrekende informatie en rapportgereedheid | Gedeeltelijk | Cockpit toont status, kritieke bevinding, volledigheid, tijdlijn, KPI's en eindcontrole; geplande werkzaamheden worden verder uitgebouwd |
| WF-06 | Dagrapport automatisch per project en datum | Gedeeltelijk | Eén zichtbaar conceptnummer; unieke databasebeperking `(project_id, report_date)` ontbreekt |
| WF-07 | Rapportcontrole blokkeert bij ontbrekende verplichte informatie | Conform | HSE en planning morgen blokkeren “Gereed voor review” in de prototypeflow |
| WF-08 | Open zaken gaan mee naar de volgende dag | Niet gestart | Vereist centrale status- en rapportquery |

## MVP-modules

| ID | Module | Status | Opmerking |
| --- | --- | --- | --- |
| MVP-01 | Organisatie, gebruikers, rollen en projectinrichting | Niet gestart | Supabase Auth, memberships en RLS nodig |
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
| MVP-15 | Audit, rechten en back-up | Niet gestart | Vereist Supabase, Drive en beveiligingsimplementatie |
| MVP-16 | Online verwerking, idempotency en hervatbare uploads | Niet gestart | Volgende infrastructuurslice |
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
| TA-06 | Supabase Auth/Postgres/Realtime met RLS | Niet gestart | Vereist Supabase-projectconfiguratie en migrations |
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

## Implementatielog

| Datum | Slice | Regels |
| --- | --- | --- |
| 18-07-2026 | Eerste responsive dagcockpit, snelle registratie, acties en rapportcontrole | PP-01, PP-03, PP-04, WF-04, WF-05, WF-07, MVP-04 |
| 18-07-2026 | CODECO-klantprofiel en formele compliance-administratie | CC-01 t/m CC-09, TA-01 t/m TA-10 |
| 18-07-2026 | CODECO-branding, project→gebouw→projectstart en interactieve aanwezigheid | WF-01, WF-02, WF-03, MVP-02, MVP-05, CC-09 |
