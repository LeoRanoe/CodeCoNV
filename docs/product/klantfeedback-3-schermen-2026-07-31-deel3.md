# Klantfeedback op drie schermen — 31 juli 2026, derde reeks

Bron: drie schermafbeeldingen met aantekeningen van CODECO (#7 issues, #9 projectregister,
#12 technische instructie). Vervolg op deel 1 en deel 2 van dezelfde dag.

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib tests next.config.ts` schoon ·
`next build` slaagt · 29/29 knipseltests groen (1 nieuwe regressietest voor deze reeks).

---

## Waar het issueformulier staat

Voor de duidelijkheid, want dit was de vraag: het issueformulier zit in
`app/operational-workspace.tsx`, in het blok `tab === "findings"`. In de app kom je er via
**Werkruimte → module *Issues*** (of via **Punchlist** in de onderbalk, die opent dezelfde
module). Sinds deel 2 staat het formulier direct open bij het openen van de module; de knop
*Nieuw* klapt het weg. De lijst eronder is `FindingList`; de kaarten daarin hebben de knoppen
*Foto koppelen*, *Naar externe partij sturen*, *PDF*, *Word*, *Voortgang vastleggen* en
*Status bijwerken*.

## #7 Issues

- **"NCR hoort hier niet thuis."** De twee tabkaarten *Issues* / *NCR* bovenaan het scherm
  zijn weg. Issues en NCR's zijn nu **twee aparte modules** in de moduleschakelaar
  (*Issues* en *NCR*), elk met eigen aantal. Het scherm zelf is daarmee, zoals de klant
  schreef, uitsluitend voor issue-invoer. NCR's blijven bereikbaar — ze zijn niet verdwenen,
  alleen niet meer vermengd met de issue-invoer.
- **"Graag de kolommen van de Excel opnemen hier."** Eerst verwerkt op basis van de
  punchlist **B1-MOH**; dat was het verkeerde bestand. Na terugkijken is de bron het
  eigen sjabloon van de klant: `tmp/client_context/xls_conversion/Issue_Management_Template_Codeco.xlsx`,
  blad **Issues_Tracking_Log**, kopregel 8. Die kolommen zijn nu één op één aangehouden,
  met de namen van de klant:

  | Excel-kolom | In de app |
  | --- | --- |
  | A · No. | automatisch issuenummer (`Q-2026-0007`) |
  | B · Current Status | de statusstroom van de app (open → in uitvoering → gereed voor verificatie → geverifieerd) |
  | C · Priority | *Priority* — Critical / High / Medium / Low, met de deadline per niveau |
  | D · Issue Description | *Issue Description*, staat nu vooraan in plaats van weggeklapt |
  | E · Assigned To Owner | *Assigned To Owner* |
  | F · Expected Resolution Date | *Expected Resolution Date* |
  | G · Escalation Required (Y/N) | *Escalation Required (Y/N)* |
  | H · Impact Summary | *Impact* met keuzechips plus vrij veld |
  | I · Action Steps | *Vereiste opvolging* met keuzechips plus vrij veld |
  | J · Issue Type | *Issue Type* — Informational / Procedural / System / Other, in die volgorde |
  | K · Date Identified | *Date Identified* (nieuw veld) |
  | L · Entered By | automatisch: de ingelogde gebruiker, staat als regel onder het formulier |
  | M · Actual Resolution Date | automatisch bij verificatie (`verified_at`) |
  | N · Final Resolution & Rationale | *Final Resolution & Rationale* bij het afronden van het issue |

  De dropdownwaarden komen uit de datavalidatie van het werkblad zelf
  (`Open,Work In Progress,Closed` · `Critical,High,Medium,Low` · `Yes,No` ·
  `Informational, Procedural, System, Other`). Het gebouw mag ook *Alle gebouwen* zijn.
  De beoordeling gevalideerd / te corrigeren / alternatieve oplossing blijft staan: die
  komt uit de punchlist en staat niet in dit sjabloon, maar de klant gebruikt beide.

## #9 Projectregister

- **"Kan ook algemeen materiaal zijn."** Het gebouw van een registeritem kan op *Alle
  gebouwen* staan; het item wordt dan zonder gebouw opgeslagen. Het label zegt dat ook:
  *Gebouw · of algemeen materiaal*.
- **"Hier kunnen aangeven als geleverd materiaal voldoet of niet! Ook hoeveelheid kunnen
  zetten."** Bij een levering, materieel of test staat nu:
  - *Voldoet het geleverde materiaal?* met **Voldoet / Voldoet niet / Deels · zie
    toelichting**;
  - *Hoeveelheid* en *Eenheid*.

  Beide komen bij het registeritem te staan (`outcome`, `quantity`, `unit`) en de lijst
  toont ze in de regel; "voldoet niet" krijgt een rode status, zodat je het terugziet
  zonder het item te openen.
- **De doorgestreepte *Exacte projectlocatie*** verdwijnt zolang er geen locatieboom is;
  dat is in deel 2 al opgelost en geldt voor alle formulieren.

## #12 Technische instructie

Het formulier vraagt nu veel minder. Weggehaald: *Functie opsteller*, *Bedrijf opsteller*,
*Gericht aan / ontvanger* (los tekstveld), *Gerelateerde RFI / NCR / tekening*,
*Referentiedocumenten*, *Prioriteit*, *Reden voor instructie* en *Vereiste actie*.
Gebleven, zoals aangevinkt in de aantekeningen: *Discipline*, de upload en
*Bijlagen en aantal pagina's*.

- **"Naam."** De opsteller is een naam, geen functie: *Opgemaakt door* is de keuzelijst met
  teamleden (uit deel 2), de functie- en bedrijfsvelden zijn weg.
- **"To:"** *Betrokken projectpartij* heet nu **Aan:** en is het enige adresveld; de
  gekozen partij vult de ontvanger van het document.
- **"Handtekening van de opsteller."** Nieuw blok *Ondertekenen als opsteller van dit
  document*: naam en het moment van ondertekenen worden bij het document opgeslagen
  (`signed_by`, `signed_by_position`, `signed_at`) en de kop toont *Ondertekend* of *Nog
  niet ondertekend*.
- **"Kunnen versturen naar aannemer."** Nieuwe knop **Naar aannemer sturen** op de
  documentkaart: opent WhatsApp met documentnummer, project, onderwerp, omschrijving,
  ontvanger, deadline en opsteller. De formele PDF of Word blijft de bijlage; die knoppen
  staan ernaast.
- **"Optie om schetsje te maken, foto te plaatsen."** Foto's kunnen sinds deel 2 bij elk
  registeritem, dus ook bij een technische instructie, met een tekst per foto. Een
  schetsblok is er nog niet — zie openstaande punten.

### Belangrijk technisch punt bij het weghalen van velden

De database eist voor een technische instructie een `requested_to`, een `reason` **en** een
`required_action` (`app_private.valid_controlled_register_details`). Zonder die drie
weigert de RPC het document. De velden zijn daarom uit het formulier gehaald maar niet uit
het document: `requested_to` komt van de gekozen partij, `reason` valt terug op de
omschrijving en `required_action` blijft `proceed`. Zo blijft opslaan werken zonder migratie.
Wil de klant die velden ook echt uit het document, dan hoort daar een migratie bij die de
controle versoepelt — dat is een aparte, te testen wijziging.

---

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **Deployen** | Zonder deploy verandert er voor de klant niets. |
| **"Liever 1 type invoerscherm" / "Waarom is dit scherm anders?"** | Terechte opmerking, en groter dan deze ronde: elke module heeft nu zijn eigen vorm. Wat al gelijkgetrokken is: het formulier staat direct open, de lege locatiekiezer is overal weg, foto's met tekst werken in HSE, registers en de daglog op dezelfde manier. Eén gedeeld invoerpatroon voor alle modules is een apart ontwerptraject. |
| **Schetsje maken** | Nog niet gebouwd. Vrij tekenen bestaat wel op PDF-tekeningen (tekeningwerkruimte); een los schetsvlak in het formulier is nieuw werk. |
| **Verstuurde TI vastleggen** | De WhatsApp-knop opent het bericht; er wordt nog niet vastgelegd dát er verstuurd is. Een beveiligde deellink zoals bij issues vraagt een migratie: `external_share_links.source_type` kent nog geen registeritem. |
| **Ondertekening is een bevestiging, geen getekende krabbel** | Naam + moment worden vastgelegd. Een met de vinger getekende handtekening is nieuw werk (canvas + bestand). |
| **E2E-suite** | Slaat over zonder `CODECO_E2E_EMAIL` / `CODECO_E2E_PASSWORD`. |
| **Current Status letterlijk overnemen** | De app heeft een rijkere statusstroom dan de drie van het werkblad (Open / Work In Progress / Closed). Die stroom is bewust behouden; bij export naar het Excel-formaat kunnen de app-statussen op die drie worden teruggebracht. Aan de klant te bevestigen. |

## Aanbevolen acceptatievolgorde

1. Deployen.
2. Werkruimte → *Issues*: onderwerp, omschrijving, uitgiftedatum en eerste opleverdatum
   invullen en opslaan; controleren dat NCR een eigen module is.
3. Registers → *Delivery*: hoeveelheid + eenheid invullen, *Voldoet niet* kiezen en opslaan;
   controleren dat de regel rood is en hoeveelheid toont.
4. Een technische instructie maken: alleen onderwerp, omschrijving, discipline, aan-wie,
   deadline; ondertekenen; opslaan; daarna *Naar aannemer sturen* en de PDF downloaden.

---

# Naronde op de deploy — 31 juli 2026

De klant heeft de gedeployde build op zijn telefoon bekeken (IMG_7103 en IMG_7104). Drie
dingen kwamen daaruit, plus twee punten die ik eerder had laten liggen.

## Kapotte UI onder het omschrijvingsveld — mijn fout

`.form-field` is een grid. De knop *Wissen* die ik onder het tekstvak plaatste rekte
daardoor over de volle breedte uit, en de dicteerknop staat `position: absolute; bottom: 7px`
in datzelfde veld — die kwam dus bovenop die balk te liggen, half buiten het scherm.
*Wissen* staat nu in de labelregel naast *Korte omschrijving*, en kleine inline-knoppen
krijgen `justify-self: start` zodat ze nooit meer als volle balk uitrekken.

## Dicteren wist de voorgestelde tekst niet

Echte bug, en de reden was subtiel: `SpeechRecognition.onresult` wordt één keer gezet en
houdt de callback vast uit de render waarin het dicteren startte. Mijn controle "is dit nog
een voorstel?" las daardoor steeds dezelfde oude waarde. Dat betekende bovendien dat een
tweede gedicteerde zin de eerste overschreef.

`dictateDescription()` leest die vraag nu uit een ref en werkt de tekst bij met een
functionele update: de eerste zin vervangt het voorstel, elke volgende zin wordt eraan
toegevoegd. Geen handwerk meer.

## De tekening bracht je niet terug

"Wanneer ik een tekening opmaakt breng het mij naar een ander scherm maar het brengt mij
niet terug." De halfingevulde registratie bleef wel in het geheugen staan, maar er was geen
weg terug. Er staat nu een balk onderaan het scherm — boven de onderbalk op mobiel — met de
omschrijving en een knop **Terug naar de registratie**, plus een kruisje om de registratie
te laten vallen.

## Taal: apparaten die al Engels hadden

De standaardtaal stond op Nederlands, maar op zijn telefoon bleef de app Engels. De reden:
in dat toestel stond `codeco-language = en` uit de tijd dat Engels de standaard was —
niemand had dat gekozen, het was wat de app deed. Alleen een taal die in de taalkeuze wordt
aangeklikt geldt nu als keuze (`codeco-language-choice`); toestellen zonder die keuze openen
in het Nederlands en houden daarna wat de supervisor kiest.

## Schetsje maken — nu wel gebouwd

`app/sketch-pad.tsx` (nieuw): wit vel, vier penkleuren, pendikte, ongedaan maken en wissen.
De schets verlaat het blok als gewone PNG-foto, dus hij loopt over dezelfde weg als al het
andere bewijs: gekoppeld aan de registratie of het registeritem en zichtbaar in *Foto's &
mappen*. Beschikbaar bij de veldregistratie (naast *Maak of kies een foto*) en bij elk
registeritem, dus ook bij de technische instructie.

## "Waarom is dit scherm anders?" — eerste concrete stap

Het issuescherm begon met vier statustellers en de reviewcyclus-kaart; de andere modules
beginnen met het formulier. Die tellers staan nu **onder** het formulier. Elke module opent
daarmee hetzelfde: kop → invoerformulier → overzicht en lijst.

## Wat hierna nog open staat

| Punt | Status |
| --- | --- |
| **Eén invoerpatroon voor alle modules** | Volgorde is nu overal gelijk (formulier eerst). De velden zelf verschillen nog per module omdat de klantformulieren verschillen; verder gelijktrekken is een ontwerpkeuze die ik niet in zijn plaats maak. |
| **Verstuurde TI vastleggen** | De WhatsApp-knop opent het bericht; vastleggen dát er verstuurd is vraagt een migratie op `external_share_links.source_type`. |
| **Getekende handtekening op het document zelf** | De ondertekening is nu naam + moment. Het schetsblok kan een krabbel maken, maar die hangt als foto aan het document, niet in de ondertekeningsregel. |
| **Current Status letterlijk als in het Excel** | Nog te bevestigen met de klant. |
