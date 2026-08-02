# Het actiecentrum en de 360°-viewer — 2 augustus 2026

*"Actiecentrum is een beetje confusing, ik weet niet wat de klant precies daar moet doen."*
*"De 360 picture viewer werkend met alle features die de foto-opties heeft."*

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib tests next.config.ts` schoon ·
`next build` slaagt · 43/43 knipseltests groen (3 nieuwe testblokken voor deze ronde).

---

# Deel 1 · Het actiecentrum

## Waarom het verwarrend was

De pagina liet zien *wat er bestaat*, niet *wat er van jou wordt verwacht*. Concreet:

1. **Geen "van mij".** De lijst was het hele project door elkaar. Het productplan noemt dit
   scherm het **actiebord**: *"Mijn acties, projectacties, deadlines, status en escalaties"*
   (§5.2), en het onderste menu heet daar *"Acties – eigen en toegewezen opvolging"* (§5.1).
   Precies dat "eigen" ontbrak.
2. **Wel een status, nooit een opdracht.** Een regel zei `ready_for_verification`. Dat is een
   toestand, geen instructie. Wat je ermee moest doen stond er niet.
3. **Doodlopende weg.** Tikken op een bevinding of een registeritem opende de *module*, niet
   het record. Je kwam op een lijst en moest zelf zoeken naar wat je net had aangetikt.
4. **Twee keer hetzelfde filter.** *Urgent of te laat* in de ene weergave en *Te laat* in de
   andere zijn op het veld hetzelfde begrip, met twee verschillende namen.
5. **Een verzonnen plattegrond.** Het paneel rechts tekende een gebouw dat niet bestond: drie
   grijze vlakken met vier pinnetjes op vaste plekken.

## Wat er nu staat

### Drie weergaven, in de volgorde van de vraag

| Weergave | Antwoord op |
| --- | --- |
| **Mijn werk** | Wat wacht er op mij? Alleen acties en bevindingen die aan de ingelogde gebruiker zijn toegewezen. |
| **Al het projectwerk** | Wat loopt er op dit project? Het oorspronkelijke actiecentrum. |
| **Deadlines** | Wat moet er op een datum af? Ongewijzigd sinds 1 augustus: *Te laat · Binnen 7 dagen · Later · Geen deadline · Alle registraties*. |

Wie werk toegewezen heeft, opent standaard op **Mijn werk**; wie niets toegewezen heeft, komt
op **Al het projectwerk** in plaats van op een leeg scherm. Het tegeltje *Deadlines* in de
werkruimte opent nog steeds direct de deadlineweergave.

### Elke regel zegt wat er moet gebeuren

Onder de titel staat één instructie, in woorden:

| Toestand van het record | Wat de regel zegt |
| --- | --- |
| concept | *Maak deze registratie af en dien hem in* |
| gereed voor verificatie | *Controleer het werk op locatie en sluit af* |
| in beoordeling (indiening) | *Leg het besluit over deze indiening vast* |
| niemand toegewezen | *Wijs toe wie dit moet doen* |
| in uitvoering | *Voeg bewijs toe en meld het gereed* |
| open | *Start de opvolging* |
| gesloten/geverifieerd | *Afgerond · niets te doen* |

Daarnaast staat op elke regel **wie** het is: *Van jou*, de naam van de collega, of de
partij — en *Nog niemand* als er niemand is toegewezen. Te laat blijft rood met het aantal
dagen erbij; die informatie is niet vervangen door de instructie maar staat ernaast.

De regels zelf zitten in `lib/actions/action-center.mjs` en zijn los getest, zonder React:
welke statussen "afgerond" betekenen, wanneer iets een escalatie is, hoeveel dagen het tot de
deadline is in de kalenderdag van Paramaribo, en welke instructie bij een record hoort.

### Tikken opent het record, niet de lijst

Het actiecentrum geeft het id van het record mee. De module scrolt naar dat record en zet er
een rand omheen (`lib/navigation/record-focus.ts`). Dat geldt voor bevindingen, NCR's,
beheerde documenten (TI/CO/ER/RFI/RFA/WIR) en de overige registeritems. Een toegewezen actie
opende al haar eigen detailvenster; dat blijft zo.

### Escalaties in plaats van een getekende plattegrond

*Urgent of te laat* heet nu **Escalaties · te laat of urgent** — één begrip, de term uit het
productplan (§5.2). Een issue dat op het klantformulier is aangevinkt met *Escalation
required* telt daar vanzelf in mee.

Het paneel rechts heet **Vraagt nu aandacht** en toont de eerste vier escalaties met hun
instructie en deadline, aanklikbaar. Daaronder drie tellers die vaak de reden zijn dat werk
blijft liggen: *zonder verantwoordelijke*, *wacht op verificatie*, *binnen 7 dagen*. De knop
naar de gecoördineerde tekening is gebleven, met het echte aantal gekoppelde punten erbij; de
nagetekende plattegrond is weg.

---

# Deel 2 · De 360°-viewer

De 360°-viewer werkte, maar had minder te bieden dan een gewone foto: één sleepgebaar, één
markerknop en verder niets. Wat een foto wél heeft — omschrijving, categorie, kijkrichting,
genummerde markeringen met een lijst erbij, het origineel openen of downloaden — ontbrak in
het 360°-beeld of stond alleen in het uploadformulier.

## Rondkijken is nu ook een knop

Onder het beeld staat een balk met **Uitzoomen · Inzoomen · Beginstand · Vanzelf draaien ·
Kijken met de telefoon · Volledig scherm**. De eigen werkbalk van de viewer is uitgezet: twee
rijen bediening op één beeld maakte de keuze alleen maar onduidelijker.

- **Vanzelf draaien** laat het beeld langzaam ronddraaien, zodat je een ruimte kunt laten zien
  zonder te slepen.
- **Kijken met de telefoon** gebruikt de bewegingssensor: je richt het toestel in de ruimte en
  het beeld draait mee. De knop verschijnt alleen op een toestel dat het ondersteunt.
- **Beginstand** zet de kijkhoek en de zoom terug.

## Een kompas en een leesbare kijkhoek

Linksboven staat een kompas dat laat zien welke kant je op kijkt; je kunt erop klikken om die
kant op te draaien. Rechtsboven staat de kijkhoek in graden plus het zoomniveau, zodat twee
mensen dezelfde plek in het beeld kunnen benoemen — het equivalent van de *Kijkrichting* die
een gewone foto meekrijgt.

Elke bestaande probleemmarker krijgt een stip op het kompas, in zijn eigen kleur
(gevalideerd groen, te corrigeren oranje, alternatieve oplossing rood). Een marker achter je
rug is daardoor zichtbaar terwijl je de andere kant op kijkt.

## Alle markeringen op een rij

Onder het beeld staat een genummerde lijst van alle markeringen op dit beeld — hetzelfde
lijstje dat de markeerpad van een foto heeft, met het bevindingsnummer, de ernst en de exacte
positie. Een markering aanklikken **draait het beeld ernaartoe**. Op een bol is dat het
verschil tussen een marker vinden en een marker zoeken.

## De woorden bij het beeld, en het origineel

Naast het beeld staat nu wat het beeld zelf zegt: titel, omschrijving (met categorie en
kijkrichting zoals ze bij het opslaan zijn meegegeven), locatie, tour en het moment van
opnemen. Daarbij twee knoppen: **Origineel openen** en **Downloaden** — dezelfde twee
mogelijkheden die een foto in de fotomappen heeft. Dit geldt voor gewone foto's en voor
360°-beelden.

## Upload 360° opent het 360°-formulier

*Upload 360°-beeld* in de fotomappen bracht je naar het scherm Visueel bewijs, waar je
dezelfde knop nog een keer moest indrukken. Nu staat het 360°-uploadformulier direct open.

## Wat een 360°-beeld nog steeds niet heeft

Eerlijk benoemd, want dit is bewust niet gedaan:

- **Tekenen op het beeld** (pen, pijl, kader) zoals de markeerpad van een foto. Een lijn op
  een bol is niet dezelfde lijn als op een platte foto; de klassering per marker
  (kleur + ernst + verantwoordelijke) doet daar het werk.
- **Een marker verwijderen of de tekst ervan aanpassen** vanuit de viewer. Een marker is
  atomair gekoppeld aan een formele bevinding; die intrekken is een databasehandeling met
  auditspoor en hoort in dezelfde ronde als de bijbehorende migratie.

---

## Bestanden

| Bestand | Wat erin veranderde |
| --- | --- |
| `lib/actions/action-center.mjs` | Nieuw. De regels van het actiecentrum zonder React: afgerond, escalatie, dagen tot de deadline op locatie, de volgende stap en de sorteervolgorde. Los getest. |
| `lib/navigation/record-focus.ts` | Nieuw. Het anker en het scrollen naar het record waar het actiecentrum naar wijst. |
| `app/project-action-center.tsx` | Drie weergaven, instructie en eigenaar per regel, escalatiepaneel, record openen in plaats van module. |
| `app/operational-workspace.tsx` | Geeft gebruiker, partijen en namen door aan het actiecentrum; bevindingen-, document- en registerlijsten krijgen een anker en een markering voor het gevraagde record. |
| `app/codeco-supervision-app.tsx` | Houdt het gevraagde record vast (buiten de geschiedenis, want het is een detail binnen een scherm) en geeft de gebruiker-id door. |
| `app/visual-evidence-workspace.tsx` | 360°-bediening, kompas, kijkhoek, markeringlijst met draaien-naar, details en download bij het beeld, en het 360°-uploadformulier dat direct opengaat. |
| `app/globals.css` | Stijl voor de nieuwe onderdelen; de nagetekende plattegrond is verwijderd. |
| `package.json` | `@photo-sphere-viewer/autorotate-plugin`, `compass-plugin` en `gyroscope-plugin`, vastgezet op dezelfde versie als de core. Ze worden pas geladen wanneer een 360°-beeld wordt geopend. |

## Aanbevolen acceptatievolgorde

1. Onderbalk → **Acties**: controleer dat de pagina op *Mijn werk* opent als er werk aan jou is
   toegewezen, en dat elke regel zegt wat er moet gebeuren en op wie hij wacht.
2. Tik op een issue of NCR in de lijst: de module opent met dát record omrand in beeld.
3. Tik op een TI, CO of RFI: hetzelfde in het documentenregister.
4. Ga naar **Al het projectwerk** → *Escalaties*: controleer dat te late en urgente registraties
   daar samen staan en dat het paneel rechts dezelfde punten toont.
5. Werkruimte → tegeltje **Deadlines**: opent nog steeds op *Te laat*.
6. Werkruimte → **Foto's** → *Upload 360°-beeld*: het 360°-formulier staat direct open.
7. Open een 360°-beeld: zoom met de knoppen, zet *Vanzelf draaien* aan en weer uit, gebruik op
   een telefoon *Kijken met de telefoon*, plaats een marker en controleer dat hij in de
   lijst eronder én als stip op het kompas verschijnt. Klik de marker in de lijst aan: het
   beeld draait ernaartoe.
8. Controleer *Origineel openen* en *Downloaden* bij een 360°-beeld en bij een gewone foto.
