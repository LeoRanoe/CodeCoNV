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
  MapPin,
  Menu,
  MessageSquareText,
  Minus,
  MoreHorizontal,
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
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  clientReportSections,
  dailyCloseoutSchema,
  getProjectStartAutomation,
  projectStartSchema,
  type DailyCloseoutAnswers,
  type ProjectStartAnswers,
} from "@/lib/forms/daily-report";

type NavKey = "vandaag" | "project" | "acties" | "rapporten" | "meer";
type ModalKey = "quick" | "entry" | "report" | "attendance" | "daily_questions" | null;
type WorkspaceStage = "projects" | "buildings" | "project_start" | "cockpit";
type EntryKind =
  | "activity"
  | "inspection"
  | "finding"
  | "photo"
  | "action"
  | "note";

type TimelineEntry = {
  id: number;
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

type ProjectContext = {
  id: string;
  name: string;
  code: string;
  location: string;
  client: string;
  progress: number;
  openIssues: number;
  buildings: BuildingContext[];
};

type BuildingContext = {
  id: string;
  name: string;
  description: string;
  progress: number;
  openIssues: number;
};

type AttendanceRow = {
  id: number;
  party: string;
  discipline: string;
  count: number;
  shift: string;
};

const navigation: { id: NavKey; label: string; icon: LucideIcon; badge?: string }[] = [
  { id: "vandaag", label: "Vandaag", icon: Home },
  { id: "project", label: "Project", icon: LayoutDashboard },
  { id: "acties", label: "Acties", icon: ClipboardCheck, badge: "5" },
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

const projects: ProjectContext[] = [
  {
    id: "kwattaweg-residence",
    name: "Kwattaweg Residence",
    code: "COD-2026-014",
    location: "Paramaribo",
    client: "Particuliere opdrachtgever",
    progress: 67,
    openIssues: 7,
    buildings: [
      { id: "hoofdgebouw", name: "Hoofdgebouw", description: "Woongebouw · ruwbouw", progress: 67, openIssues: 5 },
      { id: "terrein", name: "Terrein & voorzieningen", description: "Fundering, drainage en buitenwerk", progress: 24, openIssues: 2 },
    ],
  },
  {
    id: "commewijne-port",
    name: "Commewijne Port Facility",
    code: "COD-2026-009",
    location: "Nieuw Amsterdam, Commewijne",
    client: "Commewijne Port Facilities",
    progress: 42,
    openIssues: 4,
    buildings: [
      { id: "quay", name: "Kadeconstructie", description: "Betonwerk en aanlegvoorzieningen", progress: 42, openIssues: 3 },
      { id: "yard", name: "Opslagterrein", description: "Terreinwerk en infrastructuur", progress: 31, openIssues: 1 },
    ],
  },
];

const initialAttendance: AttendanceRow[] = [
  { id: 1, party: "Bouwbedrijf N.V.", discipline: "Ruwbouw", count: 21, shift: "07:00–16:00" },
  { id: 2, party: "ElectroWorks", discipline: "Elektro", count: 12, shift: "07:30–16:30" },
  { id: 3, party: "Aqua Install", discipline: "Werktuigbouw", count: 6, shift: "08:00–16:00" },
  { id: 4, party: "CODECO N.V.", discipline: "Supervisie", count: 3, shift: "07:00–17:00" },
];

const initialTimeline: TimelineEntry[] = [
  {
    id: 1,
    time: "11:18",
    kind: "finding",
    title: "Onvoldoende betondekking bij kolom C-14",
    detail: "Gemeten dekking 18 mm; vereist minimaal 25 mm. Uitvoerder is geïnformeerd.",
    location: "Hoofdgebouw · Verdieping 3",
    person: "Jennifer G.",
    badge: "Kritiek",
    badgeTone: "red",
  },
  {
    id: 2,
    time: "10:42",
    kind: "inspection",
    title: "Wapeningsinspectie vloer V3 afgerond",
    detail: "14 van 15 controlepunten akkoord. Eén bevinding automatisch aangemaakt.",
    location: "Hoofdgebouw · Verdieping 3",
    person: "Jennifer G.",
    badge: "Afgerond",
    badgeTone: "green",
  },
  {
    id: 3,
    time: "09:25",
    kind: "photo",
    title: "4 voortgangsfoto’s toegevoegd",
    detail: "Bekisting kernwand oostzijde, werkpakket ruwbouw.",
    location: "Hoofdgebouw · Verdieping 3",
    person: "Jennifer G.",
    badge: "Foto",
  },
  {
    id: 4,
    time: "08:10",
    kind: "activity",
    title: "Bekisting kernwand gestart",
    detail: "Ploeg van Bouwbedrijf N.V. gestart met 8 personen. Voortgang op 35% gezet.",
    location: "Hoofdgebouw · Verdieping 3",
    person: "Jennifer G.",
    badge: "Actief",
    badgeTone: "green",
  },
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

function currentTime() {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Paramaribo",
  }).format(new Date());
}

export function CodecoSupervisionApp() {
  const [workspaceStage, setWorkspaceStage] = useState<WorkspaceStage>("projects");
  const [selectedProject, setSelectedProject] = useState<ProjectContext | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingContext | null>(null);
  const [activeNav, setActiveNav] = useState<NavKey>("vandaag");
  const [modal, setModal] = useState<ModalKey>(null);
  const [selectedType, setSelectedType] = useState<string>("activity");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Verdieping 3 · Zone oost");
  const [priority, setPriority] = useState("Normaal");
  const [entries, setEntries] = useState<TimelineEntry[]>(initialTimeline);
  const [attendance, setAttendance] = useState<AttendanceRow[]>(initialAttendance);
  const [completedTodos, setCompletedTodos] = useState<number[]>([1]);
  const [projectStartAnswers, setProjectStartAnswers] = useState<ProjectStartAnswers | null>(null);
  const [dailyCloseoutAnswers, setDailyCloseoutAnswers] = useState<DailyCloseoutAnswers | null>(null);
  const [toast, setToast] = useState("");
  const storageStatus = isSupabaseConfigured
    ? "Supabase geconfigureerd · demo-invoer nog niet gekoppeld"
    : "Demosessie · niet centraal opgeslagen";

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

  const completeness = useMemo(() => {
    const complete = 4 + Math.min(completedTodos.length, 3) + (projectStartAnswers ? 1 : 0) + (dailyCloseoutAnswers ? 1 : 0);
    return Math.round((complete / 9) * 100);
  }, [completedTodos, dailyCloseoutAnswers, projectStartAnswers]);

  const attendanceTotal = useMemo(
    () => attendance.reduce((total, row) => total + row.count, 0),
    [attendance],
  );

  const openQuickAdd = () => {
    setDescription("");
    setModal("quick");
  };

  const chooseType = (type: string) => {
    setSelectedType(type);
    setModal("entry");
  };

  const saveEntry = () => {
    if (!description.trim()) return;
    const safeKind: EntryKind = ["activity", "inspection", "finding", "photo", "action", "note"].includes(selectedType)
      ? (selectedType as EntryKind)
      : "note";
    const isFinding = selectedType === "finding" || selectedType === "hse";
    const newEntry: TimelineEntry = {
      id: Date.now(),
      time: currentTime(),
      kind: safeKind,
      title: description.trim(),
      detail: `${entryTitles[selectedType]} in deze demosessie toegevoegd met project-, gebouw- en tijdcontext.`,
      location: `${selectedBuilding?.name ?? "Gebouw"} · ${location}`,
      person: "Jennifer G.",
      badge: isFinding ? priority : "Opgeslagen",
      badgeTone: isFinding && priority === "Kritiek" ? "red" : "green",
    };
    setEntries((current) => [newEntry, ...current]);
    setModal(null);
    setToast(`${entryTitles[selectedType]} is alleen in deze demosessie aan het dagrapport toegevoegd.`);
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
    setWorkspaceStage("project_start");
  };

  const startProject = (answers: ProjectStartAnswers) => {
    if (!selectedProject || !selectedBuilding) return;
    setProjectStartAnswers(answers);
    setWorkspaceStage("cockpit");
    setActiveNav("vandaag");
    window.scrollTo({ top: 0 });
  };

  const changeAttendance = (id: number, delta: number) => {
    setAttendance((current) =>
      current.map((row) => row.id === id ? { ...row, count: Math.max(0, row.count + delta) } : row),
    );
  };

  if (workspaceStage !== "cockpit") {
    return (
      <ContextSelection
        stage={workspaceStage}
        selectedProject={selectedProject}
        selectedBuilding={selectedBuilding}
        chooseProject={chooseProject}
        chooseBuilding={setSelectedBuilding}
        openProjectStart={openProjectStart}
        startProject={startProject}
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
        <div className="user-card">
          <span className="avatar">JG</span>
          <span className="user-copy">
            <strong>Jennifer G.</strong>
            <small>Supervisor</small>
          </span>
          <MoreHorizontal size={16} color="#7893a1" />
        </div>
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
            <span className="storage-state" title={storageStatus}><AlertTriangle size={14} /> <span>{storageStatus}</span></span>
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
              showCritical={() => {
                navigate("acties");
                setToast("Kritieke bevinding Q-2026-018 geopend.");
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
      {modal === "report" ? (
        <ReportModal
          close={() => setModal(null)}
          completedTodos={completedTodos}
          entries={entries}
          attendanceTotal={attendanceTotal}
          projectName={projectName}
          dailyCloseoutAnswers={dailyCloseoutAnswers}
          onSubmit={() => {
            setModal(null);
            setToast("Dagrapport is gereed voor review gezet.");
          }}
        />
      ) : null}
      {modal === "daily_questions" ? (
        <DailyQuestionsModal
          close={() => setModal(null)}
          initialAnswers={dailyCloseoutAnswers}
          projectStartAnswers={projectStartAnswers}
          save={(answers) => {
            setDailyCloseoutAnswers(answers);
            setCompletedTodos((current) => Array.from(new Set([...current, 2, 3])));
            setEntries((current) => [
              {
                id: 900001,
                time: currentTime(),
                kind: "note",
                title: "Dagvragen bijgewerkt",
                detail: "Verloop, kwaliteit/HSE, logistiek en morgenplanning zijn in de demosessie bevestigd.",
                location: `${buildingName} · projectbreed`,
                person: "Jennifer G.",
                badge: "Bevestigd",
                badgeTone: "green",
              },
              ...current.filter((entry) => entry.id !== 900001),
            ]);
            setModal(null);
            setToast("Dagvragen zijn alleen in deze demosessie verwerkt in de rapportcontrole.");
          }}
        />
      ) : null}
      {modal === "attendance" ? (
        <AttendanceModal
          rows={attendance}
          total={attendanceTotal}
          changeCount={changeAttendance}
          copyPreviousDay={() => {
            setAttendance([
              { id: 1, party: "Bouwbedrijf N.V.", discipline: "Ruwbouw", count: 20, shift: "07:00–16:00" },
              { id: 2, party: "ElectroWorks", discipline: "Elektro", count: 12, shift: "07:30–16:30" },
              { id: 3, party: "Aqua Install", discipline: "Werktuigbouw", count: 6, shift: "08:00–16:00" },
              { id: 4, party: "CODECO N.V.", discipline: "Supervisie", count: 3, shift: "07:00–17:00" },
            ]);
            setToast("Aanwezigheid van de vorige werkdag is als voorstel overgenomen.");
          }}
          close={() => setModal(null)}
          save={() => {
            setModal(null);
            setToast(`${attendanceTotal} aanwezigen zijn alleen in deze demosessie aan het dagrapport toegevoegd.`);
          }}
        />
      ) : null}

      {toast ? <div className="toast" role="status"><CheckCircle2 size={18} /> {toast}</div> : null}
    </div>
  );
}

function ContextSelection({
  stage,
  selectedProject,
  selectedBuilding,
  chooseProject,
  chooseBuilding,
  openProjectStart,
  startProject,
  goBack,
  goBackToBuilding,
}: {
  stage: WorkspaceStage;
  selectedProject: ProjectContext | null;
  selectedBuilding: BuildingContext | null;
  chooseProject: (project: ProjectContext) => void;
  chooseBuilding: (building: BuildingContext) => void;
  openProjectStart: () => void;
  startProject: (answers: ProjectStartAnswers) => void;
  goBack: () => void;
  goBackToBuilding: () => void;
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
        <div className="context-user"><span className="avatar">JG</span><span><strong>Jennifer G.</strong><small>Supervisor</small></span></div>
      </header>

      <main className="context-content">
        <div className="data-mode-notice" role="status">
          <AlertTriangle size={17} />
          <span><strong>Demosessie</strong> Wijzigingen worden nog niet centraal bewaard. Supabase is voorbereid, maar nog niet aan deze interface gekoppeld.</span>
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
}: {
  project: ProjectContext;
  building: BuildingContext;
  goBack: () => void;
  startProject: (answers: ProjectStartAnswers) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProjectStartAnswers>({
    resolver: zodResolver(projectStartSchema),
    mode: "onBlur",
    defaultValues: {
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
        <span className="context-project-pill"><CalendarDays size={15} /> Zaterdag 18 juli 2026</span>
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
            <span><ShieldCheck size={15} /> Antwoorden blijven in deze demo alleen in de geopende sessie.</span>
            <button className="primary-button" type="submit">Dagrapport starten <ArrowRight size={15} /></button>
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
}) {
  const todos = [
    { id: 1, title: "Weer en werktijden bevestigen", detail: "Vastgelegd om 07:02", flag: "" },
    { id: 2, title: "HSE-dagcheck afronden", detail: "Nog 3 controlepunten", flag: "red" },
    { id: 3, title: "Planning voor morgen invullen", detail: "Voor dagafsluiting", flag: "" },
  ];
  const automation = projectStartAnswers ? getProjectStartAutomation(projectStartAnswers) : [];
  const weatherLabel = projectStartAnswers
    ? `${projectStartAnswers.temperatureC}°C · ${weatherLabels[projectStartAnswers.weatherCondition]}`
    : "Weer nog niet bevestigd";

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">Zaterdag 18 juli 2026</p>
          <h1>Goedemorgen, Jennifer.</h1>
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
            <h2>Dagrapport DR-2026-0718</h2>
            <p>Gegevens uit alle gebouwen worden automatisch in dit projectrapport samengebracht.</p>
            <button className="inline-button" type="button" onClick={openReport}>
              Rapportstatus bekijken <ArrowRight size={14} />
            </button>
          </div>
          <div className="progress-ring" style={{ background: `conic-gradient(var(--signal) 0 ${completeness}%, rgba(255,255,255,.11) ${completeness}% 100%)` }}>
            <span className="progress-value"><strong>{completeness}%</strong><span>compleet</span></span>
          </div>
        </article>

        <article className="critical-card">
          <div>
            <div className="critical-top">
              <span className="critical-icon"><AlertTriangle size={20} /></span>
              <span className="critical-badge">1 kritiek</span>
            </div>
            <h3>Betondekking onder norm</h3>
            <p>Kolom C-14 · Verdieping 3 · Deadline vandaag 16:00</p>
          </div>
          <button className="text-link" type="button" onClick={showCritical}>Open bevinding Q-2026-018 <ArrowRight size={13} /></button>
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
              <div className="section-heading"><h2>In één oogopslag</h2><p>Stand om 11:30</p></div>
            </header>
            <div className="metrics-grid">
              <Metric icon={Users} value={String(attendanceTotal)} label="mensen aanwezig" suffix="" />
              <Metric icon={Gauge} value="67" label="projectvoortgang" suffix="%" />
              <Metric icon={ClipboardCheck} value="2/3" label="inspecties gereed" suffix="" />
              <Metric icon={CheckCircle2} value="5" label="open acties" suffix="" />
            </div>
          </article>

          <article className="panel">
            <header className="panel-header">
              <div className="section-heading"><h2>Nog te doen</h2><p>Voor je het rapport afrondt</p></div>
              <span className="status-badge" style={{ padding: "5px 8px", background: "var(--yellow-soft)", color: "var(--yellow)" }}>2 open</span>
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
}: {
  activeNav: NavKey;
  openQuickAdd: () => void;
  navigate: (next: NavKey) => void;
  projectName: string;
  buildingName: string;
  attendanceTotal: number;
  openAttendance: () => void;
}) {
  if (activeNav === "project") {
    const modules = [
      { title: "Aanwezigheid", copy: "Partijen, disciplines, aantallen en diensten", icon: Users, count: `${attendanceTotal} vandaag`, action: openAttendance },
      { title: "Activiteiten", copy: "Werkpakketten, planning en voortgang", icon: Wrench, count: "8 actief", action: openQuickAdd },
      { title: "Inspecties", copy: "Gepland, uitgevoerd en herinspecties", icon: ClipboardCheck, count: "3 vandaag", action: openQuickAdd },
      { title: "Bevindingen", copy: "Kwaliteit, NCR en herstelverificatie", icon: AlertTriangle, count: "7 open", action: () => navigate("acties") },
      { title: "HSE", copy: "Dagcheck, observaties en incidenten", icon: ShieldCheck, count: "1 open", action: openQuickAdd },
      { title: "Foto’s", copy: "Bewijs, locaties en koppelingen", icon: Image, count: "128", action: openQuickAdd },
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
    const actions = [
      { title: "Herstel betondekking kolom C-14", meta: "Bouwbedrijf N.V. · Vandaag 16:00", status: "Kritiek", tone: "red" },
      { title: "Certificaat betonlevering toevoegen", meta: "R. Pinas · Vandaag 15:00", status: "Vandaag", tone: "" },
      { title: "Herinspectie wapening vloer V3", meta: "Jennifer G. · Morgen 08:00", status: "Gepland", tone: "green" },
      { title: "Werkplan hijszone laten goedkeuren", meta: "Projectleider · 20-07-2026", status: "Open", tone: "" },
    ];
    return (
      <>
        <header className="secondary-header">
          <div><p className="eyebrow">5 open · 1 kritiek</p><h1>Acties</h1><p>Persoonlijke en toegewezen opvolging in één lijst.</p></div>
          <button className="primary-button" type="button" onClick={openQuickAdd}><Plus size={15} /> Actie toevoegen</button>
        </header>
        <section className="actions-list">
          {actions.map((action) => (
            <button className="action-row" type="button" key={action.title} style={{ textAlign: "left", cursor: "pointer" }}>
              <span className="action-icon"><CheckCircle2 size={18} /></span>
              <span className="action-copy"><strong>{action.title}</strong><span>{action.meta}</span></span>
              <span className={`task-status ${action.tone}`}>{action.status}</span>
            </button>
          ))}
        </section>
      </>
    );
  }

  if (activeNav === "rapporten") {
    return (
      <>
        <header className="secondary-header"><div><p className="eyebrow">Dagrapporten</p><h1>Rapporthistorie</h1><p>Concepten, versies, reviews en verzendhistorie.</p></div></header>
        <section className="actions-list">
          {["DR-2026-0718 · Vandaag", "DR-2026-0717 · Vrijdag", "DR-2026-0716 · Donderdag"].map((report, index) => (
            <button className="action-row" type="button" key={report} style={{ textAlign: "left", cursor: "pointer" }}>
              <span className="action-icon" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><FileText size={18} /></span>
              <span className="action-copy"><strong>{report}</strong><span>{projectName} · alle gebouwen</span></span>
              <span className={`task-status ${index === 0 ? "" : "green"}`}>{index === 0 ? "In uitvoering" : "Goedgekeurd"}</span>
            </button>
          ))}
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
  changeCount: (id: number, delta: number) => void;
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
                <span className="attendance-party"><strong>{row.party}</strong><small>{row.discipline} · {row.shift}</small></span>
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
  save: (answers: DailyCloseoutAnswers) => void;
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
                <label className="confirmation-check wide"><input type="checkbox" {...register("attachmentsConfirmed")} /><span><strong>Bijlagen gecontroleerd</strong><small>Inspectieformulieren, certificaten, bonnen, tekeningen, NCR’s en meetrapporten zijn bekeken; ontbrekende stukken blijven zichtbaar.</small></span></label>
              </div>
            </section>
          ) : null}

          <div className="modal-actions daily-question-actions">
            <span className="form-note"><CheckCircle2 size={13} /> Antwoorden worden in de demo direct hergebruikt in cockpit en rapportcontrole.</span>
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
  dailyCloseoutAnswers,
  onSubmit,
}: {
  close: () => void;
  completedTodos: number[];
  entries: TimelineEntry[];
  attendanceTotal: number;
  projectName: string;
  dailyCloseoutAnswers: DailyCloseoutAnswers | null;
  onSubmit: () => void;
}) {
  const hseComplete = completedTodos.includes(2) || Boolean(dailyCloseoutAnswers);
  const tomorrowComplete = completedTodos.includes(3) || Boolean(dailyCloseoutAnswers?.tomorrowPlan);
  const checks = [
    { title: "Project- en rapportgegevens", detail: "Nummer, datum, dienst en gebouwen", complete: true },
    { title: "Aanwezigheid en activiteiten", detail: `${attendanceTotal} personen en 3 actieve werkpakketten`, complete: true },
    { title: "Inspecties en bevindingen", detail: "3 inspecties · 1 kritieke bevinding open", complete: true },
    { title: "Dagvragen volgens klantformat", detail: dailyCloseoutAnswers ? "Verloop, weer, logistiek, risico's en morgen bevestigd" : "Vier begeleide vraaggroepen nog invullen", complete: Boolean(dailyCloseoutAnswers) },
    { title: "HSE-dagcheck", detail: hseComplete ? "Alle controlepunten ingevuld" : "Nog 3 controlepunten ontbreken", complete: hseComplete },
    { title: "Planning voor morgen", detail: tomorrowComplete ? "Planning is bevestigd" : "Nog niet ingevuld", complete: tomorrowComplete },
  ];
  const missing = checks.filter((check) => !check.complete).length;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header className="modal-header">
          <div><h2 id="report-title">Rapport controleren</h2><p>DR-2026-0718 · conceptversie</p></div>
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
            <textarea id="summary" defaultValue={dailyCloseoutAnswers?.daySummary ?? `Op 18 juli 2026 waren ${attendanceTotal} personen aanwezig op project ${projectName}. Er zijn ${entries.length} registraties vastgelegd. De werkzaamheden aan de bekisting van de kernwand en de wapening van vloer V3 zijn voortgezet. Bij kolom C-14 is een kritieke afwijking in de betondekking vastgesteld en toegewezen voor herstel.`} />
            <small className="summary-source">Vaste samenvatting op basis van bevestigde dagvragen en modulegegevens; supervisor controleert de tekst.</small>
          </div>
          <div className="modal-actions">
            <span style={{ color: missing ? "var(--yellow)" : "var(--green)", fontSize: 10, fontWeight: 680 }}>{missing ? `${missing} onderdeel${missing > 1 ? "en" : ""} nog aanvullen` : "Alle controles geslaagd"}</span>
            <button className="primary-button" type="button" disabled={missing > 0} onClick={onSubmit}>Gereed voor review <ArrowRight size={14} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
