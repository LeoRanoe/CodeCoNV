# Productplan-compliance — CODECO Supervisie

Laatst bijgewerkt: 22-07-2026
Bron: `docs/productplan-constructiesupervisie-webapp.md`  
Klantverfijning: `docs/product/client-profile-codeco.md`
Klantbrief dagrapport: `docs/product/client-day-report-brief.md`
Klantfeedback-audit 360°/tekeningen: `docs/product/klantfeedback-audit-2026-07-22.md`

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
| PP-05 | Alleen zichtbare, regelgestuurde automatisering | Gedeeltelijk | Projectstart, checklistafwijkingen, bevindingstermijnen, kritieke HSE-escalatie en vervalnotificaties zijn deterministisch en auditbaar. Volledig klantbeheer en versiebeheer van alle regels volgt |
| PP-06 | Formulieren, checklists, categorieën en rapporten configureerbaar | Gedeeltelijk | Beheerders beheren projectinstellingen, locatiehiërarchie, partijen en atomisch gepubliceerde checklists met vragen. Rapportsecties, categorieën en huisstijl zijn nog niet volledig configureerbaar |
| PP-07 | Wijzigingen, goedkeuringen en versies traceerbaar | Conform | Append-only audit, actor/tijd/old/new-waarden, immutable rapportversies en snapshots, reviewbesluiten, ondertekenverklaringen, distributieregistratie en revisiehistorie zijn centraal afgedwongen en getest |
| PP-08 | Reuse-first UI met onderhouden open-sourcecomponenten | Tijdelijke afwijking | React en Lucide worden hergebruikt, maar maatwerkdialogen/formuliervelden moeten worden vervangen door MUI-wrappers |
| PP-09 | Gratis pilot met gebruiksmeters en limietwaarschuwingen | Gedeeltelijk | Gratis private hosting is actief; de auditbare productiegereedheidschecklist bewaakt eigenaarschap en blokkades. Vercel Blob-gebruik, dataverkeer en Supabase-limietwaarschuwingen moeten operationeel worden bewaakt |

## Navigatie en dagelijkse hoofdflow

| ID | Eis | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| WF-01 | Mijn projecten → Gebouwen → Projectstart | Conform | Eerste keuze blijft een driestapsflow; daarna wisselt de zijbalk direct van gebouw zonder terug te gaan naar de projectkeuze, en een beheerder kan een tweede of derde gebouw toevoegen via de nieuwe `create_building`-RPC |
| WF-02 | Gekozen project en gebouw blijven zichtbaar | Conform | Context staat in kop en zijbalk; "Gebouw wisselen" wijzigt alleen de actieve gebouwcontext binnen dezelfde werkruimte, zonder de projectkeuze of ingevoerde dagdata te verliezen |
| WF-03 | Fysieke registratie heeft verplicht een gebouw | Conform | De live invoer vereist een gekozen gebouw; samengestelde foreign keys en databaseconstraints blokkeren fysieke registraties zonder geldig projectgebouw. Projectstart, dagafsluiting en aanwezigheid zijn nu per (dagrapport, gebouw) uniek in plaats van per dagrapport, zodat elk gebouw zijn eigen antwoorden bewaart |
| WF-04 | Maximaal vijf primaire navigatiekeuzes | Conform | Vandaag, Project, Snel toevoegen, Acties en Meer op mobiel; desktop gebruikt dezelfde informatiestructuur |
| WF-05 | Dagcockpit beantwoordt planning, controles, problemen, ontbrekende informatie en rapportgereedheid | Gedeeltelijk | Live centrale projectstart en dagvragen verzamelen weer, planning, bezetting, inspecties, risico's en voortgang; projectspecifieke externe planning ontbreekt nog |
| WF-06 | Dagrapport automatisch per project en datum | Conform | De live cockpit roept de atomische RPC aan; unieke beperking `(project_id, report_date)` en idempotency voorkomen dubbele dagrapporten |
| WF-07 | Rapportcontrole blokkeert bij ontbrekende verplichte informatie | Conform | Alle vier dagvraaggroepen, inclusief conditionele kwaliteit-/HSE-toelichting, plan voor morgen en bijlagenbevestiging, blokkeren “Gereed voor review” zolang informatie ontbreekt |
| WF-08 | Open zaken gaan mee naar de volgende dag | Gedeeltelijk | Open acties en bevindingen blijven projectbreed zichtbaar; vervallen/bijna vervallen acties en bevindingen verschijnen als gededupliceerde pushmeldingen met een auditeerbare inboxkopie. Expliciete dagoverdracht en bevestiging ontbreken nog |
| WF-09 | Eén dagrapport dekt elk gebouw van het project, niet slechts het eerst gekozen gebouw | Conform | `submit_day_report_for_review` vereist nu een projectstart én dagafsluiting voor ieder actief gebouw voordat het gedeelde dagrapport naar review mag; de formele snapshot en rapportcontrole tonen per gebouw welke onderdelen nog ontbreken |

