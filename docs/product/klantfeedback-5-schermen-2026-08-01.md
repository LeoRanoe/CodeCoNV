# Klantfeedback op vijf schermen — 1 augustus 2026

Bron: vijf schermafbeeldingen met aantekeningen van CODECO (#13 change order, #14 en #14A NCR,
een projectregister-scherm *Agreement* zonder nummer, #15 actiecentrum). Vervolg op de drie
reeksen van 31 juli.

Gecontroleerd: `npx tsc --noEmit` schoon · `npx eslint app lib tests next.config.ts` schoon ·
`next build` slaagt · 36/36 knipseltests groen (2 nieuwe regressietests voor deze reeks).

---

## Eerst: de klant kijkt naar een oudere deploy

Op elk van de vijf schermafbeeldingen staat nog het lege veld *Exacte projectlocatie* met de
melding dat er geen locatieboom is, en op #14 staan *Issues* en *NCR* nog als twee tabkaarten
binnen één module. Beide zijn op 31 juli al opgelost (deel 2 en deel 3) maar nog niet
gedeployed. Wat hieronder staat is dus deels nieuw werk en deels werk dat al klaarstond;
zonder deploy verandert er voor de klant niets.

## #14 en #14A NCR — "graag NCR form bekijken"

Het NCR-scherm was het issueformulier met een andere titel. De bron is nu het eigen formulier
van de klant (`tmp/client_context/pdf_pages/ncr/page-1.png`): kop, omschrijving, aanbevolen
actie van de ingenieur, voorgestelde correctieve actie van de aannemer, en de eindcontrole.
Die vakken staan nu in de app, in dezelfde volgorde.

- **Kop van het formulier.** Boven het NCR-formulier staat het blok met projectnaam en
  -nummer, de aannemer, het gebouw, de datum en tijd, en of het rapport ondertekend is. Het
  rapportnummer wordt bij indienen toegekend.
- **Referentiechecklist.** Nieuw veld (`NCR - 51` in het voorbeeld van de klant). In de
  NCR-module staat dat veld op de plek van de typekeuze: een keuzelijst die alleen "NCR" kan
  zeggen is in die module een vakje te veel.
- **Omschrijving van de afwijking.** Zelfde veld, met de naam van het klantformulier en een
  groter tekstvak.
- **Aanbevolen actie door de ingenieur.** Nieuw blok met *Opnieuw uitvoeren · Herstellen ·
  Alternatieve oplossing ter goedkeuring* en het zinnetje dat zegt wat de aannemer moet doen.
  Het aangevinkte vakje komt als `[X]` in de PDF en het Word-document terecht.
- **Opmerkingen** en **ondertekening door de ingenieur** (naam + moment) sluiten het formulier
  af, net als op papier.
- **Aannemer.** *Assigned To Owner* heet in de NCR-module **Aannemer · ontvangt deze NCR**.
- **Op de NCR-kaart** staan de drie vakken van het formulier naast elkaar: wat de ingenieur
  aanbeveelt, wat de aannemer voorstelt, en wat de kwaliteitscontrole besloot
  (*opgelost / nog niet opgelost*).

### "Ik wil gelijk in de NCR-invoer komen"

Het tegeltje *NCR* op de werkruimte opende de module met alleen de lijst; je moest nog op
*Nieuw* drukken. Elke ingang naar een module opent nu het invoerformulier direct, net zoals de
moduleschakelaar dat sinds 31 juli doet.

Daarbij is één echte fout weggehaald: wie de NCR-module via de moduleschakelaar opende en
opsloeg, kreeg een *tekortkoming* in plaats van een NCR, omdat het formulier zijn oude
typekeuze hield. De module bepaalt nu wat er wordt aangemaakt.

### "Ik kan geen omschrijving zetten bij de foto"

Elke foto bij een bevinding heeft sinds 1 augustus een eigen scherm met titel, toelichting,
categorie, gebouw, locatie en kijkrichting. Dat gold al voor de NCR-foto's; het staat alleen
nog niet op de deploy die de klant bekeek.

### "Na submit moet de link-optie komen"

Na het indienen staat de link naar de aannemer op dezelfde plek als het formulier: één knop
*Naar aannemer sturen* maakt de beveiligde link, met *Kopieer link* en *Open WhatsApp en
stuur* eronder. Daarvoor wordt de NCR bij verbinding eerst zelf aangemaakt en pas daarna de
foto's in de wachtrij gezet; offline blijft het gedrag zoals het was (de wachtrij maakt de
registratie bij het synchroniseren).

### "De contractor moet een melding krijgen en kunnen invullen en weer opsturen"

De aannemer heeft geen CODECO-account; de beveiligde link *is* zijn melding. Wat de link kon,
was gereedmelden of een probleem melden — het vakje *Proposed Corrective Action by Contractor*
kon hij niet invullen. Dat kan nu:

- de linkpagina toont bij een NCR eerst wat de ingenieur aanbeveelt;
- daaronder staat het tabblad **Correctie invullen** met drie standaardzinnen, een vrij veld
  en *Naam · geldt als ondertekening*;
