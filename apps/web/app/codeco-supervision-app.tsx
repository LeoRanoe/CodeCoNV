"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  FileText,
  HardDrive,
  Home,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share,
  ShieldCheck,
  Trash2,
  Users,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ALL_BUILDINGS, BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { actionStatusLabels as canonicalActionStatusLabels, labelMap, priorityText } from "@/lib/status-labels";
import { screenFromSearch, useScreenHistory, type AppScreen } from "@/lib/navigation/app-history";
import { DictateButton, appendDictation } from "@/app/dictate-button";
import { photoTitle, photoUploadDescription } from "@/app/photo-evidence";
import { ClientDashboard } from "@/app/client-dashboard";
import { DailyLogForm } from "@/app/daily-log-modal";
import { LiveWeatherChip } from "@/app/live-weather-chip";
import { LocationPicker, locationBreadcrumb, type ProjectLocationOption } from "@/app/location-picker";
import { FieldGuide } from "@/app/field-guide";
import { OperationalWorkspace, type DailyFormRenderers } from "@/app/operational-workspace";
import type { ActionCenterView } from "@/app/project-action-center";
import { ReportDownloadButtons } from "@/app/report-download-buttons";
import { ensureDailyBackup } from "@/lib/backups/client";
import { constructionDisciplines } from "@/lib/forms/disciplines";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { ProjectPermissionsProvider, useProjectPermissionsQuery } from "@/lib/permissions/project-permissions";
import { startCompassWatch } from "@/lib/images/compass";
import { normalizeImageFile } from "@/lib/images/normalize-image";
import { WorkforceForm } from "@/app/workforce-register";
import { requestProjectNotificationDispatch } from "@/lib/notifications/client";
import { currentPushState, enablePushNotifications, type PushState } from "@/lib/notifications/push-client";
import { compressFieldPhoto, dataSaverEnabled, forceSyncOfflineUploads, queueOfflineUpload, syncOfflineUploads } from "@/lib/offline/upload-queue";
import { clearFormDraft, formDraftKey, loadFormDraft } from "@/lib/offline/form-drafts";
import { useFormAutosave } from "@/lib/offline/use-form-autosave";
import { DraftNotice } from "@/app/forms/draft-notice";
import { cacheProjectDay, cacheWorkspace, getCachedProjectDay, getCachedWorkspace } from "@/lib/offline/workspace-cache";
import { loadWithOfflineCache } from "@/lib/offline/query-cache";
import { isPendingRecordId, listOfflineRecords, saveRecordOnlineOrQueue, syncOfflineRecords } from "@/lib/offline/record-queue";
import { withPendingActions } from "@/lib/offline/pending-records";
import { offlineQueryKeys } from "@/lib/offline/query-keys";
import { getSessionWithOfflineFallback, storedSessionOnThisDevice } from "@/lib/supabase/offline-session";
import { isSessionRejected } from "@/lib/supabase/session-rejection.mjs";
import { OfflineManagerModal } from "@/app/offline-manager";
import {
  discardUnsentWork,
  prepareOfflineStorageForUser,
  releaseOfflineStorageOnSignOut,
  unsentWorkCount,
} from "@/lib/offline/account-isolation";
import { setActiveOfflineUser } from "@/lib/offline/idb";
import { userFacingError } from "@/lib/user-facing-error";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { validAccessToken } from "@/lib/supabase/access-token";
import {
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
  loadProjectRecentPhotos,
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

type ProjectTabKey = "home" | "inspections" | "findings" | "ncr" | "hse" | "daily" | "workforce" | "documents" | "registers" | "visual" | "drawings" | "tools" | "files" | "assets";
const navKeys: NavKey[] = ["vandaag", "project", "acties", "projectdocs", "punchlist", "verify", "rapporten", "meer"];
const projectTabKeys: ProjectTabKey[] = ["home", "inspections", "findings", "ncr", "hse", "daily", "workforce", "documents", "registers", "visual", "drawings", "tools", "files", "assets"];
type ModalKey = "action_create" | "action_detail" | "report" | "project_start" | "user_admin" | "notifications" | "manage_buildings" | "switch_project" | "offline" | null;
/** The dialogs a back press or an address may reopen: those that need no record in hand. */
const restorableModals: Array<Exclude<ModalKey, null>> = ["action_create", "report", "project_start", "user_admin", "notifications", "manage_buildings", "switch_project", "offline"];
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

type ProjectContext = WorkspaceProject;
type BuildingContext = WorkspaceBuilding;

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

type AttendanceRow = {
  id: string;
  partyId: string;
  party: string;
  discipline: string;
  count: number;
  shiftStart: string;
  shiftEnd: string;
  crew?: string;
};

const navigation: { id: NavKey; label: string; icon: LucideIcon; badge?: string }[] = [
  { id: "vandaag", label: "Overzicht", icon: Home },
  { id: "project", label: "Werkruimte", icon: LayoutDashboard },
  { id: "acties", label: "Acties", icon: ClipboardCheck },
  /* Project Docs and Issues used to stand here as well. Both are workspace modules with their
     own way in on the workspace itself, so the bar offered the same screen twice. Their keys
     stay known, so an older address or back press still lands on the module. */
  { id: "verify", label: "Rapid Verify", icon: Search },
  { id: "rapporten", label: "Rapporten", icon: FileText },
  { id: "meer", label: "Instellingen", icon: Settings },
];

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

const actionStatusLabels = labelMap(canonicalActionStatusLabels, "nl") as Record<ProjectAction["status"], string>;
const actionStatusLabelsEnglish = labelMap(canonicalActionStatusLabels, "en") as Record<ProjectAction["status"], string>;

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
    delayReason: String(row.delay_reason ?? ""),
    contractorCompany: String(row.contractor_company ?? ""),
    contractorSignedBy: String(row.contractor_signed_by ?? ""),
    contractorSignedAt: String(row.contractor_signed_at ?? ""),
    contractorSignatureImage: String(row.contractor_signature_image ?? ""),
    signedBy: String(row.signed_by ?? ""),
    signedAt: String(row.signed_at ?? ""),
    signatureImage: String(row.signature_image ?? ""),
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
  // A visitor is on site but is not manning the work, so it never joins the counted crew.
  const buildingAttendance = day.attendance.filter((row) => row.building_id === buildingId
    && (row.entry_type ?? "workforce") === "workforce");
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
        crew: row.crew ? String(row.crew) : undefined,
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
  const [initialProjectTab, setInitialProjectTab] = useState<ProjectTabKey>("home");
  /** Which block the daily log opens on: the whole day, or the delay it was asked for. */
  /** Which record a shortcut promised, so the module opens on it and not on the last one. */
  const [projectTabPreset, setProjectTabPreset] = useState<{ registerType?: string; hseEventType?: string; dailyWorkView?: "works_ongoing" | "works_completed" | "delays" | "day" } | undefined>(undefined);
  const quickCameraInputRef = useRef<HTMLInputElement>(null);
  const dailyBackupCheckRef = useRef("");
  const [pendingQuickPhotos, setPendingQuickPhotos] = useState<File[]>([]);
  /** Day-log photos already in the upload queue, so retrying a save never files them twice. */
  const queuedDailyLogPhotos = useRef(new Set<string>());
  const [externalSubmissionIntent, setExternalSubmissionIntent] = useState(false);
  /** Which view the action centre opens on; the deadline tile asks for the deadlines. */
  const [actionCenterView, setActionCenterView] = useState<ActionCenterView>("work");
  /**
   * The record the action centre sent the user to. It is a detail inside a screen, not a
   * screen of its own, so it stays out of the history and out of the address.
   */
  const [focusRecordId, setFocusRecordId] = useState("");
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [projectStartAnswers, setProjectStartAnswers] = useState<ProjectStartAnswers | null>(null);
  const [dailyCloseoutAnswers, setDailyCloseoutAnswers] = useState<DailyCloseoutAnswers | null>(null);
  /**
   * Set once the day of the open project has been read into the screen. The day log and the
   * workforce form wait for it: a form that opened a moment earlier started empty, and saving
   * it would have overwritten the day that was already recorded.
   */
  const [dayHydrated, setDayHydrated] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ProjectAction | null>(null);
  const [toast, setToast] = useState("");
  /** Set while the user is deciding what happens to work that has not been sent yet. */
  const [signOutPrompt, setSignOutPrompt] = useState<{ unsent: number } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const reportDate = reportDateInSuriname();

  const workspaceQuery = useQuery({
    queryKey: ["workspace", session?.user.id],
    queryFn: async () => {
      try {
        const data = await loadWorkspace(supabase as SupabaseClient);
        await cacheWorkspace(session!.user.id, data).catch(() => undefined);
        return data;
      } catch (error) {
        // The copy on the device is for a server that cannot be reached. A server that answered
        // and refused the session (account removed or suspended, session revoked) ends it:
        // showing that account's projects as live would be the opposite of what the refusal says.
        if (isSessionRejected(error)) {
          await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
          throw error;
        }
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
          setToast(text(`${recordResult.synced} record(s) sent.`, `${recordResult.synced} registratie(s) verzonden.`));
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
            `${result.failed} field upload(s) still need attention. Open Photos and tap Send now.`,
            `${result.failed} veldupload(s) vragen nog aandacht. Open Foto’s en tik op Nu verzenden.`,
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

  const permissions = useProjectPermissionsQuery(supabase as SupabaseClient | null, session?.user.id, selectedProject?.id);

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

  /**
   * The explanation already given today for a deviating manning level. It is written on every
   * attendance line of the day, so the first line that carries one is the answer.
   */
  const attendanceNote = String((dayQuery.data?.attendance ?? [])
    .find((row) => String(row.building_id) === selectedBuilding?.id && row.notes)?.notes ?? "");
  /** The site visits already recorded today, kept apart from the counted crew. */
  const attendanceVisitors = (dayQuery.data?.attendance ?? [])
    .filter((row) => String(row.building_id) === selectedBuilding?.id && row.entry_type === "visitor")
    .map((row) => ({
      partyId: String(row.party_id),
      party: (dayQuery.data?.parties ?? []).find((party) => party.id === String(row.party_id))?.name ?? "",
      visitorName: String(row.visitor_name ?? ""),
      count: Number(row.headcount) || 1,
      shiftStart: String(row.shift_start).slice(0, 5),
      shiftEnd: String(row.shift_end).slice(0, 5),
    }));

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

  /* The dashboard's photo panel reads the project's own pictures, not the day's timeline:
     a project full of photos showed four empty placeholders because no photo had been
     filed as a field registration today. */
  const recentPhotosQuery = useQuery({
    queryKey: ["project-recent-photos", selectedProject?.id],
    queryFn: () => loadWithOfflineCache(
      offlineQueryKeys.projectRecentPhotos(selectedProject!.id),
      () => loadProjectRecentPhotos(supabase as SupabaseClient, selectedProject!.id),
    ),
    enabled: Boolean(supabase && session && selectedProject),
    staleTime: 60_000,
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
  const onlineStorageStatus = syncState === "saving"
    ? text("Saving centrally…", "Centraal opslaan…")
    : syncState === "error"
      ? text("Save failed · try again", "Opslaan mislukt · probeer opnieuw")
      : syncState === "saved"
        ? text("Saved centrally", "Centraal opgeslagen")
        : text("Live workspace · synchronized", "Live werkruimte · gesynchroniseerd");
  // A module whose records the user may not read would only ever be an empty page.
  const navAllowed = (id: NavKey) => id === "acties" ? permissions.canAny("actions.read", "actions.create")
    : id === "projectdocs" || id === "verify" ? permissions.can("files.read")
      : id === "punchlist" ? permissions.can("findings.read")
        : id === "rapporten" ? permissions.canAny("reports.read", "reports.readapproved")
          : true;
  const localizedNavigation = navigation.filter((item) => navAllowed(item.id)).map((item) => ({
    ...item,
    label: ({
      vandaag: text("Overview", "Overzicht"),
      project: text("Workspace", "Werkruimte"),
      acties: text("Actions", "Acties"),
      projectdocs: "Project Docs",
      punchlist: "Issues",
      verify: "Rapid Verify",
      rapporten: text("Reports", "Rapporten"),
      meer: canManageMembers ? text("Management", "Management") : text("Settings", "Instellingen"),
    } satisfies Record<NavKey, string>)[item.id],
  }));

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
    // Device storage is scoped to the account before anything cached can be shown: on a
    // shared device the previous account's readable copy is removed first.
    const scopeOfflineStorage = async (nextSession: Session | null) => {
      if (!nextSession) {
        setActiveOfflineUser(null);
        return;
      }
      await prepareOfflineStorageForUser(nextSession.user.id).catch(() => setActiveOfflineUser(nextSession.user.id));
    };
    void getSessionWithOfflineFallback(supabase).then(async (nextSession) => {
      await scopeOfflineStorage(nextSession);
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
      void scopeOfflineStorage(nextSession).then(() => {
        if (!active) return;
        setSession(nextSession);
        setAuthReady(true);
        if (!nextSession) {
          setPasswordRecovery(false);
          setSelectedProject(null);
          setSelectedBuilding(null);
          setWorkspaceStage("projects");
        }
      });
    });
    return () => {
      active = false;
      window.clearTimeout(authTimeout);
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  /**
   * Signing out hands the device to whoever signs in next. The readable project copy is
   * removed first; unsent work stays on the device for this account unless the user chose to
   * discard it. The page is reloaded afterwards so nothing of this account survives in memory.
   */
  const performSignOut = useCallback(async (options: { discardUnsent: boolean }) => {
    if (!supabase) return;
    setSigningOut(true);
    const userId = session?.user.id;
    try {
      if (options.discardUnsent && userId) await discardUnsentWork(userId);
      await releaseOfflineStorageOnSignOut();
    } catch {
      // A storage failure must not keep someone signed in on a device they are handing over.
    }
    queryClient.clear();
    const result = await supabase.auth.signOut().catch((error: unknown) => ({ error }));
    // Without a connection the server cannot revoke the session; the local copy still goes.
    if (result.error) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.replace(window.location.pathname);
  }, [queryClient, session, supabase]);

  const requestSignOut = useCallback(async () => {
    const unsent = session ? await unsentWorkCount(session.user.id).catch(() => 0) : 0;
    if (unsent > 0) {
      setSignOutPrompt({ unsent });
      return;
    }
    await performSignOut({ discardUnsent: false });
  }, [performSignOut, session]);

  // A screen reader hears the connection change; the sync chip alone is only text on a button.
  const [connectivityNote, setConnectivityNote] = useState("");
  const connectivitySeen = useRef(false);
  useEffect(() => {
    if (!connectivitySeen.current) {
      connectivitySeen.current = true;
      return;
    }
    setConnectivityNote(isOnline
      ? (language === "en" ? "Back online." : "Weer online.")
      : (language === "en" ? "No connection. Work is saved on this device." : "Geen verbinding. Werk wordt op dit apparaat bewaard."));
  }, [isOnline, language]);

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
      setDayHydrated(true);

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
  /**
   * Without a connection the header says what is true: registrations written now are kept
   * on this device and counted here. It used to say "not saved" even while they were.
   */
  const waitingOnDevice = (pendingRecordsQuery.data ?? []).length;
  const storageStatus = isOnline
    ? onlineStorageStatus
    : waitingOnDevice
      ? text(
        `No connection · ${waitingOnDevice} waiting on this device`,
        `Geen verbinding · ${waitingOnDevice} ${waitingOnDevice === 1 ? "registratie wacht" : "registraties wachten"} op dit apparaat`,
      )
      : text("No connection · working from this device", "Geen verbinding · je werkt vanaf dit apparaat");

  const runSynced = async <T,>(
    operation: () => Promise<T>,
    successMessage: string,
    // A registration that can wait on the device is allowed to run without a connection;
    // everything that changes an existing central record is not.
    options: { offlineCapable?: boolean } = {},
  ): Promise<T | null> => {
    if (!isOnline && !options.offlineCapable) {
      setSyncState("error");
      setToast(text("No connection. Your input stays in this form.", "Geen verbinding. Je invoer blijft in dit formulier."));
      return null;
    }
    const queuedBefore = selectedProject ? (await listOfflineRecords(selectedProject.id).catch(() => [])).length : 0;
    setSyncState("saving");
    try {
      const result = await operation();
      if (selectedProject && supabase && isOnline) await requestProjectNotificationDispatch(supabase, selectedProject.id).catch(() => false);
      const queuedAfter = selectedProject ? (await listOfflineRecords(selectedProject.id).catch(() => [])).length : 0;
      // Show what now waits on this device straight away. The list also polls, but a record
      // that only appears twenty seconds after "Save" reads as a record that was lost.
      if (selectedProject && queuedAfter !== queuedBefore) {
        await queryClient.invalidateQueries({ queryKey: ["offline-records", selectedProject.id] });
      }
      setSyncState(queuedAfter > queuedBefore ? "idle" : "saved");
      setToast(queuedAfter > queuedBefore
        ? text("Saved on this device. Sent when you're online.", "Opgeslagen op dit apparaat. Wordt verstuurd zodra je online bent.")
        : successMessage);
      // Callers test the result for truth to know the save succeeded; an operation that
      // returns nothing (Promise<void>) must not read as a failure, or the dialog stays open
      // after a successful save — which is exactly what the daily questions did.
      return (result === undefined ? true : result) as T;
    } catch (error) {
      setSyncState("error");
      setToast(userFacingError(error, text));
      return null;
    }
  };

  const openQuickAdd = () => {
    // The tap that opens the camera is also the moment a phone will hand out its compass, so
    // the photo can say by itself which way it was facing.
    void startCompassWatch();
    quickCameraInputRef.current?.click();
  };

  const receiveQuickCameraPhoto = async (files: FileList | null) => {
    // Judged by the bytes: a camera that labels a JPEG "image/jpg" or not at all still counts.
    const captured = (await Promise.all(Array.from(files ?? []).map((file) => normalizeImageFile(file).catch(() => null))))
      .filter((file): file is File => Boolean(file));
    if (!captured.length) return;
    if (!selectedProject || !selectedBuilding) {
      setToast(text("Choose a project and building first.", "Kies eerst een project en gebouw."));
      return;
    }
    // The camera button and the Photos tile are one way of taking photos: the photo lands in
    // the photo library, next to any photo taken before it that is not saved yet, instead of
    // replacing it. The library keeps them on the device until they are saved.
    setPendingQuickPhotos(captured);
    setToast(text("Photo added. Describe it and save.", "Foto toegevoegd. Omschrijf en sla op."));
    openWorkspaceModule("files");
    setModal(null);
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

  /**
   * Every route into a workspace module runs through here. Setting the tab and the
   * destination by hand skipped what navigate does — closing the mobile menu, dropping the
   * record the previous screen pointed at, and starting at the top — so the same module
   * opened differently depending on which tile, menu row or dialog asked for it.
   */
  const openWorkspaceModule = (tab: ProjectTabKey) => {
    navigate("project");
    setInitialProjectTab(tab);
  };

  /**
   * Everything the screen is holding that belongs to one project: the day it mirrors, the
   * record that is being written, the action that is open, the photos still waiting on the
   * device. It is wiped the moment another project becomes the active one, so no line of
   * one project can ever be read under the name of another while its own day is loading.
   */
  const resetProjectScopedState = useCallback(() => {
    setEntries([]);
    setAttendance([]);
    setProjectStartAnswers(null);
    setDailyCloseoutAnswers(null);
    setDayHydrated(false);
    setSelectedAction(null);
    setContextBuildingId(null);
    setFocusRecordId("");
    setProjectTabPreset(undefined);
    setExternalSubmissionIntent(false);
    setActionCenterView("work");
    setPendingQuickPhotos([]);
  }, []);

  const chooseProject = (project: ProjectContext) => {
    if (project.id !== selectedProject?.id) resetProjectScopedState();
    setModal(null);
    setMobileMenuOpen(false);
    setSelectedProject(project);
    setSelectedBuilding(project.buildings[0] ?? null);
    setWorkspaceStage("cockpit");
    setActiveNav("vandaag");
    setInitialProjectTab("home");
    window.scrollTo({ top: 0 });
  };

  /**
   * The safety net under every other way the active project can change: the back button,
   * a restored address, a sign-out. Whichever route was taken, the screen never keeps the
   * previous project's records around.
   */
  const hydratedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    const projectId = selectedProject?.id ?? null;
    if (hydratedProjectRef.current === projectId) return;
    hydratedProjectRef.current = projectId;
    resetProjectScopedState();
  }, [resetProjectScopedState, selectedProject?.id]);

  /**
   * Photos that were taken but never saved, found back when the project opens: the photo
   * library's pending photos, or the one staged on the photo screen. Either way the bar
   * leads back to them.
   */
  const [unsavedPhotos, setUnsavedPhotos] = useState<{ count: number; tab: "files" | "visual"; files: File[] } | null>(null);
  useEffect(() => {
    const projectId = selectedProject?.id;
    if (!projectId) return;
    let cancelled = false;
    void Promise.all([
      loadFormDraft<Array<{ file?: Blob }>>(formDraftKey("library-photos", projectId)),
      loadFormDraft<File[]>(formDraftKey("quick-photo", projectId)),
    ]).then(([library, staged]) => {
      if (cancelled) return;
      const libraryCount = Array.isArray(library?.value) ? library.value.filter((photo) => photo?.file instanceof Blob).length : 0;
      const stagedFiles = Array.isArray(staged?.value) ? staged.value.filter((file) => file instanceof Blob) : [];
      setUnsavedPhotos(libraryCount
        ? { count: libraryCount, tab: "files", files: [] }
        : stagedFiles.length ? { count: stagedFiles.length, tab: "visual", files: stagedFiles } : null);
    });
    return () => { cancelled = true; };
  }, [selectedProject?.id]);

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
    // Only a dialog that still exists comes back: an older address can name one that became a
    // workspace page, such as the day log or the workforce register.
    const contextFreeModal = restored.modal && restorableModals.includes(restored.modal as Exclude<ModalKey, null>)
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
  // Read once, before the history hook's first replaceState rewrites the address bar to
  // the project-less start screen; reading it later found an empty query and every reload
  // dropped the user back on project selection.
  const [initialSearch] = useState(() => (typeof window === "undefined" ? "" : window.location.search));
  // The projects arrive from the server, so the screen in the address bar can only be
  // restored once they are there. That is exactly what an effect is for.
  useEffect(() => {
    if (restoredFromUrlRef.current) return;
    const projects = workspaceQuery.data?.projects;
    if (!projects?.length) return;
    restoredFromUrlRef.current = true;
    const fromUrl = screenFromSearch(initialSearch);
    if (!fromUrl.project) return;
    const project = projects.find((candidate) => candidate.id === fromUrl.project);
    if (!project) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a screen from the address bar can only happen once the projects have loaded
    applyScreen(fromUrl);
  }, [applyScreen, initialSearch, workspaceQuery.data?.projects]);

  const openProjectStartForAllBuildings = () => {
    setContextBuildingId(ALL_BUILDINGS);
    setModal("project_start");
  };

  /**
   * The day closeout has one form: the day log. A second, four-step "daily questions" form
   * wrote the same record and asked again for deliveries, agreements, change orders and the
   * photo count, which each have their own register in the workspace.
   */
  const openDayLog = () => {
    setModal(null);
    openWorkspaceModule("daily");
    setProjectTabPreset({ dailyWorkView: "day" });
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
      text("Project start saved.", "Projectstart opgeslagen."),
    );
    if (!saved) return;
    if (buildings.some((building) => building.id === selectedBuilding?.id)) setProjectStartAnswers(answers);
    // Back to where the start was asked for: the overview, or the day log that needed the
    // weather. Jumping to the overview left a half-written day log behind.
    setModal(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] }),
      queryClient.invalidateQueries({ queryKey: ["workspace", session?.user.id] }),
    ]);
  };

  if (!isSupabaseConfigured || !supabase) {
    return <AppStateScreen title={text("Workspace configuration is missing", "Werkruimteconfiguratie ontbreekt")} copy={text("Not configured yet. Ask your CODECO administrator.", "Nog niet geconfigureerd. Vraag het aan je CODECO-beheerder.")} />;
  }

  if (!authReady) {
    return <AppStateScreen title={text("Opening secure workspace", "Veilige werkruimte openen")} copy={text("Checking access…", "Toegang controleren…")} loading />;
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
        signOut={() => void performSignOut({ discardUnsent: false })}
      />
    );
  }

  if (workspaceQuery.isLoading) {
    return (
      <AppStateScreen
        title={text("Loading CODECO workspace", "CODECO-werkruimte laden")}
        copy={text("Loading projects…", "Projecten laden…")}
        loading
        steps={[
          text("Session verified", "Sessie geverifieerd"),
          text("Loading projects and buildings", "Projecten en gebouwen laden"),
          text("Applying your project permissions", "Je projectrechten toepassen"),
        ]}
      />
    );
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return <AppStateScreen title={text("Workspace unavailable", "Werkruimte niet beschikbaar")} copy={workspaceQuery.error instanceof Error ? workspaceQuery.error.message : text("The central data could not be loaded.", "De centrale gegevens konden niet worden geladen.")} action={() => void workspaceQuery.refetch()} />;
  }

  if (workspaceQuery.data.organizations.length === 0) {
    if (!workspaceQuery.data.canBootstrapOrganization) {
      return (
        <AccessPendingScreen
          email={session.user.email ?? ""}
          signOut={() => void performSignOut({ discardUnsent: false })}
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
        signOut={() => void performSignOut({ discardUnsent: false })}
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
            text("Project created.", "Project aangemaakt."),
          );
          if (saved) await queryClient.invalidateQueries({ queryKey: ["workspace", session.user.id] });
          return Boolean(saved);
        }}
        signOut={() => void performSignOut({ discardUnsent: false })}
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
        signOut={() => void requestSignOut()}
        signOutDialog={signOutPrompt ? (
          <SignOutDialog
            unsent={signOutPrompt.unsent}
            busy={signingOut}
            close={() => setSignOutPrompt(null)}
            signOut={(discardUnsent) => void performSignOut({ discardUnsent })}
          />
        ) : null}
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
          <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={() => setWorkspaceStage("projects")}>{text("Back to projects", "Terug naar projecten")}</button>
        </section>
      </div>
    );
  }

  // Taking a photo files a record and a file; a reader (the client) does neither.
  const canRecord = permissions.canAny("records.create", "files.manage");
  const projectName = selectedProject?.name ?? "Project";
  const availableProjects = workspaceQuery.data.projects;
  const projectCount = availableProjects.length;
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

  /**
   * The day log and the workforce register are workspace pages, like every other record form.
   * They write the day report itself, so their save lives here; the workspace places them.
   * Until the day has loaded they wait, so a form never opens empty and stays empty.
   */
  const dailyForms: DailyFormRenderers = {
    renderDayLog: ({ focus, today, close, openModule, openWorkforce }) => {
      if (!selectedProject || !selectedBuilding) return null;
      if (!dayQuery.data || !dayHydrated) return <p className="form-helper" role="status"><Loader2 className="spin" size={15} /> {text("Loading today…", "Vandaag laden…")}</p>;
      return (
      <DailyLogForm
        // A day that turns out to be saved already opens again with what was saved.
        key={`${selectedBuilding.id}:${focus ?? "day"}:${dailyCloseoutAnswers ? "saved" : "new"}`}
        focus={focus}
        today={today}
        openModule={openModule}
        buildings={selectedProject.buildings}
        defaultBuildingId={selectedBuilding.id}
        buildingName={buildingName}
        projectStartAnswers={projectStartAnswers}
        initialCloseout={dailyCloseoutAnswers}
        attendanceTotal={projectAttendanceTotal}
        parties={dayQuery.data?.parties ?? []}
        busy={syncState === "saving"}
        draftKey={formDraftKey("daily-log", selectedProject.id, reportDate)}
        close={close}
        openProjectStart={openProjectStartForAllBuildings}
        // The draft keeps the log while the crew is counted in its own register.
        openWorkforce={openWorkforce}
        save={async ({ buildingIds: logBuildingIds, answers, photos }) => {
          const targetBuildingIds = logBuildingIds.length ? logBuildingIds : [selectedBuilding.id];
          const primaryBuildingId = targetBuildingIds[0];
          let photosUnconfirmed = "";
          const saved = await runSynced(async () => {
            const report = dayQuery.data?.report ?? await createOrGetReport(supabase, selectedProject.id, reportDate);
            // The day log is the client's own daily record, so it writes the real
            // closeout instead of a loose note. Reports and Daily work stay in sync.
            // One day can cover several buildings; each one gets its own closeout. The crew
            // is not written here: the Workforce register owns it.
            for (const logBuildingId of targetBuildingIds) {
              await saveDailyCloseout(supabase, {
                report,
                projectId: selectedProject.id,
                buildingId: logBuildingId,
                answers,
              });
            }
            if (photos.length) {
              const reportId = String(report.id);
              const logBuildingName = selectedProject.buildings.find((building) => building.id === primaryBuildingId)?.name ?? buildingName;
              for (const photo of photos) {
                // A retry after a failed send must not file the same photo twice.
                if (queuedDailyLogPhotos.current.has(photo.id)) continue;
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
                queuedDailyLogPhotos.current.add(photo.id);
              }
              // The photos are safe in the device queue from here on. A send that does not go
              // through is reported, but it no longer turns a saved day into a failed save —
              // that is what made supervisors take the same photos again.
              if (navigator.onLine) {
                try {
                  await forceSyncOfflineUploads(supabase, selectedProject.id, {
                    paused: text("Day log saved. Connection lost before the photos were confirmed. They are still on this device. Open Photos and tap Send now.", "Daglog opgeslagen. Verbinding verbroken vóór bevestiging van de foto's. Ze staan nog op dit apparaat. Open Foto's en tik op Nu verzenden."),
                    failed: (pendingCount) => text(`Day log saved. ${pendingCount} photo upload(s) not confirmed. They are still on this device. Open Photos and tap Send now.`, `Daglog opgeslagen. ${pendingCount} foto-upload(s) niet bevestigd. Ze staan nog op dit apparaat. Open Foto's en tik op Nu verzenden.`),
                  });
                } catch (error) {
                  photosUnconfirmed = error instanceof Error ? error.message : "";
                }
              }
            }
            return true;
          }, text("Daily log saved and linked to today's report.", "Daglog opgeslagen en aan het dagrapport van vandaag gekoppeld."));
          if (!saved) return false;
          queuedDailyLogPhotos.current.clear();
          if (photosUnconfirmed) setToast(photosUnconfirmed);
          if (targetBuildingIds.includes(selectedBuilding.id)) setDailyCloseoutAnswers(answers);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] }),
            queryClient.invalidateQueries({ queryKey: ["project-operations", selectedProject.id] }),
          ]);
          close();
          return true;
        }}
      />
      );
    },
    renderWorkforce: ({ close }) => {
      if (!selectedProject || !selectedBuilding) return null;
      if (!dayQuery.data || !dayHydrated) return <p className="form-helper" role="status"><Loader2 className="spin" size={15} /> {text("Loading today…", "Vandaag laden…")}</p>;
      return (
      <WorkforceForm
        key={selectedBuilding.id}
        draftKey={formDraftKey("workforce", selectedProject.id, reportDate)}
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
        expectedWorkers={projectStartAnswers?.expectedWorkers ?? null}
        initialNote={attendanceNote}
        initialVisitors={attendanceVisitors}
        currentUserName={currentUserName}
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
              crew: row.crew,
            })),
          };
        }}
        close={close}
        save={async (perBuilding, note, signature) => {
          const total = perBuilding.reduce((sum, entry) => sum + entry.rows.reduce((rowSum, row) => rowSum + row.count, 0), 0);
          const saved = await runSynced(
            async () => {
              // Counting the crew is often the first thing done on site, before anyone
              // opened the day report. The report is started here rather than sending the
              // supervisor away to press a button somewhere else first.
              const report = dayQuery.data?.report ?? await createOrGetReport(supabase, selectedProject.id, reportDate);
              // One save covers every building that was filled in, so a day across two
              // buildings is not two trips through this screen.
              for (const entry of perBuilding) {
                await saveAttendance(supabase, {
                  report,
                  projectId: selectedProject.id,
                  buildingId: entry.buildingId,
                  // The explanation belongs to the day, so every line of it carries the same
                  // sentence: a report reader sees it whichever line they open.
                  rows: entry.rows.map((row) => ({
                    partyId: row.partyId,
                    discipline: row.discipline,
                    count: row.count,
                    shiftStart: row.shiftStart,
                    shiftEnd: row.shiftEnd,
                    crew: row.crew,
                    notes: note,
                  })),
                  signature: signature ? { name: signature.name, signedAt: signature.signedAt, image: signature.image } : null,
                });
                if (entry.visitors.length) {
                  await saveAttendance(supabase, {
                    report,
                    projectId: selectedProject.id,
                    buildingId: entry.buildingId,
                    rows: entry.visitors.map((visitor) => ({
                      partyId: visitor.partyId,
                      // The visitor's own name distinguishes the line from the crew of the
                      // same organisation, which is counted rather than named.
                      discipline: visitor.visitorName.slice(0, 100),
                      visitorName: visitor.visitorName,
                      entryType: "visitor" as const,
                      count: visitor.count,
                      shiftStart: visitor.shiftStart,
                      shiftEnd: visitor.shiftEnd,
                    })),
                  });
                }
              }
            },
            text(`${total} people recorded for today.`, `${total} personen vastgelegd voor vandaag.`),
          );
          if (!saved) return false;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] }),
            queryClient.invalidateQueries({ queryKey: ["project-operations", selectedProject.id] }),
          ]);
          return true;
        }}
      />
      );
    },
  };

  return (
    <ProjectPermissionsProvider value={permissions}>
    <div className="app-shell">
      <input
        ref={quickCameraInputRef}
        className="visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
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

        <button className="project-context-card" type="button" aria-haspopup="dialog" onClick={() => setModal("switch_project")}>
          <span className="project-context-icon"><Building2 size={17} /></span>
          <span className="project-context-copy">
            <span className="sr-only">{text("Switch project: ", "Van project wisselen: ")}</span>
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
        {canRecord ? (
          <button className={`quick-add-side${activeNav === "vandaag" ? "" : " has-page-primary"}`} type="button" onClick={openQuickAdd}>
            <Camera size={18} strokeWidth={2.4} />
            {text("Take photo", "Foto maken")}
          </button>
        ) : null}
        <button className="user-card" type="button" onClick={() => void requestSignOut()} title={text("Sign out", "Afmelden")}>
          <span className="avatar" aria-hidden="true">{initials(currentUserName)}</span>
          <span className="user-copy">
            <span className="sr-only">{text("Sign out: ", "Afmelden: ")}</span>
            <strong>{currentUserName}</strong>
            <small>{text("CODECO user", "CODECO-gebruiker")}</small>
          </span>
          <LogOut size={16} color="#7893a1" />
        </button>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          {/* The header is the only project label a phone shows, so it is also the way
              out of this project: the sidebar that used to carry the switcher is hidden
              there, which left a supervisor with two projects stuck in the first one. */}
          <nav className="breadcrumb" aria-label={text("Project context", "Projectcontext")}>
            <button
              className="breadcrumb-step breadcrumb-project"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setModal("switch_project")}
            >
              <span className="sr-only">{text("Switch project. Open project: ", "Van project wisselen. Geopend project: ")}</span>
              <span className="breadcrumb-root">{text("My projects", "Mijn projecten")}</span>
              <ChevronRight className="breadcrumb-arrow" size={13} />
              <span className="breadcrumb-name">{projectName}</span>
              <ChevronDown className="breadcrumb-caret" size={13} />
            </button>
            <ChevronRight className="breadcrumb-divider" size={13} />
            <button
              className="breadcrumb-step breadcrumb-building"
              type="button"
              aria-label={text(`Manage buildings. ${buildingCount} buildings in this project.`, `Gebouwen beheren. ${buildingCount} gebouwen in dit project.`)}
              onClick={() => setModal("manage_buildings")}
            >
              <strong>{buildingContextLabel}</strong>
            </button>
          </nav>
          <div className="top-actions">
            <FieldGuide
              canManage={canManageMembers}
              onOpenDestination={(destination) => {
                if (destination === "today") { navigate("vandaag"); return; }
                if (destination === "reports") { navigate("rapporten"); return; }
                if (destination === "photo") { openQuickAdd(); return; }
                openWorkspaceModule(destination === "inspection" ? "inspections" : "findings");
              }}
            />
            <LiveWeatherChip location={selectedProject?.location ?? ""} />
            <LanguageSwitcher compact />
            {/* The connection chip is the way into the offline copy: it is where a
                supervisor already looks when the connection is the question. */}
            <button className={`storage-state ${syncState}`} type="button" title={storageStatus} onClick={() => setModal("offline")} aria-label={`${storageStatus}. ${text("Offline availability", "Offline beschikbaarheid")}`}>{syncState === "error" || !isOnline ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} <span>{storageStatus}</span></button>
            <button className={`icon-button management-button ${activeNav === "meer" ? "active" : ""}`} type="button" aria-label={text("Open management and settings", "Open beheer en instellingen")} title={text("Management and settings", "Beheer en instellingen")} onClick={() => navigate("meer")}><Settings size={17} /></button>
            <button className="icon-button" type="button" aria-label={`${text("Notifications", "Meldingen")}${unreadNotificationCount ? `, ${unreadNotificationCount} ${text("unread", "ongelezen")}` : ""}`} onClick={() => setModal("notifications")}>
              <Bell size={17} />
              {unreadNotificationCount ? <span className="notification-dot" /> : null}
            </button>
          </div>
        </header>

        {/* Keyed on the project: a module that switches to another project starts over
            instead of carrying the previous project's selection, filters and drafts. */}
        <main className="main-content" key={selectedProject?.id ?? "no-project"}>
          {activeNav === "vandaag" ? (
            <ClientDashboard
              entries={entries}
              actions={dayActions}
              recentPhotos={recentPhotosQuery.data ?? []}
              client={supabase as SupabaseClient | null}
              projectName={projectName}
              projectLocation={selectedProject?.location ?? "Paramaribo, Suriname"}
              buildingName={buildingName}
              buildingCount={selectedProject?.buildings.length ?? 0}
              weather={projectStartAnswers ? { temperatureC: projectStartAnswers.temperatureC, weatherCondition: projectStartAnswers.weatherCondition } : null}
              organizationId={activeOrganizationId!}
              projectId={selectedProject!.id}
              reportId={dayQuery.data?.report?.id ? String(dayQuery.data.report.id) : null}
              openActions={() => navigate("acties")}
              openWorkspace={() => navigate("project")}
              openDailyQuestions={() => selectedBuilding && openDayLog()}
              openProjectStart={() => selectedBuilding && openProjectStartForAllBuildings()}
              openReportCheck={() => setModal("report")}
              dayStarted={Boolean(projectStartAnswers)}
              // A record found from the overview opens in its own module, on that record —
              // the same route the action centre already uses to point at one.
              openRecord={(tab, recordId) => {
                openWorkspaceModule(tab);
                setFocusRecordId(recordId);
              }}
            />
          ) : (
            <OperationalWorkspace
              mode={activeNav === "acties" ? "actions" : activeNav === "verify" ? "verify" : activeNav === "project" || activeNav === "projectdocs" || activeNav === "punchlist" ? "project" : activeNav === "rapporten" ? "reports" : "admin"}
              client={supabase}
              organizationId={activeOrganizationId!}
              projectId={selectedProject!.id}
              projectName={projectName}
              projectCode={selectedProject!.code}
              projectLocation={selectedProject?.location ?? ""}
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
              initialRecordPreset={projectTabPreset}
              onRecordPresetConsumed={() => setProjectTabPreset(undefined)}
              onProjectTabChange={setInitialProjectTab}
              externalSubmissionIntent={externalSubmissionIntent}
              actionCenterView={actionCenterView}
              focusRecordId={focusRecordId}
              initialCameraFiles={pendingQuickPhotos}
              onInitialCameraFilesConsumed={() => setPendingQuickPhotos([])}
              dailyForms={dailyForms}
              projectActions={dayActions}
              openProjectAction={(actionId) => {
                const action = dayActions.find((item) => item.id === actionId);
                if (!action) return;
                // An action that is still waiting on the device has no central record to
                // update yet; opening its detail would offer buttons that cannot work.
                if (isPendingRecordId(action.id)) {
                  setToast(text("Not sent yet. It opens after sending.", "Nog niet verzonden. Opent na verzending."));
                  return;
                }
                setSelectedAction(action);
                setModal("action_detail");
              }}
              createProjectAction={() => setModal("action_create")}
              openProjectArea={(tab, recordId) => {
                // "submissions" is Management deliberately unlocking the contractor
                // document types; every other destination is a normal workspace module.
                openWorkspaceModule(tab === "submissions" ? "registers" : tab);
                // Both of these are cleared by navigate, so they are set after it.
                setExternalSubmissionIntent(tab === "submissions");
                // The action centre points at a record, so the module opens on that record
                // instead of on the list it stands in.
                setFocusRecordId(recordId ?? "");
              }}
              openActionCenter={(view = "work") => { navigate("acties"); setActionCenterView(view); }}
              openRapidVerify={() => navigate("verify")}
              openManagement={() => navigate("meer")}
              openReportCheck={() => setModal("report")}
            />
          )}
        </main>
      </div>

      <nav className={`mobile-bottom-nav${canRecord ? "" : " four"}`} aria-label={text("Mobile main navigation", "Mobiele hoofdnavigatie")}>
        {localizedNavigation.filter((item) => item.id === "vandaag" || item.id === "project").map((item) => {
          const Icon = item.icon;
          return (
            <button className={`mobile-nav-button ${activeNav === item.id ? "active" : ""}`} type="button" onClick={() => navigate(item.id)} key={item.id}>
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
        {canRecord ? (
          <button className={`mobile-nav-button quick${activeNav === "vandaag" ? "" : " has-page-primary"}`} type="button" onClick={openQuickAdd} aria-label={text("Photo (quick add)", "Foto (snel toevoegen)")}>
            <span className="mobile-plus"><Camera size={23} /></span>
            {text("Photo", "Foto")}
          </button>
        ) : null}
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
                className="mobile-module-switch"
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setModal("switch_project");
                }}
              >
                <span><LayoutDashboard size={19} /></span>
                <span>
                  <strong>{text("Switch project", "Van project wisselen")}</strong>
                  <small>
                    {projectCount} {projectCount === 1 ? text("project", "project") : text("projects", "projecten")}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
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
                    {text(`${selectedProject?.buildings.length ?? 0} in this project`, `${selectedProject?.buildings.length ?? 0} in dit project`)}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
              {localizedNavigation.filter((item) => ["projectdocs", "punchlist", "verify", "rapporten", "meer"].includes(item.id)).map((item) => {
                const Icon = item.icon;
                return (
                  <button className={activeNav === item.id ? "active" : ""} type="button" onClick={() => navigate(item.id)} key={item.id}>
                    <span><Icon size={19} /></span>
                    <span><strong>{item.label}</strong></span>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
              <div className="mobile-module-language"><LanguageSwitcher /></div>
              {/* On a phone the sidebar with the account card is hidden; signing out has
                  to stay reachable on a shared field device. */}
              <button
                className="mobile-module-sign-out"
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void requestSignOut();
                }}
              >
                <span><LogOut size={19} /></span>
                <span><strong>{text("Sign out", "Afmelden")}</strong><small>{currentUserName}</small></span>
                <ChevronRight size={17} />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {modal === "action_create" && selectedProject && selectedBuilding ? (
        <ActionCreateModal
          projectId={selectedProject.id}
          parties={dayQuery.data?.parties ?? []}
          employees={companyEmployees}
          projectName={projectName}
          buildingName={buildingName}
          buildings={selectedProject.buildings}
          defaultBuildingId={selectedBuilding.id}
          locationNodes={projectLocationsQuery.data ?? []}
          requiredLocationDepth={projectConfigurationQuery.data?.required_location_depth ?? "building"}
          close={() => setModal(null)}
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
              text("Action created.", "Actie aangemaakt."),
              { offlineCapable: true },
            );
            if (!saved) return false;
            setModal(null);
            navigate("acties");
            await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
            return true;
          }}
        />
      ) : null}
      {signOutPrompt ? (
        <SignOutDialog
          unsent={signOutPrompt.unsent}
          busy={signingOut}
          close={() => setSignOutPrompt(null)}
          signOut={(discardUnsent) => void performSignOut({ discardUnsent })}
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
          entries={entries}
          attendanceTotal={projectAttendanceTotal}
          reportNumber={reportNumber}
          reportStatus={String(dayQuery.data?.report?.status ?? "draft")}
          dailyCloseoutAnswers={dailyCloseoutAnswers}
          buildings={selectedProject?.buildings ?? []}
          startChecks={dayQuery.data?.startChecks ?? []}
          closeouts={dayQuery.data?.closeouts ?? []}
          openDayLog={openDayLog}
          openProjectStart={() => { setModal(null); openProjectStartForAllBuildings(); }}
          onDownload={async () => {
            const snapshot = buildDraftReportSnapshot();
            if (!snapshot) return;
            const { downloadDailyReportPdf } = await import("@/lib/reports/daily-report-pdf");
            await downloadDailyReportPdf(snapshot);
            setToast(text("Draft PDF generated.", "Concept-PDF gemaakt."));
          }}
          onDownloadDocx={async () => {
            const snapshot = buildDraftReportSnapshot();
            if (!snapshot) return;
            const { downloadDailyReportDocx } = await import("@/lib/reports/daily-report-docx");
            await downloadDailyReportDocx(snapshot);
            setToast(text("Draft Word document generated.", "Concept-Word gemaakt."));
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
              text("Project permissions updated.", "Projectrechten bijgewerkt."),
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

      {modal === "switch_project" ? (
        <ProjectSwitcherModal
          projects={availableProjects}
          activeProjectId={selectedProject?.id ?? ""}
          close={() => setModal(null)}
          chooseProject={chooseProject}
          openProjectOverview={() => {
            setModal(null);
            setMobileMenuOpen(false);
            setWorkspaceStage("projects");
          }}
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

      {unsavedPhotos && selectedProject ? (
        <div className="entry-resume-bar" role="status">
          <span><strong>{unsavedPhotos.count === 1 ? text("A photo you took is not saved yet", "Een gemaakte foto is nog niet opgeslagen") : text(`${unsavedPhotos.count} photos you took are not saved yet`, `${unsavedPhotos.count} gemaakte foto's zijn nog niet opgeslagen`)}</strong></span>
          <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={() => {
            // The library puts its own pending photos back; the photo screen is handed its one.
            if (unsavedPhotos.tab === "visual") setPendingQuickPhotos(unsavedPhotos.files);
            openWorkspaceModule(unsavedPhotos.tab);
            setUnsavedPhotos(null);
            setModal(null);
          }}><ArrowLeft size={14} /> {unsavedPhotos.count === 1 ? text("Back to the photo", "Terug naar de foto") : text("Back to the photos", "Terug naar de foto's")}</button>
          <button className="entry-resume-dismiss" type="button" onClick={() => {
            void clearFormDraft(formDraftKey(unsavedPhotos.tab === "files" ? "library-photos" : "quick-photo", selectedProject.id));
            setUnsavedPhotos(null);
          }} aria-label={unsavedPhotos.count === 1 ? text("Discard this photo", "Deze foto weggooien") : text("Discard these photos", "Deze foto's weggooien")}><X size={14} /></button>
        </div>
      ) : null}
      <div className="sr-only" role="status" aria-live="polite">{connectivityNote}</div>
      {toast ? <div className={`toast ${syncState === "error" ? "error" : ""}`} role={syncState === "error" ? "alert" : "status"} aria-live={syncState === "error" ? "assertive" : "polite"}>{syncState === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />} {toast}</div> : null}
    </div>
    </ProjectPermissionsProvider>
  );
}

function AppStateScreen({
  title,
  copy,
  loading = false,
  action,
  steps,
}: {
  title: string;
  copy: string;
  loading?: boolean;
  action?: () => void;
  /** What the app is busy with, so the wait shows progress instead of an empty screen. */
  steps?: string[];
}) {
  const { text } = useLanguage();
  return (
    <div className={`access-shell ${loading ? "loading-shell" : ""}`}>
      <section className={`access-card state-card ${loading ? "loading-card" : ""}`}>
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={text("Construction supervision", "Constructiesupervisie")} /></div><LanguageSwitcher /></div>
        <div className="state-body">
          <span className="state-icon">{loading ? <Loader2 className="spin" size={26} /> : <AlertTriangle size={26} />}</span>
          <h1>{title}</h1>
          <p>{copy}</p>
          {loading ? <span className="state-progress" role="progressbar" aria-label={title} aria-busy="true"><span /></span> : null}
          {loading && steps?.length ? (
            <ul className="state-steps">
              {steps.map((step, index) => (
                <li className={index === 0 ? "done" : ""} key={step}>
                  {index === 0 ? <Check size={13} /> : <Loader2 className="spin" size={13} />}
                  {step}
                </li>
              ))}
            </ul>
          ) : null}
          {/* A silhouette of the workspace that is coming, so the wait reads as loading
              rather than as an app that opened on a blank page. */}
          {loading ? (
            <div className="state-skeleton" aria-hidden="true">
              <span className="skeleton-line wide" />
              <span className="skeleton-line" />
              <div className="skeleton-tiles"><span /><span /><span /></div>
            </div>
          ) : null}
          {action ? <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={action}>{text("Try again", "Opnieuw proberen")}</button> : null}
        </div>
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
      // Only sentences a person can act on: raw provider or browser messages ("Failed to
      // fetch", rate-limit internals) are translated, never shown as they are.
      const raw = caught instanceof Error ? caught.message : "";
      const status = (caught as { status?: number } | null)?.status;
      setError(
        raw.includes("Invalid login credentials")
          ? text("The email address or password is incorrect.", "E-mailadres of wachtwoord is onjuist.")
          : status === 429 || /rate limit|too many/i.test(raw)
            ? text("Too many sign-in attempts. Wait a few minutes and try again.", "Te veel aanmeldpogingen. Wacht een paar minuten en probeer het opnieuw.")
            : /fetch|network|load failed|timeout/i.test(raw) || (typeof navigator !== "undefined" && !navigator.onLine)
              ? text("The server cannot be reached. Check the connection and try again.", "De server is niet bereikbaar. Controleer de verbinding en probeer het opnieuw.")
              : /email not confirmed/i.test(raw)
                ? text("This account has not been activated yet. Use the link in your invitation email.", "Dit account is nog niet geactiveerd. Gebruik de link in je uitnodigingsmail.")
                : text("Signing in did not work. Try again, or ask your CODECO administrator.", "Aanmelden is niet gelukt. Probeer het opnieuw of vraag je CODECO-beheerder."),
      );
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
          <h1>{text("Sign in", "Aanmelden")}</h1>
        </div>
        <form className="access-form" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("Email address", "E-mailadres")}</span><input type="email" autoComplete="email" {...register("email")} />{errors.email ? <small className="field-error">{errors.email.message}</small> : null}</label>
          <label className="form-field"><span>{text("Password", "Wachtwoord")}</span><input type="password" autoComplete="current-password" {...register("password")} />{errors.password ? <small className="field-error">{errors.password.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          {resetSent ? <p className="access-message success" role="status">{text("If the account exists, a recovery link was sent. Check your inbox and spam folder.", "Als het account bestaat, is een herstellink verstuurd. Controleer je inbox en spam.")}</p> : null}
          <button className="ui-button ui-button--primary ui-button--lg access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}{text("Sign in securely", "Veilig aanmelden")}</button>
          <button className="auth-help-button" type="button" disabled={busy} onClick={() => void sendPasswordReset()}>{text("Forgot your password?", "Wachtwoord vergeten?")}</button>
        </form>
        <p className="security-note">{text("No account? Ask your CODECO administrator for a personal invitation.", "Geen account? Vraag je CODECO-beheerder om een persoonlijke uitnodiging.")}</p>
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
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={mode === "recovery" ? text("Account recovery", "Accountherstel") : text("Internal invitation", "Interne uitnodiging")} /></div><LanguageSwitcher /><button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button></div>
        <span className="state-icon"><KeyRound size={26} /></span>
        <h1>{mode === "recovery" ? text("Choose a new password", "Kies een nieuw wachtwoord") : text("Set your password", "Stel je wachtwoord in")}</h1><p>{mode === "recovery" ? <>{text("The recovery link for", "De herstellink voor")} <strong>{email}</strong> {text("has been verified. Choose a new personal password of at least 12 characters.", "is geverifieerd. Kies een nieuw persoonlijk wachtwoord van minimaal 12 tekens.")}</> : <>{text("The invitation for", "De uitnodiging voor")} <strong>{email}</strong> {text("has been verified. Choose a personal password of at least 12 characters.", "is geverifieerd. Kies nu een persoonlijk wachtwoord van minimaal 12 tekens.")}</>}</p>
        <form className="access-form setup-form" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("New password", "Nieuw wachtwoord")}</span><input type="password" autoComplete="new-password" {...register("password")} />{errors.password ? <small className="field-error">{errors.password.message}</small> : null}</label>
          <label className="form-field"><span>{text("Repeat password", "Herhaal wachtwoord")}</span><input type="password" autoComplete="new-password" {...register("passwordConfirmation")} />{errors.passwordConfirmation ? <small className="field-error">{errors.passwordConfirmation.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          <button className="ui-button ui-button--primary ui-button--md access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}{text("Save password", "Wachtwoord opslaan")}</button>
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
        <p>{text("The signed-in account", "Het account")} <strong>{email}</strong> {text("has no organization or project. Ask an administrator for access.", "heeft geen organisatie of project. Vraag een beheerder om toegang.")}</p>
        <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button>
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
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={text("Initial setup", "Eerste inrichting")} /></div><LanguageSwitcher /><button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button></div>
        <h1>{text("Set up the organization securely", "Organisatie veilig instellen")}</h1><p>{text("Step 1 of 2", "Stap 1 van 2")}</p><p>{text("This creates the central role and permission structure. Your account", "Dit maakt de centrale rollen- en rechtenstructuur. Je account")} <strong>{userEmail}</strong> {text("becomes the first organization administrator.", "wordt de eerste organisatiebeheerder.")}</p>
        <form className="access-form setup-form" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("Your name", "Jouw naam")}</span><input {...register("displayName")} />{errors.displayName ? <small className="field-error">{errors.displayName.message}</small> : null}</label>
          <label className="form-field"><span>{text("Company name", "Bedrijfsnaam")}</span><input {...register("organizationName")} /></label>
          <label className="form-field"><span>{text("Technical organization slug", "Technische organisatieslug")}</span><input {...register("organizationSlug")} />{errors.organizationSlug ? <small className="field-error">{errors.organizationSlug.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          <button className="ui-button ui-button--primary ui-button--md access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}{text("Set up organization", "Organisatie instellen")}</button>
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
        <div className="setup-top"><div className="access-brand"><CompanyLogo subtitle={`${organizationName} · ${embedded ? text("New project", "Nieuw project") : text("Initial setup", "Eerste inrichting")}`} /></div><LanguageSwitcher />{embedded ? <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button> : <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button>}</div>
        <h1>{embedded ? text("Create configured project", "Maak geconfigureerd project") : text("First project and building", "Eerste project en gebouw")}</h1><p>{embedded ? text("Configure before activation", "Configureer vóór activatie") : text("Step 2 of 2", "Stap 2 van 2")}</p>
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
              <label className="form-field wide"><span>{text("Location template · type|code|name|optional parent code", "Locatiesjabloon · type|code|naam|optionele bovenliggende code")}</span><textarea rows={6} {...register("locationLevels")} /><small>{text("Types: zone, floor, room, element, work_package. Applied to every building.", "Typen: zone, floor, room, element, work_package. Geldt voor elk gebouw.")}</small></label>
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
          <button className="ui-button ui-button--primary ui-button--md access-submit wide" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}{text("Validate configuration and create project", "Valideer configuratie en maak project")}</button>
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
  signOut,
  signOutDialog,
}: {
  projects: ProjectContext[];
  chooseProject: (project: ProjectContext) => void;
  organizationName: string;
  createProject: (answers: ProjectSetupAnswers) => Promise<boolean>;
  currentUserName: string;
  storageStatus: string;
  isOnline: boolean;
  offlineCached: boolean;
  signOut: () => void;
  signOutDialog: React.ReactNode;
}) {
  const { text } = useLanguage();
  const [showProjectSetup, setShowProjectSetup] = useState(false);
  return (
    <div className="context-shell">
      {signOutDialog}
      <header className="context-topbar">
        <div className="context-brand">
          <CompanyLogo subtitle={text("Supervision", "Supervisie")} />
        </div>
        <div className="context-user">
          <LanguageSwitcher compact />
          <span className="avatar">{initials(currentUserName)}</span>
          <span className="context-user-name"><strong>{currentUserName}</strong><small>{text("CODECO user", "CODECO-gebruiker")}</small></span>
          <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={signOut} aria-label={text(`Sign out ${currentUserName}`, `${currentUserName} afmelden`)}><LogOut size={14} /> <span className="context-sign-out-label">{text("Sign out", "Afmelden")}</span></button>
        </div>
      </header>

      <main className="context-content">
        <div className={`data-mode-notice ${isOnline ? "connected" : "offline"}`} role="status">
          {isOnline ? <CheckCircle2 size={17} /> : <HardDrive size={17} />}
          <span><strong>{isOnline ? text("Online", "Online") : text("Offline", "Offline")}</strong> · {storageStatus}{isOnline ? "" : offlineCached ? ` · ${text("Last synced projects are available.", "Laatst gesynchroniseerde projecten zijn beschikbaar.")}` : ` · ${text("Only synced changes count as saved.", "Alleen gesynchroniseerde wijzigingen tellen als opgeslagen.")}`}</span>
        </div>

        <section className="context-heading">
          <div><h1>{text("My projects", "Mijn projecten")}</h1></div>
          <button className="ui-button ui-button--primary ui-button--md portfolio-cta" type="button" onClick={() => setShowProjectSetup(true)}><Plus size={15} /> {text("New configured project", "Nieuw geconfigureerd project")}</button>
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
                <strong>{project.name}</strong>
                <small><MapPin size={12} /> {project.location}</small>
              </span>
              <span className="selection-meta"><span>{project.openIssues} {project.openIssues === 1 ? text("open action", "open actie") : text("open actions", "open acties")}</span><span>{project.issueCount} {text("issues total", "issues totaal")}</span></span>
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
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("weather-unavailable");
      const accessToken = await validAccessToken(client);
      const response = await fetch(`/api/weather/current?location=${encodeURIComponent(project.location)}`, {
        cache: "no-store",
        headers: { authorization: `Bearer ${accessToken}` },
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
            <header><span className="form-section-number">1</span><span><strong>{text("Weather and working hours", "Weer en werktijden")}</strong></span></header>
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
                  : ""}</small>
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
            <header><span className="form-section-number">2</span><span><strong>{text("What is planned today?", "Wat staat vandaag gepland?")}</strong></span></header>
            <div className="form-grid two-columns">
              <div className="work-option-grid wide" aria-label={text("Choose planned work", "Kies geplande werkzaamheden")}>{constructionWorkOptions.map((option) => { const label = language === "en" ? option.en : option.nl; const active = selectedWork.includes(label); return <button className={active ? "active" : ""} type="button" aria-pressed={active} onClick={() => toggleWork(label)} key={option.en}>{active ? <Check size={14} /> : <Plus size={14} />}{label}</button>; })}</div>
              {errors.plannedWork ? <small className="field-error wide">{errors.plannedWork.message}</small> : null}
              <details className="optional-text-entry wide">
                <summary>{text("Other planned work · optional", "Andere werkzaamheden · optioneel")}</summary>
                <label className="form-field"><span>{text("Other work", "Overig werk")}</span><textarea rows={3} {...register("plannedWork")} /><DictateButton onText={(transcript) => setValue("plannedWork", appendDictation(getValues("plannedWork") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label>
              </details>
              <label className="form-field"><span>{text("Inspection planned?", "Inspectie gepland?")}</span><select {...register("inspectionPlanned")}><option value="yes">{text("Yes", "Ja")}</option><option value="no">{text("No", "Nee")}</option></select></label>
              <label className="form-field"><span>{text("Concrete work planned?", "Betonwerk gepland?")}</span><select {...register("concreteWork")}><option value="yes">{text("Yes", "Ja")}</option><option value="no">{text("No", "Nee")}</option></select></label>
              <label className="form-field"><span>{text("High-risk work?", "Hoog-risicowerk?")}</span><select {...register("highRiskWork")}><option value="no">{text("No", "Nee")}</option><option value="yes">{text("Yes", "Ja")}</option></select></label>
              <label className="form-field"><span>{text("Work permit", "Werkvergunning")}</span><select {...register("workPermit")}><option value="available">{text("Available", "Aanwezig")}</option><option value="not_required">{text("Not required", "Niet vereist")}</option><option value="missing">{text("Missing", "Ontbreekt")}</option></select></label>
            </div>
          </section>

          <section className="form-section-card">
            <header><span className="form-section-number">3</span><span><strong>{text("Documents and expected risks", "Documenten en verwachte risico’s")}</strong></span></header>
            <div className="form-grid two-columns">
              <label className="form-field"><span>{text("Approved working drawing", "Goedgekeurde werktekening")}</span><select {...register("drawingStatus")}><option value="approved">{text("Current revision available", "Actuele revisie aanwezig")}</option><option value="not_required">{text("Not required", "Niet vereist")}</option><option value="missing">{text("Missing / uncertain", "Ontbreekt / onzeker")}</option></select></label>
              <div className="quick-issue-presets wide" aria-label={text("Choose expected risks", "Kies verwachte risico's")}>{riskOptions.map((option) => <button className={selectedRisks.includes(option) ? "active" : ""} type="button" aria-pressed={selectedRisks.includes(option)} onClick={() => toggleRisk(option)} key={option}>{option}</button>)}</div>
              <details className="optional-text-entry wide">
                <summary>{text("Other risk · optional", "Ander risico · optioneel")}</summary>
                <label className="form-field"><span>{text("Other risks", "Overige risico's")}</span><textarea rows={3} {...register("riskNotes")} /><DictateButton onText={(transcript) => setValue("riskNotes", appendDictation(getValues("riskNotes") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} /></label>
              </details>
              {answers.drawingStatus === "missing" ? (
                <label className="confirmation-check wide"><input type="checkbox" {...register("drawingIssueReported")} /><span><strong>{text("Missing drawing was reported", "Ontbrekende tekening is gemeld")}</strong>{errors.drawingIssueReported ? <em className="field-error">{errors.drawingIssueReported.message}</em> : null}</span></label>
              ) : null}
            </div>
          </section>

          <div className="project-start-submit">
            <span><ShieldCheck size={15} /> {text("Saving completes only after central confirmation.", "Opslaan is pas voltooid na centrale bevestiging.")}</span>
            <button className="ui-button ui-button--primary ui-button--md" type="submit">{text("Start daily report centrally", "Dagrapport centraal starten")} <ArrowRight size={15} /></button>
          </div>
        </form>

        {automation.length ? <aside className="automation-panel">
          <header><span className="automation-panel-icon"><Settings size={19} /></span><span><strong>{text("Checks", "Controles")}</strong></span></header>
          <div className="automation-rule-list">
            {automation.map((rule) => (
              <article className={`automation-rule ${rule.tone}`} key={rule.id}>
                <span className="automation-rule-state">{rule.tone === "critical" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}</span>
                <span><strong>{rule.title}</strong><p>{rule.action}</p></span>
              </article>
            ))}
          </div>
        </aside> : null}
      </div>
      </section>
    </div>
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
        <header className="modal-header"><div><h2 id="notifications-title">{text("Push notifications and deadlines", "Pushmeldingen en deadlines")}</h2></div><button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button></header>
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
                {pushState === "active" ? ""
                  : pushState === "not-configured" ? text("Push is not configured. An administrator must add the VAPID keys.", "Push is niet geconfigureerd. Een beheerder moet de VAPID-sleutels toevoegen.")
                  : pushState === "ios-add-to-home-screen" ? text("On iPhone and iPad, push works only from the Home Screen. Tap Share, then Add to Home Screen, and open the app from there.", "Op iPhone en iPad werkt push alleen vanaf het beginscherm. Tik op Deel, dan Zet op beginscherm, en open de app daar.")
                  : pushState === "inactive" ? text("Activate failed? Check that your browser allows Google push services (Brave: Settings → Privacy and security → Use Google services for push messaging).", "Activeren mislukt? Controleer of je browser Google-pushdiensten toestaat (Brave: Instellingen → Privacy en beveiliging → Google-services voor pushberichten gebruiken).")
                  : ""}
              </small>
            </span>
            {pushState === "inactive" || pushState === "active" ? <button className={pushState === "active" ? "ui-button ui-button--secondary ui-button--md" : "ui-button ui-button--primary ui-button--md"} type="button" disabled={pushBusy} onClick={() => void activatePush()}>{pushBusy ? <Loader2 className="spin" size={15} /> : <Bell size={15} />}{pushState === "active" ? text("Test push", "Test push") : text("Activate", "Activeren")}</button> : null}
          </div>
          {pushError ? <div className="operation-alert error">{pushError}</div> : null}
          {loading ? <div className="empty-list-state"><Loader2 className="spin" size={22} /><strong>{text("Loading notifications", "Meldingen laden")}</strong></div> : null}
          {!loading && notifications.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No notifications", "Geen meldingen")}</strong></div> : null}
          {notifications.map((notification) => (
            <button className={`notification-row ${notification.read_at ? "read" : ""}`} type="button" key={notification.id} onClick={() => void markRead(notification.id)}>
              <span className="notification-row-icon">{notification.notification_type.includes("overdue") || notification.notification_type.includes("critical") ? <AlertTriangle size={17} /> : <Bell size={17} />}</span>
              <span><strong>{notificationTitle(notification.title, text)}</strong><span>{notification.body}</span><small>{notification.due_at ? `${text("Deadline", "Deadline")} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(notification.due_at))}` : text("Immediate follow-up", "Directe opvolging")} · {notification.push_status === "sent" ? text("Push sent", "Push verzonden") : notification.push_status === "failed" ? text("Push retry pending", "Nieuwe pushpoging gepland") : notification.push_status === "skipped" ? text("Activate push on a device", "Activeer push op een apparaat") : text("Push queued", "Push in wachtrij")}</small></span>
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
      setSuccess(text("Access status saved.", "Toegangsstatus opgeslagen."));
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
          <div><h2 id="user-admin-title">{text("Users and access", "Gebruikers en toegang")}</h2></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body user-admin-body">
          <div className="user-admin-tabs ui-tabs" role="tablist" aria-label={text("User management", "Gebruikersbeheer")}>
            <button role="tab" aria-selected={activePanel === "invite"} className={activePanel === "invite" ? "active" : ""} type="button" onClick={() => setActivePanel("invite")}><UserPlus size={16} /> {text("Invite someone", "Iemand uitnodigen")}</button>
            <button role="tab" aria-selected={activePanel === "members"} className={activePanel === "members" ? "active" : ""} type="button" onClick={() => setActivePanel("members")}><Users size={16} /> {text("Current access", "Huidige toegang")} <span>{access?.members.length ?? 0}</span></button>
          </div>
          {activePanel === "invite" ? <section className="invite-panel" aria-labelledby="invite-heading">
            <div className="invite-progress" aria-label={text(`Step ${inviteStep} of 3`, `Stap ${inviteStep} van 3`)}>
              {[text("Person", "Persoon"), text("Access", "Toegang"), text("Check", "Controleren")].map((label, index) => <span className={inviteStep >= index + 1 ? "active" : ""} key={label}><i>{inviteStep > index + 1 ? <Check size={12} /> : index + 1}</i>{label}</span>)}
            </div>
            <div className="section-heading"><UserPlus size={18} /><span><h3 id="invite-heading">{text("Invite project user", "Projectgebruiker uitnodigen")}</h3><p>{text("Invite a person", "Persoon uitnodigen")}</p></span></div>
            {success ? <div className="invite-success" role="status"><span><CheckCircle2 size={24} /></span><div><h3>{text("Invitation is on its way", "Uitnodiging is onderweg")}</h3><p>{text(`${invitedEmail} receives a link to set a password.`, `${invitedEmail} ontvangt een link om een wachtwoord in te stellen.`)}</p><div className="button-row"><button className="ui-button ui-button--primary ui-button--md" type="button" onClick={startAnotherInvite}><UserPlus size={15} /> {text("Invite another", "Nog iemand uitnodigen")}</button><button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setActivePanel("members")}>{text("View access", "Toegang bekijken")} <ArrowRight size={14} /></button></div></div></div> : <form className={`invite-flow step-${inviteStep}`} onSubmit={handleSubmit(submit)} noValidate>
              <input type="hidden" {...register("organizationId")} />
              {inviteStep === 1 ? <div className="form-grid"><label className="form-field"><span>{text("Full name *", "Volledige naam *")}</span><input autoFocus autoComplete="name" placeholder={text("e.g. Jane Doe", "bijv. Jane Doe")} {...register("displayName")} />{errors.displayName ? <small className="field-error">{errors.displayName.message}</small> : null}</label><label className="form-field"><span>{text("Business email address *", "Zakelijk e-mailadres *")}</span><input type="email" autoComplete="email" placeholder="naam@bedrijf.com" {...register("email")} />{errors.email ? <small className="field-error">{errors.email.message}</small> : null}</label></div> : null}
              <label className="form-field"><span>{text("Role *", "Rol *")}</span><select {...register("roleCode")} disabled={!access?.roles.length}><option value="">{text("Choose a role", "Kies een rol")}</option><optgroup label={text("Project roles · least privilege", "Projectrollen · minimale rechten")}>{projectRoles.map((role) => <option value={role.code} key={role.id}>{role.name}</option>)}</optgroup><optgroup label={text("Organization roles · internal only", "Organisatierollen · alleen intern")}>{access?.roles.filter((role) => role.scope === "organization").map((role) => <option value={role.code} key={role.id}>{role.name}</option>)}</optgroup></select>{errors.roleCode ? <small className="field-error">{errors.roleCode.message}</small> : null}</label>
              {selectedRole ? <div className={`role-access-preview ${selectedRole.code === "external_guest" ? "restricted" : ""}`}><KeyRound size={16} /><span><strong>{selectedRole.name} · {selectedRole.scope === "project" ? text("this project only", "alleen dit project") : text("entire organization", "hele organisatie")}</strong><small>{text(selectedRoleCopy[0], selectedRoleCopy[1])}</small></span></div> : null}
              {selectedRole?.scope === "project" ? <label className="form-field"><span>Project *</span><select {...register("projectId")}><option value="">{text("Choose a project", "Kies een project")}</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.code} · {project.name}</option>)}</select>{errors.projectId ? <small className="field-error">{errors.projectId.message}</small> : null}</label> : <div className="scope-note"><ShieldCheck size={16} /><span><strong>{text("Organization-wide access", "Organisatiebrede toegang")}</strong><small>{text("This role applies to all current projects in the organization.", "Deze rol geldt voor alle huidige projecten binnen de organisatie.")}</small></span></div>}
              {inviteStep === 3 ? <><dl className="invite-summary"><div><dt>{text("Project user", "Projectgebruiker")}</dt><dd>{displayName}<small>{email}</small></dd></div><div><dt>{text("Role", "Rol")}</dt><dd>{selectedRole?.name}</dd></div><div><dt>{text("Access", "Toegang")}</dt><dd>{selectedRole?.scope === "organization" ? text("All projects in the organization", "Alle projecten in de organisatie") : selectedInviteProject ? `${selectedInviteProject.code} · ${selectedInviteProject.name}` : text("No project selected", "Geen project geselecteerd")}</dd></div></dl><div className="invitation-explainer"><ShieldCheck size={17} /><span><strong>{text("What happens next?", "Wat gebeurt hierna?")}</strong>{text("Access is limited to the scope above.", "Toegang is beperkt tot het bereik hierboven.")}</span></div></> : null}
              {inviteError ? <p className="access-message error full" role="alert">{inviteError}</p> : null}
              <div className="invite-actions">{inviteStep > 1 ? <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setInviteStep(inviteStep === 3 ? 2 : 1)}><ArrowLeft size={14} /> {text("Back", "Terug")}</button> : <span />}{inviteStep < 3 ? <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={loading || Boolean(loadError)} onClick={() => void continueInvite()}>{text("Continue", "Doorgaan")} <ArrowRight size={15} /></button> : <button className="ui-button ui-button--primary ui-button--md" type="submit" disabled={busy || loading || Boolean(loadError)}>{busy ? <Loader2 className="spin" size={15} /> : <UserPlus size={15} />}{text("Send invitation", "Uitnodiging versturen")}</button>}</div>
            </form>}
          </section> : null}

          {activePanel === "members" ? <section className="internal-members" aria-labelledby="members-heading">
            <div className="member-list-heading"><span><h3 id="members-heading">{text("Project accounts", "Projectaccounts")}</h3><p>{access?.members.length ?? 0} {text("account(s) with organization or project access", "account(s) met organisatie- of projecttoegang")}</p></span>{loadError ? <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={reload}>{text("Reload", "Opnieuw laden")}</button> : null}</div>
            {loading ? <div className="empty-list-state"><Loader2 className="spin" size={22} /><strong>{text("Loading accounts", "Accounts laden")}</strong></div> : null}
            {loadError ? <p className="access-message error" role="alert">{loadError}</p> : null}
            {memberError ? <p className="access-message error" role="alert">{memberError}</p> : null}
            {!loading && !loadError && access?.members.length === 0 ? <div className="empty-list-state"><Users size={22} /><strong>{text("No accounts yet", "Nog geen accounts")}</strong></div> : null}
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
                    <span className="member-access-controls"><span className={`task-status ${member.membershipStatus === "active" && member.accessStatus === "active" ? "green" : ""}`}>{statusLabel}</span>{member.userId === currentUserId ? <small>{text("Own account", "Eigen account")}</small> : member.membershipStatus !== "revoked" ? <span>{member.membershipStatus === "suspended" ? <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={busy} onClick={() => setMemberAction({ userId: member.userId, nextStatus: "active", reason: "" })}>{text("Reactivate", "Heractiveren")}</button> : <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={busy} onClick={() => setMemberAction({ userId: member.userId, nextStatus: "suspended", reason: "" })}>{text("Suspend", "Opschorten")}</button>}<button className="ui-button ui-button--quiet ui-button--md danger" type="button" disabled={busy} onClick={() => setMemberAction({ userId: member.userId, nextStatus: "revoked", reason: "" })}>{text("Revoke", "Intrekken")}</button></span> : null}</span>
                  </article>
                  {member.projectRoles.map((projectRole) => <div className="member-project-permission" key={`${member.userId}:${projectRole.projectId}:${projectRole.roleCode}`}>
                    <span><KeyRound size={14} /><span><strong>{projectRole.projectName}</strong><small>{projectRole.roleName} · {text(roleAccessCopy[projectRole.roleCode]?.[0] ?? "Controlled project role", roleAccessCopy[projectRole.roleCode]?.[1] ?? "Gecontroleerde projectrol")}</small></span></span>
                    {member.userId !== currentUserId ? <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setRoleEdit({ userId: member.userId, projectId: projectRole.projectId, roleCode: projectRole.roleCode, reason: "" })}>{text("Edit rights", "Rechten aanpassen")}</button> : null}
                  </div>)}
                  {roleEdit?.userId === member.userId ? <div className="member-status-form role-editor"><label className="form-field"><span>{text("New project role", "Nieuwe projectrol")}</span><select value={roleEdit.roleCode} onChange={(event) => setRoleEdit({ ...roleEdit, roleCode: event.target.value })}>{projectRoles.map((role) => <option value={role.code} key={role.id}>{role.name}</option>)}</select></label><label className="form-field"><span>{text("Reason for access change *", "Reden voor rechtenwijziging *")}</span><textarea rows={2} value={roleEdit.reason} onChange={(event) => setRoleEdit({ ...roleEdit, reason: event.target.value })} placeholder={text("Stored permanently in the access audit history", "Wordt blijvend opgeslagen in de toegangs-auditgeschiedenis")} /></label><div className="button-row"><button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setRoleEdit(null)}>{text("Cancel", "Annuleren")}</button><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || roleEdit.reason.trim().length < 5} onClick={() => void confirmProjectRole()}><ShieldCheck size={14} /> {text("Save least-privilege role", "Sla minimale rol op")}</button></div></div> : null}
                  {memberAction?.userId === member.userId ? <div className="member-status-form"><label className="form-field"><span>{text("Reason for", "Reden voor")} {memberAction.nextStatus === "active" ? text("reactivation", "heractivering") : memberAction.nextStatus === "suspended" ? text("suspension", "opschorting") : text("permanent revocation", "definitieve intrekking")} *</span><textarea rows={2} value={memberAction.reason} onChange={(event) => setMemberAction({ ...memberAction, reason: event.target.value })} placeholder={text("At least 5 characters; stored in the audit trail", "Minimaal 5 tekens; wordt in de audittrail bewaard")} /></label><div className="button-row"><button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setMemberAction(null)}>{text("Cancel", "Annuleren")}</button><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || memberAction.reason.trim().length < 5} onClick={() => void confirmMemberAction()}>{busy ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />} {text("Confirm status", "Status bevestigen")}</button></div></div> : null}
                </div>;
              })}
            </div>
          </section> : null}
        </div>
      </section>
    </div>
  );
}

/**
 * The database writes a notification's title in Dutch when it creates it ("Actie nadert
 * deadline: ACT-2026-0003"). The interface says it in the language it is set to; a title it
 * does not know stays as stored.
 */
function notificationTitle(stored: string, text: (english: string, dutch: string) => string) {
  const exact: Record<string, string> = {
    "Dagrapport wacht op review": text("Daily report waiting for review", "Dagrapport wacht op review"),
    "Automatische back-up mislukt": text("Automatic backup failed", "Automatische back-up mislukt"),
  };
  if (exact[stored]) return exact[stored];
  const prefixes: Array<[string, string]> = [
    ["Actie verlopen: ", text("Action overdue: ", "Actie verlopen: ")],
    ["Actie nadert deadline: ", text("Action due soon: ", "Actie nadert deadline: ")],
    ["Bevinding nadert deadline: ", text("Finding due soon: ", "Bevinding nadert deadline: ")],
  ];
  for (const [dutch, shown] of prefixes) if (stored.startsWith(dutch)) return shown + stored.slice(dutch.length);
  return stored;
}

function ActionCreateModal({
  projectId,
  parties,
  employees,
  projectName,
  buildingName,
  buildings,
  defaultBuildingId,
  locationNodes,
  requiredLocationDepth,
  close,
  save,
}: {
  projectId: string;
  parties: ProjectParty[];
  employees: InternalMember[];
  projectName: string;
  buildingName: string;
  buildings: BuildingOption[];
  defaultBuildingId: string;
  locationNodes: ProjectLocationOption[];
  requiredLocationDepth: "building" | "floor" | "room" | "element";
  close: () => void;
  save: (answers: ProjectActionAnswers, buildingId: string, locationNodeId?: string) => Promise<boolean>;
}) {
  const { text } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [buildingId, setBuildingId] = useState(() => resolveDefaultBuildingId(buildings, defaultBuildingId));
  const [locationNodeId, setLocationNodeId] = useState("");
  const defaultParty = parties.find((party) => party.type === "contractor")?.id ?? parties[0]?.id ?? "";
  const defaultEmployee = employees[0]?.userId ?? "";
  const { register, handleSubmit, setValue, getValues, reset, control, formState: { errors } } = useForm<ProjectActionAnswers>({
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
  const watchedAnswers = useWatch({ control });
  const autosave = useFormAutosave({
    id: `form:action:${projectId}`,
    value: { answers: watchedAnswers, buildingId, locationNodeId },
    restore: (draft) => {
      reset({ ...getValues(), ...draft.answers } as ProjectActionAnswers);
      if (draft.buildingId) setBuildingId(draft.buildingId);
      setLocationNodeId(draft.locationNodeId ?? "");
    },
  });
  const applyTemplate = (template: Pick<ProjectActionAnswers, "title" | "description" | "priority">) => {
    setValue("title", template.title, { shouldDirty: true, shouldValidate: true });
    setValue("description", template.description, { shouldDirty: true, shouldValidate: true });
    setValue("priority", template.priority, { shouldDirty: true, shouldValidate: true });
  };
  const submit = async (answers: ProjectActionAnswers) => {
    setBusy(true);
    const saved = await save(answers, buildingId, locationNodeId || undefined);
    if (saved) autosave.clear();
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
          <DraftNotice status={autosave.status} savedAt={autosave.savedAt} onDiscard={() => { autosave.clear(); reset(); setLocationNodeId(""); }} />
          <div className="form-grid two-columns">
            <div className="quick-issue-presets full" aria-label={text("Choose a standard action", "Kies een standaardactie")}>{actionTemplates.map((template) => <button className={selectedActionTitle === template.title ? "active" : ""} type="button" aria-pressed={selectedActionTitle === template.title} onClick={() => applyTemplate(template)} key={template.title}>{template.title}</button>)}</div>
            
            <details className="optional-text-entry full">
              <summary>{text("Different action", "Andere actie")}</summary>
              <div className="form-grid">
                <label className="form-field"><span>{text("Action *", "Actie *")}</span><input placeholder={text("What must demonstrably be completed?", "Wat moet aantoonbaar worden uitgevoerd?")} {...register("title")} />{errors.title ? <small className="field-error">{errors.title.message}</small> : null}</label>
                <label className="form-field"><span>{text("Context and acceptance criterion *", "Context en acceptatiecriterium *")}</span><textarea rows={4} {...register("description")} /><DictateButton onText={(transcript) => setValue("description", appendDictation(getValues("description") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} />{errors.description ? <small className="field-error">{errors.description.message}</small> : null}</label>
              </div>
            </details>
            <BuildingPicker id="action-building" buildings={buildings} value={buildingId} onChange={(next) => { setBuildingId(next); setLocationNodeId(""); }} allowAll />
            {buildingId !== ALL_BUILDINGS ? <LocationPicker id="action-location" nodes={locationNodes} buildingId={buildingId} value={locationNodeId} onChange={setLocationNodeId} requiredDepth={requiredLocationDepth} /> : null}
            <label className="form-field"><span>{text("Responsible party *", "Verantwoordelijke partij *")}</span><select {...register("ownerPartyId")} disabled={parties.length === 0}><option value="">{text("Choose party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select>{errors.ownerPartyId ? <small className="field-error">{errors.ownerPartyId.message}</small> : null}</label>
            <label className="form-field"><span>{text("Assigned company employee *", "Toegewezen bedrijfsmedewerker *")}</span><select {...register("ownerUserId")} disabled={employees.length === 0}><option value="">{text("Choose employee", "Kies medewerker")}</option>{employees.map((employee) => <option value={employee.userId} key={employee.userId}>{employee.displayName || employee.email} · {[...employee.organizationRoles.map((role) => role.name), ...employee.projectRoles.filter((role) => role.projectId).map((role) => role.roleName)][0] ?? text("Employee", "Medewerker")}</option>)}</select>{errors.ownerUserId ? <small className="field-error">{errors.ownerUserId.message}</small> : null}{employees.length === 0 ? <small className="field-error">{text("No active employees. Add one under Management → Team and access.", "Geen actieve medewerkers. Voeg er een toe onder Management → Team en toegang.")}</small> : null}</label>
            <div className="form-field"><label htmlFor="action-deadline">Deadline *</label><input id="action-deadline" type="datetime-local" {...register("dueAt")} />{errors.dueAt ? <small className="field-error">{errors.dueAt.message}</small> : null}<span className="period-date-presets">{[[0, text("Today", "Vandaag")], [1, text("Tomorrow", "Morgen")], [3, text("3 days", "3 dagen")], [7, text("7 days", "7 dagen")]].map(([days, label]) => <button type="button" onClick={() => setValue("dueAt", actionDeadlineFromToday(Number(days)), { shouldDirty: true, shouldValidate: true })} key={String(label)}>{label}</button>)}</span></div>
            <label className="form-field"><span>{text("Priority", "Prioriteit")}</span><select {...register("priority")}><option value="low">{text("Low", "Laag")}</option><option value="normal">{text("Normal", "Normaal")}</option><option value="high">{text("High", "Hoog")}</option><option value="critical">{text("Critical", "Kritiek")}</option></select></label>
          </div>
          <div className="modal-actions">
            {/* Cancel closes the form. "Back" used to open a hidden sheet of record types that
                each already have a workspace tile. */}
            <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
            <button className="ui-button ui-button--primary ui-button--md" type="submit" disabled={busy || parties.length === 0 || employees.length === 0 || (buildingId !== ALL_BUILDINGS && requiredLocationDepth !== "building" && !locationNodeId)}>{busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />} {text("Save and assign", "Opslaan en toewijzen")}</button>
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
          <div><p className="record-number">{action.action_number}</p><h2 id="action-detail-title">{action.title}</h2><p>{partyName}{action.location_node_id ? ` · ${locationBreadcrumb(locationNodes, action.location_node_id)}` : ""} · {text("deadline", "deadline")} {dueAt}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body action-detail-body">
          <div className="action-detail-summary">
            <span className={`task-status ${action.priority === "critical" ? "red" : ""}`}>{priorityText(action.priority, text)}</span>
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
                <label className="form-field"><span>{nextStatus === "verified" ? text("Verification note *", "Verificatienotitie *") : text("Execution note *", "Uitvoeringsnotitie *")}</span><textarea rows={3} {...register("note")} /><DictateButton onText={(transcript) => setValue("note", appendDictation(getValues("note") ?? "", transcript), { shouldDirty: true, shouldValidate: true })} />{errors.note ? <small className="field-error">{errors.note.message}</small> : null}</label>
              </details>
              <button className="ui-button ui-button--primary ui-button--md" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <ArrowRight size={14} />} {text("Move to", "Naar")} {statusLabels[nextStatus].toLowerCase()}</button>
            </form>
          ) : <p className="action-complete-note"><CheckCircle2 size={16} /> {action.status === "verified" ? text("This action has been formally verified and closed.", "Deze actie is formeel geverifieerd en gesloten.") : text("This action was cancelled and remains visible in the history.", "Deze actie is geannuleerd en blijft in de historie zichtbaar.")}</p>}
        </div>
      </section>
    </div>
  );
}

/**
 * Signing out while work is still waiting on this device. Keeping it is the default and the
 * safe choice: it stays tied to this account, is invisible to anyone else who signs in here,
 * and is sent the next time this account signs in. Discarding is possible but is spelled out.
 */
function SignOutDialog({
  unsent,
  busy,
  close,
  signOut,
}: {
  unsent: number;
  busy: boolean;
  close: () => void;
  signOut: (discardUnsent: boolean) => void;
}) {
  const { text } = useLanguage();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && close()}>
      <section className="modal sign-out-modal" role="alertdialog" aria-modal="true" aria-labelledby="sign-out-title" aria-describedby="sign-out-copy">
        <header className="modal-header">
          <div>
            <h2 id="sign-out-title">{text("Sign out with unsent work?", "Afmelden met niet-verstuurd werk?")}</h2>
            <p id="sign-out-copy">{text(`${unsent} item(s) on this device have not been sent. Project data is removed when you sign out. Unsent work stays here, hidden from others, and is sent the next time you sign in.`, `${unsent} item(s) op dit apparaat zijn nog niet verzonden. Projectgegevens worden verwijderd bij afmelden. Niet-verzonden werk blijft hier, verborgen voor anderen, en wordt verstuurd zodra je weer aanmeldt.`)}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} disabled={busy} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        {confirmDiscard ? (
          <div className="modal-body">
            <p className="field-error" role="alert">{text(
              `The ${unsent} unsent item(s) will be deleted permanently. They exist nowhere else and cannot be recovered.`,
              `De ${unsent} niet-verstuurde item(s) worden definitief verwijderd. Ze bestaan nergens anders en kunnen niet worden hersteld.`,
            )}</p>
          </div>
        ) : null}
        <footer className="modal-actions">
          {confirmDiscard ? (
            <>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy} onClick={() => setConfirmDiscard(false)}>{text("Back", "Terug")}</button>
              <button className="ui-button ui-button--danger ui-button--md" type="button" disabled={busy} onClick={() => signOut(true)}>{busy ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />} {text("Delete and sign out", "Verwijderen en afmelden")}</button>
            </>
          ) : (
            <>
              <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={busy} onClick={() => setConfirmDiscard(true)}>{text("Discard unsent work…", "Niet-verstuurd werk weggooien…")}</button>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy} onClick={close}>{text("Stay signed in", "Aangemeld blijven")}</button>
              <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => signOut(false)}>{busy ? <Loader2 className="spin" size={15} /> : <LogOut size={15} />} {text("Keep work and sign out", "Werk bewaren en afmelden")}</button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}

/**
 * Switching project without leaving the workspace first. The sidebar card, the header on
 * a phone and the "more" drawer all open this list, so the question "which project am I
 * in, and how do I get to the other one?" has the same answer everywhere.
 */
function ProjectSwitcherModal({
  projects,
  activeProjectId,
  close,
  chooseProject,
  openProjectOverview,
}: {
  projects: ProjectContext[];
  activeProjectId: string;
  close: () => void;
  chooseProject: (project: ProjectContext) => void;
  openProjectOverview: () => void;
}) {
  const { text } = useLanguage();
  const [term, setTerm] = useState("");
  // A search box only earns its place once the list stops fitting on a phone screen.
  const searchable = projects.length > 5;
  const needle = term.trim().toLowerCase();
  const matches = needle
    ? projects.filter((project) => [project.name, project.code, project.location, project.client]
      .some((field) => String(field ?? "").toLowerCase().includes(needle)))
    : projects;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal project-switcher-modal" role="dialog" aria-modal="true" aria-labelledby="switch-project-title">
        <header className="modal-header">
          <div>
            <h2 id="switch-project-title">{text("Switch project", "Van project wisselen")}</h2>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body">
          {searchable ? (
            <label className="project-switcher-search">
              <Search size={15} />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={text("Search by name, code or location", "Zoek op naam, code of locatie")}
                aria-label={text("Search projects", "Projecten zoeken")}
              />
            </label>
          ) : null}
          <div className="project-switcher-list">
            {matches.map((project) => {
              const active = project.id === activeProjectId;
              return (
                <button
                  className={`project-switcher-row ${active ? "active" : ""}`}
                  type="button"
                  key={project.id}
                  aria-current={active ? "true" : undefined}
                  onClick={() => {
                    if (active) {
                      close();
                      return;
                    }
                    chooseProject(project);
                  }}
                >
                  <span className="project-switcher-icon">{active ? <Check size={17} /> : <Building2 size={17} />}</span>
                  <span className="project-switcher-copy">
                    <strong>{project.name}</strong>
                    <small><MapPin size={12} /> {project.location}</small>
                    <small className="project-switcher-meta">
                      {project.code} · {project.buildings.length} {project.buildings.length === 1 ? text("building", "gebouw") : text("buildings", "gebouwen")} · {project.openIssues} {project.openIssues === 1 ? text("open action", "open actie") : text("open actions", "open acties")}
                    </small>
                  </span>
                  <span className="project-switcher-state">
                    {active ? text("Current", "Huidig") : <ArrowRight size={15} />}
                  </span>
                </button>
              );
            })}
            {matches.length === 0 ? (
              <p className="project-switcher-empty">{text("No project matches your search.", "Geen project komt overeen met je zoekopdracht.")}</p>
            ) : null}
          </div>
          <button className="ui-button ui-button--secondary ui-button--md project-switcher-overview" type="button" onClick={openProjectOverview}>
            <LayoutDashboard size={15} /> {text("Open the project overview", "Projectoverzicht openen")}
          </button>
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
            <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || code.trim().length < 1 || name.trim().length < 2} onClick={() => void submit()}>{busy ? <Loader2 className="spin" size={15} /> : <Plus size={15} />} {text("Add building", "Gebouw toevoegen")}</button>
          </details>
        </div>
      </section>
    </div>
  );
}

function ReportModal({
  close,
  entries,
  attendanceTotal,
  reportNumber,
  reportStatus,
  dailyCloseoutAnswers,
  buildings,
  startChecks,
  closeouts,
  openDayLog,
  openProjectStart,
  onDownload,
  onDownloadDocx,
  onSubmit,
}: {
  close: () => void;
  entries: TimelineEntry[];
  attendanceTotal: number;
  reportNumber: string;
  reportStatus: string;
  dailyCloseoutAnswers: DailyCloseoutAnswers | null;
  buildings: BuildingContext[];
  startChecks: Array<Record<string, unknown>>;
  closeouts: Array<Record<string, unknown>>;
  /** The one form that completes the day closeout. */
  openDayLog: () => void;
  /** The start of the day: weather and working hours, for every building. */
  openProjectStart: () => void;
  onDownload: () => void | Promise<void>;
  onDownloadDocx: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
}) {
  const { text } = useLanguage();
  const buildingsMissing = buildings.filter((building) => !startChecks.some((row) => row.building_id === building.id) || !closeouts.some((row) => row.building_id === building.id));
  // What is missing decides where "Complete" leads: the start of the day first, then the day log.
  const startMissing = buildings.some((building) => !startChecks.some((row) => row.building_id === building.id));
  // Only what can actually be missing is a check. The HSE check and tomorrow's plan used to
  // stand here as two more rows for the same day log, and two rows were always green.
  const checks = [
    {
      title: text("Day log", "Daglog"),
      detail: !dailyCloseoutAnswers
        ? text("Not completed yet", "Nog niet ingevuld")
        : dailyCloseoutAnswers.tomorrowPlan
          ? text("Confirmed", "Bevestigd")
          : text("Plan for tomorrow missing", "Planning voor morgen ontbreekt"),
      complete: Boolean(dailyCloseoutAnswers?.tomorrowPlan),
      open: openDayLog,
    },
    {
      title: text("Start check and closeout for every building", "Projectstart en dagafsluiting per gebouw"),
      detail: buildingsMissing.length === 0 ? text("All buildings", "Alle gebouwen") : text(`Still missing for: ${buildingsMissing.map((building) => building.name).join(", ")}`, `Nog niet compleet voor: ${buildingsMissing.map((building) => building.name).join(", ")}`),
      complete: buildingsMissing.length === 0,
      open: (startMissing ? openProjectStart : openDayLog) as (() => void) | undefined,
    },
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
                {check.complete || !check.open
                  ? <span className="report-check-label">{check.complete ? text("Complete", "Compleet") : text("Missing", "Ontbreekt")}</span>
                  : <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={check.open}>{text("Complete", "Aanvullen")}</button>}
              </div>
            ))}
          </div>
          {/* What the report will say, as recorded. This used to be an editable box whose text
              was never saved anywhere. */}
          <div className="report-summary-box">
            <strong>{text("In this report", "In dit rapport")}</strong>
            <p>{text(`${attendanceTotal} ${attendanceTotal === 1 ? "person" : "people"} · ${entries.length} daily records · ${entries.filter((entry) => entry.kind === "inspection").length} inspections · ${entries.filter((entry) => entry.badgeTone === "red").length} critical`, `${attendanceTotal} ${attendanceTotal === 1 ? "persoon" : "personen"} · ${entries.length} dagregistraties · ${entries.filter((entry) => entry.kind === "inspection").length} inspecties · ${entries.filter((entry) => entry.badgeTone === "red").length} kritiek`)}</p>
            {dailyCloseoutAnswers?.daySummary ? <p>{dailyCloseoutAnswers.daySummary}</p> : null}
          </div>
          <div className="modal-actions">
            <span className={`report-check-status ${missing ? "is-incomplete" : "is-complete"}`}>{missing ? text(`${missing} item(s) still need completion`, `${missing} onderdeel${missing > 1 ? "en" : ""} nog aanvullen`) : text("All checks passed", "Alle controles geslaagd")}</span>
            <div className="report-action-buttons">
              <ReportDownloadButtons disabled={missing > 0} onDownloadPdf={onDownload} onDownloadWord={onDownloadDocx} />
              <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={missing > 0 || submitted} onClick={onSubmit}>{submitted ? text("Submitted", "Ingediend") : text("Ready for review", "Gereed voor review")} <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
