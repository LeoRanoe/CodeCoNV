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
- **"Graag de kolommen van de Excel opnemen hier."** Het werkblad **B1-MOH** van de klant
  werkt met: Subject · Description · Validate / To be corrected / Need an alternative
  solution · Action · Responsible from contractor · Issuance date · Initial completion date ·
  daarna een voortgangs-% per inspectiedatum. In het formulier:
  - *Onderwerp* en *Omschrijving* stonden weggeklapt onder "Andere probleeminformatie" en
    staan nu als eerste twee velden in de hoofdstroom;
  - *Uitgiftedatum* is nieuw (`issuance_date` in het issue-management-veld);
  - "Verwachte oplosdatum" heet nu **Eerste opleverdatum**, zoals in het werkblad;
  - "Verantwoordelijke partij" heet nu **Verantwoordelijke bij aannemer**;
  - beoordeling (gevalideerd / te corrigeren / alternatieve oplossing) en de actie stonden
    er al; het voortgangs-% per inspectiedatum ook, via *Voortgang vastleggen* op de kaart.
  - Het gebouw mag nu ook *Alle gebouwen* zijn.

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

## Aanbevolen acceptatievolgorde

1. Deployen.
2. Werkruimte → *Issues*: onderwerp, omschrijving, uitgiftedatum en eerste opleverdatum
   invullen en opslaan; controleren dat NCR een eigen module is.
3. Registers → *Delivery*: hoeveelheid + eenheid invullen, *Voldoet niet* kiezen en opslaan;
   controleren dat de regel rood is en hoeveelheid toont.
4. Een technische instructie maken: alleen onderwerp, omschrijving, discipline, aan-wie,
   deadline; ondertekenen; opslaan; daarna *Naar aannemer sturen* en de PDF downloaden.
