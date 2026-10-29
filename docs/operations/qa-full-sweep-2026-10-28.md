# QA-audit CODECO Supervisie — 2026-10-28

Er is niets in de code aangepast. Dit rapport verzamelt alles wat ik gevonden heb, zodat je er niet opnieuw voor hoeft te zoeken.

## 0. Wat is getest en wat niet

**Productie** (`https://code-co-nv.vercel.app/supervisie`), ingelogd door de gebruiker als *CODECO Administrator*:
- Alle hoofdschermen en tegels; Issue aanmaken, delen, aannemer-antwoord, intrekken, verifiëren, sluiten; PDF- en Word-export; Help, Meldingen, Gebouwen beheren, taalwissel; toetsenbordfocus.
- 360°-viewer, tekeningwerkruimte en pin-flow met bestaande PDF en 360°-foto (alleen daar bestaat Blob-opslag).
- Automatische UI-audit (contrast, afkapping, overflow, tikdoelen) op 9 schermen desktop en 5 op 375 px.

**Lokaal** (Docker hersteld, Supabase op `127.0.0.1:54321`, database gereset en geseed, dev-server :3000):
- **Contractor-a:** projectlijst, nieuw project, Overzicht, Werkruimte, Acties, Nieuwe actie, Rapid Verify, Project Docs, Middelen, Tekeningen, Foto's, Management, RFI met handtekening, URL-toegang, REST- en API-rechten.
- **Supervisor-a:** NCR, HSE (online en offline), workforce, werkdag starten, daglog, beide PDF-rapporten uitgelezen, offline-wachtrij en synchronisatie.
- **Client-a:** menu, tegels, formulieren, Acties, Management.
- **Inloggen:** leeg, verkeerd wachtwoord, onbekend adres, 8 pogingen achter elkaar, wachtwoord vergeten (mail gelezen), uitloggen met niet-verstuurd werk.

**Aanvullende ronde (alles wat eerder "niet getest" was):**
- **Upload op productie** met kleine gegenereerde testbestanden: tekening (`uploads 201 → complete 200` met SHA-256), 2 foto's via de fotostapel (`create_visual_capture`), en een 360°-beeld (`ew(file,"panorama")`); de 360°-viewer toont het nieuwe beeld.
- **Upload lokaal** (geen Blob-token): `POST /api/storage/uploads → 503` met de melding "Koppel eerst een private Vercel Blob-store aan dit Vercel-project."; foutafhandeling in de app getest via het PDR-formulier.
- **Formulieren lokaal als supervisor:** inspectie (15 punten, handtekening, automatische bevinding), TI, CO en PDR zijn ingediend.
- **Wachtwoordherstel tot het einde:** herstelmail gelezen, verifieer-link omgezet naar een sessie, scherm "Kies een nieuw wachtwoord" met validatie, nieuw wachtwoord werkt (200), oud niet (400), tweede gebruik van de link geeft `otp_expired`, verlopen link getoond aan de gebruiker.
- **Zoom en reflow** (Playwright, Chrome): 200 % (640×400 @2×), 400 % (320×256 @4×) en 320×568, op alle 18 schermen.
- **Toegankelijkheid** met axe-core (WCAG 2.0/2.1/2.2 A+AA en best-practice) op 18 schermen × 2 rollen en het inlogscherm; plus de accessibility tree en handmatige toetsenbordcontrole.
- **Suites:** eslint+stylelint, `tsc --noEmit`, design-guardrails, 190 node-tests, pgTAP (563 tests) en de volledige Playwright-gate (sectie 8).

**Nog steeds niet getest:** een echte schermlezer (NVDA/VoiceOver) en een echte bestandskiezer van het OS (uploads zijn gesimuleerd met `DataTransfer`); de herstelmail in het hostede productieproject (alleen lokaal gelezen).

Residu: productie bevat het gesloten issue **Q-2026-0008**, een automatisch aangemaakte mediamap per upload, de testbestanden `QA-sweep-tekening.png`, `QA-sweep-foto.jpg` (2×) en `QA-sweep-360.jpg`. Er is geen verwijderfunctie voor een gesloten issue. Lokaal staan Supabase-containers aan. Geen bronbestanden gewijzigd (alleen dit rapport en de fix-prompt zijn nieuw).

## 1. Samenvatting

| Ernst | Aantal |
| --- | --- |
| Hoog | 5 |
| Midden | 27 |
| Laag | 32 |

