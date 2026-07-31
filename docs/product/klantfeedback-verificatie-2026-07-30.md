# Klantfeedback-verificatie — 30 juli 2026

Per klantpunt: **bestaat het**, **is het zichtbaar/duidelijk in de UI**, en **wat ontbreekt echt**.
Alle regelverwijzingen zijn gecontroleerd tegen `main` @ `c97a990`. `npx tsc --noEmit` is schoon.

---

## Status na de reparatieronde van 30 juli

Alle punten hieronder zijn na de audit **opgelost in code**. Wat per punt is veranderd
staat in `docs/product/opgeloste-klantpunten-2026-07-30.md`.
Deze audit blijft staan als vastlegging van de uitgangssituatie.

## 0. Belangrijkste bevinding vooraf: de klant test een oude build

De klant citeert letterlijk deze schermtekst:

> Project Docs
> **Finish this task, then return to the workspace.**

Die zin bestaat **niet meer in de code**. Hij is verwijderd in commit `b5bbbae`
("Implement client workspace and submission workflows", 30 juli 12:36).

```
git log -S "Finish this task" → b5bbbae, 953120d
```

Alles wat vandaag ná 12:36 is gebouwd (de 15 workspace-modules, de 15 rapportopties,
de rapporthistorie met filter, het indieningencentrum, taaktoewijzing aan eigen
medewerkers, de foto-preview) zat **niet** in wat de klant heeft bekeken.

**Actie:** eerst deployen en de klant opnieuw laten kijken. Een deel van de lijst
hieronder is al opgelost maar simpelweg nooit bij de klant terechtgekomen.

---

## 1. Projectnaam in plaats van "Main building" in de overzichtsheader

**Bestaat: ja. Zichtbaar: ja.**

- `app/client-dashboard.tsx:185` — de overzichts-hero toont `<h1>{projectName}</h1>`;
  het gebouw staat alleen als subregel (`buildingContextLabel`, regel 186).
- `app/codeco-supervision-app.tsx:1346-1350` — breadcrumb: `Mijn projecten › {projectName} › {gebouw}`.

**Restpunt (klein, 1 regel):** binnen een geopende module staat nog steeds
`{projectName} · {buildingName}` in de modulebalk
(`app/operational-workspace.tsx:1247`, ook `app/project-action-center.tsx:154`).
Dát is de balk die de klant in zijn screenshot heeft geplakt. Als hij daar alleen
de projectnaam wil, is dat één wijziging op twee plekken.

## 2. Live weather register op het overzicht, "moet overall werken"

**Bestaat: ja. Zichtbaar: ja. "Overall": nee.**

- `app/client-dashboard.tsx:291-305` — paneel **"Live weather register"** met
  temperatuur, gevoelstemperatuur, luchtvochtigheid, wind, regen, verversknop,
  auto-refresh elke 10 minuten en bronvermelding (`Live · Open-Meteo`).
- `app/api/weather/current/route.ts` — echte Open-Meteo-koppeling, geocoding op de
  projectlocatie met voorkeur voor Suriname (`country_code === "SR"`), tijdzone
  `America/Paramaribo`, 8s timeout, nette 503-fallback.

**Gat:** live weer draait alleen op het overzicht en in het Projectstart-formulier
(`codeco-supervision-app.tsx:2399`). Het staat **niet** in de werkruimte, de daglog,
de inspecties (daar staat alleen een chip "Weer vooraf ingevuld · bevestig",
`operational-workspace.tsx:1290`) en niet in de rapporten — die gebruiken het
handmatig bevestigde weer uit de startcontrole. "Overall werken" is dus nog open.

## 3. Agreements made ontbreekt

**Bestaat: ja, op drie plekken. Zichtbaar: ja.**

- Workspace-tegel `agreements-made` — `app/project-workspace-home.tsx:210-217`, met teller.
- Rapportoptie `agreements_made` — `app/operational-workspace.tsx:1988`.
- Registertype `agreement` — `app/operational-workspace.tsx:169`.

