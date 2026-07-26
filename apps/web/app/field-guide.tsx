"use client";

import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CloudSun,
  DatabaseBackup,
  FileCheck2,
  FileText,
  HelpCircle,
  House,
  ListChecks,
  PackageCheck,
  Settings,
  ShieldCheck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";

const guideStorageKey = "codeco-field-guide-seen-v3";

export type FieldGuideDestination = "today" | "photo" | "inspection" | "finding" | "reports";

type FieldGuideProps = {
  canManage: boolean;
  onOpenDestination: (destination: FieldGuideDestination) => void;
};

type GuideTask = {
  id: FieldGuideDestination | "finish";
  icon: LucideIcon;
  title: string;
  summary: string;
  steps: string[];
  action: string;
  destination: FieldGuideDestination;
};

type GuideReferenceSection = {
  icon: LucideIcon;
  title: string;
  summary: string;
  items: Array<{ title: string; copy: string }>;
};

export function FieldGuide({ canManage, onOpenDestination }: FieldGuideProps) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<GuideTask["id"]>("today");

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(guideStorageKey) === "yes";
    } catch {
      // The guide still works when private browsing blocks localStorage.
    }
    if (seen) return;
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const rememberGuide = () => {
    try {
      window.localStorage.setItem(guideStorageKey, "yes");
    } catch {
      // Closing the guide must never depend on browser storage.
    }
  };

  const close = () => {
    rememberGuide();
    setOpen(false);
  };

  const openTask = (destination: FieldGuideDestination) => {
    close();
    onOpenDestination(destination);
  };

  const tasks: GuideTask[] = [
    {
      id: "today",
      icon: CloudSun,
      title: text("Start the workday", "Werkdag starten"),
      summary: text("Project, building and weather are prepared for you.", "Project, gebouw en weer worden voor je klaargezet."),
      steps: [
        text("Choose the project and building you are standing in.", "Kies het project en gebouw waar je staat."),
        text("The current weather loads automatically; only confirm the ready-made answers.", "Het actuele weer laadt automatisch; bevestig alleen de kant-en-klare antwoorden."),
        text("Enter only real numbers such as workers or quantities.", "Vul alleen echte getallen in, zoals arbeiders of hoeveelheden."),
      ],
      action: text("Open overview", "Open overzicht"),
      destination: "today",
    },
    {
      id: "photo",
      icon: Camera,
      title: text("Take a field photo", "Veldfoto maken"),
      summary: text("Point, shoot and continue working.", "Richten, fotograferen en direct verder werken."),
      steps: [
        text("Tap the red Photo button at the bottom of the screen.", "Tik onderaan op de rode knop Foto."),
        text("Take the photo. Project, building, time and the Daily progress folder are linked automatically.", "Maak de foto. Project, gebouw, tijd en de map Dagvoortgang worden automatisch gekoppeld."),
        text("No signal? The photo stays on this device and synchronizes when the connection returns.", "Geen bereik? De foto blijft op dit apparaat en synchroniseert zodra de verbinding terug is."),
      ],
      action: text("Open camera", "Open camera"),
      destination: "photo",
    },
    {
      id: "inspection",
      icon: ClipboardCheck,
      title: text("Complete an inspection", "Inspectie uitvoeren"),
      summary: text("Choose answers; type only when something is different.", "Kies antwoorden; typ alleen wanneer iets afwijkt."),
      steps: [
        text("Open Workspace, choose Inspection and select the matching checklist.", "Open Werkruimte, kies Inspectie en selecteer de juiste checklist."),
        text("Approve a complete section or tap Good, Not good or N/A for each point.", "Keur een hele sectie goed of tik per punt op Goed, Niet goed of N.v.t."),
        text("Add evidence only to the situation that needs attention, then complete the inspection.", "Voeg alleen bewijs toe aan de situatie die aandacht vraagt en rond daarna de inspectie af."),
      ],
      action: text("Open inspections", "Open inspecties"),
      destination: "inspection",
    },
    {
      id: "finding",
      icon: AlertTriangle,
      title: text("Report a problem", "Probleem melden"),
      summary: text("One situation, all evidence and follow-up together.", "Eén situatie met al het bewijs en de opvolging bij elkaar."),
      steps: [
        text("Open Workspace, choose Issue and tap the ready-made type and urgency.", "Open Werkruimte, kies Probleem en tik het kant-en-klare type en de urgentie aan."),
        text("Take as many photos as needed; they remain stacked on this one situation.", "Maak zoveel foto’s als nodig; ze blijven gestapeld bij deze ene situatie."),
        text("Assign the follow-up. The action remains visible until it is verified.", "Wijs de opvolging toe. De actie blijft zichtbaar totdat deze is geverifieerd."),
      ],
      action: text("Open issues", "Open problemen"),
      destination: "finding",
    },
    {
      id: "finish",
      icon: FileCheck2,
      title: text("Finish the day", "Werkdag afronden"),
      summary: text("The app shows what is still missing.", "De app laat zien wat nog ontbreekt."),
      steps: [
        text("Open Overview and check the completion indicator.", "Open Overzicht en controleer de voortgangsindicator."),
        text("Open Actions only when an item still needs an owner or status.", "Open Acties alleen wanneer een punt nog een eigenaar of status nodig heeft."),
        text("Reports are built from the registered work, weather, inspections, issues and photos.", "Rapporten worden opgebouwd uit het geregistreerde werk, weer, inspecties, problemen en foto’s."),
      ],
      action: text("Open reports", "Open rapporten"),
      destination: "reports",
    },
  ];
  const selectedTask = tasks.find((task) => task.id === activeTask) ?? tasks[0];
  const SelectedIcon = selectedTask.icon;
  const navigationItems = [
    { icon: House, label: text("Overview", "Overzicht"), copy: text("Today", "Vandaag") },
    { icon: Wrench, label: text("Workspace", "Werkruimte"), copy: text("Do work", "Werk uitvoeren") },
    { icon: Camera, label: text("Photo", "Foto"), copy: text("Direct camera", "Direct camera"), featured: true },
    { icon: ListChecks, label: text("Actions", "Acties"), copy: text("Follow up", "Opvolgen") },
    { icon: FileText, label: text("Reports", "Rapporten"), copy: text("Create PDF", "Maak PDF") },
  ];
  const referenceSections: GuideReferenceSection[] = [
    {
      icon: House,
      title: text("Project, workday and overview", "Project, werkdag en overzicht"),
      summary: text("Everything you do at the beginning and end of a shift.", "Alles wat je aan het begin en einde van een dienst doet."),
      items: [
        {
          title: text("Project and building", "Project en gebouw"),
          copy: text("Choose a project after signing in; the daily report then covers every building in it. Tap Switch building any time to change which building new photos and records are tagged with, or add a new building.", "Kies een project na het aanmelden; het dagrapport dekt daarna elk gebouw erin. Tik altijd op Gebouw wisselen om te wijzigen aan welk gebouw nieuwe foto's en registraties worden gekoppeld, of om een nieuw gebouw toe te voegen."),
        },
        {
          title: text("Start today", "Werkdag starten"),
          copy: text("The app loads current weather for the project location and prepares working hours and site conditions. Confirm the choices; correct only when the real field situation differs.", "De app laadt het actuele weer voor de projectlocatie en zet werktijden en terreinomstandigheden klaar. Bevestig de keuzes; corrigeer alleen wanneer de echte veldsituatie afwijkt."),
        },
        {
          title: text("Overview", "Overzicht"),
          copy: text("Shows today's progress, weather, headcount, open work and the next required task. A warning means attention is needed; it never silently closes a record.", "Toont de voortgang van vandaag, het weer, de bezetting, open werk en de volgende verplichte taak. Een waarschuwing vraagt aandacht; de app sluit nooit stilzwijgend een registratie."),
        },
        {
          title: text("Attendance and one-tap log", "Aanwezigheid en snel daglog"),
          copy: text("Choose parties, disciplines, shifts and enter only headcounts. The one-tap log reuses project, building, weather and attendance; use dictation or a short optional note only when needed.", "Kies partijen, disciplines en diensten en vul alleen aantallen in. Het snel daglog hergebruikt project, gebouw, weer en aanwezigheid; gebruik alleen dicteren of een korte optionele notitie wanneer nodig."),
        },
        {
          title: text("Daily questions and finish", "Dagvragen en afronden"),
          copy: text("Choose fixed answers for work, progress, logistics, risks and tomorrow. The completion indicator shows missing items, and the report summary is built from confirmed data for final review.", "Kies vaste antwoorden voor werk, voortgang, logistiek, risico’s en morgen. De voortgangsindicator toont ontbrekende onderdelen en de rapportsamenvatting wordt uit bevestigde gegevens opgebouwd voor eindcontrole."),
        },
      ],
    },
    {
      icon: Camera,
      title: text("Photos, folders, offline use and 360°", "Foto’s, mappen, offline gebruik en 360°"),
      summary: text("How evidence is captured, protected, organized and synchronized.", "Hoe bewijs wordt vastgelegd, beveiligd, geordend en gesynchroniseerd."),
      items: [
        {
          title: text("Direct camera", "Directe camera"),
          copy: text("Tap the red Photo button and take the picture. The app first secures a local copy, then links project, building, capture time and the Daily progress folder automatically.", "Tik op de rode knop Foto en maak de foto. De app stelt eerst een lokale kopie veilig en koppelt daarna automatisch project, gebouw, opnametijd en de map Dagvoortgang."),
        },
        {
          title: text("Several photos for one situation", "Meerdere foto’s voor één situatie"),
          copy: text("Inside an issue, inspection or HSE record, tap the evidence camera repeatedly. Up to twelve selected situation and correction photos stay stacked on that same record.", "Tik binnen een probleem, inspectie of HSE-registratie herhaaldelijk op de bewijscamera. Tot twaalf geselecteerde situatie- en herstelfoto’s blijven gestapeld bij dezelfde registratie."),
        },
        {
          title: text("Photo folders", "Fotomappen"),
          copy: text("Open Workspace → Photos & folders to see all evidence. Standard folders are offered automatically; create a custom folder only when the project needs a separate collection.", "Open Werkruimte → Foto’s & mappen om al het bewijs te zien. Standaardmappen worden automatisch aangeboden; maak alleen een eigen map wanneer het project een aparte verzameling nodig heeft."),
        },
        {
          title: text("Offline and synchronization", "Offline en synchronisatie"),
          copy: text("Without signal, photos remain in the device queue. When the connection returns, synchronization starts automatically. A red queue row needs Sync now; deleting an unsynchronized file always asks for confirmation.", "Zonder bereik blijven foto’s in de apparaatwachtrij. Zodra de verbinding terug is start synchronisatie automatisch. Een rode wachtrijregel vraagt Nu synchroniseren; verwijderen van een niet-gesynchroniseerd bestand vraagt altijd bevestiging."),
        },
        {
          title: text("Data saver and storage", "Databesparing en opslag"),
          copy: text("Data saver compresses normal field photos when useful and pauses automatic transfer on a metered connection. Originals that cannot be compressed are kept instead of being rejected.", "Databesparing comprimeert gewone veldfoto’s wanneer nuttig en pauzeert automatische overdracht op een databundel. Originelen die niet kunnen worden gecomprimeerd worden behouden in plaats van geweigerd."),
        },
        {
          title: text("360° images", "360°-beelden"),
          copy: text("Upload only a stitched equirectangular export from a dedicated 360° camera. Confirm the camera source, optionally group images into a named tour and use the viewer to place exact markers.", "Upload alleen een gestitchte equirectangulaire export van een speciale 360°-camera. Bevestig de camerabron, groepeer beelden eventueel in een benoemde rondgang en plaats exacte markeringen in de viewer."),
        },
      ],
    },
    {
      icon: ClipboardCheck,
      title: text("Inspections and checklists", "Inspecties en checklisten"),
      summary: text("Start, answer and complete controlled inspections.", "Gecontroleerde inspecties starten, beantwoorden en afronden."),
      items: [
        {
          title: text("Choose a checklist", "Checklist kiezen"),
          copy: text("Open Workspace → Inspection. Select the published project template; recommended CODECO anchor checklists can be installed by an administrator for before, during and after concrete casting.", "Open Werkruimte → Inspectie. Kies het gepubliceerde projectsjabloon; aanbevolen CODECO-ankerchecklisten kunnen door een beheerder worden geïnstalleerd voor vóór, tijdens en na het betonstorten."),
        },
        {
          title: text("Answer quickly", "Snel beantwoorden"),
          copy: text("Use Approve section when every checkpoint is good, or tap Good, Not good or N/A per checkpoint. Weather-related checkpoints receive a suggestion from today's recorded weather.", "Gebruik Sectie akkoord wanneer elk controlepunt goed is, of tik per controlepunt op Goed, Niet goed of N.v.t. Weergerelateerde punten krijgen een voorstel uit het vastgelegde weer van vandaag."),
        },
        {
          title: text("Notes, numbers and evidence", "Notities, getallen en bewijs"),
          copy: text("Free text remains optional unless a result needs explanation. Numeric checkpoints stay open for the measured value. Add photos to the inspection when visual proof is required.", "Vrije tekst blijft optioneel tenzij een resultaat uitleg nodig heeft. Numerieke controlepunten blijven open voor de gemeten waarde. Voeg foto’s aan de inspectie toe wanneer visueel bewijs nodig is."),
        },
        {
          title: text("Failed checkpoints", "Afgekeurde controlepunten"),
          copy: text("On completion, every failed required point becomes a traceable finding. It receives a number and remains open for correction and verification; the app never auto-approves it.", "Bij afronding wordt elk afgekeurd verplicht punt een traceerbare bevinding. Deze krijgt een nummer en blijft open voor herstel en verificatie; de app keurt deze nooit automatisch goed."),
        },
      ],
    },
    {
      icon: AlertTriangle,
      title: text("Issues, NCR, HSE and actions", "Problemen, NCR, HSE en acties"),
      summary: text("Record a situation once and keep responsibility visible.", "Een situatie één keer vastleggen en verantwoordelijkheid zichtbaar houden."),
      items: [
        {
          title: text("Issue or NCR", "Probleem of NCR"),
          copy: text("Choose the ready-made finding type, quality category, severity, disposition and responsible party. The app assigns the number and rule-based deadline. Add unique wording only when the preset does not describe the situation.", "Kies het kant-en-klare bevindingstype, kwaliteitscategorie, de ernst, afhandeling en verantwoordelijke partij. De app kent het nummer en de regelgestuurde deadline toe. Voeg alleen unieke tekst toe wanneer de keuze de situatie niet beschrijft."),
        },
        {
          title: text("Evidence and correction", "Bewijs en herstel"),
          copy: text("Stack the before and context photos on the same issue. Correction progress and verification remain linked, so the complete audit trail stays together.", "Stapel de voor- en contextfoto’s bij hetzelfde probleem. Herstelvoortgang en verificatie blijven gekoppeld, zodat het volledige controlespoor bij elkaar blijft."),
        },
        {
          title: text("Send to an external party without an account", "Stuur naar een externe partij zonder account"),
          copy: text(
            "Open Workspace → Issues and tap Send to external party on the correct workpoint. Check the breakdown shown in the green panel, then tap Open WhatsApp and send. The recipient opens the restricted link without signing in, sees only that workpoint, project/building, priority, deadline and source photo, and chooses Ready for verification or Report a problem. They may take a correction photo directly. Their response never closes the issue automatically; CODECO must verify it.",
            "Open Werkruimte → Problemen en tik bij het juiste werkpunt op Stuur naar externe partij. Controleer de breakdown in het groene paneel en tik daarna op Open WhatsApp en stuur. De ontvanger opent de beperkte link zonder aanmelding, ziet alleen dat werkpunt met project/gebouw, prioriteit, deadline en bronfoto, en kiest Gereedmelden of Probleem melden. De ontvanger kan direct een correctiefoto maken. De reactie sluit het probleem nooit automatisch; CODECO moet het herstel verifiëren.",
          ),
        },
        {
          title: "HSE",
          copy: text("Choose unsafe condition, unsafe act, near miss, incident, stop work or positive observation, then select severity and the immediate measure. Mark sensitive incidents confidential for authorized HSE roles.", "Kies onveilige situatie, onveilige handeling, near miss, incident, stop work of positieve observatie en selecteer daarna ernst en directe maatregel. Markeer gevoelige incidenten als vertrouwelijk voor bevoegde HSE-rollen."),
        },
        {
          title: text("Actions", "Acties"),
          copy: text("Actions show owner, due date, status and updates across the project. Change the status as work progresses and verify completion; overdue items remain visible and generate reminders.", "Acties tonen eigenaar, deadline, status en updates over het hele project. Wijzig de status tijdens de uitvoering en verifieer de afronding; verlopen punten blijven zichtbaar en genereren herinneringen."),
        },
        {
          title: text("Notifications", "Meldingen"),
          copy: text("The bell contains the auditable reminder inbox. Activate push once per device to receive deadlines outside the open app; browser permission can always be changed in device settings.", "De bel bevat de controleerbare herinneringsinbox. Activeer push één keer per apparaat om deadlines buiten de open app te ontvangen; browsertoestemming kan altijd in de apparaatinstellingen worden gewijzigd."),
        },
      ],
    },
    {
      icon: PackageCheck,
      title: text("Activities, deliveries, tests, delays and field tools", "Activiteiten, leveringen, testen, vertragingen en veldtools"),
      summary: text("The other records used during normal site supervision.", "De overige registraties tijdens normaal bouwtoezicht."),
      items: [
        {
          title: text("Activity", "Activiteit"),
          copy: text("Choose the work type, location and progress state to record what was performed. The entry is linked to the current daily report.", "Kies werksoort, locatie en voortgangsstatus om vast te leggen wat is uitgevoerd. De registratie wordt aan het huidige dagrapport gekoppeld."),
        },
        {
          title: text("Delivery", "Levering"),
          copy: text("Record material receipt, quantity or condition and select accepted, incomplete or rejected. Use the prepared options before adding a unique note.", "Registreer materiaalontvangst, hoeveelheid of staat en kies geaccepteerd, onvolledig of afgekeurd. Gebruik de voorbereide keuzes voordat je een unieke notitie toevoegt."),
        },
        {
          title: text("Test or measurement", "Test of meting"),
          copy: text("Choose the test type and acceptance result; enter the actual measured number and tolerance where required. Out-of-tolerance results need technical follow-up.", "Kies het testtype en acceptatieresultaat; vul waar nodig de werkelijk gemeten waarde en tolerantie in. Resultaten buiten tolerantie vragen technische opvolging."),
        },
        {
          title: text("Delay", "Vertraging"),
          copy: text("Choose weather, late delivery, material shortage, equipment failure or another fixed cause, then record the affected time block. The delay flows into period reports.", "Kies weer, late levering, materiaaltekort, materieelstoring of een andere vaste oorzaak en leg daarna het getroffen tijdblok vast. De vertraging stroomt door naar perioderapporten."),
        },
        {
          title: text("Field tools", "Veldtools"),
          copy: text("Use notes for temporary field facts and Agreements for decisions with an owner and due date. Formal instructions and requests belong in the controlled document register.", "Gebruik notities voor tijdelijke veldfeiten en Afspraken voor besluiten met eigenaar en deadline. Formele instructies en verzoeken horen in het beheerde documentenregister."),
        },
      ],
    },
    {
      icon: FileText,
      title: text("Documents, drawings and exact locations", "Documenten, tekeningen en exacte locaties"),
      summary: text("Keep formal records and drawing context traceable.", "Formele registraties en tekeningcontext traceerbaar houden."),
      items: [
        {
          title: text("Controlled documents", "Beheerde documenten"),
          copy: text("Use the register for RFI, RFA, WIR/inspection request, NCR, technical instruction, change order, engineering record, punch list, agreement and environmental report. The form reveals only the fields required for the selected type.", "Gebruik het register voor RFI, RFA, WIR/inspectieverzoek, NCR, technische instructie, change order, engineering record, punchlist, afspraak en milieurapport. Het formulier toont alleen de velden die voor het gekozen type nodig zijn."),
        },
        {
          title: text("Drawings and revisions", "Tekeningen en revisies"),
          copy: text("Upload a supported PDF, image or DWG source to the approved drawings area. Keep revision and document references in the controlled record so the field team uses the correct basis.", "Upload een ondersteunde PDF, afbeelding of DWG-bron naar de goedgekeurde tekeningen. Bewaar revisie- en documentreferenties in de beheerde registratie zodat het veldteam de juiste basis gebruikt."),
        },
        {
          title: text("Pins and markups", "Pinnen en markeringen"),
          copy: text("Open a drawing and tap the exact location. A pin can link an RFI, document, observation or inspection; clouds, arrows, pen strokes and text preserve the visual explanation.", "Open een tekening en tik op de exacte locatie. Een pin kan een RFI, document, observatie of inspectie koppelen; wolken, pijlen, penstrepen en tekst bewaren de visuele uitleg."),
        },
        {
          title: text("BOQ and progress", "BOQ en voortgang"),
          copy: text("Administrators can import prepared CSV BOQ lines with quantities, value and progress. Review the parsed lines before confirming the import.", "Beheerders kunnen voorbereide CSV-BOQ-regels met hoeveelheden, waarde en voortgang importeren. Controleer de ingelezen regels voordat je de import bevestigt."),
        },
      ],
    },
    {
      icon: FileCheck2,
      title: text("Reports, review and signing", "Rapporten, beoordeling en ondertekening"),
      summary: text("Turn confirmed field data into controlled client output.", "Bevestigde veldgegevens omzetten in beheerste klantoutput."),
      items: [
        {
          title: text("Report periods", "Rapportperioden"),
          copy: text("Choose daily, weekly, monthly or a custom date range. The PDF uses one permission-filtered server snapshot, so workforce, work, quality, HSE, actions, logistics, documents and photos match each other.", "Kies dagelijks, wekelijks, maandelijks of een vrije datumbereik. De PDF gebruikt één rechten-gefilterde servermomentopname, zodat bezetting, werk, kwaliteit, HSE, acties, logistiek, documenten en foto’s bij elkaar passen."),
        },
        {
          title: text("Report presets", "Rapportkeuzes"),
          copy: text("Use Complete project, Management, Execution, Quality & HSE or Contract & decisions to include only the relevant sections without rebuilding the report manually.", "Gebruik Compleet project, Management, Uitvoering, Kwaliteit & HSE of Contract & besluiten om alleen de relevante onderdelen op te nemen zonder het rapport handmatig op te bouwen."),
        },
        {
          title: text("Review and declaration", "Beoordeling en verklaring"),
          copy: text("Review the generated content, use the formal decision flow where available and record the signing declaration with identity, project role and report version. Recorded declarations remain append-only.", "Controleer de gegenereerde inhoud, gebruik waar beschikbaar de formele besluitflow en leg de ondertekenverklaring vast met identiteit, projectrol en rapportversie. Vastgelegde verklaringen blijven onveranderbaar toegevoegd."),
        },
        {
          title: text("Download and sharing", "Download en delen"),
          copy: text("Download the generated client PDF or controlled export. External evidence requests use a restricted share link; outside users do not receive an internal account or access to the rest of the project.", "Download de gegenereerde klant-PDF of beheerde export. Externe bewijsverzoeken gebruiken een beperkte deellink; externe gebruikers krijgen geen intern account of toegang tot de rest van het project."),
        },
      ],
    },
    {
      icon: Settings,
      title: text("Settings, management and project setup", "Instellingen, management en projectinrichting"),
      summary: canManage
        ? text("The controls available to your management role.", "De bediening die beschikbaar is voor jouw managementrol.")
        : text("Why some controls are visible only to administrators.", "Waarom sommige bediening alleen voor beheerders zichtbaar is."),
      items: [
        {
          title: text("Open Management", "Open Management"),
          copy: text("Use the gear in the top-right. Management is kept out of the mobile bottom bar so the five daily field actions remain directly reachable without a crowded menu.", "Gebruik het tandwiel rechtsboven. Management staat buiten de mobiele onderbalk zodat de vijf dagelijkse veldacties direct bereikbaar blijven zonder een druk menu."),
        },
        {
          title: text("Roles and access", "Rollen en toegang"),
          copy: text("Administrators invite internal users, assign organization or project roles and suspend access. Field users see only projects and records permitted by their role; never share one personal account.", "Beheerders nodigen interne gebruikers uit, wijzen organisatie- of projectrollen toe en schorten toegang op. Veldgebruikers zien alleen projecten en registraties die hun rol toestaat; deel nooit één persoonlijk account."),
        },
        {
          title: text("Project rules", "Projectregels"),
          copy: text("Management sets the report prefix, upload limit, reminder lead time, retention decision and push-notification rule. These settings apply centrally to the whole project.", "Management stelt rapportprefix, uploadlimiet, herinneringstijd, bewaartermijnbesluit en pushmeldingsregel in. Deze instellingen gelden centraal voor het hele project."),
        },
        {
          title: text("Project setup", "Projectinrichting"),
          copy: text("Maintain buildings and locations, contractors, consultants and other responsible parties here. Correct setup makes every field choice short and prevents free-text name variations.", "Beheer hier gebouwen en locaties, aannemers, adviseurs en andere verantwoordelijke partijen. Juiste inrichting maakt elke veldkeuze kort en voorkomt afwijkende vrije namen."),
        },
        {
          title: text("Quality standards", "Kwaliteitsstandaarden"),
          copy: text("Install approved library checklists or publish a project-specific template with module, code, name and one checkpoint per line. Only published templates appear to inspectors.", "Installeer goedgekeurde bibliotheekchecklisten of publiceer een projectspecifiek sjabloon met module, code, naam en één controlepunt per regel. Alleen gepubliceerde sjablonen verschijnen bij inspecteurs."),
        },
        {
          title: text("Account security", "Accountbeveiliging"),
          copy: text("Use a personal sign-in, activate MFA from Team & rules and sign out from the user card on shared devices. Private project files are served only through authenticated same-origin routes.", "Gebruik een persoonlijke aanmelding, activeer MFA via Team & regels en meld je op gedeelde apparaten af via de gebruikerskaart. Privéprojectbestanden worden alleen via geauthenticeerde routes binnen dezelfde app geleverd."),
        },
      ],
    },
    {
      icon: DatabaseBackup,
      title: text("Backups, status signals and recovery", "Back-ups, statussignalen en herstel"),
      summary: text("What runs automatically and what to do when a warning appears.", "Wat automatisch draait en wat je bij een waarschuwing moet doen."),
      items: [
        {
          title: text("Storage status", "Opslagstatus"),
          copy: text("The top status shows saved, saving or a connection problem. Saved means central confirmation; offline photo evidence may still be safely waiting in the local queue and is shown in Photos & folders.", "De status bovenaan toont opgeslagen, bezig met opslaan of een verbindingsprobleem. Opgeslagen betekent centrale bevestiging; offline fotobewijs kan daarnaast veilig in de lokale wachtrij staan en wordt getoond bij Foto’s & mappen."),
        },
        {
          title: text("Automatic backup", "Automatische back-up"),
          copy: text("The daily job creates a private backup, reads it back and verifies its SHA-256 checksum. Retention keeps 7 daily, 4 weekly and 3 monthly copies; Management shows the last verified run.", "De dagelijkse taak maakt een privéback-up, leest deze terug en verifieert de SHA-256-checksum. Bewaring houdt 7 dagelijkse, 4 wekelijkse en 3 maandelijkse kopieën; Management toont de laatste geverifieerde uitvoering."),
        },
        {
          title: text("Manual backup and restore test", "Handmatige back-up en hersteltest"),
          copy: text("An administrator can download a verified project backup and run a restore dry run. The dry run validates integrity without overwriting live project data.", "Een beheerder kan een geverifieerde projectback-up downloaden en een herstel-dry-run uitvoeren. De dry-run valideert de integriteit zonder live projectgegevens te overschrijven."),
        },
        {
          title: text("When there is no signal", "Wanneer er geen bereik is"),
          copy: text("Continue taking field photos and keep the app installed or open on the same device. Do not clear browser data or remove a waiting upload. Other form submissions remain open and tell you to retry when online.", "Blijf veldfoto’s maken en houd de app op hetzelfde apparaat geïnstalleerd of geopend. Wis geen browsergegevens en verwijder geen wachtende upload. Andere formulierinzendingen blijven open en melden dat je online opnieuw moet proberen."),
        },
        {
          title: text("When something is red", "Wanneer iets rood is"),
          copy: text("Read the message first. For an upload, open Photos & folders and tap Sync now. For a deadline, open Actions. For blocked push, allow notifications in browser settings. If a retry still fails, keep the local evidence and report the exact message to the administrator.", "Lees eerst de melding. Open voor een upload Foto’s & mappen en tik op Nu synchroniseren. Open voor een deadline Acties. Sta bij geblokkeerde push meldingen toe in de browserinstellingen. Mislukt een nieuwe poging nog steeds, bewaar dan het lokale bewijs en meld de exacte tekst aan de beheerder."),
        },
        {
          title: text("Session or secure-link message", "Sessie- of beveiligde-linkmelding"),
          copy: text(
            "For normal work, the app refreshes an expiring secure session automatically before uploads, backups, push and management actions. If renewal is no longer possible, sign in once again; locally secured photos remain in the queue. An external recipient who sees Link unavailable must ask the CODECO supervisor to create a new link from the workpoint—never send an internal password or account.",
            "Voor normaal werk vernieuwt de app een aflopende beveiligde sessie automatisch vóór uploads, back-ups, push en beheeracties. Is vernieuwing niet meer mogelijk, meld je één keer opnieuw aan; lokaal veiliggestelde foto’s blijven in de wachtrij. Ziet een externe ontvanger Link niet beschikbaar, maak dan vanuit het werkpunt een nieuwe link—stuur nooit een intern wachtwoord of account.",
          ),
        },
      ],
    },
  ];

  return (
    <>
      <button className="field-guide-trigger" type="button" onClick={() => setOpen(true)} aria-label={text("Open built-in guide", "Open ingebouwde gids")}>
        <HelpCircle size={18} />
        <span>{text("Help", "Help")}</span>
      </button>
      {open ? (
        <div className="field-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="field-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="field-guide-title">
            <header>
              <div>
                <span>{text("Built-in field guide", "Ingebouwde veldgids")}</span>
                <h2 id="field-guide-title">{text("What do you want to do?", "Wat wil je nu doen?")}</h2>
                <p>{text("Choose a task. The app shows only the steps you need.", "Kies een taak. De app toont alleen de stappen die je nodig hebt.")}</p>
              </div>
              <button type="button" onClick={close} aria-label={text("Close guide", "Sluit gids")}><X size={20} /></button>
            </header>

            <div className="field-guide-body">
              <nav className="field-guide-task-picker" aria-label={text("Guide topics", "Gidsonderwerpen")}>
                {tasks.map((task) => {
                  const Icon = task.icon;
                  return (
                    <button
                      className={task.id === selectedTask.id ? "active" : ""}
                      type="button"
                      aria-pressed={task.id === selectedTask.id}
                      onClick={() => setActiveTask(task.id)}
                      key={task.id}
                    >
                      <span><Icon size={19} /></span>
                      <strong>{task.title}</strong>
                    </button>
                  );
                })}
              </nav>

              <article className="field-guide-task-detail">
                <header>
                  <span><SelectedIcon size={24} /></span>
                  <div><h3>{selectedTask.title}</h3><p>{selectedTask.summary}</p></div>
                </header>
                <ol>
                  {selectedTask.steps.map((step, index) => (
                    <li key={step}><span>{index + 1}</span><p>{step}</p></li>
                  ))}
                </ol>
                <button className="primary-button" type="button" onClick={() => openTask(selectedTask.destination)}>
                  {selectedTask.action}
                </button>
              </article>
            </div>

            <section className="field-guide-navigation" aria-label={text("Bottom navigation explained", "Uitleg onderste navigatie")}>
              <header><strong>{text("The five buttons at the bottom", "De vijf knoppen onderaan")}</strong><span>{text("You never need to search.", "Je hoeft nooit te zoeken.")}</span></header>
              <div>
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return <span className={item.featured ? "featured" : ""} key={item.label}><Icon size={18} /><strong>{item.label}</strong><small>{item.copy}</small></span>;
                })}
              </div>
            </section>

            <details className="field-guide-reference">
              <summary>
                <span><BookOpen size={19} /><span><strong>{text("All functions from A to Z", "Alle functies van A tot Z")}</strong><small>{text("Open the complete in-app manual", "Open de volledige handleiding in de app")}</small></span></span>
                <ChevronDown size={18} />
              </summary>
              <div className="field-guide-reference-sections">
                {referenceSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <details key={section.title}>
                      <summary>
                        <span><Icon size={18} /><span><strong>{section.title}</strong><small>{section.summary}</small></span></span>
                        <ChevronDown size={17} />
                      </summary>
                      <div className="field-guide-reference-items">
                        {section.items.map((item) => <article key={item.title}><strong>{item.title}</strong><p>{item.copy}</p></article>)}
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>

            <footer>
              <span className="field-guide-automation"><ShieldCheck size={17} /> {text("Automatic: weather, local photo safety, synchronization and daily backup.", "Automatisch: weer, lokale fotobeveiliging, synchronisatie en dagelijkse back-up.")}</span>
              <span className="field-guide-no-typing">{text("Typing is optional except for real numbers and unique document details.", "Typen is optioneel, behalve voor echte getallen en unieke documentgegevens.")}</span>
              <button className="secondary-button" type="button" onClick={close}><CheckCircle2 size={16} /> {text("I understand", "Ik begrijp het")}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