## MVP-modules

| ID | Module | Status | Opmerking |
| --- | --- | --- | --- |
| MVP-01 | Organisatie, gebruikers, rollen en projectinrichting | Gedeeltelijk | Openbare registratie is databasebreed geblokkeerd. Alleen een organisatiebeheerder nodigt accounts uit, wijst organisatie-/projectrollen toe en kan met verplichte auditreden opschorten, heractiveren of definitief intrekken; eigen accountblokkade is verboden. Rollen van een bestaand actief account achteraf wijzigen volgt |
| MVP-02 | Projectlocaties, partijen en basisdocumenten | Conform | Project, gebouw, beheerbare locatiehiërarchie en projectpartijen werken centraal. Een project start met één gebouw en kan nu via een beveiligde RPC verder groeien naar meerdere gebouwen. Bestandsmetadata is afgeschermd en bestandsbytes gaan naar private Vercel Blob |
| MVP-03 | Dagrapportmotor | Gedeeltelijk | De 19 klantonderdelen, volledigheidsgate, centrale immutable snapshot met SHA-256, review/retour, ondertekening, distributieregistratie en revisies zijn gebouwd. Een rechten-gefilterde PDF werkt voor dag, week, maand en iedere vrije periode; formeel bevriezen en ondertekenen van een periodebundel volgt |
| MVP-04 | Dagcockpit en Snel toevoegen | Conform | Eerste gecontroleerde vertical slice |
| MVP-05 | Aanwezigheid | Gedeeltelijk | Partijen, disciplines, diensten, aantallen en totalen worden idempotent centraal opgeslagen; bezoekersregistratie en vorige-dagbevestiging ontbreken |
| MVP-06 | Werkzaamheden en voortgang | Gedeeltelijk | Projectstart vraagt gepland werk; dagafsluiting vraagt uitvoering en voortgangspercentage. Planningkoppeling en formele bevestiging ontbreken |
| MVP-07 | Inspecties met configureerbare checklists | Gedeeltelijk | De bibliotheek bevat exact 100 installeerbare bouw- en HSE-standaarden; installatie maakt een geversioneerde projectkopie. Supervisors beantwoorden verplichte items en afronding creëert automatisch bevindingen bij afkeur. Numerieke meetvelden, herinspectie-UI en projectspecifieke inhoudsacceptatie volgen |
| MVP-08 | Bevinding → actie → herstel → verificatie | Gedeeltelijk | Gestructureerde NCR/bevindingen hebben nummer, ernst, partij, termijn, herstelmaatregel, bewijsbeschrijving en onafhankelijke verificatie met immutable updates. Herstelbewijs kan in private Vercel Blob worden opgeslagen en centraal worden gekoppeld |
| MVP-09 | Basis-HSE en incident/near miss | Gedeeltelijk | Incident, near miss, onveilige handeling/conditie en toolbox zijn formeel registreerbaar; vertrouwelijkheid, onmiddellijke maatregel en kritieke escalatiemelding worden afgedwongen. Onderzoek/afsluitflow en definitieve klantchecklist volgen |
| MVP-10 | Actiepunten en herinneringen | Gedeeltelijk | Acties en bevindingen hebben deadlines, statusflow, realtime updates en gededupliceerde meldingen. De dagelijkse taak zet nieuwe meldingen idempotent in een e-mailwachtrij, verstuurt via een geverifieerde provider en bewaart afleverstatus plus inboxkopie. Productiemigratie, e-mailconfiguratie en bulkbeheer ontbreken nog |
| MVP-11 | Foto's en bijlagen | Conform | Gewone foto's zijn standaard. Interactief 360° vereist een bevestigde, gestitchte 2:1-export van minimaal 3840×1920 uit een speciale 360°-camera zoals Insta360; een telefoonpanorama wordt expliciet niet geaccepteerd. Private upload/download, exacte 2D-/sferische markers, tours en atomisch gekoppelde formele bevindingen zijn actief |
| MVP-12 | Vertraging en handmatig weer | Gedeeltelijk | Projectstart en dagafsluiting vragen werkelijk weer; vertraging vraagt oorzaak en uren. Automatische weerbron en tijdblokberekening ontbreken |
| MVP-13 | Review, PDF, ondertekening en revisies | Gedeeltelijk | Formele review/retour, immutable freeze+checksum, geauthenticeerde append-only ondertekenverklaringen, distributieregistratie en revisies met behoud van origineel werken. Juridisch ondertekenniveau en automatische verzending zijn klantbesluiten; PDF uit frozen snapshot volgt |
| MVP-14 | Basisdashboard en registers | Gedeeltelijk | KPI's en moduleoverzicht werken; de klantlogs omvatten nu ook RFA, IR, BOQ, punch list, notitie, afspraak, technische instructie, change order, contract en specificatie. DWG-bronnen worden veilig bewaard; PDF-/afbeeldingstekeningen hebben paginaview, exacte recordpins en geaudite vrije lijnen, revisiewolken, pijlen en tekst. Uitgebreide filters/trends volgen |
| MVP-15 | Audit, rechten en back-up | Gedeeltelijk | RLS, append-only audit, formele recordbeveiliging, 323 pgTAP-tests, productiegereedheidschecklist en handmatige export zijn aanwezig. Dagelijkse gecomprimeerde Blob-back-up, readback, SHA-verificatie, retentie en maandelijkse integriteits-dry-run zijn gebouwd; productie-uitrol en een onafhankelijke off-accountkopie blijven open |
| MVP-16 | Online verwerking, idempotency en hervatbare uploads | Gedeeltelijk | Online mutaties gebruiken unieke keys en atomische RPC's; uploads gaan rechtstreeks naar Vercel Blob via kort geldige, beperkte upload-URL's met voortgang. Automatisch hervatten na een volledige browser- of netwerkonderbreking is nog niet toegevoegd |
| MVP-17 | Beheer van secties, checklists, categorieën, deadlines en huisstijl | Gedeeltelijk | Beheer-UI werkt voor projectregels, rapportprefix, pushmeldingen, herinneringstermijnen, bestandslimiet, locatiehiërarchie, partijen, 103 bibliotheekchecklists en eigen gepubliceerde checklists. Klanten kiezen rapporttype en vrije periode; huisstijlbeheer volgt |
| MVP-18 | Dagelijkse JSON-back-up en hersteltest | Gedeeltelijk | De Vercel Cron-route, volledige organisatie-export, gzip, Blob-readback, SHA-256, inhoudscontrole en 7-dag/4-week/3-maand-retentie zijn gebouwd en getest. De productiemigratie, eerste productieback-up, onafhankelijke kopie en volledige herstelproef in een tijdelijke database zijn nog niet aantoonbaar afgerond |

