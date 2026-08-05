# Klantfeedback op vijf schermen — 4 augustus 2026

Bron: vijf schermafbeeldingen met aantekeningen van CODECO (#19 tekeningenwerkruimte, #20 het
opnamescherm *Record activity*, #21 het dagelijkse log dat onder Workforce opende, #23 en #23A
het issueformulier). Vervolg op de reeks van 2 augustus.

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib tests next.config.ts` schoon ·
`next build` slaagt · 59/59 knipseltests groen (1 nieuwe regressietest voor deze reeks, plus
unittests voor de ordening van de fotobibliotheek).

Niet lokaal gecontroleerd: de migratie `202608040004_registration_drawing_pins.sql` en de
pgTAP-suite. Deze omgeving heeft geen Docker, dus die draaien pas in de CI-job *Database
migrations, lint and pgTAP*.

---

## Vooraf: de foto's en mappen geordend

De bibliotheek was één lange strook beelden met een mappenbalk die het hele project telde
terwijl de strook één gebouw toonde. Op locatie leest dat als foto's die kwijt zijn.

Eén regel geldt nu overal: **een map telt precies wat de galerij erin laat zien.** Daarnaast:

- de mappen van de dagelijkse routine staan vooraan, in de volgorde waarin de klant werkt
  (Dagvoortgang, Inspecties, Bevindingen, HSE, Leveringen, 360°-rondgangen); zelfgemaakte
  mappen volgen alfabetisch;
- de foto's staan onder de dag waarop ze zijn gemaakt — *Vandaag*, *Gisteren*, en daarna de
  datum voluit — met de nieuwste dag bovenaan en binnen een dag de nieuwste foto bovenaan;
- een foto zonder bruikbare datum verdwijnt niet, maar staat achteraan onder *Zonder datum*.

De regels zelf staan in `lib/media/photo-library.mjs` en zijn los getest, inclusief het
tijdzonegeval dat een foto van 21:30 uur niet morgen laat worden.

## #19 · "Deze pin moet automatisch Dailyworks heten"

De pin werd geplaatst door uit een lijst met alles in het project een record te kiezen. Een
supervisor die in Dagwerk staat heeft dat record nog niet: hij is het aan het schrijven.

- **De pin hoort bij de registratie die openstaat.** Vanuit het opnamescherm tik je op
  *Open de tekening om een pin te plaatsen*, kiest de plek, en de pin wordt geplaatst zodra de
  registratie wordt opgeslagen — met het nummer, de naam en de datum van die registratie zelf.
  De database vult die naam (`ACTIVITY · 04-08-2026`), niet het formulier.
- **De lijst "Select item to be linked" is weg**, zoals gevraagd. Een issue of NCR komt hier
  binnen via *Plaats op tekening* op zijn eigen kaart; tikken plaatst hem meteen.
- **Vrij tekenen is weg.** Revisiewolk, pijl en tekst blijven; bestaande vrije lijnen worden
  nog gewoon getoond.
- **Elke pin heeft een kleur en draagt zijn code**, met een legenda naast de tekening.

Database: `drawing_pins` accepteert nu `linked_record_type = 'registration'`, met dezelfde
rechtencontrole als de andere types.

## #20 · "Kan hier staan waarin ik bezig ben?"

Het opnamescherm vraagt het nu zelf: **Waar ben je mee bezig?** met *Werkzaamheden gaande*,
*Werkzaamheden afgerond* en *Vertraging*. De keuze zet het recordtype (een vertraging wordt als
vertraging vastgelegd), stelt de zin voor die erbij hoort en staat in de regel die naar het
register gaat — dezelfde woorden die de pin op de tekening krijgt.

## #21 · "Hier moet ik alleen personeel van diverse disciplines kunnen tellen"

Dit was al opgelost in de ronde ervoor: de tegel Workforce opent het aanwezigheidsscherm, en
dat scherm telt per aannemer én per discipline in plaats van het hele dagrapport te openen.
Deze ronde is er niets aan veranderd; de regressietest die dat vastlegt staat er nog.

## #23 en #23A · Het issueformulier is het formulier van de klant

Doorgestreept en verdwenen van het issuescherm: de kant-en-klare probleemknoppen en de
historische B1-catalogus. Beide blijven op het NCR-formulier staan, waar ze om gevraagd zijn.

- **Type** is nu de indeling die de klant gebruikt: *Veiligheid, Kwaliteit, Materieel,
  Materialen, Planning, Operationeel*. Het interne recordtype vraagt de app niet meer; een
  issue is een tekortkoming, een NCR schrijf je in de NCR-module.
- **Priority** is *Hoog · 3 dagen*, *Middel · 7 dagen*, *Laag · 14 dagen*. De deadline blijft
  erbij staan omdat die regelgestuurd is. *Kritiek* blijft alleen op het NCR-formulier.
- **Disposition** is van het issuescherm verdwenen.
- **Impact** en **Vereiste opvolging** kunnen worden ingevoerd: onder de keuzeknoppen staat het
  tekstvak zelf, in plaats van verstopt achter *Andere impact of actie*. Een keuze vult het vak
  en blijft bewerkbaar.
- **Handtekening**: naast het formulier stond "signature". Het issue wordt nu ondertekend zoals
  elk ander document in de app — met de handtekening die op dat moment wordt geschreven.
