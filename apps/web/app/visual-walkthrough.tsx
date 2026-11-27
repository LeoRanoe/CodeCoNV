"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, HelpCircle, MapPin, MousePointer2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Words = readonly [string, string];
export type GuideAudience = "supervisor" | "contractor" | "client";
/** Where "Open in app" goes: a main-menu area (or portal section) and, for Workspace forms, one tile. */
export type GuideTarget = { area: string; tile?: string };

type Tour = {
  id: string;
  target: GuideTarget;
  title: Words;
  /** The real menu labels the customer clicks, in order. */
  path: readonly Words[];
  /** Where to start, what to do (one or more steps) and how to recognise success. */
  find: Words;
  actions: readonly Words[];
  success: Words;
  adminOnly?: boolean;
};

const w = (en: string, nl: string): Words => [en, nl];

const supervisorMenu: readonly { id: string; label: Words }[] = [
  { id: "vandaag", label: w("Overview", "Overzicht") },
  { id: "project", label: w("Workspace", "Werkruimte") },
  { id: "acties", label: w("Actions", "Acties") },
  { id: "verify", label: w("Rapid Verify", "Rapid Verify") },
  { id: "projectdocs", label: w("Project Documents", "Project Documents") },
  { id: "records", label: w("Records & Photos", "Records & Photos") },
  { id: "rapporten", label: w("Reports", "Rapporten") },
  { id: "meer", label: w("Management", "Beheer") },
];
const contractorMenu: readonly { id: string; label: Words }[] = [
  { id: "dashboard", label: w("Dashboard", "Dashboard") },
  { id: "assigned", label: w("Assigned to me", "Aan mij toegewezen") },
  { id: "responses", label: w("Responses & submissions", "Reacties & indieningen") },
  { id: "pending", label: w("Pending actions", "Openstaande acties") },
  { id: "history", label: w("History", "Historie") },
  { id: "documents", label: w("Shared documents", "Gedeelde documenten") },
];
const clientMenu: readonly { id: string; label: Words }[] = [
  { id: "dashboard", label: w("Client dashboard", "Dashboard") },
  { id: "progress", label: w("Project progress", "Projectvoortgang") },
  { id: "reports", label: w("Reports & publications", "Rapporten & publicaties") },
  { id: "photos", label: w("Photos & site updates", "Foto's & updates") },
  { id: "documents", label: w("Shared project documents", "Gedeelde projectdocumenten") },
  { id: "review", label: w("Items for client review", "Ter beoordeling") },
  { id: "issues", label: w("Key issues & risks", "Belangrijke issues & risico's") },
  { id: "schedule", label: w("Milestones & schedule", "Mijlpalen & planning") },
  { id: "decisions", label: w("Correspondence & decisions", "Correspondentie & besluiten") },
  { id: "history", label: w("History & notifications", "Historie & meldingen") },
];
const menus: Record<GuideAudience, readonly { id: string; label: Words }[]> = { supervisor: supervisorMenu, contractor: contractorMenu, client: clientMenu };