**Kan dit live?** De kern werkt: issue, NCR en HSE aanmaken, delen, offline opslaan en synchroniseren, pins op een tekening, de 360°-viewer, exports, en de rechtenbewaking aan de serverkant. Maar vijf dingen zijn te slecht om een klant mee te laten werken: (1) een contractor kan geen formulier indienen en ziet geen foutmelding, (2) het Actiecentrum is op elke telefoon kapot, (3) de deelknop op elke bevindingenkaart is onleesbaar, (4) het formele dagrapport schrijft bevindingen van het ene gebouw ook bij het andere gebouw, (5) op desktop kun je geüploade foto's niet omschrijven of opslaan omdat het paneel verborgen is. Het periode-PDF bevat ruwe Engelse waarden. De UI wijkt op veel plekken af van je eigen regels.

## 2. Hoog

### H1 · Contractor kan niets indienen en krijgt geen melding
- Rol: contractor. Lokaal. `?nav=project&tab=registers`.
- Stappen: RFI invullen (titel, omschrijving, ontvanger, naam, handtekening) → "Maak beheerd document". Verwacht: RFI of een foutmelding. Werkelijk: niets (2×, ook dubbelklik).
- Bewijs: `POST /rest/v1/rpc/create_day_report → 403`, `{"code":"42501","message":"new row violates row-level security policy for table \"day_reports\""}`.
- Oorzaak: `apps/web/lib/supabase/operations.ts:598-619` (`ensureProjectDayReport`) maakt altijd een dagrapport aan; de contractor heeft geen `reports.create` (`role-permission-matrix.md`). Zelfde functie bij issue, inspectie, HSE en register: `operational-workspace.tsx:2196, 2386, 2563, 2764`; `operations.ts:966, 1129, 1270, 1371, 1644`. Fout wordt niet getoond.
- Gevolg: RFI/RFA/WCR/WIR kunnen niet worden ingediend. Na uitloggen meldt de app "3 item(s) wachten nog" (de mislukte pogingen).

### H2 · Actiecentrum-tabbalk is kapot op elke breedte ≤ 1024 px
- Gemeten op productie (admin) en lokaal (contractor). `?nav=acties`.
- Op 375 px: grid van 4 kolommen (82 px) voor 3 tabs, tabs 161 px hoog, tekst letter voor letter verticaal ("M i j n w e r k"). 360 px: 78/78/160; 414 px: 92/92/187 (140 px hoog); 768 px: 177/177/358.
- Oorzaak (vermoeden): drie botsende regels op hetzelfde element: `app/styles/navigation.css:14-23`, `app/styles/sections/15-records.css:950`, `app/styles/sections/16-media.css:523-531`. Aangeroepen in `project-action-center.tsx:284`.

### H3 · Deelknoppen op bevindingenkaarten zijn onleesbaar
- Productie. Werkruimte → Issues. "Stuur naar externe partij" 1.00:1 en "WhatsApp-link · geen account nodig" 1.13:1 (wit op wit). Delen werkt wel via de banner direct na aanmaken.