## CODECO-specifieke eisen

| ID | Klantwens | Status | Productplanrelatie |
| --- | --- | --- | --- |
| CC-01 | Projectspecifieke checklists | Gedeeltelijk | Beheerbare projectsjablonen en volledige verplichte checklistuitvoering werken, inclusief automatische bevinding bij afkeur. De drie ontvangen anchorformulieren zijn als versieerbare projecttemplates verwerkt, met sectiegewijs akkoord, vooraf ingevulde weercontrole en verwijderde dubbele bronregels; overige CODECO-formulieren en gespecialiseerde meettypes volgen na ontvangst |
| CC-02 | Dagelijkse, wekelijkse en tweewekelijkse rapporten | Conform | Dezelfde centrale bron genereert een dagelijkse, wekelijkse, tweewekelijkse, maandelijkse of vrij gekozen periode-PDF met de klantonderdelen en projectlogs |
| CC-03 | Rapporten met foto's en grafieken | Gedeeltelijk | Professionele PDF uit de frozen snapshot en KPI-presentatie werken; private Blob-foto's volledig in de formele PDF opnemen volgt |
| CC-04 | Planning en deadlines bewaken | Gedeeltelijk | Actie- en bevindingstermijnen plus e-mailescalatie met inboxkopie werken in code; productiemigratie en een echte provider-afleverproef volgen. Een externe planningskoppeling ontbreekt |
| CC-05 | Kosten en budgetten bewaken | Gedeeltelijk | BOQ-CSV wordt atomisch geïmporteerd met hoeveelheid, eenheid, prijs, contractwaarde en voortgang; kostenrecords zijn projectspecifiek. Budgettotalen en goedkeuringsflow wachten op CODECO-proceskeuze |
| CC-06 | Aannemersdeclaraties controleren | Gedeeltelijk | Declaraties hebben een projectspecifiek register; controle-, bewijs- en goedkeuringsflow wachten op CODECO-proceskeuze |
| CC-07 | Meer-/minderwerk met bewijs en besluit | Gedeeltelijk | Dagafsluiting vraagt wijzigingen/meerwerk; formele bewijs-, prijs-, besluit- en goedkeuringsflow ontbreekt |
| CC-08 | Kwaliteit, veiligheid, efficiency en kostenbesparing adviseren | Gedeeltelijk | Kwaliteit/HSE zichtbaar; adviesregistratie en besluitspoor ontbreken |
| CC-09 | Kwaliteit, transparantie, klanttevredenheid en commitment zichtbaar maken | Gedeeltelijk | Transparante status en opvolging aanwezig; formele audit en klantportaal ontbreken |
| CC-10 | Echte 360°-camerabeelden in plaats van telefoonpanorama's | Conform | De uploadflow benoemt dit als kernfunctie, vereist expliciete bronbevestiging, controleert 2:1 en minimaal 3840×1920 en toont de export interactief met sferische probleemmarkers |
| CC-11 | Tekeningpins met Procore-achtige recordkoppelingen | Conform | DWG-bronnen kunnen worden opgeslagen; PDF/JPEG/PNG/WebP-tekeningen worden per pagina bekeken en krijgen schaalvaste recordpins plus vrije lijnen, revisiewolken, pijlen en tekst zonder wijziging van het bronbestand |

