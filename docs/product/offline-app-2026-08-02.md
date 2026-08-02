# De app werkt zonder internet — 2 augustus 2026

*"Dit app moet full offline compatible zijn: wanneer ik een shortcut van dit app maak, moet
het als een normale app werken met of zonder internet. Alle data moet offline ook
beschikbaar zijn wat op de database is."*

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib tests` schoon · `next build`
slaagt · 45/45 knipseltests groen · **4/4 offline-browsertests groen** (Playwright, echte
Chromium, netwerk uitgezet).

---

## Wat er misging

De app had al offline onderdelen — een servicewerker, een fotowachtrij, een kopie van de
werkruimte — maar drie dingen maakten dat je er in het veld niets aan had.

### 1. De app kon niet opstarten zonder verbinding

Twee oorzaken, allebei stil:

- **De sessie.** Supabase probeert bij het opstarten een verlopen token te vernieuwen, en dat
  vraagt internet. Zonder verbinding antwoordt de bibliotheek "geen sessie" en kwam je op het
  inlogscherm — met alle projectgegevens op de telefoon, onbereikbaar. Na ongeveer een uur was
  dat de standaardervaring.
- **De query's stonden op pauze.** React Query weigert standaard een query te *starten* zolang
  het toestel zegt dat er geen verbinding is (`networkMode: "online"`). De laadfunctie werd dus
  nooit uitgevoerd, en juist die functie leest de kopie op het apparaat. Offline bleef het
  scherm daardoor leeg — niet omdat er niets stond, maar omdat er niet gekeken werd.

### 2. Lang niet alle gegevens stonden op het toestel

Er was een kopie van de werkruimte, het dagrapport en het projectsnapshot — maar alleen van
wat je toevallig online had geopend. De kleinere reads hadden helemaal geen kopie:
projectinstellingen, de locatieboom, de tekeningenlijst, de meldingen en de ledenlijst.
Offline opende de app daardoor met lege locatiekeuzes en standaardinstellingen, wat eruitziet
als gegevensverlies.

En de foto's, 360°-beelden en tekeningen zelf stonden er nooit: die komen van een
geautoriseerde route met een token, en die kan de servicewerker niet bewaren.

### 3. De code van de app zelf stond er maar half

De servicewerker bewaarde bestanden pas nadat hij ze had zien langskomen. Bij het allereerste
bezoek staat hij nog niet aan het roer, dus de JavaScript van dat bezoek werd nooit bewaard.
En onderdelen die pas bij gebruik laden — de 360°-viewer, de tekeningweergave, de
PDF- en Word-generatoren — werden opgehaald op het moment dat je ze opende. Offline is dat
precies het moment waarop het niet kan.

---

## Wat er nu gebeurt

### Opstarten zonder verbinding

- **De sessie van het apparaat.** Kan de bibliotheek niet vernieuwen, dan wordt de sessie
  gebruikt die Supabase zelf op dit toestel heeft geschreven. Het token daarin kan verlopen
  zijn; dat geeft niets, want offline mislukt elk verzoek toch en Supabase vernieuwt het zodra
  er weer verbinding is. Het geeft nooit toegang op zichzelf — de database controleert het
  token nog steeds.
- **Een sessie die wegvalt terwijl er geen verbinding is, is geen uitloggen.** Dat wordt
  genegeerd. Bewust uitloggen wist de opgeslagen sessie en eindigt dus wél.
- **`networkMode: "offlineFirst"`.** Elke laadfunctie probeert eerst het netwerk en valt terug
  op wat er op het apparaat staat. Ze wordt nu altijd uitgevoerd, ook als het toestel zegt dat
  er geen verbinding is.

### Alles offline beschikbaar maken

Tik in de bovenbalk op de verbindingschip (*Online* / *Offline*). Daar staat één knop:
**Alles offline beschikbaar maken**. Die haalt op, met voortgang per stap:

| Wat | Waar het vandaan komt |
| --- | --- |
| Alle projecten met gebouwen en rechten | werkruimtesnapshot |
| Per project: registers, issues, NCR's, inspecties, HSE, documenten, BOQ, bestanden, 360°-markers, tekeningpins, mappen | projectsnapshot |
| Per project: het dagrapport van vandaag, partijen, acties en actiehistorie | dagsnapshot |
| Per project: instellingen, locatieboom, tekeningenlijst, meldingen | eigen kopie per read |
| Per organisatie: de ledenlijst | ledenlijst |
| De foto's, 360°-beelden en tekeningen zelf | privéopslag op het apparaat |
| De onderdelen van de app die pas bij gebruik laden | servicewerkercache |

Het vinkje *Ook foto's, 360°-beelden en tekeningen ophalen* kan uit, voor een toestel of een
databundel die dat niet aankan. De registraties zijn dan nog steeds compleet.

Het scherm toont hoeveel er staat, hoeveel ruimte het toestel de app geeft, en heeft een knop
om de kopie weer te verwijderen. **Wachtende veldfoto's worden daarbij nooit gewist**: die
bestaan nergens anders.

### Beelden op het apparaat

Elke foto die je online opent wordt meteen bewaard, en elke leespoging die het netwerk niet
haalt gebruikt die kopie. Een supervisor die een foto één keer heeft bekeken, of die het
project offline beschikbaar heeft gemaakt, blijft hem in het veld zien — inclusief openen,
downloaden en markeren.

### De app zelf

- De servicewerker bewaart nu ook `/` naast `/supervisie`, de app-iconen, de lettertypen en de
  stijlen.
- De pagina geeft bij het eerste bezoek de lijst van haar eigen JavaScript door aan de
  servicewerker, zodat een app die precies één keer is geopend daarna offline opent.
- Onderdelen die pas bij gebruik laden worden tijdens *Alles offline beschikbaar maken*
  opgehaald.
- **Een onbruikbare verbinding telt als geen verbinding.** Op locatie hangt een verzoek vaak
  in plaats van te mislukken. Na vier seconden wordt de opgeslagen pagina getoond; dat is het
  verschil tussen "de app opent" en "de app doet niets".
- Na een nieuwe versie wordt de offline-schil opnieuw opgehaald zolang er verbinding is.

### Als een echte app op het beginscherm

Het manifest heeft nu een eigen identiteit (`id`), `standalone` met een terugvaloptie, een
vaste oriëntatie, en vierkante iconen van 192 en 512 pixels plus een *maskable* icoon dat
Android in zijn eigen vorm knipt. Ook het iOS-beginschermicoon is vierkant; dat was het brede
logo, dat uitgerekt werd weergegeven.

---

## Wat werkt zonder verbinding, en wat niet

Dit staat ook in de app zelf, in het offline-scherm, want hier verkeerd over gokken kost op
locatie een werkdag.

**Werkt zonder internet**

- De app openen vanaf het beginscherm, ook na het herstarten van de telefoon.
- Elk opgehaald project lezen: registers, issues, NCR's, inspecties, HSE, documenten,
  deadlines, het actiecentrum, de daglog en de rapporthistorie.
- Opgehaalde foto's, 360°-beelden en tekeningen bekijken, markeren, openen en downloaden.
- Foto's maken en markeren: ze wachten op het apparaat en gaan er vanzelf naartoe zodra er
  verbinding is.
- Wisselen van taal, project, gebouw en module, en de terugknop.

**Vraagt nog verbinding**

- Een nieuw issue, NCR, inspectie, registeritem, HSE-registratie of dagrapport **opslaan**.
  Alleen foto's hebben een wachtrij; de overige registraties gaan rechtstreeks naar de
  database. Het formulier houdt vast wat je hebt ingevuld, en de melding zegt dat nu ook met
  zoveel woorden in plaats van een databasefout te tonen.
- Een link naar een aannemer sturen, pushmeldingen, het weer en het aanmaken van een account.

Een wachtrij voor álle registraties (een "outbox" met idempotente herhaling en een
conflictregel per recordtype) is een aparte opdracht. Dit is bewust niet half gedaan: een
registratie die lokaal "opgeslagen" lijkt maar bij synchronisatie stilletjes sneuvelt, is
erger dan een eerlijke melding.

---

## Hoe het is gecontroleerd

`tests/e2e/offline-app.spec.ts` doet dit in een echte browser, zonder account:

1. `/supervisie` openen, wachten tot de servicewerker het roer heeft.
2. Controleren dat de eigen JavaScript van de app is opgeslagen (22 bestanden) plus de
   documenten en het manifest.
3. **Het netwerk uitzetten.**
4. Herladen: de pagina komt terug.
5. Een nieuw tabblad openen — een koude start, zoals een telefoon die de app opnieuw opent:
   de pagina komt op, de JavaScript draait, en de app reageert op een klik (taal wisselen).
6. `/` openen: ook die komt op.

Vier van de vier geslaagd op zowel het mobiele als het desktopprofiel.

---

## Bestanden

| Bestand | Wat erin veranderde |
| --- | --- |
| `app/providers.tsx` | `networkMode: "offlineFirst"`, en de eigen assets van de pagina worden aan de servicewerker doorgegeven. |
| `lib/supabase/offline-session.ts` | Nieuw. De sessie van dit apparaat wanneer de bibliotheek niet kan vernieuwen. |
| `lib/offline/query-cache.ts` · `query-keys.ts` | Nieuw. Een kopie per read, met namen die de app en de sync delen. |
| `lib/offline/file-cache.ts` | Nieuw. De beelden zelf op het apparaat, met verbruik en wissen. |
| `lib/offline/full-sync.ts` | Nieuw. Alles ophalen wat dit account mag inzien, met voortgang en stopknop. |
| `lib/offline/idb.ts` | Databaseversie 2 met een `files`-store; `keys` en `clear`. |
| `lib/storage/gateway.ts` | Elke bestandslezing bewaart en valt terug op de kopie op het apparaat. |
| `lib/supabase/data.ts` | Projectinstellingen, locaties en tekeningen zijn nu herbruikbare laadfuncties. |
| `app/offline-manager.tsx` | Nieuw. Het offline-scherm met status, voortgang, uitleg en verwijderen. |
| `app/codeco-supervision-app.tsx` | Offline sessiestart, offline kopie voor elke projectread, en de verbindingschip opent het offline-scherm. |
| `app/operational-workspace.tsx` | Een mislukte opslag zonder verbinding zegt wat er aan de hand is. |
| `public/sw.js` | v3: `/` erbij, netwerktime-out, lettertypen en iconen, doorgegeven assets, schil verversen na een nieuwe versie. |
| `app/manifest.ts` · `app/layout.tsx` · `public/icon-*.png` | Installeerbaar als echte app met vierkante en maskable iconen. |
| `playwright.config.ts` | `CODECO_E2E_CHANNEL` / `CODECO_E2E_BROWSER_PATH`, zodat de suite ook draait in een omgeving zonder Google Chrome. |

## Aanbevolen acceptatievolgorde

1. Deployen. Open de app, installeer hem op het beginscherm ("Toevoegen aan beginscherm").
2. Log in, open een project.
3. Tik in de bovenbalk op de verbindingschip → **Alles offline beschikbaar maken** en wacht
   tot het klaar is. Kijk naar het aantal bestanden en de MB's.
4. Zet het toestel in vliegtuigmodus.
5. Sluit de app volledig af en open hem opnieuw vanaf het beginscherm: hij moet openen zonder
   inlogscherm.
6. Loop door: projectkeuze → werkruimte → issues, NCR, registers, deadlines, actiecentrum,
   foto's, een 360°-beeld en een tekening. Alles moet leesbaar zijn.
7. Maak een foto, markeer hem en sla hem op: hij komt in de wachtrij.
8. Probeer een issue op te slaan: er hoort een duidelijke melding te komen dat dit verbinding
   vraagt en dat je invoer blijft staan.
9. Zet de vliegtuigmodus uit: de wachtende foto's gaan vanzelf omhoog.
