# Promptlijst voor externe AI

Voor functies die **niet in de applicatie mogelijk zijn**, met de bronnen die de app
**wél al kan exporteren**.

## Waarom extern

De applicatie heeft **geen enkele AI-koppeling**. Gecontroleerd: geen `openai`,
`anthropic`, `gemini`, `langchain`, `ollama`, `mistral` of `cohere` in `apps/web`
(code noch `package.json`). Dat is een bewuste keuze — de app claimt nergens een
oordeel dat een mens hoort te geven.

Wat de app zelf al kan, hoort **niet** in deze lijst:
Rapid Verify doet trefwoordzoeken in projectbestanden, de rapportgenerator stelt
zelf periodeoverzichten samen, en er staat al een kleine promptbibliotheek in het
rapportscherm (`operational-workspace.tsx:1991-2028`). Onderstaande prompts gaan
uitsluitend over wat de app structureel niet kan.

## Beschikbare bronnen uit de app

| Bron | Waar te downloaden |
| --- | --- |
| Periode-PDF / Word (dag, week, maand, vrije periode, 16 secties) | Rapporten → Rapport maken → PDF/Word |
| Vastgezette rapportversie met SHA-256 | Rapporten → Versies & historie |
| NCR-PDF / Word per bevinding | Issues/NCR → kaart → PDF/Word |
| RFI / RFA / WIR / TI / CO / ER als PDF / Word | Project Docs → beheerd document → PDF/Word |
| Tekeningen (PDF, DWG), specificaties, contracten, BOQ | Project Docs → documentcentrum → Downloaden |
| Foto's en 360°-beelden | Fotomappen → Downloaden |

**Regel bij alle prompts:** de AI levert een **concept**. Menselijke verificatie door
CODECO blijft vereist. Geen enkele AI-uitkomst mag een NCR sluiten, een inspectie
goedkeuren of een besluit vervangen.

---

## 1. Semantische conflictanalyse tekening ↔ specificatie ↔ RFI

**Niet mogelijk in de app:** Rapid Verify doet trefwoordvergelijking zonder betekenis
en zonder tekeningbegrip.
**Bijlagen:** goedgekeurde tekeningen (PDF), technische specificaties, actueel RFI/RFA-log.

> Vergelijk de bijgevoegde goedgekeurde tekeningen, technische specificaties en het
> actuele RFI/RFA-log met elkaar. Lever een conflictmatrix met per rij: bronbestand,
> pagina- of tekeningnummer, exacte tekstcitaat of maatvoering aan beide zijden,
> aard van het conflict, betrokken gebouw, risico voor uitvoering en het vereiste
> menselijke besluit. Los technische conflicten niet zelf op en kies geen kant.
> Markeer elk punt waar je de bron niet met zekerheid kon lezen als BRON ONLEESBAAR.

## 2. Gescande of handgeschreven documenten leesbaar maken (OCR)

**Niet mogelijk in de app:** Rapid Verify leest alleen een bestaande tekstlaag; een
gescande PDF levert nul resultaten.
**Bijlagen:** gescande PDF's, foto's van handgeschreven formulieren of keuringsbonnen.

> Zet de bijgevoegde gescande of handgeschreven bouwdocumenten om naar gestructureerde
> tekst. Behoud de oorspronkelijke indeling in tabellen en velden. Geef per veld een
> zekerheidsindicatie hoog/gemiddeld/laag. Verzin nooit een ontbrekende waarde: zet
> daar exact `[ONLEESBAAR]` neer. Lever daarna een aparte lijst met alle velden die
> laag scoren, zodat een mens die kan natrekken.

## 3. Kritieke-padanalyse en planningrisico

**Niet mogelijk in de app:** er zit geen planningsengine in; de app registreert wel
vertragingen en deadlines maar rekent geen netwerk door.
**Bijlagen:** projectplanning (MS Project / P6 / Excel-export) plus de periode-PDF met
de secties Works ongoing, Works completed, Delays en Deadlines.

> Analyseer de bijgevoegde planning samen met de secties Works ongoing, Works completed,
> Delays en Deadlines uit het CODECO-periodrapport. Bepaal welke activiteiten waarschijnlijk
> op het kritieke pad liggen, welke geregistreerde vertragingen doorwerken en welke
> deadlines daardoor onhaalbaar worden. Citeer bij elke conclusie de exacte planningsregel
> en de rapportregel die je hebt gebruikt. Verzin geen afhankelijkheden die niet in de
> planning staan. Eindig met vragen voor de planner in plaats van met aannames.

