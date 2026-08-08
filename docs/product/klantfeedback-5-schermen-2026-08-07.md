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

- laat een statusovergang de **kwaliteitscontrolehandtekening** in `issue_management`
  schrijven (`app_private.validate_finding_transition`) — die trigger stond dat nog niet
  toe, terwijl `transition_project_finding` als de ingelogde gebruiker draait (niet als
  de service-role van de externe-link-flow) en dus wél tegen die controle aanloopt.
  Alleen die drie velden gaan open: de rest van `issue_management` — de aanbevolen actie,
  de opmerkingen en de **handtekening van de ingenieur zelf** — blijft voorbehouden aan
  een bevindingbeheerder. Zie de naronde hieronder;
- **vervangt** `transition_project_finding` door een versie met twee extra argumenten
  voor de handtekening, verplicht zodra een NCR (niet een gewoon issue) wordt gesloten.
  De oude zesargumentversie wordt daarbij gedropt; zie de naronde hieronder waarom dat
  moet.

**De app werkt ook zonder deze migratie**: `transitionFinding` herkent de
schema-foutmelding en valt terug op de aanroep zonder handtekening. Draai
`supabase db push` om de volledige ronde te krijgen — zonder migratie kan een NCR dan
nog niet worden afgesloten, omdat de UI de handtekening verplicht stelt maar de
database die niet opslaat.

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **`supabase db push`** | Zonder de migratie blokkeert de UI het afsluiten van een NCR met een lege handtekening, terwijl de database die nog niet kan opslaan. |
| **Project Delay Report / Lessons Learned** | Geen eigen module; alleen de bestaande NCR-velden zijn aangepast. Een apart traject nodig zodra de klant deze twee formulieren daadwerkelijk in de app wil. |
| **Category / Type / Source als aparte optielijsten** | Niet gebouwd — het onderliggende veld bestaat niet en is niet expliciet gevraagd voor deze ronde. |
| **pgTAP-suite** | Draait volledig in de CI-job *Database migrations, lint and pgTAP*. De nieuwe suite `013` is hier lokaal wel gedraaid — zie de naronde. |

## Aanbevolen acceptatievolgorde

1. `supabase db push` draaien.
2. Werkruimte → *NCR*: een NCR aanmaken en ondertekenen zoals gebruikelijk.
3. Naar aannemer sturen, de link openen en de correctie met handtekening insturen.
4. Op de NCR-kaart op *Kwaliteitscontrole · afsluiten* tikken: het formulier vraagt nu
   om een handtekening voordat *Bevestig menselijke statuswijziging* actief wordt.
5. Ondertekenen en bevestigen; controleren dat de NCR-kaart de handtekening onder
   *Quality control* toont, en dat de gedownloade PDF en het Word-bestand die
   handtekening ook op de derde ondertekenlijn tonen.
6. Op dezelfde NCR *Inspectievoortgang vastleggen* op 100% zetten — die knop roept de
   transitiefunctie intern met zes argumenten aan en moet blijven werken (zie naronde).

---

# Naronde: de migratie tegen een echte database gedraaid

De eerste versie van deze ronde is alleen op het oog beoordeeld. Bij de eindcontrole is
de volledige migratieketen (62 migraties) alsnog tegen een lokaal PostgreSQL 16-cluster
gedraaid. Dat bracht twee fouten aan het licht die in productie kapot waren gegaan.

## 1. Twee functies met dezelfde naam maakten elke bestaande aanroep dubbelzinnig

De nieuwe handtekeningargumenten hebben een standaardwaarde. Naast de bestaande
zesargumentfunctie betekende dat: een aanroep met zes argumenten past op **allebei**, en
PostgreSQL weigert dan te kiezen:

```
ERROR:  function public.transition_project_finding(uuid, unknown, ...) is not unique
```

Dat trof niet alleen de app maar ook `record_issue_progress` uit
`202607240001_client_controlled_documents.sql`, dat de transitie intern met zes
argumenten aanroept. **Inspectievoortgang vastleggen op 100% zou stuk zijn gegaan** —
een bestaande functie, kapot door een nieuwe. De migratie dropt de oude versie nu
expliciet, zodat er precies één functie overblijft waar elke bestaande aanroep via de
standaardwaarden op uitkomt.

## 2. De handtekening van de ingenieur was te openen gezet

Om de kwaliteitscontrolehandtekening te kunnen schrijven, was `issue_management` in zijn
geheel vrijgegeven tijdens een statusovergang. In diezelfde kolom staan echter ook de
aanbevolen actie, de opmerkingen en de **geschreven handtekening van de ingenieur**. De
RLS-policy `findings_update` laat naast een bevindingbeheerder ook de toegewezen
gebruiker door — die had daarmee de handtekening van de ingenieur kunnen overschrijven.

De trigger controleert nu per sleutel: alleen `verification_signed_by`,
`verification_signed_at` en `verification_signature_image` mogen door een niet-beheerder
worden geschreven; verandert er iets anders in `issue_management`, dan geldt onverkort
"Only a finding manager may change the original observation".

## Wat er nu wordt bewaakt

`supabase/tests/013_ncr_quality_control_signature.pgtap.sql` legt dit vast in dertien
assertions, alle groen tegen de volledige migratieketen:

- de zesargumentfunctie bestaat niet meer naast de nieuwe, dus geen enkele aanroep is
  dubbelzinnig;
- een NCR bereikt verificatie via een zesargumentaanroep, die dus nog steeds resolvet;
- een NCR sluit **niet** zonder geschreven handtekening, en **wel** mét;
- de handtekening staat op de registratie zelf;
- een gewoon issue sluit nog steeds zonder handtekening;
- een toegewezen niet-beheerder kan de handtekening van de ingenieur niet overschrijven,
  terwijl de kwaliteitscontrolevelden wel beschrijfbaar blijven.

Dezelfde suite is ook gedraaid tegen de keten **zonder** deze migratie: daar faalt de
laatste assertie, wat bevestigt dat de migratie nodig is en precies genoeg opent.
