"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  FileCheck2,
  FileText,
  Gauge,
  HardDrive,
  Home,
  Image,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MessageSquareText,
  PackageCheck,
  PenLine,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Settings,
  Share,
  ShieldCheck,
  TimerOff,
  Users,
  UserPlus,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ALL_BUILDINGS, BuildingMultiPicker, BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { screenFromSearch, useScreenHistory, type AppScreen } from "@/lib/navigation/app-history";
import { DictateButton, appendDictation } from "@/app/dictate-button";
import { photoEvidenceLine, photoTitle, photoUploadDescription, PhotoEvidenceList, toPhotoEvidence, type PhotoEvidence } from "@/app/photo-evidence";
import { SketchPad } from "@/app/sketch-pad";
import { ClientDashboard } from "@/app/client-dashboard";
import { DailyLogModal } from "@/app/daily-log-modal";
import { LiveWeatherChip } from "@/app/live-weather-chip";
import { LocationPicker, locationBreadcrumb, type ProjectLocationOption } from "@/app/location-picker";
import { FieldGuide } from "@/app/field-guide";
import { OperationalWorkspace } from "@/app/operational-workspace";
import type { ActionCenterView } from "@/app/project-action-center";
import { ReportDownloadButtons } from "@/app/report-download-buttons";
import { ensureDailyBackup } from "@/lib/backups/client";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { startCompassWatch } from "@/lib/images/compass";
import { WorkforceModal } from "@/app/workforce-register";
import { requestProjectNotificationDispatch } from "@/lib/notifications/client";
import { currentPushState, enablePushNotifications, type PushState } from "@/lib/notifications/push-client";
import { compressFieldPhoto, dataSaverEnabled, forceSyncOfflineUploads, queueOfflineUpload, syncOfflineUploads } from "@/lib/offline/upload-queue";
import { cacheProjectDay, cacheWorkspace, getCachedProjectDay, getCachedWorkspace } from "@/lib/offline/workspace-cache";
import { loadWithOfflineCache } from "@/lib/offline/query-cache";
import { isPendingRecordId, listOfflineRecords, saveRecordOnlineOrQueue, syncOfflineRecords } from "@/lib/offline/record-queue";
import { withPendingActions } from "@/lib/offline/pending-records";
import { offlineQueryKeys } from "@/lib/offline/query-keys";
import { getSessionWithOfflineFallback, storedSessionOnThisDevice } from "@/lib/supabase/offline-session";
import { OfflineManagerModal } from "@/app/offline-manager";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  clientReportSections,
  createDailyCloseoutSchema,
  createProjectStartSchema,
  getProjectStartAutomation,
  type DailyCloseoutAnswers,
  type ProjectStartAnswers,
} from "@/lib/forms/daily-report";
import {
  createAuthSchema,
  createOrganizationSetupSchema,
  createPasswordSetupSchema,
  createProjectSetupSchema,
  type AuthAnswers,
  type OrganizationSetupAnswers,
  type PasswordSetupAnswers,
  type ProjectSetupAnswers,
} from "@/lib/forms/workspace";
import {
  createInternalUserInviteSchema,
  type InternalUserInviteAnswers,
} from "@/lib/forms/users";
import {
  actionTransitionSchema,
  projectActionSchema,
  type ActionTransitionAnswers,
  type ProjectActionAnswers,
} from "@/lib/forms/actions";
import {
  bootstrapOrganization,
  createBuilding,
  createProjectAction,
  createOrGetReport,
  createProjectWorkspace,
  inviteInternalUser,
  loadInternalAccess,
  loadProjectConfiguration,
  loadProjectDrawings,
  loadProjectLocations,
  loadProjectNotifications,
  loadProjectDay,
  loadWorkspace,
  markNotificationRead,
  reportDateInSuriname,
  loadPreviousWorkdayAttendance,
  saveAttendance,
  saveDailyCloseout,
  saveProjectStart,
  saveSiteRegistration,
  setInternalUserAccessStatus,
  setUserProjectRole,
  submitReportForReview,
  transitionProjectAction,
  type ActionUpdate,
  type InternalAccessSnapshot,
  type InternalMember,
  type ProjectAction,
  type ProjectDaySnapshot,
  type ProjectParty,
  type ProjectNotification,
  type ProjectDrawingOption,
  type WorkspaceBuilding,
  type WorkspaceProject,
} from "@/lib/supabase/data";
import type { DailyReportPdfSnapshot } from "@/lib/reports/daily-report-pdf";
import type { CurrentProjectWeather } from "@/lib/weather";

function CompanyLogo({ subtitle }: { subtitle?: string }) {
  return (
    <span className="company-lockup">
      <NextImage
        className="company-logo"
        src="/codeco-logo.png"
        alt="CODECO Construction Designers & Consultants N.V."
        width={738}
        height={291}
        sizes="(max-width: 620px) 150px, 190px"
        priority
      />
      {subtitle ? <small className="company-logo-context">{subtitle}</small> : null}
    </span>
  );
}

type NavKey = "vandaag" | "project" | "acties" | "projectdocs" | "punchlist" | "verify" | "rapporten" | "meer";
type ProjectTabKey = "home" | "inspections" | "findings" | "ncr" | "hse" | "daily" | "documents" | "registers" | "visual" | "drawings" | "tools" | "files";
const navKeys: NavKey[] = ["vandaag", "project", "acties", "projectdocs", "punchlist", "verify", "rapporten", "meer"];
const projectTabKeys: ProjectTabKey[] = ["home", "inspections", "findings", "ncr", "hse", "daily", "documents", "registers", "visual", "drawings", "tools", "files"];
type ModalKey = "quick" | "entry" | "action_create" | "action_detail" | "report" | "attendance" | "one_tap_log" | "daily_questions" | "project_start" | "user_admin" | "notifications" | "manage_buildings" | "offline" | null;
type WorkspaceStage = "projects" | "cockpit";
type EntryKind =
  | "activity"
  | "inspection"
  | "finding"
  | "photo"
  | "action"
  | "note";

type TimelineEntry = {
  id: string;
  time: string;
  kind: EntryKind;
  title: string;
  detail: string;
  location: string;
  person: string;
  badge: string;
  badgeTone?: "green" | "red";
};

type QuickType = {
  id: EntryKind | "hse" | "delivery" | "test" | "delay" | "agreement";
  title: string;
  description: string;
  icon: LucideIcon;
};

type ProjectContext = WorkspaceProject;
type BuildingContext = WorkspaceBuilding;

/** An uploaded project drawing, used to point a field record at the right plan. */

const constructionWorkOptions = [
  { en: "Site preparation", nl: "Bouwplaatsinrichting" },
  { en: "Excavation and earthwork", nl: "Ontgraving en grondwerk" },
  { en: "Install formwork", nl: "Bekisting plaatsen" },
  { en: "Reinforcement inspection", nl: "Wapening controleren" },
  { en: "Concrete pour", nl: "Beton storten" },
  { en: "Perform masonry work", nl: "Metselwerk uitvoeren" },
  { en: "Steel construction", nl: "Staalconstructie" },
  { en: "Perform roofing work", nl: "Dakwerk uitvoeren" },
  { en: "Electrical installation", nl: "Elektrotechnische installatie" },
  { en: "Plumbing installation", nl: "Sanitaire installatie" },
  { en: "Perform finishing work", nl: "Afwerking uitvoeren" },
  { en: "Testing and inspection", nl: "Testen en inspecteren" },
];

/**
 * Work packages for a field record. Three options (structural work, installations,
 * finishing) never matched a real site day, so the client asked for the packages that
 * their own daily report distinguishes — from site setup to handover.
 */
const workPackageOptions = [
  { en: "Site setup and temporary works", nl: "Bouwplaatsinrichting en tijdelijke voorzieningen" },
  { en: "Survey and setting out", nl: "Uitzetwerk en metingen" },
  { en: "Demolition and clearing", nl: "Sloop- en opruimwerk" },
  { en: "Earthworks and excavation", nl: "Grondwerk en ontgraving" },
  { en: "Piling and foundations", nl: "Heiwerk en fundering" },
  { en: "Formwork and scaffolding", nl: "Bekisting en steigerwerk" },
  { en: "Concrete and rebar", nl: "Beton en wapening" },
  { en: "Masonry", nl: "Metselwerk" },
  { en: "Steel structure", nl: "Staalconstructie" },
  { en: "Roof structure and roofing", nl: "Dakconstructie en dakbedekking" },
  { en: "Carpentry, doors and windows", nl: "Timmerwerk, deuren en ramen" },
  { en: "Facade and cladding", nl: "Gevel en gevelbekleding" },
  { en: "Electrical installation", nl: "Elektrotechnische installatie" },
  { en: "Mechanical installation and HVAC", nl: "Mechanische installatie en HVAC" },
  { en: "Plumbing and sanitary", nl: "Loodgieterswerk en sanitair" },
  { en: "Drainage and sewerage", nl: "Riolering en afwatering" },
  { en: "Plastering and screed", nl: "Stucwerk en vloerafwerking" },
  { en: "Tiling", nl: "Tegelwerk" },
  { en: "Painting and finishing", nl: "Schilderwerk en afwerking" },
  { en: "Paving, roads and site works", nl: "Bestrating, wegen en terreinwerk" },
  { en: "Landscaping", nl: "Terreininrichting en groen" },
  { en: "Testing, commissioning and handover", nl: "Testen, inbedrijfstelling en oplevering" },
  { en: "Other work package", nl: "Ander werkpakket" },
];

type AttendanceRow = {
  id: string;
  partyId: string;
  party: string;
  discipline: string;
  count: number;
  shiftStart: string;
  shiftEnd: string;
};

const constructionDisciplines = [
  "Bouwvakkers / algemeen",
  "Timmerlieden",
  "Metselaars",
  "Beton en wapening",
  "Betonwerkers",
  "Wapeningwerkers",
  "Elektriciens",
  "HVAC",
  "Loodgieters / sanitair",
  "Schilders",
  "Gevelwerk",
  "Tegelzetters",
  "Grondwerk",
  "Staalbouw",
  "Steigerbouwers",
  "Dakwerk",
  "Machine-operators",
  "HSE / veiligheidsmedewerkers",
  "Voormannen / supervisors",
] as const;

const navigation: { id: NavKey; label: string; icon: LucideIcon; badge?: string }[] = [
  { id: "vandaag", label: "Overzicht", icon: Home },
  { id: "project", label: "Werkruimte", icon: LayoutDashboard },
  { id: "acties", label: "Acties", icon: ClipboardCheck },
  { id: "projectdocs", label: "Project Docs", icon: FileText },
  { id: "punchlist", label: "Punchlist", icon: CheckCircle2 },
  { id: "verify", label: "Rapid Verify", icon: Search },
  { id: "rapporten", label: "Rapporten", icon: FileText },
  { id: "meer", label: "Instellingen", icon: Settings },
];

const quickTypes: QuickType[] = [
  { id: "photo", title: "Foto", description: "Leg bewijs met context vast", icon: Camera },
  { id: "finding", title: "Bevinding", description: "Meld kwaliteit of afwijking", icon: AlertTriangle },
  { id: "activity", title: "Activiteit", description: "Registreer werk en voortgang", icon: Wrench },
  { id: "inspection", title: "Inspectie", description: "Start een controlelijst", icon: ClipboardCheck },
  { id: "hse", title: "HSE", description: "Observatie, near miss of incident", icon: ShieldCheck },
  { id: "action", title: "Actiepunt", description: "Wijs opvolging direct toe", icon: CheckCircle2 },
  { id: "delivery", title: "Levering", description: "Registreer materiaalontvangst", icon: PackageCheck },
  { id: "test", title: "Test / meting", description: "Noteer waarde en tolerantie", icon: Ruler },
  { id: "delay", title: "Vertraging", description: "Leg oorzaak en tijdblok vast", icon: TimerOff },
  { id: "note", title: "Notitie", description: "Leg een gedateerde veldnotitie vast", icon: MessageSquareText },
  { id: "agreement", title: "Afspraak", description: "Leg afspraak, verantwoordelijke en deadline vast", icon: FileCheck2 },
];

const quickTypesEnglish: QuickType[] = [
  { id: "photo", title: "Photo", description: "Capture evidence with context", icon: Camera },
  { id: "finding", title: "Finding", description: "Record a quality issue or deviation", icon: AlertTriangle },
  { id: "activity", title: "Activity", description: "Record work and progress", icon: Wrench },
  { id: "inspection", title: "Inspection", description: "Start an inspection checklist", icon: ClipboardCheck },
  { id: "hse", title: "HSE", description: "Observation, near miss or incident", icon: ShieldCheck },
  { id: "action", title: "Action", description: "Assign follow-up immediately", icon: CheckCircle2 },
  { id: "delivery", title: "Delivery", description: "Record a material delivery", icon: PackageCheck },
  { id: "test", title: "Test / measurement", description: "Record a value and tolerance", icon: Ruler },
  { id: "delay", title: "Delay", description: "Record the cause and time lost", icon: TimerOff },
  { id: "note", title: "Note", description: "Record a dated field note", icon: MessageSquareText },
  { id: "agreement", title: "Agreement", description: "Record the agreement, owner and deadline", icon: FileCheck2 },
];

const entryIcons: Record<EntryKind, LucideIcon> = {
  activity: Wrench,
  inspection: ClipboardCheck,
  finding: AlertTriangle,
  photo: Camera,
  action: CheckCircle2,
  note: MessageSquareText,
};

const entryTitles: Record<string, string> = {
  activity: "Activiteit",
  inspection: "Inspectie",
  finding: "Bevinding",
  photo: "Foto",
  action: "Actiepunt",
  note: "Notitie",
  hse: "HSE-registratie",
  delivery: "Levering",
  test: "Test / meting",
  delay: "Vertraging",
};

const entryTitlesEnglish: Record<string, string> = {
  activity: "Activity",
  inspection: "Inspection",
  finding: "Finding",
  photo: "Photo",
  action: "Action",
  note: "Note",
  hse: "HSE record",
  delivery: "Delivery",
  test: "Test / measurement",
  delay: "Delay",
};

const actionStatusLabels: Record<ProjectAction["status"], string> = {
  open: "Open",
  accepted: "Geaccepteerd",
  in_progress: "In uitvoering",
  ready_for_verification: "Gereed voor verificatie",
  verified: "Geverifieerd",
  cancelled: "Geannuleerd",
};

const actionStatusLabelsEnglish: Record<ProjectAction["status"], string> = {
  open: "Open",
  accepted: "Accepted",
  in_progress: "In progress",
  ready_for_verification: "Ready for verification",
  verified: "Verified",
  cancelled: "Cancelled",
};

const nextActionStatus: Partial<Record<ProjectAction["status"], ProjectAction["status"]>> = {
  open: "accepted",
  accepted: "in_progress",
  in_progress: "ready_for_verification",
  ready_for_verification: "verified",
};

function defaultActionDeadline() {
  return actionDeadlineFromToday(1);
}

function actionDeadlineFromToday(days: number) {
  const [year, month, day] = reportDateInSuriname().split("-").map(Number);
  const deadline = new Date(Date.UTC(year, month - 1, day + days));
  return `${deadline.getUTCFullYear()}-${String(deadline.getUTCMonth() + 1).padStart(2, "0")}-${String(deadline.getUTCDate()).padStart(2, "0")}T16:00`;
}

function currentTime(locale = "en-US", date = new Date()) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Paramaribo",
  }).format(date);
}

function currentDateLabel(locale = "en-US", date = new Date()) {
  const value = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Paramaribo",
  }).format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function greetingForSuriname(language: "en" | "nl", date = new Date()) {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Paramaribo",
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart ?? 0);
  if (hour >= 5 && hour < 12) return language === "en" ? "Good morning" : "Goedemorgen";
  if (hour >= 12 && hour < 18) return language === "en" ? "Good afternoon" : "Goedemiddag";
  if (hour >= 18 && hour < 23) return language === "en" ? "Good evening" : "Goedenavond";
  return language === "en" ? "Good night" : "Goedenacht";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CO";
}

function projectStartFromRow(row: Record<string, unknown> | null): ProjectStartAnswers | null {
  if (!row) return null;
  return {
    weatherCondition: row.weather_condition as ProjectStartAnswers["weatherCondition"],
    temperatureC: Number(row.temperature_c),
    windCondition: row.wind_condition as ProjectStartAnswers["windCondition"],
    shiftStart: String(row.shift_start).slice(0, 5),
    shiftEnd: String(row.shift_end).slice(0, 5),
    plannedWork: String(row.planned_work),
    expectedWorkers: Number(row.expected_workers),
    inspectionPlanned: row.inspection_planned ? "yes" : "no",
    highRiskWork: row.high_risk_work ? "yes" : "no",
    concreteWork: row.concrete_work ? "yes" : "no",
    workPermit: row.work_permit_status as ProjectStartAnswers["workPermit"],
    drawingStatus: row.drawing_status as ProjectStartAnswers["drawingStatus"],
    drawingIssueReported: Boolean(row.drawing_issue_reported),
    riskNotes: String(row.risk_notes ?? ""),
  };
}

function closeoutFromRow(row: Record<string, unknown> | null): DailyCloseoutAnswers | null {
  if (!row) return null;
  return {
    daySummary: String(row.day_summary),
    weatherSummary: String(row.weather_summary),
    workOngoing: String(row.work_ongoing ?? ""),
    workPerformed: String(row.work_performed),
    progressPercent: Number(row.progress_percent),
    inspectionResult: row.inspection_result as DailyCloseoutAnswers["inspectionResult"],
    qualityIssues: row.quality_issues ? "yes" : "no",
    qualityDetails: String(row.quality_details ?? ""),
    hseEvent: row.hse_event as DailyCloseoutAnswers["hseEvent"],
    hseDetails: String(row.hse_details ?? ""),
    equipmentStatus: String(row.equipment_status ?? ""),
    deliveries: String(row.deliveries ?? ""),
    testsMeasurements: String(row.tests_measurements ?? ""),
    variationWork: row.variation_work_status as DailyCloseoutAnswers["variationWork"],
    delayCause: row.delay_cause as DailyCloseoutAnswers["delayCause"],
    delayHours: Number(row.delay_hours),
    communication: String(row.communication ?? ""),
    risks: String(row.risks ?? ""),
    tomorrowPlan: String(row.tomorrow_plan),
    photoCount: Number(row.photo_count),
    attachmentsConfirmed: Boolean(row.attachments_confirmed),
  };
}

function timelineKind(type: string): EntryKind {
  if (type === "activity" || type === "inspection" || type === "finding" || type === "photo" || type === "action" || type === "note") return type;
  if (type === "hse") return "finding";
  return "note";
}

function disciplineForParty(type: string) {
  const labels: Record<string, string> = {
    supervisor: "Supervisie",
    client: "Opdrachtgever",
    contractor: "Uitvoering",
    subcontractor: "Onderaannemer",
    supplier: "Leverancier",
    consultant: "Advies",
  };
  return labels[type] ?? "Algemeen";
}

function attendanceRowsForBuilding(
  day: Pick<ProjectDaySnapshot, "attendance" | "parties">,
  buildingId: string,
  unknownPartyLabel: string,
  defaultShiftStart = "07:00",
  defaultShiftEnd = "16:00",
): AttendanceRow[] {
  const partyById = new Map(day.parties.map((party) => [party.id, party]));
  const buildingAttendance = day.attendance.filter((row) => row.building_id === buildingId);
  if (buildingAttendance.length) {
    return buildingAttendance.map((row) => {
      const party = partyById.get(String(row.party_id));
      return {
        id: String(row.id),
        partyId: String(row.party_id),
        party: party?.name ?? unknownPartyLabel,
        discipline: String(row.discipline),
        count: Number(row.headcount),
        shiftStart: String(row.shift_start).slice(0, 5),
        shiftEnd: String(row.shift_end).slice(0, 5),
      };
    });
  }
  return day.parties.map((party) => ({
    id: `party:${party.id}`,
    partyId: party.id,
    party: party.name,
    discipline: disciplineForParty(party.type),
    count: 0,
    shiftStart: defaultShiftStart,
    shiftEnd: defaultShiftEnd,
  }));
}

