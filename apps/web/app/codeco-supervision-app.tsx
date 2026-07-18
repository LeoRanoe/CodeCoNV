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
  Copy,
  FileCheck2,
  FileText,
  Gauge,
  History,
  Home,
  Image,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageSquareText,
  Minus,
  PackageCheck,
  Plus,
  Ruler,
  Search,
  Settings,
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
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { OperationalWorkspace } from "@/app/operational-workspace";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
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
  createProjectAction,
  createProjectWorkspace,
  getSession,
  inviteInternalUser,
  loadInternalAccess,
  loadProjectNotifications,
  loadProjectDay,
  loadWorkspace,
  markNotificationRead,
  reportDateInSuriname,
  saveAttendance,
  saveDailyCloseout,
  saveProjectStart,
  saveSiteRegistration,
  setInternalUserAccessStatus,
  submitReportForReview,
  transitionProjectAction,
  type ActionUpdate,
  type InternalAccessSnapshot,
  type ProjectAction,
  type ProjectParty,
  type ProjectNotification,
  type WorkspaceBuilding,
  type WorkspaceProject,
} from "@/lib/supabase/data";

type NavKey = "vandaag" | "project" | "acties" | "rapporten" | "meer";
type ModalKey = "quick" | "entry" | "action_create" | "action_detail" | "report" | "attendance" | "daily_questions" | "user_admin" | "notifications" | null;
type WorkspaceStage = "projects" | "buildings" | "project_start" | "cockpit";
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
  id: EntryKind | "hse" | "delivery" | "test" | "delay";
  title: string;
  description: string;
  icon: LucideIcon;
};

type ProjectContext = WorkspaceProject;
type BuildingContext = WorkspaceBuilding;

type AttendanceRow = {
  id: string;
  partyId: string;
  party: string;
  discipline: string;
  count: number;
  shiftStart: string;
  shiftEnd: string;
};

const navigation: { id: NavKey; label: string; icon: LucideIcon; badge?: string }[] = [
  { id: "vandaag", label: "Vandaag", icon: Home },
  { id: "project", label: "Project", icon: LayoutDashboard },
  { id: "acties", label: "Acties", icon: ClipboardCheck },
  { id: "rapporten", label: "Rapporten", icon: FileText },
  { id: "meer", label: "Meer", icon: Menu },
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
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(16, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function currentTime(locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Paramaribo",
  }).format(new Date());
}

function currentDateLabel(locale = "en-US") {
  const value = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Paramaribo",
  }).format(new Date());
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