## 4. RFA/RFI/IR voor externe partijen met eigen login, goedkeuring door bedrijf/eigenaar, plus historielog

**Bestaat: grotendeels. Het historielog is het echte gat.**

Wat werkt:
- **Eigen login met rolrechten** — `supabase/migrations/202607300001_external_submission_roles_and_wcr.sql`:
  `contractor` krijgt `submissions.read`; `client` (eigenaar), `lead_supervisor`,
  `project_manager` en `quality_hse_manager` krijgen `submissions.read` **en**
  `submissions.review`. Een aannemer krijgt dus géén brede `records.read`.
- **RLS** — regel 87-96: WCR/RFI/RFA/WIR zijn leesbaar met alleen `submissions.read`.
- **Goedkeuring** — RPC `respond_to_controlled_project_document` met besluitcodes
  approved / conditionally_approved / approved_with_comments / rejected /
  clarification_needed / correct_and_resubmit / acknowledged / completed / closed,
  en verplichte naam + toelichting van de respondent.
- **UI** — Management → *External parties* → knop **"Record formal response"**
  (`operational-workspace.tsx:1747`, formulier 1759-1764).

**Gat — "een log zien van alle geschiedenis":**
- Het paneel *"Open record & history"* (`operational-workspace.tsx:1748-1758`) toont
  aanmaakdatum, huidige status, omschrijving, bijlagen en **alleen het laatste antwoord**.
- De database **overschrijft** het vorige antwoord: `jsonb_set(details, '{response}', …)`
  in migratie `202607300001` regel 166-176. Eerdere besluiten zijn daarna weg.
- `audit_events` bestaat wel in de database (met immutability-trigger), maar wordt
  **nergens** in de app uitgelezen — de enige `audit_events`-referentie in de webapp is
  een `insert` in `app/api/admin/project-role/route.ts:85`.

Er is dus per document één momentopname, geen chronologisch dossier.

## 5. Na de foto maken feedback/bevinding kunnen plaatsen

**Bestaat: ja, maar de klant heeft de kapotte versie gezien.**

Huidige flow (`app/visual-evidence-workspace.tsx`):
1. Camera → foto komt binnen via `initialFiles` (regel 173-184).
2. **Voorbeeld vóór opslaan** met "Opnieuw maken" / "Verwijderen" (regel 338-346) — dit
   is vandaag toegevoegd in commit `b0c8b59`.
3. Banner **"Stap 1 van 2 · bevestig en sla deze foto op"** (regel 331).
4. Na opslaan wordt de foto automatisch de actieve capture (`pendingSelectionFileId`, regel 243).
5. Klikken op de foto → `PhotoAnnotationViewer` (regel 417-438) → `IssueForm` (regel 530).

**Restpunten:**
- Het blijft twee handelingen: eerst opslaan, dan klikken. Er is geen automatische sprong
  naar "plaats nu een marker".
- Klikken op een foto in **Fotomappen / media-bibliotheek** (`app/media-library-workspace.tsx`)
  doet niets richting bevindingen. Alleen in de module *Visueel bewijs* kun je annoteren.
  Dit is vrijwel zeker precies wat de klant bedoelde met "nu doet het niets".

## 6. Rapid Verify met bestaande bronnen

**Bestaat: ja. Zichtbaar: ja.**

- `app/rapid-verify-workspace.tsx:168-187` — `indexExistingSources()` haalt bestaande
  projectbestanden uit de beveiligde opslag en indexeert ze.
- Regel 145-162 — `addProjectFile()` voor één specifiek projectbestand.

**Grenzen die de klant moet weten:**
- Alleen **PDF, .txt en .md** (regel 164-167). Afbeeldingen, DWG, XLS en DOCX worden overgeslagen.
- Maximaal **25 bestanden** per indexeerronde (regel 173).
- Het is **trefwoordzoeken met scoring** (regel 197-212), geen AI en geen semantiek.
- **Geen OCR**: een gescande PDF zonder tekstlaag levert nul resultaten op.

## 7. WIR/WCR/RFI/RFA mogen niet in de workspace voorkomen