/** The 15 Workspace forms, with the tile id used by the Workspace and a one-line purpose. */
export const workspaceForms: readonly { tile: string; name: Words; purpose: Words }[] = [
  { tile: "photos", name: w("Photos", "Foto's"), purpose: w("Field photos with purpose, location and markup.", "Veldfoto's met doel, locatie en markeringen.") },
  { tile: "works-ongoing", name: w("Works ongoing", "Lopende werken"), purpose: w("Progress of work in execution, by discipline and activity.", "Voortgang van werk in uitvoering, per discipline en activiteit.") },
  { tile: "works-completed", name: w("Works completed", "Afgeronde werken"), purpose: w("Finished work and its inspection status.", "Afgerond werk en de keuringsstatus.") },
  { tile: "workforce", name: w("Workforce", "Personeel"), purpose: w("Daily headcount by building, attendance and signature.", "Dagtelling per gebouw, aanwezigheid en handtekening.") },
  { tile: "delay-report", name: w("Project Delay Report", "Projectvertraging"), purpose: w("A delay, its cause and its effect on the programme.", "Een vertraging, de oorzaak en het effect op de planning.") },
  { tile: "issues", name: w("Issues", "Issues"), purpose: w("An observation or problem that needs follow-up.", "Een observatie of probleem dat opvolging vraagt.") },
  { tile: "hse", name: w("HSE", "HSE"), purpose: w("A health, safety or environment observation.", "Een observatie over gezondheid, veiligheid of milieu.") },
  { tile: "materials-delivery", name: w("Materials delivery", "Materiaallevering"), purpose: w("A delivery, its condition and its acceptance.", "Een levering, de staat en de acceptatie.") },
  { tile: "inspections", name: w("Inspections", "Inspecties"), purpose: w("A checklist inspection with result and evidence.", "Een checklistinspectie met uitkomst en bewijs.") },
  { tile: "technical-instructions", name: w("Technical instructions", "Technische instructies"), purpose: w("An instruction to a contractor, tied to an exact drawing revision.", "Een instructie aan een aannemer, gekoppeld aan een exacte tekeningrevisie.") },
  { tile: "change-order", name: w("Change order", "Wijzigingsopdracht"), purpose: w("A change in scope, cost or time and its approval.", "Een wijziging in scope, kosten of tijd en de goedkeuring.") },
  { tile: "ncr", name: w("NCR", "NCR"), purpose: w("A non-conformance with cause, correction and verification.", "Een afwijking met oorzaak, herstel en verificatie.") },
  { tile: "lessons-learned", name: w("Lessons Learned", "Geleerde lessen"), purpose: w("A lesson for later phases or projects.", "Een les voor latere fasen of projecten.") },
  { tile: "hse-incident", name: w("HSE incident", "HSE-incident"), purpose: w("An incident or near miss and its investigation.", "Een incident of bijna-ongeval en het onderzoek.") },
  { tile: "agreements-made", name: w("Agreements Made", "Afspraken"), purpose: w("What was agreed, by whom, with any follow-up action.", "Wat is afgesproken, door wie en met welke opvolgactie.") },
];

const tour = (id: string, area: string, tile: string | undefined, title: Words, path: readonly Words[], find: Words, actions: readonly Words[], success: Words, adminOnly = false): Tour => ({ id, target: { area, tile }, title, path, find, actions, success, adminOnly });

