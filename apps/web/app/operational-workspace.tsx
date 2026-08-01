"use client";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
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
  FolderOpen,
  HardDrive,
  KeyRound,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  PenLine,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  Upload,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ALL_BUILDINGS, BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { photoUploadDescription, PhotoEvidenceList, toPhotoEvidence, type PhotoEvidence } from "@/app/photo-evidence";
import { SketchPad } from "@/app/sketch-pad";
import { LocationPicker, locationBreadcrumb } from "@/app/location-picker";
import { ReportDownloadButtons } from "@/app/report-download-buttons";
import { VisualEvidenceWorkspace } from "@/app/visual-evidence-workspace";
import { DailyWorkRegister, type DailyWorkView } from "@/app/daily-work-register";
import { DrawingWorkspace } from "@/app/drawing-workspace";
import { FieldTools } from "@/app/field-tools";
import { MediaLibraryWorkspace } from "@/app/media-library-workspace";
import { ProjectWorkspaceHome } from "@/app/project-workspace-home";
import { ProjectDocumentsHome } from "@/app/project-documents-home";
import { ProjectActionCenter } from "@/app/project-action-center";
import { RapidVerifyWorkspace } from "@/app/rapid-verify-workspace";
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
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { cacheProjectSnapshot, getCachedProjectSnapshot } from "@/lib/offline/project-cache";
import { compressFieldPhoto, dataSaverEnabled, forceSyncOfflineUploads, queueOfflineUpload } from "@/lib/offline/upload-queue";
import { requestProjectNotificationDispatch } from "@/lib/notifications/client";
import type { FormalReportSnapshot } from "@/lib/reports/daily-report-pdf";
import type { PeriodReportSection, PeriodReportTopic } from "@/lib/reports/period-report-pdf";
import { assignProjectAction, type InternalMember, type ProjectParty } from "@/lib/supabase/data";
import { isStorageGatewayConfigured, loadProjectFileObjectUrl, openProjectFile, uploadProjectFile } from "@/lib/storage/gateway";
import { createFileOriginResolver, filesForRecord, type FileOriginKind, type FileOriginResolver } from "@/lib/supabase/file-origins";
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
  ensureProjectDayReport,
  finishInspection,
  importProjectBoq,
  installChecklistLibraryTemplate,
  loadInspectionResponses,
  loadProjectOperations,
  recordDistribution,
  recordBoqProgress,
  recordFindingProgress,
  revokeExternalShareLink,
  respondToControlledDocument,
  reviewReport,
  saveProjectSettings,
  signReport,
  startInspection,
  startRevision,
  transitionFinding,
  updateProductionReadiness,
  validateBackupDryRun,
  type FileRecord,
  type Finding,
  type ChecklistItem,
  type Inspection,
  type OperationSnapshot,
  type ProductionReadinessItem,
} from "@/lib/supabase/operations";

type WorkspaceMode = "project" | "actions" | "verify" | "reports" | "admin";
type ProjectTab = "home" | "inspections" | "findings" | "ncr" | "hse" | "daily" | "documents" | "registers" | "visual" | "drawings" | "tools" | "files";

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
  wcr: "WCR - Work Completion Request",
  rfi: "RFI",
  submittal: "Submittal",
  site_instruction: "Site instruction",
  meeting: "Vergadering",
  correspondence: "Correspondentie",
  cost: "Kostenbewaking",
  declaration: "Aannemersdeclaratie",
  rfa: "RFA - Request for Approval",
  inspection_request: "WIR - Werkinspectieverzoek",
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

/**
 * Controlled documents an external party submits and the company or owner approves.
 * They live under Management, never as a workspace record you create yourself.
 */
const externalSubmissionRegisterTypes = ["wcr", "rfi", "rfa", "inspection_request"];

/** Register items that are judged and counted: material arrives, is checked and measured. */
const registerQuantityTypes = ["delivery", "equipment", "test"];