**Half gedaan.**

- ✅ Weg uit het workspace-startscherm: `project-workspace-home.tsx` bevat exact de 15
  door de klant gevraagde tegels, geen WIR/WCR/RFI/RFA.
- ❌ **Nog wel in de workspace aanwezig**: de module *Project Docs / registers* biedt in de
  dropdown "Register / documentformaat" gewoon `wcr`, `rfi`, `rfa` en `inspection_request`
  aan (`operational-workspace.tsx:1533`, labels op regel 156-165), en toont ze via
  `ControlledDocumentList` op regel 1607. Een supervisor kan ze dus nog steeds in de
  werkruimte aanmaken in plaats van via de aannemer + goedkeuring.
- Opruimwerk: het verborgen legacy-blok op `operational-workspace.tsx:1173-1190`
  (`aria-hidden="true" hidden`) bevat nog WCR/RFI/RFA/WIR-knoppen. Niet zichtbaar, wel dode code.

## 8. Works ongoing moet in de workspace (eigenaar moet zien wat er speelt)

**Bestaat: ja. Kwaliteit: matig.**

- Tegel `works-ongoing` — `project-workspace-home.tsx:95-101`.
- Actie → `openWorkspaceDailyRecord("works_ongoing")` → `codeco-supervision-app.tsx:951-967`.

**Gat:** het opent het **generieke registratie-modal** met een voorgevulde omschrijving
("Work is ongoing") en slaat op als losse site-registratie. Er is geen eigen
"Works ongoing"-lijst met status/voortgang die de eigenaar kan doorbladeren.
Hetzelfde geldt voor *Works completed* en *Delays*.

## 9. Daglog klopt niet

**Onderbouwd, maar de klant moet specificeren wát er niet klopt.**

Er bestaan op dit moment **drie** verschillende dag-invoerroutes die naar verschillende
tabellen schrijven:

| Ingang | Waar | Slaat op als |
| --- | --- | --- |
| "Daglog" op overzicht | `OneTapDailyLogModal`, `codeco-supervision-app.tsx:1780-1830` | bezetting (`attendance`) + notitie + foto's |
| Dagvragen / dagafsluiting | `codeco-supervision-app.tsx:4029`, 19 secties uit `clientReportSections` | dagrapport-antwoorden |
| Tegels Works ongoing / completed / Delays | `codeco-supervision-app.tsx:951` | losse site-registratie |

Dat drietal is vrijwel zeker de oorzaak van "klopt niet". Advies: vraag de klant om één
concreet voorbeeld (welk veld, welke datum, welke waarde is fout) — anders raden we.

## 10. De 15 verplichte workspace-modules

**Bestaat: ja, exact en in de volgorde van de klant.** `app/project-workspace-home.tsx:83-218`.

Foto · Works ongoing · Works completed · Workforce · Delays · Issues · HSE ·
Materials delivery · Inspections · Technical instructions · Change order CO · NCR ·
Deadlines · HSE incident · Agreements made.

Met live tellers (regel 1151-1161 in `operational-workspace.tsx`) en een zoekveld (regel 234-238).

## 11. "Include in report"-opties = dezelfde 15

**Bestaat: ja.** `app/operational-workspace.tsx:1973-1989`, gerenderd als checkboxlijst
**"Opnemen in dit rapport"** op regel 2119-2122.

**Gat dat de klant zal merken:** de 15 opties worden samengeperst op 16 PDF-secties
(`lib/reports/period-report-pdf.tsx:14`). Meerdere opties delen dezelfde sectie:

- `works_ongoing` en `works_completed` → beide `work`
- `issues`, `inspections` en `ncr` → alle drie `quality`
- `delays` en `materials_delivery` → beide `logistics`
- `hse` en `hse_incident` → beide `hse`

Gevolg: "Works completed" uitvinken terwijl "Works ongoing" aan staat verandert **niets**
aan de PDF. De checkbox doet dan zichtbaar niets.

## 12. Alle rapporthistorie met filter, rapporten aanklikbaar