const tours: Record<GuideAudience, readonly Tour[]> = {
  supervisor: [
    tour("day", "vandaag", undefined, w("Start your day", "Start je werkdag"), [w("Overview", "Overzicht")],
      w("Open Overview in the menu. Check the project and building in the header.", "Open Overzicht in het menu. Controleer het project en het gebouw bovenaan."),
      [w("Read the counters for open follow-up, quality issues, inspections and pictures, then open a recent record or an item in the priority queue.", "Lees de tellers voor opvolging, kwaliteitsissues, inspecties en foto's en open een recente registratie of een item in de prioriteitenlijst.")],
      w("The opened record shows its own number, project and status.", "De geopende registratie toont het eigen nummer, project en de status.")),
    tour("create", "project", undefined, w("Create a Workspace record", "Maak een werkregistratie"), [w("Workspace", "Werkruimte"), w("form tile", "formuliertegel")],
      w("Open Workspace and choose the tile for the work you are recording. Check the building before entering details.", "Open Werkruimte en kies de tegel voor het werk dat je vastlegt. Controleer het gebouw voordat je gegevens invoert."),
      [w("Fill the required fields (marked *) and attach evidence where it applies.", "Vul de verplichte velden (met *) in en voeg waar nodig bewijs toe."), w("Save a draft where offered, or submit the completed form.", "Bewaar een concept als dat kan of dien het ingevulde formulier in.")],
      w("A green confirmation appears and the record has a number. Find it again in Records & Photos.", "Er verschijnt een groene bevestiging en de registratie heeft een nummer. Vind haar terug in Records & Photos.")),
    tour("journey", "project", undefined, w("From record to archive", "Van registratie tot archief"), [w("Workspace", "Werkruimte"), w("Actions", "Acties"), w("Rapid Verify", "Rapid Verify"), w("Records & Photos", "Records & Photos")],
      w("Start in Workspace: create the record, for example an NCR or a Technical instruction.", "Begin in Werkruimte: maak de registratie, bijvoorbeeld een NCR of een technische instructie."),
      [w("Assign: choose the responsible party (for an NCR the action owner, for a technical instruction the Issued to organisation). The item appears in that party's portal.", "Wijs toe: kies de verantwoordelijke partij (bij een NCR de actiehouder, bij een technische instructie de organisatie bij Uitgegeven aan). Het item verschijnt in het portaal van die partij."),
        w("Response: the contractor acknowledges and responds in the Contractor portal; you review, accept or return it for correction.", "Reactie: de aannemer bevestigt en reageert in het aannemersportaal; jij beoordeelt, accepteert of stuurt terug voor herstel."),
        w("Verify: open Rapid Verify, review the evidence and record the result. Only verification closes an NCR.", "Verifieer: open Rapid Verify, bekijk het bewijs en leg de uitkomst vast. Alleen verificatie sluit een NCR.")],
      w("Open Records & Photos > Record history: every round is listed with who, step and time.", "Open Records & Photos > Registratiehistorie: elke ronde staat er met wie, stap en tijd.")),
    tour("work", "project", "works-ongoing", w("Record work and attendance", "Leg werk en aanwezigheid vast"), [w("Workspace", "Werkruimte"), w("Works ongoing", "Lopende werken"), w("Works completed", "Afgeronde werken"), w("Workforce", "Personeel")],
      w("Open Workspace and choose Works ongoing, Works completed or Workforce.", "Open Werkruimte en kies Lopende werken, Afgeronde werken of Personeel."),
      [w("For work, choose the discipline and then the activity; the questions for that activity appear.", "Kies bij werk de discipline en daarna de activiteit; de vragen bij die activiteit verschijnen."), w("In Workforce add people per party and trade, set shift, attendance and competency, then sign.", "Voeg in Personeel personen toe per partij en vak, kies dienst, aanwezigheid en bevoegdheid en onderteken.")],
      w("The saved record shows in the list; Workforce shows 'signed' with the headcount.", "De opgeslagen registratie staat in de lijst; Personeel toont 'ondertekend' met de bezetting.")),
    tour("issues", "project", "issues", w("Record issues, delays and HSE", "Leg issues, vertraging en HSE vast"), [w("Workspace", "Werkruimte"), w("Issues / NCR / HSE / HSE incident / Project Delay Report", "Issues / NCR / HSE / HSE-incident / Projectvertraging")],
      w("Open Workspace and choose the form that matches an observation, a non-conformance, an incident or a delay.", "Open Werkruimte en kies het formulier voor een observatie, afwijking, incident of vertraging."),
      [w("Choose the type; the category list narrows to that type. Add location, description and evidence.", "Kies het type; de categorielijst past zich aan. Voeg locatie, omschrijving en bewijs toe."), w("Set the action owner and due date where the form asks for them, then save.", "Kies waar gevraagd een actiehouder en deadline en bewaar.")],
      w("The record appears with a number and status Open; its owner sees it in Actions or the portal.", "De registratie verschijnt met een nummer en status Open; de eigenaar ziet haar bij Acties of in het portaal.")),
    tour("decisions", "project", "materials-delivery", w("Register deliveries and decisions", "Registreer leveringen en besluiten"), [w("Workspace", "Werkruimte"), w("Materials delivery / Technical instructions / Change order / Agreements Made / Lessons Learned", "Materiaallevering / Technische instructies / Wijzigingsopdracht / Afspraken / Geleerde lessen")],
      w("Open Workspace and choose the dedicated form.", "Open Werkruimte en kies het juiste formulier."),
      [w("Use the project's supplier, party or document register where offered, and check the dependent categories.", "Gebruik waar beschikbaar het leveranciers-, partijen- of documentenregister en controleer de afhankelijke categorieën."), w("For an instruction or change, pick the exact document revision and follow the sign-off steps.", "Kies bij een instructie of wijziging de exacte documentrevisie en volg de stappen voor ondertekening.")],
      w("The saved record lists what response, signature or action is still due.", "De opgeslagen registratie toont welke reactie, handtekening of actie nog openstaat.")),
    tour("photos", "project", "photos", w("Save and mark up photos", "Bewaar en markeer foto's"), [w("Workspace", "Werkruimte"), w("Photos", "Foto's")],
      w("Open Workspace > Photos, or tap Take photo at the bottom of the menu.", "Open Werkruimte > Foto's of tik onderaan het menu op Foto maken."),
      [w("Take or choose photos, then set the photo purpose in the review. Add a caption or mark the problem on the photo.", "Maak of kies foto's en kies in de beoordeling het fotodoel. Voeg een bijschrift toe of markeer het probleem op de foto."), w("Save the batch. Offline, the photos wait on the device and send when the connection returns.", "Sla de reeks op. Offline wachten de foto's op het apparaat en worden verstuurd zodra er verbinding is.")],
      w("The photos appear in the library with a PHO number; the original is kept next to the marked copy.", "De foto's staan in de bibliotheek met een PHO-nummer; het origineel blijft naast de gemarkeerde kopie bewaard.")),
    tour("actions", "acties", undefined, w("Assign and follow up", "Wijs toe en volg op"), [w("Actions", "Acties")],
      w("Open Actions. Use the cards and filters to find work by owner, status or deadline.", "Open Acties. Gebruik de kaarten en filters om werk te vinden op eigenaar, status of deadline."),
      [w("Open an action, check its source, and assign it to the responsible party. New action creates one by hand.", "Open een actie, controleer de bron en wijs haar toe aan de verantwoordelijke partij. Nieuwe actie maakt er handmatig een."), w("After a response, review the evidence and decide whether it is ready for verification.", "Beoordeel na een reactie het bewijs en bepaal of de actie klaar is voor verificatie.")],
      w("The action shows its owner and status, and the history lists the assignment.", "De actie toont de eigenaar en status en de historie vermeldt de toewijzing.")),
    tour("verify", "verify", undefined, w("Inspect and verify work", "Keur en verifieer werk"), [w("Workspace", "Werkruimte"), w("Inspections", "Inspecties"), w("Rapid Verify", "Rapid Verify")],
      w("Run an inspection from Workspace > Inspections, then open Rapid Verify for items awaiting verification.", "Voer een inspectie uit via Werkruimte > Inspecties en open daarna Rapid Verify voor items die op verificatie wachten."),
      [w("Open the item, review location and evidence, and select the result.", "Open het item, bekijk locatie en bewijs en kies de uitkomst."), w("Pass accepts; Fail rejects and creates the linked corrective action.", "Goed accepteert; Fout wijst af en maakt de gekoppelde herstelactie.")],
      w("Verification history lists the result, verifier, location and comment; the source record shows the new status.", "De verificatiehistorie toont uitkomst, verificateur, locatie en opmerking; de bronregistratie toont de nieuwe status.")),
    tour("documents", "projectdocs", undefined, w("Control a document revision", "Beheer een documentrevisie"), [w("Project Documents", "Project Documents")],
      w("Open Project Documents. Search by number or title and open the document's revision history.", "Open Project Documents. Zoek op nummer of titel en open de revisiehistorie."),
      [w("Upload the next revision against the same document; an authorized reviewer sets its review status.", "Upload de volgende revisie bij hetzelfde document; een bevoegde beoordelaar stelt de status in.")],
      w("The new revision shows as under review while the approved one stays current.", "De nieuwe revisie staat als in beoordeling terwijl de goedgekeurde actueel blijft.")),
    tour("records", "records", undefined, w("Find records and evidence", "Vind registraties en bewijs"), [w("Records & Photos", "Records & Photos")],
      w("Open Records & Photos and choose Submitted forms, Photo library, Attachments or Record history.", "Open Records & Photos en kies Ingediende formulieren, Fotobibliotheek, Bijlagen of Registratiehistorie."),
      [w("Search by record number, then narrow by building or kind.", "Zoek op registratienummer en beperk daarna op gebouw of soort.")],
      w("Opening the entry shows its history and the available evidence.", "Het openen van de registratie toont de historie en het beschikbare bewijs.")),
    tour("reports", "rapporten", undefined, w("Create and export a report", "Maak en exporteer een rapport"), [w("Reports", "Rapporten"), w("Create report", "Rapport maken")],
      w("Open Reports. Choose Daily, Weekly or Monthly, or Create report for a register report.", "Open Rapporten. Kies Dagelijks, Wekelijks of Maandelijks, of Rapport maken voor een registerrapport."),
      [w("Select the period and filters, review the counts, then download Excel, PDF or Word.", "Kies de periode en filters, controleer de aantallen en download Excel, PDF of Word.")],
      w("The download states the period, cut-off, filters and generation time you selected.", "De download vermeldt de periode, peildatum, filters en aanmaaktijd die je koos.")),
    tour("management", "meer", undefined, w("Set up a project", "Richt een project in"), [w("Management", "Beheer"), w("Project setup", "Projectinrichting")],
      w("Open Management (administrators only) and check the active project first.", "Open Beheer (alleen beheerders) en controleer eerst het actieve project."),
      [w("Maintain project information (client, address, dates, currency, status), buildings and locations, project parties, users and access, lists including the project disciplines, sign-off workflows and document settings in their tabs.", "Beheer projectgegevens (opdrachtgever, adres, data, valuta, status), gebouwen en locaties, projectpartijen, gebruikers en toegang, lijsten inclusief de projectdisciplines, goedkeuringsstromen en documentinstellingen in de tabbladen.")],
      w("Reopen the affected form as the intended role and confirm it offers the updated choices.", "Open het formulier opnieuw met de beoogde rol en controleer of het de bijgewerkte keuzes biedt."), true),
  ],
  contractor: [
    tour("assigned", "assigned", undefined, w("Respond to an assignment", "Reageer op een opdracht"), [w("Assigned to me", "Aan mij toegewezen")],
      w("Open Assigned to me and choose the record. Read what is requested and when it is due.", "Open Aan mij toegewezen en kies de registratie. Lees wat gevraagd wordt en wanneer het klaar moet zijn."),
      [w("Choose Acknowledge receipt, or Respond. Add the required evidence before sending.", "Kies Ontvangst bevestigen of Reageren. Voeg het vereiste bewijs toe vóór het verzenden.")],
      w("The item shows Acknowledged or Response submitted, and History lists your response.", "Het item toont Bevestigd of Reactie ingediend en Historie vermeldt je reactie.")),
    tour("responses", "responses", undefined, w("Correct a returned response", "Herstel een teruggestuurde reactie"), [w("Responses & submissions", "Reacties & indieningen")],
      w("Open Responses & submissions and find the returned item. Read the reviewer's comment.", "Open Reacties & indieningen en zoek het teruggestuurde item. Lees de opmerking van de beoordelaar."),
      [w("Update the response, attach the revised evidence and resubmit.", "Werk de reactie bij, voeg aangepast bewijs toe en dien opnieuw in.")],
      w("History keeps both rounds. CODECO verifies completed work; you cannot close it yourself.", "Historie bewaart beide rondes. CODECO verifieert afgerond werk; jij kunt het niet zelf sluiten.")),
    tour("pending", "pending", undefined, w("Work through deadlines", "Volg deadlines op"), [w("Dashboard", "Dashboard"), w("Pending actions", "Openstaande acties")],
      w("Start on the Dashboard: awaiting your response, overdue, returned and due within 7 days.", "Begin op het Dashboard: wacht op jouw reactie, te laat, teruggestuurd en binnen 7 dagen."),
      [w("Open Pending actions, choose the item you are working on and report it complete with evidence.", "Open Openstaande acties, kies het item waaraan je werkt en meld het afgerond met bewijs.")],
      w("The item shows Submitted for verification instead of Closed.", "Het item toont Ter verificatie ingediend in plaats van Gesloten.")),
    tour("documents", "documents", undefined, w("Open a shared document", "Open een gedeeld document"), [w("Shared documents", "Gedeelde documenten")],
      w("Open Shared documents and choose the right project.", "Open Gedeelde documenten en kies het juiste project."),
      [w("Open the document and check its revision before using it.", "Open het document en controleer de revisie voordat je het gebruikt.")],
      w("Only material explicitly shared with your organisation is listed; otherwise the list says nothing has been shared.", "Alleen expliciet met je organisatie gedeeld materiaal staat in de lijst; anders staat er dat niets is gedeeld.")),
  ],
  client: [
    tour("review", "review", undefined, w("Review an assigned item", "Beoordeel een toegewezen item"), [w("Items for client review", "Ter beoordeling")],
      w("Open Items for client review and choose the item. Check which decision was requested.", "Open Ter beoordeling en kies het item. Controleer welk besluit gevraagd wordt."),
      [w("Review the shared evidence and use an action offered to your account (for example Approve or Reject).", "Bekijk het gedeelde bewijs en kies een actie die voor je account beschikbaar is (bijvoorbeeld Goedkeuren of Afwijzen).")],
      w("The decision appears in Correspondence & decisions with your name and time.", "Het besluit verschijnt in Correspondentie & besluiten met je naam en tijd.")),
    tour("progress", "reports", undefined, w("Follow project progress", "Volg de projectvoortgang"), [w("Client dashboard", "Dashboard"), w("Reports & publications", "Rapporten & publicaties")],
      w("Start on the Client dashboard and read the latest published report.", "Begin op het Dashboard en lees het laatst gepubliceerde rapport."),
      [w("Open Reports & publications, Project progress, Photos & site updates or Milestones & schedule for the update you need.", "Open Rapporten & publicaties, Projectvoortgang, Foto's & updates of Mijlpalen & planning voor de update die je nodig hebt.")],
      w("Each published item shows its date, scope and attachments; empty sections say that nothing has been published.", "Elk gepubliceerd item toont datum, reikwijdte en bijlagen; lege onderdelen melden dat er niets is gepubliceerd.")),
    tour("documents", "documents", undefined, w("Find project documents and risks", "Vind projectdocumenten en risico's"), [w("Shared project documents", "Gedeelde projectdocumenten"), w("Key issues & risks", "Belangrijke issues & risico's")],
      w("Open Shared project documents and choose the project.", "Open Gedeelde projectdocumenten en kies het project."),
      [w("Check the released revision, or open Key issues & risks for a shared issue.", "Controleer de vrijgegeven revisie of open Belangrijke issues & risico's voor een gedeeld issue.")],
      w("The list shows the number, title, released revision, status and shared date.", "De lijst toont nummer, titel, vrijgegeven revisie, status en deelddatum.")),
    tour("history", "decisions", undefined, w("Find decisions and notifications", "Vind besluiten en meldingen"), [w("Correspondence & decisions", "Correspondentie & besluiten"), w("History & notifications", "Historie & meldingen")],
      w("Open Correspondence & decisions and read the decision log.", "Open Correspondentie & besluiten en lees het besluitenlogboek."),
      [w("Open History & notifications to review events and new requests, then open the linked item.", "Open Historie & meldingen om gebeurtenissen en nieuwe verzoeken te bekijken en open daarna het gekoppelde item.")],
      w("The linked item shows its current status.", "Het gekoppelde item toont de actuele status.")),
  ],
};