export function CodecoSupervisionApp() {
  const { locale, text } = useLanguage();
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isOnline, setIsOnline] = useState(true);
  const [workspaceStage, setWorkspaceStage] = useState<WorkspaceStage>("projects");
  const [selectedProject, setSelectedProject] = useState<ProjectContext | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingContext | null>(null);
  const [activeNav, setActiveNav] = useState<NavKey>("vandaag");
  const [modal, setModal] = useState<ModalKey>(null);
  const [selectedType, setSelectedType] = useState<string>("activity");
  const [initialProjectTab, setInitialProjectTab] = useState<"inspections" | "visual">("inspections");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Floor 3 · East zone");
  const [priority, setPriority] = useState("normal");
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [completedTodos, setCompletedTodos] = useState<number[]>([]);
  const [projectStartAnswers, setProjectStartAnswers] = useState<ProjectStartAnswers | null>(null);
  const [dailyCloseoutAnswers, setDailyCloseoutAnswers] = useState<DailyCloseoutAnswers | null>(null);
  const [selectedAction, setSelectedAction] = useState<ProjectAction | null>(null);
  const [toast, setToast] = useState("");
  const reportDate = reportDateInSuriname();

  const workspaceQuery = useQuery({
    queryKey: ["workspace", session?.user.id],
    queryFn: () => loadWorkspace(supabase as SupabaseClient),
    enabled: Boolean(supabase && session),
  });

  const activeOrganizationId = workspaceQuery.data?.organizations[0]?.id;
  const canManageMembers = Boolean(
    activeOrganizationId
    && workspaceQuery.data?.manageableOrganizationIds.includes(activeOrganizationId),
  );
  const internalAccessQuery = useQuery({
    queryKey: ["internal-access", activeOrganizationId],
    queryFn: () => loadInternalAccess(supabase as SupabaseClient, activeOrganizationId!),
    enabled: Boolean(supabase && session && activeOrganizationId && canManageMembers && modal === "user_admin"),
  });

  const dayQuery = useQuery({
    queryKey: ["project-day", selectedProject?.id, reportDate],
    queryFn: () => loadProjectDay(supabase as SupabaseClient, selectedProject!.id, reportDate),
    enabled: Boolean(supabase && session && selectedProject),
  });

  const notificationQuery = useQuery({
    queryKey: ["project-notifications", selectedProject?.id],
    queryFn: () => loadProjectNotifications(supabase as SupabaseClient, selectedProject!.id),
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
    label: ({ vandaag: text("Today", "Vandaag"), project: text("Project", "Project"), acties: text("Actions", "Acties"), rapporten: text("Reports", "Rapporten"), meer: text("More", "Meer") } satisfies Record<NavKey, string>)[item.id],
  }));

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void getSession(supabase).then((nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthReady(true);
      }
    }).catch(() => {
      if (active) setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (!nextSession) {
        setSelectedProject(null);
        setSelectedBuilding(null);
        setWorkspaceStage("projects");
      }
    });
    return () => {
      active = false;
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
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const day = dayQuery.data;
    if (!day || !selectedBuilding) return;
    const hydration = window.setTimeout(() => {
      const start = projectStartFromRow(day.startCheck);
      const closeout = closeoutFromRow(day.closeout);
      setProjectStartAnswers(start);
      setDailyCloseoutAnswers(closeout);
      setCompletedTodos([...(start ? [1] : []), ...(closeout ? [2, 3] : [])]);

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
        location: selectedBuilding.name,
        person: currentUserName,
        badge: priorityLabel,
        badgeTone: String(row.priority) === "critical" ? "red" : "green",
      };
      }));

      const partyById = new Map(day.parties.map((party) => [party.id, party]));
      if (day.attendance.length) {
        setAttendance(day.attendance.map((row) => {
        const party = partyById.get(String(row.party_id));
        return {
          id: String(row.id),
          partyId: String(row.party_id),
          party: party?.name ?? text("Unknown party", "Onbekende partij"),
          discipline: String(row.discipline),
          count: Number(row.headcount),
          shiftStart: String(row.shift_start).slice(0, 5),
          shiftEnd: String(row.shift_end).slice(0, 5),
        };
        }));
      } else {
        setAttendance(day.parties.map((party) => ({
        id: `party:${party.id}`,
        partyId: party.id,
        party: party.name,
        discipline: disciplineForParty(party.type),
        count: 0,
        shiftStart: "07:00",
        shiftEnd: "16:00",
        })));
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [currentUserName, dayQuery.data, locale, selectedBuilding, text]);

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
  const reportNumber = String(dayQuery.data?.report?.report_number ?? `DR-${reportDate.replaceAll("-", "")}`);
  const dayActions = dayQuery.data?.actions ?? [];

  const runSynced = async <T,>(operation: () => Promise<T>, successMessage: string): Promise<T | null> => {
    if (!isOnline) {
      setSyncState("error");
      setToast(text("No connection. Your input remains in the open form; try again when you are online.", "Geen verbinding. Je invoer blijft in het geopende formulier; probeer opnieuw zodra je online bent."));
      return null;
    }
    setSyncState("saving");
    try {
      const result = await operation();
      setSyncState("saved");
      setToast(successMessage);
      return result;
    } catch (error) {
      setSyncState("error");
      setToast(error instanceof Error ? `${text("Save failed", "Opslaan mislukt")}: ${error.message}` : text("Save failed. Try again.", "Opslaan mislukt. Probeer opnieuw."));
      return null;
    }
  };

  const openQuickAdd = () => {
    setDescription("");
    setModal("quick");
  };

  const chooseType = (type: string) => {
    if (type === "photo") {
      setInitialProjectTab("visual");
      setActiveNav("project");
      setModal(null);
      return;
    }
    setSelectedType(type);
    setModal(type === "action" ? "action_create" : "entry");
  };

  const saveEntry = async () => {
    if (!description.trim() || !supabase || !selectedProject || !selectedBuilding) return;
    const priorityMap: Record<string, string> = { low: "low", normal: "normal", high: "high", critical: "critical" };
    const saved = await runSynced(
      () => saveSiteRegistration(supabase, {
        projectId: selectedProject.id,
        buildingId: selectedBuilding.id,
        type: selectedType,
        title: description.trim(),
        description: `${location} · ${description.trim()}`,
        priority: priorityMap[priority] ?? "normal",
      }),
      text(`${entryTitles[selectedType]} was saved centrally and linked to the daily report.`, `${entryTitles[selectedType]} is centraal opgeslagen en aan het dagrapport gekoppeld.`),
    );
    if (!saved) return;
    setModal(null);
    await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
  };

  const toggleTodo = (id: number) => {
    setCompletedTodos((current) =>
      current.includes(id) ? current.filter((todo) => todo !== id) : [...current, id],
    );
  };

  const navigate = (next: NavKey) => {
    setActiveNav(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseProject = (project: ProjectContext) => {
    setSelectedProject(project);
    setSelectedBuilding(null);
    setWorkspaceStage("buildings");
  };

  const openProjectStart = () => {
    if (!selectedProject || !selectedBuilding) return;
    setWorkspaceStage(projectStartAnswers ? "cockpit" : "project_start");
  };

  const startProject = async (answers: ProjectStartAnswers) => {
    if (!supabase || !selectedProject || !selectedBuilding) return;
    const saved = await runSynced(
      () => saveProjectStart(supabase, {
        projectId: selectedProject.id,
        buildingId: selectedBuilding.id,
        answers,
        reportDate,
      }),
      text("Project start and the draft daily report were saved centrally.", "Projectstart en het conceptdagrapport zijn centraal opgeslagen."),
    );
    if (!saved) return;
    setProjectStartAnswers(answers);
    setWorkspaceStage("cockpit");
    setActiveNav("vandaag");
    window.scrollTo({ top: 0 });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] }),
      queryClient.invalidateQueries({ queryKey: ["workspace", session?.user.id] }),
    ]);
  };

  const changeAttendance = (id: string, delta: number) => {
    setAttendance((current) =>
      current.map((row) => row.id === id ? { ...row, count: Math.max(0, row.count + delta) } : row),
    );
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

  if (session.user.user_metadata?.must_set_password === true) {
    return (
      <PasswordSetupScreen
        email={session.user.email ?? ""}
        save={async (answers) => {
          const result = await supabase.auth.updateUser({
            password: answers.password,
            data: { must_set_password: false },
          });
          if (result.error) throw result.error;
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
            "CODECO-werkruimte is centraal aangemaakt.",
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
            "Project, gebouw en standaardpartijen zijn centraal aangemaakt.",
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
        stage={workspaceStage}
        selectedProject={selectedProject}
        selectedBuilding={selectedBuilding}
        chooseProject={chooseProject}
        chooseBuilding={setSelectedBuilding}
        openProjectStart={openProjectStart}
        startProject={startProject}
        currentUserName={currentUserName}
        storageStatus={storageStatus}
        initialProjectStart={projectStartAnswers}
        goBack={() => {
          setSelectedBuilding(null);
          setWorkspaceStage("projects");
        }}
        goBackToBuilding={() => setWorkspaceStage("buildings")}
      />
    );
  }

  const projectName = selectedProject?.name ?? "Project";
  const buildingName = selectedBuilding?.name ?? text("Building", "Gebouw");

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={text("Main navigation", "Hoofdnavigatie")}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy"><strong>CODECO N.V.</strong><small>Supervisie</small></span>
        </div>

        <button className="project-context-card" type="button" aria-label={text("Change project and building", "Project en gebouw wijzigen")} onClick={() => setWorkspaceStage("projects")}>
          <span className="project-context-icon"><Building2 size={17} /></span>
          <span className="project-context-copy">
            <strong>{projectName}</strong>
            <small>{buildingName} · {selectedProject?.location}</small>
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
          <Plus size={18} strokeWidth={2.4} />
          {text("Quick add", "Snel toevoegen")}
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
          <div className="breadcrumb" aria-label={text("Current work context", "Huidige werkcontext")}>
            <span>{text("My projects", "Mijn projecten")}</span>
            <ChevronRight size={13} />
            <span>{projectName}</span>
            <ChevronRight size={13} />
            <strong>{buildingName}</strong>
          </div>
          <div className="top-actions">
            <LanguageSwitcher compact />
            <span className={`storage-state ${syncState}`} title={storageStatus}>{syncState === "error" || !isOnline ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} <span>{storageStatus}</span></span>
            <button className="icon-button" type="button" aria-label={text("Search", "Zoeken")}><Search size={17} /></button>
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
              buildingName={buildingName}
              attendanceTotal={attendanceTotal}
              projectStartAnswers={projectStartAnswers}
              dailyCloseoutAnswers={dailyCloseoutAnswers}
              openDailyQuestions={() => setModal("daily_questions")}
              currentUserName={currentUserName}
              reportNumber={reportNumber}
              actions={dayActions}
              showCritical={() => {
                navigate("acties");
                setToast("De centrale actielijst is geopend.");
              }}
            />
          ) : activeNav === "project" || activeNav === "rapporten" || activeNav === "meer" ? (
            <OperationalWorkspace
              mode={activeNav === "project" ? "project" : activeNav === "rapporten" ? "reports" : "admin"}
              client={supabase}
              organizationId={activeOrganizationId!}
              projectId={selectedProject!.id}
              projectName={projectName}
              buildingId={selectedBuilding!.id}
              buildingName={buildingName}
              reportId={dayQuery.data?.report?.id ? String(dayQuery.data.report.id) : null}
              reportNumber={reportNumber}
              reportStatus={String(dayQuery.data?.report?.status ?? "draft")}
              currentUserName={currentUserName}
              parties={dayQuery.data?.parties ?? []}
              canManageOrganization={canManageMembers}
              openUserAdmin={() => setModal("user_admin")}
              initialProjectTab={initialProjectTab}
            />
          ) : (
            <SecondaryView
              activeNav={activeNav}
              openQuickAdd={openQuickAdd}
              navigate={navigate}
              projectName={projectName}
              buildingName={buildingName}
              attendanceTotal={attendanceTotal}
              openAttendance={() => setModal("attendance")}
              entries={entries}
              actions={dayActions}
              actionUpdates={dayQuery.data?.actionUpdates ?? []}
              openAction={(action) => {
                setSelectedAction(action);
                setModal("action_detail");
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
        {localizedNavigation.filter((item) => item.id !== "rapporten").slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <button className={`mobile-nav-button ${activeNav === item.id ? "active" : ""}`} type="button" onClick={() => navigate(item.id)} key={item.id}>
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
        <button className="mobile-nav-button quick" type="button" onClick={openQuickAdd} aria-label={text("Quick add", "Snel toevoegen")}>
          <span className="mobile-plus"><Plus size={25} /></span>
          {text("Add", "Toevoegen")}
        </button>
        {localizedNavigation.filter((item) => item.id === "acties" || item.id === "meer").map((item) => {
          const Icon = item.icon;
          return (
            <button className={`mobile-nav-button ${activeNav === item.id ? "active" : ""}`} type="button" onClick={() => navigate(item.id)} key={item.id}>
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {modal === "quick" ? <QuickAddModal close={() => setModal(null)} chooseType={chooseType} /> : null}
      {modal === "entry" ? (
        <EntryModal
          selectedType={selectedType}
          description={description}
          location={location}
          priority={priority}
          setDescription={setDescription}
          setLocation={setLocation}
          setPriority={setPriority}
          goBack={() => setModal("quick")}
          close={() => setModal(null)}
          save={saveEntry}
          projectName={projectName}
          buildingName={buildingName}
        />
      ) : null}
      {modal === "action_create" && selectedProject && selectedBuilding ? (
        <ActionCreateModal
          parties={dayQuery.data?.parties ?? []}
          projectName={projectName}
          buildingName={buildingName}
          close={() => setModal(null)}
          goBack={() => setModal("quick")}
          save={async (answers) => {
            const saved = await runSynced(
              () => createProjectAction(supabase, {
                projectId: selectedProject.id,
                buildingId: selectedBuilding.id,
                ...answers,
              }),
              "Actie is met deadline en verantwoordelijke centraal aangemaakt.",
            );
            if (!saved) return false;
            setModal(null);
            setActiveNav("acties");
            await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
            return true;
          }}
        />
      ) : null}
      {modal === "action_detail" && selectedAction ? (
        <ActionDetailModal
          action={selectedAction}
          partyName={dayQuery.data?.parties.find((party) => party.id === selectedAction.owner_party_id)?.name ?? "Niet toegewezen"}
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
          attendanceTotal={attendanceTotal}
          projectName={projectName}
          reportNumber={reportNumber}
          reportStatus={String(dayQuery.data?.report?.status ?? "draft")}
          dailyCloseoutAnswers={dailyCloseoutAnswers}
          onDownload={async () => {
            if (!selectedProject || !selectedBuilding || !projectStartAnswers || !dailyCloseoutAnswers) return;
            const { downloadDailyReportPdf } = await import("@/lib/reports/daily-report-pdf");
            await downloadDailyReportPdf({
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
            });
            setToast("De concept-PDF is gegenereerd uit de centraal opgeslagen rapportgegevens.");
          }}
          onSubmit={async () => {
            const reportId = dayQuery.data?.report?.id;
            if (!reportId) {
              setToast("Start eerst het dagrapport voordat je het indient.");
              return;
            }
            const saved = await runSynced(
              () => submitReportForReview(supabase, String(reportId)),
              "Dagrapport is centraal gereed voor review gezet.",
            );
            if (!saved) return;
            setModal(null);
            await queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject?.id, reportDate] });
          }}
        />
      ) : null}
      {modal === "daily_questions" ? (
        <DailyQuestionsModal
          close={() => setModal(null)}
          initialAnswers={dailyCloseoutAnswers}
          projectStartAnswers={projectStartAnswers}
          save={async (answers) => {
            if (!selectedProject || !selectedBuilding || !dayQuery.data?.report) {
              setToast("Start eerst het centrale dagrapport.");
              return;
            }
            const saved = await runSynced(
              () => saveDailyCloseout(supabase, {
                report: dayQuery.data.report!,
                projectId: selectedProject.id,
                buildingId: selectedBuilding.id,
                answers,
              }),
              "Dagvragen zijn centraal opgeslagen en in de rapportcontrole verwerkt.",
            );
            if (!saved) return;
            setDailyCloseoutAnswers(answers);
            setCompletedTodos((current) => Array.from(new Set([...current, 2, 3])));
            setModal(null);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] }),
              queryClient.invalidateQueries({ queryKey: ["workspace", session.user.id] }),
            ]);
          }}
        />
      ) : null}
      {modal === "attendance" ? (
        <AttendanceModal
          rows={attendance}
          total={attendanceTotal}
          changeCount={changeAttendance}
          copyPreviousDay={() => {
            setToast("Er is nog geen eerdere centrale werkdag met aanwezigheid om over te nemen.");
          }}
          close={() => setModal(null)}
          save={async () => {
            if (!selectedProject || !selectedBuilding || !dayQuery.data?.report) {
              setToast("Start eerst het centrale dagrapport.");
              return;
            }
            const saved = await runSynced(
              () => saveAttendance(supabase, {
                report: dayQuery.data.report!,
                projectId: selectedProject.id,
                buildingId: selectedBuilding.id,
                rows: attendance.map((row) => ({
                  partyId: row.partyId,
                  discipline: row.discipline,
                  count: row.count,
                  shiftStart: row.shiftStart,
                  shiftEnd: row.shiftEnd,
                })),
              }),
              `${attendanceTotal} aanwezigen zijn centraal aan het dagrapport gekoppeld.`,
            );
            if (!saved) return;
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
        />
      ) : null}

      {modal === "notifications" ? (
        <NotificationsModal
          notifications={notificationQuery.data ?? []}
          loading={notificationQuery.isLoading}
          close={() => setModal(null)}
          markRead={async (notificationId) => {
            const saved = await runSynced(
              () => markNotificationRead(supabase, notificationId),
              "Melding als gelezen gemarkeerd.",
            );
            if (saved) await queryClient.invalidateQueries({ queryKey: ["project-notifications", selectedProject?.id] });
          }}
        />
      ) : null}

      {toast ? <div className="toast" role="status"><CheckCircle2 size={18} /> {toast}</div> : null}
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
        <div className="setup-top"><div className="access-brand"><span className="brand-mark" /><span><strong>CODECO N.V.</strong><small>{text("Construction supervision", "Constructiesupervisie")}</small></span></div><LanguageSwitcher /></div>
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
  const { register, handleSubmit, formState: { errors } } = useForm<AuthAnswers>({
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

  return (
    <div className="access-shell">
      <section className="access-card auth-card">
        <div className="setup-top"><div className="access-brand"><span className="brand-mark" /><span><strong>CODECO N.V.</strong><small>{text("Construction supervision", "Constructiesupervisie")}</small></span></div><LanguageSwitcher /></div>
        <div className="auth-heading">
          <p className="eyebrow">{text("Internal CODECO workspace", "Interne CODECO-werkruimte")}</p>
          <h1>{text("Welcome back", "Welkom terug")}</h1>
          <p>{text("Only employees invited by an organization administrator can sign in.", "Alleen medewerkers die door een organisatiebeheerder zijn uitgenodigd kunnen aanmelden.")}</p>
        </div>
        <form className="access-form" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("Email address", "E-mailadres")}</span><input type="email" autoComplete="email" {...register("email")} />{errors.email ? <small className="field-error">{errors.email.message}</small> : null}</label>
          <label className="form-field"><span>{text("Password", "Wachtwoord")}</span><input type="password" autoComplete="current-password" {...register("password")} />{errors.password ? <small className="field-error">{errors.password.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          <button className="primary-button access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}{text("Sign in securely", "Veilig aanmelden")}</button>
        </form>
        <p className="security-note"><ShieldCheck size={14} /> {text("No account? Ask your CODECO administrator for a personal invitation.", "Geen account? Vraag je CODECO-beheerder om een persoonlijke uitnodiging.")}</p>
      </section>
    </div>
  );
}

function PasswordSetupScreen({
  email,
  save,
  signOut,
}: {
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
        <div className="setup-top"><div className="access-brand"><span className="brand-mark" /><span><strong>CODECO N.V.</strong><small>{text("Internal invitation", "Interne uitnodiging")}</small></span></div><LanguageSwitcher /><button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button></div>
        <span className="state-icon"><KeyRound size={26} /></span>
        <p className="eyebrow">{text("First sign-in", "Eerste aanmelding")}</p><h1>{text("Set your password", "Stel je wachtwoord in")}</h1><p>{text("The invitation for", "De uitnodiging voor")} <strong>{email}</strong> {text("has been verified. Choose a personal password of at least 12 characters.", "is geverifieerd. Kies nu een persoonlijk wachtwoord van minimaal 12 tekens.")}</p>
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
        <div className="setup-top"><div className="access-brand"><span className="brand-mark" /><span><strong>CODECO N.V.</strong><small>{text("Internal access", "Interne toegang")}</small></span></div><LanguageSwitcher /></div>
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
        <div className="setup-top"><div className="access-brand"><span className="brand-mark" /><span><strong>CODECO N.V.</strong><small>{text("Initial setup", "Eerste inrichting")}</small></span></div><LanguageSwitcher /><button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button></div>
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
}: {
  organizationName: string;
  save: (answers: ProjectSetupAnswers) => Promise<boolean>;
  signOut: () => void;
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
      contractorName: "Main contractor",
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
    <div className="access-shell setup-shell">
      <section className="access-card setup-card project-setup-card">
        <div className="setup-top"><div className="access-brand"><span className="brand-mark" /><span><strong>{organizationName}</strong><small>{text("Initial setup", "Eerste inrichting")}</small></span></div><LanguageSwitcher /><button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> {text("Sign out", "Afmelden")}</button></div>
        <p className="eyebrow">{text("Step 2 of 2", "Stap 2 van 2")}</p><h1>{text("First project and building", "Eerste project en gebouw")}</h1><p>{text("The application atomically creates the project, building, your project access and three standard parties.", "De applicatie maakt atomair het project, gebouw, jouw projecttoegang en drie standaardpartijen aan.")}</p>
        <form className="access-form setup-form two-columns" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>{text("Project code", "Projectcode")}</span><input {...register("code")} />{errors.code ? <small className="field-error">{errors.code.message}</small> : null}</label>
          <label className="form-field"><span>{text("Project name", "Projectnaam")}</span><input {...register("name")} /></label>
          <label className="form-field"><span>{text("Location", "Locatie")}</span><input {...register("location")} /></label>
          <label className="form-field"><span>{text("Client", "Opdrachtgever")}</span><input {...register("clientName")} /></label>
          <label className="form-field"><span>{text("Building code", "Gebouwcode")}</span><input {...register("buildingCode")} /></label>
          <label className="form-field"><span>{text("Building name", "Gebouwnaam")}</span><input {...register("buildingName")} /></label>
          <label className="form-field wide"><span>{text("Main contractor", "Hoofdaannemer")}</span><input {...register("contractorName")} /></label>
          {error ? <p className="access-message error wide" role="alert">{error}</p> : null}
          <button className="primary-button access-submit wide" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}{text("Create project workspace", "Projectwerkruimte aanmaken")}</button>
        </form>
      </section>
    </div>
  );
}

function ContextSelection({
  projects,
  stage,
  selectedProject,
  selectedBuilding,
  chooseProject,
  chooseBuilding,
  openProjectStart,
  startProject,
  goBack,
  goBackToBuilding,
  currentUserName,
  storageStatus,
  initialProjectStart,
}: {
  projects: ProjectContext[];
  stage: WorkspaceStage;
  selectedProject: ProjectContext | null;
  selectedBuilding: BuildingContext | null;
  chooseProject: (project: ProjectContext) => void;
  chooseBuilding: (building: BuildingContext) => void;
  openProjectStart: () => void;
  startProject: (answers: ProjectStartAnswers) => void | Promise<void>;
  goBack: () => void;
  goBackToBuilding: () => void;
  currentUserName: string;
  storageStatus: string;
  initialProjectStart: ProjectStartAnswers | null;
}) {
  const { text } = useLanguage();
  const showBuildings = stage === "buildings" && selectedProject;
  const showProjectStart = stage === "project_start" && Boolean(selectedProject && selectedBuilding);
  return (
    <div className="context-shell">
      <header className="context-topbar">
        <div className="context-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy"><strong>CODECO N.V.</strong><small>Supervisie</small></span>
        </div>
        <div className="context-user"><LanguageSwitcher compact /><span className="avatar">{initials(currentUserName)}</span><span><strong>{currentUserName}</strong><small>{text("CODECO user", "CODECO-gebruiker")}</small></span></div>
      </header>

      <main className="context-content">
        <div className="data-mode-notice connected" role="status">
          <CheckCircle2 size={17} />
          <span><strong>{text("Online workspace", "Online werkruimte")}</strong> {storageStatus}. {text("Only changes confirmed by Supabase receive the saved status.", "Alleen door Supabase bevestigde wijzigingen krijgen de status opgeslagen.")}</span>
        </div>
        <div className="context-steps" aria-label={text("Select work context", "Werkcontext kiezen")}>
          <span className={stage === "projects" ? "active" : "done"}><strong>1</strong> Project</span>
          <ChevronRight size={14} />
          <span className={showBuildings ? "active" : showProjectStart ? "done" : ""}><strong>2</strong> {text("Building", "Gebouw")}</span>
          <ChevronRight size={14} />
          <span className={showProjectStart ? "active" : ""}><strong>3</strong> {text("Project start", "Projectstart")}</span>
        </div>

        {showProjectStart ? (
          <ProjectStartForm
            project={selectedProject!}
            building={selectedBuilding!}
            goBack={goBackToBuilding}
            startProject={startProject}
            initialAnswers={initialProjectStart}
          />
        ) : !showBuildings ? (
          <>
            <section className="context-heading">
              <div><p className="eyebrow">{text("My projects", "Mijn projecten")}</p><h1>{text("Where will you work today?", "Waar ga je vandaag werken?")}</h1><p>{text("Select the project first. Your building and daily report follow in the next step.", "Kies eerst het project. Je gebouw en dagrapport volgen in de volgende stap.")}</p></div>
              <button className="ghost-button" type="button"><Search size={14} /> {text("Search project", "Project zoeken")}</button>
            </section>
            <section className="project-selection-grid">
              {projects.map((project) => (
                <button className="project-selection-card" type="button" onClick={() => chooseProject(project)} key={project.id}>
                  <span className="selection-card-top">
                    <span className="selection-icon"><Building2 size={21} /></span>
                    <span className="project-code">{project.code}</span>
                  </span>
                  <span className="selection-copy"><strong>{project.name}</strong><small><MapPin size={12} /> {project.location}</small></span>
                  <span className="selection-meta"><span>{project.buildings.length} {text("buildings", "gebouwen")}</span><span>{project.openIssues} {text("open issues", "open punten")}</span></span>
                  <span className="selection-progress"><span style={{ width: `${project.progress}%` }} /><em>{project.progress}% {text("progress", "voortgang")}</em></span>
                  <span className="selection-action">{text("View buildings", "Gebouwen bekijken")} <ArrowRight size={14} /></span>
                </button>
              ))}
            </section>
          </>
        ) : (
          <>
            <button className="back-button context-back" type="button" onClick={goBack}><ArrowLeft size={15} /> {text("Back to projects", "Terug naar projecten")}</button>
            <section className="context-heading">
              <div><p className="eyebrow">{showBuildings.code} · {showBuildings.location}</p><h1>{text("Select a building", "Kies een gebouw")}</h1><p>{text("Physical records are always linked to this building.", "Fysieke registraties worden verplicht aan dit gebouw gekoppeld.")}</p></div>
              <span className="context-project-pill"><Building2 size={15} /> {showBuildings.name}</span>
            </section>
            <section className="building-selection-grid">
              {showBuildings.buildings.map((building) => {
                const active = selectedBuilding?.id === building.id;
                return (
                  <button className={`building-selection-card ${active ? "selected" : ""}`} type="button" onClick={() => chooseBuilding(building)} key={building.id}>
                    <span className="building-radio">{active ? <Check size={14} /> : null}</span>
                    <span className="building-selection-copy"><strong>{building.name}</strong><small>{building.description}</small></span>
                    <span className="building-stats"><span><b>{building.progress}%</b> {text("progress", "voortgang")}</span><span><b>{building.openIssues}</b> {text("open issues", "open punten")}</span></span>
                  </button>
                );
              })}
            </section>
            <div className="project-start-bar">
              <span><strong>{selectedBuilding ? selectedBuilding.name : text("No building selected", "Nog geen gebouw gekozen")}</strong><small>{selectedBuilding ? text("Your work context is complete.", "Je werkcontext is compleet.") : text("Select a building to continue.", "Kies een gebouw om door te gaan.")}</small></span>
              <button className="primary-button" type="button" disabled={!selectedBuilding} onClick={openProjectStart}>{text("Complete project start", "Projectstart invullen")} <ArrowRight size={15} /></button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ProjectStartForm({
  project,
  building,
  goBack,
  startProject,
  initialAnswers,
}: {
  project: ProjectContext;
  building: BuildingContext;
  goBack: () => void;
  startProject: (answers: ProjectStartAnswers) => void | Promise<void>;
  initialAnswers: ProjectStartAnswers | null;
}) {
  const { language, locale, text } = useLanguage();
  const localizedProjectStartSchema = useMemo(() => createProjectStartSchema(language), [language]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProjectStartAnswers>({
    resolver: zodResolver(localizedProjectStartSchema),
    mode: "onBlur",
    defaultValues: initialAnswers ?? {
      weatherCondition: "partly_cloudy",
      temperatureC: 31,
      windCondition: "moderate",
      shiftStart: "07:00",
      shiftEnd: "16:00",
      plannedWork: "Core wall formwork and floor reinforcement inspection",
      expectedWorkers: 42,
      inspectionPlanned: "yes",
      highRiskWork: "no",
      concreteWork: "yes",
      workPermit: "not_required",
      drawingStatus: "approved",
      drawingIssueReported: false,
      riskNotes: "Check the reinforcement steel delivery around 10:00.",
    },
  });
  const answers = useWatch({ control });
  const automation = getProjectStartAutomation(answers, 41, language);

  return (
    <>
      <button className="back-button context-back" type="button" onClick={goBack}><ArrowLeft size={15} /> {text("Back to buildings", "Terug naar gebouwen")}</button>
      <section className="context-heading project-start-heading">
        <div>
          <p className="eyebrow">{project.code} · {building.name}</p>
          <h1>{text("Start the workday with the right questions", "Start de werkdag met de juiste vragen")}</h1>
          <p>{text("Confirm only what cannot be reliably derived from the project. The rules show exactly what the app prepares next.", "Bevestig alleen wat niet betrouwbaar uit het project kan worden afgeleid. De regels rechts tonen direct wat de app daarna klaarzet.")}</p>
        </div>
        <span className="context-project-pill"><CalendarDays size={15} /> {currentDateLabel(locale)}</span>
      </section>

      <div className="project-start-layout">
        <form className="project-start-form" onSubmit={handleSubmit(startProject)} noValidate>
          <section className="form-section-card">
            <header><span className="form-section-number">1</span><span><strong>{text("Weather and working hours", "Weer en werktijden")}</strong><small>{text("Observed manually on site", "Handmatig waargenomen op de bouwplaats")}</small></span></header>
            <div className="form-grid three-columns">
              <label className="form-field"><span>{text("What is the weather?", "Wat is het weer?")}</span><select {...register("weatherCondition")}><option value="sunny">{text("Sunny", "Zonnig")}</option><option value="partly_cloudy">{text("Partly cloudy", "Licht bewolkt")}</option><option value="cloudy">{text("Cloudy", "Bewolkt")}</option><option value="rain">{text("Rain", "Regen")}</option><option value="heavy_rain">{text("Heavy rain", "Zware regen")}</option></select></label>
              <label className="form-field"><span>{text("Temperature", "Temperatuur")}</span><span className="input-with-unit"><input type="number" {...register("temperatureC", { valueAsNumber: true })} /><em>°C</em></span>{errors.temperatureC ? <small className="field-error">{errors.temperatureC.message}</small> : null}</label>
              <label className="form-field"><span>{text("Wind", "Wind")}</span><select {...register("windCondition")}><option value="calm">{text("Calm", "Kalm")}</option><option value="moderate">{text("Moderate", "Matig")}</option><option value="strong">{text("Strong", "Sterk")}</option></select></label>
              <label className="form-field"><span>{text("Shift start", "Start werktijd")}</span><input type="time" {...register("shiftStart")} />{errors.shiftStart ? <small className="field-error">{errors.shiftStart.message}</small> : null}</label>
              <label className="form-field"><span>{text("Shift end", "Einde werktijd")}</span><input type="time" {...register("shiftEnd")} />{errors.shiftEnd ? <small className="field-error">{errors.shiftEnd.message}</small> : null}</label>
              <label className="form-field"><span>{text("Expected workforce", "Verwachte bezetting")}</span><span className="input-with-unit"><input type="number" {...register("expectedWorkers", { valueAsNumber: true })} /><em>{text("people", "personen")}</em></span></label>
            </div>
          </section>

          <section className="form-section-card">
            <header><span className="form-section-number">2</span><span><strong>{text("What is planned today?", "Wat staat vandaag gepland?")}</strong><small>{text("This feeds the day plan and suggested modules", "Dit voedt het dagplan en de voorgestelde modules")}</small></span></header>
            <div className="form-grid two-columns">
              <label className="form-field wide"><span>{text("Planned work *", "Geplande werkzaamheden *")}</span><textarea rows={3} {...register("plannedWork")} />{errors.plannedWork ? <small className="field-error">{errors.plannedWork.message}</small> : null}</label>
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
              <label className="form-field wide"><span>{text("Which risks do you expect today?", "Welke risico’s verwacht je vandaag?")}</span><textarea rows={3} placeholder={text("For example lifting, rain, delivery or groundwater", "Bijvoorbeeld hijswerk, regen, levering of grondwater")} {...register("riskNotes")} /></label>
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
          <p className="automation-intro">{text("No AI: every action comes from a fixed project rule and remains under supervisor control.", "Geen AI: iedere actie komt uit een vaste projectregel en blijft door de supervisor controleerbaar.")}</p>
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
    </>
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
  buildingName,
  attendanceTotal,
  projectStartAnswers,
  dailyCloseoutAnswers,
  openDailyQuestions,
  currentUserName,
  reportNumber,
  actions,
}: {
  entries: TimelineEntry[];
  completeness: number;
  completedTodos: number[];
  toggleTodo: (id: number) => void;
  openReport: () => void;
  showCritical: () => void;
  projectName: string;
  buildingName: string;
  attendanceTotal: number;
  projectStartAnswers: ProjectStartAnswers | null;
  dailyCloseoutAnswers: DailyCloseoutAnswers | null;
  openDailyQuestions: () => void;
  currentUserName: string;
  reportNumber: string;
  actions: ProjectAction[];
}) {
  const { language, locale, text } = useLanguage();
  const todos = [
    { id: 1, title: text("Confirm weather and working hours", "Weer en werktijden bevestigen"), detail: projectStartAnswers ? text("Recorded centrally", "Centraal vastgelegd") : text("Project start required", "Projectstart vereist"), flag: "" },
    { id: 2, title: text("Confirm quality and HSE", "Kwaliteit en HSE bevestigen"), detail: dailyCloseoutAnswers ? text("Recorded centrally", "Centraal vastgelegd") : text("Daily questions required", "Dagvragen vereist"), flag: "red" },
    { id: 3, title: text("Complete tomorrow's plan", "Planning voor morgen invullen"), detail: dailyCloseoutAnswers ? text("Recorded centrally", "Centraal vastgelegd") : text("Before daily closeout", "Voor dagafsluiting"), flag: "" },
  ];
  const automation = projectStartAnswers ? getProjectStartAutomation(projectStartAnswers, 41, language) : [];
  const criticalEntry = entries.find((entry) => entry.badgeTone === "red");
  const inspectionCount = entries.filter((entry) => entry.kind === "inspection").length;
  const progress = dailyCloseoutAnswers?.progressPercent ?? 0;
  const openTodoCount = todos.filter((todo) => !completedTodos.includes(todo.id)).length;
  const weatherLabel = projectStartAnswers
    ? `${projectStartAnswers.temperatureC}°C · ${({ sunny: text("Sunny", "Zonnig"), partly_cloudy: text("Partly cloudy", "Licht bewolkt"), cloudy: text("Cloudy", "Bewolkt"), rain: text("Rain", "Regen"), heavy_rain: text("Heavy rain", "Zware regen") })[projectStartAnswers.weatherCondition]}`
    : text("Weather not confirmed", "Weer nog niet bevestigd");

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">{currentDateLabel(locale)}</p>
          <h1>{text("Good morning", "Goedemorgen")}, {currentUserName}.</h1>
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
          <button className="primary-button day-questions-button" type="button" onClick={openDailyQuestions}><ClipboardCheck size={15} /> {text("Complete daily questions", "Dagvragen invullen")}</button>
        </div>
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
            <button className="ghost-button" type="button"><History size={13} /> {text("View all", "Alles bekijken")}</button>
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
  openAction,
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
  openAction: (action: ProjectAction) => void;
  reportNumber: string;
  reportStatus: string;
  canManageMembers: boolean;
  openUserAdmin: () => void;
}) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? actionStatusLabelsEnglish : actionStatusLabels;
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
    return (
      <>
        <header className="secondary-header">
          <div><p className="eyebrow">{actions.length} {text("centrally recorded", "centraal geregistreerd")}</p><h1>{text("Actions", "Acties")}</h1><p>{text("Personal and assigned follow-up in one list.", "Persoonlijke en toegewezen opvolging in één lijst.")}</p></div>
          <button className="primary-button" type="button" onClick={openQuickAdd}><Plus size={15} /> {text("Add action", "Actie toevoegen")}</button>
        </header>
        <section className="actions-list">
          {actions.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No actions yet", "Nog geen acties")}</strong><span>{text("Actions recorded in Supabase appear here.", "Acties die in Supabase worden vastgelegd verschijnen hier.")}</span></div> : null}
          {actions.map((action) => {
            const dueAt = action.due_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(action.due_at)) : text("No deadline", "Geen deadline");
            const latestUpdate = actionUpdates.find((update) => update.action_id === action.id);
            return (
            <button className="action-row" type="button" key={action.id} onClick={() => openAction(action)} style={{ textAlign: "left", cursor: "pointer" }}>
              <span className="action-icon"><CheckCircle2 size={18} /></span>
              <span className="action-copy"><strong>{action.title}</strong><span>{dueAt} · {action.action_number}{latestUpdate ? ` · ${latestUpdate.message}` : ""}</span></span>
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
    ...(canManageMembers ? [{ title: text("Users and access", "Gebruikers en toegang"), copy: text("Invite internal accounts and assign roles", "Interne accounts uitnodigen en rollen toewijzen"), icon: Users, action: openUserAdmin }] : []),
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

function NotificationsModal({ notifications, loading, close, markRead }: { notifications: ProjectNotification[]; loading: boolean; close: () => void; markRead: (notificationId: string) => Promise<void> }) {
  const { locale, text } = useLanguage();
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal notifications-modal" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
        <header className="modal-header"><div><h2 id="notifications-title">{text("Notifications and deadlines", "Meldingen en deadlines")}</h2><p>{text("In-app reminders from central actions, findings and report reviews.", "In-app herinneringen uit centrale acties, bevindingen en rapportreviews.")}</p></div><button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button></header>
        <div className="modal-body notification-list">
          {loading ? <div className="empty-list-state"><Loader2 className="spin" size={22} /><strong>{text("Loading notifications", "Meldingen laden")}</strong><span>{text("Deadlines are checked using fixed rules.", "Deadlines worden regelgestuurd gecontroleerd.")}</span></div> : null}
          {!loading && notifications.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No notifications", "Geen meldingen")}</strong><span>{text("There are no open personal reminders.", "Er zijn geen openstaande persoonlijke herinneringen.")}</span></div> : null}
          {notifications.map((notification) => (
            <button className={`notification-row ${notification.read_at ? "read" : ""}`} type="button" key={notification.id} onClick={() => void markRead(notification.id)}>
              <span className="notification-row-icon">{notification.notification_type.includes("overdue") || notification.notification_type.includes("critical") ? <AlertTriangle size={17} /> : <Bell size={17} />}</span>
              <span><strong>{notification.title}</strong><span>{notification.body}</span><small>{notification.due_at ? `${text("Deadline", "Deadline")} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(notification.due_at))}` : text("Immediate follow-up", "Directe opvolging")}</small></span>
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
}) {
  const { language, text } = useLanguage();
  const localizedInternalUserInviteSchema = useMemo(() => createInternalUserInviteSchema(language), [language]);
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [success, setSuccess] = useState("");
  const [memberError, setMemberError] = useState("");
  const [memberAction, setMemberAction] = useState<{ userId: string; nextStatus: "active" | "suspended" | "revoked"; reason: string } | null>(null);
  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<InternalUserInviteAnswers>({
    resolver: zodResolver(localizedInternalUserInviteSchema),
    defaultValues: { organizationId, displayName: "", email: "", roleCode: "", projectId: "" },
  });
  const roleCode = useWatch({ control, name: "roleCode" });
  const selectedRole = access?.roles.find((role) => role.code === roleCode);

  useEffect(() => {
    if (!roleCode && access?.roles[0]) setValue("roleCode", access.roles[0].code);
  }, [access, roleCode, setValue]);

  const submit = async (answers: InternalUserInviteAnswers) => {
    if (selectedRole?.scope === "project" && !answers.projectId) {
      setInviteError(text("Choose the project this employee may access.", "Kies het project waarop deze medewerker toegang krijgt."));
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
      setSuccess(text(`The personal invitation for ${answers.email} was sent.`, `De persoonlijke uitnodiging voor ${answers.email} is verzonden.`));
      reset({ organizationId, displayName: "", email: "", roleCode: roleCode || access?.roles[0]?.code || "", projectId: "" });
    } else {
      setInviteError(text("The invitation was not completed. Review the message and try again.", "De uitnodiging is niet voltooid. Bekijk de melding en probeer opnieuw."));
    }
    setBusy(false);
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

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal user-admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-admin-title">
        <header className="modal-header">
          <div><h2 id="user-admin-title">{text("Users and access", "Gebruikers en toegang")}</h2><p>{text("Only organization administrators can invite internal accounts.", "Alleen organisatiebeheerders kunnen interne accounts uitnodigen.")}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body user-admin-body">
          <section className="invite-panel" aria-labelledby="invite-heading">
            <div className="section-heading"><span className="module-card-icon"><UserPlus size={18} /></span><span><h3 id="invite-heading">{text("Invite employee", "Medewerker uitnodigen")}</h3><p>{text("The employee receives a personal email link and then sets a password.", "De medewerker ontvangt een persoonlijke e-maillink en stelt daarna zelf een wachtwoord in.")}</p></span></div>
            <form className="form-grid" onSubmit={handleSubmit(submit)} noValidate>
              <input type="hidden" {...register("organizationId")} />
              <label className="form-field"><span>{text("Full name *", "Volledige naam *")}</span><input autoComplete="off" {...register("displayName")} />{errors.displayName ? <small className="field-error">{errors.displayName.message}</small> : null}</label>
              <label className="form-field"><span>{text("Business email address *", "Zakelijk e-mailadres *")}</span><input type="email" autoComplete="off" {...register("email")} />{errors.email ? <small className="field-error">{errors.email.message}</small> : null}</label>
              <label className="form-field"><span>{text("Role *", "Rol *")}</span><select {...register("roleCode")} disabled={!access?.roles.length}><option value="">{text("Choose a role", "Kies een rol")}</option>{access?.roles.map((role) => <option value={role.code} key={role.id}>{role.name} · {role.scope === "organization" ? text("entire organization", "hele organisatie") : text("project", "project")}</option>)}</select>{errors.roleCode ? <small className="field-error">{errors.roleCode.message}</small> : null}</label>
              {selectedRole?.scope === "project" ? <label className="form-field"><span>Project *</span><select {...register("projectId")}><option value="">{text("Choose a project", "Kies een project")}</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.code} · {project.name}</option>)}</select>{errors.projectId ? <small className="field-error">{errors.projectId.message}</small> : null}</label> : <div className="scope-note"><ShieldCheck size={16} /><span><strong>{text("Organization-wide access", "Organisatiebrede toegang")}</strong><small>{text("This role applies to all current projects in the organization.", "Deze rol geldt voor alle huidige projecten binnen de organisatie.")}</small></span></div>}
              {inviteError ? <p className="access-message error full" role="alert">{inviteError}</p> : null}
              {success ? <p className="access-message success full" role="status">{success}</p> : null}
              <div className="modal-actions full"><span className="form-note"><ShieldCheck size={13} /> {text("Roles come from the central permission configuration.", "Rollen komen uit de centrale rechtenconfiguratie.")}</span><button className="primary-button" type="submit" disabled={busy || loading || Boolean(loadError)}>{busy ? <Loader2 className="spin" size={15} /> : <UserPlus size={15} />}{text("Send invitation", "Uitnodiging versturen")}</button></div>
            </form>
          </section>

          <section className="internal-members" aria-labelledby="members-heading">
            <div className="member-list-heading"><span><h3 id="members-heading">{text("Internal accounts", "Interne accounts")}</h3><p>{access?.members.length ?? 0} {text("account(s) with organization or project access", "account(s) met organisatie- of projecttoegang")}</p></span>{loadError ? <button className="ghost-button" type="button" onClick={reload}>{text("Reload", "Opnieuw laden")}</button> : null}</div>
            {loading ? <div className="empty-list-state"><Loader2 className="spin" size={22} /><strong>{text("Loading accounts", "Accounts laden")}</strong><span>{text("Roles and project access are being verified.", "Rollen en projecttoegang worden gecontroleerd.")}</span></div> : null}
            {loadError ? <p className="access-message error" role="alert">{loadError}</p> : null}
            {memberError ? <p className="access-message error" role="alert">{memberError}</p> : null}
            {!loading && !loadError && access?.members.length === 0 ? <div className="empty-list-state"><Users size={22} /><strong>{text("No accounts yet", "Nog geen accounts")}</strong><span>{text("Send the first internal invitation above.", "Verstuur hierboven de eerste interne uitnodiging.")}</span></div> : null}
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
                  {memberAction?.userId === member.userId ? <div className="member-status-form"><label className="form-field"><span>{text("Reason for", "Reden voor")} {memberAction.nextStatus === "active" ? text("reactivation", "heractivering") : memberAction.nextStatus === "suspended" ? text("suspension", "opschorting") : text("permanent revocation", "definitieve intrekking")} *</span><textarea rows={2} value={memberAction.reason} onChange={(event) => setMemberAction({ ...memberAction, reason: event.target.value })} placeholder={text("At least 5 characters; stored in the audit trail", "Minimaal 5 tekens; wordt in de audittrail bewaard")} /></label><div className="button-row"><button className="ghost-button" type="button" onClick={() => setMemberAction(null)}>{text("Cancel", "Annuleren")}</button><button className="primary-button" type="button" disabled={busy || memberAction.reason.trim().length < 5} onClick={() => void confirmMemberAction()}>{busy ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />} {text("Confirm status", "Status bevestigen")}</button></div></div> : null}
                </div>;
              })}
            </div>
          </section>
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
          <div><h2 id="quick-title">{text("Quick add", "Snel toevoegen")}</h2><p>{text("The project and building are linked automatically.", "Project en gebouw worden automatisch gekoppeld.")}</p></div>
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
  location,
  priority,
  setDescription,
  setLocation,
  setPriority,
  goBack,
  close,
  save,
  projectName,
  buildingName,
}: {
  selectedType: string;
  description: string;
  location: string;
  priority: string;
  setDescription: (value: string) => void;
  setLocation: (value: string) => void;
  setPriority: (value: string) => void;
  goBack: () => void;
  close: () => void;
  save: () => void;
  projectName: string;
  buildingName: string;
}) {
  const { language, locale, text } = useLanguage();
  const title = (language === "en" ? entryTitlesEnglish : entryTitles)[selectedType] ?? text("Record", "Registratie");
  const needsPriority = selectedType === "finding" || selectedType === "hse" || selectedType === "action";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
        <header className="modal-header">
          <div><h2 id="entry-title">{text(`Record ${title.toLowerCase()}`, `${title} vastleggen`)}</h2><p>{projectName} · {buildingName} · {currentTime(locale)}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="description">{text("Short description *", "Korte omschrijving *")}</label>
              <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={text(`What do you want to record about this ${title.toLowerCase()}?`, `Wat wil je over deze ${title.toLowerCase()} vastleggen?`)} autoFocus />
            </div>
            <div className="form-field">
              <label htmlFor="location">{text("Location *", "Locatie *")}</label>
              <select id="location" value={location} onChange={(event) => setLocation(event.target.value)}>
                <option>{text("Floor 3 · East zone", "Verdieping 3 · Zone oost")}</option>
                <option>{text("Floor 3 · West zone", "Verdieping 3 · Zone west")}</option>
                <option>{text("Floor 2 · Core", "Verdieping 2 · Kern")}</option>
                <option>{text("Outdoor area · North", "Buitenterrein · Noord")}</option>
              </select>
            </div>
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
                <select id="work-package"><option>{text("Structural work", "Ruwbouw")}</option><option>{text("Installations", "Installaties")}</option><option>{text("Finishing", "Afwerking")}</option></select>
              </div>
            )}
            <div className="form-field full">
              <label>{text("Add evidence", "Bewijs toevoegen")}</label>
              <button className="ghost-button" type="button" style={{ justifyContent: "center", minHeight: 50 }}><Camera size={16} /> {text("Choose photo or attachment", "Foto of bijlage kiezen")}</button>
              <span className="form-note"><CheckCircle2 size={12} /> {text("Time, author, project and building are recorded automatically.", "Tijd, maker, project en gebouw worden automatisch vastgelegd.")}</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={14} /> {text("Back", "Terug")}</button>
            <button className="primary-button" type="button" onClick={save} disabled={!description.trim()}>{text("Save and include", "Opslaan en opnemen")} <Check size={14} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionCreateModal({
  parties,
  projectName,
  buildingName,
  close,
  goBack,
  save,
}: {
  parties: ProjectParty[];
  projectName: string;
  buildingName: string;
  close: () => void;
  goBack: () => void;
  save: (answers: ProjectActionAnswers) => Promise<boolean>;
}) {
  const { text } = useLanguage();
  const [busy, setBusy] = useState(false);
  const defaultParty = parties.find((party) => party.type === "contractor")?.id ?? parties[0]?.id ?? "";
  const { register, handleSubmit, formState: { errors } } = useForm<ProjectActionAnswers>({
    resolver: zodResolver(projectActionSchema),
    defaultValues: {
      title: "",
      description: "",
      ownerPartyId: defaultParty,
      dueAt: defaultActionDeadline(),
      priority: "normal",
    },
  });
  const submit = async (answers: ProjectActionAnswers) => {
    setBusy(true);
    await save(answers);
    setBusy(false);
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal action-modal" role="dialog" aria-modal="true" aria-labelledby="action-create-title">
        <header className="modal-header">
          <div><h2 id="action-create-title">{text("Create central action", "Actie centraal aanmaken")}</h2><p>{projectName} · {buildingName}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <form className="modal-body" onSubmit={handleSubmit(submit)} noValidate>
          <div className="form-grid two-columns">
            <label className="form-field full"><span>{text("Action *", "Actie *")}</span><input autoFocus placeholder={text("What must demonstrably be completed?", "Wat moet aantoonbaar worden uitgevoerd?")} {...register("title")} />{errors.title ? <small className="field-error">{errors.title.message}</small> : null}</label>
            <label className="form-field full"><span>{text("Context and acceptance criterion *", "Context en acceptatiecriterium *")}</span><textarea rows={4} placeholder={text("Describe the location, required measure and completion criterion.", "Beschrijf locatie, gewenste maatregel en wanneer de actie gereed is.")} {...register("description")} />{errors.description ? <small className="field-error">{errors.description.message}</small> : null}</label>
            <label className="form-field"><span>{text("Responsible party *", "Verantwoordelijke partij *")}</span><select {...register("ownerPartyId")} disabled={parties.length === 0}><option value="">{text("Choose party", "Kies partij")}</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select>{errors.ownerPartyId ? <small className="field-error">{errors.ownerPartyId.message}</small> : null}</label>
            <label className="form-field"><span>Deadline *</span><input type="datetime-local" {...register("dueAt")} />{errors.dueAt ? <small className="field-error">{errors.dueAt.message}</small> : null}</label>
            <label className="form-field"><span>{text("Priority", "Prioriteit")}</span><select {...register("priority")}><option value="low">{text("Low", "Laag")}</option><option value="normal">{text("Normal", "Normaal")}</option><option value="high">{text("High", "Hoog")}</option><option value="critical">{text("Critical", "Kritiek")}</option></select></label>
            <div className="action-rule-note"><ShieldCheck size={16} /><span><strong>{text("Controlled follow-up flow", "Vaste opvolgflow")}</strong><small>{text("Open → accepted → in progress → verification → closed.", "Open → geaccepteerd → in uitvoering → verificatie → gesloten.")}</small></span></div>
          </div>
          <div className="modal-actions">
            <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={14} /> {text("Back", "Terug")}</button>
            <button className="primary-button" type="submit" disabled={busy || parties.length === 0}>{busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />} {text("Save centrally", "Centraal opslaan")}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ActionDetailModal({
  action,
  partyName,
  updates,
  close,
  transition,
}: {
  action: ProjectAction;
  partyName: string;
  updates: ActionUpdate[];
  close: () => void;
  transition: (nextStatus: ProjectAction["status"], note: string) => Promise<boolean>;
}) {
  const { language, locale, text } = useLanguage();
  const statusLabels = language === "en" ? actionStatusLabelsEnglish : actionStatusLabels;
  const [busy, setBusy] = useState(false);
  const nextStatus = nextActionStatus[action.status];
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ActionTransitionAnswers>({
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
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal action-detail-modal" role="dialog" aria-modal="true" aria-labelledby="action-detail-title">
        <header className="modal-header">
          <div><p className="eyebrow">{action.action_number}</p><h2 id="action-detail-title">{action.title}</h2><p>{partyName} · {text("deadline", "deadline")} {dueAt}</p></div>
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
              <label className="form-field"><span>{nextStatus === "verified" ? text("Verification note *", "Verificatienotitie *") : text("Execution note *", "Uitvoeringsnotitie *")}</span><textarea rows={3} placeholder={text("Record what was completed, checked or is still required.", "Leg vast wat is uitgevoerd, gecontroleerd of nog nodig is.")} {...register("note")} />{errors.note ? <small className="field-error">{errors.note.message}</small> : null}</label>
              <button className="primary-button" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <ArrowRight size={14} />} {text("Move to", "Naar")} {statusLabels[nextStatus].toLowerCase()}</button>
            </form>
          ) : <p className="action-complete-note"><CheckCircle2 size={16} /> {action.status === "verified" ? text("This action has been formally verified and closed.", "Deze actie is formeel geverifieerd en gesloten.") : text("This action was cancelled and remains visible in the history.", "Deze actie is geannuleerd en blijft in de historie zichtbaar.")}</p>}
        </div>
      </section>
    </div>
  );
}

function AttendanceModal({
  rows,
  total,
  changeCount,
  copyPreviousDay,
  close,
  save,
}: {
  rows: AttendanceRow[];
  total: number;
  changeCount: (id: string, delta: number) => void;
  copyPreviousDay: () => void;
  close: () => void;
  save: () => void;
}) {
  const { text } = useLanguage();
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-title">
        <header className="modal-header">
          <div><h2 id="attendance-title">{text("Today's attendance", "Aanwezigheid vandaag")}</h2><p>{text("Parties, disciplines and shifts", "Partijen, disciplines en werktijden")} · {total} {text("people", "personen")}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="attendance-toolbar">
            <span><Users size={16} /><strong>{total}</strong> {text("people present in total", "aanwezigen in totaal")}</span>
            <button className="ghost-button" type="button" onClick={copyPreviousDay}><Copy size={13} /> {text("Copy previous workday", "Vorige werkdag overnemen")}</button>
          </div>
          <div className="attendance-list">
            {rows.map((row) => (
              <div className="attendance-row" key={row.id}>
                <span className="attendance-party"><strong>{row.party}</strong><small>{row.discipline} · {row.shiftStart}–{row.shiftEnd}</small></span>
                <span className="counter-control">
                  <button type="button" onClick={() => changeCount(row.id, -1)} aria-label={text(`One fewer person at ${row.party}`, `Eén persoon minder bij ${row.party}`)}><Minus size={14} /></button>
                  <strong>{row.count}</strong>
                  <button type="button" onClick={() => changeCount(row.id, 1)} aria-label={text(`One more person at ${row.party}`, `Eén persoon meer bij ${row.party}`)}><Plus size={14} /></button>
                </span>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <span className="form-note"><CheckCircle2 size={13} /> {text("Totals are reused in the daily report.", "Totalen worden in het dagrapport hergebruikt.")}</span>
            <button className="primary-button" type="button" onClick={save}>{text("Confirm attendance", "Aanwezigheid bevestigen")} <Check size={14} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DailyQuestionsModal({
  close,
  initialAnswers,
  projectStartAnswers,
  save,
}: {
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
    formState: { errors },
  } = useForm<DailyCloseoutAnswers>({
    resolver: zodResolver(localizedDailyCloseoutSchema),
    mode: "onBlur",
    defaultValues: initialAnswers ?? {
      daySummary: "",
      weatherSummary: projectStartAnswers
        ? `${({ sunny: text("Sunny", "Zonnig"), partly_cloudy: text("Partly cloudy", "Licht bewolkt"), cloudy: text("Cloudy", "Bewolkt"), rain: text("Rain", "Regen"), heavy_rain: text("Heavy rain", "Zware regen") })[projectStartAnswers.weatherCondition]}, ${projectStartAnswers.temperatureC}°C, ${text("wind", "wind")} ${projectStartAnswers.windCondition === "strong" ? text("strong", "sterk") : projectStartAnswers.windCondition === "moderate" ? text("moderate", "matig") : text("calm", "kalm")}`
        : "",
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
  const [qualityIssues, hseEvent, delayCause] = useWatch({
    control,
    name: ["qualityIssues", "hseEvent", "delayCause"],
  });
  const stepFields: Array<Array<keyof DailyCloseoutAnswers>> = [
    ["daySummary", "weatherSummary", "workPerformed", "progressPercent"],
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
          <div><h2 id="daily-questions-title">{text("Daily questions for the report", "Dagvragen voor het rapport")}</h2><p>{clientReportSections.length} {text("client sections · reused across modules · step", "klantonderdelen · modulair hergebruikt · stap")} {step + 1} {text("of", "van")} 4</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <form className="modal-body daily-questions-body" onSubmit={handleSubmit(save)} noValidate>
          <div className="question-stepper" aria-label={text("Daily questions progress", "Voortgang dagvragen")}>
            {stepTitles.map((title, index) => <span className={index === step ? "active" : index < step ? "done" : ""} key={title}><b>{index < step ? <Check size={12} /> : index + 1}</b>{title}</span>)}
          </div>

          {step === 0 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><Gauge size={18} /></span><span><h3>{text("How did the project go today?", "Hoe is het project vandaag gegaan?")}</h3><p>{text("These answers feed the summary, work performed and progress; the underlying modules remain the source.", "Deze antwoorden voeden samenvatting, werkzaamheden en voortgang; de onderliggende modules blijven de bron.")}</p></span></header>
              <div className="form-grid two-columns">
                <label className="form-field wide"><span>{text("Daily summary *", "Samenvatting van de dag *")}</span><textarea rows={4} placeholder={text("Summarize what happened in no more than five lines.", "Vat in maximaal vijf regels samen wat er is gebeurd.")} {...register("daySummary")} />{errors.daySummary ? <small className="field-error">{errors.daySummary.message}</small> : null}</label>
                <label className="form-field"><span>{text("What was the actual weather? *", "Wat was het werkelijke weer? *")}</span><input type="text" {...register("weatherSummary")} />{errors.weatherSummary ? <small className="field-error">{errors.weatherSummary.message}</small> : null}</label>
                <label className="form-field"><span>{text("Project progress", "Voortgang project")}</span><span className="input-with-unit"><input type="number" min="0" max="100" {...register("progressPercent", { valueAsNumber: true })} /><em>%</em></span>{errors.progressPercent ? <small className="field-error">{errors.progressPercent.message}</small> : null}</label>
                <label className="form-field wide"><span>{text("Which work was performed? *", "Welke werkzaamheden zijn uitgevoerd? *")}</span><textarea rows={4} placeholder={text("Activity, location and percentage complete.", "Activiteit, locatie en percentage gereed.")} {...register("workPerformed")} />{errors.workPerformed ? <small className="field-error">{errors.workPerformed.message}</small> : null}</label>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><ShieldCheck size={18} /></span><span><h3>{text("What was checked and were there deviations?", "Wat is gecontroleerd en waren er afwijkingen?")}</h3><p>{text("Failed answers are only proposed as a draft finding or HSE record; the supervisor confirms severity and follow-up.", "Niet-akkoord antwoorden worden alleen als conceptbevinding of HSE-melding voorgesteld; de supervisor bevestigt ernst en vervolg.")}</p></span></header>
              <div className="form-grid two-columns">
                <label className="form-field"><span>{text("Inspections performed", "Inspecties uitgevoerd")}</span><select {...register("inspectionResult")}><option value="none">{text("No inspection", "Geen inspectie")}</option><option value="all_ok">{text("Performed · all passed", "Uitgevoerd · alles akkoord")}</option><option value="issues">{text("Performed · deviation found", "Uitgevoerd · afwijking gevonden")}</option></select></label>
                <label className="form-field"><span>{text("Quality findings?", "Kwaliteitsbevindingen?")}</span><select {...register("qualityIssues")}><option value="no">{text("No", "Nee")}</option><option value="yes">{text("Yes", "Ja")}</option></select></label>
                {qualityIssues === "yes" ? <label className="form-field wide"><span>{text("Describe location, finding and responsible party *", "Omschrijf locatie, bevinding en verantwoordelijke *")}</span><textarea rows={4} {...register("qualityDetails")} />{errors.qualityDetails ? <small className="field-error">{errors.qualityDetails.message}</small> : null}</label> : null}
                <label className="form-field"><span>{text("Safety event?", "Veiligheidsgebeurtenis?")}</span><select {...register("hseEvent")}><option value="none">{text("No incident / near miss", "Geen incident / near miss")}</option><option value="near_miss">Near miss</option><option value="incident">Incident</option></select></label>
                {hseEvent !== "none" ? <label className="form-field wide"><span>{text("Describe the event and immediate measure *", "Omschrijf gebeurtenis en directe maatregel *")}</span><textarea rows={4} {...register("hseDetails")} />{errors.hseDetails ? <small className="field-error">{errors.hseDetails.message}</small> : null}</label> : null}
              </div>
              <div className="question-module-note"><AlertTriangle size={14} /><span>{text("The app never closes an incident, NCR or repair autonomously. This remains a human action.", "De app sluit nooit autonoom een incident, NCR of herstel. Dit blijft een menselijke handeling.")}</span></div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><PackageCheck size={18} /></span><span><h3>{text("Which logistics, tests or delays affected the day?", "Welke logistiek, testen of vertraging speelden mee?")}</h3><p>{text("Answers are linked to equipment, deliveries, measurements, variation work and delay.", "Antwoorden worden gekoppeld aan materieel, leveringen, metingen, meer-/minderwerk en vertraging.")}</p></span></header>
              <div className="form-grid two-columns">
                <label className="form-field"><span>{text("Equipment and status", "Materieel en status")}</span><textarea rows={3} placeholder={text("For example concrete pump operational; plate compactor out of service", "Bijv. betonpomp operationeel; trilplaat buiten gebruik")} {...register("equipmentStatus")} /></label>
                <label className="form-field"><span>{text("Materials delivered", "Materialen geleverd")}</span><textarea rows={3} placeholder={text("Material, quantity and supplier", "Materiaal, hoeveelheid en leverancier")} {...register("deliveries")} /></label>
                <label className="form-field wide"><span>{text("Tests and measurements", "Testen en meetwaarden")}</span><textarea rows={3} placeholder={text("For example slump 90 mm; concrete cover 45 mm", "Bijv. slump 90 mm; betondekking 45 mm")} {...register("testsMeasurements")} /></label>
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
                <label className="form-field"><span>{text("Communication and agreements", "Communicatie en gemaakte afspraken")}</span><textarea rows={4} placeholder={text("Who agreed what, and when?", "Met wie is wat afgesproken en wanneer?")} {...register("communication")} /></label>
                <label className="form-field"><span>{text("Open risks", "Open risico’s")}</span><textarea rows={4} placeholder={text("Weather, delivery, groundwater, lifting...", "Weer, levering, grondwater, hijswerk...")} {...register("risks")} /></label>
                <label className="form-field wide"><span>{text("Which work is planned for tomorrow? *", "Welke werkzaamheden staan morgen gepland? *")}</span><textarea rows={4} {...register("tomorrowPlan")} />{errors.tomorrowPlan ? <small className="field-error">{errors.tomorrowPlan.message}</small> : null}</label>
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
  onDownload,
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
  onDownload: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
}) {
  const { text } = useLanguage();
  const hseComplete = completedTodos.includes(2) || Boolean(dailyCloseoutAnswers);
  const tomorrowComplete = completedTodos.includes(3) || Boolean(dailyCloseoutAnswers?.tomorrowPlan);
  const checks = [
    { title: text("Project and report details", "Project- en rapportgegevens"), detail: text("Number, date, shift and buildings", "Nummer, datum, dienst en gebouwen"), complete: true },
    { title: text("Attendance and activities", "Aanwezigheid en activiteiten"), detail: text(`${attendanceTotal} people and ${entries.length} daily records`, `${attendanceTotal} personen en ${entries.length} dagregistraties`), complete: true },
    { title: text("Inspections and findings", "Inspecties en bevindingen"), detail: text(`${entries.filter((entry) => entry.kind === "inspection").length} inspections · ${entries.filter((entry) => entry.badgeTone === "red").length} critical record(s)`, `${entries.filter((entry) => entry.kind === "inspection").length} inspecties · ${entries.filter((entry) => entry.badgeTone === "red").length} kritieke registratie(s)`), complete: true },
    { title: text("Daily questions in the client format", "Dagvragen volgens klantformat"), detail: dailyCloseoutAnswers ? text("Progress, weather, logistics, risks and tomorrow confirmed", "Verloop, weer, logistiek, risico's en morgen bevestigd") : text("Four guided question groups still need completion", "Vier begeleide vraaggroepen nog invullen"), complete: Boolean(dailyCloseoutAnswers) },
    { title: text("Daily HSE check", "HSE-dagcheck"), detail: hseComplete ? text("All checkpoints completed", "Alle controlepunten ingevuld") : text("3 checkpoints are still missing", "Nog 3 controlepunten ontbreken"), complete: hseComplete },
    { title: text("Tomorrow's plan", "Planning voor morgen"), detail: tomorrowComplete ? text("The plan is confirmed", "Planning is bevestigd") : text("Not completed yet", "Nog niet ingevuld"), complete: tomorrowComplete },
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
              <button className="ghost-button" type="button" disabled={missing > 0} onClick={onDownload}><FileText size={14} /> {text("Draft PDF", "Concept-PDF")}</button>
              <button className="primary-button" type="button" disabled={missing > 0 || submitted} onClick={onSubmit}>{submitted ? text("Submitted", "Ingediend") : text("Ready for review", "Gereed voor review")} <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
