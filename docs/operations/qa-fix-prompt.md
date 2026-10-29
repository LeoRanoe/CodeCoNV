# Opdracht: alle QA-bevindingen oplossen en de app verbeteren

Plak dit als opdracht in een nieuwe sessie met toegang tot `D:\CodeCoNV`. Het bijbehorende rapport is `docs/operations/qa-full-sweep-2026-10-28.md`. Lees dat eerst. Elk ID hieronder (H1–H5, M1–M27, L1–L32) staat daar met bewijs.

## Rol en doel

Je bent een senior full-stack engineer voor CODECO Supervisie (`apps/web`, Next.js, Supabase). Los **alle** bevindingen uit het rapport op: functionaliteit, UI en gebruiksvriendelijkheid. Laat niets liggen. Is een punt niet op te lossen zonder besluit van de productowner, schrijf dan precies op welk besluit nodig is en implementeer de veiligste tussenoplossing.

## Harde regels

1. **Productie is verboden terrein.** `apps/web/.env` wijst naar productie (Supabase `dljbeheogaeviokpcvca` + Blob). Draai nooit seeders, tests of schrijfacties daartegen. Gebruik alleen `apps/web/.env.development.local` en `.env.production.local` (beide `127.0.0.1:54321`). Controleer vóór elke schrijfactie dat de Supabase-URL lokaal is.
2. **Werk op een nieuwe branch** `fix/qa-sweep-2026-10-28` vanaf de huidige branch. Kleine, afzonderlijke commits per werkpakket. Geen push, geen PR, geen deploy zonder dat de gebruiker dat vraagt.
3. **Lees eerst** `CLAUDE.md`, `apps/web/AGENTS.md` (Next.js 16 heeft breaking changes: lees de relevante gids in `apps/web/node_modules/next/dist/docs/` vóór je Next-specifieke code schrijft), `docs/product/design-direction.md`, `docs/operations/ui-ai-slop-audit.md`, `role-permission-matrix.md`, `live-qa-bug-register.md`.
4. **UI-regels uit CLAUDE.md:** tokens uit `apps/web/app/styles/tokens.css`; statuskleur alleen voor recordstatus; oranje alleen voor huidige selectie en één primaire actie per scherm. Geen decoratieve gradients, glas, getinte icoonvierkanten, hoofdletter-eyebrows boven koppen, gekleurde modules, geneste kaarten, nep-lege-staat-inhoud, verzonnen cijfers of looping animatie. Behoud gedrag, rechten, datastroom, toegankelijke namen, rollen en testselectors.
5. **Copy:** feiten in plaats van proza, kort, Nederlands in de NL-interface; behoud offline-, fout- en juridische teksten (zie geheugen: "rustige operationele copy").
6. **Elk punt krijgt een test** (node-test, pgTAP of Playwright) die zonder de fix faalt, tenzij het puur visueel is; dan een Playwright-meting of screenshot-assertie in `tests/e2e`.
7. **Pas bestaande bugs niet over aan de testsuite** (geen tests versoepelen om groen te worden). `tests/design-baseline.json` mag alleen mee bewegen als een wijziging bewust is, met uitleg in de commit.
8. Werk elk punt af met: bewijs dat het gefixt is (testuitvoer en een browsercontrole op de lokale dev-server), niet "zou moeten werken".

## Lokale omgeving (vanuit de repo-root, in bash)

```bash
export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"
npx --yes supabase@2.109.1 start
npx --yes supabase@2.109.1 db reset
npx --yes supabase@2.109.1 status -o env      # noteer API_URL, PUBLISHABLE_KEY, SECRET_KEY
```
Seed (vanuit `apps/web`, met `CODECO_E2E_SUPABASE_URL`, `CODECO_E2E_PUBLISHABLE_KEY`, `CODECO_E2E_SECRET_KEY` uit de status-uitvoer):
```bash
node tests/e2e/seed-local-fixtures.mjs
node tests/e2e/seed-ui-demo-data.mjs
```
Dit geeft `supervisor-a@codeco.test`, `client-a@codeco.test`, `contractor-a@codeco.test` (wachtwoorden staan in de seed-uitvoer). Dev-server: preview-server `codeco-web-dev` (`.claude/launch.json`), niet via Bash. Start Docker Desktop als de engine niet draait; bij `dockerInference: The file cannot be accessed` hernoem `%LOCALAPPDATA%\Docker\run` en `%LOCALAPPDATA%\docker-secrets-engine` naar `*.stale-<timestamp>` en start opnieuw. Een `db reset` maakt browsersessies ongeldig.

