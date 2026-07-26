"use client";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Camera,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  CloudSun,
  Copy,
  DatabaseBackup,
  Download,
  FileCheck2,
  FileText,
  HardDrive,
  KeyRound,
  Link2,
  Loader2,
  MessageCircle,
  PackageCheck,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Users,
  Upload,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import NextImage from "next/image";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { VisualEvidenceWorkspace } from "@/app/visual-evidence-workspace";
import { DrawingWorkspace } from "@/app/drawing-workspace";
import { FieldTools } from "@/app/field-tools";
import { MediaLibraryWorkspace } from "@/app/media-library-workspace";
import { anchorChecklistCodes } from "@/lib/checklists/anchor-library";
import { downloadBoqCsvTemplate, parseBoqCsv, type BoqImportItem } from "@/lib/boq/csv";
import {
  createControlledDocumentDetails,
  emptyControlledDocumentDraft,
  isControlledDocumentType,
  issueCatalogPresets,
  type ControlledDocumentDraft,
} from "@/lib/forms/controlled-project-documents";
import { externalShareUrl } from "@/lib/external-share/token.mjs";
import type { ProjectStartAnswers } from "@/lib/forms/daily-report";
import { useLanguage } from "@/lib/i18n";
import { cacheProjectSnapshot, getCachedProjectSnapshot } from "@/lib/offline/project-cache";
import { compressFieldPhoto, dataSaverEnabled, queueOfflineUpload, syncOfflineUploads } from "@/lib/offline/upload-queue";
import { requestProjectNotificationDispatch } from "@/lib/notifications/client";
import type { FormalReportSnapshot } from "@/lib/reports/daily-report-pdf";
import type { PeriodReportSection } from "@/lib/reports/period-report-pdf";
import type { ProjectParty } from "@/lib/supabase/data";
import { isStorageGatewayConfigured } from "@/lib/storage/gateway";
import {
  buildPeriodReportSnapshot,
  createChecklist,
  createFinding,
  createHseEvent,
  createLocationNode,
  createProjectParty,
  createRegisterEntry,
  createExternalShareLink,
  downloadManualBackup,
  finishInspection,
  importProjectBoq,
  installChecklistLibraryTemplate,
  loadProjectOperations,
  recordDistribution,
  recordFindingProgress,
  respondToControlledDocument,
  reviewReport,
  saveProjectSettings,
  signReport,
  startInspection,
  startRevision,
  transitionFinding,
  updateProductionReadiness,
  validateBackupDryRun,
  type Finding,
  type ChecklistItem,
  type Inspection,
  type OperationSnapshot,
  type ProductionReadinessItem,
} from "@/lib/supabase/operations";

type WorkspaceMode = "project" | "reports" | "admin";
type ProjectTab = "home" | "inspections" | "findings" | "hse" | "registers" | "visual" | "drawings" | "tools" | "files";

const findingStatusLabels: Record<string, string> = {
  draft: "Concept",
  open: "Open",
  assigned: "Toegewezen",
  in_progress: "In uitvoering",
  ready_for_verification: "Gereed voor verificatie",
  closed: "Gesloten",
  rejected: "Afgewezen",
  reopened: "Heropend",
  cancelled: "Geannuleerd",
};

const findingStatusLabelsEnglish: Record<string, string> = {
  draft: "Draft", open: "Open", assigned: "Assigned", in_progress: "In progress",
  ready_for_verification: "Ready for verification", closed: "Closed", rejected: "Rejected",
  reopened: "Reopened", cancelled: "Cancelled",
};

const reportStatusLabels: Record<string, string> = {
  draft: "Concept",
  in_progress: "In uitvoering",
  ready_for_review: "Gereed voor review",
  in_review: "In review",
  approved: "Goedgekeurd",
  signed: "Ondertekend",
  sent: "Verzonden",
  revised: "Revisie",
  returned: "Teruggestuurd",
  cancelled: "Geannuleerd",
};

const reportStatusLabelsEnglish: Record<string, string> = {
  draft: "Draft", in_progress: "In progress", ready_for_review: "Ready for review",
  in_review: "In review", approved: "Approved", signed: "Signed", sent: "Sent",
  revised: "Revision", returned: "Returned", cancelled: "Cancelled",
};

const registerLabels: Record<string, string> = {
  equipment: "Materieel",
  delivery: "Levering",
  test: "Test / meting",
  variation: "Meer-/minderwerk",
  delay: "Vertraging",
  communication: "Communicatie / besluit",
  risk: "Risico",
  document: "Document",
  drawing: "Tekening",
  rfi: "RFI",
  submittal: "Submittal",
  site_instruction: "Site instruction",
  meeting: "Vergadering",
  correspondence: "Correspondentie",
  cost: "Kostenbewaking",
  declaration: "Aannemersdeclaratie",
  rfa: "RFA - Request for Approval",
  inspection_request: "IR - Inspectieverzoek",
  boq: "BOQ / voortgang",
  punch_list: "Punch list",
  notepad: "Notitieblok",
  agreement: "Afspraak",
  technical_instruction: "Technische instructie (TI)",
  change_order: "Change order (CO)",
  contract: "Contract",
  specification: "Technische specificatie",
  environmental_report: "Milieurapport (ER)",
};

const registerLabelsEnglish: Record<string, string> = {
  equipment: "Equipment", delivery: "Delivery", test: "Test / measurement", variation: "Variation",
  delay: "Delay", communication: "Communication / decision", risk: "Risk", document: "Document",
  drawing: "Drawing", rfi: "RFI", submittal: "Submittal", site_instruction: "Site instruction",
  meeting: "Meeting", correspondence: "Correspondence", cost: "Cost control", declaration: "Contractor payment claim",
  rfa: "RFA - Request for Approval", inspection_request: "IR - Inspection request", boq: "BOQ / progress",
  punch_list: "Punch list", notepad: "Notepad", agreement: "Agreement", technical_instruction: "Technical instruction (TI)",
  change_order: "Change order (CO)", contract: "Contract", specification: "Technical specification",
  environmental_report: "Environmental report (ER)",
};

function formatDate(value: string | null, locale = "en-GB") {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Paramaribo",
  }).format(new Date(value));
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "The operation was not completed.";
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Kopiëren wordt niet ondersteund door deze browser.");
}

type InspectionAnswer = {
  result: string;
  notes: string;
  numericValue?: number;
  textValue?: string;
};

function checklistItemAnswered(item: ChecklistItem, answer?: InspectionAnswer) {
  if (!answer?.result) return false;
  if (item.response_type === "number") return answer.result === "value" && Number.isFinite(answer.numericValue);
  if (item.response_type === "text") return answer.result === "text" && Boolean(answer.textValue?.trim());
  return true;
}

function checklistGuidance(item: ChecklistItem) {
  if (item.guidance?.startsWith("AUTO_WEATHER|")) return item.guidance.split("|").slice(1).join("|");
  return item.guidance;
}

function isAutomaticWeatherItem(item: ChecklistItem) {
  return item.guidance?.startsWith("AUTO_WEATHER|")
    || /ambient weather conditions are suitable/i.test(item.prompt);
}

