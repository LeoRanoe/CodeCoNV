# Productplan-compliance — CODECO Supervisie

Laatst bijgewerkt: 18-07-2026  
Bron: `docs/productplan-constructiesupervisie-webapp.md`  
Klantverfijning: `docs/product/client-profile-codeco.md`
Klantbrief dagrapport: `docs/product/client-day-report-brief.md`

## Werkwijze

Deze lijst is de levende controle op de klantwensen. Een eis krijgt pas **Conform** wanneer zij is geïmplementeerd én aantoonbaar gecontroleerd.

Statussen:

- **Conform** — gebouwd en gecontroleerd;
- **Gedeeltelijk** — zichtbaar of werkend, maar nog niet volledig volgens alle regels;
- **Niet gestart** — nog niet gebouwd;
- **Geblokkeerd** — vereist een klantbesluit, account, contractgegeven of externe configuratie;
- **Tijdelijke afwijking** — bewust afwijkend en voorzien van herstelactie.

Bij iedere functionele wijziging worden de betrokken regels en de verificatie in deze lijst bijgewerkt.

## Productprincipes

| ID | Eis | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| PP-01 | Mobile-first, bruikbaar op telefoon en tablet | Conform | Responsieve cockpit, mobiele ondernavigatie, grote tikdoelen en modal-sheets; productiebuild en broncontrole aanwezig |
| PP-02 | Online-first; Supabase/Postgres is de enige actuele gegevensbron | Conform | Hosted Supabase is gekoppeld; login, organisatie/projectinrichting, projectstart, dagvragen, aanwezigheid, registraties en reviewstatus lezen en schrijven centraal. De UI bevestigt pas na serverrespons |
| PP-03 | Eenmaal invoeren, overal hergebruiken | Conform | Centrale projectstart, dagafsluiting, aanwezigheid en registraties voeden context, cockpit, tijdlijn, KPI's, review en PDF-concept zonder tweede invoer |
| PP-04 | Veelgebruikte registratie binnen enkele tikken | Gedeeltelijk | Centrale knop, typekeuze en compact formulier werken; 30-seconden-test met echte supervisors moet nog plaatsvinden |
| PP-05 | Alleen zichtbare, regelgestuurde automatisering | Gedeeltelijk | Projectstart, checklistafwijkingen, bevindingstermijnen, kritieke HSE-escalatie en vervalnotificaties zijn deterministisch en auditbaar. Volledig klantbeheer en versiebeheer van alle regels volgt |
| PP-06 | Formulieren, checklists, categorieën en rapporten configureerbaar | Gedeeltelijk | Beheerders beheren projectinstellingen, locatiehiërarchie, partijen en atomisch gepubliceerde checklists met vragen. Rapportsecties, categorieën en huisstijl zijn nog niet volledig configureerbaar |
| PP-07 | Wijzigingen, goedkeuringen en versies traceerbaar | Conform | Append-only audit, actor/tijd/old/new-waarden, immutable rapportversies en snapshots, reviewbesluiten, ondertekenverklaringen, distributieregistratie en revisiehistorie zijn centraal afgedwongen en getest |
| PP-08 | Reuse-first UI met onderhouden open-sourcecomponenten | Tijdelijke afwijking | React en Lucide worden hergebruikt, maar maatwerkdialogen/formuliervelden moeten worden vervangen door MUI-wrappers |
| PP-09 | Gratis pilot met gebruiksmeters en limietwaarschuwingen | Gedeeltelijk | Gratis private hosting is actief en de opslaggateway bevat een beheerdersendpoint voor Drive-quota; live quota en Supabase-limietwaarschuwingen wachten op het dedicated Drive-account |

## Navigatie en dagelijkse hoofdflow