## 4. Trendanalyse over de punch-list inspectierondes

**Niet mogelijk in de app:** de app toont voortgangspunten per bevinding, maar rekent
geen trend over meerdere inspectiedatums heen.
**Bijlagen:** de punch-list werkmap (B1-MOH of gelijkwaardig) plus de periode-PDF's van
de betrokken maanden.

> Analyseer de bijgevoegde punch-list met voortgangspercentages per inspectiedatum.
> Bepaal per onderwerp de trend (verbetert, stagneert, verslechtert) en bereken de
> gemiddelde doorlooptijd van uitgifte tot 100%. Groepeer daarna per verantwoordelijke
> aannemer. Markeer onderwerpen die al twee of meer inspectierondes op hetzelfde
> percentage staan als STAGNATIE. Houd de indeling Validate / To be corrected /
> Need an alternative solution intact en meng die categorieën niet. Geef geen enkel
> onderwerp de status afgerond.

## 5. Fotoherkenning van gebreken

**Niet mogelijk in de app:** de app slaat foto's beveiligd op en laat markers plaatsen,
maar herkent zelf niets in het beeld.
**Bijlagen:** exportmap met bouwplaatsfoto's, plus de betrokken checklist of specificatie.

> Bekijk de bijgevoegde bouwplaatsfoto's. Beschrijf per foto uitsluitend wat feitelijk
> zichtbaar is en welk mogelijk uitvoeringsgebrek dat kán zijn, met de bijbehorende
> zekerheid. Verwijs waar mogelijk naar het eisenpunt uit de bijgevoegde checklist of
> specificatie. Stel nooit vast dát iets een afwijking is en geef geen ernstclassificatie —
> lever een conceptlijst die een supervisor ter plaatse moet bevestigen. Noem expliciet
> welke foto's te onscherp, te donker of te ver weg zijn om te beoordelen.

## 6. Vergaderopname of transcript omzetten naar Agreements made

**Niet mogelijk in de app:** de app heeft dicteren per veld, maar geen
audiotranscriptie en geen extractie van besluiten.
**Bijlagen:** vergaderopname of transcript, plus het actuele Agreements-register.

> Zet het bijgevoegde vergadertranscript om naar concept-afspraken in het CODECO-formaat
> Agreements made. Geef per afspraak: besluit, verantwoordelijke partij, deadline,
> brontijdstip in het transcript en zekerheid. Zet bij onduidelijke eigenaar of datum
> exact `[INVOER VEREIST]`. Scheid harde afspraken van intenties en discussiepunten.
> Controleer tot slot tegen het bijgevoegde bestaande Agreements-register welke punten
> een herbevestiging of wijziging van een bestaande afspraak zijn.

## 7. Commerciële afwijkingsanalyse BOQ ↔ Change Orders

**Niet mogelijk in de app:** de app registreert BOQ-voortgang en change orders, maar
maakt geen commerciële analyse of claimonderbouwing.
**Bijlagen:** BOQ-export, alle change orders als PDF, materiaalleveringen en de
periode-PDF met voortgang.

> Maak op basis van de bijgevoegde BOQ, change orders, materiaalleveringen en
> voortgangsrapportage een concept commerciële afwijkingsanalyse. Scheid strikt:
> gecontracteerde hoeveelheid, goedgekeurde wijziging, niet-goedgekeurde blootstelling
> en ontbrekend bronbewijs. Behoud bij elk bedrag de oorspronkelijke valuta en de
> bronreferentie. Bereken niets waarvoor een brongegeven ontbreekt — zet daar
> `[BRON ONTBREEKT]`. Eindig met een lijst documenten die nodig zijn om de analyse af te maken.

## 8. Grondoorzaakanalyse en clustering van NCR's

**Niet mogelijk in de app:** de app houdt NCR's individueel bij, zonder patroonanalyse.
**Bijlagen:** alle NCR-PDF's over de gekozen periode plus de bijbehorende inspectieresultaten.

> Cluster de bijgevoegde NCR's op waarschijnlijke gemeenschappelijke grondoorzaak
> (ontwerp, materiaal, vakmanschap, coördinatie, toezicht). Onderbouw elk cluster met de
> NCR-nummers waarop het berust. Houd Issues en NCR's strikt gescheiden: een Issue is een
> projectbeheersingspunt, een NCR is een formele afwijking van een eis. Lever per cluster
> een concept preventieve maatregel en de vraag die aan de verantwoordelijke aannemer
> gesteld moet worden. Verklaar geen enkele NCR gesloten en wijs geen schuld toe.

