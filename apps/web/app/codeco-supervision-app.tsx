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
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  clientReportSections,
  dailyCloseoutSchema,
  getProjectStartAutomation,
  projectStartSchema,
  type DailyCloseoutAnswers,
  type ProjectStartAnswers,
} from "@/lib/forms/daily-report";
import {
  authSchema,
  organizationSetupSchema,
  projectSetupSchema,
  type AuthAnswers,
  type OrganizationSetupAnswers,
  type ProjectSetupAnswers,
} from "@/lib/forms/workspace";
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
  loadProjectDay,
  loadWorkspace,
  reportDateInSuriname,
  saveAttendance,
  saveDailyCloseout,
  saveProjectStart,
  saveSiteRegistration,
  submitReportForReview,
  transitionProjectAction,
  type ActionUpdate,
  type ProjectAction,
  type ProjectParty,
  type WorkspaceBuilding,
  type WorkspaceProject,
} from "@/lib/supabase/data";

type NavKey = "vandaag" | "project" | "acties" | "rapporten" | "meer";
type ModalKey = "quick" | "entry" | "action_create" | "action_detail" | "report" | "attendance" | "daily_questions" | null;
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

const weatherLabels: Record<ProjectStartAnswers["weatherCondition"], string> = {
  sunny: "Zonnig",
  partly_cloudy: "Licht bewolkt",
  cloudy: "Bewolkt",
  rain: "Regen",
  heavy_rain: "Zware regen",
};

const actionStatusLabels: Record<ProjectAction["status"], string> = {
  open: "Open",
  accepted: "Geaccepteerd",
  in_progress: "In uitvoering",
  ready_for_verification: "Gereed voor verificatie",
  verified: "Geverifieerd",
  cancelled: "Geannuleerd",
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

function currentTime() {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Paramaribo",
  }).format(new Date());
}

