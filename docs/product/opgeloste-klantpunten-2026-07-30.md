# Opgeloste klantpunten — 30 juli 2026

Uitgangspunt: `docs/product/klantfeedback-verificatie-2026-07-30.md`.
Dit document beschrijft wat er daadwerkelijk is gewijzigd.

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib` schoon ·
`next build` slaagt · 25/25 knipseltests groen (3 nieuwe regressietests toegevoegd) · 0 lint-waarschuwingen.

---

## 1. Foto's zijn nu zichtbaar gekoppeld aan elk onderdeel

Was: `file_links` werd **wel geschreven maar nooit gelezen**, dus nergens stond bij
welk record een foto hoorde.

- `lib/supabase/operations.ts` — `file_links` zit nu in de projectmomentopname
  (`fileLinks`), met een veilige terugval als een rol de tabel niet mag lezen.
- `lib/supabase/file-origins.ts` (nieuw) — `createFileOriginResolver()` bouwt per
  momentopname geïndexeerde lookuptabellen en lost per bestand alle herkomsten op:
  issue/NCR, inspectie, HSE, register en visueel bewijs.
- `app/media-library-workspace.tsx` — elke foto toont **koppelingschips**
  (`NCR-004`, `INS-012`, `HSE-003`, …) of expliciet "Nog niet aan een record gekoppeld",
  plus een **filterbalk** met telling per categorie.
- `app/operational-workspace.tsx` — `RecordPhotoStrip` op de issue/NCR-kaart: hoeveel
  foto's eraan hangen, uitklapbaar naar aanklikbare miniaturen.

**Prestaties:** de resolver is geïndexeerd (geen scan per bestand per record) en de
miniaturen laden pas na uitklappen. Zonder dat zou een register van honderd
bevindingen honderden beveiligde downloads tegelijk starten.

## 2. Punch-list markerkleur en gebouw — dit was een echte bug

Was: de keuze *Gevalideerd·groen / Te corrigeren·oranje / Alternatieve oplossing·rood*
stond wel in het formulier, maar de marker werd op **ernst** gekleurd en de
classificatie werd alleen als tekst `[to be corrected]` in de omschrijving geplakt.
"Alternatieve oplossing · rood" kwam er dus **oranje** uit.

- `supabase/migrations/202607300004_visual_marker_disposition_and_building.sql` (nieuw)
  - `visual_annotations.disposition` als echte kolom met constraint, plus backfill.
  - `create_visual_annotation_finding` herschreven: accepteert nu `p_disposition` en
    `p_building_id`, valideert dat het gebouw bij het project hoort, en zet de
    classificatie ook in `findings.issue_management`.
  - Trigger die de classificatie overneemt van de bevinding wanneer een marker aan een
    **bestaand** issue wordt gekoppeld, zodat één issue nooit twee kleuren krijgt.
- `app/visual-evidence-workspace.tsx` — `markerTone()` kleurt op classificatie
  (terugval op ernst voor oude markers); de omschrijving wordt niet meer vervuild.
- `globals.css` — drie eigen kleuren volgens het B1-MOH-schema.
- **Gebouw op de marker**: `BuildingPicker id="marker-building"` in het markerformulier.
  Eén 360°-beeld kan meerdere gebouwen raken; de marker bepaalt nu zelf waar hij hoort.

## 3. WIR / WCR / RFI / RFA uit de werkruimte

Was: verwijderd uit de tegels, maar nog gewoon aanmaakbaar via de registerdropdown.

- `operational-workspace.tsx` — `externalSubmissionRegisterTypes` filtert deze vier uit
  de dropdown én uit de documentenlijst van de werkruimte, met een uitlegblok en een
  knop naar Management.
- Het verborgen legacy-blok van 68 regels met WCR/RFI/RFA/WIR-knoppen is verwijderd.

**Belangrijk nagedacht punt:** hiermee zou niemand ze meer kunnen aanmaken — ook de
aannemer niet. Daarom is er een expliciete route: Management → *"Externe indiening
registreren"* zet `externalSubmissionIntent`, wat de vier types alleen dán vrijgeeft,
met een eigen banner. Elke navigatie zet de vlag weer uit.

## 4. Volledige besluithistorie op beheerde documenten

Was: de database **overschreef** het vorige antwoord met `jsonb_set`; eerdere besluiten
waren definitief weg.

- `supabase/migrations/202607300005_controlled_document_response_history.sql` (nieuw) —
  `details.response_history` als append-only log; `details.response` blijft het huidige
  besluit voor bestaande lezers. Bestaande losse antwoorden migreren automatisch mee
  bij het eerstvolgende besluit. Idempotentie controleert nu het hele log.
- `operational-workspace.tsx` — het dossierpaneel toont een **tijdlijn** met besluit,
  respondent, bedrijf, datum en toelichting per reactie, met kleur per besluitsoort.

## 5. Alle vijftien rapportopties doen nu echt iets

Was: 15 vinkjes werden samengeperst op 16 secties. "Works completed" uitvinken terwijl
"Works ongoing" aan stond veranderde niets aan de PDF.

- `lib/reports/period-report-pdf.tsx` — nieuw begrip `PeriodReportTopic`: secties
  bepalen welke pagina's bestaan, onderwerpen bepalen welke blokken erin komen.
  Elk van de vijftien onderwerpen heeft nu een eigen blok, inclusief een splitsing van
  Issues ↔ NCR, HSE-observaties ↔ HSE-incidenten, leveringen ↔ vertragingen en
  lopend ↔ afgerond werk.
- `lib/reports/period-report-docx.ts` — dezelfde splitsing in de Word-export.
- De rapporthistorie downloadt nu bewust de **volledige** periode in plaats van de
  toevallig aangevinkte selectie van dat moment.

## 6. Issue → tekening, vanaf het issue zelf

Was: alleen andersom, via Tekeningen & pins een bestaand issue opzoeken.

- `operational-workspace.tsx` — knop **"Plaats op tekening"** op de issue-kaart
  (of "Bekijk op tekening" als er al een pin is).
- `drawing-workspace.tsx` — `initialFindingId` zet het koppeltype op *observatie* en
  het issue voorgeselecteerd, springt naar de bestaande pin als die er is, en toont een
  banner met de volgende stap.

## 7. Projectnaam in de koppen

`operational-workspace.tsx` (modulebalk en werkruimtekop) en `project-action-center.tsx`
tonen nu de projectnaam in plaats van `Project · Main building` — precies de balk uit de
screenshot van de klant.

## 8. Live weer in elke module

Was: alleen op het overzicht en in Projectstart.

- `lib/weather-client.ts` (nieuw) — één gedeelde, gecachete bron per projectlocatie met
  auto-verversing per 10 minuten. Meerdere schermen delen één verzoek.
- `app/live-weather-chip.tsx` (nieuw) — weerchip in de **topbalk**, dus zichtbaar op elk
  scherm; kleurt oranje bij harde wind of zware regen; klik = verversen.
- Het overzichtspaneel draait op dezelfde bron, dus geen dubbele API-aanroepen meer.

## 9. Works ongoing / completed / delays zijn nu te bekijken

Was: de tegels openden alleen een generiek invoerscherm. De eigenaar kon niets zien.

- `app/daily-work-register.tsx` (nieuw) — module **Dagwerk** met drie tabbladen
  (lopend / afgerond / vertragingen), filter per gebouw, datum, voortgangsbalk en
  vertragingsoorzaak met urenverlies. Elke regel komt uit een bevestigde dagafsluiting,
  dus de eigenaar ziet dezelfde feiten als het rapport.
- `lib/supabase/operations.ts` — `day_closeouts` zit nu in de momentopname (`dailyWork`).
- De drie tegels openen deze module; "Vastleggen" opent alsnog het invoerscherm.

## 10. De eigenaar kon die schermen niet zien — rol gerepareerd

Tijdens de flowcontrole bleek de projectrol `client` (de eigenaar/opdrachtgever) alleen
`reports.readapproved`, `reports.sign` en de indieningsrechten te hebben. Daardoor zou
**precies de persoon voor wie punt 9 is gebouwd** een leeg scherm zien.

- `supabase/migrations/202607300006_owner_read_access_to_daily_work.sql` (nieuw) —
  alleen-lezen rechten voor de eigenaar: `records.read`, `reports.read`,
  `attendance.read`, `actions.read`, `inspections.read`, `findings.read`, `hse.read`,
  `files.read`, `audit.read`. Geen enkel schrijf-, verificatie- of beheerrecht erbij.
  De rol-trigger voor nieuwe organisaties is meegewijzigd.

## 11. Daglog — nu het eigen dagformaat van de klant

De klant wist zelf niet wat er precies mis was. Ik heb het uit hun **eigen weekrapport**
gehaald (`WEEKLY REPORT 16-12-'24 tot 20-12-'24.docx`, TELESUR CSC). Elke dag in dat
document bestaat uit exact deze blokken:

```
WEATHER CONDITIONS  ·  08:00-17:00
CONSTRUCTION IN PROGRESS -> CONSTRUCTION ACTIVITY & LOCATION
QC PERFORMED & ADVISE
HEALTH & SAFETY ISSUES
GENERAL ADVICE TO THE CONTRACTOR
```

**Wat er mis was:** de knop met het label **"Daglog"** opende een *bezettingsteller*
(plus/min per discipline). Dat is workforce, niet de daglog. Het echte dagformaat zat
verstopt in een vierstaps vragenlijst van 19 rapportsecties.

**Wat er nu is** (`app/daily-log-modal.tsx`, nieuw):
- Een scherm met precies de blokken hierboven, in dezelfde volgorde.
- Weer en werktijden worden **getoond** uit Projectstart (al automatisch gevuld met het
  live weer); ontbreekt de startcontrole, dan staat er een knop om die te bevestigen.
- Aanklikbare standaardkeuzes per blok en dicteren op elk tekstveld.
- Werk afgerond + voortgangsschuif, vertraging met urenverlies, planning morgen.
- Bezetting en foto's blijven beschikbaar, maar als **uitklapbaar onderdeel** in plaats
  van de hele daglog.
- Opslaan schrijft de echte `day_closeouts`-registratie, dus dagrapport, periode-PDF en
  de module Dagwerk tonen daarna dezelfde feiten. Voorheen werd het een losse notitie.
- Ontbrekende verplichte velden worden vooraf benoemd in plaats van bij het opslaan te falen.

De oude `OneTapDailyLogModal` en twee bijbehorende hulpcomponenten zijn verwijderd.

## 12. Mobiele header en gebouwkeuze

- **Header was te vol.** Op de telefoon stonden breadcrumb, weer, taal, synchronisatie,
  instellingen en meldingen naast elkaar; de projectnaam werd afgekapt tot `F.. 2`.
  De header toont nu **projectnaam - weer - synchronisatie - meldingen**. Taal en
  instellingen zaten al in de onderbalk onder *Meer*; de taalkeuze is daar expliciet
  toegevoegd aan de Managementkop zodat hij op mobiel vindbaar blijft.
- **Gebouwkeuze is nu altijd een dropdown.** De variant met een knoppenrij groeide mee
  met elk gebouw en duwde de rest van het formulier weg. De dropdown is bovendien
  expliciet `position: static`, hij plakt nergens aan de bovenkant.

---

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **Deployen** | De klant kijkt nog naar een build van vóór 12:36. Zonder deploy verandert er voor hem niets. |
| **Migraties uitvoeren** | 202607300004, 05 en 06 zijn **niet lokaal uitgevoerd**: Docker draait niet op deze machine. De SQL is met de hand nagelopen tegen het bestaande schema, maar moet nog tegen een echte database aan. |
| **E2E-suite** | Slaat over zonder `CODECO_E2E_EMAIL` / `CODECO_E2E_PASSWORD`; in deze sessie dus niet gedraaid. |
| **"Daglog klopt niet"** | Opgelost, zie punt 11: herbouwd naar het dagformaat uit het eigen weekrapport van de klant. |
| **Rapid Verify** | Blijft trefwoordzoeken op PDF/tekst zonder OCR. Semantische analyse staat als prompt in `externe-ai-promptlijst.md`. |

## Aanbevolen acceptatievolgorde

1. Migraties 202607300004 t/m 06 uitrollen naar het gekoppelde Supabase-project.
2. Deployen.
3. Foto maken → opslaan → markeren met classificatie *Alternatieve oplossing* →
   controleren dat de marker **rood** is en dat de foto als `NCR-…` in de bibliotheek staat.
4. Als aannemer een RFI indienen via Management, als eigenaar tweemaal antwoorden en
   controleren dat **beide** besluiten in de tijdlijn blijven staan.
5. Een rapport maken met alleen "Works ongoing" aangevinkt en controleren dat
   "Works completed" er echt niet in staat.
6. Inloggen als eigenaar en controleren dat Dagwerk gevuld is.