## Klantdagrapport — 19 onderdelen

| ID | Klantonderdeel | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| CDR-01 | Projectinformatie, weer en werkuren | Gedeeltelijk | Context, rapportdatum, handmatig weer en werkuren worden centraal opgeslagen en verschijnen in het PDF-concept; aanvullende contractmetadata volgt |
| CDR-02 | Samenvatting van het verloop | Conform | De centrale vraag “Hoe is het project vandaag gegaan?” voedt rapport, PDF-concept en immutable centrale snapshot |
| CDR-03 | Aanwezigheid en partijen | Gedeeltelijk | Aanwezigheidsmodule slaat partijen, disciplines, diensten en aantallen centraal op en hergebruikt die in het rapport; bezoekersregister ontbreekt |
| CDR-04 | Werkzaamheden en voortgang | Gedeeltelijk | Gepland en uitgevoerd werk plus voortgangspercentage worden gevraagd; planningkoppeling ontbreekt |
| CDR-05 | Inspecties en controles | Gedeeltelijk | Volledige gepubliceerde checklistdetails, antwoorden, resultaat en automatische afwijkingen worden centraal opgeslagen; meettypes en PDF-weergave volgen |
| CDR-06 | Kwaliteitsbevindingen | Gedeeltelijk | Formele NCR/bevinding met ernst, partij, termijn, herstel, bewijsbeschrijving en verificatiestatus werkt; private Blob-bewijsbestanden en beeldmarkers kunnen traceerbaar worden gekoppeld |
| CDR-07 | HSE, incidenten en near misses | Gedeeltelijk | Formele HSE-registratie met type, ernst, directe maatregel, vertrouwelijkheid en kritieke escalatie werkt; onderzoek/afsluiting volgt |
| CDR-08 | Materieel en machines | Gedeeltelijk | Dagvraag en centraal materieelregister zijn beschikbaar; inzeturen, keuring en stilstandhistorie volgen |
| CDR-09 | Materialen en leveringen | Gedeeltelijk | Dagvraag en centraal leveringsregister zijn beschikbaar en private Blob-documenten kunnen centraal worden gekoppeld; een gespecialiseerde ontvangstcontrole volgt |
| CDR-10 | Proeven en metingen | Gedeeltelijk | Dagvraag, proefregister en checklistbasis zijn beschikbaar; gespecialiseerde meetwaarden, toleranties en certificaatkoppeling volgen |
| CDR-11 | Wijzigingen en meer-/minderwerk | Gedeeltelijk | Dagvraag en centraal wijzigingsregister werken; bewijs-, prijs-, besluit- en goedkeuringsflow volgt |
| CDR-12 | Vertragingen | Gedeeltelijk | Oorzaak en duur worden conditioneel gevraagd en een centraal vertragingsregister bestaat; gevolg- en claimanalyse ontbreken |
| CDR-13 | Communicatie en besluiten | Gedeeltelijk | Dagvraag plus registers voor communicatie, instructie, overleg en correspondentie werken; geadresseerden/documentreferenties worden verder gespecialiseerd |
| CDR-14 | Openstaande acties | Gedeeltelijk | Acties hebben eigenaar/partij, deadline, status, realtime updates en vervalmeldingen; expliciete dagoverdracht volgt |
| CDR-15 | Risico's en maatregelen | Gedeeltelijk | Start-/eindvragen en een centraal risicoregister werken; kans×impactmatrix en maatregelworkflow volgen |
| CDR-16 | Planning volgende werkdag | Gedeeltelijk | “Wat staat morgen gepland?” is verplicht voor rapportreview; centrale planningkoppeling ontbreekt |
| CDR-17 | Foto-overzicht | Gedeeltelijk | Gewone foto's en gevalideerde exports uit een speciale 360°-camera hebben titel, locatie, tourcontext, private Blob-upload/download en exacte probleemmarkers die als formele bevinding terugkomen. Visuele records kunnen tevens op een tekeningpagina worden gepind. Volledige PDF-opname volgt |
| CDR-18 | Bijlagen | Conform | Bijlagencontrole, centraal documentenregister, private Vercel Blob-bytes, geautoriseerde download en bestandsscope zijn actief |
| CDR-19 | Controle en ondertekening | Gedeeltelijk | Review/retour, naam/rol, append-only ondertekenverklaring, distributie en revisie werken. Juridisch niveau en vereiste ondertekenrollen moeten CODECO contractueel vaststellen |