| ID | Eis | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| WF-01 | Mijn projecten → Gebouwen → Projectstart | Conform | Verplichte driestapsflow gebouwd en door server-rendercontrole afgedekt |
| WF-02 | Gekozen project en gebouw blijven zichtbaar | Conform | Context staat in kop en zijbalk; contextwissel keert terug naar de projectkeuze |
| WF-03 | Fysieke registratie heeft verplicht een gebouw | Conform | De live invoer vereist een gekozen gebouw; samengestelde foreign keys en databaseconstraints blokkeren fysieke registraties zonder geldig projectgebouw |
| WF-04 | Maximaal vijf primaire navigatiekeuzes | Conform | Vandaag, Project, Snel toevoegen, Acties en Meer op mobiel; desktop gebruikt dezelfde informatiestructuur |
| WF-05 | Dagcockpit beantwoordt planning, controles, problemen, ontbrekende informatie en rapportgereedheid | Gedeeltelijk | Live centrale projectstart en dagvragen verzamelen weer, planning, bezetting, inspecties, risico's en voortgang; projectspecifieke externe planning ontbreekt nog |
| WF-06 | Dagrapport automatisch per project en datum | Conform | De live cockpit roept de atomische RPC aan; unieke beperking `(project_id, report_date)` en idempotency voorkomen dubbele dagrapporten |
| WF-07 | Rapportcontrole blokkeert bij ontbrekende verplichte informatie | Conform | Alle vier dagvraaggroepen, inclusief conditionele kwaliteit-/HSE-toelichting, plan voor morgen en bijlagenbevestiging, blokkeren “Gereed voor review” zolang informatie ontbreekt |
| WF-08 | Open zaken gaan mee naar de volgende dag | Gedeeltelijk | Open acties en bevindingen blijven projectbreed zichtbaar; vervallen/bijna vervallen acties en bevindingen verschijnen als gededupliceerde in-appmeldingen. Expliciete dagoverdracht en bevestiging ontbreken nog |

## MVP-modules

