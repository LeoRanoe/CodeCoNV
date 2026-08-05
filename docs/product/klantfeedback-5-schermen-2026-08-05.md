# Klantfeedback op vijf schermen — 5 augustus 2026

Bron: vijf schermafbeeldingen met aantekeningen van CODECO (#22 het opnamescherm van een
vertraging, #24 het HSE-formulier, #25 het projectregister, #26 het inspectiescherm en #26A een
open checklist). Vervolg op de reeks van 4 augustus.

Gecontroleerd: `npx tsc --noEmit` schoon · `npm run lint` schoon · `next build` slaagt ·
62/62 knipseltests groen (1 nieuwe regressietest voor deze reeks). De migratie
`202608050002` is toegepast op een lokaal PostgreSQL 16-cluster met de volledige
migratieketen; daar zijn ook de HSE-categorie en de handtekening op een inspectie
uitgevoerd. De pgTAP-suite zelf draait pas in de CI (die extensie ontbreekt hier).

---

## #26 en #25 · "Uniform maken" / "Niet uniform"

Het gebouwveld verschilde per scherm: een eigen dropdown in de inspectiezoeker, een eigen
label op het registerformulier ("Gebouw · of algemeen materiaal"), en weer een ander in de
fotobibliotheek ("Getoond gebouw / uploaddoel"). Overal staat nu hetzelfde veld met hetzelfde
woord: **Gebouw**, met *Alle gebouwen* als eerste keuze waar dat mag.

## #26 · "Automatisch" bij de inspectiedatum

De datumfilter was een lege datumprikker waarin je een dag kon kiezen waarop niets gebeurd is.
Het is nu een lijst van de dagen waarop dit project daadwerkelijk geïnspecteerd heeft, nieuwste
eerst, met *Vandaag* als die erbij staat.

## #26 en #26A · Locatie pinnen, ondertekenen en de NCR

- **Locatie pinnen.** In een open checklist staat *Locatie op de tekening pinnen*. De
  tekeningenwerkruimte opent met deze inspectie als doel; één tik plaatst de pin met het
  inspectienummer en de titel.
- **"Geen optie om te ondertekenen! Naam etc."** De checklist wordt ondertekend door wie hem
  gelopen heeft, met de handtekening die op dat moment wordt geschreven. Zonder handtekening
  kan de inspectie niet worden afgerond. De naam staat daarna in de lijst achter de inspectie.
- **"Optie om NCR te kiezen vanuit hier."** Onder de checklist staat *NCR opstellen vanuit
  deze checklist*: het NCR-formulier opent met het inspectienummer als referentie, het gebouw
  en de locatie ingevuld, en de afgekeurde controlepunten al in de omschrijving.

## #24 · Health, Safety of Environmental

- Boven de situatie staat nu de kop van het klantformulier: **Health**, **Safety** of
  **Environmental**. De keuze wordt bij de gebeurtenis opgeslagen en staat in de lijst.
- **"Kunnen deze 2 gelijk onder elkaar?"** *Wat is waargenomen?* en *Directe maatregel* staan
  onder elkaar, in het zicht. Het uitklapblok *Andere HSE-situatie* dat ze verborg is weg;
  type en titel staan er gewoon boven.
- **"Ik vermoed dat dag, datum & tijd zelf komen."** Dat klopt, en het formulier zegt het nu:
  *Dag, datum en tijd worden automatisch vastgelegd*, met de datum en tijd erbij.

## #25 · Materiaallevering

- De kop noemt wat je vastlegt (**Materiaallevering**, **Afspraak**, **RFI**) in plaats van
  "Projectregister aanvullen" met het antwoord in een dropdown eronder. Dat keuzeveld zit nu
  achter *Iets anders vastleggen*.
- **"Ik moet meer kunnen invoeren onder elkaar"** en **"wel optie voor omschrijving extra"**:
  een levering is een lijst regels, elk met een hoeveelheid, een eenheid en een eigen
  omschrijving, met *Regel toevoegen* eronder. Alle regels worden opgeslagen; de eerste blijft
  ook als losse hoeveelheid staan zodat register en rapporten die blijven lezen.
- Titel en omschrijving staan in het zicht; het uitklapblok *Andere titel of documentinhoud*
  is weg. *Betrokken partij* en *Schets maken* zijn van dit formulier verdwenen — de schets
  blijft waar hij op locatie wordt gemaakt: in een veldregistratie.

## #22 · Het heet een PDF

Bij *Locatie op tekening* stond in het rood "PDF" over het woord drawing. Het veld heet nu
*Locatie op de PDF-tekening*, met *Geen PDF gekozen* en *Open de PDF om een pin te plaatsen*.