## Technische architectuur

| ID | Keuze uit productplan | Status | Afwijking / herstelactie |
| --- | --- | --- | --- |
| TA-01 | React 19.2 + TypeScript strict | Conform | React 19.2.6 en strict TypeScript |
| TA-02 | Vite 8.1 + React Router 8, geen Next.js-applicatielaag | Klantafwijking | Op uitdrukkelijk klantbesluit wordt de webapp native als Next.js 16-app op Vercel gebouwd. De oude Sites/vinext-runtime is verwijderd; Supabase blijft de centrale datalaag en private Vercel Blob verzorgt bestandsbytes |
| TA-03 | MUI + Emotion en MUI X Community | Niet gestart | Thema en componentwrappers moeten de maatwerkprimitieven vervangen |
| TA-04 | TanStack Query 5 | Conform | Centrale workspace- en dagdata gebruiken querycaching en gerichte invalidatie na bevestigde mutaties |
| TA-05 | React Hook Form + Zod 4 | Conform | Projectstart en dagafsluiting gebruiken React Hook Form met Zod 4, schemaresolvers en conditionele validatie |
| TA-06 | Supabase Auth/Postgres/Realtime met RLS | Conform | Hosted Auth/Postgres, 25 uitgerolde versioned migrations, RLS op 44 browserbereikbare tabellen, atomische RPC's en Realtime-publicatie/invalidering zijn actief. De lokaal geteste migraties 26 t/m 28 voor geplande jobs, tekeningpins en de bindende PDF-eisen wachten op productieprojecttoegang |
| TA-07 | Google Drive als enige bestandsopslag via Worker-gateway | Klantafwijking | Op uitdrukkelijk klantbesluit gebruikt de applicatie private Vercel Blob. Beveiligde Next.js-routes valideren Supabase JWT/RLS; uploads gebruiken kort geldige, pad- en bestandstypegebonden upload-URL's en downloads blijven server-geautoriseerd |
| TA-08 | Bun workspaces + Turborepo + Biome | Tijdelijke afwijking | De gekozen Next.js-app gebruikt npm. GitHub Actions bewaakt inmiddels lint, productiebuild, webtests, dependency-audit, migraties, database-lint en pgTAP; een toolmigratie levert nu geen functioneel voordeel op |
| TA-09 | Client-side PDF uit immutable snapshot | Conform | Werk-PDF komt uit bevestigde centrale data; iedere formele revisie kan apart worden gedownload en wordt uitsluitend uit haar frozen snapshot opgebouwd, met revisie, frozen tijd en volledige SHA-256 in het document |
| TA-10 | Productiehosting | Conform | De native Next.js-app draait onder het CODECO Vercel-team op `code-co-nv.vercel.app`, met correcte rootdirectory, productie-environmentvariabelen, private Blob-store, veilige headers en geslaagde HTTP-smoketests |

