# Klantfeedback op drie schermen — 2 augustus 2026

Bron: drie schermafbeeldingen met aantekeningen van CODECO (#17 fotodetailscherm, #18 en #18A
het opnamescherm van visueel bewijs). Vervolg op de reeks van 1 augustus.

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib tests next.config.ts` schoon ·
`next build` slaagt · 51/51 knipseltests groen (1 nieuwe regressietest voor deze reeks).

---

## "Voor nr is 1 invoer voldoende" — één tekstvak per foto

Op #17 en #18 staan *Wat staat er op deze foto?*, *Categorie* en *Ruimte / locatie in eigen
woorden* doorgestreept, met een pijl naar het toelichtingsveld. Dat is nu het enige geschreven
veld dat een foto nog vraagt, op beide schermen:

> **Wat is er op deze foto te zien, en waarom is dat belangrijk?**

Het rapport heeft nog steeds een naam per bestand nodig. Die naam komt vanaf nu uit de eerste
zin van wat de supervisor schrijft (`photoTitleFromDescription`), afgekapt op een woord en niet
midden in een woord. Een markering op de foto mag de foto nog steeds zelf benoemen; in dat
geval wint die naam. In de regel die naar het register gaat wordt de titel weggelaten zodra hij
het begin van de toelichting is, zodat dezelfde zin niet twee keer boven elkaar staat.

Het gebouw blijft staan — de klant heeft dat veld afgevinkt.

## "Kan dit automatisch?" en "Automatisch, aub!" — de kijkrichting

De kijkrichting wordt niet meer gevraagd maar gemeten, in deze volgorde:

1. **Uit de foto zelf.** Een telefooncamera schrijft de kompaskoers in het beeld
   (EXIF `GPSImgDirection`). `lib/images/exif-direction.mjs` leest precies dat ene getal — geen
   bibliotheek, geen upload, en alleen de kop van het bestand.
2. **Uit het kompas van het toestel.** Binnen heeft een telefoon vaak geen fix en schrijft de
   camera niets. Het kompas start op de tik waarmee de camera opengaat: dat is het gebaar dat
   iOS vereist voordat het de oriëntatie afgeeft, en het is precies het moment dat de meting
   ertoe doet.
3. **Met de hand.** Meet geen van beide iets, dan staat de keuzelijst er nog, nu als
   *Niet gemeten · optioneel*. Opslaan wordt er nooit door geblokkeerd.

Is de richting gemeten, dan staat er een vaststelling in plaats van een vraag —
*NO · automatisch bepaald* — met een klein *Wijzig* ernaast.

## "Laten we met knopjes werken. En meerdere kiezen" — het gebouw

Het gebouw op het opnamescherm is een rij knoppen geworden (`BuildingChoiceField`) in plaats
van een keuzelijst: knoppen van 44 pixels hoog, te raken met een werkhandschoen aan. Er kunnen
meerdere gebouwen aan staan; de foto wordt dan onder elk gekozen gebouw opgeslagen, dezelfde
afspraak als bij een veldregistratie die meerdere gebouwen raakt. Het laatste aangevinkte
gebouw kan niet uit — een foto zonder gebouw bestaat niet.

De keuzelijst was ooit een bewuste keuze: een rij knoppen groeit mee met elk gebouw en duwde de
rest van het formulier van het scherm. Daarom houden de knoppen op bij acht gebouwen; een groter
project krijgt de lijst terug die het had.

## "Locatie kunnen kiezen in PDF!"

Naast de projectlocatie staat nu **Aanwijzen op tekening**. Die opent de bouwtekening van het
gekozen gebouw (PDF of afbeelding, met bladeren per pagina), waar de supervisor de plek aantikt
waar de foto is genomen. Wat dat oplevert:

- de locatie van de foto in woorden — de naam van de tekening en de pagina — zodat het
  handmatige ruimteveld dat de klant doorstreepte niet gemist wordt;
- een pin op die tekening, gekoppeld aan de foto, zodra het beeld de server bereikt. De foto is
  daarmee terug te vinden vanaf het plan en niet alleen vanaf een lijst met bestandsnamen.

De pin reist mee door de offlinewachtrij (`drawingPin` op een wachtende upload) en wordt pas
gezet als de opname zelf is aangemaakt. Mislukt het zetten van de pin, dan blijft de foto staan:
de locatie staat er ook in woorden bij.

## "Ik begrijp dit niet! Misschien kan het weg."

De keuzelijst *Wissel van module* rechtsboven is weg. Elke module staat als tegel op de
werkruimte zelf, en de knop *Werkruimte* links brengt je daar in één tik terug. Er is nu één
manier naar binnen in plaats van twee, waarvan één verborgen in een hoek.

## "Kunnen we de zwarte delen wegdoen"

Een staande telefoonfoto werd over de volle breedte van de kaart gelegd en met zwart aangevuld.
De voorvertoning laat het beeld nu de ruimte nemen die het nodig heeft en niet meer — geen twee
zwarte kolommen meer naast een staande foto.

## Wat er verder wegviel op het opnamescherm

Op #18 zijn ook de fotolijst, de geannoteerde foto en het paneel *Selecteer of plaats een
marker* doorgestreept. Zolang een foto op opslaan wacht, toont het scherm die foto en verder
niets: op de bouwplaats zijn dat drie dingen om langs te lezen voordat je kunt opslaan. Na
opslaan komt alles terug zoals het was.

## Twee stukken UI die nooit stijl hadden gekregen

Bij het nalopen van het scherm bleken `.form-helper` (vier formulieren) en `.inline-error`
(tweestapsverificatie) wel gebruikt maar nooit opgemaakt. Een mislukte stap kwam er dus uit als
gewone lopende tekst naast een groene bevestiging. Beide hebben nu de opmaak die ze horen te
hebben.

---

# Naschrift — Workforce tegen §4.3 van het productplan

De tegel *Workforce* opende het dagrapport. Bij het rechtzetten daarvan is eerst het
verkeerde scherm aangewezen (`AttendanceModal`, een ouder en dunner scherm dat naast het
echte was blijven staan) en daarna het register herbouwd. Pas daarna is §4.3 van het
productplan ernaast gelegd, en dat had andersom gemoeten.

Wat §4.3 *Aanwezige partijen en mankracht* vraagt, en waar het nu staat:

| Productplan | Status |
| --- | --- |
| organisatie, ploeg, discipline en aantal personen | compleet — *ploeg* is nieuw |
| werktijd of dienst | per regel aanpasbaar |
| bezoekersregistratie | nieuw, apart van de getelde ploeg |
| optioneel individuele aanwezigheidsregistratie | niet gebouwd — het plan noemt dit optioneel |
| toelichting bij afwijkende bezetting | nieuw, en verplicht zodra er een afwijking is |
| vorige werkdag als voorstel kopiëren | werkt echt, tot veertien dagen terug |
| totalen per organisatie en discipline | nieuw |
| grote afwijkingen signaleren | nieuw, tegen planning én vorige werkdag |
| importeren uit toegangscontrole | niet gebouwd — het plan noemt dit optioneel |

**Bezoekers tellen niet mee.** Een inspecteur of opdrachtgever is op de bouwplaats maar
bemant het werk niet. Zou een bezoeker in de bezetting meetellen, dan groeit het getal
waar de aannemer aan gehouden wordt zonder dat er iemand meer werkt. Bezoekers staan
daarom in een eigen blok en blijven buiten elk totaal.

**De afwijkingsmelding oordeelt niet.** Ze noemt het feit en het getal erachter — "12
aanwezig tegenover 20 gepland, 40% minder" — en vraagt om een toelichting. Of een
halve ploeg terecht is, weet alleen de supervisor; op een dag afwerking kan dat kloppen.
De drempel is 20%, dezelfde die het dagrapport al hanteert.

**Migratie.** `entry_type`, `crew` en `visitor_name` zijn toegevoegd aan
`attendance_entries` (`202608050001`), bewust niet als tweede tabel: row level security,
de creator-guard, de touch-trigger en het auditspoor gelden daar al. De kolom `notes`
bestond al maar werd nooit geschreven; die draagt nu de toelichting. Zolang de migratie
niet is gedraaid blijft de telling gewoon werken — het scherm valt terug op de kolommen
die er altijd waren.
