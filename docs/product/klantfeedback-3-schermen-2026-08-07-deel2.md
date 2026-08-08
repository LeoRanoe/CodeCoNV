# Klantfeedback op drie schermen — 7 augustus 2026, deel 2

Bron: drie schermafbeeldingen met aantekeningen van CODECO — een geannoteerd "Change
Order"-scherm, een geannoteerd "Agreements Made"-scherm, en een screenshot van het
**echte** werkruimte-dashboard (`/supervisie`) met "Deadlines" doorgestreept en
"LESSONS LEARNED" ernaast geschreven. Vervolg op de ronde van eerder vandaag
(`docs/product/klantfeedback-5-schermen-2026-08-07.md`).

Navraag bij de klant over twee punten die niet met zekerheid te lezen waren:

1. *"Deadlines" doorgestreept, "Lessons Learned" ernaast — moet Deadlines verdwijnen?*
   Antwoord: **nee, allebei moeten gewoon bestaan.**
2. *Onleesbare rode tekst bij "Completion Status" op Agreements Made.*
   Antwoord: **"Het is datum"** — te kort om een concrete velduitbreiding op te
   baseren; hieronder als openstaand punt genoteerd in plaats van geraden.

Gecontroleerd: `npx tsc --noEmit` schoon (afgezien van de al bekende, niet-gerelateerde
ontbrekende `public/landing/*`-beeldbestanden in deze checkout) · `npx eslint app lib
tests next.config.ts` schoon · `next build` slaagt · 93/93 knipseltests groen
(1 nieuwe regressietest voor deze reeks).

---

## Change Order en Agreements Made: mockup ≠ echte formulieren

Zelfde patroon als de NCR-mockups van vanochtend: deze twee schermen komen uit dezelfde
losstaande mockup-stijl, niet uit de live app. Voor elke doorgestreepte of omcirkelde
aantekening is nagegaan of het onderliggende veld echt bestaat:

- **Kopvelden ("IDEM": Project Name, Date, Project No, Location/Area, Originated/
  Prepared By).** Al uniform — Change Order en Agreement gebruiken al hetzelfde gedeelde
  kopblok (`controlled-document-context`) als elk ander formulier in de app.
- **Drie goedkeuringsvakken op Change Order (Developer Originator / Supervision /
  Contractor Acceptance), met alleen Supervision omcirkeld.** Bestaat niet: Change Order
  heeft één handtekening (de opsteller bij CODECO), net als Technical Instruction.
- **Proposed Finish Date (By Contractor) / Likely Completion Date / Actual Status-foto
  op Change Order, doorgestreept.** Bestaan niet; het echte formulier heeft in plaats
  daarvan *Schedule impact* / *Cost impact* keuzelijsten plus een toelichting.
- **"Developer Representative" op Agreements Made, doorgestreept.** Het echte
  Agreement-formulier heeft geen vaste derde rol; het is al een vrije keuze van *twee*
  partijen uit een lijst (CODECO N.V., de ingelogde gebruiker, alle projectpartijen),
  elk met een eigen handtekening. Er is dus niets vasts om te verwijderen.

Voor deze twee formulieren is er dan ook niets aangepast — er was niets dat overeenkwam
met wat op de mockup stond en nog niet al zo (of flexibeler) in de app zat.

## Het dashboard: een echte tegel, een echt ontbrekende module

Screenshot 3 is wél een schermafdruk van de live werkruimte
(`app/project-workspace-home.tsx`, gerenderd op `/supervisie`). De tegel *Deadlines*
bestaat écht en opent het actiecentrum op de deadline-weergave; die blijft ongewijzigd.
Ernaast staat nu een nieuwe tegel:

- **Nieuwe tegel "Lessons learned"** op het dashboard, met een eigen icoon, direct naast
  *Agreements made*. Opent het projectregister met het nieuwe registertype
  `lessons_learned`.
- **Nieuw registerformulier**, met dezelfde velden als het "Capture, Learn & Improve"-
  formulier van de klant (`docs/product/klantfeedback-5-schermen-2026-08-04.md` /
  screenshot #5 van die ronde): Projectfase, Probleem, Oorzaak, Oplossing/verbetering,
  Verwacht resultaat, Vervolgactie, Verantwoordelijke en Status (Open / In uitvoering /
  Afgerond).
  - **Geen Target Date-veld** — dat streepte de klant destijds al door op het eigen
    Lessons Learned-scherm.
  - **Twee foto's (Picture of Issue / Picture of Result)** lopen mee in de bestaande,
    algemene fotocapture die elk registeritem al heeft, in plaats van twee losse
    vakken.
  - Het record wordt, net als elk ander registeritem, ondertekend met de algemene
    registratiehandtekening.
  - De registerlijst toont status en verantwoordelijke in de samenvattingsregel, net
    zoals een afspraak zijn partijen en handtekeningen toont.

### Migratie

Geen. `lessons_learned` gebruikt, net als `agreement` en `delivery`, de bestaande
vrije `details` jsonb-kolom van `register_entries` — geen nieuwe databasekolommen
nodig.

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **"Completion Status" + "datum" op Agreements Made** | Onduidelijk gebleven, ook na navraag ("Het is datum"). Het Agreement-formulier heeft vandaag geen aparte afrondingsstap (Completed / Partially Completed / Not Completed + datum) zoals op de mockup. Concrete aanvulling nodig zodra duidelijk is wat er precies gevraagd wordt. |
| **Lessons Learned: geen apart export-/afdrukformaat** | Het record is zichtbaar en bewerkbaar in de registerlijst zoals elk ander registeritem, maar heeft geen eigen PDF/Word-sjabloon zoals NCR dat wel heeft. |

## Aanbevolen acceptatievolgorde

1. Werkruimte-dashboard openen: *Deadlines* en *Lessons learned* staan beide als tegel.
2. *Lessons learned* openen, een les vastleggen (Probleem/Oorzaak/Oplossing/Verwacht
   resultaat zijn verplicht) en opslaan; controleren dat de registerlijst de status en
   verantwoordelijke toont.
3. Change Order en Agreements Made aanmaken zoals gebruikelijk — deze twee zijn
   ongewijzigd.