| ID | Module | Status | Opmerking |
| --- | --- | --- | --- |
| MVP-01 | Organisatie, gebruikers, rollen en projectinrichting | Gedeeltelijk | Openbare registratie is databasebreed geblokkeerd. Alleen een organisatiebeheerder nodigt accounts uit, wijst organisatie-/projectrollen toe en kan met verplichte auditreden opschorten, heractiveren of definitief intrekken; eigen accountblokkade is verboden. Rollen van een bestaand actief account achteraf wijzigen volgt |
| MVP-02 | Projectlocaties, partijen en basisdocumenten | Gedeeltelijk | Project, gebouw, beheerbare locatiehiërarchie en projectpartijen werken centraal. Bestandsmetadata is afgeschermd; daadwerkelijke Drive-opslag wacht op OAuth-configuratie |
| MVP-03 | Dagrapportmotor | Gedeeltelijk | De 19 klantonderdelen, volledigheidsgate, centrale immutable snapshot met SHA-256, review/retour, ondertekening, distributieregistratie en revisies zijn gebouwd. Week-/tweeweekrapport en PDF rechtstreeks uit de frozen snapshot volgen |
| MVP-04 | Dagcockpit en Snel toevoegen | Conform | Eerste gecontroleerde vertical slice |
| MVP-05 | Aanwezigheid | Gedeeltelijk | Partijen, disciplines, diensten, aantallen en totalen worden idempotent centraal opgeslagen; bezoekersregistratie en vorige-dagbevestiging ontbreken |
| MVP-06 | Werkzaamheden en voortgang | Gedeeltelijk | Projectstart vraagt gepland werk; dagafsluiting vraagt uitvoering en voortgangspercentage. Planningkoppeling en formele bevestiging ontbreken |
| MVP-07 | Inspecties met configureerbare checklists | Gedeeltelijk | Beheerders publiceren atomisch projectspecifieke templates; supervisors beantwoorden verplichte items en afronding creëert automatisch bevindingen bij afkeur. Numerieke meetvelden, herinspectie-UI en klantdefinitieve formulieren volgen |
| MVP-08 | Bevinding → actie → herstel → verificatie | Gedeeltelijk | Gestructureerde NCR/bevindingen hebben nummer, ernst, partij, termijn, herstelmaatregel, bewijsbeschrijving en onafhankelijke verificatie met immutable updates. Drive-bestandsbewijs wacht op de opslagkoppeling |
| MVP-09 | Basis-HSE en incident/near miss | Gedeeltelijk | Incident, near miss, onveilige handeling/conditie en toolbox zijn formeel registreerbaar; vertrouwelijkheid, onmiddellijke maatregel en kritieke escalatiemelding worden afgedwongen. Onderzoek/afsluitflow en definitieve klantchecklist volgen |
| MVP-10 | Actiepunten en herinneringen | Gedeeltelijk | Acties en bevindingen hebben deadlines, statusflow, realtime updates en gededupliceerde in-appmeldingen voor naderende/vervallen termijnen en kritieke HSE. Geplande externe meldingen en bulkbeheer ontbreken |
| MVP-11 | Foto's en bijlagen | Geblokkeerd | Metadata, rechtenmodel, uploadscherm en JWT/RLS-beveiligde resumable Drive-gateway zijn gebouwd en gecompileerd. Live uploads vereisen het dedicated CODECO Google-account en OAuth-/Worker-secrets |
| MVP-12 | Vertraging en handmatig weer | Gedeeltelijk | Projectstart en dagafsluiting vragen werkelijk weer; vertraging vraagt oorzaak en uren. Automatische weerbron en tijdblokberekening ontbreken |
| MVP-13 | Review, PDF, ondertekening en revisies | Gedeeltelijk | Formele review/retour, immutable freeze+checksum, geauthenticeerde append-only ondertekenverklaringen, distributieregistratie en revisies met behoud van origineel werken. Juridisch ondertekenniveau en automatische verzending zijn klantbesluiten; PDF uit frozen snapshot volgt |
| MVP-14 | Basisdashboard en registers | Gedeeltelijk | KPI's en moduleoverzicht werken; centrale registers zijn beschikbaar voor materieel, levering, proef, wijziging, vertraging, communicatie, risico, documenten, tekeningen, RFI, submittal, instructie, overleg, correspondentie, kosten en declaraties. Uitgebreide filters/trends volgen |
| MVP-15 | Audit, rechten en back-up | Gedeeltelijk | RLS, append-only audit, formele recordbeveiliging, 229 pgTAP-tests, handmatige JSON-export, SHA-verificatie en restore-dry-run zijn aanwezig. Dagelijkse offsite Drive-back-up is extern geblokkeerd |
| MVP-16 | Online verwerking, idempotency en hervatbare uploads | Geblokkeerd | Online mutaties gebruiken unieke keys en atomische RPC's; de gecompileerde gateway verwerkt 1 MiB-chunks via kortlevende ondertekende sessies. Live hervatten vereist Google OAuth-/Worker-configuratie |
| MVP-17 | Beheer van secties, checklists, categorieën, deadlines en huisstijl | Gedeeltelijk | Beheer-UI werkt voor projectregels, rapportprefix, herinneringstermijnen, bestandslimiet, locatiehiërarchie, partijen en gepubliceerde checklists. Rapportsecties, categorieën en huisstijlbeheer volgen |
| MVP-18 | Dagelijkse JSON-back-up en hersteltest | Geblokkeerd | Beheerders kunnen een centrale JSON-export maken, SHA-256 verifiëren, downloaden en een restore-dry-run auditen. Dagplanning, retentie en Drive-upload vereisen het dedicated opslagaccount |

## CODECO-specifieke eisen

| ID | Klantwens | Status | Productplanrelatie |
| --- | --- | --- | --- |
| CC-01 | Projectspecifieke checklists | Gedeeltelijk | Beheerbare projectsjablonen en volledige verplichte checklistuitvoering werken, inclusief automatische bevinding bij afkeur; definitieve CODECO-vragen en meettypes moeten nog worden bevestigd |
| CC-02 | Dagelijkse, wekelijkse en tweewekelijkse rapporten | Gedeeltelijk | Dagrapportprototype volgt nu de 19 klantonderdelen; week/2-weekrapport nog niet |
| CC-03 | Rapporten met foto's en grafieken | Gedeeltelijk | Professioneel PDF-concept en KPI-presentatie werken; echte Drive-foto's en genereren uit frozen snapshot volgen |
| CC-04 | Planning en deadlines bewaken | Gedeeltelijk | Actie- en bevindingstermijnen plus in-appescalatie werken; externe planning en geplande notificatiejob ontbreken |
| CC-05 | Kosten en budgetten bewaken | Gedeeltelijk | Kostenrecords kunnen projectspecifiek met gestructureerde details worden geregistreerd; budgettotalen en goedkeuringsflow wachten op CODECO-proceskeuze |
| CC-06 | Aannemersdeclaraties controleren | Gedeeltelijk | Declaraties hebben een projectspecifiek register; controle-, bewijs- en goedkeuringsflow wachten op CODECO-proceskeuze |
| CC-07 | Meer-/minderwerk met bewijs en besluit | Gedeeltelijk | Dagafsluiting vraagt wijzigingen/meerwerk; formele bewijs-, prijs-, besluit- en goedkeuringsflow ontbreekt |
| CC-08 | Kwaliteit, veiligheid, efficiency en kostenbesparing adviseren | Gedeeltelijk | Kwaliteit/HSE zichtbaar; adviesregistratie en besluitspoor ontbreken |
| CC-09 | Kwaliteit, transparantie, klanttevredenheid en commitment zichtbaar maken | Gedeeltelijk | Transparante status en opvolging aanwezig; formele audit en klantportaal ontbreken |

