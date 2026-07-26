# Klantfeedback-audit - 22 juli 2026

## Bronnen

- Procore Project Management Product Demo: `https://www.youtube.com/watch?v=4mUxlHnnJb4`
- `Supervisie app.pdf` (drie pagina's handgeschreven productschets)
- referentiebeeld van een bouwtekening met RFI-, observatie- en inspectielabels
- referentiebeeld van de Procore-dialoog **Link Item**
- `WhatsApp Video 2026-07-23 at 10.41.25.mp4` (10 seconden; visuele referentie voor Snap & Assign, One-Tap Daily Log en Subcontractor View)
- bestaande CODECO-webapp, Supabase-migraties, RLS-regels en regressietests
- dertien laat ontvangen klantbestanden: maand- en weekrapport, inspectierapport B1,
  RFI, RFA, WIR, NCR, Technical Instruction, Change Order, Environmental Report
  en twee issue-managementwerkboeken

## Status van de PDF

`Supervisie app.pdf` is de bindende functionele klant-specificatie. De onderdelen uit deze PDF zijn geen optionele roadmap en mogen niet als vrijblijvende vervolgwensen worden gepresenteerd. AI en SMS-notificaties behoren niet tot de klantvraag. De latere klantcorrectie is leidend: meldingen en taakherinneringen lopen primair via browser-push, met een auditeerbare kopie in de applicatie. WhatsApp wordt uitsluitend gebruikt als bewuste redirect naar een tijdelijke taaklink voor externe vakpartijen zonder account. De link toont alleen het gedeelde werkpunt en accepteert uitsluitend een gereedmelding, optionele bewijsfoto of probleemterugmelding; definitieve verificatie blijft intern bij CODECO.

## Doorslaggevende interpretatie

Met "3D image" bedoelt de klant een interactief bolvormig terreinbeeld uit een speciale 360°-camera, bijvoorbeeld Insta360. Dit is geen vlak telefoonpanorama en ook geen fotostrip. Het opgeslagen bronbestand blijft technisch een gestitchte equirectangulaire 2:1-export; de gebruiker ziet het als een interactieve 360°-ruimteweergave waarin rondkijken en exact markeren mogelijk is.

De Procore-referentie vraagt daarnaast om een tekeningenwerkruimte, niet alleen om een bestandenlijst. Een locatie op een tekening moet rechtstreeks verwijzen naar het formele projectrecord dat daar hoort: RFI, submittal, document, observatie/NCR, inspectie of visueel bewijs.

## Aanvullende klantcontext van 24 juli 2026

De dertien later ontvangen bestanden zijn als productspecificatie verwerkt, niet als
productiedata die blind actief mocht worden gemaakt. Historische B1-onderwerpen zijn
daarom een snelinvoercatalogus; pas na menselijke indiening ontstaat een nieuw issue.

| Bronformaat | Actuele implementatie |
| --- | --- |
| RFI / RFA | Eigen formele velden, projectgebonden nummering, revisie, uiterste antwoorddatum, ontvanger, referenties, bijlagen, exacte antwoordcodes en downloadbare klant-PDF |
| WIR / Inspection Request | Discipline, gereeddatum/-tijd, A/B/C/D-besluitstructuur, respondent en downloadbare klant-PDF |
| Technical Instruction | Discipline, prioriteit, aanleiding, referenties, vereiste actie, planning-/kostenimpact, ontvangst/closeout en downloadbare klant-PDF |
| Change Order | Wijzigingsomschrijving, bijlagen, planning-/kostenimpact, ontvangst en downloadbare klant-PDF |
| Environmental Report | Rapportperiode, housekeeping-/milieuobservaties, verloren uren, aannemersontvangst en downloadbare klant-PDF |
| NCR | Klantopmaak met afwijking, Engineer-recommendation, corrigerende actie, QC-verificatie, bewijsverwijzingen en afzonderlijke menselijke afsluiting |
| Issue Management / B1 percentages | Impact, actiestappen, escalatie, disposition en onbeperkte gedateerde voortgangspunten; 100% gaat alleen naar gereed voor verificatie |
| Inspection Report B1 | 35 herbruikbare issuecategorieën, lessons learned uit actuele issues, voortgang per inspectiedatum en gebouwsecties |
| Weekly / Monthly Report | Dagkaarten met weer, uren, werk, QC/HSE en advies; documentcontrolmatrix; milieu; partijen; gebouwen; issues; voortgang; foto-/bestandsaantallen en gebouwsamenvattingen uit één servermomentopname |

## Nu conform gemaakt

| Klantwens | Resultaat |
| --- | --- |
| Geen telefoonpanorama als 360°-bewijs | De interface noemt dit overal **360°-camerabeeld** en vereist expliciete bevestiging dat de bron uit een speciale 360°-camera komt. |
| Inspecteerbare 360°-kwaliteit | De browser controleert een gestitchte 2:1-verhouding en minimaal 3840×1920 pixels voordat upload mogelijk is. |
| Interactief rondkijken | Photo Sphere Viewer rendert de camera-export als bolweergave; yaw/pitch-markers blijven aan formele bevindingen gekoppeld. |
| 360°-rondgang per locatie | Meerdere camerabeelden kunnen in een benoemde en geordende tour staan. |
| Foto/360° op plattegrond | Visuele records zijn als eigen koppelingstype beschikbaar in de tekeningenwerkruimte. |
| Tekeningen bekijken | Private PDF-, JPEG-, PNG- en WebP-tekeningen worden in de browser weergegeven; PDF heeft paginanavigatie. |
| Locatiepin op tekening | Pins bewaren pagina en genormaliseerde X/Y-coördinaten, zodat zij bij iedere schermschaal correct blijven staan. |
| Procore-achtige Link Item-flow | Een pin koppelt aan precies één bestaand RFI-, submittal-, document-, observatie/NCR-, inspectie- of visueel record. |
| Traceerbaarheid en rechten | Aanmaak loopt via een beveiligde RPC; RLS, permissiecontrole, audittrigger, idempotentie, Realtime en back-updekking zijn toegevoegd. |
| Technische betrouwbaarheid | Next.js is bijgewerkt naar 16.2.11, `sharp` naar 0.35.3 en de productie-audit rapporteert nul bekende kwetsbaarheden. |
| PDF tekenen en annoteren | Vrije lijnen, revisiewolken, pijlen en tekst worden als schaalvaste, geaudite overlay opgeslagen; het originele PDF- of DWG-bronbestand blijft ongewijzigd. |
| DWG/PDF-upload | Native DWG-bronnen en PDF-tekeningen kunnen veilig als tekening worden opgeslagen. Voor browserreview en markeringen wordt de gecontroleerde PDF gebruikt. |
| RFA/RFI/IR en projectlogs | Afzonderlijke registers bestaan voor RFA, RFI, inspectieverzoek, technische instructie, change order, afspraak, contract, specificatie, punch list en overige klantlogs. |
| Projectoverzicht | Iedere projectkaart toont de actuele aantallen open acties, issues, NCR's, inspecties, technische instructies (TI) en change orders (CO). |
| Bezetting per vak | Timmerlieden, elektriciens, HVAC, schilders, gevelwerk, beton/wapening, tegelzetters, sanitair en aanvullende bouwdisciplines zijn expliciet selecteerbaar en komen per discipline terug in rapportages. |
| BOQ en voortgang | Een gevalideerde CSV-import legt code, omschrijving, hoeveelheid, eenheid, eenheidsprijs, contractwaarde en voortgang atomisch vast. |
| Dag/week/maand/vrije periode | Eén rechten-gefilterde servermomentopname genereert een periode-PDF met bezetting, voortgang, inspecties, NCR, HSE, leveringen, vertragingen, TI, CO, afspraken, deadlines en visueel bewijs. |
| Zelf rapport kiezen | De klant kiest eerst management, uitvoering, kwaliteit/HSE, contract/besluiten, visueel of compleet en daarna een vrije begin- en einddatum. Alleen die secties worden in de PDF gevuld. |
| Dashboard vóór projectkeuze | Een compact portfolio-overzicht toont projecten, planning vandaag, open acties, Issues, NCR en inspecties voordat een project wordt geopend. |
| Gebouwoverzicht | Iedere gebouwkaart toont eigen voortgang, acties, Issues, NCR, inspecties, TI, CO, fotoaantal en werkzaamheden die vandaag zijn gepland. |
| Mobile-first werkruimte | De werkruimte opent als één taakgestuurde startpagina: camera als primaire actie, inspectie en probleemmelding direct zichtbaar, tekening/pin als vaste vervolgstap en alle overige modules achter één uitklapper. Een geopend onderdeel toont mobiel alleen terugnavigatie en één compacte sectiekeuze. |
| Point-and-shoot bewijs | De primaire cameraknoppen openen rechtstreeks de achtercamera. Project, gebouw, datum, tijd en standaardmap worden na de opname automatisch gekoppeld; meerdere foto’s kunnen aan dezelfde inspectie, bevinding of HSE-situatie worden gestapeld. |
| Zo min mogelijk typen | Werkzaamheden voor vandaag, uitgevoerd werk en planning morgen zijn aanklikbare bouwactiviteiten. De app hergebruikt de keuze automatisch in dagplanning, samenvatting en rapportage. |
| Tik-arme dagelijkse registratie | Dagstart-risico’s en bezetting, standaardacties en deadlines, statusnotities, dagsamenvattingen, kwaliteits- en HSE-situaties, registeritems, 360°-probleemmarkers, herstelmaatregelen en standaard fotomappen zijn aanklikbaar. Vrije tekst blijft beschikbaar voor uitzonderlijke of contractueel specifieke details. |
| Foto's en tekeningen offline | Bestanden worden direct in IndexedDB klaargezet, inclusief automatisch project, gebouw, datum, tijd, titel en map; synchronisatie start bij herstel van een geschikte verbinding. |
| Databesparing | Gewone foto's worden lokaal verkleind en gecomprimeerd. 360°-camera-exporten en tekeningen blijven onveranderd; automatische upload pauzeert op een databundel en kan bewust worden geforceerd. |
| Beeldmappen | Per gebouw kunnen mappen worden gemaakt; de galerij toont beelden per map en bewaart private bestandsrechten. |
| Pushmeldingen | Pushabonnementen zijn per gebruiker en apparaat opgeslagen. Vaste deadline-regels vullen de wachtrij; de dagelijkse taak verzendt automatisch en bewaart aflevering/fouten centraal. |
| WhatsApp voor externe vakpartij | Vanuit een bevinding ontstaat een onvoorspelbare, intrekbare link met beperkte gegevens en standaardvervaldatum; daarna opent de systeem-WhatsApp-flow. De ontvanger heeft geen account of projectrechten nodig. |
| Snap & Assign uit klantvideo | Een probleemfoto, standaardprobleem, ernst en verantwoordelijke partij staan in één snelle registratie. Project, gebouw, datum en tijd worden automatisch gekoppeld; foto plus conceptbevinding kunnen samen in de offline wachtrij. |
| One-Tap Daily Log uit klantvideo | Het dashboard opent één compacte daglog met reeds gekoppelde locatie en weer, plus/min-knoppen per discipline, aanklikbare standaardnotities en optioneel dicteren. Bezetting en notities worden in één bevestiging aan het dagrapport gekoppeld. |
| Interactieve Subcontractor View | De beveiligde accountloze link toont de bronfoto, laat het werk gereedmelden voor interne verificatie, comprimeert een optionele bewijsfoto om data te besparen en accepteert een probleemterugmelding. Iedere reactie is centraal geaudit en veroorzaakt een interne melding. |
| Ongeveer honderd checklists | De centrale bibliotheek bevat exact 100 installeerbare bouw- en HSE-standaarden; iedere installatie maakt een geversioneerde projectspecifieke kopie. |
| Notitieblok en spraak naar tekst | Veldnotities, afspraken en technische instructies kunnen worden getypt of op ondersteunde browsers worden gedicteerd en krijgen automatisch datum en tijd. |
| Calculator | De veldtools bevatten oppervlakte-, inhouds- en veilige rekenfunctionaliteit zonder `eval`. |
| Pushmeldingen | Nieuwe deadline-, bevinding-, HSE- en reviewmeldingen komen idempotent in een pushwachtrij; verzendstatus, verlopen apparaten en fouten blijven centraal controleerbaar. E-mail is alleen een later configureerbare, standaard uitgeschakelde fallback. |
| Dagelijkse back-upbewaking | De beveiligde Vercel-taak maakt idempotente private back-ups. Omdat Hobby-planning binnen een uur mag variëren, controleert de eerste bevoegde CODECO-sessie van de dag aanvullend of de back-up al verified is en start hem anders direct. Alleen een gebruiker met `backup.manage` mag deze watchdog activeren. |

## Reeds aanwezig en gecontroleerd

- bedrijf -> project -> gebouw -> dagstart;
- dagrapport met planning, werkelijk weer, bezetting, voortgang en dagsluiting;
- aanwezigheid per partij en discipline;
- configureerbare inspectie- en HSE-checklists;
- automatische bevinding bij een afgekeurd controlepunt;
- observatie/tekortkoming/afwijking/NCR met ernst, partij, deadline, herstel en onafhankelijke verificatie;
- HSE-observatie, near miss, incident, stop-work, vertrouwelijkheid en kritieke escalatie;
- acties, deadlines, in-appmeldingen en Realtime-verversing;
- registers voor levering, materieel, proef, wijziging, vertraging, communicatie, risico, document, tekening, RFI, submittal, instructie, overleg, correspondentie, kosten en declaratie;
- private Vercel Blob-upload/download met actuele projectrechten;
- immutable dagrapportversies, SHA-256, review, retour, ondertekenverklaring, distributiespoor en revisies;
- automatische en handmatige back-upmanifesten met controles en retentie.

## Nog nodig voor productieacceptatie

Dit zijn geen ontbrekende PDF-functies, maar noodzakelijke configuratie- en acceptatiestappen:

| Stap | Vereiste |
| --- | --- |
| Productiemigratie | Migraties 26 t/m 30 gecontroleerd naar het gekoppelde Supabase-project uitrollen. De volledige reeks is lokaal vanaf nul geslaagd. |
| Pushsleutels | Een VAPID-sleutelpaar, `VAPID_SUBJECT` en de canonieke productie-URL in Vercel instellen; daarna push op telefoon, tablet en desktop activeren en testen. |
| Optionele e-mailfallback | Resend kan later worden ingesteld; dit blokkeert de primaire pushworkflow niet. |
| Veld-UAT | Testen met een echte Insta360-export, een echte project-PDF, een echte DWG-bron, een CODECO-BOQ en gebruikers uit de relevante rollen. |
| Checklistacceptatie | De 100 basisstandaarden zijn functioneel beschikbaar; CODECO moet de inhoud projectspecifiek bevestigen of aanpassen vóór contractueel gebruik. |
| Juridische ondertekening | De technische ondertekenverklaring werkt; het vereiste juridische niveau blijft een contractuele organisatiekeuze. |

## Acceptatiecriteria voor veld-UAT

1. Upload een echte Insta360- of gelijkwaardige export en bevestig dat 360° rondkijken vloeiend werkt op telefoon, tablet en desktop.
2. Plaats een marker op een herkenbaar gebrek, maak de bevinding aan en controleer dat beeld, marker en bevinding na herladen gekoppeld blijven.
3. Upload een meerpagina-PDF-tekening, plaats pins op twee pagina's en koppel minimaal een RFI, inspectie en 360°-camerabeeld.
4. Schaal het scherm en roteer een tablet; controleer dat alle pins op dezelfde fysieke tekenlocatie blijven.
5. Trek projecttoegang van een testgebruiker in en bevestig dat tekening, 360°-beeld en pins onmiddellijk niet meer leesbaar zijn.
6. Maak een handmatige back-up en bevestig dat `drawing_pins`, `drawing_markups`, `visual_captures` en `visual_annotations` in het manifest staan.
7. Teken een vrije lijn, revisiewolk, pijl en tekst op twee PDF-pagina's en bevestig dat het originele bestand ongewijzigd blijft.
8. Importeer een echte BOQ en controleer hoeveelheid, contractwaarde en voortgang; één ongeldige rij moet de volledige import terugrollen.
9. Installeer drie bibliotheekchecklists en voer één inspectie met automatische NCR bij afkeur uit.
10. Genereer een week-, maand- en vrije-perioderapport en vergelijk de totalen met de bronregistraties.
11. Maak een deadline- en kritieke HSE-melding en bevestig ontvangst als push plus status **Push verzonden** in de inbox.
12. Zet het toestel offline, maak gewone foto's én een Insta360-export klaar, herstart de app, controleer de lokale wachtrij en herstel daarna de verbinding voor automatische synchronisatie.
13. Deel een bevinding via WhatsApp, open de link zonder account, meld het herstel gereed met een bewijsfoto en bevestig dat de bevinding alleen naar **gereed voor verificatie** gaat en de interne supervisor een push/in-appmelding ontvangt.
14. Maak een probleemfoto terwijl het toestel offline is, kies een standaardprobleem en verantwoordelijke partij, herstel de verbinding en bevestig dat foto, bevinding en toewijzing samen synchroniseren.
15. Open **Snel daglog**, wijzig de bezetting met plus/min, kies een standaardnotitie, dicteer een aanvulling en bevestig dat één opslagactie alle gegevens aan het dagrapport koppelt.
16. Doorloop dagstart, actie, HSE, register, 360°-marker, herstel/verificatie en fotomappen uitsluitend met de aangeboden snelkeuzes; bevestig dat vrije tekst nergens verplicht is zolang een passende standaardoptie bestaat.
17. Open de werkruimte op 390×844 en op desktop, maak via de primaire knop direct een foto, start een inspectie en meld een probleem; bevestig dat geen horizontale registerbalk of snelactiematrix de mobiele startflow verdringt.

De applicatie mag pas als productie-geaccepteerd worden aangeduid nadat bovenstaande UAT, productieconfiguratie en contractuele ondertekenkeuze zijn afgerond.