## 9. Contract- en specificatieclausules omzetten naar checklistpunten

**Niet mogelijk in de app:** checklists worden handmatig of uit de bibliotheek
geïnstalleerd; er is geen automatische extractie uit contracttekst.
**Bijlagen:** contract, technische specificatie, eventueel de bestaande projectchecklist.

> Haal uit het bijgevoegde contract en de technische specificatie alle **verifieerbare**
> eisen. Zet elke eis om naar één controlepunt met: exacte clausuleverwijzing, letterlijk
> citaat, meetbaar acceptatiecriterium en het antwoordtype (ja/nee/n.v.t., akkoord/niet
> akkoord, getalwaarde met eenheid, of vrije tekst). Laat eisen die niet objectief
> controleerbaar zijn weg en zet ze in een aparte lijst met de reden. Vergelijk het
> resultaat met de bijgevoegde bestaande checklist en markeer wat ontbreekt, dubbel is
> of tegenstrijdig.

## 10. Rapport herschrijven voor een specifiek publiek of in een andere taal

**Niet mogelijk in de app:** de rapportgenerator levert één vaste opmaak in Nederlands
of Engels; hij herschrijft niet naar doelgroep.
**Bijlagen:** de gegenereerde periode-PDF.

> Herschrijf het bijgevoegde CODECO-supervisierapport voor [stuurgroep / opdrachtgever /
> aannemer / verzekeraar] in [taal]. Behoud **alle** cijfers, datums, recordnummers en
> statussen exact zoals ze in het bronrapport staan. Groepeer acties per verantwoordelijke
> partij en eindig met een besluitenlijst. Voeg geen enkele conclusie toe die niet
> letterlijk uit het bronrapport volgt. Zet aan het slot een lijst van alles wat je hebt
> weggelaten om het stuk korter te maken.

## 11. Meerdere periodes vergelijken

**Niet mogelijk in de app:** elk rapport is één periode; er is geen periode-op-periode-vergelijking.
**Bijlagen:** twee of meer periode-PDF's (bijvoorbeeld drie opeenvolgende maanden).

> Vergelijk de bijgevoegde CODECO-periodrapporten met elkaar. Zet per rapportsectie de
> ontwikkeling naast elkaar: bezetting, voortgang, open Issues, NCR's, HSE-meldingen,
> vertragingen en deadlines. Geef aan welke verandering statistisch betekenisvol lijkt en
> welke binnen normale schommeling valt, en zeg er expliciet bij dat je dat op basis van
> weinig meetpunten doet. Citeer bij elk getal het rapport en de sectie. Verzin geen
> tussenliggende periodes.

## 12. Concept HSE-toolboxagenda uit terugkerende bevindingen

**Niet mogelijk in de app:** de app registreert HSE-meldingen maar leidt daar geen
programma uit af.
**Bijlagen:** periode-PDF met de secties HSE en HSE incident, plus de workforce-gegevens.

> Analyseer de bijgevoegde HSE-observaties, incidenten, bezetting en lopende werkzaamheden
> op terugkerende zwakke plekken in de beheersmaatregelen. Lever een concept
> toolbox-agenda van maximaal vijf punten, elk onderbouwd met de meldingsnummers waarop
> het berust, en een vragenlijst voor de HSE-functionaris. Stel geen medische diagnose,
> beoordeel geen letsel en vervang het formele incidentonderzoek niet.

---

## Werkwijze

1. Genereer de bron **in de app** (PDF of Word) — nooit met de hand overtypen.
2. Controleer of het rapport het juiste rapportnummer en de juiste periode draagt.
3. Plak de prompt, hang de bron eraan.
4. Neem de uitkomst terug in de app als **concept**: nieuw issue, nieuwe afspraak,
   nieuwe checklist of nieuw actiepunt — altijd via een menselijke indiening.
5. Zet in de omschrijving van dat record welke prompt en welke bronversie is gebruikt,
   zodat het auditspoor klopt.

**Nooit doen:** persoonsgegevens, contractprijzen of vertrouwelijke HSE-incidenten in een
externe AI plakken zonder dat CODECO daar per geval toestemming voor heeft gegeven.