Controles die altijd moeten slagen vóór je klaar bent (vanuit `apps/web`):
```bash
npm run lint
npm run test            # bouwt en draait de node-tests
npm run test:design
npx playwright test     # relevante specs; de volledige gate duurt ±17 min
```
En vanuit de root: `npx supabase test db` (pgTAP, na `db reset`, vóór je opnieuw seedt).

## Werkpakketten

Volgorde is bewust: eerst wat gebruikers blokkeert.

### WP1 — Contractor kan indienen; fouten worden getoond (H1, M4, L16, L17)
**Probleem.** `ensureProjectDayReport` (`lib/supabase/operations.ts:598-619`) roept altijd `create_day_report` aan. Die functie is `security invoker` (`supabase/migrations/202607180001_core_supervision_foundation.sql:780`); RLS op `day_reports` weigert rollen zonder `reports.create`. De contractor kan daardoor geen RFI/RFA/WCR/WIR (en niets anders) indienen en ziet geen melding (`POST …/rpc/create_day_report → 403`, SQLSTATE 42501). Aanroepers: `operational-workspace.tsx:2196, 2386, 2563, 2764`, `operations.ts:966, 1129, 1270, 1371, 1644`.
**Te doen.**
- Nieuwe migratie (volgnummer na `202610100005`): laat `create_day_report` (of een nieuwe, smalle functie `ensure_day_report_for_record`) een bestaand dagrapport van die datum teruggeven of aanmaken voor elke projectlid die in dat project minstens één schrijfrecht heeft (`records.create`, `actions.create`, `findings.create`, `hse.manage`, `inspections.manage`, `files.manage`). `security definer`, `set search_path = pg_catalog, public`, volledige membership- en statuscontrole (geschorst/ingetrokken = geweigerd), idempotent, en **geef geen leesrecht op rapporten** door het aanmaken.
- pgTAP `021_*`: contractor en supervisor kunnen een dagrapport verzekeren; `external_guest`, geschorst lid en lid van een ander project niet; geen rapportinhoud leesbaar voor de contractor.
- UI: elke mislukte opslag toont een specifieke Nederlandse melding in `run()` (rechten, verbinding, validatie). Nooit stil falen. Test: Playwright met een contractor die een RFI indient.
- Verminder verkeer: `create_day_report` 2× per klik en 6 permissie-RPC's per opslag (2× `can_bootstrap_organization`, 4× `can_manage_organization_members`): cache of dedupliceer.
- `notifications/dispatch → 503` zonder geconfigureerde push-sleutels: geen stille fout; behandel als "push niet actief" zonder gebruikersmelding, maar log het.
- "Nieuwe actie": als een partij geen medewerkers heeft, toon een duidelijke tekst met wat de gebruiker kan doen (en niet verwijzen naar een scherm dat de rol niet heeft); bied waar de rol het mag het toewijzen aan de partij zelf.
**Klaar als:** contractor-a dient een RFI in en ziet het document; een geweigerde actie toont een begrijpelijke melding; pgTAP en Playwright slagen.

