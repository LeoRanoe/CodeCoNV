# Klantfeedback op vijf schermen — 31 juli 2026

Bron: vijf schermafbeeldingen met handmatige aantekeningen van CODECO (#1 projectkeuze,
#2 projectoverzicht, #3 *Record activity*, #5 daglog, #6 *Record delay*).
De schermafbeeldingen komen van een deploy van vóór deze wijzigingen.

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib tests next.config.ts` schoon ·
`next build` slaagt · 26/26 knipseltests groen (1 nieuwe regressietest voor deze ronde).

---

## #1 Projectkeuze — "niet nodig hier"

De donkere balk met zeven portfoliotellers (actieve projecten, planning vandaag, open
acties, issues, NCR, inspecties, afspraken) is **verwijderd**. Dit scherm hoeft maar één
vraag te beantwoorden: waar werk ik vandaag? Dezelfde cijfers staan in het
projectdashboard, waar ze context hebben.

- `app/codeco-supervision-app.tsx` — `ContextSelection`: sectie `portfolio-dashboard`
  en de bijbehorende `portfolio`-berekening zijn weg.
- `app/globals.css` — de bijbehorende regels (± 1.650 tekens) zijn opgeruimd, inclusief
  de mobiele variant. Geen dode CSS laten staan.
- Het gebouwicoon stond los boven de projectnaam (het omcirkelde punt met de pijl naar
  de naam). Het icoon staat nu **naast de projectnaam** in dezelfde regel; rechtsboven
  blijft alleen de projectcode staan.

## #2 Projectoverzicht — "smaller" en "pictures"

- **Kop kleiner.** `.overview-hero` gebruikt minder padding en de projectnaam gaat van
  `clamp(1.65rem … 2.25rem)` naar `clamp(1.15rem … 1.5rem)`. De werkblokken beginnen
  daardoor hoger in het beeld.
- **"Evidence" heet nu "Pictures" / "Foto's".** `app/client-dashboard.tsx`, de vierde
  KPI-kaart. De ondertitel ("Foto's met projectcontext") blijft.

## #3 en #6 Veldregistratie (*activiteit* en *vertraging*)

Beide schermen hadden dezelfde opmerkingen; ze gebruiken één component (`EntryModal`).

### "Alleen Engels nu?"

De interfacetaal viel terug op Engels zodra er geen keuze was opgeslagen. `lib/i18n.tsx`
start nu in het **Nederlands**; Engels blijft beschikbaar via de taalkeuze en wordt
bewaard. Alleen een expliciete keuze voor `en` geeft nog Engels.

### "Deze tekst gaat niet automatisch weg"

De omschrijving die de app zelf voorstelt (via *Works ongoing*, *Works completed* of
*Delay* in de werkruimte) bleef als gewone tekst staan.

- Voorgestelde tekst is nu herkenbaar als voorstel (cursief, grijstint) en wordt
  **volledig geselecteerd bij focus**: de eerste toetsaanslag vervangt hem.
- Naast het veld staat een knop **Wissen**.
- De standaardomschrijvingen bovenaan werken als schakelaars: nog een keer op dezelfde
  chip tikken haalt de tekst weg.
- Dicteren over een voorstel heen vervangt het voorstel in plaats van het aan te vullen.

### "Ook de optie om meer dan 1 te kiezen" (gebouw)

`BuildingMultiPicker` (nieuw in `app/building-picker.tsx`): aanvinkbare gebouwen plus
*Alle gebouwen*, in plaats van één keuze uit een dropdown. De registratie wordt per
aangevinkt gebouw opgeslagen — dat deed `saveEntry` al voor *Alle gebouwen*. Het laatste
vinkje kan niet uit: een registratie zonder gebouw bestaat niet.
De enkelvoudige dropdown blijft ongewijzigd in alle andere formulieren.

### "Als ik het gebouw heb gekozen moet hier een lijst met PDF-tekeningen komen"

Onder *Exacte projectlocatie* staat nu **Locatie op tekening**: een lijst met de
tekeningen van het gekozen gebouw (`files` met categorie `drawing`, nieuwe
`project-drawings`-query). De gekozen tekening komt in de locatieomschrijving van de
registratie te staan, plus een link **Open de tekening om een pin te plaatsen** naar de
tekeningwerkruimte, waar de pin op coördinaat wordt vastgelegd.
Staat er nog geen tekening voor dat gebouw, dan zegt het veld dat en verwijst het naar
Project Docs.

### "Deze lijst moet meer opties hebben" (werkpakket)

Er waren drie opties (ruwbouw, installaties, afwerking) en de dropdown was zelfs niet
aangesloten — de keuze werd nooit opgeslagen. Nu 23 werkpakketten uit het eigen
dagrapport van de klant: bouwplaatsinrichting, uitzetwerk, sloop, grondwerk, heiwerk en
fundering, bekisting en steigerwerk, beton en wapening, metselwerk, staalconstructie,
dakwerk, timmerwerk, gevel, elektra, mechanisch/HVAC, sanitair, riolering, stucwerk,
tegelwerk, schilderwerk, bestrating, terreininrichting, testen en oplevering, overig.
Het gekozen werkpakket staat vanaf nu **in de opgeslagen registratie**.

### "Maakt de camera-app niet open, maar brengt je naar een andere page" / "werkt niet"

*Maak of kies een foto* stuurde je naar de fotowerkruimte, waardoor de halfingevulde
registratie verdween. De knop opent nu **de camera in het formulier zelf**
(`capture="environment"`), met miniaturen en een verwijderknop per foto. Bij opslaan
gaan de foto's door de bestaande offline wachtrij mee:

- gekoppeld aan de registratie (`file_links.record_type = 'registration'`);
- en als visuele opname, zodat ze in *Foto's & mappen* met hun context terugkomen
  (`ensureVisualCapture` in `lib/offline/upload-queue.ts`, één keer per bestand, dus een
  nieuwe poging maakt geen dubbele opname).

De foto blokkeert het opslaan nooit: de registratie is al bevestigd voordat de upload
begint, precies zoals bij de daglog.

## #5 Daglog

- **"Foto kan ik niet bewerken of benoemen".** Elke toegevoegde foto krijgt nu een
  miniatuur, een veld **Fotonaam voor het rapport** en een verwijderknop. Die naam wordt
  de titel van het bestand in het rapport en in de fotobibliotheek; zonder naam blijft
  het "Veldfoto".
- **Teksten over personeel.** Het blok *Bezetting en foto's* heeft standaardnotities die
  over de bezetting zelf gaan, niet over het aantal: onvoldoende arbeiders, er kunnen
  meer arbeiders worden ingezet, bezetting is voldoende, belangrijke discipline afwezig,
  te laat op de bouwplaats, extra dienst of overwerk nodig. Ze schakelen aan en uit en
  landen in het adviesveld dat al naar `communication` in de dagafsluiting schrijft.

---

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **Deployen** | De klant kijkt naar een oudere build. Zonder deploy verandert er voor hem niets. |
| **Pin op tekening in het formulier** | De registratie noemt de tekening; het plaatsen van een pin op coördinaat gebeurt in de tekeningwerkruimte (link staat in het formulier). Een minikaart in de modal zelf is een volgende stap. |
| **Werkpakket als eigen kolom** | Het werkpakket staat in de omschrijving van de registratie, niet in een eigen kolom. Filteren en tellen per werkpakket vraagt een migratie. |
| **Projectspecifieke werkpakketten** | De lijst is nu vast voor alle projecten. Per project beheren hoort bij Projectinstellingen en is een klantbesluit. |
| **E2E-suite** | Slaat over zonder `CODECO_E2E_EMAIL` / `CODECO_E2E_PASSWORD`; in deze sessie niet gedraaid. |

## Aanbevolen acceptatievolgorde

1. Deployen en de app openen op een leeg apparaat: de interface staat in het Nederlands.
2. *Works ongoing* openen, direct typen: de voorgestelde tekst is weg na de eerste letter.
3. Twee gebouwen aanvinken en opslaan: de registratie staat bij beide gebouwen in het
   dagrapport.
4. Een PDF-tekening uploaden bij Project Docs en die daarna in het formulier kiezen als
   locatie.
5. In het formulier een foto maken, opslaan en controleren dat de foto bij de registratie
   én in *Foto's & mappen* staat.
6. In de daglog twee foto's toevoegen, benoemen, één verwijderen en opslaan; controleren
   dat de namen in het rapport staan.