## Klantdagrapport — 19 onderdelen

| ID | Klantonderdeel | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| CDR-01 | Projectinformatie, weer en werkuren | Gedeeltelijk | Context, rapportdatum, handmatig weer en werkuren worden centraal opgeslagen en verschijnen in het PDF-concept; aanvullende contractmetadata volgt |
| CDR-02 | Samenvatting van het verloop | Conform | De centrale vraag “Hoe is het project vandaag gegaan?” voedt rapport, PDF-concept en immutable centrale snapshot |
| CDR-03 | Aanwezigheid en partijen | Gedeeltelijk | Aanwezigheidsmodule slaat partijen, disciplines, diensten en aantallen centraal op en hergebruikt die in het rapport; bezoekersregister ontbreekt |
| CDR-04 | Werkzaamheden en voortgang | Gedeeltelijk | Gepland en uitgevoerd werk plus voortgangspercentage worden gevraagd; planningkoppeling ontbreekt |
| CDR-05 | Inspecties en controles | Gedeeltelijk | Volledige gepubliceerde checklistdetails, antwoorden, resultaat en automatische afwijkingen worden centraal opgeslagen; meettypes en PDF-weergave volgen |
| CDR-06 | Kwaliteitsbevindingen | Gedeeltelijk | Formele NCR/bevinding met ernst, partij, termijn, herstel, bewijsbeschrijving en verificatiestatus werkt; Drive-bewijs is geblokkeerd |
| CDR-07 | HSE, incidenten en near misses | Gedeeltelijk | Formele HSE-registratie met type, ernst, directe maatregel, vertrouwelijkheid en kritieke escalatie werkt; onderzoek/afsluiting volgt |
| CDR-08 | Materieel en machines | Gedeeltelijk | Dagvraag en centraal materieelregister zijn beschikbaar; inzeturen, keuring en stilstandhistorie volgen |
| CDR-09 | Materialen en leveringen | Gedeeltelijk | Dagvraag en centraal leveringsregister zijn beschikbaar; definitieve ontvangstcontrole en Drive-documentkoppeling volgen |
| CDR-10 | Proeven en metingen | Gedeeltelijk | Dagvraag, proefregister en checklistbasis zijn beschikbaar; gespecialiseerde meetwaarden, toleranties en certificaatkoppeling volgen |
| CDR-11 | Wijzigingen en meer-/minderwerk | Gedeeltelijk | Dagvraag en centraal wijzigingsregister werken; bewijs-, prijs-, besluit- en goedkeuringsflow volgt |
| CDR-12 | Vertragingen | Gedeeltelijk | Oorzaak en duur worden conditioneel gevraagd en een centraal vertragingsregister bestaat; gevolg- en claimanalyse ontbreken |
| CDR-13 | Communicatie en besluiten | Gedeeltelijk | Dagvraag plus registers voor communicatie, instructie, overleg en correspondentie werken; geadresseerden/documentreferenties worden verder gespecialiseerd |
| CDR-14 | Openstaande acties | Gedeeltelijk | Acties hebben eigenaar/partij, deadline, status, realtime updates en vervalmeldingen; expliciete dagoverdracht volgt |
| CDR-15 | Risico's en maatregelen | Gedeeltelijk | Start-/eindvragen en een centraal risicoregister werken; kans×impactmatrix en maatregelworkflow volgen |
| CDR-16 | Planning volgende werkdag | Gedeeltelijk | “Wat staat morgen gepland?” is verplicht voor rapportreview; centrale planningkoppeling ontbreekt |
| CDR-17 | Foto-overzicht | Geblokkeerd | Fotoaantal en bestandsmetadata zijn voorzien; upload, locatie en bijschrift wachten op de live Drive-gateway |
| CDR-18 | Bijlagen | Geblokkeerd | Bijlagencontrole en documentenregister zijn aanwezig; daadwerkelijke bytes wachten op het dedicated Drive-account |
| CDR-19 | Controle en ondertekening | Gedeeltelijk | Review/retour, naam/rol, append-only ondertekenverklaring, distributie en revisie werken. Juridisch niveau en vereiste ondertekenrollen moeten CODECO contractueel vaststellen |