## Open klantbesluiten

Deze onderwerpen blijven bewust **Geblokkeerd** totdat CODECO ze formeel bevestigt:

1. welke gegevens opdrachtgever en aannemer per object mogen zien;
2. definitieve dagrapport-, inspectie-, HSE- en NCR-formulieren;
3. contractuele bewaartermijnen;
4. vereist juridisch niveau van digitale ondertekening;
5. definitieve KPI-formules en eventuele contractuele betekenis;
6. definitieve productnaam en aanvullende huisstijlregels; het officiële bedrijfslogo is geleverd en geïntegreerd;
7. exacte werkwijze voor aannemersdeclaraties en budgetgoedkeuring.

## Beveiliging en betrouwbaarheid

| ID | Regel | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| SEC-01 | RLS op iedere browserbereikbare tabel, geïndexeerd en per rol getest | Conform | RLS staat op alle 44 browserbereikbare tabellen; policykolommen zijn geïndexeerd en de lokale zichtbaarheidsmatrix dekt alle acht productrollen plus een buitenstaander. Visuele records, tekeningpins en markeringen volgen actuele projectrechten en bewaakte RPC's |
| SEC-02 | Service keys en opslagtokens nooit in de React-app | Conform | De browser ontvangt uitsluitend een kort geldige upload-URL voor één object. `SUPABASE_SECRET_KEY`, Blob OIDC en eventuele Blob read-write fallback blijven uitsluitend in Vercel serverroutes |
| SEC-03 | Kritieke mutaties atomisch en idempotent | Gedeeltelijk | Dagrapport, aanwezigheid, registratie, inspectie, checklistinstallatie, BOQ-import, bevinding, HSE, tekeningmarkup, review/freeze, ondertekening, distributie, revisie, e-mailaflevering en back-upexport hebben databasebescherming. Productie-uitrol van migraties 26 t/m 28 volgt |
| SEC-04 | Append-only audit en immutable formele versies | Conform | Audit/history-tabellen blokkeren wijziging/verwijdering; report snapshots+SHA, reviews, signatures en distributions hebben integriteitstriggers en formele acties lopen uitsluitend via bewaakte RPC's |
| SEC-05 | Geldige statusovergangen en bevoegde verificatie in de database | Gedeeltelijk | Dagrapport-, actie-, inspectie- en bevindingstransities plus onafhankelijke verificatie zijn database-enforced; gespecialiseerde registers wachten op klantgoedgekeurde matrices |
| SEC-06 | Dependencycontrole zonder open productierisico's | Conform | Next.js 16.2.11, Sharp 0.35.3 en de veilige PostCSS-override zijn actief; `npm audit --omit=dev` rapporteert nul productiekwetsbaarheden. Build- en regressietests bevestigen compatibiliteit |
| SEC-07 | MFA, veilige headers, rate limits en foutmeldingen zonder gevoelige data | Gedeeltelijk | TOTP-inschrijving/verificatie, 12-teken wachtwoordbeleid, e-mailbevestiging, CSP/HSTS/frame/referrer/permissions-headers en database-backed admin-uitnodigingslimiet zijn actief. Verplichte AAL2 per risicorol volgt na CODECO-beleid |
| SEC-08 | Dagelijkse back-up, checksums en periodieke restoretest | Gedeeltelijk | Dagelijkse private Blob-back-up, volledige readback, SHA-256, inhoudsvalidatie, 7/4/3-retentie en maandelijkse integriteits-dry-run zijn gebouwd. Productiemigratie en eerste run moeten nog slagen; een off-accountkopie en echte tijdelijke database-restore blijven operationele vereisten |
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
| 18-07-2026 | Operationele werkruimte voor inspecties, automatische afwijkingen, bevindingen/NCR, formele HSE, zestien projectregisters en in-apptermijnmeldingen | PP-05, WF-08, MVP-07 t/m MVP-10, MVP-14, CC-01, CC-04 t/m CC-08 |
| 18-07-2026 | Formele rapportfreeze met SHA-256, review/retour, ondertekenverklaringen, distributiespoor en revisies met behoud van origineel | PP-07, MVP-03, MVP-13, CDR-19, SEC-03 t/m SEC-05 |
| 18-07-2026 | Beheer voor projectregels, locaties, partijen, checklists, TOTP en geverifieerde handmatige JSON-back-up/restore-dry-run | PP-06, MVP-02, MVP-15, MVP-17, MVP-18, SEC-07, SEC-08 |
| 19-07-2026 | Google Drive Worker op klantverzoek vervangen door private Vercel Blob met Supabase-geautoriseerde uploadreservering, kort geldige presigned upload, centrale voltooiingscontrole en private downloadstream | MVP-11, MVP-16, TA-07, SEC-02, SEC-03, SEC-08 |
| 19-07-2026 | Branded fout- en 404-pagina's, PWA-manifest, wachtwoordherstel, modalfocusbeheer en toegankelijke foutmeldingen toegevoegd; build, zeven webtests en dependency-audit slagen | PP-01, MVP-01, TA-10, SEC-06, SEC-07 |
| 19-07-2026 | Dagelijkse Vercel Cron voor gecomprimeerde organisatieback-up en in-appmeldingen, private Blob-readback/checksum, 7/4/3-retentie, maandelijkse integriteitscontrole en geautomatiseerde GitHub-releasegates gebouwd; productie-uitrol wacht op Supabase-projecttoegang | MVP-10, MVP-15, MVP-18, TA-08, SEC-03, SEC-08 |
| 18-07-2026 | Interne accountlevenscyclus met auditreden, atomische organisatie-/projectopschorting, heractivering, definitieve intrekking en bescherming tegen eigen lock-out | MVP-01, SEC-03, SEC-09 |
| 18-07-2026 | Centrale productiegereedheidschecklist met zestien account-, configuratie-, beheer-, besluit- en acceptatiepunten, blokkeringsstatus, veilige bewijsreferentie, beheerrechten en auditspoor | PP-07, PP-09, MVP-15, MVP-17, SEC-01, SEC-04 |
| 18-07-2026 | Gewone foto's als standaard bewijs, optionele interactieve 360°-camerabeelden/tours en exacte markers die atomisch een traceerbare bevinding plus bestandskoppeling maken | MVP-08, MVP-11, CDR-06, CDR-17, SEC-03 |
| 18-07-2026 | Engels als standaardinterface met persistente Nederlandse keuze voor login, inrichting, dagcockpit, projectregisters, visueel bewijs, rapportreview, accountbeheer en productiegereedheid | PP-01, PP-06, WF-01, WF-05 |
| 18-07-2026 | Migratie van de webapp naar native Next.js op Vercel, inclusief server-only adminroute, CSP/HSTS, Vercel-readinessitems en deploymentchecklist | TA-02, TA-10, SEC-02, SEC-07 |
| 18-07-2026 | Intrekking van projecttoegang direct doorgetrokken naar bestanden en visueel bewijs; uploader-eigendom geeft geen blijvende leesroute en bestandsscope is immutable | MVP-01, MVP-15, SEC-01, SEC-09 |
| 22-07-2026 | 360° herijkt als gevalideerde export uit een speciale camera (Insta360 of gelijkwaardig), met expliciete afwijzing van telefoonpanorama's en minimale inspecteerbare resolutie | MVP-11, CDR-17, CC-10 |
| 22-07-2026 | Beveiligde tekeningenwerkruimte met PDF-rendering, paginanavigatie en auditeerbare schaalvaste pins naar RFI, submittal, document, observatie/NCR, inspectie en visueel bewijs | MVP-14, CC-11, SEC-01, SEC-04 |
| 22-07-2026 | Bindende PDF-specificatie plus klantcorrecties afgerond met 100 checkliststandaarden, 360°-cameraweergave, tekenmarkup, DWG-bronupload, RFA/RFI/IR/TI/CO, BOQ, klikbare werkzaamheden, zelfgekozen perioderapport, push, offline beelden/databesparing, beeldmappen en WhatsApp-links zonder AI of SMS-notificaties | MVP-03, MVP-07, MVP-10, MVP-14, MVP-17, CC-02, CC-04, CC-05, CC-11, SEC-03 |
| 26-07-2026 | Drie klant-anchorchecklists projectspecifiek geautomatiseerd, actueel weer op projectlocatie vooraf ingevuld, secties met één tik akkoord, maximaal twaalf probleemfoto's per bevinding en een visuele first-use veldgids | CC-01, CDR-01, CDR-05, CDR-17, MVP-12, MVP-17 |
| 24-07-2026 | Dertien laat ontvangen klantformulieren verwerkt als beheerde RFI/RFA/WIR/TI/CO/ER/NCR-documenten, B1-issuecatalogus, gedateerde issuevoortgang en uitgebreid week-/maand-/gebouwrapport uit één centrale dataset | MVP-03, MVP-07, MVP-08, MVP-13, MVP-14, CDR-04 t/m CDR-07, CDR-11, CDR-13, CDR-17, CDR-19, SEC-03 t/m SEC-05 |
| 26-07-2026 | Dagrapportflow losgekoppeld van één vast gebouw: projectstart, dagafsluiting en aanwezigheid zijn per gebouw uniek in plaats van per dagrapport, een nieuwe `create_building`-RPC laat een project na oprichting groeien, rapportindiening vereist alle actieve gebouwen, de formele snapshot en PDF tonen een uitsplitsing per gebouw, en de zijbalk wisselt direct van gebouw zonder de projectcontext te verliezen | WF-01, WF-02, WF-03, WF-09, MVP-02 |
| 02-08-2026 | Actiecentrum omgebouwd tot het actiebord van het productplan: weergaven *Mijn werk / Al het projectwerk / Deadlines*, één instructie en de verantwoordelijke per regel, escalaties als één begrip en een rij die het record zelf opent in plaats van zijn module | MVP-09, CC-06, WF-08 |
| 02-08-2026 | 360°-camerabeeld gelijkgetrokken met de foto-opties: benoemde zoom-, draai-, gyroscoop- en volledig-schermbediening, kompas met kijkhoek en probleemstippen, genummerde markeringlijst die het beeld naar de marker draait, en de eigen omschrijving plus origineel openen/downloaden bij het beeld | MVP-11, CDR-17, CC-10 |

