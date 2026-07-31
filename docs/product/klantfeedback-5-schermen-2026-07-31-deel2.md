# Klantfeedback op vijf schermen — 31 juli 2026, tweede reeks

Bron: vijf schermafbeeldingen met aantekeningen van CODECO (#4 daglog, #8 HSE,
#9A registers, #10 inspecties, #11 technische instructie).
Vervolg op `klantfeedback-5-schermen-2026-07-31.md`.

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib tests next.config.ts` schoon ·
`next build` slaagt · 27/27 knipseltests groen (1 nieuwe regressietest voor deze reeks).

---

## #10 "Ik kan geen checklist invullen!" — dit was een echte blokkade

Een inspectie starten kon wel, maar daarna niet meer openen: de lijst toonde hem als
*in progress* en de rijen waren niet aanklikbaar. De checklist was daarmee onbereikbaar.

- `lib/supabase/operations.ts` — `loadInspectionResponses()` (nieuw) leest de al
  opgeslagen antwoorden van één inspectie.
- `app/operational-workspace.tsx` — `resumeInspection()` opent de checklist opnieuw, legt
  de bewaarde antwoorden over de controlepunten en laat je afronden. Kan de checklist niet
  worden geladen (niet meer gepubliceerd, of de antwoorden zijn onleesbaar), dan zegt het
  scherm dat expliciet in plaats van stil te falen.
- `RecordList` heeft nu een knop per rij: **Checklist invullen** bij status *planned*,
  *in progress*, *failed* of *ready for reinspection*. Afgeronde inspecties krijgen die
  knop niet.

## #8 HSE

- **"Dubbel."** De situatiechips (*Safe work observed*, *Unsafe work area*, …) zetten het
  type al. De aparte dropdown *Type* stond ernaast en zei hetzelfde. Die staat nu in het
  blok *Andere HSE-situatie*, waar je hem gebruikt als je afwijkt van de chips. *Ernst*
  blijft direct zichtbaar.
- **"Geen tekst bij foto mogelijk!"** Elke HSE-bewijsfoto heeft nu een eigen veld
  *wat is te zien?*. Die tekst wordt de titel van het bestand en gaat mee in de
  omschrijving; zonder tekst valt hij terug op de titel van de registratie.
  `FindingPhotoStack` kreeg daarvoor optionele `captions`, dus hetzelfde patroon is later
  beschikbaar voor issues en inspecties.
- **"Niet nodig hier"** bij *Exacte projectlocatie*. Zolang er geen locatieboom voor het
  gebouw bestaat, kon dat veld alleen "geen diepere locatie" zeggen en daarna melden dat
  er geen boom is. `LocationPicker` rendert nu niets in dat geval — in álle formulieren.
  Zodra er verdiepingen of ruimten zijn, of het project een diepteniveau verplicht stelt,
  komt het veld terug.
- **"Waarom komt hier niet gelijk me invoerscherm?"** Bij het openen van een module stond
  `showForm` op `false`, dus je zag alleen de lijst en moest eerst op *Nieuw* drukken. Een
  module openen betekent dat je iets wilt vastleggen: het formulier staat er nu direct.
  *Nieuw* blijft de knop om het weg te klappen.

## #11 Technische instructie / beheerde documenten

- **"Project info boven."** Nieuw blok bovenaan het formulier met project en projectcode,
  waarvoor het document geldt, uitgiftedatum en -tijd, en wie het opmaakt.
- **"Boven."** De datumsectie (*Datums technische instructie*) is verplaatst naar boven,
  direct onder de projectinfo, in plaats van halverwege het formulier.
- **"Kunnen kiezen wie het opmaakt."** *Opgemaakt door* is een keuzelijst met de
  ingelogde gebruiker en de medewerkers van de organisatie, plus *iemand anders · naam
  typen*. De gekozen naam komt in het document (`issued_by`) terecht; eerder was dat altijd
  de ingelogde gebruiker.
- **"Kan ook algemeen."** Het gebouw van een beheerd document kan op *Alle gebouwen*
  staan; het document wordt dan projectbreed opgeslagen zonder gebouw (`building_id` is
  nul, wat het schema al toestond).
- **"Pinpoint op PDF optie."** Naast de locatie staat nu **Locatie op tekening** met de
  tekeningen van het gekozen gebouw, plus een link naar de tekeningwerkruimte om een pin
  te plaatsen. De gekozen tekening wordt bij het document opgeslagen
  (`drawing_file_id` en `drawing_name`).
- **Twee doorgestreepte voorbeeldchips** (*Replacing generator of Central Lab* en
  *Execution instruction*) zijn verwijderd. Een technische instructie is altijd
  projectspecifiek; voorbeelden uit een ander project moesten alleen weer weggegooid worden.

## #9A Registers

- **"Foto optie ontbreekt."** Het registerformulier kon alleen documenten uploaden. Er is
  nu een camerablok met dezelfde fototekst per foto als bij HSE. De foto's worden aan het
  registeritem gekoppeld (`file_links.record_type = 'register_entry'`) en verschijnen als
  visuele opname in *Foto's & mappen*.
- **"Dit moet weg onder delivery!"** Onder het registerformulier (dat op *Delivery* start)
  stond het hele BOQ-importblok open, met daaronder het BOQ-voortgangsregister. Dat heeft
  niets met een levering te maken. Het zit nu in een dichtgeklapt blok
  **Meetstaat · import en voortgang** met het aantal BOQ-regels erbij. De functie is
  behouden, één tik weg — verwijderd is hij niet, want de meetstaat is elders wel nodig.

  Dit is een interpretatie van de aantekening; die is voor twee dingen te lezen. De andere
  lezing — de tellers *WCR* en *RFI* onder de registertegels moeten weg — is al opgelost in
  de ronde van 30 juli: die tegels worden nu weggefilterd in de werkruimte
  (`externalSubmissionRegisterTypes`) en stonden alleen nog op de oude deploy waarvan de
  schermafbeelding komt. *Submittal* staat er nog wel; die is nooit als aannemersindiening
  aangemerkt. Zie de openstaande punten hieronder.

## #4 Daglog

- **"Ik kan hier niet van beide gebouwen invullen!"** De daglog gebruikte één gebouw. Nu
  staan alle gebouwen als aanvinkbare keuze (`BuildingMultiPicker`, dezelfde component als
  bij de veldregistratie) en wordt de dagafsluiting **per aangevinkt gebouw** opgeslagen,
  inclusief de bezetting. Foto's gaan één keer mee, bij het eerste gekozen gebouw.
- **Doorgestreepte bezettingsregels** (*Opdrachtgever*, *Supervisie*, *Uitvoering*). Er
  werd automatisch een teller-regel per projectpartij klaargezet, ook voor partijen die
  geen arbeiders leveren. Die regels zijn weg: je kiest **partij + discipline** en tikt
  *Persoon toevoegen*. Bestaande regels met een vastgelegd aantal blijven staan, en elke
  regel kan met een kruisje weg.
- **Twee vraagtekens bij *Quick entry* / *Complete client log*.** Die twee modi bestaan
  sinds de herbouw van de daglog niet meer; de tekst op de snelkoppeling beloofde ze nog
  wel. Die zegt nu waar de knop echt voor is: *de dag van vandaag in je eigen
  rapportformaat*. De volledige dagvragen blijven bereikbaar onderin de daglog.
- De doorgestreepte context-chips *Location* en *Weather* boven het formulier bestaan in
  de huidige daglog niet meer; die zijn met de herbouw van 30 juli al vervallen. Het weer
  zelf blijft staan, want het is een verplicht onderdeel van het dagrapport van de klant.

---

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **Deployen** | De klant kijkt naar een oudere build. Zonder deploy verandert er voor hem niets. |
| **"Dit moet weg onder delivery!" navragen** | Verwerkt als: het BOQ-blok hoort niet open onder het registerformulier. Bij de acceptatie aan de klant vragen of dat klopt, of dat hij iets anders bedoelde (bijvoorbeeld de tegel *Submittal*). Terugdraaien of aanscherpen is een kleine wijziging. |
| **Pin echt op de PDF zetten vanuit het formulier** | Het formulier kiest de tekening; het plaatsen van de pin op coördinaat blijft de tekeningwerkruimte. Een minikaart in het formulier zelf is een volgende stap. |
| **Fototekst bij issues en inspecties** | De component ondersteunt het al; alleen HSE en registers gebruiken het nu. Doortrekken zodra de klant dat daar ook wil. |
| **Werkuren per bezettingsregel** | Toegevoegde regels nemen de standaardwerktijden van het project over; per regel afwijken kan nog niet. |
| **E2E-suite** | Slaat over zonder `CODECO_E2E_EMAIL` / `CODECO_E2E_PASSWORD`; in deze sessie niet gedraaid. |

## Aanbevolen acceptatievolgorde

1. Deployen.
2. Inspecties openen → bij een inspectie *in progress* op **Checklist invullen** tikken,
   punten beantwoorden en afronden.
3. HSE openen: het formulier staat er direct, er is één *Type*-keuze, en een foto krijgt
   een eigen tekst.
4. Een technische instructie maken met *Alle gebouwen*, een andere opsteller en een
   gekozen tekening; controleren dat de kop van het document dat overneemt.
5. Een registeritem *Delivery* opslaan met twee foto's en controleren dat ze bij het item
   én in *Foto's & mappen* staan.
6. Een daglog opslaan met beide gebouwen aangevinkt en twee bezettingsregels die je zelf
   hebt toegevoegd.