## Technische architectuur

| ID | Keuze uit productplan | Status | Afwijking / herstelactie |
| --- | --- | --- | --- |
| TA-01 | React 19.2 + TypeScript strict | Conform | React 19.2.6 en strict TypeScript |
| TA-02 | Vite 8.1 + React Router 8, geen Next.js-applicatielaag | Tijdelijke afwijking | De werkende private Sites-app gebruikt vinext/Vite met één serverroute. Migratie naar de productplanrouter blijft technisch werk en mag de functionele pilot niet destabiliseren |
| TA-03 | MUI + Emotion en MUI X Community | Niet gestart | Thema en componentwrappers moeten de maatwerkprimitieven vervangen |
| TA-04 | TanStack Query 5 | Conform | Centrale workspace- en dagdata gebruiken querycaching en gerichte invalidatie na bevestigde mutaties |
| TA-05 | React Hook Form + Zod 4 | Conform | Projectstart en dagafsluiting gebruiken React Hook Form met Zod 4, schemaresolvers en conditionele validatie |
| TA-06 | Supabase Auth/Postgres/Realtime met RLS | Conform | Hosted Auth/Postgres, 18 versioned migrations, RLS op 38 browserbereikbare tabellen, atomische RPC's, Realtime-invalidering en in-appnotificaties zijn actief; live schema-lint is schoon |
| TA-07 | Google Drive als enige bestandsopslag via Worker-gateway | Geblokkeerd | De aparte Worker-gateway valideert Supabase JWT/RLS, bewaart OAuth server-side en ondersteunt private mappen, resumable upload, download en quota. Deployment wacht op dedicated Google-account en secrets; er is geen alternatieve productopslag toegevoegd |
| TA-08 | Bun workspaces + Turborepo + Biome | Tijdelijke afwijking | Starter gebruikt npm; monorepo- en toolmigratie vóór CI-inrichting |
| TA-09 | Client-side PDF uit immutable snapshot | Conform | Werk-PDF komt uit bevestigde centrale data; iedere formele revisie kan apart worden gedownload en wordt uitsluitend uit haar frozen snapshot opgebouwd, met revisie, frozen tijd en volledige SHA-256 in het document |
| TA-10 | Cloudflare-compatible ESM-output | Conform | Productiebuild en privédeployment geslaagd |

## Open klantbesluiten

Deze onderwerpen blijven bewust **Geblokkeerd** totdat CODECO ze formeel bevestigt:

1. welke gegevens opdrachtgever en aannemer per object mogen zien;
2. definitieve dagrapport-, inspectie-, HSE- en NCR-formulieren;
3. contractuele bewaartermijnen;
4. vereist juridisch niveau van digitale ondertekening;
5. definitieve KPI-formules en eventuele contractuele betekenis;
6. officiële productnaam en aan te leveren logo-/huisstijlbestanden;
7. exacte werkwijze voor aannemersdeclaraties en budgetgoedkeuring.

## Beveiliging en betrouwbaarheid