const registerLabelsEnglish: Record<string, string> = {
  equipment: "Equipment", delivery: "Delivery", test: "Test / measurement", variation: "Variation",
  delay: "Delay", communication: "Communication / decision", risk: "Risk", document: "Document",
  drawing: "Drawing", wcr: "WCR - Work Completion Request", rfi: "RFI", submittal: "Submittal", site_instruction: "Site instruction",
  meeting: "Meeting", correspondence: "Correspondence", cost: "Cost control", declaration: "Contractor payment claim",
  rfa: "RFA - Request for Approval", inspection_request: "WIR - Work Inspection Request", boq: "BOQ / progress",
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

/**
 * Not every contractor uses WhatsApp; on site an SMS is what always arrives. Both open
 * the phone's own app with the message ready, so no number is stored in the project.
 */
function openWhatsApp(message: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

function openSms(message: string) {
  // "?&body=" is the form both iOS and Android accept without a recipient.
  window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
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
  buildings,
  reportId,
  reportNumber,
  reportStatus,
  projectStartAnswers,
  currentUserName,
  companyEmployees,
  parties,
  canManageOrganization,
  openUserAdmin,
  initialProjectTab = "home",
  externalSubmissionIntent = false,
  actionCenterView = "work",
  initialCameraFiles = [],
  onInitialCameraFilesConsumed,
  openQuickCamera,
  openDailyRecord,
  openProjectArea,
  openActionCenter,
  openRapidVerify,
  openReports,
  openManagement,
  projectActions = [],
  openProjectAction,
  createProjectAction,
}: {
  mode: WorkspaceMode;
  client: SupabaseClient;
  organizationId: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  buildingId: string;
  buildingName: string;
  buildings: BuildingOption[];
  reportId: string | null;
  reportNumber: string;
  reportStatus: string;
  projectStartAnswers: ProjectStartAnswers | null;
  currentUserName: string;
  companyEmployees: InternalMember[];
  parties: ProjectParty[];
  canManageOrganization: boolean;
  openUserAdmin: () => void;
  initialProjectTab?: ProjectTab;
  /** Set when Management sends the user here to record a contractor submission. */
  externalSubmissionIntent?: boolean;
  /** Which view of the action centre to open: the worklist or the deadlines. */
  actionCenterView?: "work" | "deadlines";
  initialCameraFiles?: File[];
  onInitialCameraFilesConsumed?: () => void;
  openQuickCamera: () => void;
  openDailyRecord: (type: "works_ongoing" | "works_completed" | "workforce" | "delay") => void;
  openProjectArea: (tab: "inspections" | "findings" | "ncr" | "documents" | "registers" | "visual" | "drawings" | "files" | "submissions") => void;
  openActionCenter: (view?: "work" | "deadlines") => void;
  openRapidVerify: () => void;
  openReports: () => void;
  openManagement: () => void;
  projectActions?: Array<{ id: string; title: string; action_number: string; status: string; priority: string; due_at: string | null; owner_user_id?: string | null }>;
  openProjectAction?: (actionId: string) => void;
  createProjectAction?: () => void;
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
          key={`${projectId}:${initialProjectTab}:${externalSubmissionIntent}`}
          data={query.data}
          organizationId={organizationId}
          reportId={reportId}
          projectId={projectId}
          projectName={projectName}
          projectCode={projectCode}
          buildingId={buildingId}
          buildingName={buildingName}
          buildings={buildings}
          projectStartAnswers={projectStartAnswers}
          currentUserName={currentUserName}
          companyEmployees={companyEmployees}
          parties={parties}
          client={client}
          busy={busy}
          run={run}
          initialTab={initialProjectTab}
          externalSubmissionIntent={externalSubmissionIntent}
          initialCameraFiles={initialCameraFiles}
          onInitialCameraFilesConsumed={onInitialCameraFilesConsumed}
          openQuickCamera={openQuickCamera}
          openDailyRecord={openDailyRecord}
          openActionCenter={openActionCenter}
          openRapidVerify={openRapidVerify}
          openReports={openReports}
          openManagement={openManagement}
        />
      ) : null}
      {mode === "actions" ? (
        <ProjectActionCenter
          data={query.data}
          actions={projectActions}
          projectName={projectName}
          initialView={actionCenterView}
          openAction={(actionId) => openProjectAction?.(actionId)}
          createAction={() => createProjectAction?.()}
          openProjectArea={(tab) => openProjectArea(tab)}
        />
      ) : null}
      {mode === "verify" ? <RapidVerifyWorkspace projectName={projectName} projectFiles={query.data.files} client={client} /> : null}
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
          buildings={buildings}
          companyEmployees={companyEmployees}
          projectActions={projectActions}
          parties={parties}
          canManageOrganization={canManageOrganization}
          openUserAdmin={openUserAdmin}
          openProjectArea={openProjectArea}
          openActionCenter={openActionCenter}
          createProjectAction={() => createProjectAction?.()}
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
  buildings,
  projectStartAnswers,
  currentUserName,
  companyEmployees,
  parties,
  client,
  busy,
  run,
  initialTab,
  initialCameraFiles,
  onInitialCameraFilesConsumed,
  openQuickCamera,
  openDailyRecord,
  openActionCenter,
  openRapidVerify,
  openReports,
  openManagement,
  externalSubmissionIntent = false,
}: {
  data: OperationSnapshot;
  organizationId: string;
  reportId: string | null;
  projectId: string;
  projectName: string;
  projectCode: string;
  buildingId: string;
  buildingName: string;
  buildings: BuildingOption[];
  projectStartAnswers: ProjectStartAnswers | null;
  currentUserName: string;
  companyEmployees: InternalMember[];
  parties: ProjectParty[];
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  initialTab: ProjectTab;
  initialCameraFiles: File[];
  onInitialCameraFilesConsumed?: () => void;
  openQuickCamera: () => void;
  openDailyRecord: (type: "works_ongoing" | "works_completed" | "workforce" | "delay") => void;
  openActionCenter: (view?: "work" | "deadlines") => void;
  openRapidVerify: () => void;
  openReports: () => void;
  openManagement: () => void;
  externalSubmissionIntent?: boolean;
}) {
  const { language, locale, text } = useLanguage();
  const allRegisterNames = language === "en" ? registerLabelsEnglish : registerLabels;
  // WCR, RFI, RFA and WIR are contractor submissions. They are filled in by the external
  // party and decided by the company or owner under Management, so the supervision
  // workspace must not offer them as something you create here.
  const registerNames = externalSubmissionIntent
    ? allRegisterNames
    : Object.fromEntries(
      Object.entries(allRegisterNames).filter(([type]) => !externalSubmissionRegisterTypes.includes(type)),
    );
  const issueDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date());
  const issueTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(new Date());
  const [tab, setTab] = useState<ProjectTab>(initialTab);
  // Issues and NCRs are separate modules: the client's issue screen is for issues only.
  const findingScope: "issue" | "ncr" = tab === "ncr" ? "ncr" : "issue";
  const [visualFindingId, setVisualFindingId] = useState("");
  const [drawingFindingId, setDrawingFindingId] = useState("");
  const [dailyWorkView, setDailyWorkView] = useState<DailyWorkView>("works_ongoing");
  const [showForm, setShowForm] = useState(initialTab !== "home");
  const [activeInspection, setActiveInspection] = useState<Inspection | null>(null);
  const [inspectionResumeError, setInspectionResumeError] = useState("");
  const [inspectionTitle, setInspectionTitle] = useState("");
  const [inspectionTemplateId, setInspectionTemplateId] = useState("");
  const [inspectionAnswers, setInspectionAnswers] = useState<Record<string, InspectionAnswer>>({});
  const [inspectionPhotos, setInspectionPhotos] = useState<PhotoEvidence[]>([]);
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
    // The issue list of the client has its own issuance date column.
    dateIdentified: "",
    // The boxes of the client's own non-conformance report.
    referenceChecklist: "",
    recommendedAction: "" as "" | "rework" | "repair" | "alternative",
    recommendedActionDetail: "",
    remarks: "",
    signedBy: "",
    signedAt: "",
  });
  const [findingPhotos, setFindingPhotos] = useState<PhotoEvidence[]>([]);
  const [findingPhotoError, setFindingPhotoError] = useState("");
  /** The record that was just submitted, so the link to the contractor is one tap away. */
  const [submittedFinding, setSubmittedFinding] = useState<Finding | null>(null);
  const [hseForm, setHseForm] = useState({ type: "unsafe_condition", title: "", description: "", severity: "medium", immediateMeasure: "", confidential: false });
  const [hsePhotos, setHsePhotos] = useState<PhotoEvidence[]>([]);
  // One short text per evidence photo, in the same order as the photos themselves.
  const [hsePhotoError, setHsePhotoError] = useState("");
  const [registerForm, setRegisterForm] = useState<ControlledDocumentDraft>({ ...emptyControlledDocumentDraft });
  const [registerFiles, setRegisterFiles] = useState<File[]>([]);
  const [boqFile, setBoqFile] = useState<File | null>(null);
  const [boqItems, setBoqItems] = useState<BoqImportItem[]>([]);
  const [boqError, setBoqError] = useState("");
  const [inspectionLocationNodeId, setInspectionLocationNodeId] = useState("");
  const [findingLocationNodeId, setFindingLocationNodeId] = useState("");
  const [hseLocationNodeId, setHseLocationNodeId] = useState("");
  const [registerLocationNodeId, setRegisterLocationNodeId] = useState("");
  const [inspectionBuildingId, setInspectionBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [findingBuildingId, setFindingBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [hseBuildingId, setHseBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [registerBuildingId, setRegisterBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [boqBuildingId, setBoqBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [inspectionFilterBuildingId, setInspectionFilterBuildingId] = useState("");
  const [inspectionFilterLocationNodeId, setInspectionFilterLocationNodeId] = useState("");
  const [inspectionFilterDate, setInspectionFilterDate] = useState("");
  const [registerDrawingId, setRegisterDrawingId] = useState("");
  const [registerOutcome, setRegisterOutcome] = useState("");
  const [registerQuantity, setRegisterQuantity] = useState("");
  const [registerUnit, setRegisterUnit] = useState("");
  const [registerPhotos, setRegisterPhotos] = useState<PhotoEvidence[]>([]);
  const [registerPhotoError, setRegisterPhotoError] = useState("");
  const [registerSketching, setRegisterSketching] = useState(false);
  /** An agreement is text plus the two parties who made it, and who signs for them. */
  const [agreementForm, setAgreementForm] = useState({
    partyA: "", partyB: "", signedByA: "", signedAtA: "", signedByB: "", signedAtB: "",
  });
  // Everything this workspace already knows about the project is offered inside the marking
  // pad, so a marker on a photo can say which building, floor, room and party it belongs to.
  const markupOptions = useMemo(() => ({
    buildings: buildings.map((building) => ({ id: building.id, label: building.name })),
    locations: data.locationNodes.map((node) => ({ id: node.id, label: locationBreadcrumb(data.locationNodes, node.id), buildingId: node.building_id })),
    parties: parties.map((party) => ({ id: party.id, label: party.name })),
  }), [buildings, data.locationNodes, parties]);
  const requiredLocationDepth = data.settings?.required_location_depth ?? "building";
  const exactLocationRequired = requiredLocationDepth !== "building";
  const registerContextLabel = registerBuildingId === ALL_BUILDINGS
    ? text("Whole project · all buildings", "Hele project · alle gebouwen")
    : buildings.find((building) => building.id === registerBuildingId)?.name ?? buildingName;
  // Drawings of the chosen building, so a controlled document can point at the plan it
  // belongs to instead of only naming a floor.
  const registerDrawings = data.files.filter((file) => (
    file.category === "drawing"
    && file.status === "available"
    && (!file.building_id || file.building_id === registerBuildingId)
  ));
  const documentIssuerOptions = Array.from(new Set([
    currentUserName,
    ...companyEmployees.map((employee) => employee.displayName?.trim() || employee.email),
  ].filter(Boolean)));
  const recordContextLabel = (recordBuildingId: string | null, locationNodeId?: string | null) => {
    const recordBuilding = buildings.find((building) => building.id === recordBuildingId)?.name
      ?? text("Project-wide", "Projectbreed");
    const exactLocation = locationBreadcrumb(data.locationNodes, locationNodeId);
    return exactLocation ? `${recordBuilding} → ${exactLocation}` : recordBuilding;
  };
  const filteredInspections = data.inspections.filter((inspection) => {
    if (inspectionFilterBuildingId && inspection.building_id !== inspectionFilterBuildingId) return false;
    if (inspectionFilterLocationNodeId && inspection.location_node_id !== inspectionFilterLocationNodeId) return false;
    if (inspectionFilterDate) {
      const recordedAt = inspection.completed_at ?? inspection.started_at ?? inspection.planned_at;
      if (!recordedAt || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date(recordedAt)) !== inspectionFilterDate) return false;
    }
    return true;
  });
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
  // Every form says the same thing about a photo, because a photo works the same in
  // every form: tap it to describe it, mark it or throw it away.
  const photoCaptureHint = text(
    "Tap again for another photo. Tap a photo in the list to describe, mark or remove it.",
    "Tik opnieuw voor nog een foto. Tik op een foto in de lijst om te omschrijven, markeren of verwijderen.",
  );
  const scopedFindings = data.findings.filter((finding) => findingScope === "ncr"
    ? finding.finding_type === "ncr"
    : finding.finding_type !== "ncr");
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
    // An agreement is what two parties said to each other; a suggested sentence would
    // only have to be deleted again.
    agreement: [],
    // A technical instruction is always project-specific. Example presets from another
    // project only had to be deleted again, so this form starts empty.
    technical_instruction: [],
    // A change order is project-specific for the same reason as a technical instruction.
    change_order: [],
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
    && (registerForm.type !== "technical_instruction" || (registerForm.reason.trim().length >= 3 && Boolean(registerForm.dueDate)))
  );
  const agreementRegister = registerForm.type === "agreement";
  // Who the parties of an agreement can be: the own company, the signed-in supervisor
  // and every party of this project.
  const agreementPartyOptions = Array.from(new Set([
    "CODECO N.V.",
    currentUserName,
    ...parties.map((party) => party.name),
  ].filter(Boolean)));
  // An agreement is written as a sentence, so its own text is also its register line.
  const registerTitle = agreementRegister
    ? registerForm.title.trim() || registerForm.details.trim().split(/\r?\n/)[0].slice(0, 90)
    : registerForm.title.trim();

  const switchTab = (next: ProjectTab) => {
    setTab(next);
    setSubmittedFinding(null);
    // Opening a module means you came to record something: the entry form is there
    // right away. "New" stays as the toggle to get it out of the way.
    setShowForm(true);
    setActiveInspection(null);
  };

  // Every way into a module is the same way: the entry form is open. Reaching NCR and
  // then still having to press "New" was the client's own remark.
  const openTask = (next: ProjectTab, createRecord = true) => {
    setTab(next);
    setSubmittedFinding(null);
    setShowForm(createRecord);
    setActiveInspection(null);
  };

  const openRegister = (type: "change_order" | "delivery" | "technical_instruction" | "agreement") => {
    setRegisterForm({ ...emptyControlledDocumentDraft, type });
    setRegisterFiles([]);
    setRegisterLocationNodeId("");
    openTask("registers", true);
  };

  /**
   * A narrow, expiring link to one record. It is used both from the list and straight
   * after submitting, because an NCR only starts moving once the contractor has it.
   */
  const shareFinding = async (finding: Finding) => {
    let sharedToken = "";
    let shareId = "";
    let expiresAt = "";
    const okay = await run(async () => {
      const created = await createExternalShareLink(client, projectId, "finding", finding.id);
      shareId = created.share_id;
      sharedToken = created.token;
      expiresAt = created.expires_at;
    }, text("Secure external link created.", "Beveiligde externe link aangemaakt."));
    if (!okay || !shareId || !sharedToken || !expiresAt) return null;
    return { shareId, url: externalShareUrl(window.location.origin, sharedToken), expiresAt };
  };

  const openFinding = (scope: "issue" | "ncr", createRecord = true) => {
    setFindingForm((current) => ({ ...current, type: scope === "ncr" ? "ncr" : current.type === "ncr" ? "deficiency" : current.type }));
    openTask(scope === "ncr" ? "ncr" : "findings", createRecord);
  };

  const beginInspection = async () => {
    const templateId = inspectionTemplateId || inspectionTemplates[0]?.id;
    const template = data.templates.find((item) => item.id === templateId);
    const inspectionBuildingName = buildings.find((building) => building.id === inspectionBuildingId)?.name ?? buildingName;
    const resolvedTitle = inspectionTitle.trim() || `${template?.name ?? text("Inspection", "Inspectie")} · ${inspectionBuildingName}`;
    if (!templateId) return;
    let created: Inspection | null = null;
    const okay = await run(async () => {
      created = await startInspection(client, { projectId, buildingId: inspectionBuildingId, locationNodeId: inspectionLocationNodeId, reportId, templateId, title: resolvedTitle });
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

  /**
   * Reopens a checklist that is still open. Without this an inspection could be started
   * but never filled in: the list only showed it as "in progress".
   */
  const resumeInspection = async (inspection: Inspection) => {
    const template = data.templates.find((item) => item.id === inspection.template_id);
    if (!template) {
      setInspectionResumeError(text(
        "The checklist of this inspection is no longer published for this project.",
        "De checklist van deze inspectie is niet meer gepubliceerd voor dit project.",
      ));
      return;
    }
    setInspectionResumeError("");
    setActiveInspection(inspection);
    setShowForm(false);
    setInspectionAnswers(Object.fromEntries(template.items.map((item) => [item.id, { result: "", notes: "" }])));
    try {
      const stored = await loadInspectionResponses(client, inspection.id);
      // Keep every checkpoint present, then lay the saved answers over it.
      setInspectionAnswers((current) => ({ ...current, ...stored }));
    } catch {
      setInspectionResumeError(text(
        "Earlier answers could not be loaded. Answer the checkpoints again before completing.",
        "Eerdere antwoorden konden niet worden geladen. Vul de controlepunten opnieuw in vóór afronden.",
      ));
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

  const existingMediaFolderId = (name: string, forBuildingId: string) => {
    const existing = data.mediaFolders.find((folder) => (!folder.building_id || folder.building_id === forBuildingId) && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    return existing?.id ?? null;
  };

  const syncQueuedEvidenceNow = () => forceSyncOfflineUploads(client, projectId, {
    paused: text(
      "The connection changed before central evidence confirmation. The photos remain safe on this device. Keep this form open, then open Photos & folders and tap Sync now.",
      "De verbinding veranderde vóór de centrale bewijsbevestiging. De foto’s blijven veilig op dit apparaat. Houd dit formulier open, open daarna Foto’s & mappen en tik op Nu synchroniseren.",
    ),
    failed: (pendingCount) => text(
      `${pendingCount} evidence upload(s) could not be confirmed centrally. They remain safe on this device. Keep this form open, then open Photos & folders and tap Sync now.`,
      `${pendingCount} bewijsupload(s) konden niet centraal worden bevestigd. Ze blijven veilig op dit apparaat. Houd dit formulier open, open daarna Foto’s & mappen en tik op Nu synchroniseren.`,
    ),
  });

  const submitInspection = async () => {
    if (!activeInspection || !activeTemplate) return;
    if (activeTemplate.items.some((item) => item.required && !checklistItemAnswered(item, inspectionAnswers[item.id]))) return;
    const okay = await run(
      async () => {
        const effectiveReportId = await ensureProjectDayReport(client, projectId, reportId);
        await finishInspection(client, activeInspection, inspectionAnswers);
        if (inspectionPhotos.length) {
          const folderName = text("Inspections", "Inspecties");
          const photoBuildingId = activeInspection.building_id;
          const folderId = existingMediaFolderId(folderName, photoBuildingId);
          for (const photo of inspectionPhotos) {
            const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
            const caption = photo.details.title.trim();
            await queueOfflineUpload({
              projectId,
              buildingId: photoBuildingId,
              reportId: effectiveReportId,
              folderId,
              folderName,
              kind: "photo",
              file: prepared.blob,
              fileName: prepared.fileName,
              mimeType: prepared.mimeType,
              // The photo's own text wins; the checklist title is only the fallback.
              title: caption || activeInspection.title,
              description: photoUploadDescription(photo, "", language),
              locationLabel: buildings.find((building) => building.id === photoBuildingId)?.name ?? buildingName,
              locationNodeId: photo.details.locationNodeId || activeInspection.location_node_id,
              capturedAt: new Date(photo.file.lastModified || Date.now()).toISOString(),
              originalSize: photo.original.size,
              queuedSize: prepared.blob.size,
              compressed: prepared.compressed,
              recordLink: { organizationId, recordType: "inspection", recordId: activeInspection.id, relationship: "evidence" },
            });
          }
          if (navigator.onLine) await syncQueuedEvidenceNow();
        }
      },
      text("Inspection completed; every photo is secured locally and linked during automatic sync.", "Inspectie afgerond; elke foto is lokaal veiliggesteld en wordt automatisch gekoppeld."),
    );
    if (okay) {
      setActiveInspection(null);
      setInspectionTitle("");
      setInspectionLocationNodeId("");
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
    setFiles: Dispatch<SetStateAction<PhotoEvidence[]>>,
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
      const keyed = new Map(current.map((photo) => [`${photo.original.name}:${photo.original.size}:${photo.original.lastModified}`, photo]));
      valid.forEach((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!keyed.has(key)) keyed.set(key, toPhotoEvidence(file));
      });
      return [...keyed.values()].slice(0, 12);
    });
  };

  const addFindingPhotos = (files: FileList | null) => addPhotosToStack(files, setFindingPhotos, setFindingPhotoError);

  const addFinding = async () => {
    if (findingForm.title.trim().length < 3 || findingForm.description.trim().length < 3) return;
    // A finding always belongs to a building in the database. "All buildings" therefore
    // means the same record in every building, exactly as the daily log and the field
    // notes already do it; before this it produced an error on saving.
    const projectWideFinding = findingBuildingId === ALL_BUILDINGS;
    const findingBuildingIds = projectWideFinding ? buildings.map((building) => building.id) : [findingBuildingId];
    const findingPhotoBuildingId = projectWideFinding ? resolveDefaultBuildingId(buildings, buildingId) : findingBuildingId;
    const findingBuildingName = projectWideFinding
      ? text("All buildings", "Alle gebouwen")
      : buildings.find((building) => building.id === findingBuildingId)?.name ?? buildingName;
    // The module decides what is created here. Without this an NCR opened from the
    // module switcher would be stored as an ordinary deficiency and vanish from the
    // NCR list it was entered in.
    const findingType = findingScope === "ncr" ? "ncr" : findingForm.type === "ncr" ? "deficiency" : findingForm.type;
    const draft = {
      projectId,
      buildingId: findingBuildingIds[0] ?? findingBuildingId,
      type: findingType,
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
      referenceChecklist: findingForm.referenceChecklist,
      recommendedAction: findingForm.recommendedAction || undefined,
      recommendedActionDetail: findingForm.recommendedActionDetail,
      remarks: findingForm.remarks,
      signedBy: findingForm.signedBy,
      signedAt: findingForm.signedAt,
      locationNodeId: projectWideFinding ? "" : findingLocationNodeId,
    };
    // The record itself is created first whenever there is a connection. That is what
    // makes the link to the contractor available the moment the NCR is submitted; the
    // photos still travel over the offline queue and attach themselves to it.
    let created: Finding | null = null;
    const success = findingPhotos.length
      ? text("Issue and photo stack secured; numbering and assignment synchronize automatically.", "Probleem en fotostapel veiliggesteld; nummering en toewijzing synchroniseren automatisch.")
      : text("Finding numbered, assigned and given a rule-driven deadline.", "Bevinding genummerd, toegewezen en van een regelgestuurde deadline voorzien.");
    const okay = await run(async () => {
      const effectiveReportId = await ensureProjectDayReport(client, projectId, reportId);
      // Without photos there is nothing to queue, so the record is created here even
      // when the connection is gone: the failure has to be visible, not silent.
      if (navigator.onLine || !findingPhotos.length) {
        for (const targetBuildingId of findingBuildingIds) {
          const record = await createFinding(client, { ...draft, buildingId: targetBuildingId, reportId: effectiveReportId });
          // The photos hang under the first record; the others carry the same words.
          if (!created) created = record;
        }
      }
      if (findingPhotos.length) {
        const folderName = text("Findings", "Bevindingen");
        const findingFolderId = existingMediaFolderId(folderName, findingPhotoBuildingId);
        const groupId = crypto.randomUUID();
        for (const photo of findingPhotos) {
          const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
          // The photo's own words win over the record's; without them the register shows a
          // dozen identical titles for one issue.
          await queueOfflineUpload({
            projectId,
            buildingId: findingPhotoBuildingId,
            reportId: effectiveReportId,
            folderId: findingFolderId,
            folderName,
            kind: "photo",
            file: prepared.blob,
            fileName: prepared.fileName,
            mimeType: prepared.mimeType,
            title: photo.details.title.trim() || findingForm.title,
            description: photoUploadDescription(photo, findingForm.description, language),
            locationLabel: findingBuildingName,
            locationNodeId: photo.details.locationNodeId || (projectWideFinding ? null : findingLocationNodeId) || null,
            capturedAt: new Date(photo.file.lastModified || Date.now()).toISOString(),
            originalSize: photo.original.size,
            queuedSize: prepared.blob.size,
            compressed: prepared.compressed,
            findingGroup: {
              id: groupId,
              organizationId,
              // An already created record is only linked; without a connection the queue
              // still creates it from this draft during synchronization.
              findingId: created?.id,
              draft: {
                organizationId,
                type: findingType,
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
                dateIdentified: findingForm.dateIdentified,
                referenceChecklist: findingForm.referenceChecklist,
                recommendedAction: findingForm.recommendedAction || undefined,
                recommendedActionDetail: findingForm.recommendedActionDetail,
                remarks: findingForm.remarks,
                signedBy: findingForm.signedBy,
                signedAt: findingForm.signedAt,
                locationNodeId: (projectWideFinding ? "" : findingLocationNodeId) || undefined,
              },
            },
          });
        }
        if (navigator.onLine) await syncQueuedEvidenceNow();
      }
    }, success);
    if (okay) {
      setFindingForm({
        type: findingScope === "ncr" ? "ncr" : "deficiency", title: "", description: "", severity: "medium", responsiblePartyId: "",
        issueType: "quality", impactSummary: "", actionSteps: "", escalationRequired: false,
        disposition: "to_be_corrected", expectedResolutionDate: "", sourceCatalogSubject: "", dateIdentified: "",
        referenceChecklist: "", recommendedAction: "", recommendedActionDetail: "", remarks: "", signedBy: "", signedAt: "",
      });
      setFindingPhotos([]);
      setFindingPhotoError("");
      setFindingLocationNodeId("");
      setShowForm(false);
      // Right after submitting, the record itself offers the link to the contractor:
      // an NCR only works when the party that must correct it actually receives it.
      setSubmittedFinding(created);
    }
  };

  const addHse = async () => {
    if (hseForm.title.trim().length < 3 || hseForm.description.trim().length < 3) return;
    // The same building choice as every other field record, and it has to work: an HSE
    // event needs a building, so "all buildings" writes the event in each of them.
    const projectWideHse = hseBuildingId === ALL_BUILDINGS;
    const hseBuildingIds = projectWideHse ? buildings.map((building) => building.id) : [hseBuildingId];
    const hsePhotoBuildingId = projectWideHse ? resolveDefaultBuildingId(buildings, buildingId) : hseBuildingId;
    const hseBuildingName = projectWideHse
      ? text("All buildings", "Alle gebouwen")
      : buildings.find((building) => building.id === hseBuildingId)?.name ?? buildingName;
    const okay = await run(
      async () => {
        const effectiveReportId = await ensureProjectDayReport(client, projectId, reportId);
        let event: Awaited<ReturnType<typeof createHseEvent>> | null = null;
        for (const targetBuildingId of hseBuildingIds) {
          const recorded = await createHseEvent(client, { projectId, buildingId: targetBuildingId, locationNodeId: projectWideHse ? "" : hseLocationNodeId, reportId: effectiveReportId, ...hseForm });
          // The photos hang under the first event; the others carry the same words.
          if (!event) event = recorded;
        }
        if (hsePhotos.length && event) {
          const folderName = "HSE";
          const folderId = existingMediaFolderId(folderName, hsePhotoBuildingId);
          for (const photo of hsePhotos) {
            const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
            const caption = photo.details.title.trim();
            await queueOfflineUpload({
              projectId,
              buildingId: hsePhotoBuildingId,
              reportId: effectiveReportId,
              folderId,
              folderName,
              kind: "photo",
              file: prepared.blob,
              fileName: prepared.fileName,
              mimeType: prepared.mimeType,
              // The photo's own text wins; the record title is only the fallback.
              title: caption || hseForm.title,
              description: photoUploadDescription(photo, hseForm.description, language),
              locationLabel: hseBuildingName,
              locationNodeId: photo.details.locationNodeId || (projectWideHse ? null : hseLocationNodeId) || null,
              capturedAt: new Date(photo.file.lastModified || Date.now()).toISOString(),
              originalSize: photo.original.size,
              queuedSize: prepared.blob.size,
              compressed: prepared.compressed,
              recordLink: { organizationId, recordType: "hse", recordId: event.id, relationship: "evidence" },
            });
          }
          if (navigator.onLine) await syncQueuedEvidenceNow();
        }
      },
      text("HSE event recorded; every photo is secured locally and linked during automatic sync.", "HSE-gebeurtenis vastgelegd; elke foto is lokaal veiliggesteld en wordt automatisch gekoppeld."),
    );
    if (okay) {
      setHseForm({ type: "unsafe_condition", title: "", description: "", severity: "medium", immediateMeasure: "", confidential: false });
      setHsePhotos([]);
      setHsePhotoError("");
      setHseLocationNodeId("");
      setShowForm(false);
    }
  };

  const addRegisterEntry = async () => {
    if (registerTitle.length < 3) return;
    // A controlled document may apply to the whole project; then it has no building.
    const projectWideRegister = registerBuildingId === ALL_BUILDINGS;
    const registerRecordBuildingId = projectWideRegister ? null : registerBuildingId;
    const registerPhotoBuildingId = projectWideRegister ? resolveDefaultBuildingId(buildings, buildingId) : registerBuildingId;
    const registerBuildingName = projectWideRegister
      ? registerContextLabel
      : buildings.find((building) => building.id === registerBuildingId)?.name ?? buildingName;
    const selectedDrawing = registerDrawings.find((drawing) => drawing.id === registerDrawingId);
    const baseDetails = controlledRegister
      ? createControlledDocumentDetails(registerForm, {
          projectName,
          projectCode,
          buildingName: registerBuildingName,
          currentUserName,
        })
      : {
        description: registerForm.details,
        outcome: registerOutcome || null,
        quantity: registerQuantity.trim() ? Number(registerQuantity) : null,
        unit: registerUnit.trim() || null,
        // An agreement carries the two parties that made it and their signatures.
        ...(agreementRegister ? {
          agreed_between: [agreementForm.partyA, agreementForm.partyB].filter(Boolean),
          signed_by_first: agreementForm.signedByA || null,
          signed_at_first: agreementForm.signedAtA || null,
          signed_by_second: agreementForm.signedByB || null,
          signed_at_second: agreementForm.signedAtB || null,
        } : {}),
      };
    const okay = await run(
      async () => {
        const effectiveReportId = await ensureProjectDayReport(client, projectId, reportId);
        const uploadedFiles = [];
        for (const file of registerFiles) {
          const uploaded = await uploadProjectFile(client, {
            projectId,
            buildingId: registerPhotoBuildingId,
            category: "document",
            file,
          });
          uploadedFiles.push({
            file_id: uploaded.fileId,
            sha256: uploaded.sha256,
            name: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
          });
        }
        const entry = await createRegisterEntry(client, {
          projectId,
          buildingId: registerRecordBuildingId,
          locationNodeId: registerLocationNodeId,
          reportId: effectiveReportId,
          type: registerForm.type,
          title: registerTitle,
          responsiblePartyId: registerForm.responsiblePartyId,
          dueAt: registerForm.dueDate || null,
          details: {
            ...baseDetails,
            attachment_files: uploadedFiles,
            drawing_file_id: selectedDrawing?.id ?? null,
            drawing_name: selectedDrawing?.original_name ?? null,
          },
        });
        // Site photos belong to a register item as much as documents do.
        if (registerPhotos.length) {
          const folderName = text("Register evidence", "Registerbewijs");
          const folderId = existingMediaFolderId(folderName, registerPhotoBuildingId);
          for (const photo of registerPhotos) {
            const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
            const caption = photo.details.title.trim();
            await queueOfflineUpload({
              projectId,
              buildingId: registerPhotoBuildingId,
              reportId: effectiveReportId,
              folderId,
              folderName,
              kind: "photo",
              file: prepared.blob,
              fileName: prepared.fileName,
              mimeType: prepared.mimeType,
              title: caption || `${entry.entry_number} · ${registerForm.title.trim()}`.slice(0, 120),
              description: photoUploadDescription(photo, "", language),
              locationLabel: registerBuildingName,
              locationNodeId: photo.details.locationNodeId || registerLocationNodeId || null,
              capturedAt: new Date(photo.file.lastModified || Date.now()).toISOString(),
              originalSize: photo.original.size,
              queuedSize: prepared.blob.size,
              compressed: prepared.compressed,
              recordLink: { organizationId, recordType: "register_entry", recordId: entry.id, relationship: "evidence" },
            });
          }
          if (navigator.onLine) await syncQueuedEvidenceNow();
        }
        if (registerForm.type === "punch_list") {
          await createFinding(client, {
            projectId,
            buildingId: registerPhotoBuildingId,
            locationNodeId: registerLocationNodeId,
            reportId: effectiveReportId,
            type: "deficiency",
            title: registerForm.title,
            description: registerForm.details,
            severity: "medium",
            responsiblePartyId: registerForm.responsiblePartyId,
            issueType: "quality",
            actionSteps: text("Correct this punch-list item and submit visual evidence.", "Herstel dit punch-listpunt en lever visueel bewijs."),
            sourceCatalogSubject: entry.entry_number,
          });
        }
        return entry;
      },
      text(`${registerNames[registerForm.type] ?? "Record"} was saved centrally and linked to the daily report.`, `${registerNames[registerForm.type] ?? "Registeritem"} centraal opgeslagen en aan het dagrapport gekoppeld.`),
    );
    if (okay) {
      setRegisterForm({ ...emptyControlledDocumentDraft, type: registerForm.type });
      setAgreementForm({ partyA: "", partyB: "", signedByA: "", signedAtA: "", signedByB: "", signedAtB: "" });
      setRegisterFiles([]);
      setRegisterOutcome("");
      setRegisterQuantity("");
      setRegisterUnit("");
      setRegisterPhotos([]);
      setRegisterPhotoError("");
      setRegisterDrawingId("");
      setRegisterLocationNodeId("");
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
      () => importProjectBoq(client, { projectId, buildingId: boqBuildingId, reportId, items: boqItems }),
      text(`${boqItems.length} BOQ lines imported with quantity, value and progress.`, `${boqItems.length} BOQ-regels geïmporteerd met hoeveelheid, waarde en voortgang.`),
    );
    if (okay) {
      setBoqFile(null);
      setBoqItems([]);
      setBoqError("");
    }
  };

  const moduleEnabled = (module: string) => data.settings?.modules?.[module] !== false;
  const projectSections: Array<[Exclude<ProjectTab, "home">, string, number]> = ([
    ["inspections", text("Inspections", "Inspecties"), data.inspections.length],
    ["findings", text("Issues", "Issues"), data.findings.filter((item) => item.finding_type !== "ncr" && item.status !== "closed").length],
    ["ncr", "NCR", data.findings.filter((item) => item.finding_type === "ncr" && item.status !== "closed").length],
    ["hse", "HSE", data.hseEvents.length],
    ["daily", text("Daily work", "Dagwerk"), (data.dailyWork ?? []).length],
    ["documents", "Project Docs", data.files.filter((file) => file.status === "available").length + data.registerEntries.filter((entry) => ["document", "drawing", "specification", "contract", "boq"].includes(entry.register_type)).length],
    ["registers", text("Formal documents & registers", "Formele documenten & registers"), data.registerEntries.length],
    ["visual", text("Visual evidence", "Visueel bewijs"), data.visualCaptures.length],
    ["drawings", text("Drawings", "Tekeningen"), data.files.filter((file) => file.category === "drawing" && file.status === "available").length],
    ["tools", text("Field tools", "Veldtools"), data.registerEntries.filter((entry) => ["notepad", "agreement", "technical_instruction"].includes(entry.register_type)).length],
    ["files", text("Photos & folders", "Foto’s & mappen"), data.files.length],
  ] as Array<[Exclude<ProjectTab, "home">, string, number]>).filter(([sectionId]) => ({
    inspections: moduleEnabled("inspections"),
    findings: moduleEnabled("quality"),
    ncr: moduleEnabled("quality"),
    hse: moduleEnabled("hse"),
    daily: true,
    documents: moduleEnabled("documents"),
    registers: moduleEnabled("documents"),
    visual: moduleEnabled("visual_evidence"),
    drawings: moduleEnabled("documents"),
    tools: moduleEnabled("documents"),
    files: moduleEnabled("visual_evidence"),
  })[sectionId]);
  const activeSectionLabel = projectSections.find(([id]) => id === tab)?.[1];
  const activeSectionCount = projectSections.find(([id]) => id === tab)?.[2] ?? 0;
  const projectSectionGroups = [
    {
      label: text("Field control", "Veldcontrole"),
      sections: projectSections.filter(([id]) => ["inspections", "findings", "ncr", "hse", "daily"].includes(id)),
    },
    {
      label: text("Documents & approvals", "Documenten & goedkeuring"),
      sections: projectSections.filter(([id]) => ["documents", "registers", "drawings"].includes(id)),
    },
    {
      label: text("Evidence & tools", "Bewijs & hulpmiddelen"),
      sections: projectSections.filter(([id]) => ["visual", "files", "tools"].includes(id)),
    },
  ].filter((group) => group.sections.length);
  const canCreateRecord = ["inspections", "findings", "hse", "registers"].includes(tab);

  return (
    <>
      {tab === "home" ? <header className="secondary-header workspace-header home">
        <div>
          <p className="eyebrow">{projectName}</p>
          <h1>{text("Workspace", "Werkruimte")}</h1>
          <p>{text("Choose one task. Project context and filing are handled automatically.", "Kies één taak. Projectcontext en ordening worden automatisch geregeld.")}</p>
        </div>
      </header> : null}

      {tab === "home" ? (
        <>
          <ProjectWorkspaceHome
            counts={{
              inspections: data.inspections.length,
              issues: data.findings.filter((item) => item.finding_type !== "ncr" && !["closed", "cancelled"].includes(item.status)).length,
              ncr: data.findings.filter((item) => item.finding_type === "ncr" && !["closed", "cancelled"].includes(item.status)).length,
              hse: data.hseEvents.length,
              photos: data.visualCaptures.filter((capture) => capture.capture_type === "photo" && capture.status === "active").length,
              deliveries: data.registerEntries.filter((entry) => entry.register_type === "delivery").length,
              agreements: data.registerEntries.filter((entry) => entry.register_type === "agreement").length,
              deadlines: data.findings.filter((item) => item.due_at && !["closed", "cancelled"].includes(item.status)).length
                + data.registerEntries.filter((entry) => entry.due_at && !["closed", "approved", "cancelled"].includes(entry.status)).length,
            }}
            modules={data.settings?.modules ?? {}}
            openQuickCamera={openQuickCamera}
            openTask={openTask}
            openFinding={openFinding}
            openRegister={openRegister}
            openDailyRecord={openDailyRecord}
            openDailyWork={(view) => { setDailyWorkView(view); switchTab("daily"); }}
            openActionCenter={openActionCenter}
            openRapidVerify={openRapidVerify}
            openReports={openReports}
            openManagement={openManagement}
          />
        </>
      ) : (
        <>
          <div className="workspace-section-controls">
            <button className="workspace-back-button" type="button" onClick={() => switchTab("home")}><ArrowLeft size={17} /> {text("Workspace", "Werkruimte")}</button>
            <div className="workspace-current-module" aria-live="polite">
              <span>{projectName}</span>
              <strong>{activeSectionLabel}</strong>
              <b>{activeSectionCount}</b>
            </div>
            <label className="workspace-section-picker mobile-workspace-section-select">
              <span>{text("Switch module", "Wissel van module")}</span>
              <select value={tab} onChange={(event) => switchTab(event.target.value as ProjectTab)} aria-label={text("Switch project module", "Wissel projectmodule")}>
                {projectSectionGroups.map((group) => (
                  <optgroup label={group.label} key={group.label}>
                    {group.sections.map(([id, label, count]) => <option value={id} key={id}>{label} · {count}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            {canCreateRecord && !activeInspection ? <button className="primary-button workspace-module-create" type="button" onClick={() => setShowForm((value) => !value)}><Plus size={15} /> {text("New", "Nieuw")}</button> : null}
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
                <span><strong>{inspectionPhotos.length ? text(`${inspectionPhotos.length} photos ready`, `${inspectionPhotos.length} foto’s klaar`) : text("Take or choose a photo", "Maak of kies een foto")}</strong><small>{photoCaptureHint}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotosToStack(event.currentTarget.files, setInspectionPhotos, setInspectionPhotoError); event.currentTarget.value = ""; }} />
              </label>
              <PhotoEvidenceList
                photos={inspectionPhotos}
                setPhotos={setInspectionPhotos}
                markupContext={{ ...markupOptions, defaultBuildingId: activeInspection.building_id }}
              />
              {inspectionPhotoError ? <p className="field-error" role="alert">{inspectionPhotoError}</p> : null}
              <div className="form-actions checklist-sticky-actions"><button className="secondary-button" type="button" onClick={() => setActiveInspection(null)}>{text("Complete later", "Later afronden")}</button><button className="primary-button" type="button" disabled={busy || activeTemplate.items.some((item) => item.required && !checklistItemAnswered(item, inspectionAnswers[item.id]))} onClick={() => void submitInspection()}>{busy ? <Loader2 className="spin" size={15} /> : <FileCheck2 size={15} />} {text("Complete inspection", "Inspectie afronden")}</button></div>
            </div>
          ) : null}
          {showForm && !activeInspection ? (
            <div className="operation-form">
              <h2>{text("Start inspection", "Inspectie starten")}</h2>
              {!reportId ? <p className="form-helper">{text("Starting this checklist prepares today’s draft report automatically.", "Bij het starten van deze checklist wordt het conceptrapport van vandaag automatisch klaargezet.")}</p> : null}
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
                <BuildingPicker id="inspection-building" buildings={buildings} value={inspectionBuildingId} onChange={(next) => { setInspectionBuildingId(next); setInspectionLocationNodeId(""); }} />
                <LocationPicker id="inspection-location" nodes={data.locationNodes} buildingId={inspectionBuildingId} value={inspectionLocationNodeId} onChange={setInspectionLocationNodeId} requiredDepth={requiredLocationDepth} />
                <label className="form-field"><span>{text("Checklist · recommended for today's work first", "Checklist · aanbevolen voor vandaag eerst")}</span><select value={inspectionTemplateId || inspectionTemplates[0]?.id || ""} onChange={(event) => { setInspectionTemplateId(event.target.value); setInspectionTitle(""); }}>{inspectionTemplates.map((template) => <option value={template.id} key={template.id}>{["LIB-101", "LIB-102", "LIB-103"].includes(template.code) ? "★ " : ""}{template.name} · v{template.version_number}</option>)}</select></label>
                <details className="inspection-subject-details"><summary>{text("Add a different subject or element · optional", "Ander onderwerp of element toevoegen · optioneel")}</summary><label className="form-field"><span>{text("Subject / element", "Onderwerp / element")}</span><input value={inspectionTitle} onChange={(event) => setInspectionTitle(event.target.value)} placeholder={`${inspectionTemplates.find((template) => template.id === (inspectionTemplateId || inspectionTemplates[0]?.id))?.name ?? text("Inspection", "Inspectie")} · ${buildingName}`} /></label></details>
                <button className="primary-button start-checklist-button" type="button" disabled={busy || (exactLocationRequired && !inspectionLocationNodeId)} onClick={() => void beginInspection()}><ClipboardCheck size={15} /> {text("Start recommended checklist", "Start aanbevolen checklist")}</button>
              </> : <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("No project checklist is published yet", "Nog geen projectchecklist gepubliceerd")}</strong><span>{text("An administrator can install the ready-made CODECO checklist package under More.", "Een beheerder kan het kant-en-klare CODECO-pakket onder Meer installeren.")}</span></div></div>}
            </div>
          ) : null}
          <div className="operation-form inspection-search">
            <div className="operation-form-heading"><div><span className="record-number">{text("Inspection lookup", "Inspecties terugvinden")}</span><h2>{text("Search by building, exact location and date", "Zoek op gebouw, exacte locatie en datum")}</h2></div><span>{filteredInspections.length}</span></div>
            <div className="form-grid-2">
              <label className="form-field"><span>{text("Building", "Gebouw")}</span><select value={inspectionFilterBuildingId} onChange={(event) => { setInspectionFilterBuildingId(event.target.value); setInspectionFilterLocationNodeId(""); }}><option value="">{text("All buildings", "Alle gebouwen")}</option>{buildings.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}</select></label>
              <label className="form-field"><span>{text("Exact location", "Exacte locatie")}</span><select value={inspectionFilterLocationNodeId} onChange={(event) => setInspectionFilterLocationNodeId(event.target.value)}><option value="">{text("All locations", "Alle locaties")}</option>{data.locationNodes.filter((node) => !inspectionFilterBuildingId || node.building_id === inspectionFilterBuildingId).map((node) => <option value={node.id} key={node.id}>{locationBreadcrumb(data.locationNodes, node.id)}</option>)}</select></label>
              <label className="form-field"><span>{text("Inspection date", "Inspectiedatum")}</span><input type="date" value={inspectionFilterDate} onChange={(event) => setInspectionFilterDate(event.target.value)} /></label>
              <button className="secondary-button" type="button" onClick={() => { setInspectionFilterBuildingId(""); setInspectionFilterLocationNodeId(""); setInspectionFilterDate(""); }}>{text("Clear filters", "Wis filters")}</button>
            </div>
          </div>
          {inspectionResumeError ? <p className="field-error" role="alert">{inspectionResumeError}</p> : null}
          {/* An inspection that is still open can be opened again from this list, so a
              started checklist can actually be filled in and completed. */}
          <RecordList empty={text("No inspections match these filters.", "Geen inspecties gevonden met deze filters.")} rows={filteredInspections.map((inspection) => ({
            id: inspection.id,
            icon: ClipboardCheck,
            title: inspection.title,
            meta: `${inspection.inspection_number} · ${recordContextLabel(inspection.building_id, inspection.location_node_id)} · ${formatDate(inspection.completed_at ?? inspection.started_at, locale)}`,
            status: inspection.status.replaceAll("_", " "),
            tone: inspection.status === "passed" ? "green" : inspection.status === "failed" ? "red" : "",
            open: ["planned", "in_progress", "ready_for_reinspection", "failed"].includes(inspection.status)
              ? {
                label: activeInspection?.id === inspection.id
                  ? text("Open below", "Staat hieronder")
                  : text("Fill in checklist", "Checklist invullen"),
                onOpen: () => {
                  void resumeInspection(inspection);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                },
              }
              : undefined,
          }))} />
        </section>
      ) : null}

      {tab === "findings" || tab === "ncr" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className="operation-form snap-assign-form">
              <div className="operation-form-heading"><div><span className="record-number">{findingScope === "ncr" ? text("Formal non-conformance", "Formele afwijking") : text("Issue management", "Issuebeheer")}</span><h2>{findingScope === "ncr" ? text("Non-conformance report", "Non-conformance report") : text("Create issue", "Issue registreren")}</h2></div>{!online ? <span className="experimental-badge"><WifiOff size={13} /> {text("Queues offline", "Offline wachtrij")}</span> : null}</div>
              {/* The head of the client's own NCR form: project, contractor, subject and
                  the reference, with the date and the report number filled by the app. */}
              {findingScope === "ncr" ? (
                <section className="controlled-document-context ncr-form-context" aria-label={text("Non-conformance report header", "Kop van het non-conformance report")}>
                  <div><small>{text("Project name and number", "Projectnaam en -nummer")}</small><strong>{projectName}</strong><span>{projectCode}</span></div>
                  <div><small>{text("Contractor", "Aannemer")}</small><strong>{parties.find((party) => party.id === findingForm.responsiblePartyId)?.name || text("Not assigned yet", "Nog niet toegewezen")}</strong><span>{buildings.find((building) => building.id === findingBuildingId)?.name ?? buildingName}</span></div>
                  <div><small>{text("Date", "Datum")}</small><strong>{issueDate}</strong><span>{issueTime}</span></div>
                  <div><small>{text("Report no · automatic", "Rapportnummer · automatisch")}</small><strong>{text("On submit", "Bij indienen")}</strong><span>{findingForm.signedBy ? text("Signed", "Ondertekend") : text("Not signed yet", "Nog niet ondertekend")}</span></div>
                </section>
              ) : null}
              <label className="finding-photo-capture">
                <Camera size={22} />
                <span><strong>{findingPhotos.length ? text(`${findingPhotos.length} photos ready`, `${findingPhotos.length} foto’s klaar`) : text("Take or choose a photo", "Maak of kies een foto")}</strong><small>{photoCaptureHint}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addFindingPhotos(event.target.files); event.currentTarget.value = ""; }} />
              </label>
              <PhotoEvidenceList
                photos={findingPhotos}
                setPhotos={setFindingPhotos}
                markupContext={{ ...markupOptions, defaultBuildingId: findingBuildingId }}
              />
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
                {/* In the NCR module the type is the NCR itself; a dropdown that can only
                    say "NCR" is one box too many on the client's form. */}
                {findingScope === "ncr"
                  ? <label className="form-field"><span>{text("Reference checklist / earlier report", "Referentiechecklist / eerder rapport")}</span><input value={findingForm.referenceChecklist} onChange={(event) => setFindingForm({ ...findingForm, referenceChecklist: event.target.value })} placeholder="NCR - 51" /></label>
                  : <label className="form-field"><span>{text("Type", "Type")}</span><select value={findingForm.type} onChange={(event) => setFindingForm({ ...findingForm, type: event.target.value })}><option value="observation">{text("Observation", "Observatie")}</option><option value="deficiency">{text("Deficiency", "Tekortkoming")}</option><option value="deviation">{text("Deviation", "Afwijking")}</option><option value="ncr">NCR</option><option value="improvement">{text("Improvement opportunity", "Verbeterkans")}</option></select></label>}
                <label className="form-field"><span>{text("Priority", "Priority")}</span><select value={findingForm.severity} onChange={(event) => setFindingForm({ ...findingForm, severity: event.target.value })}><option value="low">{text("Low · 14 days", "Low · 14 dagen")}</option><option value="medium">{text("Medium · 7 days", "Middel · 7 dagen")}</option><option value="high">{text("High · 3 days", "Hoog · 3 dagen")}</option><option value="critical">{text("Critical · 1 day + escalation", "Kritiek · 1 dag + escalatie")}</option></select></label>
              </div>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Issue type", "Issue Type")}</span><select value={findingForm.issueType} onChange={(event) => setFindingForm({ ...findingForm, issueType: event.target.value })}><option value="informational">Informational</option><option value="procedural">Procedural</option><option value="system">System</option><option value="other">Other</option><option value="quality">{text("Quality / workmanship", "Kwaliteit / uitvoering")}</option></select></label>
                <label className="form-field"><span>{text("Disposition", "Beoordeling")}</span><select value={findingForm.disposition} onChange={(event) => setFindingForm({ ...findingForm, disposition: event.target.value as typeof findingForm.disposition })}><option value="validated">{text("Validated", "Gevalideerd")}</option><option value="to_be_corrected">{text("To be corrected", "Te corrigeren")}</option><option value="alternative_solution">{text("Alternative solution required", "Alternatieve oplossing nodig")}</option></select></label>
              </div>
              <div className="form-grid">
                <label className="form-field"><span>{findingScope === "ncr" ? text("Subject", "Onderwerp") : text("Issue title · used as the log line", "Issuetitel · wordt de regel in het log")}</span><input value={findingForm.title} onChange={(event) => setFindingForm({ ...findingForm, title: event.target.value })} placeholder={findingScope === "ncr" ? text("What the non-conformance is about", "Waar de afwijking over gaat") : text("Short title for the issue log", "Korte titel voor het issuelog")} /></label>
                <label className="form-field"><span>{findingScope === "ncr" ? text("Description of non-conformance", "Omschrijving van de afwijking") : text("Issue description", "Issue Description")}</span><textarea rows={findingScope === "ncr" ? 5 : 3} value={findingForm.description} onChange={(event) => setFindingForm({ ...findingForm, description: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, description: appendDictation(current.description, transcript) }))} /></label>
              </div>
              {/* "Recommended Action by Engineer" on the client's own NCR form: rework or
                  repair, with the sentence that says what has to happen. */}
              {findingScope === "ncr" ? (
                <div className="click-answer-block ncr-recommended-action">
                  <strong>{text("Recommended action by engineer", "Aanbevolen actie door de ingenieur")}</strong>
                  <div className="quick-issue-presets">
                    {([["rework", text("Rework", "Opnieuw uitvoeren")], ["repair", text("Repair", "Herstellen")], ["alternative", text("Alternative solution for approval", "Alternatieve oplossing ter goedkeuring")]] as const).map(([value, label]) => (
                      <button className={findingForm.recommendedAction === value ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, recommendedAction: findingForm.recommendedAction === value ? "" : value })} key={value}>{label}</button>
                    ))}
                  </div>
                  <label className="form-field"><span>{text("What the contractor has to do", "Wat de aannemer moet doen")}</span><textarea rows={2} value={findingForm.recommendedActionDetail} onChange={(event) => setFindingForm({ ...findingForm, recommendedActionDetail: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, recommendedActionDetail: appendDictation(current.recommendedActionDetail, transcript) }))} /></label>
                </div>
              ) : null}
              <div className="click-answer-block"><strong>{text("Impact", "Impact")}</strong><div className="quick-issue-presets">{findingImpactPresets.map((option) => <button className={findingForm.impactSummary === option ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, impactSummary: option })} key={option}>{option}</button>)}</div></div>
              <div className="click-answer-block"><strong>{text("Required follow-up", "Vereiste opvolging")}</strong><div className="quick-issue-presets">{findingActionPresets.map((option) => <button className={findingForm.actionSteps === option ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, actionSteps: option })} key={option}>{option}</button>)}</div></div>
              <details className="optional-text-entry">
                <summary>{text("Different impact or action", "Andere impact of actie")}</summary>
                <div className="form-grid">
                  <label className="form-field"><span>{text("Different impact", "Andere impact")}</span><textarea value={findingForm.impactSummary} onChange={(event) => setFindingForm({ ...findingForm, impactSummary: event.target.value })} rows={2} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, impactSummary: appendDictation(current.impactSummary, transcript) }))} /></label>
                  <label className="form-field"><span>{text("Different action", "Andere actie")}</span><textarea value={findingForm.actionSteps} onChange={(event) => setFindingForm({ ...findingForm, actionSteps: event.target.value })} rows={2} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, actionSteps: appendDictation(current.actionSteps, transcript) }))} /></label>
                </div>
              </details>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Date identified", "Date Identified")}</span><input type="date" value={findingForm.dateIdentified} onChange={(event) => setFindingForm({ ...findingForm, dateIdentified: event.target.value })} /></label>
                <label className="form-field"><span>{text("Expected resolution date", "Expected Resolution Date")}</span><input type="date" value={findingForm.expectedResolutionDate} onChange={(event) => setFindingForm({ ...findingForm, expectedResolutionDate: event.target.value })} /></label>
              </div>
              <label className="check-field issue-escalation"><input type="checkbox" checked={findingForm.escalationRequired} onChange={(event) => setFindingForm({ ...findingForm, escalationRequired: event.target.checked })} /> {text("Escalation required (Y/N)", "Escalation Required (Y/N)")}</label>
              <p className="form-helper">{text(`Entered by ${currentUserName} · the ID, current status and actual resolution date are kept by the app itself.`, `Entered By ${currentUserName} · het ID, de status en de Actual Resolution Date houdt de app zelf bij.`)}</p>
              <div className="form-grid-2">
                <BuildingPicker id="finding-building" buildings={buildings} value={findingBuildingId} onChange={(next) => { setFindingBuildingId(next); setFindingLocationNodeId(""); }} allowAll />
                <label className="form-field"><span>{findingScope === "ncr" ? text("Contractor · receives this NCR", "Aannemer · ontvangt deze NCR") : text("Assigned to owner", "Assigned To Owner")}</span><select value={findingForm.responsiblePartyId} onChange={(event) => setFindingForm({ ...findingForm, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Nog niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
              </div>
              <LocationPicker id="finding-location" nodes={data.locationNodes} buildingId={findingBuildingId} value={findingLocationNodeId} onChange={setFindingLocationNodeId} requiredDepth={requiredLocationDepth} />
              {/* The last two boxes of the client's NCR form: free remarks and the
                  signature of the engineer who issues it. */}
              {findingScope === "ncr" ? (
                <>
                  <label className="form-field"><span>{text("Remarks", "Opmerkingen")}</span><textarea rows={2} value={findingForm.remarks} onChange={(event) => setFindingForm({ ...findingForm, remarks: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, remarks: appendDictation(current.remarks, transcript) }))} /></label>
                  <label className="check-field controlled-document-signature">
                    <input
                      type="checkbox"
                      checked={Boolean(findingForm.signedBy)}
                      onChange={(event) => setFindingForm({
                        ...findingForm,
                        signedBy: event.target.checked ? currentUserName : "",
                        signedAt: event.target.checked ? new Date().toISOString() : "",
                      })}
                    />
                    <span>
                      <strong>{text("Sign as the engineer who issues this NCR", "Ondertekenen als ingenieur die deze NCR uitgeeft")}</strong>
                      <small>{findingForm.signedBy
                        ? text(`Signed by ${findingForm.signedBy} · ${formatDate(findingForm.signedAt, locale)}`, `Ondertekend door ${findingForm.signedBy} · ${formatDate(findingForm.signedAt, locale)}`)
                        : text("The name and the moment of signing are stored with the report.", "De naam en het moment van ondertekenen worden bij het rapport opgeslagen.")}</small>
                    </span>
                  </label>
                  <div className="operation-alert warning"><RotateCcw size={17} /><div><strong>{text("The contractor fills in the correction", "De aannemer vult de correctie in")}</strong><span>{text("After submitting you send this NCR to the contractor with one tap. The contractor fills in the proposed corrective action and sends it back; the quality-control close-out stays with CODECO.", "Na indienen stuur je deze NCR met één tik naar de aannemer. De aannemer vult de voorgestelde correctieve actie in en stuurt die terug; de eindcontrole blijft bij CODECO.")}</span></div></div>
                </>
              ) : null}
              <button className="primary-button" type="button" disabled={busy || (exactLocationRequired && findingBuildingId !== ALL_BUILDINGS && !findingLocationNodeId) || (!online && !findingPhotos.length) || findingForm.title.trim().length < 3 || findingForm.description.trim().length < 3} onClick={() => void addFinding()}><AlertTriangle size={15} /> {!online ? text("Add to sync queue", "In synchronisatiewachtrij") : findingScope === "ncr" ? text("Submit NCR", "NCR indienen") : text("Submit issue", "Probleem indienen")}</button>
            </div>
          ) : null}
          {/* Submitting is not the end of an NCR: the contractor has to receive it and
              send the correction back, so the link stands right where you submitted. */}
          {submittedFinding ? (
            <SubmittedRecordShare
              finding={submittedFinding}
              scope={findingScope}
              projectName={projectName}
              projectCode={projectCode}
              buildingName={buildings.find((building) => building.id === submittedFinding.building_id)?.name ?? buildingName}
              contractorName={parties.find((party) => party.id === submittedFinding.responsible_party_id)?.name ?? ""}
              busy={busy}
              share={shareFinding}
              close={() => setSubmittedFinding(null)}
            />
          ) : null}
          <div className="punchlist-command">
            <div className="punchlist-stages">
              {[
                [text("Open", "Open"), scopedFindings.filter((item) => ["draft", "open", "assigned"].includes(item.status)).length],
                [text("In progress", "In uitvoering"), scopedFindings.filter((item) => ["in_progress", "reopened", "rejected"].includes(item.status)).length],
                [text("Ready for verification", "Gereed voor verificatie"), scopedFindings.filter((item) => item.status === "ready_for_verification").length],
                [text("Verified", "Geverifieerd"), scopedFindings.filter((item) => item.status === "closed").length],
              ].map(([label, count], index) => <div className={index === 2 ? "attention" : index === 3 ? "complete" : ""} key={String(label)}><span>{index + 1}</span><strong>{count}</strong><small>{label}</small></div>)}
            </div>
            <div className="punchlist-cycle-card">
              <span><RotateCcw size={19} /></span>
              <div><strong>{text("Contractor-to-supervisor review cycle", "Reviewcyclus aannemer naar supervisor")}</strong><p>{text("The contractor marks work ready with evidence. A supervisor verifies, closes or reopens it with a reason. The history remains intact.", "De aannemer meldt werk gereed met bewijs. Een supervisor verifieert, sluit of heropent het met reden. De historie blijft intact.")}</p></div>
              <div className="button-row"><button className="secondary-button" type="button" onClick={() => setTab("visual")}><Camera size={14} /> {text("Open normal photo", "Open normale foto")}</button><button className="secondary-button" type="button" onClick={() => setTab("visual")}><RotateCcw size={14} /> {text("Open 360° image", "Open 360°-beeld")}</button></div>
            </div>
          </div>
          <FindingList
            data={data}
            client={client}
            run={run}
            findings={scopedFindings}
            progressUpdates={data.findingProgressUpdates}
            visualAnnotations={data.visualAnnotations}
            externalShareLinks={data.externalShareLinks ?? []}
            projectName={projectName}
            projectCode={projectCode}
            buildings={buildings}
            locationNodes={data.locationNodes}
            currentUserName={currentUserName}
            parties={parties}
            busy={busy}
            transition={(finding, nextStatus, note, finalMeasure, correction) => run(() => transitionFinding(client, finding.id, nextStatus, note, finalMeasure, correction), `Bevinding ${finding.finding_number} staat nu op ${findingStatusLabels[nextStatus] ?? nextStatus}.`)}
            recordProgress={(finding, progressPercent, disposition, note) => run(
              () => recordFindingProgress(client, { findingId: finding.id, progressPercent, disposition, note }),
              text(`Progress for ${finding.finding_number} recorded; 100% still requires verification.`, `Voortgang voor ${finding.finding_number} vastgelegd; ook 100% vraagt nog verificatie.`),
            )}
            share={shareFinding}
            revoke={(shareId) => run(
              () => revokeExternalShareLink(client, shareId),
              text("External link revoked. A previously sent WhatsApp link no longer works.", "Externe link ingetrokken. Een eerder verstuurde WhatsApp-link werkt niet meer."),
            )}
            linkVisual={(finding) => {
              setVisualFindingId(finding.id);
              switchTab("visual");
            }}
            linkDrawing={(finding) => {
              setDrawingFindingId(finding.id);
              switchTab("drawings");
            }}
          />
        </section>
      ) : null}

      {tab === "hse" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className="operation-form">
              <h2>{text("HSE observation or incident", "HSE-observatie of incident")}</h2>
              {/* The situation chips already set the type. A second Type dropdown next to
                  them said the same thing twice, so it moved into the manual block below. */}
              <div className="quick-issue-presets" aria-label={text("Choose a standard HSE record", "Kies een standaard HSE-registratie")}>{hsePresets.map((preset) => <button className={hseForm.title === preset.title ? "active" : ""} type="button" onClick={() => setHseForm({ ...hseForm, ...preset })} key={preset.title}>{preset.title}</button>)}</div>
              <label className="form-field"><span>{text("Severity", "Ernst")}</span><select value={hseForm.severity} onChange={(event) => setHseForm({ ...hseForm, severity: event.target.value })}><option value="low">{text("Low", "Laag")}</option><option value="medium">{text("Medium", "Middel")}</option><option value="high">{text("High", "Hoog")}</option><option value="critical">{text("Critical", "Kritiek")}</option></select></label>
              <details className="optional-text-entry">
                <summary>{text("Different HSE situation", "Andere HSE-situatie")}</summary>
                <div className="form-grid">
                  <label className="form-field"><span>{text("Type", "Type")}</span><select value={hseForm.type} onChange={(event) => setHseForm({ ...hseForm, type: event.target.value })}><option value="positive_observation">{text("Positive observation", "Positieve observatie")}</option><option value="unsafe_act">{text("Unsafe act", "Onveilige handeling")}</option><option value="unsafe_condition">{text("Unsafe condition", "Onveilige situatie")}</option><option value="near_miss">Near miss</option><option value="incident">Incident</option><option value="stop_work">Stop work</option><option value="toolbox">Toolbox meeting</option></select></label>
                  <label className="form-field"><span>{text("Title", "Titel")}</span><input value={hseForm.title} onChange={(event) => setHseForm({ ...hseForm, title: event.target.value })} /></label>
                  <label className="form-field"><span>{text("What was observed?", "Wat is waargenomen?")}</span><textarea value={hseForm.description} onChange={(event) => setHseForm({ ...hseForm, description: event.target.value })} rows={3} /><DictateButton onText={(transcript) => setHseForm((current) => ({ ...current, description: appendDictation(current.description, transcript) }))} /></label>
                  <label className="form-field"><span>{text("Immediate measure", "Directe maatregel")}</span><textarea value={hseForm.immediateMeasure} onChange={(event) => setHseForm({ ...hseForm, immediateMeasure: event.target.value })} rows={2} /><DictateButton onText={(transcript) => setHseForm((current) => ({ ...current, immediateMeasure: appendDictation(current.immediateMeasure, transcript) }))} /></label>
                </div>
              </details>
              <label className="finding-photo-capture hse-photo-capture">
                <Camera size={22} />
                <span><strong>{hsePhotos.length ? text(`${hsePhotos.length} photos ready`, `${hsePhotos.length} foto’s klaar`) : text("Take or choose a photo", "Maak of kies een foto")}</strong><small>{photoCaptureHint}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotosToStack(event.currentTarget.files, setHsePhotos, setHsePhotoError); event.currentTarget.value = ""; }} />
              </label>
              <PhotoEvidenceList
                photos={hsePhotos}
                setPhotos={setHsePhotos}
                markupContext={{ ...markupOptions, defaultBuildingId: hseBuildingId === ALL_BUILDINGS ? "" : hseBuildingId }}
              />
              {hsePhotoError ? <p className="field-error" role="alert">{hsePhotoError}</p> : null}
              <div className="form-grid-2">
                <BuildingPicker id="hse-building" buildings={buildings} value={hseBuildingId} onChange={(next) => { setHseBuildingId(next); setHseLocationNodeId(""); }} allowAll />
                <LocationPicker id="hse-location" nodes={data.locationNodes} buildingId={hseBuildingId} value={hseLocationNodeId} onChange={setHseLocationNodeId} requiredDepth={hseBuildingId === ALL_BUILDINGS ? "building" : requiredLocationDepth} />
              </div>
              <label className="check-field"><input type="checkbox" checked={hseForm.confidential} onChange={(event) => setHseForm({ ...hseForm, confidential: event.target.checked })} /> {text("Restrict this sensitive incident to authorized HSE roles", "Beperk dit gevoelige incident tot bevoegde HSE-rollen")}</label>
              <button className="primary-button" type="button" disabled={busy || (exactLocationRequired && hseBuildingId !== ALL_BUILDINGS && !hseLocationNodeId) || hseForm.title.trim().length < 3 || hseForm.description.trim().length < 3} onClick={() => void addHse()}><ShieldCheck size={15} /> {text("Save HSE record", "HSE-registratie opslaan")}</button>
            </div>
          ) : null}
          <RecordList empty={text("No formal HSE records yet.", "Nog geen formele HSE-registraties.")} rows={data.hseEvents.map((event) => ({ id: event.id, icon: ShieldCheck, title: event.confidential ? `${event.title} · ${text("confidential", "vertrouwelijk")}` : event.title, meta: `${event.event_number} · ${recordContextLabel(event.building_id, event.location_node_id)} · ${event.event_type.replaceAll("_", " ")} · ${formatDate(event.occurred_at, locale)}`, status: event.status.replaceAll("_", " "), tone: event.severity === "critical" ? "red" : event.status === "closed" ? "green" : "" }))} />
        </section>
      ) : null}

      {tab === "registers" ? (
        <section className="operation-panel">
          {showForm ? (
            <div className={`operation-form ${controlledRegister ? "wide controlled-document-form" : ""}`}>
              <div className="operation-form-heading"><div><span className="record-number">{controlledRegister ? text("Client-controlled form", "Klantgestuurd formulier") : text("Project register", "Projectregister")}</span><h2>{controlledRegister ? registerNames[registerForm.type] : text("Add project register item", "Projectregister aanvullen")}</h2></div>{controlledRegister ? <span className="controlled-document-badge">{projectCode} · {registerContextLabel}</span> : null}</div>
              {/* A controlled document starts with the project information and the dates:
                  that is the head of the paper form the client hands out. */}
              {controlledRegister ? (
                <>
                <section className="controlled-document-context" aria-label={text("Project information", "Projectinformatie")}>
                  <div><small>{text("Project", "Project")}</small><strong>{projectName}</strong><span>{projectCode}</span></div>
                  <div><small>{text("Applies to", "Geldt voor")}</small><strong>{registerContextLabel}</strong><span>{registerLocationNodeId ? locationBreadcrumb(data.locationNodes, registerLocationNodeId) : text("Building level", "Gebouwniveau")}</span></div>
                  <div><small>{text("Issue date and time", "Uitgiftedatum en -tijd")}</small><strong>{issueDate}</strong><span>{issueTime}</span></div>
                  <div><small>{text("Drawn up by", "Opgemaakt door")}</small><strong>{registerForm.issuerName.trim() || currentUserName}</strong><span>{registerForm.signedBy ? text("Signed", "Ondertekend") : text("Not signed yet", "Nog niet ondertekend")}</span></div>
                </section>
                  <section className="controlled-document-dates" aria-label={text("Document dates", "Documentdatums")}>
                    <header><FileCheck2 size={17} /><div><strong>{registerForm.type === "technical_instruction" ? text("Technical instruction dates", "Datums technische instructie") : text("Document dates", "Documentdatums")}</strong><small>{text("The issue date and time come from the controlled project context; the deadline is selected explicitly.", "De uitgiftedatum en -tijd komen uit de gecontroleerde projectcontext; de deadline wordt expliciet gekozen.")}</small></div></header>
                    <div className="form-grid">
                      <label className="form-field"><span>{text("Issue date · automatic", "Uitgiftedatum · automatisch")}</span><input type="date" value={issueDate} readOnly /></label>
                      <label className="form-field"><span>{text("Issue time · automatic", "Uitgiftetijd · automatisch")}</span><input type="time" value={issueTime} readOnly /></label>
                      <label className="form-field"><span>{registerForm.type === "technical_instruction" ? text("Instruction deadline / required by", "Deadline instructie / uitvoeren uiterlijk") : text("Response / information required by", "Antwoord / informatie nodig uiterlijk")}</span><input type="date" min={issueDate} value={registerForm.dueDate} onChange={(event) => setRegisterForm({ ...registerForm, dueDate: event.target.value })} /></label>
                    </div>
                  </section>
                </>
              ) : null}
              <div className="form-grid-2">
                <BuildingPicker id="register-building" buildings={buildings} value={registerBuildingId} onChange={(next) => { setRegisterBuildingId(next); setRegisterLocationNodeId(""); }} allowAll label={controlledRegister ? text("Building · or project-wide", "Gebouw · of projectbreed") : text("Building · or general material", "Gebouw · of algemeen materiaal")} />
                <LocationPicker id="register-location" nodes={data.locationNodes} buildingId={registerBuildingId} value={registerLocationNodeId} onChange={setRegisterLocationNodeId} requiredDepth={registerBuildingId === ALL_BUILDINGS ? "building" : requiredLocationDepth} />
                <label className="form-field"><span>{text("Register / document format", "Register / documentformaat")}</span><select value={registerForm.type} onChange={(event) => setRegisterForm({ ...emptyControlledDocumentDraft, type: event.target.value })}>{Object.entries(registerNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                {registerBuildingId !== ALL_BUILDINGS && registerDrawings.length ? (
                  <label className="form-field"><span>{text("Location on drawing", "Locatie op tekening")}</span>
                    <select value={registerDrawingId} onChange={(event) => setRegisterDrawingId(event.target.value)}>
                      <option value="">{text("No drawing selected", "Geen tekening gekozen")}</option>
                      {registerDrawings.map((drawing) => <option value={drawing.id} key={drawing.id}>{drawing.original_name}</option>)}
                    </select>
                    <button className="field-inline-link" type="button" onClick={() => switchTab("drawings")}><MapPin size={12} /> {text("Open the drawing to place a pin", "Open de tekening om een pin te plaatsen")}</button>
                  </label>
                ) : null}
              </div>
              {activeRegisterPresets.length ? <div className="quick-issue-presets" aria-label={text("Choose a standard register item", "Kies een standaard registeritem")}>{activeRegisterPresets.map((preset) => <button className={registerForm.title === preset.title ? "active" : ""} type="button" onClick={() => setRegisterForm({ ...registerForm, ...preset })} key={preset.title}>{preset.title}</button>)}</div> : null}
              {controlledRegister ? (
                <div className="form-grid">
                  <label className="form-field"><span>{registerForm.type === "technical_instruction" ? text("Instruction title / reference", "Titel / referentie instructie") : registerForm.type === "change_order" ? text("Change title / reference", "Titel / referentie wijziging") : text("Title / reference", "Titel / referentie")}</span><input value={registerForm.title} onChange={(event) => setRegisterForm({ ...registerForm, title: event.target.value })} /></label>
                  <label className="form-field"><span>{registerForm.type === "technical_instruction" ? text("Instruction description", "Omschrijving instructie") : registerForm.type === "change_order" ? text("Change description", "Omschrijving van de wijziging") : text("Formal request / instruction / observation", "Formeel verzoek / instructie / observatie")}</span><textarea value={registerForm.details} onChange={(event) => setRegisterForm({ ...registerForm, details: event.target.value })} rows={5} /><DictateButton onText={(transcript) => setRegisterForm((current) => ({ ...current, details: appendDictation(current.details, transcript) }))} /></label>
                </div>
              ) : agreementRegister ? (
                <>
                  {/* An agreement is one text and the two parties who made it. Everything
                      else on the register form is noise for this record. */}
                  <div className="form-grid-2">
                    <label className="form-field"><span>{text("Agreement between", "Afspraak tussen")}</span><select value={agreementForm.partyA} onChange={(event) => setAgreementForm({ ...agreementForm, partyA: event.target.value, signedByA: "", signedAtA: "" })}><option value="">{text("Choose party", "Kies partij")}</option>{agreementPartyOptions.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
                    <label className="form-field"><span>{text("and", "en")}</span><select value={agreementForm.partyB} onChange={(event) => setAgreementForm({ ...agreementForm, partyB: event.target.value, signedByB: "", signedAtB: "" })}><option value="">{text("Choose party", "Kies partij")}</option>{agreementPartyOptions.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
                  </div>
                  <label className="form-field"><span>{text("What was agreed?", "Wat is afgesproken?")}</span><textarea value={registerForm.details} onChange={(event) => setRegisterForm({ ...registerForm, details: event.target.value })} rows={5} /><DictateButton onText={(transcript) => setRegisterForm((current) => ({ ...current, details: appendDictation(current.details, transcript) }))} /></label>
                  <div className="agreement-signatures">
                    {([["partyA", "signedByA", "signedAtA"], ["partyB", "signedByB", "signedAtB"]] as const).map(([partyKey, signedKey, signedAtKey]) => {
                      const partyName = agreementForm[partyKey];
                      return (
                        <label className="check-field controlled-document-signature" key={partyKey}>
                          <input
                            type="checkbox"
                            disabled={!partyName}
                            checked={Boolean(agreementForm[signedKey])}
                            onChange={(event) => setAgreementForm({
                              ...agreementForm,
                              [signedKey]: event.target.checked ? partyName : "",
                              [signedAtKey]: event.target.checked ? new Date().toISOString() : "",
                            })}
                          />
                          <span>
                            <strong>{partyName ? text(`Signed for ${partyName}`, `Ondertekend namens ${partyName}`) : text("Choose a party first", "Kies eerst een partij")}</strong>
                            <small>{agreementForm[signedKey]
                              ? formatDate(agreementForm[signedAtKey], locale)
                              : text("The name and the moment of signing are stored with the agreement.", "De naam en het moment van ondertekenen worden bij de afspraak opgeslagen.")}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                {/* A delivery, test or equipment line is judged and counted; that verdict
                    and the quantity are what the client needs in the register. */}
                {registerQuantityTypes.includes(registerForm.type) ? (
                  <div className="form-grid-2 register-outcome">
                    <div className="form-field">
                      <label htmlFor="register-outcome">{registerForm.type === "delivery" ? text("Does the delivered material comply?", "Voldoet het geleverde materiaal?") : text("Outcome", "Resultaat")}</label>
                      <div className="quick-issue-presets" id="register-outcome">
                        {([["compliant", text("Complies", "Voldoet")], ["not_compliant", text("Does not comply", "Voldoet niet")], ["partly", text("Partly · see note", "Deels · zie toelichting")]] as const).map(([value, label]) => (
                          <button className={registerOutcome === value ? "active" : ""} type="button" onClick={() => setRegisterOutcome(registerOutcome === value ? "" : value)} key={value}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Quantity", "Hoeveelheid")}</span><input type="number" min="0" step="0.01" value={registerQuantity} onChange={(event) => setRegisterQuantity(event.target.value)} /></label>
                      <label className="form-field"><span>{text("Unit", "Eenheid")}</span><input value={registerUnit} onChange={(event) => setRegisterUnit(event.target.value)} placeholder={text("pcs, m³, kg", "st, m³, kg")} /></label>
                    </div>
                  </div>
                ) : null}
                <details className="optional-text-entry">
                  <summary>{text("Different title or document content", "Andere titel of documentinhoud")}</summary>
                  <div className="form-grid">
                    <label className="form-field"><span>{text("Title / reference", "Titel / referentie")}</span><input value={registerForm.title} onChange={(event) => setRegisterForm({ ...registerForm, title: event.target.value })} /></label>
                    <label className="form-field"><span>{text("Details, quantity, measure or decision", "Details, hoeveelheid, maatregel of besluit")}</span><textarea value={registerForm.details} onChange={(event) => setRegisterForm({ ...registerForm, details: event.target.value })} rows={3} /><DictateButton onText={(transcript) => setRegisterForm((current) => ({ ...current, details: appendDictation(current.details, transcript) }))} /></label>
                  </div>
                </details>
                </>
              )}
              {controlledRegister ? <>
                <label className="form-field"><span>{text("Revision", "Revisie")}</span><input value={registerForm.revision} onChange={(event) => setRegisterForm({ ...registerForm, revision: event.target.value })} /></label>
                {/* Who draws the document up is a choice, not always the person logged in. */}
                <div className="form-grid-2">
                  <label className="form-field"><span>{text("Drawn up by", "Opgemaakt door")}</span>
                    <select value={documentIssuerOptions.includes(registerForm.issuerName.trim() || currentUserName) ? registerForm.issuerName.trim() || currentUserName : "__other__"} onChange={(event) => setRegisterForm({ ...registerForm, issuerName: event.target.value === "__other__" ? "" : event.target.value })}>
                      {documentIssuerOptions.map((name) => <option value={name} key={name}>{name}</option>)}
                      <option value="__other__">{text("Someone else · type the name", "Iemand anders · naam typen")}</option>
                    </select>
                  </label>
                  {documentIssuerOptions.includes(registerForm.issuerName.trim() || currentUserName)
                    ? null
                    : <label className="form-field"><span>{text("Name of the author", "Naam van de opsteller")}</span><input value={registerForm.issuerName} onChange={(event) => setRegisterForm({ ...registerForm, issuerName: event.target.value })} /></label>}
                </div>
                {/* The party you address it to is the recipient; a second free-text name
                    next to it, plus reference fields nobody filled, are gone. */}
                <label className="form-field"><span>{text("To:", "Aan:")}</span><select value={registerForm.responsiblePartyId} onChange={(event) => { const party = parties.find((item) => item.id === event.target.value); setRegisterForm({ ...registerForm, responsiblePartyId: event.target.value, requestedTo: party?.name ?? "" }); }}><option value="">{text("Choose party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name} · {party.type}</option>)}</select></label>
                <label className="form-field"><span>{text("Attachments and page count", "Bijlagen en aantal pagina's")}</span><input value={registerForm.attachments} onChange={(event) => setRegisterForm({ ...registerForm, attachments: event.target.value })} /></label>
                <label className="secondary-button file-button controlled-document-upload">
                  <Upload size={15} /> {registerFiles.length
                    ? text(`${registerFiles.length} document(s) selected`, `${registerFiles.length} document(en) geselecteerd`)
                    : text("Upload contract, specification or attachment", "Upload contract, technische specificatie of bijlage")}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.csv,.txt,image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files ?? []);
                      setRegisterFiles(files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {registerFiles.length ? <div className="boq-preview">{registerFiles.map((file) => <div key={`${file.name}:${file.lastModified}`}><FileText size={15} /><span>{file.name}</span><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div>)}</div> : null}
                {registerForm.type === "inspection_request" ? <div className="form-grid-2"><label className="form-field"><span>{text("Inspection category", "Inspectiecategorie")}</span><select value={registerForm.inspectionCategory} onChange={(event) => setRegisterForm({ ...registerForm, inspectionCategory: event.target.value })}><option value="architectural">Architectural</option><option value="structural">Structural</option><option value="mep">MEP</option><option value="testing">Testing</option><option value="other">Other</option></select></label><div className="form-grid-2"><label className="form-field"><span>{text("Ready date", "Gereeddatum")}</span><input type="date" value={registerForm.readyDate} onChange={(event) => setRegisterForm({ ...registerForm, readyDate: event.target.value })} /></label><label className="form-field"><span>{text("Ready time", "Gereedtijd")}</span><input type="time" value={registerForm.readyTime} onChange={(event) => setRegisterForm({ ...registerForm, readyTime: event.target.value })} /></label></div></div> : null}
                {registerForm.type === "technical_instruction" ? <label className="form-field"><span>{text("Discipline", "Discipline")}</span><select value={registerForm.discipline} onChange={(event) => setRegisterForm({ ...registerForm, discipline: event.target.value })}><option value="architectural">Architectural</option><option value="structural">Structural</option><option value="electrical">Electrical</option><option value="mechanical">Mechanical</option><option value="civil">Civil</option><option value="hse">HSE</option></select></label> : null}
                {registerForm.type === "change_order" || registerForm.type === "technical_instruction" ? <><div className="form-grid-2"><label className="form-field"><span>{text("Schedule impact", "Planningimpact")}</span><select value={registerForm.scheduleImpact} onChange={(event) => setRegisterForm({ ...registerForm, scheduleImpact: event.target.value })}><option value="none">None</option><option value="possible">Possible</option><option value="confirmed">Confirmed</option><option value="unknown">To be assessed</option></select></label><label className="form-field"><span>{text("Cost impact", "Kostenimpact")}</span><select value={registerForm.costImpact} onChange={(event) => setRegisterForm({ ...registerForm, costImpact: event.target.value })}><option value="none">None</option><option value="possible">Possible</option><option value="confirmed">Confirmed</option><option value="unknown">To be assessed</option></select></label></div><label className="form-field"><span>{text("Impact explanation", "Toelichting impact")}</span><textarea rows={2} value={registerForm.impactExplanation} onChange={(event) => setRegisterForm({ ...registerForm, impactExplanation: event.target.value })} /><DictateButton onText={(transcript) => setRegisterForm((current) => ({ ...current, impactExplanation: appendDictation(current.impactExplanation, transcript) }))} /></label></> : null}
                {registerForm.type === "environmental_report" ? <><div className="form-grid-2"><label className="form-field"><span>{text("Period start", "Periode start")}</span><input type="date" value={registerForm.periodStart} onChange={(event) => setRegisterForm({ ...registerForm, periodStart: event.target.value })} /></label><label className="form-field"><span>{text("Period end", "Periode einde")}</span><input type="date" value={registerForm.periodEnd} onChange={(event) => setRegisterForm({ ...registerForm, periodEnd: event.target.value })} /></label></div><div className="form-grid-2"><label className="form-field"><span>{text("Lost hours", "Verloren uren")}</span><input type="number" min="0" value={registerForm.lostHours} onChange={(event) => setRegisterForm({ ...registerForm, lostHours: event.target.value })} /></label><label className="form-field"><span>{text("Reason for lost hours", "Reden verloren uren")}</span><input value={registerForm.lostHoursReason} onChange={(event) => setRegisterForm({ ...registerForm, lostHoursReason: event.target.value })} /></label></div></> : null}
                <label className="check-field controlled-document-signature">
                  <input
                    type="checkbox"
                    checked={Boolean(registerForm.signedBy)}
                    onChange={(event) => setRegisterForm({
                      ...registerForm,
                      signedBy: event.target.checked ? registerForm.issuerName.trim() || currentUserName : "",
                      signedAt: event.target.checked ? new Date().toISOString() : "",
                    })}
                  />
                  <span>
                    <strong>{text("Sign as the author of this document", "Ondertekenen als opsteller van dit document")}</strong>
                    <small>{registerForm.signedBy
                      ? text(`Signed by ${registerForm.signedBy} · ${formatDate(registerForm.signedAt, locale)}`, `Ondertekend door ${registerForm.signedBy} · ${formatDate(registerForm.signedAt, locale)}`)
                      : text("The name and the moment of signing are stored with the document.", "De naam en het moment van ondertekenen worden bij het document opgeslagen.")}</small>
                  </span>
                </label>
                <div className="operation-alert warning"><FileCheck2 size={17} /><div><strong>{text("Numbering and metadata are automatic", "Nummering en metadata zijn automatisch")}</strong><span>{text("Project, building, issue date, author and audit history are filled from the current context. Approval, acknowledgement and signature remain explicit human actions.", "Project, gebouw, uitgiftedatum, opsteller en auditgeschiedenis komen uit de actuele context. Goedkeuring, ontvangst en ondertekening blijven expliciete menselijke acties.")}</span></div></div>
              </> : agreementRegister ? null : <label className="form-field"><span>{text("Involved party", "Betrokken partij")}</span><select value={registerForm.responsiblePartyId} onChange={(event) => setRegisterForm({ ...registerForm, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>}
              {/* Every register item can carry site photos, with the text that says what
                  the photo shows. Documents alone were not enough for the client. */}
              <label className="finding-photo-capture register-photo-capture">
                <Camera size={22} />
                <span><strong>{registerPhotos.length ? text(`${registerPhotos.length} photos ready`, `${registerPhotos.length} foto’s klaar`) : text("Take or choose a photo", "Maak of kies een foto")}</strong><small>{photoCaptureHint}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotosToStack(event.currentTarget.files, setRegisterPhotos, setRegisterPhotoError); event.currentTarget.value = ""; }} />
              </label>
              <button className="ghost-button sketch-open-button" type="button" onClick={() => setRegisterSketching(true)}><PenLine size={15} /> {text("Make a sketch", "Schets maken")}</button>
              {registerSketching ? <SketchPad close={() => setRegisterSketching(false)} save={(file) => { setRegisterPhotos((current) => [...current, toPhotoEvidence(file, { category: "overview" })]); setRegisterSketching(false); }} /> : null}
              <PhotoEvidenceList
                photos={registerPhotos}
                setPhotos={setRegisterPhotos}
                markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId === ALL_BUILDINGS ? "" : registerBuildingId }}
              />
              {registerPhotoError ? <p className="field-error" role="alert">{registerPhotoError}</p> : null}
              <button className="primary-button" type="button" disabled={busy || (exactLocationRequired && registerBuildingId !== ALL_BUILDINGS && !registerLocationNodeId) || registerTitle.length < 3 || !controlledFormReady} onClick={() => void addRegisterEntry()}><PackageCheck size={15} /> {controlledRegister ? text("Create controlled document", "Maak beheerd document") : agreementRegister ? text("Save agreement", "Afspraak opslaan") : text("Save register item", "Registeritem opslaan")}</button>
            </div>
          ) : null}
          {/* The bill of quantities has nothing to do with a delivery or any other
              register item you are filling in, so it no longer sits open underneath the
              form. It stays one tap away. */}
          <details className="boq-import-section">
            <summary>{text("Bill of quantities · import and progress", "Meetstaat · import en voortgang")}<span>{data.registerEntries.filter((entry) => entry.register_type === "boq").length} {text("BOQ lines", "BOQ-regels")}</span></summary>
            <div className="boq-import-card">
              <div><span className="record-number">{text("BOQ import and progress", "BOQ-import en voortgang")}</span><h2>{text("Import the bill of quantities as a controlled project log", "Importeer de meetstaat als gecontroleerd projectlog")}</h2><p>{text("CSV columns: code, description, quantity, unit, unit rate, contract value and progress percentage. The complete import is atomic: an invalid row stores nothing.", "CSV-kolommen: code, omschrijving, hoeveelheid, eenheid, eenheidsprijs, contractbedrag en voortgangspercentage. De volledige import is atomisch: bij een ongeldige rij wordt niets opgeslagen.")}</p></div>
              <BuildingPicker id="boq-building" buildings={buildings} value={boqBuildingId} onChange={setBoqBuildingId} />
              <div className="boq-import-actions"><button className="secondary-button" type="button" onClick={downloadBoqCsvTemplate}><Download size={15} /> {text("Download CSV template", "Download CSV-sjabloon")}</button><label className="secondary-button file-button"><Upload size={15} /> {text("Choose BOQ file", "Kies BOQ-bestand")}<input type="file" accept="text/csv,.csv" hidden onChange={(event) => void inspectBoqFile(event.target.files?.[0] ?? null)} /></label><button className="primary-button" type="button" disabled={busy || !boqItems.length} onClick={() => void importBoq()}><PackageCheck size={15} /> {text("Import BOQ", "Importeer BOQ")}</button></div>
              {boqFile ? <span className="boq-file-summary"><strong>{boqFile.name}</strong>{boqItems.length ? ` · ${boqItems.length} ${text("validated rows", "gevalideerde regels")}` : ""}</span> : null}
              {boqError ? <span className="field-error">{boqError}</span> : null}
              {boqItems.length ? <div className="boq-preview"><span>{text("First validated lines", "Eerste gevalideerde regels")}</span>{boqItems.slice(0, 5).map((item) => <div key={`${item.code}:${item.source_row}`}><strong>{item.code}</strong><span>{item.description}</span><small>{item.quantity ?? "-"} {item.unit} · {item.progress_percent}%</small></div>)}</div> : null}
            </div>
            <BoqProgressRegister
              entries={data.registerEntries.filter((entry) => entry.register_type === "boq")}
              updates={data.boqProgressUpdates}
              buildings={buildings}
              busy={busy}
              run={run}
              client={client}
            />
          </details>
          <div className="register-summary-grid">{Object.entries(registerNames).map(([type, label]) => <div className="register-summary" key={type}><strong>{data.registerEntries.filter((entry) => entry.register_type === type).length}</strong><span>{label}</span></div>)}</div>
          {externalSubmissionIntent ? (
            <div className="operation-alert success external-submission-notice">
              <Users size={18} />
              <div>
                <strong>{text("Recording a contractor submission", "Aannemersindiening vastleggen")}</strong>
                <span>{text("WCR, RFI, RFA and WIR are unlocked here because you came from Management. The decision is recorded there too.", "WCR, RFI, RFA en WIR zijn hier vrijgegeven omdat je vanuit Management komt. Het besluit leg je daar ook vast.")}</span>
              </div>
              <button className="secondary-button" type="button" onClick={openManagement}>{text("Back to Management", "Terug naar Management")}</button>
            </div>
          ) : (
          <div className="operation-alert external-submission-notice">
            <Users size={18} />
            <div>
              <strong>{text("WCR, RFI, RFA and WIR are not created here", "WCR, RFI, RFA en WIR maak je hier niet aan")}</strong>
              <span>{text("The contractor submits them first; the company or owner records the decision under Management.", "De aannemer dient ze eerst in; het bedrijf of de eigenaar legt het besluit vast onder Management.")}</span>
            </div>
            <button className="secondary-button" type="button" onClick={openManagement}>{text("Open submissions", "Open indieningen")}</button>
          </div>
          )}
          <ControlledDocumentList entries={data.registerEntries.filter((entry) => isControlledDocumentType(entry.register_type) && (externalSubmissionIntent || !externalSubmissionRegisterTypes.includes(entry.register_type)))} buildings={buildings} locationNodes={data.locationNodes} busy={busy} currentUserName={currentUserName} client={client} run={run} />
          <RecordList empty={text("No additional project registers yet.", "Nog geen aanvullende projectregisters.")} rows={data.registerEntries.filter((entry) => !isControlledDocumentType(entry.register_type) && entry.register_type !== "boq").map((entry) => {
            // The verdict and the quantity are the point of a delivery line, so the list
            // shows them instead of hiding them in the record.
            const outcome = String(entry.details?.outcome ?? "");
            const quantity = entry.details?.quantity;
            const outcomeLabel = outcome === "compliant" ? text("complies", "voldoet") : outcome === "not_compliant" ? text("does not comply", "voldoet niet") : outcome === "partly" ? text("partly", "deels") : "";
            const quantityLabel = quantity === null || quantity === undefined ? "" : `${quantity}${entry.details?.unit ? ` ${String(entry.details.unit)}` : ""}`;
            return {
              id: entry.id,
              icon: Wrench,
              title: entry.title,
              meta: [
                entry.entry_number,
                recordContextLabel(entry.building_id, entry.location_node_id),
                registerNames[entry.register_type] ?? allRegisterNames[entry.register_type] ?? entry.register_type,
                quantityLabel,
                outcomeLabel,
                formatDate(entry.occurred_at, locale),
              ].filter(Boolean).join(" · "),
              status: entry.status,
              tone: outcome === "not_compliant" ? "red" : entry.status === "closed" || entry.status === "approved" ? "green" : "",
            };
          })} />
        </section>
      ) : null}

      {tab === "daily" ? <DailyWorkRegister
        records={data.dailyWork ?? []}
        dayReports={data.dayReports ?? []}
        buildings={buildings}
        view={dailyWorkView}
        onViewChange={setDailyWorkView}
        onRecord={(view) => openDailyRecord(view === "delays" ? "delay" : view)}
      /> : null}

      {tab === "visual" ? <VisualEvidenceWorkspace data={data} projectId={projectId} buildingId={buildingId} buildingName={buildingName} buildings={buildings} reportId={reportId} parties={parties} client={client} busy={busy} run={run} initialFindingId={visualFindingId} initialFiles={initialCameraFiles} onInitialFilesConsumed={onInitialCameraFilesConsumed} /> : null}

      {tab === "documents" ? <ProjectDocumentsHome data={data} client={client} openDrawings={() => switchTab("drawings")} openFiles={() => switchTab("files")} openRegisters={() => switchTab("registers")} createDocument={() => openTask("registers", true)} /> : null}

      {tab === "drawings" ? <DrawingWorkspace data={data} projectId={projectId} buildingId={buildingId} buildings={buildings} client={client} busy={busy} run={run} initialFindingId={drawingFindingId} onOpenLinkedRecord={(recordType) => switchTab(recordType === "observation" ? "findings" : recordType === "inspection" ? "inspections" : recordType === "visual" ? "visual" : "registers")} /> : null}

      {tab === "tools" ? <FieldTools data={data} projectId={projectId} buildingId={buildingId} buildings={buildings} parties={parties} reportId={reportId} client={client} busy={busy} run={run} /> : null}

      {tab === "files" ? <MediaLibraryWorkspace data={data} projectId={projectId} buildingId={buildingId} buildingName={buildingName} buildings={buildings} reportId={reportId} client={client} busy={busy} run={run} initialFiles={initialCameraFiles} onInitialFilesConsumed={onInitialCameraFilesConsumed} open360Upload={() => setTab("visual")} /> : null}
    </>
  );
}

function BoqProgressRegister({
  entries,
  updates,
  buildings,
  busy,
  run,
  client,
}: {
  entries: OperationSnapshot["registerEntries"];
  updates: OperationSnapshot["boqProgressUpdates"];
  buildings: BuildingOption[];
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  client: SupabaseClient;
}) {
  const { locale, text } = useLanguage();
  const [active, setActive] = useState<string | null>(null);
  const [progress, setProgress] = useState("0");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  if (!entries.length) return null;
  return (
    <section className="controlled-document-register">
      <div className="controlled-document-register-heading">
        <div><span className="record-number">{text("Measured progress", "Gemeten voortgang")}</span><h2>{text("Update BOQ lines with dated evidence", "Werk BOQ-regels bij met gedateerd bewijs")}</h2></div>
        <span>{entries.length} {text("lines", "regels")}</span>
      </div>
      <div className="record-stack">
        {entries.map((entry) => {
          const details = entry.details ?? {};
          const latest = updates.find((update) => update.register_entry_id === entry.id);
          const currentProgress = Number(latest?.progress_percent ?? details.progress_percent ?? 0);
          const building = buildings.find((item) => item.id === entry.building_id)?.name ?? text("Project-wide", "Projectbreed");
          return (
            <article className="controlled-document-card" key={entry.id}>
              <div className="controlled-document-card-main">
                <div>
                  <span className="record-number">{String(details.code ?? entry.entry_number)} · {building}</span>
                  <h3>{String(details.description ?? entry.title)}</h3>
                  <p>{String(details.quantity ?? "—")} {String(details.unit ?? "")} · {text("contract value", "contractwaarde")} {String(details.contract_value ?? "—")}</p>
                  <small>{currentProgress}%{latest ? ` · ${formatDate(latest.recorded_at, locale)} · ${latest.note}` : ""}</small>
                </div>
                <span className={`task-status ${currentProgress >= 100 ? "green" : ""}`}>{currentProgress}%</span>
              </div>
              <div className="finding-actions">
                <button className="secondary-button" type="button" onClick={() => {
                  setActive(active === entry.id ? null : entry.id);
                  setProgress(String(currentProgress));
                  setQuantity(latest?.quantity_completed == null ? "" : String(latest.quantity_completed));
                  setNote("");
                }}>{text("Record progress", "Voortgang vastleggen")}</button>
              </div>
              {active === entry.id ? (
                <div className="inline-transition issue-progress-form">
                  <div className="form-grid-2">
                    <label className="form-field"><span>{text("Progress percentage", "Voortgangspercentage")}</span><input type="number" min="0" max="100" step="0.1" value={progress} onChange={(event) => setProgress(event.target.value)} /></label>
                    <label className="form-field"><span>{text("Completed quantity", "Uitgevoerde hoeveelheid")}</span><input type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
                  </div>
                  <label className="form-field"><span>{text("Measurement / evidence note", "Meet- / bewijsnotitie")}</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /><DictateButton onText={(transcript) => setNote((current) => appendDictation(current, transcript))} /></label>
                  <button className="primary-button" type="button" disabled={busy || Number(progress) < 0 || Number(progress) > 100 || note.trim().length < 2} onClick={() => void run(
                    () => recordBoqProgress(client, {
                      registerEntryId: entry.id,
                      progressPercent: Number(progress),
                      quantityCompleted: quantity ? Number(quantity) : null,
                      note,
                    }),
                    text(`BOQ progress for ${String(details.code ?? entry.entry_number)} recorded.`, `BOQ-voortgang voor ${String(details.code ?? entry.entry_number)} vastgelegd.`),
                  ).then((okay) => { if (okay) { setActive(null); setNote(""); } })}>{text("Save dated progress", "Sla gedateerde voortgang op")}</button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ControlledDocumentList({ entries, buildings, locationNodes, busy, currentUserName, client, run }: {
  entries: OperationSnapshot["registerEntries"];
  buildings: BuildingOption[];
  locationNodes: OperationSnapshot["locationNodes"];
  busy: boolean;
  currentUserName: string;
  client: SupabaseClient;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const { locale, text } = useLanguage();
  const [active, setActive] = useState<string | null>(null);
  const [historyActive, setHistoryActive] = useState<string | null>(null);
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

  /** The announcement the contractor gets; the PDF or Word file is the attachment. */
  const contractorMessage = (entry: OperationSnapshot["registerEntries"][number]) => {
    const details = entry.details ?? {};
    return [
      `${entry.entry_number} · ${entry.register_type.replaceAll("_", " ").toUpperCase()}`,
      `${String(details.project_number ?? "")} · ${String(details.project_name ?? "")}`.trim(),
      entry.title,
      String(details.description ?? ""),
      details.requested_to ? `${text("To", "Aan")}: ${String(details.requested_to)}` : "",
      entry.due_at ? `${text("Required by", "Uiterlijk")}: ${formatDate(entry.due_at, locale)}` : "",
      `${text("Issued by", "Opgemaakt door")}: ${String(details.signed_by || details.issued_by || currentUserName)}`,
    ].filter(Boolean).join("\n");
  };

  if (!entries.length) return null;
  return (
    <section className="controlled-document-register">
      <div className="controlled-document-register-heading"><div><span className="record-number">{text("Formal client documents", "Formele klantdocumenten")}</span><h2>RFI · RFA · WIR · TI · CO · ER</h2></div><span>{entries.length} {text("controlled records", "beheerde registraties")}</span></div>
      <div className="record-stack">
        {entries.map((entry) => {
          const details = entry.details ?? {};
          const entryBuildingName = buildings.find((building) => building.id === entry.building_id)?.name ?? text("Project-wide", "Projectbreed");
          const entryLocation = locationBreadcrumb(locationNodes, entry.location_node_id);
          const responseData = details.response && typeof details.response === "object" && !Array.isArray(details.response) ? details.response as Record<string, unknown> : {};
          // Every recorded decision, oldest first. Falls back to the single current
          // response for records answered before the history log shipped.
          const responseHistory = (Array.isArray(details.response_history)
            ? details.response_history.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
            : Object.keys(responseData).length ? [responseData] : []);
          const attachmentFiles = Array.isArray(details.attachment_files)
            ? details.attachment_files.filter((file): file is Record<string, unknown> => Boolean(file) && typeof file === "object" && !Array.isArray(file))
            : [];
          return <article className="controlled-document-card" key={entry.id}>
            <div className="controlled-document-card-main"><div><span className="record-number">{entry.entry_number} · {entry.register_type.replaceAll("_", " ").toUpperCase()}</span><h3>{entry.title}</h3><p>{String(details.description ?? "")}</p><small>{entryBuildingName}{entryLocation ? ` → ${entryLocation}` : ""} · {formatDate(entry.occurred_at, locale)}{entry.due_at ? ` · ${text("due", "uiterlijk")} ${formatDate(entry.due_at, locale)}` : ""}{responseData.decision ? ` · ${String(responseData.decision).replaceAll("_", " ")}` : ""}</small></div><span className={`task-status ${entry.status === "approved" || entry.status === "closed" ? "green" : entry.status === "rejected" ? "red" : ""}`}>{entry.status.replaceAll("_", " ")}</span></div>
            <div className="finding-actions"><button className="secondary-button" type="button" onClick={() => setHistoryActive((current) => current === entry.id ? null : entry.id)}><Archive size={15} /> {historyActive === entry.id ? text("Close record", "Sluit dossier") : text("Open record & history", "Open dossier & historie")}</button>
            {/* Send the document to the contractor over WhatsApp. The formal PDF or Word
                file stays the attachment; this is the message that announces it. */}
            <button className="whatsapp-button" type="button" onClick={() => openWhatsApp(contractorMessage(entry))}><MessageCircle size={16} /> {text("Send to contractor", "Naar aannemer sturen")}</button>
            <button className="secondary-button" type="button" onClick={() => openSms(contractorMessage(entry))}><Smartphone size={15} /> {text("Send as SMS", "Als SMS sturen")}</button>
            <ReportDownloadButtons disabled={busy} onDownloadPdf={() => import("@/lib/reports/controlled-document-pdf").then(({ downloadControlledDocumentPdf }) => downloadControlledDocumentPdf(entry))} onDownloadWord={() => import("@/lib/reports/controlled-document-docx").then(({ downloadControlledDocumentDocx }) => downloadControlledDocumentDocx(entry))} />{!["closed", "cancelled"].includes(entry.status) ? <button className="primary-button" type="button" disabled={busy} onClick={() => { setActive(active === entry.id ? null : entry.id); setResponse({ decision: entry.register_type === "technical_instruction" || entry.register_type === "change_order" ? "acknowledged" : "approved", comments: "", respondentName: currentUserName, respondentPosition: "", respondentCompany: "CODECO N.V." }); }}><FileCheck2 size={15} /> {text("Record formal response", "Leg formeel antwoord vast")}</button> : null}</div>
            {historyActive === entry.id ? <section className="controlled-document-history">
              <div><span>{text("Created / issued", "Aangemaakt / uitgegeven")}</span><strong>{formatDate(entry.occurred_at, locale)}</strong><small>{String(details.issuer_name ?? details.issued_by ?? currentUserName)} · {String(details.issuer_company ?? "CODECO N.V.")}</small></div>
              <div><span>{text("Current status", "Huidige status")}</span><strong>{entry.status.replaceAll("_", " ")}</strong><small>{responseData.decision ? `${text("Decision", "Besluit")}: ${String(responseData.decision).replaceAll("_", " ")}` : text("No formal decision recorded yet", "Nog geen formeel besluit vastgelegd")}</small></div>
              <div className="controlled-history-description"><span>{text("Complete content", "Volledige inhoud")}</span><p>{String(details.description ?? details.request ?? details.instruction ?? text("No description supplied.", "Geen omschrijving ingevoerd."))}</p></div>
              {attachmentFiles.length ? <div className="controlled-history-attachments"><span>{text("Uploaded attachments", "Geüploade bijlagen")}</span>{attachmentFiles.map((file, index) => {
                const fileId = String(file.file_id ?? "");
                const filename = String(file.name ?? `${text("Attachment", "Bijlage")} ${index + 1}`);
                return <button className="secondary-button" type="button" disabled={busy || !fileId} onClick={() => void run(() => openProjectFile(client, fileId, filename), text(`${filename} opened.`, `${filename} geopend.`))} key={`${fileId}:${index}`}><FolderOpen size={15} /> {filename}</button>;
              })}</div> : <div className="controlled-history-attachments empty"><span>{text("Uploaded attachments", "Geüploade bijlagen")}</span><small>{text("No uploaded attachment is linked to this record.", "Aan dit dossier is geen geüploade bijlage gekoppeld.")}</small></div>}
              <div className="controlled-history-timeline">
                <span>{text("Complete decision history", "Volledige besluithistorie")}</span>
                {responseHistory.length ? <ol>
                  {responseHistory.map((item, index) => (
                    <li key={String(item.idempotency_key ?? item.responded_at ?? index)}>
                      <b className={`decision-dot ${String(item.decision ?? "")}`} />
                      <div>
                        <strong>{decisions.find(([value]) => value === item.decision)?.[1] ?? String(item.decision ?? text("Response", "Reactie")).replaceAll("_", " ")}</strong>
                        <small>{String(item.respondent_name ?? item.respondentName ?? text("Recorded reviewer", "Vastgelegde reviewer"))}{item.respondent_company || item.respondentCompany ? ` · ${String(item.respondent_company ?? item.respondentCompany)}` : ""}{item.responded_at ? ` · ${formatDate(String(item.responded_at), locale)}` : ""}</small>
                        <p>{String(item.comments ?? item.comment ?? "")}</p>
                      </div>
                    </li>
                  ))}
                </ol> : <small>{text("No formal decision has been recorded yet.", "Er is nog geen formeel besluit vastgelegd.")}</small>}
              </div>
            </section> : null}
            {active === entry.id ? <div className="inline-transition controlled-response-form">
              <div className="form-grid-2"><label className="form-field"><span>{text("Decision / response code", "Besluit / antwoordcode")}</span><select value={response.decision} onChange={(event) => setResponse({ ...response, decision: event.target.value })}>{decisions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="form-field"><span>{text("Respondent name", "Naam respondent")}</span><input value={response.respondentName} onChange={(event) => setResponse({ ...response, respondentName: event.target.value })} /></label></div>
              <div className="form-grid-2"><label className="form-field"><span>{text("Position", "Functie")}</span><input value={response.respondentPosition} onChange={(event) => setResponse({ ...response, respondentPosition: event.target.value })} /></label><label className="form-field"><span>{text("Company", "Bedrijf")}</span><input value={response.respondentCompany} onChange={(event) => setResponse({ ...response, respondentCompany: event.target.value })} /></label></div>
              <label className="form-field"><span>{text("Formal comments / remarks", "Formele opmerkingen")}</span><textarea rows={3} value={response.comments} onChange={(event) => setResponse({ ...response, comments: event.target.value })} /><DictateButton onText={(transcript) => setResponse((current) => ({ ...current, comments: appendDictation(current.comments, transcript) }))} /></label>
              <button className="primary-button" type="button" disabled={busy || response.respondentName.trim().length < 2 || response.comments.trim().length < 2} onClick={() => void run(() => respondToControlledDocument(client, entry.id, response), text(`${entry.entry_number} response stored in the audit trail.`, `Antwoord op ${entry.entry_number} in de auditgeschiedenis opgeslagen.`)).then((okay) => { if (okay) setActive(null); })}>{text("Confirm human response", "Bevestig menselijk antwoord")}</button>
            </div> : null}
          </article>;
        })}
      </div>
    </section>
  );
}

/**
 * Photos waiting to be saved. With `captions` every photo also gets the short text that
 * explains what it shows; the file name alone means nothing in a report.
 */
function StoredPhotoThumbnail({ client, file }: { client: SupabaseClient; file: FileRecord }) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void loadProjectFileObjectUrl(client, file.id).then((url) => {
      objectUrl = url;
      if (active) setSource(url);
      else URL.revokeObjectURL(url);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, file.id]);
  if (failed || !file.mime_type.startsWith("image/")) return <span className="record-photo-fallback"><FolderOpen size={17} /></span>;
  // Private object URLs cannot pass through the Next image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return source ? <img src={source} alt={file.original_name} loading="lazy" onError={() => setFailed(true)} /> : <span className="record-photo-fallback"><Loader2 className="spin" size={16} /></span>;
}

/**
 * Shows every stored photo that belongs to one record, so evidence is visible from
 * the record itself. Thumbnails are fetched only after the user opens the strip:
 * a register of a hundred findings would otherwise start hundreds of secure
 * downloads on first paint.
 */
function RecordPhotoStrip({ data, client, kind, recordId, resolver, busy, run }: { data: OperationSnapshot; client: SupabaseClient; kind: FileOriginKind; recordId: string; resolver: FileOriginResolver; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const files = filesForRecord(data, kind, recordId, resolver);
  if (!files.length) return null;
  const label = `${files.length} ${text(files.length === 1 ? "linked photo" : "linked photos", files.length === 1 ? "gekoppelde foto" : "gekoppelde foto's")}`;
  return (
    <section className="record-photo-strip" aria-label={text("Photos linked to this record", "Foto's gekoppeld aan dit record")}>
      <header>
        <button className="record-photo-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <Camera size={15} /> <span>{label}</span>
        </button>
      </header>
      {open ? (
        <div>
          {files.slice(0, 12).map((file) => (
            <button type="button" disabled={busy} onClick={() => void run(() => openProjectFile(client, file.id, file.original_name), text(`${file.original_name} opened.`, `${file.original_name} geopend.`))} title={file.original_name} key={file.id}>
              <StoredPhotoThumbnail client={client} file={file} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The step straight after submitting: a record that a contractor must act on is sent to
 * that contractor here, without first looking it up in the list below.
 */
function SubmittedRecordShare({ finding, scope, projectName, projectCode, buildingName, contractorName, busy, share, close }: {
  finding: Finding;
  scope: "issue" | "ncr";
  projectName: string;
  projectCode: string;
  buildingName: string;
  contractorName: string;
  busy: boolean;
  share: (finding: Finding) => Promise<{ shareId: string; url: string; expiresAt: string } | null>;
  close: () => void;
}) {
  const { locale, text } = useLanguage();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const heading = scope === "ncr"
    ? text("NCR issued · send it to the contractor", "NCR uitgegeven · stuur hem naar de aannemer")
    : text("Issue recorded · send it to the responsible party", "Issue vastgelegd · stuur het naar de verantwoordelijke partij");
  const message = (shared: { url: string; expiresAt: string }) => [
    `${scope === "ncr" ? "CODECO NCR" : "CODECO werkpunt"} ${finding.finding_number}`,
    `${projectCode} · ${projectName}${buildingName ? ` · ${buildingName}` : ""}`,
    finding.title,
    `Deadline: ${formatDate(finding.due_at, locale)}`,
    "",
    scope === "ncr"
      ? "Open de NCR, vul de voorgestelde correctieve actie in en stuur die terug:"
      : "Open de volledige breakdown, bronfoto en antwoordknoppen zonder account:",
    shared.url,
    `Link geldig tot ${formatDate(shared.expiresAt, locale)}.`,
  ].join("\n");
  const createLink = async () => {
    setCreating(true);
    setFeedback("");
    const created = await share(finding);
    if (created) setLink({ url: created.url, expiresAt: created.expiresAt });
    setCreating(false);
  };
  return (
    <section className="submitted-record-share" aria-label={heading}>
      <header>
        <span><Link2 size={18} /></span>
        <div>
          <strong>{heading}</strong>
          <small>{finding.finding_number} · {finding.title}{contractorName ? ` · ${contractorName}` : ""}</small>
        </div>
        <button type="button" aria-label={text("Close", "Sluiten")} onClick={close}><X size={16} /></button>
      </header>
      {scope === "ncr" ? <p>{text("The contractor opens the link without an account, reads the recommended action and fills in the proposed corrective action. CODECO verifies and closes the NCR.", "De aannemer opent de link zonder account, leest de aanbevolen actie en vult de voorgestelde correctieve actie in. CODECO verifieert en sluit de NCR.")}</p> : null}
      {link ? (
        <>
          <label><span>{text("Secure link · expires", "Beveiligde link · vervalt")} {formatDate(link.expiresAt, locale)}</span><input readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} /></label>
          {feedback ? <p className="external-share-feedback" role="status">{feedback}</p> : null}
          <div className="submitted-record-share-actions">
            <button className="secondary-button" type="button" onClick={() => void copyToClipboard(link.url).then(() => setFeedback(text("Link copied.", "Link gekopieerd."))).catch((error) => setFeedback(messageFrom(error)))}><Copy size={16} /> {text("Copy link", "Kopieer link")}</button>
            <button className="whatsapp-button" type="button" onClick={() => openWhatsApp(message(link))}><MessageCircle size={17} /> {text("Open WhatsApp and send", "Open WhatsApp en stuur")}</button>
            <button className="secondary-button" type="button" onClick={() => openSms(message(link))}><Smartphone size={16} /> {text("Send as SMS", "Als SMS sturen")}</button>
          </div>
        </>
      ) : (
        <button className="primary-button" type="button" disabled={busy || creating} onClick={() => void createLink()}>
          {creating ? <Loader2 className="spin" size={16} /> : <MessageCircle size={16} />}
          {scope === "ncr" ? text("Send to contractor", "Naar aannemer sturen") : text("Send to external party", "Stuur naar externe partij")}
        </button>
      )}
    </section>
  );
}

function FindingList({ data, client, run, findings, progressUpdates, visualAnnotations, externalShareLinks, projectName, projectCode, buildings, locationNodes, currentUserName, parties, busy, transition, recordProgress, share, revoke, linkVisual, linkDrawing }: {
  data: OperationSnapshot;
  client: SupabaseClient;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  findings: Finding[];
  progressUpdates: OperationSnapshot["findingProgressUpdates"];
  visualAnnotations: OperationSnapshot["visualAnnotations"];
  externalShareLinks: NonNullable<OperationSnapshot["externalShareLinks"]>;
  projectName: string;
  projectCode: string;
  buildings: BuildingOption[];
  locationNodes: OperationSnapshot["locationNodes"];
  currentUserName: string;
  parties: ProjectParty[];
  busy: boolean;
  transition: (finding: Finding, nextStatus: string, note: string, finalMeasure: string, correction: string) => Promise<boolean>;
  recordProgress: (finding: Finding, progressPercent: number, disposition: "validated" | "to_be_corrected" | "alternative_solution", note: string) => Promise<boolean>;
  share: (finding: Finding) => Promise<{ shareId: string; url: string; expiresAt: string } | null>;
  revoke: (shareId: string) => Promise<boolean>;
  linkVisual: (finding: Finding) => void;
  linkDrawing: (finding: Finding) => void;
}) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? findingStatusLabelsEnglish : findingStatusLabels;
  const fileOriginResolver = useMemo(() => createFileOriginResolver(data), [data]);
  const [active, setActive] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [measure, setMeasure] = useState("");
  /** What the contractor proposes to do, as on the client's own NCR form. */
  const [correction, setCorrection] = useState("");
  const [progressActive, setProgressActive] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState("0");
  const [progressDisposition, setProgressDisposition] = useState<"validated" | "to_be_corrected" | "alternative_solution">("to_be_corrected");
  const [progressNote, setProgressNote] = useState("");
  const [creatingShareFor, setCreatingShareFor] = useState<string | null>(null);
  const [externalShare, setExternalShare] = useState<{ findingId: string; shareId: string; url: string; expiresAt: string } | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
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
  const findingBuildingName = (finding: Finding) => buildings.find((building) => building.id === finding.building_id)?.name ?? "";
  const externalMessage = (finding: Finding, shared: { url: string; expiresAt: string }) => [
    `CODECO werkpunt ${finding.finding_number}`,
    `${projectCode} · ${projectName}${findingBuildingName(finding) ? ` · ${findingBuildingName(finding)}` : ""}`,
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
        const visualAnnotation = visualAnnotations.find((item) => item.finding_id === finding.id && item.status === "active");
        const drawingPin = data.drawingPins.find((pin) => pin.linked_record_type === "observation" && pin.linked_record_id === finding.id && pin.status === "active");
        const issue = finding.issue_management ?? {};
        const recordBuildingName = findingBuildingName(finding);
        const recordLocation = locationBreadcrumb(locationNodes, finding.location_node_id);
        const activeExternalShares = externalShareLinks.filter((item) =>
          item.source_type === "finding"
          && item.source_id === finding.id
          && !item.revoked_at
          && new Date(item.expires_at).getTime() > Date.now()
        );
        return (
          <article className="finding-card" key={finding.id}>
            <div className="finding-card-main"><span className={`record-severity ${finding.severity}`}>{finding.severity}</span><div><span className="record-number">{finding.finding_number} · {finding.finding_type.toUpperCase()}</span><h3>{finding.title}</h3><p>{finding.description}</p>{issue.action_steps ? <p className="finding-required-action"><strong>{text("Required action:", "Vereiste actie:")}</strong> {issue.action_steps}</p> : null}<small>{recordBuildingName}{recordLocation ? ` → ${recordLocation}` : ""} · Deadline {formatDate(finding.due_at, locale)}{latestProgress ? ` · ${text("progress", "voortgang")} ${latestProgress.progress_percent}% · ${latestProgress.disposition.replaceAll("_", " ")}` : ""}{finding.verified_at ? ` · ${text("verified", "geverifieerd")} ${formatDate(finding.verified_at, locale)}` : ""}</small></div><span className={`task-status ${finding.status === "closed" ? "green" : finding.severity === "critical" ? "red" : ""}`}>{statusLabels[finding.status] ?? finding.status}</span></div>
            <div className="finding-actions">
              <button className="secondary-button" type="button" onClick={() => linkVisual(finding)}><Camera size={16} /> {visualAnnotation ? text("View photo marker", "Bekijk fotomarker") : text("Mark on photo / 360°", "Markeer op foto / 360°")}</button>
              <button className="secondary-button" type="button" onClick={() => linkDrawing(finding)}><MapPin size={16} /> {drawingPin ? text("View on drawing", "Bekijk op tekening") : text("Place on drawing", "Plaats op tekening")}</button>
              <button className="external-party-button" type="button" disabled={busy || creatingShareFor === finding.id} onClick={() => void createShare(finding)}>
                {creatingShareFor === finding.id ? <Loader2 className="spin" size={17} /> : <MessageCircle size={17} />}
                <span><strong>{text("Send to external party", "Stuur naar externe partij")}</strong><small>{text("WhatsApp link · no account needed", "WhatsApp-link · geen account nodig")}</small></span>
              </button>
              <ReportDownloadButtons disabled={busy} onDownloadPdf={() => import("@/lib/reports/ncr-pdf").then(({ downloadNcrPdf }) => downloadNcrPdf(finding, latestProgress, { projectName, projectCode, buildingName: recordBuildingName, issuerName: currentUserName, responsiblePartyName: parties.find((party) => party.id === finding.responsible_party_id)?.name ?? "" }))} onDownloadWord={() => import("@/lib/reports/ncr-docx").then(({ downloadNcrDocx }) => downloadNcrDocx(finding, latestProgress, { projectName, projectCode, buildingName: recordBuildingName, issuerName: currentUserName, responsiblePartyName: parties.find((party) => party.id === finding.responsible_party_id)?.name ?? "" }))} />
              {!["closed", "cancelled", "rejected"].includes(finding.status) ? <button className="secondary-button" type="button" onClick={() => { setProgressActive(progressActive === finding.id ? null : finding.id); setProgressPercent(String(latestProgress?.progress_percent ?? 0)); setProgressDisposition(latestProgress?.disposition ?? issue.disposition ?? "to_be_corrected"); }}>{text("Record inspection progress", "Inspectievoortgang vastleggen")}</button> : null}
              {nextStatus ? <button className="secondary-button" type="button" onClick={() => { setActive(active === finding.id ? null : finding.id); setCorrection(""); }}>{nextStatus === "closed" ? finding.finding_type === "ncr" ? text("Quality control · resolve", "Kwaliteitscontrole · afsluiten") : text("Verify", "Verifiëren") : nextStatus === "ready_for_verification" ? text("Mark repair ready", "Herstel gereedmelden") : finding.finding_type === "ncr" ? text("Record contractor answer", "Antwoord aannemer vastleggen") : text("Update status", "Status bijwerken")}</button> : null}
            </div>
            {/* The three signed boxes of the client's NCR form, in the order of the form:
                what the engineer recommends, what the contractor proposes, what quality
                control decided. */}
            {finding.finding_type === "ncr" ? (
              <section className="ncr-form-boxes" aria-label={text("Non-conformance report boxes", "Vakken van het non-conformance report")}>
                <div>
                  <span>{text("Recommended action by engineer", "Aanbevolen actie door de ingenieur")}</span>
                  <strong>{issue.recommended_action ? { rework: text("Rework", "Opnieuw uitvoeren"), repair: text("Repair", "Herstellen"), alternative: text("Alternative solution", "Alternatieve oplossing") }[issue.recommended_action] : text("Not chosen", "Niet gekozen")}</strong>
                  <p>{issue.recommended_action_detail || issue.action_steps || text("No instruction recorded.", "Geen instructie vastgelegd.")}</p>
                  <small>{issue.signed_by ? text(`Signed by ${issue.signed_by} · ${formatDate(issue.signed_at ?? null, locale)}`, `Ondertekend door ${issue.signed_by} · ${formatDate(issue.signed_at ?? null, locale)}`) : text("Not signed", "Niet ondertekend")}</small>
                </div>
                <div className={finding.proposed_correction ? "answered" : ""}>
                  <span>{text("Proposed corrective action by contractor", "Voorgestelde correctieve actie door de aannemer")}</span>
                  <p>{finding.proposed_correction || text("Waiting for the contractor's answer through the sent link.", "Wacht op het antwoord van de aannemer via de verstuurde link.")}</p>
                </div>
                <div className={finding.status === "closed" ? "answered" : ""}>
                  <span>{text("Quality control", "Kwaliteitscontrole")}</span>
                  <strong>{finding.status === "closed" ? text("Issue resolved", "Afwijking opgelost") : text("Issue not resolved", "Afwijking nog niet opgelost")}</strong>
                  <p>{finding.final_measure || text("No verified close-out yet.", "Nog geen geverifieerde afsluiting.")}</p>
                  {issue.remarks ? <small>{text("Remarks:", "Opmerkingen:")} {issue.remarks}</small> : null}
                </div>
              </section>
            ) : null}
            <RecordPhotoStrip data={data} client={client} kind="finding" recordId={finding.id} resolver={fileOriginResolver} busy={busy} run={run} />
            {activeExternalShares.length ? (
              <section className="active-external-shares" aria-label={text("Active external links", "Actieve externe links")}>
                <header><Link2 size={16} /><span><strong>{text(`${activeExternalShares.length} active external link${activeExternalShares.length === 1 ? "" : "s"}`, `${activeExternalShares.length} actieve externe link${activeExternalShares.length === 1 ? "" : "s"}`)}</strong><small>{text("The raw link is shown only once when it is created. It can always be revoked here.", "De ruwe link wordt alleen bij het aanmaken getoond. Intrekken kan hier altijd.")}</small></span></header>
                {activeExternalShares.map((shared) => (
                  <div className="active-external-share-row" key={shared.id}>
                    <span><strong>{text("Expires", "Vervalt")} {formatDate(shared.expires_at, locale)}</strong><small>{text(`${shared.view_count} view${shared.view_count === 1 ? "" : "s"}`, `${shared.view_count} keer bekeken`)}</small></span>
                    {revokeConfirmId === shared.id ? (
                      <div className="revoke-share-confirm">
                        <small>{text("The sent link stops immediately.", "De verstuurde link stopt direct.")}</small>
                        <button className="ghost-button" type="button" onClick={() => setRevokeConfirmId(null)}>{text("Cancel", "Annuleer")}</button>
                        <button className="danger-button" type="button" disabled={busy} onClick={() => void revoke(shared.id).then((okay) => {
                          if (!okay) return;
                          setRevokeConfirmId(null);
                          if (externalShare?.shareId === shared.id) setExternalShare(null);
                        })}>{text("Confirm revoke", "Intrekken bevestigen")}</button>
                      </div>
                    ) : (
                      <button className="revoke-share-button" type="button" onClick={() => setRevokeConfirmId(shared.id)}>{text("Revoke link", "Link intrekken")}</button>
                    )}
                  </div>
                ))}
              </section>
            ) : null}
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
                  <button className="whatsapp-button" type="button" onClick={() => openWhatsApp(externalMessage(finding, externalShare))}><MessageCircle size={17} /> {text("Open WhatsApp and send", "Open WhatsApp en stuur")}</button>
                  <button className="secondary-button" type="button" onClick={() => openSms(externalMessage(finding, externalShare))}><Smartphone size={16} /> {text("Send as SMS", "Als SMS sturen")}</button>
                  <button className="revoke-share-button" type="button" onClick={() => setRevokeConfirmId(externalShare.shareId)}><X size={16} /> {text("Revoke link", "Link intrekken")}</button>
                </div>
              </section>
            ) : null}
            {progressActive === finding.id ? (
              <div className="inline-transition issue-progress-form">
                <div className="form-grid-2"><label className="form-field"><span>{text("Progress at this inspection", "Voortgang bij deze inspectie")}</span><input type="number" min="0" max="100" step="1" value={progressPercent} onChange={(event) => setProgressPercent(event.target.value)} /></label><label className="form-field"><span>{text("Disposition", "Beoordeling")}</span><select value={progressDisposition} onChange={(event) => setProgressDisposition(event.target.value as typeof progressDisposition)}><option value="validated">{text("Validated", "Gevalideerd")}</option><option value="to_be_corrected">{text("To be corrected", "Te corrigeren")}</option><option value="alternative_solution">{text("Alternative solution", "Alternatieve oplossing")}</option></select></label></div>
                <label className="form-field"><span>{text("Inspection note", "Inspectienotitie")}</span><textarea rows={2} value={progressNote} onChange={(event) => setProgressNote(event.target.value)} /><DictateButton onText={(transcript) => setProgressNote((current) => appendDictation(current, transcript))} /></label>
                <button className="primary-button" type="button" disabled={busy || Number(progressPercent) < 0 || Number(progressPercent) > 100 || progressNote.trim().length < 2} onClick={() => void recordProgress(finding, Number(progressPercent), progressDisposition, progressNote).then((okay) => { if (okay) { setProgressActive(null); setProgressNote(""); } })}>{text("Save dated progress point", "Sla gedateerd voortgangspunt op")}</button>
              </div>
            ) : null}
            {active === finding.id && nextStatus ? (
              <div className="inline-transition">
                {nextStatus === "ready_for_verification" ? <><div className="quick-issue-presets" aria-label={text("Choose the completed measure", "Kies de uitgevoerde maatregel")}>{measureChoices.map((choice) => <button className={measure === choice ? "active" : ""} type="button" onClick={() => setMeasure(choice)} key={choice}>{choice}</button>)}</div><label className="form-field"><span>{text("Final resolution & rationale", "Final Resolution & Rationale")}</span><textarea rows={2} value={measure} onChange={(event) => setMeasure(event.target.value)} /><DictateButton onText={(transcript) => setMeasure((current) => appendDictation(current, transcript))} /></label></> : null}
                {/* An NCR answered by phone or on paper still belongs in the same box as
                    the answer that comes back through the link. */}
                {finding.finding_type === "ncr" && nextStatus === "in_progress" ? (
                  <label className="form-field"><span>{text("Proposed corrective action by contractor · optional", "Voorgestelde correctieve actie door de aannemer · optioneel")}</span><textarea rows={2} value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder={finding.proposed_correction ?? text("Only needed when the contractor answered outside the app.", "Alleen nodig als de aannemer buiten de app heeft geantwoord.")} /><DictateButton onText={(transcript) => setCorrection((current) => appendDictation(current, transcript))} /></label>
                ) : null}
                <div className="quick-issue-presets" aria-label={text("Choose a status note", "Kies een statusnotitie")}>{(noteChoices[nextStatus] ?? []).map((choice) => <button className={note === choice ? "active" : ""} type="button" onClick={() => setNote(choice)} key={choice}>{choice}</button>)}</div>
                <label className="form-field"><span>{nextStatus === "closed" ? finding.finding_type === "ncr" ? text("Quality control · issue resolved because", "Kwaliteitscontrole · afwijking opgelost omdat") : text("Verification finding", "Verificatiebevinding") : text("Comment", "Toelichting")}</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /><DictateButton onText={(transcript) => setNote((current) => appendDictation(current, transcript))} /></label>
                <button className="primary-button" type="button" disabled={busy || note.trim().length < 2 || (nextStatus === "ready_for_verification" && measure.trim().length < 3)} onClick={() => void transition(finding, nextStatus, note, measure, correction).then((okay) => { if (okay) { setActive(null); setNote(""); setMeasure(""); setCorrection(""); } })}>{text("Confirm human status change", "Bevestig menselijke statuswijziging")}</button>
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
    ...(data.settings?.report_sections?.length ? [{
      id: "project",
      title: text("Configured client report", "Geconfigureerd klantrapport"),
      sections: data.settings.report_sections as PeriodReportSection[],
    }] : []),
    { id: "complete", title: text("Complete project report", "Compleet projectrapport"), sections: ["management", "workforce", "work", "quality", "hse", "actions", "logistics", "instructions", "commercial", "communications", "requests", "boq", "visual", "documents", "environment", "buildings"] },
    { id: "management", title: text("Management report", "Managementrapport"), sections: ["management", "workforce", "work", "actions", "commercial"] },
    { id: "quality", title: text("Quality and HSE", "Kwaliteit & HSE"), sections: ["quality", "hse", "environment", "actions", "visual", "buildings"] },
    { id: "visual", title: text("Visual progress report", "Visueel voortgangsrapport"), sections: ["visual", "work"] },
  ];
  const [reportChoice, setReportChoice] = useState(data.settings?.report_sections?.length ? "project" : "complete");
  const [reportView, setReportView] = useState<"create" | "workflow" | "history">("create");
  const [historyType, setHistoryType] = useState<"all" | "daily" | "weekly" | "monthly">("all");
  const [openHistoryId, setOpenHistoryId] = useState("");
  const [periodPreset, setPeriodPreset] = useState<"day" | "week" | "month" | "custom">("month");
  const [periodLabel, setPeriodLabel] = useState(() => text("Monthly supervision report", "Maandelijks supervisierapport"));
  const selectedReport = reportChoices.find((choice) => choice.id === reportChoice) ?? reportChoices[0];
  const clientReportOptions: Array<{ id: string; label: string; sections: PeriodReportSection[] }> = [
    { id: "photos", label: text("Photos", "Foto's"), sections: ["visual"] },
    { id: "works_ongoing", label: text("Works ongoing", "Werkzaamheden gaande"), sections: ["work"] },
    { id: "works_completed", label: text("Works completed", "Werkzaamheden afgerond"), sections: ["work"] },
    { id: "workforce", label: "Workforce", sections: ["workforce"] },
    { id: "delays", label: text("Delays", "Vertragingen"), sections: ["logistics"] },
    { id: "issues", label: "Issues", sections: ["quality"] },
    { id: "hse", label: "HSE", sections: ["hse"] },
    { id: "materials_delivery", label: text("Materials delivery", "Materiaallevering"), sections: ["logistics"] },
    { id: "inspections", label: text("Inspections", "Inspecties"), sections: ["quality"] },
    { id: "technical_instructions", label: text("Technical instructions", "Technische instructies"), sections: ["instructions"] },
    { id: "change_order", label: text("Change order · CO", "Wijzigingsopdracht · CO"), sections: ["commercial"] },
    { id: "ncr", label: "NCR", sections: ["quality"] },
    { id: "deadlines", label: text("Deadlines", "Deadlines"), sections: ["actions"] },
    { id: "hse_incident", label: text("HSE incident", "HSE-incident"), sections: ["hse"] },
    { id: "agreements_made", label: text("Agreements made", "Gemaakte afspraken"), sections: ["communications"] },
  ];
  const [includedClientOptions, setIncludedClientOptions] = useState(() => clientReportOptions.map((option) => option.id));
  const reportPromptLibrary = [
    text(
      "Create an executive project-management summary from the attached CODECO report. Separate facts, risks, decisions required, overdue actions and the next seven-day outlook. Do not invent missing information.",
      "Maak uit het bijgevoegde CODECO-rapport een managementsamenvatting. Scheid feiten, risico's, vereiste besluiten, achterstallige acties en de vooruitblik voor zeven dagen. Verzin geen ontbrekende informatie.",
    ),
    text(
      "Review this supervision report for schedule, quality, HSE and commercial risks. For every conclusion, cite the exact report section and clearly mark uncertainty.",
      "Controleer dit supervisierapport op planning-, kwaliteit-, HSE- en commerciële risico's. Noem bij elke conclusie het exacte rapportonderdeel en markeer onzekerheid duidelijk.",
    ),
    text(
      "Rewrite the attached report for a client steering meeting. Preserve all figures and statuses, group actions by responsible party and finish with a decision list.",
      "Herschrijf het bijgevoegde rapport voor een stuurgroepoverleg met de klant. Behoud alle cijfers en statussen, groepeer acties per verantwoordelijke en eindig met een besluitenlijst.",
    ),
    text(
      "Compare the attached approved drawings, technical specifications and latest RFI/RFA log. Produce a conflict matrix with source filename, page or drawing reference, conflict, affected building, risk and required human decision. Do not resolve engineering conflicts yourself.",
      "Vergelijk de bijgevoegde goedgekeurde tekeningen, technische specificaties en het actuele RFI/RFA-log. Maak een conflictmatrix met bronbestand, pagina- of tekeningreferentie, conflict, betrokken gebouw, risico en vereist menselijk besluit. Los technische conflicten niet zelf op.",
    ),
    text(
      "Analyze the attached schedule, Works ongoing, Works completed, Delays and Deadlines exports. Identify the likely critical-path risks and prepare questions for the planner. Cite every input row used and do not invent dependencies.",
      "Analyseer de bijgevoegde planning en exports Werkzaamheden gaande, Werkzaamheden afgerond, Vertragingen en Deadlines. Benoem waarschijnlijke kritieke-pad-risico's en stel vragen voor de planner op. Citeer elke gebruikte invoerregel en verzin geen afhankelijkheden.",
    ),
    text(
      "Review the attached photo register, Issues, NCRs and inspection results. Cluster repeated observations by building and location, but keep Issues and NCRs separate. Return possible trends, missing evidence and a human verification checklist; never declare an NCR closed.",
      "Controleer het bijgevoegde fotoregister, Issues, NCR's en inspectieresultaten. Groepeer herhaalde observaties per gebouw en locatie, maar houd Issues en NCR's gescheiden. Geef mogelijke trends, ontbrekend bewijs en een menselijke verificatiechecklist; verklaar nooit zelf een NCR gesloten.",
    ),
    text(
      "Convert the attached meeting transcript into draft Agreements made. For each item provide decision, responsible party, due date, source timestamp and confidence. Mark unclear owners or dates as REQUIRED INPUT and do not create commitments automatically.",
      "Zet het bijgevoegde vergadertranscript om in concept Gemaakte afspraken. Geef per punt besluit, verantwoordelijke partij, deadline, brontijdstip en zekerheid. Markeer onduidelijke eigenaars of datums als INVOER VEREIST en maak nooit automatisch verplichtingen aan.",
    ),
    text(
      "Using the attached BOQ, Change Orders, material deliveries and progress report, prepare a draft commercial variance review. Separate contracted quantity, approved change, unapproved exposure and missing source evidence. All amounts must retain their original currency and source reference.",
      "Maak met de bijgevoegde BOQ, wijzigingsopdrachten, materiaalleveringen en voortgangsrapportage een concept commerciële afwijkingsanalyse. Scheid gecontracteerde hoeveelheid, goedgekeurde wijziging, niet-goedgekeurde blootstelling en ontbrekend bronbewijs. Behoud bij alle bedragen de oorspronkelijke valuta en bronreferentie.",
    ),
    text(
      "Review the attached HSE observations, incidents, workforce and works ongoing records for recurring control weaknesses. Return a draft toolbox-talk agenda and questions for the HSE officer. Do not diagnose injuries or replace the formal incident investigation.",
      "Controleer de bijgevoegde HSE-observaties, incidenten, workforce en lopende werkzaamheden op terugkerende tekortkomingen in beheersmaatregelen. Geef een concept toolbox-agenda en vragen voor de HSE-functionaris. Stel geen medische diagnose en vervang het formele incidentonderzoek niet.",
    ),
  ];
  const activeSections = [...new Set(clientReportOptions
    .filter((option) => includedClientOptions.includes(option.id))
    .flatMap((option) => option.sections))] as PeriodReportSection[];
  // Sections decide which pages exist; topics decide which blocks appear inside them,
  // so unticking one subject always changes the document.
  const activeTopics = includedClientOptions as PeriodReportTopic[];
  const toggleReportSection = (sectionId: string) => setIncludedClientOptions((current) => current.includes(sectionId)
    ? current.filter((id) => id !== sectionId)
    : [...current, sectionId]);
  const applyDatePreset = (days: number, label: string, preset: "day" | "week") => {
    const start = new Date(`${today}T12:00:00-03:00`);
    start.setDate(start.getDate() - Math.max(0, days - 1));
    setPeriod({ start: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(start), end: today });
    setPeriodLabel(label);
    setPeriodPreset(preset);
  };
  const canReview = reportStatus === "ready_for_review" || reportStatus === "in_review";
  const canSign = reportStatus === "approved" || reportStatus === "signed";
  const canDistribute = reportStatus === "signed" || reportStatus === "sent";
  const reportViews = [
    { id: "create" as const, icon: CalendarRange, title: text("Create report", "Rapport maken"), copy: text("Choose content and period", "Kies inhoud en periode") },
    { id: "workflow" as const, icon: FileCheck2, title: text("Review & sign", "Review & onderteken"), copy: text("Controlled formal steps", "Beheerste formele stappen") },
    { id: "history" as const, icon: Archive, title: text("Versions & history", "Versies & historie"), copy: text("Fixed audit trail", "Vast controlespoor") },
  ];
  const workflowStep = canReview ? 1 : reportStatus === "approved" ? 2 : ["signed", "sent"].includes(reportStatus) ? 3 : 0;
  const workflowGuidance = !reportId
    ? text("Start the daily report through Project start first.", "Start eerst het dagrapport via Projectstart.")
    : ["draft", "in_progress", "returned"].includes(reportStatus)
      ? text("Next: open Overview, complete the daily questions and choose Check report → Ready for review.", "Volgende stap: open Overzicht, rond de dagvragen af en kies Rapport controleren → Gereed voor review.")
      : canReview
        ? text("Next: an authorized reviewer records a comment and approves or returns this version.", "Volgende stap: een bevoegde reviewer legt een commentaar vast en keurt deze versie goed of stuurt haar terug.")
        : reportStatus === "approved"
          ? text("Review is complete. Record the signing declaration for the fixed report version.", "De review is afgerond. Leg nu de ondertekenverklaring voor de vastgezette rapportversie vast.")
          : reportStatus === "signed"
            ? text("The declaration is recorded. Register only a distribution that actually took place.", "De verklaring is vastgelegd. Registreer nu alleen een distributie die werkelijk heeft plaatsgevonden.")
            : reportStatus === "sent"
              ? text("The formal flow is complete. Additional real recipients may be recorded here; the immutable version remains in History.", "De formele flow is afgerond. Extra werkelijke ontvangers kunnen hier worden geregistreerd; de onveranderbare versie blijft in Historie.")
              : text("This report status has no formal action available. Check History or return to Overview.", "Voor deze rapportstatus is geen formele actie beschikbaar. Controleer Historie of ga terug naar Overzicht.");
  const dayReportArchive = (data.dayReports ?? []).map((report) => ({
    id: `daily:${report.id}`,
    type: "daily" as const,
    title: report.report_number,
    start: report.report_date,
    end: report.report_date,
    status: report.status,
    count: 1,
    completeness: report.completeness_percent,
  }));
  const groupedArchive = (type: "weekly" | "monthly") => {
    const groups = new Map<string, typeof dayReportArchive>();
    dayReportArchive.forEach((report) => {
      const date = new Date(`${report.start}T12:00:00-03:00`);
      let key = report.start.slice(0, 7);
      if (type === "weekly") {
        const day = date.getDay() || 7;
        date.setDate(date.getDate() - day + 1);
        key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(date);
      }
      groups.set(key, [...(groups.get(key) ?? []), report]);
    });
    return [...groups.entries()].map(([key, reports]) => ({
      id: `${type}:${key}`,
      type,
      title: type === "weekly" ? text(`Week of ${key}`, `Week van ${key}`) : text(`Month ${key}`, `Maand ${key}`),
      start: [...reports].sort((a, b) => a.start.localeCompare(b.start))[0]?.start ?? key,
      end: [...reports].sort((a, b) => b.end.localeCompare(a.end))[0]?.end ?? key,
      status: reports.every((report) => ["approved", "signed", "sent"].includes(report.status)) ? "complete" : "in_progress",
      count: reports.length,
      completeness: Math.round(reports.reduce((sum, report) => sum + report.completeness, 0) / Math.max(1, reports.length)),
    }));
  };
  const reportArchive = [...dayReportArchive, ...groupedArchive("weekly"), ...groupedArchive("monthly")]
    .filter((report) => historyType === "all" || report.type === historyType)
    .sort((left, right) => right.end.localeCompare(left.end));
  return (
    <>
      <header className="secondary-header report-page-header"><div><p className="eyebrow">{text("Reports", "Rapporten")}</p><h1>{text("Client reports", "Klantrapporten")}</h1><p>{text("Create the right PDF first. Formal approval and history stay available in their own clear steps.", "Maak eerst de juiste PDF. Formele goedkeuring en historie blijven beschikbaar in eigen duidelijke stappen.")}</p></div><div className="report-header-state"><span className="record-number">{reportNumber}</span><span className={`report-state-pill ${reportStatus}`}>{statusLabels[reportStatus] ?? reportStatus}</span></div></header>
      <nav className="report-frequency-tabs" aria-label={text("Report frequency", "Rapportfrequentie")}>
        <button className={periodPreset === "day" ? "active" : ""} type="button" onClick={() => { setReportView("create"); applyDatePreset(1, text("Daily supervision report", "Dagelijks supervisierapport"), "day"); }}><CalendarRange size={19} /><span><strong>Daily report</strong><small>{text("Today and daily records", "Vandaag en dagregistraties")}</small></span></button>
        <button className={periodPreset === "week" ? "active" : ""} type="button" onClick={() => { setReportView("create"); applyDatePreset(7, text("Weekly supervision report", "Wekelijks supervisierapport"), "week"); }}><FileText size={19} /><span><strong>Weekly report</strong><small>{text("Last seven days", "Laatste zeven dagen")}</small></span></button>
        <button className={periodPreset === "month" ? "active" : ""} type="button" onClick={() => { setReportView("create"); setPeriod({ start: `${today.slice(0, 8)}01`, end: today }); setPeriodLabel(text("Monthly supervision report", "Maandelijks supervisierapport")); setPeriodPreset("month"); }}><Archive size={19} /><span><strong>Monthly report</strong><small>{text("Management summary and trends", "Managementsamenvatting en trends")}</small></span></button>
      </nav>
      <nav className="report-section-tabs" role="tablist" aria-label={text("Report workspace", "Rapportwerkruimte")}>
        {reportViews.map((view) => {
          const Icon = view.icon;
          return <button className={reportView === view.id ? "active" : ""} type="button" role="tab" aria-selected={reportView === view.id} onClick={() => setReportView(view.id)} key={view.id}><Icon size={18} /><span><strong>{view.title}</strong><small>{view.copy}</small></span></button>;
        })}
      </nav>
      {reportView === "create" ? (
        <section className="period-report-card">
          <div className="workflow-icon"><CalendarRange size={20} /></div>
          <div className="period-report-copy"><span className="record-number">{text("Automatic client output", "Automatische klantoutput")}</span><h2>{text("Choose what the client needs", "Kies wat de klant nodig heeft")}</h2><p>{text("The app compiles one consistent snapshot from workforce, progress, inspections, findings, HSE, deliveries, delays, controlled documents and visual evidence.", "De app stelt één consistente momentopname samen uit bezetting, voortgang, inspecties, bevindingen, HSE, leveringen, vertragingen, beheerde documenten en visueel bewijs.")}</p></div>
          <div className="period-report-types" role="radiogroup" aria-label={text("Report type", "Rapporttype")}>{reportChoices.map((choice) => <button className={reportChoice === choice.id ? "active" : ""} type="button" role="radio" aria-checked={reportChoice === choice.id} onClick={() => setReportChoice(choice.id)} key={choice.id}><strong>{choice.title}</strong><span>{choice.sections.length} {text("automatic sections", "automatische onderdelen")}</span></button>)}</div>
          <fieldset className="report-source-checklist">
            <legend>{text("Include in this report", "Opnemen in dit rapport")}</legend>
            {clientReportOptions.map((option) => <label key={option.id}><input type="checkbox" checked={includedClientOptions.includes(option.id)} onChange={() => toggleReportSection(option.id)} /><span>{option.label}</span></label>)}
          </fieldset>
          <details className="report-prompt-library">
            <summary><MessageCircle size={15} /> {text("Prompt library for external writing review", "Promptlijst voor externe schrijfreview")}</summary>
            <p>{text("Copy a controlled prompt after downloading the report. No project data is sent automatically.", "Kopieer na het downloaden van het rapport een gecontroleerde prompt. Er worden niet automatisch projectgegevens verstuurd.")}</p>
            <div>{reportPromptLibrary.map((prompt, index) => <button type="button" onClick={() => void navigator.clipboard.writeText(prompt)} key={prompt}><Copy size={14} /><span><strong>{text("Copy prompt", "Kopieer prompt")} {index + 1}</strong><small>{prompt}</small></span></button>)}</div>
          </details>
          <div className="period-date-presets"><span>{text("Quick period", "Snelle periode")}</span><button className={periodPreset === "day" ? "active" : ""} type="button" aria-pressed={periodPreset === "day"} onClick={() => applyDatePreset(1, text("Daily supervision report", "Dagelijks supervisierapport"), "day")}>{text("Today", "Vandaag")}</button><button className={periodPreset === "week" ? "active" : ""} type="button" aria-pressed={periodPreset === "week"} onClick={() => applyDatePreset(7, text("Weekly supervision report", "Wekelijks supervisierapport"), "week")}>{text("Last 7 days", "Laatste 7 dagen")}</button><button className={periodPreset === "month" ? "active" : ""} type="button" aria-pressed={periodPreset === "month"} onClick={() => { setPeriod({ start: `${today.slice(0, 8)}01`, end: today }); setPeriodLabel(text("Monthly supervision report", "Maandelijks supervisierapport")); setPeriodPreset("month"); }}>{text("This month", "Deze maand")}</button>{periodPreset === "custom" ? <em>{text("Custom period", "Vrije periode")}</em> : null}</div>
          <label className="form-field"><span>{text("From", "Van")}</span><input type="date" value={period.start} max={period.end} onChange={(event) => { setPeriod({ ...period, start: event.target.value }); setPeriodLabel(text("Period supervision report", "Supervisierapport over periode")); setPeriodPreset("custom"); }} /></label>
          <label className="form-field"><span>{text("Through", "Tot en met")}</span><input type="date" value={period.end} min={period.start} max={today} onChange={(event) => { setPeriod({ ...period, end: event.target.value }); setPeriodLabel(text("Period supervision report", "Supervisierapport over periode")); setPeriodPreset("custom"); }} /></label>
          <ReportDownloadButtons
            variant="prominent"
            className="report-create-button"
            disabled={busy || !activeSections.length || !period.start || !period.end || period.end < period.start}
            onDownloadPdf={() => run(async () => { const snapshot = await buildPeriodReportSnapshot(client, projectId, period.start, period.end); const { downloadPeriodReportPdf } = await import("@/lib/reports/period-report-pdf"); await downloadPeriodReportPdf(snapshot, { sections: activeSections, topics: activeTopics, reportTitle: `${periodLabel} · ${selectedReport.title}`, headerText: data.settings?.report_header, footerText: data.settings?.report_footer }); }, text(`${periodLabel} for ${projectName} downloaded.`, `${periodLabel} voor ${projectName} gedownload.`))}
            onDownloadWord={() => run(async () => { const snapshot = await buildPeriodReportSnapshot(client, projectId, period.start, period.end); const { downloadPeriodReportDocx } = await import("@/lib/reports/period-report-docx"); await downloadPeriodReportDocx(snapshot, { sections: activeSections, topics: activeTopics, reportTitle: `${periodLabel} · ${selectedReport.title}`, headerText: data.settings?.report_header, footerText: data.settings?.report_footer }); }, text(`${periodLabel} for ${projectName} downloaded as Word.`, `${periodLabel} voor ${projectName} als Word gedownload.`))}
          />
        </section>
      ) : null}
      {reportView === "workflow" ? (
        <>
          <div className={`operation-alert report-next-step ${workflowStep ? "success" : "warning"}`} role="status">
            {workflowStep ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <div><strong>{text("Current next step", "Huidige volgende stap")}</strong><span>{workflowGuidance}</span></div>
          </div>
          <section className="workflow-grid">
            <div className={`workflow-card ${workflowStep === 1 ? "current" : workflowStep > 1 ? "complete" : "locked"}`}><div className="workflow-icon"><ClipboardCheck size={19} /></div><h2>1. Review</h2><p>{text("An authorized reviewer approves or returns the report with a reason. Approval automatically freezes the complete snapshot with SHA-256.", "Een bevoegde reviewer keurt goed of stuurt gemotiveerd terug. Bij goedkeuring bevriest de database automatisch de volledige momentopname met SHA-256.")}</p><label className="form-field"><span>{text("Review comment", "Reviewcommentaar")}</span><textarea rows={3} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /><DictateButton onText={(transcript) => setReviewComment((current) => appendDictation(current, transcript))} /></label><div className="button-row"><button className="secondary-button" type="button" disabled={busy || !reportId || !canReview || reviewComment.trim().length < 2} onClick={() => void run(() => reviewReport(client, reportId!, "returned", reviewComment), text("Report returned for correction with a reason.", "Rapport gemotiveerd teruggestuurd voor correctie."))}>{text("Return", "Terugsturen")}</button><button className="primary-button" type="button" disabled={busy || !reportId || !canReview || reviewComment.trim().length < 2} onClick={() => void run(() => reviewReport(client, reportId!, "approved", reviewComment), text("Report approved and frozen as an immutable version.", "Rapport goedgekeurd en als immutable versie vastgezet."))}><FileCheck2 size={15} /> {text("Approve and freeze", "Goedkeuren & vastzetten")}</button></div></div>
            <div className={`workflow-card ${workflowStep === 2 ? "current" : workflowStep > 2 ? "complete" : "locked"}`}><div className="workflow-icon"><FileCheck2 size={19} /></div><h2>2. {text("Signing declaration", "Ondertekenverklaring")}</h2><p>{text("Identity, project role, version hash and declaration remain append-only. The legal level remains", "Identiteit, projectrol, versiehash en verklaring blijven append-only bewaard. Het juridische niveau blijft")} <strong>contract pending</strong> {text("until CODECO formally decides.", "totdat CODECO dit formeel kiest.")}</p><label className="form-field"><span>{text("Sign as", "Onderteken als")}</span><select value={signerRole} onChange={(event) => setSignerRole(event.target.value)}><option value="supervisor">Supervisor</option><option value="project_manager">{text("Project manager", "Projectleider")}</option><option value="lead_supervisor">Lead supervisor</option><option value="contractor">{text("Contractor", "Aannemer")}</option><option value="client">{text("Client", "Opdrachtgever")}</option><option value="quality_hse_manager">{text("Quality/HSE", "Kwaliteit/HSE")}</option></select></label><label className="form-field"><span>{text("Declaration", "Verklaring")}</span><textarea rows={3} value={declaration} onChange={(event) => setDeclaration(event.target.value)} /><DictateButton onText={(transcript) => setDeclaration((current) => appendDictation(current, transcript))} /></label><button className="primary-button" type="button" disabled={busy || !reportId || !canSign || declaration.trim().length < 10} onClick={() => void run(() => signReport(client, reportId!, signerRole, currentUserName, declaration), text("Signing declaration immutably linked to the report version.", "Ondertekenverklaring onveranderbaar aan de rapportversie gekoppeld."))}><FileCheck2 size={15} /> {text("Record declaration", "Verklaring vastleggen")}</button></div>
            <div className={`workflow-card ${workflowStep === 3 ? "current" : "locked"}`}><div className="workflow-icon"><Users size={19} /></div><h2>3. {text("Distribution", "Distributie")}</h2><p>{text("Only record a delivery that actually occurred. Without an email connector, the app does not claim automatic delivery.", "Registreer alleen een verzending die werkelijk heeft plaatsgevonden. De app claimt zonder e-mailconnector geen automatische bezorging.")}</p><label className="form-field"><span>{text("Recipient", "Ontvanger")}</span><input value={distribution.name} onChange={(event) => setDistribution({ ...distribution, name: event.target.value })} /></label><label className="form-field"><span>{text("Address / reference", "Adres / referentie")}</span><input value={distribution.address} onChange={(event) => setDistribution({ ...distribution, address: event.target.value })} /></label><label className="form-field"><span>{text("Channel", "Kanaal")}</span><select value={distribution.channel} onChange={(event) => setDistribution({ ...distribution, channel: event.target.value })}><option value="manual">{text("Manual transfer", "Handmatige overdracht")}</option><option value="email">{text("Email (sent externally)", "E-mail (extern verzonden)")}</option><option value="download">{text("Secure download", "Beveiligde download")}</option></select></label><button className="primary-button" type="button" disabled={busy || !reportId || !canDistribute || distribution.name.trim().length < 2 || distribution.address.trim().length < 3} onClick={() => void run(() => recordDistribution(client, reportId!, distribution.name, distribution.address, distribution.channel), text("Traceable distribution record added to the fixed version.", "Aantoonbare distributieregel aan de vastgezette versie toegevoegd."))}><FileText size={15} /> {text("Record distribution", "Distributie registreren")}</button></div>
          </section>
        </>
      ) : null}
      {reportView === "history" ? (
        <>
          <section className="report-archive">
            <header><div><span className="record-number">{text("Report history", "Rapporthistorie")}</span><h2>{text("All available reports", "Alle beschikbare rapporten")}</h2><p>{text("Daily records are the source of truth. Weekly and monthly entries group those same records and remain clickable.", "Dagregistraties zijn de bron. Week- en maanditems groeperen dezelfde registraties en blijven aanklikbaar.")}</p></div><label className="form-field"><span>{text("Report type", "Rapporttype")}</span><select value={historyType} onChange={(event) => setHistoryType(event.target.value as typeof historyType)}><option value="all">{text("All reports", "Alle rapporten")}</option><option value="daily">{text("Daily", "Dagrapport")}</option><option value="weekly">{text("Weekly", "Weekrapport")}</option><option value="monthly">{text("Monthly", "Maandrapport")}</option></select></label></header>
            <div className="report-archive-list">
              {reportArchive.map((report) => <article className={openHistoryId === report.id ? "open" : ""} key={report.id}>
                <button type="button" onClick={() => setOpenHistoryId((current) => current === report.id ? "" : report.id)}><span className={`report-type-badge ${report.type}`}>{report.type}</span><span><strong>{report.title}</strong><small>{report.start}{report.end !== report.start ? ` → ${report.end}` : ""} · {report.count} {text("day record(s)", "dagregistratie(s)")}</small></span><span className="report-archive-progress"><b>{report.completeness}%</b><i><em style={{ width: `${report.completeness}%` }} /></i></span><ArrowRight size={15} /></button>
                {openHistoryId === report.id ? <div className="report-archive-detail"><span>{text("Status", "Status")}: <strong>{report.status.replaceAll("_", " ")}</strong></span><span>{text("Content", "Inhoud")}: {text("complete record for this period", "volledige registratie over deze periode")}</span><ReportDownloadButtons disabled={busy} onDownloadPdf={() => run(async () => { const snapshot = await buildPeriodReportSnapshot(client, projectId, report.start, report.end); const { downloadPeriodReportPdf } = await import("@/lib/reports/period-report-pdf"); await downloadPeriodReportPdf(snapshot, { reportTitle: report.title, headerText: data.settings?.report_header, footerText: data.settings?.report_footer }); }, text("Archived report view downloaded.", "Rapportweergave uit de historie gedownload."))} onDownloadWord={() => run(async () => { const snapshot = await buildPeriodReportSnapshot(client, projectId, report.start, report.end); const { downloadPeriodReportDocx } = await import("@/lib/reports/period-report-docx"); await downloadPeriodReportDocx(snapshot, { reportTitle: report.title, headerText: data.settings?.report_header, footerText: data.settings?.report_footer }); }, text("Archived report view downloaded as Word.", "Rapportweergave uit de historie als Word gedownload."))} /></div> : null}
              </article>)}
              {!reportArchive.length ? <div className="empty-list-state"><Archive size={22} /><strong>{text("No reports for this filter", "Geen rapporten voor dit filter")}</strong><span>{text("Create a daily report from Overview first.", "Maak eerst een dagrapport vanuit Overzicht.")}</span></div> : null}
            </div>
          </section>
          <section className="report-history-grid">
            <HistoryColumn title={text("Fixed versions", "Vastgezette versies")} empty={text("No immutable version yet.", "Nog geen immutable versie.")} rows={data.reportVersions.map((version) => <div className="history-version" key={version.id}><span>{text("Revision", "Revisie")} {version.revision} · {formatDate(version.created_at, locale)} · SHA {version.sha256.slice(0, 12)}…</span><ReportDownloadButtons disabled={busy} onDownloadPdf={() => run(async () => { const { downloadFormalReportPdf } = await import("@/lib/reports/daily-report-pdf"); await downloadFormalReportPdf(version.snapshot as FormalReportSnapshot, version.revision, version.sha256); }, text(`Formal revision ${version.revision} downloaded directly from the immutable snapshot.`, `Formele revisie ${version.revision} rechtstreeks uit de immutable snapshot gedownload.`))} onDownloadWord={() => run(async () => { const { downloadFormalReportDocx } = await import("@/lib/reports/daily-report-docx"); await downloadFormalReportDocx(version.snapshot as FormalReportSnapshot, version.revision, version.sha256); }, text(`Formal revision ${version.revision} downloaded as Word directly from the immutable snapshot.`, `Formele revisie ${version.revision} als Word rechtstreeks uit de immutable snapshot gedownload.`))} /></div>)} />
            <HistoryColumn title="Reviews" empty={text("No review decision yet.", "Nog geen reviewbesluit.")} rows={data.reportReviews.map((review) => `${statusLabels[review.decision] ?? review.decision} · ${review.comment} · ${formatDate(review.created_at, locale)}`)} />
            <HistoryColumn title={text("Declarations", "Verklaringen")} empty={text("No signing declaration yet.", "Nog geen ondertekenverklaring.")} rows={data.reportSignatures.map((signature) => `${signature.signer_name} · ${signature.signer_role} · ${formatDate(signature.signed_at, locale)}`)} />
            <HistoryColumn title={text("Distribution", "Distributie")} empty={text("No delivery recorded yet.", "Nog geen verzending geregistreerd.")} rows={data.reportDistributions.map((item) => `${item.recipient_name} · ${item.channel} · ${item.status}`)} />
          </section>
          {reportStatus === "approved" || reportStatus === "signed" || reportStatus === "sent" ? <div className="revision-bar"><div><strong>{text("Correction after freezing?", "Correctie na vastzetten?")}</strong><span>{text("The original version remains; corrections start a new revision.", "De oorspronkelijke versie blijft bestaan; correcties starten een nieuwe revisie.")}</span></div><input value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder={text("Required revision reason", "Verplichte revisiereden")} /><button className="secondary-button" type="button" disabled={busy || !reportId || revisionReason.trim().length < 5} onClick={() => void run(() => startRevision(client, reportId!, revisionReason), text("New report revision started; the original version remains immutable.", "Nieuwe rapportrevisie gestart; de oorspronkelijke versie blijft immutable."))}><RotateCcw size={15} /> {text("Start revision", "Start revisie")}</button></div> : null}
        </>
      ) : null}
    </>
  );
}

function AdminOperations({ data, client, organizationId, projectId, projectName, reportStatus, buildingId, buildingName, buildings, companyEmployees, projectActions, parties, canManageOrganization, openUserAdmin, openProjectArea, openActionCenter, createProjectAction, busy, run }: { data: OperationSnapshot; client: SupabaseClient; organizationId: string; projectId: string; projectName: string; reportStatus: string; buildingId: string; buildingName: string; buildings: BuildingOption[]; companyEmployees: InternalMember[]; projectActions: Array<{ id: string; title: string; action_number: string; status: string; priority: string; due_at: string | null; owner_user_id?: string | null }>; parties: ProjectParty[]; canManageOrganization: boolean; openUserAdmin: () => void; openProjectArea: (tab: "inspections" | "findings" | "registers" | "visual" | "submissions") => void; openActionCenter: () => void; createProjectAction: () => void; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const { text } = useLanguage();
  const [section, setSection] = useState<"overview" | "settings" | "structure" | "templates" | "backup">("overview");
  const [structureBuildingId, setStructureBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [template, setTemplate] = useState({ module: "inspection", code: "", name: "", prompts: "" });
  const [settings, setSettings] = useState(() => ({
    maxFileSizeMb: data.settings?.max_file_size_mb ?? 25,
    leadHours: data.settings?.notification_lead_hours ?? 24,
    retentionDays: data.settings?.retention_days?.toString() ?? "",
    reportPrefix: data.settings?.report_prefix ?? "DR",
    pushNotificationsEnabled: data.settings?.push_notifications_enabled ?? true,
    defaultLanguage: data.settings?.default_language ?? "en",
    shiftStart: data.settings?.default_shift_start?.slice(0, 5) ?? "07:00",
    shiftEnd: data.settings?.default_shift_end?.slice(0, 5) ?? "16:00",
    disciplines: (data.settings?.disciplines ?? []).join("\n"),
    requiredLocationDepth: data.settings?.required_location_depth ?? "building",
    lowDays: data.settings?.finding_deadlines?.low ?? 14,
    mediumDays: data.settings?.finding_deadlines?.medium ?? 7,
    highDays: data.settings?.finding_deadlines?.high ?? 3,
    criticalDays: data.settings?.finding_deadlines?.critical ?? 1,
    reportSections: [
      "photos", "works_ongoing", "works_completed", "workforce", "delays", "issues", "hse",
      "materials_delivery", "inspections", "technical_instructions", "change_order", "ncr",
      "deadlines", "hse_incident", "agreements_made",
    ],
    reportHeader: data.settings?.report_header ?? "",
    reportFooter: data.settings?.report_footer ?? "",
    modules: data.settings?.modules ?? {},
  }));
  const [location, setLocation] = useState({ type: "zone", code: "", name: "", parentId: "", description: "" });
  const [party, setParty] = useState({ type: "contractor", code: "", name: "" });
  const [libraryCategory, setLibraryCategory] = useState("all");
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const latestScheduledBackup = data.backupRuns.find((item) => item.run_type === "scheduled" && item.status === "verified");
  const latestRestoreTest = data.backupRuns.find((item) => item.run_type === "restore_test" && item.status === "dry_run_passed");
  const openFindings = data.findings.filter((item) => !["closed", "cancelled"].includes(item.status));
  const criticalFindings = openFindings.filter((item) => item.severity === "critical" || item.severity === "high");
  const activeInspections = data.inspections.filter((item) => item.status === "planned" || item.status === "in_progress" || item.status === "failed");
  const externalSubmissions = data.registerEntries.filter((entry) => ["rfi", "rfa", "inspection_request", "wcr"].includes(entry.register_type));
  const assignableActions = projectActions.filter((action) => !["verified", "cancelled"].includes(action.status));
  const employeeName = (userId: string | null | undefined) => {
    if (!userId) return text("Not assigned", "Niet toegewezen");
    const employee = companyEmployees.find((item) => item.userId === userId);
    return employee?.displayName?.trim() || employee?.email || text("Unknown employee", "Onbekende medewerker");
  };
  const addTemplate = () => {
    const prompts = template.prompts.split("\n").map((value) => value.trim()).filter(Boolean);
    if (template.code.trim().length < 2 || template.name.trim().length < 3 || prompts.length === 0) return;
    void run(() => createChecklist(client, { organizationId, projectId, module: template.module, code: template.code, name: template.name, prompts }), text("Project checklist published; existing inspection results remain linked to their previous version.", "Projectchecklist gepubliceerd; bestaande inspectieresultaten blijven aan hun oude versie gekoppeld.")).then((okay) => { if (okay) setTemplate({ module: "inspection", code: "", name: "", prompts: "" }); });
  };
  return (
    <>
      <header className="secondary-header"><div><p className="eyebrow">{text("Management workspace", "Managementwerkruimte")} · {projectName}</p><h1>{section === "overview" ? text("Management overview", "Managementoverzicht") : text("Administration and control", "Beheer en controle")}</h1><p>{text("Decisions, access, project standards and continuity in one place.", "Besluiten, toegang, projectstandaarden en continuïteit op één plek.")}</p></div><div className="management-header-actions">{/* The top bar drops the language switch on phones, so it lives here. */}<LanguageSwitcher />{canManageOrganization ? <button className="primary-button" type="button" onClick={openUserAdmin}><Users size={15} /> {text("Manage team", "Team beheren")}</button> : null}</div></header>
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
        <section className="external-submission-center">
          <header><div><span className="record-number">{text("External parties", "Externe partijen")}</span><h2>{text("Submissions, decisions and task ownership", "Indieningen, besluiten en taakverdeling")}</h2><p>{text("Contractors submit RFI, RFA, IR/WIR or WCR first. The company or owner records the decision; every response remains in the document history.", "Aannemers dienen eerst RFI, RFA, IR/WIR of WCR in. Het bedrijf of de eigenaar legt het besluit vast; elk antwoord blijft in de documenthistorie.")}</p></div><div className="button-row"><button className="secondary-button" type="button" onClick={() => openProjectArea("submissions")}><FileText size={15} /> {text("Record external submission", "Externe indiening registreren")}</button><button className="secondary-button" type="button" onClick={openActionCenter}><ClipboardCheck size={15} /> {text("Manage tasks", "Taken beheren")}</button><button className="primary-button" type="button" onClick={createProjectAction}><Plus size={15} /> {text("Assign follow-up", "Opvolging toewijzen")}</button></div></header>
          <div className="external-access-summary">
            <span><KeyRound size={17} /><strong>{text("With account", "Met account")}</strong><small>{text("Project role controls what the external party may submit and view.", "De projectrol bepaalt wat de externe partij mag indienen en zien.")}</small></span>
            <span><Link2 size={17} /><strong>{text("Without account", "Zonder account")}</strong><small>{text("Use a revocable external evidence link; no general project access is granted.", "Gebruik een intrekbare externe bewijslink; er wordt geen algemene projecttoegang gegeven.")}</small></span>
            <span><Archive size={17} /><strong>{externalSubmissions.length} {text("submissions", "indieningen")}</strong><small>{externalSubmissions.filter((entry) => !["approved", "closed", "cancelled"].includes(entry.status)).length} {text("require a decision", "vragen een besluit")}</small></span>
          </div>
          <section className="company-task-assignment">
            <header>
              <div><span className="record-number">{text("Company employees", "Eigen medewerkers")}</span><h3>{text("Assign and redistribute project tasks", "Projecttaken toewijzen en herverdelen")}</h3><p>{text("Only active company employees are selectable. Every assignment is recorded in the immutable action history.", "Alleen actieve medewerkers van het bedrijf zijn selecteerbaar. Iedere toewijzing wordt vastgelegd in de onveranderbare actiehistorie.")}</p></div>
              <button className="secondary-button" type="button" onClick={openUserAdmin}><Users size={15} /> {text("Manage employees", "Medewerkers beheren")}</button>
            </header>
            {companyEmployees.length ? (
              <>
                <div className="employee-workload-strip">
                  {companyEmployees.map((employee) => {
                    const openCount = assignableActions.filter((action) => action.owner_user_id === employee.userId).length;
                    const projectRole = employee.projectRoles.find((role) => role.projectId === projectId);
                    return <span key={employee.userId}><strong>{employee.displayName?.trim() || employee.email}</strong><small>{projectRole?.roleName || employee.organizationRoles[0]?.name || text("Company employee", "Bedrijfsmedewerker")} · {openCount} {text("open", "open")}</small></span>;
                  })}
                </div>
                <div className="company-action-assignment-list">
                  {assignableActions.map((action) => {
                    const selectedUserId = assignmentDrafts[action.id] ?? action.owner_user_id ?? "";
                    const changed = Boolean(selectedUserId) && selectedUserId !== action.owner_user_id;
                    return <article key={action.id}>
                      <div><span className={`priority-dot ${action.priority}`} /><span><strong>{action.title}</strong><small>{action.action_number} · {action.status.replaceAll("_", " ")} · {text("Current", "Huidig")}: {employeeName(action.owner_user_id)}</small></span></div>
                      <label className="form-field"><span>{text("Responsible employee", "Verantwoordelijke medewerker")}</span><select value={selectedUserId} onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [action.id]: event.target.value }))}><option value="">{text("Choose an employee", "Kies een medewerker")}</option>{companyEmployees.map((employee) => <option value={employee.userId} key={employee.userId}>{employee.displayName?.trim() || employee.email}</option>)}</select></label>
                      <button className="primary-button" type="button" disabled={busy || !changed} onClick={() => void run(() => assignProjectAction(client, { actionId: action.id, ownerUserId: selectedUserId, note: "Assigned or reassigned by Management." }), text("Task assigned to the selected company employee; the history was updated.", "Taak aan de gekozen eigen medewerker toegewezen; de historie is bijgewerkt.")).then((okay) => { if (okay) setAssignmentDrafts((current) => { const next = { ...current }; delete next[action.id]; return next; }); })}>{text("Assign", "Toewijzen")}</button>
                    </article>;
                  })}
                  {!assignableActions.length ? <div className="empty-list-state"><CheckCircle2 size={20} /><strong>{text("No open project tasks", "Geen open projecttaken")}</strong><span>{text("Create a follow-up task when a submission or finding requires an employee.", "Maak een opvolgtaak wanneer een indiening of bevinding een medewerker vereist.")}</span></div> : null}
                </div>
              </>
            ) : <div className="operation-alert warning"><Users size={18} /><div><strong>{text("No assignable company employees", "Geen toewijsbare eigen medewerkers")}</strong><span>{text("Add an active employee with an organization role or supervisor/project manager role first.", "Voeg eerst een actieve medewerker met een organisatierol of supervisor/projectmanagerrol toe.")}</span></div></div>}
          </section>
          <ControlledDocumentList entries={externalSubmissions} buildings={buildings} locationNodes={data.locationNodes} busy={busy} currentUserName={text("Company / owner reviewer", "Reviewer bedrijf / eigenaar")} client={client} run={run} />
        </section>
        <div className="management-context"><div><span>{text("Current report", "Huidig rapport")}</span><strong>{reportStatus.replaceAll("_", " ")}</strong></div><div><span>{text("Project locations", "Projectlocaties")}</span><strong>{data.locationNodes.length}</strong></div><div><span>{text("Published checklists", "Gepubliceerde checklists")}</span><strong>{data.templates.filter((item) => item.status === "published").length}</strong></div><div><span>{text("Controlled files", "Beheerde bestanden")}</span><strong>{data.files.length}</strong></div></div>
      </section> : null}
      {section === "settings" ? (
        <section className="operation-panel">
          <div className="admin-card-grid">
            {canManageOrganization ? <button className="module-card" type="button" onClick={openUserAdmin}><span className="module-card-icon"><Users size={19} /></span><h2>{text("Users and access", "Gebruikers en toegang")}</h2><p>{text("Only administrators create internal accounts and assign organization or project roles.", "Alleen beheerders maken interne accounts en wijzen organisatie- of projectrollen toe.")}</p></button> : null}
            <MfaSecurityCard client={client} />
            <div className="operation-form">
              <div className="operation-form-heading"><div><span className="record-number">{text("Client-controlled configuration", "Klantbeheerbare configuratie")}</span><h2>{text("Project rules", "Projectregels")}</h2></div><span className={`task-status ${data.settings?.configuration_status === "active" ? "green" : ""}`}>{data.settings?.configuration_status ?? "setup"}</span></div>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Report prefix", "Rapportprefix")}</span><input value={settings.reportPrefix} onChange={(event) => setSettings({ ...settings, reportPrefix: event.target.value.toUpperCase() })} /></label>
                <label className="form-field"><span>{text("Default language", "Standaardtaal")}</span><select value={settings.defaultLanguage} onChange={(event) => setSettings({ ...settings, defaultLanguage: event.target.value })}><option value="en">English</option><option value="nl">Nederlands</option></select></label>
                <label className="form-field"><span>{text("Default shift start", "Standaard starttijd")}</span><input type="time" value={settings.shiftStart} onChange={(event) => setSettings({ ...settings, shiftStart: event.target.value })} /></label>
                <label className="form-field"><span>{text("Default shift end", "Standaard eindtijd")}</span><input type="time" value={settings.shiftEnd} onChange={(event) => setSettings({ ...settings, shiftEnd: event.target.value })} /></label>
                <label className="form-field"><span>{text("Required location detail", "Verplicht locatieniveau")}</span><select value={settings.requiredLocationDepth} onChange={(event) => setSettings({ ...settings, requiredLocationDepth: event.target.value as typeof settings.requiredLocationDepth })}><option value="building">{text("Building", "Gebouw")}</option><option value="floor">{text("Floor", "Verdieping")}</option><option value="room">{text("Room", "Ruimte")}</option><option value="element">{text("Element", "Element")}</option></select></label>
                <label className="form-field"><span>{text("File limit (MB)", "Bestandslimiet (MB)")}</span><input type="number" min="1" max="100" value={settings.maxFileSizeMb} onChange={(event) => setSettings({ ...settings, maxFileSizeMb: Number(event.target.value) })} /></label>
                <label className="form-field"><span>{text("Reminder before deadline (hours)", "Herinnering vóór deadline (uur)")}</span><input type="number" min="1" max="720" value={settings.leadHours} onChange={(event) => setSettings({ ...settings, leadHours: Number(event.target.value) })} /></label>
                <label className="form-field"><span>{text("Retention period (days)", "Bewaartermijn (dagen)")}</span><input type="number" min="30" value={settings.retentionDays} onChange={(event) => setSettings({ ...settings, retentionDays: event.target.value })} /></label>
              </div>
              <label className="form-field"><span>{text("Workforce disciplines · one per line", "Workforce-disciplines · één per regel")}</span><textarea rows={7} value={settings.disciplines} onChange={(event) => setSettings({ ...settings, disciplines: event.target.value })} /><DictateButton onText={(transcript) => setSettings((current) => ({ ...current, disciplines: appendDictation(current.disciplines, transcript) }))} /></label>
              <div className="form-grid-2">
                {[
                  ["lowDays", text("Low severity deadline (days)", "Deadline lage ernst (dagen)")],
                  ["mediumDays", text("Medium severity deadline (days)", "Deadline middelhoge ernst (dagen)")],
                  ["highDays", text("High severity deadline (days)", "Deadline hoge ernst (dagen)")],
                  ["criticalDays", text("Critical severity deadline (days)", "Deadline kritieke ernst (dagen)")],
                ].map(([key, label]) => <label className="form-field" key={key}><span>{label}</span><input type="number" min="0" max="365" value={settings[key as "lowDays" | "mediumDays" | "highDays" | "criticalDays"]} onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })} /></label>)}
              </div>
              <div className="click-answer-block">
                <strong>{text("Active project modules", "Actieve projectmodules")}</strong>
                <div className="quick-issue-presets">{Object.entries({
                  attendance: text("Workforce", "Workforce"), inspections: text("Inspections", "Inspecties"),
                  quality: text("Issues & NCR", "Issues & NCR"), hse: "HSE", actions: text("Actions", "Acties"),
                  documents: text("Documents", "Documenten"), visual_evidence: text("Visual evidence", "Visueel bewijs"),
                }).map(([module, label]) => <button className={settings.modules[module] !== false ? "active" : ""} type="button" onClick={() => setSettings({ ...settings, modules: { ...settings.modules, [module]: settings.modules[module] === false } })} key={module}>{label}</button>)}</div>
              </div>
              <div className="click-answer-block">
                <strong>{text("Client report sections", "Secties in klantrapport")}</strong>
                <div className="quick-issue-presets">{[
                  ["photos", text("Photos", "Foto's")],
                  ["works_ongoing", text("Works ongoing", "Werkzaamheden gaande")],
                  ["works_completed", text("Works completed", "Werkzaamheden afgerond")],
                  ["workforce", "Workforce"],
                  ["delays", text("Delays", "Vertragingen")],
                  ["issues", "Issues"],
                  ["hse", "HSE"],
                  ["materials_delivery", text("Materials delivery", "Materiaallevering")],
                  ["inspections", text("Inspections", "Inspecties")],
                  ["technical_instructions", text("Technical instructions", "Technische instructies")],
                  ["change_order", text("Change order · CO", "Wijzigingsopdracht · CO")],
                  ["ncr", "NCR"],
                  ["deadlines", text("Deadlines", "Deadlines")],
                  ["hse_incident", text("HSE incident", "HSE-incident")],
                  ["agreements_made", text("Agreements made", "Gemaakte afspraken")],
                ].map(([sectionName, label]) => <button className={settings.reportSections.includes(sectionName) ? "active" : ""} type="button" onClick={() => setSettings({ ...settings, reportSections: settings.reportSections.includes(sectionName) ? settings.reportSections.filter((item) => item !== sectionName) : [...settings.reportSections, sectionName] })} key={sectionName}>{label}</button>)}</div>
              </div>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Report header", "Rapportkop")}</span><input value={settings.reportHeader} onChange={(event) => setSettings({ ...settings, reportHeader: event.target.value })} /></label>
                <label className="form-field"><span>{text("Report footer", "Rapportvoettekst")}</span><input value={settings.reportFooter} onChange={(event) => setSettings({ ...settings, reportFooter: event.target.value })} /></label>
              </div>
              <label className="confirmation-check"><input type="checkbox" checked={settings.pushNotificationsEnabled} onChange={(event) => setSettings({ ...settings, pushNotificationsEnabled: event.target.checked })} /><span><strong>{text("Automatic push notifications for deadlines", "Automatische pushmeldingen voor deadlines")}</strong><small>{text("The in-app inbox keeps the auditable copy.", "De inbox bewaart de auditeerbare kopie.")}</small></span></label>
              <button className="primary-button" type="button" disabled={busy || !data.settings || settings.disciplines.split("\n").filter((item) => item.trim()).length === 0 || settings.reportSections.length === 0} onClick={() => data.settings && void run(() => saveProjectSettings(client, data.settings!, {
                report_prefix: settings.reportPrefix,
                default_language: settings.defaultLanguage,
                default_shift_start: settings.shiftStart,
                default_shift_end: settings.shiftEnd,
                max_file_size_mb: settings.maxFileSizeMb,
                notification_lead_hours: settings.leadHours,
                push_notifications_enabled: settings.pushNotificationsEnabled,
                email_notifications_enabled: false,
                retention_days: settings.retentionDays ? Number(settings.retentionDays) : null,
                disciplines: settings.disciplines.split("\n").map((item) => item.trim()).filter(Boolean),
                required_location_depth: settings.requiredLocationDepth,
                finding_deadlines: { low: settings.lowDays, medium: settings.mediumDays, high: settings.highDays, critical: settings.criticalDays },
                report_sections: settings.reportSections,
                report_header: settings.reportHeader.trim() || null,
                report_footer: settings.reportFooter.trim() || null,
                modules: settings.modules,
                configuration_status: "active",
              }), text("All client-controlled project rules were stored centrally.", "Alle klantbeheerbare projectregels zijn centraal opgeslagen."))}><Settings size={15} /> {text("Save all project parameters", "Sla alle projectparameters op")}</button>
            </div>
          </div>
        </section>
      ) : null}
      {section === "structure" ? <section className="operation-panel"><div className="admin-card-grid"><div className="operation-form"><h2>Locatieboom · {buildings.find((item) => item.id === structureBuildingId)?.name ?? buildingName}</h2><BuildingPicker id="structure-building" buildings={buildings} value={structureBuildingId} onChange={setStructureBuildingId} /><div className="form-grid-2"><label className="form-field"><span>Type</span><select value={location.type} onChange={(event) => setLocation({ ...location, type: event.target.value })}><option value="zone">Zone</option><option value="floor">Verdieping</option><option value="room">Ruimte</option><option value="element">Element</option><option value="work_package">Werkpakket</option></select></label><label className="form-field"><span>Code</span><input value={location.code} onChange={(event) => setLocation({ ...location, code: event.target.value })} /></label></div><label className="form-field"><span>Naam</span><input value={location.name} onChange={(event) => setLocation({ ...location, name: event.target.value })} /></label><label className="form-field"><span>Bovenliggende locatie</span><select value={location.parentId} onChange={(event) => setLocation({ ...location, parentId: event.target.value })}><option value="">Direct onder {buildings.find((item) => item.id === structureBuildingId)?.name ?? buildingName}</option>{data.locationNodes.filter((node) => node.building_id === structureBuildingId).map((node) => <option value={node.id} key={node.id}>{node.code} · {node.name}</option>)}</select></label><label className="form-field"><span>Toelichting</span><input value={location.description} onChange={(event) => setLocation({ ...location, description: event.target.value })} /></label><button className="primary-button" type="button" disabled={busy || location.code.trim().length < 1 || location.name.trim().length < 2} onClick={() => void run(() => createLocationNode(client, { organizationId, projectId, buildingId: structureBuildingId, parentId: location.parentId, type: location.type, code: location.code, name: location.name, description: location.description }), "Locatie aan de vaste projecthiërarchie toegevoegd.").then((okay) => { if (okay) setLocation({ type: "zone", code: "", name: "", parentId: "", description: "" }); })}><Plus size={15} /> Locatie toevoegen</button><div className="compact-register">{data.locationNodes.filter((node) => node.building_id === structureBuildingId).map((node) => <span key={node.id}><strong>{node.code}</strong> {node.name} · {node.node_type}</span>)}</div></div><div className="operation-form"><h2>Projectpartijen</h2><div className="form-grid-2"><label className="form-field"><span>Type</span><select value={party.type} onChange={(event) => setParty({ ...party, type: event.target.value })}><option value="client">Opdrachtgever</option><option value="supervisor">Supervisor</option><option value="contractor">Aannemer</option><option value="subcontractor">Onderaannemer</option><option value="supplier">Leverancier</option><option value="consultant">Adviseur</option><option value="other">Overig</option></select></label><label className="form-field"><span>Code</span><input value={party.code} onChange={(event) => setParty({ ...party, code: event.target.value })} /></label></div><label className="form-field"><span>Naam</span><input value={party.name} onChange={(event) => setParty({ ...party, name: event.target.value })} /></label><button className="primary-button" type="button" disabled={busy || party.code.trim().length < 1 || party.name.trim().length < 2} onClick={() => void run(() => createProjectParty(client, { organizationId, projectId, code: party.code, name: party.name, type: party.type }), "Projectpartij centraal toegevoegd en beschikbaar voor aanwezigheid en toewijzing.").then((okay) => { if (okay) setParty({ type: "contractor", code: "", name: "" }); })}><Users size={15} /> Partij toevoegen</button><div className="compact-register">{parties.map((item) => <span key={item.id}><strong>{item.name}</strong> {item.type}</span>)}</div></div></div></section> : null}
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
          <details className="custom-checklist-details"><summary>{text("Create a custom project checklist", "Maak een eigen projectchecklist")}</summary><div className="operation-form"><h2>{text("Publish new project checklist", "Nieuwe projectchecklist publiceren")}</h2><div className="form-grid-2"><label className="form-field"><span>{text("Module", "Module")}</span><select value={template.module} onChange={(event) => setTemplate({ ...template, module: event.target.value })}><option value="inspection">{text("Inspection", "Inspectie")}</option><option value="hse">HSE</option><option value="delivery">{text("Delivery", "Levering")}</option><option value="test">{text("Test / measurement", "Test / meting")}</option></select></label><label className="form-field"><span>Code</span><input value={template.code} onChange={(event) => setTemplate({ ...template, code: event.target.value })} placeholder={text("For example CONC-01", "Bijv. BETON-01")} /></label></div><label className="form-field"><span>{text("Name", "Naam")}</span><input value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} /></label><label className="form-field"><span>{text("Checkpoints · one per line", "Controlepunten · één per regel")}</span><textarea rows={6} value={template.prompts} onChange={(event) => setTemplate({ ...template, prompts: event.target.value })} /><DictateButton onText={(transcript) => setTemplate((current) => ({ ...current, prompts: appendDictation(current.prompts, transcript) }))} /></label><button className="primary-button" type="button" disabled={busy} onClick={addTemplate}><Plus size={15} /> {text("Publish checklist", "Checklist publiceren")}</button></div></details>
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
        <label className="form-field readiness-evidence"><span>{text("Evidence reference", "Bewijsreferentie")}{requiresEvidence ? text(" · required", " · verplicht") : ""}</span><textarea rows={2} maxLength={1000} value={evidence} disabled={!editable || busy} onChange={(event) => setEvidence(event.target.value)} placeholder={text("For example ticket CODECO-42 · checked 18-07-2026 by administrator", "Bijv. ticket CODECO-42 · gecontroleerd 18-07-2026 door beheerder")} />{editable && !busy ? <DictateButton onText={(transcript) => setEvidence((current) => appendDictation(current, transcript))} /> : null}</label>
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

function RecordList({ empty, rows }: { empty: string; rows: Array<{ id: string; icon: typeof ClipboardCheck; title: string; meta: string; status: string; tone: string; open?: { label: string; onOpen: () => void } }> }) {
  const { text } = useLanguage();
  if (!rows.length) return <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No records", "Geen registraties")}</strong><span>{empty}</span></div>;
  return <div className="record-stack">{rows.map((row) => {
    const Icon = row.icon;
    return (
      <article className="record-row" key={row.id}>
        <span className="action-icon"><Icon size={18} /></span>
        <div><strong>{row.title}</strong><span>{row.meta}</span></div>
        {row.open ? <button className="secondary-button record-row-open" type="button" onClick={row.open.onOpen}>{row.open.label}</button> : null}
        <span className={`task-status ${row.tone}`}>{row.status}</span>
      </article>
    );
  })}</div>;
}

function HistoryColumn({ title, empty, rows }: { title: string; empty: string; rows: React.ReactNode[] }) {
  return <div className="history-column"><h3>{title}</h3>{rows.length ? <ul>{rows.map((row, index) => <li key={index}>{row}</li>)}</ul> : <p>{empty}</p>}</div>;
}