### WP2 — Formeel dagrapport klopt per gebouw en volgt de spec (H4, M13, M17, L20)
**Problemen.** (a) `dayLogToday` (`operational-workspace.tsx:2971-2981`) filtert op datum, niet op gebouw: elk gebouw toont alle bevindingen en HSE van het project. (b) `closeoutFromToday` (`daily-log-modal.tsx:60-79`) zet `inspectionResult` op "issues" zodra er bevindingen zijn, ook bij 0 inspecties ("Uitgevoerd · afwijking gevonden"). (c) `expectedWorkers: 42` standaard (`codeco-supervision-app.tsx:2632`). (d) Voortgang 70 % bij een gebouw waarvoor dat niet is ingevoerd. (e) "Rapport controleren" meldt "0 kritiek" terwijl een kritieke NCR bestaat. (f) "Aanwezig 1 personen", koptekst breekt "Readi- ness".
**Te doen.**
- Filter `dayLogToday` per `building_id` (inclusief records die aan meerdere gebouwen hangen via `record_buildings`).
- `inspectionResult`: "none" zonder inspecties; "all_ok" of "issues" alleen op basis van inspecties.
- Geen standaardbezetting: laat het veld leeg (of vul met de vorige werkdag) met een duidelijke "nog niet ingevuld"-status; maak het geen verplicht verzonnen getal.
- Voortgang per gebouw: geen overname; leeg tot ingevuld.
- Tel "kritiek" uit de werkelijke records van het gebouw/rapport.
- Pas `lib/reports/daily-report-pdf.tsx` (en `daily-report-docx.ts`) aan naar de 19-punts-opbouw uit de opdrachtgever, met **tabellen** in plaats van losse tekst:
  1 projectkop incl. opdrachtgever, aannemer, supervisor, weer (conditie, temperatuur, bewolking, regen, wind), werktijden;
  3 aanwezigheid per organisatie en discipline (uit Workforce);
  4 werkzaamheden: activiteit · locatie · % gereed;
  5 inspecties met resultaat en meetwaarde;
  6 kwaliteitsbevindingen: nr · omschrijving · ernst · status · locatie · foto · tekeningverwijzing · verantwoordelijke · deadline;
  7 HSE-checklist en near miss apart;
  8–10 materieel, leveringen (hoeveelheid, leverancier), testen en metingen als tabellen;
  11 meer- en minderwerk; 12 meerdere vertragingsoorzaken met uren; 13 communicatie; 14 openstaande acties (actie · verantwoordelijke · deadline); 15 risico's; 16 planning morgen; 17 fotolijst (nummer, tijd, GPS, locatie, omschrijving, categorie); 18 bijlagenlijst; 19 handtekeningen;
  en bovenaan een KPI-blok (voortgang, inspecties, afwijkingen, kritiek, incidenten, open acties, foto's, weervertraging, arbeiders, machines), alleen uit echte data, nooit uit standaardwaarden. Waar data ontbreekt: "Niet geregistreerd".
- "1 persoon / 2 personen" correct meervoud; koptekst zonder afbreking midden in woorden; geen onzichtbare tekens.
- Productowner-besluit nodig over: één dagrapport per gebouw of per project, en of het periode-rapport en het formele dagrapport samenvallen (nu twee verschillende documenten; zie WP3).
**Klaar als:** een PDF met twee gebouwen toont per gebouw alleen eigen bevindingen en HSE, geen verzonnen getallen, alle 19 onderdelen en het KPI-blok; unit-test op `closeoutFromToday` en een Playwright-test (`day-report-lifecycle.spec.ts` uitbreiden); de PDF-tekst wordt in een test uitgelezen en vergeleken.

### WP3 — Periode-rapport in correct Nederlands (M12)
**Probleem.** *Rapporten → Dagrapport/Week/Maand → PDF* ("Dagelijks supervisierapport · Geconfigureerd klantrapport") toont ruwe waarden: "Weer: cloudy · wind moderate", "HSE: near_miss", "QC: issues", "in progress / recorded / assigned / open", "high / critical / medium / low", labels "building name:", "due date:", "disposition: to be corrected", "progress percent:", "hse category:", "responsible person:", "immediate measure:", "action required", werkuren "07:00:00 16:00:00". Geen opdrachtgever, aannemer, supervisor, handtekening.
**Te doen.** Gebruik `lib/reports/report-vocabulary.ts` (bestaat al, `tests/report-vocabulary.test.mjs`) in `period-report-pdf.tsx` en `period-report-docx.ts` voor elk veld; vertaal labels; tijden als `07:00–16:00`; voeg projectkop (opdrachtgever, aannemer, supervisor) en handtekeningblok toe. Een test faalt zodra een ruwe enum-waarde (`_` of Engelse sleutel) in de PDF-tekst voorkomt. Besluit het verband met WP2 en documenteer het.

### WP4 — Telefoonlayout en tikdoelen (H2, M10, L13)
- **Actiecentrum-tabbalk** (`project-action-center.tsx:284`, `styles/navigation.css:14-23`, `styles/sections/15-records.css:950`, `16-media.css:523-531`): drie botsende regels op `.action-center-views`. Kies één mechanisme: of de `SectionNav`-menuvariant op telefoon (zoals bedoeld in `navigation.css` regel 1–3), of een gelijke 3-koloms-segmentbalk met afkapping. Resultaat: op 360, 375, 390, 414, 600, 768 en 1024 px drie gelijke tabs van ≥44 px hoog, geen verticale tekst. Voeg die breedtes toe aan `tests/e2e/responsive-audit.spec.ts` of `viewport-walk.spec.ts`.
- **Vaste balk "N foto's zijn nog niet opgeslagen"**: mag nooit de inhoud afdekken. Reserveer ruimte (padding-bottom) of verplaats de balk boven de onderbalk zonder overlap; test op Project Docs, Middelen en mobiel.
- **Tikdoelen ≥ 44 px op ≤ 1024 px**: checkboxes in "Directe maatregel" (13–22 px), "Dicteren" (38 px), invoer "Overig · omschrijf" (21 px), sluitknop in het 360°-venster (36 px), koppen op 768 px (37–41 px). Vergroot het klikgebied via label/padding zonder het ontwerp te vervuilen.

### WP5 — Deelknoppen en contrast (H3, M11, L11)
- `operational-workspace.tsx:5184, 5349`: "Stuur naar externe partij" en "WhatsApp-link · geen account nodig" hebben wit-op-wit (contrast 1.00 en 1.13). Herstel met tokens; één primaire actie per kaart, de rest secundair.
- Alle tekst moet WCAG AA halen (4,5:1; 3:1 voor groot): "Nog open" 3,46; "Alle opvolging" 3,84; "Kwaliteit"/"Main building" 3,46; "Foto toevoegen" 3,86; grijze 14 px-labels 4,1–4,4; "Open de tekening om een pin te plaatsen" 3,86; "0 afgerond · 0 open" 4,37. Pas de tokens aan in `styles/tokens.css` waar het systematisch is. Voeg een Playwright-contrastcontrole toe (de meetfunctie uit het rapport: voorgrond versus dichtstbijzijnde dekkende achtergrond) op Overzicht, Werkruimte, Acties, Issues, Registers, Rapporten.
- Deelpagina (`app/share/[token]/page.tsx`): primaire knop oranje volgens de regels, verwijder het rode hoofdletter-label "CODECO N.V. · SUPERVISIE" als eyebrow (gebruik het logo of gewone tekst), lijn "Prioriteit/Deadline"-labels uit, en werk de statusbadge bij na een antwoord (LQA-013).

### WP6 — Rechten in de UI voor contractor en client (M2, M3, L14)
- Menu en schermen volgen de rolmatrix: de contractor ziet niet "Rapporten" (menu verbergt dat al) **en** `?nav=rapporten` toont een nette weigering of redirect; `?nav=meer` toont voor contractor en client geen beheerknoppen (Team beheren, Taken beheren, Opvolging toewijzen, Medewerkers beheren, Externe indiening registreren) tenzij de rol dat mag. Eén naam voor het scherm in menu en kop ("Instellingen" óf "Management"; nu "Instellingen", "Management", "Meer" en "Managementoverzicht" door elkaar, `codeco-supervision-app.tsx:234, 666`).
- "Nieuw geconfigureerd project" alleen voor wie `projects.create` heeft; het formulier mag nooit voorgevuld zijn met productiegegevens ("First construction project", "COD-2026-001").
- Rechtenfouten krijgen een eigen melding ("Je rol mag dit niet"), niet "Controleer de projectcode" (`codeco-supervision-app.tsx:2455`); de chip "Opslaan mislukt · probeer opnieuw" (`:646`) verdwijnt na sluiten en suggereert geen nutteloos opnieuw proberen.
- Controleer of `profiles.phone` zichtbaar moet zijn voor een contractor; beperk indien niet (migratie + pgTAP).
- Tellers zoals "Hoog-risico 0 / Actief controlewerk 0" voor rollen die niets mogen lezen: toon "–" of verberg, geen nul als feit.
- Test: uitbreiding van `tests/e2e/role-views.spec.ts` met directe URL's voor contractor en client.

### WP7 — Dialogen, overlays en tekeningflow (M1, M8, M9, L3, L4, L15)
- **Help-venster** (`field-guide.tsx`): staat onder de vaste zijbalk (`z-index:20`); geef het dezelfde laag als andere dialogen (z-index 50) en test dat de linkerrand zichtbaar is. Opent nu automatisch bij het eerste bezoek: maak dat uitsluitbaar, onthoud de keuze per gebruiker.
- **360°-dialoog**: de knop "Markeer midden van huidige weergave" (833×48) overlapt de bedieningsbalk 8 px; geef ruimte. Sluitknop ≥44 px. Toon de actieve staat van "Vanzelf draaien" (aria-pressed + visuele staat).
- **Tekening-pin** (`drawing-workspace.tsx`): bevestigingspaneel en "Pin plaatsen" staan ±1200 px onder de tekening; plaats het paneel naast of direct onder de plek (sticky), of laat de pin direct kiezen. "Open gekoppeld projectrecord" moet het **specifieke** record openen (scroll naar en markeer, of een detailweergave), niet de algemene lijst met leeg formulier. Het lege paneel "Plaats of selecteer een tekeningspin" (±300 px leeg) en de permanente groene balk "Originele tekening blijft ongewijzigd" (ook zonder tekening) verkleinen of conditioneel tonen.
- **Bevestigingen**: vervang `window.confirm()` (`drawing-workspace.tsx:1194`, en andere voorkomens; zoek `confirm(`) door de bestaande inline-bevestiging ("Intrekken bevestigen"). Native confirm onderdrukt testbrowsers en voelt inconsistent.
- **Meldingen** ("Pin opgeslagen.", "…rapport gedownload.", "Opgeslagen op dit apparaat…") verdwijnen na enkele seconden en bij schermwissel.

### WP8 — Formulieren: duidelijk, Nederlands, voorspelbaar (M6, M16, L1, L2, L9, L18, L20)
- **Uitgeschakelde verzendknoppen** krijgen overal een "Nog nodig: …"-regel zoals het RFI-formulier: Issue (prod), HSE en NCR (`operational-workspace.tsx`), en elke andere. Verplichte velden zijn gemarkeerd en de eerste ontbrekende krijgt focus bij een klik.
- **HSE/Issue "Verantwoordelijke"**: een lege selectie plus tekstveld met de placeholder "Nog niemand van dit project staat in de app" (`:3445, 3848`) is verwarrend. Toon een uitlegtekst en maak duidelijk dat een naam typen mag.
- **NCR-labels** (`:3631-3634`): "Date Identified", "Expected Resolution Date", "Escalation Required (Y/N)", "Priority", "Issue Type" naar Nederlands (`text(en, nl)`).
- **RFI-formulier**: verwijder de Engelse voorbeeldchip (`:1888`, "Detailed specifications for the server room of B1 second floor") of vertaal en genericeer; "Functie" niet vooraf op "Construction Supervisor" voor een contractor (`lib/forms/controlled-project-documents.ts:75`); label "Aan:" zonder dubbele punt zoals de rest; spacing tussen chips en "Ingediend door".
- **Tijd**: concept-melding en tijdvelden in 24-uurs (`forms/draft-notice.tsx:10`: gebruik `Intl.DateTimeFormat(locale, { hour12:false })`; native time-inputs kunnen `lang` of een tekstveld met patroon krijgen).
- **"Werkdag starten"**: de validatiefout "Kies de geplande werkzaamheden" moet zichtbaar worden (scroll en focus) bij de eerste klik.
- **Misleidende melding** na een online HSE-opslag ("Opgeslagen op dit apparaat. Foto's worden verzonden zodra je online bent.") alleen tonen als er werkelijk iets in de wachtrij staat; online: "HSE opgeslagen."
- **"Persoon toevoegen"** 3× klikken geeft 1 persoon zonder uitleg: toon het aantal of laat het formulier niet stil resetten.
- **Autosave en annuleren**: controleer annuleren met niet-opgeslagen wijzigingen in alle formulieren; toon een bevestiging.

### WP9 — Tellers en definities één keer (M5, M7, L21, L22, L23)
- Foto's: tegel (20) versus lijst en Overzicht (22): tel 360° mee; een tekening (DWG) is geen foto en krijgt geen label "FOTO".
- Issues: kop, tegel, lijst en Acties ("Alle registraties") gebruiken dezelfde definitie van "open", "gesloten" en "totaal"; label wat een getal telt. Gebruik `lib/actions/open-work.mjs` als bron en breid `tests/e2e/overview-counts.spec.ts` uit met een gesloten issue.
- Overzicht: "Nog geen activiteit" en "Geen werk vastgelegd" mogen niet suggereren dat er niets is gebeurd bij een project met inspecties en foto's: toon laatste activiteit uit echte records of verwijder het blok.
- "Projectlocaties 0" bij 2 gebouwen: hernoem of tel juist. "Wacht op jouw controle" versus "Wacht op verificatie": één term. Filter "1/9" uitleggen of weghalen.
- Filter "Auteur" bevat alleen "Alle auteurs": vul met echte auteurs of verberg.

### WP10 — Inloggen, herstel en toegankelijkheid (M14, M15, L8, L19)
- Loginfouten ("Vul een geldig e-mailadres in", "Gebruik minimaal 8 tekens") krijgen `role="alert"` of `aria-live="polite"`, `aria-invalid="true"` en `aria-describedby` op het veld. De serverfout heeft al een live-regio.
- Herstel van wachtwoord: `supabase/config.toml:159-163` laat alleen `https://code-co-nv.vercel.app` toe; voeg `http://localhost:3000` en `http://127.0.0.1:3000` voor lokale ontwikkeling toe zodat `redirectTo: ${origin}/supervisie` werkt, en test het scherm "Nieuw wachtwoord" (`codeco-supervision-app.tsx:2333`) end-to-end met Inbucket/Mailpit (`http://127.0.0.1:54324`). Maak de herstelmail Nederlands (`[auth.email.template.recovery]` in `config.toml`, met subject en tekst), met herkenbare afzender. **Controleer en documenteer** dat dezelfde sjabloon in het hostede Supabase-project moet worden ingesteld (dat kan je niet zelf; schrijf het als handmatige stap).
- Inlogpogingen: rate-limit of vertraging na meerdere mislukte pogingen (config + test); documenteer de productie-instelling.
- Checkboxes in "Directe maatregel" krijgen een toegankelijke naam (nu "on"); code-invoer in "Gebouw toevoegen" een echt label; voeg een skip-link toe naar `main`; houd één `h1` per scherm (Project Docs heeft er twee, LQA-011).
- Controleer toetsenbord: tabvolgorde door elk scherm, focus zichtbaar, geen focus-trap, Esc sluit dialogen, focus keert terug naar de trigger.

### WP11 — Overig (L5, L6, L7, L10, L12, L24)
- Zijbalk-projectkeuze (110 px) kapt naam en locatie af: geef tooltip of meer ruimte.
- Verwijder of herstel de losstaande knoppen "Open normale foto" / "Open 360°-beeld" onder de Issue-filters.
- Ongeldig `?project=<id>`: toon een melding en ga naar de projectlijst.
- Testdata op productie opruimen is een handmatige stap: "TEST 360 — DELETE ME" (PHO-2026-0019/0020), "Test phase 3", NCR-categorie "Sweep tile" (`lib/forms/controlled-project-documents.ts:151`: verwijder uit de standaardcatalogus als het testdata is, bevestig met de productowner). Voeg een veilige verwijder- of archiefactie toe voor per ongeluk aangemaakte records (met audit), zodat zoiets niet blijft staan.
- Console: verwijder de preload-waarschuwingen (zes "preloaded but not used"); onderzoek de laadtijd van "Projectregisters laden…" (meet; >6 s eenmalig gezien) en de niet te herleiden 401 bij de eerste laad.
- NL/EN-mix: HSE-types (Safety, Health, Environment, Near miss, Incident), "Issues", "Workforce", "Change order (CO)", "Geleerde lessen (LL)", "Project Docs", "Back-up". Kies één taal per interface; laat alleen vaste vakterm (CO, NCR, RFI, PDR) in afkorting staan.

### WP13 — Foto- en mediabibliotheek op desktop (H5, M21, M26, M27, L27, L29)
- **H5:** `app/styles/sections/15-records.css:382-387` verbergt `.media-actions-panel` (en `.media-library-toolbar`) op ≥ 1025 px; daarin zitten het gebouwfilter, "Filteren op" en de fotostapel met "Fotostapel opslaan". Verwijder `.media-actions-panel` en `.media-library-toolbar` uit die `display:none`-groep (laat alleen de mobiele sheet-regels staan), controleer `15-records.css:550` (≤1024-regel) en `09-media.css:686`. Test in Playwright op 1280 px: bestand kiezen → fotostapel zichtbaar → omschrijven → "Fotostapel opslaan" → foto in de lijst; hetzelfde voor 360° (`tab=visual`) en tekening.
- **M26:** een geüploade tekening is geen foto: tel en label per `category`; en maak niet bij elke upload een nieuwe mediamap (`create_media_folder`): hergebruik de bestaande map.
- **M27:** de balk "N gemaakte foto's zijn nog niet opgeslagen" verdwijnt direct na opslaan en dekt nooit inhoud af.
- **M21:** na een geslaagde online upload toon "Foto geüpload" (en "360°-beeld geüpload"); toon "Opgeslagen op dit apparaat…" alleen als er echt iets in de wachtrij staat.
- **L27:** vervang het kale `<input type=file>` op "Visueel bewijs" door de bestaande knopstijl (verborgen input met label).
- **L29:** vertaal de 503 van `/api/storage/uploads` naar een gebruikersmelding ("Uploaden is nu niet beschikbaar; je foto blijft op dit apparaat"), en log de beheerderstekst alleen.

### WP14 — Toegankelijkheid, contrast en zoom (M22, M23, M24, M25, M14, L31, L8)
- **Contrast** (axe: 62 nodes op 16 schermen): pas de tokens in `app/styles/tokens.css` aan: `#707780` op `#fafbfb`, `#f6f7f6`, `#f3f5f6` (4,13–4,36:1) naar een donkerder grijs ≥ 4,5:1; `#cf6300` op `#fff0e4` (3,46:1) naar een donkerder oranje voor tekst op de actieve-tegelachtergrond ≥ 4,5:1 (oranje blijft voor selectie en primaire actie). Draai `npm run test:design`; werk `tests/design-baseline.json` alleen bij als de wijziging bewust is. Voeg een axe-controle toe aan `tests/e2e` (de scan in `docs/operations/qa-full-sweep-2026-10-28.md` sectie 8 is een startpunt).
- **Keuzelijsten zonder naam** (kritiek): geef `.record-order-2 > .form-field > select` en `.record-responsible-field > select` (Issue/HSE) een `aria-label` of een gekoppeld `<label>`.
- **Landmarks en koppen:** `.action-focus-card` (Acties) en `.rapid-source-panel` (Rapid Verify) zijn `aside` binnen een andere landmark: maak er `section` of `div` van; herstel de koppenvolgorde in de vindingkaart, NCR en Project Docs; geef het inlogscherm een `main` en zet alle inhoud in een landmark.
- **400 % zoom / 320 px:** Middelen (349 px) en Management (412 px) lopen over de rand: laat de knoppen "Voeg een projectmiddel toe", "Maak foto", "Foto's uploaden" en de actieregels wrappen. Voeg 320 px toe aan `tests/e2e/responsive-audit.spec.ts` voor alle 18 schermen (200 % zoom is al schoon).
- **Meldingen op het herstel- en inlogscherm** (M14, L31): `role="alert"`/`aria-live`, `aria-invalid`, `aria-describedby`.

### WP15 — Formulieren: vereisten en verplichte bijlagen (M19, M20, L25, L26, L30)
- **M19:** "Nog nodig"-regels noemen de echte ontbrekende velden: PDR (categorie, soort, impact, inloopplan, "Foto op de oorspronkelijke einddatum", statusfoto); CO (scope-gebied, indien nodig einddatum). Leid ze af uit dezelfde functie als de validatie (`lib/forms/delay-report.ts:181`, `lib/forms/change-order.ts:176`), zodat ze nooit uit elkaar lopen.
- **M20:** sla een formeel document met verplichte foto's pas op als de foto's bevestigd zijn, of markeer het als **concept** en laat verzenden pas toe zodra de bijlagen er zijn.
- **L25:** rond een inspectie af met één RPC die alle antwoorden meeneemt (of een batch), met idempotente herhaling.
- **L26:** vertaal checklist- en bevindingteksten (`Afgekeurd controlepunt: …`), TI-keuzelijsten (Discipline, Planningimpact, Kostenimpact) en checklist-items; behoud bestaande projectversies.
- **L30:** toon na het wijzigen van het wachtwoord "Wachtwoord gewijzigd" en ga dan naar de projectlijst.
- **M18:** toon bij een herstellink met `#error=…otp_expired` een duidelijke melding ("Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.") met een knop om opnieuw aan te vragen.

### WP12 — Afronden
- Werk `docs/operations/live-qa-bug-register.md` bij met een rij per ID (LQA-016 e.v.: status, test, commit).
- Draai de controles uit "Lokale omgeving" en plak de uitvoer (aantallen geslaagd/gefaald) in een nieuw document `docs/operations/qa-fix-verification-<datum>.md`.
- Doe een volledige handmatige doorloop als **contractor**, **client** en **supervisor** op 375, 768, 1024 en 1440 px: alle schermen, tabs, dialogen en formulieren uit het rapport, met screenshots; noteer wat nog niet goed is.
- Bij de laatste stap: stop de dev-server en meld of de Supabase-containers draaien.

## Dekking: elk ID moet voorkomen

| IDs | Werkpakket |
| --- | --- |
| H1, M4, L16, L17 | WP1 |
| H4, M13, M17, L20 (PDF) | WP2 |
| M12 | WP3 |
| H2, M10, L13 | WP4 |
| H3, M11, L11 | WP5 |
| M2, M3, L14 | WP6 |
| M1, M8, M9, L3, L4, L15 | WP7 |
| M6, M16, L1, L2, L9, L18, L20 (formulier) | WP8 |
| M5, M7, L21, L22, L23 | WP9 |
| M14, M15, L8, L19 | WP10 |
| L5, L6, L7, L10, L12, L24 | WP11 |
| H5, M21, M26, M27, L27, L29 | WP13 |
| M22, M23, M24, M25, L31 (en M14, L8 uit WP10) | WP14 |
| M18, M19, M20, L25, L26, L30 | WP15 |
| L28 | WP12 (pgTAP isoleren van seed-data en een test voor H1: contractor maakt een dagrapport aan) |
| L32 | WP11 (records-schermen laden één keer; herstel daarna `tests/e2e/double-submit.spec.ts:36`, dat nu faalt op "Loading project records…") |

Controleer aan het einde dat geen enkel ID uit het rapport ontbreekt in `qa-fix-verification-<datum>.md`.

## Besluiten die je van de productowner nodig hebt (vraag ze, blokkeer er niet op)

1. Contractor-rechten: mag elk schrijfrecht een dagrapport aanmaken (aanbevolen), of krijgt de contractor een eigen pad zonder dagrapport?
2. Dagrapport: één document per project of per gebouw; vallen periode-rapport en formeel dagrapport samen?
3. Moet de contractor `Rapporten` of `Management` helemaal niet zien, of een beperkte weergave?
4. Taalbeleid: volledig Nederlands in de NL-interface, behalve vaste afkortingen?
5. Productie: wie ruimt testrecords op, en welk mailsjabloon staat in het hostede Supabase-project?

## Opleveren

Een samenvatting per werkpakket (wat veranderd is, welke tests erbij, wat nog open staat), de lijst van commits, het verificatiedocument, en een eerlijke lijst van wat **niet** is opgelost of niet kon worden getest en waarom.