const FORMS_TOUR = "forms";

export function guideTourCount(audience: GuideAudience, canManage: boolean) {
  return tours[audience].filter((item) => !item.adminOnly || canManage).length + (audience === "supervisor" ? 1 : 0);
}

export function VisualWalkthrough({ audience, canManage, onNavigate, onSkip }: { audience: GuideAudience; canManage: boolean; onNavigate: (target: GuideTarget) => void; onSkip?: () => void }) {
  const { text } = useLanguage();
  const available = useMemo(() => tours[audience].filter((item) => !item.adminOnly || canManage), [audience, canManage]);
  const ids = useMemo(() => [...available.map((item) => item.id), ...(audience === "supervisor" ? [FORMS_TOUR] : [])], [available, audience]);
  const [topicId, setTopicId] = useState(ids[0]);
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => { if (moved.current) heading.current?.focus(); }, [topicId, step]);
  const current = ids.includes(topicId) ? topicId : ids[0];
  const isForms = current === FORMS_TOUR;
  const selected = available.find((item) => item.id === current);
  const menu = menus[audience];
  const stageWords = (index: number, total: number) => index === 0 ? text("Find it", "Vind het") : index === total - 1 ? text("Check the result", "Controleer de uitkomst") : text("Do it", "Voer het uit");

  const labelOf = (item: Words) => text(item[0], item[1]);
  const titleFor = (id: string) => id === FORMS_TOUR ? text("The 15 Workspace forms", "De 15 formulieren in de Werkruimte") : labelOf(available.find((item) => item.id === id)!.title);

  const picker = (
    <label className="form-field walk-picker">
      <span>{text("Choose a task", "Kies een taak")}</span>
      <select value={current} onChange={(event) => { moved.current = false; setTopicId(event.target.value); setStep(0); }}>
        {ids.map((id) => <option key={id} value={id}>{titleFor(id)}</option>)}
      </select>
    </label>
  );

  if (isForms) {
    return (
      <div className="walk">
        {picker}
        <section className="walk-step" aria-labelledby="walk-forms-title">
          <h3 id="walk-forms-title" ref={heading} tabIndex={-1}>{titleFor(FORMS_TOUR)}</h3>
          <p>{text("Open Workspace and choose a tile. Each button below opens the real form; nothing is saved until you submit it yourself.", "Open Werkruimte en kies een tegel. Elke knop hieronder opent het echte formulier; er wordt niets bewaard totdat je zelf indient.")}</p>
          <ul className="walk-forms">
            {workspaceForms.map((form) => (
              <li key={form.tile}>
                <button type="button" className="walk-form-button" data-guide-form={form.tile} onClick={() => onNavigate({ area: "project", tile: form.tile })}>
                  <strong>{labelOf(form.name)}</strong>
                  <small>{labelOf(form.purpose)}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {onSkip ? <div className="walk-controls"><button type="button" className="ui-button ui-button--quiet ui-button--md" onClick={onSkip}>{text("Skip the tour", "Sla de rondleiding over")}</button></div> : null}
      </div>
    );
  }

  const item = selected ?? available[0];
  const steps: { stage: string; body: string }[] = [
    { stage: stageWords(0, item.actions.length + 2), body: labelOf(item.find) },
    ...item.actions.map((action, index) => ({ stage: stageWords(index + 1, item.actions.length + 2), body: labelOf(action) })),
    { stage: stageWords(item.actions.length + 1, item.actions.length + 2), body: labelOf(item.success) },
  ];
  const last = steps.length - 1;
  const index = Math.min(step, last);
  const Icon = index === 0 ? MapPin : index === last ? CheckCircle2 : MousePointer2;
  const targetLabel = menu.find((entry) => entry.id === item.target.area)?.label;
  const formName = item.target.tile ? workspaceForms.find((form) => form.tile === item.target.tile)?.name : undefined;
  const go = (delta: number) => { moved.current = true; setStep(Math.max(0, Math.min(last, index + delta))); };

  return (
    <div className="walk">
      {picker}
      <section className="walk-step" aria-labelledby="walk-title">
        <h3 id="walk-title" ref={heading} tabIndex={-1}>{labelOf(item.title)}</h3>
        <div className="walk-map" aria-hidden="true">
          {menu.map((entry) => <span key={entry.id} className={entry.id === item.target.area ? "is-target" : undefined}>{labelOf(entry.label)}</span>)}
        </div>
        <p className="walk-path">
          <MapPin size={16} aria-hidden="true" />
          <span className="sr-only">{text("Start here: ", "Begin hier: ")}{targetLabel ? labelOf(targetLabel) : ""}. </span>
          {item.path.map((part, partIndex) => <span key={labelOf(part)} className="walk-path-part">{partIndex > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}{labelOf(part)}</span>)}
        </p>
        <ol className="walk-stages" aria-label={text("Steps", "Stappen")}>
          {steps.map((entry, entryIndex) => <li key={entryIndex} aria-current={entryIndex === index ? "step" : undefined} className={entryIndex < index ? "is-done" : undefined}><span>{entryIndex + 1}</span>{entry.stage}</li>)}
        </ol>
        <div className="walk-instruction" aria-live="polite"><Icon size={22} aria-hidden="true" /><p>{steps[index].body}</p></div>
        {formName ? <p className="walk-note">{text(`Opens the ${labelOf(formName)} form. Nothing is saved or sent by opening it.`, `Opent het formulier ${labelOf(formName)}. Door te openen wordt niets bewaard of verstuurd.`)}</p> : null}
      </section>
      <div className="walk-controls">
        <button type="button" className="ui-button ui-button--secondary ui-button--md" disabled={index === 0} onClick={() => go(-1)}><ArrowLeft size={16} aria-hidden="true" />{text("Previous", "Vorige")}</button>
        {index < last
          ? <button type="button" className="ui-button ui-button--secondary ui-button--md" onClick={() => go(1)}>{text("Next step", "Volgende stap")}<ArrowRight size={16} aria-hidden="true" /></button>
          : null}
        <button type="button" className="ui-button ui-button--primary ui-button--md" data-guide-open={item.id} onClick={() => onNavigate(item.target)}>{text("Open in app", "Open in app")}<ArrowRight size={16} aria-hidden="true" /></button>
        {onSkip ? <button type="button" className="ui-button ui-button--quiet ui-button--md" onClick={onSkip}>{text("Skip the tour", "Sla de rondleiding over")}</button> : null}
      </div>
    </div>
  );
}

/** Help button and tour dialog for the contractor and client portals. */
export function PortalGuide({ audience, onNavigate }: { audience: Exclude<GuideAudience, "supervisor">; onNavigate: (target: GuideTarget) => void }) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const key = `codeco-portal-guide-seen-v1-${audience}`;
  const remember = () => { try { window.localStorage.setItem(key, "yes"); } catch { /* storage is optional */ } };
  const close = () => { remember(); setOpen(false); };
  useEffect(() => {
    let seen = false;
    try { seen = window.localStorage.getItem(key) === "yes"; } catch { /* storage is optional */ }
    if (seen) return;
    const timer = window.setTimeout(() => { triggerRef.current?.focus(); setOpen(true); }, 700);
    return () => window.clearTimeout(timer);
  }, [key]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { remember(); setOpen(false); } };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const go = (target: GuideTarget) => { close(); onNavigate(target); };
  return (
    <>
      <button ref={triggerRef} className="field-guide-trigger field-guide-trigger--inline" type="button" onClick={() => setOpen(true)} aria-label={text("Help: open built-in guide", "Help: open ingebouwde gids")}>
        <HelpCircle size={16} aria-hidden="true" />
        <span>{text("Help", "Help")}</span>
      </button>
      {open ? createPortal(
        <div className="field-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="field-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="portal-guide-title">
            <header>
              <div><h2 id="portal-guide-title">{text("What do you want to do?", "Wat wil je nu doen?")}</h2></div>
              <button type="button" onClick={close} aria-label={text("Close guide", "Sluit gids")}><X size={20} /></button>
            </header>
            <VisualWalkthrough audience={audience} canManage={false} onNavigate={go} onSkip={close} />
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
