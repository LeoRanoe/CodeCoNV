"use client";

import { SectionNav } from "@/app/section-nav";
import { locateCoordinates } from "@/lib/browser/geolocation";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Camera,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  CloudSun,
  Construction,
  Copy,
  DatabaseBackup,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  HardDrive,
  Info,
  HeartPulse,
  KeyRound,
  Leaf,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  Paperclip,
  PersonStanding,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Smartphone,
  UserCheck,
  Users,
  Upload,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { AgreementSignatureFields, agreementRecordDetails, agreementSignatureDetails, agreementSummaryLine, emptyAgreementRecord, emptyAgreementSignature } from "@/app/agreement-signature";
import { ALL_BUILDINGS, BuildingMultiPicker, BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { RecordBuildingsField, RecordFormSection, RecordFormShell, RecordSignatureField } from "@/app/forms/record-form-shell";
import { RecordList } from "@/app/forms/record-list";
import { NamedPhotoSlot, photoTitle, photoUploadDescription, PhotoEvidenceList, toPhotoEvidence, type PhotoEvidence } from "@/app/photo-evidence";
import { RecordLocationMap } from "@/app/record-location-map";
import { StoredPhotoDetail } from "@/app/stored-photo-detail";
import { LocationPicker, locationBreadcrumb } from "@/app/location-picker";
import { ReportDownloadButtons } from "@/app/report-download-buttons";
import { VisualEvidenceWorkspace } from "@/app/visual-evidence-workspace";
import { DailyWorkRegister, type DailyWorkView } from "@/app/daily-work-register";
import type { DayLogFocus, DayLogToday } from "@/app/daily-log-modal";
import { reportDateInSuriname } from "@/lib/supabase/data";
import { DrawingWorkspace } from "@/app/drawing-workspace";
import { FieldTools } from "@/app/field-tools";
import { BackupCenter } from "@/app/backup-center";
import { PromptLibrary } from "@/app/prompt-library";
import { MediaLibraryWorkspace } from "@/app/media-library-workspace";
import { ProjectWorkspaceHome } from "@/app/project-workspace-home";
import { ProjectDocumentsHome } from "@/app/project-documents-home";
import { ProjectActionCenter, type ActionCenterView } from "@/app/project-action-center";
import { RapidVerifyWorkspace } from "@/app/rapid-verify-workspace";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { detailsForEdit } from "@/lib/forms/edit-details.mjs";
import { controlledDocumentSignatures, documentSignatureState } from "@/lib/reports/controlled-document-signatures.mjs";
import { findingStatusLabels as canonicalFindingStatusLabels, labelMap, statusText, typeText, codeText, optionText, severityText, partyTypeText } from "@/lib/status-labels";
import { reportWeather, reportWind } from "@/lib/reports/report-vocabulary";
import { userFacingError } from "@/lib/user-facing-error";
import { anchorChecklistCodes } from "@/lib/checklists/anchor-library";
import { recordAnchorId, useRecordFocus } from "@/lib/navigation/record-focus";
import { buildRecordDirectory } from "@/lib/records/record-directory.mjs";
import { signatureFromDetails } from "@/lib/signatures/handwritten-signature.mjs";
import { isPendingRecordId, listOfflineRecords, saveRecordOnlineOrQueue, syncOfflineRecords } from "@/lib/offline/record-queue";
import { withPendingRecords } from "@/lib/offline/pending-records";
import { downloadBoqCsvTemplate, parseBoqCsv, type BoqImportItem } from "@/lib/boq/csv";
import {
  createControlledDocumentDetails,
  emptyControlledDocumentDraft,
  isControlledDocumentType,
  issueCatalogPresets,
  type ControlledDocumentDraft,
} from "@/lib/forms/controlled-project-documents";
import {
  changeOrderDetails,
  changeOrderFinishDate,
  changeOrderReady,
  changeOrderReasons,
  changeOrderScopeAreas,
  changeOrderTypes,
  emptyChangeOrder, changeOrderFromDetails } from "@/lib/forms/change-order";
import {
  delayActivities,
  delayCategories,
  delayCompletionStarted,
  delayCompletionStatuses,
  delayImpacts,
  delayReportDetails,
  delayReportReady,
  delayRevisedFinishDate,
  delayStatusOnFinishDate,
  delayTypes,
  emptyDelayReport,
} from "@/lib/forms/delay-report";
import { externalShareUrl } from "@/lib/external-share/token.mjs";
import type { ProjectStartAnswers } from "@/lib/forms/daily-report";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { DraftNotice } from "@/app/forms/draft-notice";
import { useFormAutosave } from "@/lib/offline/use-form-autosave";
import { useLanguage } from "@/lib/i18n";
import { cacheProjectSnapshot, getCachedProjectSnapshot } from "@/lib/offline/project-cache";
import { useLiveProjectWeather } from "@/lib/weather-client";
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
  ensureProjectDayReport,
  finishInspection,
  saveInspectionAnswers,
  signInspection,
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
  updateFindingRecord,
  updateHseRecord,
  updateInspectionRecord,
  updateProductionReadiness,
  updateRegisterRecord,
  withdrawWorkspaceRecord,
  type FileRecord,
  type Finding,
  type HseEvent,
  type ChecklistItem,
  type Inspection,
  type OperationSnapshot,
  type ProductionReadinessItem,
  type QualityControlVerification,
  type RegisterEntry,
} from "@/lib/supabase/operations";

type WorkspaceMode = "project" | "actions" | "verify" | "reports" | "admin";
/** What a workspace tile asks the module to open on: its own record, not the last one. */
type WorkspaceTilePreset = { registerType?: string; hseEventType?: string; dailyWorkView?: DailyWorkView | "day" };

/**
 * The two client forms that live in the shell, because they write the day report itself:
 * the day log and the workforce register. The workspace places them as module pages, the
 * same as every other record form; the shell supplies the form and its save.
 */
/** Places a form the shell renders; a component of its own, so the form keeps its state. */
function RenderSlot<Input>({ render, input }: { render: (input: Input) => React.ReactNode; input: Input }) {
  return <>{render(input)}</>;
}

export type DailyFormRenderers = {
  renderDayLog: (input: { focus?: DayLogFocus; today: DayLogToday; close: () => void; openModule: (module: "inspections" | "findings" | "ncr" | "hse") => void; openWorkforce: () => void }) => React.ReactNode;
  renderWorkforce: (input: { close: () => void }) => React.ReactNode;
};

/** The modules that are a record form plus the list of what was recorded before it. */
const recordModuleTabs = ["inspections", "findings", "ncr", "hse", "registers", "daily"];

type ProjectTab = "home" | "inspections" | "findings" | "ncr" | "hse" | "daily" | "workforce" | "documents" | "registers" | "visual" | "drawings" | "tools" | "files" | "assets";

type ViewedWorkspaceRecord = {
  kind: "inspection" | "finding" | "hse" | "register_entry" | "daily_work";
  id: string;
  code: string;
  title: string;
  status: string;
  meta: string;
  description?: string;
};

const findingStatusLabels = labelMap(canonicalFindingStatusLabels, "nl");
const findingStatusLabelsEnglish = labelMap(canonicalFindingStatusLabels, "en");

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

/* The name of a form is the name that stands on the client's own paper, carried through to
   every place the app says it: the workspace tile, the heading of the form and the row in
   the register. Where the client writes an abbreviation on the sheet — PDR, LL, CO, TI, ER
   — it belongs in the name, because that is what the number under it reads. */
const registerLabels: Record<string, string> = {
  equipment: "Materieel",
  delivery: "Materiaallevering",
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
  agreement: "Gemaakte afspraken",
  technical_instruction: "Technische instructie (TI)",
  change_order: "Change order (CO)",
  contract: "Contract",
  specification: "Technische specificatie",
  environmental_report: "Milieurapport (ER)",
  lessons_learned: "Geleerde lessen (LL)",
  delay_report: "Vertragingsrapport (PDR)",
};

/**
 * Controlled documents an external party submits and the company or owner approves.
 * They live under Management, never as a workspace record you create yourself.
 */
const externalSubmissionRegisterTypes = ["wcr", "rfi", "rfa", "inspection_request"];

/** Register items that are judged and counted: material arrives, is checked and measured. */
const registerQuantityTypes = ["delivery", "equipment", "test"];

/**
 * A lesson learned, as on the client's own form: what went wrong, why, what fixed it,
 * what that is expected to achieve, and what follow-up keeps it fixed. No target date —
 * the client struck that field off the form.
 */
const emptyLessonLearned = {
  projectPhase: "",
  issue: "",
  cause: "",
  solution: "",
  expectedResults: "",
  followUpAction: "",
  responsiblePerson: "",
  status: "open" as "open" | "in_progress" | "closed",
};

/**
 * The photos the client's own forms ask for by name, and the name each one carries into
 * the media library, the record and the report. Without it a report shows two pictures of
 * the same wall and cannot say which one is the problem and which one is the repair.
 */
const namedPhotoRoles: Record<string, { en: string; nl: string }> = {
  lesson_issue: { en: "Picture of Issue", nl: "Foto van het probleem" },
  lesson_result: { en: "Picture of Result", nl: "Foto van het resultaat" },
  agreement_evidence: { en: "Photo / Evidence", nl: "Foto / bewijs" },
  agreement_completion: { en: "Photo as evidence of completion", nl: "Foto als bewijs van afronding" },
  change_scope: { en: "Photo of scope / reference", nl: "Foto van scope / referentie" },
  delay_status: { en: "Actual Photo on Original Finish Date", nl: "Foto op de oorspronkelijke einddatum" },
  delay_completion: { en: "Photo as evidence of completion", nl: "Foto als bewijs van afronding" },
};

const namedPhotoLabel = (role: string, language: "en" | "nl") =>
  language === "en" ? namedPhotoRoles[role]?.en ?? role : namedPhotoRoles[role]?.nl ?? role;

const lessonProjectPhases = [
  { id: "design", en: "Design", nl: "Ontwerp" },
  { id: "procurement", en: "Procurement", nl: "Inkoop" },
  { id: "mobilization", en: "Mobilization", nl: "Mobilisatie" },
  { id: "construction", en: "Construction", nl: "Uitvoering" },
  { id: "testing_commissioning", en: "Testing & commissioning", nl: "Testen & inbedrijfstelling" },
  { id: "handover", en: "Handover", nl: "Oplevering" },
  { id: "closeout", en: "Project closeout", nl: "Projectafsluiting" },
] as const;

/**
 * Section 1 of the client's own HSE observation / issue screen: one grid of tiles.
 *
 * The grid the client drew mixes the heading of the form — Safety, Health, Environment —
 * with the kind of event that was seen: near miss, incident, unsafe act, unsafe
 * condition. The record keeps storing both, so a health observation is filed as a health
 * observation instead of as a made-up unsafe condition.
 */
const hseIssueTypes = [
  { id: "safety", en: "Safety", nl: "Safety", icon: ShieldCheck, category: "safety", eventType: "observation" },
  { id: "health", en: "Health", nl: "Health", icon: HeartPulse, category: "health", eventType: "observation" },
  { id: "environment", en: "Environment", nl: "Environment", icon: Leaf, category: "environmental", eventType: "observation" },
  { id: "near_miss", en: "Near miss", nl: "Near miss", icon: AlertTriangle, category: "safety", eventType: "near_miss" },
  { id: "incident", en: "Incident", nl: "Incident", icon: Siren, category: "safety", eventType: "incident" },
  { id: "unsafe_act", en: "Unsafe act", nl: "Onveilige handeling", icon: PersonStanding, category: "safety", eventType: "unsafe_act" },
  { id: "unsafe_condition", en: "Unsafe condition", nl: "Onveilige situatie", icon: Construction, category: "safety", eventType: "unsafe_condition" },
  { id: "other", en: "Other", nl: "Overig", icon: MoreHorizontal, category: "safety", eventType: "other" },
] as const;

/**
 * The client's issue screen and their own non-conformance report fill the same record.
 * The screen decides which of these boxes are asked for; the register keeps them all.
 */
const emptyFindingForm = {
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
  // The boxes the client's own issue screen added: the category, what was already done
  // on the spot, who has to act, the cause and the coordinates of the spot itself.
  issueCategory: "",
  immediateActions: [] as string[],
  immediateActionOther: "",
  responsibleUserId: "",
  responsiblePerson: "",
  rootCause: "",
  latitude: "",
  longitude: "",
  // The boxes of the client's own non-conformance report.
  referenceChecklist: "",
  /** What the non-conformance is, and which work it hit. */
  ncrCategory: "",
  ncrWorkType: "",
  recommendedAction: "" as "" | "rework" | "repair" | "alternative",
  recommendedActionDetail: "",
  remarks: "",
  signedBy: "",
  signedAt: "",
  /** The job the signer holds; every signature box on the client's form asks for it. */
  signedPosition: "",
  /** The signature that was written on this form, not a tick in a box. */
  signatureImage: "",
};

export type FindingForm = typeof emptyFindingForm;

/**
 * Section 1 of the client's own issue screen. The same grid as the HSE screen, with the
 * kinds an issue is filed under here: what it is about decides who picks it up.
 */
const issueTypeTiles = [
  { id: "safety", en: "Safety", nl: "Veiligheid", icon: ShieldCheck },
  { id: "quality", en: "Quality", nl: "Kwaliteit", icon: CheckCircle2 },
  { id: "environmental", en: "Environmental", nl: "Milieu", icon: Leaf },
  { id: "equipment", en: "Equipment", nl: "Materieel", icon: Wrench },
  { id: "materials", en: "Material", nl: "Materiaal", icon: PackageCheck },
  { id: "schedule", en: "Schedule", nl: "Planning", icon: CalendarRange },
  { id: "operational", en: "Operational", nl: "Operationeel", icon: Settings },
  { id: "documentation", en: "Documentation", nl: "Documentatie", icon: FileText },
  { id: "other", en: "Other", nl: "Overig", icon: MoreHorizontal },
] as const;

/**
 * The two lists at the head of the client's own NCR form, in the client's own order and
 * wording. "Category" says what the non-conformance is; "Type" says which work it hit.
 * The third list on that sheet — "Source", where it was identified — was struck through,
 * so it is not here and must not come back: an NCR is answered by what is wrong and where
 * in the works, not by which inspection happened to find it.
 */
const ncrCategories = [
  { id: "workmanship", en: "Workmanship", nl: "Uitvoering" },
  { id: "material_product", en: "Material / product", nl: "Materiaal / product" },
  { id: "equipment_tools", en: "Equipment / tools", nl: "Materieel / gereedschap" },
  { id: "method_procedure", en: "Method / procedure", nl: "Methode / procedure" },
  { id: "measurement_testing", en: "Measurement / testing", nl: "Meting / beproeving" },
  { id: "design_drawing", en: "Design / drawing", nl: "Ontwerp / tekening" },
  { id: "documentation", en: "Documentation", nl: "Documentatie" },
  { id: "inspection_test_failure", en: "Inspection / test failure", nl: "Inspectie / test niet gehaald" },
  { id: "safety", en: "Safety", nl: "Veiligheid" },
  { id: "environmental", en: "Environmental", nl: "Milieu" },
  { id: "site_housekeeping", en: "Site / housekeeping", nl: "Terrein / orde en netheid" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

const ncrWorkTypes = [
  { id: "concrete_work", en: "Concrete work", nl: "Betonwerk" },
  { id: "masonry_block_work", en: "Masonry / block work", nl: "Metsel- / blokwerk" },
  { id: "structural_steel_work", en: "Structural steel work", nl: "Staalconstructie" },
  { id: "formwork_shuttering", en: "Formwork / shuttering", nl: "Bekisting" },
  { id: "reinforcement_work", en: "Reinforcement work", nl: "Wapening" },
  { id: "flooring_tiling_lvt", en: "Flooring / tiling / LVT", nl: "Vloeren / tegelwerk / LVT" },
  { id: "painting_coating", en: "Painting / coating", nl: "Schilderwerk / coating" },
  { id: "mechanical_hvac", en: "Mechanical / HVAC", nl: "Mechanisch / HVAC" },
  { id: "electrical", en: "Electrical", nl: "Elektra" },
  { id: "plumbing_piping", en: "Plumbing / piping", nl: "Loodgieterswerk / leidingwerk" },
  { id: "waterproofing", en: "Waterproofing", nl: "Waterdichting" },
  { id: "finishes_architectural", en: "Finishes / architectural", nl: "Afwerking / bouwkundig" },
  { id: "excavation_earthwork", en: "Excavation / earthwork", nl: "Ontgraving / grondwerk" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

/** Section 2 of the issue screen: what the issue is about, on site and on paper. */
const issueCategories = [
  { id: "ppe", en: "PPE (Personal Protective Equipment)", nl: "PBM (persoonlijke beschermingsmiddelen)" },
  { id: "housekeeping", en: "Housekeeping and access", nl: "Orde, netheid en toegang" },
  { id: "work_at_height", en: "Work at height", nl: "Werken op hoogte" },
  { id: "workmanship", en: "Workmanship and finish", nl: "Uitvoering en afwerking" },
  { id: "dimensions", en: "Dimensions and setting out", nl: "Maatvoering en uitzetten" },
  { id: "electrical", en: "Electrical", nl: "Elektra" },
  { id: "equipment", en: "Equipment and machinery", nl: "Materieel en machines" },
  { id: "materials", en: "Materials and delivery", nl: "Materialen en levering" },
  { id: "hazardous_materials", en: "Hazardous materials", nl: "Gevaarlijke stoffen" },
  { id: "environment", en: "Environment and spills", nl: "Milieu en morsingen" },
  { id: "planning", en: "Planning and sequence", nl: "Planning en volgorde" },
  { id: "documentation", en: "Drawings and documents", nl: "Tekeningen en documenten" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

/** Section 2: what the issue is about, in the words of the client's own form. */
const hseIssueCategories = [
  { id: "ppe", en: "PPE (Personal Protective Equipment)", nl: "PBM (persoonlijke beschermingsmiddelen)" },
  { id: "housekeeping", en: "Housekeeping and access", nl: "Orde, netheid en toegang" },
  { id: "work_at_height", en: "Work at height", nl: "Werken op hoogte" },
  { id: "electrical", en: "Electrical safety", nl: "Elektrische veiligheid" },
  { id: "equipment", en: "Equipment and machinery", nl: "Materieel en machines" },
  { id: "lifting", en: "Lifting and hoisting", nl: "Hijsen en heffen" },
  { id: "excavation", en: "Excavation and confined space", nl: "Ontgraving en besloten ruimte" },
  { id: "hazardous_materials", en: "Hazardous materials", nl: "Gevaarlijke stoffen" },
  { id: "fire", en: "Fire and hot work", nl: "Brand en heet werk" },
  { id: "traffic", en: "Traffic and vehicles", nl: "Verkeer en voertuigen" },
  { id: "environment", en: "Environment and spills", nl: "Milieu en morsingen" },
  { id: "health_hygiene", en: "Health and hygiene", nl: "Gezondheid en hygiëne" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

/** Section 7: what was already done on the spot, ticked instead of typed. */
const immediateActionsTaken = [
  { id: "work_stopped", en: "Work stopped", nl: "Werk stilgelegd" },
  { id: "area_barricaded", en: "Area barricaded", nl: "Zone afgezet" },
  { id: "employee_warned", en: "Employee warned", nl: "Medewerker aangesproken" },
  { id: "supervisor_informed", en: "Supervisor informed", nl: "Supervisor geïnformeerd" },
  { id: "first_aid_provided", en: "First aid provided", nl: "Eerste hulp verleend" },
  { id: "spill_cleaned", en: "Spill cleaned", nl: "Morsing opgeruimd" },
  { id: "equipment_isolated", en: "Equipment isolated", nl: "Materieel geïsoleerd" },
  { id: "ppe_provided", en: "PPE provided", nl: "PBM verstrekt" },
] as const;

/** Section 10: why it happened. Optional, because it is often only known afterwards. */
const recordRootCauses = [
  { id: "unsafe_behaviour", en: "Unsafe behaviour", nl: "Onveilig gedrag" },
  { id: "training", en: "Instruction or training missing", nl: "Instructie of training ontbrak" },
  { id: "supervision", en: "Insufficient supervision", nl: "Onvoldoende toezicht" },
  { id: "procedure_not_followed", en: "Procedure not followed", nl: "Procedure niet gevolgd" },
  { id: "procedure_missing", en: "No procedure or method statement", nl: "Geen procedure of werkplan" },
  { id: "equipment_failure", en: "Equipment defective or unsuitable", nl: "Materieel defect of ongeschikt" },
  { id: "ppe_unavailable", en: "PPE unavailable", nl: "PBM niet beschikbaar" },
  { id: "housekeeping", en: "Poor housekeeping", nl: "Slechte orde en netheid" },
  { id: "planning", en: "Planning or design", nl: "Planning of ontwerp" },
  { id: "weather", en: "Weather or ground conditions", nl: "Weer of bodemgesteldheid" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

/**
 * The client's screens show the number of the record while it is being written. The number
 * itself is handed out centrally when it is submitted — two people can be filling in the
 * same screen — so this is the one that is next in line, marked as provisional.
 */
function nextRecordNumber(existing: string[], prefix: string, year: string) {
  const pattern = new RegExp(`^${prefix}-${year}-([0-9]+)$`);
  const highest = existing.reduce((top, number) => {
    const match = pattern.exec(number.trim());
    return match ? Math.max(top, Number(match[1])) : top;
  }, 0);
  return `${prefix}-${year}-${String(highest + 1).padStart(4, "0")}`;
}

/** "(Today)", "(tomorrow)", "(in 3 days)": what the deadline means without counting. */
function deadlineDistanceLabel(value: string, todayLabel: string, tomorrowLabel: string, inDays: (days: number) => string, overdue: string) {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "";
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86400000);
  if (days < 0) return overdue;
  if (days === 0) return todayLabel;
  if (days === 1) return tomorrowLabel;
  return inDays(days);
}

/**
 * Section 9 of both screens: the deadline the severity implies. The same ladder a finding
 * is given centrally, so the lists cannot disagree about how urgent one severity is.
 */
const recordSeverityDueDays: Record<string, number> = { critical: 1, high: 3, medium: 7, low: 14 };

const emptyHseIssueForm = {
  /** Section 1: the tile that was tapped. */
  issueType: "safety",
  /** Derived from the tile: the heading of the client's form. */
  category: "safety",
  /** Derived from the tile: the kind of event the record is filed as. */
  type: "observation",
  issueCategory: "",
  severity: "medium",
  title: "",
  description: "",
  immediateActions: [] as string[],
  immediateActionOther: "",
  responsibleUserId: "",
  responsiblePerson: "",
  dueAt: "",
  rootCause: "",
  correctiveAction: "",
  notes: "",
  latitude: "",
  longitude: "",
  confidential: false,
};

export type HseIssueForm = typeof emptyHseIssueForm;

/** The deadline the severity implies, in the format the date and time field reads. */
function recordDueDateTimeDefault(severity: string) {
  const due = new Date();
  due.setDate(due.getDate() + (recordSeverityDueDays[severity] ?? 7));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`;
}

/** The same deadline for a register that keeps the day, not the minute. */
function recordDueDateDefault(severity: string) {
  return recordDueDateTimeDefault(severity).slice(0, 10);
}

/**
 * The screen has no title box: the client writes what was observed. The list still needs
 * one line, so it takes the first sentence of that description and falls back to the
 * chosen type when the sentence is too short to say anything.
 */
function recordLogLine(description: string, fallback: string) {
  const [firstSentence] = description.trim().split(/(?<=[.!?])\s+/);
  const line = (firstSentence || description).trim().slice(0, 120).trim();
  return line.length >= 3 ? line : fallback;
}

/**
 * "Save draft" on the client's screens: a record that is interrupted — by a call, by a
 * supervisor, by the phone locking — is not typed a second time. The draft stays on the
 * device, per screen and per project, until it is submitted or thrown away.
 */
type RecordDraftKind = "hse" | "issue";

const recordDraftKey = (kind: RecordDraftKind, projectId: string) => `codeco:${kind}-draft:${projectId}`;

/** The screens themselves are the only things that park or throw away a draft. */
const recordDraftListeners = new Set<() => void>();

function subscribeRecordDraft(listener: () => void) {
  recordDraftListeners.add(listener);
  return () => { recordDraftListeners.delete(listener); };
}

function storedRecordDraft(kind: RecordDraftKind, projectId: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(recordDraftKey(kind, projectId));
  } catch {
    // Private browsing blocks the store; the record itself is filled in as usual.
    return null;
  }
}

/** The draft is only a head start: unknown or missing boxes fall back to an empty form. */
function parseRecordDraft<Form extends { immediateActions: string[] }>(stored: string | null, empty: Form): Form | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<Form>;
    return { ...empty, ...parsed, immediateActions: Array.isArray(parsed.immediateActions) ? parsed.immediateActions : [] };
  } catch {
    return null;
  }
}

function writeRecordDraft(kind: RecordDraftKind, projectId: string, form: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(recordDraftKey(kind, projectId), JSON.stringify(form));
  } catch {
    // A device with no room for a draft still has to be able to submit the record itself.
  }
  recordDraftListeners.forEach((listener) => listener());
}

function clearRecordDraft(kind: RecordDraftKind, projectId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(recordDraftKey(kind, projectId));
  } catch {
    // Nothing to do: the draft is a convenience, never the record.
  }
  recordDraftListeners.forEach((listener) => listener());
}

const registerLabelsEnglish: Record<string, string> = {
  equipment: "Equipment", delivery: "Materials delivery", test: "Test / measurement", variation: "Variation",
  delay: "Delay", communication: "Communication / decision", risk: "Risk", document: "Document",
  drawing: "Drawing", wcr: "WCR - Work Completion Request", rfi: "RFI", submittal: "Submittal", site_instruction: "Site instruction",
  meeting: "Meeting", correspondence: "Correspondence", cost: "Cost control", declaration: "Contractor payment claim",
  rfa: "RFA - Request for Approval", inspection_request: "WIR - Work Inspection Request", boq: "BOQ / progress",
  punch_list: "Punch list", notepad: "Notepad", agreement: "Agreements Made", technical_instruction: "Technical instruction (TI)",
  change_order: "Change order (CO)", contract: "Contract", specification: "Technical specification",
  environmental_report: "Environmental report (ER)", lessons_learned: "Lessons Learned (LL)",
  delay_report: "Project Delay Report (PDR)",
};

/** A calendar day (YYYY-MM-DD) as a date on site; noon in Suriname so it never shifts a day. */
function formatDay(day: string | null | undefined, locale = "en-GB") {
  if (!day) return "";
  const moment = new Date(`${day.slice(0, 10)}T12:00:00-03:00`);
  if (Number.isNaN(moment.getTime())) return day;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(moment);
}

/** A month key (YYYY-MM) written out, e.g. "oktober 2026". */
function formatMonth(month: string, locale = "en-GB") {
  const moment = new Date(`${month.slice(0, 7)}-15T12:00:00-03:00`);
  if (Number.isNaN(moment.getTime())) return month;
  const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "America/Paramaribo" }).format(moment);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(value: string | null, locale = "en-GB") {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Paramaribo",
  }).format(new Date(value));
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

/** The seeded checklists carry one generic instruction on every point; it says nothing the buttons do not. */
const genericChecklistGuidance = /^Choose (Yes, No or N\/A|Pass, Fail or N\/A)\./i;

function checklistGuidance(item: ChecklistItem) {
  if (item.guidance?.startsWith("AUTO_WEATHER|")) return item.guidance.split("|").slice(1).join("|");
  return item.guidance && genericChecklistGuidance.test(item.guidance.trim()) ? "" : item.guidance;
}

/** Only a planned or running inspection takes answers; a completed one is read, not re-answered. */
function inspectionOpen(inspection: Pick<Inspection, "status">) {
  return inspection.status === "planned" || inspection.status === "in_progress";
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
  projectLocation = "",
  buildingId,
  buildingName,
  buildings,
  reportId,
  reportNumber,
  reportStatus,
  projectStartAnswers,
  currentUserName,
  currentUserId,
  companyEmployees,
  parties,
  canManageOrganization,
  openUserAdmin,
  initialProjectTab = "home",
  initialRecordPreset,
  onRecordPresetConsumed,
  onProjectTabChange,
  externalSubmissionIntent = false,
  actionCenterView = "work",
  initialCameraFiles = [],
  onInitialCameraFilesConsumed,
  pendingRecordPin = null,
  onPlaceRecordPin,
  dailyForms,
  openProjectArea,
  openActionCenter,
  openRapidVerify,
  openManagement,
  openReportCheck,
  projectActions = [],
  openProjectAction,
  createProjectAction,
  focusRecordId = "",
}: {
  mode: WorkspaceMode;
  client: SupabaseClient;
  organizationId: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  /** Where the project stands on earth, so the HSE screen can read the live weather. */
  projectLocation?: string;
  buildingId: string;
  buildingName: string;
  buildings: BuildingOption[];
  reportId: string | null;
  reportNumber: string;
  reportStatus: string;
  projectStartAnswers: ProjectStartAnswers | null;
  currentUserName: string;
  /** Who is looking, so the action centre can show the work that is theirs. */
  currentUserId: string;
  companyEmployees: InternalMember[];
  parties: ProjectParty[];
  canManageOrganization: boolean;
  openUserAdmin: () => void;
  initialProjectTab?: ProjectTab;
  /** Which record a shortcut elsewhere promised; the module opens on it, once. */
  initialRecordPreset?: WorkspaceTilePreset;
  onRecordPresetConsumed?: () => void;
  /** The app shell keeps the open module, so it can be reached with the back button. */
  onProjectTabChange: (tab: ProjectTab) => void;
  /** Set when Management sends the user here to record a contractor submission. */
  externalSubmissionIntent?: boolean;
  /** Which view of the action centre to open: my work, all project work or the deadlines. */
  actionCenterView?: ActionCenterView;
  initialCameraFiles?: File[];
  onInitialCameraFilesConsumed?: () => void;
  /** The field record that is still open on the record screen, waiting for its spot. */
  pendingRecordPin?: { label: string; title: string; point: { xRatio: number; yRatio: number; drawingId: string; pageNumber: number } | null } | null;
  onPlaceRecordPin?: (point: { drawingId: string; pageNumber: number; xRatio: number; yRatio: number }) => void;
  dailyForms: DailyFormRenderers;
  /** The optional record id opens that record itself, instead of the list it stands in. */
  openProjectArea: (tab: "inspections" | "findings" | "ncr" | "hse" | "daily" | "documents" | "registers" | "visual" | "drawings" | "files" | "assets" | "submissions", recordId?: string) => void;
  openActionCenter: (view?: ActionCenterView) => void;
  openRapidVerify: () => void;
  openManagement: () => void;
  /** Opens the day report check, where the supervisor marks it ready for review. */
  openReportCheck?: () => void;
  projectActions?: Array<{ id: string; title: string; action_number: string; status: string; priority: string; due_at: string | null; owner_user_id?: string | null }>;
  openProjectAction?: (actionId: string) => void;
  createProjectAction?: () => void;
  /** The record the action centre sent the user to; it opens expanded and scrolled to. */
  focusRecordId?: string;
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
  // `busy` only reaches a button after the next render. Two taps that land before it does (a
  // double-tap on a slow phone, a held Enter key) would both start the save and, as every
  // save has its own key, both create a record. The ref closes that window at once.
  const saveInFlight = useRef(false);
  /**
   * The registrations that are on this device and still have to be sent. They are read
   * alongside the project snapshot and shown in the same lists, marked as waiting: a
   * record that vanishes after saving reads as data loss.
   */
  const pendingRecordsQuery = useQuery({
    queryKey: ["offline-records", projectId],
    queryFn: () => listOfflineRecords(projectId),
    networkMode: "always",
    refetchInterval: 20_000,
  });
  const pendingRecords = useMemo(() => pendingRecordsQuery.data ?? [], [pendingRecordsQuery.data]);
  /** The name behind an assignment, stable so the action centre does not rebuild its list. */
  const resolveMemberName = useCallback((userId: string | null) => {
    const employee = companyEmployees.find((member) => member.userId === userId);
    return employee?.displayName?.trim() || employee?.email || "";
  }, [companyEmployees]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-operations", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["project-day", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["workspace"] }),
      queryClient.invalidateQueries({ queryKey: ["offline-records", projectId] }),
    ]);
  };

  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (saveInFlight.current) return false;
    saveInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const queuedBefore = (await listOfflineRecords(projectId).catch(() => [])).length;
    try {
      await operation();
      // A successful save means there is a connection, so anything that had to wait
      // earlier goes now instead of on the next reconnect.
      if (typeof navigator === "undefined" || navigator.onLine) await syncOfflineRecords(client, projectId).catch(() => undefined);
      await requestProjectNotificationDispatch(client, projectId).catch(() => false);
      // A registration that had to wait says so, instead of claiming it is central.
      const waiting = await listOfflineRecords(projectId).catch(() => []);
      setNotice(waiting.length > queuedBefore
        ? text("Saved on this device. Sent when you're online.", "Opgeslagen op dit apparaat. Wordt verstuurd zodra je online bent.")
        : success);
      await refresh();
      return true;
    } catch (caught) {
      // Offline the real cause is always the same one, and the generic database message
      // reads like data loss. Photos are the exception: they queue on the device.
      setError(typeof navigator !== "undefined" && !navigator.onLine
        ? text("No connection. Not saved yet; your input stays in this form. Photos stay on this device.", "Geen verbinding. Nog niet opgeslagen; je invoer blijft in dit formulier. Foto's blijven op dit apparaat.")
        : userFacingError(caught, text));
      return false;
    } finally {
      saveInFlight.current = false;
      setBusy(false);
    }
  };

  if (query.isLoading) {
    return <div className="operation-loading"><Loader2 className="spin" size={22} /> {text("Loading project records…", "Projectregisters laden…")}</div>;
  }
  if (query.error || !query.data) {
    return <div className="operation-alert error"><AlertTriangle size={18} /> {userFacingError(query.error, text)}</div>;
  }

  // Everything below reads one snapshot, so the registrations waiting on the device are
  // merged in once, here, instead of in every list that shows them.
  const snapshot = withPendingRecords(query.data, pendingRecords);

  return (
    <>
      {snapshot._offlineCached ? <div className="operation-alert warning"><HardDrive size={17} /><div><strong>{text("Offline project copy", "Offline projectkopie")}</strong><span>{text("Offline. Last synced data is available; formal changes wait for a connection.", "Offline. Laatst gesynchroniseerde gegevens zijn beschikbaar; formele wijzigingen wachten op verbinding.")} {snapshot._offlineSavedAt ? `${text("Saved", "Opgeslagen")} ${formatDate(snapshot._offlineSavedAt)}.` : ""}</span></div></div> : null}
      {error ? <div className="operation-alert error"><AlertTriangle size={17} /> {error}</div> : null}
      {notice ? <div className="operation-alert success"><CheckCircle2 size={17} /> {notice}</div> : null}
      {mode === "project" ? (
        <ProjectOperations
          key={`${projectId}:${externalSubmissionIntent}`}
          data={snapshot}
          organizationId={organizationId}
          reportId={reportId}
          projectId={projectId}
          projectName={projectName}
          projectCode={projectCode}
          projectLocation={projectLocation}
          buildingId={buildingId}
          buildingName={buildingName}
          buildings={buildings}
          projectStartAnswers={projectStartAnswers}
          currentUserName={currentUserName}
          currentUserId={currentUserId}
          companyEmployees={companyEmployees}
          parties={parties}
          client={client}
          busy={busy}
          run={run}
          initialTab={initialProjectTab}
          initialRecordPreset={initialRecordPreset}
          onRecordPresetConsumed={onRecordPresetConsumed}
          onTabChange={onProjectTabChange}
          externalSubmissionIntent={externalSubmissionIntent}
          initialCameraFiles={initialCameraFiles}
          onInitialCameraFilesConsumed={onInitialCameraFilesConsumed}
          pendingRecordPin={pendingRecordPin}
          onPlaceRecordPin={onPlaceRecordPin}
          dailyForms={dailyForms}
          openProjectArea={openProjectArea}
          openActionCenter={openActionCenter}
          openRapidVerify={openRapidVerify}
          openManagement={openManagement}
          focusRecordId={focusRecordId}
        />
      ) : null}
      {mode === "actions" ? (
        <ProjectActionCenter
          data={snapshot}
          actions={projectActions}
          projectName={projectName}
          initialView={actionCenterView}
          currentUserId={currentUserId}
          parties={parties}
          resolveUserName={resolveMemberName}
          openAction={(actionId) => openProjectAction?.(actionId)}
          createAction={() => createProjectAction?.()}
          openProjectArea={(tab, recordId) => openProjectArea(tab, recordId)}
        />
      ) : null}
      {mode === "verify" ? <RapidVerifyWorkspace key={projectId} projectName={projectName} projectFiles={snapshot.files} client={client} /> : null}
      {mode === "reports" ? (
        <ReportOperations
          data={snapshot}
          reportId={reportId}
          reportNumber={reportNumber}
          reportStatus={reportStatus}
          currentUserName={currentUserName}
          projectId={projectId}
          projectName={projectName}
          busy={busy}
          run={run}
          client={client}
          openModule={openProjectArea}
          openDeadlines={() => openActionCenter("deadlines")}
          openReportCheck={openReportCheck}
        />
      ) : null}
      {mode === "admin" ? (
        <AdminOperations
          data={snapshot}
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
  projectLocation,
  buildingId,
  buildingName,
  buildings,
  projectStartAnswers,
  currentUserName,
  currentUserId,
  companyEmployees,
  parties,
  client,
  busy,
  run,
  initialTab,
  initialRecordPreset,
  onRecordPresetConsumed,
  onTabChange,
  initialCameraFiles,
  onInitialCameraFilesConsumed,
  pendingRecordPin = null,
  onPlaceRecordPin,
  dailyForms,
  openProjectArea,
  openActionCenter,
  openRapidVerify,
  openManagement,
  externalSubmissionIntent = false,
  focusRecordId = "",
}: {
  data: OperationSnapshot;
  organizationId: string;
  reportId: string | null;
  projectId: string;
  projectName: string;
  projectCode: string;
  /** Where the project stands on earth, so the HSE screen can read the live weather. */
  projectLocation: string;
  buildingId: string;
  buildingName: string;
  buildings: BuildingOption[];
  projectStartAnswers: ProjectStartAnswers | null;
  currentUserName: string;
  /** Who is filling the screen in, so the HSE header can say their department. */
  currentUserId: string;
  companyEmployees: InternalMember[];
  parties: ProjectParty[];
  client: SupabaseClient;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  initialTab: ProjectTab;
  initialRecordPreset?: WorkspaceTilePreset;
  onRecordPresetConsumed?: () => void;
  /** Reports the chosen module upwards, so it becomes a history entry. */
  onTabChange: (tab: ProjectTab) => void;
  initialCameraFiles: File[];
  onInitialCameraFilesConsumed?: () => void;
  /** The field record that is still open on the record screen, waiting for its spot. */
  pendingRecordPin?: { label: string; title: string; point: { xRatio: number; yRatio: number; drawingId: string; pageNumber: number } | null } | null;
  onPlaceRecordPin?: (point: { drawingId: string; pageNumber: number; xRatio: number; yRatio: number }) => void;
  dailyForms: DailyFormRenderers;
  /** Opens a module on one record: how the workspace search reaches what it found. */
  openProjectArea: (tab: "inspections" | "findings" | "ncr" | "hse" | "documents" | "registers" | "visual" | "drawings" | "files" | "assets" | "submissions", recordId?: string) => void;
  openActionCenter: (view?: ActionCenterView) => void;
  openRapidVerify: () => void;
  openManagement: () => void;
  externalSubmissionIntent?: boolean;
  /** A record the action centre asked for; it opens expanded instead of only its module. */
  focusRecordId?: string;
}) {
  const { language, locale, text } = useLanguage();
  // The weather at the moment the issue is written: the head of the client's HSE screen
  // carries it, and site work is weather driven.
  const { weather: liveWeather } = useLiveProjectWeather(projectLocation);
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
  // Shown to people in the app's one date convention; issueDate stays ISO for numbering.
  const issueDateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date());
  const issueTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(new Date());
  // The open module is owned by the app shell: it is a screen of its own, so it belongs
  // in the browser history instead of in a state nobody can navigate back to.
  const tab = initialTab;
  const internalTabChange = useRef(false);
  const setTab = (next: ProjectTab) => {
    internalTabChange.current = true;
    onTabChange(next);
  };
  // Issues and NCRs are separate modules: the client's issue screen is for issues only.
  const findingScope: "issue" | "ncr" = tab === "ncr" ? "ncr" : "issue";
  const [visualFindingId, setVisualFindingId] = useState("");
  /** The photo the library sent here to have a problem marked on it. */
  const [visualFileId, setVisualFileId] = useState("");
  /** Set when the photo library asked for the 360° upload form instead of a normal photo. */
  const [visual360Intent, setVisual360Intent] = useState(false);
  const [drawingFindingId, setDrawingFindingId] = useState("");
  /** The checklist that was sent to the drawings screen to have its location pinned. */
  const [drawingInspectionId, setDrawingInspectionId] = useState("");
  const [dailyWorkView, setDailyWorkView] = useState<DailyWorkView>("works_ongoing");
  /** The block of the day log the tile asked for; none when the whole day was asked for. */
  const [dayLogFocus, setDayLogFocus] = useState<DayLogFocus | undefined>(undefined);
  const openDailyWork = (view: DailyWorkView | "day") => {
    setDailyWorkView(view === "day" ? "works_ongoing" : view);
    setDayLogFocus(view === "day" ? undefined : view === "delays" ? "delay" : view);
  };
  const permissions = useProjectPermissions();
  const [wantsForm, setShowForm] = useState(initialTab !== "home");
  // What a user may write depends on the module. A reader (the client) gets the list and the
  // records, not a form that could only be refused when it is sent.
  const mayCreateHere = tab === "inspections" ? permissions.can("inspections.manage")
    : tab === "findings" || tab === "ncr" ? permissions.can("findings.create")
      : tab === "hse" ? permissions.can("hse.manage")
        : tab === "registers" ? permissions.can("records.create")
          : tab === "daily" ? permissions.canAny("reports.create", "reports.edit")
            : true;
  const showForm = wantsForm && mayCreateHere;
  const [viewedRecord, setViewedRecord] = useState<ViewedWorkspaceRecord | null>(null);
  const [editingFindingId, setEditingFindingId] = useState("");
  const [editingHseId, setEditingHseId] = useState("");
  const [editingRegisterId, setEditingRegisterId] = useState("");
  const [activeInspection, setActiveInspection] = useState<Inspection | null>(null);
  const [inspectionResumeError, setInspectionResumeError] = useState("");
  const [inspectionTitle, setInspectionTitle] = useState("");
  const [inspectionTemplateId, setInspectionTemplateId] = useState("");
  const [inspectionAnswers, setInspectionAnswers] = useState<Record<string, InspectionAnswer>>({});
  const [inspectionPhotos, setInspectionPhotos] = useState<PhotoEvidence[]>([]);
  const [inspectionPhotoError, setInspectionPhotoError] = useState("");
  /** The signature under the completed checklist. */
  const [inspectionSignature, setInspectionSignature] = useState<HandwrittenSignature | null>(null);
  const [findingForm, setFindingForm] = useState<FindingForm>({ ...emptyFindingForm });
  const [findingPhotos, setFindingPhotos] = useState<PhotoEvidence[]>([]);
  const [findingPhotoError, setFindingPhotoError] = useState("");
  /** The record that was just submitted, so the link to the contractor is one tap away. */
  const [submittedFinding, setSubmittedFinding] = useState<Finding | null>(null);
  /**
   * The twelve numbered boxes of the client's own HSE observation / issue screen. The
   * heading (health, safety, environmental) and the kind of event are derived from the
   * chosen tile, so the record keeps saying both without asking twice.
   */
  const [hseForm, setHseForm] = useState({ ...emptyHseIssueForm });
  const [hsePhotos, setHsePhotos] = useState<PhotoEvidence[]>([]);
  const [hseSignature, setHseSignature] = useState<HandwrittenSignature | null>(null);
  // One short text per evidence photo, in the same order as the photos themselves.
  const [hsePhotoError, setHsePhotoError] = useState("");
  /** Set while the phone is asked for the spot the issue was seen at. */
  const [issueLocating, setIssueLocating] = useState(false);
  const [issueLocationError, setIssueLocationError] = useState("");
  /** The coordinates are typed by hand when the phone cannot see the sky. */
  const [issueManualPosition, setIssueManualPosition] = useState(false);
  /** Set while the phone is asked for the spot the HSE event was seen at. */
  const [hseLocating, setHseLocating] = useState(false);
  const [hseLocationError, setHseLocationError] = useState("");
  /** The coordinates are typed by hand when the phone cannot see the sky. */
  const [hseManualPosition, setHseManualPosition] = useState(false);
  const gpsRequests = useRef<{ issue: AbortController | null; hse: AbortController | null }>({ issue: null, hse: null });
  useEffect(() => () => {
    gpsRequests.current.issue?.abort();
    gpsRequests.current.hse?.abort();
  }, [showForm, tab, projectId]);
  const discardRegisterDraft = () => {
    registerAutosave.clear();
    setRegisterForm({ ...emptyControlledDocumentDraft, type: registerForm.type });
    setAgreementForm({ ...emptyAgreementSignature });
    setAgreementRecord({ ...emptyAgreementRecord });
    setChangeOrder({ ...emptyChangeOrder });
    setDelayForm({ ...emptyDelayReport });
    setLessonForm({ ...emptyLessonLearned });
    setRegisterFiles([]);
    setRegisterSignature(null);
    setRegisterOutcome("");
    setRegisterLines([{ quantity: "", unit: "", description: "" }]);
    setRegisterPhotos([]);
    setRegisterNamedPhotos({});
    setRegisterDrawingId("");
    setRegisterLocationNodeId("");
  };
  /**
   * A parked draft is offered, never pushed back in silently: the person who reopens the
   * screen decides whether the old words are still the ones they want to send.
   */
  const hseParkedDraft = parseRecordDraft(useSyncExternalStore(
    subscribeRecordDraft,
    useCallback(() => storedRecordDraft("hse", projectId), [projectId]),
    () => null,
  ), emptyHseIssueForm);
  /** The parked issue screen, offered back the same way the HSE screen offers its own. */
  const issueParkedDraft = parseRecordDraft(useSyncExternalStore(
    subscribeRecordDraft,
    useCallback(() => storedRecordDraft("issue", projectId), [projectId]),
    () => null,
  ), emptyFindingForm);
  // Management's "Record external submission" opens the form it names. It used to open the
  // default register (materials delivery) with the document type hidden behind "Record
  // something else". The component is remounted when the intent changes, so the initial
  // state is enough.
  const [registerForm, setRegisterForm] = useState<ControlledDocumentDraft>({
    ...emptyControlledDocumentDraft,
    ...(externalSubmissionIntent ? { type: "rfi" } : {}),
  });
  const [registerSignature, setRegisterSignature] = useState<HandwrittenSignature | null>(null);
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
  /**
   * The buildings this issue or NCR covers. "All buildings" is selecting every one of
   * them, so the choice the client asked to keep is still here — it is simply no longer
   * the only way to name more than one.
   */
  const [findingBuildingIds, setFindingBuildingIds] = useState<string[]>(() => [resolveDefaultBuildingId(buildings, buildingId)].filter(Boolean));
  const chooseFindingBuildings = (next: string[]) => {
    setFindingBuildingIds(next);
    setFindingBuildingId(next[0] ?? findingBuildingId);
    setFindingLocationNodeId("");
  };
  const findingCoversEveryBuilding = buildings.length > 0 && findingBuildingIds.length === buildings.length;
  const findingBuildingsLabel = findingCoversEveryBuilding
    ? text("All buildings", "Alle gebouwen")
    : findingBuildingIds.map((id) => buildings.find((building) => building.id === id)?.name).filter(Boolean).join(" · ") || buildingName;
  const [hseBuildingId, setHseBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [registerBuildingId, setRegisterBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [inspectionBuildingIds, setInspectionBuildingIds] = useState(() => [resolveDefaultBuildingId(buildings, buildingId)].filter(Boolean));
  const [hseBuildingIds, setHseBuildingIds] = useState(() => [resolveDefaultBuildingId(buildings, buildingId)].filter(Boolean));
  const [registerBuildingIds, setRegisterBuildingIds] = useState(() => [resolveDefaultBuildingId(buildings, buildingId)].filter(Boolean));
  const [boqBuildingId, setBoqBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [inspectionFilterBuildingId, setInspectionFilterBuildingId] = useState("");
  const [inspectionFilterLocationNodeId, setInspectionFilterLocationNodeId] = useState("");
  const [inspectionFilterDate, setInspectionFilterDate] = useState("");
  const [registerDrawingId, setRegisterDrawingId] = useState("");
  const [registerOutcome, setRegisterOutcome] = useState("");
  /**
   * A delivery is rarely one line: "ik moet meer kunnen invoeren onder elkaar", with
   * "wel optie voor omschrijving extra". So the quantity is a list, each line with its own
   * unit and its own words, and the register keeps every line.
   */
  const [registerLines, setRegisterLines] = useState<Array<{ quantity: string; unit: string; description: string }>>([{ quantity: "", unit: "", description: "" }]);
  const [registerPhotos, setRegisterPhotos] = useState<PhotoEvidence[]>([]);
  const [registerPhotoError, setRegisterPhotoError] = useState("");
  /**
   * The photos the client's own forms ask for by name and by position — the picture of the
   * issue and the picture of the result, the evidence a completed agreement is completed.
   * They are kept apart from the general pile because a pile cannot say which picture is
   * the before and which is the after; the slot they were taken in says it.
   */
  const [registerNamedPhotos, setRegisterNamedPhotos] = useState<Record<string, PhotoEvidence | null>>({});
  const setNamedPhoto = (role: string, photo: PhotoEvidence | null) =>
    setRegisterNamedPhotos((current) => ({ ...current, [role]: photo }));
  // A module reached from outside — the bottom bar, a deadline row, the back button —
  // opens the same way as one chosen in the switcher.
  useEffect(() => {
    if (internalTabChange.current) {
      internalTabChange.current = false;
      return;
    }
    setSubmittedFinding(null);
    setShowForm(tab !== "home");
    setActiveInspection(null);
  }, [tab]);
  /** An agreement is text plus the two parties who made it, and who signs for them. */
  const [agreementForm, setAgreementForm] = useState({ ...emptyAgreementSignature });
  /** And the rest of the client's own form: the owner, the urgency and the completion. */
  const [agreementRecord, setAgreementRecord] = useState({ ...emptyAgreementRecord });
  /** A change order is a contract change: scope, schedule, acknowledgement and approval. */
  const [changeOrder, setChangeOrder] = useState({ ...emptyChangeOrder });
  /** A project delay report: what slipped, by how many days, and the pictures that show it. */
  const [delayForm, setDelayForm] = useState({ ...emptyDelayReport });
  /** A lesson learned: the issue, its cause, the fix, the expected result and the
   * follow-up — captured once, so the same mistake is not repeated on the next building. */
  const [lessonForm, setLessonForm] = useState({ ...emptyLessonLearned });
  /*
   * Autosave. Every form of this workspace keeps what was typed on the device, per project, and
   * puts it back when the person returns from another tab, a reload or a call. Opening a form
   * and leaving it writes nothing; sending the record or choosing "Start over" removes it.
   */
  const openForNew = showForm && !activeInspection;
  const findingAutosave = useFormAutosave({
    id: `form:${findingScope}:${projectId}`,
    enabled: openForNew && (tab === "findings" || tab === "ncr") && !editingFindingId,
    value: { findingForm, findingPhotos, findingBuildingId, findingBuildingIds, findingLocationNodeId },
    restore: (draft) => {
      setFindingForm((current) => ({ ...current, ...draft.findingForm }));
      setFindingPhotos(Array.isArray(draft.findingPhotos) ? draft.findingPhotos : []);
      if (draft.findingBuildingId) setFindingBuildingId(draft.findingBuildingId);
      if (draft.findingBuildingIds?.length) setFindingBuildingIds(draft.findingBuildingIds);
      setFindingLocationNodeId(draft.findingLocationNodeId ?? "");
    },
  });
  const hseAutosave = useFormAutosave({
    id: `form:hse:${projectId}`,
    enabled: openForNew && tab === "hse" && !editingHseId,
    value: { hseForm, hsePhotos, hseSignature, hseBuildingId, hseBuildingIds, hseLocationNodeId },
    restore: (draft) => {
      setHseForm((current) => ({ ...current, ...draft.hseForm }));
      setHsePhotos(Array.isArray(draft.hsePhotos) ? draft.hsePhotos : []);
      setHseSignature(draft.hseSignature ?? null);
      if (draft.hseBuildingId) setHseBuildingId(draft.hseBuildingId);
      if (draft.hseBuildingIds?.length) setHseBuildingIds(draft.hseBuildingIds);
      setHseLocationNodeId(draft.hseLocationNodeId ?? "");
    },
  });
  const registerAutosave = useFormAutosave({
    id: `form:register:${projectId}`,
    enabled: openForNew && tab === "registers" && !editingRegisterId,
    value: {
      registerForm, registerSignature, registerFiles, registerLines, registerPhotos, registerNamedPhotos, registerOutcome,
      registerDrawingId, registerLocationNodeId, registerBuildingId, registerBuildingIds,
      agreementForm, agreementRecord, changeOrder, delayForm, lessonForm,
    },
    restore: (draft) => {
      setRegisterForm((current) => ({ ...current, ...draft.registerForm }));
      setRegisterSignature(draft.registerSignature ?? null);
      setRegisterFiles(Array.isArray(draft.registerFiles) ? draft.registerFiles : []);
      if (Array.isArray(draft.registerLines) && draft.registerLines.length) setRegisterLines(draft.registerLines);
      setRegisterPhotos(Array.isArray(draft.registerPhotos) ? draft.registerPhotos : []);
      setRegisterNamedPhotos(draft.registerNamedPhotos ?? {});
      setRegisterOutcome(draft.registerOutcome ?? "");
      setRegisterDrawingId(draft.registerDrawingId ?? "");
      setRegisterLocationNodeId(draft.registerLocationNodeId ?? "");
      if (draft.registerBuildingId) setRegisterBuildingId(draft.registerBuildingId);
      if (draft.registerBuildingIds?.length) setRegisterBuildingIds(draft.registerBuildingIds);
      setAgreementForm((current) => ({ ...current, ...draft.agreementForm }));
      setAgreementRecord((current) => ({ ...current, ...draft.agreementRecord }));
      setChangeOrder((current) => ({ ...current, ...draft.changeOrder }));
      setDelayForm((current) => ({ ...current, ...draft.delayForm }));
      setLessonForm((current) => ({ ...current, ...draft.lessonForm }));
    },
  });
  const inspectionAutosave = useFormAutosave({
    id: `form:inspection-start:${projectId}`,
    enabled: showForm && !activeInspection && tab === "inspections",
    value: { inspectionTitle, inspectionTemplateId, inspectionBuildingId, inspectionBuildingIds, inspectionLocationNodeId },
    restore: (draft) => {
      setInspectionTitle(draft.inspectionTitle ?? "");
      setInspectionTemplateId(draft.inspectionTemplateId ?? "");
      if (draft.inspectionBuildingId) setInspectionBuildingId(draft.inspectionBuildingId);
      if (draft.inspectionBuildingIds?.length) setInspectionBuildingIds(draft.inspectionBuildingIds);
      setInspectionLocationNodeId(draft.inspectionLocationNodeId ?? "");
    },
  });
  /**
   * Every numbered record in this project, so the workspace search can find a document
   * back from the unique code that stands on it — on paper, in an e-mail or on a photo.
   */
  const recordDirectory = useMemo(() => buildRecordDirectory({ ...data, buildings }), [buildings, data]);
  // Everything this workspace already knows about the project is offered inside the marking
  // pad, so a marker on a photo can say which building, floor, room and party it belongs to.
  const markupOptions = useMemo(() => ({
    buildings: buildings.map((building) => ({ id: building.id, label: building.name })),
    locations: data.locationNodes.map((node) => ({ id: node.id, label: locationBreadcrumb(data.locationNodes, node.id), buildingId: node.building_id })),
    parties: parties.map((party) => ({ id: party.id, label: party.name })),
  }), [buildings, data.locationNodes, parties]);
  const requiredLocationDepth = data.settings?.required_location_depth ?? "building";
  const exactLocationRequired = requiredLocationDepth !== "building";
  const registerContextLabel = registerBuildingIds.length === buildings.length
    ? text("Whole project · all buildings", "Hele project · alle gebouwen")
    : registerBuildingIds.map((selectedId) => buildings.find((building) => building.id === selectedId)?.name).filter(Boolean).join(" · ") || buildingName;
  // Drawings of the chosen building, so a controlled document can point at the plan it
  // belongs to instead of only naming a floor.
  const registerDrawings = data.files.filter((file) => (
    file.category === "drawing"
    && file.status === "available"
    && (!file.building_id || file.building_id === registerBuildingId)
  ));
  /**
   * The people this project knows by name. Used for the QC signature on a closed NCR:
   * the database records who verified, the app has to be able to name that person.
   */
  const resolveUserName = (userId: string | null) => {
    if (!userId) return "";
    const employee = companyEmployees.find((member) => member.userId === userId);
    return employee?.displayName?.trim() || employee?.email || "";
  };
  const documentIssuerOptions = Array.from(new Set([
    currentUserName,
    ...companyEmployees.map((employee) => employee.displayName?.trim() || employee.email),
  ].filter(Boolean)));
  const recordContextLabel = (recordBuildingId: string | null, locationNodeId?: string | null, recordBuildingIds?: string[]) => {
    const linkedIds = recordBuildingIds?.length ? recordBuildingIds : recordBuildingId ? [recordBuildingId] : [];
    const recordBuilding = linkedIds
      .map((linkedId) => buildings.find((building) => building.id === linkedId)?.name)
      .filter(Boolean)
      .join(" · ") || text("Project-wide", "Projectbreed");
    const exactLocation = locationBreadcrumb(data.locationNodes, locationNodeId);
    return exactLocation ? `${recordBuilding} → ${exactLocation}` : recordBuilding;
  };
  const filteredInspections = data.inspections.filter((inspection) => {
    if (inspectionFilterBuildingId && !(inspection.building_ids?.length ? inspection.building_ids : [inspection.building_id]).includes(inspectionFilterBuildingId)) return false;
    if (inspectionFilterLocationNodeId && inspection.location_node_id !== inspectionFilterLocationNodeId) return false;
    if (inspectionFilterDate) {
      const recordedAt = inspection.completed_at ?? inspection.started_at ?? inspection.planned_at;
      if (!recordedAt || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date(recordedAt)) !== inspectionFilterDate) return false;
    }
    return true;
  });
  /** The days this project actually inspected, newest first, for the lookup. */
  const inspectionDates = Array.from(new Set(data.inspections
    .map((inspection) => inspection.completed_at ?? inspection.started_at ?? inspection.planned_at)
    .filter((stamp): stamp is string => Boolean(stamp))
    .map((stamp) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date(stamp)))))
    .sort((left, right) => right.localeCompare(left));
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date());
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
  const photoCaptureHint = text("Tap a photo to describe, mark or remove it.", "Tik op een foto om te omschrijven, te markeren of te verwijderen.");
  /** The record screens show a strip of pictures, not a list, so the sentence says so. */
  const photoStripHint = text(
    "Tap a photo to describe it, mark it or remove it.",
    "Tik op een foto om die te omschrijven, te markeren of te verwijderen.",
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
  /**
   * The kinds of issue the client registers, written on the issue screen itself:
   * "safety / quality / equipment / materials / schedule / operational".
   */
  const issueTypeOptions = [
    { id: "safety", label: text("Safety", "Veiligheid") },
    { id: "quality", label: text("Quality", "Kwaliteit") },
    { id: "equipment", label: text("Equipment", "Materieel") },
    { id: "materials", label: text("Materials", "Materialen") },
    { id: "schedule", label: text("Schedule", "Planning") },
    { id: "operational", label: text("Operational", "Operationeel") },
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
  /** The three headings of the client's HSE form, as they read in a list. */
  const hseCategoryLabels: Record<string, string> = {
    health: text("Health", "Health"),
    safety: text("Safety", "Safety"),
    environmental: text("Environmental", "Environmental"),
  };
  /**
   * The standard HSE records the client asked to be able to pick: one tap fills the tile,
   * the severity, what was observed and what was already done, and every box stays
   * editable afterwards.
   */
  const hsePresets = [
    { issueType: "safety", severity: "low", label: text("Safe work observed", "Veilig werk waargenomen"), description: text("The work was performed safely and according to the agreed control measures.", "Het werk is veilig en volgens de afgesproken beheersmaatregelen uitgevoerd."), actions: [] as string[] },
    { issueType: "unsafe_condition", severity: "high", label: text("Unsafe work area", "Onveilige werkzone"), description: text("The work area was not sufficiently secured or marked.", "De werkzone was onvoldoende afgezet of gemarkeerd."), actions: ["work_stopped", "area_barricaded"] },
    { issueType: "unsafe_act", severity: "high", label: text("PPE not used correctly", "PBM niet correct gebruikt"), description: text("Required personal protective equipment was not used correctly.", "Verplichte persoonlijke beschermingsmiddelen werden niet correct gebruikt."), actions: ["employee_warned", "ppe_provided"] },
    { issueType: "near_miss", severity: "high", label: "Near miss", description: text("An event occurred without injury but with a realistic risk of harm.", "Er vond een gebeurtenis plaats zonder letsel, maar met reëel risico op schade."), actions: ["work_stopped", "area_barricaded", "supervisor_informed"] },
    { issueType: "incident", severity: "critical", label: text("Work stopped", "Werk stilgelegd"), description: text("Work was stopped because the risk was not adequately controlled.", "Werk is stilgelegd omdat het risico onvoldoende werd beheerst."), actions: ["work_stopped", "supervisor_informed"] },
  ];
  const hseTileLabel = (tile: (typeof hseIssueTypes)[number]) => text(tile.en, tile.nl);
  /** The tile that is selected, with the heading and the event kind it stands for. */
  const hseIssueTile = hseIssueTypes.find((tile) => tile.id === hseForm.issueType) ?? hseIssueTypes[0];
  const hseCategoryOption = hseIssueCategories.find((option) => option.id === hseForm.issueCategory);
  /** Section 9 shows the deadline the severity implies until somebody sets another one. */
  const hseDueValue = hseForm.dueAt || recordDueDateTimeDefault(hseForm.severity);
  const hsePriority = hseForm.severity === "critical" ? "critical" : hseForm.severity === "high" ? "high" : hseForm.severity === "medium" ? "normal" : "low";
  const recordPriorityLabels: Record<string, string> = {
    critical: text("Critical", "Kritiek"), high: text("High", "Hoog"),
    normal: text("Normal", "Normaal"), low: text("Low", "Laag"),
  };
  // High and critical events are opened as action required by the database itself, so the
  // screen says the status the record will actually get.
  const hseStatusLabel = hseForm.severity === "high" || hseForm.severity === "critical"
    ? text("Action required", "Actie vereist")
    : text("Open", "Open");
  /** Section 8 of both screens: the colleagues who can be made responsible, with the role they carry here. */
  const responsiblePeople = companyEmployees.map((member) => {
    const projectRole = member.projectRoles.find((role) => role.projectId === projectId);
    const name = member.displayName?.trim() || member.email;
    return { id: member.userId, name, role: projectRole?.roleName ?? member.organizationRoles[0]?.name ?? "" };
  });
  /** The department in the head of the screen is the role the reporter carries here. */
  const reporterDepartment = (() => {
    const me = companyEmployees.find((member) => member.userId === currentUserId);
    const projectRole = me?.projectRoles.find((role) => role.projectId === projectId);
    return projectRole?.roleName || me?.organizationRoles[0]?.name || text("Field operations", "Uitvoering");
  })();
  const liveWeatherLabel = liveWeather
    ? `${({
      sunny: text("Clear", "Helder"), partly_cloudy: text("Partly cloudy", "Licht bewolkt"),
      cloudy: text("Cloudy", "Bewolkt"), rain: text("Rain", "Regen"), heavy_rain: text("Heavy rain", "Zware regen"),
    } as Record<string, string>)[liveWeather.condition] ?? liveWeather.condition}`
    : text("Not available", "Niet beschikbaar");
  /** Section 1: the tile decides the heading of the form and the kind of event it is. */
  const chooseHseIssueType = (id: string) => {
    const tile = hseIssueTypes.find((option) => option.id === id) ?? hseIssueTypes[0];
    setHseForm((current) => ({ ...current, issueType: tile.id, category: tile.category, type: tile.eventType }));
  };
  const toggleHseAction = (id: string) => setHseForm((current) => ({
    ...current,
    immediateActions: current.immediateActions.includes(id)
      ? current.immediateActions.filter((action) => action !== id)
      : [...current.immediateActions, id],
  }));
  /** Section 7 as one sentence, so every report that already reads the measure keeps working. */
  const hseImmediateMeasure = (form: HseIssueForm) => {
    const taken = immediateActionsTaken.filter((action) => form.immediateActions.includes(action.id)).map((action) => text(action.en, action.nl));
    if (form.immediateActionOther.trim()) taken.push(form.immediateActionOther.trim());
    return taken.join(" · ");
  };
  /** Section 5: the spot itself, as the phone reads it. */
  const captureHsePosition = () => {
    if (gpsRequests.current.hse) return;
    const request = new AbortController();
    gpsRequests.current.hse = request;
    const original = { latitude: hseForm.latitude, longitude: hseForm.longitude };
    setHseLocating(true);
    void locateCoordinates(request.signal).then((coordinates) => {
      if (request.signal.aborted) return;
      setHseForm((current) => current.latitude !== original.latitude || current.longitude !== original.longitude ? current : {
        ...current, latitude: coordinates.latitude.toFixed(6), longitude: coordinates.longitude.toFixed(6),
      });
      setHseLocationError("");
    }).catch(() => {
      if (request.signal.aborted) return;
      setHseLocationError(text("Location could not be read. Enter the coordinates.", "Locatie niet gelezen. Voer de coördinaten in."));
      setHseManualPosition(true);
    }).finally(() => {
      if (gpsRequests.current.hse === request) { gpsRequests.current.hse = null; setHseLocating(false); }
    });
  };
  /**
   * The client's issue screen is the same shape as the HSE one: numbered sections, one
   * grid of tiles and a bar underneath. What differs is what is filed — the kind of
   * issue, and the register it lands in.
   */
  /** The number both screens show while the record is being written. */
  const recordYear = issueDate.slice(0, 4);
  const nextIssueNumber = nextRecordNumber(data.findings.map((finding) => finding.finding_number), "Q", recordYear);
  const nextHseNumber = nextRecordNumber(data.hseEvents.map((event) => event.event_number), "HSE", recordYear);
  const deadlineDistance = (value: string) => deadlineDistanceLabel(
    value,
    text("today", "vandaag"),
    text("tomorrow", "morgen"),
    (days) => text(`in ${days} days`, `over ${days} dagen`),
    text("overdue", "verlopen"),
  );
  /**
   * The chip in the head of the record screens is not only a light: it is the way to push
   * what is still on the device. "Data will sync" has to be something you can also ask for.
   */
  const syncWaitingRecordsNow = () => void run(
    async () => {
      await syncOfflineRecords(client, projectId);
      await syncQueuedEvidenceNow();
    },
    text("Sent to the project.", "Naar het project verzonden."),
  );
  /** The line the client's own screens carry: what the app already filled in by itself. */
  // Before the phone has been asked anything, the map already knows roughly where the
  // project stands: the same place the live weather was resolved for.
  const projectCenter = liveWeather ? { latitude: liveWeather.latitude, longitude: liveWeather.longitude } : null;
  const syncChip = online ? { label: text("Online", "Online"), detail: "" } : { label: text("Offline", "Offline"), detail: "" };
  const issueTile = issueTypeTiles.find((tile) => tile.id === findingForm.issueType) ?? issueTypeTiles[0];
  const issueTileLabel = (tile: (typeof issueTypeTiles)[number]) => text(tile.en, tile.nl);
  const issueCategoryOption = issueCategories.find((option) => option.id === findingForm.issueCategory);
  const ncrCategoryOption = ncrCategories.find((option) => option.id === findingForm.ncrCategory);
  const ncrWorkTypeOption = ncrWorkTypes.find((option) => option.id === findingForm.ncrWorkType);
  const issuePriority = findingForm.severity === "critical" ? "critical" : findingForm.severity === "high" ? "high" : findingForm.severity === "medium" ? "normal" : "low";
  // A record with somebody's name on it opens as assigned; without one it opens as open.
  const issueStatusLabel = findingForm.responsibleUserId || findingForm.responsiblePartyId
    ? text("Assigned", "Toegewezen")
    : text("Open", "Open");
  /** Section 9 shows the deadline the severity implies until somebody sets another one. */
  const issueDueValue = findingForm.expectedResolutionDate || recordDueDateDefault(findingForm.severity);
  const chooseIssueType = (id: string) => setFindingForm((current) => ({ ...current, issueType: id }));
  const toggleIssueAction = (id: string) => setFindingForm((current) => ({
    ...current,
    immediateActions: current.immediateActions.includes(id)
      ? current.immediateActions.filter((action) => action !== id)
      : [...current.immediateActions, id],
  }));
  /** Section 5 of the issue screen: the spot itself, as the phone reads it. */
  const captureIssuePosition = () => {
    if (gpsRequests.current.issue) return;
    const request = new AbortController();
    gpsRequests.current.issue = request;
    const original = { latitude: findingForm.latitude, longitude: findingForm.longitude };
    setIssueLocating(true);
    void locateCoordinates(request.signal).then((coordinates) => {
      if (request.signal.aborted) return;
      setFindingForm((current) => current.latitude !== original.latitude || current.longitude !== original.longitude ? current : {
        ...current, latitude: coordinates.latitude.toFixed(6), longitude: coordinates.longitude.toFixed(6),
      });
      setIssueLocationError("");
    }).catch(() => {
      if (request.signal.aborted) return;
      setIssueLocationError(text("Location could not be read. Enter the coordinates.", "Locatie niet gelezen. Voer de coördinaten in."));
      setIssueManualPosition(true);
    }).finally(() => {
      if (gpsRequests.current.issue === request) { gpsRequests.current.issue = null; setIssueLocating(false); }
    });
  };
  const resetFindingForm = () => {
    setFindingForm({ ...emptyFindingForm, type: findingScope === "ncr" ? "ncr" : "deficiency" });
    setFindingPhotos([]);
    setFindingPhotoError("");
    setFindingLocationNodeId("");
    setIssueLocationError("");
    setIssueManualPosition(false);
    const defaultId = resolveDefaultBuildingId(buildings, buildingId);
    setFindingBuildingId(defaultId);
    setFindingBuildingIds(defaultId ? [defaultId] : []);
    setEditingFindingId("");
  };
  const resetHseForm = () => {
    setHseForm({ ...emptyHseIssueForm });
    setHsePhotos([]);
    setHsePhotoError("");
    setHseLocationError("");
    setHseManualPosition(false);
    setHseLocationNodeId("");
    setHseSignature(null);
    const defaultId = resolveDefaultBuildingId(buildings, buildingId);
    setHseBuildingId(defaultId);
    setHseBuildingIds(defaultId ? [defaultId] : []);
    setEditingHseId("");
  };
  const storedCategoryId = (value: string | null | undefined, options: ReadonlyArray<{ id: string; en: string; nl: string }>) => {
    const normalized = (value ?? "").trim().toLocaleLowerCase();
    return options.find((option) => [option.id, option.en, option.nl].some((candidate) => candidate.toLocaleLowerCase() === normalized))?.id ?? "";
  };
  const viewInspection = (inspection: Inspection) => setViewedRecord({
    kind: "inspection", id: inspection.id, code: inspection.inspection_number, title: inspection.title,
    status: statusText(inspection.status, text),
    meta: `${recordContextLabel(inspection.building_id, inspection.location_node_id, inspection.building_ids)} · ${formatDate(inspection.completed_at ?? inspection.started_at, locale)}`,
  });
  const editFinding = (finding: Finding) => {
    const issue = finding.issue_management ?? {};
    setFindingForm({
      ...emptyFindingForm,
      type: finding.finding_type,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      responsiblePartyId: finding.responsible_party_id ?? "",
      responsibleUserId: finding.assigned_user_id ?? "",
      responsiblePerson: issue.responsible_person ?? "",
      issueType: issue.issue_type ?? "quality",
      issueCategory: storedCategoryId(issue.issue_category, issueCategories),
      immediateActions: issue.immediate_actions ?? [],
      immediateActionOther: issue.immediate_action_other ?? "",
      rootCause: issue.root_cause ?? "",
      latitude: issue.latitude == null ? "" : String(issue.latitude),
      longitude: issue.longitude == null ? "" : String(issue.longitude),
      impactSummary: issue.impact_summary ?? "",
      actionSteps: issue.action_steps ?? "",
      escalationRequired: Boolean(issue.escalation_required),
      disposition: issue.disposition ?? "to_be_corrected",
      expectedResolutionDate: (issue.expected_resolution_date ?? finding.due_at ?? "").slice(0, 10),
      sourceCatalogSubject: issue.source_catalog_subject ?? "",
      dateIdentified: (issue.date_identified ?? finding.created_at).slice(0, 10),
      referenceChecklist: issue.reference_checklist ?? "",
      recommendedAction: issue.recommended_action ?? "",
      recommendedActionDetail: issue.recommended_action_detail ?? "",
      remarks: issue.remarks ?? "",
      signedBy: issue.signed_by ?? "",
      signedAt: issue.signed_at ?? "",
      signatureImage: issue.signature_image ?? "",
    });
    setFindingBuildingId(finding.building_id);
    setFindingBuildingIds(finding.building_ids?.length ? finding.building_ids : [finding.building_id]);
    setFindingLocationNodeId(finding.location_node_id ?? "");
    setFindingPhotos([]);
    setEditingFindingId(finding.id);
    setViewedRecord(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const viewFinding = (finding: Finding) => setViewedRecord({
    kind: "finding", id: finding.id, code: finding.finding_number, title: finding.title,
    status: statusText(finding.status, text), description: finding.description,
    meta: `${recordContextLabel(finding.building_id, finding.location_node_id, finding.building_ids)} · ${formatDate(finding.created_at, locale)}`,
  });
  const editHse = (event: HseEvent) => {
    setHseForm({
      ...emptyHseIssueForm,
      issueType: event.issue_type ?? "safety",
      category: event.hse_category ?? "safety",
      type: event.event_type,
      issueCategory: storedCategoryId(event.issue_category, hseIssueCategories),
      severity: event.severity,
      description: event.description,
      immediateActions: event.immediate_actions ?? [],
      immediateActionOther: event.immediate_action_other ?? "",
      responsibleUserId: event.responsible_user_id ?? "",
      responsiblePerson: event.responsible_person ?? "",
      dueAt: event.due_at?.slice(0, 16) ?? "",
      rootCause: event.root_cause ?? "",
      correctiveAction: event.corrective_action ?? "",
      notes: event.notes ?? "",
      latitude: event.latitude == null ? "" : String(event.latitude),
      longitude: event.longitude == null ? "" : String(event.longitude),
      confidential: event.confidential,
    });
    setHseBuildingId(event.building_id);
    setHseBuildingIds(event.building_ids?.length ? event.building_ids : [event.building_id]);
    setHseLocationNodeId(event.location_node_id ?? "");
    setHseSignature(signatureFromDetails(event.signed_by, event.signed_at, event.signature_image));
    setHsePhotos([]);
    setEditingHseId(event.id);
    setViewedRecord(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const viewHse = (event: HseEvent) => setViewedRecord({
    kind: "hse", id: event.id, code: event.event_number, title: event.title,
    status: statusText(event.status, text), description: event.description,
    meta: `${recordContextLabel(event.building_id, event.location_node_id, event.building_ids)} · ${formatDate(event.occurred_at, locale)}`,
  });
  const editRegister = (entry: RegisterEntry) => {
    const details = entry.details ?? {};
    setRegisterForm({
      ...emptyControlledDocumentDraft,
      type: entry.register_type,
      title: entry.title,
      details: String(details.description ?? ""),
      dueDate: entry.due_at?.slice(0, 10) ?? "",
      revision: String(details.revision ?? "0"),
      requestedTo: String(details.requested_to ?? ""),
      issuerName: String(details.issued_by ?? ""),
      signedBy: entry.signed_by ?? String(details.signed_by ?? ""),
      signedAt: entry.signed_at ?? String(details.signed_at ?? ""),
      signatureImage: entry.signature_image ?? String(details.signature_image ?? ""),
      issuerPosition: String(details.issuer_position ?? emptyControlledDocumentDraft.issuerPosition),
      issuerCompany: String(details.issuer_company ?? emptyControlledDocumentDraft.issuerCompany),
      discipline: String(details.discipline ?? emptyControlledDocumentDraft.discipline),
      priority: String(details.priority ?? emptyControlledDocumentDraft.priority),
      relatedReference: String(details.related_reference ?? ""),
      referenceDocuments: String(details.reference_documents ?? ""),
      attachments: String(details.attachments ?? ""),
      reason: String(details.reason ?? ""),
      requiredAction: String(details.required_action ?? emptyControlledDocumentDraft.requiredAction),
      scheduleImpact: String(details.schedule_impact ?? emptyControlledDocumentDraft.scheduleImpact),
      costImpact: String(details.cost_impact ?? emptyControlledDocumentDraft.costImpact),
      impactExplanation: String(details.impact_explanation ?? ""),
      readyDate: String(details.ready_date ?? ""), readyTime: String(details.ready_time ?? emptyControlledDocumentDraft.readyTime),
      inspectionCategory: String(details.inspection_category ?? emptyControlledDocumentDraft.inspectionCategory),
      periodStart: String(details.period_start ?? ""), periodEnd: String(details.period_end ?? ""),
      lostHours: String(details.lost_hours ?? "0"), lostHoursReason: String(details.lost_hours_reason ?? ""),
      responsiblePartyId: parties.find((party) => party.name === String(details.requested_to ?? ""))?.id ?? "",
    });
    const lessonStatus = String(details.lesson_status ?? "open");
    setLessonForm({
      projectPhase: String(details.project_phase ?? ""),
      issue: String(details.issue ?? details.description ?? ""),
      cause: String(details.cause ?? ""),
      solution: String(details.solution_improvement ?? ""),
      expectedResults: String(details.expected_results ?? ""),
      followUpAction: String(details.follow_up_action ?? ""),
      responsiblePerson: String(details.responsible_person ?? ""),
      status: lessonStatus === "in_progress" || lessonStatus === "closed" ? lessonStatus : "open",
    });
    setRegisterBuildingId(entry.building_id ?? resolveDefaultBuildingId(buildings, buildingId));
    setRegisterBuildingIds(entry.building_ids?.length ? entry.building_ids : entry.building_id ? [entry.building_id] : []);
    setRegisterLocationNodeId(entry.location_node_id ?? "");
    setRegisterSignature(signatureFromDetails(entry.signed_by, entry.signed_at, entry.signature_image));
    if (entry.register_type === "change_order") setChangeOrder(changeOrderFromDetails(details));
    setEditingRegisterId(entry.id);
    setViewedRecord(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const viewRegister = (entry: RegisterEntry) => setViewedRecord({
    kind: "register_entry", id: entry.id, code: entry.entry_number, title: entry.title,
    status: statusText(entry.status, text), description: String(entry.details?.description ?? ""),
    meta: `${recordContextLabel(entry.building_id, entry.location_node_id, entry.building_ids)} · ${formatDate(entry.occurred_at, locale)}`,
  });
  const withdrawRecord = (record: ViewedWorkspaceRecord) => {
    // A day closeout is corrected in the day log, never withdrawn: the day report stands on it.
    const kind = record.kind;
    if (kind === "daily_work") return;
    const reason = window.prompt(text("Why is this record being withdrawn?", "Waarom wordt deze registratie ingetrokken?"), "");
    if (!reason) return;
    void run(() => withdrawWorkspaceRecord(client, kind, record.id, reason), text(`${record.code} withdrawn. History kept.`, `${record.code} ingetrokken. Historie bewaard.`)).then((okay) => {
      if (okay) setViewedRecord(null);
    });
  };
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
  // A saved document keeps its original business timestamp while being edited.
  const editingDocument = data.registerEntries.find((entry) => entry.id === editingRegisterId);
  const documentIssueMoment = editingDocument?.occurred_at && Number.isFinite(Date.parse(editingDocument.occurred_at))
    ? new Date(editingDocument.occurred_at)
    : new Date();
  const documentIssueDateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(documentIssueMoment);
  const documentIssueTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(documentIssueMoment);
  const documentIssueDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(documentIssueMoment);
  /* Every register form is wide. Only a controlled document used to be, so the rest — PDR,
     Lessons Learned, Agreements Made, Materials delivery — fell back to the 720px column
     that .operation-form gives an unmarked form, and on a desktop that left two thirds of
     the window empty. */
  const registerFormClassName = `wide sectioned-record-form${controlledRegister ? " controlled-document-form" : ""}`;
  const controlledFormReady = !controlledRegister || (
    registerForm.details.trim().length >= 3
    && (
      registerForm.type === "environmental_report"
        ? Boolean(registerForm.periodStart && registerForm.periodEnd && registerForm.periodEnd >= registerForm.periodStart)
        : registerForm.requestedTo.trim().length >= 2
    )
    && (registerForm.type !== "inspection_request" || Boolean(registerForm.readyDate))
    // The reason is derived from the description when the document is saved; only the deadline is asked.
    && (registerForm.type !== "technical_instruction" || Boolean(registerForm.dueDate))
    // The change order carries its own required boxes, in its own module.
    && (registerForm.type !== "change_order" || changeOrderReady(changeOrder))
  );
  const agreementRegister = registerForm.type === "agreement";
  const changeOrderRegister = registerForm.type === "change_order";
  const lessonsLearnedRegister = registerForm.type === "lessons_learned";
  const delayReportRegister = registerForm.type === "delay_report";
  // Section 3 is marked "photo required" on the client's own form, and section 5 asks for
  // one the moment the completion box is started.
  const delayReportFormReady = !delayReportRegister || (
    delayReportReady(delayForm)
    && Boolean(registerNamedPhotos.delay_status)
    && (!delayCompletionStarted(delayForm) || Boolean(registerNamedPhotos.delay_completion))
  );
  const lessonFormReady = !lessonsLearnedRegister || (
    lessonForm.issue.trim().length >= 3
    && lessonForm.cause.trim().length >= 3
    && lessonForm.solution.trim().length >= 3
    && lessonForm.expectedResults.trim().length >= 3
    && lessonForm.followUpAction.trim().length >= 3
    // Both pictures are marked required on the client's own form: the problem as it was
    // found, and the result after the improvement.
    && Boolean(registerNamedPhotos.lesson_issue)
    && Boolean(registerNamedPhotos.lesson_result)
  );
  // WCR, RFI, RFA and WIR are forms the contractor draws up and signs. CODECO only
  // records them and signs the response, so "sign as the author" is not CODECO's to tick.
  const submittedRegister = externalSubmissionRegisterTypes.includes(registerForm.type);
  // Who the parties of an agreement can be: the own company, the signed-in supervisor
  // and every party of this project.
  const agreementPartyOptions = Array.from(new Set([
    "CODECO N.V.",
    currentUserName,
    ...parties.map((party) => party.name),
  ].filter(Boolean)));
  // An agreement is written as a sentence, so its own text is also its register line; a
  // lesson learned reads the same way off its own issue text.
  const registerTitle = agreementRegister
    ? registerForm.title.trim() || registerForm.details.trim().split(/\r?\n/)[0].slice(0, 90)
    : lessonsLearnedRegister
    ? registerForm.title.trim() || lessonForm.issue.trim().split(/\r?\n/)[0].slice(0, 90)
    : delayReportRegister
    // A delay report is read back by the work that slipped and the days it slipped by.
    ? registerForm.title.trim() || [
      delayActivities.find((option) => option.id === delayForm.activity)?.[language === "en" ? "en" : "nl"] ?? "",
      delayForm.description.trim().split(/\r?\n/)[0],
    ].filter(Boolean).join(" · ").slice(0, 90)
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
  /**
   * A shortcut elsewhere in the app can say which record it meant. It is applied once, on
   * arrival, so the module opens on that record instead of on whatever was chosen last.
   */
  const presetHandled = useRef("");
  useEffect(() => {
    const key = `${initialRecordPreset?.registerType ?? ""}:${initialRecordPreset?.hseEventType ?? ""}:${initialRecordPreset?.dailyWorkView ?? ""}`;
    if (key === "::" || presetHandled.current === key) return;
    presetHandled.current = key;
    const applyPreset = window.setTimeout(() => {
      if (initialRecordPreset?.registerType) {
        setRegisterForm({ ...emptyControlledDocumentDraft, type: initialRecordPreset.registerType });
        setEditingRegisterId("");
      }
      if (initialRecordPreset?.hseEventType) {
        setHseForm((current) => ({ ...current, type: initialRecordPreset.hseEventType!, issueType: "safety", category: "safety" }));
        setEditingHseId("");
      }
      if (initialRecordPreset?.dailyWorkView) openDailyWork(initialRecordPreset.dailyWorkView);
      setShowForm(true);
      onRecordPresetConsumed?.();
    }, 0);
    return () => window.clearTimeout(applyPreset);
  }, [initialRecordPreset, onRecordPresetConsumed]);

  const openTask = (next: ProjectTab, createRecord = true, preset?: WorkspaceTilePreset) => {
    setTab(next);
    setSubmittedFinding(null);
    // The client's own record screens open with their form ready and the "New" button
    // folds it away — that is how their document describes them. Arriving from a tile
    // still only navigates; nothing is submitted on the way in.
    setShowForm(createRecord || recordModuleTabs.includes(next));
    setActiveInspection(null);
    // A tile that promises a delivery, a technical instruction, a change order, an
    // agreement or an incident opens that record. Four tiles used to land on the same
    // register form holding whatever type happened to be chosen last.
    if (preset?.registerType) {
      setRegisterForm({ ...emptyControlledDocumentDraft, type: preset.registerType });
      setEditingRegisterId("");
    }
    if (preset?.hseEventType) {
      setHseForm((current) => ({ ...current, type: preset.hseEventType!, issueType: "safety", category: "safety" }));
      setEditingHseId("");
    }
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
      created = await startInspection(client, { projectId, buildingId: inspectionBuildingId, buildingIds: inspectionBuildingIds, locationNodeId: inspectionLocationNodeId, reportId, templateId, title: resolvedTitle });
    }, text("Inspection started; complete every required checkpoint.", "Inspectie gestart; vul nu ieder verplicht controlepunt in."));
    if (okay && created) {
      inspectionAutosave.clear();
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
            `Automatisch voorgesteld vanuit het vastgelegde weer van vandaag: ${projectStartAnswers.temperatureC}°C, ${reportWeather(projectStartAnswers.weatherCondition).toLowerCase()}, wind ${reportWind(projectStartAnswers.windCondition)}.`,
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
    setInspectionBuildingId(inspection.building_id);
    setInspectionBuildingIds(inspection.building_ids?.length ? inspection.building_ids : [inspection.building_id]);
    setInspectionLocationNodeId(inspection.location_node_id ?? "");
    setInspectionTitle(inspection.title);
    setInspectionSignature(signatureFromDetails(inspection.signed_by, inspection.signed_at, inspection.signature_image));
    // Resuming replaces whatever was being read; the reader closes with it.
    setViewedRecord(null);
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
    text("Checklists installed.", "Checklists geïnstalleerd."),
  );

  const existingMediaFolderId = (name: string, forBuildingId: string) => {
    const existing = data.mediaFolders.find((folder) => (!folder.building_id || folder.building_id === forBuildingId) && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    return existing?.id ?? null;
  };

  const syncQueuedEvidenceNow = () => forceSyncOfflineUploads(client, projectId, {
    paused: text("Connection lost before the photos were confirmed. They are still on this device. Keep this form open, then tap Send now in Photos.", "Verbinding verbroken vóór bevestiging van de foto's. Ze staan nog op dit apparaat. Houd dit formulier open en tik in Foto's op Nu verzenden."),
    failed: (pendingCount) => text(`${pendingCount} photo upload(s) not confirmed. They are still on this device. Keep this form open, then tap Send now in Photos.`, `${pendingCount} foto-upload(s) niet bevestigd. Ze staan nog op dit apparaat. Houd dit formulier open en tik in Foto's op Nu verzenden.`),
  });

  /**
   * From a checklist straight into the formal report. The client asked for the option to
   * pick an NCR from the inspection screen; the NCR then opens with this checklist as its
   * reference, so the two records point at each other from the start.
   */
  const raiseNcrFromInspection = async (inspection: Inspection) => {
    // The answers given so far are stored first: leaving for the NCR form must not lose the checklist.
    if (inspectionOpen(inspection) && !await run(() => saveInspectionAnswers(client, inspection, inspectionAnswers), text("Checklist progress saved.", "Voortgang van de checklist opgeslagen."))) return;
    const failed = activeTemplate?.items.filter((item) => inspectionAnswers[item.id]?.result === "fail" || inspectionAnswers[item.id]?.result === "no") ?? [];
    setFindingForm((current) => ({
      ...current,
      type: "ncr",
      referenceChecklist: inspection.inspection_number,
      title: current.title || inspection.title,
      description: current.description || (failed.length
        ? `${text("Failed checkpoints:", "Afgekeurde controlepunten:")}\n${failed.map((item) => `- ${item.prompt}`).join("\n")}`
        : ""),
    }));
    setFindingBuildingId(inspection.building_id);
    setFindingBuildingIds(inspection.building_ids?.length ? inspection.building_ids : [inspection.building_id]);
    setFindingLocationNodeId(inspection.location_node_id ?? "");
    setShowForm(true);
    switchTab("ncr");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitInspection = async () => {
    if (!activeInspection || !activeTemplate) return;
    if (activeTemplate.items.some((item) => item.required && !checklistItemAnswered(item, inspectionAnswers[item.id]))) return;
    const okay = await run(
      async () => {
        const effectiveReportId = await ensureProjectDayReport(client, projectId, reportId);
        const inspectionToFinish = await updateInspectionRecord(client, {
          projectId,
          id: activeInspection.id,
          buildingId: inspectionBuildingIds[0] ?? activeInspection.building_id,
          buildingIds: inspectionBuildingIds.length ? inspectionBuildingIds : [activeInspection.building_id],
          locationNodeId: inspectionLocationNodeId || activeInspection.location_node_id || undefined,
          title: inspectionTitle.trim() || activeInspection.title,
        });
        // The signature is stored first: an inspection that is completed always carries the signature
        // of the person who walked it, even when the connection drops between the two steps.
        if (inspectionSignature && !activeInspection.signature_image) {
          await signInspection(client, activeInspection.id, inspectionSignature);
          setActiveInspection((current) => current ? { ...current, signed_by: inspectionSignature.name, signed_at: inspectionSignature.signedAt, signature_image: inspectionSignature.image } : current);
        }
        if (!["passed", "cancelled"].includes(activeInspection.status)) {
          await finishInspection(client, inspectionToFinish, inspectionAnswers);
        }
        if (inspectionPhotos.length) {
          const folderName = text("Inspections", "Inspecties");
          const photoBuildingId = activeInspection.building_id;
          const folderId = existingMediaFolderId(folderName, photoBuildingId);
          for (const photo of inspectionPhotos) {
            const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
            const caption = photoTitle(photo);
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
      inspectionPhotos.length
        ? text("Inspection completed. Photos are sent when you're online.", "Inspectie afgerond. Foto's worden verzonden zodra je online bent.")
        : text("Inspection completed and signed.", "Inspectie afgerond en ondertekend."),
    );
    if (okay) {
      setActiveInspection(null);
      setInspectionTitle("");
      setInspectionLocationNodeId("");
      setInspectionPhotos([]);
      setInspectionPhotoError("");
    }
  };

  /** Marks the points still open in a section as passed. A point already answered (a "No", a "Fail",
      an "N/A") is an exception somebody recorded and is never overwritten. */
  const approveChecklistSection = (items: ChecklistItem[]) => {
    setInspectionAnswers((answers) => ({
      ...answers,
      ...Object.fromEntries(items
        .filter((item) => (item.response_type === "yes_no_na" || item.response_type === "pass_fail_na") && !checklistItemAnswered(item, answers[item.id]))
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
    if (findingForm.description.trim().length < 3) return;
    // The client's issue screen has no title box: the record takes its log line from the
    // first sentence of the description. The NCR form keeps its own subject.
    const findingTitle = findingScope === "ncr"
      ? findingForm.title
      : recordLogLine(findingForm.description, `${issueTileLabel(issueTile)}${issueCategoryOption ? ` · ${text(issueCategoryOption.en, issueCategoryOption.nl)}` : ""}`);
    if (findingTitle.trim().length < 3) return;
    // The primary building remains on the finding; the association list makes this one
    // numbered record visible under every selected building without cloning it.
    const online = typeof navigator === "undefined" || navigator.onLine;
    let createdRecordId = "";
    // The punchlist screen picks one building, or "All buildings". A finding always
    // belongs to a building in the database, so project-wide means the same numbered
    // record associated with every building — the association list carries that without
    // cloning the record.
    const selectedFindingBuildingIds = findingBuildingIds.length ? findingBuildingIds : [findingBuildingId];
    const projectWideFinding = buildings.length > 0 && selectedFindingBuildingIds.length === buildings.length;
    const primaryFindingBuildingId = selectedFindingBuildingIds[0] ?? findingBuildingId;
    const findingPhotoBuildingId = primaryFindingBuildingId;
    const findingBuildingName = projectWideFinding
      ? text("All buildings", "Alle gebouwen")
      : selectedFindingBuildingIds.map((selectedId) => buildings.find((building) => building.id === selectedId)?.name).filter(Boolean).join(" · ") || buildingName;
    // The module decides what is created here. Without this an NCR opened from the
    // module switcher would be stored as an ordinary deficiency and vanish from the
    // NCR list it was entered in.
    const findingType = findingScope === "ncr" ? "ncr" : findingForm.type === "ncr" ? "deficiency" : findingForm.type;
    const draft = {
      projectId,
      buildingId: primaryFindingBuildingId,
      buildingIds: selectedFindingBuildingIds,
      type: findingType,
      title: findingTitle,
      description: findingForm.description,
      severity: findingForm.severity,
      responsiblePartyId: findingForm.responsiblePartyId,
      assignedUserId: findingForm.responsibleUserId,
      responsiblePerson: findingForm.responsiblePerson,
      issueType: findingForm.issueType,
      issueCategory: issueCategoryOption ? text(issueCategoryOption.en, issueCategoryOption.nl) : "",
      immediateActions: findingForm.immediateActions,
      immediateActionOther: findingForm.immediateActionOther,
      rootCause: findingForm.rootCause,
      latitude: findingForm.latitude.trim() === "" ? null : Number(findingForm.latitude),
      longitude: findingForm.longitude.trim() === "" ? null : Number(findingForm.longitude),
      locationLabel: findingBuildingName,
      impactSummary: findingForm.impactSummary,
      actionSteps: findingForm.actionSteps,
      escalationRequired: findingForm.escalationRequired,
      disposition: findingForm.disposition,
      expectedResolutionDate: findingForm.expectedResolutionDate,
      sourceCatalogSubject: findingForm.sourceCatalogSubject,
      referenceChecklist: findingForm.referenceChecklist,
      // The two lists at the head of the NCR form, stored as the words that stand on the
      // printed form rather than as an internal id.
      ncrCategory: ncrCategoryOption ? text(ncrCategoryOption.en, ncrCategoryOption.nl) : "",
      ncrWorkType: ncrWorkTypeOption ? text(ncrWorkTypeOption.en, ncrWorkTypeOption.nl) : "",
      recommendedAction: findingForm.recommendedAction || undefined,
      recommendedActionDetail: findingForm.recommendedActionDetail,
      remarks: findingForm.remarks,
      // Who drew the record up is stored with the record, so the register and the printed
      // form never have to guess it from whoever opens the file later.
      issuedBy: currentUserName,
      signedBy: findingForm.signedBy,
      signedAt: findingForm.signedAt,
      signedPosition: findingForm.signedPosition,
      signatureImage: findingForm.signatureImage || null,
      locationNodeId: findingLocationNodeId,
    };
    // The record itself is created first whenever there is a connection. That is what
    // makes the link to the contractor available the moment the NCR is submitted; the
    // photos still travel over the offline queue and attach themselves to it.
    let created: Finding | null = null;
    let queuedOffline = false;
    const success = findingPhotos.length
      ? text("Issue saved on this device. Sent when you're online.", "Issue opgeslagen op dit apparaat. Wordt verstuurd zodra je online bent.")
      : text("Finding saved with number and deadline.", "Bevinding opgeslagen met nummer en deadline.");
    const okay = await run(async () => {
      // Creating the day report needs the network. Without one the record keeps the report
      // it already knows about; the queue attaches it to today's report when it is sent.
      const effectiveReportId = online ? await ensureProjectDayReport(client, projectId, reportId) : reportId;
      // The record is written first, with or without a connection: without one it goes
      // to the device and appears in the list marked as waiting, so a supervisor sees
      // that the issue is registered instead of nothing at all.
      if (editingFindingId) {
        if (!online) throw new Error(text("Go online to edit an existing record.", "Ga online om een bestaande registratie te bewerken."));
        created = await updateFindingRecord(client, {
          projectId,
          id: editingFindingId,
          buildingId: primaryFindingBuildingId,
          buildingIds: selectedFindingBuildingIds,
          locationNodeId: draft.locationNodeId,
          title: findingTitle,
          description: draft.description,
          severity: draft.severity as Finding["severity"],
          priority: issuePriority as Finding["priority"],
          responsiblePartyId: draft.responsiblePartyId,
          assignedUserId: draft.assignedUserId,
          dueAt: draft.expectedResolutionDate ? `${draft.expectedResolutionDate}T23:59:59-03:00` : null,
          issueManagement: {
            issue_type: draft.issueType,
            issue_category: draft.issueCategory,
            immediate_actions: draft.immediateActions,
            immediate_action_other: draft.immediateActionOther,
            responsible_person: draft.responsiblePerson,
            root_cause: draft.rootCause,
            latitude: draft.latitude,
            longitude: draft.longitude,
            location_label: draft.locationLabel,
            impact_summary: draft.impactSummary,
            action_steps: draft.actionSteps,
            escalation_required: draft.escalationRequired,
            disposition: draft.disposition,
            expected_resolution_date: draft.expectedResolutionDate || null,
            source_catalog_subject: draft.sourceCatalogSubject,
            date_identified: findingForm.dateIdentified || null,
            reference_checklist: draft.referenceChecklist,
            recommended_action: draft.recommendedAction,
            recommended_action_detail: draft.recommendedActionDetail,
            remarks: draft.remarks,
            issued_by: currentUserName,
            issued_at: new Date().toISOString(),
            signed_by: draft.signedBy,
            signed_at: draft.signedAt || null,
            signature_image: draft.signatureImage,
          },
        });
        createdRecordId = editingFindingId;
      } else {
        const saved = await saveRecordOnlineOrQueue({
          kind: "finding",
          projectId,
          input: { ...draft, reportId: effectiveReportId },
          preview: {
            title: draft.title,
            description: draft.description,
            buildingId: primaryFindingBuildingId,
            locationNodeId: draft.locationNodeId || null,
            severity: draft.severity,
            priority: issuePriority,
            dueAt: draft.expectedResolutionDate ? `${draft.expectedResolutionDate}T23:59:59-03:00` : null,
            recordType: findingType,
          },
          send: () => createFinding(client, { ...draft, reportId: effectiveReportId }),
        });
        queuedOffline = saved.queued;
        created = saved.record;
        createdRecordId = saved.id;
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
            title: photoTitle(photo) || findingTitle,
            description: photoUploadDescription(photo, findingForm.description, language),
            locationLabel: findingBuildingName,
            locationNodeId: photo.details.locationNodeId || findingLocationNodeId || null,
            capturedAt: new Date(photo.file.lastModified || Date.now()).toISOString(),
            originalSize: photo.original.size,
            queuedSize: prepared.blob.size,
            compressed: prepared.compressed,
            findingGroup: {
              id: groupId,
              organizationId,
              // An already created record is only linked. A record that was written to the
              // device carries its local id, which the upload queue swaps for the real one
              // once the record queue has sent it. The draft below stays as the fallback
              // for uploads that were queued before records could wait on the device.
              findingId: created?.id,
              pendingRecordId: queuedOffline ? createdRecordId : undefined,
              draft: {
                organizationId,
                type: findingType,
                title: findingTitle,
                description: findingForm.description,
                severity: findingForm.severity,
                responsiblePartyId: findingForm.responsiblePartyId,
                assignedUserId: findingForm.responsibleUserId,
                responsiblePerson: findingForm.responsiblePerson,
                issueType: findingForm.issueType,
                issueCategory: issueCategoryOption ? text(issueCategoryOption.en, issueCategoryOption.nl) : "",
                immediateActions: findingForm.immediateActions,
                immediateActionOther: findingForm.immediateActionOther,
                rootCause: findingForm.rootCause,
                impactSummary: findingForm.impactSummary,
                actionSteps: findingForm.actionSteps,
                escalationRequired: findingForm.escalationRequired,
                disposition: findingForm.disposition,
                expectedResolutionDate: findingForm.expectedResolutionDate,
                sourceCatalogSubject: findingForm.sourceCatalogSubject,
                dateIdentified: findingForm.dateIdentified,
                referenceChecklist: findingForm.referenceChecklist,
                ncrCategory: ncrCategoryOption ? text(ncrCategoryOption.en, ncrCategoryOption.nl) : "",
                ncrWorkType: ncrWorkTypeOption ? text(ncrWorkTypeOption.en, ncrWorkTypeOption.nl) : "",
                recommendedAction: findingForm.recommendedAction || undefined,
                recommendedActionDetail: findingForm.recommendedActionDetail,
                remarks: findingForm.remarks,
                issuedBy: currentUserName,
                signedBy: findingForm.signedBy,
                signedAt: findingForm.signedAt,
                signedPosition: findingForm.signedPosition,
                signatureImage: findingForm.signatureImage || null,
                locationNodeId: findingLocationNodeId || undefined,
                buildingIds: selectedFindingBuildingIds,
              },
            },
          });
        }
        if (navigator.onLine) await syncQueuedEvidenceNow();
      }
    }, success);
    if (okay) {
      // The issue is filed, so the parked draft of it has nothing left to protect.
      clearRecordDraft("issue", projectId);
      findingAutosave.clear();
      resetFindingForm();
      setEditingFindingId("");
      setShowForm(false);
      // Right after submitting, the record itself offers the link to the contractor:
      // an NCR only works when the party that must correct it actually receives it.
      // The contractor link only exists for a record the database has actually numbered.
      setSubmittedFinding(queuedOffline ? null : created);
    }
  };

  const addHse = async () => {
    if (hseForm.description.trim().length < 3) return;
    // The client's screen has no title box: the record takes its log line from the first
    // sentence of what was observed, so the list still reads as a list.
    const hseTitle = recordLogLine(hseForm.description, `${hseTileLabel(hseIssueTile)}${hseCategoryOption ? ` · ${text(hseCategoryOption.en, hseCategoryOption.nl)}` : ""}`);
    const hseLatitude = hseForm.latitude.trim() === "" ? null : Number(hseForm.latitude);
    const hseLongitude = hseForm.longitude.trim() === "" ? null : Number(hseForm.longitude);
    const hseDueAt = new Date(hseDueValue);
    const selectedHseBuildingIds = hseBuildingIds.length ? hseBuildingIds : [hseBuildingId];
    const primaryHseBuildingId = selectedHseBuildingIds[0] ?? hseBuildingId;
    const projectWideHse = selectedHseBuildingIds.length === buildings.length;
    const hsePhotoBuildingId = primaryHseBuildingId;
    const hseBuildingName = projectWideHse
      ? text("All buildings", "Alle gebouwen")
      : selectedHseBuildingIds.map((selectedId) => buildings.find((building) => building.id === selectedId)?.name).filter(Boolean).join(" · ") || buildingName;
    const hseOnline = typeof navigator === "undefined" || navigator.onLine;
    const okay = await run(
      async () => {
        const effectiveReportId = hseOnline ? await ensureProjectDayReport(client, projectId, reportId) : reportId;
        const input = {
            projectId,
            buildingId: primaryHseBuildingId,
            buildingIds: selectedHseBuildingIds,
            locationNodeId: hseLocationNodeId,
            reportId: effectiveReportId,
            type: hseForm.type,
            category: hseForm.category,
            title: hseTitle,
            description: hseForm.description,
            severity: hseForm.severity,
            confidential: hseForm.confidential,
            immediateMeasure: hseImmediateMeasure(hseForm),
            issueType: hseForm.issueType,
            issueCategory: hseCategoryOption ? text(hseCategoryOption.en, hseCategoryOption.nl) : "",
            immediateActions: hseForm.immediateActions,
            immediateActionOther: hseForm.immediateActionOther,
            responsiblePerson: hseForm.responsiblePerson,
            responsibleUserId: hseForm.responsibleUserId,
            dueAt: Number.isNaN(hseDueAt.getTime()) ? null : hseDueAt.toISOString(),
            rootCause: hseForm.rootCause,
            correctiveAction: hseForm.correctiveAction,
            notes: hseForm.notes,
            latitude: hseLatitude,
            longitude: hseLongitude,
            locationLabel: hseBuildingName,
            signedBy: hseSignature?.name,
            signedAt: hseSignature?.signedAt,
            signatureImage: hseSignature?.image ?? null,
        };
        let eventId = editingHseId;
        if (editingHseId) {
          if (!hseOnline) throw new Error(text("Go online to edit an existing record.", "Ga online om een bestaande registratie te bewerken."));
          await updateHseRecord(client, {
            projectId,
            id: editingHseId,
            buildingId: primaryHseBuildingId,
            buildingIds: selectedHseBuildingIds,
            locationNodeId: hseLocationNodeId,
            type: hseForm.type,
            category: hseForm.category,
            title: hseTitle,
            description: hseForm.description,
            severity: hseForm.severity as HseEvent["severity"],
            confidential: hseForm.confidential,
            immediateMeasure: hseImmediateMeasure(hseForm),
            issueType: hseForm.issueType,
            issueCategory: hseCategoryOption ? text(hseCategoryOption.en, hseCategoryOption.nl) : "",
            immediateActions: hseForm.immediateActions,
            immediateActionOther: hseForm.immediateActionOther,
            responsiblePerson: hseForm.responsiblePerson,
            responsibleUserId: hseForm.responsibleUserId,
            dueAt: Number.isNaN(hseDueAt.getTime()) ? null : hseDueAt.toISOString(),
            rootCause: hseForm.rootCause,
            correctiveAction: hseForm.correctiveAction,
            notes: hseForm.notes,
            latitude: hseLatitude,
            longitude: hseLongitude,
            locationLabel: hseBuildingName,
            signature: hseSignature,
          });
        } else {
          const saved = await saveRecordOnlineOrQueue({
            kind: "hse",
            projectId,
            input,
            preview: {
              title: hseTitle,
              description: hseForm.description,
              buildingId: primaryHseBuildingId,
              locationNodeId: hseLocationNodeId || null,
              severity: hseForm.severity,
              priority: hsePriority,
              dueAt: Number.isNaN(hseDueAt.getTime()) ? null : hseDueAt.toISOString(),
              recordType: hseForm.type,
            },
            send: () => createHseEvent(client, input),
          });
          eventId = saved.id;
        }
        if (hsePhotos.length && eventId) {
          const folderName = "HSE";
          const folderId = existingMediaFolderId(folderName, hsePhotoBuildingId);
          for (const photo of hsePhotos) {
            const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
            const caption = photoTitle(photo);
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
              title: caption || hseTitle,
              description: photoUploadDescription(photo, hseForm.description, language),
              locationLabel: hseBuildingName,
              locationNodeId: photo.details.locationNodeId || hseLocationNodeId || null,
              capturedAt: new Date(photo.file.lastModified || Date.now()).toISOString(),
              originalSize: photo.original.size,
              queuedSize: prepared.blob.size,
              compressed: prepared.compressed,
              recordLink: { organizationId, recordType: "hse", recordId: eventId, relationship: "evidence" },
            });
          }
          if (navigator.onLine) await syncQueuedEvidenceNow();
        }
      },
      text("Saved on this device. Photos are sent when you're online.", "Opgeslagen op dit apparaat. Foto's worden verzonden zodra je online bent."),
    );
    if (okay) {
      // The issue is filed, so the parked draft of it has nothing left to protect.
      clearRecordDraft("hse", projectId);
      hseAutosave.clear();
      resetHseForm();
      setEditingHseId("");
      setShowForm(false);
    }
  };

  const addRegisterEntry = async () => {
    if (registerTitle.length < 3) return;
    const selectedRegisterBuildingIds = registerBuildingIds.length ? registerBuildingIds : [registerBuildingId];
    const registerRecordBuildingId = selectedRegisterBuildingIds[0] ?? registerBuildingId;
    const projectWideRegister = selectedRegisterBuildingIds.length === buildings.length;
    const registerPhotoBuildingId = registerRecordBuildingId;
    const registerBuildingName = projectWideRegister
      ? registerContextLabel
      : selectedRegisterBuildingIds.map((selectedId) => buildings.find((building) => building.id === selectedId)?.name).filter(Boolean).join(" · ") || buildingName;
    const selectedDrawing = registerDrawings.find((drawing) => drawing.id === registerDrawingId);
    const editingRegister = data.registerEntries.find((entry) => entry.id === editingRegisterId);
    // Only the lines that were actually filled in; an empty extra line is not a delivery.
    const deliveryLines = registerLines.filter((line) => line.quantity.trim() !== "" && Number.isFinite(Number(line.quantity)));
    // The photos the form asked for by name, in the order the form asks for them.
    const namedRegisterPhotos = Object.entries(registerNamedPhotos)
      .flatMap(([role, photo]) => photo ? [{ role, photo }] : []);
    const baseDetails = controlledRegister
      ? {
        ...createControlledDocumentDetails(registerForm, {
          projectName,
          projectCode,
          buildingName: registerBuildingName,
          currentUserName,
        }),
        // A change order carries the client's own sections next to the shared document
        // header, so the register, the printed form and the reports read the same thing.
        ...(changeOrderRegister ? changeOrderDetails(changeOrder) : {}),
        named_photos: namedRegisterPhotos.map(({ role, photo }) => ({
          role,
          label: namedPhotoLabel(role, "en"),
          caption: photoTitle(photo),
        })),
      }
      : {
        description: lessonsLearnedRegister ? lessonForm.issue.trim() : registerForm.details,
        outcome: registerOutcome || null,
        // Every line of the delivery, and the first one still as the plain quantity and
        // unit the register and the reports already read.
        lines: deliveryLines.map((line) => ({ quantity: Number(line.quantity), unit: line.unit.trim() || null, description: line.description.trim() || null })),
        quantity: deliveryLines.length ? Number(deliveryLines[0].quantity) : null,
        unit: deliveryLines[0]?.unit.trim() || null,
        // An agreement carries the two parties that made it and their signatures.
        ...(agreementRegister ? { ...agreementSignatureDetails(agreementForm), ...agreementRecordDetails(agreementRecord) } : {}),
        // Which of the named boxes actually carry a picture. The pictures themselves live
        // in the media library; the record says which box each one was taken in.
        named_photos: namedRegisterPhotos.map(({ role, photo }) => ({
          role,
          label: namedPhotoLabel(role, "en"),
          caption: photoTitle(photo),
        })),
        // A project delay report: what slipped, by how many calendar days, and where that
        // puts the finish date — with the two pictures that evidence it.
        ...(delayReportRegister ? delayReportDetails(delayForm) : {}),
        // A lesson learned: the issue, its cause, the fix, the expected result and the
        // follow-up, exactly as on the client's own form — minus the target date, which
        // was struck off it.
        ...(lessonsLearnedRegister ? {
          project_phase: lessonForm.projectPhase || null,
          issue: lessonForm.issue.trim(),
          cause: lessonForm.cause.trim(),
          solution_improvement: lessonForm.solution.trim(),
          expected_results: lessonForm.expectedResults.trim(),
          follow_up_action: lessonForm.followUpAction.trim(),
          responsible_person: lessonForm.responsiblePerson.trim(),
          lesson_status: lessonForm.status,
        } : {}),
      };
    const registerOnline = typeof navigator === "undefined" || navigator.onLine;
    const okay = await run(
      async () => {
        // A document attachment is uploaded to private storage and lives inside the record
        // itself, so it cannot be added afterwards. Without a connection the register item
        // can still be written to the device — the attachment cannot, and saying so is
        // better than dropping the file silently.
        if (!registerOnline && registerFiles.length) {
          throw new Error(text("Attachments need a connection. Remove them to save on this device, or go online.", "Bijlagen hebben verbinding nodig. Verwijder ze om op dit apparaat op te slaan, of ga online."));
        }
        const effectiveReportId = registerOnline ? await ensureProjectDayReport(client, projectId, reportId) : reportId;
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
        const registerInput = {
          projectId,
          buildingId: registerRecordBuildingId,
          buildingIds: selectedRegisterBuildingIds,
          locationNodeId: registerLocationNodeId,
          reportId: effectiveReportId,
          type: registerForm.type,
          title: registerTitle,
          responsiblePartyId: registerForm.responsiblePartyId,
          dueAt: registerForm.dueDate || null,
          details: detailsForEdit(editingRegister?.details, {
            ...baseDetails,
            ...(controlledRegister && editingRegister ? { issue_date: String(editingRegister.details?.issue_date || documentIssueDate) } : {}),
            attachment_files: uploadedFiles.length ? uploadedFiles : editingRegister?.details?.attachment_files ?? [],
            drawing_file_id: selectedDrawing?.id ?? editingRegister?.details?.drawing_file_id ?? null,
            drawing_name: selectedDrawing?.original_name ?? editingRegister?.details?.drawing_name ?? null,
          }),
          signedBy: controlledRegister ? registerForm.signedBy : registerSignature?.name,
          signedAt: controlledRegister ? registerForm.signedAt : registerSignature?.signedAt,
          signatureImage: controlledRegister ? registerForm.signatureImage || null : registerSignature?.image ?? null,
        };
        let entry: Pick<RegisterEntry, "id" | "entry_number">;
        if (editingRegisterId) {
          if (!registerOnline) throw new Error(text("Go online to edit an existing record.", "Ga online om een bestaande registratie te bewerken."));
          const updated = await updateRegisterRecord(client, {
            projectId,
            id: editingRegisterId,
            buildingId: registerRecordBuildingId,
            buildingIds: selectedRegisterBuildingIds,
            locationNodeId: registerLocationNodeId,
            title: registerTitle,
            dueAt: registerForm.dueDate || null,
            details: registerInput.details,
            signature: signatureFromDetails(registerInput.signedBy, registerInput.signedAt, registerInput.signatureImage),
            expectedVersion: editingRegister?.version,
          });
          entry = updated;
        } else {
          const savedEntry = await saveRecordOnlineOrQueue({
            kind: "register",
            projectId,
            input: registerInput,
            preview: {
              title: registerTitle,
              description: String(baseDetails.description ?? ""),
              buildingId: registerRecordBuildingId,
              locationNodeId: registerLocationNodeId || null,
              severity: "medium",
              priority: "normal",
              dueAt: registerForm.dueDate || null,
              recordType: registerForm.type,
            },
            send: () => createRegisterEntry(client, registerInput),
          });
          // A queued item has no number yet; the database assigns it when the item is sent.
          entry = savedEntry.record ?? { id: savedEntry.id, entry_number: "" };
        }
        // Site photos belong to a register item as much as documents do. The photos the
        // form asked for by name are filed the same way and in the same folder, but keep
        // the name of the box they were taken in, so the report can tell them apart.
        if (registerPhotos.length || namedRegisterPhotos.length) {
          const folderName = text("Register evidence", "Registerbewijs");
          const folderId = existingMediaFolderId(folderName, registerPhotoBuildingId);
          const filedPhotos = [
            ...namedRegisterPhotos.map(({ role, photo }) => ({ photo, role })),
            ...registerPhotos.map((photo) => ({ photo, role: "" })),
          ];
          for (const { photo, role } of filedPhotos) {
            const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
            const written = photoTitle(photo);
            const caption = role
              ? [namedPhotoLabel(role, language), written].filter(Boolean).join(" · ")
              : written;
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
        if (!editingRegisterId && registerForm.type === "punch_list") {
          const punchInput = {
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
            // A queued register item has no number yet, so the reference stays empty
            // instead of pointing at nothing.
            sourceCatalogSubject: entry.entry_number,
          };
          await saveRecordOnlineOrQueue({
            kind: "finding",
            projectId,
            input: punchInput,
            preview: {
              title: registerForm.title,
              description: registerForm.details,
              buildingId: registerPhotoBuildingId,
              locationNodeId: registerLocationNodeId || null,
              severity: "medium",
              priority: "normal",
              dueAt: null,
              recordType: "deficiency",
            },
            send: () => createFinding(client, punchInput),
          });
        }
        return entry;
      },
      text(`${registerNames[registerForm.type] ?? "Record"} saved.`, `${registerNames[registerForm.type] ?? "Registratie"} opgeslagen.`),
    );
    if (okay) {
      registerAutosave.clear();
      setRegisterForm({ ...emptyControlledDocumentDraft, type: registerForm.type });
      setEditingRegisterId("");
      setAgreementForm({ ...emptyAgreementSignature });
      setAgreementRecord({ ...emptyAgreementRecord });
      setChangeOrder({ ...emptyChangeOrder });
      setDelayForm({ ...emptyDelayReport });
      setLessonForm({ ...emptyLessonLearned });
      setRegisterFiles([]);
      setRegisterSignature(null);
      setRegisterOutcome("");
      setRegisterLines([{ quantity: "", unit: "", description: "" }]);
      setRegisterPhotos([]);
      setRegisterNamedPhotos({});
      setRegisterPhotoError("");
      setRegisterDrawingId("");
      setRegisterLocationNodeId("");
      setShowForm(false);
    }
  };

  const boqSelectionRef = useRef(0);
  const inspectBoqFile = async (file: File | null) => {
    const selection = ++boqSelectionRef.current;
    setBoqFile(file);
    setBoqItems([]);
    setBoqError("");
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Het CSV-bestand is te groot (maximaal 5 MB).");
      const content = await file.text();
      if (selection !== boqSelectionRef.current) return;
      setBoqItems(parseBoqCsv(content));
    } catch (caught) {
      if (selection === boqSelectionRef.current) setBoqError(userFacingError(caught, text));
    }
  };

  const importBoq = async () => {
    if (!boqItems.length) return;
    const okay = await run(
      () => importProjectBoq(client, { projectId, buildingId: boqBuildingId, reportId, items: boqItems }),
      text(`${boqItems.length} BOQ lines imported.`, `${boqItems.length} BOQ-regels geïmporteerd.`),
    );
    if (okay) {
      setBoqFile(null);
      setBoqItems([]);
      setBoqError("");
    }
  };

  const moduleEnabled = (module: string) => data.settings?.modules?.[module] !== false;
  /** What the other modules recorded today, for the quality and safety blocks of the day log. */
  const todayInSuriname = reportDateInSuriname();
  const isToday = (...values: Array<string | null | undefined>) => values.some((value) => Boolean(value) && reportDateInSuriname(new Date(value!)) === todayInSuriname);
  const dayLogToday: DayLogToday = {
    inspections: data.inspections
      .filter((inspection) => isToday(inspection.started_at, inspection.completed_at, inspection.planned_at))
      .map((inspection) => ({ id: inspection.id, code: inspection.inspection_number, title: inspection.title, status: inspection.status })),
    findings: data.findings
      .filter((finding) => finding.status !== "cancelled" && isToday(finding.created_at))
      .map((finding) => ({ id: finding.id, code: finding.finding_number, title: finding.title, type: finding.finding_type === "ncr" ? "ncr" as const : "issue" as const })),
    hse: data.hseEvents
      .filter((event) => event.status !== "cancelled" && isToday(event.occurred_at))
      .map((event) => ({ id: event.id, code: event.event_number, title: event.title, eventType: event.event_type })),
  };
  /** The counted days of the Workforce register: one line per day and building. */
  const reportDates = new Map((data.dayReports ?? []).map((report) => [report.id, report.report_date]));
  const workforceDays = Array.from((data.attendance ?? []).reduce((days, entry) => {
    const key = `${entry.day_report_id}:${entry.building_id}`;
    const day = days.get(key) ?? { key, reportId: entry.day_report_id, buildingId: entry.building_id, headcount: 0, visitors: 0, signedBy: "" };
    if (entry.entry_type === "visitor") day.visitors += 1;
    else day.headcount += Number(entry.headcount) || 0;
    day.signedBy = day.signedBy || entry.signed_by || "";
    days.set(key, day);
    return days;
  }, new Map<string, { key: string; reportId: string; buildingId: string; headcount: number; visitors: number; signedBy: string }>()).values())
    .map((day) => {
      const reportDate = reportDates.get(day.reportId) ?? "";
      return {
        ...day,
        reportDate,
        date: reportDate ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(`${reportDate}T12:00:00-03:00`)) : "",
      };
    })
    .sort((left, right) => right.reportDate.localeCompare(left.reportDate));

  const projectSections: Array<[Exclude<ProjectTab, "home">, string, number]> = ([
    ["inspections", text("Inspections", "Inspecties"), data.inspections.length],
    ["findings", text("Issues", "Issues"), data.findings.filter((item) => item.finding_type !== "ncr" && item.status !== "closed").length],
    ["ncr", "NCR", data.findings.filter((item) => item.finding_type === "ncr" && item.status !== "closed").length],
    ["hse", "HSE", data.hseEvents.length],
    // The page is named after what was asked for: one block of the day, or the whole day log.
    ["daily", !dayLogFocus ? text("Day log", "Daglog") : dailyWorkView === "works_completed" ? text("Works completed", "Werkzaamheden afgerond") : dailyWorkView === "delays" ? text("Delays", "Vertragingen") : text("Works ongoing", "Werkzaamheden gaande"), (data.dailyWork ?? []).length],
    ["workforce", text("Workforce", "Workforce"), workforceDays.length],
    ["documents", "Project Docs", data.files.filter((file) => file.status === "available").length + data.registerEntries.filter((entry) => ["document", "drawing", "specification", "contract", "boq"].includes(entry.register_type)).length],
    ["registers", text("Formal documents & registers", "Formele documenten & registers"), data.registerEntries.length],
    ["visual", text("Visual evidence", "Visueel bewijs"), data.visualCaptures.length],
    ["drawings", text("Drawings", "Tekeningen"), data.files.filter((file) => file.category === "drawing" && file.status === "available").length],
    ["tools", text("Field tools", "Veldtools"), data.registerEntries.filter((entry) => ["notepad", "agreement", "technical_instruction"].includes(entry.register_type)).length],
    ["files", text("Photos", "Foto's"), data.files.filter((file) => file.mime_type.startsWith("image/")).length],
    ["assets", text("Assets", "Middelen"), data.files.length + data.inspections.length + data.findings.length + data.hseEvents.length + data.registerEntries.length + (data.dayReports ?? []).length],
  ] as Array<[Exclude<ProjectTab, "home">, string, number]>).filter(([sectionId]) => ({
    inspections: moduleEnabled("inspections"),
    findings: moduleEnabled("quality"),
    ncr: moduleEnabled("quality"),
    hse: moduleEnabled("hse"),
    daily: true,
    workforce: true,
    documents: moduleEnabled("documents"),
    registers: moduleEnabled("documents"),
    visual: moduleEnabled("visual_evidence"),
    drawings: moduleEnabled("documents"),
    tools: moduleEnabled("documents"),
    files: moduleEnabled("visual_evidence"),
    assets: moduleEnabled("documents") || moduleEnabled("visual_evidence"),
  })[sectionId]);
  const activeSectionLabel = projectSections.find(([id]) => id === tab)?.[1];
  const activeSectionCount = projectSections.find(([id]) => id === tab)?.[2] ?? 0;
  const canCreateRecord = recordModuleTabs.includes(tab) && mayCreateHere;

  return (
    <>
      {tab === "home" ? <header className="secondary-header workspace-header home">
        <div>
          <h1>{text("Workspace", "Werkruimte")}</h1>
          <p>{projectName}</p>
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
            records={recordDirectory}
            buildings={buildings}
            openRecord={(recordTab, recordId, kind) => {
              if (recordTab === "daily") {
                openDailyWork(kind === "delay" ? "delays" : "works_completed");
                openTask("daily", false);
              } else if (recordTab === "home") {
                openTask("home", false);
              } else {
                openProjectArea(recordTab as Parameters<typeof openProjectArea>[0], recordId);
              }
            }}
            openPhotoLibrary={() => switchTab("files")}
            openTask={openTask}
            openWorkforce={() => switchTab("workforce")}
            openFinding={openFinding}
            openDailyWork={(view) => { openDailyWork(view); switchTab("daily"); }}
            openActionCenter={openActionCenter}
            openRapidVerify={openRapidVerify}
          />
        </>
      ) : (
        <>
          <div className="workspace-section-controls">
            <button className="workspace-back-button" type="button" onClick={() => switchTab("home")}><ArrowLeft size={17} /> {text("Workspace", "Werkruimte")}</button>
            <div className="workspace-current-module" aria-live="polite">
              <span>{projectName}</span>
              {/* The module's own title: a heading, so it is announced and navigable. */}
              <h1>{activeSectionLabel}</h1>
              <b>{activeSectionCount}</b>
            </div>
            {/* The "Switch module" dropdown used to sit here. The client wrote next to it: "ik
                begrijp dit niet, misschien kan het weg". Every module is one tap away on the
                workspace itself, so there is no second, hidden way in any more. */}
            {canCreateRecord && !activeInspection ? <button className={`ui-button ${showForm ? "ui-button--secondary" : "ui-button--primary"} ui-button--md workspace-module-create`} type="button" onClick={() => setShowForm((value) => !value)}><Plus size={15} /> {text("New", "Nieuw")}</button> : null}
          </div>
        </>
      )}

      {/* The record opens over the list it was tapped in. As a panel at the top of the tab
          it was simply off-screen on a phone: tapping "View" looked like nothing at all. */}
      {tab !== "home" && viewedRecord ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setViewedRecord(null)}>
        <aside className="modal record-readonly-panel" role="dialog" aria-modal="true" aria-label={text("Record details", "Registratiedetails")}>
          <div>
            <span className="record-number">{viewedRecord.code}</span>
            <h2>{viewedRecord.title}</h2>
            {viewedRecord.description ? <p>{viewedRecord.description}</p> : null}
            <small>{viewedRecord.meta}</small>
          </div>
          <span className="task-status">{viewedRecord.status}</span>
          <div className="record-readonly-actions">
            {viewedRecord.status !== "cancelled" && permissions.can("records.edit") ? <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => {
              if (viewedRecord.kind === "inspection") {
                const record = data.inspections.find((item) => item.id === viewedRecord.id);
                if (record) void resumeInspection(record);
              } else if (viewedRecord.kind === "finding") {
                const record = data.findings.find((item) => item.id === viewedRecord.id);
                if (record) editFinding(record);
              } else if (viewedRecord.kind === "hse") {
                const record = data.hseEvents.find((item) => item.id === viewedRecord.id);
                if (record) editHse(record);
              } else if (viewedRecord.kind === "daily_work") {
                // A day has one closeout: editing it is the day log of that day, already open
                // above the list with what was saved.
                setViewedRecord(null);
                setShowForm(true);
              } else {
                const record = data.registerEntries.find((item) => item.id === viewedRecord.id);
                if (record) editRegister(record);
              }
            }}><Wrench size={14} /> {text("Edit in form", "Bewerken in formulier")}</button> : null}
            {viewedRecord.status !== "cancelled" && viewedRecord.kind !== "daily_work" && permissions.can("records.edit") ? <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => withdrawRecord(viewedRecord)}>{text("Withdraw", "Intrekken")}</button> : null}
            <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setViewedRecord(null)}><X size={14} /> {text("Close", "Sluiten")}</button>
          </div>
        </aside>
        </div>
      ) : null}

      {tab === "inspections" ? (
        <section className="operation-panel">
          {activeInspection && activeTemplate ? (
            <RecordFormShell code={activeInspection.inspection_number} title={activeInspection.title} status={text("In progress", "In uitvoering")} busy={busy} className="wide sectioned-record-form">
              <p className="form-intro">{text("A failed point creates a finding when you complete the inspection.", "Een niet-geslaagd punt maakt een bevinding aan zodra je de inspectie afrondt.")}</p>
              <div className="checklist-progress" aria-label={text("Checklist progress", "Checklistvoortgang")}>
                <span><b>{answeredChecklistItems}</b> / {activeTemplate.items.length} {text("answered", "beantwoord")}</span>
                <span className="checklist-progress-track"><i style={{ width: `${activeTemplate.items.length ? Math.round((answeredChecklistItems / activeTemplate.items.length) * 100) : 0}%` }} /></span>
              </div>
              <div className="checklist-run">
                {checklistSections.map(({ section, items }) => (
                  <section className="checklist-section" key={section}>
                    <header>
                      <span><strong>{section}</strong><small>{items.filter((item) => checklistItemAnswered(item, inspectionAnswers[item.id])).length} / {items.length}</small></span>
                      {items.every((item) => item.response_type === "yes_no_na" || item.response_type === "pass_fail_na") && items.some((item) => !checklistItemAnswered(item, inspectionAnswers[item.id])) ? <button type="button" onClick={() => approveChecklistSection(items)}><CheckCircle2 size={14} /> {text("Approve section", "Sectie akkoord")}</button> : null}
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
              <RecordBuildingsField
                id="active-inspection-buildings"
                buildings={buildings}
                value={inspectionBuildingIds}
                onChange={(next) => { setInspectionBuildingIds(next); setInspectionBuildingId(next[0] ?? inspectionBuildingId); setInspectionLocationNodeId(""); }}
              />
              <LocationPicker id="active-inspection-location" nodes={data.locationNodes} buildingId={inspectionBuildingId} value={inspectionLocationNodeId} onChange={setInspectionLocationNodeId} requiredDepth={requiredLocationDepth} />
              <PhotoEvidenceList
                photos={inspectionPhotos}
                setPhotos={setInspectionPhotos}
                markupContext={{ ...markupOptions, defaultBuildingId: activeInspection.building_id }}
              />
              {inspectionPhotoError ? <p className="field-error" role="alert">{inspectionPhotoError}</p> : null}
              {/* "Geen optie om te ondertekenen! Naam etc." — the person who walked the
                  checklist signs it, here, before it is completed. */}
              <RecordSignatureField
                declaration={text(
                  "By signing you confirm that you checked every point of this checklist yourself.",
                  "Met je handtekening bevestig je dat je elk punt van deze checklist zelf hebt gecontroleerd.",
                )}
                nameSuggestion={currentUserName}
                lockName
                locked={Boolean(activeInspection.signature_image)}
                value={inspectionSignature}
                onChange={setInspectionSignature}
                required
              />
              {/* "Locatie pinnen": the checklist itself gets its spot on the drawing. */}
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => { setDrawingInspectionId(activeInspection.id); setDrawingFindingId(""); switchTab("drawings"); }}>
                <MapPin size={15} /> {text("Pin this location on the drawing", "Locatie op de tekening pinnen")}
              </button>
              {/* "Optie om NCR te kiezen vanuit hier" — a failed point can become the
                  formal report straight away, with the checklist as its reference. */}
              <button className="ui-button ui-button--secondary ui-button--md inspection-ncr-button" type="button" onClick={() => raiseNcrFromInspection(activeInspection)}>
                <ShieldAlert size={15} /> {text("Raise an NCR from this checklist", "NCR opstellen vanuit deze checklist")}
              </button>
              <div className="form-actions checklist-sticky-actions"><button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy} onClick={() => { if (!inspectionOpen(activeInspection)) { setActiveInspection(null); return; } void run(() => saveInspectionAnswers(client, activeInspection, inspectionAnswers), text("Checklist progress saved.", "Voortgang van de checklist opgeslagen.")).then((saved) => { if (saved) setActiveInspection(null); }); }}>{text("Complete later", "Later afronden")}</button><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !inspectionSignature || activeTemplate.items.some((item) => item.required && !checklistItemAnswered(item, inspectionAnswers[item.id]))} onClick={() => void submitInspection()}>{busy ? <Loader2 className="spin" size={15} /> : <FileCheck2 size={15} />} {text("Complete inspection", "Inspectie afronden")}</button></div>
              {!inspectionSignature ? <p className="form-intro">{text("Sign the checklist to complete it.", "Onderteken de checklist om hem af te ronden.")}</p> : null}
            </RecordFormShell>
          ) : null}
          {showForm && !activeInspection ? (
            <RecordFormShell title={text("Start inspection", "Inspectie starten")} status={text("New", "Nieuw")} busy={busy} className="wide sectioned-record-form">
              <DraftNotice status={inspectionAutosave.status} savedAt={inspectionAutosave.savedAt} onDiscard={() => { inspectionAutosave.clear(); setInspectionTitle(""); setInspectionTemplateId(""); setInspectionLocationNodeId(""); }} />
              
              {anchorWorkPlanned && missingAnchorChecklistCodes.length ? (
                <div className="operation-alert success recommended-checklist-install">
                  <ClipboardCheck size={18} />
                  <div>
                    <strong>{text("Anchor work recognized", "Ankerwerk herkend")}</strong>
                    <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => void installRecommendedAnchorPackage()}>
                      {busy ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
                      {text("Prepare all 3 checklists", "Zet alle 3 checklists klaar")}
                    </button>
                  </div>
                </div>
              ) : null}
              {inspectionTemplates.length ? <RecordFormSection number={1} title={text("Checklist and location", "Checklist en locatie")}>
                <RecordBuildingsField id="inspection-buildings" buildings={buildings} value={inspectionBuildingIds} onChange={(next) => { setInspectionBuildingIds(next); setInspectionBuildingId(next[0] ?? inspectionBuildingId); setInspectionLocationNodeId(""); }} />
                <LocationPicker id="inspection-location" nodes={data.locationNodes} buildingId={inspectionBuildingId} value={inspectionLocationNodeId} onChange={setInspectionLocationNodeId} requiredDepth={requiredLocationDepth} />
                <label className="form-field"><span>{text("Checklist · recommended for today's work first", "Checklist · aanbevolen voor vandaag eerst")}</span><select value={inspectionTemplateId || inspectionTemplates[0]?.id || ""} onChange={(event) => { setInspectionTemplateId(event.target.value); setInspectionTitle(""); }}>{inspectionTemplates.map((template) => <option value={template.id} key={template.id}>{["LIB-101", "LIB-102", "LIB-103"].includes(template.code) ? "★ " : ""}{template.name} · v{template.version_number}</option>)}</select></label>
                <details className="inspection-subject-details"><summary>{text("Add a different subject or element · optional", "Ander onderwerp of element toevoegen · optioneel")}</summary><label className="form-field"><span>{text("Subject / element", "Onderwerp / element")}</span><input value={inspectionTitle} onChange={(event) => setInspectionTitle(event.target.value)} placeholder={`${inspectionTemplates.find((template) => template.id === (inspectionTemplateId || inspectionTemplates[0]?.id))?.name ?? text("Inspection", "Inspectie")} · ${buildingName}`} /></label></details>
                <button className="ui-button ui-button--primary ui-button--md start-checklist-button" type="button" disabled={busy || (exactLocationRequired && !inspectionLocationNodeId)} onClick={() => void beginInspection()}><ClipboardCheck size={15} /> {text("Start recommended checklist", "Start aanbevolen checklist")}</button>
              </RecordFormSection> : <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("No project checklist is published yet", "Nog geen projectchecklist gepubliceerd")}</strong><span>{text("Only an administrator can install checklists (Management).", "Alleen een beheerder kan checklists installeren (Management).")}</span></div></div>}
            </RecordFormShell>
          ) : null}
          <div className="operation-form inspection-search">
            <div className="operation-form-heading"><div><h2>{text("Search by building, exact location and date", "Zoek op gebouw, exacte locatie en datum")}</h2></div><span>{filteredInspections.length}</span></div>
            <div className="form-grid-2">
              {/* The same building field as every other form on this screen. */}
              <BuildingPicker id="inspection-filter-building" buildings={buildings} value={inspectionFilterBuildingId || ALL_BUILDINGS} onChange={(next) => { setInspectionFilterBuildingId(next === ALL_BUILDINGS ? "" : next); setInspectionFilterLocationNodeId(""); }} allowAll />
              <label className="form-field"><span>{text("Exact location", "Exacte locatie")}</span><select value={inspectionFilterLocationNodeId} onChange={(event) => setInspectionFilterLocationNodeId(event.target.value)}><option value="">{text("All locations", "Alle locaties")}</option>{data.locationNodes.filter((node) => !inspectionFilterBuildingId || node.building_id === inspectionFilterBuildingId).map((node) => <option value={node.id} key={node.id}>{locationBreadcrumb(data.locationNodes, node.id)}</option>)}</select></label>
              {/* "Automatisch": the dates come from the inspections themselves, so a date
                  that has nothing on it cannot be chosen at all. */}
              <label className="form-field"><span>{text("Inspection date", "Inspectiedatum")}</span>
                <select value={inspectionFilterDate} onChange={(event) => setInspectionFilterDate(event.target.value)}>
                  <option value="">{text("All dates", "Alle datums")}</option>
                  {inspectionDates.map((day) => <option value={day} key={day}>{day === todayKey ? text(`Today · ${day}`, `Vandaag · ${day}`) : formatDate(`${day}T12:00:00-03:00`, locale)}</option>)}
                </select>
              </label>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => { setInspectionFilterBuildingId(""); setInspectionFilterLocationNodeId(""); setInspectionFilterDate(""); }}>{text("Clear filters", "Wis filters")}</button>
            </div>
          </div>
          {inspectionResumeError ? <p className="field-error" role="alert">{inspectionResumeError}</p> : null}
          {/* An inspection that is still open can be opened again from this list, so a
              started checklist can actually be filled in and completed. */}
          <RecordList empty={text("No inspections match these filters.", "Geen inspecties gevonden met deze filters.")} rows={filteredInspections.map((inspection) => ({
            id: inspection.id,
            icon: ClipboardCheck,
            title: inspection.title,
            meta: `${inspection.inspection_number} · ${recordContextLabel(inspection.building_id, inspection.location_node_id, inspection.building_ids)} · ${formatDate(inspection.completed_at ?? inspection.started_at, locale)}${inspection.signed_by ? ` · ${text("signed by", "ondertekend door")} ${inspection.signed_by}` : ""}`,
            status: statusText(inspection.status, text),
            tone: inspection.status === "passed" ? "green" : inspection.status === "failed" ? "red" : "",
            onOpen: () => viewInspection(inspection),
            onEdit: inspection.status !== "cancelled" ? () => { void resumeInspection(inspection); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined,
            editLabel: inspection.status === "in_progress" || inspection.status === "planned" ? text("Fill in checklist", "Checklist invullen") : undefined,
            onWithdraw: inspection.status !== "cancelled" ? () => withdrawRecord({ kind: "inspection", id: inspection.id, code: inspection.inspection_number, title: inspection.title, status: inspection.status, meta: recordContextLabel(inspection.building_id, inspection.location_node_id, inspection.building_ids) }) : undefined,
          }))} />
        </section>
      ) : null}

      {tab === "findings" || tab === "ncr" ? (
        <section className="operation-panel">
          {/*
            * The client's own issue screen: the same numbered sections as the HSE screen,
            * with the kinds an issue is filed under and the register it lands in. The NCR
            * module keeps the client's paper NCR form, below.
            */}
          {showForm && findingScope === "issue" ? (
            <div className="operation-form wide sectioned-record-form">
              <div className="operation-form-heading sectioned-record-heading">
                <button className="record-back-button" type="button" onClick={() => { resetFindingForm(); setShowForm(false); }} aria-label={text("Leave this screen", "Dit scherm verlaten")}><ArrowLeft size={18} /></button>
                <div>
                  <h2>{text("Create issue", "Issue registreren")}</h2>
                </div>
                <button className={`record-sync-chip${online ? "" : " offline"}`} type="button" disabled={busy} onClick={syncWaitingRecordsNow} title={text("Send what is still waiting on this device", "Verstuur wat nog op dit apparaat wacht")}>{online ? <CloudSun size={15} /> : <WifiOff size={15} />}<span><strong>{syncChip.label}</strong></span></button>
                <button className="ui-button ui-button--secondary ui-button--md record-heading-draft" type="button" onClick={() => writeRecordDraft("issue", projectId, findingForm)}><Save size={14} /> {text("Save draft", "Concept opslaan")}</button>
              </div>
              <section className="controlled-document-context sectioned-record-context" aria-label={text("Issue header", "Kop van het issue")}>
                <div><small>{text("Issue ID", "Issue ID")}</small><strong>{nextIssueNumber}</strong><span>{text("Provisional · fixed on submit", "Voorlopig · vast bij indienen")}</span></div>
                <div><small>{text("Date and time", "Datum en tijd")}</small><strong>{issueDateLabel}</strong><span>{issueTime}</span></div>
                <div><small>{text("Reporter", "Melder")}</small><strong>{currentUserName}</strong><span>{reporterDepartment}</span></div>
                <div><small>{text("Project", "Project")}</small><strong>{projectName}</strong><span>{projectCode}</span></div>
                <div><small>{text("Site / location", "Locatie")}</small><strong>{findingBuildingsLabel}</strong><span>{findingForm.latitude && findingForm.longitude ? `${findingForm.latitude}, ${findingForm.longitude}` : projectLocation || text("No coordinates yet", "Nog geen coördinaten")}</span></div>
                <div><small>{text("Weather", "Weer")}</small><strong>{liveWeatherLabel}</strong><span>{liveWeather ? `${liveWeather.temperatureC}°C` : "—"}</span></div>
                <div><small>{text("Department", "Afdeling")}</small><strong>{reporterDepartment}</strong><span>{text("Of the reporter", "Van de melder")}</span></div>
                <div><small>{text("Status", "Status")}</small><strong className="record-status-preview">{issueStatusLabel}</strong><span>{text("On submit", "Bij indienen")}</span></div>
              </section>
              <DraftNotice status={findingAutosave.status} savedAt={findingAutosave.savedAt} onDiscard={() => { findingAutosave.clear(); resetFindingForm(); }} />
              {issueParkedDraft ? (
                <p className="form-helper record-draft-notice">
                  <Save size={13} /> {text("A saved draft of this screen is waiting on this device.", "Op dit apparaat staat een opgeslagen concept van dit scherm.")}
                  <button className="text-link" type="button" onClick={() => { setFindingForm(issueParkedDraft); clearRecordDraft("issue", projectId); }}>{text("Put it back", "Terugzetten")}</button>
                  <button className="text-link" type="button" onClick={() => clearRecordDraft("issue", projectId)}>{text("Throw it away", "Weggooien")}</button>
                </p>
              ) : null}

              <div className="sectioned-record-columns">
                <div className="sectioned-record-column">
                  <section className="record-section record-order-1" aria-label={text("Issue type", "Issuetype")}>
                    <h3><span className="record-section-number">1</span> {text("Issue type", "Issuetype")} <em className="record-section-required">*</em></h3>
                    <div className="record-tile-grid">
                      {issueTypeTiles.map((tile) => {
                        const TileIcon = tile.icon;
                        return (
                          <button className={`record-tile${findingForm.issueType === tile.id ? " active" : ""}`} type="button" key={tile.id} aria-pressed={findingForm.issueType === tile.id} onClick={() => chooseIssueType(tile.id)}>
                            <TileIcon size={20} />
                            <span>{issueTileLabel(tile)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="record-section record-order-2" aria-label={text("Category", "Categorie")}>
                    <h3><span className="record-section-number">2</span> {text("Category", "Categorie")} <em className="record-section-required">*</em></h3>
                    <label className="form-field"><select value={findingForm.issueCategory} onChange={(event) => setFindingForm({ ...findingForm, issueCategory: event.target.value })}>
                      <option value="">{text("Choose a category", "Kies een categorie")}</option>
                      {issueCategories.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}
                    </select></label>
                  </section>

                  <section className="record-section record-order-3" aria-label={text("Severity", "Ernst")}>
                    <h3><span className="record-section-number">3</span> {text("Severity", "Ernst")} <em className="record-section-required">*</em></h3>
                    <div className="record-severity-choices">
                      {([["low", text("Low", "Laag")], ["medium", text("Medium", "Middel")], ["high", text("High", "Hoog")], ["critical", text("Critical", "Kritiek")]] as const).map(([value, label]) => (
                        <button className={`record-severity-choice record-severity-choice-${value}${findingForm.severity === value ? " active" : ""}`} type="button" key={value} aria-pressed={findingForm.severity === value} onClick={() => setFindingForm({ ...findingForm, severity: value })}>
                          <Circle size={13} /> {label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="record-section record-order-4" aria-label={text("Description", "Omschrijving")}>
                    <h3><span className="record-section-number">4</span> {text("Description", "Omschrijving")} <em className="record-section-required">*</em></h3>
                    <label className="form-field record-description-field">
                      <textarea rows={5} maxLength={1000} value={findingForm.description} onChange={(event) => setFindingForm({ ...findingForm, description: event.target.value })} />
                      <div className="record-field-foot">
                        <DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, description: appendDictation(current.description, transcript) }))} />
                        <span className="record-counter">{findingForm.description.length} / 1000</span>
                      </div>
                    </label>
                  </section>

                  <section className="record-section record-order-5" aria-label={text("Location", "Locatie")}>
                    <h3><span className="record-section-number">5</span> {text("Location", "Locatie")} <em className="record-section-required">*</em></h3>
                    <div className="form-grid-2">
                      <BuildingMultiPicker id="finding-buildings" buildings={buildings} value={findingBuildingIds} onChange={chooseFindingBuildings} />
                      <LocationPicker id="finding-location" nodes={data.locationNodes} buildingId={findingBuildingId} value={findingLocationNodeId} onChange={setFindingLocationNodeId} requiredDepth={requiredLocationDepth} />
                    </div>
                    <RecordLocationMap
                      client={client}
                      value={{ latitude: findingForm.latitude, longitude: findingForm.longitude }}
                      fallbackCenter={projectCenter}
                      contextLabel={findingCoversEveryBuilding ? projectName : `${findingBuildingsLabel}, ${projectName}`}
                      onChange={(coordinates) => setFindingForm((current) => ({ ...current, ...coordinates }))}
                      onUseMyLocation={captureIssuePosition}
                      locating={issueLocating}
                      manualOpen={issueManualPosition}
                      onToggleManual={() => setIssueManualPosition(!issueManualPosition)}
                    />
                    {issueLocationError ? <p className="field-error" role="alert">{issueLocationError}</p> : null}
                  </section>
                </div>

                <div className="sectioned-record-column">
                  <section className="record-section record-order-6" aria-label={text("Photos / evidence", "Foto's / bewijs")}>
                    <h3><span className="record-section-number">6</span> {text("Photos / evidence", "Foto's / bewijs")}</h3>
                    {/* The strip the client drew: the pictures themselves with a cross on
                        them, and the tile that adds one right next to them. Tapping a
                        picture still opens the one screen where it is described. */}
                    <div className="record-evidence-strip">
                      <PhotoEvidenceList
                        photos={findingPhotos}
                        setPhotos={setFindingPhotos}
                        markupContext={{ ...markupOptions, defaultBuildingId: findingBuildingId }}
                        layout="gallery"
                      />
                      <label className="record-add-photo">
                        <Camera size={20} />
                        <strong>{text("Add photo", "Foto toevoegen")}</strong>
                        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addFindingPhotos(event.target.files); event.currentTarget.value = ""; }} />
                      </label>
                    </div>
                    <small className="record-photo-hint">{photoStripHint}</small>
                    {findingPhotoError ? <p className="field-error" role="alert">{findingPhotoError}</p> : null}
                  </section>

                  <section className="record-section record-order-7" aria-label={text("Immediate action taken", "Directe maatregel")}>
                    <h3><span className="record-section-number">7</span> {text("Immediate action taken", "Directe maatregel")}</h3>
                    <div className="record-action-grid">
                      {immediateActionsTaken.map((action) => (
                        <label className={`record-action-check${findingForm.immediateActions.includes(action.id) ? " active" : ""}`} key={action.id}>
                          <input type="checkbox" checked={findingForm.immediateActions.includes(action.id)} onChange={() => toggleIssueAction(action.id)} />
                          {text(action.en, action.nl)}
                        </label>
                      ))}
                      <label className="record-action-check record-action-other">
                        <MoreHorizontal size={14} />
                        <input type="text" value={findingForm.immediateActionOther} onChange={(event) => setFindingForm({ ...findingForm, immediateActionOther: event.target.value })} maxLength={240} aria-label={text("Other · specify", "Overig · omschrijf")} placeholder={text("Other · specify", "Overig · omschrijf")} />
                      </label>
                    </div>
                  </section>

                  <section className="record-section record-order-8" aria-label={text("Responsible person", "Verantwoordelijke")}>
                    <h3><span className="record-section-number">8</span> {text("Responsible person", "Verantwoordelijke")} <em className="record-section-required">*</em></h3>
                    <label className="form-field record-responsible-field">
                      <UserCheck size={15} />
                      <select value={findingForm.responsibleUserId} onChange={(event) => {
                        const chosen = responsiblePeople.find((option) => option.id === event.target.value);
                        setFindingForm({ ...findingForm, responsibleUserId: chosen?.id ?? "", responsiblePerson: chosen ? `${chosen.name}${chosen.role ? ` (${chosen.role})` : ""}` : "" });
                      }}>
                        <option value="">{text("Choose who has to act", "Kies wie moet handelen")}</option>
                        {responsiblePeople.map((option) => <option value={option.id} key={option.id}>{option.role ? `${option.name} (${option.role})` : option.name}</option>)}
                      </select>
                      {findingForm.responsibleUserId ? <button className="record-field-clear" type="button" onClick={() => setFindingForm({ ...findingForm, responsibleUserId: "", responsiblePerson: "" })} aria-label={text("Clear the responsible person", "Verantwoordelijke wissen")}><X size={14} /></button> : null}
                    </label>
                    {!responsiblePeople.length ? (
                      <label className="form-field"><span>{text("Name of the responsible person", "Naam van de verantwoordelijke")}</span><input value={findingForm.responsiblePerson} onChange={(event) => setFindingForm({ ...findingForm, responsiblePerson: event.target.value })} placeholder={text("Nobody from this project is in the app yet", "Nog niemand van dit project staat in de app")} /></label>
                    ) : null}
                    {/* The contractor that has to correct it is a party, not a colleague:
                        the client's issue log carries both. */}
                    <label className="form-field"><span>{text("Contractor · owner of the correction", "Aannemer · eigenaar van de correctie")}</span><select value={findingForm.responsiblePartyId} onChange={(event) => setFindingForm({ ...findingForm, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Nog niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
                  </section>

                  <section className="record-section record-order-9" aria-label={text("Due date", "Deadline")}>
                    <h3><span className="record-section-number">9</span> {text("Due date", "Deadline")}</h3>
                    <label className="form-field record-due-field">
                      <CalendarClock size={15} />
                      <input type="date" value={issueDueValue} onChange={(event) => setFindingForm({ ...findingForm, expectedResolutionDate: event.target.value })} />
                      <span className="record-due-distance">({deadlineDistance(issueDueValue)})</span>
                      <Info size={15} className="record-due-info" aria-label={text("How this deadline is set", "Hoe deze deadline tot stand komt")} />
                    </label>
                    <div className="record-derived-block">
                      <div><small>{text("Priority", "Prioriteit")}</small><span className={`record-priority-badge record-priority-${issuePriority}`}>{recordPriorityLabels[issuePriority]}</span></div>
                      <div><small>{text("Status", "Status")}</small><span className="record-status-badge">{issueStatusLabel}</span></div>
                      <div className="record-derived-assignee"><small>{text("Automatically assigned to", "Automatisch toegewezen aan")}</small><strong>{findingForm.responsiblePerson || parties.find((party) => party.id === findingForm.responsiblePartyId)?.name || text("Nobody yet", "Nog niemand")}</strong></div>
                    </div>
                    <p className="form-helper">{text("Default deadline by severity: critical 1 day, high 3, medium 7, low 14.", "Standaarddeadline per ernst: kritiek 1 dag, hoog 3, midden 7, laag 14.")}</p>
                  </section>

                  <section className="record-section record-order-10" aria-label={text("Root cause", "Oorzaak")}>
                    <h3><span className="record-section-number">10</span> {text("Root cause", "Oorzaak")} <em className="record-section-optional">({text("optional", "optioneel")})</em></h3>
                    <label className="form-field"><select value={findingForm.rootCause} onChange={(event) => setFindingForm({ ...findingForm, rootCause: event.target.value })}>
                      <option value="">{text("Select root cause", "Kies een oorzaak")}</option>
                      {recordRootCauses.map((cause) => <option value={cause.id} key={cause.id}>{text(cause.en, cause.nl)}</option>)}
                    </select></label>
                  </section>

                  <section className="record-section record-order-11" aria-label={text("Additional notes", "Aanvullende notities")}>
                    <h3><span className="record-section-number">11</span> {text("Additional notes", "Aanvullende notities")} <em className="record-section-optional">({text("optional", "optioneel")})</em></h3>
                    <label className="form-field">
                      <textarea rows={3} maxLength={500} value={findingForm.remarks} onChange={(event) => setFindingForm({ ...findingForm, remarks: event.target.value })} placeholder={text("Any additional notes...", "Aanvullende notities...")} />
                      <div className="record-field-foot"><span /><span className="record-counter">{findingForm.remarks.length} / 500</span></div>
                    </label>
                  </section>
                </div>
              </div>

              {/* The impact, the follow-up and the escalation flag are not on the screen
                  the client drew, but they are the boxes of their own issue register and
                  the period report reads them. They stay one tap away, folded shut. */}
              <details className="record-extra-details">
                <summary>{text("Impact, follow-up and escalation", "Impact, opvolging en escalatie")}</summary>
                <div className="record-extra-body">
                  <div className="click-answer-block">
                    <strong>{text("Impact", "Impact")}</strong>
                    <div className="quick-issue-presets">{findingImpactPresets.map((option) => <button className={findingForm.impactSummary === option ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, impactSummary: findingForm.impactSummary === option ? "" : option })} key={option}>{option}</button>)}</div>
                    <label className="form-field"><textarea rows={2} aria-label={text("Impact", "Impact")} value={findingForm.impactSummary} onChange={(event) => setFindingForm({ ...findingForm, impactSummary: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, impactSummary: appendDictation(current.impactSummary, transcript) }))} /></label>
                  </div>
                  <div className="click-answer-block">
                    <strong>{text("Required follow-up", "Vereiste opvolging")}</strong>
                    <div className="quick-issue-presets">{findingActionPresets.map((option) => <button className={findingForm.actionSteps === option ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, actionSteps: findingForm.actionSteps === option ? "" : option })} key={option}>{option}</button>)}</div>
                    <label className="form-field"><textarea rows={2} aria-label={text("Required follow-up", "Vereiste opvolging")} value={findingForm.actionSteps} onChange={(event) => setFindingForm({ ...findingForm, actionSteps: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, actionSteps: appendDictation(current.actionSteps, transcript) }))} /></label>
                  </div>
                  <label className="check-field issue-escalation"><input type="checkbox" checked={findingForm.escalationRequired} onChange={(event) => setFindingForm({ ...findingForm, escalationRequired: event.target.checked })} /> {text("Escalation required (Y/N)", "Escalatie vereist (J/N)")}</label>
                </div>
              </details>
              {/* The client wrote "signature" beside the issue form too. */}
              <SignatureField
                label={text("Sign as the supervisor who reports this issue", "Ondertekenen als supervisor die dit issue meldt")}
                declaration={text(
                  "By signing you report this issue under your own name.",
                  "Met je handtekening meld je dit issue onder je eigen naam.",
                )}
                hint={text("Signature, name and time are stored with the report.", "Handtekening, naam en tijdstip worden bij het rapport bewaard.")}
                nameSuggestion={currentUserName}
                nameOptions={documentIssuerOptions}
                value={signatureFromDetails(findingForm.signedBy, findingForm.signedAt, findingForm.signatureImage)}
                onChange={(signature) => setFindingForm({
                  ...findingForm,
                  signedBy: signature?.name ?? "",
                  signedAt: signature?.signedAt ?? "",
                  signatureImage: signature?.image ?? "",
                })}
              />
              <div className="record-form-actions">
                <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => { resetFindingForm(); setShowForm(false); }}><X size={14} /> {text("Cancel", "Annuleren")}</button>
                <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => writeRecordDraft("issue", projectId, findingForm)}><Save size={14} /> {text("Save draft", "Concept opslaan")}</button>
                <label className="record-attachment-count">
                  <Paperclip size={14} /> {text(`Attachments (${findingPhotos.length})`, `Bijlagen (${findingPhotos.length})`)}
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addFindingPhotos(event.target.files); event.currentTarget.value = ""; }} />
                </label>
                <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || (exactLocationRequired && !findingCoversEveryBuilding && !findingLocationNodeId) || (!online && !findingPhotos.length) || !findingForm.issueCategory || findingForm.responsiblePerson.trim().length < 2 || findingForm.description.trim().length < 3} onClick={() => void addFinding()}><Send size={15} /> {!online ? text("Add to sync queue", "In synchronisatiewachtrij") : text("Submit issue", "Issue indienen")}</button>
              </div>
            </div>
          ) : null}
          {showForm && findingScope === "ncr" ? (
            <div className="operation-form wide sectioned-record-form snap-assign-form">
              <div className="operation-form-heading"><div><h2>{text("Non-conformance report", "Non-conformance report")}</h2></div>{!online ? <span className="experimental-badge"><WifiOff size={13} /> {text("Queues offline", "Offline wachtrij")}</span> : null}</div>
              {/* The head of the client's own NCR form: project, contractor, subject and
                  the reference, with the date and the report number filled by the app. */}
              <section className="controlled-document-context ncr-form-context" aria-label={text("Non-conformance report header", "Kop van het non-conformance report")}>
                <div><small>{text("Project name and number", "Projectnaam en -nummer")}</small><strong>{projectName}</strong><span>{projectCode}</span></div>
                <div><small>{text("Contractor", "Aannemer")}</small><strong>{parties.find((party) => party.id === findingForm.responsiblePartyId)?.name || text("Not assigned yet", "Nog niet toegewezen")}</strong><span>{findingBuildingsLabel}</span></div>
                <div><small>{text("Date", "Datum")}</small><strong>{issueDateLabel}</strong><span>{issueTime}</span></div>
                {/* An NCR says who drew it up, from the moment it is written: without it
                    the contractor receives a formal report nobody stands behind. */}
                <div><small>{text("Drawn up by", "Opgesteld door")}</small><strong>{currentUserName}</strong><span>{findingForm.signedBy ? text(`Signed by ${findingForm.signedBy}`, `Ondertekend door ${findingForm.signedBy}`) : text("Not signed yet", "Nog niet ondertekend")}</span></div>
                <div><small>{text("Report no · automatic", "Rapportnummer · automatisch")}</small><strong>{text("On submit", "Bij indienen")}</strong><span>{text("Unique project code", "Unieke projectcode")}</span></div>
              </section>
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
              {/* The client struck the ready-made problems and the historic B1 catalog off
                  the issue screen: an issue is written in the words of the site. The NCR
                  form keeps both, because that is where they were asked for. */}
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
              }}><option value="">{text("Choose only when applicable", "Kies alleen indien van toepassing")}</option>{issueCatalogPresets.map((preset) => <option value={preset.subject} key={preset.subject}>{preset.subject}</option>)}</select></label>
              {/* The two lists at the head of the client's own NCR form: what the
                  non-conformance is, and which work it hit. The third list on that sheet,
                  "Source", is struck through — an NCR is answered by what is wrong and
                  where in the works, not by which inspection happened to find it. */}
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Category", "Categorie")}</span><select value={findingForm.ncrCategory} onChange={(event) => setFindingForm({ ...findingForm, ncrCategory: event.target.value })}><option value="">{text("Choose a category", "Kies een categorie")}</option>{ncrCategories.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}</select></label>
                <label className="form-field"><span>{text("Type", "Type")}</span><select value={findingForm.ncrWorkType} onChange={(event) => setFindingForm({ ...findingForm, ncrWorkType: event.target.value })}><option value="">{text("Choose a type of work", "Kies een soort werk")}</option>{ncrWorkTypes.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}</select></label>
              </div>
              <div className="form-grid-2">
                {/* In the NCR module the type is the NCR itself; a dropdown that can only
                    say "NCR" is one box too many on the client's form. */}
                <label className="form-field"><span>{text("Reference checklist / earlier report", "Referentiechecklist / eerder rapport")}</span><input value={findingForm.referenceChecklist} onChange={(event) => setFindingForm({ ...findingForm, referenceChecklist: event.target.value })} placeholder="NCR - 51" /></label>
                {/* Priority is High, Medium or Low, in the client's own words. The deadline
                    that follows from it stays visible, because it is rule-driven. */}
                <label className="form-field"><span>{text("Priority", "Priority")}</span><select value={findingForm.severity} onChange={(event) => setFindingForm({ ...findingForm, severity: event.target.value })}><option value="high">{text("High · 3 days", "Hoog · 3 dagen")}</option><option value="medium">{text("Medium · 7 days", "Middel · 7 dagen")}</option><option value="low">{text("Low · 14 days", "Laag · 14 dagen")}</option><option value="critical">{text("Critical · 1 day + escalation", "Kritiek · 1 dag + escalatie")}</option></select></label>
              </div>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Issue type", "Issue Type")}</span><select value={findingForm.issueType} onChange={(event) => setFindingForm({ ...findingForm, issueType: event.target.value })}>{issueTypeOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
                <label className="form-field"><span>{text("Disposition", "Beoordeling")}</span><select value={findingForm.disposition} onChange={(event) => setFindingForm({ ...findingForm, disposition: event.target.value as typeof findingForm.disposition })}><option value="validated">{text("Validated", "Gevalideerd")}</option><option value="to_be_corrected">{text("To be corrected", "Te corrigeren")}</option><option value="alternative_solution">{text("Alternative solution required", "Alternatieve oplossing nodig")}</option></select></label>
              </div>
              <div className="form-grid">
                <label className="form-field"><span>{text("Subject", "Onderwerp")}</span><input value={findingForm.title} onChange={(event) => setFindingForm({ ...findingForm, title: event.target.value })} placeholder={text("What the non-conformance is about", "Waar de afwijking over gaat")} /></label>
                <label className="form-field"><span>{text("Description of non-conformance", "Omschrijving van de afwijking")}</span><textarea rows={5} value={findingForm.description} onChange={(event) => setFindingForm({ ...findingForm, description: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, description: appendDictation(current.description, transcript) }))} /></label>
              </div>
              {/* "Recommended Action by Engineer" on the client's own NCR form: rework or
                  repair, with the sentence that says what has to happen. */}
              <div className="click-answer-block ncr-recommended-action">
                <strong>{text("Recommended action by engineer", "Aanbevolen actie door de ingenieur")}</strong>
                <div className="quick-issue-presets">
                  {([["rework", text("Rework", "Opnieuw uitvoeren")], ["repair", text("Repair", "Herstellen")], ["alternative", text("Alternative solution for approval", "Alternatieve oplossing ter goedkeuring")]] as const).map(([value, label]) => (
                    <button className={findingForm.recommendedAction === value ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, recommendedAction: findingForm.recommendedAction === value ? "" : value })} key={value}>{label}</button>
                  ))}
                </div>
                <label className="form-field"><span>{text("What the contractor has to do", "Wat de aannemer moet doen")}</span><textarea rows={2} value={findingForm.recommendedActionDetail} onChange={(event) => setFindingForm({ ...findingForm, recommendedActionDetail: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, recommendedActionDetail: appendDictation(current.recommendedActionDetail, transcript) }))} /></label>
              </div>
              {/* "Moet ook kunnen invoeren": the impact and the follow-up are typed here,
                  in the same block as the ready-made sentences. A choice fills the field
                  and stays editable, instead of hiding the writing behind a fold-out. */}
              <div className="click-answer-block">
                <strong>{text("Impact", "Impact")}</strong>
                <div className="quick-issue-presets">{findingImpactPresets.map((option) => <button className={findingForm.impactSummary === option ? "active" : ""} type="button" onClick={() => setFindingForm({ ...findingForm, impactSummary: findingForm.impactSummary === option ? "" : option })} key={option}>{option}</button>)}</div>
                <label className="form-field"><span>{text("Impact in your own words", "Impact in eigen woorden")}</span><textarea rows={2} value={findingForm.impactSummary} onChange={(event) => setFindingForm({ ...findingForm, impactSummary: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, impactSummary: appendDictation(current.impactSummary, transcript) }))} /></label>
              </div>
              {/* "Corrective Action Required" is struck through on the client's own NCR
                  form, and rightly so: what has to happen is already the engineer's
                  recommended action above, and what will happen is the contractor's own
                  proposal below. A third box in between only invited three answers to one
                  question. It stays on the issue screen, which has no such pair. */}
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Date identified", "Date Identified")}</span><input type="date" value={findingForm.dateIdentified} onChange={(event) => setFindingForm({ ...findingForm, dateIdentified: event.target.value })} /></label>
                <label className="form-field"><span>{text("Expected resolution date", "Expected Resolution Date")}</span><input type="date" value={findingForm.expectedResolutionDate} onChange={(event) => setFindingForm({ ...findingForm, expectedResolutionDate: event.target.value })} /></label>
              </div>
              <label className="check-field issue-escalation"><input type="checkbox" checked={findingForm.escalationRequired} onChange={(event) => setFindingForm({ ...findingForm, escalationRequired: event.target.checked })} /> {text("Escalation required (Y/N)", "Escalation Required (Y/N)")}</label>
              <p className="form-helper">{text(`Entered by ${currentUserName}`, `Ingevoerd door ${currentUserName}`)}</p>
              <div className="form-grid-2">
                <BuildingMultiPicker id="ncr-buildings" buildings={buildings} value={findingBuildingIds} onChange={chooseFindingBuildings} />
                <label className="form-field"><span>{text("Contractor · receives this NCR", "Aannemer · ontvangt deze NCR")}</span><select value={findingForm.responsiblePartyId} onChange={(event) => setFindingForm({ ...findingForm, responsiblePartyId: event.target.value })}><option value="">{text("Not assigned", "Nog niet toegewezen")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
              </div>
              <LocationPicker id="finding-location" nodes={data.locationNodes} buildingId={findingBuildingId} value={findingLocationNodeId} onChange={setFindingLocationNodeId} requiredDepth={requiredLocationDepth} />
              {/* The last two boxes of the client's NCR form: free remarks and the
                  signature of the engineer who issues it. */}
              <label className="form-field"><span>{text("Remarks", "Opmerkingen")}</span><textarea rows={2} value={findingForm.remarks} onChange={(event) => setFindingForm({ ...findingForm, remarks: event.target.value })} /><DictateButton onText={(transcript) => setFindingForm((current) => ({ ...current, remarks: appendDictation(current.remarks, transcript) }))} /></label>
              {/* Signing is the signature itself, written here, on this form, at this
                  moment — not a box that records that somebody clicked. The client wrote
                  "signature" beside the issue form too, so both are signed the same way. */}
              <SignatureField
                label={text("Sign as the engineer who issues this NCR", "Ondertekenen als ingenieur die deze NCR uitgeeft")}
                declaration={text(
                  "By signing you issue this non-conformance report to the contractor named above.",
                  "Met je handtekening geef je dit non-conformance report uit aan de hierboven genoemde aannemer.",
                )}
                hint={text("Signature, name and date are stored with the report.", "Handtekening, naam en datum worden bij het rapport bewaard.")}
                nameSuggestion={currentUserName}
                nameOptions={documentIssuerOptions}
                value={signatureFromDetails(findingForm.signedBy, findingForm.signedAt, findingForm.signatureImage)}
                onChange={(signature) => setFindingForm({
                  ...findingForm,
                  signedBy: signature?.name ?? "",
                  signedAt: signature?.signedAt ?? "",
                  signatureImage: signature?.image ?? "",
                })}
              />
              {/* Every signature box on the client's own form prints Name and Position
                  under the line. The name and the date come from the act of signing; the
                  job the signer holds is the one thing the app cannot know. */}
              <label className="form-field ncr-signature-position"><span>{text("Position", "Functie")}</span><input value={findingForm.signedPosition} onChange={(event) => setFindingForm({ ...findingForm, signedPosition: event.target.value })} placeholder={text("Quality Engineer", "Quality Engineer")} /></label>
                <div className="operation-alert warning"><RotateCcw size={17} /><div><strong>{text("The contractor fills in the correction", "De aannemer vult de correctie in")}</strong><span>{text("Submit, then send the NCR to the contractor. The contractor proposes the corrective action; CODECO verifies and closes.", "Dien in en stuur de NCR naar de aannemer. De aannemer stelt de corrigerende maatregel voor; CODECO verifieert en sluit.")}</span></div></div>
              <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || (exactLocationRequired && !findingCoversEveryBuilding && !findingLocationNodeId) || (!online && !findingPhotos.length) || findingForm.title.trim().length < 3 || findingForm.description.trim().length < 3} onClick={() => void addFinding()}><AlertTriangle size={15} /> {!online ? text("Add to sync queue", "In synchronisatiewachtrij") : text("Submit NCR", "NCR indienen")}</button>
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
                [text("In progress", "In uitvoering"), scopedFindings.filter((item) => ["in_progress", "reopened"].includes(item.status)).length],
                [text("Ready for verification", "Gereed voor verificatie"), scopedFindings.filter((item) => item.status === "ready_for_verification").length],
                [text("Verified", "Geverifieerd"), scopedFindings.filter((item) => item.status === "closed").length],
              ].map(([label, count], index) => <div className={index === 2 ? "attention" : index === 3 ? "complete" : ""} key={String(label)}><span>{index + 1}</span><strong>{count}</strong><small>{label}</small></div>)}
            </div>
            <div className="punchlist-cycle-card">
              <div className="button-row">{!permissions.can("files.manage") ? null : <><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setTab("visual")}><Camera size={14} /> {text("Open normal photo", "Open normale foto")}</button><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setTab("visual")}><RotateCcw size={14} /> {text("Open 360° image", "Open 360°-beeld")}</button></>}</div>
            </div>
          </div>
          <FindingList
            data={data}
            client={client}
            run={run}
            projectId={projectId}
            openPhotoMarking={(fileId) => { setVisualFileId(fileId); switchTab("visual"); }}
            findings={scopedFindings}
            progressUpdates={data.findingProgressUpdates}
            visualAnnotations={data.visualAnnotations}
            externalShareLinks={data.externalShareLinks ?? []}
            currentUserId={currentUserId}
            projectName={projectName}
            projectCode={projectCode}
            buildings={buildings}
            locationNodes={data.locationNodes}
            currentUserName={currentUserName}
            resolveUserName={resolveUserName}
            parties={parties}
            busy={busy}
            focusRecordId={focusRecordId}
            transition={(finding, nextStatus, note, finalMeasure, correction, verificationSignedBy, verificationSignatureImage, verification) => run(() => transitionFinding(client, finding.id, nextStatus, note, finalMeasure, correction, verificationSignedBy, verificationSignatureImage, verification), `Bevinding ${finding.finding_number} staat nu op ${findingStatusLabels[nextStatus] ?? nextStatus}.`)}
            recordProgress={(finding, progressPercent, disposition, note) => run(
              () => recordFindingProgress(client, { findingId: finding.id, progressPercent, disposition, note }),
              text(`Progress recorded. 100% still needs verification.`, `Voortgang vastgelegd. 100% moet nog worden geverifieerd.`),
            )}
            share={shareFinding}
            revoke={(shareId) => run(
              () => revokeExternalShareLink(client, shareId),
              text("External link revoked.", "Externe link ingetrokken."),
            )}
            linkVisual={(finding) => {
              setVisualFindingId(finding.id);
              switchTab("visual");
            }}
            linkDrawing={(finding) => {
              setDrawingFindingId(finding.id);
              switchTab("drawings");
            }}
            viewRecord={viewFinding}
            editRecord={editFinding}
            withdrawRecord={(finding) => withdrawRecord({ kind: "finding", id: finding.id, code: finding.finding_number, title: finding.title, status: finding.status, meta: recordContextLabel(finding.building_id, finding.location_node_id, finding.building_ids), description: finding.description })}
          />
        </section>
      ) : null}
      {tab === "hse" ? (
        <section className="operation-panel">
          {showForm ? (
            <RecordFormShell
              code={data.hseEvents.find((item) => item.id === editingHseId)?.event_number ?? nextHseNumber}
              title={editingHseId ? text("Edit HSE observation / issue", "HSE-observatie / issue bewerken") : text("HSE observation / issue", "HSE-observatie / issue")}
              status={hseStatusLabel}
              busy={busy}
              className="wide sectioned-record-form"
              headerAside={<>
                <button className="record-back-button" type="button" onClick={() => { resetHseForm(); setShowForm(false); }} aria-label={text("Leave this screen", "Dit scherm verlaten")}><ArrowLeft size={18} /></button>
                <button className={`record-sync-chip${online ? "" : " offline"}`} type="button" disabled={busy} onClick={syncWaitingRecordsNow} title={text("Send what is still waiting on this device", "Verstuur wat nog op dit apparaat wacht")}>{online ? <CloudSun size={15} /> : <WifiOff size={15} />}<span><strong>{syncChip.label}</strong></span></button>
                <button className="ui-button ui-button--secondary ui-button--md record-heading-draft" type="button" onClick={() => writeRecordDraft("hse", projectId, hseForm)}><Save size={14} /> {text("Save draft", "Concept opslaan")}</button>
              </>}
            >
              {/* The head of the client's own screen: what the app already knows before a
                  single box is filled in. "Ik vermoed dat dag, datum & tijd zelf komen" —
                  they do, and so do the reporter, the project, the site and the weather. */}
              <section className="controlled-document-context sectioned-record-context" aria-label={text("Issue header", "Kop van de melding")}>
                <div><small>{text("Issue ID", "Issue ID")}</small><strong>{nextHseNumber}</strong><span>{text("Provisional · fixed on submit", "Voorlopig · vast bij indienen")}</span></div>
                <div><small>{text("Date and time", "Datum en tijd")}</small><strong>{issueDateLabel}</strong><span>{issueTime}</span></div>
                <div><small>{text("Reporter", "Melder")}</small><strong>{currentUserName}</strong><span>{reporterDepartment}</span></div>
                <div><small>{text("Project", "Project")}</small><strong>{projectName}</strong><span>{projectCode}</span></div>
                <div><small>{text("Site / location", "Locatie")}</small><strong>{hseBuildingIds.map((selectedId) => buildings.find((building) => building.id === selectedId)?.name).filter(Boolean).join(" · ") || buildingName}</strong><span>{hseForm.latitude && hseForm.longitude ? `${hseForm.latitude}, ${hseForm.longitude}` : projectLocation || text("No coordinates yet", "Nog geen coördinaten")}</span></div>
                <div><small>{text("Weather", "Weer")}</small><strong>{liveWeatherLabel}</strong><span>{liveWeather ? `${liveWeather.temperatureC}°C` : "—"}</span></div>
                <div><small>{text("Department", "Afdeling")}</small><strong>{reporterDepartment}</strong><span>{text("Of the reporter", "Van de melder")}</span></div>
                <div><small>{text("Status", "Status")}</small><strong className="record-status-preview">{hseStatusLabel}</strong><span>{text("On submit", "Bij indienen")}</span></div>
              </section>
              {/* "Ik vermoed dat dag, datum & tijd zelf komen" — the form says so out loud. */}
              <DraftNotice status={hseAutosave.status} savedAt={hseAutosave.savedAt} onDiscard={() => { hseAutosave.clear(); resetHseForm(); }} />
              {hseParkedDraft ? (
                <p className="form-helper record-draft-notice">
                  <Save size={13} /> {text("A saved draft of this screen is waiting on this device.", "Op dit apparaat staat een opgeslagen concept van dit scherm.")}
                  <button className="text-link" type="button" onClick={() => { setHseForm(hseParkedDraft); clearRecordDraft("hse", projectId); }}>{text("Put it back", "Terugzetten")}</button>
                  <button className="text-link" type="button" onClick={() => clearRecordDraft("hse", projectId)}>{text("Throw it away", "Weggooien")}</button>
                </p>
              ) : null}

              <div className="sectioned-record-columns">
                <div className="sectioned-record-column">
                  <section className="record-section record-order-1" aria-label={text("Issue type", "Issuetype")}>
                    <h3><span className="record-section-number">1</span> {text("Issue type", "Issuetype")} <em className="record-section-required">*</em></h3>
                    <div className="record-tile-grid">
                      {hseIssueTypes.map((tile) => {
                        const TileIcon = tile.icon;
                        return (
                          <button className={`record-tile${hseForm.issueType === tile.id ? " active" : ""}`} type="button" key={tile.id} aria-pressed={hseForm.issueType === tile.id} onClick={() => chooseHseIssueType(tile.id)}>
                            <TileIcon size={20} />
                            <span>{hseTileLabel(tile)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="record-section record-order-2" aria-label={text("Category", "Categorie")}>
                    <h3><span className="record-section-number">2</span> {text("Category", "Categorie")} <em className="record-section-required">*</em></h3>
                    <label className="form-field"><select value={hseForm.issueCategory} onChange={(event) => setHseForm({ ...hseForm, issueCategory: event.target.value })}>
                      <option value="">{text("Choose a category", "Kies een categorie")}</option>
                      {hseIssueCategories.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}
                    </select></label>
                  </section>

                  <section className="record-section record-order-3" aria-label={text("Severity", "Ernst")}>
                    <h3><span className="record-section-number">3</span> {text("Severity", "Ernst")} <em className="record-section-required">*</em></h3>
                    <div className="record-severity-choices">
                      {([["low", text("Low", "Laag")], ["medium", text("Medium", "Middel")], ["high", text("High", "Hoog")], ["critical", text("Critical", "Kritiek")]] as const).map(([value, label]) => (
                        <button className={`record-severity-choice record-severity-choice-${value}${hseForm.severity === value ? " active" : ""}`} type="button" key={value} aria-pressed={hseForm.severity === value} onClick={() => setHseForm({ ...hseForm, severity: value })}>
                          <Circle size={13} /> {label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="record-section record-order-4" aria-label={text("Description", "Omschrijving")}>
                    <h3><span className="record-section-number">4</span> {text("Description", "Omschrijving")} <em className="record-section-required">*</em></h3>
                    {/* The standard records the client asked for stay one tap away; they
                        fill this box and every box they belong to, and stay editable. */}
                    <div className="quick-issue-presets" aria-label={text("Choose a standard HSE record", "Kies een standaard HSE-registratie")}>{hsePresets.map((preset) => <button className={hseForm.description === preset.description ? "active" : ""} type="button" onClick={() => { chooseHseIssueType(preset.issueType); setHseForm((current) => ({ ...current, issueType: preset.issueType, severity: preset.severity, description: preset.description, immediateActions: preset.actions })); }} key={preset.label}>{preset.label}</button>)}</div>
                    <label className="form-field record-description-field">
                      <textarea rows={5} maxLength={1000} value={hseForm.description} onChange={(event) => setHseForm({ ...hseForm, description: event.target.value })} />
                      <div className="record-field-foot">
                        <DictateButton onText={(transcript) => setHseForm((current) => ({ ...current, description: appendDictation(current.description, transcript) }))} />
                        <span className="record-counter">{hseForm.description.length} / 1000</span>
                      </div>
                    </label>
                  </section>

                  <section className="record-section record-order-8" aria-label={text("Responsible person", "Verantwoordelijke")}>
                    <h3><span className="record-section-number">8</span> {text("Responsible person", "Verantwoordelijke")} <em className="record-section-required">*</em></h3>
                    <label className="form-field record-responsible-field">
                      <UserCheck size={15} />
                      <select value={hseForm.responsibleUserId} onChange={(event) => {
                        const chosen = responsiblePeople.find((option) => option.id === event.target.value);
                        setHseForm({ ...hseForm, responsibleUserId: chosen?.id ?? "", responsiblePerson: chosen ? `${chosen.name}${chosen.role ? ` (${chosen.role})` : ""}` : "" });
                      }}>
                        <option value="">{text("Choose who has to act", "Kies wie moet handelen")}</option>
                        {responsiblePeople.map((option) => <option value={option.id} key={option.id}>{option.role ? `${option.name} (${option.role})` : option.name}</option>)}
                      </select>
                      {hseForm.responsibleUserId ? <button className="record-field-clear" type="button" onClick={() => setHseForm({ ...hseForm, responsibleUserId: "", responsiblePerson: "" })} aria-label={text("Clear the responsible person", "Verantwoordelijke wissen")}><X size={14} /></button> : null}
                    </label>
                    {/* A project without colleagues in the app still has to be able to file
                        the issue: then the name is written instead of chosen. */}
                    {!responsiblePeople.length ? (
                      <label className="form-field"><span>{text("Name of the responsible person", "Naam van de verantwoordelijke")}</span><input value={hseForm.responsiblePerson} onChange={(event) => setHseForm({ ...hseForm, responsiblePerson: event.target.value })} placeholder={text("Nobody from this project is in the app yet", "Nog niemand van dit project staat in de app")} /></label>
                    ) : null}
                  </section>

                  <section className="record-section record-order-9" aria-label={text("Due date", "Deadline")}>
                    <h3><span className="record-section-number">9</span> {text("Due date", "Deadline")}</h3>
                    <label className="form-field record-due-field">
                      <CalendarClock size={15} />
                      <input type="datetime-local" value={hseDueValue} onChange={(event) => setHseForm({ ...hseForm, dueAt: event.target.value })} />
                      <span className="record-due-distance">({deadlineDistance(hseDueValue)})</span>
                      <Info size={15} className="record-due-info" aria-label={text("How this deadline is set", "Hoe deze deadline tot stand komt")} />
                    </label>
                    {/* The deadline follows the severity by the same ladder a finding gets,
                        so the priority, the status and the owner are not typed twice. */}
                    <div className="record-derived-block">
                      <div><small>{text("Priority", "Prioriteit")}</small><span className={`record-priority-badge record-priority-${hsePriority}`}>{recordPriorityLabels[hsePriority]}</span></div>
                      <div><small>{text("Status", "Status")}</small><span className="record-status-badge">{hseStatusLabel}</span></div>
                      <div className="record-derived-assignee"><small>{text("Automatically assigned to", "Automatisch toegewezen aan")}</small><strong>{hseForm.responsiblePerson || text("Nobody yet", "Nog niemand")}</strong></div>
                    </div>
                    <p className="form-helper">{text(`Default deadline by severity: critical 1 day, high 3, medium 7, low 14.`, `Standaarddeadline per ernst: kritiek 1 dag, hoog 3, midden 7, laag 14.`)}</p>
                  </section>
                </div>

                <div className="sectioned-record-column">
                  <section className="record-section record-order-5" aria-label={text("Location", "Locatie")}>
                    <h3><span className="record-section-number">5</span> {text("Location", "Locatie")} <em className="record-section-required">*</em></h3>
                    <RecordBuildingsField id="hse-buildings" buildings={buildings} value={hseBuildingIds} onChange={(next) => { setHseBuildingIds(next); setHseBuildingId(next[0] ?? hseBuildingId); setHseLocationNodeId(""); }} />
                    <LocationPicker id="hse-location" nodes={data.locationNodes} buildingId={hseBuildingId} value={hseLocationNodeId} onChange={setHseLocationNodeId} requiredDepth={requiredLocationDepth} />
                    {/* Where on earth it was seen, next to where in the works it was seen. */}
                    <RecordLocationMap
                      client={client}
                      value={{ latitude: hseForm.latitude, longitude: hseForm.longitude }}
                      fallbackCenter={projectCenter}
                      contextLabel={`${buildings.find((building) => building.id === hseBuildingId)?.name ?? buildingName}, ${projectName}`}
                      onChange={(coordinates) => setHseForm((current) => ({ ...current, ...coordinates }))}
                      onUseMyLocation={captureHsePosition}
                      locating={hseLocating}
                      manualOpen={hseManualPosition}
                      onToggleManual={() => setHseManualPosition(!hseManualPosition)}
                    />
                    {hseLocationError ? <p className="field-error" role="alert">{hseLocationError}</p> : null}
                  </section>

                  <section className="record-section record-order-6" aria-label={text("Photos / evidence", "Foto's / bewijs")}>
                    <h3><span className="record-section-number">6</span> {text("Photos / evidence", "Foto's / bewijs")}</h3>
                    <div className="record-evidence-strip">
                      <PhotoEvidenceList
                        photos={hsePhotos}
                        setPhotos={setHsePhotos}
                        markupContext={{ ...markupOptions, defaultBuildingId: hseBuildingId }}
                        layout="gallery"
                      />
                      <label className="record-add-photo">
                        <Camera size={20} />
                        <strong>{text("Add photo", "Foto toevoegen")}</strong>
                        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotosToStack(event.currentTarget.files, setHsePhotos, setHsePhotoError); event.currentTarget.value = ""; }} />
                      </label>
                    </div>
                    <small className="record-photo-hint">{photoStripHint}</small>
                    {hsePhotoError ? <p className="field-error" role="alert">{hsePhotoError}</p> : null}
                  </section>

                  <section className="record-section record-order-7" aria-label={text("Immediate action taken", "Directe maatregel")}>
                    <h3><span className="record-section-number">7</span> {text("Immediate action taken", "Directe maatregel")}</h3>
                    <div className="record-action-grid">
                      {immediateActionsTaken.map((action) => (
                        <label className={`record-action-check${hseForm.immediateActions.includes(action.id) ? " active" : ""}`} key={action.id}>
                          <input type="checkbox" checked={hseForm.immediateActions.includes(action.id)} onChange={() => toggleHseAction(action.id)} />
                          {text(action.en, action.nl)}
                        </label>
                      ))}
                      <label className="record-action-check record-action-other">
                        <MoreHorizontal size={14} />
                        <input type="text" value={hseForm.immediateActionOther} onChange={(event) => setHseForm({ ...hseForm, immediateActionOther: event.target.value })} maxLength={240} aria-label={text("Other · specify", "Overig · omschrijf")} placeholder={text("Other · specify", "Overig · omschrijf")} />
                      </label>
                    </div>
                  </section>

                  <section className="record-section record-order-10" aria-label={text("Root cause", "Oorzaak")}>
                    <h3><span className="record-section-number">10</span> {text("Root cause", "Oorzaak")} <em className="record-section-optional">({text("optional", "optioneel")})</em></h3>
                    <label className="form-field"><select value={hseForm.rootCause} onChange={(event) => setHseForm({ ...hseForm, rootCause: event.target.value })}>
                      <option value="">{text("Select root cause", "Kies een oorzaak")}</option>
                      {recordRootCauses.map((cause) => <option value={cause.id} key={cause.id}>{text(cause.en, cause.nl)}</option>)}
                    </select></label>
                  </section>

                  <section className="record-section record-order-11" aria-label={text("Corrective action required", "Vereiste correctieve actie")}>
                    <h3><span className="record-section-number">11</span> {text("Corrective action required", "Vereiste correctieve actie")}</h3>
                    <label className="form-field">
                      <textarea rows={3} maxLength={1000} value={hseForm.correctiveAction} onChange={(event) => setHseForm({ ...hseForm, correctiveAction: event.target.value })} aria-label={text("What corrective action is required?", "Welke correctieve actie is nodig?")} placeholder={text("What corrective action is required?", "Welke correctieve actie is nodig?")} />
                      <DictateButton onText={(transcript) => setHseForm((current) => ({ ...current, correctiveAction: appendDictation(current.correctiveAction, transcript) }))} />
                    </label>
                  </section>

                  <section className="record-section record-order-12" aria-label={text("Notes", "Notities")}>
                    <h3><span className="record-section-number">12</span> {text("Notes", "Notities")} <em className="record-section-optional">({text("optional", "optioneel")})</em></h3>
                    <label className="form-field">
                      <textarea rows={3} maxLength={500} value={hseForm.notes} onChange={(event) => setHseForm({ ...hseForm, notes: event.target.value })} placeholder={text("Additional notes...", "Aanvullende notities...")} />
                      <div className="record-field-foot"><span /><span className="record-counter">{hseForm.notes.length} / 500</span></div>
                    </label>
                  </section>
                </div>
              </div>

              <label className="check-field"><input type="checkbox" checked={hseForm.confidential} onChange={(event) => setHseForm({ ...hseForm, confidential: event.target.checked })} /> {text("Restrict this sensitive incident to authorized HSE roles", "Beperk dit gevoelige incident tot bevoegde HSE-rollen")}</label>
              <RecordSignatureField
                value={hseSignature}
                onChange={setHseSignature}
                nameSuggestion={currentUserName}
                lockName
                locked={Boolean(data.hseEvents.find((item) => item.id === editingHseId)?.signature_image)}
                declaration={text("I confirm this HSE record is complete and accurate.", "Ik bevestig dat deze HSE-registratie volledig en juist is.")}
              />
              {/* The bar of the client's screen: leave it, park it, count the evidence,
                  submit it. */}
              <div className="record-form-actions">
                <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => { resetHseForm(); setShowForm(false); }}><X size={14} /> {text("Cancel", "Annuleren")}</button>
                <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => writeRecordDraft("hse", projectId, hseForm)}><Save size={14} /> {text("Save draft", "Concept opslaan")}</button>
                <label className="record-attachment-count">
                  <Paperclip size={14} /> {text(`Attachments (${hsePhotos.length})`, `Bijlagen (${hsePhotos.length})`)}
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotosToStack(event.currentTarget.files, setHsePhotos, setHsePhotoError); event.currentTarget.value = ""; }} />
                </label>
                <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || (exactLocationRequired && !hseLocationNodeId) || !hseForm.issueCategory || hseForm.responsiblePerson.trim().length < 2 || hseForm.description.trim().length < 3} onClick={() => void addHse()}><Send size={15} /> {text("Submit issue", "Issue indienen")}</button>
              </div>
            </RecordFormShell>
          ) : null}
          {/* The line under a record says what was filled in on the screen: the heading,
              the category, who has to act and by when. A box that is only asked for and
              never read back reads as a box that was not stored. */}
          <RecordList empty={text("No formal HSE records yet.", "Nog geen formele HSE-registraties.")} rows={data.hseEvents.map((event) => ({
            id: event.id,
            icon: ShieldCheck,
            title: event.confidential ? `${event.title} · ${text("confidential", "vertrouwelijk")}` : event.title,
            meta: [
              event.event_number,
              event.hse_category ? hseCategoryLabels[event.hse_category] ?? event.hse_category : "",
              event.issue_category || "",
              recordContextLabel(event.building_id, event.location_node_id, event.building_ids),
              typeText(event.event_type, text),
              formatDate(event.occurred_at, locale),
              event.responsible_person ? text(`for ${event.responsible_person}`, `voor ${event.responsible_person}`) : "",
              event.due_at ? `${text("deadline", "deadline")} ${formatDate(event.due_at, locale)}` : "",
              event.root_cause ? `${text("cause", "oorzaak")}: ${optionText(recordRootCauses, event.root_cause, text)}` : "",
            ].filter(Boolean).join(" · "),
            status: statusText(event.status, text),
            tone: event.severity === "critical" ? "red" : event.status === "closed" ? "green" : "",
            onOpen: () => viewHse(event),
            onEdit: event.status !== "cancelled" ? () => editHse(event) : undefined,
            onWithdraw: event.status !== "cancelled" ? () => withdrawRecord({ kind: "hse", id: event.id, code: event.event_number, title: event.title, status: event.status, meta: recordContextLabel(event.building_id, event.location_node_id, event.building_ids), description: event.description }) : undefined,
          }))} />
        </section>
      ) : null}

      {tab === "registers" ? (
        <section className="operation-panel">
          {showForm ? (
            <RecordFormShell
              code={data.registerEntries.find((item) => item.id === editingRegisterId)?.entry_number}
              title={registerNames[registerForm.type] ?? text("Project register item", "Projectregistratie")}
              status={editingRegisterId ? text("Editing", "Bewerken") : text("Draft", "Concept")}
              busy={busy}
              className={registerFormClassName}
              headerAside={controlledRegister ? <span className="controlled-document-badge">{projectCode} · {registerContextLabel}</span> : null}
            >
              <DraftNotice status={registerAutosave.status} savedAt={registerAutosave.savedAt} onDiscard={discardRegisterDraft} />
              {controlledRegister ? (
                <div className="form-grid controlled-document-primary">
                  <label className="form-field"><span>{registerForm.type === "technical_instruction" ? text("Instruction title / reference", "Titel / referentie instructie") : text("Title / reference", "Titel / referentie")}</span><input value={registerForm.title} onChange={(event) => setRegisterForm({ ...registerForm, title: event.target.value })} /></label>
                  <label className="form-field"><span>{registerForm.type === "technical_instruction" ? text("Instruction description", "Omschrijving instructie") : text("Formal request / instruction / observation", "Formeel verzoek / instructie / observatie")}</span><textarea value={registerForm.details} onChange={(event) => setRegisterForm({ ...registerForm, details: event.target.value })} rows={5} /><DictateButton onText={(transcript) => setRegisterForm((current) => ({ ...current, details: appendDictation(current.details, transcript) }))} /></label>
                </div>
              ) : null}
              {/* The form says what is being recorded — Materials delivery, Agreement,
                  RFI — instead of a general register heading with the answer hidden in a
                  dropdown below it. */}
              {/* "Zelfde als HSE": the head of the client's own delay report is what the
                  app already knows before a single box is filled in — the project, where
                  it is, who is reporting it, and the day and time it is being written. */}
              {delayReportRegister ? (
                <>
                  <section className="controlled-document-context sectioned-record-context" aria-label={text("Delay report header", "Kop van het vertragingsrapport")}>
                    <div><small>{text("Form no · automatic", "Formuliernummer · automatisch")}</small><strong>{text("On submit", "Bij indienen")}</strong><span>{text("Unique project code", "Unieke projectcode")}</span></div>
                    <div><small>{text("Project", "Project")}</small><strong>{projectName}</strong><span>{projectCode}</span></div>
                    <div><small>{text("Location / area", "Locatie / gebied")}</small><strong>{registerContextLabel}</strong><span>{registerLocationNodeId ? locationBreadcrumb(data.locationNodes, registerLocationNodeId) : text("Building level", "Gebouwniveau")}</span></div>
                    <div><small>{text("Date and time", "Datum en tijd")}</small><strong>{issueDateLabel}</strong><span>{issueTime}</span></div>
                    <div><small>{text("Reported by", "Gemeld door")}</small><strong>{currentUserName}</strong><span>{reporterDepartment}</span></div>
                  </section>
                </>
              ) : null}
              {/* A controlled document starts with the project information and the dates:
                  that is the head of the paper form the client hands out. */}
              {controlledRegister ? (
                <>
                <section className="controlled-document-context" aria-label={text("Project information", "Projectinformatie")}>
                  <div><small>{text("Project", "Project")}</small><strong>{projectName}</strong><span>{projectCode}</span></div>
                  <div><small>{text("Applies to", "Geldt voor")}</small><strong>{registerContextLabel}</strong><span>{registerLocationNodeId ? locationBreadcrumb(data.locationNodes, registerLocationNodeId) : text("Building level", "Gebouwniveau")}</span></div>
                  <div><small>{text("Issue date and time", "Uitgiftedatum en -tijd")}</small><strong>{documentIssueDateLabel}</strong><span>{documentIssueTime}</span></div>
                  <div>
                    <small>{text("Drawn up by", "Opgemaakt door")}</small>
                    <strong>{registerForm.issuerName.trim() || currentUserName}</strong>
                    <span>{registerForm.signedBy ? text("Signed", "Ondertekend") : text("Not signed yet", "Nog niet ondertekend")}</span>
                    {!submittedRegister && !registerForm.signedBy ? (
                      <details className="controlled-document-author-edit">
                        <summary>{text("Change author", "Opsteller wijzigen")}</summary>
                        <label className="form-field">
                          <span>{text("Document author", "Opsteller document")}</span>
                          <input list="controlled-document-author-options" value={registerForm.issuerName || currentUserName} onChange={(event) => setRegisterForm({ ...registerForm, issuerName: event.target.value })} />
                          <datalist id="controlled-document-author-options">{documentIssuerOptions.map((name) => <option value={name} key={name} />)}</datalist>
                        </label>
                      </details>
                    ) : null}
                  </div>
                </section>

                </>
              ) : null}
              <div className="form-grid-2">
                <RecordBuildingsField id="register-buildings" buildings={buildings} value={registerBuildingIds} onChange={(next) => { setRegisterBuildingIds(next); setRegisterBuildingId(next[0] ?? registerBuildingId); setRegisterLocationNodeId(""); }} />
                <LocationPicker id="register-location" nodes={data.locationNodes} buildingId={registerBuildingId} value={registerLocationNodeId} onChange={setRegisterLocationNodeId} requiredDepth={requiredLocationDepth} />
                {(!controlledRegister || submittedRegister) ? <details className="optional-text-entry register-type-switch">
                  <summary>{text("Record something else", "Iets anders vastleggen")}</summary>
                  {/* Switching format starts the other form empty. Carrying a delay's
                      baseline date into a change order is how a wrong date gets signed. */}
                  <label className="form-field"><span>{text("Register / document format", "Register / documentformaat")}</span><select value={registerForm.type} onChange={(event) => {
                    setRegisterForm({ ...emptyControlledDocumentDraft, type: event.target.value });
                    setAgreementForm({ ...emptyAgreementSignature });
                    setAgreementRecord({ ...emptyAgreementRecord });
                    setChangeOrder({ ...emptyChangeOrder });
                    setDelayForm({ ...emptyDelayReport });
                    setLessonForm({ ...emptyLessonLearned });
                    setRegisterNamedPhotos({});
                  }}>{Object.entries(registerNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                </details> : null}
                {registerDrawings.length ? (
                  <label className="form-field"><span>{text("Location on drawing", "Locatie op tekening")}</span>
                    <select value={registerDrawingId} onChange={(event) => setRegisterDrawingId(event.target.value)}>
                      <option value="">{text("No drawing selected", "Geen tekening gekozen")}</option>
                      {registerDrawings.map((drawing) => <option value={drawing.id} key={drawing.id}>{drawing.original_name}</option>)}
                    </select>
                    <button className="field-inline-link" type="button" onClick={() => switchTab("drawings")}><MapPin size={12} /> {text("Open the drawing to place a pin", "Open de tekening om een pin te plaatsen")}</button>
                  </label>
                ) : null}
              </div>
              {controlledRegister ? (
                <label className="form-field controlled-document-deadline">
                  <span>{registerForm.type === "technical_instruction" ? text("Instruction deadline / required by", "Deadline instructie / uitvoeren uiterlijk") : text("Response / information required by", "Antwoord / informatie nodig uiterlijk")}</span>
                  <input type="date" min={editingRegisterId ? undefined : issueDate} value={registerForm.dueDate} onChange={(event) => setRegisterForm({ ...registerForm, dueDate: event.target.value })} />
                </label>
              ) : null}
              {activeRegisterPresets.length ? <div className="quick-issue-presets" aria-label={text("Choose a standard register item", "Kies een standaard registeritem")}>{activeRegisterPresets.map((preset) => <button className={registerForm.title === preset.title ? "active" : ""} type="button" onClick={() => setRegisterForm({ ...registerForm, ...preset })} key={preset.title}>{preset.title}</button>)}</div> : null}
              {delayReportRegister ? (
                /* The client's own Project Delay Report. The header above this — project,
                   location, reporter, date and time — is filled by the app, "zelfde als
                   HSE"; what follows is the delay itself, in the client's own sections. */
                <div className="record-form-sections delay-report-sections">
                  <RecordFormSection
                    number={1}
                    title={text("Delay details", "Details van de vertraging")}
                  >
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Activity / work affected", "Activiteit / getroffen werk")}</span><select value={delayForm.activity} onChange={(event) => setDelayForm({ ...delayForm, activity: event.target.value })}><option value="">{text("Select activity / work", "Kies activiteit / werk")}</option>{delayActivities.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}</select></label>
                      {/* The duration is what moves the finish date, so it stands with the
                          dates it drives, not on the far side of the form. */}
                      <label className="form-field"><span>{text("Delay duration (calendar days)", "Duur van de vertraging (kalenderdagen)")}</span><input type="number" min="0" step="1" value={delayForm.durationDays} onChange={(event) => setDelayForm({ ...delayForm, durationDays: event.target.value, newExpectedFinishDate: delayRevisedFinishDate(delayForm.originalFinishDate, event.target.value) })} /></label>
                    </div>
                    <label className="form-field"><span>{text("Description of delay (brief)", "Omschrijving van de vertraging (kort)")}</span><textarea rows={3} maxLength={250} value={delayForm.description} onChange={(event) => setDelayForm({ ...delayForm, description: event.target.value })} placeholder={text("Describe the delay briefly.", "Beschrijf de vertraging kort.")} /><DictateButton onText={(transcript) => setDelayForm((current) => ({ ...current, description: appendDictation(current.description, transcript) }))} /></label>
                    <div className="form-grid-2 delay-choice-columns">
                      <div className="form-field">
                        <span>{text("Delay category", "Categorie van de vertraging")}</span>
                        <div className="record-action-grid">
                          {delayCategories.map((option) => (
                            <label className={`record-action-check${delayForm.categories.includes(option.id) ? " active" : ""}`} key={option.id}>
                              <input type="checkbox" checked={delayForm.categories.includes(option.id)} onChange={() => setDelayForm((current) => ({ ...current, categories: current.categories.includes(option.id) ? current.categories.filter((item) => item !== option.id) : [...current.categories, option.id] }))} />
                              {text(option.en, option.nl)}
                            </label>
                          ))}
                        </div>
                        {delayForm.categories.includes("other") ? <input className="delay-other-input" value={delayForm.categoryOther} maxLength={240} onChange={(event) => setDelayForm({ ...delayForm, categoryOther: event.target.value })} placeholder={text("Specify", "Omschrijf")} /> : null}
                      </div>
                      <div className="form-field">
                        <span>{text("Delay type", "Soort vertraging")}</span>
                        <div className="record-action-grid">
                          {delayTypes.map((option) => (
                            <label className={`record-action-check${delayForm.types.includes(option.id) ? " active" : ""}`} key={option.id}>
                              <input type="checkbox" checked={delayForm.types.includes(option.id)} onChange={() => setDelayForm((current) => ({ ...current, types: current.types.includes(option.id) ? current.types.filter((item) => item !== option.id) : [...current.types, option.id] }))} />
                              {text(option.en, option.nl)}
                            </label>
                          ))}
                        </div>
                        {delayForm.types.includes("other") ? <input className="delay-other-input" value={delayForm.typeOther} maxLength={240} onChange={(event) => setDelayForm({ ...delayForm, typeOther: event.target.value })} placeholder={text("Specify", "Omschrijf")} /> : null}
                      </div>
                    </div>
                    <div className="form-field">
                      <span>{text("Delay impact", "Impact van de vertraging")}</span>
                      <div className="record-action-grid">
                        {delayImpacts.map((option) => (
                          <label className={`record-action-check${delayForm.impacts.includes(option.id) ? " active" : ""}`} key={option.id}>
                            <input type="checkbox" checked={delayForm.impacts.includes(option.id)} onChange={() => setDelayForm((current) => ({ ...current, impacts: current.impacts.includes(option.id) ? current.impacts.filter((item) => item !== option.id) : [...current.impacts, option.id] }))} />
                            {text(option.en, option.nl)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </RecordFormSection>

                  <RecordFormSection
                    number={2}
                    title={text("Delay dates", "Datums van de vertraging")}
                  >
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Original finish date (baseline)", "Oorspronkelijke einddatum (baseline)")}</span><input type="date" value={delayForm.originalFinishDate} onChange={(event) => setDelayForm({ ...delayForm, originalFinishDate: event.target.value, newExpectedFinishDate: delayRevisedFinishDate(event.target.value, delayForm.durationDays) })} /></label>
                      {/* Calculated, never typed: two fields that can disagree about the
                          same fact are two chances to be wrong. */}
                      <label className="form-field"><span>{text("New expected finish date (revised) · calculated", "Nieuwe verwachte einddatum (herzien) · berekend")}</span><input type="date" value={delayForm.newExpectedFinishDate || delayRevisedFinishDate(delayForm.originalFinishDate, delayForm.durationDays)} readOnly /></label>
                    </div>
                  </RecordFormSection>

                  <RecordFormSection
                    number={3}
                    title={text("Status on original finish date", "Status op de oorspronkelijke einddatum")}
                  >
                    <div className="form-grid-2 named-photo-pair">
                      <div className="form-field">
                        <label className="form-field"><span>{text("Actual status on this date", "Werkelijke status op deze datum")}</span><select value={delayForm.statusOnFinishDate} onChange={(event) => setDelayForm({ ...delayForm, statusOnFinishDate: event.target.value })}><option value="">{text("Select status", "Kies status")}</option>{delayStatusOnFinishDate.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}</select></label>
                        {/* "Eventueel korte omschrijving": the status in one word, and room
                            for the sentence that explains it when one word is not enough. */}
                        <label className="form-field"><span>{text("Short description (optional)", "Korte omschrijving (optioneel)")}</span><textarea rows={2} maxLength={250} value={delayForm.statusDescription} onChange={(event) => setDelayForm({ ...delayForm, statusDescription: event.target.value })} /><DictateButton onText={(transcript) => setDelayForm((current) => ({ ...current, statusDescription: appendDictation(current.statusDescription, transcript) }))} /></label>
                      </div>
                      <NamedPhotoSlot
                        label={text("Actual photo on original finish date", "Foto op de oorspronkelijke einddatum")}
                        required
                        value={registerNamedPhotos.delay_status ?? null}
                        onChange={(photo) => setNamedPhoto("delay_status", photo)}
                        markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId }}
                        maxSizeMb={data.settings?.max_file_size_mb ?? 25}
                        defaults={{ category: "progress" }}
                      />
                    </div>
                  </RecordFormSection>

                  <RecordFormSection
                    number={4}
                    title={text("Contractor acknowledgement", "Erkenning door de aannemer")}
                  >
                    <label className="form-field"><span>{text("Proposed recovery plan (brief)", "Voorgesteld inloopplan (kort)")}</span><textarea rows={3} maxLength={250} value={delayForm.recoveryPlan} onChange={(event) => setDelayForm({ ...delayForm, recoveryPlan: event.target.value })} /><DictateButton onText={(transcript) => setDelayForm((current) => ({ ...current, recoveryPlan: appendDictation(current.recoveryPlan, transcript) }))} /></label>
                    <label className="form-field"><span>{text("Contractor representative", "Vertegenwoordiger aannemer")}</span><input list="delay-contractors" value={delayForm.contractorRepresentative} onChange={(event) => setDelayForm({ ...delayForm, contractorRepresentative: event.target.value })} placeholder={text("Enter name", "Voer naam in")} /><datalist id="delay-contractors">{parties.map((party) => <option value={party.name} key={party.id} />)}</datalist></label>
                    <SignatureField
                      label={text("Signature · contractor representative", "Handtekening · vertegenwoordiger aannemer")}
                      declaration={text(
                        "By signing you acknowledge this delay and the recovery plan written above.",
                        "Met je handtekening erken je deze vertraging en het hierboven beschreven inloopplan.",
                      )}
                      hint={text("Signature, name and date are stored with the report.", "Handtekening, naam en datum worden bij het rapport bewaard.")}
                      nameSuggestion={delayForm.contractorRepresentative}
                      value={signatureFromDetails(delayForm.contractorSignedBy, delayForm.contractorSignedAt, delayForm.contractorSignatureImage)}
                      onChange={(signature) => setDelayForm({
                        ...delayForm,
                        contractorSignedBy: signature?.name ?? "",
                        contractorSignedAt: signature?.signedAt ?? "",
                        contractorSignatureImage: signature?.image ?? "",
                        contractorRepresentative: signature?.name || delayForm.contractorRepresentative,
                      })}
                    />
                  </RecordFormSection>

                  <RecordFormSection
                    number={5}
                    title={text("Completion verification", "Verificatie van de afronding")}
                  >
                    <div className="form-grid-2 named-photo-pair">
                      <div className="form-field">
                        <label className="form-field"><span>{text("Actual completed date", "Werkelijke afrondingsdatum")}</span><input type="date" value={delayForm.actualCompletedDate} onChange={(event) => setDelayForm({ ...delayForm, actualCompletedDate: event.target.value })} /></label>
                        {/* "STATUS!": a completion date on its own does not say whether the
                            recovery worked. */}
                        <label className="form-field"><span>{text("Status", "Status")}</span><select value={delayForm.completionStatus} onChange={(event) => setDelayForm({ ...delayForm, completionStatus: event.target.value })}><option value="">{text("Not completed yet", "Nog niet afgerond")}</option>{delayCompletionStatuses.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}</select></label>
                      </div>
                      <NamedPhotoSlot
                        label={text("Photo as evidence of completion", "Foto als bewijs van afronding")}
                        required={delayCompletionStarted(delayForm)}
                        hint={text("Required once this box is filled in.", "Verplicht zodra dit vak is ingevuld.")}
                        value={registerNamedPhotos.delay_completion ?? null}
                        onChange={(photo) => setNamedPhoto("delay_completion", photo)}
                        markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId }}
                        maxSizeMb={data.settings?.max_file_size_mb ?? 25}
                        defaults={{ category: "progress" }}
                      />
                    </div>
                    <label className="form-field"><span>{text("Remarks (optional)", "Opmerkingen (optioneel)")}</span><textarea rows={2} maxLength={500} value={delayForm.completionRemarks} onChange={(event) => setDelayForm({ ...delayForm, completionRemarks: event.target.value })} /><DictateButton onText={(transcript) => setDelayForm((current) => ({ ...current, completionRemarks: appendDictation(current.completionRemarks, transcript) }))} /></label>
                  </RecordFormSection>
                </div>
              ) : changeOrderRegister ? (
                /* The client's own Change Order form. A change order is a contract change,
                   so it is asked for as one: what changes, why, what exactly moves, and
                   what that does to the finish date. */
                <div className="record-form-sections change-order-sections">
                  <RecordFormSection
                    number={1}
                    title={text("Change description", "Omschrijving van de wijziging")}
                  >
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Change order type", "Type wijzigingsopdracht")}</span><select value={changeOrder.changeOrderType} onChange={(event) => setChangeOrder({ ...changeOrder, changeOrderType: event.target.value })}><option value="">{text("Select type", "Kies type")}</option>{changeOrderTypes.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}</select></label>
                      <label className="form-field"><span>{text("Reason for change", "Reden van de wijziging")}</span><select value={changeOrder.reason} onChange={(event) => setChangeOrder({ ...changeOrder, reason: event.target.value })}><option value="">{text("Select reason", "Kies reden")}</option>{changeOrderReasons.map((option) => <option value={option.id} key={option.id}>{text(option.en, option.nl)}</option>)}</select></label>
                    </div>
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Requested by", "Aangevraagd door")}</span><input list="change-order-requesters" value={changeOrder.requestedBy} onChange={(event) => setChangeOrder({ ...changeOrder, requestedBy: event.target.value })} placeholder={text("Enter name", "Voer naam in")} /><datalist id="change-order-requesters">{documentIssuerOptions.map((name) => <option value={name} key={name} />)}{parties.map((party) => <option value={party.name} key={party.id} />)}</datalist></label>
                    </div>
                  </RecordFormSection>

                  <RecordFormSection
                    number={2}
                    title={text("Scope of change", "Omvang van de wijziging")}
                  >
                    <div className="record-action-grid">
                      {changeOrderScopeAreas.map((area) => (
                        <label className={`record-action-check${changeOrder.scopeAreas.includes(area.id) ? " active" : ""}`} key={area.id}>
                          <input
                            type="checkbox"
                            checked={changeOrder.scopeAreas.includes(area.id)}
                            onChange={() => setChangeOrder((current) => ({
                              ...current,
                              scopeAreas: current.scopeAreas.includes(area.id)
                                ? current.scopeAreas.filter((item) => item !== area.id)
                                : [...current.scopeAreas, area.id],
                            }))}
                          />
                          {text(area.en, area.nl)}
                        </label>
                      ))}
                    </div>
                    {changeOrder.scopeAreas.includes("other") ? (
                      <label className="form-field"><span>{text("Other · specify", "Overig · omschrijf")}</span><input value={changeOrder.scopeAreaOther} maxLength={240} onChange={(event) => setChangeOrder({ ...changeOrder, scopeAreaOther: event.target.value })} /></label>
                    ) : null}
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Details / what will change?", "Details / wat verandert er?")}</span><textarea rows={4} maxLength={1000} value={changeOrder.scopeDetails} onChange={(event) => setChangeOrder({ ...changeOrder, scopeDetails: event.target.value })} /><DictateButton onText={(transcript) => setChangeOrder((current) => ({ ...current, scopeDetails: appendDictation(current.scopeDetails, transcript) }))} /></label>
                      <NamedPhotoSlot
                        label={text("Photo (scope / reference)", "Foto (scope / referentie)")}
                        value={registerNamedPhotos.change_scope ?? null}
                        onChange={(photo) => setNamedPhoto("change_scope", photo)}
                        markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId }}
                        maxSizeMb={data.settings?.max_file_size_mb ?? 25}
                        defaults={{ category: "overview" }}
                      />
                    </div>
                  </RecordFormSection>
                </div>
              ) : controlledRegister ? null : agreementRegister ? (
                /* The client's own "Agreements Made" form, in its own four numbered
                   boxes: what was agreed, who owns it, who signs for it and — once the
                   work is done — the date and the picture that close it. */
                <div className="record-form-sections agreement-sections">
                  <RecordFormSection
                    number={1}
                    title={text("Agreement details", "Details van de afspraak")}
                  >
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Subject / topic", "Onderwerp")}</span><input value={registerForm.title} onChange={(event) => setRegisterForm({ ...registerForm, title: event.target.value })} placeholder={text("Enter subject / topic", "Voer onderwerp in")} /></label>
                      <label className="form-field"><span>{text("Implement / execute by", "Uitvoeren uiterlijk")}</span><input type="date" value={registerForm.dueDate} onChange={(event) => setRegisterForm({ ...registerForm, dueDate: event.target.value })} /></label>
                    </div>
                    <label className="form-field"><span>{text("Description of agreement", "Omschrijving van de afspraak")}</span><textarea value={registerForm.details} onChange={(event) => setRegisterForm({ ...registerForm, details: event.target.value })} rows={5} /><DictateButton onText={(transcript) => setRegisterForm((current) => ({ ...current, details: appendDictation(current.details, transcript) }))} /></label>
                    <div className="form-grid-2">
                      <div className="form-field">
                        <span>{text("Priority", "Prioriteit")}</span>
                        <div className="quick-issue-presets">
                          {([["low", text("Low", "Laag")], ["normal", text("Normal", "Normaal")], ["high", text("High", "Hoog")], ["critical", text("Critical", "Kritiek")]] as const).map(([value, label]) => (
                            <button className={agreementRecord.priority === value ? "active" : ""} type="button" onClick={() => setAgreementRecord({ ...agreementRecord, priority: value })} key={value}>{label}</button>
                          ))}
                        </div>
                      </div>
                      <NamedPhotoSlot
                        label={text("Photo / evidence (optional)", "Foto / bewijs (optioneel)")}
                        value={registerNamedPhotos.agreement_evidence ?? null}
                        onChange={(photo) => setNamedPhoto("agreement_evidence", photo)}
                        markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId }}
                        maxSizeMb={data.settings?.max_file_size_mb ?? 25}
                        defaults={{ category: "overview" }}
                      />
                    </div>
                  </RecordFormSection>

                  <RecordFormSection
                    number={2}
                    title={text("Action owner", "Eigenaar van de actie")}
                  >
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Responsible party", "Verantwoordelijke partij")}</span><select value={registerForm.responsiblePartyId} onChange={(event) => setRegisterForm({ ...registerForm, responsiblePartyId: event.target.value })}><option value="">{text("Select party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
                      <div className="form-field">
                        <span>{text("Status", "Status")}</span>
                        <div className="quick-issue-presets">
                          {([["open", text("Open", "Open")], ["in_progress", text("In progress", "In uitvoering")], ["completed", text("Completed", "Afgerond")]] as const).map(([value, label]) => (
                            <button className={agreementRecord.status === value ? "active" : ""} type="button" onClick={() => setAgreementRecord({ ...agreementRecord, status: value })} key={value}>{label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Responsible person", "Verantwoordelijke persoon")}</span><input value={agreementRecord.responsiblePerson} onChange={(event) => setAgreementRecord({ ...agreementRecord, responsiblePerson: event.target.value })} placeholder={text("Enter name", "Voer naam in")} /></label>
                      <label className="form-field"><span>{text("Remarks (optional)", "Opmerkingen (optioneel)")}</span><textarea rows={3} maxLength={500} value={agreementRecord.remarks} onChange={(event) => setAgreementRecord({ ...agreementRecord, remarks: event.target.value })} /><DictateButton onText={(transcript) => setAgreementRecord((current) => ({ ...current, remarks: appendDictation(current.remarks, transcript) }))} /></label>
                    </div>
                  </RecordFormSection>

                  <RecordFormSection
                    number={3}
                    title={text("Agreement confirmation", "Bevestiging van de afspraak")}
                  >
                    <AgreementSignatureFields
                      options={agreementPartyOptions}
                      value={agreementForm}
                      onChange={setAgreementForm}
                      roleLabels={[text("Contractor representative", "Vertegenwoordiger aannemer"), text("Supervision (consultant)", "Supervisie (consultant)")]}
                    />
                  </RecordFormSection>

                  <RecordFormSection
                    number={4}
                    title={text("Completion", "Afronding")}
                  >
                    <div className="form-grid-2">
                      <label className="form-field"><span>{text("Actual completion date", "Werkelijke afrondingsdatum")}</span><input type="date" value={agreementRecord.actualCompletionDate} onChange={(event) => setAgreementRecord({ ...agreementRecord, actualCompletionDate: event.target.value })} /></label>
                      <NamedPhotoSlot
                        label={text("Photo as evidence", "Foto als bewijs")}
                        value={registerNamedPhotos.agreement_completion ?? null}
                        onChange={(photo) => setNamedPhoto("agreement_completion", photo)}
                        markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId }}
                        maxSizeMb={data.settings?.max_file_size_mb ?? 25}
                        defaults={{ category: "repair" }}
                      />
                    </div>
                    <div className="form-field">
                      <span>{text("Completion status", "Status van afronding")}</span>
                      <div className="quick-issue-presets">
                        {([["completed", text("Completed", "Afgerond")], ["partially_completed", text("Partially completed", "Deels afgerond")], ["not_completed", text("Not completed", "Niet afgerond")]] as const).map(([value, label]) => (
                          <button className={agreementRecord.completionStatus === value ? "active" : ""} type="button" onClick={() => setAgreementRecord({ ...agreementRecord, completionStatus: agreementRecord.completionStatus === value ? "" : value })} key={value}>{label}</button>
                        ))}
                      </div>
                      {/* "+ datum": a completion status without the date it was reached says
                          nothing a month later. Choosing one fills today's date unless a
                          date was already written. */}
                      {agreementRecord.completionStatus && !agreementRecord.actualCompletionDate ? (
                        <small>{text("Enter the completion date above.", "Vul hierboven de afrondingsdatum in.")}</small>
                      ) : null}
                    </div>
                    <label className="form-field"><span>{text("Remarks (optional)", "Opmerkingen (optioneel)")}</span><textarea rows={2} maxLength={500} value={agreementRecord.completionRemarks} onChange={(event) => setAgreementRecord({ ...agreementRecord, completionRemarks: event.target.value })} /><DictateButton onText={(transcript) => setAgreementRecord((current) => ({ ...current, completionRemarks: appendDictation(current.completionRemarks, transcript) }))} /></label>
                  </RecordFormSection>
                </div>
              ) : lessonsLearnedRegister ? (
                <>
                  {/* Capture, learn and improve: the client's own form, as one project
                      phase and four short questions instead of a free-text register line. */}
                  <label className="form-field"><span>{text("Project phase", "Projectfase")}</span><select value={lessonForm.projectPhase} onChange={(event) => setLessonForm({ ...lessonForm, projectPhase: event.target.value })}><option value="">{text("Choose a phase", "Kies een fase")}</option>{lessonProjectPhases.map((phase) => <option value={phase.id} key={phase.id}>{text(phase.en, phase.nl)}</option>)}</select></label>
                  <div className="form-grid">
                    <label className="form-field"><span>{text("Issue", "Probleem")}</span><textarea rows={3} value={lessonForm.issue} onChange={(event) => setLessonForm({ ...lessonForm, issue: event.target.value })} /><DictateButton onText={(transcript) => setLessonForm((current) => ({ ...current, issue: appendDictation(current.issue, transcript) }))} /></label>
                    <label className="form-field"><span>{text("Cause", "Oorzaak")}</span><textarea rows={3} value={lessonForm.cause} onChange={(event) => setLessonForm({ ...lessonForm, cause: event.target.value })} /><DictateButton onText={(transcript) => setLessonForm((current) => ({ ...current, cause: appendDictation(current.cause, transcript) }))} /></label>
                    <label className="form-field"><span>{text("Solution / improvement", "Oplossing / verbetering")}</span><textarea rows={3} value={lessonForm.solution} onChange={(event) => setLessonForm({ ...lessonForm, solution: event.target.value })} /><DictateButton onText={(transcript) => setLessonForm((current) => ({ ...current, solution: appendDictation(current.solution, transcript) }))} /></label>
                    <label className="form-field"><span>{text("Expected results", "Verwacht resultaat")}</span><textarea rows={3} value={lessonForm.expectedResults} onChange={(event) => setLessonForm({ ...lessonForm, expectedResults: event.target.value })} /><DictateButton onText={(transcript) => setLessonForm((current) => ({ ...current, expectedResults: appendDictation(current.expectedResults, transcript) }))} /></label>
                  </div>
                  {/* The two pictures the client's own form marks required: the problem as
                      it was found, and the result after the improvement. A lesson nobody
                      can see is a lesson the next crew reads past. */}
                  <div className="form-grid-2 named-photo-pair">
                    <NamedPhotoSlot
                      label={text("Picture of issue", "Foto van het probleem")}
                      required
                      value={registerNamedPhotos.lesson_issue ?? null}
                      onChange={(photo) => setNamedPhoto("lesson_issue", photo)}
                      markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId }}
                      maxSizeMb={data.settings?.max_file_size_mb ?? 25}
                      defaults={{ category: "deficiency" }}
                    />
                    <NamedPhotoSlot
                      label={text("Picture of result", "Foto van het resultaat")}
                      required
                      value={registerNamedPhotos.lesson_result ?? null}
                      onChange={(photo) => setNamedPhoto("lesson_result", photo)}
                      markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId }}
                      maxSizeMb={data.settings?.max_file_size_mb ?? 25}
                      defaults={{ category: "repair" }}
                    />
                  </div>
                  {/* Follow-up: what still has to happen, who does it, and where it
                      stands — no target date, the client struck that field off the form. */}
                  <label className="form-field"><span>{text("Follow-up action", "Vervolgactie")}</span><textarea rows={2} value={lessonForm.followUpAction} onChange={(event) => setLessonForm({ ...lessonForm, followUpAction: event.target.value })} /><DictateButton onText={(transcript) => setLessonForm((current) => ({ ...current, followUpAction: appendDictation(current.followUpAction, transcript) }))} /></label>
                  <div className="form-grid-2">
                    <label className="form-field"><span>{text("Responsible person", "Verantwoordelijke")}</span><input value={lessonForm.responsiblePerson} onChange={(event) => setLessonForm({ ...lessonForm, responsiblePerson: event.target.value })} /></label>
                    <div className="form-field">
                      <span>{text("Status", "Status")}</span>
                      <div className="quick-issue-presets">
                        {([["open", text("Open", "Open")], ["in_progress", text("In progress", "In uitvoering")], ["closed", text("Closed", "Afgerond")]] as const).map(([value, label]) => (
                          <button className={lessonForm.status === value ? "active" : ""} type="button" onClick={() => setLessonForm({ ...lessonForm, status: value })} key={value}>{label}</button>
                        ))}
                      </div>
                    </div>
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
                    <div className="register-line-list">
                      {registerLines.map((line, index) => (
                        <div className="register-line" key={index}>
                          <label className="form-field"><span>{text("Quantity", "Hoeveelheid")}</span><input type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => setRegisterLines((lines) => lines.map((item, position) => position === index ? { ...item, quantity: event.target.value } : item))} /></label>
                          <label className="form-field"><span>{text("Unit", "Eenheid")}</span><input value={line.unit} onChange={(event) => setRegisterLines((lines) => lines.map((item, position) => position === index ? { ...item, unit: event.target.value } : item))} placeholder={text("pcs, m³, kg", "st, m³, kg")} /></label>
                          <label className="form-field"><span>{text("Description · optional", "Omschrijving · optioneel")}</span><input value={line.description} onChange={(event) => setRegisterLines((lines) => lines.map((item, position) => position === index ? { ...item, description: event.target.value } : item))} placeholder={text("What was delivered on this line", "Wat op deze regel is geleverd")} /></label>
                          <button className="ui-button ui-button--quiet ui-button--md register-line-remove" type="button" disabled={registerLines.length === 1} aria-label={text("Remove this line", "Verwijder deze regel")} onClick={() => setRegisterLines((lines) => lines.filter((item, position) => position !== index))}><X size={14} /></button>
                        </div>
                      ))}
                      <button className="ui-button ui-button--secondary ui-button--md register-line-add" type="button" onClick={() => setRegisterLines((lines) => [...lines, { quantity: "", unit: "", description: "" }])}><Plus size={15} /> {text("Add a line", "Regel toevoegen")}</button>
                    </div>
                  </div>
                ) : null}
                {/* The title and the words of the record stand in the open: the client
                    crossed out the fold-out that hid them. */}
                <div className="form-grid">
                  <label className="form-field"><span>{text("Title / reference", "Titel / referentie")}</span><input value={registerForm.title} onChange={(event) => setRegisterForm({ ...registerForm, title: event.target.value })} /></label>
                  <label className="form-field"><span>{text("Details, measure or decision", "Details, maatregel of besluit")}</span><textarea value={registerForm.details} onChange={(event) => setRegisterForm({ ...registerForm, details: event.target.value })} rows={3} /><DictateButton onText={(transcript) => setRegisterForm((current) => ({ ...current, details: appendDictation(current.details, transcript) }))} /></label>
                </div>
                </>
              )}
              {controlledRegister ? <>
                {editingRegisterId ? <label className="form-field"><span>{text("Revision", "Revisie")}</span><input value={registerForm.revision} onChange={(event) => setRegisterForm({ ...registerForm, revision: event.target.value })} /></label> : null}
                {/* Who draws the document up is a choice, not always the person logged in. */}
                {submittedRegister ? (
                  <div className="form-grid-2">
                    <label className="form-field"><span>{text("Submitted by · name on the form", "Ingediend door · naam op het formulier")}</span><input value={registerForm.issuerName} onChange={(event) => setRegisterForm({ ...registerForm, issuerName: event.target.value })} placeholder={text("Name of the contractor's signatory", "Naam van de ondertekenaar bij de aannemer")} /></label>
                    <label className="form-field"><span>{text("Position", "Functie")}</span><input value={registerForm.issuerPosition} onChange={(event) => setRegisterForm({ ...registerForm, issuerPosition: event.target.value })} placeholder="Quality Control" /></label>
                  </div>
                ) : null}
                {/* The party you address it to is the recipient; a second free-text name
                    next to it, plus reference fields nobody filled, are gone. */}
                <label className="form-field"><span>{text("To:", "Aan:")}</span><select value={registerForm.responsiblePartyId} onChange={(event) => { const party = parties.find((item) => item.id === event.target.value); setRegisterForm({ ...registerForm, responsiblePartyId: event.target.value, requestedTo: party?.name ?? "" }); }}><option value="">{text("Choose party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name} · {partyTypeText(party.type, text)}</option>)}</select></label>
                <details className="controlled-document-optional-attachments">
                  <summary>{text("Additional attachment notes", "Extra bijlageninformatie")}</summary>
                  <label className="form-field"><span>{text("Page count or reference (if applicable)", "Aantal pagina's of referentie (indien van toepassing)")}</span><input value={registerForm.attachments} onChange={(event) => setRegisterForm({ ...registerForm, attachments: event.target.value })} /></label>
                </details>
                <label className="ui-button ui-button--secondary ui-button--md file-button controlled-document-upload">
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
                {registerForm.type === "technical_instruction" ? <details className="controlled-document-optional-impact"><summary>{text("Schedule and cost impact", "Planning- en kostenimpact")}</summary><div className="form-grid-2"><label className="form-field"><span>{text("Schedule impact", "Planningimpact")}</span><select value={registerForm.scheduleImpact} onChange={(event) => setRegisterForm({ ...registerForm, scheduleImpact: event.target.value })}><option value="none">None</option><option value="possible">Possible</option><option value="confirmed">Confirmed</option><option value="unknown">To be assessed</option></select></label><label className="form-field"><span>{text("Cost impact", "Kostenimpact")}</span><select value={registerForm.costImpact} onChange={(event) => setRegisterForm({ ...registerForm, costImpact: event.target.value })}><option value="none">None</option><option value="possible">Possible</option><option value="confirmed">Confirmed</option><option value="unknown">To be assessed</option></select></label></div><label className="form-field"><span>{text("Impact explanation", "Toelichting impact")}</span><textarea rows={2} value={registerForm.impactExplanation} onChange={(event) => setRegisterForm({ ...registerForm, impactExplanation: event.target.value })} /><DictateButton onText={(transcript) => setRegisterForm((current) => ({ ...current, impactExplanation: appendDictation(current.impactExplanation, transcript) }))} /></label></details> : null}
                {changeOrderRegister ? (
                  <div className="record-form-sections change-order-sections">
                    <RecordFormSection
                      number={3}
                      title={text("Schedule impact", "Planningimpact")}
                    >
                      <div className="form-field">
                        <span>{text("Does this change affect the schedule?", "Heeft deze wijziging invloed op de planning?")}</span>
                        <div className="quick-issue-presets">
                          {([[true, text("Yes", "Ja")], [false, text("No", "Nee")]] as const).map(([value, label]) => (
                            <button className={changeOrder.affectsSchedule === value ? "active" : ""} type="button" onClick={() => setChangeOrder({ ...changeOrder, affectsSchedule: value })} key={String(value)}>{label}</button>
                          ))}
                        </div>
                      </div>
                      {changeOrder.affectsSchedule ? (
                        <div className="form-grid-2">
                          <label className="form-field"><span>{text("Original finish date (baseline)", "Oorspronkelijke einddatum (baseline)")}</span><input type="date" value={changeOrder.originalFinishDate} onChange={(event) => setChangeOrder({ ...changeOrder, originalFinishDate: event.target.value, newExpectedFinishDate: changeOrderFinishDate(event.target.value, changeOrder.extensionDays) })} /></label>
                          <label className="form-field"><span>{text("Extension of time (days)", "Termijnverlenging (dagen)")}</span><input type="number" min="0" step="1" value={changeOrder.extensionDays} onChange={(event) => setChangeOrder({ ...changeOrder, extensionDays: event.target.value, newExpectedFinishDate: changeOrderFinishDate(changeOrder.originalFinishDate, event.target.value) })} /></label>
                          {/* The revised date follows from the baseline and the extension, so
                              the form the contractor signs cannot contradict itself. */}
                          <label className="form-field"><span>{text("New expected finish date (revised) · calculated", "Nieuwe verwachte einddatum (herzien) · berekend")}</span><input type="date" value={changeOrder.newExpectedFinishDate || changeOrderFinishDate(changeOrder.originalFinishDate, changeOrder.extensionDays)} readOnly /></label>
                        </div>
                      ) : null}
                    </RecordFormSection>

                    <RecordFormSection
                      number={5}
                      title={text("Acknowledgement & agreement", "Erkenning & akkoord")}
                    >
                      <div className="form-grid-2">
                        <label className="form-field"><span>{text("Contractor representative", "Vertegenwoordiger aannemer")}</span><input list="change-order-contractors" value={changeOrder.contractorRepresentative} onChange={(event) => setChangeOrder({ ...changeOrder, contractorRepresentative: event.target.value })} placeholder={text("Enter name", "Voer naam in")} /><datalist id="change-order-contractors">{parties.map((party) => <option value={party.name} key={party.id} />)}</datalist></label>
                        <label className="form-field"><span>{text("Position", "Functie")}</span><input value={changeOrder.contractorPosition} onChange={(event) => setChangeOrder({ ...changeOrder, contractorPosition: event.target.value })} placeholder={text("Enter position", "Voer functie in")} /></label>
                      </div>
                      <SignatureField
                        label={text("Signature · contractor representative", "Handtekening · vertegenwoordiger aannemer")}
                        declaration={text(
                          "By signing you acknowledge this change and agree to proceed according to its impact on time, if any.",
                          "Met je handtekening erken je deze wijziging en ga je akkoord met de uitvoering volgens het effect op de tijd, indien van toepassing.",
                        )}
                        hint={text("Signature, name and date are stored with the change order.", "Handtekening, naam en datum worden bij de wijzigingsopdracht bewaard.")}
                        nameSuggestion={changeOrder.contractorRepresentative}
                        value={signatureFromDetails(changeOrder.contractorSignedBy, changeOrder.contractorSignedAt, changeOrder.contractorSignatureImage)}
                        onChange={(signature) => setChangeOrder({
                          ...changeOrder,
                          contractorSignedBy: signature?.name ?? "",
                          contractorSignedAt: signature?.signedAt ?? "",
                          contractorSignatureImage: signature?.image ?? "",
                          contractorRepresentative: signature?.name || changeOrder.contractorRepresentative,
                        })}
                      />
                      <label className="form-field"><span>{text("Contractor remarks (optional)", "Opmerkingen aannemer (optioneel)")}</span><textarea rows={2} maxLength={500} value={changeOrder.contractorRemarks} onChange={(event) => setChangeOrder({ ...changeOrder, contractorRemarks: event.target.value })} placeholder={text("Enter remarks (if any).", "Voer eventuele opmerkingen in.")} /><DictateButton onText={(transcript) => setChangeOrder((current) => ({ ...current, contractorRemarks: appendDictation(current.contractorRemarks, transcript) }))} /></label>
                    </RecordFormSection>

                    <RecordFormSection
                      number={6}
                      title={text("Approval · supervision", "Goedkeuring · supervisie")}
                    >
                      {/* The supervision approval is the issuer's signature on a change order: one signature,
                          under the account's own name, not a second one asked at the bottom of the form. */}
                      <SignatureField
                        label={text("Signature · supervision (issuer)", "Handtekening · supervisie (uitgever)")}
                        declaration={text(
                          "By signing you issue and approve this change order on behalf of supervision.",
                          "Met je handtekening geef je deze wijzigingsopdracht uit en keur je die goed namens de supervisie.",
                        )}
                        hint={text("Signed under your own name; it cannot be changed afterwards.", "Ondertekend onder je eigen naam; daarna niet meer te wijzigen.")}
                        nameSuggestion={currentUserName}
                        lockName
                        locked={Boolean(editingDocument?.signature_image || editingDocument?.details?.signature_image)}
                        value={signatureFromDetails(changeOrder.supervisionSignedBy, changeOrder.supervisionSignedAt, changeOrder.supervisionSignatureImage)}
                        onChange={(signature) => {
                          setChangeOrder({
                            ...changeOrder,
                            supervisionSignedBy: signature?.name ?? "",
                            supervisionSignedAt: signature?.signedAt ?? "",
                            supervisionSignatureImage: signature?.image ?? "",
                            supervisionName: signature?.name || "",
                          });
                          setRegisterForm((current) => ({ ...current, signedBy: signature?.name ?? "", signedAt: signature?.signedAt ?? "", signatureImage: signature?.image ?? "" }));
                        }}
                      />
                    </RecordFormSection>
                  </div>
                ) : null}
                {registerForm.type === "environmental_report" ? <><div className="form-grid-2"><label className="form-field"><span>{text("Period start", "Periode start")}</span><input type="date" value={registerForm.periodStart} onChange={(event) => setRegisterForm({ ...registerForm, periodStart: event.target.value })} /></label><label className="form-field"><span>{text("Period end", "Periode einde")}</span><input type="date" value={registerForm.periodEnd} onChange={(event) => setRegisterForm({ ...registerForm, periodEnd: event.target.value })} /></label></div><div className="form-grid-2"><label className="form-field"><span>{text("Lost hours", "Verloren uren")}</span><input type="number" min="0" value={registerForm.lostHours} onChange={(event) => setRegisterForm({ ...registerForm, lostHours: event.target.value })} /></label><label className="form-field"><span>{text("Reason for lost hours", "Reden verloren uren")}</span><input value={registerForm.lostHoursReason} onChange={(event) => setRegisterForm({ ...registerForm, lostHoursReason: event.target.value })} /></label></div></> : null}
                {/* The document is signed here, with a written signature, at the moment it
                    is drawn up or the moment the received form is recorded. */}
                {changeOrderRegister ? null : <SignatureField
                  label={submittedRegister
                    ? text("Signature on the submitted form", "Handtekening op het ingediende formulier")
                    : text("Sign as the author of this document", "Ondertekenen als opsteller van dit document")}
                  declaration={submittedRegister
                    ? text("Record the signature on the received form. CODECO signs in the formal response.", "Leg de handtekening op het ontvangen formulier vast. CODECO tekent bij de formele reactie.")
                    : text("By signing you issue this document under your own name.", "Met je handtekening geef je dit document onder je eigen naam uit.")}
                  hint={text("Signature, name and time are stored with the document.", "Handtekening, naam en tijdstip worden bij het document bewaard.")}
                  nameSuggestion={submittedRegister ? registerForm.issuerName.trim() : currentUserName}
                  nameOptions={[]}
                  lockName={!submittedRegister}
                  locked={Boolean(editingDocument?.signature_image || editingDocument?.details?.signature_image)}
                  disabled={submittedRegister && !registerForm.issuerName.trim()}
                  disabledHint={text("Fill in who submitted the form first.", "Vul eerst in wie het formulier heeft ingediend.")}
                  value={signatureFromDetails(registerForm.signedBy, registerForm.signedAt, registerForm.signatureImage)}
                  onChange={(signature) => setRegisterForm({
                    ...registerForm,
                    signedBy: signature?.name ?? "",
                    signedAt: signature?.signedAt ?? "",
                    signatureImage: signature?.image ?? "",
                  })}
                />}
                {submittedRegister ? <p className="form-helper">{text("Drawn up and signed by the submitting party. CODECO signs in the formal response below.", "Opgesteld en ondertekend door de indienende partij. CODECO tekent bij de formele reactie hieronder.")}</p> : null}
              </> : null}
              {!controlledRegister && !agreementRegister ? (
                <RecordSignatureField
                  value={registerSignature}
                  onChange={setRegisterSignature}
                  nameSuggestion={currentUserName}
                  declaration={text(
                    "I confirm that this register entry reflects what was recorded on site.",
                    "Ik bevestig dat dit registeritem weergeeft wat op de bouwplaats is vastgelegd.",
                  )}
                />
              ) : null}
              {/* Every register item can carry site photos, with the text that says what
                  the photo shows. Documents alone were not enough for the client. */}
              <label className="finding-photo-capture register-photo-capture">
                <Camera size={22} />
                <span><strong>{registerPhotos.length ? text(`${registerPhotos.length} photos ready`, `${registerPhotos.length} foto’s klaar`) : text("Take or choose a photo", "Maak of kies een foto")}</strong><small>{photoCaptureHint}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotosToStack(event.currentTarget.files, setRegisterPhotos, setRegisterPhotoError); event.currentTarget.value = ""; }} />
              </label>
              <PhotoEvidenceList
                photos={registerPhotos}
                setPhotos={setRegisterPhotos}
                markupContext={{ ...markupOptions, defaultBuildingId: registerBuildingId }}
              />
              {registerPhotoError ? <p className="field-error" role="alert">{registerPhotoError}</p> : null}
              {(() => {
                // What is still missing before the save button works, in words. A disabled button
                // that does not say why is how a form gets abandoned; this mirrors the rules above.
                const registerMissing = [
    exactLocationRequired && !registerLocationNodeId ? text("exact location", "exacte locatie") : "",
    registerTitle.length < 3 ? text("title", "titel") : "",
    controlledRegister && registerForm.details.trim().length < 3 ? text("description", "omschrijving") : "",
    controlledRegister && registerForm.type === "environmental_report"
      ? (registerForm.periodStart && registerForm.periodEnd && registerForm.periodEnd >= registerForm.periodStart ? "" : text("period", "periode"))
      : controlledRegister && registerForm.requestedTo.trim().length < 2 ? text("recipient", "ontvanger") : "",
    controlledRegister && registerForm.type === "inspection_request" && !registerForm.readyDate ? text("ready date", "gereeddatum") : "",
    controlledRegister && registerForm.type === "technical_instruction" && !registerForm.dueDate ? text("deadline", "deadline") : "",
    controlledRegister && registerForm.type === "change_order" && !changeOrderReady(changeOrder) ? text("change order details", "gegevens wijzigingsopdracht") : "",
    !lessonFormReady ? text("lesson fields and both photos", "velden en beide foto's van de les") : "",
    !delayReportFormReady ? text("delay report fields and status photo", "velden en statusfoto van het vertragingsrapport") : "",
                ].filter(Boolean);
                return registerMissing.length ? <small className="confirm-needs">{text("Still needed", "Nog nodig")}: {registerMissing.join(" · ")}</small> : null;
              })()}
              <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || (exactLocationRequired && !registerLocationNodeId) || registerTitle.length < 3 || !controlledFormReady || !lessonFormReady || !delayReportFormReady} onClick={() => void addRegisterEntry()}><PackageCheck size={15} /> {controlledRegister ? text("Create controlled document", "Maak beheerd document") : agreementRegister ? text("Save agreement", "Afspraak opslaan") : lessonsLearnedRegister ? text("Save lesson learned", "Geleerde les opslaan") : delayReportRegister ? text("Save delay report", "Vertragingsrapport opslaan") : text("Save register item", "Registeritem opslaan")}</button>
            </RecordFormShell>
          ) : null}
          {/* The bill of quantities has nothing to do with a delivery or any other
              register item you are filling in, so it no longer sits open underneath the
              form. It stays one tap away. */}
          {registerForm.type === "delivery" ? (
          <details className="boq-import-section">
            <summary>{text("Bill of quantities · import and progress", "Meetstaat · import en voortgang")}<span>{data.registerEntries.filter((entry) => entry.register_type === "boq").length} {text("BOQ lines", "BOQ-regels")}</span></summary>
            <div className="boq-import-card">
              <div><span className="record-number">{text("BOQ import and progress", "BOQ-import en voortgang")}</span><h2>{text("Import BOQ", "BOQ importeren")}</h2><p>{text("CSV columns: code, description, quantity, unit, unit rate, contract value, progress %. One invalid row cancels the whole import.", "CSV-kolommen: code, omschrijving, hoeveelheid, eenheid, eenheidsprijs, contractwaarde, voortgang %. Eén ongeldige regel annuleert de hele import.")}</p></div>
              <BuildingPicker id="boq-building" buildings={buildings} value={boqBuildingId} onChange={setBoqBuildingId} />
              <div className="boq-import-actions"><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={downloadBoqCsvTemplate}><Download size={15} /> {text("Download CSV template", "Download CSV-sjabloon")}</button><label className="ui-button ui-button--secondary ui-button--md file-button"><Upload size={15} /> {text("Choose BOQ file", "Kies BOQ-bestand")}<input type="file" accept="text/csv,.csv" hidden onChange={(event) => void inspectBoqFile(event.target.files?.[0] ?? null)} /></label><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !boqItems.length} onClick={() => void importBoq()}><PackageCheck size={15} /> {text("Import BOQ", "Importeer BOQ")}</button></div>
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
          ) : null}
          <div className="register-summary-grid">{Object.entries(registerNames).map(([type, label]) => <div className="register-summary" key={type}><strong>{data.registerEntries.filter((entry) => entry.register_type === type).length}</strong><span>{label}</span></div>)}</div>
          {externalSubmissionIntent ? (
            <div className="operation-alert success external-submission-notice">
              <Users size={18} />
              <div>
                <strong>{text("Recording a contractor submission", "Aannemersindiening vastleggen")}</strong>
              </div>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={openManagement}>{text("Back to Management", "Terug naar Management")}</button>
            </div>
          ) : null}
          <ControlledDocumentList entries={data.registerEntries.filter((entry) => isControlledDocumentType(entry.register_type) && (externalSubmissionIntent || !externalSubmissionRegisterTypes.includes(entry.register_type)))} buildings={buildings} locationNodes={data.locationNodes} busy={busy} currentUserName={currentUserName} focusRecordId={focusRecordId} client={client} run={run} />
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
                recordContextLabel(entry.building_id, entry.location_node_id, entry.building_ids),
                registerNames[entry.register_type] ?? allRegisterNames[entry.register_type] ?? entry.register_type,
                quantityLabel,
                outcomeLabel,
                // An agreement without its parties and signature is unreadable in a list.
                entry.register_type === "agreement" ? agreementSummaryLine(entry.details, text) : "",
                // A delay report reads by how many days it slipped and where that puts the
                // finish date; a delay whose new date you cannot see is just bad news.
                entry.register_type === "delay_report" ? [
                  entry.details?.delay_duration_days ? text(`${entry.details.delay_duration_days} days`, `${entry.details.delay_duration_days} dagen`) : "",
                  entry.details?.new_expected_finish_date ? `${text("revised", "herzien")} ${formatDate(String(entry.details.new_expected_finish_date), locale)}` : "",
                  entry.details?.completion_status ? text("completed", "afgerond") : "",
                ].filter(Boolean).join(" · ") : "",
                // A lesson learned reads its own follow-up status and who owns it.
                entry.register_type === "lessons_learned" ? [
                  { open: text("open", "open"), in_progress: text("in progress", "in uitvoering"), closed: text("closed", "afgerond") }[String(entry.details?.lesson_status ?? "open")] ?? "",
                  entry.details?.responsible_person ? String(entry.details.responsible_person) : "",
                ].filter(Boolean).join(" · ") : "",
                formatDate(entry.occurred_at, locale),
              ].filter(Boolean).join(" · "),
              status: entry.status,
              tone: outcome === "not_compliant" ? "red" : entry.status === "closed" || entry.status === "approved" ? "green" : "",
              onOpen: () => viewRegister(entry),
              onEdit: entry.status !== "cancelled" ? () => editRegister(entry) : undefined,
              onWithdraw: entry.status !== "cancelled" ? () => withdrawRecord({ kind: "register_entry", id: entry.id, code: entry.entry_number, title: entry.title, status: entry.status, meta: recordContextLabel(entry.building_id, entry.location_node_id, entry.building_ids), description: String(entry.details?.description ?? "") }) : undefined,
            };
          })} focusRecordId={focusRecordId} />
        </section>
      ) : null}

      {/* Works ongoing, works completed and delays: the day log as the page's form, the
          recorded days as its list — the same page every other record module is. */}
      {tab === "daily" ? (
        <section className="operation-panel">
          {showForm ? <RenderSlot render={dailyForms.renderDayLog} input={{
            focus: dayLogFocus,
            today: dayLogToday,
            close: () => setShowForm(false),
            openModule: (module: "inspections" | "findings" | "ncr" | "hse") => switchTab(module),
            openWorkforce: () => switchTab("workforce"),
          }} /> : null}
          <DailyWorkRegister
            records={data.dailyWork ?? []}
            dayReports={data.dayReports ?? []}
            buildings={buildings}
            view={dailyWorkView}
            onViewChange={(view) => openDailyWork(view)}
            onOpen={(record, title, meta) => setViewedRecord({
              kind: "daily_work",
              id: record.id,
              code: text("Day log", "Daglog"),
              title,
              status: record.signed_by ? text("Signed", "Ondertekend") : text("Saved", "Opgeslagen"),
              meta,
              // The line the list showed is the title; the rest of the day stands below it once.
              description: [
                record.work_ongoing ? `${text("Works ongoing", "Werkzaamheden gaande")}: ${record.work_ongoing}` : "",
                record.work_performed ? `${text("Works completed", "Werkzaamheden afgerond")}: ${record.work_performed}` : "",
                record.tomorrow_plan ? `${text("Plan for tomorrow", "Planning morgen")}: ${record.tomorrow_plan}` : "",
              ].filter((line) => line && !line.endsWith(`: ${title}`)).join("\n"),
            })}
          />
        </section>
      ) : null}

      {/* The Workforce register: today's count as the page's form, the counted days below. */}
      {tab === "workforce" ? (
        <section className="operation-panel">
          <RenderSlot render={dailyForms.renderWorkforce} input={{ close: () => switchTab("home") }} />
          <RecordList empty={text("No workforce recorded yet.", "Nog geen bezetting vastgelegd.")} rows={workforceDays.map((day) => ({
            id: day.key,
            icon: Users,
            title: day.headcount === 1 ? text("1 person on site", "1 persoon op de bouwplaats") : text(`${day.headcount} people on site`, `${day.headcount} personen op de bouwplaats`),
            meta: [
              day.date,
              buildings.find((building) => building.id === day.buildingId)?.name ?? "",
              day.visitors ? text(`${day.visitors} visitor(s)`, `${day.visitors} bezoeker(s)`) : "",
              day.signedBy ? `${text("signed by", "ondertekend door")} ${day.signedBy}` : "",
            ].filter(Boolean).join(" · "),
            status: day.signedBy ? text("Signed", "Ondertekend") : text("Counted", "Geteld"),
            tone: day.signedBy ? "green" : "",
          }))} />
        </section>
      ) : null}

      {tab === "visual" ? <VisualEvidenceWorkspace data={data} projectId={projectId} buildingId={buildingId} buildingName={buildingName} buildings={buildings} reportId={reportId} parties={parties} client={client} busy={busy} run={run} initialFindingId={visualFindingId} initialFileId={visualFileId} onInitialFileConsumed={() => setVisualFileId("")} initialFiles={initialCameraFiles} onInitialFilesConsumed={onInitialCameraFilesConsumed} start360Upload={visual360Intent} onStart360UploadConsumed={() => setVisual360Intent(false)} /> : null}

      {tab === "documents" ? <ProjectDocumentsHome data={data} client={client} organizationId={organizationId} projectId={projectId} reportId={reportId} buildingId={buildingId} buildings={buildings} busy={busy} run={run} openDrawings={() => switchTab("drawings")} openFiles={() => switchTab("assets")} openRegisters={() => switchTab("registers")} createDocument={() => openTask("registers", true)} /> : null}

      {tab === "drawings" ? <DrawingWorkspace data={data} projectId={projectId} buildingId={buildingId} buildings={buildings} client={client} busy={busy} run={run} initialFindingId={drawingFindingId} initialInspectionId={drawingInspectionId} pendingRecord={pendingRecordPin} onPlaceRecordPin={onPlaceRecordPin} onOpenLinkedRecord={(recordType) => switchTab(recordType === "observation" ? "findings" : recordType === "inspection" ? "inspections" : recordType === "visual" ? "visual" : recordType === "registration" ? "daily" : "registers")} /> : null}

      {tab === "tools" ? <FieldTools data={data} projectId={projectId} buildingId={buildingId} buildings={buildings} parties={parties} reportId={reportId} currentUserName={currentUserName} client={client} busy={busy} run={run} /> : null}

      {tab === "files" ? <MediaLibraryWorkspace mode="photos" focusRecordId={focusRecordId} markPhotoIssue={(fileId) => { setVisualFileId(fileId); switchTab("visual"); }} data={data} projectId={projectId} buildingId={buildingId} buildingName={buildingName} buildings={buildings} reportId={reportId} client={client} busy={busy} run={run} initialFiles={initialCameraFiles} onInitialFilesConsumed={onInitialCameraFilesConsumed} open360Upload={() => { setVisual360Intent(true); setTab("visual"); }} /> : null}

      {tab === "assets" ? <MediaLibraryWorkspace mode="assets" focusRecordId={focusRecordId} organizationId={organizationId} data={data} projectId={projectId} buildingId={buildingId} buildingName={buildingName} buildings={buildings} reportId={reportId} client={client} busy={busy} run={run} open360Upload={() => { setVisual360Intent(true); setTab("visual"); }} markPhotoIssue={(fileId) => { setVisualFileId(fileId); switchTab("visual"); }} openRecord={(recordTab, recordId) => openProjectArea(recordTab as Parameters<typeof openProjectArea>[0], recordId)} /> : null}
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
          const building = (entry.building_ids?.length ? entry.building_ids : entry.building_id ? [entry.building_id] : [])
            .map((id) => buildings.find((item) => item.id === id)?.name)
            .filter(Boolean).join(" · ") || text("Project-wide", "Projectbreed");
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
                <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => {
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
                  <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || Number(progress) < 0 || Number(progress) > 100 || note.trim().length < 2} onClick={() => void run(
                    () => recordBoqProgress(client, {
                      registerEntryId: entry.id,
                      progressPercent: Number(progress),
                      quantityCompleted: quantity ? Number(quantity) : null,
                      note,
                    }),
                    text(`BOQ progress recorded.`, `BOQ-voortgang vastgelegd.`),
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

function ControlledDocumentList({ entries, buildings, locationNodes, busy, currentUserName, focusRecordId = "", client, run }: {
  entries: OperationSnapshot["registerEntries"];
  buildings: BuildingOption[];
  locationNodes: OperationSnapshot["locationNodes"];
  busy: boolean;
  currentUserName: string;
  /** The register item the action centre pointed at. */
  focusRecordId?: string;
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
  /** The recipient's handwritten signature on the formal response; the server stamps who captured it. */
  const [responseSignature, setResponseSignature] = useState<HandwrittenSignature | null>(null);
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
      `${entry.entry_number} · ${typeText(entry.register_type, text).toUpperCase()}`,
      `${String(details.project_number ?? "")} · ${String(details.project_name ?? "")}`.trim(),
      entry.title,
      String(details.description ?? ""),
      details.requested_to ? `${text("To", "Aan")}: ${String(details.requested_to)}` : "",
      entry.due_at ? `${text("Required by", "Uiterlijk")}: ${formatDate(entry.due_at, locale)}` : "",
      `${text("Issued by", "Opgemaakt door")}: ${String(details.signed_by || details.issued_by || currentUserName)}`,
    ].filter(Boolean).join("\n");
  };

  useRecordFocus(focusRecordId, entries.some((entry) => entry.id === focusRecordId));
  if (!entries.length) return null;
  return (
    <section className="controlled-document-register">
      <div className="controlled-document-register-heading"><div><span className="record-number">{text("Formal client documents", "Formele klantdocumenten")}</span><h2>RFI · RFA · WIR · TI · CO · ER</h2></div><span>{entries.length} {text("controlled records", "beheerde registraties")}</span></div>
      <div className="record-stack">
        {entries.map((entry) => {
          const details = entry.details ?? {};
          const entryBuildingName = (entry.building_ids?.length ? entry.building_ids : entry.building_id ? [entry.building_id] : [])
            .map((id) => buildings.find((building) => building.id === id)?.name)
            .filter(Boolean).join(" · ") || text("Project-wide", "Projectbreed");
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
          const entryWaiting = isPendingRecordId(entry.id);
          return <article className={`controlled-document-card ${entryWaiting ? "record-waiting" : ""} ${focusRecordId === entry.id ? "record-focused" : ""}`} id={recordAnchorId(entry.id)} key={entry.id}>
            {entryWaiting ? <p className="record-waiting-note"><WifiOff size={14} /> {text("Saved on this device. Number follows after sending.", "Opgeslagen op dit apparaat. Nummer volgt na verzending.")}</p> : null}
            <div className="controlled-document-card-main"><div><span className="record-number">{entry.entry_number} · {typeText(entry.register_type, text).toUpperCase()}</span><h3>{entry.title}</h3><p>{String(details.description ?? "")}</p><small>{entryBuildingName}{entryLocation ? ` → ${entryLocation}` : ""} · {formatDate(entry.occurred_at, locale)}{entry.due_at ? ` · ${text("due", "uiterlijk")} ${formatDate(entry.due_at, locale)}` : ""}{responseData.decision ? ` · ${codeText(String(responseData.decision), text)}` : ""}</small></div><span className={`task-status ${entry.status === "approved" || entry.status === "closed" ? "green" : entry.status === "rejected" ? "red" : ""}`}>{statusText(entry.status, text)}</span></div>
            <div className="finding-actions" hidden={entryWaiting}><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setHistoryActive((current) => current === entry.id ? null : entry.id)}><Archive size={15} /> {historyActive === entry.id ? text("Close record", "Sluit dossier") : text("Open record & history", "Open dossier & historie")}</button>
            {/* Send the document to the contractor over WhatsApp. The formal PDF or Word
                file stays the attachment; this is the message that announces it. */}
            <button className="whatsapp-button" type="button" onClick={() => openWhatsApp(contractorMessage(entry))}><MessageCircle size={16} /> {text("Send to contractor", "Naar aannemer sturen")}</button>
            <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => openSms(contractorMessage(entry))}><Smartphone size={15} /> {text("Send as SMS", "Als SMS sturen")}</button>
            <ReportDownloadButtons disabled={busy} onDownloadPdf={() => import("@/lib/reports/controlled-document-pdf").then(({ downloadControlledDocumentPdf }) => downloadControlledDocumentPdf(entry))} onDownloadWord={() => import("@/lib/reports/controlled-document-docx").then(({ downloadControlledDocumentDocx }) => downloadControlledDocumentDocx(entry))} />{!["closed", "cancelled"].includes(entry.status) ? <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => { setActive(active === entry.id ? null : entry.id); const recipientAnswers = entry.register_type === "technical_instruction" || entry.register_type === "change_order"; setResponse({ decision: recipientAnswers ? "acknowledged" : "approved", comments: "", respondentName: recipientAnswers ? "" : currentUserName, respondentPosition: "", respondentCompany: recipientAnswers ? String(details.requested_to ?? "") : "CODECO N.V." }); setResponseSignature(null); }}><FileCheck2 size={15} /> {text("Record formal response", "Leg formeel antwoord vast")}</button> : null}</div>
            {historyActive === entry.id ? <section className="controlled-document-history">
              <div><span>{text("Created / issued", "Aangemaakt / uitgegeven")}</span><strong>{formatDate(entry.occurred_at, locale)}</strong><small>{String(details.issuer_name ?? details.issued_by ?? currentUserName)} · {String(details.issuer_company ?? "CODECO N.V.")}</small></div>
              <div><span>{text("Current status", "Huidige status")}</span><strong>{statusText(entry.status, text)}</strong><small>{responseData.decision ? `${text("Decision", "Besluit")}: ${codeText(String(responseData.decision), text)}` : text("No formal decision recorded yet", "Nog geen formeel besluit vastgelegd")}</small></div>
              {(() => {
                const signatures = controlledDocumentSignatures(entry);
                const state = documentSignatureState(entry);
                const stateLabel = state === "acknowledged" ? text("Acknowledged", "Bevestigd") : state === "issued" ? text("Issued · awaiting acknowledgement", "Uitgegeven · wacht op bevestiging") : text("Not signed yet", "Nog niet ondertekend");
                return <div className="controlled-history-signatures">
                  <span>{text("Signatures", "Handtekeningen")}</span>
                  <strong>{stateLabel}</strong>
                  <small>{text("Issuer", "Uitgever")}: {signatures.issuer.signed ? `${signatures.issuer.name} · ${signatures.issuer.signedAt}` : text("not signed", "niet ondertekend")}</small>
                  <small>{text("Recipient", "Ontvanger")}: {signatures.recipient.signed ? `${signatures.recipient.name} · ${signatures.recipient.signedAt}${signatures.recipient.onDevice && signatures.recipient.capturedBy ? ` · ${text("signed on the device of", "getekend op het toestel van")} ${signatures.recipient.capturedBy}` : ""}` : text("not signed", "niet ondertekend")}</small>
                </div>;
              })()}
              <div className="controlled-history-description"><span>{text("Complete content", "Volledige inhoud")}</span><p>{String(details.description ?? details.request ?? details.instruction ?? text("No description supplied.", "Geen omschrijving ingevoerd."))}</p></div>
              {attachmentFiles.length ? <div className="controlled-history-attachments"><span>{text("Uploaded attachments", "Geüploade bijlagen")}</span>{attachmentFiles.map((file, index) => {
                const fileId = String(file.file_id ?? "");
                const filename = String(file.name ?? `${text("Attachment", "Bijlage")} ${index + 1}`);
                return <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || !fileId} onClick={() => void run(() => openProjectFile(client, fileId, filename), text(`${filename} opened.`, `${filename} geopend.`))} key={`${fileId}:${index}`}><FolderOpen size={15} /> {filename}</button>;
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
              {(() => {
                // A document the issuer has signed is acknowledged by the recipient in writing.
                const issued = Boolean(entry.signature_image || details.signature_image);
                const needsSignature = issued && entry.register_type === "technical_instruction" && response.decision === "acknowledged";
                const issuerName = String(entry.signed_by ?? details.signed_by ?? "").trim().toLowerCase();
                const sameAsIssuer = Boolean(issuerName) && response.respondentName.trim().toLowerCase() === issuerName;
                const signatureReady = !responseSignature || (response.respondentPosition.trim().length >= 2 && !sameAsIssuer);
                return <>
                  {issued ? <SignatureField
                    label={text("Signature · recipient", "Handtekening · ontvanger")}
                    declaration={text("By signing you acknowledge receipt of this document.", "Met je handtekening bevestig je de ontvangst van dit document.")}
                    hint={needsSignature ? text("Required to acknowledge a technical instruction.", "Vereist om een technische instructie te bevestigen.") : text("Optional.", "Optioneel.")}
                    nameSuggestion={response.respondentName}
                    value={responseSignature}
                    onChange={(signature) => { setResponseSignature(signature); if (signature?.name) setResponse((current) => ({ ...current, respondentName: signature.name })); }}
                  /> : null}
                  {responseSignature && sameAsIssuer ? <p className="field-error" role="alert">{text("The recipient cannot be the issuer of the document.", "De ontvanger kan niet de uitgever van het document zijn.")}</p> : null}
                  {responseSignature && response.respondentPosition.trim().length < 2 ? <p className="field-error" role="alert">{text("Fill in the position of the person signing.", "Vul de functie in van wie tekent.")}</p> : null}
                  <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || response.respondentName.trim().length < 2 || response.comments.trim().length < 2 || (needsSignature && !responseSignature) || !signatureReady} onClick={() => void run(() => respondToControlledDocument(client, entry.id, { ...response, signatureImage: responseSignature?.image ?? null }), text(`${entry.entry_number} response stored in the audit trail.`, `Antwoord op ${entry.entry_number} in de auditgeschiedenis opgeslagen.`)).then((okay) => { if (okay) { setActive(null); setResponseSignature(null); } })}>{text("Confirm human response", "Bevestig menselijk antwoord")}</button>
                </>;
              })()}
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
function RecordPhotoStrip({ data, client, kind, recordId, resolver, buildings, projectId, busy, run, openPhotoMarking }: { data: OperationSnapshot; client: SupabaseClient; kind: FileOriginKind; recordId: string; resolver: FileOriginResolver; buildings: BuildingOption[]; projectId: string; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>; openPhotoMarking?: (fileId: string) => void }) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  /** The photo whose own screen is open, the same screen the library opens. */
  const [openFileId, setOpenFileId] = useState("");
  const files = filesForRecord(data, kind, recordId, resolver);
  const openFile = files.find((file) => file.id === openFileId) ?? null;
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
            <button type="button" onClick={() => setOpenFileId(file.id)} title={file.original_name} key={file.id}>
              <StoredPhotoThumbnail client={client} file={file} />
            </button>
          ))}
        </div>
      ) : null}
      {openFile ? (
        <StoredPhotoDetail
          data={data}
          buildings={buildings}
          file={openFile}
          client={client}
          busy={busy}
          run={run}
          projectId={projectId}
          close={() => setOpenFileId("")}
          openMarking={openPhotoMarking}
        />
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
      {scope === "ncr" ? <p>{text("The contractor opens the link without an account and proposes the corrective action. CODECO verifies and closes.", "De aannemer opent de link zonder account en stelt de corrigerende maatregel voor. CODECO verifieert en sluit.")}</p> : null}
      {link ? (
        <>
          <label><span>{text("Secure link · expires", "Beveiligde link · vervalt")} {formatDate(link.expiresAt, locale)}</span><input readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} /></label>
          {feedback ? <p className="external-share-feedback" role="status">{feedback}</p> : null}
          <div className="submitted-record-share-actions">
            <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => void copyToClipboard(link.url).then(() => setFeedback(text("Link copied.", "Link gekopieerd."))).catch((error) => setFeedback(userFacingError(error, text)))}><Copy size={16} /> {text("Copy link", "Kopieer link")}</button>
            <button className="whatsapp-button" type="button" onClick={() => openWhatsApp(message(link))}><MessageCircle size={17} /> {text("Open WhatsApp and send", "Open WhatsApp en stuur")}</button>
            <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => openSms(message(link))}><Smartphone size={16} /> {text("Send as SMS", "Als SMS sturen")}</button>
          </div>
        </>
      ) : (
        <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || creating} onClick={() => void createLink()}>
          {creating ? <Loader2 className="spin" size={16} /> : <MessageCircle size={16} />}
          {scope === "ncr" ? text("Send to contractor", "Naar aannemer sturen") : text("Send to external party", "Stuur naar externe partij")}
        </button>
      )}
    </section>
  );
}

function FindingList({ data, client, run, findings, progressUpdates, visualAnnotations, externalShareLinks, currentUserId, projectId, projectName, projectCode, buildings, locationNodes, currentUserName, resolveUserName, parties, busy, focusRecordId = "", transition, recordProgress, share, revoke, linkVisual, linkDrawing, openPhotoMarking, viewRecord, editRecord, withdrawRecord }: {
  data: OperationSnapshot;
  client: SupabaseClient;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  findings: Finding[];
  progressUpdates: OperationSnapshot["findingProgressUpdates"];
  visualAnnotations: OperationSnapshot["visualAnnotations"];
  externalShareLinks: NonNullable<OperationSnapshot["externalShareLinks"]>;
  /** Who is looking: an assigned finding may be moved on by its assignee. */
  currentUserId: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  buildings: BuildingOption[];
  locationNodes: OperationSnapshot["locationNodes"];
  currentUserName: string;
  /** Turns the stored verifier id into the name that belongs on the QC signature line. */
  resolveUserName: (userId: string | null) => string;
  parties: ProjectParty[];
  busy: boolean;
  /** The finding the action centre pointed at, so it is the one in front of the user. */
  focusRecordId?: string;
  transition: (finding: Finding, nextStatus: string, note: string, finalMeasure: string, correction: string, verificationSignedBy: string, verificationSignatureImage: string, verification?: QualityControlVerification) => Promise<boolean>;
  recordProgress: (finding: Finding, progressPercent: number, disposition: "validated" | "to_be_corrected" | "alternative_solution", note: string) => Promise<boolean>;
  share: (finding: Finding) => Promise<{ shareId: string; url: string; expiresAt: string } | null>;
  revoke: (shareId: string) => Promise<boolean>;
  linkVisual: (finding: Finding) => void;
  linkDrawing: (finding: Finding) => void;
  /** Opens the screen where problems are marked on a photo, on the photo that was tapped. */
  openPhotoMarking?: (fileId: string) => void;
  viewRecord: (finding: Finding) => void;
  editRecord: (finding: Finding) => void;
  withdrawRecord: (finding: Finding) => void;
}) {
  const { language, locale, text } = useLanguage();
  const permissions = useProjectPermissions();
  const statusLabels = language === "en" ? findingStatusLabelsEnglish : findingStatusLabels;
  const fileOriginResolver = useMemo(() => createFileOriginResolver(data), [data]);
  const [active, setActive] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [measure, setMeasure] = useState("");
  /** What the contractor proposes to do, as on the client's own NCR form. */
  const [correction, setCorrection] = useState("");
  /** The written signature under the Quality Control / Verification box, required to
   * close an NCR — the client's own form marks that box "Signature *". */
  const [verificationSignature, setVerificationSignature] = useState<HandwrittenSignature | null>(null);
  /**
   * The rest of that box, as the client's own form asks for it: whether the issue is
   * resolved, the day the re-inspection was carried out, what was observed, the comments
   * the verifier signs for and the job that verifier holds.
   */
  const [verification, setVerification] = useState({
    issueResolved: true,
    inspectionDate: "",
    remarks: "",
    comments: "",
    position: "",
  });
  const emptyVerification = { issueResolved: true, inspectionDate: "", remarks: "", comments: "", position: "" };
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
  useRecordFocus(focusRecordId, findings.some((finding) => finding.id === focusRecordId));
  const findingBuildingName = (finding: Finding) => (finding.building_ids?.length ? finding.building_ids : [finding.building_id])
    .map((id) => buildings.find((building) => building.id === id)?.name)
    .filter(Boolean).join(" · ");
  /**
   * The signature lines of the client's NCR form. "QC verification" is the person the
   * database recorded as verifier, never the person who happens to download the file.
   */
  const ncrContext = (finding: Finding, recordBuildingName: string) => ({
    projectName,
    projectCode,
    buildingName: recordBuildingName,
    // The person who drew the NCR up, as it was stored with the record. Never the person
    // who happens to download the form.
    issuerName: finding.issue_management?.issued_by || currentUserName,
    signatureImage: finding.issue_management?.signature_image ?? null,
    responsiblePartyName: parties.find((party) => party.id === finding.responsible_party_id)?.name ?? "",
    verifierName: resolveUserName(finding.verified_by),
  });
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
      {findings.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No findings yet", "Nog geen bevindingen")}</strong></div> : null}
      {findings.map((finding) => {
        // The database rule, so the screen offers only the step this role can actually take: the
        // assignee or a finding manager moves a finding on; closing and reopening may also be done
        // by whoever holds the verify permission. Anything else would only end in a refusal after
        // the whole verification form, signature included, had been filled in.
        const mayStep = (status: string | undefined) => Boolean(status) && (
          (Boolean(currentUserId) && finding.assigned_user_id === currentUserId)
          || permissions.can("findings.manage")
          || (["closed", "reopened"].includes(String(status)) && permissions.can("findings.verify"))
        );
        const nextStatus = mayStep(next[finding.status]) ? next[finding.status] : undefined;
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
        const waitingToBeSent = isPendingRecordId(finding.id);
        return (
          <article className={`finding-card ${waitingToBeSent ? "record-waiting" : ""} ${focusRecordId === finding.id ? "record-focused" : ""}`} id={recordAnchorId(finding.id)} key={finding.id}>
            {waitingToBeSent ? (
              <p className="record-waiting-note">
                <WifiOff size={14} />
                {text("Saved on this device. Number, deadline and contractor link follow after sending.", "Opgeslagen op dit apparaat. Nummer, deadline en aannemerslink volgen na verzending.")}
              </p>
            ) : null}
            <div className="finding-card-main"><span className={`record-severity ${finding.severity}`}>{severityText(finding.severity, text)}</span><div><span className="record-number">{finding.finding_number} · {finding.finding_type.toUpperCase()}</span><h3>{finding.title}</h3><p>{finding.description}</p>{issue.action_steps ? <p className="finding-required-action"><strong>{text("Required action:", "Vereiste actie:")}</strong> {issue.action_steps}</p> : null}{issue.immediate_actions?.length || issue.immediate_action_other ? <p className="finding-immediate-action"><strong>{text("Already done:", "Al gedaan:")}</strong> {[...(issue.immediate_actions ?? []).map((action) => optionText(immediateActionsTaken, action, text)), issue.immediate_action_other ?? ""].filter(Boolean).join(" · ")}</p> : null}<small>{[issue.issue_category, issue.root_cause ? `${text("cause", "oorzaak")}: ${optionText(recordRootCauses, issue.root_cause, text)}` : "", issue.responsible_person].filter(Boolean).join(" · ")}{[issue.issue_category, issue.root_cause, issue.responsible_person].some(Boolean) ? " · " : ""}{recordBuildingName}{recordLocation ? ` → ${recordLocation}` : ""} · Deadline {formatDate(finding.due_at, locale)}{latestProgress ? ` · ${text("progress", "voortgang")} ${latestProgress.progress_percent}% · ${codeText(latestProgress.disposition, text)}` : ""}{finding.verified_at ? ` · ${text("verified", "geverifieerd")} ${formatDate(finding.verified_at, locale)}` : ""}</small></div><span className={`task-status ${finding.status === "closed" ? "green" : finding.severity === "critical" ? "red" : ""}`}>{statusLabels[finding.status] ?? finding.status}</span></div>
            <div className="finding-actions" hidden={waitingToBeSent}>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => viewRecord(finding)}><FileText size={16} /> {text("View record", "Registratie bekijken")}</button>
              {finding.status !== "cancelled" && permissions.can("records.edit") ? <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => editRecord(finding)}><Wrench size={16} /> {text("Edit", "Bewerken")}</button> : null}
              {finding.status !== "cancelled" && permissions.can("records.edit") ? <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => withdrawRecord(finding)}>{text("Withdraw", "Intrekken")}</button> : null}
              {visualAnnotation || permissions.can("files.manage") ? <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => linkVisual(finding)}><Camera size={16} /> {visualAnnotation ? text("View photo marker", "Bekijk fotomarker") : text("Mark on photo / 360°", "Markeer op foto / 360°")}</button> : null}
              {drawingPin || permissions.can("files.manage") ? <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => linkDrawing(finding)}><MapPin size={16} /> {drawingPin ? text("View on drawing", "Bekijk op tekening") : text("Place on drawing", "Plaats op tekening")}</button> : null}
              {permissions.can("findings.create") ? <button className="external-party-button" type="button" disabled={busy || creatingShareFor === finding.id} onClick={() => void createShare(finding)}>
                {creatingShareFor === finding.id ? <Loader2 className="spin" size={17} /> : <MessageCircle size={17} />}
                <span><strong>{text("Send to external party", "Stuur naar externe partij")}</strong><small>{text("WhatsApp link · no account needed", "WhatsApp-link · geen account nodig")}</small></span>
              </button> : null}
              <ReportDownloadButtons disabled={busy} onDownloadPdf={() => import("@/lib/reports/ncr-pdf").then(({ downloadNcrPdf }) => downloadNcrPdf(finding, latestProgress, ncrContext(finding, recordBuildingName)))} onDownloadWord={() => import("@/lib/reports/ncr-docx").then(({ downloadNcrDocx }) => downloadNcrDocx(finding, latestProgress, ncrContext(finding, recordBuildingName)))} />
              {!["closed", "cancelled", "rejected"].includes(finding.status) && permissions.can("findings.manage") ? <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => { setProgressActive(progressActive === finding.id ? null : finding.id); setProgressPercent(String(latestProgress?.progress_percent ?? 0)); setProgressDisposition(latestProgress?.disposition ?? issue.disposition ?? "to_be_corrected"); }}>{text("Record inspection progress", "Inspectievoortgang vastleggen")}</button> : null}
              {nextStatus ? <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => { setActive(active === finding.id ? null : finding.id); setCorrection(""); setVerificationSignature(null); }}>{nextStatus === "closed" ? finding.finding_type === "ncr" ? text("Quality control · resolve", "Kwaliteitscontrole · afsluiten") : text("Verify", "Verifiëren") : nextStatus === "ready_for_verification" ? text("Mark repair ready", "Herstel gereedmelden") : finding.finding_type === "ncr" ? text("Record contractor answer", "Antwoord aannemer vastleggen") : text("Update status", "Status bijwerken")}</button> : null}
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
                  {/* Who drew the NCR up stands on the record itself, next to the written
                      signature of the engineer who issued it. */}
                  <small>{text("Drawn up by", "Opgesteld door")}: {issue.issued_by || text("not recorded", "niet vastgelegd")}</small>
                  {issue.signature_image ? (
                    // A stored signature is a data URL, which the image optimizer cannot take.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="record-signature-proof" src={issue.signature_image} alt={text(`Signature of ${issue.signed_by ?? ""}`, `Handtekening van ${issue.signed_by ?? ""}`)} />
                  ) : null}
                  <small>{issue.signed_by ? text(`Signed by ${issue.signed_by} · ${formatDate(issue.signed_at ?? null, locale)}`, `Ondertekend door ${issue.signed_by} · ${formatDate(issue.signed_at ?? null, locale)}`) : text("Not signed", "Niet ondertekend")}</small>
                  {issue.signed_position ? <small>{text("Position", "Functie")}: {issue.signed_position}</small> : null}
                </div>
                <div className={finding.proposed_correction ? "answered" : ""}>
                  <span>{text("Proposed corrective action by contractor", "Voorgestelde correctieve actie door de aannemer")}</span>
                  <p>{finding.proposed_correction || (activeExternalShares.length
                    ? text("Waiting for the contractor's answer through the sent link.", "Wacht op het antwoord van de aannemer via de verstuurde link.")
                    : text("No contractor answer yet.", "Nog geen antwoord van de aannemer."))}</p>
                  {/* The name the contractor typed under the correction is the signature. */}
                  {finding.proposed_correction && issue.correction_signature_image ? (
                    // The signature the contractor wrote through the shared link.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="record-signature-proof" src={issue.correction_signature_image} alt={text(`Signature of ${issue.correction_signed_by ?? ""}`, `Handtekening van ${issue.correction_signed_by ?? ""}`)} />
                  ) : null}
                  {finding.proposed_correction ? <small>{issue.correction_signed_by
                    ? text(`Signed by ${issue.correction_signed_by} · ${formatDate(issue.correction_signed_at ?? null, locale)}`, `Ondertekend door ${issue.correction_signed_by} · ${formatDate(issue.correction_signed_at ?? null, locale)}`)
                    : text("Recorded without a name", "Vastgelegd zonder naam")}</small> : null}
                </div>
                <div className={finding.status === "closed" ? "answered" : ""}>
                  <span>{text("Quality control / verification", "Kwaliteitscontrole / verificatie")}</span>
                  {/* "Issue resolved" is what the verifier signed for, not what the status
                      column happens to say: an NCR can be closed on a solution that only
                      partly worked, and the client's own form has a box for exactly that. */}
                  <strong>{issue.qc_issue_resolved === false
                    ? text("Issue not resolved", "Afwijking niet opgelost")
                    : finding.status === "closed" || issue.qc_issue_resolved
                    ? text("Issue resolved", "Afwijking opgelost")
                    : text("Issue not resolved", "Afwijking nog niet opgelost")}</strong>
                  <p>{finding.final_measure || text("No verified close-out yet.", "Nog geen geverifieerde afsluiting.")}</p>
                  {issue.qc_inspection_date ? <small>{text("Date of QC inspection", "Datum QC-inspectie")}: {formatDate(issue.qc_inspection_date, locale)}</small> : null}
                  {issue.qc_remarks ? <small>{text("Remarks / observations:", "Opmerkingen / waarnemingen:")} {issue.qc_remarks}</small> : null}
                  {issue.verification_comments ? <small>{text("Verification comments:", "Verificatiecommentaar:")} {issue.verification_comments}</small> : null}
                  {issue.remarks ? <small>{text("Remarks:", "Opmerkingen:")} {issue.remarks}</small> : null}
                  {/* The written signature under the Quality Control / Verification box,
                      next to the drawn signatures on the other two boxes of this form. */}
                  {issue.verification_signature_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="record-signature-proof" src={issue.verification_signature_image} alt={text(`Signature of ${issue.verification_signed_by ?? ""}`, `Handtekening van ${issue.verification_signed_by ?? ""}`)} />
                  ) : null}
                  {finding.status === "closed" ? <small>{issue.verification_signed_by
                    ? text(`Signed by ${issue.verification_signed_by} · ${formatDate(issue.verification_signed_at ?? null, locale)}`, `Ondertekend door ${issue.verification_signed_by} · ${formatDate(issue.verification_signed_at ?? null, locale)}`)
                    : text("Recorded without a signature", "Vastgelegd zonder handtekening")}</small> : null}
                  {issue.verification_signed_position ? <small>{text("Position", "Functie")}: {issue.verification_signed_position}</small> : null}
                </div>
              </section>
            ) : null}
            <RecordPhotoStrip data={data} client={client} kind="finding" recordId={finding.id} resolver={fileOriginResolver} buildings={buildings} projectId={projectId} busy={busy} run={run} openPhotoMarking={openPhotoMarking} />
            {activeExternalShares.length ? (
              <section className="active-external-shares" aria-label={text("Active external links", "Actieve externe links")}>
                <header><Link2 size={16} /><span><strong>{text(`${activeExternalShares.length} active external link${activeExternalShares.length === 1 ? "" : "s"}`, `${activeExternalShares.length} actieve externe link${activeExternalShares.length === 1 ? "" : "s"}`)}</strong><small>{text("The link is shown once. Revoke it here.", "De link wordt één keer getoond. Trek hem hier in.")}</small></span></header>
                {activeExternalShares.map((shared) => (
                  <div className="active-external-share-row" key={shared.id}>
                    <span><strong>{text("Expires", "Vervalt")} {formatDate(shared.expires_at, locale)}</strong><small>{text(`${shared.view_count} view${shared.view_count === 1 ? "" : "s"}`, `${shared.view_count} keer bekeken`)}</small></span>
                    {revokeConfirmId === shared.id ? (
                      <div className="revoke-share-confirm">
                        <small>{text("The sent link stops immediately.", "De verstuurde link stopt direct.")}</small>
                        <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setRevokeConfirmId(null)}>{text("Cancel", "Annuleer")}</button>
                        <button className="ui-button ui-button--danger ui-button--md" type="button" disabled={busy} onClick={() => void revoke(shared.id).then((okay) => {
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
                  <li>{text("Contractor sees: project, building, location, priority, deadline, photo.", "Aannemer ziet: project, gebouw, locatie, prioriteit, deadline, foto.")}</li>
                  <li>{text("Can report completion or a problem with one tap.", "Kan met één tik gereedmelden of een probleem terugmelden.")}</li>
                  <li>{text("Can take and attach a correction photo directly.", "Kan direct een correctiefoto maken en meesturen.")}</li>
                </ul>
                <label><span>{text("Secure link · expires", "Beveiligde link · vervalt")} {formatDate(externalShare.expiresAt, locale)}</span><input readOnly value={externalShare.url} onFocus={(event) => event.currentTarget.select()} /></label>
                {shareFeedback ? <p className="external-share-feedback" role="status">{shareFeedback}</p> : null}
                <div className="external-share-preflight-actions">
                  <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => void copyToClipboard(externalShare.url).then(() => setShareFeedback(text("Link copied.", "Link gekopieerd."))).catch((error) => setShareFeedback(userFacingError(error, text)))}><Copy size={16} /> {text("Copy link", "Kopieer link")}</button>
                  <button className="whatsapp-button" type="button" onClick={() => openWhatsApp(externalMessage(finding, externalShare))}><MessageCircle size={17} /> {text("Open WhatsApp and send", "Open WhatsApp en stuur")}</button>
                  <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => openSms(externalMessage(finding, externalShare))}><Smartphone size={16} /> {text("Send as SMS", "Als SMS sturen")}</button>
                  <button className="revoke-share-button" type="button" onClick={() => setRevokeConfirmId(externalShare.shareId)}><X size={16} /> {text("Revoke link", "Link intrekken")}</button>
                </div>
              </section>
            ) : null}
            {progressActive === finding.id ? (
              <div className="inline-transition issue-progress-form">
                <div className="form-grid-2"><label className="form-field"><span>{text("Progress at this inspection", "Voortgang bij deze inspectie")}</span><input type="number" min="0" max="100" step="1" value={progressPercent} onChange={(event) => setProgressPercent(event.target.value)} /></label><label className="form-field"><span>{text("Disposition", "Beoordeling")}</span><select value={progressDisposition} onChange={(event) => setProgressDisposition(event.target.value as typeof progressDisposition)}><option value="validated">{text("Validated", "Gevalideerd")}</option><option value="to_be_corrected">{text("To be corrected", "Te corrigeren")}</option><option value="alternative_solution">{text("Alternative solution", "Alternatieve oplossing")}</option></select></label></div>
                <label className="form-field"><span>{text("Inspection note", "Inspectienotitie")}</span><textarea rows={2} value={progressNote} onChange={(event) => setProgressNote(event.target.value)} /><DictateButton onText={(transcript) => setProgressNote((current) => appendDictation(current, transcript))} /></label>
                <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || Number(progressPercent) < 0 || Number(progressPercent) > 100 || progressNote.trim().length < 2} onClick={() => void recordProgress(finding, Number(progressPercent), progressDisposition, progressNote).then((okay) => { if (okay) { setProgressActive(null); setProgressNote(""); } })}>{text("Save dated progress point", "Sla gedateerd voortgangspunt op")}</button>
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
                {/* The Quality Control / Verification box of the client's own NCR form, in
                    full: whether the issue is resolved, the day the re-inspection was
                    actually carried out, what was observed, the comments the verifier
                    signs for, and the written signature the form marks required. */}
                {finding.finding_type === "ncr" && nextStatus === "closed" ? (
                  <div className="ncr-verification-box">
                    <div className="form-grid-2">
                      <div className="form-field">
                        <span>{text("Quality control issue", "Bevinding kwaliteitscontrole")}</span>
                        <div className="quick-issue-presets">
                          {([[true, text("Issue resolved", "Afwijking opgelost")], [false, text("Issue not resolved", "Afwijking niet opgelost")]] as const).map(([value, label]) => (
                            <button className={verification.issueResolved === value ? "active" : ""} type="button" onClick={() => setVerification({ ...verification, issueResolved: value })} key={String(value)}>{label}</button>
                          ))}
                        </div>
                      </div>
                      <label className="form-field"><span>{text("Date of QC inspection", "Datum QC-inspectie")}</span><input type="date" value={verification.inspectionDate} onChange={(event) => setVerification({ ...verification, inspectionDate: event.target.value })} /></label>
                    </div>
                    <label className="form-field"><span>{text("Remarks / observations", "Opmerkingen / waarnemingen")}</span><textarea rows={2} maxLength={1000} value={verification.remarks} onChange={(event) => setVerification({ ...verification, remarks: event.target.value })} placeholder={text("What the re-inspection actually saw.", "Wat er bij de herinspectie daadwerkelijk is gezien.")} /><DictateButton onText={(transcript) => setVerification((current) => ({ ...current, remarks: appendDictation(current.remarks, transcript) }))} /></label>
                    <label className="form-field"><span>{text("Verification comments", "Verificatiecommentaar")}</span><textarea rows={2} maxLength={1000} value={verification.comments} onChange={(event) => setVerification({ ...verification, comments: event.target.value })} placeholder={text("Corrective action verified. NCR can be closed.", "Corrigerende maatregel geverifieerd. NCR kan worden gesloten.")} /><DictateButton onText={(transcript) => setVerification((current) => ({ ...current, comments: appendDictation(current.comments, transcript) }))} /></label>
                    <SignatureField
                      label={text("Sign as the person closing this NCR", "Onderteken als afsluiter van deze NCR")}
                      declaration={text(
                        "By signing you confirm the corrective action was verified and this non-conformance report is closed.",
                        "Met je handtekening bevestig je dat de correctieve actie is geverifieerd en dat dit non-conformance report wordt afgesloten.",
                      )}
                      hint={text("Signature, name and date are stored with the report.", "Handtekening, naam en datum worden bij het rapport bewaard.")}
                      nameSuggestion={currentUserName}
                      value={verificationSignature}
                      onChange={setVerificationSignature}
                    />
                    <label className="form-field"><span>{text("Position", "Functie")}</span><input value={verification.position} onChange={(event) => setVerification({ ...verification, position: event.target.value })} placeholder={text("Quality Engineer", "Quality Engineer")} /></label>
                  </div>
                ) : null}
                {(() => {
                  // A disabled button that does not say why is how a verification form gets abandoned.
                  const missing = [
                    note.trim().length < 2 ? text("note", "notitie") : "",
                    nextStatus === "ready_for_verification" && measure.trim().length < 3 ? text("final measure", "definitieve maatregel") : "",
                    finding.finding_type === "ncr" && nextStatus === "closed" && !verification.inspectionDate ? text("date of QC inspection", "datum QC-inspectie") : "",
                    finding.finding_type === "ncr" && nextStatus === "closed" && verification.comments.trim().length < 3 ? text("verification comments", "verificatiecommentaar") : "",
                    finding.finding_type === "ncr" && nextStatus === "closed" && !verificationSignature ? text("signature", "handtekening") : "",
                  ].filter(Boolean);
                  return missing.length ? <small className="confirm-needs">{text("Still needed", "Nog nodig")}: {missing.join(" · ")}</small> : null;
                })()}
                <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || note.trim().length < 2 || (nextStatus === "ready_for_verification" && measure.trim().length < 3) || (finding.finding_type === "ncr" && nextStatus === "closed" && (!verificationSignature || !verification.inspectionDate || verification.comments.trim().length < 3))} onClick={() => void transition(finding, nextStatus, note, measure, correction, verificationSignature?.name ?? "", verificationSignature?.image ?? "", finding.finding_type === "ncr" && nextStatus === "closed" ? {
                  verification_signed_position: verification.position.trim(),
                  verification_comments: verification.comments.trim(),
                  qc_inspection_date: verification.inspectionDate,
                  qc_issue_resolved: verification.issueResolved,
                  qc_remarks: verification.remarks.trim(),
                } : {}).then((okay) => { if (okay) { setActive(null); setNote(""); setMeasure(""); setCorrection(""); setVerificationSignature(null); setVerification({ ...emptyVerification }); } })}>{text("Confirm human status change", "Bevestig menselijke statuswijziging")}</button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function ReportOperations({ data, reportId, reportNumber, reportStatus, currentUserName, projectId, projectName, busy, run, client, openModule, openDeadlines, openReportCheck }: { data: OperationSnapshot; reportId: string | null; reportNumber: string; reportStatus: string; currentUserName: string; projectId: string; projectName: string; busy: boolean; run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>; client: SupabaseClient; openModule: (tab: "documents" | "drawings" | "findings" | "ncr" | "hse" | "inspections" | "registers" | "files" | "daily") => void; openDeadlines: () => void; openReportCheck?: () => void }) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? reportStatusLabelsEnglish : reportStatusLabels;
  const [reviewComment, setReviewComment] = useState("");
  const [signerRole, setSignerRole] = useState("supervisor");
  const [declaration, setDeclaration] = useState(() => text("I declare that I reviewed this fixed report version and confirmed it truthfully.", "Ik verklaar dat ik deze vastgezette rapportversie heb gecontroleerd en naar waarheid heb bevestigd."));
  /** The declaration is signed by hand, at the moment it is recorded. */
  const [reportSignature, setReportSignature] = useState<HandwrittenSignature | null>(null);
  const [distribution, setDistribution] = useState({ name: "", address: "", channel: "manual" });
  const [revisionReason, setRevisionReason] = useState("");
  /**
   * The declarations that belong to one fixed version. A version is signed after it is
   * frozen, so they travel next to the snapshot into the PDF and the Word file.
   */
  const signatureLines = (versionId: string) => data.reportSignatures
    .filter((signature) => signature.report_version_id === versionId)
    .map((signature) => ({
      name: signature.signer_name,
      role: signature.signer_role,
      declaration: signature.declaration,
      signedAt: signature.signed_at,
      legalLevel: signature.legal_level,
      // The signature that was written when the version was signed, so the file that
      // leaves the app carries it too.
      signatureImage: signature.signature_image ?? null,
    }));
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
  const [reportView, setReportView] = useState<"create" | "workflow" | "history" | "prompts">("create");
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
  /**
   * Who has to sign is a project setting, not a fixed list. The database refuses a role
   * the signer does not hold and only marks the report "signed" when every required role
   * of this project has signed, so the form has to offer exactly those roles.
   */
  const signingWorkflow = data.settings?.signing_workflow?.length
    ? data.settings.signing_workflow
    : [{ role: "supervisor", required: true }, { role: "project_manager", required: true }];
  const roleLabels: Record<string, string> = {
    supervisor: "Supervisor",
    lead_supervisor: "Lead supervisor",
    project_manager: text("Project manager", "Projectleider"),
    contractor: text("Contractor", "Aannemer"),
    client: text("Client", "Opdrachtgever"),
    quality_hse_manager: text("Quality/HSE", "Kwaliteit/HSE"),
  };
  const latestVersionId = data.reportVersions[0]?.id ?? "";
  const requiredRoles = signingWorkflow.filter((rule) => rule.required);
  const signedRequiredRoles = requiredRoles.filter((rule) => data.reportSignatures.some(
    (signature) => signature.report_version_id === latestVersionId && signature.signer_role === rule.role,
  ));
  // A project that does not use "supervisor" must not start on it either.
  const effectiveSignerRole = signingWorkflow.some((rule) => rule.role === signerRole)
    ? signerRole
    : signingWorkflow[0]?.role ?? "supervisor";
  const canDistribute = reportStatus === "signed" || reportStatus === "sent";
  const reportViews = [
    { id: "create" as const, icon: CalendarRange, title: text("Create report", "Rapport maken") },
    { id: "workflow" as const, icon: FileCheck2, title: text("Review & sign", "Review & onderteken") },
    { id: "history" as const, icon: Archive, title: text("Versions & history", "Versies & historie") },
    { id: "prompts" as const, icon: MessageCircle, title: text("Beyond this app", "Buiten deze app") },
  ];
  const workflowStep = canReview ? 1 : reportStatus === "approved" ? 2 : ["signed", "sent"].includes(reportStatus) ? 3 : 0;
  const workflowGuidance = !reportId
    ? text("Start the daily report through Project start first.", "Start eerst het dagrapport via Projectstart.")
    : ["draft", "in_progress", "returned"].includes(reportStatus)
      ? text("Next: complete the project start and daily questions for every building, then choose Check report → Ready for review.", "Volgende stap: rond per gebouw projectstart en dagvragen af en kies daarna Rapport controleren → Gereed voor review.")
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
      title: type === "weekly" ? text(`Week of ${formatDay(key, locale)}`, `Week van ${formatDay(key, locale)}`) : formatMonth(key, locale),
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
      <header className="secondary-header report-page-header ui-page-header"><div><h1>{text("Client reports", "Klantrapporten")}</h1></div><div className="report-header-state"><span className="record-number ui-page-header__code">{reportNumber}</span><span className={`report-state-pill ui-status-badge ${reportStatus}`}>{statusLabels[reportStatus] ?? reportStatus}</span></div></header>
      <SectionNav
        label={text("Report workspace", "Rapportwerkruimte")}
        items={[
          { id: "day", label: text("Daily report", "Dagrapport"), selected: reportView === "create" && periodPreset === "day", onSelect: () => { setReportView("create"); applyDatePreset(1, text("Daily supervision report", "Dagelijks supervisierapport"), "day"); } },
          { id: "week", label: text("Weekly report", "Weekrapport"), selected: reportView === "create" && periodPreset === "week", onSelect: () => { setReportView("create"); applyDatePreset(7, text("Weekly supervision report", "Wekelijks supervisierapport"), "week"); } },
          { id: "month", label: text("Monthly report", "Maandrapport"), selected: reportView === "create" && periodPreset === "month", onSelect: () => { setReportView("create"); setPeriod({ start: `${today.slice(0, 8)}01`, end: today }); setPeriodLabel(text("Monthly supervision report", "Maandelijks supervisierapport")); setPeriodPreset("month"); } },
          ...reportViews.map((view) => ({ id: view.id, label: view.title, selected: reportView === view.id && (view.id !== "create" || periodPreset === "custom"), onSelect: () => { setReportView(view.id); if (view.id === "create") setPeriodPreset("custom"); } })),
        ]}
      />
      {reportView === "prompts" ? (
        <PromptLibrary
          shortcuts={{
            // The month is the period most of these prompts are written for, so the
            // shortcut sets it rather than dropping the reader on an empty date range.
            openMonthlyReport: () => {
              setReportView("create");
              setPeriod({ start: `${today.slice(0, 8)}01`, end: today });
              setPeriodLabel(text("Monthly supervision report", "Maandelijks supervisierapport"));
              setPeriodPreset("month");
            },
            openReportBuilder: () => setReportView("create"),
            openModule,
            openDeadlines,
          }}
        />
      ) : null}
      {reportView === "create" ? (
        <section className="period-report-card ui-panel">
          <div className="period-report-copy"><h2>{text("Choose what the client needs", "Kies wat de klant nodig heeft")}</h2></div>
          <div className="period-report-types" role="radiogroup" aria-label={text("Report type", "Rapporttype")}>{reportChoices.map((choice) => <button className={reportChoice === choice.id ? "active" : ""} type="button" role="radio" aria-checked={reportChoice === choice.id} onClick={() => setReportChoice(choice.id)} key={choice.id}><strong>{choice.title}</strong><span>{choice.sections.length} {text("automatic sections", "automatische onderdelen")}</span></button>)}</div>
          <fieldset className="report-source-checklist">
            <legend>{text("Include in this report", "Opnemen in dit rapport")}</legend>
            {clientReportOptions.map((option) => <label key={option.id}><input type="checkbox" checked={includedClientOptions.includes(option.id)} onChange={() => toggleReportSection(option.id)} /><span>{option.label}</span></label>)}
          </fieldset>
          {/* The full library is a view of its own now; this points at it instead of
              hiding ten prompts behind a summary nobody opened. */}
          <button className="report-prompt-link" type="button" onClick={() => setReportView("prompts")}>
            <MessageCircle size={15} />
            <span>
              <strong>{text("Something this report cannot do?", "Iets wat dit rapport niet kan?")}</strong>
            </span>
            <ChevronRight size={15} />
          </button>
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
            {/* The step the guidance names has to be one tap away from it. */}
            {reportId && openReportCheck && ["draft", "in_progress", "returned"].includes(reportStatus) ? (
              <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={openReportCheck}><ClipboardCheck size={15} /> {text("Check report", "Rapport controleren")}</button>
            ) : null}
          </div>
          <section className="workflow-grid">
            <div className={`workflow-card ${workflowStep === 1 ? "current" : workflowStep > 1 ? "complete" : "locked"}`}><div className="workflow-icon"><ClipboardCheck size={19} /></div><h2>1. Review</h2><p>{text("Approval freezes this version (SHA-256). A returned report needs a reason.", "Goedkeuring bevriest deze versie (SHA-256). Retour vraagt een reden.")}</p><label className="form-field"><span>{text("Review comment", "Reviewcommentaar")}</span><textarea rows={3} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /><DictateButton onText={(transcript) => setReviewComment((current) => appendDictation(current, transcript))} /></label><div className="button-row"><button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || !reportId || !canReview || reviewComment.trim().length < 2} onClick={() => void run(() => reviewReport(client, reportId!, "returned", reviewComment), text("Report returned for correction with a reason.", "Rapport gemotiveerd teruggestuurd voor correctie."))}>{text("Return", "Terugsturen")}</button><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !reportId || !canReview || reviewComment.trim().length < 2} onClick={() => void run(() => reviewReport(client, reportId!, "approved", reviewComment), text("Report approved and frozen as an immutable version.", "Rapport goedgekeurd en als onveranderbare versie vastgezet."))}><FileCheck2 size={15} /> {text("Approve and freeze", "Goedkeuren & vastzetten")}</button></div></div>
            <div className={`workflow-card ${workflowStep === 2 ? "current" : workflowStep > 2 ? "complete" : "locked"}`}><div className="workflow-icon"><FileCheck2 size={19} /></div><h2>2. {text("Signing declaration", "Ondertekenverklaring")}</h2><p>{text("Identity, project role, version hash and declaration remain append-only. The legal level remains", "Identiteit, projectrol, versiehash en verklaring blijven append-only bewaard. Het juridische niveau blijft")} <strong>contract pending</strong> {text("until CODECO formally decides.", "totdat CODECO dit formeel kiest.")}</p><label className="form-field"><span>{text("Sign as", "Onderteken als")}</span><select value={effectiveSignerRole} onChange={(event) => setSignerRole(event.target.value)}>{signingWorkflow.map((rule) => <option value={rule.role} key={rule.role}>{roleLabels[rule.role] ?? rule.role.replaceAll("_", " ")}{rule.required ? ` · ${text("required", "verplicht")}` : ""}</option>)}</select><small>{text(`${signedRequiredRoles.length} of ${requiredRoles.length} required signatures recorded. You can only sign in a role you hold.`, `${signedRequiredRoles.length} van ${requiredRoles.length} verplichte handtekeningen gezet. Je kunt alleen tekenen in een rol die je hebt.`)}</small></label><label className="form-field"><span>{text("Declaration", "Verklaring")}</span><textarea rows={3} value={declaration} onChange={(event) => setDeclaration(event.target.value)} /><DictateButton onText={(transcript) => setDeclaration((current) => appendDictation(current, transcript))} /></label>{/* The declaration is signed here and now, by hand, like every other document in the app. */}<SignatureField label={text("Sign this declaration", "Onderteken deze verklaring")} declaration={declaration} hint={text("The signature is stored with the version hash and cannot be changed.", "De handtekening wordt met de versiehash bewaard en kan niet worden gewijzigd.")} nameSuggestion={currentUserName} value={reportSignature} onChange={setReportSignature} disabled={!canSign} disabledHint={text("You can only sign in a project role you actually hold.", "Je kunt alleen tekenen in een projectrol die je echt hebt.")} /><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !reportId || !canSign || declaration.trim().length < 10 || !reportSignature} onClick={() => void run(async () => { await signReport(client, reportId!, effectiveSignerRole, reportSignature?.name || currentUserName, declaration, reportSignature?.image ?? null); setReportSignature(null); }, text("Signing declaration immutably linked to the report version.", "Ondertekenverklaring onveranderbaar aan de rapportversie gekoppeld."))}><FileCheck2 size={15} /> {text("Record signed declaration", "Ondertekende verklaring vastleggen")}</button></div>
            <div className={`workflow-card ${workflowStep === 3 ? "current" : "locked"}`}><div className="workflow-icon"><Users size={19} /></div><h2>3. {text("Distribution", "Distributie")}</h2><p>{text("Record only deliveries that took place.", "Leg alleen verzendingen vast die hebben plaatsgevonden.")}</p><label className="form-field"><span>{text("Recipient", "Ontvanger")}</span><input value={distribution.name} onChange={(event) => setDistribution({ ...distribution, name: event.target.value })} /></label><label className="form-field"><span>{text("Address / reference", "Adres / referentie")}</span><input value={distribution.address} onChange={(event) => setDistribution({ ...distribution, address: event.target.value })} /></label><label className="form-field"><span>{text("Channel", "Kanaal")}</span><select value={distribution.channel} onChange={(event) => setDistribution({ ...distribution, channel: event.target.value })}><option value="manual">{text("Manual transfer", "Handmatige overdracht")}</option><option value="email">{text("Email (sent externally)", "E-mail (extern verzonden)")}</option><option value="download">{text("Secure download", "Beveiligde download")}</option></select></label><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !reportId || !canDistribute || distribution.name.trim().length < 2 || distribution.address.trim().length < 3} onClick={() => void run(() => recordDistribution(client, reportId!, distribution.name, distribution.address, distribution.channel), text("Traceable distribution record added to the fixed version.", "Aantoonbare distributieregel aan de vastgezette versie toegevoegd."))}><FileText size={15} /> {text("Record distribution", "Distributie registreren")}</button></div>
          </section>
        </>
      ) : null}
      {reportView === "history" ? (
        <>
          <section className="report-archive">
            <header><div><span className="record-number">{text("Report history", "Rapporthistorie")}</span><h2>{text("All available reports", "Alle beschikbare rapporten")}</h2></div><label className="form-field"><span>{text("Report type", "Rapporttype")}</span><select value={historyType} onChange={(event) => setHistoryType(event.target.value as typeof historyType)}><option value="all">{text("All reports", "Alle rapporten")}</option><option value="daily">{text("Daily", "Dagrapport")}</option><option value="weekly">{text("Weekly", "Weekrapport")}</option><option value="monthly">{text("Monthly", "Maandrapport")}</option></select></label></header>
            <div className="report-archive-list">
              {reportArchive.map((report) => <article className={openHistoryId === report.id ? "open" : ""} key={report.id}>
                <button type="button" onClick={() => setOpenHistoryId((current) => current === report.id ? "" : report.id)}><span className={`report-type-badge ${report.type}`}>{report.type === "weekly" ? text("Weekly", "Week") : report.type === "monthly" ? text("Monthly", "Maand") : text("Daily", "Dag")}</span><span><strong>{report.title}</strong><small>{formatDay(report.start, locale)}{report.end !== report.start ? ` → ${formatDay(report.end, locale)}` : ""} · {report.count} {text("day record(s)", "dagregistratie(s)")}</small></span><span className="report-archive-progress"><b>{report.completeness}%</b><i><em style={{ width: `${report.completeness}%` }} /></i></span><ArrowRight size={15} /></button>
                {openHistoryId === report.id ? <div className="report-archive-detail"><span>{text("Status", "Status")}: <strong>{statusText(report.status, text)}</strong></span><span>{text("Content", "Inhoud")}: {text("complete record for this period", "volledige registratie over deze periode")}</span><ReportDownloadButtons disabled={busy} onDownloadPdf={() => run(async () => { const snapshot = await buildPeriodReportSnapshot(client, projectId, report.start, report.end); const { downloadPeriodReportPdf } = await import("@/lib/reports/period-report-pdf"); await downloadPeriodReportPdf(snapshot, { reportTitle: report.title, headerText: data.settings?.report_header, footerText: data.settings?.report_footer }); }, text("Archived report view downloaded.", "Rapportweergave uit de historie gedownload."))} onDownloadWord={() => run(async () => { const snapshot = await buildPeriodReportSnapshot(client, projectId, report.start, report.end); const { downloadPeriodReportDocx } = await import("@/lib/reports/period-report-docx"); await downloadPeriodReportDocx(snapshot, { reportTitle: report.title, headerText: data.settings?.report_header, footerText: data.settings?.report_footer }); }, text("Archived report view downloaded as Word.", "Rapportweergave uit de historie als Word gedownload."))} /></div> : null}
              </article>)}
              {!reportArchive.length ? <div className="empty-list-state"><Archive size={22} /><strong>{text("No reports for this filter", "Geen rapporten voor dit filter")}</strong></div> : null}
            </div>
          </section>
          <section className="report-history-grid">
            <HistoryColumn title={text("Fixed versions", "Vastgezette versies")} empty={text("No immutable version yet.", "Nog geen vastgezette versie.")} rows={data.reportVersions.map((version) => <div className="history-version" key={version.id}><span>{text("Revision", "Revisie")} {version.revision} · {formatDate(version.created_at, locale)} · SHA {version.sha256.slice(0, 12)}…</span><ReportDownloadButtons disabled={busy} onDownloadPdf={() => run(async () => { const { downloadFormalReportPdf } = await import("@/lib/reports/daily-report-pdf"); await downloadFormalReportPdf(version.snapshot as FormalReportSnapshot, version.revision, version.sha256, signatureLines(version.id)); }, text(`Revision ${version.revision} downloaded.`, `Revisie ${version.revision} gedownload.`))} onDownloadWord={() => run(async () => { const { downloadFormalReportDocx } = await import("@/lib/reports/daily-report-docx"); await downloadFormalReportDocx(version.snapshot as FormalReportSnapshot, version.revision, version.sha256, signatureLines(version.id)); }, text(`Revision ${version.revision} downloaded as Word.`, `Revisie ${version.revision} als Word gedownload.`))} /></div>)} />
            <HistoryColumn title="Reviews" empty={text("No review decision yet.", "Nog geen reviewbesluit.")} rows={data.reportReviews.map((review) => `${statusLabels[review.decision] ?? review.decision} · ${review.comment} · ${formatDate(review.created_at, locale)}`)} />
            <HistoryColumn title={text("Declarations", "Verklaringen")} empty={text("No signing declaration yet.", "Nog geen ondertekenverklaring.")} rows={data.reportSignatures.map((signature) => `${signature.signer_name} · ${roleLabels[signature.signer_role] ?? codeText(signature.signer_role, text)} · ${formatDate(signature.signed_at, locale)}`)} />
            <HistoryColumn title={text("Distribution", "Distributie")} empty={text("No delivery recorded yet.", "Nog geen verzending geregistreerd.")} rows={data.reportDistributions.map((item) => `${item.recipient_name} · ${item.channel} · ${item.status}`)} />
          </section>
          {reportStatus === "approved" || reportStatus === "signed" || reportStatus === "sent" ? <div className="revision-bar"><div><strong>{text("Correction after freezing?", "Correctie na vastzetten?")}</strong><span>{text("Corrections start a new revision.", "Correcties starten een nieuwe revisie.")}</span></div><input value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} aria-label={text("Required revision reason", "Verplichte revisiereden")} placeholder={text("Required revision reason", "Verplichte revisiereden")} /><button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || !reportId || revisionReason.trim().length < 5} onClick={() => void run(() => startRevision(client, reportId!, revisionReason), text("New revision started. The original is unchanged.", "Nieuwe revisie gestart. Het origineel is ongewijzigd."))}><RotateCcw size={15} /> {text("Start revision", "Start revisie")}</button></div> : null}
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
  const latestScheduledBackup = data.backupRuns.find((item) => item.run_type === "scheduled" && item.status === "verified");
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
    void run(() => createChecklist(client, { organizationId, projectId, module: template.module, code: template.code, name: template.name, prompts }), text("Checklist published. Earlier inspections keep their version.", "Checklist gepubliceerd. Eerdere inspecties behouden hun versie.")).then((okay) => { if (okay) setTemplate({ module: "inspection", code: "", name: "", prompts: "" }); });
  };
  return (
    <>
      <header className="secondary-header ui-page-header"><div><h1>{section === "overview" ? text("Management overview", "Managementoverzicht") : text("Administration and control", "Beheer en controle")}</h1><span className="ui-page-header__code">{projectName}</span></div><div className="management-header-actions">{canManageOrganization ? <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={openUserAdmin}><Users size={15} /> {text("Manage team", "Team beheren")}</button> : null}</div></header>
      <SectionNav
        label={text("Management sections", "Beheeronderdelen")}
        items={([["overview", text("Overview", "Overzicht")], ["settings", text("Team & rules", "Team & regels")], ["structure", text("Project setup", "Projectinrichting")], ["templates", text("Quality standards", "Kwaliteitsstandaarden")], ["backup", text("Backup & continuity", "Back-up & continuïteit")]] as const).map(([id, label]) => ({ id, label, selected: section === id, onSelect: () => setSection(id) }))}
      />
      {section === "overview" ? <section className="management-overview">
        <div className="management-kpis">
          <button className={data.settings ? "healthy" : "attention"} type="button" onClick={() => setSection("settings")}><span>{text("Project configuration", "Projectconfiguratie")}</span><strong>{data.settings ? text("Active", "Actief") : text("Missing", "Ontbreekt")}</strong>{data.settings ? null : <small>{text("Project rules require configuration", "Projectregels moeten worden ingesteld")}</small>}</button>
          <button className={criticalFindings.length ? "attention" : ""} type="button" onClick={() => openProjectArea("findings")}><span>{text("High-risk findings", "Hoog-risico bevindingen")}</span><strong>{criticalFindings.length}</strong><small>{openFindings.length} {text("findings still open", "bevindingen nog open")}</small></button>
          <button type="button" onClick={() => openProjectArea("inspections")}><span>{text("Active control work", "Actief controlewerk")}</span><strong>{activeInspections.length}</strong><small>{data.inspections.length} {text("inspections recorded", "inspecties geregistreerd")}</small></button>
          <button className={latestScheduledBackup ? "healthy" : "attention"} type="button" onClick={() => setSection("backup")}><span>{text("Continuity", "Continuïteit")}</span><strong>{latestScheduledBackup ? text("Verified", "Geverifieerd") : text("Pending", "Openstaand")}</strong><small>{latestScheduledBackup ? formatDate(latestScheduledBackup.verified_at) : text("Verified backup required", "Geverifieerde back-up vereist")}</small></button>
        </div>
        <div className="management-columns">
          <article className="management-card ui-panel"><header className="ui-panel__heading"><h2>{text("Management attention", "Managementaandacht")}</h2></header><div className="management-attention-list">{criticalFindings.length ? criticalFindings.slice(0, 4).map((item) => <div className="ui-list-row" key={item.id}><span><strong>{item.title}</strong><small>{item.finding_number} · {statusText(item.status, text)}</small></span></div>) : <div className="management-clear"><CheckCircle2 size={18} /><span><strong>{text("No high-risk findings", "Geen hoog-risico bevindingen")}</strong></span></div>}</div></article>
          <article className="management-card ui-panel"><header className="ui-panel__heading"><h2>{text("Management controls", "Managementbediening")}</h2></header><div className="management-control-list"><button type="button" onClick={openUserAdmin}><Users size={16} /><span><strong>{text("Team and access", "Team en toegang")}</strong></span></button><button type="button" onClick={() => setSection("settings")}><Settings size={16} /><span><strong>{text("Project rules", "Projectregels")}</strong></span></button><button type="button" onClick={() => setSection("structure")}><Wrench size={16} /><span><strong>{text("Structure and parties", "Structuur en partijen")}</strong></span></button><button type="button" onClick={() => setSection("backup")}><DatabaseBackup size={16} /><span><strong>{text("Continuity controls", "Continuïteitscontrole")}</strong></span></button></div></article>
        </div>
        <section className="external-submission-center">
          <header><div><span className="record-number">{text("External parties", "Externe partijen")}</span><h2>{text("Submissions, decisions and task ownership", "Indieningen, besluiten en taakverdeling")}</h2></div><div className="button-row"><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => openProjectArea("submissions")}><FileText size={15} /> {text("Record external submission", "Externe indiening registreren")}</button><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={openActionCenter}><ClipboardCheck size={15} /> {text("Manage tasks", "Taken beheren")}</button><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={createProjectAction}><Plus size={15} /> {text("Assign follow-up", "Opvolging toewijzen")}</button></div></header>
          <div className="external-access-summary">
            <span><KeyRound size={17} /><strong>{text("With account", "Met account")}</strong></span>
            <span><Link2 size={17} /><strong>{text("Without account", "Zonder account")}</strong></span>
            <span><Archive size={17} /><strong>{externalSubmissions.length} {text("submissions", "indieningen")}</strong><small>{externalSubmissions.filter((entry) => !["approved", "closed", "cancelled"].includes(entry.status)).length} {text("require a decision", "vragen een besluit")}</small></span>
          </div>
        </section>
          <section className="company-task-assignment ui-panel">
            <header>
              <div><span className="record-number">{text("Company employees", "Eigen medewerkers")}</span><h3>{text("Assign and redistribute project tasks", "Projecttaken toewijzen en herverdelen")}</h3></div>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={openUserAdmin}><Users size={15} /> {text("Manage employees", "Medewerkers beheren")}</button>
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
                      <div><span className={`priority-dot ${action.priority}`} /><span><strong>{action.title}</strong><small>{action.action_number} · {statusText(action.status, text)} · {text("Current", "Huidig")}: {employeeName(action.owner_user_id)}</small></span></div>
                      <label className="form-field"><span>{text("Responsible employee", "Verantwoordelijke medewerker")}</span><select value={selectedUserId} onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [action.id]: event.target.value }))}><option value="">{text("Choose an employee", "Kies een medewerker")}</option>{companyEmployees.map((employee) => <option value={employee.userId} key={employee.userId}>{employee.displayName?.trim() || employee.email}</option>)}</select></label>
                      <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || !changed} onClick={() => void run(() => assignProjectAction(client, { actionId: action.id, ownerUserId: selectedUserId, note: "Assigned or reassigned by Management." }), text("Task assigned.", "Taak toegewezen.")).then((okay) => { if (okay) setAssignmentDrafts((current) => { const next = { ...current }; delete next[action.id]; return next; }); })}>{text("Assign", "Toewijzen")}</button>
                    </article>;
                  })}
                  {!assignableActions.length ? <div className="empty-list-state"><CheckCircle2 size={20} /><strong>{text("No open project tasks", "Geen open projecttaken")}</strong></div> : null}
                </div>
              </>
            ) : <div className="operation-alert warning"><Users size={18} /><div><strong>{text("No assignable company employees", "Geen toewijsbare eigen medewerkers")}</strong><span>{text("Add an active employee first.", "Voeg eerst een actieve medewerker toe.")}</span></div></div>}
          </section>
          <ControlledDocumentList entries={externalSubmissions} buildings={buildings} locationNodes={data.locationNodes} busy={busy} currentUserName={text("Company / owner reviewer", "Reviewer bedrijf / eigenaar")} client={client} run={run} />
        <div className="management-context"><div><span>{text("Current report", "Huidig rapport")}</span><strong>{statusText(reportStatus, text)}</strong></div><div><span>{text("Project locations", "Projectlocaties")}</span><strong>{data.locationNodes.length}</strong></div><div><span>{text("Published checklists", "Gepubliceerde checklists")}</span><strong>{data.templates.filter((item) => item.status === "published").length}</strong></div><div><span>{text("Controlled files", "Beheerde bestanden")}</span><strong>{data.files.length}</strong></div></div>
      </section> : null}
      {section === "settings" ? (
        <section className="operation-panel">
          <div className="admin-card-grid">
            {canManageOrganization ? <button className="module-card" type="button" onClick={openUserAdmin}><span className="module-card-icon"><Users size={19} /></span><h2>{text("Users and access", "Gebruikers en toegang")}</h2><p>{text("Only administrators can create accounts and assign roles.", "Alleen beheerders kunnen accounts aanmaken en rollen toewijzen.")}</p></button> : null}
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
              <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !data.settings || settings.disciplines.split("\n").filter((item) => item.trim()).length === 0 || settings.reportSections.length === 0} onClick={() => data.settings && void run(() => saveProjectSettings(client, data.settings!, {
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
      {section === "structure" ? <section className="operation-panel"><div className="admin-card-grid"><div className="operation-form"><h2>{text("Location tree", "Locatieboom")} · {buildings.find((item) => item.id === structureBuildingId)?.name ?? buildingName}</h2><BuildingPicker id="structure-building" buildings={buildings} value={structureBuildingId} onChange={setStructureBuildingId} /><div className="form-grid-2"><label className="form-field"><span>Type</span><select value={location.type} onChange={(event) => setLocation({ ...location, type: event.target.value })}><option value="zone">{text("Zone", "Zone")}</option><option value="floor">{text("Floor", "Verdieping")}</option><option value="room">{text("Room", "Ruimte")}</option><option value="element">{text("Element", "Element")}</option><option value="work_package">{text("Work package", "Werkpakket")}</option></select></label><label className="form-field"><span>Code</span><input value={location.code} onChange={(event) => setLocation({ ...location, code: event.target.value })} /></label></div><label className="form-field"><span>{text("Name", "Naam")}</span><input value={location.name} onChange={(event) => setLocation({ ...location, name: event.target.value })} /></label><label className="form-field"><span>{text("Parent location", "Bovenliggende locatie")}</span><select value={location.parentId} onChange={(event) => setLocation({ ...location, parentId: event.target.value })}><option value="">{text("Directly under", "Direct onder")} {buildings.find((item) => item.id === structureBuildingId)?.name ?? buildingName}</option>{data.locationNodes.filter((node) => node.building_id === structureBuildingId).map((node) => <option value={node.id} key={node.id}>{node.code} · {node.name}</option>)}</select></label><label className="form-field"><span>{text("Notes", "Toelichting")}</span><input value={location.description} onChange={(event) => setLocation({ ...location, description: event.target.value })} /></label><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || location.code.trim().length < 1 || location.name.trim().length < 2} onClick={() => void run(() => createLocationNode(client, { organizationId, projectId, buildingId: structureBuildingId, parentId: location.parentId, type: location.type, code: location.code, name: location.name, description: location.description }), "Locatie aan de vaste projecthiërarchie toegevoegd.").then((okay) => { if (okay) setLocation({ type: "zone", code: "", name: "", parentId: "", description: "" }); })}><Plus size={15} /> {text("Add location", "Locatie toevoegen")}</button><div className="compact-register">{data.locationNodes.filter((node) => node.building_id === structureBuildingId).map((node) => <span key={node.id}><strong>{node.code}</strong> {node.name} · {typeText(node.node_type, text)}</span>)}</div></div><div className="operation-form"><h2>{text("Project parties", "Projectpartijen")}</h2><div className="form-grid-2"><label className="form-field"><span>Type</span><select value={party.type} onChange={(event) => setParty({ ...party, type: event.target.value })}><option value="client">{text("Client", "Opdrachtgever")}</option><option value="supervisor">Supervisor</option><option value="contractor">{text("Contractor", "Aannemer")}</option><option value="subcontractor">{text("Subcontractor", "Onderaannemer")}</option><option value="supplier">{text("Supplier", "Leverancier")}</option><option value="consultant">{text("Consultant", "Adviseur")}</option><option value="other">{text("Other", "Overig")}</option></select></label><label className="form-field"><span>Code</span><input value={party.code} onChange={(event) => setParty({ ...party, code: event.target.value })} /></label></div><label className="form-field"><span>{text("Name", "Naam")}</span><input value={party.name} onChange={(event) => setParty({ ...party, name: event.target.value })} /></label><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || party.code.trim().length < 1 || party.name.trim().length < 2} onClick={() => void run(() => createProjectParty(client, { organizationId, projectId, code: party.code, name: party.name, type: party.type }), "Projectpartij centraal toegevoegd en beschikbaar voor aanwezigheid en toewijzing.").then((okay) => { if (okay) setParty({ type: "contractor", code: "", name: "" }); })}><Users size={15} /> {text("Add party", "Partij toevoegen")}</button><div className="compact-register">{parties.map((item) => <span key={item.id}><strong>{item.name}</strong> {partyTypeText(item.type, text)}</span>)}</div></div></div></section> : null}
      {section === "templates" ? (
        <section className="operation-panel checklist-management">
          <div className="checklist-library-header">
            <div><span className="record-number">{text("Client requirement", "Klanteis")}</span><h2>{text(`${data.checklistLibrary.length} ready-to-install construction checklists`, `${data.checklistLibrary.length} direct installeerbare bouwchecklists`)}</h2><p>{text("Installing creates a project version; completed inspections keep their original version.", "Installeren maakt een projectversie; afgeronde inspecties behouden hun oorspronkelijke versie.")}</p></div>
            <label className="form-field"><span>{text("Category", "Categorie")}</span><select value={libraryCategory} onChange={(event) => setLibraryCategory(event.target.value)}><option value="all">{text(`All ${data.checklistLibrary.length}`, `Alle ${data.checklistLibrary.length}`)}</option>{[...new Set(data.checklistLibrary.map((item) => item.category))].map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
          </div>
          <div className="checklist-library-grid">
            {data.checklistLibrary.filter((item) => libraryCategory === "all" || item.category === libraryCategory).map((item) => {
              const installed = data.templates.some((templateItem) => templateItem.project_id === projectId && templateItem.code === item.code && templateItem.status === "published");
              return <article className="checklist-library-card" key={item.code}><span>{item.code} · {item.category}</span><h3>{item.name}</h3><small>{item.prompts.length} {text("mandatory checkpoints", "verplichte controlepunten")}</small><button className={installed ? "ui-button ui-button--secondary ui-button--md" : "ui-button ui-button--primary ui-button--md"} type="button" disabled={busy || installed} onClick={() => void run(() => installChecklistLibraryTemplate(client, projectId, item.code), text(`${item.name} installed as a project checklist.`, `${item.name} als projectchecklist geïnstalleerd.`))}>{installed ? <CheckCircle2 size={15} /> : <Plus size={15} />} {installed ? text("Installed", "Geïnstalleerd") : text("Install checklist", "Installeer checklist")}</button></article>;
            })}
          </div>
          <details className="custom-checklist-details"><summary>{text("Create a custom project checklist", "Maak een eigen projectchecklist")}</summary><div className="operation-form"><h2>{text("Publish new project checklist", "Nieuwe projectchecklist publiceren")}</h2><div className="form-grid-2"><label className="form-field"><span>{text("Module", "Module")}</span><select value={template.module} onChange={(event) => setTemplate({ ...template, module: event.target.value })}><option value="inspection">{text("Inspection", "Inspectie")}</option><option value="hse">HSE</option><option value="delivery">{text("Delivery", "Levering")}</option><option value="test">{text("Test / measurement", "Test / meting")}</option></select></label><label className="form-field"><span>Code</span><input value={template.code} onChange={(event) => setTemplate({ ...template, code: event.target.value })} placeholder={text("For example CONC-01", "Bijv. BETON-01")} /></label></div><label className="form-field"><span>{text("Name", "Naam")}</span><input value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} /></label><label className="form-field"><span>{text("Checkpoints · one per line", "Controlepunten · één per regel")}</span><textarea rows={6} value={template.prompts} onChange={(event) => setTemplate({ ...template, prompts: event.target.value })} /><DictateButton onText={(transcript) => setTemplate((current) => ({ ...current, prompts: appendDictation(current.prompts, transcript) }))} /></label><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={addTemplate}><Plus size={15} /> {text("Publish checklist", "Checklist publiceren")}</button></div></details>
          <div className="template-grid">{data.templates.map((item) => <article className="template-card" key={item.id}><span>{item.module.toUpperCase()} · {item.code} · v{item.version_number}</span><h3>{item.name}</h3><p>{item.items.length} {text("checkpoints", "controlepunten")} · {statusText(item.status, text)}</p></article>)}</div>
        </section>
      ) : null}
      {section === "backup" ? (
        <BackupCenter
          client={client}
          data={data}
          organizationId={organizationId}
          projectId={projectId}
          projectName={projectName}
          canManageOrganization={canManageOrganization}
          isStorageGatewayConfigured={isStorageGatewayConfigured}
          busy={busy}
          run={run}
        />
      ) : null}
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
      <div className="operation-alert warning"><AlertTriangle size={18} /><div><strong>{text("Evidence references, never secrets", "Bewijsreferenties, nooit geheimen")}</strong><span>{text("Enter only ticket numbers, dates, names or locations. Never paste passwords, tokens or recovery codes.", "Voer alleen ticketnummers, datums, namen of locaties in. Plak nooit wachtwoorden, tokens of herstelcodes.")}</span></div></div>
      {!editable ? <div className="operation-alert"><ShieldCheck size={18} /><div><strong>{text("Read only", "Alleen-lezen")}</strong><span>{text("Only an administrator can change this.", "Alleen een beheerder kan dit wijzigen.")}</span></div></div> : null}
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
        <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={!editable || busy || unchanged || (requiresEvidence && evidence.trim().length < 5)} onClick={() => void run(() => updateProductionReadiness(client, item.id, status, evidence), text(`${item.code} updated centrally and recorded in the audit log.`, `${item.code} centraal bijgewerkt en in het auditlog vastgelegd.`))}><ShieldCheck size={15} /> {text("Save status", "Status opslaan")}</button>
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
      setMessage(text("Two-step verification is on.", "Tweestapsverificatie staat aan."));
    }
    setLoading(false);
  };

  return (
    <div className="mfa-card">
      <span className="module-card-icon"><KeyRound size={19} /></span>
      <div><h2>{text("Two-step verification", "Tweestapsverificatie")}</h2><p>{verified ? text("Authenticator active for this internal account.", "Authenticator actief voor dit interne account.") : text("Protect admin, review and signing with an authenticator app.", "Beveilig beheer, review en ondertekening met een authenticator-app.")}</p></div>
      {error ? <span className="inline-error">{error}</span> : null}
      {message ? <span className="inline-success">{message}</span> : null}
      {!verified && !qrCode ? <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={loading} onClick={() => void enroll()}>{loading ? <Loader2 className="spin" size={15} /> : <KeyRound size={15} />} {text("Set up authenticator", "Authenticator instellen")}</button> : null}
      {qrCode ? <div className="mfa-enroll"><NextImage src={qrCode} alt={text("QR code for CODECO two-step verification", "QR-code voor CODECO tweestapsverificatie")} width={150} height={150} unoptimized /><div><span>{text("Scan with your authenticator app or use this key:", "Scan met je authenticator-app of gebruik deze sleutel:")}</span><code>{secret}</code><label className="form-field"><span>{text("6-digit code", "6-cijferige code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={loading || code.length !== 6} onClick={() => void verify()}>{text("Confirm authenticator", "Bevestig authenticator")}</button></div></div> : null}
    </div>
  );
}

function HistoryColumn({ title, empty, rows }: { title: string; empty: string; rows: React.ReactNode[] }) {
  return <div className="history-column"><h3>{title}</h3>{rows.length ? <ul>{rows.map((row, index) => <li key={index}>{row}</li>)}</ul> : <p>{empty}</p>}</div>;
}