- het antwoord komt in `findings.proposed_correction` terecht, de NCR gaat van *open* naar
  *in uitvoering*, en de opsteller krijgt de melding *Voorgestelde correctieve actie
  ontvangen*. Sluiten blijft mensenwerk bij CODECO.

Antwoordde de aannemer telefonisch of op papier, dan kan de supervisor hetzelfde vakje zelf
invullen bij *Antwoord aannemer vastleggen*.

### Migratie hoort hierbij

`supabase/migrations/202608010001_ncr_contractor_correction.sql` voegt het antwoordtype
`proposed_correction` toe, laat `resolve_external_share_link` ook zeggen dat het om een NCR
gaat en welke actie is aanbevolen, en schrijft het antwoord naar `proposed_correction`.

**De app werkt ook zonder die migratie**: de linkpagina toont dan het gewone werkpunt met twee
tabbladen, en een correctie die toch verstuurd wordt komt als gewone terugmelding binnen met
de tekst *"Voorgestelde correctieve actie: …"* ervoor. Draai `supabase db push` om de volledige
ronde te krijgen.

## #13 Change order — "zelfde feedback als #11 & 12"

De change order gebruikt hetzelfde beheerde-documentformulier als de technische instructie, dus
projectinfo en datums bovenaan, *Opgemaakt door* als keuzelijst, *Alle gebouwen*, locatie op
tekening, **Aan:**, ondertekenen als opsteller, foto's, schetsblok en *Naar aannemer sturen*
gelden er al voor. Wat nog van #11 en #12 openstond:

- de twee voorbeeldchips (*Wall thickness Building 1–8* en *Change pending approval*) zijn weg,
  om dezelfde reden als bij de technische instructie: een wijziging is projectspecifiek;
- de velden heten nu *Titel / referentie wijziging* en *Omschrijving van de wijziging* in
  plaats van de algemene documentteksten.

## Projectregister · Agreement

- **"Alleen tekst optie."** Een afspraak vraagt nu één tekstveld — *Wat is afgesproken?* — in
  plaats van het weggeklapte blok met titel en documentinhoud. De eerste regel van die tekst
  wordt de regel in het register, dus een aparte titel hoeft niet.
- **"Kunnen kiezen tussen wie de afspraak is gemaakt."** Twee keuzelijsten, *Afspraak tussen*
  en *en*, met CODECO N.V., de ingelogde gebruiker en alle projectpartijen. Ze worden als
  `agreed_between` bij het registeritem opgeslagen.
- **"Onderteken optie."** Per partij een ondertekenvakje; naam en moment worden vastgelegd
  (`signed_by_first`/`signed_at_first` en `signed_by_second`/`signed_at_second`).
- De doorgestreepte *Exacte projectlocatie* verdwijnt zolang er geen locatieboom is; dat was al
  opgelost op 31 juli.

## #15 Actiecentrum — "dit is de deadline page! niet correct"

Het tegeltje *Deadlines* opende het actiecentrum, en dat was geen deadlinepagina. Het
actiecentrum houdt zijn naam — zie de naronde onderaan — en krijgt er een deadlineweergave
bij die wel klopt:

- **Geen vervangende datum meer.** Een bevinding zonder deadline toonde haar aanmaakdatum, een
  registeritem zijn registratiedatum. Daardoor leek alles een deadline te hebben. Alleen de
  echte deadline telt; records zonder deadline staan in hun eigen groep.
- **Groepen naast de statussen**: *Te laat · Binnen 7 dagen · Later · Geen deadline ·
  Alle registraties*. Het tegeltje *Deadlines* opent op *Te laat*.
- **De datum staat er in woorden bij**: "3 dag(en) te laat", "vandaag", "morgen", "over 5
  dagen". Te late regels zijn rood.
- **Alles met een deadline staat erop.** Naast acties, bevindingen en aannemersindieningen nu
  ook de beheerde documenten die CODECO zelf uitgeeft (TI, CO, ER) zodra ze een deadline
  hebben, met een eigen tabblad *TI / CO / documenten*.
- Een gesloten of goedgekeurd record met een datum in het verleden telt niet als achterstand.

---

## Wat nog open staat

| Punt | Status |
| --- | --- |
| **Deployen + `supabase db push`** | Zonder deploy verandert er niets voor de klant; zonder de migratie werkt de NCR-ronde in afgeslankte vorm (zie hierboven). |
| **Melding aan de aannemer zonder link** | Push en e-mail gaan naar CODECO-gebruikers. Een aannemer zonder account bereik je met de WhatsApp-link; die staat nu direct na het indienen. Een aannemersaccount is een aparte keuze. |
| **Getekende handtekening** | Ondertekenen is naam + moment, op het NCR-formulier, de afspraak en de beheerde documenten. Een met de vinger gezette krabbel in de handtekeningregel is nieuw werk. |
| **Foto's in de gegenereerde NCR-PDF** | De PDF verwijst naar de gekoppelde bewijsfoto's; het inbedden van de beelden zelf staat nog open. |
| **E2E-suite** | Slaat over zonder `CODECO_E2E_EMAIL` / `CODECO_E2E_PASSWORD`; in deze sessie niet gedraaid. |