| ID | Regel | Status | Bewijs / eerstvolgende actie |
| --- | --- | --- | --- |
| SEC-01 | RLS op iedere browserbereikbare tabel, geïndexeerd en per rol getest | Conform | RLS staat op alle 38 browserbereikbare tabellen; policykolommen zijn geïndexeerd en de lokale zichtbaarheidsmatrix dekt alle acht productrollen plus een buitenstaander |
| SEC-02 | Service keys, Vault-secrets en Google-tokens nooit in de React-app | Conform | De browserconfiguratie accepteert uitsluitend de publieke Supabase URL + publishable key. De nieuwe `SUPABASE_SECRET_KEY` wordt alleen door de Cloudflare-serverroute gelezen; bron- en env-tests blokkeren publieke serversecrets |
| SEC-03 | Kritieke mutaties atomisch en idempotent | Gedeeltelijk | Dagrapport, aanwezigheid, registratie, inspectie, checklistpublicatie, bevinding, HSE, review/freeze, ondertekening, distributie, revisie en back-upexport hebben databasebescherming. Dagelijkse achtergrondjobs volgen |
| SEC-04 | Append-only audit en immutable formele versies | Conform | Audit/history-tabellen blokkeren wijziging/verwijdering; report snapshots+SHA, reviews, signatures en distributions hebben integriteitstriggers en formele acties lopen uitsluitend via bewaakte RPC's |
| SEC-05 | Geldige statusovergangen en bevoegde verificatie in de database | Gedeeltelijk | Dagrapport-, actie-, inspectie- en bevindingstransities plus onafhankelijke verificatie zijn database-enforced; gespecialiseerde registers wachten op klantgoedgekeurde matrices |
| SEC-06 | Dependencycontrole zonder open productierisico's | Conform | De kwetsbare geneste PostCSS-versie is veilig naar 8.5.14 geünificeerd; `npm audit --omit=dev` rapporteert nul productiekwetsbaarheden. Build- en regressietests bevestigen compatibiliteit |
| SEC-07 | MFA, veilige headers, rate limits en foutmeldingen zonder gevoelige data | Gedeeltelijk | TOTP-inschrijving/verificatie, 12-teken wachtwoordbeleid, e-mailbevestiging, CSP/HSTS/frame/referrer/permissions-headers en database-backed admin-uitnodigingslimiet zijn actief. Verplichte AAL2 per risicorol volgt na CODECO-beleid |
| SEC-08 | Dagelijkse back-up, checksums en periodieke restoretest | Geblokkeerd | Handmatige JSON-export, SHA-256-verificatie, download en geaudite restore-dry-run werken. Dagelijkse Drive-job, retentie en externe herstelproef vereisen het opslagaccount |
| SEC-09 | Alleen beheerders maken interne accounts en wijzen rollen toe | Conform | Geen `signUp`-actie of registratiescherm; Supabase self-signup staat uit. De uitnodigingsroute verifieert het gebruikers-JWT, eist `members.manage`, bewaart organisatie-/projectmembership en rol via een beveiligde RPC en zet de serversecret nooit in de browser |

## Implementatielog

