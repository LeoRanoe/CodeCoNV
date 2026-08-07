# Klantfeedback op vijf schermen — 7 augustus 2026

Bron: vijf schermafbeeldingen met aantekeningen van CODECO — een optielijstenoverzicht
("NCR FORM – SELECT OPTION LISTS": Category, Type, Source), een schone "New NCR"-opname
(Recommended Action by Engineer, Proposed Corrective Action by Contractor, Quality
Control / Verification), een doorgestreept "Project Delay Report"-scherm, een volledig
geannoteerd "New NCR"-scherm (13 genummerde vakken) en een "Lessons Learned"-scherm.

Gecontroleerd: `npx tsc --noEmit` schoon (afgezien van ontbrekende `public/landing/*`-
beeldbestanden in deze checkout, niet aan deze reeks gerelateerd) · `npx eslint app lib
tests next.config.ts` schoon · `next build` slaagt · 92/92 knipseltests groen (1 nieuwe
regressietest voor deze reeks).

Niet lokaal gecontroleerd: de migratie `202608070002_ncr_quality_control_signature.sql`
en de pgTAP-suite. Deze omgeving heeft geen Docker, dus die draaien pas in de CI-job
*Database migrations, lint and pgTAP*.

---

## Eerst: waar deze vijf schermen wél en niet bij aansluiten

Dit zijn geen schermafdrukken van de live app. De opmaak (donkere achtergrond, gele
accenten, telefoonstatusbalk, onderbalk *Dashboard / Inspections / NCR / Reports /
Field Forms / More*) komt uit een ander ontwerp dan de CODECO-webapp
(`app/codeco-supervision-app.tsx` met `app/operational-workspace.tsx` als NCR-scherm
erin). Voor iedere aantekening is nagegaan of het onderliggende veld of scherm al
bestaat, om te voorkomen dat er een module wordt gebouwd die de klant niet heeft
gevraagd:

- **"Source"-optielijst (scherm 1, doorgestreept) en het Source-veld op scherm 4.**
  Bestaat niet in de NCR-module en heeft nooit bestaan — er is dus niets te
  verwijderen. Wat er wel staat: *Issue type* en *Priority*, niet in de vorm
  *Category / Type / Source*.
- **Standard/Specification, Clause/Requirement, de losse tekstbox "Corrective Action
  Required" (scherm 4, doorgestreept).** Bestaan evenmin in de NCR-module.