export function CodecoSupervisionApp() {
  const { language, locale, text } = useLanguage();
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => typeof window !== "undefined" && window.location.hash.includes("type=recovery"),
  );
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [workspaceStage, setWorkspaceStage] = useState<WorkspaceStage>("projects");
  const [selectedProject, setSelectedProject] = useState<ProjectContext | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingContext | null>(null);
  const [contextBuildingId, setContextBuildingId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavKey>("vandaag");
  const [modal, setModal] = useState<ModalKey>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("activity");
  const [initialProjectTab, setInitialProjectTab] = useState<ProjectTabKey>("home");
  const quickCameraInputRef = useRef<HTMLInputElement>(null);
  const dailyBackupCheckRef = useRef("");
  const [pendingQuickPhotos, setPendingQuickPhotos] = useState<File[]>([]);
  const [externalSubmissionIntent, setExternalSubmissionIntent] = useState(false);
  /** Which view the action centre opens on; the deadline tile asks for the deadlines. */
  const [actionCenterView, setActionCenterView] = useState<ActionCenterView>("work");
  /**
   * The record the action centre sent the user to. It is a detail inside a screen, not a
   * screen of its own, so it stays out of the history and out of the address.
   */
  const [focusRecordId, setFocusRecordId] = useState("");
  const [description, setDescription] = useState("");
  // A proposed description must vanish on the first keystroke instead of staying behind.
  const [descriptionSuggested, setDescriptionSuggested] = useState(false);
  // Same answer, readable from a speech-recognition callback that captured an older render.
  const descriptionSuggestedRef = useRef(false);
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState("normal");
  const [entryBuildingIds, setEntryBuildingIds] = useState<string[]>([]);
  const [entryLocationNodeId, setEntryLocationNodeId] = useState("");
  const [entryDrawingId, setEntryDrawingId] = useState("");
  const [entryWorkPackage, setEntryWorkPackage] = useState(workPackageOptions[0].en);
  const [entryPhotos, setEntryPhotos] = useState<PhotoEvidence[]>([]);
  // Set while the supervisor is on the drawing screen with a field record still open.
  const [entryDraftParked, setEntryDraftParked] = useState(false);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [completedTodos, setCompletedTodos] = useState<number[]>([]);
  const [projectStartAnswers, setProjectStartAnswers] = useState<ProjectStartAnswers | null>(null);
  const [dailyCloseoutAnswers, setDailyCloseoutAnswers] = useState<DailyCloseoutAnswers | null>(null);
  const [selectedAction, setSelectedAction] = useState<ProjectAction | null>(null);
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const reportDate = reportDateInSuriname();

  const workspaceQuery = useQuery({
    queryKey: ["workspace", session?.user.id],
    queryFn: async () => {
      try {
        const data = await loadWorkspace(supabase as SupabaseClient);
        await cacheWorkspace(session!.user.id, data).catch(() => undefined);
        return data;
      } catch (error) {
        const cached = await getCachedWorkspace(session!.user.id).catch(() => null);
        if (cached) return cached;
        throw error;
      }
    },
    enabled: Boolean(supabase && session),
  });

  const activeOrganizationId = workspaceQuery.data?.organizations[0]?.id;
  const canManageMembers = Boolean(
    activeOrganizationId
    && workspaceQuery.data?.manageableOrganizationIds.includes(activeOrganizationId),
  );

  useEffect(() => {
    if (!supabase || !session || !activeOrganizationId || !canManageMembers || !isOnline) return;
    const checkKey = `${activeOrganizationId}:${reportDate}`;
    if (dailyBackupCheckRef.current === checkKey) return;
    dailyBackupCheckRef.current = checkKey;
    void ensureDailyBackup(supabase, activeOrganizationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["project-operations"] }))
      .catch(() => {
        dailyBackupCheckRef.current = "";
      });
  }, [activeOrganizationId, canManageMembers, isOnline, queryClient, reportDate, session, supabase]);

  useEffect(() => {
    if (!supabase || !session || !selectedProject || !isOnline) return;
    let active = true;
    const timer = window.setTimeout(() => {
      // The registrations go first: a photo that belongs to one of them can only be
      // linked once that record has a real number.
      void syncOfflineRecords(supabase, selectedProject.id).then(async (recordResult) => {
        if (!active) return;
        if (recordResult.synced > 0) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["project-operations", selectedProject.id] }),
            queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id] }),
            queryClient.invalidateQueries({ queryKey: ["offline-records", selectedProject.id] }),
          ]);
          setToast(text(
            `${recordResult.synced} field record(s) sent from this device.`,
            `${recordResult.synced} veldregistratie(s) vanaf dit apparaat verstuurd.`,
          ));
        }
      }).catch(() => undefined).finally(() => {
      void syncOfflineUploads(supabase, selectedProject.id).then(async (result) => {
        if (!active) return;
        if (result.synced > 0) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["project-operations", selectedProject.id] }),
            queryClient.invalidateQueries({ queryKey: ["workspace"] }),
          ]);
        }
        if (result.failed > 0) {
          setToast(text(
            `${result.failed} field upload(s) still need attention. Open Photos & folders and tap Sync now.`,
            `${result.failed} veldupload(s) vragen nog aandacht. Open Foto’s & mappen en tik op Nu synchroniseren.`,
          ));
        }
      }).catch(() => {
        if (active) setToast(text(
          "Queued field photos remain safely on this device.",
          "Wachtende veldfoto’s blijven veilig op dit apparaat.",
        ));
      });
      });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isOnline, queryClient, selectedProject, session, supabase, text]);

  const internalAccessQuery = useQuery({
    queryKey: ["internal-access", activeOrganizationId],
    queryFn: () => loadWithOfflineCache(
      offlineQueryKeys.internalAccess(activeOrganizationId!),
      () => loadInternalAccess(supabase as SupabaseClient, activeOrganizationId!),
    ),
    enabled: Boolean(
      supabase
      && session
      && activeOrganizationId
      && canManageMembers
      && (modal === "user_admin" || modal === "action_create" || activeNav === "meer"),
    ),
  });
  const companyEmployees = useMemo(() => {
    const employeeProjectRoles = new Set(["supervisor", "lead_supervisor", "project_manager", "quality_hse_manager"]);
    return (internalAccessQuery.data?.members ?? []).filter((member) => (
      member.membershipStatus === "active"
      && member.accessStatus === "active"
      && (
        member.organizationRoles.length > 0
        || member.projectRoles.some((role) => role.projectId === selectedProject?.id && employeeProjectRoles.has(role.roleCode))
      )
    ));
  }, [internalAccessQuery.data?.members, selectedProject?.id]);

  const dayQuery = useQuery({
    queryKey: ["project-day", selectedProject?.id, reportDate],
    queryFn: async () => {
      try {
        const data = await loadProjectDay(supabase as SupabaseClient, selectedProject!.id, reportDate);
        await cacheProjectDay(selectedProject!.id, reportDate, data).catch(() => undefined);
        return data;
      } catch (error) {
        const cached = await getCachedProjectDay(selectedProject!.id, reportDate).catch(() => null);
        if (cached) return cached;
        throw error;
      }
    },
    enabled: Boolean(supabase && session && selectedProject),
  });

  const projectConfigurationQuery = useQuery({
    queryKey: ["project-configuration", selectedProject?.id],
    queryFn: () => loadWithOfflineCache(
      offlineQueryKeys.projectConfiguration(selectedProject!.id),
      () => loadProjectConfiguration(supabase as SupabaseClient, selectedProject!.id),
    ),
    enabled: Boolean(supabase && session && selectedProject),
  });
  const configuredDisciplines = projectConfigurationQuery.data?.disciplines?.length
    ? projectConfigurationQuery.data.disciplines
    : [...constructionDisciplines];
  const configuredShiftStart = projectConfigurationQuery.data?.default_shift_start?.slice(0, 5) ?? "07:00";
  const configuredShiftEnd = projectConfigurationQuery.data?.default_shift_end?.slice(0, 5) ?? "16:00";
  const projectLocationsQuery = useQuery({
    queryKey: ["project-locations", selectedProject?.id],
    queryFn: () => loadWithOfflineCache(
      offlineQueryKeys.projectLocations(selectedProject!.id),
      () => loadProjectLocations(supabase as SupabaseClient, selectedProject!.id) as Promise<ProjectLocationOption[]>,
    ),
    enabled: Boolean(supabase && session && selectedProject),
  });

  const projectDrawingsQuery = useQuery({
    queryKey: ["project-drawings", selectedProject?.id],
    queryFn: () => loadWithOfflineCache(
      offlineQueryKeys.projectDrawings(selectedProject!.id),
      () => loadProjectDrawings(supabase as SupabaseClient, selectedProject!.id),
    ),
    enabled: Boolean(supabase && session && selectedProject),
  });

  const notificationQuery = useQuery({
    queryKey: ["project-notifications", selectedProject?.id],
    queryFn: () => loadWithOfflineCache(
      offlineQueryKeys.projectNotifications(selectedProject!.id),
      () => loadProjectNotifications(supabase as SupabaseClient, selectedProject!.id),
    ),
    enabled: Boolean(supabase && session && selectedProject),
    staleTime: 60_000,
  });
  const unreadNotificationCount = (notificationQuery.data ?? []).filter((notification) => !notification.read_at).length;

  const currentUserName = workspaceQuery.data?.profileName
    ?? String(session?.user.user_metadata?.display_name ?? session?.user.email?.split("@")[0] ?? text("CODECO user", "CODECO-gebruiker"));
  const storageStatus = !isOnline
    ? text("No connection · not saved", "Geen verbinding · nog niet opgeslagen")
    : syncState === "saving"
      ? text("Saving to Supabase…", "Opslaan in Supabase…")
      : syncState === "error"
        ? text("Save failed · try again", "Opslaan mislukt · probeer opnieuw")
        : syncState === "saved"
          ? text("Saved centrally · Supabase", "Centraal opgeslagen · Supabase")
          : text("Live database · Supabase Realtime", "Live database · Supabase Realtime");
  const localizedNavigation = navigation.map((item) => ({
    ...item,
    label: ({
      vandaag: text("Overview", "Overzicht"),
      project: text("Workspace", "Werkruimte"),
      acties: text("Actions", "Acties"),
      projectdocs: "Project Docs",
      punchlist: "Punchlist",
      verify: "Rapid Verify",
      rapporten: text("Reports", "Rapporten"),
      meer: canManageMembers ? text("Management", "Management") : text("Settings", "Instellingen"),
    } satisfies Record<NavKey, string>)[item.id],
  }));

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const authTimeout = window.setTimeout(() => {
      if (active) setAuthReady(true);
    }, 8_000);
    // Offline the library cannot refresh an expired access token, so it answers "no
    // session". The session written to this device is used instead: without it an
    // installed app opened in the field showed the login screen with all its data sitting
    // unreachable on the phone.
    void getSessionWithOfflineFallback(supabase).then((nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthReady(true);
      }
    }).catch(() => {
      if (active) setAuthReady(true);
    }).finally(() => {
      window.clearTimeout(authTimeout);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      // Losing the session while there is no connection is not a sign-out: it is a refresh
      // that could not reach the server. Signing out on purpose clears the stored session,
      // so a real sign-out still ends here.
      if (!nextSession && !navigator.onLine && storedSessionOnThisDevice()) return;
      setSession(nextSession);
      setAuthReady(true);
      if (!nextSession) {
        setPasswordRecovery(false);
        setSelectedProject(null);
        setSelectedBuilding(null);
        setWorkspaceStage("projects");
      }
    });
    return () => {
      active = false;
      window.clearTimeout(authTimeout);
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!modal) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusDialog = window.requestAnimationFrame(() => {
      if (!dialog || dialog.contains(document.activeElement)) return;
      dialog.querySelector<HTMLElement>(focusableSelector)?.focus();
    });
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInside);
    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [modal]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const day = dayQuery.data;
    if (!day || !selectedBuilding) return;
    const hydration = window.setTimeout(() => {
      const start = projectStartFromRow(day.startChecks.find((row) => row.building_id === selectedBuilding.id) ?? null);
      const closeout = closeoutFromRow(day.closeouts.find((row) => row.building_id === selectedBuilding.id) ?? null);
      setProjectStartAnswers(start);
      setDailyCloseoutAnswers(closeout);
      setCompletedTodos([...(start ? [1] : []), ...(closeout ? [2, 3] : [])]);

      const buildingNameById = new Map((selectedProject?.buildings ?? []).map((building) => [building.id, building.name]));
      setEntries(day.registrations.map((row) => {
      const type = String(row.registration_type);
      const occurredAt = new Date(String(row.occurred_at));
      const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(occurredAt);
      const priorityLabel = String(row.priority) === "critical" ? text("Critical", "Kritiek") : String(row.priority) === "high" ? text("High", "Hoog") : text("Saved", "Opgeslagen");
      return {
        id: String(row.id),
        time,
        kind: timelineKind(type),
        title: String(row.title),
        detail: String(row.description ?? `${entryTitles[type] ?? "Registratie"} centraal opgeslagen.`),
        location: [
          buildingNameById.get(String(row.building_id)) ?? selectedBuilding.name,
          locationBreadcrumb(projectLocationsQuery.data ?? [], String(row.location_node_id ?? "")),
        ].filter(Boolean).join(" → "),
        person: currentUserName,
        badge: priorityLabel,
        badgeTone: String(row.priority) === "critical" ? "red" : "green",
      };
      }));

      setAttendance(attendanceRowsForBuilding(day, selectedBuilding.id, text("Unknown party", "Onbekende partij"), configuredShiftStart, configuredShiftEnd));
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [configuredShiftEnd, configuredShiftStart, currentUserName, dayQuery.data, locale, projectLocationsQuery.data, selectedBuilding, selectedProject, text]);

  useEffect(() => {
    if (!supabase || !session || !selectedProject) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
      void queryClient.invalidateQueries({ queryKey: ["workspace", session.user.id] });
      void queryClient.invalidateQueries({ queryKey: ["project-operations", selectedProject.id] });
      void queryClient.invalidateQueries({ queryKey: ["project-notifications", selectedProject.id] });
    };
    const channel = supabase
      .channel(`project-live:${selectedProject.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "actions", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "action_updates", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_registrations", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "day_reports", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "inspections", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "findings", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hse_events", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "visual_captures", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "visual_annotations", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "drawing_pins", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "drawing_markups", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, reportDate, selectedProject, session, supabase]);

  const completeness = useMemo(() => {
    const complete = 4 + Math.min(completedTodos.length, 3) + (projectStartAnswers ? 1 : 0) + (dailyCloseoutAnswers ? 1 : 0);
    return Math.round((complete / 9) * 100);
  }, [completedTodos, dailyCloseoutAnswers, projectStartAnswers]);

  const attendanceTotal = useMemo(
    () => attendance.reduce((total, row) => total + row.count, 0),
    [attendance],
  );
  const projectAttendanceTotal = useMemo(
    () => (dayQuery.data?.attendance ?? []).reduce((total, row) => total + Number(row.headcount ?? 0), 0),
    [dayQuery.data],
  );
  const reportNumber = String(dayQuery.data?.report?.report_number ?? `DR-${reportDate.replaceAll("-", "")}`);
  /**
   * The actions of today, with the ones that are still waiting on this device in front of
   * them. An action written without a connection has to be visible in the action centre,
   * otherwise it looks like it was never saved.
   */
  const pendingRecordsQuery = useQuery({
    queryKey: ["offline-records", selectedProject?.id],
    queryFn: () => listOfflineRecords(selectedProject!.id),
    networkMode: "always",
    refetchInterval: 20_000,
    enabled: Boolean(selectedProject),
  });
  const dayActions = withPendingActions(dayQuery.data?.actions ?? [], pendingRecordsQuery.data ?? []);

  const runSynced = async <T,>(
    operation: () => Promise<T>,
    successMessage: string,
    // A registration that can wait on the device is allowed to run without a connection;
    // everything that changes an existing central record is not.
    options: { offlineCapable?: boolean } = {},
  ): Promise<T | null> => {
    if (!isOnline && !options.offlineCapable) {
      setSyncState("error");
      setToast(text("No connection. Your input remains in the open form; try again when you are online.", "Geen verbinding. Je invoer blijft in het geopende formulier; probeer opnieuw zodra je online bent."));
      return null;
    }
    const queuedBefore = selectedProject ? (await listOfflineRecords(selectedProject.id).catch(() => [])).length : 0;
    setSyncState("saving");
    try {
      const result = await operation();
      if (selectedProject && supabase && isOnline) await requestProjectNotificationDispatch(supabase, selectedProject.id).catch(() => false);
      const queuedAfter = selectedProject ? (await listOfflineRecords(selectedProject.id).catch(() => [])).length : 0;
      setSyncState(queuedAfter > queuedBefore ? "idle" : "saved");
      setToast(queuedAfter > queuedBefore
        ? text(
          "Saved on this device and sent by itself as soon as there is a connection.",
          "Op dit apparaat opgeslagen en wordt vanzelf verstuurd zodra er verbinding is.",
        )
        : successMessage);
      return result;
    } catch (error) {
      setSyncState("error");
      setToast(error instanceof Error ? `${text("Save failed", "Opslaan mislukt")}: ${error.message}` : text("Save failed. Try again.", "Opslaan mislukt. Probeer opnieuw."));
      return null;
    }
  };

  /**
   * Every description change goes through here so the app knows whether the text was
   * proposed (a preset or a quick action) or typed by the supervisor.
   */
  const writeDescription = (value: string, suggested = false) => {
    setDescription(value);
    setDescriptionSuggested(suggested && value.length > 0);
    descriptionSuggestedRef.current = suggested && value.length > 0;
  };

  /**
   * Speech recognition keeps calling back with the handler it captured when dictation
   * started, so the decision cannot depend on values from that render. The ref answers
   * "is the text still only a proposal?" at the moment each sentence arrives: the first
   * sentence replaces the proposal, every following one is added to it.
   */
  const dictateDescription = (transcript: string) => {
    const replacing = descriptionSuggestedRef.current;
    descriptionSuggestedRef.current = false;
    setDescriptionSuggested(false);
    setDescription((current) => appendDictation(replacing ? "" : current, transcript));
  };

  const openQuickAdd = () => {
    writeDescription("");
    setLocation(selectedBuilding?.name ?? "");
    // The tap that opens the camera is also the moment a phone will hand out its compass, so
    // the photo can say by itself which way it was facing.
    void startCompassWatch();
    quickCameraInputRef.current?.click();
  };

  const prepareEntry = (type: string) => {
    setSelectedType(type);
    const defaultBuildingId = resolveDefaultBuildingId(selectedProject?.buildings ?? [], selectedBuilding?.id);
    setEntryBuildingIds(defaultBuildingId ? [defaultBuildingId] : []);
    setLocation(selectedProject?.buildings.find((building) => building.id === defaultBuildingId)?.name ?? "");
    setEntryLocationNodeId("");
    setEntryDrawingId("");
    setEntryWorkPackage(workPackageOptions[0].en);
    setEntryPhotos([]);
    setEntryDraftParked(false);
  };

  const receiveQuickCameraPhoto = async (files: FileList | null) => {
    const captured = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!captured.length) return;
    if (!selectedProject || !selectedBuilding) {
      setToast(text("Choose a project and building before taking a field photo.", "Kies eerst een project en gebouw voordat je een veldfoto maakt."));
      return;
    }
    setPendingQuickPhotos(captured);
    setToast(text(
      "Photo ready. Confirm its project context, save it, then click the image to place a finding.",
      "Foto klaar. Bevestig de projectcontext, sla op en klik daarna op de foto om een bevinding te plaatsen.",
    ));
    setInitialProjectTab("visual");
    setActiveNav("project");
    setModal(null);
  };

  const chooseType = (type: string) => {
    if (type === "photo") {
      setInitialProjectTab("visual");
      setActiveNav("project");
      setModal(null);
      return;
    }
    if (type === "finding" || type === "inspection" || type === "hse") {
      setInitialProjectTab(type === "finding" ? "findings" : type === "inspection" ? "inspections" : "hse");
      setActiveNav("project");
      setModal(null);
      return;
    }
    if (type === "note" || type === "agreement") {
      setInitialProjectTab("tools");
      setActiveNav("project");
      setModal(null);
      return;
    }
    prepareEntry(type);
    writeDescription("");
    setModal(type === "action" ? "action_create" : "entry");
  };

  const openWorkspaceDailyRecord = (type: "works_ongoing" | "works_completed" | "workforce" | "delay") => {
    if (type === "workforce") {
      // Workforce opens the attendance screen itself. It used to open the whole daily log
      // with the workforce block folded shut, which is a day report to read past for one
      // headcount — and not what the tile promises: "attendance by contractor and trade".
      setModal("attendance");
      return;
    }
    const isDelay = type === "delay";
    prepareEntry(isDelay ? "delay" : "activity");
    writeDescription(type === "works_ongoing"
      ? text("Work is ongoing", "Werkzaamheden zijn gaande")
      : type === "works_completed"
        ? text("Work completed", "Werkzaamheden afgerond")
        : text("Delay recorded", "Vertraging geregistreerd"), true);
    setLocation(selectedBuilding?.name ?? "");
    setModal("entry");
  };

  const saveEntry = async () => {
    if (!description.trim() || !supabase || !selectedProject || !selectedBuilding) return;
    const priorityMap: Record<string, string> = { low: "low", normal: "normal", high: "high", critical: "critical" };
    const targetBuildings = selectedProject.buildings.filter((building) => entryBuildingIds.includes(building.id));
    if (!targetBuildings.length) targetBuildings.push(selectedBuilding);
    const singleBuilding = targetBuildings.length === 1;
    const workPackageLabel = workPackageOptions.find((option) => option.en === entryWorkPackage);
    const workPackageNote = workPackageLabel && !["finding", "hse", "action"].includes(selectedType)
      ? ` · ${text(workPackageLabel.en, workPackageLabel.nl)}`
      : "";
    const saved = await runSynced(
      () => Promise.all(targetBuildings.map((entryBuilding) => saveSiteRegistration(supabase, {
        projectId: selectedProject.id,
        buildingId: entryBuilding.id,
        locationNodeId: singleBuilding ? entryLocationNodeId : "",
        type: selectedType,
        title: description.trim(),
        description: `${singleBuilding ? location || entryBuilding.name : entryBuilding.name} · ${description.trim()}${workPackageNote}`,
        priority: priorityMap[priority] ?? "normal",
      }))),
      text(`${entryTitlesEnglish[selectedType]} was saved centrally and linked to the daily report.`, `${entryTitles[selectedType]} is centraal opgeslagen en aan het dagrapport gekoppeld.`),
    );
    if (!saved) return;
    // Photos taken inside the record ride along with it: they are queued for the first
    // target building and linked to that registration, so evidence keeps its origin.
    if (entryPhotos.length) {
      const registration = (Array.isArray(saved) ? saved[0] : saved) as { id?: string; day_report_id?: string } | null;
      await queueEntryPhotos({
        photos: entryPhotos,
        projectId: selectedProject.id,
        buildingId: targetBuildings[0].id,
        buildingLabel: singleBuilding ? location || targetBuildings[0].name : targetBuildings[0].name,
        locationNodeId: singleBuilding ? entryLocationNodeId : "",
        organizationId: selectedProject.organizationId,
        registrationId: registration?.id ?? "",
        reportId: registration?.day_report_id ?? null,
        title: description.trim(),
      });
    }
    setEntryPhotos([]);
    setEntryDraftParked(false);
    setModal(null);
    await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
  };

  /**
   * Field photos never block a saved record: they are queued locally first and then
   * synchronized, exactly like the daily log and the photo workspace do.
   */
  const queueEntryPhotos = async (input: {
    photos: PhotoEvidence[];
    projectId: string;
    buildingId: string;
    buildingLabel: string;
    locationNodeId: string;
    organizationId: string;
    registrationId: string;
    reportId: string | null;
    title: string;
  }) => {
    if (!supabase) return;
    for (const photo of input.photos) {
      const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
      // The photo's own words win over the record title, and its own location over the
      // record's, so the photo register can be read without opening the registration.
      const uploadTitle = photoTitle(photo) || input.title.trim();
      await queueOfflineUpload({
        projectId: input.projectId,
        buildingId: input.buildingId,
        reportId: input.reportId,
        folderId: null,
        folderName: text("Field records", "Veldregistraties"),
        kind: "photo",
        file: prepared.blob,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        title: uploadTitle.slice(0, 120),
        description: [photoEvidenceLine(photo, language), photo.details.description.trim()].filter(Boolean).join("\n"),
        locationLabel: input.buildingLabel,
        locationNodeId: photo.details.locationNodeId || input.locationNodeId || null,
        capturedAt: new Date(photo.file.lastModified || Date.now()).toISOString(),
        originalSize: photo.original.size,
        queuedSize: prepared.blob.size,
        compressed: prepared.compressed,
        recordLink: input.registrationId
          ? { organizationId: input.organizationId, recordType: "registration", recordId: input.registrationId, relationship: "evidence" }
          : null,
      });
    }
    if (navigator.onLine) {
      await forceSyncOfflineUploads(supabase, input.projectId, {
        paused: text(
          "The connection changed before central photo confirmation. The photos remain safe on this device. Open Photos & folders and tap Sync now.",
          "De verbinding veranderde vóór de centrale fotobevestiging. De foto’s blijven veilig op dit apparaat. Open Foto’s & mappen en tik op Nu synchroniseren.",
        ),
        failed: (pendingCount) => text(
          `${pendingCount} photo upload(s) could not be confirmed centrally. They remain safe on this device. Open Photos & folders and tap Sync now.`,
          `${pendingCount} foto-upload(s) konden niet centraal worden bevestigd. Ze blijven veilig op dit apparaat. Open Foto’s & mappen en tik op Nu synchroniseren.`,
        ),
      });
    }
  };

  const toggleTodo = (id: number) => {
    setCompletedTodos((current) =>
      current.includes(id) ? current.filter((todo) => todo !== id) : [...current, id],
    );
  };

  const navigate = (next: NavKey) => {
    if (next === "project") setInitialProjectTab("home");
    // Project Docs and Punchlist are the workspace with one module already open.
    if (next === "projectdocs") setInitialProjectTab("documents");
    if (next === "punchlist") setInitialProjectTab("findings");
    // Reaching the action centre from the bar means the worklist; only the deadline
    // tile of the workspace asks for the deadline view.
    setActionCenterView("work");
    // A new destination is a new screen: the record the action centre pointed at is done.
    setFocusRecordId("");
    // Any deliberate navigation ends the Management submission hand-off, so the
    // workspace never stays unlocked for contractor document types.
    setExternalSubmissionIntent(false);
    setMobileMenuOpen(false);
    setActiveNav(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseProject = (project: ProjectContext) => {
    setSelectedProject(project);
    setSelectedBuilding(project.buildings[0] ?? null);
    setWorkspaceStage("cockpit");
    setActiveNav("vandaag");
    setInitialProjectTab("home");
  };

  /**
   * The screen the app is showing, in the few things a user would call a page: the
   * project, the destination in the bar, the open module and any full-screen dialog.
   * Everything else is detail inside a screen and stays out of the history.
   */
  const screen: AppScreen = useMemo(() => ({
    project: workspaceStage === "cockpit" && selectedProject ? selectedProject.id : null,
    nav: activeNav,
    tab: initialProjectTab,
    modal: modal ?? null,
    menu: mobileMenuOpen,
  }), [activeNav, initialProjectTab, mobileMenuOpen, modal, selectedProject, workspaceStage]);

  /** Puts the app back on a screen the back button handed to us. */
  const applyScreen = useCallback((restored: AppScreen) => {
    const projects = workspaceQuery.data?.projects ?? [];
    if (!restored.project) {
      setWorkspaceStage("projects");
    } else {
      const project = projects.find((candidate) => candidate.id === restored.project);
      if (project) {
        setSelectedProject((current) => current?.id === project.id ? current : project);
        setSelectedBuilding((current) => current && project.buildings.some((building) => building.id === current.id)
          ? current
          : project.buildings[0] ?? null);
      }
      setWorkspaceStage("cockpit");
    }
    setActiveNav(navKeys.includes(restored.nav as NavKey) ? restored.nav as NavKey : "vandaag");
    setInitialProjectTab(projectTabKeys.includes(restored.tab as ProjectTabKey) ? restored.tab as ProjectTabKey : "home");
    // A dialog that only makes sense with a record in hand is not restored from an
    // entry; the screen behind it is what the user asked to go back to.
    const contextFreeModal = restored.modal && !["action_detail", "entry"].includes(restored.modal)
      ? restored.modal as ModalKey
      : null;
    setModal(contextFreeModal);
    setMobileMenuOpen(restored.menu);
    // A restored screen is a fresh screen: never keep the previous one's scroll.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [workspaceQuery.data?.projects]);

  useScreenHistory(screen, applyScreen);

  // A reload, a shared link or a phone that reopens the installed app lands on the
  // screen the address bar describes instead of at the beginning.
  const restoredFromUrlRef = useRef(false);
  // The projects arrive from the server, so the screen in the address bar can only be
  // restored once they are there. That is exactly what an effect is for.
  useEffect(() => {
    if (restoredFromUrlRef.current) return;
    const projects = workspaceQuery.data?.projects;
    if (!projects?.length) return;
    restoredFromUrlRef.current = true;
    const fromUrl = screenFromSearch(window.location.search);
    if (!fromUrl.project) return;
    const project = projects.find((candidate) => candidate.id === fromUrl.project);
    if (!project) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a screen from the address bar can only happen once the projects have loaded
    applyScreen(fromUrl);
  }, [applyScreen, workspaceQuery.data?.projects]);

  const openBuildingStart = (building: BuildingContext) => {
    setContextBuildingId(building.id);
    setModal("project_start");
  };

  const openBuildingCloseout = (building: BuildingContext) => {
    setContextBuildingId(building.id);
    setModal("daily_questions");
  };

  const openProjectStartForAllBuildings = () => {
    setContextBuildingId(ALL_BUILDINGS);
    setModal("project_start");
  };

  const openDailyQuestionsForAllBuildings = () => {
    setContextBuildingId(ALL_BUILDINGS);
    setModal("daily_questions");
  };

  const addBuilding = async (input: { code: string; name: string; description: string }) => {
    if (!selectedProject || !supabase) return false;
    const created = await runSynced(
      () => createBuilding(supabase, { projectId: selectedProject.id, code: input.code, name: input.name, description: input.description }),
      text("Building added to the project.", "Gebouw aan het project toegevoegd."),
    );
    if (!created) return false;
    const newBuilding: BuildingContext = {
      id: created.id,
      name: created.name,
      description: created.description ?? "",
      progress: 0,
      openIssues: 0,
      issueCount: 0,
      ncrCount: 0,
      inspectionCount: 0,
      technicalInstructionCount: 0,
      changeOrderCount: 0,
      agreementCount: 0,
      photoCount: 0,
      todayPlannedWork: [],
    };
    setSelectedProject((current) => current ? { ...current, buildings: [...current.buildings, newBuilding] } : current);
    setModal(null);
    await queryClient.invalidateQueries({ queryKey: ["workspace", session?.user.id] });
    return true;
  };

  const startProject = async (buildings: BuildingContext[], answers: ProjectStartAnswers) => {
    if (!supabase || !selectedProject || !buildings.length) return;
    const saved = await runSynced(
      () => Promise.all(buildings.map((building) => saveProjectStart(supabase, {
        projectId: selectedProject.id,
        buildingId: building.id,
        answers,
        reportDate,
      }))),
      text("Project start and the draft daily report were saved centrally.", "Projectstart en het conceptdagrapport zijn centraal opgeslagen."),
    );
    if (!saved) return;
    if (buildings.some((building) => building.id === selectedBuilding?.id)) setProjectStartAnswers(answers);
    setModal(null);
    setActiveNav("vandaag");
    window.scrollTo({ top: 0 });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] }),
      queryClient.invalidateQueries({ queryKey: ["workspace", session?.user.id] }),
    ]);
  };

  if (!isSupabaseConfigured || !supabase) {
    return <AppStateScreen title={text("Supabase configuration is missing", "Supabase-configuratie ontbreekt")} copy={text("The application starts after the public project URL and publishable key are configured. A secret key never belongs in the browser app.", "De applicatie start pas wanneer de publieke project-URL en publishable key beschikbaar zijn. Een secret key hoort nooit in de browserapp.")} />;
  }

  if (!authReady) {
    return <AppStateScreen title={text("Opening secure workspace", "Veilige werkruimte openen")} copy={text("Your session and project access are being checked.", "Je sessie en projecttoegang worden gecontroleerd.")} loading />;
  }

  if (!session) {
    return <AuthScreen client={supabase} />;
  }

  if (passwordRecovery || session.user.user_metadata?.must_set_password === true) {
    return (
      <PasswordSetupScreen
        mode={passwordRecovery ? "recovery" : "invitation"}
        email={session.user.email ?? ""}
        save={async (answers) => {
          const result = await supabase.auth.updateUser({
            password: answers.password,
            data: { must_set_password: false },
          });
          if (result.error) throw result.error;
          setPasswordRecovery(false);
          window.history.replaceState(null, "", window.location.pathname);
          setSession((current) => current ? { ...current, user: result.data.user } : current);
        }}
        signOut={() => void supabase.auth.signOut()}
      />
    );
  }

  if (workspaceQuery.isLoading) {
    return <AppStateScreen title={text("Loading CODECO workspace", "CODECO-werkruimte laden")} copy={text("Projects, buildings and permissions are being loaded from Supabase.", "Projecten, gebouwen en rechten worden uit Supabase opgehaald.")} loading />;
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return <AppStateScreen title={text("Workspace unavailable", "Werkruimte niet beschikbaar")} copy={workspaceQuery.error instanceof Error ? workspaceQuery.error.message : text("The central data could not be loaded.", "De centrale gegevens konden niet worden geladen.")} action={() => void workspaceQuery.refetch()} />;
  }

  if (workspaceQuery.data.organizations.length === 0) {
    if (!workspaceQuery.data.canBootstrapOrganization) {
      return (
        <AccessPendingScreen
          email={session.user.email ?? ""}
          signOut={() => void supabase.auth.signOut()}
        />
      );
    }
    return (
      <OrganizationSetupScreen
        userEmail={session.user.email ?? ""}
        defaultDisplayName={currentUserName}
        save={async (answers) => {
          const saved = await runSynced(
            () => bootstrapOrganization(supabase, {
              name: answers.organizationName,
              slug: answers.organizationSlug,
              displayName: answers.displayName,
            }),
            text("The CODECO workspace has been created.", "De CODECO-werkruimte is aangemaakt."),
          );
          if (saved) await queryClient.invalidateQueries({ queryKey: ["workspace", session.user.id] });
          return Boolean(saved);
        }}
        signOut={() => void supabase.auth.signOut()}
      />
    );
  }

  if (workspaceQuery.data.projects.length === 0) {
    return (
      <ProjectSetupScreen
        organizationName={workspaceQuery.data.organizations[0].name}
        save={async (answers) => {
          const saved = await runSynced(
            () => createProjectWorkspace(supabase, {
              organizationId: workspaceQuery.data.organizations[0].id,
              ...answers,
            }),
            text("Project, building and standard parties have been created.", "Project, gebouw en standaardpartijen zijn aangemaakt."),
          );
          if (saved) await queryClient.invalidateQueries({ queryKey: ["workspace", session.user.id] });
          return Boolean(saved);
        }}
        signOut={() => void supabase.auth.signOut()}
      />
    );
  }

  if (workspaceStage !== "cockpit") {
    return (
      <ContextSelection
        projects={workspaceQuery.data.projects}
        chooseProject={chooseProject}
        organizationName={workspaceQuery.data.organizations[0].name}
        createProject={async (answers) => {
          const saved = await runSynced(
            () => createProjectWorkspace(supabase, {
              organizationId: workspaceQuery.data!.organizations[0].id,
              ...answers,
            }),
            text("Configured project workspace created.", "Geconfigureerde projectwerkruimte aangemaakt."),
          );
          if (saved) await queryClient.invalidateQueries({ queryKey: ["workspace", session.user.id] });
          return Boolean(saved);
        }}
        currentUserName={currentUserName}
        storageStatus={storageStatus}
        isOnline={isOnline}
        offlineCached={Boolean(workspaceQuery.data._offlineCached)}
      />
    );
  }

  if (selectedProject && !selectedBuilding) {
    return (
      <div className="access-shell">
        <section className="access-card state-card">
          <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={text("Construction supervision", "Constructiesupervisie")} /></div><LanguageSwitcher /></div>
          <span className="state-icon"><AlertTriangle size={26} /></span>
          <h1>{text("This project has no building yet", "Dit project heeft nog geen gebouw")}</h1>
          <p>{text("Add a first building to continue.", "Voeg een eerste gebouw toe om verder te gaan.")}</p>
          <button className="primary-button" type="button" onClick={() => setWorkspaceStage("projects")}>{text("Back to projects", "Terug naar projecten")}</button>
        </section>
      </div>
    );
  }

  const projectName = selectedProject?.name ?? "Project";
  const buildingName = selectedBuilding?.name ?? text("Building", "Gebouw");
  const buildingCount = selectedProject?.buildings.length ?? 0;
  const buildingContextLabel = buildingCount > 1
    ? text(`${buildingCount} buildings`, `${buildingCount} gebouwen`)
    : buildingName;
  const contextIsAllBuildings = contextBuildingId === ALL_BUILDINGS;
  const contextBuilding = contextIsAllBuildings
    ? null
    : selectedProject?.buildings.find((building) => building.id === contextBuildingId) ?? selectedBuilding;
  const contextProjectStartAnswers = contextIsAllBuildings
    ? null
    : contextBuilding?.id === selectedBuilding?.id
      ? projectStartAnswers
      : projectStartFromRow(dayQuery.data?.startChecks.find((row) => row.building_id === contextBuilding?.id) ?? null);
  const contextDailyCloseoutAnswers = contextIsAllBuildings
    ? null
    : contextBuilding?.id === selectedBuilding?.id
      ? dailyCloseoutAnswers
      : closeoutFromRow(dayQuery.data?.closeouts.find((row) => row.building_id === contextBuilding?.id) ?? null);

  const buildDraftReportSnapshot = (): DailyReportPdfSnapshot | null => {
    if (!selectedProject || !selectedBuilding || !projectStartAnswers || !dailyCloseoutAnswers) return null;
    const buildingsBreakdown = selectedProject.buildings.length > 1
      ? selectedProject.buildings
          .map((building) => {
            const start = projectStartFromRow(dayQuery.data?.startChecks.find((row) => row.building_id === building.id) ?? null);
            const closeout = closeoutFromRow(dayQuery.data?.closeouts.find((row) => row.building_id === building.id) ?? null);
            return start && closeout ? { name: building.name, projectStart: start, closeout } : null;
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : undefined;
    return {
      reportNumber: String(dayQuery.data?.report?.report_number ?? `DR-${reportDate.replaceAll("-", "")}`),
      reportDate,
      projectName,
      projectCode: selectedProject.code,
      buildingName,
      location: selectedProject.location,
      supervisorName: currentUserName,
      attendanceTotal,
      registrationCount: entries.length,
      projectStart: projectStartAnswers,
      closeout: dailyCloseoutAnswers,
      buildings: buildingsBreakdown,
    };
  };

  return (
    <div className="app-shell">
      <FieldGuide
        canManage={canManageMembers}
        onOpenDestination={(destination) => {
          if (destination === "today") {
            navigate("vandaag");
            return;
          }
          if (destination === "reports") {
            navigate("rapporten");
            return;
          }
          if (destination === "photo") {
            openQuickAdd();
            return;
          }
          setInitialProjectTab(destination === "inspection" ? "inspections" : "findings");
          setActiveNav("project");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <input
        ref={quickCameraInputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => {
          void receiveQuickCameraPhoto(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <aside className="sidebar" aria-label={text("Main navigation", "Hoofdnavigatie")}>
        <div className="brand">
          <CompanyLogo subtitle={text("Supervision", "Supervisie")} />
        </div>

        <button className="project-context-card" type="button" aria-label={text("Change project and building", "Project en gebouw wijzigen")} onClick={() => setWorkspaceStage("projects")}>
          <span className="project-context-icon"><Building2 size={17} /></span>
          <span className="project-context-copy">
            <strong>{projectName}</strong>
            <small>{buildingContextLabel} · {selectedProject?.location}</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav className="side-nav">
          <span className="nav-label">{text("Workspace", "Werkruimte")}</span>
          {localizedNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-button ${activeNav === item.id ? "active" : ""}`}
                type="button"
                onClick={() => navigate(item.id)}
                key={item.id}
              >
                <Icon size={18} strokeWidth={1.8} />
                {item.label}
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <button className="quick-add-side" type="button" onClick={openQuickAdd}>
          <Camera size={18} strokeWidth={2.4} />
          {text("Take photo", "Foto maken")}
        </button>
        <button className="user-card" type="button" onClick={() => void supabase.auth.signOut()} title={text("Sign out", "Afmelden")}>
          <span className="avatar">{initials(currentUserName)}</span>
          <span className="user-copy">
            <strong>{currentUserName}</strong>
            <small>{text("CODECO user", "CODECO-gebruiker")}</small>
          </span>
          <LogOut size={16} color="#7893a1" />
        </button>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button
            className="breadcrumb"
            type="button"
            aria-label={text(`Manage buildings. ${buildingCount} buildings in this project.`, `Gebouwen beheren. ${buildingCount} gebouwen in dit project.`)}
            onClick={() => setModal("manage_buildings")}
          >
            <span>{text("My projects", "Mijn projecten")}</span>
            <ChevronRight size={13} />
            <span>{projectName}</span>
            <ChevronRight size={13} />
            <strong>{buildingContextLabel}</strong>
          </button>
          <div className="top-actions">
            <LiveWeatherChip location={selectedProject?.location ?? ""} />
            <LanguageSwitcher compact />
            {/* The connection chip is the way into the offline copy: it is where a
                supervisor already looks when the connection is the question. */}
            <button className={`storage-state ${syncState}`} type="button" title={storageStatus} onClick={() => setModal("offline")} aria-label={text("Offline availability", "Offline beschikbaarheid")}>{syncState === "error" || !isOnline ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} <span>{storageStatus}</span></button>
            <button className={`icon-button management-button ${activeNav === "meer" ? "active" : ""}`} type="button" aria-label={text("Open management and settings", "Open beheer en instellingen")} title={text("Management and settings", "Beheer en instellingen")} onClick={() => navigate("meer")}><Settings size={17} /></button>
            <button className="icon-button" type="button" aria-label={`${text("Notifications", "Meldingen")}${unreadNotificationCount ? `, ${unreadNotificationCount} ${text("unread", "ongelezen")}` : ""}`} onClick={() => setModal("notifications")}>
              <Bell size={17} />
              {unreadNotificationCount ? <span className="notification-dot" /> : null}
            </button>
          </div>
        </header>

        <main className="main-content">
          {activeNav === "vandaag" ? (
            <TodayView
              entries={entries}
              completeness={completeness}
              completedTodos={completedTodos}
              toggleTodo={toggleTodo}
              openReport={() => setModal("report")}
              projectName={projectName}
              projectLocation={selectedProject?.location ?? "Paramaribo, Suriname"}
              buildingName={buildingName}
              attendanceTotal={projectAttendanceTotal}
              projectStartAnswers={projectStartAnswers}
              dailyCloseoutAnswers={dailyCloseoutAnswers}
              openProjectStart={() => selectedBuilding && openProjectStartForAllBuildings()}
              openDailyQuestions={() => selectedBuilding && openDailyQuestionsForAllBuildings()}
              openQuickAdd={openQuickAdd}
              openOneTapLog={() => setModal("one_tap_log")}
              openActions={() => navigate("acties")}
              openWorkspace={() => navigate("project")}
              openSettings={() => navigate("meer")}
              canManageMembers={canManageMembers}
              currentUserName={currentUserName}
              now={clock}
              reportNumber={reportNumber}
              actions={dayActions}
              showCritical={() => {
                navigate("acties");
                setToast(text("The action list is open.", "De actielijst is geopend."));
              }}
              buildings={selectedProject?.buildings ?? []}
              startChecks={dayQuery.data?.startChecks ?? []}
              closeouts={dayQuery.data?.closeouts ?? []}
              onStartBuilding={openBuildingStart}
              onCloseoutBuilding={openBuildingCloseout}
            />
          ) : activeNav === "project" || activeNav === "acties" || activeNav === "projectdocs" || activeNav === "punchlist" || activeNav === "verify" || activeNav === "rapporten" || activeNav === "meer" ? (
            <OperationalWorkspace
              mode={activeNav === "acties" ? "actions" : activeNav === "verify" ? "verify" : activeNav === "project" || activeNav === "projectdocs" || activeNav === "punchlist" ? "project" : activeNav === "rapporten" ? "reports" : "admin"}
              client={supabase}
              organizationId={activeOrganizationId!}
              projectId={selectedProject!.id}
              projectName={projectName}
              projectCode={selectedProject!.code}
              buildingId={selectedBuilding!.id}
              buildingName={buildingName}
              buildings={selectedProject?.buildings ?? []}
              reportId={dayQuery.data?.report?.id ? String(dayQuery.data.report.id) : null}
              reportNumber={reportNumber}
              reportStatus={String(dayQuery.data?.report?.status ?? "draft")}
              projectStartAnswers={projectStartAnswers}
              currentUserName={currentUserName}
              currentUserId={session.user.id}
              companyEmployees={companyEmployees}
              parties={dayQuery.data?.parties ?? []}
              canManageOrganization={canManageMembers}
              openUserAdmin={() => setModal("user_admin")}
              initialProjectTab={initialProjectTab}
              onProjectTabChange={setInitialProjectTab}
              externalSubmissionIntent={externalSubmissionIntent}
              actionCenterView={actionCenterView}
              focusRecordId={focusRecordId}
              initialCameraFiles={pendingQuickPhotos}
              onInitialCameraFilesConsumed={() => setPendingQuickPhotos([])}
              openQuickCamera={openQuickAdd}
              openDailyRecord={openWorkspaceDailyRecord}
              projectActions={dayActions}
              openProjectAction={(actionId) => {
                const action = dayActions.find((item) => item.id === actionId);
                if (!action) return;
                // An action that is still waiting on the device has no central record to
                // update yet; opening its detail would offer buttons that cannot work.
                if (isPendingRecordId(action.id)) {
                  setToast(text(
                    "This action is still on this device. It opens as soon as it has been sent.",
                    "Deze actie staat nog op dit apparaat. Ze opent zodra ze is verstuurd.",
                  ));
                  return;
                }
                setSelectedAction(action);
                setModal("action_detail");
              }}
              createProjectAction={() => setModal("action_create")}
              openProjectArea={(tab, recordId) => {
                // "submissions" is Management deliberately unlocking the contractor
                // document types; every other destination is a normal workspace module.
                setExternalSubmissionIntent(tab === "submissions");
                setInitialProjectTab(tab === "submissions" ? "registers" : tab);
                // The action centre points at a record, so the module opens on that record
                // instead of on the list it stands in.
                setFocusRecordId(recordId ?? "");
                setActiveNav("project");
              }}
              openActionCenter={(view = "work") => { navigate("acties"); setActionCenterView(view); }}
              openRapidVerify={() => navigate("verify")}
              openReports={() => navigate("rapporten")}
              openManagement={() => navigate("meer")}
            />
          ) : (
            <SecondaryView
              activeNav={activeNav}
              openQuickAdd={openQuickAdd}
              navigate={navigate}
              projectName={projectName}
              buildingName={buildingName}
              attendanceTotal={projectAttendanceTotal}
              openAttendance={() => setModal("attendance")}
              entries={entries}
              actions={dayActions}
              actionUpdates={dayQuery.data?.actionUpdates ?? []}
              locationNodes={projectLocationsQuery.data ?? []}
              openAction={(action) => {
                setSelectedAction(action);
                setModal("action_detail");
              }}
              openActionCreate={() => setModal("action_create")}
              openProjectTab={(tab) => {
                setInitialProjectTab(tab);
                setActiveNav("project");
              }}
              reportNumber={reportNumber}
              reportStatus={String(dayQuery.data?.report?.status ?? "draft")}
              canManageMembers={canManageMembers}
              openUserAdmin={() => setModal("user_admin")}
            />
          )}
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label={text("Mobile main navigation", "Mobiele hoofdnavigatie")}>
        {localizedNavigation.filter((item) => item.id === "vandaag" || item.id === "project").map((item) => {
          const Icon = item.icon;
          return (
            <button className={`mobile-nav-button ${activeNav === item.id ? "active" : ""}`} type="button" onClick={() => navigate(item.id)} key={item.id}>
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
        <button className="mobile-nav-button quick" type="button" onClick={openQuickAdd} aria-label={text("Quick add", "Snel toevoegen")}>
          <span className="mobile-plus"><Camera size={23} /></span>
          {text("Photo", "Foto")}
        </button>
        {localizedNavigation.filter((item) => item.id === "acties").map((item) => {
          const Icon = item.icon;
          return (
            <button className={`mobile-nav-button ${activeNav === item.id ? "active" : ""}`} type="button" onClick={() => navigate(item.id)} key={item.id}>
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
        <button
          className={`mobile-nav-button ${["projectdocs", "punchlist", "verify", "rapporten", "meer"].includes(activeNav) ? "active" : ""}`}
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-module-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <Settings size={20} />
          {text("More", "Meer")}
        </button>
      </nav>

      {mobileMenuOpen ? (
        <div className="mobile-module-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMobileMenuOpen(false)}>
          <section className="mobile-module-sheet" id="mobile-module-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-module-title">
            <header>
              <div>
                <span>{projectName}</span>
                <h2 id="mobile-module-title">{text("All project modules", "Alle projectmodules")}</h2>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label={text("Close", "Sluiten")}><X size={19} /></button>
            </header>
            <div className="mobile-module-grid">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setModal("manage_buildings");
                }}
              >
                <span><Building2 size={19} /></span>
                <span>
                  <strong>{text("Buildings", "Gebouwen")}</strong>
                  <small>
                    {text(
                      `${selectedProject?.buildings.length ?? 0} in this project · view or add`,
                      `${selectedProject?.buildings.length ?? 0} in dit project · bekijken of toevoegen`,
                    )}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
              {localizedNavigation.filter((item) => ["projectdocs", "punchlist", "verify", "rapporten", "meer"].includes(item.id)).map((item) => {
                const Icon = item.icon;
                const descriptions: Record<string, string> = {
                  projectdocs: text("Drawings, BOQ, specifications and contracts", "Tekeningen, BOQ, specificaties en contracten"),
                  punchlist: text("Contractor and supervisor verification", "Verificatie door aannemer en supervisor"),
                  verify: text("Check project documents quickly", "Controleer projectdocumenten snel"),
                  rapporten: text("Daily, weekly and monthly output", "Dag-, week- en maandrapportage"),
                  meer: text("Team, rules and project setup", "Team, regels en projectinrichting"),
                };
                return (
                  <button className={activeNav === item.id ? "active" : ""} type="button" onClick={() => navigate(item.id)} key={item.id}>
                    <span><Icon size={19} /></span>
                    <span><strong>{item.label}</strong><small>{descriptions[item.id]}</small></span>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {modal === "quick" ? <QuickAddModal close={() => setModal(null)} chooseType={chooseType} /> : null}
      {modal === "entry" && selectedProject ? (
        <EntryModal
          selectedType={selectedType}
          description={description}
          descriptionSuggested={descriptionSuggested}
          priority={priority}
          workPackage={entryWorkPackage}
          setDescription={writeDescription}
          dictateDescription={dictateDescription}
          setWorkPackage={setEntryWorkPackage}
          setLocation={setLocation}
          setPriority={setPriority}
          goBack={() => setModal("quick")}
          close={() => setModal(null)}
          save={saveEntry}
          photos={entryPhotos}
          setPhotos={setEntryPhotos}
          addPhotos={(files) => {
            const captured = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
            if (captured.length) setEntryPhotos((current) => [...current, ...captured.map((file) => toPhotoEvidence(file))]);
          }}
          addSketch={(file) => setEntryPhotos((current) => [...current, toPhotoEvidence(file, { category: "overview" })])}
          projectName={projectName}
          buildingName={buildingName}
          buildings={selectedProject.buildings}
          buildingIds={entryBuildingIds}
          setBuildingIds={(next) => { setEntryBuildingIds(next); setEntryLocationNodeId(""); setEntryDrawingId(""); }}
          locationNodes={projectLocationsQuery.data ?? []}
          locationNodeId={entryLocationNodeId}
          setLocationNodeId={setEntryLocationNodeId}
          drawings={projectDrawingsQuery.data ?? []}
          drawingId={entryDrawingId}
          setDrawingId={setEntryDrawingId}
          openDrawings={() => {
            setModal(null);
            setEntryDraftParked(true);
            setInitialProjectTab("drawings");
            setActiveNav("project");
          }}
          requiredLocationDepth={projectConfigurationQuery.data?.required_location_depth ?? "building"}
          busy={syncState === "saving"}
        />
      ) : null}
      {modal === "action_create" && selectedProject && selectedBuilding ? (
        <ActionCreateModal
          parties={dayQuery.data?.parties ?? []}
          employees={companyEmployees}
          projectName={projectName}
          buildingName={buildingName}
          buildings={selectedProject.buildings}
          defaultBuildingId={selectedBuilding.id}
          locationNodes={projectLocationsQuery.data ?? []}
          requiredLocationDepth={projectConfigurationQuery.data?.required_location_depth ?? "building"}
          close={() => setModal(null)}
          goBack={() => setModal("quick")}
          save={async (answers, actionBuildingId, locationNodeId) => {
            const targetBuildingIds = actionBuildingId === ALL_BUILDINGS
              ? selectedProject.buildings.map((building) => building.id)
              : [actionBuildingId];
            const saved = await runSynced(
              () => Promise.all(targetBuildingIds.map((buildingId) => {
                const input = {
                  projectId: selectedProject.id,
                  buildingId,
                  locationNodeId: actionBuildingId === ALL_BUILDINGS ? undefined : locationNodeId,
                  ...answers,
                };
                return saveRecordOnlineOrQueue({
                  kind: "action",
                  projectId: selectedProject.id,
                  input,
                  preview: {
                    title: answers.title,
                    description: answers.description,
                    buildingId,
                    locationNodeId: actionBuildingId === ALL_BUILDINGS ? null : locationNodeId || null,
                    severity: "medium",
                    priority: answers.priority,
                    dueAt: answers.dueAt || null,
                    recordType: "action",
                  },
                  send: () => createProjectAction(supabase, input),
                });
              })),
              text("The action has been created with its deadline and responsible party.", "De actie is aangemaakt met deadline en verantwoordelijke."),
              { offlineCapable: true },
            );
            if (!saved) return false;
            setModal(null);
            setActiveNav("acties");
            await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
            return true;
          }}
        />
      ) : null}
      {modal === "offline" && supabase && session ? (
        <OfflineManagerModal
          client={supabase}
          userId={session.user.id}
          projectId={selectedProject?.id ?? ""}
          isOnline={isOnline}
          close={() => setModal(null)}
        />
      ) : null}
      {modal === "action_detail" && selectedAction ? (
        <ActionDetailModal
          action={selectedAction}
          partyName={dayQuery.data?.parties.find((party) => party.id === selectedAction.owner_party_id)?.name ?? "Niet toegewezen"}
          locationNodes={projectLocationsQuery.data ?? []}
          updates={(dayQuery.data?.actionUpdates ?? []).filter((update) => update.action_id === selectedAction.id)}
          close={() => {
            setSelectedAction(null);
            setModal(null);
          }}
          transition={async (nextStatus, note) => {
            const saved = await runSynced(
              () => transitionProjectAction(supabase, { actionId: selectedAction.id, nextStatus, note }),
              `Actie is centraal bijgewerkt naar ${actionStatusLabels[nextStatus].toLowerCase()}.`,
            );
            if (!saved) return false;
            setSelectedAction(saved);
            await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject?.id, reportDate] });
            return true;
          }}
        />
      ) : null}
      {modal === "report" ? (
        <ReportModal
          close={() => setModal(null)}
          completedTodos={completedTodos}
          entries={entries}
          attendanceTotal={projectAttendanceTotal}
          projectName={projectName}
          reportNumber={reportNumber}
          reportStatus={String(dayQuery.data?.report?.status ?? "draft")}
          dailyCloseoutAnswers={dailyCloseoutAnswers}
          buildings={selectedProject?.buildings ?? []}
          startChecks={dayQuery.data?.startChecks ?? []}
          closeouts={dayQuery.data?.closeouts ?? []}
          onDownload={async () => {
            const snapshot = buildDraftReportSnapshot();
            if (!snapshot) return;
            const { downloadDailyReportPdf } = await import("@/lib/reports/daily-report-pdf");
            await downloadDailyReportPdf(snapshot);
            setToast(text("The draft PDF has been generated from the saved report data.", "De concept-PDF is gegenereerd uit de opgeslagen rapportgegevens."));
          }}
          onDownloadDocx={async () => {
            const snapshot = buildDraftReportSnapshot();
            if (!snapshot) return;
            const { downloadDailyReportDocx } = await import("@/lib/reports/daily-report-docx");
            await downloadDailyReportDocx(snapshot);
            setToast(text("The draft Word document has been generated from the saved report data.", "Het concept-Worddocument is gegenereerd uit de opgeslagen rapportgegevens."));
          }}
          onSubmit={async () => {
            const reportId = dayQuery.data?.report?.id;
            if (!reportId) {
              setToast(text("Start the day report before submitting it.", "Start eerst het dagrapport voordat je het indient."));
              return;
            }
            const saved = await runSynced(
              () => submitReportForReview(supabase, String(reportId)),
              text("The day report has been submitted for review.", "Het dagrapport is gereed voor review gezet."),
            );
            if (!saved) return;
            setModal(null);
            await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject?.id, reportDate] });
          }}
        />
      ) : null}
      {modal === "daily_questions" && selectedProject && (contextBuilding || contextIsAllBuildings) ? (
        <DailyQuestionsModal
          key={contextBuildingId ?? "none"}
          buildingName={contextIsAllBuildings ? text("All buildings", "Alle gebouwen") : contextBuilding!.name}
          buildingId={contextIsAllBuildings ? ALL_BUILDINGS : contextBuilding!.id}
          buildings={selectedProject.buildings}
          onChangeBuilding={setContextBuildingId}
          close={() => { setModal(null); setContextBuildingId(null); }}
          initialAnswers={contextDailyCloseoutAnswers}
          projectStartAnswers={contextProjectStartAnswers}
          save={async (answers) => {
            const targetBuildings = contextIsAllBuildings ? selectedProject.buildings : [contextBuilding!];
            const saved = await runSynced(
              async () => {
                // Same as the attendance screen: answering the day's questions must not wait
                // on a report the supervisor has to go and start somewhere else first.
                const report = dayQuery.data?.report ?? await createOrGetReport(supabase, selectedProject.id, reportDate);
                await Promise.all(targetBuildings.map((building) => saveDailyCloseout(supabase, {
                  report,
                  projectId: selectedProject.id,
                  buildingId: building.id,
                  answers,
                })));
              },
              text(
                "The day's questions are saved and carried into the report review.",
                "De dagvragen zijn opgeslagen en in de rapportcontrole verwerkt.",
              ),
            );
            if (!saved) return;
            if (targetBuildings.some((building) => building.id === selectedBuilding?.id)) {
              setDailyCloseoutAnswers(answers);
              setCompletedTodos((current) => Array.from(new Set([...current, 2, 3])));
            }
            setModal(null);
            setContextBuildingId(null);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] }),
              queryClient.invalidateQueries({ queryKey: ["workspace", session.user.id] }),
            ]);
          }}
        />
      ) : null}
      {modal === "project_start" && selectedProject && (contextBuilding || contextIsAllBuildings) ? (
        <ProjectStartForm
          key={contextBuildingId ?? "none"}
          project={selectedProject}
          buildingId={contextIsAllBuildings ? ALL_BUILDINGS : contextBuilding!.id}
          buildingName={contextIsAllBuildings ? text("All buildings", "Alle gebouwen") : contextBuilding!.name}
          buildings={selectedProject.buildings}
          onChangeBuilding={setContextBuildingId}
          defaultShiftStart={configuredShiftStart}
          defaultShiftEnd={configuredShiftEnd}
          close={() => { setModal(null); setContextBuildingId(null); }}
          initialAnswers={contextProjectStartAnswers}
          save={async (answers) => {
            const targetBuildings = contextIsAllBuildings ? selectedProject.buildings : [contextBuilding!];
            await startProject(targetBuildings, answers);
            setContextBuildingId(null);
          }}
        />
      ) : null}
      {modal === "attendance" && selectedProject && selectedBuilding ? (
        <WorkforceModal
          initialRows={attendance}
          rowsForBuilding={(nextBuildingId) => dayQuery.data
            ? attendanceRowsForBuilding(dayQuery.data, nextBuildingId, text("Unknown party", "Onbekende partij"), configuredShiftStart, configuredShiftEnd)
            : []}
          parties={dayQuery.data?.parties ?? []}
          disciplines={configuredDisciplines}
          defaultShiftStart={configuredShiftStart}
          defaultShiftEnd={configuredShiftEnd}
          buildings={selectedProject.buildings}
          defaultBuildingId={selectedBuilding.id}
          buildingName={buildingName}
          weatherLabel={projectStartAnswers ? `${projectStartAnswers.temperatureC}°C` : ""}
          busy={syncState === "saving"}
          copyPreviousWorkday={async (workforceBuildingId) => {
            const previous = await loadPreviousWorkdayAttendance(supabase, selectedProject.id, reportDate, workforceBuildingId);
            if (!previous) return null;
            const partyName = new Map((dayQuery.data?.parties ?? []).map((party) => [party.id, party.name]));
            return {
              reportDate: previous.reportDate,
              rows: previous.rows.map((row) => ({
                partyId: row.partyId,
                party: partyName.get(row.partyId) ?? text("Unknown party", "Onbekende partij"),
                discipline: row.discipline,
                count: row.headcount,
                shiftStart: row.shiftStart,
                shiftEnd: row.shiftEnd,
              })),
            };
          }}
          close={() => setModal(null)}
          save={async (rows, attendanceBuildingId) => {
            const total = rows.reduce((sum, row) => sum + row.count, 0);
            const saved = await runSynced(
              async () => {
                // Counting the crew is often the first thing done on site, before anyone
                // opened the day report. The report is started here rather than sending the
                // supervisor away to press a button somewhere else first.
                const report = dayQuery.data?.report ?? await createOrGetReport(supabase, selectedProject.id, reportDate);
                await saveAttendance(supabase, {
                  report,
                  projectId: selectedProject.id,
                  buildingId: attendanceBuildingId,
                  rows: rows.map((row) => ({
                    partyId: row.partyId,
                    discipline: row.discipline,
                    count: row.count,
                    shiftStart: row.shiftStart,
                    shiftEnd: row.shiftEnd,
                  })),
                });
              },
              text(
                `${total} people present are now linked to today's day report.`,
                `${total} aanwezigen zijn aan het dagrapport van vandaag gekoppeld.`,
              ),
            );
            if (!saved) return;
            setModal(null);
            await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
          }}
        />
      ) : null}
      {modal === "one_tap_log" && selectedProject && selectedBuilding ? (
        <DailyLogModal
          buildings={selectedProject.buildings}
          defaultBuildingId={selectedBuilding.id}
          buildingName={buildingName}
          projectStartAnswers={projectStartAnswers}
          initialCloseout={dailyCloseoutAnswers}
          attendanceRows={attendance}
          disciplines={configuredDisciplines}
          parties={dayQuery.data?.parties ?? []}
          busy={syncState === "saving"}
          close={() => setModal(null)}
          openProjectStart={() => {
            setModal(null);
            openProjectStartForAllBuildings();
          }}
          openFullQuestionnaire={() => {
            setModal(null);
            openBuildingCloseout(selectedBuilding);
          }}
          save={async ({ buildingIds: logBuildingIds, answers, attendance: rows, photos }) => {
            const targetBuildingIds = logBuildingIds.length ? logBuildingIds : [selectedBuilding.id];
            const primaryBuildingId = targetBuildingIds[0];
            const saved = await runSynced(async () => {
              const report = dayQuery.data?.report ?? await createOrGetReport(supabase, selectedProject.id, reportDate);
              // The day log is the client's own daily record, so it writes the real
              // closeout instead of a loose note. Reports and Daily work stay in sync.
              // One day can cover several buildings; each one gets its own closeout.
              for (const logBuildingId of targetBuildingIds) {
                await saveDailyCloseout(supabase, {
                  report,
                  projectId: selectedProject.id,
                  buildingId: logBuildingId,
                  answers,
                });
                if (rows.length) {
                  await saveAttendance(supabase, {
                    report,
                    projectId: selectedProject.id,
                    buildingId: logBuildingId,
                    rows: rows.map((row) => ({
                      partyId: row.partyId,
                      discipline: row.discipline,
                      count: row.count,
                      shiftStart: row.shiftStart,
                      shiftEnd: row.shiftEnd,
                    })),
                  });
                }
              }
              if (photos.length) {
                const reportId = String(report.id);
                const logBuildingName = selectedProject.buildings.find((building) => building.id === primaryBuildingId)?.name ?? buildingName;
                for (const photo of photos) {
                  const prepared = await compressFieldPhoto(photo.file, dataSaverEnabled());
                  await queueOfflineUpload({
                    projectId: selectedProject.id,
                    buildingId: primaryBuildingId,
                    reportId,
                    folderId: null,
                    folderName: text("Daily progress", "Dagvoortgang"),
                    kind: "photo",
                    file: prepared.blob,
                    fileName: prepared.fileName,
                    mimeType: prepared.mimeType,
                    // The words the supervisor gave the photo are what the report shows.
                    title: photoTitle(photo).slice(0, 120) || text("Field photo", "Veldfoto"),
                    description: photoUploadDescription(photo, "", language),
                    locationLabel: logBuildingName,
                    locationNodeId: photo.details.locationNodeId || null,
                    capturedAt: new Date(photo.file.lastModified || Date.now()).toISOString(),
                    originalSize: photo.original.size,
                    queuedSize: prepared.blob.size,
                    compressed: prepared.compressed,
                  });
                }
                if (navigator.onLine) {
                  await forceSyncOfflineUploads(supabase, selectedProject.id, {
                    paused: text(
                      "The connection changed before central photo confirmation. The photos remain safe on this device. Open Photos & folders and tap Sync now.",
                      "De verbinding veranderde vóór de centrale fotobevestiging. De foto’s blijven veilig op dit apparaat. Open Foto’s & mappen en tik op Nu synchroniseren.",
                    ),
                    failed: (pendingCount) => text(
                      `${pendingCount} photo upload(s) could not be confirmed centrally. They remain safe on this device. Open Photos & folders and tap Sync now.`,
                      `${pendingCount} foto-upload(s) konden niet centraal worden bevestigd. Ze blijven veilig op dit apparaat. Open Foto’s & mappen en tik op Nu synchroniseren.`,
                    ),
                  });
                }
              }
              return true;
            }, text("Daily log saved and linked to today's report.", "Daglog opgeslagen en aan het dagrapport van vandaag gekoppeld."));
            if (!saved) return;
            if (targetBuildingIds.includes(selectedBuilding.id)) {
              setDailyCloseoutAnswers(answers);
              setCompletedTodos((current) => Array.from(new Set([...current, 2, 3])));
            }
            setModal(null);
            await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
          }}
        />
      ) : null}

      {modal === "user_admin" && activeOrganizationId ? (
        <UserAdminModal
          close={() => setModal(null)}
          organizationId={activeOrganizationId}
          projects={workspaceQuery.data.projects.filter((project) => project.organizationId === activeOrganizationId)}
          access={internalAccessQuery.data ?? null}
          loading={internalAccessQuery.isLoading}
          loadError={internalAccessQuery.error instanceof Error ? internalAccessQuery.error.message : ""}
          reload={() => void internalAccessQuery.refetch()}
          currentUserId={session.user.id}
          invite={async (answers) => {
            const saved = await runSynced(
              () => inviteInternalUser(supabase, answers),
              `Uitnodiging is verzonden naar ${answers.email}.`,
            );
            if (!saved) return false;
            await internalAccessQuery.refetch();
            return true;
          }}
          changeStatus={async (userId, nextStatus, reason) => {
            const saved = await runSynced(
              () => setInternalUserAccessStatus(supabase, activeOrganizationId, userId, nextStatus, reason),
              nextStatus === "active" ? "Interne toegang opnieuw geactiveerd." : nextStatus === "suspended" ? "Interne toegang tijdelijk opgeschort." : "Interne toegang definitief ingetrokken.",
            );
            if (!saved) return false;
            await internalAccessQuery.refetch();
            return true;
          }}
          changeProjectRole={async (userId, projectId, roleCode, reason) => {
            const saved = await runSynced(
              () => setUserProjectRole(supabase, { organizationId: activeOrganizationId, userId, projectId, roleCode, reason }),
              text("Project permissions changed and recorded in the audit history.", "Projectrechten aangepast en in de auditgeschiedenis vastgelegd."),
            );
            if (!saved) return false;
            await internalAccessQuery.refetch();
            return true;
          }}
        />
      ) : null}

      {modal === "manage_buildings" && selectedProject ? (
        <ManageBuildingsModal
          buildings={selectedProject.buildings}
          close={() => setModal(null)}
          addBuilding={addBuilding}
        />
      ) : null}

      {modal === "notifications" ? (
        <NotificationsModal
          client={supabase}
          notifications={notificationQuery.data ?? []}
          loading={notificationQuery.isLoading}
          close={() => setModal(null)}
          markRead={async (notificationId) => {
            const saved = await runSynced(
              () => markNotificationRead(supabase, notificationId),
              text("Notification marked as read.", "Melding als gelezen gemarkeerd."),
            );
            if (saved) await queryClient.invalidateQueries({ queryKey: ["project-notifications", selectedProject?.id] });
          }}
        />
      ) : null}

      {/* Opening a drawing leaves the record behind. This bar is the way back to it, so
          the half-filled record is never lost on the drawing screen. */}
      {entryDraftParked && modal !== "entry" ? (
        <div className="entry-resume-bar" role="status">
          <span><strong>{text("Your field record is still open", "Je veldregistratie staat nog open")}</strong><small>{description.trim() || text("No description yet", "Nog geen omschrijving")}</small></span>
          <button className="primary-button" type="button" onClick={() => { setEntryDraftParked(false); setModal("entry"); }}><ArrowLeft size={14} /> {text("Back to the record", "Terug naar de registratie")}</button>
          <button className="entry-resume-dismiss" type="button" onClick={() => setEntryDraftParked(false)} aria-label={text("Discard this record", "Deze registratie laten vallen")}><X size={14} /></button>
        </div>
      ) : null}
      {toast ? <div className={`toast ${syncState === "error" ? "error" : ""}`} role={syncState === "error" ? "alert" : "status"} aria-live={syncState === "error" ? "assertive" : "polite"}>{syncState === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />} {toast}</div> : null}
    </div>
  );
}

function AppStateScreen({
  title,
  copy,
  loading = false,
  action,
}: {
  title: string;
  copy: string;
  loading?: boolean;
  action?: () => void;
}) {
  const { text } = useLanguage();
  return (
    <div className="access-shell">
      <section className="access-card state-card">
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={text("Construction supervision", "Constructiesupervisie")} /></div><LanguageSwitcher /></div>
        <span className="state-icon">{loading ? <Loader2 className="spin" size={26} /> : <AlertTriangle size={26} />}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
        {action ? <button className="primary-button" type="button" onClick={action}>{text("Try again", "Opnieuw proberen")}</button> : null}
      </section>
    </div>
  );
}

function AuthScreen({ client }: { client: SupabaseClient }) {
  const { language, text } = useLanguage();
  const localizedAuthSchema = useMemo(() => createAuthSchema(language), [language]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<AuthAnswers>({
    resolver: zodResolver(localizedAuthSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = async (answers: AuthAnswers) => {
    setBusy(true);
    setError("");
    try {
      const result = await client.auth.signInWithPassword({ email: answers.email, password: answers.password });
      if (result.error) throw result.error;
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : text("Sign-in failed.", "Aanmelden is niet gelukt.");
      setError(raw.includes("Invalid login credentials") ? text("The email address or password is incorrect.", "E-mailadres of wachtwoord is onjuist.") : raw);
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    const email = getValues("email").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(text("Enter your email address first.", "Vul eerst je e-mailadres in."));
      return;
    }
    setBusy(true);
    setError("");
    setResetSent(false);
    try {
      const result = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/supervisie` });
      if (result.error) throw result.error;
      setResetSent(true);
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : "";
      setError(/rate limit/i.test(raw)
        ? text("Too many recovery emails were requested. Try again later.", "Er zijn te veel herstelmails aangevraagd. Probeer het later opnieuw.")
        : text("The recovery email could not be sent. Try again.", "De herstelmail kon niet worden verzonden. Probeer opnieuw."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="access-shell">
      <section className="access-card auth-card">
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={text("Construction supervision", "Constructiesupervisie")} /></div><LanguageSwitcher /></div>
        <div className="auth-heading">
          <p className="eyebrow">{text("Internal CODECO workspace", "Interne CODECO-werkruimte")}</p>
          <h1>{text("Welcome back", "Welkom terug")}</h1>
          <p>{text("Only project users invited by an organization administrator can sign in.", "Alleen projectgebruikers die door een organisatiebeheerder zijn uitgenodigd kunnen aanmelden.")}</p>
        </div>
        <form className="access-form" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("Email address", "E-mailadres")}</span><input type="email" autoComplete="email" {...register("email")} />{errors.email ? <small className="field-error">{errors.email.message}</small> : null}</label>
          <label className="form-field"><span>{text("Password", "Wachtwoord")}</span><input type="password" autoComplete="current-password" {...register("password")} />{errors.password ? <small className="field-error">{errors.password.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          {resetSent ? <p className="access-message success" role="status">{text("If this account exists, a secure recovery link has been sent. Check your inbox and spam folder.", "Als dit account bestaat, is een beveiligde herstellink verstuurd. Controleer je inbox en spammap.")}</p> : null}
          <button className="primary-button access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}{text("Sign in securely", "Veilig aanmelden")}</button>
          <button className="auth-help-button" type="button" disabled={busy} onClick={() => void sendPasswordReset()}>{text("Forgot your password?", "Wachtwoord vergeten?")}</button>
        </form>
        <p className="security-note"><ShieldCheck size={14} /> {text("No account? Ask your CODECO administrator for a personal invitation.", "Geen account? Vraag je CODECO-beheerder om een persoonlijke uitnodiging.")}</p>
      </section>
    </div>
  );
}

function PasswordSetupScreen({
  mode,
  email,
  save,
  signOut,
}: {
  mode: "invitation" | "recovery";
  email: string;
  save: (answers: PasswordSetupAnswers) => Promise<void>;
  signOut: () => void;
}) {
  const { language, text } = useLanguage();
  const localizedPasswordSetupSchema = useMemo(() => createPasswordSetupSchema(language), [language]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<PasswordSetupAnswers>({
    resolver: zodResolver(localizedPasswordSetupSchema),
    defaultValues: { password: "", passwordConfirmation: "" },
  });
  const submit = async (answers: PasswordSetupAnswers) => {
    setBusy(true);
    setError("");
    try {
      await save(answers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("The password could not be saved.", "Het wachtwoord kon niet worden opgeslagen."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="access-shell setup-shell">
      <section className="access-card setup-card">
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={mode === "recovery" ? text("Account recovery", "Accountherstel") : text("Internal invitation", "Interne uitnodiging")} /></div><LanguageSwitcher /><button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button></div>
        <span className="state-icon"><KeyRound size={26} /></span>
        <p className="eyebrow">{mode === "recovery" ? text("Secure recovery", "Veilig herstel") : text("First sign-in", "Eerste aanmelding")}</p><h1>{mode === "recovery" ? text("Choose a new password", "Kies een nieuw wachtwoord") : text("Set your password", "Stel je wachtwoord in")}</h1><p>{mode === "recovery" ? <>{text("The recovery link for", "De herstellink voor")} <strong>{email}</strong> {text("has been verified. Choose a new personal password of at least 12 characters.", "is geverifieerd. Kies een nieuw persoonlijk wachtwoord van minimaal 12 tekens.")}</> : <>{text("The invitation for", "De uitnodiging voor")} <strong>{email}</strong> {text("has been verified. Choose a personal password of at least 12 characters.", "is geverifieerd. Kies nu een persoonlijk wachtwoord van minimaal 12 tekens.")}</>}</p>
        <form className="access-form setup-form" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("New password", "Nieuw wachtwoord")}</span><input type="password" autoComplete="new-password" {...register("password")} />{errors.password ? <small className="field-error">{errors.password.message}</small> : null}</label>
          <label className="form-field"><span>{text("Repeat password", "Herhaal wachtwoord")}</span><input type="password" autoComplete="new-password" {...register("passwordConfirmation")} />{errors.passwordConfirmation ? <small className="field-error">{errors.passwordConfirmation.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          <button className="primary-button access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}{text("Save password", "Wachtwoord opslaan")}</button>
        </form>
      </section>
    </div>
  );
}

function AccessPendingScreen({ email, signOut }: { email: string; signOut: () => void }) {
  const { text } = useLanguage();
  return (
    <div className="access-shell">
      <section className="access-card state-card">
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={text("Internal access", "Interne toegang")} /></div><LanguageSwitcher /></div>
        <span className="state-icon"><ShieldCheck size={26} /></span>
        <h1>{text("No project access yet", "Nog geen projecttoegang")}</h1>
        <p>{text("The signed-in account", "Het account")} <strong>{email}</strong> {text("has no CODECO organization or project assigned. Ask an organization administrator to assign the appropriate role.", "is aangemeld, maar heeft geen CODECO-organisatie of project toegewezen. Vraag een organisatiebeheerder om de juiste rol toe te kennen.")}</p>
        <button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button>
      </section>
    </div>
  );
}

function OrganizationSetupScreen({
  userEmail,
  defaultDisplayName,
  save,
  signOut,
}: {
  userEmail: string;
  defaultDisplayName: string;
  save: (answers: OrganizationSetupAnswers) => Promise<boolean>;
  signOut: () => void;
}) {
  const { language, text } = useLanguage();
  const localizedOrganizationSetupSchema = useMemo(() => createOrganizationSetupSchema(language), [language]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<OrganizationSetupAnswers>({
    resolver: zodResolver(localizedOrganizationSetupSchema),
    defaultValues: { displayName: defaultDisplayName, organizationName: "CODECO N.V.", organizationSlug: "codeco-nv" },
  });
  const submit = async (answers: OrganizationSetupAnswers) => {
    setBusy(true);
    setError("");
    const ok = await save(answers);
    if (!ok) setError(text("The organization could not be created. Check whether the slug already exists.", "De organisatie kon niet worden aangemaakt. Controleer of de slug al bestaat."));
    setBusy(false);
  };
  return (
    <div className="access-shell setup-shell">
      <section className="access-card setup-card">
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={text("Initial setup", "Eerste inrichting")} /></div><LanguageSwitcher /><button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button></div>
        <p className="eyebrow">{text("Step 1 of 2", "Stap 1 van 2")}</p><h1>{text("Set up the organization securely", "Organisatie veilig instellen")}</h1><p>{text("This creates the central role and permission structure. Your account", "Dit maakt de centrale rollen- en rechtenstructuur. Je account")} <strong>{userEmail}</strong> {text("becomes the first organization administrator.", "wordt de eerste organisatiebeheerder.")}</p>
        <form className="access-form setup-form" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("Your name", "Jouw naam")}</span><input {...register("displayName")} />{errors.displayName ? <small className="field-error">{errors.displayName.message}</small> : null}</label>
          <label className="form-field"><span>{text("Company name", "Bedrijfsnaam")}</span><input {...register("organizationName")} /></label>
          <label className="form-field"><span>{text("Technical organization slug", "Technische organisatieslug")}</span><input {...register("organizationSlug")} />{errors.organizationSlug ? <small className="field-error">{errors.organizationSlug.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          <button className="primary-button access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}{text("Set up organization", "Organisatie instellen")}</button>
        </form>
      </section>
    </div>
  );
}

function ProjectSetupScreen({
  organizationName,
  save,
  signOut,
  embedded = false,
  close,
}: {
  organizationName: string;
  save: (answers: ProjectSetupAnswers) => Promise<boolean>;
  signOut: () => void;
  embedded?: boolean;
  close?: () => void;
}) {
  const { text } = useLanguage();
  const localizedProjectSetupSchema = useMemo(() => createProjectSetupSchema(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<ProjectSetupAnswers>({
    resolver: zodResolver(localizedProjectSetupSchema),
    defaultValues: {
      code: "COD-2026-001",
      name: "First construction project",
      location: "Paramaribo, Suriname",
      clientName: "Client",
      buildingCode: "HOOFD",
      buildingName: "Main building",
      additionalBuildings: "",
      locationLevels: "floor|GF|Ground floor\nfloor|L1|First floor\nfloor|L2|Second floor",
      contractorName: "Main contractor",
      defaultLanguage: "en",
      shiftStart: "07:00",
      shiftEnd: "16:00",
      reportPrefix: "DR",
      requiredLocationDepth: "floor",
      disciplines: constructionDisciplines.join("\n"),
      lowDeadlineDays: 14,
      mediumDeadlineDays: 7,
      highDeadlineDays: 3,
      criticalDeadlineDays: 1,
      notificationLeadHours: 24,
      reportHeader: "CODECO Construction Supervision",
      reportFooter: "",
      enableWorkforce: true,
      enableInspections: true,
      enableQuality: true,
      enableHse: true,
      enableDocuments: true,
      enableVisualEvidence: true,
    },
  });
  const submit = async (answers: ProjectSetupAnswers) => {
    setBusy(true);
    setError("");
    const ok = await save(answers);
    if (!ok) setError(text("The project could not be created. Check the project code and try again.", "Het project kon niet worden aangemaakt. Controleer de projectcode en probeer opnieuw."));
    setBusy(false);
  };
  return (
    <div className={embedded ? "modal-backdrop" : "access-shell setup-shell"} onMouseDown={(event) => embedded && event.target === event.currentTarget && close?.()}>
      <section className={embedded ? "modal setup-card project-setup-card" : "access-card setup-card project-setup-card"} role={embedded ? "dialog" : undefined} aria-modal={embedded ? true : undefined}>
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={`${organizationName} · ${embedded ? text("New project", "Nieuw project") : text("Initial setup", "Eerste inrichting")}`} /></div><LanguageSwitcher />{embedded ? <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button> : <button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button>}</div>
        <p className="eyebrow">{embedded ? text("Configure before activation", "Configureer vóór activatie") : text("Step 2 of 2", "Stap 2 van 2")}</p><h1>{embedded ? text("Create configured project", "Maak geconfigureerd project") : text("First project and building", "Eerste project en gebouw")}</h1><p>{text("The project, buildings, location tree, client parameters and standard parties are stored before field work starts.", "Project, gebouwen, locatieboom, klantparameters en standaardpartijen worden opgeslagen voordat het veldwerk start.")}</p>
        <form className="access-form setup-form two-columns" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("Project code", "Projectcode")}</span><input {...register("code")} />{errors.code ? <small className="field-error">{errors.code.message}</small> : null}</label>
          <label className="form-field"><span>{text("Project name", "Projectnaam")}</span><input {...register("name")} /></label>
          <label className="form-field"><span>{text("Location", "Locatie")}</span><input {...register("location")} /></label>
          <label className="form-field"><span>{text("Client", "Opdrachtgever")}</span><input {...register("clientName")} /></label>
          <label className="form-field"><span>{text("Building code", "Gebouwcode")}</span><input {...register("buildingCode")} /></label>
          <label className="form-field"><span>{text("Building name", "Gebouwnaam")}</span><input {...register("buildingName")} /></label>
          <label className="form-field wide"><span>{text("Main contractor", "Hoofdaannemer")}</span><input {...register("contractorName")} /></label>
          <details className="optional-text-entry wide" open>
            <summary>{text("Buildings and exact location structure", "Gebouwen en exacte locatiestructuur")}</summary>
            <div className="form-grid two-columns">
              <label className="form-field wide"><span>{text("Additional buildings · CODE|Name · one per line", "Extra gebouwen · CODE|Naam · één per regel")}</span><textarea rows={3} {...register("additionalBuildings")} placeholder={"B2|Building 2\nB3|Building 3"} /></label>
              <label className="form-field wide"><span>{text("Location template · type|code|name|optional parent code", "Locatiesjabloon · type|code|naam|optionele bovenliggende code")}</span><textarea rows={6} {...register("locationLevels")} /><small>{text("Types: zone, floor, room, element or work_package. The template is applied to every building.", "Typen: zone, floor, room, element of work_package. Het sjabloon wordt op ieder gebouw toegepast.")}</small></label>
              <label className="form-field"><span>{text("Required location detail", "Verplicht locatieniveau")}</span><select {...register("requiredLocationDepth")}><option value="building">{text("Building", "Gebouw")}</option><option value="floor">{text("Floor", "Verdieping")}</option><option value="room">{text("Room", "Ruimte")}</option><option value="element">{text("Element", "Element")}</option></select></label>
            </div>
          </details>
          <details className="optional-text-entry wide" open>
            <summary>{text("Daily work parameters", "Dagelijkse werkparameters")}</summary>
            <div className="form-grid two-columns">
              <label className="form-field"><span>{text("Default language", "Standaardtaal")}</span><select {...register("defaultLanguage")}><option value="en">English</option><option value="nl">Nederlands</option></select></label>
              <label className="form-field"><span>{text("Report prefix", "Rapportprefix")}</span><input {...register("reportPrefix")} /></label>
              <label className="form-field"><span>{text("Shift start", "Start werktijd")}</span><input type="time" {...register("shiftStart")} /></label>
              <label className="form-field"><span>{text("Shift end", "Einde werktijd")}</span><input type="time" {...register("shiftEnd")} /></label>
              <label className="form-field wide"><span>{text("Workforce disciplines · one per line", "Workforce-disciplines · één per regel")}</span><textarea rows={9} {...register("disciplines")} /></label>
            </div>
          </details>
          <details className="optional-text-entry wide">
            <summary>{text("Deadlines, notifications and reports", "Deadlines, meldingen en rapporten")}</summary>
            <div className="form-grid two-columns">
              <label className="form-field"><span>{text("Low severity · days", "Lage ernst · dagen")}</span><input type="number" {...register("lowDeadlineDays", { valueAsNumber: true })} /></label>
              <label className="form-field"><span>{text("Medium severity · days", "Middelhoge ernst · dagen")}</span><input type="number" {...register("mediumDeadlineDays", { valueAsNumber: true })} /></label>
              <label className="form-field"><span>{text("High severity · days", "Hoge ernst · dagen")}</span><input type="number" {...register("highDeadlineDays", { valueAsNumber: true })} /></label>
              <label className="form-field"><span>{text("Critical severity · days", "Kritieke ernst · dagen")}</span><input type="number" {...register("criticalDeadlineDays", { valueAsNumber: true })} /></label>
              <label className="form-field"><span>{text("Reminder before deadline · hours", "Herinnering vóór deadline · uur")}</span><input type="number" {...register("notificationLeadHours", { valueAsNumber: true })} /></label>
              <label className="form-field"><span>{text("Report header", "Rapportkop")}</span><input {...register("reportHeader")} /></label>
              <label className="form-field wide"><span>{text("Report footer", "Rapportvoettekst")}</span><input {...register("reportFooter")} /></label>
            </div>
          </details>
          <fieldset className="wide configuration-modules">
            <legend>{text("Active modules for this project", "Actieve modules voor dit project")}</legend>
            {[["enableWorkforce", text("Workforce", "Workforce")], ["enableInspections", text("Inspections", "Inspecties")], ["enableQuality", text("Issues & NCR", "Issues & NCR")], ["enableHse", "HSE"], ["enableDocuments", text("Documents and formal registers", "Documenten en formele registers")], ["enableVisualEvidence", text("Photos, 360° and pointers", "Foto's, 360° en pointers")]].map(([field, label]) => <label className="confirmation-check" key={field}><input type="checkbox" {...register(field as "enableWorkforce" | "enableInspections" | "enableQuality" | "enableHse" | "enableDocuments" | "enableVisualEvidence")} /><span><strong>{label}</strong></span></label>)}
          </fieldset>
          {error ? <p className="access-message error wide" role="alert">{error}</p> : null}
          <button className="primary-button access-submit wide" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}{text("Validate configuration and create project", "Valideer configuratie en maak project")}</button>
        </form>
      </section>
    </div>
  );
}

function ContextSelection({
  projects,
  chooseProject,
  organizationName,
  createProject,
  currentUserName,
  storageStatus,
  isOnline,
  offlineCached,
}: {
  projects: ProjectContext[];
  chooseProject: (project: ProjectContext) => void;
  organizationName: string;
  createProject: (answers: ProjectSetupAnswers) => Promise<boolean>;
  currentUserName: string;
  storageStatus: string;
  isOnline: boolean;
  offlineCached: boolean;
}) {
  const { text } = useLanguage();
  const [showProjectSetup, setShowProjectSetup] = useState(false);
  return (
    <div className="context-shell">
      <header className="context-topbar">
        <div className="context-brand">
          <CompanyLogo subtitle={text("Supervision", "Supervisie")} />
        </div>
        <div className="context-user"><LanguageSwitcher compact /><span className="avatar">{initials(currentUserName)}</span><span><strong>{currentUserName}</strong><small>{text("CODECO user", "CODECO-gebruiker")}</small></span></div>
      </header>

      <main className="context-content">
        <div className={`data-mode-notice ${isOnline ? "connected" : "offline"}`} role="status">
          {isOnline ? <CheckCircle2 size={17} /> : <HardDrive size={17} />}
          <span><strong>{isOnline ? text("Online workspace", "Online werkruimte") : text("Offline field mode", "Offline veldmodus")}</strong> {storageStatus}. {offlineCached ? text("The last synchronized projects and buildings are available; photos and drawings can be queued locally.", "De laatst gesynchroniseerde projecten en gebouwen zijn beschikbaar; foto’s en tekeningen kunnen lokaal worden klaargezet.") : text("Only changes confirmed by Supabase receive the saved status.", "Alleen door Supabase bevestigde wijzigingen krijgen de status opgeslagen.")}</span>
        </div>

        <section className="context-heading">
          <div><p className="eyebrow">{text("My projects", "Mijn projecten")}</p><h1>{text("Where will you work today?", "Waar ga je vandaag werken?")}</h1><p>{text("Select a project to open its dashboard. Every building in the project is available from there.", "Kies een project om het dashboard te openen. Alle gebouwen van het project zijn daar direct beschikbaar.")}</p></div>
          <button className="primary-button portfolio-cta" type="button" onClick={() => setShowProjectSetup(true)}><Plus size={15} /> {text("New configured project", "Nieuw geconfigureerd project")}</button>
        </section>
        {/* No portfolio counters here: this screen only has to answer "which project am I
            working on today?". The numbers live in the project dashboard, in context. */}
        <section className={`project-selection-grid ${projects.length === 1 ? "single-project" : ""}`}>
          {projects.map((project) => (
            <button className="project-selection-card" type="button" onClick={() => chooseProject(project)} key={project.id}>
              <span className="selection-card-top">
                <span className="project-code">{project.code}</span>
              </span>
              <span className="selection-copy">
                <strong><span className="selection-icon"><Building2 size={18} /></span> {project.name}</strong>
                <small><MapPin size={12} /> {project.location}</small>
              </span>
              <span className="selection-meta"><span>{project.buildings.length} {text("buildings", "gebouwen")}</span><span>{project.openIssues} {text("open actions", "open acties")}</span></span>
              <span className="project-register-metrics" aria-label={text("Project register totals", "Totalen projectregisters")}>
                <span><b>{project.issueCount}</b>{text("Issues", "Issues")}</span>
                <span><b>{project.ncrCount}</b>NCR</span>
                <span><b>{project.inspectionCount}</b>{text("Inspections", "Inspecties")}</span>
                <span><b>{project.technicalInstructionCount}</b>TI</span>
                <span><b>{project.changeOrderCount}</b>CO</span>
                <span><b>{project.agreementCount}</b>{text("Agreements", "Afspraken")}</span>
              </span>
              <span className="selection-progress"><span style={{ width: `${project.progress}%` }} /><em>{project.progress}% {text("progress", "voortgang")}</em></span>
              <span className="selection-action">{text("Open dashboard", "Dashboard openen")} <ArrowRight size={14} /></span>
            </button>
          ))}
        </section>
      </main>
      {showProjectSetup ? <ProjectSetupScreen organizationName={organizationName} save={async (answers) => {
        const okay = await createProject(answers);
        if (okay) setShowProjectSetup(false);
        return okay;
      }} signOut={() => undefined} embedded close={() => setShowProjectSetup(false)} /> : null}
    </div>
  );
}

function ProjectStartForm({
  project,
  buildingId,
  buildingName,
  buildings,
  onChangeBuilding,
  defaultShiftStart,
  defaultShiftEnd,
  close,
  save,
  initialAnswers,
}: {
  project: ProjectContext;
  buildingId: string;
  buildingName: string;
  buildings: BuildingOption[];
  onChangeBuilding: (buildingId: string) => void;
  defaultShiftStart: string;
  defaultShiftEnd: string;
  close: () => void;
  save: (answers: ProjectStartAnswers) => void | Promise<void>;
  initialAnswers: ProjectStartAnswers | null;
}) {
  const { language, locale, text } = useLanguage();
  const localizedProjectStartSchema = useMemo(() => createProjectStartSchema(language), [language]);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProjectStartAnswers>({
    resolver: zodResolver(localizedProjectStartSchema),
    mode: "onBlur",
    defaultValues: initialAnswers ?? {
      weatherCondition: "partly_cloudy",
      temperatureC: 31,
      windCondition: "moderate",
      shiftStart: defaultShiftStart,
      shiftEnd: defaultShiftEnd,
      plannedWork: "",
      expectedWorkers: 42,
      inspectionPlanned: "yes",
      highRiskWork: "no",
      concreteWork: "yes",
      workPermit: "not_required",
      drawingStatus: "approved",
      drawingIssueReported: false,
      riskNotes: "",
    },
  });
  const answers = useWatch({ control });
  const [automaticWeather, setAutomaticWeather] = useState<CurrentProjectWeather | null>(null);
  const [weatherLoadState, setWeatherLoadState] = useState<"idle" | "loading" | "ready" | "failed">(
    initialAnswers ? "idle" : "loading",
  );
  const loadAutomaticWeather = useCallback(async () => {
    setWeatherLoadState("loading");
    try {
      const response = await fetch(`/api/weather/current?location=${encodeURIComponent(project.location)}`, {
        cache: "no-store",
      });
      const payload = await response.json() as CurrentProjectWeather | { error?: string };
      if (!response.ok || !("condition" in payload)) {
        throw new Error("weather-unavailable");
      }
      setAutomaticWeather(payload);
      setValue("weatherCondition", payload.condition, { shouldDirty: true, shouldValidate: true });
      setValue("temperatureC", payload.temperatureC, { shouldDirty: true, shouldValidate: true });
      setValue("windCondition", payload.windCondition, { shouldDirty: true, shouldValidate: true });
      setWeatherLoadState("ready");
    } catch {
      setWeatherLoadState("failed");
    }
  }, [project.location, setValue]);

  useEffect(() => {
    if (initialAnswers) return;
    const timer = window.setTimeout(() => void loadAutomaticWeather(), 0);
    return () => window.clearTimeout(timer);
  }, [initialAnswers, loadAutomaticWeather]);

  const automation = getProjectStartAutomation(answers, undefined, language);
  const selectedWork = String(answers.plannedWork ?? "").split("; ").filter(Boolean);
  const toggleWork = (label: string) => {
    const next = selectedWork.includes(label) ? selectedWork.filter((item) => item !== label) : [...selectedWork, label];
    setValue("plannedWork", next.join("; "), { shouldDirty: true, shouldValidate: true });
  };
  const riskOptions = [
    text("Lifting work", "Hijswerk"),
    text("Work at height", "Werk op hoogte"),
    text("Rain or thunder", "Regen of onweer"),
    text("Deliveries and traffic", "Leveringen en verkeer"),
    text("Excavation or groundwater", "Graafwerk of grondwater"),
    text("Electrical work", "Elektrisch werk"),
  ];
  const selectedRisks = String(answers.riskNotes ?? "").split("; ").filter(Boolean);
  const toggleRisk = (label: string) => {
    const next = selectedRisks.includes(label) ? selectedRisks.filter((item) => item !== label) : [...selectedRisks, label];
    setValue("riskNotes", next.join("; "), { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal project-start-modal" role="dialog" aria-modal="true" aria-labelledby="project-start-title">
        <header className="modal-header">
          <div>
            <h2 id="project-start-title">{text("Start the workday", "Werkdag starten")} · {buildingName}</h2>
            <p>{project.code} · {currentDateLabel(locale)}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

      <div className="modal-body project-start-layout">
        <form className="project-start-form" onSubmit={handleSubmit(save)} noValidate>
          <BuildingPicker id="project-start-building" buildings={buildings} value={buildingId} onChange={onChangeBuilding} allowAll />
          <section className="form-section-card">
            <header><span className="form-section-number">1</span><span><strong>{text("Weather and working hours", "Weer en werktijden")}</strong><small>{text("Weather loads automatically from the project location", "Weer laadt automatisch vanuit de projectlocatie")}</small></span></header>
            <div className={`automatic-weather-status ${weatherLoadState}`}>
              <span className="automatic-weather-icon">{weatherLoadState === "loading" ? <Loader2 className="spin" size={18} /> : weatherLoadState === "ready" ? <CheckCircle2 size={18} /> : <CloudSun size={18} />}</span>
              <span>
                <strong>{weatherLoadState === "loading"
                  ? text("Loading current weather…", "Actueel weer laden…")
                  : weatherLoadState === "ready" && automaticWeather
                    ? text(`Automatically loaded · ${automaticWeather.resolvedLocation}`, `Automatisch geladen · ${automaticWeather.resolvedLocation}`)
                    : initialAnswers
                      ? text("Saved weather for this workday", "Opgeslagen weer voor deze werkdag")
                      : text("Automatic source unavailable · check the fields below", "Automatische bron niet beschikbaar · controleer de velden hieronder")}</strong>
                <small>{weatherLoadState === "ready" && automaticWeather
                  ? text(`${automaticWeather.source} · wind ${automaticWeather.windSpeedKph} km/h · humidity ${automaticWeather.relativeHumidityPercent}%`, `${automaticWeather.source} · wind ${automaticWeather.windSpeedKph} km/u · luchtvochtigheid ${automaticWeather.relativeHumidityPercent}%`)
                  : text("The supervisor can always correct the suggested values.", "De supervisor kan de voorgestelde waarden altijd corrigeren.")}</small>
              </span>
              {!initialAnswers ? <button type="button" onClick={() => void loadAutomaticWeather()} disabled={weatherLoadState === "loading"}><RefreshCw size={15} /> {text("Refresh", "Vernieuw")}</button> : null}
            </div>
            <div className="form-grid three-columns">
              <label className="form-field"><span>{text("What is the weather?", "Wat is het weer?")}</span><select {...register("weatherCondition")}><option value="sunny">{text("Sunny", "Zonnig")}</option><option value="partly_cloudy">{text("Partly cloudy", "Licht bewolkt")}</option><option value="cloudy">{text("Cloudy", "Bewolkt")}</option><option value="rain">{text("Rain", "Regen")}</option><option value="heavy_rain">{text("Heavy rain", "Zware regen")}</option></select></label>
              <label className="form-field"><span>{text("Temperature", "Temperatuur")}</span><span className="input-with-unit"><input type="number" {...register("temperatureC", { valueAsNumber: true })} /><em>°C</em></span>{errors.temperatureC ? <small className="field-error">{errors.temperatureC.message}</small> : null}</label>
              <label className="form-field"><span>{text("Wind", "Wind")}</span><select {...register("windCondition")}><option value="calm">{text("Calm", "Kalm")}</option><option value="moderate">{text("Moderate", "Matig")}</option><option value="strong">{text("Strong", "Sterk")}</option></select></label>
              <label className="form-field"><span>{text("Shift start", "Start werktijd")}</span><input type="time" {...register("shiftStart")} />{errors.shiftStart ? <small className="field-error">{errors.shiftStart.message}</small> : null}</label>
              <label className="form-field"><span>{text("Shift end", "Einde werktijd")}</span><input type="time" {...register("shiftEnd")} />{errors.shiftEnd ? <small className="field-error">{errors.shiftEnd.message}</small> : null}</label>
              <div className="form-field"><label htmlFor="expected-workers">{text("Expected workforce", "Verwachte bezetting")}</label><span className="input-with-unit"><input id="expected-workers" type="number" {...register("expectedWorkers", { valueAsNumber: true })} /><em>{text("people", "personen")}</em></span><span className="period-date-presets">{[10, 20, 30, 40, 50].map((count) => <button type="button" onClick={() => setValue("expectedWorkers", count, { shouldDirty: true, shouldValidate: true })} key={count}>{count}</button>)}</span></div>
            </div>
          </section>

          <section className="form-section-card">
            <header><span className="form-section-number">2</span><span><strong>{text("What is planned today?", "Wat staat vandaag gepland?")}</strong><small>{text("This feeds the day plan and suggested modules", "Dit voedt het dagplan en de voorgestelde modules")}</small></span></header>
            <div className="form-grid two-columns">
              <div className="work-option-grid wide" aria-label={text("Choose planned work", "Kies geplande werkzaamheden")}>{constructionWorkOptions.map((option) => { const label = language === "en" ? option.en : option.nl; const active = selectedWork.includes(label); return <button className={active ? "active" : ""} type="button" aria-pressed={active} onClick={() => toggleWork(label)} key={option.en}>{active ? <Check size={14} /> : <Plus size={14} />}{label}</button>; })}</div>
              {errors.plannedWork ? <small className="field-error wide">{errors.plannedWork.message}</small> : null}
              <details className="optional-text-entry wide">
                <summary>{text("Other planned work · optional", "Andere werkzaamheden · optioneel")}</summary>
                <label className="form-field"><span>{text("Only add work that is not listed above", "Voeg alleen werk toe dat hierboven niet staat")}</span><textarea rows={3} {...register("plannedWork")} /><DictateButton onText={(transcript) => setValue("plannedWork", appendDictation(getValues("plannedWork") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label>
              </details>
              <label className="form-field"><span>{text("Inspection planned?", "Inspectie gepland?")}</span><select {...register("inspectionPlanned")}><option value="yes">{text("Yes", "Ja")}</option><option value="no">{text("No", "Nee")}</option></select></label>
              <label className="form-field"><span>{text("Concrete work planned?", "Betonwerk gepland?")}</span><select {...register("concreteWork")}><option value="yes">{text("Yes", "Ja")}</option><option value="no">{text("No", "Nee")}</option></select></label>
              <label className="form-field"><span>{text("High-risk work?", "Hoog-risicowerk?")}</span><select {...register("highRiskWork")}><option value="no">{text("No", "Nee")}</option><option value="yes">{text("Yes", "Ja")}</option></select></label>
              <label className="form-field"><span>{text("Work permit", "Werkvergunning")}</span><select {...register("workPermit")}><option value="available">{text("Available", "Aanwezig")}</option><option value="not_required">{text("Not required", "Niet vereist")}</option><option value="missing">{text("Missing", "Ontbreekt")}</option></select></label>
            </div>
          </section>

          <section className="form-section-card">
            <header><span className="form-section-number">3</span><span><strong>{text("Documents and expected risks", "Documenten en verwachte risico’s")}</strong><small>{text("The app warns; the supervisor remains the decision maker", "De app waarschuwt; de supervisor blijft beslissen")}</small></span></header>
            <div className="form-grid two-columns">
              <label className="form-field"><span>{text("Approved working drawing", "Goedgekeurde werktekening")}</span><select {...register("drawingStatus")}><option value="approved">{text("Current revision available", "Actuele revisie aanwezig")}</option><option value="not_required">{text("Not required", "Niet vereist")}</option><option value="missing">{text("Missing / uncertain", "Ontbreekt / onzeker")}</option></select></label>
              <div className="quick-issue-presets wide" aria-label={text("Choose expected risks", "Kies verwachte risico's")}>{riskOptions.map((option) => <button className={selectedRisks.includes(option) ? "active" : ""} type="button" aria-pressed={selectedRisks.includes(option)} onClick={() => toggleRisk(option)} key={option}>{option}</button>)}</div>
              <details className="optional-text-entry wide">
                <summary>{text("Other risk · optional", "Ander risico · optioneel")}</summary>
                <label className="form-field"><span>{text("Only add an exceptional project-specific risk", "Voeg alleen een uitzonderlijk projectspecifiek risico toe")}</span><textarea rows={3} {...register("riskNotes")} /><DictateButton onText={(transcript) => setValue("riskNotes", appendDictation(getValues("riskNotes") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label>
              </details>
              {answers.drawingStatus === "missing" ? (
                <label className="confirmation-check wide"><input type="checkbox" {...register("drawingIssueReported")} /><span><strong>{text("Missing drawing was reported", "Ontbrekende tekening is gemeld")}</strong><small>{text("Human confirmation is required before the workday opens.", "Menselijke bevestiging vereist voordat de werkdag wordt geopend.")}</small>{errors.drawingIssueReported ? <em className="field-error">{errors.drawingIssueReported.message}</em> : null}</span></label>
              ) : null}
            </div>
          </section>

          <div className="project-start-submit">
            <span><ShieldCheck size={15} /> {text("Saving completes only after confirmation by Supabase.", "Opslaan is pas voltooid na bevestiging door Supabase.")}</span>
            <button className="primary-button" type="submit">{text("Start daily report centrally", "Dagrapport centraal starten")} <ArrowRight size={15} /></button>
          </div>
        </form>

        <aside className="automation-panel">
          <header><span className="automation-panel-icon"><Settings size={19} /></span><span><strong>{text("Visible automation", "Zichtbare automatisering")}</strong><small>{automation.length} {text("fixed rules active", "vaste regels actief")}</small></span></header>
              <p className="automation-intro">{text("Every action comes from a fixed project rule and remains under supervisor control.", "Iedere actie komt uit een vaste projectregel en blijft door de supervisor controleerbaar.")}</p>
          <div className="automation-rule-list">
            {automation.map((rule) => (
              <article className={`automation-rule ${rule.tone}`} key={rule.id}>
                <span className="automation-rule-state">{rule.tone === "critical" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}</span>
                <span><strong>{rule.title}</strong><p>{rule.action}</p><small>{text("Triggered by", "Geactiveerd door")}: {rule.source} · {rule.id}</small></span>
              </article>
            ))}
          </div>
        </aside>
      </div>
      </section>
    </div>
  );
}

function TodayView({
  entries,
  completeness,
  completedTodos,
  toggleTodo,
  openReport,
  showCritical,
  projectName,
  projectLocation,
  buildingName,
  attendanceTotal,
  projectStartAnswers,
  dailyCloseoutAnswers,
  openProjectStart,
  openDailyQuestions,
  openQuickAdd,
  openOneTapLog,
  openActions,
  openWorkspace,
  openSettings,
  canManageMembers,
  currentUserName,
  now,
  reportNumber,
  actions,
  buildings,
  startChecks,
  closeouts,
  onStartBuilding,
  onCloseoutBuilding,
}: {
  entries: TimelineEntry[];
  completeness: number;
  completedTodos: number[];
  toggleTodo: (id: number) => void;
  openReport: () => void;
  showCritical: () => void;
  projectName: string;
  projectLocation: string;
  buildingName: string;
  attendanceTotal: number;
  projectStartAnswers: ProjectStartAnswers | null;
  dailyCloseoutAnswers: DailyCloseoutAnswers | null;
  openProjectStart: () => void;
  openDailyQuestions: () => void;
  openQuickAdd: () => void;
  openOneTapLog: () => void;
  openActions: () => void;
  openWorkspace: () => void;
  openSettings: () => void;
  canManageMembers: boolean;
  currentUserName: string;
  now: Date;
  reportNumber: string;
  actions: ProjectAction[];
  buildings: BuildingContext[];
  startChecks: Array<Record<string, unknown>>;
  closeouts: Array<Record<string, unknown>>;
  onStartBuilding: (building: BuildingContext) => void;
  onCloseoutBuilding: (building: BuildingContext) => void;
}) {
  const { language, locale, text } = useLanguage();
  const todos = [
    { id: 1, title: text("Confirm weather and working hours", "Weer en werktijden bevestigen"), detail: projectStartAnswers ? text("Recorded centrally", "Centraal vastgelegd") : text("Project start required", "Projectstart vereist"), flag: "" },
    { id: 2, title: text("Confirm quality and HSE", "Kwaliteit en HSE bevestigen"), detail: dailyCloseoutAnswers ? text("Recorded centrally", "Centraal vastgelegd") : text("Daily questions required", "Dagvragen vereist"), flag: "red" },
    { id: 3, title: text("Complete tomorrow's plan", "Planning voor morgen invullen"), detail: dailyCloseoutAnswers ? text("Recorded centrally", "Centraal vastgelegd") : text("Before daily closeout", "Voor dagafsluiting"), flag: "" },
  ];
  const automation = projectStartAnswers ? getProjectStartAutomation(projectStartAnswers, undefined, language) : [];
  const criticalEntry = entries.find((entry) => entry.badgeTone === "red");
  const inspectionCount = entries.filter((entry) => entry.kind === "inspection").length;
  const progress = dailyCloseoutAnswers?.progressPercent ?? 0;
  const openTodoCount = todos.filter((todo) => !completedTodos.includes(todo.id)).length;
  const weatherLabel = projectStartAnswers
    ? `${projectStartAnswers.temperatureC}°C · ${({ sunny: text("Sunny", "Zonnig"), partly_cloudy: text("Partly cloudy", "Licht bewolkt"), cloudy: text("Cloudy", "Bewolkt"), rain: text("Rain", "Regen"), heavy_rain: text("Heavy rain", "Zware regen") })[projectStartAnswers.weatherCondition]}`
    : text("Weather not confirmed", "Weer nog niet bevestigd");

  if (process.env.NEXT_PUBLIC_SUPERVISION_DASHBOARD !== "legacy") {
    return (
      <ClientDashboard
        entries={entries}
        actions={actions}
        projectName={projectName}
        projectLocation={projectLocation}
        buildingName={buildingName}
        buildingCount={buildings.length}
        weather={projectStartAnswers ? { temperatureC: projectStartAnswers.temperatureC, weatherCondition: projectStartAnswers.weatherCondition } : null}
        openQuickAdd={openQuickAdd}
        openActions={openActions}
        openWorkspace={openWorkspace}
        openDailyQuestions={openDailyQuestions}
      />
    );
  }

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">{currentDateLabel(locale, now)} · {currentTime(locale, now)}</p>
          <h1>{greetingForSuriname(language, now)}, {currentUserName}.</h1>
          <p>{text("This requires your attention today at", "Dit vraagt vandaag je aandacht bij")} {projectName} · {buildingName}.</p>
        </div>
        <div className="page-intro-actions">
          <div className="weather-chip">
            <span className="weather-icon"><CloudSun size={20} /></span>
            <span className="weather-copy">
              <strong>{weatherLabel}</strong>
              <span>{text("Confirmed manually at Project start", "Handmatig bevestigd bij Projectstart")}</span>
            </span>
            <ChevronRight size={15} color="#718995" />
          </div>
          {!projectStartAnswers ? <button className="primary-button day-questions-button" type="button" onClick={openProjectStart}><CloudSun size={15} /> {text("Start today", "Werkdag starten")}</button> : <button className="primary-button day-questions-button" type="button" onClick={openDailyQuestions}><ClipboardCheck size={15} /> {text("Complete daily questions", "Dagvragen invullen")}</button>}
        </div>
      </section>

      <section className="overview-shortcuts" aria-label={text("Quick routes", "Directe routes")}>
        <button className="overview-shortcut primary" type="button" onClick={openQuickAdd}><span><Camera size={18} /></span><strong>{text("Take a photo", "Foto maken")}</strong><small>{text("Project, building, time and folder automatic", "Project, gebouw, tijd en map automatisch")}</small><ArrowRight size={16} /></button>
        {/* One route, one meaning: the day's log in the client's own report format. */}
        <button className="overview-shortcut" type="button" onClick={openOneTapLog}><span><ClipboardCheck size={18} /></span><strong>{text("Daily log", "Daglog")}</strong><small>{text("Today's log in your own report format", "De dag van vandaag in je eigen rapportformaat")}</small><ArrowRight size={16} /></button>
        <button className="overview-shortcut mobile-redundant" type="button" onClick={openActions}><span><ClipboardCheck size={18} /></span><strong>{text("Open actions", "Acties openen")}</strong><small>{text(`${actions.filter((action) => action.status !== "verified" && action.status !== "cancelled").length} require follow-up`, `${actions.filter((action) => action.status !== "verified" && action.status !== "cancelled").length} vragen opvolging`)}</small><ArrowRight size={16} /></button>
        <button className="overview-shortcut mobile-redundant" type="button" onClick={canManageMembers ? openSettings : openWorkspace}><span>{canManageMembers ? <Settings size={18} /> : <LayoutDashboard size={18} />}</span><strong>{canManageMembers ? text("Manage workspace", "Werkruimte beheren") : text("Open project workspace", "Projectwerkruimte openen")}</strong><small>{canManageMembers ? text("Users, rules and project structure", "Gebruikers, regels en projectstructuur") : text("Inspections, findings and files", "Inspecties, bevindingen en bestanden")}</small><ArrowRight size={16} /></button>
      </section>

      <section className="day-hero" aria-label={text("Today's status", "Status van vandaag")}>
        <article className="report-card">
          <div className="report-copy">
            <div className="status-kicker"><span className="live-dot" /> {text("Report in progress", "Rapport in uitvoering")}</div>
            <h2>{text("Daily report", "Dagrapport")} {reportNumber}</h2>
            <p>{text("Data from all buildings is automatically brought together in this project report.", "Gegevens uit alle gebouwen worden automatisch in dit projectrapport samengebracht.")}</p>
            <button className="inline-button" type="button" onClick={openReport}>
              {text("View report status", "Rapportstatus bekijken")} <ArrowRight size={14} />
            </button>
          </div>
          <div className="progress-ring" style={{ background: `conic-gradient(var(--signal) 0 ${completeness}%, rgba(255,255,255,.11) ${completeness}% 100%)` }}>
            <span className="progress-value"><strong>{completeness}%</strong><span>{text("complete", "compleet")}</span></span>
          </div>
        </article>

        <article className={`critical-card ${criticalEntry ? "" : "clear"}`}>
          <div>
            <div className="critical-top">
              <span className="critical-icon">{criticalEntry ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</span>
              <span className="critical-badge">{criticalEntry ? text("Critical", "Kritiek") : text("No critical record", "Geen kritieke registratie")}</span>
            </div>
            <h3>{criticalEntry?.title ?? text("No immediate blocker recorded", "Geen directe blokkade geregistreerd")}</h3>
            <p>{criticalEntry?.detail ?? text("New critical records appear here immediately.", "Nieuwe kritieke registraties worden hier direct zichtbaar.")}</p>
          </div>
          <button className="text-link" type="button" onClick={showCritical}>{text("Open central action list", "Open centrale actielijst")} <ArrowRight size={13} /></button>
        </article>
      </section>

      {buildings.length > 1 ? (
        <section className="panel" aria-label={text("Buildings in this report", "Gebouwen in dit rapport")}>
          <header className="panel-header">
            <div className="section-heading">
              <h2>{text("Buildings in today's report", "Gebouwen in het rapport van vandaag")}</h2>
              <p>{text("One project-wide report, complete once every building below has its own start check and closeout.", "Eén projectbreed rapport, compleet zodra elk gebouw hieronder een eigen projectstart en dagafsluiting heeft.")}</p>
            </div>
          </header>
          <div className="todo-list">
            {buildings.map((building) => {
              const startDone = startChecks.some((row) => row.building_id === building.id);
              const closeoutDone = closeouts.some((row) => row.building_id === building.id);
              return (
                <div className="todo-row" key={building.id}>
                  <span className={`todo-check ${startDone && closeoutDone ? "done" : ""}`}><Check size={14} /></span>
                  <span className="todo-copy">
                    <strong>{building.name}</strong>
                    <span>{startDone ? text("Start done", "Start gereed") : text("Start missing", "Start ontbreekt")} · {closeoutDone ? text("Closeout done", "Afsluiting gereed") : text("Closeout missing", "Afsluiting ontbreekt")}</span>
                  </span>
                  <span className="todo-row-actions">
                    {!startDone ? <button className="text-link" type="button" onClick={() => onStartBuilding(building)}>{text("Start check", "Start")}</button> : null}
                    {startDone && !closeoutDone ? <button className="text-link" type="button" onClick={() => onCloseoutBuilding(building)}>{text("Closeout", "Afsluiting")}</button> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={`questionnaire-strip ${dailyCloseoutAnswers ? "complete" : ""}`} aria-label={text("Daily questions and automation", "Dagvragen en automatisering")}>
        <div className="questionnaire-main">
          <span className="questionnaire-icon"><FileCheck2 size={21} /></span>
          <span className="questionnaire-copy">
            <span className="status-kicker">{text("Client format", "Klantformat")} · {clientReportSections.length} {text("report sections", "rapportonderdelen")}</span>
            <strong>{dailyCloseoutAnswers ? text("Daily questions confirmed", "Dagvragen bevestigd") : text("How did the project go today?", "Hoe is het project vandaag gegaan?")}</strong>
            <p>{text("Four short question groups feed the right modules: progress, quality/HSE, logistics and tomorrow's plan.", "Vier korte vraaggroepen vullen de juiste modules: verloop, kwaliteit/HSE, logistiek en planning morgen.")}</p>
          </span>
        </div>
        <div className="questionnaire-automation">
          {automation.slice(0, 3).map((rule) => <span className={`rule-chip ${rule.tone}`} title={`${text("Triggered by", "Geactiveerd door")}: ${rule.source}`} key={rule.id}>{rule.title}</span>)}
        </div>
        <div className="questionnaire-progress"><strong>{dailyCloseoutAnswers ? "4/4" : "1/4"}</strong><span>{text("question groups", "vraaggroepen")}</span></div>
        <button className={dailyCloseoutAnswers ? "ghost-button" : "primary-button"} type="button" onClick={openDailyQuestions}>{dailyCloseoutAnswers ? text("View answers", "Antwoorden bekijken") : text("Start questions", "Vragen starten")} <ArrowRight size={14} /></button>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <header className="panel-header">
            <div className="section-heading">
              <h2>{text("Today's timeline", "Tijdlijn vandaag")}</h2>
              <p>{entries.length} {text("records · updated in real time", "registraties · realtime bijgewerkt")}</p>
            </div>
          </header>
          <div className="timeline">
            {entries.map((entry) => {
              const Icon = entryIcons[entry.kind];
              return (
                <article className="timeline-row" key={entry.id}>
                  <time className="timeline-time">{entry.time}</time>
                  <span className={`timeline-icon ${entry.kind}`}><Icon size={16} /></span>
                  <div className="timeline-copy">
                    <strong>{entry.title}</strong>
                    <p>{entry.detail}</p>
                    <div className="timeline-meta">
                      <span><MapPin size={10} /> {entry.location}</span>
                      <span><Users size={10} /> {entry.person}</span>
                    </div>
                  </div>
                  <span className={`timeline-badge ${entry.badgeTone ?? ""}`}>{entry.badge}</span>
                </article>
              );
            })}
          </div>
        </article>

        <aside className="right-column">
          <article className="panel">
            <header className="panel-header">
              <div className="section-heading"><h2>{text("At a glance", "In één oogopslag")}</h2><p>{text("Updated centrally", "Centraal bijgewerkt")}</p></div>
            </header>
            <div className="metrics-grid">
              <Metric icon={Users} value={String(attendanceTotal)} label={text("people present", "mensen aanwezig")} suffix="" />
              <Metric icon={Gauge} value={String(progress)} label={text("project progress", "projectvoortgang")} suffix="%" />
              <Metric icon={ClipboardCheck} value={String(inspectionCount)} label={text("inspections today", "inspecties vandaag")} suffix="" />
              <Metric icon={CheckCircle2} value={String(actions.length)} label={text("actions", "acties")} suffix="" />
            </div>
          </article>

          <article className="panel">
            <header className="panel-header">
              <div className="section-heading"><h2>{text("Still to do", "Nog te doen")}</h2><p>{text("Before finalizing the report", "Voor je het rapport afrondt")}</p></div>
              <span className="status-badge" style={{ padding: "5px 8px", background: "var(--yellow-soft)", color: "var(--yellow)" }}>{openTodoCount} {text("open", "open")}</span>
            </header>
            <div className="todo-list">
              {todos.map((todo) => {
                const done = completedTodos.includes(todo.id);
                return (
                  <div className="todo-row" key={todo.id}>
                    <button className={`todo-check ${done ? "done" : ""}`} type="button" onClick={() => toggleTodo(todo.id)} aria-label={`${todo.title} ${done ? text("reopen", "heropenen") : text("complete", "afronden")}`}>
                      <Check size={14} />
                    </button>
                    <span className="todo-copy"><strong>{todo.title}</strong><span>{done ? text("Completed", "Afgerond") : todo.detail}</span></span>
                    {!done ? <span className={`todo-flag ${todo.flag}`} /> : null}
                  </div>
                );
              })}
            </div>
          </article>
        </aside>
      </section>

      <section className="report-control-bar">
        <div className="report-control-copy">
          <span className="report-control-icon"><FileCheck2 size={19} /></span>
          <span><strong>{text("Ready for the final check?", "Klaar voor de eindcontrole?")}</strong><span>{text("The app checks required data and compiles the summary.", "De app controleert verplichte gegevens en stelt de samenvatting samen.")}</span></span>
        </div>
        <button className="primary-button" type="button" onClick={openReport}>{text("Check report", "Rapport controleren")} <ArrowRight size={14} /></button>
      </section>
    </>
  );
}

function Metric({ icon: Icon, value, suffix, label }: { icon: LucideIcon; value: string; suffix: string; label: string }) {
  return (
    <div className="metric-card">
      <span className="metric-icon"><Icon size={15} /></span>
      <span className="metric-value"><strong>{value}</strong><span>{suffix}</span></span>
      <span>{label}</span>
    </div>
  );
}

function SecondaryView({
  activeNav,
  openQuickAdd,
  navigate,
  projectName,
  buildingName,
  attendanceTotal,
  openAttendance,
  entries,
  actions,
  actionUpdates,
  locationNodes,
  openAction,
  openActionCreate,
  openProjectTab,
  reportNumber,
  reportStatus,
  canManageMembers,
  openUserAdmin,
}: {
  activeNav: NavKey;
  openQuickAdd: () => void;
  navigate: (next: NavKey) => void;
  projectName: string;
  buildingName: string;
  attendanceTotal: number;
  openAttendance: () => void;
  entries: TimelineEntry[];
  actions: ProjectAction[];
  actionUpdates: ActionUpdate[];
  locationNodes: ProjectLocationOption[];
  openAction: (action: ProjectAction) => void;
  openActionCreate: () => void;
  openProjectTab: (tab: "registers" | "findings" | "drawings") => void;
  reportNumber: string;
  reportStatus: string;
  canManageMembers: boolean;
  openUserAdmin: () => void;
}) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? actionStatusLabelsEnglish : actionStatusLabels;
  const [actionFilter, setActionFilter] = useState<"open" | "urgent" | "completed" | "all">("open");
  if (activeNav === "project") {
    const registrationsByKind = (kind: EntryKind) => entries.filter((entry) => entry.kind === kind).length;
    const modules = [
      { title: text("Attendance", "Aanwezigheid"), copy: text("Parties, disciplines, headcounts and shifts", "Partijen, disciplines, aantallen en diensten"), icon: Users, count: `${attendanceTotal} ${text("today", "vandaag")}`, action: openAttendance },
      { title: text("Activities", "Activiteiten"), copy: text("Work packages, planning and progress", "Werkpakketten, planning en voortgang"), icon: Wrench, count: `${registrationsByKind("activity")} ${text("today", "vandaag")}`, action: openQuickAdd },
      { title: text("Inspections", "Inspecties"), copy: text("Planned, completed and re-inspections", "Gepland, uitgevoerd en herinspecties"), icon: ClipboardCheck, count: `${registrationsByKind("inspection")} ${text("today", "vandaag")}`, action: openQuickAdd },
      { title: text("Findings", "Bevindingen"), copy: text("Quality, NCR and repair verification", "Kwaliteit, NCR en herstelverificatie"), icon: AlertTriangle, count: `${registrationsByKind("finding")} ${text("today", "vandaag")}`, action: () => navigate("acties") },
      { title: text("Actions", "Acties"), copy: text("Assignment, deadlines and verification", "Toewijzing, deadlines en verificatie"), icon: ShieldCheck, count: `${actions.length} ${text("central", "centraal")}`, action: () => navigate("acties") },
      { title: text("Photos", "Foto’s"), copy: text("Evidence, locations and links", "Bewijs, locaties en koppelingen"), icon: Image, count: `${registrationsByKind("photo")} ${text("today", "vandaag")}`, action: openQuickAdd },
    ];
    return (
      <>
        <header className="secondary-header">
          <div><p className="eyebrow">{projectName}</p><h1>{text("Project overview", "Projectoverzicht")}</h1><p>{text("Registers and operational modules for", "Registers en operationele modules voor")} {buildingName}.</p></div>
          <button className="primary-button" type="button" onClick={openQuickAdd}><Plus size={15} /> {text("New record", "Nieuwe registratie")}</button>
        </header>
        <section className="secondary-grid">
          {modules.map((item) => {
            const Icon = item.icon;
            return (
              <button className="module-card" type="button" key={item.title} onClick={item.action} style={{ textAlign: "left", cursor: "pointer" }}>
                <span className="module-card-top"><span className="module-card-icon"><Icon size={19} /></span><span className="module-count">{item.count}</span></span>
                <h2>{item.title}</h2><p>{item.copy}</p>
              </button>
            );
          })}
        </section>
      </>
    );
  }

  if (activeNav === "acties") {
    const openActions = actions.filter((action) => action.status !== "verified" && action.status !== "cancelled");
    const urgentActions = openActions.filter((action) => action.priority === "high" || action.priority === "critical");
    const completedActions = actions.filter((action) => action.status === "verified" || action.status === "cancelled");
    const visibleActions = actionFilter === "urgent" ? urgentActions : actionFilter === "completed" ? completedActions : actionFilter === "all" ? actions : openActions;
    return (
      <>
        <header className="secondary-header">
          <div><p className="eyebrow">{actions.length} {text("centrally recorded", "centraal geregistreerd")}</p><h1>{text("Actions", "Acties")}</h1><p>{text("Personal and assigned follow-up in one list.", "Persoonlijke en toegewezen opvolging in één lijst.")}</p></div>
          <button className="primary-button" type="button" onClick={openActionCreate}><Plus size={15} /> {text("Add action", "Actie toevoegen")}</button>
        </header>
        <nav className="action-record-shortcuts" aria-label={text("Open work and document records", "Openstaande werk- en documentregistraties")}>
          <button type="button" onClick={() => openProjectTab("registers")}><FileCheck2 size={16} /><span><strong>WCR</strong><small>{text("Work completion requests", "Werkcontroleverzoeken")}</small></span></button>
          <button type="button" onClick={() => openProjectTab("registers")}><MessageSquareText size={16} /><span><strong>RFI</strong><small>{text("Information requests", "Informatieverzoeken")}</small></span></button>
          <button type="button" onClick={() => openProjectTab("registers")}><PackageCheck size={16} /><span><strong>RFA</strong><small>{text("Approval requests", "Goedkeuringsverzoeken")}</small></span></button>
          <button type="button" onClick={() => openProjectTab("registers")}><ClipboardCheck size={16} /><span><strong>WIR</strong><small>{text("Inspection requests", "Inspectieverzoeken")}</small></span></button>
          <button type="button" onClick={() => openProjectTab("findings")}><AlertTriangle size={16} /><span><strong>{text("Issues / NCR", "Issues / NCR")}</strong><small>{text("Open findings", "Open bevindingen")}</small></span></button>
          <button type="button" onClick={() => openProjectTab("findings")}><CheckCircle2 size={16} /><span><strong>Punchlist</strong><small>{text("Ready for review", "Gereed voor review")}</small></span></button>
          <button type="button" onClick={() => openProjectTab("drawings")}><MapPin size={16} /><span><strong>{text("Floor plan", "Plattegrond")}</strong><small>{text("All linked pins", "Alle gekoppelde pins")}</small></span></button>
        </nav>
        <section className="action-overview" aria-label={text("Action summary", "Actieoverzicht")}><button className={actionFilter === "open" ? "active" : ""} type="button" onClick={() => setActionFilter("open")}><strong>{openActions.length}</strong><span>{text("Open", "Open")}</span></button><button className={actionFilter === "urgent" ? "active urgent" : "urgent"} type="button" onClick={() => setActionFilter("urgent")}><strong>{urgentActions.length}</strong><span>{text("Urgent", "Urgent")}</span></button><button className={actionFilter === "completed" ? "active" : ""} type="button" onClick={() => setActionFilter("completed")}><strong>{completedActions.length}</strong><span>{text("Completed", "Afgerond")}</span></button><button className={actionFilter === "all" ? "active" : ""} type="button" onClick={() => setActionFilter("all")}><strong>{actions.length}</strong><span>{text("All", "Alles")}</span></button></section>
        <section className="actions-list">
          {visibleActions.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{actionFilter === "urgent" ? text("Nothing urgent", "Niets urgent") : actionFilter === "completed" ? text("No completed actions", "Nog geen afgeronde acties") : text("No open actions", "Geen open acties")}</strong><span>{text("Choose another filter or create a new action.", "Kies een ander filter of maak een nieuwe actie aan.")}</span></div> : null}
          {visibleActions.map((action) => {
            const dueAt = action.due_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(action.due_at)) : text("No deadline", "Geen deadline");
            const latestUpdate = actionUpdates.find((update) => update.action_id === action.id);
            return (
            <button className="action-row" type="button" key={action.id} onClick={() => openAction(action)} style={{ textAlign: "left", cursor: "pointer" }}>
              <span className="action-icon"><CheckCircle2 size={18} /></span>
              <span className="action-copy"><strong>{action.title}</strong><span>{dueAt} · {action.action_number}{action.location_node_id ? ` · ${locationBreadcrumb(locationNodes, action.location_node_id)}` : ""}{latestUpdate ? ` · ${latestUpdate.message}` : ""}</span></span>
              <span className={`task-status ${action.priority === "critical" ? "red" : action.status === "verified" ? "green" : ""}`}>{statusLabels[action.status]}</span>
            </button>
          );})}
        </section>
      </>
    );
  }

  if (activeNav === "rapporten") {
    return (
      <>
        <header className="secondary-header"><div><p className="eyebrow">{text("Daily reports", "Dagrapporten")}</p><h1>{text("Report history", "Rapporthistorie")}</h1><p>{text("Drafts, versions, reviews and distribution history.", "Concepten, versies, reviews en verzendhistorie.")}</p></div></header>
        <section className="actions-list">
          <button className="action-row" type="button" style={{ textAlign: "left", cursor: "pointer" }}>
              <span className="action-icon" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><FileText size={18} /></span>
              <span className="action-copy"><strong>{reportNumber} · {text("Today", "Vandaag")}</strong><span>{projectName} · {text("all buildings", "alle gebouwen")}</span></span>
              <span className={`task-status ${reportStatus === "approved" ? "green" : ""}`}>{reportStatus.replaceAll("_", " ")}</span>
          </button>
        </section>
      </>
    );
  }

  const settings = [
    { title: text("Reports", "Rapporten"), copy: text("History, revisions and distribution", "Historie, revisies en distributie"), icon: FileText, action: () => navigate("rapporten") },
    { title: "Dashboard", copy: text("KPIs, trends and source data", "KPI’s, trends en brongegevens"), icon: Gauge },
    { title: text("Tomorrow's plan", "Planning morgen"), copy: text("Activities, risks and inspections", "Activiteiten, risico’s en inspecties"), icon: CalendarDays },
    { title: text("Project settings", "Projectinstellingen"), copy: text("Locations, parties and configuration", "Locaties, partijen en configuratie"), icon: Settings },
    ...(canManageMembers ? [{ title: text("Users and access", "Gebruikers en toegang"), copy: text("Invite employees or external parties and assign roles", "Medewerkers of externe partijen uitnodigen en rollen toewijzen"), icon: Users, action: openUserAdmin }] : []),
  ];
  return (
    <>
      <header className="secondary-header"><div><p className="eyebrow">{text("Workspace", "Werkruimte")}</p><h1>{text("More", "Meer")}</h1><p>{text("Reporting, planning and project management.", "Rapportage, planning en projectbeheer.")}</p></div></header>
      <section className="settings-list">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <button className="settings-row" type="button" key={item.title} onClick={item.action}>
              <span className="module-card-icon"><Icon size={18} /></span>
              <span style={{ textAlign: "left" }}><strong>{item.title}</strong><span>{item.copy}</span></span>
              <ChevronRight size={16} color="#718995" />
            </button>
          );
        })}
      </section>
    </>
  );

}

function NotificationsModal({ client, notifications, loading, close, markRead }: { client: SupabaseClient; notifications: ProjectNotification[]; loading: boolean; close: () => void; markRead: (notificationId: string) => Promise<void> }) {
  const { locale, text } = useLanguage();
  const [pushState, setPushState] = useState<PushState>("inactive");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  useEffect(() => { void currentPushState().then(setPushState); }, []);
  const activatePush = async () => {
    setPushBusy(true);
    setPushError("");
    try {
      await enablePushNotifications(client);
      setPushState("active");
    } catch (error) {
      setPushError(error instanceof Error ? error.message : text("Push activation failed.", "Push activeren is mislukt."));
      setPushState(await currentPushState());
    } finally {
      setPushBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal notifications-modal" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
        <header className="modal-header"><div><h2 id="notifications-title">{text("Push notifications and deadlines", "Pushmeldingen en deadlines")}</h2><p>{text("Automatic device notifications from actions, findings and report reviews, with an auditable copy in this inbox.", "Automatische apparaatmeldingen uit acties, bevindingen en rapportreviews, met een auditeerbare kopie in deze inbox.")}</p></div><button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button></header>
        <div className="modal-body notification-list">
          <div className={`push-activation ${pushState}`}>
            {pushState === "ios-add-to-home-screen" ? <Share size={19} /> : <Bell size={19} />}
            <span>
              <strong>
                {pushState === "active" ? text("Push is active on this device", "Push is actief op dit apparaat")
                  : pushState === "blocked" ? text("Push is blocked in browser settings", "Push is geblokkeerd in de browserinstellingen")
                  : pushState === "not-configured" ? text("Push is not configured for this deployment yet", "Push is nog niet geconfigureerd voor deze omgeving")
                  : pushState === "ios-add-to-home-screen" ? text("Add this app to your Home Screen first", "Voeg deze app eerst toe aan je beginscherm")
                  : pushState === "unsupported" ? text("This browser does not support push", "Deze browser ondersteunt geen push")
                  : text("Activate push on this device", "Activeer push op dit apparaat")}
              </strong>
              <small>
                {pushState === "active" ? text("Use Test push to verify the complete browser, subscription and delivery chain.", "Gebruik Test push om de volledige browser-, registratie- en afleverketen te controleren.")
                  : pushState === "not-configured" ? text("An administrator still needs to add the VAPID keys (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) to the deployment. Nobody can activate push until that's done.", "Een beheerder moet de VAPID-sleutels (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) nog toevoegen aan de omgeving. Niemand kan push activeren zolang dat niet is gebeurd.")
                  : pushState === "ios-add-to-home-screen" ? text("iPhone and iPad only support push for apps opened from the Home Screen. Tap Share, then \"Add to Home Screen\", and open the app from there to activate push.", "iPhone en iPad ondersteunen push alleen voor apps die vanaf het beginscherm zijn geopend. Tik op Delen, dan op \"Zet op beginscherm\", en open de app van daaruit om push te activeren.")
                  : pushState === "inactive" ? text("If Activate fails on a Chromium browser (Brave, Chrome, Edge), check that the browser isn't blocking Google push services: Brave disables this by default under Settings → Privacy and security → Use Google services for push messaging.", "Als Activeren mislukt in een Chromium-browser (Brave, Chrome, Edge), controleer dan of de browser Google-pushservices niet blokkeert: Brave zet dit standaard uit onder Instellingen → Privacy en beveiliging → Google-services gebruiken voor pushmeldingen.")
                  : text("Deadlines are generated automatically from fixed project rules.", "Deadlines worden automatisch uit vaste projectregels gegenereerd.")}
              </small>
            </span>
            {pushState === "inactive" || pushState === "active" ? <button className={pushState === "active" ? "secondary-button" : "primary-button"} type="button" disabled={pushBusy} onClick={() => void activatePush()}>{pushBusy ? <Loader2 className="spin" size={15} /> : <Bell size={15} />}{pushState === "active" ? text("Test push", "Test push") : text("Activate", "Activeren")}</button> : null}
          </div>
          {pushError ? <div className="operation-alert error">{pushError}</div> : null}
          {loading ? <div className="empty-list-state"><Loader2 className="spin" size={22} /><strong>{text("Loading notifications", "Meldingen laden")}</strong><span>{text("Deadlines are checked using fixed rules.", "Deadlines worden regelgestuurd gecontroleerd.")}</span></div> : null}
          {!loading && notifications.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No notifications", "Geen meldingen")}</strong><span>{text("There are no open personal reminders.", "Er zijn geen openstaande persoonlijke herinneringen.")}</span></div> : null}
          {notifications.map((notification) => (
            <button className={`notification-row ${notification.read_at ? "read" : ""}`} type="button" key={notification.id} onClick={() => void markRead(notification.id)}>
              <span className="notification-row-icon">{notification.notification_type.includes("overdue") || notification.notification_type.includes("critical") ? <AlertTriangle size={17} /> : <Bell size={17} />}</span>
              <span><strong>{notification.title}</strong><span>{notification.body}</span><small>{notification.due_at ? `${text("Deadline", "Deadline")} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(notification.due_at))}` : text("Immediate follow-up", "Directe opvolging")} · {notification.push_status === "sent" ? text("Push sent", "Push verzonden") : notification.push_status === "failed" ? text("Push retry pending", "Nieuwe pushpoging gepland") : notification.push_status === "skipped" ? text("Activate push on a device", "Activeer push op een apparaat") : text("Push queued", "Push in wachtrij")}</small></span>
              {!notification.read_at ? <i aria-label={text("Unread", "Ongelezen")} /> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function UserAdminModal({
  close,
  organizationId,
  projects,
  access,
  loading,
  loadError,
  reload,
  invite,
  currentUserId,
  changeStatus,
  changeProjectRole,
}: {
  close: () => void;
  organizationId: string;
  projects: WorkspaceProject[];
  access: InternalAccessSnapshot | null;
  loading: boolean;
  loadError: string;
  reload: () => void;
  invite: (answers: InternalUserInviteAnswers) => Promise<boolean>;
  currentUserId: string;
  changeStatus: (userId: string, nextStatus: "active" | "suspended" | "revoked", reason: string) => Promise<boolean>;
  changeProjectRole: (userId: string, projectId: string, roleCode: string, reason: string) => Promise<boolean>;
}) {
  const { language, text } = useLanguage();
  const localizedInternalUserInviteSchema = useMemo(() => createInternalUserInviteSchema(language), [language]);
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [success, setSuccess] = useState("");
  const [activePanel, setActivePanel] = useState<"invite" | "members">("invite");
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3>(1);
  const [invitedEmail, setInvitedEmail] = useState("");
  const [memberError, setMemberError] = useState("");
  const [memberAction, setMemberAction] = useState<{ userId: string; nextStatus: "active" | "suspended" | "revoked"; reason: string } | null>(null);
  const [roleEdit, setRoleEdit] = useState<{ userId: string; projectId: string; roleCode: string; reason: string } | null>(null);
  const { register, handleSubmit, control, reset, setValue, trigger, getValues, formState: { errors } } = useForm<InternalUserInviteAnswers>({
    resolver: zodResolver(localizedInternalUserInviteSchema),
    defaultValues: { organizationId, displayName: "", email: "", roleCode: "", projectId: "" },
  });
  const roleCode = useWatch({ control, name: "roleCode" });
  const displayName = useWatch({ control, name: "displayName" });
  const email = useWatch({ control, name: "email" });
  const projectId = useWatch({ control, name: "projectId" });
  const selectedRole = access?.roles.find((role) => role.code === roleCode);
  const selectedInviteProject = projects.find((project) => project.id === projectId);
  const projectRoles = access?.roles.filter((role) => role.scope === "project") ?? [];
  const defaultProjectRole = projectRoles.find((role) => role.code === "external_guest") ?? projectRoles[0];
  const roleAccessCopy: Record<string, [string, string]> = {
    external_guest: [
      "No general project access. Receives only explicitly shared, revocable evidence links.",
      "Geen algemene projecttoegang. Ontvangt alleen expliciet gedeelde, intrekbare bewijslinks.",
    ],
    contractor: [
      "May submit controlled external records and supporting files; cannot manage the company team or approve its own submission.",
      "Mag gecontroleerde externe indieningen en bijlagen aanleveren; kan het bedrijfsteam niet beheren en de eigen indiening niet goedkeuren.",
    ],
    client: [
      "May view approved reports and review controlled external submissions; cannot edit field records.",
      "Mag goedgekeurde rapporten bekijken en gecontroleerde externe indieningen beoordelen; kan veldregistraties niet wijzigen.",
    ],
    supervisor: [
      "Company employee access to field records, inspections, actions and reports for the selected project.",
      "Toegang voor een eigen medewerker tot veldregistraties, inspecties, acties en rapporten van het gekozen project.",
    ],
  };
  const selectedRoleCopy = roleAccessCopy[selectedRole?.code ?? ""] ?? [
    "Permissions are limited to the centrally controlled role shown here.",
    "Rechten zijn beperkt tot de centraal beheerde rol die hier wordt getoond.",
  ];

  useEffect(() => {
    if (!roleCode && defaultProjectRole) setValue("roleCode", defaultProjectRole.code);
  }, [defaultProjectRole, roleCode, setValue]);

  const submit = async (answers: InternalUserInviteAnswers) => {
    if (selectedRole?.scope === "project" && !answers.projectId) {
      setInviteError(text("Choose the project this user may access.", "Kies het project waarop deze gebruiker toegang krijgt."));
      return;
    }
    setBusy(true);
    setInviteError("");
    setSuccess("");
    const prepared = {
      ...answers,
      projectId: selectedRole?.scope === "organization" ? "" : answers.projectId,
    };
    const saved = await invite(prepared);
    if (saved) {
      setInvitedEmail(answers.email);
      setSuccess(text(`The personal invitation for ${answers.email} was sent.`, `De persoonlijke uitnodiging voor ${answers.email} is verzonden.`));
      reset({ organizationId, displayName: "", email: "", roleCode: defaultProjectRole?.code || "", projectId: "" });
    } else {
      setInviteError(text("The invitation was not completed. Review the message and try again.", "De uitnodiging is niet voltooid. Bekijk de melding en probeer opnieuw."));
    }
    setBusy(false);
  };

  const continueInvite = async () => {
    setInviteError("");
    if (inviteStep === 1) {
      if (await trigger(["displayName", "email"])) setInviteStep(2);
      return;
    }
    if (selectedRole?.scope === "project" && !getValues("projectId")) {
      setInviteError(text("Choose the project this user may access.", "Kies het project waarop deze gebruiker toegang krijgt."));
      return;
    }
    if (await trigger(["roleCode", "projectId"])) setInviteStep(3);
  };

  const startAnotherInvite = () => {
    setSuccess("");
    setInvitedEmail("");
    setInviteStep(1);
  };

  const confirmMemberAction = async () => {
    if (!memberAction || memberAction.reason.trim().length < 5) return;
    setBusy(true);
    setMemberError("");
    const saved = await changeStatus(memberAction.userId, memberAction.nextStatus, memberAction.reason.trim());
    if (saved) {
      setMemberAction(null);
      setSuccess(text("The access status and reason were stored centrally and audited.", "De toegangsstatus en reden zijn centraal opgeslagen en geaudit."));
    } else {
      setMemberError(text("The access status could not be changed.", "De toegangsstatus kon niet worden gewijzigd."));
    }
    setBusy(false);
  };

  const confirmProjectRole = async () => {
    if (!roleEdit || roleEdit.reason.trim().length < 5) return;
    setBusy(true);
    setMemberError("");
    const saved = await changeProjectRole(roleEdit.userId, roleEdit.projectId, roleEdit.roleCode, roleEdit.reason.trim());
    if (saved) {
      setRoleEdit(null);
      setSuccess(text("Project rights were updated and audited.", "Projectrechten zijn aangepast en geaudit."));
    } else {
      setMemberError(text("The project rights could not be updated.", "De projectrechten konden niet worden aangepast."));
    }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal user-admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-admin-title">
        <header className="modal-header">
          <div><p className="eyebrow">{text("Access management", "Toegangsbeheer")}</p><h2 id="user-admin-title">{text("Users and access", "Gebruikers en toegang")}</h2><p>{text("Invite employees or external project parties and keep access explicit.", "Nodig medewerkers of externe projectpartijen uit en houd de toegang expliciet.")}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body user-admin-body">
          <div className="user-admin-tabs" role="tablist" aria-label={text("User management", "Gebruikersbeheer")}>
            <button role="tab" aria-selected={activePanel === "invite"} className={activePanel === "invite" ? "active" : ""} type="button" onClick={() => setActivePanel("invite")}><UserPlus size={16} /> {text("Invite someone", "Iemand uitnodigen")}</button>
            <button role="tab" aria-selected={activePanel === "members"} className={activePanel === "members" ? "active" : ""} type="button" onClick={() => setActivePanel("members")}><Users size={16} /> {text("Current access", "Huidige toegang")} <span>{access?.members.length ?? 0}</span></button>
          </div>
          {activePanel === "invite" ? <section className="invite-panel" aria-labelledby="invite-heading">
            <div className="invite-progress" aria-label={text(`Step ${inviteStep} of 3`, `Stap ${inviteStep} van 3`)}>
              {[text("Person", "Persoon"), text("Access", "Toegang"), text("Check", "Controleren")].map((label, index) => <span className={inviteStep >= index + 1 ? "active" : ""} key={label}><i>{inviteStep > index + 1 ? <Check size={12} /> : index + 1}</i>{label}</span>)}
            </div>
            <div className="section-heading"><span className="module-card-icon"><UserPlus size={18} /></span><span><h3 id="invite-heading">{text("Invite project user", "Projectgebruiker uitnodigen")}</h3><p>{text("Invite an employee, contractor, consultant or owner with a personal login and a project-scoped role.", "Nodig een medewerker, aannemer, adviseur of eigenaar uit met een persoonlijke login en projectgebonden rol.")}</p></span></div>
            {success ? <div className="invite-success" role="status"><span><CheckCircle2 size={24} /></span><div><h3>{text("Invitation is on its way", "Uitnodiging is onderweg")}</h3><p>{text(`${invitedEmail} receives a secure link to set a password. The account remains marked as invited until the first sign-in.`, `${invitedEmail} ontvangt een beveiligde link om een wachtwoord in te stellen. Tot de eerste aanmelding blijft het account als uitgenodigd gemarkeerd.`)}</p><div className="button-row"><button className="primary-button" type="button" onClick={startAnotherInvite}><UserPlus size={15} /> {text("Invite another", "Nog iemand uitnodigen")}</button><button className="ghost-button" type="button" onClick={() => setActivePanel("members")}>{text("View access", "Toegang bekijken")} <ArrowRight size={14} /></button></div></div></div> : <form className={`invite-flow step-${inviteStep}`} onSubmit={handleSubmit(submit)} noValidate>
              <input type="hidden" {...register("organizationId")} />
              {inviteStep === 1 ? <div className="form-grid"><label className="form-field"><span>{text("Full name *", "Volledige naam *")}</span><input autoFocus autoComplete="name" placeholder={text("e.g. Jane Doe", "bijv. Jane Doe")} {...register("displayName")} />{errors.displayName ? <small className="field-error">{errors.displayName.message}</small> : null}</label><label className="form-field"><span>{text("Business email address *", "Zakelijk e-mailadres *")}</span><input type="email" autoComplete="email" placeholder="naam@bedrijf.com" {...register("email")} />{errors.email ? <small className="field-error">{errors.email.message}</small> : null}</label></div> : null}
              <label className="form-field"><span>{text("Role *", "Rol *")}</span><select {...register("roleCode")} disabled={!access?.roles.length}><option value="">{text("Choose a role", "Kies een rol")}</option><optgroup label={text("Project roles · least privilege", "Projectrollen · minimale rechten")}>{projectRoles.map((role) => <option value={role.code} key={role.id}>{role.name}</option>)}</optgroup><optgroup label={text("Organization roles · internal only", "Organisatierollen · alleen intern")}>{access?.roles.filter((role) => role.scope === "organization").map((role) => <option value={role.code} key={role.id}>{role.name}</option>)}</optgroup></select>{errors.roleCode ? <small className="field-error">{errors.roleCode.message}</small> : null}</label>
              {selectedRole ? <div className={`role-access-preview ${selectedRole.code === "external_guest" ? "restricted" : ""}`}><KeyRound size={16} /><span><strong>{selectedRole.name} · {selectedRole.scope === "project" ? text("this project only", "alleen dit project") : text("entire organization", "hele organisatie")}</strong><small>{text(selectedRoleCopy[0], selectedRoleCopy[1])}</small></span></div> : null}
              {selectedRole?.scope === "project" ? <label className="form-field"><span>Project *</span><select {...register("projectId")}><option value="">{text("Choose a project", "Kies een project")}</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.code} · {project.name}</option>)}</select>{errors.projectId ? <small className="field-error">{errors.projectId.message}</small> : null}</label> : <div className="scope-note"><ShieldCheck size={16} /><span><strong>{text("Organization-wide access", "Organisatiebrede toegang")}</strong><small>{text("This role applies to all current projects in the organization.", "Deze rol geldt voor alle huidige projecten binnen de organisatie.")}</small></span></div>}
              {inviteStep === 3 ? <><dl className="invite-summary"><div><dt>{text("Project user", "Projectgebruiker")}</dt><dd>{displayName}<small>{email}</small></dd></div><div><dt>{text("Role", "Rol")}</dt><dd>{selectedRole?.name}</dd></div><div><dt>{text("Access", "Toegang")}</dt><dd>{selectedRole?.scope === "organization" ? text("All projects in the organization", "Alle projecten in de organisatie") : selectedInviteProject ? `${selectedInviteProject.code} · ${selectedInviteProject.name}` : text("No project selected", "Geen project geselecteerd")}</dd></div></dl><div className="invitation-explainer"><ShieldCheck size={17} /><span><strong>{text("What happens next?", "Wat gebeurt hierna?")}</strong>{text("The invited person opens the personal email link, sets a password and can then access only the scope shown above.", "De uitgenodigde persoon opent de persoonlijke e-maillink, stelt een wachtwoord in en krijgt daarna alleen toegang tot de scope hierboven.")}</span></div></> : null}
              {inviteError ? <p className="access-message error full" role="alert">{inviteError}</p> : null}
              <div className="invite-actions">{inviteStep > 1 ? <button className="ghost-button" type="button" onClick={() => setInviteStep(inviteStep === 3 ? 2 : 1)}><ArrowLeft size={14} /> {text("Back", "Terug")}</button> : <span />}{inviteStep < 3 ? <button className="primary-button" type="button" disabled={loading || Boolean(loadError)} onClick={() => void continueInvite()}>{text("Continue", "Doorgaan")} <ArrowRight size={15} /></button> : <button className="primary-button" type="submit" disabled={busy || loading || Boolean(loadError)}>{busy ? <Loader2 className="spin" size={15} /> : <UserPlus size={15} />}{text("Send invitation", "Uitnodiging versturen")}</button>}</div>
            </form>}
          </section> : null}

          {activePanel === "members" ? <section className="internal-members" aria-labelledby="members-heading">
            <div className="member-list-heading"><span><h3 id="members-heading">{text("Project accounts", "Projectaccounts")}</h3><p>{access?.members.length ?? 0} {text("account(s) with organization or project access", "account(s) met organisatie- of projecttoegang")}</p></span>{loadError ? <button className="ghost-button" type="button" onClick={reload}>{text("Reload", "Opnieuw laden")}</button> : null}</div>
            {loading ? <div className="empty-list-state"><Loader2 className="spin" size={22} /><strong>{text("Loading accounts", "Accounts laden")}</strong><span>{text("Roles and project access are being verified.", "Rollen en projecttoegang worden gecontroleerd.")}</span></div> : null}
            {loadError ? <p className="access-message error" role="alert">{loadError}</p> : null}
            {memberError ? <p className="access-message error" role="alert">{memberError}</p> : null}
            {!loading && !loadError && access?.members.length === 0 ? <div className="empty-list-state"><Users size={22} /><strong>{text("No accounts yet", "Nog geen accounts")}</strong><span>{text("Send the first project invitation above.", "Verstuur hierboven de eerste projectuitnodiging.")}</span></div> : null}
            <div className="member-list">
              {access?.members.map((member) => {
                const roles = [
                  ...member.organizationRoles.map((role) => role.name),
                  ...member.projectRoles.map((role) => `${role.roleName} · ${role.projectName}`),
                ];
                const statusLabel = member.membershipStatus === "suspended" ? text("Suspended", "Opgeschort") : member.membershipStatus === "revoked" ? text("Revoked", "Ingetrokken") : member.accessStatus === "active" ? text("Active", "Actief") : text("Invited", "Uitgenodigd");
                return <div className="member-access-card" key={member.userId}>
                  <article className="member-row">
                    <span className="avatar">{initials(member.displayName || member.email)}</span>
                    <span className="member-copy"><strong>{member.displayName || member.email}</strong><span>{member.email}</span><small>{roles.join(" · ") || text("No role yet", "Nog geen rol")}</small></span>
                    <span className="member-access-controls"><span className={`task-status ${member.membershipStatus === "active" && member.accessStatus === "active" ? "green" : ""}`}>{statusLabel}</span>{member.userId === currentUserId ? <small>{text("Own account", "Eigen account")}</small> : member.membershipStatus !== "revoked" ? <span>{member.membershipStatus === "suspended" ? <button className="ghost-button" type="button" disabled={busy} onClick={() => setMemberAction({ userId: member.userId, nextStatus: "active", reason: "" })}>{text("Reactivate", "Heractiveren")}</button> : <button className="ghost-button" type="button" disabled={busy} onClick={() => setMemberAction({ userId: member.userId, nextStatus: "suspended", reason: "" })}>{text("Suspend", "Opschorten")}</button>}<button className="ghost-button danger" type="button" disabled={busy} onClick={() => setMemberAction({ userId: member.userId, nextStatus: "revoked", reason: "" })}>{text("Revoke", "Intrekken")}</button></span> : null}</span>
                  </article>
                  {member.projectRoles.map((projectRole) => <div className="member-project-permission" key={`${member.userId}:${projectRole.projectId}:${projectRole.roleCode}`}>
                    <span><KeyRound size={14} /><span><strong>{projectRole.projectName}</strong><small>{projectRole.roleName} · {text(roleAccessCopy[projectRole.roleCode]?.[0] ?? "Controlled project role", roleAccessCopy[projectRole.roleCode]?.[1] ?? "Gecontroleerde projectrol")}</small></span></span>
                    {member.userId !== currentUserId ? <button className="ghost-button" type="button" onClick={() => setRoleEdit({ userId: member.userId, projectId: projectRole.projectId, roleCode: projectRole.roleCode, reason: "" })}>{text("Edit rights", "Rechten aanpassen")}</button> : null}
                  </div>)}
                  {roleEdit?.userId === member.userId ? <div className="member-status-form role-editor"><label className="form-field"><span>{text("New project role", "Nieuwe projectrol")}</span><select value={roleEdit.roleCode} onChange={(event) => setRoleEdit({ ...roleEdit, roleCode: event.target.value })}>{projectRoles.map((role) => <option value={role.code} key={role.id}>{role.name}</option>)}</select></label><label className="form-field"><span>{text("Reason for access change *", "Reden voor rechtenwijziging *")}</span><textarea rows={2} value={roleEdit.reason} onChange={(event) => setRoleEdit({ ...roleEdit, reason: event.target.value })} placeholder={text("Stored permanently in the access audit history", "Wordt blijvend opgeslagen in de toegangs-auditgeschiedenis")} /></label><div className="button-row"><button className="ghost-button" type="button" onClick={() => setRoleEdit(null)}>{text("Cancel", "Annuleren")}</button><button className="primary-button" type="button" disabled={busy || roleEdit.reason.trim().length < 5} onClick={() => void confirmProjectRole()}><ShieldCheck size={14} /> {text("Save least-privilege role", "Sla minimale rol op")}</button></div></div> : null}
                  {memberAction?.userId === member.userId ? <div className="member-status-form"><label className="form-field"><span>{text("Reason for", "Reden voor")} {memberAction.nextStatus === "active" ? text("reactivation", "heractivering") : memberAction.nextStatus === "suspended" ? text("suspension", "opschorting") : text("permanent revocation", "definitieve intrekking")} *</span><textarea rows={2} value={memberAction.reason} onChange={(event) => setMemberAction({ ...memberAction, reason: event.target.value })} placeholder={text("At least 5 characters; stored in the audit trail", "Minimaal 5 tekens; wordt in de audittrail bewaard")} /></label><div className="button-row"><button className="ghost-button" type="button" onClick={() => setMemberAction(null)}>{text("Cancel", "Annuleren")}</button><button className="primary-button" type="button" disabled={busy || memberAction.reason.trim().length < 5} onClick={() => void confirmMemberAction()}>{busy ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />} {text("Confirm status", "Status bevestigen")}</button></div></div> : null}
                </div>;
              })}
            </div>
          </section> : null}
        </div>
      </section>
    </div>
  );
}

function QuickAddModal({ close, chooseType }: { close: () => void; chooseType: (type: string) => void }) {
  const { language, text } = useLanguage();
  const availableTypes = language === "en" ? quickTypesEnglish : quickTypes;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="quick-title">
        <header className="modal-header">
          <div><h2 id="quick-title">{text("Other field record", "Andere veldregistratie")}</h2><p>{text("Choose once; the project, building and daily report are linked automatically.", "Kies één keer; project, gebouw en dagrapport worden automatisch gekoppeld.")}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="quick-grid">
            {availableTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button className="quick-tile" type="button" onClick={() => chooseType(type.id)} key={type.id}>
                  <span className="quick-tile-icon"><Icon size={18} /></span>
                  <strong>{type.title}</strong><span>{type.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function EntryModal({
  selectedType,
  description,
  descriptionSuggested,
  priority,
  workPackage,
  setDescription,
  dictateDescription,
  setWorkPackage,
  setLocation,
  setPriority,
  goBack,
  close,
  save,
  photos,
  setPhotos,
  addPhotos,
  addSketch,
  projectName,
  buildingName,
  buildings,
  buildingIds,
  setBuildingIds,
  locationNodes,
  locationNodeId,
  setLocationNodeId,
  drawings,
  drawingId,
  setDrawingId,
  openDrawings,
  requiredLocationDepth,
  busy,
}: {
  selectedType: string;
  description: string;
  /** The text was proposed by the app, not typed. It must disappear on the first keystroke. */
  descriptionSuggested: boolean;
  priority: string;
  workPackage: string;
  setDescription: (value: string, suggested?: boolean) => void;
  dictateDescription: (transcript: string) => void;
  setWorkPackage: (value: string) => void;
  setLocation: (value: string) => void;
  setPriority: (value: string) => void;
  goBack: () => void;
  close: () => void;
  save: () => void;
  photos: PhotoEvidence[];
  setPhotos: (photos: PhotoEvidence[]) => void;
  addPhotos: (files: FileList | null) => void;
  addSketch: (file: File) => void;
  projectName: string;
  buildingName: string;
  buildings: BuildingOption[];
  buildingIds: string[];
  setBuildingIds: (value: string[]) => void;
  locationNodes: ProjectLocationOption[];
  locationNodeId: string;
  setLocationNodeId: (value: string) => void;
  drawings: ProjectDrawingOption[];
  drawingId: string;
  setDrawingId: (value: string) => void;
  openDrawings: () => void;
  requiredLocationDepth: "building" | "floor" | "room" | "element";
  busy: boolean;
}) {
  const { language, locale, text } = useLanguage();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [sketching, setSketching] = useState(false);
  // What this record already knows about the project is offered inside the marking pad, so a
  // marker can say which building, floor, room and work package it belongs to.
  const markupContext = useMemo(() => ({
    buildings: buildings.map((building) => ({ id: building.id, label: building.name })),
    defaultBuildingId: buildingIds.length === 1 ? buildingIds[0] : "",
    locations: locationNodes.map((node) => ({ id: node.id, label: locationBreadcrumb(locationNodes, node.id), buildingId: node.building_id })),
    workPackages: workPackageOptions.map((option) => (language === "en" ? option.en : option.nl)),
  }), [buildingIds, buildings, language, locationNodes]);
  const title = (language === "en" ? entryTitlesEnglish : entryTitles)[selectedType] ?? text("Record", "Registratie");
  const singleBuildingId = buildingIds.length === 1 ? buildingIds[0] : "";
  const chosenBuildingName = buildingIds.length === buildings.length && buildings.length > 1
    ? text("All buildings", "Alle gebouwen")
    : buildingIds.length > 1
      ? buildings.filter((building) => buildingIds.includes(building.id)).map((building) => building.name).join(" + ")
      : buildings.find((building) => building.id === singleBuildingId)?.name ?? buildingName;
  const needsPriority = selectedType === "finding" || selectedType === "hse" || selectedType === "action";
  const choices: Record<string, string[]> = {
    activity: [text("Work started as planned.", "Werk volgens planning gestart."), text("Work completed as planned.", "Werk volgens planning afgerond."), text("Work continues tomorrow.", "Werk wordt morgen voortgezet.")],
    inspection: [text("Inspection completed; all points passed.", "Inspectie uitgevoerd; alle punten akkoord."), text("Inspection completed; follow-up required.", "Inspectie uitgevoerd; opvolging vereist.")],
    finding: [text("Work is incomplete.", "Werk is niet volledig uitgevoerd."), text("Finish does not meet the requirement.", "Afwerking voldoet niet aan de eis."), text("Executed dimensions differ from the drawing.", "Uitvoering wijkt af van de tekening.")],
    hse: [text("Unsafe situation was corrected immediately.", "Onveilige situatie direct gecorrigeerd."), text("Safety point requires follow-up.", "Veiligheidspunt vraagt opvolging."), text("Positive safety observation.", "Positieve veiligheidsobservatie.")],
    delivery: [text("Delivery received and checked.", "Levering ontvangen en gecontroleerd."), text("Delivery incomplete or damaged.", "Levering onvolledig of beschadigd."), text("Delivery rejected.", "Levering geweigerd.")],
    test: [text("Test performed; result within tolerance.", "Test uitgevoerd; resultaat binnen tolerantie."), text("Test performed; deviation found.", "Test uitgevoerd; afwijking vastgesteld.")],
    delay: [text("Delay due to weather.", "Vertraging door weersomstandigheden."), text("Delay due to late delivery.", "Vertraging door te late levering."), text("Delay due to equipment failure.", "Vertraging door materieelstoring.")],
  };
  const descriptionChoices = choices[selectedType] ?? [];
  const buildingDrawings = drawings.filter((drawing) => !singleBuildingId || !drawing.buildingId || drawing.buildingId === singleBuildingId);
  const locationRequired = Boolean(singleBuildingId) && requiredLocationDepth !== "building";
  const describeLocation = (nodeId: string, drawing: string) => {
    const parts = [chosenBuildingName];
    if (nodeId) parts.push(locationBreadcrumb(locationNodes, nodeId));
    const drawingName = drawings.find((item) => item.id === drawing)?.name;
    if (drawingName) parts.push(text(`drawing ${drawingName}`, `tekening ${drawingName}`));
    return parts.filter(Boolean).join(" → ");
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
        <header className="modal-header">
          <div><h2 id="entry-title">{text(`Record ${title.toLowerCase()}`, `${title} vastleggen`)}</h2><p>{projectName} · {chosenBuildingName} · {currentTime(locale)}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="form-grid">
            {descriptionChoices.length ? <div className="quick-issue-presets full" aria-label={text("Choose a standard description", "Kies een standaardomschrijving")}>{descriptionChoices.map((choice) => <button className={description.trim() === choice ? "active" : ""} type="button" onClick={() => setDescription(description.trim() === choice ? "" : choice)} key={choice}>{choice}</button>)}</div> : null}
            <div className="form-field full">
              <div className="field-label-row">
                <label htmlFor="description">{text("Short description *", "Korte omschrijving *")}</label>
                {description ? <button className="field-clear-button" type="button" onClick={() => setDescription("")} aria-label={text("Clear the description", "Omschrijving wissen")}><X size={13} /> {text("Clear", "Wissen")}</button> : null}
              </div>
              {/* A proposed text is a suggestion, never a leftover: typing replaces it in
                  one go and the clear button empties the field without selecting text. */}
              <textarea
                className={descriptionSuggested ? "suggested-value" : ""}
                id="description"
                value={description}
                onChange={(event) => setDescription(descriptionSuggested
                  // Typing over a proposal replaces it, wherever the caret happened to be.
                  ? event.target.value.replace(description, "").trim() || event.target.value.trim()
                  : event.target.value)}
                onFocus={(event) => { if (descriptionSuggested) event.currentTarget.select(); }}
                placeholder={text("Choose above, dictate, or type what happened.", "Kies hierboven, dicteer of typ wat er is gebeurd.")}
              />
              {/* Dictation replaces the proposed text and then keeps adding to what was
                  already said, instead of asking the supervisor to clean up by hand. */}
              <DictateButton onText={dictateDescription} />
            </div>
            {buildings.length > 1
              ? <BuildingMultiPicker
                id="entry-building"
                buildings={buildings}
                value={buildingIds}
                onChange={(next) => {
                  setBuildingIds(next);
                  setLocation(next.length === 1 ? buildings.find((building) => building.id === next[0])?.name ?? "" : "");
                }}
              />
              : null}
            {singleBuildingId ? (
              <>
                <LocationPicker
                  id="entry-location"
                  nodes={locationNodes}
                  buildingId={singleBuildingId}
                  value={locationNodeId}
                  onChange={(next) => { setLocationNodeId(next); setLocation(describeLocation(next, drawingId)); }}
                  requiredDepth={requiredLocationDepth}
                />
                <div className="form-field">
                  <label htmlFor="entry-drawing">{text("Location on drawing", "Locatie op tekening")}</label>
                  <select id="entry-drawing" value={drawingId} onChange={(event) => { setDrawingId(event.target.value); setLocation(describeLocation(locationNodeId, event.target.value)); }}>
                    <option value="">{text("No drawing selected", "Geen tekening gekozen")}</option>
                    {buildingDrawings.map((drawing) => <option value={drawing.id} key={drawing.id}>{drawing.name}</option>)}
                  </select>
                  {buildingDrawings.length
                    ? <button className="field-inline-link" type="button" onClick={openDrawings}><MapPin size={12} /> {text("Open the drawing to place a pin", "Open de tekening om een pin te plaatsen")}</button>
                    : <small>{text("No drawing has been uploaded for this building yet. Upload the PDF under Project Docs.", "Voor dit gebouw is nog geen tekening geüpload. Upload de PDF bij Project Docs.")}</small>}
                </div>
              </>
            ) : null}
            {needsPriority ? (
              <div className="form-field">
                <label htmlFor="priority">{text("Priority", "Prioriteit")}</label>
                <select id="priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option>{text("Low", "Laag")}</option><option>{text("Normal", "Normaal")}</option><option>{text("High", "Hoog")}</option><option>{text("Critical", "Kritiek")}</option>
                </select>
              </div>
            ) : (
              <div className="form-field">
                <label htmlFor="work-package">{text("Work package", "Werkpakket")}</label>
                <select id="work-package" value={workPackage} onChange={(event) => setWorkPackage(event.target.value)}>
                  {workPackageOptions.map((option) => <option value={option.en} key={option.en}>{language === "en" ? option.en : option.nl}</option>)}
                </select>
              </div>
            )}
            <div className="form-field full">
              <label>{text("Add evidence", "Bewijs toevoegen")}</label>
              {/* The camera opens here. Sending the supervisor to the photo workspace lost
                  the half-filled record, which is what the client reported. */}
              <input ref={cameraInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} />
              <div className="evidence-button-row">
                <button className="ghost-button" type="button" onClick={() => cameraInputRef.current?.click()}><Camera size={16} /> {photos.length ? text(`Add another photo · ${photos.length} added`, `Nog een foto toevoegen · ${photos.length} toegevoegd`) : text("Take or choose a photo", "Maak of kies een foto")}</button>
                <button className="ghost-button" type="button" onClick={() => setSketching(true)}><PenLine size={16} /> {text("Make a sketch", "Schets maken")}</button>
              </div>
              {sketching ? <SketchPad close={() => setSketching(false)} save={(file) => { addSketch(file); setSketching(false); }} /> : null}
              {/* A photo is not finished when it is taken: it carries its own words, its
                  category, its location and the direction it was taken from, and it can be
                  marked on the picture itself. */}
              <PhotoEvidenceList
                photos={photos}
                setPhotos={setPhotos}
                markupContext={markupContext}
              />
              <span className="form-note"><CheckCircle2 size={12} /> {text("Time, author, project and building are recorded automatically.", "Tijd, maker, project en gebouw worden automatisch vastgelegd.")}</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={14} /> {text("Back", "Terug")}</button>
            <button className="primary-button" type="button" onClick={save} disabled={busy || !description.trim() || !buildingIds.length || (locationRequired && !locationNodeId)}>{busy ? <Loader2 className="spin" size={14} /> : null} {text("Save and include", "Opslaan en opnemen")} <Check size={14} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionCreateModal({
  parties,
  employees,
  projectName,
  buildingName,
  buildings,
  defaultBuildingId,
  locationNodes,
  requiredLocationDepth,
  close,
  goBack,
  save,
}: {
  parties: ProjectParty[];
  employees: InternalMember[];
  projectName: string;
  buildingName: string;
  buildings: BuildingOption[];
  defaultBuildingId: string;
  locationNodes: ProjectLocationOption[];
  requiredLocationDepth: "building" | "floor" | "room" | "element";
  close: () => void;
  goBack: () => void;
  save: (answers: ProjectActionAnswers, buildingId: string, locationNodeId?: string) => Promise<boolean>;
}) {
  const { text } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [buildingId, setBuildingId] = useState(() => resolveDefaultBuildingId(buildings, defaultBuildingId));
  const [locationNodeId, setLocationNodeId] = useState("");
  const defaultParty = parties.find((party) => party.type === "contractor")?.id ?? parties[0]?.id ?? "";
  const defaultEmployee = employees[0]?.userId ?? "";
  const { register, handleSubmit, setValue, getValues, control, formState: { errors } } = useForm<ProjectActionAnswers>({
    resolver: zodResolver(projectActionSchema),
    defaultValues: {
      title: "",
      description: "",
      ownerPartyId: defaultParty,
      ownerUserId: defaultEmployee,
      dueAt: defaultActionDeadline(),
      priority: "normal",
    },
  });
  const actionTemplates: Array<Pick<ProjectActionAnswers, "title" | "description" | "priority">> = [
    { title: text("Complete unfinished work", "Onvolledig werk afronden"), description: text("Complete the remaining work and provide visible proof for verification.", "Rond het resterende werk af en lever zichtbaar bewijs voor verificatie."), priority: "normal" },
    { title: text("Repair visible defect", "Zichtbaar gebrek herstellen"), description: text("Repair the recorded defect and report it ready for CODECO verification.", "Herstel het vastgelegde gebrek en meld het gereed voor CODECO-verificatie."), priority: "high" },
    { title: text("Submit missing document", "Ontbrekend document aanleveren"), description: text("Submit the missing document or approved revision for project control.", "Lever het ontbrekende document of de goedgekeurde revisie aan voor projectcontrole."), priority: "normal" },
    { title: text("Correct unsafe condition", "Onveilige situatie corrigeren"), description: text("Correct the unsafe condition immediately and provide evidence of the measure.", "Corrigeer de onveilige situatie direct en lever bewijs van de maatregel."), priority: "critical" },
    { title: text("Finish and clean work area", "Werkzone afwerken en schoonmaken"), description: text("Finish the work and leave the work area clean and ready for inspection.", "Werk het onderdeel af en laat de werkzone schoon en gereed voor inspectie achter."), priority: "low" },
  ];
  const selectedActionTitle = useWatch({ control, name: "title" });
  const applyTemplate = (template: Pick<ProjectActionAnswers, "title" | "description" | "priority">) => {
    setValue("title", template.title, { shouldDirty: true, shouldValidate: true });
    setValue("description", template.description, { shouldDirty: true, shouldValidate: true });
    setValue("priority", template.priority, { shouldDirty: true, shouldValidate: true });
  };
  const submit = async (answers: ProjectActionAnswers) => {
    setBusy(true);
    await save(answers, buildingId, locationNodeId || undefined);
    setBusy(false);
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal action-modal" role="dialog" aria-modal="true" aria-labelledby="action-create-title">
        <header className="modal-header">
          <div><h2 id="action-create-title">{text("Create central action", "Actie centraal aanmaken")}</h2><p>{projectName} · {buildingId === ALL_BUILDINGS ? text("All buildings", "Alle gebouwen") : buildings.find((building) => building.id === buildingId)?.name ?? buildingName}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <form className="modal-body" onSubmit={handleSubmit(submit)} noValidate>
          <div className="form-grid two-columns">
            <div className="quick-issue-presets full" aria-label={text("Choose a standard action", "Kies een standaardactie")}>{actionTemplates.map((template) => <button className={selectedActionTitle === template.title ? "active" : ""} type="button" aria-pressed={selectedActionTitle === template.title} onClick={() => applyTemplate(template)} key={template.title}>{template.title}</button>)}</div>
            {errors.title || errors.description ? <small className="field-error full">{text("Choose a standard action or open “Different action”.", "Kies een standaardactie of open ‘Andere actie’.")}</small> : null}
            <details className="optional-text-entry full">
              <summary>{text("Different action", "Andere actie")}</summary>
              <div className="form-grid">
                <label className="form-field"><span>{text("Action *", "Actie *")}</span><input placeholder={text("What must demonstrably be completed?", "Wat moet aantoonbaar worden uitgevoerd?")} {...register("title")} />{errors.title ? <small className="field-error">{errors.title.message}</small> : null}</label>
                <label className="form-field"><span>{text("Context and acceptance criterion *", "Context en acceptatiecriterium *")}</span><textarea rows={4} placeholder={text("Describe the location, required measure and completion criterion.", "Beschrijf locatie, gewenste maatregel en wanneer de actie gereed is.")} {...register("description")} /><DictateButton onText={(transcript) => setValue("description", appendDictation(getValues("description") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} />{errors.description ? <small className="field-error">{errors.description.message}</small> : null}</label>
              </div>
            </details>
            <BuildingPicker id="action-building" buildings={buildings} value={buildingId} onChange={(next) => { setBuildingId(next); setLocationNodeId(""); }} allowAll />
            {buildingId !== ALL_BUILDINGS ? <LocationPicker id="action-location" nodes={locationNodes} buildingId={buildingId} value={locationNodeId} onChange={setLocationNodeId} requiredDepth={requiredLocationDepth} /> : null}
            <label className="form-field"><span>{text("Responsible party *", "Verantwoordelijke partij *")}</span><select {...register("ownerPartyId")} disabled={parties.length === 0}><option value="">{text("Choose party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select>{errors.ownerPartyId ? <small className="field-error">{errors.ownerPartyId.message}</small> : null}</label>
            <label className="form-field"><span>{text("Assigned company employee *", "Toegewezen bedrijfsmedewerker *")}</span><select {...register("ownerUserId")} disabled={employees.length === 0}><option value="">{text("Choose employee", "Kies medewerker")}</option>{employees.map((employee) => <option value={employee.userId} key={employee.userId}>{employee.displayName || employee.email} · {[...employee.organizationRoles.map((role) => role.name), ...employee.projectRoles.filter((role) => role.projectId).map((role) => role.roleName)][0] ?? text("Employee", "Medewerker")}</option>)}</select>{errors.ownerUserId ? <small className="field-error">{errors.ownerUserId.message}</small> : null}{employees.length === 0 ? <small className="field-error">{text("No active company employees are available. Invite or activate one under Management → Team and access.", "Er zijn geen actieve bedrijfsmedewerkers beschikbaar. Nodig iemand uit of activeer het account via Management → Team en toegang.")}</small> : null}</label>
            <div className="form-field"><label htmlFor="action-deadline">Deadline *</label><input id="action-deadline" type="datetime-local" {...register("dueAt")} />{errors.dueAt ? <small className="field-error">{errors.dueAt.message}</small> : null}<span className="period-date-presets">{[[0, text("Today", "Vandaag")], [1, text("Tomorrow", "Morgen")], [3, text("3 days", "3 dagen")], [7, text("7 days", "7 dagen")]].map(([days, label]) => <button type="button" onClick={() => setValue("dueAt", actionDeadlineFromToday(Number(days)), { shouldDirty: true, shouldValidate: true })} key={String(label)}>{label}</button>)}</span></div>
            <label className="form-field"><span>{text("Priority", "Prioriteit")}</span><select {...register("priority")}><option value="low">{text("Low", "Laag")}</option><option value="normal">{text("Normal", "Normaal")}</option><option value="high">{text("High", "Hoog")}</option><option value="critical">{text("Critical", "Kritiek")}</option></select></label>
            <div className="action-rule-note"><ShieldCheck size={16} /><span><strong>{text("Controlled follow-up flow", "Vaste opvolgflow")}</strong><small>{text("Open → accepted → in progress → verification → closed.", "Open → geaccepteerd → in uitvoering → verificatie → gesloten.")}</small></span></div>
          </div>
          <div className="modal-actions">
            <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={14} /> {text("Back", "Terug")}</button>
            <button className="primary-button" type="submit" disabled={busy || parties.length === 0 || employees.length === 0 || (buildingId !== ALL_BUILDINGS && requiredLocationDepth !== "building" && !locationNodeId)}>{busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />} {text("Save and assign", "Opslaan en toewijzen")}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ActionDetailModal({
  action,
  partyName,
  locationNodes,
  updates,
  close,
  transition,
}: {
  action: ProjectAction;
  partyName: string;
  locationNodes: ProjectLocationOption[];
  updates: ActionUpdate[];
  close: () => void;
  transition: (nextStatus: ProjectAction["status"], note: string) => Promise<boolean>;
}) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? actionStatusLabelsEnglish : actionStatusLabels;
  const [busy, setBusy] = useState(false);
  const nextStatus = nextActionStatus[action.status];
  const { register, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm<ActionTransitionAnswers>({
    resolver: zodResolver(actionTransitionSchema),
    defaultValues: { note: "" },
  });
  const submit = async ({ note }: ActionTransitionAnswers) => {
    if (!nextStatus) return;
    setBusy(true);
    const saved = await transition(nextStatus, note);
    if (saved) reset();
    setBusy(false);
  };
  const dueAt = action.due_at
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(action.due_at))
    : text("No deadline", "Geen deadline");
  const transitionChoices: Partial<Record<ProjectAction["status"], string[]>> = {
    accepted: [text("Action received and scheduled.", "Actie ontvangen en ingepland."), text("Action accepted; required resources are available.", "Actie geaccepteerd; benodigde middelen zijn beschikbaar.")],
    in_progress: [text("Execution has started.", "Uitvoering is gestart."), text("Work is in progress according to plan.", "Werk is volgens planning in uitvoering.")],
    ready_for_verification: [text("Work completed and ready for verification.", "Werk uitgevoerd en gereed voor verificatie."), text("Measure completed; evidence is available.", "Maatregel uitgevoerd; bewijs is beschikbaar.")],
    verified: [text("Work checked and accepted.", "Werk gecontroleerd en akkoord."), text("Completion verified against the acceptance criterion.", "Uitvoering getoetst aan het acceptatiecriterium en akkoord.")],
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal action-detail-modal" role="dialog" aria-modal="true" aria-labelledby="action-detail-title">
        <header className="modal-header">
          <div><p className="eyebrow">{action.action_number}</p><h2 id="action-detail-title">{action.title}</h2><p>{partyName}{action.location_node_id ? ` · ${locationBreadcrumb(locationNodes, action.location_node_id)}` : ""} · {text("deadline", "deadline")} {dueAt}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body action-detail-body">
          <div className="action-detail-summary">
            <span className={`task-status ${action.priority === "critical" ? "red" : ""}`}>{action.priority}</span>
            <span className={`task-status ${action.status === "verified" ? "green" : ""}`}>{statusLabels[action.status]}</span>
            <p>{action.description}</p>
          </div>
          <div className="action-status-flow" aria-label={text("Action status", "Actiestatus")}>
            {(["open", "accepted", "in_progress", "ready_for_verification", "verified"] as ProjectAction["status"][]).map((status) => {
              const order = ["open", "accepted", "in_progress", "ready_for_verification", "verified"];
              const reached = order.indexOf(status) <= order.indexOf(action.status);
              return <span className={reached ? "reached" : ""} key={status}><i />{statusLabels[status]}</span>;
            })}
          </div>
          <section className="action-history">
            <h3>{text("Immutable history", "Onveranderbare historie")}</h3>
            {updates.length === 0 ? <p>{text("No history loaded yet.", "Nog geen historie geladen.")}</p> : updates.map((update) => (
              <article key={update.id}><span className="timeline-dot" /><div><strong>{update.update_type === "status" && update.to_status ? statusLabels[update.to_status as ProjectAction["status"]] : text("Created", "Aangemaakt")}</strong><p>{update.message}</p><time>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(update.created_at))}</time></div></article>
            ))}
          </section>
          {nextStatus ? (
            <form className="action-transition-form" onSubmit={handleSubmit(submit)} noValidate>
              <div className="quick-issue-presets" aria-label={text("Choose a standard status note", "Kies een standaard statusnotitie")}>{(transitionChoices[nextStatus] ?? []).map((choice) => <button type="button" onClick={() => setValue("note", choice, { shouldDirty: true, shouldValidate: true })} key={choice}>{choice}</button>)}</div>
              {errors.note ? <small className="field-error">{text("Choose a standard status note or enter a different note.", "Kies een standaard statusnotitie of voer een andere notitie in.")}</small> : null}
              <details className="optional-text-entry">
                <summary>{text("Different status note", "Andere statusnotitie")}</summary>
                <label className="form-field"><span>{nextStatus === "verified" ? text("Verification note *", "Verificatienotitie *") : text("Execution note *", "Uitvoeringsnotitie *")}</span><textarea rows={3} placeholder={text("Record what was completed, checked or is still required.", "Leg vast wat is uitgevoerd, gecontroleerd of nog nodig is.")} {...register("note")} /><DictateButton onText={(transcript) => setValue("note", appendDictation(getValues("note") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} />{errors.note ? <small className="field-error">{errors.note.message}</small> : null}</label>
              </details>
              <button className="primary-button" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <ArrowRight size={14} />} {text("Move to", "Naar")} {statusLabels[nextStatus].toLowerCase()}</button>
            </form>
          ) : <p className="action-complete-note"><CheckCircle2 size={16} /> {action.status === "verified" ? text("This action has been formally verified and closed.", "Deze actie is formeel geverifieerd en gesloten.") : text("This action was cancelled and remains visible in the history.", "Deze actie is geannuleerd en blijft in de historie zichtbaar.")}</p>}
        </div>
      </section>
    </div>
  );
}

function ManageBuildingsModal({
  buildings,
  close,
  addBuilding,
}: {
  buildings: BuildingContext[];
  close: () => void;
  addBuilding: (input: { code: string; name: string; description: string }) => Promise<boolean>;
}) {
  const { text } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const submit = async () => {
    if (code.trim().length < 1 || name.trim().length < 2) return;
    setBusy(true);
    const saved = await addBuilding({ code: code.trim(), name: name.trim(), description: description.trim() });
    setBusy(false);
    if (saved) {
      setCode("");
      setName("");
      setDescription("");
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="manage-buildings-title">
        <header className="modal-header">
          <div>
            <h2 id="manage-buildings-title">{text("Buildings in this project", "Gebouwen in dit project")}</h2>
            <p>{text("The daily report already covers every building. Every record — photo, finding, inspection, log — lets you choose its own building individually. Buildings you add here become available to pick from.", "Het dagrapport dekt al elk gebouw. Elke registratie — foto, bevinding, inspectie, log — laat je zelf het gebouw kiezen. Gebouwen die je hier toevoegt, worden overal beschikbaar om uit te kiezen.")}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="building-selection-grid">
            {buildings.map((building) => (
              <div className="building-selection-card" key={building.id}>
                <span className="building-selection-copy"><strong>{building.name}</strong><small>{building.description}</small></span>
              </div>
            ))}
          </div>
          <details className="optional-text-entry full">
            <summary>{text("Add a new building", "Nieuw gebouw toevoegen")}</summary>
            <div className="form-grid two-columns">
              <label className="form-field"><span>{text("Building code *", "Gebouwcode *")}</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder={text("e.g. TOWER-B", "bijv. TOREN-B")} /></label>
              <label className="form-field"><span>{text("Building name *", "Gebouwnaam *")}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className="form-field wide"><span>{text("Description", "Omschrijving")}</span><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            </div>
            <button className="primary-button" type="button" disabled={busy || code.trim().length < 1 || name.trim().length < 2} onClick={() => void submit()}>{busy ? <Loader2 className="spin" size={15} /> : <Plus size={15} />} {text("Add building", "Gebouw toevoegen")}</button>
          </details>
        </div>
      </section>
    </div>
  );
}

function DailyQuestionsModal({
  buildingName,
  buildingId,
  buildings,
  onChangeBuilding,
  close,
  initialAnswers,
  projectStartAnswers,
  save,
}: {
  buildingName: string;
  buildingId: string;
  buildings: BuildingOption[];
  onChangeBuilding: (buildingId: string) => void;
  close: () => void;
  initialAnswers: DailyCloseoutAnswers | null;
  projectStartAnswers: ProjectStartAnswers | null;
  save: (answers: DailyCloseoutAnswers) => void | Promise<void>;
}) {
  const { language, text } = useLanguage();
  const localizedDailyCloseoutSchema = useMemo(() => createDailyCloseoutSchema(language), [language]);
  const [step, setStep] = useState(0);
  const {
    register,
    handleSubmit,
    control,
    trigger,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<DailyCloseoutAnswers>({
    resolver: zodResolver(localizedDailyCloseoutSchema),
    mode: "onBlur",
    defaultValues: initialAnswers ?? {
      daySummary: "",
      weatherSummary: projectStartAnswers
        ? `${({ sunny: text("Sunny", "Zonnig"), partly_cloudy: text("Partly cloudy", "Licht bewolkt"), cloudy: text("Cloudy", "Bewolkt"), rain: text("Rain", "Regen"), heavy_rain: text("Heavy rain", "Zware regen") })[projectStartAnswers.weatherCondition]}, ${projectStartAnswers.temperatureC}°C, ${text("wind", "wind")} ${projectStartAnswers.windCondition === "strong" ? text("strong", "sterk") : projectStartAnswers.windCondition === "moderate" ? text("moderate", "matig") : text("calm", "kalm")}`
        : "",
      workOngoing: "",
      workPerformed: "",
      progressPercent: 67,
      inspectionResult: "none",
      qualityIssues: "no",
      qualityDetails: "",
      hseEvent: "none",
      hseDetails: "",
      equipmentStatus: "",
      deliveries: "",
      testsMeasurements: "",
      variationWork: "none",
      delayCause: "none",
      delayHours: 0,
      communication: "",
      risks: projectStartAnswers?.riskNotes ?? "",
      tomorrowPlan: "",
      photoCount: 0,
      attachmentsConfirmed: false,
    },
  });
  const [qualityIssues, hseEvent, delayCause, workOngoing, workPerformed, tomorrowPlan, daySummary, weatherSummary, equipmentStatus, deliveries, testsMeasurements, communication, risks] = useWatch({
    control,
    name: ["qualityIssues", "hseEvent", "delayCause", "workOngoing", "workPerformed", "tomorrowPlan", "daySummary", "weatherSummary", "equipmentStatus", "deliveries", "testsMeasurements", "communication", "risks"],
  });
  const dailySummaryOptions = [
    text("Work proceeded according to plan.", "Werk is volgens planning verlopen."),
    text("Most planned work was completed; remaining work continues tomorrow.", "Het grootste deel van het geplande werk is uitgevoerd; resterend werk gaat morgen verder."),
    text("Progress was affected by a recorded delay.", "De voortgang is beïnvloed door een geregistreerde vertraging."),
    text("Work was paused for quality or safety follow-up.", "Werk is onderbroken voor kwaliteits- of veiligheidsopvolging."),
  ];
  const qualityDetailOptions = [
    text("Finish does not meet the approved requirement.", "Afwerking voldoet niet aan de goedgekeurde eis."),
    text("Executed dimensions differ from the drawing.", "Uitgevoerde maatvoering wijkt af van de tekening."),
    text("Work is incomplete and requires repair.", "Werk is onvolledig en vraagt herstel."),
  ];
  const hseDetailOptions = [
    text("Unsafe situation was stopped and the work area was secured.", "Onveilige situatie is gestopt en de werkzone is beveiligd."),
    text("Near miss recorded; workers were instructed immediately.", "Near miss vastgelegd; medewerkers zijn direct geïnstrueerd."),
    text("Incident recorded; first response and escalation were started.", "Incident vastgelegd; eerste opvang en escalatie zijn gestart."),
  ];
  const equipmentOptions = [
    text("No equipment issue.", "Geen materieelprobleem."),
    text("Equipment was operational throughout the shift.", "Materieel was de hele dienst operationeel."),
    text("Equipment failure was recorded and followed up.", "Materieelstoring is vastgelegd en opgevolgd."),
  ];
  const deliveryOptions = [
    text("No delivery today.", "Vandaag geen levering."),
    text("Delivery received and checked.", "Levering ontvangen en gecontroleerd."),
    text("Delivery incomplete or damaged; follow-up recorded.", "Levering onvolledig of beschadigd; opvolging vastgelegd."),
  ];
  const testOptions = [
    text("No test or measurement today.", "Vandaag geen test of meting."),
    text("Tests and measurements completed and compliant.", "Testen en metingen uitgevoerd en akkoord."),
    text("A test deviation was recorded for follow-up.", "Een testafwijking is vastgelegd voor opvolging."),
  ];
  const communicationOptions = [
    text("No special agreement today.", "Vandaag geen bijzondere afspraak."),
    text("Coordination completed; agreements were recorded.", "Afstemming uitgevoerd; afspraken zijn vastgelegd."),
    text("Site instruction issued and contractor informed.", "Bouwplaatsinstructie gegeven en aannemer geïnformeerd."),
  ];
  const openRiskOptions = [
    text("No new open risks.", "Geen nieuwe open risico’s."),
    text("Weather risk remains open.", "Weerrisico blijft open."),
    text("Delivery risk remains open.", "Leveringsrisico blijft open."),
    text("Safety risk remains open.", "Veiligheidsrisico blijft open."),
  ];
  const toggleCloseoutWork = (field: "workOngoing" | "workPerformed" | "tomorrowPlan", label: string) => {
    const fieldValue = field === "workOngoing" ? workOngoing : field === "workPerformed" ? workPerformed : tomorrowPlan;
    const current = String(fieldValue).split("; ").filter(Boolean);
    const next = current.includes(label) ? current.filter((item) => item !== label) : [...current, label];
    setValue(field, next.join("; "), { shouldDirty: true, shouldValidate: true });
    if (field === "workPerformed" && !daySummary && next.length) setValue("daySummary", `${text("Work completed", "Werk uitgevoerd")}: ${next.join(", ")}.`, { shouldDirty: true, shouldValidate: true });
  };
  const stepFields: Array<Array<keyof DailyCloseoutAnswers>> = [
    ["daySummary", "weatherSummary", "workOngoing", "workPerformed", "progressPercent"],
    ["inspectionResult", "qualityIssues", "qualityDetails", "hseEvent", "hseDetails"],
    ["equipmentStatus", "deliveries", "testsMeasurements", "variationWork", "delayCause", "delayHours"],
    ["communication", "risks", "tomorrowPlan", "photoCount", "attachmentsConfirmed"],
  ];
  const stepTitles = [text("Progress & work", "Verloop & werk"), text("Quality & HSE", "Kwaliteit & HSE"), text("Logistics & delay", "Logistiek & vertraging"), text("Agreements & tomorrow", "Afspraken & morgen")];
  const nextStep = async () => {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((current) => Math.min(3, current + 1));
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal daily-questions-modal" role="dialog" aria-modal="true" aria-labelledby="daily-questions-title">
        <header className="modal-header">
          <div><h2 id="daily-questions-title">{text("Daily questions for the report", "Dagvragen voor het rapport")} · {buildingName}</h2><p>{clientReportSections.length} {text("client sections · reused across modules · step", "klantonderdelen · modulair hergebruikt · stap")} {step + 1} {text("of", "van")} 4</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <form className="modal-body daily-questions-body" onSubmit={handleSubmit(save)} noValidate>
          <BuildingPicker id="daily-questions-building" buildings={buildings} value={buildingId} onChange={onChangeBuilding} allowAll />
          <div className="question-stepper" aria-label={text("Daily questions progress", "Voortgang dagvragen")}>
            {stepTitles.map((title, index) => <span className={index === step ? "active" : index < step ? "done" : ""} key={title}><b>{index < step ? <Check size={12} /> : index + 1}</b>{title}</span>)}
          </div>

          {step === 0 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><Gauge size={18} /></span><span><h3>{text("How did the project go today?", "Hoe is het project vandaag gegaan?")}</h3><p>{text("These answers feed the summary, work performed and progress; the underlying modules remain the source.", "Deze antwoorden voeden samenvatting, werkzaamheden en voortgang; de onderliggende modules blijven de bron.")}</p></span></header>
              <div className="form-grid two-columns">
                <div className="quick-issue-presets wide" aria-label={text("Choose a daily summary", "Kies een dagsamenvatting")}>{dailySummaryOptions.map((option) => <button className={daySummary === option ? "active" : ""} type="button" onClick={() => setValue("daySummary", option, { shouldDirty: true, shouldValidate: true })} key={option}>{option}</button>)}</div>
                {errors.daySummary ? <small className="field-error wide">{errors.daySummary.message}</small> : null}
                <details className="optional-text-entry wide">
                  <summary>{text("Different daily summary", "Andere dagsamenvatting")}</summary>
                  <label className="form-field"><span>{text("Daily summary *", "Samenvatting van de dag *")}</span><textarea rows={4} placeholder={text("Summarize what happened in no more than five lines.", "Vat in maximaal vijf regels samen wat er is gebeurd.")} {...register("daySummary")} /><DictateButton onText={(transcript) => setValue("daySummary", appendDictation(getValues("daySummary") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label>
                </details>
                <div className="derived-answer">
                  <span>{text("Actual weather · automatic", "Werkelijk weer · automatisch")}</span>
                  <strong><CloudSun size={15} /> {weatherSummary || text("Weather is loaded from the project start.", "Weer wordt overgenomen van de projectstart.")}</strong>
                  {errors.weatherSummary ? <small className="field-error">{errors.weatherSummary.message}</small> : null}
                  <details className="optional-text-entry">
                    <summary>{text("Correct weather", "Weer corrigeren")}</summary>
                    <label className="form-field"><span>{text("Weather correction", "Weercorrectie")}</span><input type="text" {...register("weatherSummary")} /></label>
                  </details>
                </div>
                <label className="form-field"><span>{text("Project progress", "Voortgang project")}</span><span className="input-with-unit"><input type="number" min="0" max="100" {...register("progressPercent", { valueAsNumber: true })} /><em>%</em></span>{errors.progressPercent ? <small className="field-error">{errors.progressPercent.message}</small> : null}</label>
                <div className="click-answer-block wide">
                  <strong>{text("Work ongoing at day end", "Werk lopend aan het einde van de dag")}</strong>
                  <small>{text("Select work that started but was not yet completed.", "Kies werkzaamheden die zijn gestart maar nog niet zijn afgerond.")}</small>
                  <div className="work-option-grid" aria-label={text("Choose ongoing work", "Kies lopend werk")}>{constructionWorkOptions.map((option) => { const label = language === "en" ? option.en : option.nl; const active = String(workOngoing).split("; ").includes(label); return <button className={active ? "active" : ""} type="button" aria-pressed={active} onClick={() => toggleCloseoutWork("workOngoing", label)} key={option.en}>{active ? <Check size={14} /> : <Plus size={14} />}{label}</button>; })}</div>
                  <details className="optional-text-entry">
                    <summary>{text("Other ongoing work", "Ander lopend werk")}</summary>
                    <label className="form-field"><textarea rows={3} {...register("workOngoing")} /><DictateButton onText={(transcript) => setValue("workOngoing", appendDictation(getValues("workOngoing") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label>
                  </details>
                </div>
                <div className="click-answer-block wide">
                  <strong>{text("Work completed today *", "Werk vandaag afgerond *")}</strong>
                  <small>{text("Select the work that was actually completed today.", "Kies de werkzaamheden die vandaag daadwerkelijk zijn afgerond.")}</small>
                  <div className="work-option-grid" aria-label={text("Choose completed work", "Kies afgerond werk")}>{constructionWorkOptions.map((option) => { const label = language === "en" ? option.en : option.nl; const active = String(workPerformed).split("; ").includes(label); return <button className={active ? "active" : ""} type="button" aria-pressed={active} onClick={() => toggleCloseoutWork("workPerformed", label)} key={option.en}>{active ? <Check size={14} /> : <Plus size={14} />}{label}</button>; })}</div>
                </div>
                {errors.workPerformed ? <small className="field-error wide">{errors.workPerformed.message}</small> : null}
                <details className="optional-text-entry wide">
                  <summary>{text("Other completed work", "Andere uitgevoerde werkzaamheden")}</summary>
                  <label className="form-field"><span>{text("Only add work that is not listed above", "Voeg alleen werk toe dat hierboven niet staat")}</span><textarea rows={4} {...register("workPerformed")} /><DictateButton onText={(transcript) => setValue("workPerformed", appendDictation(getValues("workPerformed") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label>
                </details>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><ShieldCheck size={18} /></span><span><h3>{text("What was checked and were there deviations?", "Wat is gecontroleerd en waren er afwijkingen?")}</h3><p>{text("Failed answers are only proposed as a draft finding or HSE record; the supervisor confirms severity and follow-up.", "Niet-akkoord antwoorden worden alleen als conceptbevinding of HSE-melding voorgesteld; de supervisor bevestigt ernst en vervolg.")}</p></span></header>
              <div className="form-grid two-columns">
                <label className="form-field"><span>{text("Inspections performed", "Inspecties uitgevoerd")}</span><select {...register("inspectionResult")}><option value="none">{text("No inspection", "Geen inspectie")}</option><option value="all_ok">{text("Performed · all passed", "Uitgevoerd · alles akkoord")}</option><option value="issues">{text("Performed · deviation found", "Uitgevoerd · afwijking gevonden")}</option></select></label>
                <label className="form-field"><span>{text("Quality findings?", "Kwaliteitsbevindingen?")}</span><select {...register("qualityIssues")}><option value="no">{text("No", "Nee")}</option><option value="yes">{text("Yes", "Ja")}</option></select></label>
                {qualityIssues === "yes" ? <div className="wide"><div className="quick-issue-presets" aria-label={text("Choose a quality finding", "Kies een kwaliteitsbevinding")}>{qualityDetailOptions.map((option) => <button type="button" onClick={() => setValue("qualityDetails", option, { shouldDirty: true, shouldValidate: true })} key={option}>{option}</button>)}</div>{errors.qualityDetails ? <small className="field-error">{errors.qualityDetails.message}</small> : null}<details className="optional-text-entry"><summary>{text("Different quality finding", "Andere kwaliteitsbevinding")}</summary><label className="form-field"><span>{text("Location, finding and responsible party *", "Locatie, bevinding en verantwoordelijke *")}</span><textarea rows={4} {...register("qualityDetails")} /><DictateButton onText={(transcript) => setValue("qualityDetails", appendDictation(getValues("qualityDetails") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label></details></div> : null}
                <label className="form-field"><span>{text("Safety event?", "Veiligheidsgebeurtenis?")}</span><select {...register("hseEvent")}><option value="none">{text("No incident / near miss", "Geen incident / near miss")}</option><option value="near_miss">Near miss</option><option value="incident">Incident</option></select></label>
                {hseEvent !== "none" ? <div className="wide"><div className="quick-issue-presets" aria-label={text("Choose an HSE description", "Kies een HSE-omschrijving")}>{hseDetailOptions.map((option) => <button type="button" onClick={() => setValue("hseDetails", option, { shouldDirty: true, shouldValidate: true })} key={option}>{option}</button>)}</div>{errors.hseDetails ? <small className="field-error">{errors.hseDetails.message}</small> : null}<details className="optional-text-entry"><summary>{text("Different HSE event", "Andere HSE-gebeurtenis")}</summary><label className="form-field"><span>{text("Event and immediate measure *", "Gebeurtenis en directe maatregel *")}</span><textarea rows={4} {...register("hseDetails")} /><DictateButton onText={(transcript) => setValue("hseDetails", appendDictation(getValues("hseDetails") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label></details></div> : null}
              </div>
              <div className="question-module-note"><AlertTriangle size={14} /><span>{text("The app never closes an incident, NCR or repair autonomously. This remains a human action.", "De app sluit nooit autonoom een incident, NCR of herstel. Dit blijft een menselijke handeling.")}</span></div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><PackageCheck size={18} /></span><span><h3>{text("Which logistics, tests or delays affected the day?", "Welke logistiek, testen of vertraging speelden mee?")}</h3><p>{text("Answers are linked to equipment, deliveries, measurements, variation work and delay.", "Antwoorden worden gekoppeld aan materieel, leveringen, metingen, meer-/minderwerk en vertraging.")}</p></span></header>
              <div className="form-grid two-columns">
                <div className="click-answer-block"><strong>{text("Equipment and status", "Materieel en status")}</strong><div className="quick-issue-presets">{equipmentOptions.map((option) => <button className={equipmentStatus === option ? "active" : ""} type="button" onClick={() => setValue("equipmentStatus", option, { shouldDirty: true, shouldValidate: true })} key={option}>{option}</button>)}</div><details className="optional-text-entry"><summary>{text("Other equipment status", "Andere materieelstatus")}</summary><label className="form-field"><textarea rows={3} {...register("equipmentStatus")} /><DictateButton onText={(transcript) => setValue("equipmentStatus", appendDictation(getValues("equipmentStatus") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label></details></div>
                <div className="click-answer-block"><strong>{text("Materials delivered", "Materialen geleverd")}</strong><div className="quick-issue-presets">{deliveryOptions.map((option) => <button className={deliveries === option ? "active" : ""} type="button" onClick={() => setValue("deliveries", option, { shouldDirty: true, shouldValidate: true })} key={option}>{option}</button>)}</div><details className="optional-text-entry"><summary>{text("Other delivery detail", "Andere leveringsinformatie")}</summary><label className="form-field"><textarea rows={3} {...register("deliveries")} /><DictateButton onText={(transcript) => setValue("deliveries", appendDictation(getValues("deliveries") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label></details></div>
                <div className="click-answer-block wide"><strong>{text("Tests and measurements", "Testen en meetwaarden")}</strong><div className="quick-issue-presets">{testOptions.map((option) => <button className={testsMeasurements === option ? "active" : ""} type="button" onClick={() => setValue("testsMeasurements", option, { shouldDirty: true, shouldValidate: true })} key={option}>{option}</button>)}</div><details className="optional-text-entry"><summary>{text("Add a numeric test result", "Numerieke testwaarde toevoegen")}</summary><label className="form-field"><span>{text("Test name, value and unit", "Testnaam, waarde en eenheid")}</span><textarea rows={3} placeholder={text("Example: slump 90 mm", "Bijvoorbeeld: slump 90 mm")} {...register("testsMeasurements")} /><DictateButton onText={(transcript) => setValue("testsMeasurements", appendDictation(getValues("testsMeasurements") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label></details></div>
                <label className="form-field"><span>{text("Variation work", "Meer- of minderwerk")}</span><select {...register("variationWork")}><option value="none">{text("Not applicable", "Niet van toepassing")}</option><option value="pending">{text("Pending", "In behandeling")}</option><option value="approved">{text("Approved", "Goedgekeurd")}</option><option value="rejected">{text("Rejected", "Afgewezen")}</option></select></label>
                <label className="form-field"><span>{text("Was there a delay?", "Was er vertraging?")}</span><select {...register("delayCause")}><option value="none">{text("No delay", "Geen vertraging")}</option><option value="weather">{text("Weather", "Weer")}</option><option value="delivery">{text("Late delivery", "Levering te laat")}</option><option value="material">{text("Material shortage", "Materiaaltekort")}</option><option value="equipment">{text("Equipment failure", "Materieelstoring")}</option><option value="other">{text("Other cause", "Andere oorzaak")}</option></select></label>
                {delayCause !== "none" ? <label className="form-field"><span>{text("Time lost", "Tijdverlies")}</span><span className="input-with-unit"><input type="number" min="0" max="24" step="0.25" {...register("delayHours", { valueAsNumber: true })} /><em>{text("hours", "uur")}</em></span>{errors.delayHours ? <small className="field-error">{errors.delayHours.message}</small> : null}</label> : null}
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><CalendarDays size={18} /></span><span><h3>{text("What was agreed and what is planned for tomorrow?", "Wat is afgesproken en wat staat morgen gepland?")}</h3><p>{text("Agreements, risks and planning remain structured and carry over to the next day.", "Afspraken, risico’s en planning blijven gestructureerd en worden meegenomen naar de volgende dag.")}</p></span></header>
              <div className="form-grid two-columns">
                <div className="click-answer-block"><strong>{text("Communication and agreements", "Communicatie en gemaakte afspraken")}</strong><div className="quick-issue-presets">{communicationOptions.map((option) => <button className={communication === option ? "active" : ""} type="button" onClick={() => setValue("communication", option, { shouldDirty: true, shouldValidate: true })} key={option}>{option}</button>)}</div><details className="optional-text-entry"><summary>{text("Other agreement", "Andere afspraak")}</summary><label className="form-field"><textarea rows={4} {...register("communication")} /><DictateButton onText={(transcript) => setValue("communication", appendDictation(getValues("communication") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label></details></div>
                <div className="click-answer-block"><strong>{text("Open risks", "Open risico’s")}</strong><div className="quick-issue-presets">{openRiskOptions.map((option) => <button className={risks === option ? "active" : ""} type="button" onClick={() => setValue("risks", option, { shouldDirty: true, shouldValidate: true })} key={option}>{option}</button>)}</div><details className="optional-text-entry"><summary>{text("Other open risk", "Ander open risico")}</summary><label className="form-field"><textarea rows={4} {...register("risks")} /><DictateButton onText={(transcript) => setValue("risks", appendDictation(getValues("risks") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label></details></div>
                <div className="work-option-grid wide" aria-label={text("Choose tomorrow's work", "Kies werkzaamheden voor morgen")}>{constructionWorkOptions.map((option) => { const label = language === "en" ? option.en : option.nl; const active = String(tomorrowPlan).split("; ").includes(label); return <button className={active ? "active" : ""} type="button" aria-pressed={active} onClick={() => toggleCloseoutWork("tomorrowPlan", label)} key={option.en}>{active ? <Check size={14} /> : <Plus size={14} />}{label}</button>; })}</div>
                {errors.tomorrowPlan ? <small className="field-error wide">{errors.tomorrowPlan.message}</small> : null}
                <details className="optional-text-entry wide"><summary>{text("Other work for tomorrow", "Andere werkzaamheden voor morgen")}</summary><label className="form-field"><textarea rows={4} {...register("tomorrowPlan")} /><DictateButton onText={(transcript) => setValue("tomorrowPlan", appendDictation(getValues("tomorrowPlan") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label></details>
                <label className="form-field"><span>{text("Number of photos today", "Aantal foto’s vandaag")}</span><input type="number" min="0" {...register("photoCount", { valueAsNumber: true })} /></label>
                <label className="confirmation-check wide"><input type="checkbox" {...register("attachmentsConfirmed")} /><span><strong>{text("Attachments checked", "Bijlagen gecontroleerd")}</strong><small>{text("Inspection forms, certificates, tickets, drawings, NCRs and measurement reports were checked; missing items remain visible.", "Inspectieformulieren, certificaten, bonnen, tekeningen, NCR’s en meetrapporten zijn bekeken; ontbrekende stukken blijven zichtbaar.")}</small>{errors.attachmentsConfirmed ? <em className="field-error">{errors.attachmentsConfirmed.message}</em> : null}</span></label>
              </div>
            </section>
          ) : null}

          <div className="modal-actions daily-question-actions">
            <span className="form-note"><CheckCircle2 size={13} /> {text("After server confirmation, answers are reused centrally in the cockpit and report review.", "Na serverbevestiging worden antwoorden centraal hergebruikt in cockpit en rapportcontrole.")}</span>
            <div>
              {step > 0 ? <button className="ghost-button" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={14} /> {text("Previous", "Vorige")}</button> : null}
              {step < 3 ? <button className="primary-button" type="button" onClick={nextStep}>{text("Next questions", "Volgende vragen")} <ArrowRight size={14} /></button> : <button className="primary-button" type="submit">{text("Confirm daily questions", "Dagvragen bevestigen")} <Check size={14} /></button>}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReportModal({
  close,
  completedTodos,
  entries,
  attendanceTotal,
  projectName,
  reportNumber,
  reportStatus,
  dailyCloseoutAnswers,
  buildings,
  startChecks,
  closeouts,
  onDownload,
  onDownloadDocx,
  onSubmit,
}: {
  close: () => void;
  completedTodos: number[];
  entries: TimelineEntry[];
  attendanceTotal: number;
  projectName: string;
  reportNumber: string;
  reportStatus: string;
  dailyCloseoutAnswers: DailyCloseoutAnswers | null;
  buildings: BuildingContext[];
  startChecks: Array<Record<string, unknown>>;
  closeouts: Array<Record<string, unknown>>;
  onDownload: () => void | Promise<void>;
  onDownloadDocx: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
}) {
  const { text } = useLanguage();
  const hseComplete = completedTodos.includes(2) || Boolean(dailyCloseoutAnswers);
  const tomorrowComplete = completedTodos.includes(3) || Boolean(dailyCloseoutAnswers?.tomorrowPlan);
  const buildingsMissing = buildings.filter((building) => !startChecks.some((row) => row.building_id === building.id) || !closeouts.some((row) => row.building_id === building.id));
  const checks = [
    { title: text("Project and report details", "Project- en rapportgegevens"), detail: text("Number, date, shift and buildings", "Nummer, datum, dienst en gebouwen"), complete: true },
    { title: text("Attendance and activities", "Aanwezigheid en activiteiten"), detail: text(`${attendanceTotal} people and ${entries.length} daily records`, `${attendanceTotal} personen en ${entries.length} dagregistraties`), complete: true },
    { title: text("Inspections and findings", "Inspecties en bevindingen"), detail: text(`${entries.filter((entry) => entry.kind === "inspection").length} inspections · ${entries.filter((entry) => entry.badgeTone === "red").length} critical record(s)`, `${entries.filter((entry) => entry.kind === "inspection").length} inspecties · ${entries.filter((entry) => entry.badgeTone === "red").length} kritieke registratie(s)`), complete: true },
    { title: text("Daily questions in the client format", "Dagvragen volgens klantformat"), detail: dailyCloseoutAnswers ? text("Progress, weather, logistics, risks and tomorrow confirmed", "Verloop, weer, logistiek, risico's en morgen bevestigd") : text("Four guided question groups still need completion", "Vier begeleide vraaggroepen nog invullen"), complete: Boolean(dailyCloseoutAnswers) },
    { title: text("Daily HSE check", "HSE-dagcheck"), detail: hseComplete ? text("All checkpoints completed", "Alle controlepunten ingevuld") : text("3 checkpoints are still missing", "Nog 3 controlepunten ontbreken"), complete: hseComplete },
    { title: text("Tomorrow's plan", "Planning voor morgen"), detail: tomorrowComplete ? text("The plan is confirmed", "Planning is bevestigd") : text("Not completed yet", "Nog niet ingevuld"), complete: tomorrowComplete },
    { title: text("Start check and closeout for every building", "Projectstart en dagafsluiting per gebouw"), detail: buildingsMissing.length === 0 ? text("Every building has confirmed its start check and closeout", "Elk gebouw heeft een bevestigde projectstart en dagafsluiting") : text(`Still missing for: ${buildingsMissing.map((building) => building.name).join(", ")}`, `Nog niet compleet voor: ${buildingsMissing.map((building) => building.name).join(", ")}`), complete: buildingsMissing.length === 0 },
  ];
  const missing = checks.filter((check) => !check.complete).length;
  const submitted = ["ready_for_review", "in_review", "approved"].includes(reportStatus);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header className="modal-header">
          <div><h2 id="report-title">{text("Review report", "Rapport controleren")}</h2><p>{reportNumber} · {submitted ? text("submitted", "ingediend") : text("draft version", "conceptversie")}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="report-check-list">
            {checks.map((check) => (
              <div className="report-check-row" key={check.title}>
                <span className={`report-check-state ${check.complete ? "complete" : "missing"}`}>{check.complete ? <Check size={15} /> : <AlertTriangle size={15} />}</span>
                <span className="report-check-copy"><strong>{check.title}</strong><span>{check.detail}</span></span>
                <span className="report-check-label">{check.complete ? text("Complete", "Compleet") : text("Complete item", "Aanvullen")}</span>
              </div>
            ))}
          </div>
          <div className="report-summary-box">
            <label htmlFor="summary">{text("Proposed daily summary", "Voorgestelde dagsamenvatting")}</label>
            <textarea id="summary" defaultValue={dailyCloseoutAnswers?.daySummary ?? text(`${attendanceTotal} people were present at project ${projectName}. ${entries.length} central daily records were captured.`, `Er waren ${attendanceTotal} personen aanwezig op project ${projectName}. Er zijn ${entries.length} centrale dagregistraties vastgelegd.`)} />
            <small className="summary-source">{text("Fixed summary based on confirmed daily questions and module data; the supervisor reviews the text.", "Vaste samenvatting op basis van bevestigde dagvragen en modulegegevens; supervisor controleert de tekst.")}</small>
          </div>
          <div className="modal-actions">
            <span style={{ color: missing ? "var(--yellow)" : "var(--green)", fontSize: 10, fontWeight: 680 }}>{missing ? text(`${missing} item(s) still need completion`, `${missing} onderdeel${missing > 1 ? "en" : ""} nog aanvullen`) : text("All checks passed", "Alle controles geslaagd")}</span>
            <div className="report-action-buttons">
              <ReportDownloadButtons disabled={missing > 0} onDownloadPdf={onDownload} onDownloadWord={onDownloadDocx} />
              <button className="primary-button" type="button" disabled={missing > 0 || submitted} onClick={onSubmit}>{submitted ? text("Submitted", "Ingediend") : text("Ready for review", "Gereed voor review")} <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