| Datum | Slice | Regels |
| --- | --- | --- |
| 18-07-2026 | Eerste responsive dagcockpit, snelle registratie, acties en rapportcontrole | PP-01, PP-03, PP-04, WF-04, WF-05, WF-07, MVP-04 |
| 18-07-2026 | CODECO-klantprofiel en formele compliance-administratie | CC-01 t/m CC-09, TA-01 t/m TA-10 |
| 18-07-2026 | CODECO-branding, project→gebouw→projectstart en interactieve aanwezigheid | WF-01, WF-02, WF-03, MVP-02, MVP-05, CC-09 |
| 18-07-2026 | Online-first Supabase-fundering met rollen, projectrechten, RLS, audit, unieke dagrapporten, idempotency en eerlijke demo-opslagstatus | PP-02, PP-07, WF-03, WF-06, MVP-01, MVP-15, MVP-16, TA-06 |
| 18-07-2026 | Modulaire projectstart- en dagvragen volgens de 19 klantonderdelen, met vaste zichtbare automatisatieregels en conditionele validatie | PP-03, PP-05, PP-06, WF-05, WF-07, MVP-03, MVP-06, MVP-09, MVP-11, MVP-12, CDR-01 t/m CDR-19, TA-05 |
| 18-07-2026 | Hosted Supabase live gekoppeld met Auth, centrale onboarding, projectwerkruimte, dagdata, aanwezigheid, registraties en reviewsubmit | PP-02, PP-03, WF-03, WF-06, MVP-01, MVP-04, MVP-05, MVP-15, MVP-16, TA-04, TA-06, SEC-03 |
| 18-07-2026 | Professioneel client-side dagrapportconcept volgens alle 19 klantonderdelen, zonder ongefundeerde democijfers | MVP-03, MVP-13, CDR-01 t/m CDR-19, TA-09 |
| 18-07-2026 | Post-MVP centrale actie-opvolging met nummering, toewijzing, deadline, statusflow, verificatie, immutable historie en selectieve Realtime-updates | WF-08, MVP-08, MVP-10, MVP-15, MVP-16, TA-06, SEC-03 |
| 18-07-2026 | Intern accountbeheer met geblokkeerde self-signup, admin-uitnodiging, wachtwoordinstelling, gegevensgestuurde organisatie-/projectrollen en geharde bootstrap | PP-07, MVP-01, MVP-15, TA-05, TA-06, SEC-02, SEC-09 |
| 18-07-2026 | Operationele werkruimte voor inspecties, automatische afwijkingen, bevindingen/NCR, formele HSE, zestien projectregisters en in-apptermijnmeldingen | PP-05, WF-08, MVP-07 t/m MVP-10, MVP-14, CC-01, CC-04 t/m CC-08 |
| 18-07-2026 | Formele rapportfreeze met SHA-256, review/retour, ondertekenverklaringen, distributiespoor en revisies met behoud van origineel | PP-07, MVP-03, MVP-13, CDR-19, SEC-03 t/m SEC-05 |
| 18-07-2026 | Beheer voor projectregels, locaties, partijen, checklists, TOTP en geverifieerde handmatige JSON-back-up/restore-dry-run | PP-06, MVP-02, MVP-15, MVP-17, MVP-18, SEC-07, SEC-08 |
| 18-07-2026 | Afzonderlijke Google Drive Worker-gateway voor JWT/RLS-controle, private mapstructuur, resumable uploads, downloads en quota; livekoppeling expliciet geblokkeerd op externe credentials | MVP-11, MVP-16, TA-07, SEC-02, SEC-03, SEC-08 |
| 18-07-2026 | Interne accountlevenscyclus met auditreden, atomische organisatie-/projectopschorting, heractivering, definitieve intrekking en bescherming tegen eigen lock-out | MVP-01, SEC-03, SEC-09 |

## Verificatie van deze slice

Alle 18 migrations zijn op 18-07-2026 vanaf een lege lokale Supabase/Postgres-database toegepast en staan gelijk in het gekoppelde hosted project. Lokale en live schema-lint rapporteren geen fouten. Zeven pgTAP-bestanden met samen 229 tests slagen lokaal, inclusief RLS voor alle acht productrollen plus buitenstaander, admin-only provisioning/accountlevenscyclus, inspectie→bevinding, HSE-escalatie, formele rapportintegriteit/PDF-snapshot, atomaire checklistrollback en back-up-dry-run. Tijdens de live audit slaagden de 38 niet-mutating funderingstests; de overige fixtures stopten vóór uitvoering omdat de beheerde productieverbinding directe inserts in `auth.users` terecht weigert. Die beveiliging is niet verruimd en de tijdelijke pgTAP-productie-extensie is daarna weer verwijderd.

Hosted Auth blokkeert self-signup, vereist bevestigde e-mail, minimaal 12 tekens met kleine letter/hoofdletter/cijfer en ondersteunt TOTP. Productiebuild, vier webtests, strict TypeScript, ESLint en de aparte Worker TypeScript-/Wrangler-dry-run slagen. De live schema-lint is schoon. Regels blijven **Gedeeltelijk** of **Geblokkeerd** waar het dedicated CODECO Google-account, automatische dagelijkse Drive-back-up, week-/tweeweekrapport, gespecialiseerde kosten/declaratieflows, juridisch ondertekenniveau, definitieve formulieren/retentie/KPI's of officiële huisstijl nog ontbreken.