function currentDateLabel() {
  const value = new Intl.DateTimeFormat("nl-NL", {
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
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Verdieping 3 · Zone oost");
  const [priority, setPriority] = useState("Normaal");
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

  const dayQuery = useQuery({
    queryKey: ["project-day", selectedProject?.id, reportDate],
    queryFn: () => loadProjectDay(supabase as SupabaseClient, selectedProject!.id, reportDate),
    enabled: Boolean(supabase && session && selectedProject),
  });

  const currentUserName = workspaceQuery.data?.profileName
    ?? String(session?.user.user_metadata?.display_name ?? session?.user.email?.split("@")[0] ?? "CODECO-gebruiker");
  const storageStatus = !isOnline
    ? "Geen verbinding · nog niet opgeslagen"
    : syncState === "saving"
      ? "Opslaan in Supabase…"
      : syncState === "error"
        ? "Opslaan mislukt · probeer opnieuw"
        : syncState === "saved"
          ? "Centraal opgeslagen · Supabase"
          : "Live database · Supabase Realtime";

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
      const time = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(occurredAt);
      const priorityLabel = String(row.priority) === "critical" ? "Kritiek" : String(row.priority) === "high" ? "Hoog" : "Opgeslagen";
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
          party: party?.name ?? "Onbekende partij",
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
  }, [currentUserName, dayQuery.data, selectedBuilding]);

  useEffect(() => {
    if (!supabase || !session || !selectedProject) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["project-day", selectedProject.id, reportDate] });
      void queryClient.invalidateQueries({ queryKey: ["workspace", session.user.id] });
    };
    const channel = supabase
      .channel(`project-live:${selectedProject.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "actions", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "action_updates", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_registrations", filter: `project_id=eq.${selectedProject.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "day_reports", filter: `project_id=eq.${selectedProject.id}` }, refresh)
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
      setToast("Geen verbinding. Je invoer blijft in het geopende formulier; probeer opnieuw zodra je online bent.");
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
      setToast(error instanceof Error ? `Opslaan mislukt: ${error.message}` : "Opslaan mislukt. Probeer opnieuw.");
      return null;
    }
  };

  const openQuickAdd = () => {
    setDescription("");
    setModal("quick");
  };

  const chooseType = (type: string) => {
    setSelectedType(type);
    setModal(type === "action" ? "action_create" : "entry");
  };

  const saveEntry = async () => {
    if (!description.trim() || !supabase || !selectedProject || !selectedBuilding) return;
    const priorityMap: Record<string, string> = { Laag: "low", Normaal: "normal", Hoog: "high", Kritiek: "critical" };
    const saved = await runSynced(
      () => saveSiteRegistration(supabase, {
        projectId: selectedProject.id,
        buildingId: selectedBuilding.id,
        type: selectedType,
        title: description.trim(),
        description: `${location} · ${description.trim()}`,
        priority: priorityMap[priority] ?? "normal",
      }),
      `${entryTitles[selectedType]} is centraal opgeslagen en aan het dagrapport gekoppeld.`,
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
      "Projectstart en het conceptdagrapport zijn centraal opgeslagen.",
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
    return <AppStateScreen title="Supabase-configuratie ontbreekt" copy="De applicatie start pas wanneer de publieke project-URL en publishable key beschikbaar zijn. Een service-role key hoort nooit in de browserapp." />;
  }

  if (!authReady) {
    return <AppStateScreen title="Veilige werkruimte openen" copy="Je sessie en projecttoegang worden gecontroleerd." loading />;
  }

  if (!session) {
    return <AuthScreen client={supabase} />;
  }

  if (workspaceQuery.isLoading) {
    return <AppStateScreen title="CODECO-werkruimte laden" copy="Projecten, gebouwen en rechten worden uit Supabase opgehaald." loading />;
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return <AppStateScreen title="Werkruimte niet beschikbaar" copy={workspaceQuery.error instanceof Error ? workspaceQuery.error.message : "De centrale gegevens konden niet worden geladen."} action={() => void workspaceQuery.refetch()} />;
  }

  if (workspaceQuery.data.organizations.length === 0) {
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
  const buildingName = selectedBuilding?.name ?? "Gebouw";

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Hoofdnavigatie">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy"><strong>CODECO N.V.</strong><small>Supervisie</small></span>
        </div>

        <button className="project-context-card" type="button" aria-label="Project en gebouw wijzigen" onClick={() => setWorkspaceStage("projects")}>
          <span className="project-context-icon"><Building2 size={17} /></span>
          <span className="project-context-copy">
            <strong>{projectName}</strong>
            <small>{buildingName} · {selectedProject?.location}</small>
          </span>
          <ChevronDown size={15} />
        </button>

        <nav className="side-nav">
          <span className="nav-label">Werkruimte</span>
          {navigation.map((item) => {
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
          Snel toevoegen
        </button>
        <button className="user-card" type="button" onClick={() => void supabase.auth.signOut()} title="Afmelden">
          <span className="avatar">{initials(currentUserName)}</span>
          <span className="user-copy">
            <strong>{currentUserName}</strong>
            <small>CODECO-gebruiker</small>
          </span>
          <LogOut size={16} color="#7893a1" />
        </button>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb" aria-label="Huidige werkcontext">
            <span>Mijn projecten</span>
            <ChevronRight size={13} />
            <span>{projectName}</span>
            <ChevronRight size={13} />
            <strong>{buildingName}</strong>
          </div>
          <div className="top-actions">
            <span className={`storage-state ${syncState}`} title={storageStatus}>{syncState === "error" || !isOnline ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} <span>{storageStatus}</span></span>
            <button className="icon-button" type="button" aria-label="Zoeken"><Search size={17} /></button>
            <button className="icon-button" type="button" aria-label="Meldingen">
              <Bell size={17} />
              <span className="notification-dot" />
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
            />
          )}
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobiele hoofdnavigatie">
        {navigation.filter((item) => item.id !== "rapporten").slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <button className={`mobile-nav-button ${activeNav === item.id ? "active" : ""}`} type="button" onClick={() => navigate(item.id)} key={item.id}>
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
        <button className="mobile-nav-button quick" type="button" onClick={openQuickAdd} aria-label="Snel toevoegen">
          <span className="mobile-plus"><Plus size={25} /></span>
          Toevoegen
        </button>
        {navigation.filter((item) => item.id === "acties" || item.id === "meer").map((item) => {
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
  return (
    <div className="access-shell">
      <section className="access-card state-card">
        <div className="access-brand"><span className="brand-mark" /><span><strong>CODECO N.V.</strong><small>Constructiesupervisie</small></span></div>
        <span className="state-icon">{loading ? <Loader2 className="spin" size={26} /> : <AlertTriangle size={26} />}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
        {action ? <button className="primary-button" type="button" onClick={action}>Opnieuw proberen</button> : null}
      </section>
    </div>
  );
}

function AuthScreen({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<AuthAnswers>({
    resolver: zodResolver(authSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const submit = async (answers: AuthAnswers) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "sign_in") {
        const result = await client.auth.signInWithPassword({ email: answers.email, password: answers.password });
        if (result.error) throw result.error;
      } else {
        const result = await client.auth.signUp({
          email: answers.email,
          password: answers.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: answers.displayName?.trim() || answers.email.split("@")[0] },
          },
        });
        if (result.error) throw result.error;
        if (!result.data.session) setMessage("Controleer je e-mail en bevestig je account. Daarna kun je hier aanmelden.");
      }
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : "Aanmelden is niet gelukt.";
      setError(raw.includes("Invalid login credentials") ? "E-mailadres of wachtwoord is onjuist." : raw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="access-shell">
      <section className="access-card auth-card">
        <div className="access-brand"><span className="brand-mark" /><span><strong>CODECO N.V.</strong><small>Constructiesupervisie</small></span></div>
        <div className="auth-heading">
          <p className="eyebrow">Beveiligde online werkruimte</p>
          <h1>{mode === "sign_in" ? "Welkom terug" : "Eerste toegang aanmaken"}</h1>
          <p>Projectgegevens worden centraal onder jouw Supabase-account en projectrechten opgeslagen.</p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Toegangsactie">
          <button type="button" className={mode === "sign_in" ? "active" : ""} onClick={() => setMode("sign_in")}>Aanmelden</button>
          <button type="button" className={mode === "sign_up" ? "active" : ""} onClick={() => setMode("sign_up")}>Account maken</button>
        </div>
        <form className="access-form" onSubmit={handleSubmit(submit)} noValidate>
          {mode === "sign_up" ? <label className="form-field"><span>Volledige naam</span><input autoComplete="name" {...register("displayName")} /></label> : null}
          <label className="form-field"><span>E-mailadres</span><input type="email" autoComplete="email" {...register("email")} />{errors.email ? <small className="field-error">{errors.email.message}</small> : null}</label>
          <label className="form-field"><span>Wachtwoord</span><input type="password" autoComplete={mode === "sign_in" ? "current-password" : "new-password"} {...register("password")} />{errors.password ? <small className="field-error">{errors.password.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          {message ? <p className="access-message success" role="status">{message}</p> : null}
          <button className="primary-button access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}{mode === "sign_in" ? "Veilig aanmelden" : "Account aanmaken"}</button>
        </form>
        <p className="security-note"><ShieldCheck size={14} /> Service-role keys en projectbestanden worden nooit in de browser opgeslagen.</p>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<OrganizationSetupAnswers>({
    resolver: zodResolver(organizationSetupSchema),
    defaultValues: { displayName: defaultDisplayName, organizationName: "CODECO N.V.", organizationSlug: "codeco-nv" },
  });
  const submit = async (answers: OrganizationSetupAnswers) => {
    setBusy(true);
    setError("");
    const ok = await save(answers);
    if (!ok) setError("De organisatie kon niet worden aangemaakt. Controleer of de slug al bestaat.");
    setBusy(false);
  };
  return (
    <div className="access-shell setup-shell">
      <section className="access-card setup-card">
        <div className="setup-top"><div className="access-brand"><span className="brand-mark" /><span><strong>CODECO N.V.</strong><small>Eerste inrichting</small></span></div><button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> Afmelden</button></div>
        <p className="eyebrow">Stap 1 van 2</p><h1>Organisatie veilig instellen</h1><p>Dit maakt de centrale rollen- en rechtenstructuur. Je account <strong>{userEmail}</strong> wordt de eerste organisatiebeheerder.</p>
        <form className="access-form setup-form" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>Jouw naam</span><input {...register("displayName")} />{errors.displayName ? <small className="field-error">{errors.displayName.message}</small> : null}</label>
          <label className="form-field"><span>Bedrijfsnaam</span><input {...register("organizationName")} /></label>
          <label className="form-field"><span>Technische organisatieslug</span><input {...register("organizationSlug")} />{errors.organizationSlug ? <small className="field-error">{errors.organizationSlug.message}</small> : null}</label>
          {error ? <p className="access-message error" role="alert">{error}</p> : null}
          <button className="primary-button access-submit" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}Organisatie instellen</button>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<ProjectSetupAnswers>({
    resolver: zodResolver(projectSetupSchema),
    defaultValues: {
      code: "COD-2026-001",
      name: "Eerste constructieproject",
      location: "Paramaribo, Suriname",
      clientName: "Opdrachtgever",
      buildingCode: "HOOFD",
      buildingName: "Hoofdgebouw",
      contractorName: "Hoofdaannemer",
    },
  });
  const submit = async (answers: ProjectSetupAnswers) => {
    setBusy(true);
    setError("");
    const ok = await save(answers);
    if (!ok) setError("Het project kon niet worden aangemaakt. Controleer de projectcode en probeer opnieuw.");
    setBusy(false);
  };
  return (
    <div className="access-shell setup-shell">
      <section className="access-card setup-card project-setup-card">
        <div className="setup-top"><div className="access-brand"><span className="brand-mark" /><span><strong>{organizationName}</strong><small>Eerste inrichting</small></span></div><button className="ghost-button" type="button" onClick={signOut}><LogOut size={14} /> Afmelden</button></div>
        <p className="eyebrow">Stap 2 van 2</p><h1>Eerste project en gebouw</h1><p>De applicatie maakt atomair het project, gebouw, jouw projecttoegang en drie standaardpartijen aan.</p>
        <form className="access-form setup-form two-columns" onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field"><span>Projectcode</span><input {...register("code")} />{errors.code ? <small className="field-error">{errors.code.message}</small> : null}</label>
          <label className="form-field"><span>Projectnaam</span><input {...register("name")} /></label>
          <label className="form-field"><span>Locatie</span><input {...register("location")} /></label>
          <label className="form-field"><span>Opdrachtgever</span><input {...register("clientName")} /></label>
          <label className="form-field"><span>Gebouwcode</span><input {...register("buildingCode")} /></label>
          <label className="form-field"><span>Gebouwnaam</span><input {...register("buildingName")} /></label>
          <label className="form-field wide"><span>Hoofdaannemer</span><input {...register("contractorName")} /></label>
          {error ? <p className="access-message error wide" role="alert">{error}</p> : null}
          <button className="primary-button access-submit wide" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}Projectwerkruimte aanmaken</button>
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
  const showBuildings = stage === "buildings" && selectedProject;
  const showProjectStart = stage === "project_start" && Boolean(selectedProject && selectedBuilding);
  return (
    <div className="context-shell">
      <header className="context-topbar">
        <div className="context-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy"><strong>CODECO N.V.</strong><small>Supervisie</small></span>
        </div>
        <div className="context-user"><span className="avatar">{initials(currentUserName)}</span><span><strong>{currentUserName}</strong><small>CODECO-gebruiker</small></span></div>
      </header>

      <main className="context-content">
        <div className="data-mode-notice connected" role="status">
          <CheckCircle2 size={17} />
          <span><strong>Online werkruimte</strong> {storageStatus}. Alleen door Supabase bevestigde wijzigingen krijgen de status opgeslagen.</span>
        </div>
        <div className="context-steps" aria-label="Werkcontext kiezen">
          <span className={stage === "projects" ? "active" : "done"}><strong>1</strong> Project</span>
          <ChevronRight size={14} />
          <span className={showBuildings ? "active" : showProjectStart ? "done" : ""}><strong>2</strong> Gebouw</span>
          <ChevronRight size={14} />
          <span className={showProjectStart ? "active" : ""}><strong>3</strong> Projectstart</span>
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
              <div><p className="eyebrow">Mijn projecten</p><h1>Waar ga je vandaag werken?</h1><p>Kies eerst het project. Je gebouw en dagrapport volgen in de volgende stap.</p></div>
              <button className="ghost-button" type="button"><Search size={14} /> Project zoeken</button>
            </section>
            <section className="project-selection-grid">
              {projects.map((project) => (
                <button className="project-selection-card" type="button" onClick={() => chooseProject(project)} key={project.id}>
                  <span className="selection-card-top">
                    <span className="selection-icon"><Building2 size={21} /></span>
                    <span className="project-code">{project.code}</span>
                  </span>
                  <span className="selection-copy"><strong>{project.name}</strong><small><MapPin size={12} /> {project.location}</small></span>
                  <span className="selection-meta"><span>{project.buildings.length} gebouwen</span><span>{project.openIssues} open punten</span></span>
                  <span className="selection-progress"><span style={{ width: `${project.progress}%` }} /><em>{project.progress}% voortgang</em></span>
                  <span className="selection-action">Gebouwen bekijken <ArrowRight size={14} /></span>
                </button>
              ))}
            </section>
          </>
        ) : (
          <>
            <button className="back-button context-back" type="button" onClick={goBack}><ArrowLeft size={15} /> Terug naar projecten</button>
            <section className="context-heading">
              <div><p className="eyebrow">{showBuildings.code} · {showBuildings.location}</p><h1>Kies een gebouw</h1><p>Fysieke registraties worden verplicht aan dit gebouw gekoppeld.</p></div>
              <span className="context-project-pill"><Building2 size={15} /> {showBuildings.name}</span>
            </section>
            <section className="building-selection-grid">
              {showBuildings.buildings.map((building) => {
                const active = selectedBuilding?.id === building.id;
                return (
                  <button className={`building-selection-card ${active ? "selected" : ""}`} type="button" onClick={() => chooseBuilding(building)} key={building.id}>
                    <span className="building-radio">{active ? <Check size={14} /> : null}</span>
                    <span className="building-selection-copy"><strong>{building.name}</strong><small>{building.description}</small></span>
                    <span className="building-stats"><span><b>{building.progress}%</b> voortgang</span><span><b>{building.openIssues}</b> open punten</span></span>
                  </button>
                );
              })}
            </section>
            <div className="project-start-bar">
              <span><strong>{selectedBuilding ? selectedBuilding.name : "Nog geen gebouw gekozen"}</strong><small>{selectedBuilding ? "Je werkcontext is compleet." : "Kies een gebouw om door te gaan."}</small></span>
              <button className="primary-button" type="button" disabled={!selectedBuilding} onClick={openProjectStart}>Projectstart invullen <ArrowRight size={15} /></button>
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
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProjectStartAnswers>({
    resolver: zodResolver(projectStartSchema),
    mode: "onBlur",
    defaultValues: initialAnswers ?? {
      weatherCondition: "partly_cloudy",
      temperatureC: 31,
      windCondition: "moderate",
      shiftStart: "07:00",
      shiftEnd: "16:00",
      plannedWork: "Bekisting kernwand en wapeningscontrole vloer V3",
      expectedWorkers: 42,
      inspectionPlanned: "yes",
      highRiskWork: "no",
      concreteWork: "yes",
      workPermit: "not_required",
      drawingStatus: "approved",
      drawingIssueReported: false,
      riskNotes: "Levering betonstaal rond 10:00 controleren.",
    },
  });
  const answers = useWatch({ control });
  const automation = getProjectStartAutomation(answers);

  return (
    <>
      <button className="back-button context-back" type="button" onClick={goBack}><ArrowLeft size={15} /> Terug naar gebouwen</button>
      <section className="context-heading project-start-heading">
        <div>
          <p className="eyebrow">{project.code} · {building.name}</p>
          <h1>Start de werkdag met de juiste vragen</h1>
          <p>Bevestig alleen wat niet betrouwbaar uit het project kan worden afgeleid. De regels rechts tonen direct wat de app daarna klaarzet.</p>
        </div>
        <span className="context-project-pill"><CalendarDays size={15} /> {currentDateLabel()}</span>
      </section>

      <div className="project-start-layout">
        <form className="project-start-form" onSubmit={handleSubmit(startProject)} noValidate>
          <section className="form-section-card">
            <header><span className="form-section-number">1</span><span><strong>Weer en werktijden</strong><small>Handmatig waargenomen op de bouwplaats</small></span></header>
            <div className="form-grid three-columns">
              <label className="form-field"><span>Wat is het weer?</span><select {...register("weatherCondition")}><option value="sunny">Zonnig</option><option value="partly_cloudy">Licht bewolkt</option><option value="cloudy">Bewolkt</option><option value="rain">Regen</option><option value="heavy_rain">Zware regen</option></select></label>
              <label className="form-field"><span>Temperatuur</span><span className="input-with-unit"><input type="number" {...register("temperatureC", { valueAsNumber: true })} /><em>°C</em></span>{errors.temperatureC ? <small className="field-error">{errors.temperatureC.message}</small> : null}</label>
              <label className="form-field"><span>Wind</span><select {...register("windCondition")}><option value="calm">Kalm</option><option value="moderate">Matig</option><option value="strong">Sterk</option></select></label>
              <label className="form-field"><span>Start werktijd</span><input type="time" {...register("shiftStart")} />{errors.shiftStart ? <small className="field-error">{errors.shiftStart.message}</small> : null}</label>
              <label className="form-field"><span>Einde werktijd</span><input type="time" {...register("shiftEnd")} />{errors.shiftEnd ? <small className="field-error">{errors.shiftEnd.message}</small> : null}</label>
              <label className="form-field"><span>Verwachte bezetting</span><span className="input-with-unit"><input type="number" {...register("expectedWorkers", { valueAsNumber: true })} /><em>personen</em></span></label>
            </div>
          </section>

          <section className="form-section-card">
            <header><span className="form-section-number">2</span><span><strong>Wat staat vandaag gepland?</strong><small>Dit voedt het dagplan en de voorgestelde modules</small></span></header>
            <div className="form-grid two-columns">
              <label className="form-field wide"><span>Geplande werkzaamheden *</span><textarea rows={3} {...register("plannedWork")} />{errors.plannedWork ? <small className="field-error">{errors.plannedWork.message}</small> : null}</label>
              <label className="form-field"><span>Inspectie gepland?</span><select {...register("inspectionPlanned")}><option value="yes">Ja</option><option value="no">Nee</option></select></label>
              <label className="form-field"><span>Betonwerk gepland?</span><select {...register("concreteWork")}><option value="yes">Ja</option><option value="no">Nee</option></select></label>
              <label className="form-field"><span>Hoog-risicowerk?</span><select {...register("highRiskWork")}><option value="no">Nee</option><option value="yes">Ja</option></select></label>
              <label className="form-field"><span>Werkvergunning</span><select {...register("workPermit")}><option value="available">Aanwezig</option><option value="not_required">Niet vereist</option><option value="missing">Ontbreekt</option></select></label>
            </div>
          </section>

          <section className="form-section-card">
            <header><span className="form-section-number">3</span><span><strong>Documenten en verwachte risico’s</strong><small>De app waarschuwt; de supervisor blijft beslissen</small></span></header>
            <div className="form-grid two-columns">
              <label className="form-field"><span>Goedgekeurde werktekening</span><select {...register("drawingStatus")}><option value="approved">Actuele revisie aanwezig</option><option value="not_required">Niet vereist</option><option value="missing">Ontbreekt / onzeker</option></select></label>
              <label className="form-field wide"><span>Welke risico’s verwacht je vandaag?</span><textarea rows={3} placeholder="Bijvoorbeeld hijswerk, regen, levering of grondwater" {...register("riskNotes")} /></label>
              {answers.drawingStatus === "missing" ? (
                <label className="confirmation-check wide"><input type="checkbox" {...register("drawingIssueReported")} /><span><strong>Ontbrekende tekening is gemeld</strong><small>Menselijke bevestiging vereist voordat de werkdag wordt geopend.</small>{errors.drawingIssueReported ? <em className="field-error">{errors.drawingIssueReported.message}</em> : null}</span></label>
              ) : null}
            </div>
          </section>

          <div className="project-start-submit">
            <span><ShieldCheck size={15} /> Opslaan is pas voltooid na bevestiging door Supabase.</span>
            <button className="primary-button" type="submit">Dagrapport centraal starten <ArrowRight size={15} /></button>
          </div>
        </form>

        <aside className="automation-panel">
          <header><span className="automation-panel-icon"><Settings size={19} /></span><span><strong>Zichtbare automatisering</strong><small>{automation.length} vaste regels actief</small></span></header>
          <p className="automation-intro">Geen AI: iedere actie komt uit een vaste projectregel en blijft door de supervisor controleerbaar.</p>
          <div className="automation-rule-list">
            {automation.map((rule) => (
              <article className={`automation-rule ${rule.tone}`} key={rule.id}>
                <span className="automation-rule-state">{rule.tone === "critical" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}</span>
                <span><strong>{rule.title}</strong><p>{rule.action}</p><small>Geactiveerd door: {rule.source} · {rule.id}</small></span>
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
  const todos = [
    { id: 1, title: "Weer en werktijden bevestigen", detail: projectStartAnswers ? "Centraal vastgelegd" : "Projectstart vereist", flag: "" },
    { id: 2, title: "Kwaliteit en HSE bevestigen", detail: dailyCloseoutAnswers ? "Centraal vastgelegd" : "Dagvragen vereist", flag: "red" },
    { id: 3, title: "Planning voor morgen invullen", detail: dailyCloseoutAnswers ? "Centraal vastgelegd" : "Voor dagafsluiting", flag: "" },
  ];
  const automation = projectStartAnswers ? getProjectStartAutomation(projectStartAnswers) : [];
  const criticalEntry = entries.find((entry) => entry.badgeTone === "red");
  const inspectionCount = entries.filter((entry) => entry.kind === "inspection").length;
  const progress = dailyCloseoutAnswers?.progressPercent ?? 0;
  const openTodoCount = todos.filter((todo) => !completedTodos.includes(todo.id)).length;
  const weatherLabel = projectStartAnswers
    ? `${projectStartAnswers.temperatureC}°C · ${weatherLabels[projectStartAnswers.weatherCondition]}`
    : "Weer nog niet bevestigd";

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">{currentDateLabel()}</p>
          <h1>Goedemorgen, {currentUserName}.</h1>
          <p>Dit vraagt vandaag je aandacht bij {projectName} · {buildingName}.</p>
        </div>
        <div className="page-intro-actions">
          <div className="weather-chip">
            <span className="weather-icon"><CloudSun size={20} /></span>
            <span className="weather-copy">
              <strong>{weatherLabel}</strong>
              <span>Handmatig bevestigd bij Projectstart</span>
            </span>
            <ChevronRight size={15} color="#718995" />
          </div>
          <button className="primary-button day-questions-button" type="button" onClick={openDailyQuestions}><ClipboardCheck size={15} /> Dagvragen invullen</button>
        </div>
      </section>

      <section className="day-hero" aria-label="Status van vandaag">
        <article className="report-card">
          <div className="report-copy">
            <div className="status-kicker"><span className="live-dot" /> Rapport in uitvoering</div>
            <h2>Dagrapport {reportNumber}</h2>
            <p>Gegevens uit alle gebouwen worden automatisch in dit projectrapport samengebracht.</p>
            <button className="inline-button" type="button" onClick={openReport}>
              Rapportstatus bekijken <ArrowRight size={14} />
            </button>
          </div>
          <div className="progress-ring" style={{ background: `conic-gradient(var(--signal) 0 ${completeness}%, rgba(255,255,255,.11) ${completeness}% 100%)` }}>
            <span className="progress-value"><strong>{completeness}%</strong><span>compleet</span></span>
          </div>
        </article>

        <article className={`critical-card ${criticalEntry ? "" : "clear"}`}>
          <div>
            <div className="critical-top">
              <span className="critical-icon">{criticalEntry ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</span>
              <span className="critical-badge">{criticalEntry ? "Kritiek" : "Geen kritieke registratie"}</span>
            </div>
            <h3>{criticalEntry?.title ?? "Geen directe blokkade geregistreerd"}</h3>
            <p>{criticalEntry?.detail ?? "Nieuwe kritieke registraties worden hier direct zichtbaar."}</p>
          </div>
          <button className="text-link" type="button" onClick={showCritical}>Open centrale actielijst <ArrowRight size={13} /></button>
        </article>
      </section>

      <section className={`questionnaire-strip ${dailyCloseoutAnswers ? "complete" : ""}`} aria-label="Dagvragen en automatisering">
        <div className="questionnaire-main">
          <span className="questionnaire-icon"><FileCheck2 size={21} /></span>
          <span className="questionnaire-copy">
            <span className="status-kicker">Klantformat · {clientReportSections.length} rapportonderdelen</span>
            <strong>{dailyCloseoutAnswers ? "Dagvragen bevestigd" : "Hoe is het project vandaag gegaan?"}</strong>
            <p>Vier korte vraaggroepen vullen de juiste modules: verloop, kwaliteit/HSE, logistiek en planning morgen.</p>
          </span>
        </div>
        <div className="questionnaire-automation">
          {automation.slice(0, 3).map((rule) => <span className={`rule-chip ${rule.tone}`} title={`Geactiveerd door: ${rule.source}`} key={rule.id}>{rule.title}</span>)}
        </div>
        <div className="questionnaire-progress"><strong>{dailyCloseoutAnswers ? "4/4" : "1/4"}</strong><span>vraaggroepen</span></div>
        <button className={dailyCloseoutAnswers ? "ghost-button" : "primary-button"} type="button" onClick={openDailyQuestions}>{dailyCloseoutAnswers ? "Antwoorden bekijken" : "Vragen starten"} <ArrowRight size={14} /></button>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <header className="panel-header">
            <div className="section-heading">
              <h2>Tijdlijn vandaag</h2>
              <p>{entries.length} registraties · realtime bijgewerkt</p>
            </div>
            <button className="ghost-button" type="button"><History size={13} /> Alles bekijken</button>
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
              <div className="section-heading"><h2>In één oogopslag</h2><p>Centraal bijgewerkt</p></div>
            </header>
            <div className="metrics-grid">
              <Metric icon={Users} value={String(attendanceTotal)} label="mensen aanwezig" suffix="" />
              <Metric icon={Gauge} value={String(progress)} label="projectvoortgang" suffix="%" />
              <Metric icon={ClipboardCheck} value={String(inspectionCount)} label="inspecties vandaag" suffix="" />
              <Metric icon={CheckCircle2} value={String(actions.length)} label="acties" suffix="" />
            </div>
          </article>

          <article className="panel">
            <header className="panel-header">
              <div className="section-heading"><h2>Nog te doen</h2><p>Voor je het rapport afrondt</p></div>
              <span className="status-badge" style={{ padding: "5px 8px", background: "var(--yellow-soft)", color: "var(--yellow)" }}>{openTodoCount} open</span>
            </header>
            <div className="todo-list">
              {todos.map((todo) => {
                const done = completedTodos.includes(todo.id);
                return (
                  <div className="todo-row" key={todo.id}>
                    <button className={`todo-check ${done ? "done" : ""}`} type="button" onClick={() => toggleTodo(todo.id)} aria-label={`${todo.title} ${done ? "heropenen" : "afronden"}`}>
                      <Check size={14} />
                    </button>
                    <span className="todo-copy"><strong>{todo.title}</strong><span>{done ? "Afgerond" : todo.detail}</span></span>
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
          <span><strong>Klaar voor de eindcontrole?</strong><span>De app controleert verplichte gegevens en stelt de samenvatting samen.</span></span>
        </div>
        <button className="primary-button" type="button" onClick={openReport}>Rapport controleren <ArrowRight size={14} /></button>
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
}) {
  if (activeNav === "project") {
    const registrationsByKind = (kind: EntryKind) => entries.filter((entry) => entry.kind === kind).length;
    const modules = [
      { title: "Aanwezigheid", copy: "Partijen, disciplines, aantallen en diensten", icon: Users, count: `${attendanceTotal} vandaag`, action: openAttendance },
      { title: "Activiteiten", copy: "Werkpakketten, planning en voortgang", icon: Wrench, count: `${registrationsByKind("activity")} vandaag`, action: openQuickAdd },
      { title: "Inspecties", copy: "Gepland, uitgevoerd en herinspecties", icon: ClipboardCheck, count: `${registrationsByKind("inspection")} vandaag`, action: openQuickAdd },
      { title: "Bevindingen", copy: "Kwaliteit, NCR en herstelverificatie", icon: AlertTriangle, count: `${registrationsByKind("finding")} vandaag`, action: () => navigate("acties") },
      { title: "Acties", copy: "Toewijzing, deadlines en verificatie", icon: ShieldCheck, count: `${actions.length} centraal`, action: () => navigate("acties") },
      { title: "Foto’s", copy: "Bewijs, locaties en koppelingen", icon: Image, count: `${registrationsByKind("photo")} vandaag`, action: openQuickAdd },
    ];
    return (
      <>
        <header className="secondary-header">
          <div><p className="eyebrow">{projectName}</p><h1>Projectoverzicht</h1><p>Registers en operationele modules voor {buildingName}.</p></div>
          <button className="primary-button" type="button" onClick={openQuickAdd}><Plus size={15} /> Nieuwe registratie</button>
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
          <div><p className="eyebrow">{actions.length} centraal geregistreerd</p><h1>Acties</h1><p>Persoonlijke en toegewezen opvolging in één lijst.</p></div>
          <button className="primary-button" type="button" onClick={openQuickAdd}><Plus size={15} /> Actie toevoegen</button>
        </header>
        <section className="actions-list">
          {actions.length === 0 ? <div className="empty-list-state"><CheckCircle2 size={22} /><strong>Nog geen acties</strong><span>Acties die in Supabase worden vastgelegd verschijnen hier.</span></div> : null}
          {actions.map((action) => {
            const dueAt = action.due_at ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(action.due_at)) : "Geen deadline";
            const latestUpdate = actionUpdates.find((update) => update.action_id === action.id);
            return (
            <button className="action-row" type="button" key={action.id} onClick={() => openAction(action)} style={{ textAlign: "left", cursor: "pointer" }}>
              <span className="action-icon"><CheckCircle2 size={18} /></span>
              <span className="action-copy"><strong>{action.title}</strong><span>{dueAt} · {action.action_number}{latestUpdate ? ` · ${latestUpdate.message}` : ""}</span></span>
              <span className={`task-status ${action.priority === "critical" ? "red" : action.status === "verified" ? "green" : ""}`}>{actionStatusLabels[action.status]}</span>
            </button>
          );})}
        </section>
      </>
    );
  }

  if (activeNav === "rapporten") {
    return (
      <>
        <header className="secondary-header"><div><p className="eyebrow">Dagrapporten</p><h1>Rapporthistorie</h1><p>Concepten, versies, reviews en verzendhistorie.</p></div></header>
        <section className="actions-list">
          <button className="action-row" type="button" style={{ textAlign: "left", cursor: "pointer" }}>
              <span className="action-icon" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><FileText size={18} /></span>
              <span className="action-copy"><strong>{reportNumber} · Vandaag</strong><span>{projectName} · alle gebouwen</span></span>
              <span className={`task-status ${reportStatus === "approved" ? "green" : ""}`}>{reportStatus.replaceAll("_", " ")}</span>
          </button>
        </section>
      </>
    );
  }

  const settings = [
    { title: "Rapporten", copy: "Historie, revisies en distributie", icon: FileText },
    { title: "Dashboard", copy: "KPI’s, trends en brongegevens", icon: Gauge },
    { title: "Planning morgen", copy: "Activiteiten, risico’s en inspecties", icon: CalendarDays },
    { title: "Projectinstellingen", copy: "Locaties, partijen en configuratie", icon: Settings },
  ];
  return (
    <>
      <header className="secondary-header"><div><p className="eyebrow">Werkruimte</p><h1>Meer</h1><p>Rapportage, planning en projectbeheer.</p></div></header>
      <section className="settings-list">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <button className="settings-row" type="button" key={item.title} onClick={() => item.title === "Rapporten" && navigate("rapporten")}>
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

function QuickAddModal({ close, chooseType }: { close: () => void; chooseType: (type: string) => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="quick-title">
        <header className="modal-header">
          <div><h2 id="quick-title">Snel toevoegen</h2><p>Project en gebouw worden automatisch gekoppeld.</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="quick-grid">
            {quickTypes.map((type) => {
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
  const title = entryTitles[selectedType] ?? "Registratie";
  const needsPriority = selectedType === "finding" || selectedType === "hse" || selectedType === "action";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
        <header className="modal-header">
          <div><h2 id="entry-title">{title} vastleggen</h2><p>{projectName} · {buildingName} · {currentTime()}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="description">Korte omschrijving *</label>
              <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={`Wat wil je over deze ${title.toLowerCase()} vastleggen?`} autoFocus />
            </div>
            <div className="form-field">
              <label htmlFor="location">Locatie *</label>
              <select id="location" value={location} onChange={(event) => setLocation(event.target.value)}>
                <option>Verdieping 3 · Zone oost</option>
                <option>Verdieping 3 · Zone west</option>
                <option>Verdieping 2 · Kern</option>
                <option>Buitenterrein · Noord</option>
              </select>
            </div>
            {needsPriority ? (
              <div className="form-field">
                <label htmlFor="priority">Prioriteit</label>
                <select id="priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option>Laag</option><option>Normaal</option><option>Hoog</option><option>Kritiek</option>
                </select>
              </div>
            ) : (
              <div className="form-field">
                <label htmlFor="work-package">Werkpakket</label>
                <select id="work-package"><option>Ruwbouw</option><option>Installaties</option><option>Afwerking</option></select>
              </div>
            )}
            <div className="form-field full">
              <label>Bewijs toevoegen</label>
              <button className="ghost-button" type="button" style={{ justifyContent: "center", minHeight: 50 }}><Camera size={16} /> Foto of bijlage kiezen</button>
              <span className="form-note"><CheckCircle2 size={12} /> Tijd, maker, project en gebouw worden automatisch vastgelegd.</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={14} /> Terug</button>
            <button className="primary-button" type="button" onClick={save} disabled={!description.trim()}>Opslaan en opnemen <Check size={14} /></button>
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
          <div><h2 id="action-create-title">Actie centraal aanmaken</h2><p>{projectName} · {buildingName}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
        </header>
        <form className="modal-body" onSubmit={handleSubmit(submit)} noValidate>
          <div className="form-grid two-columns">
            <label className="form-field full"><span>Actie *</span><input autoFocus placeholder="Wat moet aantoonbaar worden uitgevoerd?" {...register("title")} />{errors.title ? <small className="field-error">{errors.title.message}</small> : null}</label>
            <label className="form-field full"><span>Context en acceptatiecriterium *</span><textarea rows={4} placeholder="Beschrijf locatie, gewenste maatregel en wanneer de actie gereed is." {...register("description")} />{errors.description ? <small className="field-error">{errors.description.message}</small> : null}</label>
            <label className="form-field"><span>Verantwoordelijke partij *</span><select {...register("ownerPartyId")} disabled={parties.length === 0}><option value="">Kies partij</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select>{errors.ownerPartyId ? <small className="field-error">{errors.ownerPartyId.message}</small> : null}</label>
            <label className="form-field"><span>Deadline *</span><input type="datetime-local" {...register("dueAt")} />{errors.dueAt ? <small className="field-error">{errors.dueAt.message}</small> : null}</label>
            <label className="form-field"><span>Prioriteit</span><select {...register("priority")}><option value="low">Laag</option><option value="normal">Normaal</option><option value="high">Hoog</option><option value="critical">Kritiek</option></select></label>
            <div className="action-rule-note"><ShieldCheck size={16} /><span><strong>Vaste opvolgflow</strong><small>Open → geaccepteerd → in uitvoering → verificatie → gesloten.</small></span></div>
          </div>
          <div className="modal-actions">
            <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={14} /> Terug</button>
            <button className="primary-button" type="submit" disabled={busy || parties.length === 0}>{busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />} Centraal opslaan</button>
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
    ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(action.due_at))
    : "Geen deadline";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal action-detail-modal" role="dialog" aria-modal="true" aria-labelledby="action-detail-title">
        <header className="modal-header">
          <div><p className="eyebrow">{action.action_number}</p><h2 id="action-detail-title">{action.title}</h2><p>{partyName} · deadline {dueAt}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
        </header>
        <div className="modal-body action-detail-body">
          <div className="action-detail-summary">
            <span className={`task-status ${action.priority === "critical" ? "red" : ""}`}>{action.priority}</span>
            <span className={`task-status ${action.status === "verified" ? "green" : ""}`}>{actionStatusLabels[action.status]}</span>
            <p>{action.description}</p>
          </div>
          <div className="action-status-flow" aria-label="Actiestatus">
            {(["open", "accepted", "in_progress", "ready_for_verification", "verified"] as ProjectAction["status"][]).map((status) => {
              const order = ["open", "accepted", "in_progress", "ready_for_verification", "verified"];
              const reached = order.indexOf(status) <= order.indexOf(action.status);
              return <span className={reached ? "reached" : ""} key={status}><i />{actionStatusLabels[status]}</span>;
            })}
          </div>
          <section className="action-history">
            <h3>Onveranderbare historie</h3>
            {updates.length === 0 ? <p>Nog geen historie geladen.</p> : updates.map((update) => (
              <article key={update.id}><span className="timeline-dot" /><div><strong>{update.update_type === "status" && update.to_status ? actionStatusLabels[update.to_status as ProjectAction["status"]] : "Aangemaakt"}</strong><p>{update.message}</p><time>{new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(update.created_at))}</time></div></article>
            ))}
          </section>
          {nextStatus ? (
            <form className="action-transition-form" onSubmit={handleSubmit(submit)} noValidate>
              <label className="form-field"><span>{nextStatus === "verified" ? "Verificatienotitie *" : "Uitvoeringsnotitie *"}</span><textarea rows={3} placeholder="Leg vast wat is uitgevoerd, gecontroleerd of nog nodig is." {...register("note")} />{errors.note ? <small className="field-error">{errors.note.message}</small> : null}</label>
              <button className="primary-button" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <ArrowRight size={14} />} Naar {actionStatusLabels[nextStatus].toLowerCase()}</button>
            </form>
          ) : <p className="action-complete-note"><CheckCircle2 size={16} /> {action.status === "verified" ? "Deze actie is formeel geverifieerd en gesloten." : "Deze actie is geannuleerd en blijft in de historie zichtbaar."}</p>}
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
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-title">
        <header className="modal-header">
          <div><h2 id="attendance-title">Aanwezigheid vandaag</h2><p>Partijen, disciplines en werktijden · {total} personen</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="attendance-toolbar">
            <span><Users size={16} /><strong>{total}</strong> aanwezigen in totaal</span>
            <button className="ghost-button" type="button" onClick={copyPreviousDay}><Copy size={13} /> Vorige werkdag overnemen</button>
          </div>
          <div className="attendance-list">
            {rows.map((row) => (
              <div className="attendance-row" key={row.id}>
                <span className="attendance-party"><strong>{row.party}</strong><small>{row.discipline} · {row.shiftStart}–{row.shiftEnd}</small></span>
                <span className="counter-control">
                  <button type="button" onClick={() => changeCount(row.id, -1)} aria-label={`Eén persoon minder bij ${row.party}`}><Minus size={14} /></button>
                  <strong>{row.count}</strong>
                  <button type="button" onClick={() => changeCount(row.id, 1)} aria-label={`Eén persoon meer bij ${row.party}`}><Plus size={14} /></button>
                </span>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <span className="form-note"><CheckCircle2 size={13} /> Totalen worden in het dagrapport hergebruikt.</span>
            <button className="primary-button" type="button" onClick={save}>Aanwezigheid bevestigen <Check size={14} /></button>
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
  const [step, setStep] = useState(0);
  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors },
  } = useForm<DailyCloseoutAnswers>({
    resolver: zodResolver(dailyCloseoutSchema),
    mode: "onBlur",
    defaultValues: initialAnswers ?? {
      daySummary: "",
      weatherSummary: projectStartAnswers
        ? `${weatherLabels[projectStartAnswers.weatherCondition]}, ${projectStartAnswers.temperatureC}°C, wind ${projectStartAnswers.windCondition === "strong" ? "sterk" : projectStartAnswers.windCondition === "moderate" ? "matig" : "kalm"}`
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
  const stepTitles = ["Verloop & werk", "Kwaliteit & HSE", "Logistiek & vertraging", "Afspraken & morgen"];
  const nextStep = async () => {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((current) => Math.min(3, current + 1));
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal daily-questions-modal" role="dialog" aria-modal="true" aria-labelledby="daily-questions-title">
        <header className="modal-header">
          <div><h2 id="daily-questions-title">Dagvragen voor het rapport</h2><p>{clientReportSections.length} klantonderdelen · modulair hergebruikt · stap {step + 1} van 4</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
        </header>
        <form className="modal-body daily-questions-body" onSubmit={handleSubmit(save)} noValidate>
          <div className="question-stepper" aria-label="Voortgang dagvragen">
            {stepTitles.map((title, index) => <span className={index === step ? "active" : index < step ? "done" : ""} key={title}><b>{index < step ? <Check size={12} /> : index + 1}</b>{title}</span>)}
          </div>

          {step === 0 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><Gauge size={18} /></span><span><h3>Hoe is het project vandaag gegaan?</h3><p>Deze antwoorden voeden samenvatting, werkzaamheden en voortgang; de onderliggende modules blijven de bron.</p></span></header>
              <div className="form-grid two-columns">
                <label className="form-field wide"><span>Samenvatting van de dag *</span><textarea rows={4} placeholder="Vat in maximaal vijf regels samen wat er is gebeurd." {...register("daySummary")} />{errors.daySummary ? <small className="field-error">{errors.daySummary.message}</small> : null}</label>
                <label className="form-field"><span>Wat was het werkelijke weer? *</span><input type="text" {...register("weatherSummary")} />{errors.weatherSummary ? <small className="field-error">{errors.weatherSummary.message}</small> : null}</label>
                <label className="form-field"><span>Voortgang project</span><span className="input-with-unit"><input type="number" min="0" max="100" {...register("progressPercent", { valueAsNumber: true })} /><em>%</em></span>{errors.progressPercent ? <small className="field-error">{errors.progressPercent.message}</small> : null}</label>
                <label className="form-field wide"><span>Welke werkzaamheden zijn uitgevoerd? *</span><textarea rows={4} placeholder="Activiteit, locatie en percentage gereed." {...register("workPerformed")} />{errors.workPerformed ? <small className="field-error">{errors.workPerformed.message}</small> : null}</label>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><ShieldCheck size={18} /></span><span><h3>Wat is gecontroleerd en waren er afwijkingen?</h3><p>Niet-akkoord antwoorden worden alleen als conceptbevinding of HSE-melding voorgesteld; de supervisor bevestigt ernst en vervolg.</p></span></header>
              <div className="form-grid two-columns">
                <label className="form-field"><span>Inspecties uitgevoerd</span><select {...register("inspectionResult")}><option value="none">Geen inspectie</option><option value="all_ok">Uitgevoerd · alles akkoord</option><option value="issues">Uitgevoerd · afwijking gevonden</option></select></label>
                <label className="form-field"><span>Kwaliteitsbevindingen?</span><select {...register("qualityIssues")}><option value="no">Nee</option><option value="yes">Ja</option></select></label>
                {qualityIssues === "yes" ? <label className="form-field wide"><span>Omschrijf locatie, bevinding en verantwoordelijke *</span><textarea rows={4} {...register("qualityDetails")} />{errors.qualityDetails ? <small className="field-error">{errors.qualityDetails.message}</small> : null}</label> : null}
                <label className="form-field"><span>Veiligheidsgebeurtenis?</span><select {...register("hseEvent")}><option value="none">Geen incident / near miss</option><option value="near_miss">Near miss</option><option value="incident">Incident</option></select></label>
                {hseEvent !== "none" ? <label className="form-field wide"><span>Omschrijf gebeurtenis en directe maatregel *</span><textarea rows={4} {...register("hseDetails")} />{errors.hseDetails ? <small className="field-error">{errors.hseDetails.message}</small> : null}</label> : null}
              </div>
              <div className="question-module-note"><AlertTriangle size={14} /><span>De app sluit nooit autonoom een incident, NCR of herstel. Dit blijft een menselijke handeling.</span></div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><PackageCheck size={18} /></span><span><h3>Welke logistiek, testen of vertraging speelden mee?</h3><p>Antwoorden worden gekoppeld aan materieel, leveringen, metingen, meer-/minderwerk en vertraging.</p></span></header>
              <div className="form-grid two-columns">
                <label className="form-field"><span>Materieel en status</span><textarea rows={3} placeholder="Bijv. betonpomp operationeel; trilplaat buiten gebruik" {...register("equipmentStatus")} /></label>
                <label className="form-field"><span>Materialen geleverd</span><textarea rows={3} placeholder="Materiaal, hoeveelheid en leverancier" {...register("deliveries")} /></label>
                <label className="form-field wide"><span>Testen en meetwaarden</span><textarea rows={3} placeholder="Bijv. slump 90 mm; betondekking 45 mm" {...register("testsMeasurements")} /></label>
                <label className="form-field"><span>Meer- of minderwerk</span><select {...register("variationWork")}><option value="none">Niet van toepassing</option><option value="pending">In behandeling</option><option value="approved">Goedgekeurd</option><option value="rejected">Afgewezen</option></select></label>
                <label className="form-field"><span>Was er vertraging?</span><select {...register("delayCause")}><option value="none">Geen vertraging</option><option value="weather">Weer</option><option value="delivery">Levering te laat</option><option value="material">Materiaaltekort</option><option value="equipment">Materieelstoring</option><option value="other">Andere oorzaak</option></select></label>
                {delayCause !== "none" ? <label className="form-field"><span>Tijdverlies</span><span className="input-with-unit"><input type="number" min="0" max="24" step="0.25" {...register("delayHours", { valueAsNumber: true })} /><em>uur</em></span>{errors.delayHours ? <small className="field-error">{errors.delayHours.message}</small> : null}</label> : null}
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="question-group">
              <header><span className="question-group-icon"><CalendarDays size={18} /></span><span><h3>Wat is afgesproken en wat staat morgen gepland?</h3><p>Afspraken, risico’s en planning blijven gestructureerd en worden meegenomen naar de volgende dag.</p></span></header>
              <div className="form-grid two-columns">
                <label className="form-field"><span>Communicatie en gemaakte afspraken</span><textarea rows={4} placeholder="Met wie is wat afgesproken en wanneer?" {...register("communication")} /></label>
                <label className="form-field"><span>Open risico’s</span><textarea rows={4} placeholder="Weer, levering, grondwater, hijswerk..." {...register("risks")} /></label>
                <label className="form-field wide"><span>Welke werkzaamheden staan morgen gepland? *</span><textarea rows={4} {...register("tomorrowPlan")} />{errors.tomorrowPlan ? <small className="field-error">{errors.tomorrowPlan.message}</small> : null}</label>
                <label className="form-field"><span>Aantal foto’s vandaag</span><input type="number" min="0" {...register("photoCount", { valueAsNumber: true })} /></label>
                <label className="confirmation-check wide"><input type="checkbox" {...register("attachmentsConfirmed")} /><span><strong>Bijlagen gecontroleerd</strong><small>Inspectieformulieren, certificaten, bonnen, tekeningen, NCR’s en meetrapporten zijn bekeken; ontbrekende stukken blijven zichtbaar.</small>{errors.attachmentsConfirmed ? <em className="field-error">{errors.attachmentsConfirmed.message}</em> : null}</span></label>
              </div>
            </section>
          ) : null}

          <div className="modal-actions daily-question-actions">
            <span className="form-note"><CheckCircle2 size={13} /> Na serverbevestiging worden antwoorden centraal hergebruikt in cockpit en rapportcontrole.</span>
            <div>
              {step > 0 ? <button className="ghost-button" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={14} /> Vorige</button> : null}
              {step < 3 ? <button className="primary-button" type="button" onClick={nextStep}>Volgende vragen <ArrowRight size={14} /></button> : <button className="primary-button" type="submit">Dagvragen bevestigen <Check size={14} /></button>}
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
  const hseComplete = completedTodos.includes(2) || Boolean(dailyCloseoutAnswers);
  const tomorrowComplete = completedTodos.includes(3) || Boolean(dailyCloseoutAnswers?.tomorrowPlan);
  const checks = [
    { title: "Project- en rapportgegevens", detail: "Nummer, datum, dienst en gebouwen", complete: true },
    { title: "Aanwezigheid en activiteiten", detail: `${attendanceTotal} personen en ${entries.length} dagregistraties`, complete: true },
    { title: "Inspecties en bevindingen", detail: `${entries.filter((entry) => entry.kind === "inspection").length} inspecties · ${entries.filter((entry) => entry.badgeTone === "red").length} kritieke registratie(s)`, complete: true },
    { title: "Dagvragen volgens klantformat", detail: dailyCloseoutAnswers ? "Verloop, weer, logistiek, risico's en morgen bevestigd" : "Vier begeleide vraaggroepen nog invullen", complete: Boolean(dailyCloseoutAnswers) },
    { title: "HSE-dagcheck", detail: hseComplete ? "Alle controlepunten ingevuld" : "Nog 3 controlepunten ontbreken", complete: hseComplete },
    { title: "Planning voor morgen", detail: tomorrowComplete ? "Planning is bevestigd" : "Nog niet ingevuld", complete: tomorrowComplete },
  ];
  const missing = checks.filter((check) => !check.complete).length;
  const submitted = ["ready_for_review", "in_review", "approved"].includes(reportStatus);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header className="modal-header">
          <div><h2 id="report-title">Rapport controleren</h2><p>{reportNumber} · {submitted ? "ingediend" : "conceptversie"}</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label="Sluiten"><X size={18} /></button>
        </header>
        <div className="modal-body">
          <div className="report-check-list">
            {checks.map((check) => (
              <div className="report-check-row" key={check.title}>
                <span className={`report-check-state ${check.complete ? "complete" : "missing"}`}>{check.complete ? <Check size={15} /> : <AlertTriangle size={15} />}</span>
                <span className="report-check-copy"><strong>{check.title}</strong><span>{check.detail}</span></span>
                <span className="report-check-label">{check.complete ? "Compleet" : "Aanvullen"}</span>
              </div>
            ))}
          </div>
          <div className="report-summary-box">
            <label htmlFor="summary">Voorgestelde dagsamenvatting</label>
            <textarea id="summary" defaultValue={dailyCloseoutAnswers?.daySummary ?? `Er waren ${attendanceTotal} personen aanwezig op project ${projectName}. Er zijn ${entries.length} centrale dagregistraties vastgelegd.`} />
            <small className="summary-source">Vaste samenvatting op basis van bevestigde dagvragen en modulegegevens; supervisor controleert de tekst.</small>
          </div>
          <div className="modal-actions">
            <span style={{ color: missing ? "var(--yellow)" : "var(--green)", fontSize: 10, fontWeight: 680 }}>{missing ? `${missing} onderdeel${missing > 1 ? "en" : ""} nog aanvullen` : "Alle controles geslaagd"}</span>
            <div className="report-action-buttons">
              <button className="ghost-button" type="button" disabled={missing > 0} onClick={onDownload}><FileText size={14} /> Concept-PDF</button>
              <button className="primary-button" type="button" disabled={missing > 0 || submitted} onClick={onSubmit}>{submitted ? "Ingediend" : "Gereed voor review"} <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
