# De terugknop — 2 augustus 2026

*"Als je nu op terug drukt, kom je op de landingspagina of het dashboard. Ik wil dat
terug me naar de vorige pagina brengt. De app wordt vooral op de telefoon gebruikt, dus
de terugknopstroom moet kloppen."*

## Waarom het misging

De hele supervisie-app is één route (`/supervisie`) met schermen die in geheugen worden
omgezet: project kiezen, onderbalk, module, dialoog. De browser zag daar niets van — die
had precies één regel in zijn geschiedenis. Eén keer terug op de telefoon betekende dus
niet "een scherm terug", maar "de app uit".

## Wat een scherm is

Alles wat een gebruiker een pagina zou noemen, is nu een regel in de geschiedenis, met
een eigen adres:

| Onderdeel | In het adres |
| --- | --- |
| Het geopende project (leeg = projectkeuze) | `?project=<id>` |
| De bestemming in de onderbalk | `&nav=project` |
| De open module in de werkruimte | `&tab=ncr` |
| Een schermvullende dialoog | `&modal=quick` |

Details *binnen* een scherm — een uitgeklapt blok, een filter, een chip — blijven erbuiten.
Anders zou terug een ongedaan-maakknop worden.

## Hoe het zich gedraagt

- **Een nieuw scherm legt een regel bij.** Project openen → werkruimte → NCR-module →
  drie keer terug brengt je stap voor stap terug naar de projectkeuze, en pas dán uit de
  app.
- **Terug sluit een dialoog** in plaats van het scherm eronder te verlaten. Dat geldt ook
  voor het mobiele *Meer*-menu.
- **Een dialoog die je met het kruisje sluit, verbruikt zijn eigen regel.** Anders zou de
  volgende keer terug de dialoog weer openen — precies de irritatie die de klant beschreef.
- **Schermvullende overlays doen hetzelfde**: het fotodetail, de markeerpad en het
  schetsblok. Staat de markeerpad boven het fotodetail, dan sluit terug eerst de pad en
  daarna het detail.
- **Het adres houdt het scherm vast.** Een herlaadbeurt, een gedeelde link of een
  geïnstalleerde app die opnieuw opent, komt terug op hetzelfde scherm in plaats van
  vooraan. Een dialoog die alleen met een record in de hand betekenis heeft (het
  actiedetail, de veldregistratie) wordt niet uit een link hersteld; je landt op het
  scherm eronder.
- **Een halfingevulde registratie blijft staan.** Terug sluit de dialoog, niet het
  concept: opnieuw openen laat de tekst en de foto's weer zien.

## Wat er technisch is veranderd

- `lib/navigation/screen-url.mjs` — de regels zonder React: wat een scherm is, wanneer de
  geschiedenis moet *pushen*, *vervangen* of een regel *verbruiken*, en hoe een scherm in
  en uit het adres wordt gelezen. Los getest.
- `lib/navigation/app-history.ts` — `useScreenHistory` (houdt scherm en geschiedenis
  gelijk, en zet de app terug op het scherm dat de terugknop teruggeeft) en
  `useBackToClose` voor een overlay die in één component leeft.
- De open module was een geheim van de werkruimte en is nu van de app-schil
  (`onProjectTabChange`), zodat de terugknop hem kan terugzetten. De werkruimte bouwt zich
  daardoor ook niet meer opnieuw op bij het wisselen van module.
- Onderbalk-bestemmingen *Project Docs* en *Punchlist* zetten voortaan expliciet hun
  module, in plaats van die tijdens het renderen te overschrijven.

## Wat de test bewaakt

`tests/field-workflows.test.mjs` speelt een echte telefoonsessie na: projectkeuze →
project → werkruimte → NCR → dialoog, met terug na elke stap, plus het geval waarin de
dialoog met het kruisje sluit. Die test ving meteen een fout in de eerste versie: de vlag
die "we volgen de terugknop" betekent bleef aan staan, waardoor de eerstvolgende echte
navigatie geen regel meer bijlegde en één stap uit de geschiedenis verdween.

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **Schermen binnen een werkruimte-module** | De tekeningwerkruimte, de fotobibliotheek en de checklist hebben interne weergaven die nog geen eigen regel krijgen. Terug brengt je daar naar de module ervoor; de checklist die je open had staat er nog zoals je hem verliet. |
| **Vooruitknop** | Werkt zolang je niets nieuws doet; na een nieuwe stap verdwijnt de vooruit-tak zoals in elke browser. |
| **Deep link naar een dialoog met context** | Bewust niet hersteld: een actiedetail zonder actie is een leeg scherm. |
