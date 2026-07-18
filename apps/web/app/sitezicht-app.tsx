"use client";

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
  History,
  Home,
  Image,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquareText,
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

type NavKey = "vandaag" | "project" | "acties" | "rapporten" | "meer";
type ModalKey = "quick" | "entry" | "report" | null;
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

const initialTimeline: TimelineEntry[] = [
  {
    id: 1,
    time: "11:18",
    kind: "finding",
    title: "Onvoldoende betondekking bij kolom C-14",
    detail: "Gemeten dekking 18 mm; vereist minimaal 25 mm. Uitvoerder is geïnformeerd.",
    location: "Toren A · Verdieping 3",
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
    location: "Toren A · Verdieping 3",
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
    location: "Toren A · Verdieping 3",
    person: "Jennifer G.",
    badge: "Foto",
  },
  {
    id: 4,
    time: "08:10",
    kind: "activity",
    title: "Bekisting kernwand gestart",
    detail: "Ploeg van Bouwbedrijf N.V. gestart met 8 personen. Voortgang op 35% gezet.",
    location: "Toren A · Verdieping 3",
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

function currentTime() {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Paramaribo",
  }).format(new Date());
}

export function SitezichtApp() {
  const [activeNav, setActiveNav] = useState<NavKey>("vandaag");
  const [modal, setModal] = useState<ModalKey>(null);
  const [selectedType, setSelectedType] = useState<string>("activity");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Verdieping 3 · Zone oost");
  const [priority, setPriority] = useState("Normaal");
  const [entries, setEntries] = useState<TimelineEntry[]>(initialTimeline);
  const [completedTodos, setCompletedTodos] = useState<number[]>([1]);
  const [toast, setToast] = useState("");

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
    const complete = 4 + Math.min(completedTodos.length, 2);
    return Math.round((complete / 8) * 100);
  }, [completedTodos]);

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
      detail: `${entryTitles[selectedType]} centraal opgeslagen met project-, gebouw- en tijdcontext.`,
      location: `Toren A · ${location}`,
      person: "Jennifer G.",
      badge: isFinding ? priority : "Opgeslagen",
      badgeTone: isFinding && priority === "Kritiek" ? "red" : "green",
    };
    setEntries((current) => [newEntry, ...current]);
    setModal(null);
    setToast(`${entryTitles[selectedType]} is opgeslagen en in het dagrapport opgenomen.`);
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

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Hoofdnavigatie">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Sitezicht
        </div>

        <button className="project-context-card" type="button" aria-label="Project en gebouw wijzigen">
          <span className="project-context-icon"><Building2 size={17} /></span>
          <span className="project-context-copy">
            <strong>Waterkant Residences</strong>
            <small>Toren A · Paramaribo</small>
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
            <span>Waterkant Residences</span>
            <ChevronRight size={13} />
            <strong>Toren A</strong>
          </div>
          <div className="top-actions">
            <span className="online-state"><span className="online-dot" /> <span>Alles opgeslagen</span></span>
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
              showCritical={() => {
                navigate("acties");
                setToast("Kritieke bevinding Q-2026-018 geopend.");
              }}
            />
          ) : (
            <SecondaryView activeNav={activeNav} openQuickAdd={openQuickAdd} navigate={navigate} />
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
        />
      ) : null}
      {modal === "report" ? (
        <ReportModal
          close={() => setModal(null)}
          completedTodos={completedTodos}
          entries={entries}
          onSubmit={() => {
            setModal(null);
            setToast("Dagrapport is gereed voor review gezet.");
          }}
        />
      ) : null}

      {toast ? <div className="toast" role="status"><CheckCircle2 size={18} /> {toast}</div> : null}
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
}: {
  entries: TimelineEntry[];
  completeness: number;
  completedTodos: number[];
  toggleTodo: (id: number) => void;
  openReport: () => void;
  showCritical: () => void;
}) {
  const todos = [
    { id: 1, title: "Weer en werktijden bevestigen", detail: "Vastgelegd om 07:02", flag: "" },
    { id: 2, title: "HSE-dagcheck afronden", detail: "Nog 3 controlepunten", flag: "red" },
    { id: 3, title: "Planning voor morgen invullen", detail: "Voor dagafsluiting", flag: "" },
  ];

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">Zaterdag 18 juli 2026</p>
          <h1>Goedemorgen, Jennifer.</h1>
          <p>Dit vraagt vandaag je aandacht op Toren A.</p>
        </div>
        <div className="weather-chip">
          <span className="weather-icon"><CloudSun size={20} /></span>
          <span className="weather-copy">
            <strong>31°C · Licht bewolkt</strong>
            <span>Handmatig vastgelegd · 07:02</span>
          </span>
          <ChevronRight size={15} color="#718995" />
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
              <Metric icon={Users} value="42" label="mensen aanwezig" suffix="" />
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

function SecondaryView({ activeNav, openQuickAdd, navigate }: { activeNav: NavKey; openQuickAdd: () => void; navigate: (next: NavKey) => void }) {
  if (activeNav === "project") {
    const modules = [
      { title: "Activiteiten", copy: "Werkpakketten, planning en voortgang", icon: Wrench, count: "8 actief" },
      { title: "Inspecties", copy: "Gepland, uitgevoerd en herinspecties", icon: ClipboardCheck, count: "3 vandaag" },
      { title: "Bevindingen", copy: "Kwaliteit, NCR en herstelverificatie", icon: AlertTriangle, count: "7 open" },
      { title: "HSE", copy: "Dagcheck, observaties en incidenten", icon: ShieldCheck, count: "1 open" },
      { title: "Foto’s", copy: "Bewijs, locaties en koppelingen", icon: Image, count: "128" },
      { title: "Documenten", copy: "Tekeningen, normen en actuele revisies", icon: FileText, count: "42" },
    ];
    return (
      <>
        <header className="secondary-header">
          <div><p className="eyebrow">Waterkant Residences</p><h1>Projectoverzicht</h1><p>Registers en operationele modules voor Toren A.</p></div>
          <button className="primary-button" type="button" onClick={openQuickAdd}><Plus size={15} /> Nieuwe registratie</button>
        </header>
        <section className="secondary-grid">
          {modules.map((item) => {
            const Icon = item.icon;
            return (
              <button className="module-card" type="button" key={item.title} style={{ textAlign: "left", cursor: "pointer" }}>
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
              <span className="action-copy"><strong>{report}</strong><span>Waterkant Residences · alle gebouwen</span></span>
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
}) {
  const title = entryTitles[selectedType] ?? "Registratie";
  const needsPriority = selectedType === "finding" || selectedType === "hse" || selectedType === "action";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
        <header className="modal-header">
          <div><h2 id="entry-title">{title} vastleggen</h2><p>Waterkant Residences · Toren A · {currentTime()}</p></div>
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

function ReportModal({ close, completedTodos, entries, onSubmit }: { close: () => void; completedTodos: number[]; entries: TimelineEntry[]; onSubmit: () => void }) {
  const hseComplete = completedTodos.includes(2);
  const tomorrowComplete = completedTodos.includes(3);
  const checks = [
    { title: "Project- en rapportgegevens", detail: "Nummer, datum, dienst en gebouwen", complete: true },
    { title: "Aanwezigheid en activiteiten", detail: "42 personen en 3 actieve werkpakketten", complete: true },
    { title: "Inspecties en bevindingen", detail: "3 inspecties · 1 kritieke bevinding open", complete: true },
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
            <textarea id="summary" defaultValue={`Op 18 juli 2026 waren 42 personen aanwezig op project Waterkant Residences. Er zijn ${entries.length} registraties vastgelegd. De werkzaamheden aan de bekisting van de kernwand en de wapening van vloer V3 zijn voortgezet. Bij kolom C-14 is een kritieke afwijking in de betondekking vastgesteld en toegewezen voor herstel.`} />
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