## Aanbevolen acceptatievolgorde

1. Deployen en `supabase db push` draaien.
2. Werkruimte → *NCR*: het formulier staat direct open. Foto maken, omschrijving bij de foto
   zetten, aanbevolen actie *Herstellen* kiezen, ondertekenen en indienen.
3. In het paneel dat daarna verschijnt op *Naar aannemer sturen* tikken en de link in WhatsApp
   openen.
4. De link op een tweede toestel openen, *Correctie invullen* gebruiken en versturen;
   controleren dat de NCR-kaart de voorgestelde correctie toont en op *in uitvoering* staat.
5. De NCR afsluiten via *Kwaliteitscontrole · afsluiten* en de PDF downloaden: de aangekruiste
   actie, de correctie van de aannemer en de eindcontrole staan erop.
6. Registers → *Agreement*: twee partijen kiezen, de afspraak typen, beide ondertekenen en
   opslaan.
7. Werkruimte → *Deadlines*: controleren dat de pagina op *Te laat* opent en dat elke regel
   zegt hoeveel dagen het is.

---

# Naronde: actiecentrum, deadlines en scherm #16

## Het actiecentrum blijft het actiecentrum

De vorige ronde hernoemde de pagina naar *Deadlines*. Dat was fout: het actiecentrum is
iets wat de klant zelf heeft gevraagd, en een naam vervangen lost geen deadlineprobleem op.
De pagina heet weer **Actiecentrum** en heeft nu twee weergaven van dezelfde werklijst:

- **Werklijst** — waar het werk in staat: *Open · Urgent of te laat · Wacht op verificatie ·
  Alle registraties*. Dit is het oorspronkelijke actiecentrum, met één verbetering: te laat
  telt mee als urgent, want op het veld is dat hetzelfde.
- **Deadlines** — waar de datum in zit: *Te laat · Binnen 7 dagen · Later · Geen deadline ·
  Alle registraties*. Het tegeltje *Deadlines* in de werkruimte opent het actiecentrum direct
  op deze weergave; via de onderbalk kom je op de werklijst.

Wat er inhoudelijk niet klopte en nu wel klopt:

- Een bevinding zonder deadline toonde haar aanmaakdatum en een registeritem zijn
  registratiedatum. Alleen de echte deadline telt nu; records zonder deadline hebben een
  eigen groep in plaats van een verzonnen datum.
- De datum staat er in woorden bij: "3 dag(en) te laat", "vandaag", "morgen", "over 5 dagen".
- **De dag is de dag op locatie.** De telling gebruikt de kalenderdag in Paramaribo, niet die
  van het toestel. Een telefoon die op een andere tijdzone staat maakte van "vandaag"
  anders "gisteren".
- Een gesloten, geverifieerd of goedgekeurd record met een datum in het verleden telt niet
  als achterstand.
- Alles met een deadline staat erop: acties, bevindingen, NCR's, aannemersindieningen én de
  beheerde documenten die CODECO zelf uitgeeft (TI, CO, ER), met een tabblad
  *TI / CO / documenten*.
- Tikken op een NCR opent voortaan de NCR-module. Dat was de issuemodule, waar de NCR niet
  in staat — een doodlopende weg op het veld.

## #16 HSE-scherm

- **"Foto kan niet bewerkt of een omschrijving krijgen."** Elke fotoknop in de app zegt nu
  hetzelfde en zegt wat er kan: *Maak of kies een foto* met daaronder "Tik op een foto in de
  lijst om te omschrijven, markeren of verwijderen". De fotorij zelf opende die details al;
  op het scherm was alleen niet te zien dát het kon.
- **"Keuze niet uniform."** Het HSE-formulier zette *Gebouw* en *Exacte projectlocatie* onder
  elkaar over de volle breedte en kende geen *Alle gebouwen*, terwijl de andere formulieren
  dat wel doen. Beide velden staan nu in hetzelfde tweekolomsblok als overal, met dezelfde
  keuzes.
- **"Locatie keuze."** De locatiekeuze verdwijnt zolang er geen locatieboom bestaat en zodra
  de registratie voor alle gebouwen geldt; ze komt terug zodra er verdiepingen of ruimten
  zijn.
- **Bijbehorende fout hersteld.** *Alle gebouwen* kon voor een bevinding of NCR wél worden
  gekozen maar niet worden opgeslagen: een bevinding en een HSE-gebeurtenis hebben in de
  database altijd een gebouw. Kiezen betekende dus een foutmelding bij opslaan. Nu wordt de
  registratie per gebouw opgeslagen — dezelfde afspraak als in de daglog en de veldnotities —
  en de foto's hangen aan de eerste ervan.
- **"SMS link!"** Naast *Open WhatsApp en stuur* staat nu **Als SMS sturen**, op dezelfde drie
  plekken: het paneel direct na het indienen, de kaart van een bevinding of NCR, en de kaart
  van een beheerd document. De knop opent de sms-app van de telefoon zelf met het bericht en
  de beveiligde link erin. Er wordt geen sms-gateway gebruikt en geen telefoonnummer
  opgeslagen; dat blijft zoals het klantvoorstel het vroeg.