**Bestaat: ja. Zichtbaar: ja.** Rapporten → tab **"Versies & historie"**:

- Filter `historyType` — Alle / Dagrapport / Weekrapport / Maandrapport (`operational-workspace.tsx:2156`).
- Aanklikbare rijen die uitklappen naar status + PDF/Word-download (regel 2158-2161).
- Daaronder vier kolommen: vastgezette versies (met SHA-256), reviews, verklaringen, distributie (regel 2166-2169).

**Restpunten:**
- Week- en maandrapporten zijn **afgeleide groeperingen** van dagrapporten (regel 2074-2096),
  geen opgeslagen rapporten.
- Het detailpaneel zegt "Inhoud: N geselecteerde klantonderdelen" maar gebruikt de
  **nu aangevinkte** checkboxen (`includedClientOptions`), niet de selectie waarmee dat
  rapport destijds is gemaakt. Een historisch rapport reproduceert zichzelf dus niet exact.

## 13. Management: indieningen van externe partijen, met en zonder account

**Bestaat: ja. Zichtbaar: ja.** `app/operational-workspace.tsx:2244-2281`, sectie
*External parties · Submissions, decisions and task ownership*:

- Uitleg **"Met account"** (projectrol bepaalt wat men mag) vs **"Zonder account"**
  (intrekbare bewijslink) — regel 2246-2250.
- Teller indieningen + hoeveel er een besluit vragen.
- Volledige `ControlledDocumentList` met besluitknop (regel 2280).

## 14. Eigenaar ziet alles; manager kan taken naar eigen medewerkers schuiven

**Bestaat: ja, met een beperking.**

- `company-task-assignment` — `operational-workspace.tsx:2251-2279`: werklaststrip per
  medewerker, dropdown "Verantwoordelijke medewerker" per actie, knop **Toewijzen** →
  `assignProjectAction` (migratie `202607300002_company_employee_task_assignment.sql`).

**Gat:** alleen `project_actions` zijn herverdeelbaar. Een RFI/RFA/WIR/WCR-indiening
zelf heeft **geen** "wijs toe aan medewerker". Je moet handmatig een opvolgactie aanmaken
via *Assign follow-up*. De wens "de taken zijn dingen die al bestaan, bv. het handelen van
een RFI" is daarmee alleen indirect ingevuld.

## 15. Pin location op tekeningen

**Bestaat: ja, volledig. Vindbaarheid: slecht.**

- `app/drawing-workspace.tsx` — PDF/JPEG/PNG/WebP-tekeningen, paginanavigatie,
  genormaliseerde X/Y-pins (schaalvast), markup-gereedschap.
- Zes koppeltypes met eigen kleur (regel 70-86): RFI rood, submittal oranje, document blauw,
  **observatie/NCR paars**, inspectie groen, foto/360° cyaan.
- Database: `drawing_pins` uit migratie `202607220001_drawing_pin_workspace.sql`.

**Gat:** de route loopt maar één kant op. Je moet naar *Tekeningen & pins* gaan, daar het
type "observatie" kiezen en het issue uit een lijst zoeken. **Op de issue-kaart zelf staat
géén "plaats op tekening"** — alleen "Koppel visuele pointer" (foto/360°),
`operational-workspace.tsx:1874`. De klantwens "wanneer ik een issue vind, meteen op de
tekening aangeven" kost nu 4-5 navigatiestappen.

## 16. Projects: te veel verspilde ruimte

**Deels aangepakt vandaag.**

- `04f27d3` — de portfolio-balk op het projectkeuzescherm is herbouwd als wrappende
  stat-chips met gekleurd icoon per metriek; geen lege wees-cel meer bij 7 items.
- `c97a990` — onzichtbare staplabels en zwevende mobiele stapblokjes gefixt.

**Nog open:** het voorbeeld dat de klant plakte (Project Docs) heeft **drie gestapelde
koppen** boven de eerste inhoudsregel: secondary-header → modulebalk
(`workspace-section-controls`, regel 1244-1262) → `project-documents-summary`
(`project-documents-home.tsx:108-114`) → tabbalk → browser-header. Op mobiel is de
eerste echte regel daardoor ver naar beneden geduwd. Dat is nog niet opgelost.

