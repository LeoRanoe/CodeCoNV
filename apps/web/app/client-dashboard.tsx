"use client";

import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  FileCheck2,
  LayoutDashboard,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import NextImage from "next/image";
import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type DashboardEntry = {
  id: string;
  time: string;
  kind: string;
  title: string;
  detail: string;
  location: string;
  person: string;
  badgeTone?: "green" | "red";
};

type DashboardAction = {
  id: string;
  title: string;
  status: string;
  priority: string;
};

type DashboardWeather = {
  temperatureC: number;
  weatherCondition: string;
} | null;

const projectPhotos = [
  "/landing/structural-frame.jpg",
  "/landing/commewijne-port-facility.png",
  "/landing/structural-analysis.jpg",
  "/landing/newmont-recreation-centre.jpg",
  "/landing/consulting-design.jpg",
  "/landing/samara-apartment-complex.jpg",
];

function DashboardKpi({
  label,
  value,
  detail,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  tone: "green" | "orange" | "purple" | "cyan";
  onClick?: () => void;
}) {
  return (
    <button className="client-kpi-card" type="button" onClick={onClick}>
      <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
      <i className={tone}>{icon}</i>
    </button>
  );
}

function DonutCard({
  title,
  total,
  segments,
  link,
  onClick,
}: {
  title: string;
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
  link: string;
  onClick: () => void;
}) {
  const safeTotal = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
  const stops = segments.map((segment, index) => {
    const start = segments
      .slice(0, index)
      .reduce((sum, item) => sum + (item.value / safeTotal) * 100, 0);
    const end = start + (segment.value / safeTotal) * 100;
    return `${segment.color} ${start}% ${end}%`;
  }).join(", ");
  return (
    <article className="client-dashboard-card client-donut-card">
      <h2>{title}</h2>
      <div className="client-donut-content">
        <div className="client-donut" style={{ background: `conic-gradient(${stops || "#eaf0f2 0 100%"})` }}>
          <span><strong>{total}</strong><small>Totaal</small></span>
        </div>
        <div className="client-donut-legend">
          {segments.map((segment) => <span key={segment.label}><i style={{ background: segment.color }} /><b>{segment.label}</b><em>{segment.value}</em></span>)}
        </div>
      </div>
      <button className="client-card-link" type="button" onClick={onClick}>{link} <ChevronRight size={13} /></button>
    </article>
  );
}