### H4 · Formeel dagrapport-PDF is inhoudelijk fout
Gegenereerd via Rapporten → Review & onderteken → Rapport controleren → PDF (4 pagina's, uitgelezen).
- De sectie **"Nieuwbouw Oost"** toont dezelfde bevindingen en HSE-meldingen als Hoofdgebouw (Q-2026-0005, 0004, 0003, 0002, 0001, HSE-2026-0001/0002), ook die van een ander gebouw, en "Voortgang 70 %", terwijl ik voor dit gebouw geen voortgang invoerde.
- **"Inspecties: Uitgevoerd · afwijking gevonden"** terwijl het controle-venster "0 inspecties" meldt.
- **"Verwachte bezetting 42"** komt uit een vooringevuld standaardgetal in "Werkdag starten" (zie M13), niet uit invoer.
- Controle-venster zegt "0 kritiek" terwijl er een kritieke NCR (Q-2026-0002) bestaat.

### H5 · Op desktop (≥ 1025 px) kun je de fotostapel niet omschrijven of opslaan
- Gemeten op productie als administrator, `?nav=project&tab=files`, 1025 px en 1204 px breed.
- Werkelijk: `.media-actions-panel` is `display: none` (`app/styles/sections/15-records.css:382-387`; de groep `.media-library-toolbar, .media-actions-panel, .mobile-module-sheet-backdrop, .mobile-module-sheet`). Daarin zitten het gebouwfilter, "Filteren op" en de fotostapel met "Foto 1 · nog niet omschreven" en **"Fotostapel opslaan"**. Op ≤ 1024 px is hetzelfde paneel zichtbaar (grid, 801 px, review 591 px).
- Gevolg: een bureaugebruiker die "Foto's uploaden" gebruikt, krijgt de foto's in een onzichtbare stapel; de vaste balk "N gemaakte foto's zijn nog niet opgeslagen → Terug naar de foto's" verwijst naar hetzelfde onzichtbare paneel.
- Bewijs dat de backend werkt als het paneel zichtbaar is: met een tijdelijke stijl in mijn eigen tab zichtbaar gemaakt, "Fotostapel opslaan" gaf `uploads 201 → complete 200 → create_visual_capture 200` voor beide foto's.
- Voorbehoud: ik gebruikte een gesimuleerde bestandskeuze (`DataTransfer`). De CSS-regel en het gedrag per breedte zijn deterministisch gemeten; bevestig dit met een echte bestandskiezer.

## 3. Midden

| ID | Titel | Bewijs |
| --- | --- | --- |
| M1 | Help-venster wordt links afgekapt door de zijbalk en opent automatisch bij het eerste bezoek | Zijbalk `z-index:20` boven het venster; prod én lokaal. |
| M2 | Contractor en client zien beheerschermen en knoppen | Contractor opent `?nav=rapporten` (volledig scherm) en `?nav=meer`; beide rollen zien "Team beheren", "Taken beheren", "Opvolging toewijzen", "Medewerkers beheren", "Externe indiening registreren". Database geeft 0 rijen, geen datalek. Menunaam wisselt: "Instellingen" (contractor/client), "Management" (desktop), "Meer" (mobiel); scherm heet "Managementoverzicht". |
| M3 | Contractor én client zien "Nieuw geconfigureerd project" met voorgevulde productiegegevens | Database weigert (goed); melding "Controleer de projectcode" is misleidend; chip "Opslaan mislukt · probeer opnieuw" blijft na sluiten. |
| M4 | "Nieuwe actie" kan niet worden afgerond | Contractor lokaal: voor geen enkele partij medewerkers; hint verwijst naar "Management → Team en toegang" dat de rol niet heeft. Prod (admin): standaardpartij heeft lege lijst. |
| M5 | Foto-aantal verschilt | Tegel 20, lijst en Overzicht 22 (tegel telt 360° niet); DWG staat als "FOTO". |
| M6 | Verzend-knoppen zijn uitgeschakeld zonder reden | Issue (prod), HSE en NCR (lokaal): geen "Nog nodig"-regel; bij HSE is het verplichte veld "naam verantwoordelijke" met placeholder "Nog niemand van dit project staat in de app". Het RFI-formulier heeft de regel wel. |
| M7 | Issue-tellers kloppen niet onderling | Na sluiten: lijst 7, kop en tegel 6, Actiecentrum 8. |
| M8 | Tekening-pin: bevestigen ver weg, record opent niet | "Pin plaatsen" ±1200 px onder de tekening; "Open gekoppeld projectrecord" gaat naar de Issues-lijst met leeg formulier. |
| M9 | 360°-dialoog: knop "Markeer midden…" overlapt de bedieningsbalk | 8 px overlap (balk 722–766, knop 730–778). |
| M10 | Vaste balk "N foto's niet opgeslagen" dekt inhoud af | Project Docs, Middelen, mobiel. |
| M11 | Contrast onder 4,5:1 | "Nog open" 3,46; "Alle opvolging" 3,84; "Kwaliteit"/"Main building" 3,46; "Foto toevoegen" 3,86; grijze labels 4,1–4,4. |
| M12 | Periode-PDF ("Dagrapport" via Rapporten → PDF, 6 pagina's) bevat ruwe Engelse waarden | "Weer: cloudy · 29 °C · wind moderate", "HSE: near_miss", "QC: issues", statussen "in progress / recorded / assigned / open", ernst "high/critical/medium/low", labels "building name:", "due date:", "disposition: to be corrected", "progress percent:", "hse category:", "responsible person:", "immediate measure:", "action required", werkuren "07:00:00 16:00:00". Geen opdrachtgever, aannemer, supervisor of handtekening. |
| M13 | "Verwachte bezetting 42 personen" is vooringevuld | In "Werkdag starten"; komt in het PDF. Een verzonnen standaardwaarde. |
| M14 | Login-fouten worden niet voorgelezen | "Vul een geldig e-mailadres in" en "Gebruik minimaal 8 tekens" hebben geen `role="alert"`, `aria-live`, `aria-invalid` of `aria-describedby`. (De serverfout "E-mailadres of wachtwoord is onjuist." heeft wel een live-regio.) |
| M15 | Herstelmail is een Engelse standaardmail; herstellink gaat naar productie | "Reset your password" van `admin@email.com`; `redirect_to=https://code-co-nv.vercel.app` (`supabase/config.toml:159-163` laat alleen productie toe, de app vraagt `origin/supervisie`). Productie-instelling niet gecontroleerd. |
| M16 | Misleidende bevestiging na opslaan | HSE online: "Opgeslagen op dit apparaat. Foto's worden verzonden zodra je online bent." terwijl de server al had opgeslagen en er geen foto's waren. |
| M17 | Dagrapport mist wat je in je spec vraagt | Zie sectie 6. |
| M18 | Verlopen of al gebruikte herstellink toont geen uitleg | `…#error=access_denied&error_code=otp_expired` wordt genegeerd; de gebruiker ziet alleen het inlogscherm. |
| M19 | "Nog nodig"-regels zijn te vaag of wijzen het verkeerde aan | PDR: "velden en statusfoto van het vertragingsrapport" terwijl `delay-report.ts:181` ook categorie, soort, impact en inloopplan eist; de formulierkop vraagt "Foto op de oorspronkelijke einddatum *". CO: "gegevens wijzigingsopdracht" terwijl een scope-gebied moet worden aangevinkt (`change-order.ts:176`). |
| M20 | PDR wordt opgeslagen vóór de verplichte foto's zijn bevestigd | `create_project_register_entry → 200` terwijl beide foto-uploads `503` gaven; de app meldt "2 foto-upload(s) niet bevestigd…". Een formeel document zonder verplichte bijlage bestaat dan al. |
| M21 | 360°-upload toont na een geslaagde online upload "Opgeslagen op dit apparaat. Wordt verstuurd zodra je online bent." | Prod: `uploads 201 → complete 200 → create_visual_capture 200`, tóch die melding (zelfde patroon als M16). |
| M22 | Keuzelijsten zonder naam (axe `select-name`, kritiek) | 6 nodes op Issue en HSE: `.record-order-2 > .form-field > select`, `.record-responsible-field > select`. |
| M23 | Contrast: 62 nodes op 16 schermen (axe `color-contrast`) | `#707780` op `#fafbfb`/`#f6f7f6`/`#f3f5f6` = 4,13–4,36:1 (`.overview-progress small`, `.controlled-document-register-heading span`, `.workforce-headline span`, `.attention small`, `.workspace-current-module b`, `.document-status`, `.complete small`); `#cf6300` op `#fff0e4` = 3,46:1 (actieve tegels, `.building-multi-options .active`, `.media-folder-bar .active`, `.action-center-summary .active`). Het zijn token-waarden, dus één correctie lost veel op. |
| M24 | Bij 400 % zoom (320 px) lopen twee schermen over de rand | Middelen 349 px ("Voeg een projectmiddel toe", "Maak foto", "Foto's uploaden"), Management 412 px (actieregels). 200 % zoom is schoon op alle 18 schermen. |
| M25 | Oriëntatiepunten en koppen | `aside` binnen een andere landmark (`.action-focus-card` op Acties, `.rapid-source-panel` op Rapid Verify); koppenvolgorde (`h3` in vindingkaart, NCR, Project Docs); inlogscherm heeft geen `main` en inhoud buiten een landmark. |
| M26 | Een geüploade tekening telt als foto; elke upload maakt een mediamap | Foto-teller 22 → 23 na een tekening (PNG); `create_media_folder` bij elke upload (2 mappen na 2 uploads). |
| M27 | Balk "N gemaakte foto's zijn nog niet opgeslagen" blijft staan na opslaan | Verdwijnt pas na herladen. |

## 4. Laag

- L1 Concept-tijd in 12-uurs ("05:16 PM"); tijdvelden tonen AM/PM.
- L2 RFI-formulier: Engelse voorbeeldchip "Detailed specifications for the server room of B1 second floor"; "Functie" vooraf "Construction Supervisor" voor een contractor; "Aan:" heeft dubbele punt, andere labels niet; label raakt chips.
- L3 Native `window.confirm()` voor pin verwijderen (`drawing-workspace.tsx:1194`) naast inline bevestigingen; dat maakt knoppen in testbrowsers schijnbaar dood ("Intrekken").
- L4 Tekeningpaneel: ±300 px leeg; permanente balk "Originele tekening blijft ongewijzigd" ook zonder tekening.
- L5 Zijbalk-projectkeuze kapt naam en locatie af op 110 px.
- L6 Losse knoppen "Open normale foto" / "Open 360°-beeld" in lege kaart onder de Issue-filters.
- L7 Filter "Auteur" bevat alleen "Alle auteurs" (prod en lokaal).
- L8 Toegankelijkheid: acht "Directe maatregel"-checkboxes heten "on"; code-invoer "Gebouw toevoegen" alleen placeholder; geen skip-link.
- L9 NL/EN-mix: NCR-labels "Priority", "Issue Type", "Date Identified", "Expected Resolution Date", "Escalation Required (Y/N)"; HSE-types "Safety, Health, Environment, Near miss, Incident"; "Issues", "Workforce", "Change order (CO)", "Project Docs".
- L10 Ongeldig `?project=<id>` valt stil terug op de projectlijst.
- L11 Deelpagina: groene primaire knop (app gebruikt oranje), rood hoofdletter-label "CODECO N.V. · SUPERVISIE", verspringende labels, badge blijft "Open" (LQA-013).
- L12 Testdata op productie: "TEST 360 — DELETE ME", "Test phase 3", "Sweep tile".
- L13 Tikdoelen onder 44 px op 375 px: checkboxes 13–22, "Dicteren" 38, "Overig · omschrijf" 21, sluitknop 360° 36 (LQA-015).
- L14 Contractor leest naam, telefoon en taal van teamleden (`profiles`).
- L15 Oude meldingen blijven staan na schermwissel ("Pin opgeslagen.", "…rapport gedownload.", "Opgeslagen op dit apparaat…").
- L16 Eén opslag veroorzaakt 6 permissie-RPC's (2× `can_bootstrap_organization`, 4× `can_manage_organization_members`); `create_day_report` 2× per klik.
- L17 `POST /api/notifications/dispatch → 503` lokaal (push-sleutels niet ingesteld), gebruiker ziet niets.
- L18 Validatiefout "Kies de geplande werkzaamheden" staat ver boven de verzendknop in "Werkdag starten"; de eerste klik lijkt niets te doen.
- L19 Geen vertraging of lockout na 8 mislukte logins in ±15 s (lokale instelling, productie niet gecontroleerd).
- L20 PDF-details: "Aanwezig 1 personen"; koptekst breekt "Readi- ness Demo"; "Persoon toevoegen" 3× klikken geeft 1 persoon zonder uitleg.

- L21 Overzicht (prod, admin) meldt "Nog geen activiteit" en "Geen werk vastgelegd" terwijl het project 10 inspecties, 22 foto's en 7 open bevindingen heeft; leest als "er is niets gebeurd".
- L22 Management toont "Projectlocaties 0" terwijl het project 2 gebouwen heeft; onduidelijk wat een "locatie" is.
- L23 Acties: "Wacht op jouw controle" (tab) en "Wacht op verificatie" (zijblok) lijken hetzelfde; "Alle registraties" 7/8 naast "1/9" in de filterbalk.
- L25 Inspectie afronden stuurt 15 afzonderlijke `save_inspection_response`-aanroepen plus `complete_project_inspection`; trager en kwetsbaar bij een wegvallende verbinding.
- L26 Meer NL/EN-mix in inhoud: bevinding "Afgekeurd controlepunt: Inspection records are complete and approved."; checklists in het Engels ("All personnel wear the required PPE."); TI-keuzelijsten "Architectural/Structural", "None/Possible/Confirmed"; "Cast-in anchors · after concrete casting".
- L27 Pagina "Visueel bewijs" toont een onopgemaakt browserveld "Choose File / No file chosen" in een verder opgemaakt formulier.
- L28 pgTAP is niet geïsoleerd van seed-data: op een geseede database falen 14 bestanden (honderden tests); alleen na `db reset` slaagt alles. Geen pgTAP-test dekt een contractor die een dagrapport aanmaakt (H1 bleef daardoor onopgemerkt).
- L29 De upload-API antwoordt bij een ontbrekende Blob-store met een beheerderstekst ("Koppel eerst een private Vercel Blob-store aan dit Vercel-project."); controleer dat gebruikers die nooit te zien krijgen.
- L30 Na het opslaan van een nieuw wachtwoord sta je ingelogd op de projectlijst zonder bevestiging dat het wachtwoord is gewijzigd.
- L31 Validatiemeldingen op het herstelscherm ("Gebruik minimaal 12 tekens", "De wachtwoorden zijn niet gelijk") worden net als bij inloggen niet aan schermlezers aangekondigd.
- L32 Na het openen van een scherm met records (bijvoorbeeld Technische instructies) verschijnt de lijst en valt de pagina daarna terug op "Loading project records…": twee keer laden, zichtbaar als flikkering en de oorzaak van de falende `double-submit`-test.
- L24 Console op `/supervisie` (prod): zes waarschuwingen "preloaded but not used" voor CSS en lettertypes; één niet te herleiden 401 bij de eerste laad van Werkruimte; "Projectregisters laden…" duurde eenmalig >6 s op een directe URL.

Bekend, niet nieuw: LQA-011 (Project Docs 2 `h1`), LQA-013, LQA-015.

## 4b. Oorzaken die in de code zijn aangewezen

| Bevinding | Plek | Wat er gebeurt |
| --- | --- | --- |
| H1 | `lib/supabase/operations.ts:598-619`; `supabase/migrations/202607180001_core_supervision_foundation.sql:780` | `create_day_report` is `security invoker`; RLS op `day_reports` weigert rollen zonder `reports.create`. Elke opslag roept het eerst aan. |
| H2 | `styles/navigation.css:14-23`, `styles/sections/15-records.css:950`, `styles/sections/16-media.css:523-531`, `project-action-center.tsx:284` | Drie regels op één element: kolom-flow, 2 kolommen in rijen, en "laatste oneven kind over alle kolommen". |
| H3 | `operational-workspace.tsx:5184, 5349` | Knopstijl met witte tekst op witte achtergrond. |
| H4 (gebouwen) | `operational-workspace.tsx:2971-2981` | `dayLogToday` filtert op datum, niet op gebouw; elk gebouw krijgt alle bevindingen en HSE van het project. |
| H4 (inspectie) | `daily-log-modal.tsx:66-68` | `inspectionResult` wordt "issues" zodra er bevindingen zijn, ook zonder inspecties. |
| H4/M13 (bezetting 42) | `codeco-supervision-app.tsx:2632` | `expectedWorkers: 42` als standaardwaarde. |
| M3 | `codeco-supervision-app.tsx:646, 2455` | Eén vaste tekst voor elke mislukte opslag, ook bij een rechtenfout. |
| M6/M16-HSE placeholder | `operational-workspace.tsx:3445, 3848` | Placeholder "Nog niemand van dit project staat in de app" op het naamveld. |
| L1 | `forms/draft-notice.tsx:10` | `toLocaleTimeString([], …)` volgt de browsertaal (12-uurs). |
| L2 | `operational-workspace.tsx:1888`; `lib/forms/controlled-project-documents.ts:75` | Engelse voorbeeldchip; standaardfunctie "Construction Supervisor". |
| L9 | `operational-workspace.tsx:3631-3634` | NL-label is Engels ("Date Identified", "Expected Resolution Date", "Escalation Required (Y/N)"). |
| L3 | `drawing-workspace.tsx:1194` | `window.confirm()`. |
| M2 (menunaam) | `codeco-supervision-app.tsx:234, 666` | Menu "Instellingen" vs "Management". |
| M12 | `lib/reports/period-report-pdf.tsx`, `period-report-docx.ts` (+ `report-vocabulary.ts` bestaat al) | Ruwe waarden worden zonder vocabulaire geprint. Exacte regels niet aangewezen. |

## 5. Wat werkt (bewezen)

- Issue/NCR/HSE aanmaken; status open → gereed voor verificatie → geverifieerd/gesloten; speciale tekens en emoji veilig opgeslagen.
- Deellink: aanmaken, uitgelogd openen, aannemer-antwoord, intrekken (404), `noindex`.
- **Offline:** melding "Geen verbinding · je werkt vanaf dit apparaat", chip "Offline", opslaan geeft "Opgeslagen op dit apparaat. Wordt verstuurd zodra je online bent.", badge "QUEUED OFFLINE", bij terugkeer `create_project_hse_event → 200` en "gesynchroniseerd".
- Uitloggen met niet-verstuurd werk: duidelijke keuze (bewaren / blijven / weggooien).
- Login: generieke fout, geen account-enumeratie, wachtwoord-vergeten-antwoord lekt niets.
- 360°-viewer (slepen, zoomen, beginstand, vanzelf draaien); tekeningpins (plaatsen, bewaren na herladen, verwijderen).
- Handtekeningvenster (tekenen, ongedaan maken, wissen). Autosave van concepten.
- PDF/Word-export werkt (prod 71/74 KB; lokaal 75/78 KB).
- Rechten: contractor ziet 0 rijen bij bevindingen, acties, inspecties, HSE, bestanden, audit; `/api/admin/users` en `/api/admin/project-role` geven 403 (geldige body); zonder sessie 401. Client heeft geen formulieren, geen "Nieuwe actie", HSE alleen-lezen.
- CSP beperkt `connect-src` (blokkeerde zelfs mijn lokale ontvanger).
- Responsief: geen horizontaal scrollen op 375/768/1024; onderbalk ≤1024 px.

## 6. Dagrapport tegenover jouw spec (uit de echte PDF)

Er zijn **twee** "dagrapporten":
1. *Rapporten → Dagrapport → PDF* geeft het **periode-rapport** ("Dagelijks supervisierapport · Geconfigureerd klantrapport"); zie M12.
2. *Rapport controleren → PDF* geeft het **formele dagrapport** met je 19 punten (`lib/reports/daily-report-pdf.tsx`).

Uitgelezen formeel PDF (Nederlands, 4 pagina's):

| Jouw onderdeel | In het PDF | Ontbreekt |
| --- | --- | --- |
| 1 Algemeen | project, code, gebouw, locatie, supervisor, weer, werkuren | opdrachtgever, aannemer, bewolking/regen |
| 2 Samenvatting | eerste regel van "wat loopt" | eigen veld, begrenzing |
| 3 Aanwezigheid | "Aanwezig 1 personen" | tabel per organisatie (data bestaat in Workforce) |
| 4 Werkzaamheden | lopend/afgerond als tekst, één voortgang-% | tabel activiteit · locatie · % |
| 5 Inspecties | "Uitgevoerd · afwijking gevonden" (zie H4) | lijst met meetwaarden |
| 6 Kwaliteit | één regel "Q-nr titel; Q-nr titel" | ernst, status, locatie, foto, tekening, norm, verantwoordelijke, deadline |
| 7 HSE | één regel per melding | checklist PBM/steigers/valbeveiliging, near miss apart |
| 8–10 Materieel, leveringen, testen | tekst of "Niet geregistreerd" | tabellen |
| 11 Meerwerk | "Niet van toepassing" | lijst |
| 12 Vertraging | "Geen vertraging" | meerdere oorzaken |
| 13, 15, 16 | tekst | – |
| 14 Actiepunten | alleen "Registraties 2 dagregistraties" | lijst actie · verantwoordelijke · deadline |
| 17 Foto's | "Foto's 0" | fotonummer, tijd, GPS, locatie |
| 18 Bijlagen | "Nog niet bevestigd" | lijst |
| 19 Handtekening | drie blokken "Nog niet ondertekend" | – |
| Dashboard-KPI's | niet aanwezig | alle |

De gegevens voor de meeste tabellen bestaan al in de app (bevindingen, acties, workforce, foto's); ze komen niet als tabel in het rapport.

## 7. Naleving CLAUDE.md (UI)

- Hoofdletter-eyebrow en groene primaire knop op de deelpagina (L11).
- Contrast en onleesbare knoppen (H3, M11); vaste balk die inhoud afdekt (M10); Help onder de zijbalk (M1).
- Vooringevulde verzonnen getallen: bezetting 42 (M13).
- Niet gezien: decoratieve gradients, glas, getinte icoonvierkanten, geneste kaarten, oneindige animatie.

## 8. Bestaande testsuites (lokaal, tegen `127.0.0.1`, niets tegen productie)

| Suite | Commando | Uitkomst |
| --- | --- | --- |
| ESLint + stylelint | `npm run lint` | 0 fouten |
| TypeScript | `npx tsc --noEmit` | 0 fouten |
| Design-guardrails | `npm run test:design` | 9/9 geslaagd |
| Node-tests incl. productiebuild | `npm test` | 190/190 geslaagd, 0 overgeslagen |
| pgTAP | `npx supabase test db` na `db reset` | 20 bestanden, 563 tests, **PASS**. Op een geseede database falen 14 bestanden (zie L28). |
| Playwright, alle specs, 3 viewports (productiebuild) | `npx playwright test` | 180 tests: **106 geslaagd, 1 gefaald, 73 overgeslagen** (8,3 min) |
| Playwright, extra run met client- en contractor-gegevens en `CODECO_AUDIT_SWEEP=1` | `double-submit role-views overview-counts audit-sweep two-party-signature session-revoked` | 15 geslaagd, 1 gefaald (dezelfde), 14 overgeslagen (viewport-afhankelijk) |
| axe-core + zoom (eigen script) | zie sectie 0 | zie M22–M25 |

**De ene Playwright-fout** — `double-submit.spec.ts:36` ("two taps on 'Create controlled document' create one document"), reproduceerbaar 2×: verwacht 1, gevonden 0. De pagina-snapshot bij falen toont wél precies één document (`TI-E2E-001-001`, "Double tap …"): de fix voor dubbel klikken (LQA-006) werkt. De test telt echter terwijl het scherm na de eerste weergave van de records terugvalt op "Loading project records…" (screenshot). Dat is een test-race én een echte flikkering: de lijst verschijnt en wordt daarna vervangen door een laadscherm (L32).

**Overgeslagen** (73 + 14): bijna alles is bewust per viewport (`test.skip(project !== "desktop-office")`) of opt-in. Zonder client- en contractor-gegevens werden de `role-views`-tests overgeslagen; in de extra run slagen ze alle drie. `media-and-sharing` (foto-stapels, 360°, tekeningpins en delen end-to-end) blijft overgeslagen: het vereist testfoto's en een tekening via `CODECO_E2E_PHOTO_*` en `CODECO_E2E_DRAWING`, en lokaal een Blob-store.

**Wat de suites niet vangen** (daarom bleven bevindingen onopgemerkt): H1 (geen pgTAP- of e2e-test voor een contractor die iets indient), H2 (tabbalk op 360–414 px), H3 en M11/M23 (contrast), H4 (dagrapport met twee gebouwen), H5 (fotopaneel op ≥ 1025 px), M2 (contractor opent `?nav=rapporten`), M5/M7 (tellers met een gesloten issue).

## 9. Niet getest en wat daarvoor nodig is

| Onderdeel | Reden en wat er nodig is |
| --- | --- |
| Echte schermlezer (NVDA, JAWS, VoiceOver) | Alleen axe-core, de accessibility tree en toetsenbordcontrole; een mens met een schermlezer moet de belangrijkste flows doorlopen. |
| Echte bestandskiezer van het besturingssysteem | Uploads zijn gesimuleerd met `DataTransfer`; bevestig H5 en de uploadflows met een echte keuze. |
| `media-and-sharing.spec.ts` | Vereist een Blob-store en testbestanden via `CODECO_E2E_PHOTO_1..3` en `CODECO_E2E_DRAWING`. |
| Herstelmail, loginlimiet en mailsjabloon in het hostede Supabase-project | Alleen lokaal gelezen; dashboard-instellingen. |
| Productie-herstel van een wachtwoord | Niet uitgevoerd (zou een echt account wijzigen). |

Wat eerder "niet getest" was en nu **wel** is getest: upload van foto, 360° en tekening (productie), inspectie/TI/CO/PDR indienen, wachtwoordherstel tot het einde, 200 %/400 % zoom, toegankelijkheidsscan en alle suites.

## 10. Volgorde om te fixen

1. H1 — `ensureProjectDayReport` mag niet falen voor rollen zonder `reports.create`; toon fouten.
2. H4 — per-gebouw-filter in het formele dagrapport; inspectie-tekst; geen verzonnen standaardbezetting.
3. H2 — Actiecentrum-tabbalk (drie botsende CSS-regels).
4. H3 — kleur van de deelknoppen.
5. M12 — periode-PDF vertalen en ruwe waarden vervangen; opdrachtgever/aannemer/handtekening toevoegen.
6. M2/M3 — scherm- en knoprechten voor contractor en client; één naam voor het beheerscherm.
7. M6/M4 — reden bij uitgeschakelde knoppen; lege selecties uitleggen.
8. M1/M10 — Help boven zijbalk; vaste balken zonder overlap.
9. M14/M15/L8 — toegankelijkheid van login en checkboxes; Nederlandse herstelmail en juiste redirect.
10. Dagrapport-tabellen uit bestaande data (sectie 6), tellers (M5, M7), contrast (M11).