## 17. Punch list: gewone foto's, issue-type, kleurcodering, gebouw op de marker

Ik heb de punch list van de klant (`tmp/client_context/workbooks/issues-b1-percentages--sheet1.png`,
werkblad **B1-MOH**) gelezen. Die werkt met: Subject · Description ·
**Validate** (groen) · **To be corrected** (oranje X) · **Need an alternative solution**
(rode X) · Action · Responsible from contractor · Issuance date · Initial completion date ·
en daarna een voortgangs-% per inspectiedatum.

| Wens | Status |
| --- | --- |
| Ook gewone foto's, niet alleen 360° | ✅ `PhotoAnnotationViewer` (`visual-evidence-workspace.tsx:417-438`) plaatst X/Y-markers op gewone foto's; toolbar heeft aparte knoppen "Maak foto" en "Upload 360°" (regel 325-326) |
| Type issue kiezen op de marker | ✅ regel 558 — observatie / tekortkoming / afwijking / NCR / verbeterkans |
| Kleurcodering zoals de punch list | ⚠️ dropdown bestaat, kleur klopt niet — zie hieronder |
| Gebouw aangeven op de marker | ❌ ontbreekt |

**Kleur klopt niet (echte bug).** De dropdown *"Markerclassificatie · kleur"* op regel 559
biedt exact de klantindeling: Gevalideerd·groen / Te corrigeren·oranje / Alternatieve
oplossing·rood. Maar:

- De marker op het beeld wordt gekleurd op **ernst**, niet op classificatie:
  `` `visual-marker ${annotation.severity}` `` (regel 432). CSS `globals.css:6993-6998`:
  low = groen, high = `#d36f25` oranje, critical = rood, medium = geen kleur.
- `saveIssue` (regel 293) vertaalt: validated → `low`, alternative_solution → **`high`**,
  to_be_corrected → de door de gebruiker gekozen ernst.
- Resultaat: **"Alternatieve oplossing · rood" wordt oranje weergegeven**, en
  "Te corrigeren · oranje" kan groen of rood worden, afhankelijk van de ernst.
- Bovendien stuurt `createVisualAnnotationFinding` (`lib/supabase/operations.ts:1056-1085`)
  de `disposition` **helemaal niet** mee. Hij wordt alleen als tekst in de omschrijving
  gepropt: `` `[${issue.disposition}] ${description}` `` (regel 292). De classificatie is
  dus geen data — niet filterbaar, niet rapporteerbaar.
- De kolom bestaat wél in de database (`findings.disposition` en
  `finding_progress_updates.disposition`, migratie `202607240001` regel 34-35) en wordt bij
  handmatige issues wél gevuld (`operations.ts:673`). Alleen de visuele markerroute slaat hem over.

**Gebouw op de marker ontbreekt.** Het gebouw wordt op de **foto** gekozen
(`BuildingPicker`, `visual-evidence-workspace.tsx:344`), niet op de marker. De punch list van
de klant is per gebouw georganiseerd (B1-MOH) en één 360°-beeld kan meerdere zones raken.

## 18. Foto's zijn niet goed gekoppeld aan elke feature

**Bevestigd, en het is een concreet aanwijsbaar gat.**

- De koppeltabel `file_links` (bestand ↔ finding / action / inspection / hse, met relatie
  attachment/before/after/evidence) wordt **wel geschreven**:
  `lib/offline/upload-queue.ts:245`, `:273`, `:282`.
- Maar hij wordt **nergens gelezen**. `file_links` staat niet in de snapshot-query van
  `lib/supabase/operations.ts` (de snapshot haalt 27 tabellen op — `file_links` zit er niet bij),
  en geen enkel component leest hem uit.

Gevolg, precies zoals de klant het beschrijft:
- De fotobibliotheek toont map, gebouw, datum en tijd — maar **nooit** "hoort bij NCR-004"
  of "hoort bij inspectie INS-012".