export function ClientDashboard({
  entries,
  actions,
  projectName,
  buildingName,
  weather,
  openQuickAdd,
  openActions,
  openWorkspace,
  openDailyQuestions,
}: {
  entries: DashboardEntry[];
  actions: DashboardAction[];
  projectName: string;
  buildingName: string;
  weather: DashboardWeather;
  openQuickAdd: () => void;
  openActions: () => void;
  openWorkspace: () => void;
  openDailyQuestions: () => void;
}) {
  const { text } = useLanguage();
  const [search, setSearch] = useState("");
  const openTaskItems = actions.filter((action) => action.status !== "verified" && action.status !== "cancelled");
  const completedActions = actions.filter((action) => action.status === "verified" || action.status === "cancelled");
  const urgentActions = openTaskItems.filter((action) => action.priority === "high" || action.priority === "critical");
  const inspections = entries.filter((entry) => entry.kind === "inspection");
  const issues = entries.filter((entry) => entry.kind === "finding" || entry.badgeTone === "red");
  const photos = entries.filter((entry) => entry.kind === "photo");
  const workEntries = entries.filter((entry) => entry.kind === "activity");
  const displayedWork = (workEntries.length ? workEntries : entries).slice(0, 3);
  const displayedEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries.slice(0, 5);
    return entries.filter((entry) => `${entry.title} ${entry.detail} ${entry.location} ${entry.person}`.toLowerCase().includes(term)).slice(0, 5);
  }, [entries, search]);
  const issueOpen = issues.length;
  const issueReview = Math.min(issueOpen, Math.max(0, Math.round(issueOpen * 0.3)));
  const issueClosed = Math.max(0, entries.filter((entry) => entry.kind === "finding" && entry.badgeTone === "green").length);
  const temperature = weather?.temperatureC ?? 31;
  const weatherText = weather
    ? ({ sunny: text("Sunny", "Zonnig"), partly_cloudy: text("Partly cloudy", "Licht bewolkt"), cloudy: text("Cloudy", "Bewolkt"), rain: text("Rain", "Regen"), heavy_rain: text("Heavy rain", "Zware regen") } as Record<string, string>)[weather.weatherCondition] ?? text("Current weather", "Actueel weer")
    : text("Lightly clouded", "Licht bewolkt");

  return (
    <section className="client-dashboard" aria-label={text("Project dashboard", "Projectdashboard")}>
      <header className="client-dashboard-toolbar">
        <div><LayoutDashboard size={18} /><strong>Dashboard</strong></div>
        <div className="client-dashboard-tools">
          <label className="client-dashboard-search"><Search size={16} /><span className="sr-only">{text("Search dashboard", "Doorzoek dashboard")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Search", "Zoeken")} /></label>
          <button type="button" aria-label={text("Notifications", "Meldingen")}><Bell size={17} /><i /></button>
          <button type="button" aria-label={text("Daily questions", "Dagvragen")} onClick={openDailyQuestions}><CalendarDays size={17} /></button>
          <button className="client-new-button" type="button" onClick={openQuickAdd}><Plus size={16} /> {text("New", "Nieuw")}</button>
        </div>
      </header>

      <div className="client-kpi-grid">
        <DashboardKpi label={text("Tasks", "Taken")} value={actions.length} detail={`${completedActions.length} ${text("completed", "voltooid")} · ${openTaskItems.length} open`} icon={<FileCheck2 size={22} />} tone="green" onClick={openActions} />
        <DashboardKpi label={text("Issues / defects", "Issues / defecten")} value={issues.length} detail={`${issueOpen} open · ${issueClosed} ${text("closed", "gesloten")}`} icon={<AlertTriangle size={22} />} tone="orange" onClick={openActions} />
        <DashboardKpi label={text("Inspections", "Inspecties")} value={inspections.length} detail={text("This month", "Deze maand")} icon={<ClipboardCheck size={22} />} tone="purple" onClick={openWorkspace} />
        <DashboardKpi label={text("Photos", "Foto's")} value={photos.length} detail={text("This month", "Deze maand")} icon={<Camera size={22} />} tone="cyan" onClick={openQuickAdd} />
      </div>

      <div className="client-dashboard-row client-dashboard-middle">
        <article className="client-dashboard-card client-work-card">
          <h2>{text("Latest recorded work", "Laatst ingevoerde werkzaamheden")}</h2>
          <div className="client-work-table">
            <header><span>{text("Work", "Werkzaamheid")}</span><span>{text("Location", "Locatie")}</span><span>{text("Latest update", "Laatste update")}</span></header>
            {displayedWork.length ? displayedWork.map((entry) => (
              <button type="button" key={entry.id} onClick={openWorkspace}>
                <span><strong>{entry.title}</strong><small>{entry.detail}</small></span>
                <span>{entry.location}</span>
                <span>{entry.time}</span>
              </button>
            )) : <div className="client-empty-row">{text("No work recorded yet.", "Nog geen werkzaamheden geregistreerd.")}</div>}
          </div>
          <button className="client-card-link" type="button" onClick={openWorkspace}>{text("View all work", "Bekijk alle werkzaamheden")} <ChevronRight size={13} /></button>
        </article>

        <DonutCard
          title={text("Issues overview", "Issues overzicht")}
          total={issues.length}
          segments={[
            { label: text("Open", "Open"), value: Math.max(0, issueOpen - issueReview), color: "#ef3f36" },
            { label: text("In review", "In review"), value: issueReview, color: "#22a6d5" },
            { label: text("Closed", "Gesloten"), value: issueClosed, color: "#42af58" },
          ]}
          link={text("View all issues", "Bekijk alle issues")}
          onClick={openActions}
        />
        <DonutCard
          title={text("Tasks overview", "Taken overzicht")}
          total={actions.length}
          segments={[
            { label: text("Open", "Open"), value: Math.max(0, openTaskItems.length - urgentActions.length), color: "#ef3f36" },
            { label: text("Urgent", "Urgent"), value: urgentActions.length, color: "#f6a51c" },
            { label: text("Completed", "Voltooid"), value: completedActions.length, color: "#42af58" },
          ]}
          link={text("View all tasks", "Bekijk alle taken")}
          onClick={openActions}
        />
      </div>

      <div className="client-dashboard-row client-dashboard-bottom">
        <article className="client-dashboard-card client-activity-card">
          <h2>{text("Latest activities", "Laatste activiteiten")}</h2>
          <div className="client-activity-list">
            {displayedEntries.length ? displayedEntries.map((entry) => (
              <button type="button" key={entry.id} onClick={openActions}>
                <i className={entry.badgeTone === "red" ? "alert" : entry.kind}><CheckCircle2 size={15} /></i>
                <span><strong>{entry.title}</strong><small>{entry.person} · {entry.detail}</small></span>
                <time>{entry.time}</time>
              </button>
            )) : <div className="client-empty-row">{text("No matching activities.", "Geen overeenkomende activiteiten.")}</div>}
          </div>
          <button className="client-card-link" type="button" onClick={openActions}>{text("View all activities", "Bekijk alle activiteiten")} <ChevronRight size={13} /></button>
        </article>

        <article className="client-dashboard-card client-photo-card">
          <h2>{text("Recent photos", "Recente foto's")}</h2>
          <div className="client-photo-grid">
            {projectPhotos.map((source, index) => <button type="button" key={source} onClick={openQuickAdd} aria-label={text(`Open project photo ${index + 1}`, `Open projectfoto ${index + 1}`)}><NextImage src={source} alt="" fill sizes="(max-width: 900px) 33vw, 150px" /></button>)}
          </div>
          <button className="client-card-link" type="button" onClick={openQuickAdd}>{text("View all photos", "Bekijk alle foto's")} <ChevronRight size={13} /></button>
        </article>

        <article className="client-dashboard-card client-weather-plan-card">
          <div className="client-weather">
            <div><CloudSun size={34} /><span><strong>{temperature}°C</strong><small>{weatherText}</small></span></div>
            <dl><div><dt>{text("Humidity", "Vochtigheid")}</dt><dd>70%</dd></div><div><dt>{text("Wind", "Wind")}</dt><dd>18 km/h</dd></div><div><dt>{text("Rain chance", "Regenkans")}</dt><dd>40%</dd></div></dl>
          </div>
          <div className="client-weather-days">
            {["MA", "DI", "WO", "DO", "VR"].map((day, index) => <span key={day}><b>{day}</b><CloudSun size={17} /><small>{32 - (index % 2)}° / 24°</small></span>)}
          </div>
          <button className="client-plan-preview" type="button" onClick={openWorkspace}>
            <NextImage src="/landing/structural-analysis.jpg" alt={text("Project drawing with linked supervision points", "Projecttekening met gekoppelde supervisiepunten")} fill sizes="360px" />
            <i className="pin one"><MapPin size={16} /></i><i className="pin two"><MapPin size={16} /></i><i className="pin three"><MapPin size={16} /></i>
          </button>
          <button className="client-card-link" type="button" onClick={openWorkspace}>{text("View on plan", "Bekijk op plattegrond")} <ChevronRight size={13} /></button>
        </article>
      </div>
      <p className="client-dashboard-context">{projectName} · {buildingName}</p>
    </section>
  );
}