- **De herstructurering naar aanbevolen actie → correctie van de aannemer →
  kwaliteitscontrole, als apart vervolg op het aanmaken van de NCR (scherm 2, "next
  photo").** Dit is al gebouwd, sinds de ronde van 1 augustus
  (`docs/product/klantfeedback-5-schermen-2026-08-01.md`): de NCR wordt aangemaakt,
  de aannemer vult zijn correctie in via de beveiligde link, en CODECO sluit af via
  *Kwaliteitscontrole · afsluiten*. Deze drie vakken staan al naast elkaar op de
  NCR-kaart.
- **Project Delay Report en Lessons Learned.** Bestaan niet als module, hebben geen
  eigen papieren formulier in `tmp/client_context/pdf_pages` (waar wel `ncr`, `wir`,
  `inspection`, `rfi`, `rfa`, `monthly` staan) en zijn op uitdrukkelijk verzoek van
  CODECO **niet** in deze ronde gebouwd — alleen bestaande velden/logica van de
  NCR-module zijn aangepast, in de bestaande vormgeving van de app.

## Wat wél ontbrak: de handtekening op Quality Control / Verification

Op scherm 2 (het schone "next photo"-voorbeeld) staat op het vak *Quality Control /
Verification* een verplicht handtekeningveld — `Signature *` met naam, positie en
datum — precies zoals de andere twee vakken van hetzelfde formulier (*Recommended
Action by Engineer*, *Proposed Corrective Action by Contractor*) al ondertekend worden.
Dat ontbrak: het afsluiten van een NCR (*Kwaliteitscontrole · afsluiten*) legde alleen
een tekstnotitie vast; de geverifieerde naam kwam pas achteraf uit `verified_by`, de
database-kolom die de ingelogde gebruiker vastlegt.

- **De afsluitstap vraagt nu om dezelfde handtekening** als de rest van het NCR-formulier
  — geschreven op het moment van afsluiten, net als bij het aanmaken van de NCR en het
  antwoord van de aannemer. Alleen voor een NCR is de handtekening verplicht; een gewoon
  issue kan nog zonder worden geverifieerd.
- **De database bewaart de handtekening bij het dossier zelf**, niet alleen bij de
  gebruiker die toevallig het PDF/Word-bestand downloadt: `issue_management` krijgt
  `verification_signed_by`, `verification_signed_at` en `verification_signature_image`,
  op dezelfde manier als de bestaande `correction_signed_by` en `completion_signed_by`.
- **Op de NCR-kaart en in de gegenereerde PDF/Word staat de handtekening** onder het
  vak *Quality control*, met dezelfde opmaak als de andere twee handtekeningen.

### Migratie hoort hierbij

`supabase/migrations/202608070002_ncr_quality_control_signature.sql`:

- voegt `issue_management` toe aan de kolommen die een statusovergang mag wijzigen
  (`app_private.validate_finding_transition`) — die trigger stond het nog niet toe,
  terwijl `transition_project_finding` als de ingelogde gebruiker draait (niet als de
  service-role van de externe-link-flow) en dus wél tegen die controle aanloopt;
- voegt een nieuwe overload van `transition_project_finding` toe met twee extra
  argumenten voor de handtekening, verplicht zodra een NCR (niet een gewoon issue)
  wordt gesloten;
- **laat de bestaande zesargumentfunctie ongewijzigd staan**, zodat een omgeving die
  deze migratie nog niet heeft gedraaid gewoon kan blijven afsluiten — de app valt dan
  terug op de oude functie en slaat de handtekening niet op, precies zoals eerder bij
  `202608040003_written_contractor_signature.sql` is gedaan.

**De app werkt ook zonder deze migratie**: `transitionFinding` herkent de
schema-foutmelding en valt terug op de oude aanroep zonder handtekening. Draai
`supabase db push` om de volledige ronde te krijgen — zonder migratie kan een NCR dan
nog niet worden afgesloten, omdat de UI de handtekening verplicht stelt maar de
database die niet opslaat.

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **`supabase db push`** | Zonder de migratie blokkeert de UI het afsluiten van een NCR met een lege handtekening, terwijl de database die nog niet kan opslaan. |
| **Project Delay Report / Lessons Learned** | Geen eigen module; alleen de bestaande NCR-velden zijn aangepast. Een apart traject nodig zodra de klant deze twee formulieren daadwerkelijk in de app wil. |
| **Category / Type / Source als aparte optielijsten** | Niet gebouwd — het onderliggende veld bestaat niet en is niet expliciet gevraagd voor deze ronde. |
| **pgTAP-suite** | Draait pas in de CI-job *Database migrations, lint and pgTAP*; deze omgeving heeft geen Docker. |

## Aanbevolen acceptatievolgorde

1. `supabase db push` draaien.
2. Werkruimte → *NCR*: een NCR aanmaken en ondertekenen zoals gebruikelijk.
3. Naar aannemer sturen, de link openen en de correctie met handtekening insturen.
4. Op de NCR-kaart op *Kwaliteitscontrole · afsluiten* tikken: het formulier vraagt nu
   om een handtekening voordat *Bevestig menselijke statuswijziging* actief wordt.
5. Ondertekenen en bevestigen; controleren dat de NCR-kaart de handtekening onder
   *Quality control* toont, en dat de gedownloade PDF en het Word-bestand die
   handtekening ook op de derde ondertekenlijn tonen.
