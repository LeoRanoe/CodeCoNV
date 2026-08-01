# Ondertekenen — waar het misging, 1 augustus 2026

De klant komt in bijna elke ronde terug op ondertekenen: *"handtekening van de opsteller"*
(#12), *"onderteken optie"* bij de afspraak, de vier handtekeningregels op zijn eigen
NCR-formulier, en punt 19 van zijn dagrapport: *"Controle, naam/functie en ondertekening"*.

Bij het nalopen van de docs tegen de code bleek het patroon steeds hetzelfde: **er wordt
wél ondertekend, maar de handtekening komt niet terecht op het papier dat de klant
uitdeelt.** Hieronder wat er misging en wat er nu gebeurt.

Bronnen: `docs/productplan-constructiesupervisie-webapp.md` §4.17 en §7,
`docs/product/client-day-report-brief.md` punt 19,
`docs/product/klantfeedback-3-schermen-2026-07-31-deel3.md` (#12),
`docs/product/klantfeedback-5-schermen-2026-08-01.md` (NCR en afspraak),
`tmp/client_context/pdf_pages/ncr/page-1.png` (het NCR-formulier zelf).

---

## 1. Het dagrapport toonde nergens dat het ondertekend was

**Gevraagd** — punt 19 van het dagrapport van de klant: controle, naam/functie en
ondertekening. Productplan §4.17: ondertekenen door supervisor, uitvoerder en optioneel
opdrachtgever.

**Wat er stond** — de ondertekenverklaring werkt: rol, naam, verklaring, moment en
versiehash worden append-only vastgelegd (`report_signatures`) en in de app getoond in de
kolom *Verklaringen*. Maar de **PDF en het Word-document van het dagrapport hadden geen
enkel ondertekenblok**. Wie het rapport uitprintte of doorstuurde, zag alleen "Supervisor:
naam" in de kop. Ondertekenen veranderde niets aan het document.

**Nu** — sectie 17–19 is gesplitst: *17–18. Foto's en bijlagen* en een eigen blok
**19. Controle, naam/functie en ondertekening** met drie kolommen (supervisor, aannemer,
opdrachtgever). Een rol die nog niet tekende houdt een lege lijn met "Nog niet
ondertekend"; wie wel tekende staat er met naam, moment en de letterlijke verklaring
eronder. Omdat een versie ná het bevriezen wordt ondertekend, reizen de verklaringen naast
de immutable snapshot mee naar de PDF en het Word-bestand.

## 2. Het beheerde document (TI, CO, RFI, WIR, ER) verzweeg zijn opsteller

**Gevraagd** — #12: *"Handtekening van de opsteller."*

**Wat er stond** — het vinkje *Ondertekenen als opsteller* slaat `signed_by`,
`signed_by_position` en `signed_at` op. De gegenereerde PDF en het Word-bestand printten
daar niets van; ze toonden alleen het lege antwoordblok van de ontvanger, met de zin *"A
blank signature line is intentional"*. De aannemer die het document kreeg kon dus niet zien
dat het ondertekend was.

**Nu** — een blok **ISSUED AND SIGNED BY** met naam, functie/bedrijf en de datum van
ondertekenen, vóór het antwoordblok. Niet ondertekend staat er als "Not signed yet"; de
zin over de lege regel is aangepast, want die geldt nu alleen nog voor de ontvanger.

## 3. De aannemer tekende de correctie, maar zijn naam bleef in een tabel hangen

**Gevraagd** — het NCR-formulier van de klant heeft onder *Proposed Corrective Action by
Contractor* een handtekening en een datum.

**Wat er stond** — de linkpagina vraagt *"Naam · geldt als ondertekening"*, maar die naam
werd alleen in `external_share_responses.contact_name` opgeslagen. De NCR zelf kreeg alleen
de tekst, dus de handtekeningregel *Received / contractor* op de gegenereerde NCR bleef
leeg en de kaart in de app zei niet wie geantwoord had. Bovendien was de naam **optioneel**
— een handtekening die je leeg mag laten.

**Nu** —
- de naam is verplicht zodra de aannemer een correctie invult (minimaal 2 tekens);
- migratie `202608010002` schrijft `correction_signed_by` en `correction_signed_at` bij de
  NCR zelf, en `completion_signed_by`/`_at` bij een externe gereedmelding;
- de NCR-kaart toont *"Ondertekend door … · datum"* onder het correctievak;
- de handtekeningregel *Received / contractor* op de NCR-PDF en het Word-bestand is
  gevuld, met de datum in het correctievak erbij.

## 4. De afspraak kon getekend worden, maar je zag het daarna nooit terug

**Gevraagd** — *"Onderteken optie"* bij de afspraak, plus kunnen kiezen tussen wie de
afspraak is gemaakt.

**Wat er stond** — beide partijen en beide handtekeningen werden opgeslagen in
`details`, maar de afspraak verscheen daarna in het projectregister als een gewone regel:
titel, nummer, gebouw, datum. Geen partijen, geen ondertekenstatus. Ondertekenen was
onzichtbaar zodra je op opslaan drukte.

**Nu** — de registerregel zegt het: *"tussen CODECO N.V. en 23RD Metallurgical · door
beide partijen ondertekend"*, of *"niet ondertekend"*, of wie van de twee wel tekende.

## 5. Er waren twee plekken om een afspraak vast te leggen, met verschillende regels

**Wat er stond** — het registerformulier (*Registers → Agreement*) kreeg op 1 augustus de
twee partijen en de ondertekenvakjes. Het **veldnotitieblok** (*Veldtools → Formele
afspraak*) schrijft exact hetzelfde registertype `agreement`, maar had geen partijen en
geen ondertekening. Welke van de twee je koos bepaalde of je kon tekenen.

**Nu** — beide gebruiken hetzelfde blok (`app/agreement-signature.tsx`): dezelfde
partijkeuze, dezelfde twee handtekeningen, dezelfde opslag. Wat je ook opent, een afspraak
kan getekend worden.

---

## Wat bewust niet is opgelost

| Punt | Waarom |
| --- | --- |
| **Een met de vinger getekende krabbel** | Ondertekenen is nu overal naam + moment (+ rol en verklaring bij het rapport). Het schetsblok kan al met de vinger tekenen; die krabbel als beeld in de handtekeningregel zetten vraagt opslag van het beeld bij het document en het inbedden ervan in PDF en Word. Dat is een aparte, te testen wijziging — en volgens het productplan (§4.17) eerst een **juridische keuze**: "een getekende afbeelding alleen is niet in elke situatie voldoende". Zeg wat CODECO contractueel nodig heeft, dan bouw ik het daarop. |
| **Antwoord van de aannemer dat buiten de app binnenkomt** | Vult de supervisor de correctie zelf in (telefonisch of op papier), dan staat er geen naam van de aannemer onder — de app kan niet doen alsof die getekend heeft. De supervisor noteert de naam in de tekst; de auditregel toont wie het invoerde. |
| **Juridisch niveau van de ondertekening** | Blijft `contract_pending`, zoals het productplan en de audit van 22 juli voorschrijven. Dat is een contractuele keuze van CODECO, geen technische. |

## Aanbevolen acceptatievolgorde

1. `supabase db push` (migraties `202608010001` en `202608010002`, in die volgorde).
2. Dagrapport: vastzetten, *Verklaring vastleggen* met rol en verklaring, daarna de PDF van
   die revisie downloaden — blok 19 toont naam, rol, moment en de verklaring.
3. Een technische instructie of change order ondertekenen als opsteller en de PDF
   downloaden — *ISSUED AND SIGNED BY* is gevuld.
4. Een NCR versturen, op een tweede toestel *Correctie invullen* met naam, en daarna de
   NCR-PDF downloaden — het contractorvak en de handtekeningregel dragen die naam.
5. Een afspraak opslaan met twee partijen en beide handtekeningen, zowel via *Registers →
   Agreement* als via *Veldtools → Formele afspraak*, en de regel in het register
   controleren.