export function OperationalWorkspace({
  mode,
  client,
  organizationId,
  projectId,
  projectName,
  projectCode,
  buildingId,
  buildingName,
  reportId,
  reportNumber,
  reportStatus,
  projectStartAnswers,
  currentUserName,
  parties,
  canManageOrganization,
  openUserAdmin,
  initialProjectTab = "home",
  initialCameraFiles = [],
  onInitialCameraFilesConsumed,
  openQuickCamera,
  openProjectArea,
}: {
  mode: WorkspaceMode;
  client: SupabaseClient;
  organizationId: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  buildingId: string;
  buildingName: string;
  reportId: string | null;
  reportNumber: string;
  reportStatus: string;
  projectStartAnswers: ProjectStartAnswers | null;
  currentUserName: string;
  parties: ProjectParty[];
  canManageOrganization: boolean;
  openUserAdmin: () => void;
  initialProjectTab?: ProjectTab;
  initialCameraFiles?: File[];
  onInitialCameraFilesConsumed?: () => void;
  openQuickCamera: () => void;
  openProjectArea: (tab: "inspections" | "findings" | "visual" | "files") => void;
}) {
  const { text } = useLanguage();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["project-operations", projectId, reportId],
    queryFn: async () => {
      try {
        const snapshot = await loadProjectOperations(client, projectId, organizationId, reportId);
        await cacheProjectSnapshot(projectId, reportId, snapshot).catch(() => undefined);
        return snapshot;
      } catch (error) {
        const cached = await getCachedProjectSnapshot(projectId, reportId).catch(() => null);
        if (cached) return cached;
        throw error;
      }
    },
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-operations", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["project-day", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    ]);
  };

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      await requestProjectNotificationDispatch(client, projectId).catch(() => false);
      setNotice(success);
      await refresh();
      return true;
    } catch (caught) {
      setError(messageFrom(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (query.isLoading) {
    return <div className="operation-loading"><Loader2 className="spin" size={22} /> {text("Loading project records…", "Projectregisters laden…")}</div>;
  }
  if (query.error || !query.data) {
    return <div className="operation-alert error"><AlertTriangle size={18} /> {messageFrom(query.error)}</div>;
  }

  return (
    <>
      {query.data._offlineCached ? <div className="operation-alert warning"><HardDrive size={17} /><div><strong>{text("Offline project copy", "Offline projectkopie")}</strong><span>{text("You can inspect the last synchronized data and queue photos or drawings. Formal changes synchronize only when the connection returns.", "Je kunt de laatst gesynchroniseerde gegevens bekijken en foto’s of tekeningen klaarzetten. Formele wijzigingen synchroniseren pas zodra de verbinding terug is.")} {query.data._offlineSavedAt ? `${text("Saved", "Opgeslagen")} ${formatDate(query.data._offlineSavedAt)}.` : ""}</span></div></div> : null}
      {error ? <div className="operation-alert error"><AlertTriangle size={17} /> {error}</div> : null}
      {notice ? <div className="operation-alert success"><CheckCircle2 size={17} /> {notice}</div> : null}
      {mode === "project" ? (
        <ProjectOperations
          key={`${projectId}:${initialProjectTab}`}
          data={query.data}
          organizationId={organizationId}
          reportId={reportId}
          projectId={projectId}
          projectName={projectName}
          projectCode={projectCode}
          buildingId={buildingId}
          buildingName={buildingName}
          projectStartAnswers={projectStartAnswers}
          currentUserName={currentUserName}
          parties={parties}
          client={client}
          busy={busy}
          run={run}
          initialTab={initialProjectTab}
          initialCameraFiles={initialCameraFiles}
          onInitialCameraFilesConsumed={onInitialCameraFilesConsumed}
          openQuickCamera={openQuickCamera}
        />
      ) : null}
      {mode === "reports" ? (
        <ReportOperations
          data={query.data}
          reportId={reportId}
          reportNumber={reportNumber}
          reportStatus={reportStatus}
          currentUserName={currentUserName}
          projectId={projectId}
          projectName={projectName}
          busy={busy}
          run={run}
          client={client}
        />
      ) : null}
      {mode === "admin" ? (
        <AdminOperations
          data={query.data}
          client={client}
          organizationId={organizationId}
          projectId={projectId}
          projectName={projectName}
          reportStatus={reportStatus}
          buildingId={buildingId}
          buildingName={buildingName}
          parties={parties}
          canManageOrganization={canManageOrganization}
          openUserAdmin={openUserAdmin}
          openProjectArea={openProjectArea}
          busy={busy}
          run={run}
        />
      ) : null}
    </>
  );
}

function ProjectOperations({
  data,
  organizationId,
  reportId,
  projectId,
  projectName,
  projectCode,
  buildingId,
  buildingName,
  projectStartAnswers,
  currentUserName,
  parties,
  client,
  busy,
  run,
  initialTab,
  initialCameraFiles,
  onInitialCameraFilesConsumed,
  openQuickCamera,
}: {
  data: OperationSnapshot;
  organizationId: string;
  reportId: string | null;
  projectId: string;
  projectName: string;
  projectCode: string;
  buildingId: string;
  buildingName: string;
  projectStartAnswers: ProjectStartAnswers | null;
  currentUserName: string;
  parties: ProjectParty[];
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  initialTab: ProjectTab;
  initialCameraFiles: File[];
  onInitialCameraFilesConsumed?: () => void;
  openQuickCamera: () => void;
}) {
  const { language, locale, text } = useLanguage();
  const registerNames = language === "en" ? registerLabelsEnglish : registerLabels;
  const [tab, setTab] = useState<ProjectTab>(initialTab);
  const [showForm, setShowForm] = useState(false);
  const [activeInspection, setActiveInspection] = useState<Inspection | null>(null);
  const [inspectionTitle, setInspectionTitle] = useState("");
  const [inspectionTemplateId, setInspectionTemplateId] = useState("");
  const [inspectionAnswers, setInspectionAnswers] = useState<Record<string, InspectionAnswer>>({});
  const [inspectionPhotos, setInspectionPhotos] = useState<File[]>([]);
  const [inspectionPhotoError, setInspectionPhotoError] = useState("");
  const [findingForm, setFindingForm] = useState({
    type: "deficiency",
    title: "",
    description: "",
    severity: "medium",
    responsiblePartyId: "",
    issueType: "quality",
    impactSummary: "",
    actionSteps: "",
    escalationRequired: false,
    disposition: "to_be_corrected" as "validated" | "to_be_corrected" | "alternative_solution",
    expectedResolutionDate: "",
    sourceCatalogSubject: "",
  });
  const [findingPhotos, setFindingPhotos] = useState<File[]>([]);
  const [findingPhotoError, setFindingPhotoError] = useState("");
  const [hseForm, setHseForm] = useState({ type: "unsafe_condition", title: "", description: "", severity: "medium", immediateMeasure: "", confidential: false });
  const [hsePhotos, setHsePhotos] = useState<File[]>([]);
  const [hsePhotoError, setHsePhotoError] = useState("");
  const [registerForm, setRegisterForm] = useState<ControlledDocumentDraft>({ ...emptyControlledDocumentDraft });
  const [boqFile, setBoqFile] = useState<File | null>(null);
  const [boqItems, setBoqItems] = useState<BoqImportItem[]>([]);
  const [boqError, setBoqError] = useState("");
  const inspectionTemplates = data.templates
    .filter((template) => template.module === "inspection" && template.status === "published")
    .sort((left, right) => {
      const plannedWork = projectStartAnswers?.plannedWork.toLowerCase() ?? "";
      const relevant = (template: typeof left) => {
        const anchorTemplate = ["LIB-101", "LIB-102", "LIB-103"].includes(template.code);
        return anchorTemplate && /(anchor|anker|concrete|beton|stort)/i.test(plannedWork);
      };
      return Number(relevant(right)) - Number(relevant(left)) || left.name.localeCompare(right.name);
    });
  const activeTemplate = data.templates.find((template) => template.id === activeInspection?.template_id);
  const anchorWorkPlanned = /(anchor|anker|concrete|beton|stort)/i.test(projectStartAnswers?.plannedWork ?? "");
  const missingAnchorChecklistCodes = anchorChecklistCodes.filter((code) => !data.templates.some(
    (template) => template.project_id === projectId && template.code === code && template.status === "published",
  ));
  const checklistSections = activeTemplate
    ? [...new Set(activeTemplate.items.map((item) => item.section))].map((section) => ({
        section,
        items: activeTemplate.items.filter((item) => item.section === section),
      }))
    : [];
  const answeredChecklistItems = activeTemplate
    ? activeTemplate.items.filter((item) => checklistItemAnswered(item, inspectionAnswers[item.id])).length
    : 0;
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const findingPresets = [
    { title: text("Crack or damage", "Scheur of beschadiging"), description: text("Visible crack or damage requires repair and verification.", "Zichtbare scheur of beschadiging moet worden hersteld en gecontroleerd.") },
    { title: text("Work incomplete", "Werk niet volledig"), description: text("The planned work is not fully completed.", "Het geplande werk is niet volledig uitgevoerd.") },
    { title: text("Incorrect dimensions", "Verkeerde maatvoering"), description: text("The executed dimensions do not match the approved drawing.", "De uitgevoerde maatvoering komt niet overeen met de goedgekeurde tekening.") },
    { title: text("Safety risk", "Veiligheidsrisico"), description: text("An unsafe condition requires immediate attention.", "Een onveilige situatie vraagt directe opvolging.") },
    { title: text("Finish or cleaning", "Afwerking of schoonmaak"), description: text("The finish or work area does not meet the required condition.", "De afwerking of werkzone voldoet niet aan de vereiste staat.") },
  ];
  const findingImpactPresets = [
    text("No schedule impact identified.", "Geen planningimpact vastgesteld."),
    text("Possible schedule impact; monitor in the next update.", "Mogelijke planningimpact; volgen in de volgende update."),
    text("Scope or work area is affected.", "Scope of werkzone is beïnvloed."),
  ];
  const findingActionPresets = [
    text("Correct the issue and submit photo evidence.", "Herstel het probleem en lever fotobewijs."),
    text("Inspect the correction and verify compliance.", "Inspecteer het herstel en verifieer dat het voldoet."),
    text("Stop the affected work pending an approved correction.", "Stop het betrokken werk tot een goedgekeurde correctie."),
  ];
  const hsePresets = [
    { type: "positive_observation", severity: "low", title: text("Safe work observed", "Veilig werk waargenomen"), description: text("The work was performed safely and according to the agreed control measures.", "Het werk is veilig en volgens de afgesproken beheersmaatregelen uitgevoerd."), immediateMeasure: text("Positive feedback was given to the team.", "Positieve feedback is aan het team gegeven.") },
    { type: "unsafe_condition", severity: "high", title: text("Unsafe work area", "Onveilige werkzone"), description: text("The work area was not sufficiently secured or marked.", "De werkzone was onvoldoende afgezet of gemarkeerd."), immediateMeasure: text("Work was paused and the area was secured.", "Werk is gepauzeerd en de zone is beveiligd.") },
    { type: "unsafe_act", severity: "high", title: text("PPE not used correctly", "PBM niet correct gebruikt"), description: text("Required personal protective equipment was not used correctly.", "Verplichte persoonlijke beschermingsmiddelen werden niet correct gebruikt."), immediateMeasure: text("The worker was instructed and PPE use was corrected.", "De medewerker is geïnstrueerd en het PBM-gebruik is gecorrigeerd.") },
    { type: "near_miss", severity: "high", title: "Near miss", description: text("An event occurred without injury but with a realistic risk of harm.", "Er vond een gebeurtenis plaats zonder letsel, maar met reëel risico op schade."), immediateMeasure: text("The activity was stopped, the area secured and the supervisor informed.", "De activiteit is gestopt, de zone beveiligd en de supervisor geïnformeerd.") },
    { type: "stop_work", severity: "critical", title: "Stop work", description: text("Work was stopped because the risk was not adequately controlled.", "Werk is stilgelegd omdat het risico onvoldoende werd beheerst."), immediateMeasure: text("Access was restricted pending approval of corrective measures.", "Toegang is beperkt in afwachting van goedgekeurde herstelmaatregelen.") },
  ];
  const registerPresets: Record<string, Array<Partial<ControlledDocumentDraft> & { title: string; details: string }>> = {
    delivery: [
      { title: text("Delivery received and checked", "Levering ontvangen en gecontroleerd"), details: text("Quantity, condition and delivery documents were checked.", "Hoeveelheid, staat en leveringsdocumenten zijn gecontroleerd.") },
      { title: text("Delivery incomplete or damaged", "Levering onvolledig of beschadigd"), details: text("A discrepancy was found during receipt and requires supplier follow-up.", "Bij ontvangst is een afwijking vastgesteld die opvolging door de leverancier vraagt.") },
    ],
    equipment: [
      { title: text("Equipment operational", "Materieel operationeel"), details: text("Equipment was checked and is available for planned work.", "Materieel is gecontroleerd en beschikbaar voor het geplande werk.") },
      { title: text("Equipment out of service", "Materieel buiten gebruik"), details: text("Equipment is unavailable and requires repair or replacement.", "Materieel is niet beschikbaar en vraagt reparatie of vervanging.") },
    ],
    test: [
      { title: text("Test result accepted", "Testresultaat akkoord"), details: text("The measurement was performed and the result is within tolerance.", "De meting is uitgevoerd en het resultaat valt binnen de tolerantie.") },
      { title: text("Test deviation", "Afwijking in testresultaat"), details: text("The result is outside tolerance and requires technical follow-up.", "Het resultaat valt buiten de tolerantie en vraagt technische opvolging.") },
    ],
    delay: [
      { title: text("Weather delay", "Vertraging door weer"), details: text("Planned work was delayed by weather conditions.", "Gepland werk is vertraagd door weersomstandigheden.") },
      { title: text("Delivery delay", "Vertraging door levering"), details: text("Planned work was delayed because materials arrived late or incomplete.", "Gepland werk is vertraagd doordat materiaal te laat of onvolledig aankwam.") },
    ],
    rfi: [
      { title: "Detailed specifications for the server room of B1 second floor", details: "According to change CO-11 for the B1 second-floor PAHO server room, provide the detailed specifications after the change of location.", relatedReference: "CO-11 B1 SF PAHO SERVER ROOM EXCHANGE", revision: "0" },
      { title: text("Clarification required", "Verduidelijking vereist"), details: text("The approved documents do not provide sufficient information for execution.", "De goedgekeurde documenten geven onvoldoende informatie voor uitvoering.") },
      { title: text("Drawing conflict", "Tegenstrijdigheid in tekening"), details: text("A conflict was found between drawing, specification or site condition.", "Er is een tegenstrijdigheid vastgesteld tussen tekening, specificatie of situatie op locatie.") },
    ],
    rfa: [
      { title: "Lighting switch layout of Building B1", details: "Request approval of the lighting switch layout of Building B1.", relatedReference: "RFA.SU-L1054.519.4", revision: "4", attachments: "Lighting switch layout of Building B1.zip · 1 page" },
    ],
    inspection_request: [
      { title: "Acceptance of reinforcement for shear wall of Ground Floor, Building B2", details: "Inspect and confirm the reinforcement for the ground-floor shear wall before subsequent work proceeds.", inspectionCategory: "structural", readyTime: "07:30" },
      { title: text("Work ready for inspection", "Werk gereed voor inspectie"), details: text("The work is completed and available for the requested inspection.", "Het werk is uitgevoerd en beschikbaar voor de aangevraagde inspectie.") },
    ],
    punch_list: [
      { title: text("Finishing point", "Afwerkingspunt"), details: text("A finishing item remains open and must be corrected before handover.", "Een afwerkingspunt staat nog open en moet vóór oplevering worden gecorrigeerd.") },
      { title: text("Cleaning point", "Schoonmaakpunt"), details: text("The work area requires final cleaning before handover.", "De werkzone vraagt eindschoonmaak vóór oplevering.") },
    ],
    agreement: [
      { title: text("Site agreement", "Afspraak op locatie"), details: text("The parties agreed the described action and deadline.", "Partijen hebben de beschreven actie en deadline afgesproken.") },
    ],
    technical_instruction: [
      { title: "Replacing generator of Central Lab", details: "Move the generator from Central Lab to the new location behind Building B8-4. Use the attached slab detail and DWG of the new generator location.", reason: "Relocation of the existing Central Lab generator.", requiredAction: "proceed", attachments: "Slab detail and DWG · 1 page" },
      { title: text("Execution instruction", "Uitvoeringsinstructie"), details: text("Execute the described measure according to the approved documents.", "Voer de beschreven maatregel uit volgens de goedgekeurde documenten.") },
    ],
    change_order: [
      { title: "Wall thickness Building 1–8", details: "Adjust the wall thicknesses according to the attached drawings for Buildings 1 through 8.", attachments: "Approved wall-thickness drawings" },
      { title: text("Change pending approval", "Wijziging wacht op goedkeuring"), details: text("The proposed change must be reviewed before execution.", "De voorgestelde wijziging moet vóór uitvoering worden beoordeeld.") },
    ],
    environmental_report: [
      { title: text("Environmental and housekeeping inspection", "Milieu- en housekeepinginspectie"), details: text("Record construction debris, access roads, waste separation, material stacking and repeated housekeeping observations for the reporting period.", "Leg bouwafval, toegangswegen, afvalscheiding, materiaalstapeling en herhaalde housekeepingobservaties voor de rapportperiode vast.") },
    ],
  };
  const activeRegisterPresets = registerPresets[registerForm.type] ?? [];
  const controlledRegister = isControlledDocumentType(registerForm.type);
  const controlledFormReady = !controlledRegister || (
    registerForm.details.trim().length >= 3
    && (
      registerForm.type === "environmental_report"
        ? Boolean(registerForm.periodStart && registerForm.periodEnd && registerForm.periodEnd >= registerForm.periodStart)
        : registerForm.requestedTo.trim().length >= 2
    )
    && (registerForm.type !== "inspection_request" || Boolean(registerForm.readyDate))
    && (registerForm.type !== "technical_instruction" || registerForm.reason.trim().length >= 3)
  );

  const switchTab = (next: ProjectTab) => {
    setTab(next);
    setShowForm(false);
    setActiveInspection(null);
  };

  const openTask = (next: ProjectTab, createRecord = false) => {
    setTab(next);
    setShowForm(createRecord);
    setActiveInspection(null);
  };

  const beginInspection = async () => {
    if (!reportId) return;
    const templateId = inspectionTemplateId || inspectionTemplates[0]?.id;
    const template = data.templates.find((item) => item.id === templateId);
    const resolvedTitle = inspectionTitle.trim() || `${template?.name ?? text("Inspection", "Inspectie")} · ${buildingName}`;
    if (!templateId) return;
    let created: Inspection | null = null;
    const okay = await run(async () => {
      created = await startInspection(client, { projectId, buildingId, reportId, templateId, title: resolvedTitle });
    }, text("Inspection started; complete every required checkpoint.", "Inspectie gestart; vul nu ieder verplicht controlepunt in."));
    if (okay && created) {
      setActiveInspection(created);
      const automaticWeatherResult = projectStartAnswers
        ? projectStartAnswers.weatherCondition === "rain"
          || projectStartAnswers.weatherCondition === "heavy_rain"
          || projectStartAnswers.windCondition === "strong"
          ? "no"
          : "yes"
        : "";
      const weatherNote = projectStartAnswers
        ? text(
            `Automatically suggested from today's recorded weather: ${projectStartAnswers.temperatureC}°C, ${projectStartAnswers.weatherCondition.replaceAll("_", " ")}, wind ${projectStartAnswers.windCondition}.`,
            `Automatisch voorgesteld vanuit het vastgelegde weer van vandaag: ${projectStartAnswers.temperatureC}°C, ${projectStartAnswers.weatherCondition.replaceAll("_", " ")}, wind ${projectStartAnswers.windCondition}.`,
          )
        : "";
      setInspectionAnswers(Object.fromEntries((template?.items ?? []).map((item) => {
        const suggestedResult = item.response_type === "yes_no_na"
          ? automaticWeatherResult
          : automaticWeatherResult === "yes" ? "pass" : automaticWeatherResult === "no" ? "fail" : "";
        return [
          item.id,
          isAutomaticWeatherItem(item) && suggestedResult
            ? { result: suggestedResult, notes: weatherNote }
            : { result: "", notes: "" },
        ];
      })));
      setShowForm(false);
    }
  };

  const installRecommendedAnchorPackage = () => run(
    async () => {
      for (const code of missingAnchorChecklistCodes) {
        await installChecklistLibraryTemplate(client, projectId, code);
      }
    },
    text(
      "The three CODECO anchor checklists are ready for this project.",
      "De drie CODECO-ankerchecklists staan klaar voor dit project.",
    ),
  );

  const existingMediaFolderId = (name: string) => {
    const existing = data.mediaFolders.find((folder) => (!folder.building_id || folder.building_id === buildingId) && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    return existing?.id ?? null;
  };

  const submitInspection = async () => {
    if (!activeInspection || !activeTemplate) return;
    if (activeTemplate.items.some((item) => item.required && !checklistItemAnswered(item, inspectionAnswers[item.id]))) return;
    const okay = await run(
      async () => {
        await finishInspection(client, activeInspection, inspectionAnswers);
        if (inspectionPhotos.length) {
          const folderName = text("Inspections", "Inspecties");
          const folderId = existingMediaFolderId(folderName);
          for (const photo of inspectionPhotos) {
            const prepared = await compressFieldPhoto(photo, dataSaverEnabled());
            await queueOfflineUpload({
              projectId,
              buildingId,
              reportId,
              folderId,
              folderName,
              kind: "photo",
              file: prepared.blob,
              fileName: prepared.fileName,
              mimeType: prepared.mimeType,
              title: activeInspection.title,
              locationLabel: buildingName,
              capturedAt: new Date(photo.lastModified || Date.now()).toISOString(),
              originalSize: photo.size,
              queuedSize: prepared.blob.size,
              compressed: prepared.compressed,
              recordLink: { organizationId, recordType: "inspection", recordId: activeInspection.id, relationship: "evidence" },
            });
          }
          if (navigator.onLine) await syncOfflineUploads(client, projectId, { force: true });
        }
      },
      text("Inspection completed; every photo is secured locally and linked during automatic sync.", "Inspectie afgerond; elke foto is lokaal veiliggesteld en wordt automatisch gekoppeld."),
    );
    if (okay) {
      setActiveInspection(null);
      setInspectionTitle("");
      setInspectionPhotos([]);
      setInspectionPhotoError("");
    }
  };

  const approveChecklistSection = (items: ChecklistItem[]) => {
    setInspectionAnswers((answers) => ({
      ...answers,
      ...Object.fromEntries(items
        .filter((item) => item.response_type === "yes_no_na" || item.response_type === "pass_fail_na")
        .map((item) => [
          item.id,
          {
            ...answers[item.id],
            result: item.response_type === "yes_no_na" ? "yes" : "pass",
            notes: answers[item.id]?.notes ?? "",
          },
        ])),
    }));
  };

  const addPhotosToStack = (
    files: FileList | null,
    setFiles: Dispatch<SetStateAction<File[]>>,
    setError: Dispatch<SetStateAction<string>>,
  ) => {
    if (!files) return;
    const maximumSize = (data.settings?.max_file_size_mb ?? 25) * 1024 * 1024;
    const candidates = Array.from(files);
    const valid = candidates.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= maximumSize);
    if (valid.length !== candidates.length) {
      setError(text(
        `Use JPEG, PNG or WebP files up to ${data.settings?.max_file_size_mb ?? 25} MB each.`,
        `Gebruik JPEG-, PNG- of WebP-bestanden tot ${data.settings?.max_file_size_mb ?? 25} MB per foto.`,
      ));
    } else {
      setError("");
    }
    setFiles((current) => {
      const keyed = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      valid.forEach((file) => keyed.set(`${file.name}:${file.size}:${file.lastModified}`, file));
      return [...keyed.values()].slice(0, 12);
    });
  };

  const addFindingPhotos = (files: FileList | null) => addPhotosToStack(files, setFindingPhotos, setFindingPhotoError);

  const addFinding = async () => {
    if (!reportId || findingForm.title.trim().length < 3 || findingForm.description.trim().length < 3) return;
    const draft = {
      projectId,
      buildingId,
      reportId,
      type: findingForm.type,
      title: findingForm.title,
      description: findingForm.description,
      severity: findingForm.severity,
      responsiblePartyId: findingForm.responsiblePartyId,
      issueType: findingForm.issueType,
      impactSummary: findingForm.impactSummary,
      actionSteps: findingForm.actionSteps,
      escalationRequired: findingForm.escalationRequired,
      disposition: findingForm.disposition,
      expectedResolutionDate: findingForm.expectedResolutionDate,
      sourceCatalogSubject: findingForm.sourceCatalogSubject,
    };
    const success = findingPhotos.length
      ? text("Issue and photo stack secured; numbering and assignment synchronize automatically.", "Probleem en fotostapel veiliggesteld; nummering en toewijzing synchroniseren automatisch.")
      : text("Finding numbered, assigned and given a rule-driven deadline.", "Bevinding genummerd, toegewezen en van een regelgestuurde deadline voorzien.");
    const okay = await run(async () => {
      if (findingPhotos.length) {
        const folderName = text("Findings", "Bevindingen");
        const findingFolderId = existingMediaFolderId(folderName);
        const groupId = crypto.randomUUID();
        for (const photo of findingPhotos) {
          const prepared = await compressFieldPhoto(photo, dataSaverEnabled());
          await queueOfflineUpload({
            projectId,
            buildingId,
            reportId,
            folderId: findingFolderId,
            folderName,
            kind: "photo",
            file: prepared.blob,
            fileName: prepared.fileName,
            mimeType: prepared.mimeType,
            title: findingForm.title,
            description: findingForm.description,
            locationLabel: buildingName,
            capturedAt: new Date(photo.lastModified || Date.now()).toISOString(),
            originalSize: photo.size,
            queuedSize: prepared.blob.size,
            compressed: prepared.compressed,
            findingGroup: {
              id: groupId,
              organizationId,
              draft: {
                organizationId,
                type: findingForm.type,
                title: findingForm.title,
                description: findingForm.description,
                severity: findingForm.severity,
                responsiblePartyId: findingForm.responsiblePartyId,
                issueType: findingForm.issueType,
                impactSummary: findingForm.impactSummary,
                actionSteps: findingForm.actionSteps,
                escalationRequired: findingForm.escalationRequired,
                disposition: findingForm.disposition,
                expectedResolutionDate: findingForm.expectedResolutionDate,
                sourceCatalogSubject: findingForm.sourceCatalogSubject,
              },
            },
          });
        }
        if (navigator.onLine) await syncOfflineUploads(client, projectId, { force: true });
        return;
      }
      await createFinding(client, draft);
    }, success);
    if (okay) {
      setFindingForm({
        type: "deficiency", title: "", description: "", severity: "medium", responsiblePartyId: "",
        issueType: "quality", impactSummary: "", actionSteps: "", escalationRequired: false,
        disposition: "to_be_corrected", expectedResolutionDate: "", sourceCatalogSubject: "",
      });
      setFindingPhotos([]);
      setFindingPhotoError("");
      setShowForm(false);
    }
  };

  const addHse = async () => {
    if (!reportId || hseForm.title.trim().length < 3 || hseForm.description.trim().length < 3) return;
    const okay = await run(
      async () => {
        const event = await createHseEvent(client, { projectId, buildingId, reportId, ...hseForm });
        if (hsePhotos.length) {
          const folderName = "HSE";
          const folderId = existingMediaFolderId(folderName);
          for (const photo of hsePhotos) {
            const prepared = await compressFieldPhoto(photo, dataSaverEnabled());
            await queueOfflineUpload({
              projectId,
              buildingId,
              reportId,
              folderId,
              folderName,
              kind: "photo",
              file: prepared.blob,
              fileName: prepared.fileName,
              mimeType: prepared.mimeType,
              title: hseForm.title,
              description: hseForm.description,
              locationLabel: buildingName,
              capturedAt: new Date(photo.lastModified || Date.now()).toISOString(),
              originalSize: photo.size,
              queuedSize: prepared.blob.size,
              compressed: prepared.compressed,
              recordLink: { organizationId, recordType: "hse", recordId: event.id, relationship: "evidence" },
            });
          }
          if (navigator.onLine) await syncOfflineUploads(client, projectId, { force: true });
        }
      },
      text("HSE event recorded; every photo is secured locally and linked during automatic sync.", "HSE-gebeurtenis vastgelegd; elke foto is lokaal veiliggesteld en wordt automatisch gekoppeld."),
    );
    if (okay) {
      setHseForm({ type: "unsafe_condition", title: "", description: "", severity: "medium", immediateMeasure: "", confidential: false });
      setHsePhotos([]);
      setHsePhotoError("");
      setShowForm(false);
    }
  };

  const addRegisterEntry = async () => {
    if (!reportId || registerForm.title.trim().length < 3) return;
    const details = controlledRegister
      ? createControlledDocumentDetails(registerForm, {
          projectName,
          projectCode,
          buildingName,
          currentUserName,
        })
      : { description: registerForm.details };
    const okay = await run(
      () => createRegisterEntry(client, {
        projectId,
        buildingId,
        reportId,
        type: registerForm.type,
        title: registerForm.title,
        responsiblePartyId: registerForm.responsiblePartyId,
        dueAt: registerForm.dueDate || null,
        details,
      }),
      text(`${registerNames[registerForm.type] ?? "Record"} was saved centrally and linked to the daily report.`, `${registerNames[registerForm.type] ?? "Registeritem"} centraal opgeslagen en aan het dagrapport gekoppeld.`),
    );
    if (okay) {
      setRegisterForm({ ...emptyControlledDocumentDraft });
      setShowForm(false);
    }
  };

  const inspectBoqFile = async (file: File | null) => {
    setBoqFile(file);
    setBoqItems([]);
    setBoqError("");
    if (!file) return;
    try {
      setBoqItems(parseBoqCsv(await file.text()));
    } catch (caught) {
      setBoqError(messageFrom(caught));
    }
  };

  const importBoq = async () => {
    if (!boqItems.length) return;
    const okay = await run(
      () => importProjectBoq(client, { projectId, buildingId, reportId, items: boqItems }),
      text(`${boqItems.length} BOQ lines imported with quantity, value and progress.`, `${boqItems.length} BOQ-regels geïmporteerd met hoeveelheid, waarde en voortgang.`),
    );
    if (okay) {
      setBoqFile(null);
      setBoqItems([]);
      setBoqError("");
    }
  };

  const projectSections: Array<[Exclude<ProjectTab, "home">, string, number]> = [
    ["inspections", text("Inspections", "Inspecties"), data.inspections.length],
    ["findings", text("Findings / NCR", "Bevindingen / NCR"), data.findings.filter((item) => item.status !== "closed").length],
    ["hse", "HSE", data.hseEvents.length],
    ["registers", text("Other records", "Overige registers"), data.registerEntries.length],
    ["visual", text("Visual evidence", "Visueel bewijs"), data.visualCaptures.length],
    ["drawings", text("Drawings", "Tekeningen"), data.files.filter((file) => file.category === "drawing" && file.status === "available").length],
    ["tools", text("Field tools", "Veldtools"), data.registerEntries.filter((entry) => ["notepad", "agreement", "technical_instruction"].includes(entry.register_type)).length],
    ["files", text("Photos & folders", "Foto’s & mappen"), data.files.length],
  ];
  const activeSectionLabel = projectSections.find(([id]) => id === tab)?.[1];
  const canCreateRecord = ["inspections", "findings", "hse", "registers"].includes(tab);

  return (
    <>
      <header className={`secondary-header workspace-header${tab === "home" ? " home" : ""}`}>
        <div>
          <p className="eyebrow">{projectName} · {buildingName}</p>
          <h1>{tab === "home" ? text("Workspace", "Werkruimte") : activeSectionLabel}</h1>
          <p>{tab === "home"
            ? text("Choose one task. Project context and filing are handled automatically.", "Kies één taak. Projectcontext en ordening worden automatisch geregeld.")
            : text("Finish this task, then return to the workspace.", "Rond deze taak af en ga daarna terug naar de werkruimte.")}</p>
        </div>
        {canCreateRecord && !activeInspection ? <button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}><Plus size={15} /> {text("New record", "Nieuwe registratie")}</button> : null}
      </header>

      {tab === "home" ? (
        <section className="workspace-task-hub" aria-labelledby="workspace-task-title">
          <div className="workspace-task-heading">
            <span><Wrench size={22} /></span>
            <div><p>{text("One task at a time", "Eén taak tegelijk")}</p><h2 id="workspace-task-title">{text("What do you need to do now?", "Wat wil je nu doen?")}</h2></div>
          </div>

          <button className="workspace-camera-action" type="button" onClick={openQuickCamera}>
            <span><Camera size={25} /></span>
            <span><strong>{text("Take a photo", "Foto maken")}</strong><small>{text("Point and shoot · project, building, time and folder are linked automatically", "Richten en maken · project, gebouw, tijd en map worden automatisch gekoppeld")}</small></span>
          </button>

          <div className="workspace-primary-actions">
            <button className="workspace-task-action inspection" type="button" onClick={() => openTask("inspections", true)}>
              <ClipboardCheck size={22} />
              <strong>{text("Start inspection", "Start inspectie")}</strong>
              <small>{text("Recommended checklist is ready", "Aanbevolen checklist staat klaar")}</small>
            </button>
            <button className="workspace-task-action finding" type="button" onClick={() => openTask("findings", true)}>
              <AlertTriangle size={22} />
              <strong>{text("Report issue", "Meld probleem")}</strong>
              <small>{text("Stack photos and assign directly", "Stapel foto’s en wijs direct toe")}</small>
            </button>
          </div>

          <button className="workspace-drawing-action" type="button" onClick={() => openTask("drawings")}>
            <FileText size={21} />
            <span><strong>{text("Open drawing and place a pin", "Open tekening en plaats een pin")}</strong><small>{text("Link RFI, document, observation or inspection to the exact location", "Koppel RFI, document, observatie of inspectie aan de exacte locatie")}</small></span>
          </button>

          <details className="workspace-more-actions">
            <summary>{text("More field tasks", "Meer veldtaken")}<span>{text("HSE, folders, 360° and documents", "HSE, mappen, 360° en documenten")}</span></summary>
            <div className="workspace-more-grid">
              <button type="button" onClick={() => openTask("hse", true)}><ShieldCheck size={18} /><span><strong>HSE</strong><small>{text("Safety event", "Veiligheidsmelding")}</small></span></button>
              <button type="button" onClick={() => openTask("files")}><Camera size={18} /><span><strong>{text("Photo folders", "Fotomappen")}</strong><small>{text("All evidence", "Alle bewijzen")}</small></span></button>
              <button type="button" onClick={() => openTask("visual")}><RotateCcw size={18} /><span><strong>{text("360° evidence", "360° bewijs")}</strong><small>{text("Upload panorama", "Panorama uploaden")}</small></span></button>
              <button type="button" onClick={() => openTask("registers", true)}><Archive size={18} /><span><strong>{text("Documents", "Documenten")}</strong><small>RFI · RFA · WIR · NCR</small></span></button>
              <button type="button" onClick={() => openTask("tools")}><Wrench size={18} /><span><strong>{text("Field tools", "Veldtools")}</strong><small>{text("Notes and agreements", "Notities en afspraken")}</small></span></button>
            </div>
          </details>

          <div className="workspace-automation-strip" aria-label={text("Automatic field support", "Automatische veldondersteuning")}>
            <span><CloudSun size={16} /><small>{text("Weather prefilled", "Weer vooraf ingevuld")}</small></span>
            <span><CheckCircle2 size={16} /><small>{text("Numbers assigned", "Nummers toegekend")}</small></span>
            <span><WifiOff size={16} /><small>{text("Photos queue offline", "Foto’s wachten offline")}</small></span>
          </div>
        </section>
      ) : (
        <>
          <div className="workspace-section-controls">
            <button className="workspace-back-button" type="button" onClick={() => switchTab("home")}><ArrowLeft size={17} /> {text("Workspace", "Werkruimte")}</button>
            <label className="mobile-workspace-section-select">
              <span>{text("Current section", "Huidig onderdeel")}</span>
              <select value={tab} onChange={(event) => switchTab(event.target.value as ProjectTab)}>
                {projectSections.map(([id, label, count]) => <option value={id} key={id}>{label} · {count}</option>)}
              </select>
            </label>
          </div>
          <div className="operation-tabs workspace-desktop-tabs" role="tablist" aria-label={text("Project records", "Projectregisters")}>
            {projectSections.map(([id, label, count]) => (
          <button className={tab === id ? "active" : ""} type="button" role="tab" aria-selected={tab === id} onClick={() => switchTab(id)} key={id}>{label}<span>{count}</span></button>
            ))}
          </div>
        </>
      )}

      {tab === "inspections" ? (
        <section className="operation-panel">
          {activeInspection && activeTemplate ? (
            <div className="operation-form wide">
              <div className="operation-form-heading"><div><span className="record-number">{activeInspection.inspection_number}</span><h2>{activeInspection.title}</h2></div><span className="task-status">{text("In progress", "In uitvoering")}</span></div>
              <p className="form-intro">{text("Answer every required checkpoint. A failed point automatically creates a traceable finding on completion; the app never closes it by itself.", "Beantwoord alle verplichte controlepunten. Een afkeur maakt bij afronding automatisch een traceerbare bevinding; de app sluit die nooit zelf.")}</p>
              <div className="checklist-progress" aria-label={text("Checklist progress", "Checklistvoortgang")}>
                <span><b>{answeredChecklistItems}</b> / {activeTemplate.items.length} {text("answered", "beantwoord")}</span>
                <span className="checklist-progress-track"><i style={{ width: `${activeTemplate.items.length ? Math.round((answeredChecklistItems / activeTemplate.items.length) * 100) : 0}%` }} /></span>
              </div>
              <div className="checklist-run">
                {checklistSections.map(({ section, items }) => (
                  <section className="checklist-section" key={section}>
                    <header>
                      <span><strong>{section}</strong><small>{items.filter((item) => checklistItemAnswered(item, inspectionAnswers[item.id])).length} / {items.length}</small></span>
                      {items.every((item) => item.response_type === "yes_no_na" || item.response_type === "pass_fail_na") ? <button type="button" onClick={() => approveChecklistSection(items)}><CheckCircle2 size={14} /> {text("Approve section", "Sectie akkoord")}</button> : null}
                    </header>
                    {items.map((item) => {
                      const current = inspectionAnswers[item.id] ?? { result: "", notes: "" };
                      const automaticWeather = isAutomaticWeatherItem(item);
                      const failed = current.result === "no" || current.result === "fail";
                      return (
                        <fieldset className={`checklist-question${automaticWeather ? " automatic" : ""}`} key={item.id}>
                          <legend>{item.prompt}{item.required ? " *" : ""}</legend>
                          {automaticWeather ? <span className="checklist-auto-chip"><CloudSun size={13} /> {text("Weather prefilled · confirm", "Weer vooraf ingevuld · bevestig")}</span> : null}
                          {checklistGuidance(item) ? <small>{checklistGuidance(item)}</small> : null}
                          {item.response_type === "number" ? (
                            <label className="checklist-value-input"><input type="number" value={current.numericValue ?? ""} min={item.minimum_value ?? undefined} max={item.maximum_value ?? undefined} onChange={(event) => setInspectionAnswers((answers) => ({ ...answers, [item.id]: { ...current, result: event.target.value ? "value" : "", numericValue: event.target.value ? Number(event.target.value) : undefined } }))} />{item.unit ? <em>{item.unit}</em> : null}</label>
                          ) : item.response_type === "text" ? (
                            <input value={current.textValue ?? ""} onChange={(event) => setInspectionAnswers((answers) => ({ ...answers, [item.id]: { ...current, result: event.target.value.trim() ? "text" : "", textValue: event.target.value } }))} placeholder={text("Enter the required value", "Vul de vereiste waarde in")} />
                          ) : (
                            <div className="answer-options">
                              {(item.response_type === "yes_no_na" ? [["yes", text("Yes", "Ja")], ["no", text("No", "Nee")], ["na", text("N/A", "N.v.t.")]] : [["pass", text("Pass", "Akkoord")], ["fail", text("Fail", "Niet akkoord")], ["na", text("N/A", "N.v.t.")]]).map(([value, label]) => (
                                <label key={value}><input type="radio" name={item.id} value={value} checked={current.result === value} onChange={() => setInspectionAnswers((answers) => ({ ...answers, [item.id]: { ...current, result: value } }))} /> {label}</label>
                              ))}
                            </div>
                          )}
                          {failed || current.notes ? <input className="checklist-remark" value={current.notes} onChange={(event) => setInspectionAnswers((answers) => ({ ...answers, [item.id]: { ...current, notes: event.target.value } }))} placeholder={text("Short exception note or evidence reference", "Korte afwijkingsnotitie of bewijsreferentie")} /> : null}
                        </fieldset>
                      );
                    })}
                  </section>
                ))}
              </div>
              <label className="finding-photo-capture inspection-photo-capture">
                <Camera size={22} />
                <span><strong>{inspectionPhotos.length ? text(`${inspectionPhotos.length} evidence photos ready`, `${inspectionPhotos.length} bewijsfoto’s klaar`) : text("Take inspection evidence photo", "Maak inspectiebewijsfoto")}</strong><small>{text("Tap again for another photo. Every image is linked to this inspection.", "Tik opnieuw voor nog een foto. Elk beeld wordt aan deze inspectie gekoppeld.")}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotosToStack(event.currentTarget.files, setInspectionPhotos, setInspectionPhotoError); event.currentTarget.value = ""; }} />
              </label>
              {inspectionPhotos.length ? <FindingPhotoStack files={inspectionPhotos} onRemove={(index) => setInspectionPhotos((current) => current.filter((_, currentIndex) => currentIndex !== index))} /> : null}
              {inspectionPhotoError ? <p className="field-error" role="alert">{inspectionPhotoError}</p> : null}
              <div className="form-actions checklist-sticky-actions"><button className="secondary-button" type="button" onClick={() => setActiveInspection(null)}>{text("Complete later", "Later afronden")}</button><button className="primary-button" type="button" disabled={busy || activeTemplate.items.some((item) => item.required && !checklistItemAnswered(item, inspectionAnswers[item.id]))} onClick={() => void submitInspection()}>{busy ? <Loader2 className="spin" size={15} /> : <FileCheck2 size={15} />} {text("Complete inspection", "Inspectie afronden")}</button></div>
            </div>
          ) : null}
          {showForm && !activeInspection ? (
            <div className="operation-form">
              <h2>{text("Start inspection", "Inspectie starten")}</h2>
              {!reportId ? <p className="inline-error">{text("Start the daily report through Project start first.", "Start eerst het dagrapport via Projectstart.")}</p> : null}
              {anchorWorkPlanned && missingAnchorChecklistCodes.length ? (
                <div className="operation-alert success recommended-checklist-install">
                  <ClipboardCheck size={18} />
                  <div>
                    <strong>{text("Anchor work recognized", "Ankerwerk herkend")}</strong>
                    <span>{text("Install the three client-based checklists here; no searching or typing required.", "Installeer hier de drie klantchecklists; zoeken of typen is niet nodig.")}</span>
                    <button className="primary-button" type="button" disabled={busy} onClick={() => void installRecommendedAnchorPackage()}>
                      {busy ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
                      {text("Prepare all 3 checklists", "Zet alle 3 checklists klaar")}
                    </button>
                  </div>
                </div>
              ) : null}
              {inspectionTemplates.length ? <>
                <label className="form-field"><span>{text("Checklist · recommended for today's work first", "Checklist · aanbevolen voor vandaag eerst")}</span><select value={inspectionTemplateId || inspectionTemplates[0]?.id || ""} onChange={(event) => { setInspectionTemplateId(event.target.value); setInspectionTitle(""); }}>{inspectionTemplates.map((template) => <option value={template.id} key={template.id}>{["LIB-101", "LIB-102", "LIB-103"].includes(template.code) ? "★ " : ""}{template.name} · v{template.version_number}</option>)}</select></label>
                <details className="inspection-subject-details"><summary>{text("Add a different subject or element · optional", "Ander onderwerp of element toevoegen · optioneel")}</summary><label className="form-field"><span>{text("Subject / element", "Onderwerp / element")}</span><input value={inspectionTitle} onChange={(event) => setInspectionTitle(event.target.value)} placeholder={`${inspectionTemplates.find((template) => template.id === (inspectionTemplateId || inspectionTemplates[0]?.id))?.name ?? text("Inspection", "Inspectie")} · ${buildingName}`} /></label></details>
                <button className="primary-button start-checklist-button" type="button" disabled={busy || !reportId} onClick={() => void beginInspection()}><ClipboardCheck size={15} /> {text("Start recommended checklist", "Start aanbevolen checklist")}</button>
              </> : <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("No project checklist is published yet", "Nog geen projectchecklist gepubliceerd")}</strong><span>{text("An administrator can install the ready-made CODECO checklist package under More.", "Een beheerder kan het kant-en-klare CODECO-pakket onder Meer installeren.")}</span></div></div>}
            </div>
          ) : null}
          <RecordList empty={text("No formal inspections yet.", "Nog geen formele inspecties.")} rows={data.inspections.map((inspection) => ({
            id: inspection.id,
            icon: ClipboardCheck,
            title: inspection.title,
            meta: `${inspection.inspection_number} · ${formatDate(inspection.completed_at ?? inspection.started_at, locale)}`,
            status: inspection.status.replaceAll("_", " "),
            tone: inspection.status === "passed" ? "green" : inspection.status === "failed" ? "red" : "",
          }))} />
        </section>
      ) : null}

      {tab === "findings" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className="operation-form snap-assign-form">
              <div className="operation-form-heading"><div><span className="record-number">{text("Snap & assign", "Foto & toewijzen")}</span><h2>{text("Record finding / NCR", "Bevinding / NCR registreren")}</h2></div>{!online ? <span className="experimental-badge"><WifiOff size={13} /> {text("Queues offline", "Offline wachtrij")}</span> : null}</div>
              <label className="finding-photo-capture">
                <Camera size={22} />
                <span><strong>{findingPhotos.length ? text(`${findingPhotos.length} photos stacked for this issue`, `${findingPhotos.length} foto’s gestapeld voor dit probleem`) : text("Take or choose issue photos", "Maak of kies probleemfoto’s")}</strong><small>{text("Tap again to add another photo. Project, building, date and time are linked automatically.", "Tik opnieuw om nog een foto toe te voegen. Project, gebouw, datum en tijd worden automatisch gekoppeld.")}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addFindingPhotos(event.target.files); event.currentTarget.value = ""; }} />
              </label>
              {findingPhotos.length ? <FindingPhotoStack files={findingPhotos} onRemove={(index) => setFindingPhotos((current) => current.filter((_, currentIndex) => currentIndex !== index))} /> : null}
              {findingPhotoError ? <p className="field-error" role="alert">{findingPhotoError}</p> : null}
              <div className="quick-issue-presets" aria-label={text("Common issue choices", "Veelvoorkomende problemen")}>
                {findingPresets.map((preset) => <button className={findingForm.title === preset.title ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, title: preset.title, description: preset.description, type: preset.title === text("Safety risk", "Veiligheidsrisico") ? "observation" : "deficiency", severity: preset.title === text("Safety risk", "Veiligheidsrisico") ? "high" : findingForm.severity })} key={preset.title}>{preset.title}</button>)}
              </div>
              <label className="form-field"><span>{text("Client B1 issue catalog (35 reusable categories)", "Klantcatalogus B1 (35 herbruikbare categorieën)")}</span><select value={findingForm.sourceCatalogSubject} onChange={(event) => {
                const preset = issueCatalogPresets.find((item) => item.subject === event.target.value);
                if (!preset) {
                  setFindingForm({ ...findingForm, sourceCatalogSubject: "" });
                  return;
                }
                setFindingForm({
                  ...findingForm,
                  sourceCatalogSubject: preset.subject,
                  title: preset.subject,
                  description: preset.description,
                  actionSteps: preset.action,
                  disposition: preset.disposition,
                  type: "deficiency",
                  issueType: "quality",
                });
              }}><option value="">{text("Choose only when applicable", "Kies alleen indien van toepassing")}</option>{issueCatalogPresets.map((preset) => <option value={preset.subject} key={preset.subject}>{preset.subject}</option>)}</select><small>{text("The historic spreadsheet is used as a quick-entry catalog; choosing an item does not mark it as an active project issue until you submit it.", "Het historische spreadsheet is een snelinvoercatalogus; een keuze wordt pas een actief projectpunt nadat je het indient.")}</small></label>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Type", "Type")}</span><select value={findingForm.type} onChange={(event) => setFindingForm({ ...findingForm, type: event.target.value })}><option value="observation">{text("Observation", "Observatie")}</option><option value="deficiency">{text("Deficiency", "Tekortkoming")}</option><option value="deviation">{text("Deviation", "Afwijking")}</option><option value="ncr">NCR</option><option value="improvement">{text("Improvement opportunity", "Verbeterkans")}</option></select></label>
                <label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={findingForm.severity} onChange={(event) => setFindingForm({ ...findingForm, severity: event.target.value })}><option value="low">{text("Low · 14 days", "Laag · 14 dagen")}</option><option value="medium">{text("Medium · 7 days", "Middel · 7 dagen")}</option><option value="high">{text("High · 3 days", "Hoog · 3 dagen")}</option><option value="critical">{text("Critical · 1 day + escalation", "Kritiek · 1 dag + escalatie")}</option></select></label>
              </div>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Issue type", "Soort issue")}</span><select value={findingForm.issueType} onChange={(event) => setFindingForm({ ...findingForm, issueType: event.target.value })}><option value="quality">{text("Quality / workmanship", "Kwaliteit / uitvoering")}</option><option value="informational">{text("Informational", "Informatief")}</option><option value="procedural">{text("Procedural", "Procedureel")}</option><option value="system">{text("System / installation", "Systeem / installatie")}</option><option value="other">{text("Other", "Overig")}</option></select></label>
                <label className="form-field"><span>{text("Disposition", "Beoordeling")}</span><select value={findingForm.disposition} onChange={(event) => setFindingForm({ ...findingForm, disposition: event.target.value as typeof findingForm.disposition })}><option value="validated">{text("Validated", "Gevalideerd")}</option><option value="to_be_corrected">{text("To be corrected", "Te corrigeren")}</option><option value="alternative_solution">{text("Alternative solution required", "Alternatieve oplossing nodig")}</option></select></label>
              </div>
              <div className="click-answer-block"><strong>{text("Impact", "Impact")}</strong><div className="quick-issue-presets">{findingImpactPresets.map((option) => <button className={findingForm.impactSummary === option ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, impactSummary: option })} key={option}>{option}</button>)}</div></div>
              <div className="click-answer-block"><strong>{text("Required follow-up", "Vereiste opvolging")}</strong><div className="quick-issue-presets">{findingActionPresets.map((option) => <button className={findingForm.actionSteps === option ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, actionSteps: option })} key={option}>{option}</button>)}</div></div>
              <details className="optional-text-entry">
                <summary>{text("Different issue details", "Andere probleeminformatie")}</summary>
                <div className="form-grid">
                  <label className="form-field"><span>{text("Title", "Titel")}</span><input value={findingForm.title} onChange={(event) => setFindingForm({ ...findingForm, title: event.target.value })} /></label>
                  <label className="form-field"><span>{text("Factual description", "Feitelijke omschrijving")}</span><textarea value={findingForm.description} onChange={(event) => setFindingForm({ ...findingForm, description: event.target.value })} rows={3} /></label>
                  <label className="form-field"><span>{text("Different impact", "Andere impact")}</span><textarea value={findingForm.impactSummary} onChange={(event) => setFindingForm({ ...findingForm, impactSummary: event.target.value })} rows={2} /></label>
                  <label className="form-field"><span>{text("Different action", "Andere actie")}</span><textarea value={findingForm.actionSteps} onChange={(event) => setFindingForm({ ...findingForm, actionSteps: event.target.value })} rows={2} /></label>
                </div>
              </details>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Expected resolution date", "Verwachte oplosdatum")}</span><input type="date" value={findingForm.expectedResolutionDate} onChange={(event) => setFindingForm({ ...findingForm, expectedResolutionDate: event.target.value })} /></label>
                <label className="check-field issue-escalation"><input type="checkbox" checked={findingForm.escalationRequired} onChange={(event) => setFindingForm({ ...findingForm, escalationRequired: event.target.checked })} /> {text("Escalation required", "Escalatie vereist")}</label>
              </div>
              <label className="form-field"><span>{text("Responsible party", "Verantwoordelijke partij")}</span><select value={findingForm.responsiblePartyId} onChange={(event) => setFindingForm({ ...findingForm, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Nog niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
              <button className="primary-button" type="button" disabled={busy || !reportId || (!online && !findingPhotos.length) || findingForm.title.trim().length < 3 || findingForm.description.trim().length < 3} onClick={() => void addFinding()}><AlertTriangle size={15} /> {!online ? text("Add to sync queue", "In synchronisatiewachtrij") : text("Submit issue", "Probleem indienen")}</button>
            </div>
          ) : null}
          <FindingList
            findings={data.findings}
            progressUpdates={data.findingProgressUpdates}
            projectName={projectName}
            projectCode={projectCode}
            buildingName={buildingName}
            currentUserName={currentUserName}
            parties={parties}
            busy={busy}
            transition={(finding, nextStatus, note, finalMeasure) => run(() => transitionFinding(client, finding.id, nextStatus, note, finalMeasure), `Bevinding ${finding.finding_number} staat nu op ${findingStatusLabels[nextStatus] ?? nextStatus}.`)}
            recordProgress={(finding, progressPercent, disposition, note) => run(
              () => recordFindingProgress(client, { findingId: finding.id, progressPercent, disposition, note }),
              text(`Progress for ${finding.finding_number} recorded; 100% still requires verification.`, `Voortgang voor ${finding.finding_number} vastgelegd; ook 100% vraagt nog verificatie.`),
            )}
            share={async (finding) => {
              let sharedToken = "";
              let expiresAt = "";
              const okay = await run(async () => {
                const created = await createExternalShareLink(client, projectId, "finding", finding.id);
                sharedToken = created.token;
                expiresAt = created.expires_at;
              }, text("Secure external link created.", "Beveiligde externe link aangemaakt."));
              if (!okay || !sharedToken || !expiresAt) return null;
              return { url: externalShareUrl(window.location.origin, sharedToken), expiresAt };
            }}
          />
        </section>
      ) : null}

      {tab === "hse" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className="operation-form">
              <h2>{text("HSE observation or incident", "HSE-observatie of incident")}</h2>
              <div className="quick-issue-presets" aria-label={text("Choose a standard HSE record", "Kies een standaard HSE-registratie")}>{hsePresets.map((preset) => <button className={hseForm.title === preset.title ? "active" : ""} type="button" onClick={() => setHseForm({ ...hseForm, ...preset })} key={preset.title}>{preset.title}</button>)}</div>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Type", "Type")}</span><select value={hseForm.type} onChange={(event) => setHseForm({ ...hseForm, type: event.target.value })}><option value="positive_observation">{text("Positive observation", "Positieve observatie")}</option><option value="unsafe_act">{text("Unsafe act", "Onveilige handeling")}</option><option value="unsafe_condition">{text("Unsafe condition", "Onveilige situatie")}</option><option value="near_miss">Near miss</option><option value="incident">Incident</option><option value="stop_work">Stop work</option><option value="toolbox">Toolbox meeting</option></select></label>
                <label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={hseForm.severity} onChange={(event) => setHseForm({ ...hseForm, severity: event.target.value })}><option value="low">{text("Low", "Laag")}</option><option value="medium">{text("Medium", "Middel")}</option><option value="high">{text("High", "Hoog")}</option><option value="critical">{text("Critical", "Kritiek")}</option></select></label>
              </div>
              <details className="optional-text-entry">
                <summary>{text("Different HSE situation", "Andere HSE-situatie")}</summary>
                <div className="form-grid">
                  <label className="form-field"><span>{text("Title", "Titel")}</span><input value={hseForm.title} onChange={(event) => setHseForm({ ...hseForm, title: event.target.value })} /></label>
                  <label className="form-field"><span>{text("What was observed?", "Wat is waargenomen?")}</span><textarea value={hseForm.description} onChange={(event) => setHseForm({ ...hseForm, description: event.target.value })} rows={3} /></label>
                  <label className="form-field"><span>{text("Immediate measure", "Directe maatregel")}</span><textarea value={hseForm.immediateMeasure} onChange={(event) => setHseForm({ ...hseForm, immediateMeasure: event.target.value })} rows={2} /></label>
                </div>
              </details>
              <label className="finding-photo-capture hse-photo-capture">
                <Camera size={22} />
                <span><strong>{hsePhotos.length ? text(`${hsePhotos.length} evidence photos ready`, `${hsePhotos.length} bewijsfoto’s klaar`) : text("Take HSE evidence photo", "Maak HSE-bewijsfoto")}</strong><small>{text("Tap again to stack situation and control-measure photos.", "Tik opnieuw om situatie- en maatregelfoto’s te stapelen.")}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotosToStack(event.currentTarget.files, setHsePhotos, setHsePhotoError); event.currentTarget.value = ""; }} />
              </label>
              {hsePhotos.length ? <FindingPhotoStack files={hsePhotos} onRemove={(index) => setHsePhotos((current) => current.filter((_, currentIndex) => currentIndex !== index))} /> : null}
              {hsePhotoError ? <p className="field-error" role="alert">{hsePhotoError}</p> : null}
              <label className="check-field"><input type="checkbox" checked={hseForm.confidential} onChange={(event) => setHseForm({ ...hseForm, confidential: event.target.checked })} /> {text("Restrict this sensitive incident to authorized HSE roles", "Beperk dit gevoelige incident tot bevoegde HSE-rollen")}</label>
              <button className="primary-button" type="button" disabled={busy || !reportId || hseForm.title.trim().length < 3 || hseForm.description.trim().length < 3} onClick={() => void addHse()}><ShieldCheck size={15} /> {text("Save HSE record", "HSE-registratie opslaan")}</button>
            </div>
          ) : null}
          <RecordList empty={text("No formal HSE records yet.", "Nog geen formele HSE-registraties.")} rows={data.hseEvents.map((event) => ({ id: event.id, icon: ShieldCheck, title: event.confidential ? `${event.title} · ${text("confidential", "vertrouwelijk")}` : event.title, meta: `${event.event_number} · ${event.event_type.replaceAll("_", " ")} · ${formatDate(event.occurred_at, locale)}`, status: event.status.replaceAll("_", " "), tone: event.severity === "critical" ? "red" : event.status === "closed" ? "green" : "" }))} />
        </section>
      ) : null}

      {tab === "registers" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className={`operation-form ${controlledRegister ? "wide controlled-document-form" : ""}`}>
              <div className="operation-form-heading"><div><span className="record-number">{controlledRegister ? text("Client-controlled form", "Klantgestuurd formulier") : text("Project register", "Projectregister")}</span><h2>{controlledRegister ? registerNames[registerForm.type] : text("Add project register item", "Projectregister aanvullen")}</h2></div>{controlledRegister ? <span className="controlled-document-badge">{projectCode} · {buildingName}</span> : null}</div>
              <label className="form-field"><span>{text("Register / document format", "Register / documentformaat")}</span><select value={registerForm.type} onChange={(event) => setRegisterForm({ ...emptyControlledDocumentDraft, type: event.target.value })}>{Object.entries(registerNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              {activeRegisterPresets.length ? <div className="quick-issue-presets" aria-label={text("Choose a standard register item", "Kies een standaard registeritem")}>{activeRegisterPresets.map((preset) => <button className={registerForm.title === preset.title ? "active" : ""} type="button" onClick={() => setRegisterForm({ ...registerForm, ...preset })} key={preset.title}>{preset.title}</button>)}</div> : null}
              <details className="optional-text-entry">
                <summary>{text("Different title or document content", "Andere titel of documentinhoud")}</summary>
                <div className="form-grid">
                  <label className="form-field"><span>{text("Title / reference", "Titel / referentie")}</span><input value={registerForm.title} onChange={(event) => setRegisterForm({ ...registerForm, title: event.target.value })} /></label>
                  <label className="form-field"><span>{controlledRegister ? text("Formal request / instruction / observation", "Formeel verzoek / instructie / observatie") : text("Details, quantity, measure or decision", "Details, hoeveelheid, maatregel of besluit")}</span><textarea value={registerForm.details} onChange={(event) => setRegisterForm({ ...registerForm, details: event.target.value })} rows={controlledRegister ? 5 : 3} /></label>
                </div>
              </details>
              {controlledRegister ? <>
                <div className="form-grid-2"><label className="form-field"><span>{text("Revision", "Revisie")}</span><input value={registerForm.revision} onChange={(event) => setRegisterForm({ ...registerForm, revision: event.target.value })} /></label><label className="form-field"><span>{text("Response / information required by", "Antwoord / informatie nodig uiterlijk")}</span><input type="date" value={registerForm.dueDate} onChange={(event) => setRegisterForm({ ...registerForm, dueDate: event.target.value })} /></label></div>
                <div className="form-grid-2"><label className="form-field"><span>{text("Issued by position", "Functie opsteller")}</span><input value={registerForm.issuerPosition} onChange={(event) => setRegisterForm({ ...registerForm, issuerPosition: event.target.value })} /></label><label className="form-field"><span>{text("Issued by company", "Bedrijf opsteller")}</span><input value={registerForm.issuerCompany} onChange={(event) => setRegisterForm({ ...registerForm, issuerCompany: event.target.value })} /></label></div>
                <div className="form-grid-2"><label className="form-field"><span>{text("Involved project party", "Betrokken projectpartij")}</span><select value={registerForm.responsiblePartyId} onChange={(event) => { const party = parties.find((item) => item.id === event.target.value); setRegisterForm({ ...registerForm, responsiblePartyId: event.target.value, requestedTo: party?.name ?? "" }); }}><option value="">{text("Choose party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name} · {party.type}</option>)}</select></label><label className="form-field"><span>{text("Requested to / recipient name", "Gericht aan / ontvanger")}</span><input value={registerForm.requestedTo} onChange={(event) => setRegisterForm({ ...registerForm, requestedTo: event.target.value })} /></label></div>
                <div className="form-grid-2"><label className="form-field"><span>{text("Related RFI / NCR / drawing", "Gerelateerde RFI / NCR / tekening")}</span><input value={registerForm.relatedReference} onChange={(event) => setRegisterForm({ ...registerForm, relatedReference: event.target.value })} /></label><label className="form-field"><span>{text("Reference documents", "Referentiedocumenten")}</span><input value={registerForm.referenceDocuments} onChange={(event) => setRegisterForm({ ...registerForm, referenceDocuments: event.target.value })} /></label></div>
                <label className="form-field"><span>{text("Attachments and page count", "Bijlagen en aantal pagina's")}</span><input value={registerForm.attachments} onChange={(event) => setRegisterForm({ ...registerForm, attachments: event.target.value })} /></label>
                {registerForm.type === "inspection_request" ? <div className="form-grid-2"><label className="form-field"><span>{text("Inspection category", "Inspectiecategorie")}</span><select value={registerForm.inspectionCategory} onChange={(event) => setRegisterForm({ ...registerForm, inspectionCategory: event.target.value })}><option value="architectural">Architectural</option><option value="structural">Structural</option><option value="mep">MEP</option><option value="testing">Testing</option><option value="other">Other</option></select></label><div className="form-grid-2"><label className="form-field"><span>{text("Ready date", "Gereeddatum")}</span><input type="date" value={registerForm.readyDate} onChange={(event) => setRegisterForm({ ...registerForm, readyDate: event.target.value })} /></label><label className="form-field"><span>{text("Ready time", "Gereedtijd")}</span><input type="time" value={registerForm.readyTime} onChange={(event) => setRegisterForm({ ...registerForm, readyTime: event.target.value })} /></label></div></div> : null}
                {registerForm.type === "technical_instruction" ? <><div className="form-grid-2"><label className="form-field"><span>{text("Discipline", "Discipline")}</span><select value={registerForm.discipline} onChange={(event) => setRegisterForm({ ...registerForm, discipline: event.target.value })}><option value="architectural">Architectural</option><option value="structural">Structural</option><option value="electrical">Electrical</option><option value="mechanical">Mechanical</option><option value="civil">Civil</option><option value="hse">HSE</option></select></label><label className="form-field"><span>{text("Priority", "Prioriteit")}</span><select value={registerForm.priority} onChange={(event) => setRegisterForm({ ...registerForm, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div><label className="form-field"><span>{text("Reason for instruction", "Reden voor instructie")}</span><textarea rows={2} value={registerForm.reason} onChange={(event) => setRegisterForm({ ...registerForm, reason: event.target.value })} /></label><label className="form-field"><span>{text("Required action", "Vereiste actie")}</span><select value={registerForm.requiredAction} onChange={(event) => setRegisterForm({ ...registerForm, requiredAction: event.target.value })}><option value="proceed">Proceed</option><option value="stop">Stop work</option><option value="revise">Revise</option><option value="submit_revised">Submit revised document</option><option value="inspect">Carry out inspection</option><option value="other">Other</option></select></label></> : null}
                {registerForm.type === "change_order" || registerForm.type === "technical_instruction" ? <><div className="form-grid-2"><label className="form-field"><span>{text("Schedule impact", "Planningimpact")}</span><select value={registerForm.scheduleImpact} onChange={(event) => setRegisterForm({ ...registerForm, scheduleImpact: event.target.value })}><option value="none">None</option><option value="possible">Possible</option><option value="confirmed">Confirmed</option><option value="unknown">To be assessed</option></select></label><label className="form-field"><span>{text("Cost impact", "Kostenimpact")}</span><select value={registerForm.costImpact} onChange={(event) => setRegisterForm({ ...registerForm, costImpact: event.target.value })}><option value="none">None</option><option value="possible">Possible</option><option value="confirmed">Confirmed</option><option value="unknown">To be assessed</option></select></label></div><label className="form-field"><span>{text("Impact explanation", "Toelichting impact")}</span><textarea rows={2} value={registerForm.impactExplanation} onChange={(event) => setRegisterForm({ ...registerForm, impactExplanation: event.target.value })} /></label></> : null}
                {registerForm.type === "environmental_report" ? <><div className="form-grid-2"><label className="form-field"><span>{text("Period start", "Periode start")}</span><input type="date" value={registerForm.periodStart} onChange={(event) => setRegisterForm({ ...registerForm, periodStart: event.target.value })} /></label><label className="form-field"><span>{text("Period end", "Periode einde")}</span><input type="date" value={registerForm.periodEnd} onChange={(event) => setRegisterForm({ ...registerForm, periodEnd: event.target.value })} /></label></div><div className="form-grid-2"><label className="form-field"><span>{text("Lost hours", "Verloren uren")}</span><input type="number" min="0" value={registerForm.lostHours} onChange={(event) => setRegisterForm({ ...registerForm, lostHours: event.target.value })} /></label><label className="form-field"><span>{text("Reason for lost hours", "Reden verloren uren")}</span><input value={registerForm.lostHoursReason} onChange={(event) => setRegisterForm({ ...registerForm, lostHoursReason: event.target.value })} /></label></div></> : null}
                <div className="operation-alert warning"><FileCheck2 size={17} /><div><strong>{text("Numbering and metadata are automatic", "Nummering en metadata zijn automatisch")}</strong><span>{text("Project, building, issue date, author and audit history are filled from the current context. Approval, acknowledgement and signature remain explicit human actions.", "Project, gebouw, uitgiftedatum, opsteller en auditgeschiedenis komen uit de actuele context. Goedkeuring, ontvangst en ondertekening blijven expliciete menselijke acties.")}</span></div></div>
              </> : <label className="form-field"><span>{text("Involved party", "Betrokken partij")}</span><select value={registerForm.responsiblePartyId} onChange={(event) => setRegisterForm({ ...registerForm, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>}
              <button className="primary-button" type="button" disabled={busy || !reportId || registerForm.title.trim().length < 3 || !controlledFormReady} onClick={() => void addRegisterEntry()}><PackageCheck size={15} /> {controlledRegister ? text("Create controlled document", "Maak beheerd document") : text("Save register item", "Registeritem opslaan")}</button>
            </div>
          ) : null}
          <div className="boq-import-card">
            <div><span className="record-number">{text("BOQ import and progress", "BOQ-import en voortgang")}</span><h2>{text("Import the bill of quantities as a controlled project log", "Importeer de meetstaat als gecontroleerd projectlog")}</h2><p>{text("CSV columns: code, description, quantity, unit, unit rate, contract value and progress percentage. The complete import is atomic: an invalid row stores nothing.", "CSV-kolommen: code, omschrijving, hoeveelheid, eenheid, eenheidsprijs, contractbedrag en voortgangspercentage. De volledige import is atomisch: bij een ongeldige rij wordt niets opgeslagen.")}</p></div>
            <div className="boq-import-actions"><button className="secondary-button" type="button" onClick={downloadBoqCsvTemplate}><Download size={15} /> {text("Download CSV template", "Download CSV-sjabloon")}</button><label className="secondary-button file-button"><Upload size={15} /> {text("Choose BOQ file", "Kies BOQ-bestand")}<input type="file" accept="text/csv,.csv" hidden onChange={(event) => void inspectBoqFile(event.target.files?.[0] ?? null)} /></label><button className="primary-button" type="button" disabled={busy || !boqItems.length} onClick={() => void importBoq()}><PackageCheck size={15} /> {text("Import BOQ", "Importeer BOQ")}</button></div>
            {boqFile ? <span className="boq-file-summary"><strong>{boqFile.name}</strong>{boqItems.length ? ` · ${boqItems.length} ${text("validated rows", "gevalideerde regels")}` : ""}</span> : null}
            {boqError ? <span className="field-error">{boqError}</span> : null}
            {boqItems.length ? <div className="boq-preview"><span>{text("First validated lines", "Eerste gevalideerde regels")}</span>{boqItems.slice(0, 5).map((item) => <div key={`${item.code}:${item.source_row}`}><strong>{item.code}</strong><span>{item.description}</span><small>{item.quantity ?? "-"} {item.unit} · {item.progress_percent}%</small></div>)}</div> : null}
          </div>
          <div className="register-summary-grid">{Object.entries(registerNames).map(([type, label]) => <div className="register-summary" key={type}><strong>{data.registerEntries.filter((entry) => entry.register_type === type).length}</strong><span>{label}</span></div>)}</div>
          <ControlledDocumentList entries={data.registerEntries.filter((entry) => isControlledDocumentType(entry.register_type))} busy={busy} currentUserName={currentUserName} client={client} run={run} />
          <RecordList empty={text("No additional project registers yet.", "Nog geen aanvullende projectregisters.")} rows={data.registerEntries.filter((entry) => !isControlledDocumentType(entry.register_type)).map((entry) => ({ id: entry.id, icon: Wrench, title: entry.title, meta: `${entry.entry_number} · ${registerNames[entry.register_type] ?? entry.register_type} · ${formatDate(entry.occurred_at, locale)}`, status: entry.status, tone: entry.status === "closed" || entry.status === "approved" ? "green" : "" }))} />
        </section>
      ) : null}

      {tab === "visual" ? <VisualEvidenceWorkspace data={data} projectId={projectId} buildingId={buildingId} buildingName={buildingName} reportId={reportId} parties={parties} client={client} busy={busy} run={run} /> : null}

      {tab === "drawings" ? <DrawingWorkspace data={data} projectId={projectId} buildingId={buildingId} client={client} busy={busy} run={run} onOpenLinkedRecord={(recordType) => switchTab(recordType === "observation" ? "findings" : recordType === "inspection" ? "inspections" : recordType === "visual" ? "visual" : "registers")} /> : null}

      {tab === "tools" ? <FieldTools data={data} projectId={projectId} buildingId={buildingId} reportId={reportId} client={client} busy={busy} run={run} /> : null}

      {tab === "files" ? <MediaLibraryWorkspace data={data} projectId={projectId} buildingId={buildingId} buildingName={buildingName} reportId={reportId} client={client} busy={busy} run={run} initialFiles={initialCameraFiles} onInitialFilesConsumed={onInitialCameraFilesConsumed} open360Upload={() => setTab("visual")} /> : null}
    </>
  );
}

function ControlledDocumentList({ entries, busy, currentUserName, client, run }: {
  entries: OperationSnapshot["registerEntries"];
  busy: boolean;
  currentUserName: string;
  client: SupabaseClient;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const { locale, text } = useLanguage();
  const [active, setActive] = useState<string | null>(null);
  const [response, setResponse] = useState({
    decision: "approved",
    comments: "",
    respondentName: currentUserName,
    respondentPosition: "",
    respondentCompany: "CODECO N.V.",
  });
  const decisions = [
    ["approved", text("Approved", "Goedgekeurd")],
    ["conditionally_approved", text("Conditionally approved", "Voorwaardelijk goedgekeurd")],
    ["approved_with_comments", text("Approved with comments", "Goedgekeurd met opmerkingen")],
    ["clarification_needed", text("Clarification needed", "Verduidelijking nodig")],
    ["correct_and_resubmit", text("Correct and resubmit", "Corrigeren en opnieuw indienen")],
    ["rejected", text("Rejected", "Afgewezen")],
    ["acknowledged", text("Acknowledged", "Ontvangst bevestigd")],
    ["completed", text("Completed / closeout", "Voltooid / afsluiting")],
  ];
  if (!entries.length) return null;
  return (
    <section className="controlled-document-register">
      <div className="controlled-document-register-heading"><div><span className="record-number">{text("Formal client documents", "Formele klantdocumenten")}</span><h2>RFI · RFA · WIR · TI · CO · ER</h2></div><span>{entries.length} {text("controlled records", "beheerde registraties")}</span></div>
      <div className="record-stack">
        {entries.map((entry) => {
          const details = entry.details ?? {};
          const responseData = details.response && typeof details.response === "object" && !Array.isArray(details.response) ? details.response as Record<string, unknown> : {};
          return <article className="controlled-document-card" key={entry.id}>
            <div className="controlled-document-card-main"><div><span className="record-number">{entry.entry_number} · {entry.register_type.replaceAll("_", " ").toUpperCase()}</span><h3>{entry.title}</h3><p>{String(details.description ?? "")}</p><small>{formatDate(entry.occurred_at, locale)}{entry.due_at ? ` · ${text("due", "uiterlijk")} ${formatDate(entry.due_at, locale)}` : ""}{responseData.decision ? ` · ${String(responseData.decision).replaceAll("_", " ")}` : ""}</small></div><span className={`task-status ${entry.status === "approved" || entry.status === "closed" ? "green" : entry.status === "rejected" ? "red" : ""}`}>{entry.status.replaceAll("_", " ")}</span></div>
            <div className="finding-actions"><button className="secondary-button" type="button" disabled={busy} onClick={() => void import("@/lib/reports/controlled-document-pdf").then(({ downloadControlledDocumentPdf }) => downloadControlledDocumentPdf(entry))}><Download size={15} /> {text("Download client-format PDF", "Download PDF in klantformaat")}</button>{!["closed", "cancelled"].includes(entry.status) ? <button className="primary-button" type="button" disabled={busy} onClick={() => { setActive(active === entry.id ? null : entry.id); setResponse({ decision: entry.register_type === "technical_instruction" || entry.register_type === "change_order" ? "acknowledged" : "approved", comments: "", respondentName: currentUserName, respondentPosition: "", respondentCompany: "CODECO N.V." }); }}><FileCheck2 size={15} /> {text("Record formal response", "Leg formeel antwoord vast")}</button> : null}</div>
            {active === entry.id ? <div className="inline-transition controlled-response-form">
              <div className="form-grid-2"><label className="form-field"><span>{text("Decision / response code", "Besluit / antwoordcode")}</span><select value={response.decision} onChange={(event) => setResponse({ ...response, decision: event.target.value })}>{decisions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="form-field"><span>{text("Respondent name", "Naam respondent")}</span><input value={response.respondentName} onChange={(event) => setResponse({ ...response, respondentName: event.target.value })} /></label></div>
              <div className="form-grid-2"><label className="form-field"><span>{text("Position", "Functie")}</span><input value={response.respondentPosition} onChange={(event) => setResponse({ ...response, respondentPosition: event.target.value })} /></label><label className="form-field"><span>{text("Company", "Bedrijf")}</span><input value={response.respondentCompany} onChange={(event) => setResponse({ ...response, respondentCompany: event.target.value })} /></label></div>
              <label className="form-field"><span>{text("Formal comments / remarks", "Formele opmerkingen")}</span><textarea rows={3} value={response.comments} onChange={(event) => setResponse({ ...response, comments: event.target.value })} /></label>
              <button className="primary-button" type="button" disabled={busy || response.respondentName.trim().length < 2 || response.comments.trim().length < 2} onClick={() => void run(() => respondToControlledDocument(client, entry.id, response), text(`${entry.entry_number} response stored in the audit trail.`, `Antwoord op ${entry.entry_number} in de auditgeschiedenis opgeslagen.`)).then((okay) => { if (okay) setActive(null); })}>{text("Confirm human response", "Bevestig menselijk antwoord")}</button>
            </div> : null}
          </article>;
        })}
      </div>
    </section>
  );
}

function FindingPhotoStack({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const { text } = useLanguage();

  return (
    <div className="finding-photo-stack" aria-label={text("Photos attached to this issue", "Foto’s bij dit probleem")}>
      {files.map((file, index) => (
        <article key={`${file.name}:${file.size}:${file.lastModified}`}>
          <FindingPhotoPreview file={file} />
          <span><strong>{index + 1}</strong><small>{file.name}</small></span>
          <button type="button" onClick={() => onRemove(index)} aria-label={text(`Remove photo ${index + 1}`, `Verwijder foto ${index + 1}`)}><X size={14} /></button>
        </article>
      ))}
    </div>
  );
}

function FindingPhotoPreview({ file }: { file: File }) {
  const [source] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(source), [source]);
  return <NextImage src={source} alt="" width={160} height={110} unoptimized />;
}

function FindingList({ findings, progressUpdates, projectName, projectCode, buildingName, currentUserName, parties, busy, transition, recordProgress, share }: {
  findings: Finding[];
  progressUpdates: OperationSnapshot["findingProgressUpdates"];
  projectName: string;
  projectCode: string;
  buildingName: string;
  currentUserName: string;
  parties: ProjectParty[];
  busy: boolean;
  transition: (finding: Finding, nextStatus: string, note: string, finalMeasure: string) => Promise<boolean>;
  recordProgress: (finding: Finding, progressPercent: number, disposition: "validated" | "to_be_corrected" | "alternative_solution", note: string) => Promise<boolean>;
  share: (finding: Finding) => Promise<{ url: string; expiresAt: string } | null>;
}) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? findingStatusLabelsEnglish : findingStatusLabels;
  const [active, setActive] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [measure, setMeasure] = useState("");
  const [progressActive, setProgressActive] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState("0");
  const [progressDisposition, setProgressDisposition] = useState<"validated" | "to_be_corrected" | "alternative_solution">("to_be_corrected");
  const [progressNote, setProgressNote] = useState("");
  const [creatingShareFor, setCreatingShareFor] = useState<string | null>(null);
  const [externalShare, setExternalShare] = useState<{ findingId: string; url: string; expiresAt: string } | null>(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const next: Record<string, string> = { open: "in_progress", assigned: "in_progress", reopened: "in_progress", in_progress: "ready_for_verification", ready_for_verification: "closed" };
  const noteChoices: Record<string, string[]> = {
    in_progress: [text("Follow-up has started.", "Opvolging is gestart."), text("Responsible party has started the repair.", "Verantwoordelijke partij is met herstel gestart.")],
    ready_for_verification: [text("Repair completed; ready for CODECO verification.", "Herstel uitgevoerd; gereed voor CODECO-verificatie."), text("Required work completed and evidence added.", "Vereist werk uitgevoerd en bewijs toegevoegd.")],
    closed: [text("Repair inspected and accepted.", "Herstel geïnspecteerd en akkoord."), text("Finding verified against the approved requirement.", "Bevinding getoetst aan de goedgekeurde eis en akkoord.")],
  };
  const measureChoices = [
    text("Defect repaired according to the approved drawing.", "Gebrek hersteld volgens de goedgekeurde tekening."),
    text("Work completed and the area cleaned.", "Werk afgerond en de werkzone schoongemaakt."),
    text("Unsafe condition corrected and control measure applied.", "Onveilige situatie gecorrigeerd en beheersmaatregel toegepast."),
  ];
  const createShare = async (finding: Finding) => {
    setCreatingShareFor(finding.id);
    setShareFeedback("");
    const result = await share(finding);
    if (result) setExternalShare({ findingId: finding.id, ...result });
    setCreatingShareFor(null);
  };
  const externalMessage = (finding: Finding, shared: { url: string; expiresAt: string }) => [
    `CODECO werkpunt ${finding.finding_number}`,
    `${projectCode} · ${projectName}${buildingName ? ` · ${buildingName}` : ""}`,
    finding.title,
    `Deadline: ${formatDate(finding.due_at, locale)}`,
    "",
    "Open de volledige breakdown, bronfoto en antwoordknoppen zonder account:",
    shared.url,
    `Link geldig tot ${formatDate(shared.expiresAt, locale)}.`,
  ].join("\n");
  return (
    <div className="record-stack">
      {findings.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No findings yet", "Nog geen bevindingen")}</strong><span>{text("Failed inspection points and manual NCRs appear here.", "Afgekeurde inspectiepunten en handmatige NCR’s verschijnen hier.")}</span></div> : null}
      {findings.map((finding) => {
        const nextStatus = next[finding.status];
        const latestProgress = progressUpdates.find((item) => item.finding_id === finding.id);
        const issue = finding.issue_management ?? {};
        return (
          <article className="finding-card" key={finding.id}>
            <div className="finding-card-main"><span className={`record-severity ${finding.severity}`}>{finding.severity}</span><div><span className="record-number">{finding.finding_number} · {finding.finding_type.toUpperCase()}</span><h3>{finding.title}</h3><p>{finding.description}</p>{issue.action_steps ? <p className="finding-required-action"><strong>{text("Required action:", "Vereiste actie:")}</strong> {issue.action_steps}</p> : null}<small>Deadline {formatDate(finding.due_at, locale)}{latestProgress ? ` · ${text("progress", "voortgang")} ${latestProgress.progress_percent}% · ${latestProgress.disposition.replaceAll("_", " ")}` : ""}{finding.verified_at ? ` · ${text("verified", "geverifieerd")} ${formatDate(finding.verified_at, locale)}` : ""}</small></div><span className={`task-status ${finding.status === "closed" ? "green" : finding.severity === "critical" ? "red" : ""}`}>{statusLabels[finding.status] ?? finding.status}</span></div>
            <div className="finding-actions">
              <button className="external-party-button" type="button" disabled={busy || creatingShareFor === finding.id} onClick={() => void createShare(finding)}>
                {creatingShareFor === finding.id ? <Loader2 className="spin" size={17} /> : <MessageCircle size={17} />}
                <span><strong>{text("Send to external party", "Stuur naar externe partij")}</strong><small>{text("WhatsApp link · no account needed", "WhatsApp-link · geen account nodig")}</small></span>
              </button>
              <button className="secondary-button" type="button" disabled={busy} onClick={() => void import("@/lib/reports/ncr-pdf").then(({ downloadNcrPdf }) => downloadNcrPdf(finding, latestProgress, { projectName, projectCode, buildingName, issuerName: currentUserName, responsiblePartyName: parties.find((party) => party.id === finding.responsible_party_id)?.name ?? "" }))}><Download size={15} /> {text("NCR client PDF", "NCR-klant-PDF")}</button>
              {!["closed", "cancelled", "rejected"].includes(finding.status) ? <button className="secondary-button" type="button" onClick={() => { setProgressActive(progressActive === finding.id ? null : finding.id); setProgressPercent(String(latestProgress?.progress_percent ?? 0)); setProgressDisposition(latestProgress?.disposition ?? issue.disposition ?? "to_be_corrected"); }}>{text("Record inspection progress", "Inspectievoortgang vastleggen")}</button> : null}
              {nextStatus ? <button className="secondary-button" type="button" onClick={() => setActive(active === finding.id ? null : finding.id)}>{nextStatus === "closed" ? text("Verify", "Verifiëren") : nextStatus === "ready_for_verification" ? text("Mark repair ready", "Herstel gereedmelden") : text("Update status", "Status bijwerken")}</button> : null}
            </div>
            {externalShare?.findingId === finding.id ? (
              <section className="external-share-preflight" aria-label={text("External party link ready", "Link voor externe partij klaar")}>
                <div className="external-share-preflight-heading"><span><Link2 size={18} /></span><div><strong>{text("Ready to send · recipient needs no account", "Klaar om te sturen · ontvanger heeft geen account nodig")}</strong><small>{text("Only this workpoint and its evidence are shared.", "Alleen dit werkpunt en het bijbehorende bewijs worden gedeeld.")}</small></div><button type="button" aria-label={text("Close external link panel", "Sluit extern-linkpaneel")} onClick={() => setExternalShare(null)}><X size={16} /></button></div>
                <ul>
                  <li>{text("Sees project, building, workpoint, priority, deadline and source photo.", "Ziet project, gebouw, werkpunt, prioriteit, deadline en bronfoto.")}</li>
                  <li>{text("Can report completion or a problem with one tap.", "Kan met één tik gereedmelden of een probleem terugmelden.")}</li>
                  <li>{text("Can take and attach a correction photo directly.", "Kan direct een correctiefoto maken en meesturen.")}</li>
                </ul>
                <label><span>{text("Secure link · expires", "Beveiligde link · vervalt")} {formatDate(externalShare.expiresAt, locale)}</span><input readOnly value={externalShare.url} onFocus={(event) => event.currentTarget.select()} /></label>
                {shareFeedback ? <p className="external-share-feedback" role="status">{shareFeedback}</p> : null}
                <div className="external-share-preflight-actions">
                  <button className="secondary-button" type="button" onClick={() => void copyToClipboard(externalShare.url).then(() => setShareFeedback(text("Link copied.", "Link gekopieerd."))).catch((error) => setShareFeedback(messageFrom(error)))}><Copy size={16} /> {text("Copy link", "Kopieer link")}</button>
                  <button className="whatsapp-button" type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(externalMessage(finding, externalShare))}`, "_blank", "noopener,noreferrer")}><MessageCircle size={17} /> {text("Open WhatsApp and send", "Open WhatsApp en stuur")}</button>
                </div>
              </section>
            ) : null}
            {progressActive === finding.id ? (
              <div className="inline-transition issue-progress-form">
                <div className="form-grid-2"><label className="form-field"><span>{text("Progress at this inspection", "Voortgang bij deze inspectie")}</span><input type="number" min="0" max="100" step="1" value={progressPercent} onChange={(event) => setProgressPercent(event.target.value)} /></label><label className="form-field"><span>{text("Disposition", "Beoordeling")}</span><select value={progressDisposition} onChange={(event) => setProgressDisposition(event.target.value as typeof progressDisposition)}><option value="validated">{text("Validated", "Gevalideerd")}</option><option value="to_be_corrected">{text("To be corrected", "Te corrigeren")}</option><option value="alternative_solution">{text("Alternative solution", "Alternatieve oplossing")}</option></select></label></div>
                <label className="form-field"><span>{text("Inspection note", "Inspectienotitie")}</span><textarea rows={2} value={progressNote} onChange={(event) => setProgressNote(event.target.value)} /></label>
                <button className="primary-button" type="button" disabled={busy || Number(progressPercent) < 0 || Number(progressPercent) > 100 || progressNote.trim().length < 2} onClick={() => void recordProgress(finding, Number(progressPercent), progressDisposition, progressNote).then((okay) => { if (okay) { setProgressActive(null); setProgressNote(""); } })}>{text("Save dated progress point", "Sla gedateerd voortgangspunt op")}</button>
              </div>
            ) : null}
            {active === finding.id && nextStatus ? (
              <div className="inline-transition">
                {nextStatus === "ready_for_verification" ? <><div className="quick-issue-presets" aria-label={text("Choose the completed measure", "Kies de uitgevoerde maatregel")}>{measureChoices.map((choice) => <button className={measure === choice ? "active" : ""} type="button" onClick={() => setMeasure(choice)} key={choice}>{choice}</button>)}</div><label className="form-field"><span>{text("Final measure", "Definitieve maatregel")}</span><textarea rows={2} value={measure} onChange={(event) => setMeasure(event.target.value)} /></label></> : null}
                <div className="quick-issue-presets" aria-label={text("Choose a status note", "Kies een statusnotitie")}>{(noteChoices[nextStatus] ?? []).map((choice) => <button className={note === choice ? "active" : ""} type="button" onClick={() => setNote(choice)} key={choice}>{choice}</button>)}</div>
                <label className="form-field"><span>{nextStatus === "closed" ? text("Verification finding", "Verificatiebevinding") : text("Comment", "Toelichting")}</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label>
                <button className="primary-button" type="button" disabled={busy || note.trim().length < 2 || (nextStatus === "ready_for_verification" && measure.trim().length < 3)} onClick={() => void transition(finding, nextStatus, note, measure).then((okay) => { if (okay) { setActive(null); setNote(""); setMeasure(""); } })}>{text("Confirm human status change", "Bevestig menselijke statuswijziging")}</button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function ReportOperations({ data, reportId, reportNumber, reportStatus, currentUserName, projectId, projectName, busy, run, client }: { data: OperationSnapshot; reportId: string | null; reportNumber: string; reportStatus: string; currentUserName: string; projectId: string; projectName: string; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>; client: SupabaseClient }) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? reportStatusLabelsEnglish : reportStatusLabels;
  const [reviewComment, setReviewComment] = useState("");
  const [signerRole, setSignerRole] = useState("supervisor");
  const [declaration, setDeclaration] = useState(() => text("I declare that I reviewed this fixed report version and confirmed it truthfully.", "Ik verklaar dat ik deze vastgezette rapportversie heb gecontroleerd en naar waarheid heb bevestigd."));
  const [distribution, setDistribution] = useState({ name: "", address: "", channel: "manual" });
  const [revisionReason, setRevisionReason] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date());
  const [period, setPeriod] = useState({ start: `${today.slice(0, 8)}01`, end: today });
  const reportChoices: Array<{ id: string; title: string; sections: PeriodReportSection[] }> = [
    { id: "complete", title: text("Complete project report", "Compleet projectrapport"), sections: ["management", "workforce", "work", "quality", "hse", "actions", "logistics", "instructions", "commercial", "communications", "requests", "boq", "visual", "documents", "environment", "buildings"] },
    { id: "management", title: text("Management report", "Managementrapport"), sections: ["management", "workforce", "work", "actions", "commercial"] },
    { id: "execution", title: text("Execution and progress", "Uitvoering & voortgang"), sections: ["management", "workforce", "work", "logistics", "visual"] },
    { id: "quality", title: text("Quality and HSE", "Kwaliteit & HSE"), sections: ["quality", "hse", "environment", "actions", "visual", "buildings"] },
    { id: "contract", title: text("Contract and decisions", "Contract & besluiten"), sections: ["management", "instructions", "commercial", "communications", "requests", "documents", "boq"] },
    { id: "visual", title: text("Visual progress report", "Visueel voortgangsrapport"), sections: ["visual", "work"] },
  ];
  const [reportChoice, setReportChoice] = useState("complete");
  const [periodLabel, setPeriodLabel] = useState(() => text("Monthly supervision report", "Maandelijks supervisierapport"));
  const selectedReport = reportChoices.find((choice) => choice.id === reportChoice) ?? reportChoices[0];
  const applyDatePreset = (days: number, label: string) => {
    const start = new Date(`${today}T12:00:00-03:00`);
    start.setDate(start.getDate() - Math.max(0, days - 1));
    setPeriod({ start: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(start), end: today });
    setPeriodLabel(label);
  };
  const canReview = reportStatus === "ready_for_review" || reportStatus === "in_review";
  const canSign = reportStatus === "approved" || reportStatus === "signed";
  const canDistribute = reportStatus === "signed" || reportStatus === "sent";
  return (
    <>
      <header className="secondary-header"><div><p className="eyebrow">{text("Formal report workflow", "Formele rapportworkflow")}</p><h1>{reportNumber}</h1><p>{text("Immutable version, review, declarations, distribution and revision history.", "Immutable versie, review, verklaringen, distributie en revisiehistorie.")}</p></div><span className={`report-state-pill ${reportStatus}`}>{statusLabels[reportStatus] ?? reportStatus}</span></header>
      <section className="period-report-card">
        <div className="workflow-icon"><CalendarRange size={20} /></div>
        <div className="period-report-copy"><span className="record-number">{text("Required client period report", "Verplicht klant-perioderapport")}</span><h2>{text("Daily, weekly, monthly or freely selected period", "Dagelijks, wekelijks, maandelijks of vrij gekozen periode")}</h2><p>{text("The PDF is generated from one permission-filtered server snapshot and includes workforce, progress, inspections, findings/NCR, HSE, deliveries, delays, technical instructions, change orders, agreements, deadlines and visual evidence.", "De PDF komt uit één rechten-gefilterde servermomentopname en bevat bezetting, voortgang, inspecties, bevindingen/NCR, HSE, leveringen, vertragingen, technische instructies, change orders, afspraken, deadlines en visueel bewijs.")}</p></div>
        <div className="period-report-types" role="radiogroup" aria-label={text("Report type", "Rapporttype")}>{reportChoices.map((choice) => <button className={reportChoice === choice.id ? "active" : ""} type="button" role="radio" aria-checked={reportChoice === choice.id} onClick={() => setReportChoice(choice.id)} key={choice.id}><strong>{choice.title}</strong><span>{choice.sections.length} {text("automatic sections", "automatische onderdelen")}</span></button>)}</div>
        <div className="period-date-presets"><button type="button" onClick={() => applyDatePreset(1, text("Daily supervision report", "Dagelijks supervisierapport"))}>{text("Daily format", "Dagformaat")}</button><button type="button" onClick={() => applyDatePreset(7, text("Weekly supervision report", "Wekelijks supervisierapport"))}>{text("Weekly format", "Weekformaat")}</button><button type="button" onClick={() => { setPeriod({ start: `${today.slice(0, 8)}01`, end: today }); setPeriodLabel(text("Monthly supervision report", "Maandelijks supervisierapport")); }}>{text("Monthly format", "Maandformaat")}</button></div>
        <label className="form-field"><span>{text("From", "Van")}</span><input type="date" value={period.start} max={period.end} onChange={(event) => { setPeriod({ ...period, start: event.target.value }); setPeriodLabel(text("Period supervision report", "Supervisierapport over periode")); }} /></label>
        <label className="form-field"><span>{text("Through", "Tot en met")}</span><input type="date" value={period.end} min={period.start} max={today} onChange={(event) => { setPeriod({ ...period, end: event.target.value }); setPeriodLabel(text("Period supervision report", "Supervisierapport over periode")); }} /></label>
        <button className="primary-button" type="button" disabled={busy || !period.start || !period.end || period.end < period.start} onClick={() => void run(async () => { const snapshot = await buildPeriodReportSnapshot(client, projectId, period.start, period.end); const { downloadPeriodReportPdf } = await import("@/lib/reports/period-report-pdf"); await downloadPeriodReportPdf(snapshot, { sections: selectedReport.sections, reportTitle: `${periodLabel} · ${selectedReport.title}` }); }, text(`${periodLabel} for ${projectName} downloaded.`, `${periodLabel} voor ${projectName} gedownload.`))}><FileText size={15} /> {text("Create selected report", "Maak gekozen rapport")}</button>
      </section>
      {!reportId ? <div className="operation-alert warning"><AlertTriangle size={18} /> {text("Start the daily report through Project start first.", "Start eerst het dagrapport via Projectstart.")}</div> : null}
      <section className="workflow-grid">
        <div className="workflow-card"><div className="workflow-icon"><ClipboardCheck size={19} /></div><h2>1. Review</h2><p>{text("An authorized reviewer approves or returns the report with a reason. Approval automatically freezes the complete snapshot with SHA-256.", "Een bevoegde reviewer keurt goed of stuurt gemotiveerd terug. Bij goedkeuring bevriest de database automatisch de volledige momentopname met SHA-256.")}</p><label className="form-field"><span>{text("Review comment", "Reviewcommentaar")}</span><textarea rows={3} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /></label><div className="button-row"><button className="secondary-button" type="button" disabled={busy || !reportId || !canReview || reviewComment.trim().length < 2} onClick={() => void run(() => reviewReport(client, reportId!, "returned", reviewComment), text("Report returned for correction with a reason.", "Rapport gemotiveerd teruggestuurd voor correctie."))}>{text("Return", "Terugsturen")}</button><button className="primary-button" type="button" disabled={busy || !reportId || !canReview || reviewComment.trim().length < 2} onClick={() => void run(() => reviewReport(client, reportId!, "approved", reviewComment), text("Report approved and frozen as an immutable version.", "Rapport goedgekeurd en als immutable versie vastgezet."))}><FileCheck2 size={15} /> {text("Approve and freeze", "Goedkeuren & vastzetten")}</button></div></div>
        <div className="workflow-card"><div className="workflow-icon"><FileCheck2 size={19} /></div><h2>2. {text("Signing declaration", "Ondertekenverklaring")}</h2><p>{text("Identity, project role, version hash and declaration remain append-only. The legal level remains", "Identiteit, projectrol, versiehash en verklaring blijven append-only bewaard. Het juridische niveau blijft")} <strong>contract pending</strong> {text("until CODECO formally decides.", "totdat CODECO dit formeel kiest.")}</p><label className="form-field"><span>{text("Sign as", "Onderteken als")}</span><select value={signerRole} onChange={(event) => setSignerRole(event.target.value)}><option value="supervisor">Supervisor</option><option value="project_manager">{text("Project manager", "Projectleider")}</option><option value="lead_supervisor">Lead supervisor</option><option value="contractor">{text("Contractor", "Aannemer")}</option><option value="client">{text("Client", "Opdrachtgever")}</option><option value="quality_hse_manager">{text("Quality/HSE", "Kwaliteit/HSE")}</option></select></label><label className="form-field"><span>{text("Declaration", "Verklaring")}</span><textarea rows={3} value={declaration} onChange={(event) => setDeclaration(event.target.value)} /></label><button className="primary-button" type="button" disabled={busy || !reportId || !canSign || declaration.trim().length < 10} onClick={() => void run(() => signReport(client, reportId!, signerRole, currentUserName, declaration), text("Signing declaration immutably linked to the report version.", "Ondertekenverklaring onveranderbaar aan de rapportversie gekoppeld."))}><FileCheck2 size={15} /> {text("Record declaration", "Verklaring vastleggen")}</button></div>
        <div className="workflow-card"><div className="workflow-icon"><Users size={19} /></div><h2>3. {text("Distribution", "Distributie")}</h2><p>{text("Only record a delivery that actually occurred. Without an email connector, the app does not claim automatic delivery.", "Registreer alleen een verzending die werkelijk heeft plaatsgevonden. De app claimt zonder e-mailconnector geen automatische bezorging.")}</p><label className="form-field"><span>{text("Recipient", "Ontvanger")}</span><input value={distribution.name} onChange={(event) => setDistribution({ ...distribution, name: event.target.value })} /></label><label className="form-field"><span>{text("Address / reference", "Adres / referentie")}</span><input value={distribution.address} onChange={(event) => setDistribution({ ...distribution, address: event.target.value })} /></label><label className="form-field"><span>{text("Channel", "Kanaal")}</span><select value={distribution.channel} onChange={(event) => setDistribution({ ...distribution, channel: event.target.value })}><option value="manual">{text("Manual transfer", "Handmatige overdracht")}</option><option value="email">{text("Email (sent externally)", "E-mail (extern verzonden)")}</option><option value="download">{text("Secure download", "Beveiligde download")}</option></select></label><button className="primary-button" type="button" disabled={busy || !reportId || !canDistribute || distribution.name.trim().length < 2 || distribution.address.trim().length < 3} onClick={() => void run(() => recordDistribution(client, reportId!, distribution.name, distribution.address, distribution.channel), text("Traceable distribution record added to the fixed version.", "Aantoonbare distributieregel aan de vastgezette versie toegevoegd."))}><FileText size={15} /> {text("Record distribution", "Distributie registreren")}</button></div>
      </section>
      <section className="report-history-grid">
        <HistoryColumn title={text("Fixed versions", "Vastgezette versies")} empty={text("No immutable version yet.", "Nog geen immutable versie.")} rows={data.reportVersions.map((version) => <div className="history-version" key={version.id}><span>{text("Revision", "Revisie")} {version.revision} · {formatDate(version.created_at, locale)} · SHA {version.sha256.slice(0, 12)}…</span><button className="secondary-button" type="button" disabled={busy} onClick={() => void run(async () => { const { downloadFormalReportPdf } = await import("@/lib/reports/daily-report-pdf"); await downloadFormalReportPdf(version.snapshot as FormalReportSnapshot, version.revision, version.sha256); }, text(`Formal revision ${version.revision} downloaded directly from the immutable snapshot.`, `Formele revisie ${version.revision} rechtstreeks uit de immutable snapshot gedownload.`))}><FileText size={14} /> {text("Formal PDF", "Formele PDF")}</button></div>)} />
        <HistoryColumn title="Reviews" empty={text("No review decision yet.", "Nog geen reviewbesluit.")} rows={data.reportReviews.map((review) => `${statusLabels[review.decision] ?? review.decision} · ${review.comment} · ${formatDate(review.created_at, locale)}`)} />
        <HistoryColumn title={text("Declarations", "Verklaringen")} empty={text("No signing declaration yet.", "Nog geen ondertekenverklaring.")} rows={data.reportSignatures.map((signature) => `${signature.signer_name} · ${signature.signer_role} · ${formatDate(signature.signed_at, locale)}`)} />
        <HistoryColumn title={text("Distribution", "Distributie")} empty={text("No delivery recorded yet.", "Nog geen verzending geregistreerd.")} rows={data.reportDistributions.map((item) => `${item.recipient_name} · ${item.channel} · ${item.status}`)} />
      </section>
      {reportStatus === "approved" || reportStatus === "signed" || reportStatus === "sent" ? <div className="revision-bar"><div><strong>{text("Correction after freezing?", "Correctie na vastzetten?")}</strong><span>{text("The original version remains; corrections start a new revision.", "De oorspronkelijke versie blijft bestaan; correcties starten een nieuwe revisie.")}</span></div><input value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder={text("Required revision reason", "Verplichte revisiereden")} /><button className="secondary-button" type="button" disabled={busy || !reportId || revisionReason.trim().length < 5} onClick={() => void run(() => startRevision(client, reportId!, revisionReason), text("New report revision started; the original version remains immutable.", "Nieuwe rapportrevisie gestart; de oorspronkelijke versie blijft immutable."))}><RotateCcw size={15} /> {text("Start revision", "Start revisie")}</button></div> : null}
    </>
  );
}

function AdminOperations({ data, client, organizationId, projectId, projectName, reportStatus, buildingId, buildingName, parties, canManageOrganization, openUserAdmin, openProjectArea, busy, run }: { data: OperationSnapshot; client: SupabaseClient; organizationId: string; projectId: string; projectName: string; reportStatus: string; buildingId: string; buildingName: string; parties: ProjectParty[]; canManageOrganization: boolean; openUserAdmin: () => void; openProjectArea: (tab: "inspections" | "findings" | "visual") => void; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const { text } = useLanguage();
  const [section, setSection] = useState<"overview" | "settings" | "structure" | "templates" | "backup">("overview");
  const [template, setTemplate] = useState({ module: "inspection", code: "", name: "", prompts: "" });
  const [settings, setSettings] = useState(() => ({ maxFileSizeMb: data.settings?.max_file_size_mb ?? 25, leadHours: data.settings?.notification_lead_hours ?? 24, retentionDays: data.settings?.retention_days?.toString() ?? "", reportPrefix: data.settings?.report_prefix ?? "DR", pushNotificationsEnabled: data.settings?.push_notifications_enabled ?? true }));
  const [location, setLocation] = useState({ type: "zone", code: "", name: "", parentId: "", description: "" });
  const [party, setParty] = useState({ type: "contractor", code: "", name: "" });
  const [libraryCategory, setLibraryCategory] = useState("all");
  const fileInput = useRef<HTMLInputElement>(null);
  const latestScheduledBackup = data.backupRuns.find((item) => item.run_type === "scheduled" && item.status === "verified");
  const latestRestoreTest = data.backupRuns.find((item) => item.run_type === "restore_test" && item.status === "dry_run_passed");
  const openFindings = data.findings.filter((item) => !["closed", "cancelled"].includes(item.status));
  const criticalFindings = openFindings.filter((item) => item.severity === "critical" || item.severity === "high");
  const activeInspections = data.inspections.filter((item) => item.status === "planned" || item.status === "in_progress" || item.status === "failed");
  const addTemplate = () => {
    const prompts = template.prompts.split("\n").map((value) => value.trim()).filter(Boolean);
    if (template.code.trim().length < 2 || template.name.trim().length < 3 || prompts.length === 0) return;
    void run(() => createChecklist(client, { organizationId, projectId, module: template.module, code: template.code, name: template.name, prompts }), text("Project checklist published; existing inspection results remain linked to their previous version.", "Projectchecklist gepubliceerd; bestaande inspectieresultaten blijven aan hun oude versie gekoppeld.")).then((okay) => { if (okay) setTemplate({ module: "inspection", code: "", name: "", prompts: "" }); });
  };
  return (
    <>
      <header className="secondary-header"><div><p className="eyebrow">{text("Management workspace", "Managementwerkruimte")} · {projectName}</p><h1>{section === "overview" ? text("Management overview", "Managementoverzicht") : text("Administration and control", "Beheer en controle")}</h1><p>{text("Decisions, access, project standards and continuity in one place.", "Besluiten, toegang, projectstandaarden en continuïteit op één plek.")}</p></div>{canManageOrganization ? <button className="primary-button" type="button" onClick={openUserAdmin}><Users size={15} /> {text("Manage team", "Team beheren")}</button> : null}</header>
      <div className="operation-tabs admin-tabs">{[["overview", text("Overview", "Overzicht")], ["settings", text("Team & rules", "Team & regels")], ["structure", text("Project setup", "Projectinrichting")], ["templates", text("Quality standards", "Kwaliteitsstandaarden")], ["backup", text("Backup & continuity", "Back-up & continuïteit")]].map(([id, label]) => <button className={section === id ? "active" : ""} type="button" onClick={() => setSection(id as typeof section)} key={id}>{label}</button>)}</div>
      {section === "overview" ? <section className="management-overview">
        <div className="management-kpis">
          <button className={data.settings ? "healthy" : "attention"} type="button" onClick={() => setSection("settings")}><span>{text("Project configuration", "Projectconfiguratie")}</span><strong>{data.settings ? text("Active", "Actief") : text("Missing", "Ontbreekt")}</strong><small>{data.settings ? text("Central project rules are stored", "Centrale projectregels zijn opgeslagen") : text("Project rules require configuration", "Projectregels moeten worden ingesteld")}</small></button>
          <button className={criticalFindings.length ? "attention" : ""} type="button" onClick={() => openProjectArea("findings")}><span>{text("High-risk findings", "Hoog-risico bevindingen")}</span><strong>{criticalFindings.length}</strong><small>{openFindings.length} {text("findings still open", "bevindingen nog open")}</small></button>
          <button type="button" onClick={() => openProjectArea("inspections")}><span>{text("Active control work", "Actief controlewerk")}</span><strong>{activeInspections.length}</strong><small>{data.inspections.length} {text("inspections recorded", "inspecties geregistreerd")}</small></button>
          <button className={latestScheduledBackup ? "healthy" : "attention"} type="button" onClick={() => setSection("backup")}><span>{text("Continuity", "Continuïteit")}</span><strong>{latestScheduledBackup ? text("Verified", "Geverifieerd") : text("Pending", "Openstaand")}</strong><small>{latestScheduledBackup ? formatDate(latestScheduledBackup.verified_at) : text("Verified backup required", "Geverifieerde back-up vereist")}</small></button>
        </div>
        <div className="management-columns">
          <article className="management-card"><header><div><span className="module-card-icon"><AlertTriangle size={18} /></span><div><h2>{text("Management attention", "Managementaandacht")}</h2><p>{text("Items that may block delivery or control.", "Punten die oplevering of beheersing kunnen blokkeren.")}</p></div></div></header><div className="management-attention-list">{criticalFindings.length ? criticalFindings.slice(0, 4).map((item) => <div key={item.id}><span className="risk-dot" /><span><strong>{item.title}</strong><small>{item.finding_number} · {item.status.replaceAll("_", " ")}</small></span></div>) : <div className="management-clear"><CheckCircle2 size={18} /><span><strong>{text("No high-risk findings", "Geen hoog-risico bevindingen")}</strong><small>{text("Continue monitoring open work.", "Blijf openstaand werk volgen.")}</small></span></div>}</div></article>
          <article className="management-card"><header><div><span className="module-card-icon"><Settings size={18} /></span><div><h2>{text("Management controls", "Managementbediening")}</h2><p>{text("Go directly to the area you need to manage.", "Ga direct naar het onderdeel dat je wilt beheren.")}</p></div></div></header><div className="management-control-list"><button type="button" onClick={openUserAdmin}><Users size={16} /><span><strong>{text("Team and access", "Team en toegang")}</strong><small>{text("Invite, suspend and review roles", "Uitnodigen, opschorten en rollen controleren")}</small></span></button><button type="button" onClick={() => setSection("settings")}><Settings size={16} /><span><strong>{text("Project rules", "Projectregels")}</strong><small>{text("Reporting, deadlines and retention", "Rapportage, deadlines en bewaartermijn")}</small></span></button><button type="button" onClick={() => setSection("structure")}><Wrench size={16} /><span><strong>{text("Structure and parties", "Structuur en partijen")}</strong><small>{text("Locations, contractors and consultants", "Locaties, aannemers en adviseurs")}</small></span></button><button type="button" onClick={() => setSection("backup")}><DatabaseBackup size={16} /><span><strong>{text("Continuity controls", "Continuïteitscontrole")}</strong><small>{text("Backups and restore verification", "Back-ups en herstelverificatie")}</small></span></button></div></article>
        </div>
        <div className="management-context"><div><span>{text("Current report", "Huidig rapport")}</span><strong>{reportStatus.replaceAll("_", " ")}</strong></div><div><span>{text("Project locations", "Projectlocaties")}</span><strong>{data.locationNodes.length}</strong></div><div><span>{text("Published checklists", "Gepubliceerde checklists")}</span><strong>{data.templates.filter((item) => item.status === "published").length}</strong></div><div><span>{text("Controlled files", "Beheerde bestanden")}</span><strong>{data.files.length}</strong></div></div>
      </section> : null}
      {section === "settings" ? <section className="operation-panel"><div className="admin-card-grid">{canManageOrganization ? <button className="module-card" type="button" onClick={openUserAdmin}><span className="module-card-icon"><Users size={19} /></span><h2>{text("Users and access", "Gebruikers en toegang")}</h2><p>{text("Only administrators create internal accounts and assign organization or project roles.", "Alleen beheerders maken interne accounts en wijzen organisatie- of projectrollen toe.")}</p></button> : null}<MfaSecurityCard client={client} /><div className="operation-form"><h2>{text("Project rules", "Projectregels")}</h2><div className="form-grid-2"><label className="form-field"><span>{text("Report prefix", "Rapportprefix")}</span><input value={settings.reportPrefix} onChange={(event) => setSettings({ ...settings, reportPrefix: event.target.value.toUpperCase() })} /></label><label className="form-field"><span>{text("File limit (MB)", "Bestandslimiet (MB)")}</span><input type="number" min="1" max="100" value={settings.maxFileSizeMb} onChange={(event) => setSettings({ ...settings, maxFileSizeMb: Number(event.target.value) })} /></label><label className="form-field"><span>{text("Reminder before deadline (hours)", "Herinnering vóór deadline (uur)")}</span><input type="number" min="1" max="720" value={settings.leadHours} onChange={(event) => setSettings({ ...settings, leadHours: Number(event.target.value) })} /></label><label className="form-field"><span>{text("Retention period (days)", "Bewaartermijn (dagen)")}</span><input type="number" min="30" value={settings.retentionDays} onChange={(event) => setSettings({ ...settings, retentionDays: event.target.value })} placeholder={text("Client decision required", "Klantbesluit vereist")} /></label></div><label className="confirmation-check"><input type="checkbox" checked={settings.pushNotificationsEnabled} onChange={(event) => setSettings({ ...settings, pushNotificationsEnabled: event.target.checked })} /><span><strong>{text("Automatic push notifications for deadlines", "Automatische pushmeldingen voor deadlines")}</strong><small>{text("Users activate delivery once per device; the in-app inbox keeps the auditable copy.", "Gebruikers activeren bezorging één keer per apparaat; de inbox bewaart de auditeerbare kopie.")}</small></span></label><button className="primary-button" type="button" disabled={busy || !data.settings} onClick={() => data.settings && void run(() => saveProjectSettings(client, data.settings!, { report_prefix: settings.reportPrefix, max_file_size_mb: settings.maxFileSizeMb, notification_lead_hours: settings.leadHours, push_notifications_enabled: settings.pushNotificationsEnabled, email_notifications_enabled: false, retention_days: settings.retentionDays ? Number(settings.retentionDays) : null }), text("Project rules stored centrally and audited.", "Projectregels centraal opgeslagen en geaudit."))}><Settings size={15} /> {text("Save rules", "Regels opslaan")}</button></div></div></section> : null}
      {section === "structure" ? <section className="operation-panel"><div className="admin-card-grid"><div className="operation-form"><h2>Locatieboom · {buildingName}</h2><div className="form-grid-2"><label className="form-field"><span>Type</span><select value={location.type} onChange={(event) => setLocation({ ...location, type: event.target.value })}><option value="zone">Zone</option><option value="floor">Verdieping</option><option value="room">Ruimte</option><option value="element">Element</option><option value="work_package">Werkpakket</option></select></label><label className="form-field"><span>Code</span><input value={location.code} onChange={(event) => setLocation({ ...location, code: event.target.value })} /></label></div><label className="form-field"><span>Naam</span><input value={location.name} onChange={(event) => setLocation({ ...location, name: event.target.value })} /></label><label className="form-field"><span>Bovenliggende locatie</span><select value={location.parentId} onChange={(event) => setLocation({ ...location, parentId: event.target.value })}><option value="">Direct onder {buildingName}</option>{data.locationNodes.filter((node) => node.building_id === buildingId).map((node) => <option value={node.id} key={node.id}>{node.code} · {node.name}</option>)}</select></label><label className="form-field"><span>Toelichting</span><input value={location.description} onChange={(event) => setLocation({ ...location, description: event.target.value })} /></label><button className="primary-button" type="button" disabled={busy || location.code.trim().length < 1 || location.name.trim().length < 2} onClick={() => void run(() => createLocationNode(client, { organizationId, projectId, buildingId, parentId: location.parentId, type: location.type, code: location.code, name: location.name, description: location.description }), "Locatie aan de vaste projecthiërarchie toegevoegd.").then((okay) => { if (okay) setLocation({ type: "zone", code: "", name: "", parentId: "", description: "" }); })}><Plus size={15} /> Locatie toevoegen</button><div className="compact-register">{data.locationNodes.filter((node) => node.building_id === buildingId).map((node) => <span key={node.id}><strong>{node.code}</strong> {node.name} · {node.node_type}</span>)}</div></div><div className="operation-form"><h2>Projectpartijen</h2><div className="form-grid-2"><label className="form-field"><span>Type</span><select value={party.type} onChange={(event) => setParty({ ...party, type: event.target.value })}><option value="client">Opdrachtgever</option><option value="supervisor">Supervisor</option><option value="contractor">Aannemer</option><option value="subcontractor">Onderaannemer</option><option value="supplier">Leverancier</option><option value="consultant">Adviseur</option><option value="other">Overig</option></select></label><label className="form-field"><span>Code</span><input value={party.code} onChange={(event) => setParty({ ...party, code: event.target.value })} /></label></div><label className="form-field"><span>Naam</span><input value={party.name} onChange={(event) => setParty({ ...party, name: event.target.value })} /></label><button className="primary-button" type="button" disabled={busy || party.code.trim().length < 1 || party.name.trim().length < 2} onClick={() => void run(() => createProjectParty(client, { organizationId, projectId, code: party.code, name: party.name, type: party.type }), "Projectpartij centraal toegevoegd en beschikbaar voor aanwezigheid en toewijzing.").then((okay) => { if (okay) setParty({ type: "contractor", code: "", name: "" }); })}><Users size={15} /> Partij toevoegen</button><div className="compact-register">{parties.map((item) => <span key={item.id}><strong>{item.name}</strong> {item.type}</span>)}</div></div></div></section> : null}
      {section === "templates" ? (
        <section className="operation-panel checklist-management">
          <div className="checklist-library-header">
            <div><span className="record-number">{text("Client requirement", "Klanteis")}</span><h2>{text(`${data.checklistLibrary.length} ready-to-install construction checklists`, `${data.checklistLibrary.length} direct installeerbare bouwchecklists`)}</h2><p>{text("Choose a standard. Installation creates a published, project-specific version with all required checkpoints; completed inspections always keep their original version.", "Kies een standaard. Installatie maakt een gepubliceerde, projectspecifieke versie met alle vereiste controlepunten; afgeronde inspecties behouden altijd hun oorspronkelijke versie.")}</p></div>
            <label className="form-field"><span>{text("Category", "Categorie")}</span><select value={libraryCategory} onChange={(event) => setLibraryCategory(event.target.value)}><option value="all">{text(`All ${data.checklistLibrary.length}`, `Alle ${data.checklistLibrary.length}`)}</option>{[...new Set(data.checklistLibrary.map((item) => item.category))].map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
          </div>
          <div className="checklist-library-grid">
            {data.checklistLibrary.filter((item) => libraryCategory === "all" || item.category === libraryCategory).map((item) => {
              const installed = data.templates.some((templateItem) => templateItem.project_id === projectId && templateItem.code === item.code && templateItem.status === "published");
              return <article className="checklist-library-card" key={item.code}><span>{item.code} · {item.category}</span><h3>{item.name}</h3><p>{item.description}</p><small>{item.prompts.length} {text("mandatory checkpoints", "verplichte controlepunten")} · {item.module}</small><button className={installed ? "secondary-button" : "primary-button"} type="button" disabled={busy || installed} onClick={() => void run(() => installChecklistLibraryTemplate(client, projectId, item.code), text(`${item.name} installed as a project checklist.`, `${item.name} als projectchecklist geïnstalleerd.`))}>{installed ? <CheckCircle2 size={15} /> : <Plus size={15} />} {installed ? text("Installed", "Geïnstalleerd") : text("Install checklist", "Installeer checklist")}</button></article>;
            })}
          </div>
          <details className="custom-checklist-details"><summary>{text("Create a custom project checklist", "Maak een eigen projectchecklist")}</summary><div className="operation-form"><h2>{text("Publish new project checklist", "Nieuwe projectchecklist publiceren")}</h2><div className="form-grid-2"><label className="form-field"><span>{text("Module", "Module")}</span><select value={template.module} onChange={(event) => setTemplate({ ...template, module: event.target.value })}><option value="inspection">{text("Inspection", "Inspectie")}</option><option value="hse">HSE</option><option value="delivery">{text("Delivery", "Levering")}</option><option value="test">{text("Test / measurement", "Test / meting")}</option></select></label><label className="form-field"><span>Code</span><input value={template.code} onChange={(event) => setTemplate({ ...template, code: event.target.value })} placeholder={text("For example CONC-01", "Bijv. BETON-01")} /></label></div><label className="form-field"><span>{text("Name", "Naam")}</span><input value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} /></label><label className="form-field"><span>{text("Checkpoints · one per line", "Controlepunten · één per regel")}</span><textarea rows={6} value={template.prompts} onChange={(event) => setTemplate({ ...template, prompts: event.target.value })} /></label><button className="primary-button" type="button" disabled={busy} onClick={addTemplate}><Plus size={15} /> {text("Publish checklist", "Checklist publiceren")}</button></div></details>
          <div className="template-grid">{data.templates.map((item) => <article className="template-card" key={item.id}><span>{item.module.toUpperCase()} · {item.code} · v{item.version_number}</span><h3>{item.name}</h3><p>{item.items.length} {text("checkpoints", "controlepunten")} · {item.status}</p></article>)}</div>
        </section>
      ) : null}
      {section === "backup" ? <section className="operation-panel"><div className="storage-status-grid"><div className={`storage-status-card ${isStorageGatewayConfigured ? "" : "blocked"}`}><HardDrive size={21} /><div><strong>Vercel Blob</strong><span>{isStorageGatewayConfigured ? text("Private same-origin storage routes active", "Private opslagroutes binnen dezelfde app actief") : text("Connect a private Blob store in Vercel", "Koppel een private Blob-store in Vercel")}</span></div></div><div className={`storage-status-card ${latestScheduledBackup ? "" : "blocked"}`}><DatabaseBackup size={21} /><div><strong>{text("Latest automatic backup", "Laatste automatische back-up")}</strong><span>{latestScheduledBackup ? formatDate(latestScheduledBackup.verified_at) : text("Waiting for the first daily run", "Wacht op de eerste dagelijkse run")}</span></div></div><div className={`storage-status-card ${latestRestoreTest ? "" : "blocked"}`}><Archive size={21} /><div><strong>{text("Latest restore integrity test", "Laatste herstel-integriteitstest")}</strong><span>{formatDate(latestRestoreTest?.verified_at ?? null)}</span></div></div></div><div className="backup-actions"><button className="primary-button" type="button" disabled={busy || !canManageOrganization} onClick={() => void run(() => downloadManualBackup(client, organizationId, projectId), text("Backup downloaded and checksum verified centrally. Keep a separate recovery copy.", "Back-up gedownload en checksum centraal geverifieerd. Bewaar een afzonderlijke herstelkopie."))}><DatabaseBackup size={15} /> {text("Download verified project backup", "Download geverifieerde projectback-up")}</button><button className="secondary-button" type="button" disabled={busy || !canManageOrganization} onClick={() => fileInput.current?.click()}><RotateCcw size={15} /> Restore dry run</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => validateBackupDryRun(client, file), text("Restore dry run passed; no data was overwritten.", "Restore dry run geslaagd; er zijn geen gegevens overschreven.")); event.target.value = ""; }} /></div>{latestScheduledBackup ? <div className="operation-alert success"><DatabaseBackup size={18} /><div><strong>{text("Daily Vercel Blob backup active", "Dagelijkse Vercel Blob-back-up actief")}</strong><span>{text("Every stored backup is read back, checksum-verified and retained as 7 daily, 4 weekly and 3 monthly copies. Keep an additional copy outside this Vercel account for account-level disaster recovery.", "Elke opgeslagen back-up wordt teruggelezen, met SHA-256 gecontroleerd en bewaard als 7 dagelijkse, 4 wekelijkse en 3 maandelijkse kopieën. Bewaar daarnaast een kopie buiten dit Vercel-account voor herstel bij accountverlies.")}</span></div></div> : <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("First automatic backup pending", "Eerste automatische back-up nog niet uitgevoerd")}</strong><span>{text("The daily job is configured. This status becomes green after its first verified production run.", "De dagelijkse taak is geconfigureerd. Deze status wordt groen na de eerste geverifieerde productierun.")}</span></div></div>}<HistoryColumn title={text("Backup history", "Back-uphistorie")} empty={text("No backup run yet.", "Nog geen back-uprun.")} rows={data.backupRuns.map((item) => `${item.run_type} · ${item.status} · ${formatDate(item.created_at)}${item.sha256 ? ` · SHA ${item.sha256.slice(0, 12)}…` : ""}`)} /></section> : null}
    </>
  );
}

const readinessStatusLabels: Record<ProductionReadinessItem["status"], string> = {
  todo: "Nog te doen",
  in_progress: "In uitvoering",
  done: "Gereed",
  not_applicable: "Niet van toepassing",
};

const readinessStatusLabelsEnglish: Record<ProductionReadinessItem["status"], string> = {
  todo: "To do", in_progress: "In progress", done: "Done", not_applicable: "Not applicable",
};

const readinessCategoryLabels: Record<ProductionReadinessItem["category"], string> = {
  accounts: "Accounts",
  configuration: "Configuratie",
  operations: "Beheer",
  legal: "Besluiten",
  acceptance: "Acceptatie",
};

const readinessCategoryLabelsEnglish: Record<ProductionReadinessItem["category"], string> = {
  accounts: "Accounts", configuration: "Configuration", operations: "Operations",
  legal: "Decisions", acceptance: "Acceptance",
};

// Kept for historical records but intentionally no longer exposed in Management.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ReadinessChecklist({ items, editable, busy, run, client }: { items: ProductionReadinessItem[]; editable: boolean; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>; client: SupabaseClient }) {
  const { text } = useLanguage();
  const completed = items.filter((item) => item.status === "done" || item.status === "not_applicable").length;
  const blockingOpen = items.filter((item) => item.blocking && item.status !== "done" && item.status !== "not_applicable").length;
  const percentage = items.length ? Math.round((completed / items.length) * 100) : 0;

  return (
    <section className="operation-panel readiness-panel">
      <div className={`readiness-summary ${blockingOpen ? "blocked" : "ready"}`}>
        <div className="readiness-summary-icon">{blockingOpen ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}</div>
        <div className="readiness-summary-copy"><span>{text("Production status", "Productiestatus")}</span><strong>{blockingOpen ? text(`${blockingOpen} blocking items open`, `${blockingOpen} blokkerende punten open`) : text("Go-live checklist complete", "Go-live checklist voltooid")}</strong><p>{text(`${completed} of ${items.length} items demonstrably completed`, `${completed} van ${items.length} punten aantoonbaar afgerond`)} · {percentage}%</p></div>
        <div className="readiness-progress" aria-label={text(`${percentage} percent complete`, `${percentage} procent gereed`)}><span style={{ width: `${percentage}%` }} /></div>
      </div>
      <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("Evidence references, never secrets", "Bewijsreferenties, nooit geheimen")}</strong><span>{text("Enter only a ticket number, date, responsible person or document location. Never paste passwords, tokens, OAuth secrets or recovery codes here.", "Vul alleen een ticketnummer, datum, verantwoordelijke of documentlocatie in. Plak hier geen wachtwoorden, tokens, OAuth-secrets of herstelcodes.")}</span></div></div>
      {!editable ? <div className="operation-alert"><ShieldCheck size={18} /><div><strong>{text("Read only", "Alleen-lezen")}</strong><span>{text("An organization administrator can update the central production status and evidence references.", "Een organisatiebeheerder kan de centrale productiestatus en bewijsreferenties bijwerken.")}</span></div></div> : null}
      <div className="readiness-list">
        {items.map((item) => <ReadinessItem key={`${item.id}:${item.status}:${item.evidence ?? ""}`} item={item} editable={editable} busy={busy} run={run} client={client} />)}
      </div>
    </section>
  );
}

function ReadinessItem({ item, editable, busy, run, client }: { item: ProductionReadinessItem; editable: boolean; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>; client: SupabaseClient }) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? readinessStatusLabelsEnglish : readinessStatusLabels;
  const categoryLabels = language === "en" ? readinessCategoryLabelsEnglish : readinessCategoryLabels;
  const [status, setStatus] = useState<ProductionReadinessItem["status"]>(item.status);
  const [evidence, setEvidence] = useState(item.evidence ?? "");

  const requiresEvidence = status === "done" || status === "not_applicable";
  const unchanged = status === item.status && evidence.trim() === (item.evidence ?? "");

  return (
    <article className={`readiness-item ${item.status === "done" || item.status === "not_applicable" ? "complete" : ""}`}>
      <div className="readiness-item-main">
        <div className="readiness-item-heading"><div><span className="record-number">{categoryLabels[item.category]} · {item.code}</span><h2>{item.title}</h2></div>{item.blocking ? <span className="readiness-blocker">{text("Blocking", "Blokkerend")}</span> : <span className="readiness-optional">{text("Non-blocking", "Niet-blokkerend")}</span>}</div>
        <p>{item.description}</p>
        <span className="readiness-owner">{text("Owner", "Eigenaar")}: {item.owner_hint}{item.completed_at ? ` · ${text("Completed", "Afgerond")} ${formatDate(item.completed_at, locale)}` : ""}</span>
      </div>
      <div className="readiness-item-controls">
        <label className="form-field"><span>Status</span><select value={status} disabled={!editable || busy} onChange={(event) => setStatus(event.target.value as ProductionReadinessItem["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="form-field readiness-evidence"><span>{text("Evidence reference", "Bewijsreferentie")}{requiresEvidence ? text(" · required", " · verplicht") : ""}</span><textarea rows={2} maxLength={1000} value={evidence} disabled={!editable || busy} onChange={(event) => setEvidence(event.target.value)} placeholder={text("For example ticket CODECO-42 · checked 18-07-2026 by administrator", "Bijv. ticket CODECO-42 · gecontroleerd 18-07-2026 door beheerder")} /></label>
        <button className="primary-button" type="button" disabled={!editable || busy || unchanged || (requiresEvidence && evidence.trim().length < 5)} onClick={() => void run(() => updateProductionReadiness(client, item.id, status, evidence), text(`${item.code} updated centrally and recorded in the audit log.`, `${item.code} centraal bijgewerkt en in het auditlog vastgelegd.`))}><ShieldCheck size={15} /> {text("Save status", "Status opslaan")}</button>
      </div>
    </article>
  );
}

function MfaSecurityCard({ client }: { client: SupabaseClient }) {
  const { text } = useLanguage();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void client.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!active) return;
      if (listError) setError(listError.message);
      setVerified(Boolean(data?.totp.some((factor) => factor.status === "verified")));
      setLoading(false);
    });
    return () => { active = false; };
  }, [client]);

  const enroll = async () => {
    setLoading(true);
    setError("");
    const result = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "CODECO Supervisie" });
    if (result.error) setError(result.error.message);
    else {
      setFactorId(result.data.id);
      setQrCode(result.data.totp.qr_code);
      setSecret(result.data.totp.secret);
    }
    setLoading(false);
  };

  const verify = async () => {
    setLoading(true);
    setError("");
    const result = await client.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (result.error) setError(result.error.message);
    else {
      setVerified(true);
      setQrCode("");
      setSecret("");
      setMessage(text("Authenticator confirmed; this session now uses two-step verification.", "Authenticator bevestigd; deze sessie gebruikt nu tweestapsverificatie."));
    }
    setLoading(false);
  };

  return (
    <div className="mfa-card">
      <span className="module-card-icon"><KeyRound size={19} /></span>
      <div><h2>{text("Two-step verification", "Tweestapsverificatie")}</h2><p>{verified ? text("Authenticator active for this internal account.", "Authenticator actief voor dit interne account.") : text("Protect administration, review and signing actions with an authenticator app.", "Bescherm beheer-, review- en ondertekenhandelingen met een authenticator-app.")}</p></div>
      {error ? <span className="inline-error">{error}</span> : null}
      {message ? <span className="inline-success">{message}</span> : null}
      {!verified && !qrCode ? <button className="secondary-button" type="button" disabled={loading} onClick={() => void enroll()}>{loading ? <Loader2 className="spin" size={15} /> : <KeyRound size={15} />} {text("Set up authenticator", "Authenticator instellen")}</button> : null}
      {qrCode ? <div className="mfa-enroll"><NextImage src={qrCode} alt={text("QR code for CODECO two-step verification", "QR-code voor CODECO tweestapsverificatie")} width={150} height={150} unoptimized /><div><span>{text("Scan with your authenticator app or use this key:", "Scan met je authenticator-app of gebruik deze sleutel:")}</span><code>{secret}</code><label className="form-field"><span>{text("6-digit code", "6-cijferige code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label><button className="primary-button" type="button" disabled={loading || code.length !== 6} onClick={() => void verify()}>{text("Confirm authenticator", "Bevestig authenticator")}</button></div></div> : null}
    </div>
  );
}

function RecordList({ empty, rows }: { empty: string; rows: Array<{ id: string; icon: typeof ClipboardCheck; title: string; meta: string; status: string; tone: string }> }) {
  const { text } = useLanguage();
  if (!rows.length) return <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No records", "Geen registraties")}</strong><span>{empty}</span></div>;
  return <div className="record-stack">{rows.map((row) => { const Icon = row.icon; return <article className="record-row" key={row.id}><span className="action-icon"><Icon size={18} /></span><div><strong>{row.title}</strong><span>{row.meta}</span></div><span className={`task-status ${row.tone}`}>{row.status}</span></article>; })}</div>;
}

function HistoryColumn({ title, empty, rows }: { title: string; empty: string; rows: React.ReactNode[] }) {
  return <div className="history-column"><h3>{title}</h3>{rows.length ? <ul>{rows.map((row, index) => <li key={index}>{row}</li>)}</ul> : <p>{empty}</p>}</div>;
}