## Verificatie van deze slice

De lokale migratiereeks bevat nu 32 migraties. Migratie 32 met de drie anchorchecklists is foutloos toegepast op het repository-gekoppelde hosted CODECO-project. De Vercel-productieomgeving gebruikt nog Supabase-project `dljbeheogaeviokpcvca`; de app levert de drie checklists daar daarom aanvullend vanuit een ingebouwde catalogus en installeert het volledige pakket met één knop via de bestaande beveiligde checklist-RPC. Alleen de database-trigger voor volledig automatische installatie op ieder nieuw project wacht nog op een Supabase-account met projectrechten. De acht pgTAP-bestanden bevatten samen 333 geslaagde tests, naast dertien geslaagde webregressietests en een productie-audit met nul bekende kwetsbaarheden.

Hosted Auth blokkeert self-signup, vereist bevestigde e-mail, minimaal 12 tekens met kleine letter/hoofdletter/cijfer en ondersteunt TOTP. De native Next.js-productiebouw, strict TypeScript, ESLint, dertien webtests en `npm audit --omit=dev` met nul kwetsbaarheden slagen. GitHub Actions herhaalt deze controles en start daarnaast een lege Supabase-stack voor migratie-, schema-lint- en pgTAP-controle. Regels blijven **Gedeeltelijk** of **Geblokkeerd** waar migraties 26 t/m 28/productierun, een onafhankelijke back-upkopie, veld-UAT, e-mailprovider/domeinauthenticatie, hervatbare uploads na browserherstart, gespecialiseerde kosten-/declaratiegoedkeuring, juridisch ondertekenniveau, projectspecifieke formulieracceptatie/retentie/KPI's of aanvullende huisstijlbesluiten nog ontbreken.