- Een issue-kaart toont geen fotostrip; alleen de ene visuele annotatie via
  "Bekijk visuele pointer".
- Foto's bij een inspectie (`inspectionPhotos`) en bij HSE worden geüpload en gekoppeld,
  maar zijn daarna nergens terug te zien vanuit dat record.

## 19. "Alles moet goed naar elkaar koppelen"

Stand van zaken, feitelijk:

**Werkt echt gekoppeld:**
- Inspectie-afkeur → automatische bevinding (RPC).
- Bevinding → visuele annotatie op foto/360° (bidirectioneel).
- Bevinding / RFI / document / inspectie / foto → pin op tekening.
- Bevinding → externe deelbare link → gereedmelding → interne melding.
- Alle registraties → dagrapport → periode-PDF.

**Geschreven maar niet zichtbaar:**
- `file_links` (foto ↔ record) — zie punt 18.
- `audit_events` (volledige historie) — zie punt 4.
- `findings.disposition` vanuit de visuele markerroute — zie punt 17.

**Helemaal niet gekoppeld:**
- Indiening (RFI/RFA/WIR/WCR) → taak voor eigen medewerker.
- Issue → tekening, vanaf de issue-kant.
- Werkzaamheden gaande/afgerond → eigen register dat de eigenaar kan doorbladeren.

---

## Samenvatting

| # | Klantpunt | Bestaat | Zichtbaar/duidelijk |
| --- | --- | --- | --- |
| 1 | Projectnaam in overzichtsheader | ✅ | ✅ (modulebalk toont nog project · gebouw) |
| 2 | Live weather register | ✅ | ✅ op overzicht, ❌ "overall" |
| 3 | Agreements made | ✅ | ✅ |
| 4 | Externe login + goedkeuring | ✅ | ⚠️ historielog toont alleen laatste antwoord |
| 5 | Foto → bevinding plaatsen | ✅ | ⚠️ 2 stappen; werkt niet vanuit fotomappen |
| 6 | Rapid Verify met bestaande bronnen | ✅ | ⚠️ alleen PDF/tekst, geen OCR |
| 7 | WIR/WCR/RFI/RFA uit de workspace | ⚠️ | ❌ nog in Project Docs-dropdown |
| 8 | Works ongoing in workspace | ✅ | ⚠️ generiek notitiescherm |
| 9 | Daglog | ⚠️ | ❌ drie concurrerende ingangen |
| 10 | 15 workspace-modules | ✅ | ✅ |
| 11 | 15 rapportopties | ✅ | ⚠️ 4 checkboxen doen niets apart |
| 12 | Rapporthistorie + filter + klikbaar | ✅ | ⚠️ week/maand afgeleid; inhoud niet historisch |
| 13 | Indieningen in Management | ✅ | ✅ |
| 14 | Taken schuiven naar medewerkers | ✅ | ⚠️ alleen acties, niet indieningen |
| 15 | Pin op tekening | ✅ | ⚠️ niet bereikbaar vanaf het issue |
| 16 | Projects-schermruimte | ⚠️ | ⚠️ drie gestapelde koppen blijven |
| 17 | Punch list kleur + gebouw op marker | ⚠️ | ❌ kleur klopt niet, gebouw ontbreekt |
| 18 | Fotokoppeling per feature | ❌ | ❌ `file_links` wordt nooit gelezen |
| 19 | Overall samenhang | ⚠️ | ⚠️ zie punt 19 |

**Aanbevolen volgorde:**
1. Deployen (punt 0) — anders blijft de klant naar de oude build kijken.
2. Fotokoppeling zichtbaar maken (18) — grootste klacht, kleinste ingreep: `file_links`
   in de snapshot + fotostrip per record.
3. Marker-kleur en `disposition` echt opslaan (17) — dit is een aanwijsbare bug.
4. WIR/WCR/RFI/RFA uit de workspace-dropdown halen (7).
5. Historielog per beheerd document (4).
6. "Plaats op tekening" op de issue-kaart (15).
