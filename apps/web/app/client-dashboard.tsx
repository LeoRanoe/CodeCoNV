"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  HardHat,
  LayoutDashboard,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: "teal" | "orange" | "blue" | "violet";
  onClick: () => void;
}) {
  return (
    <button className={`overview-metric ${tone}`} type="button" onClick={onClick}>
      <span className="overview-metric-icon">{icon}</span>
      <span className="overview-metric-copy">
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </span>
      <ArrowRight size={15} />
    </button>
  );
}

function EntryIcon({ kind, alert }: { kind: string; alert?: boolean }) {
  if (alert) return <AlertTriangle size={16} />;
  if (kind === "inspection") return <ClipboardCheck size={16} />;
  if (kind === "photo") return <Camera size={16} />;
  if (kind === "finding") return <AlertTriangle size={16} />;
  if (kind === "action") return <FileCheck2 size={16} />;
  return <Wrench size={16} />;
}

export function ClientDashboard({
  entries,
  actions,
  projectName,
  projectLocation,
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
  projectLocation: string;
  buildingName: string;
  weather: DashboardWeather;
  openQuickAdd: () => void;
  openActions: () => void;
  openWorkspace: () => void;
  openDailyQuestions: () => void;
}) {
  const { locale, text } = useLanguage();
  const [search, setSearch] = useState("");
  const [liveWeather, setLiveWeather] = useState<null | {
    temperatureC: number;
    apparentTemperatureC: number;
    relativeHumidityPercent: number;
    precipitationMm: number;
    windSpeedKph: number;
    observedAt: string;
    resolvedLocation: string;
    source: string;
  }>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const loadLiveWeather = async () => {
    setWeatherLoading(true);
    setWeatherError("");
    try {
      const response = await fetch(`/api/weather/current?location=${encodeURIComponent(projectLocation)}`, { headers: { accept: "application/json" } });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(payload.error ?? "Weather unavailable"));
      setLiveWeather(payload as typeof liveWeather);
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : text("Weather unavailable", "Weer niet beschikbaar"));
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    const initial = window.setTimeout(() => void loadLiveWeather(), 0);
    const timer = window.setInterval(() => void loadLiveWeather(), 10 * 60 * 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectLocation]);
  const openItems = actions.filter((action) => !["verified", "cancelled"].includes(action.status));
  const completedItems = actions.filter((action) => ["verified", "cancelled"].includes(action.status));
  const urgentItems = openItems.filter((action) => ["high", "critical"].includes(action.priority));
  const inspections = entries.filter((entry) => entry.kind === "inspection");
  const issues = entries.filter((entry) => entry.kind === "finding" || entry.badgeTone === "red");
  const photoEntries = entries.filter((entry) => entry.kind === "photo");
  const workEntries = entries.filter((entry) => entry.kind === "activity");
  const completion = actions.length ? Math.round((completedItems.length / actions.length) * 100) : 0;

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale);
    const source = workEntries.length ? workEntries : entries;
    if (!term) return source.slice(0, 5);
    return source.filter((entry) =>
      `${entry.title} ${entry.detail} ${entry.location} ${entry.person}`.toLocaleLowerCase(locale).includes(term),
    ).slice(0, 5);
  }, [entries, locale, search, workEntries]);

  const activityEntries = entries.slice(0, 6);
  const evidenceEntries = photoEntries.slice(0, 4);
  const weatherLabel = weather
    ? ({
      sunny: text("Clear", "Helder"),
      partly_cloudy: text("Partly cloudy", "Licht bewolkt"),
      cloudy: text("Cloudy", "Bewolkt"),
      rain: text("Rain", "Regen"),
      heavy_rain: text("Heavy rain", "Zware regen"),
    } as Record<string, string>)[weather.weatherCondition] ?? text("Recorded", "Vastgelegd")
    : text("Not confirmed", "Niet bevestigd");

  return (
    <section className="project-overview" aria-label={text("Project command center", "Projectcommandocentrum")}>
      <header className="overview-hero">
        <div>
          <span className="overview-kicker"><LayoutDashboard size={15} /> {text("Live project control", "Actuele projectsturing")}</span>
          <h1>{projectName}</h1>
          <p>{buildingName} · {text("One operational view for today’s work, risks and evidence.", "Eén operationeel overzicht voor het werk, de risico’s en het bewijs van vandaag.")}</p>
        </div>
        <div className="overview-hero-actions">
          <label className="overview-search">
            <Search size={16} />
            <span className="sr-only">{text("Search recent project records", "Doorzoek recente projectregistraties")}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Search today", "Zoek in vandaag")} />
          </label>
          <button className="overview-icon-button" type="button" aria-label={text("Notifications", "Meldingen")} onClick={openActions}><Bell size={17} />{urgentItems.length ? <i /> : null}</button>
          <button className="overview-icon-button" type="button" aria-label={text("Daily questions", "Dagvragen")} onClick={openDailyQuestions}><CalendarDays size={17} /></button>
          <button className="primary-button overview-create-button" type="button" onClick={openQuickAdd}><Plus size={16} /> {text("New field record", "Nieuwe veldregistratie")}</button>
        </div>
      </header>

      <div className="overview-metrics">
        <MetricCard icon={<FileCheck2 size={21} />} label={text("Open follow-up", "Open opvolging")} value={openItems.length} detail={`${urgentItems.length} ${text("high priority", "hoge prioriteit")}`} tone="teal" onClick={openActions} />
        <MetricCard icon={<AlertTriangle size={21} />} label={text("Quality issues", "Kwaliteitspunten")} value={issues.length} detail={text("Findings and NCRs", "Bevindingen en NCR's")} tone="orange" onClick={openActions} />
        <MetricCard icon={<ClipboardCheck size={21} />} label={text("Inspections", "Inspecties")} value={inspections.length} detail={text("Recorded in this report", "In dit rapport vastgelegd")} tone="blue" onClick={openWorkspace} />
        <MetricCard icon={<Camera size={21} />} label={text("Evidence", "Bewijs")} value={photoEntries.length} detail={text("Photos linked to context", "Foto's met projectcontext")} tone="violet" onClick={openQuickAdd} />
      </div>

      <div className="overview-primary-grid">
        <article className="overview-panel overview-work-panel">
          <header className="overview-panel-heading">
            <div><span>{text("Today on site", "Vandaag op locatie")}</span><h2>{text("Latest recorded work", "Laatst vastgelegde werkzaamheden")}</h2></div>
            <button type="button" onClick={openWorkspace}>{text("Open workspace", "Open werkruimte")} <ArrowRight size={14} /></button>
          </header>
          <div className="overview-work-list">
            {visibleEntries.length ? visibleEntries.map((entry, index) => (
              <button type="button" key={entry.id} onClick={openWorkspace}>
                <span className="overview-work-index">{String(index + 1).padStart(2, "0")}</span>
                <span><strong>{entry.title}</strong><small>{entry.detail || text("No additional note", "Geen aanvullende notitie")}</small></span>
                <span className="overview-work-location"><MapPin size={13} /> {entry.location || buildingName}</span>
                <time>{entry.time}</time>
              </button>
            )) : (
              <div className="overview-purposeful-empty">
                <span><HardHat size={24} /></span>
                <div><strong>{text("No work recorded for this view", "Geen werkzaamheden in deze weergave")}</strong><p>{text("Start with a field record; the overview will build itself from verified project data.", "Start met een veldregistratie; het overzicht vult zich daarna met gecontroleerde projectdata.")}</p></div>
                <button className="secondary-button" type="button" onClick={openQuickAdd}><Plus size={15} /> {text("Record work", "Werk vastleggen")}</button>
              </div>
            )}
          </div>
        </article>

        <article className="overview-panel overview-priority-panel">
          <header className="overview-panel-heading">
            <div><span>{text("Attention", "Aandacht")}</span><h2>{text("Priority queue", "Prioriteitenlijst")}</h2></div>
            <span className={`overview-health ${urgentItems.length ? "attention" : "stable"}`}>{urgentItems.length ? text("Action needed", "Actie nodig") : text("Under control", "Onder controle")}</span>
          </header>
          <div className="overview-progress">
            <div><span>{text("Action completion", "Actievoortgang")}</span><strong>{completion}%</strong></div>
            <span><i style={{ width: `${completion}%` }} /></span>
            <small>{completedItems.length} {text("completed", "afgerond")} · {openItems.length} open</small>
          </div>
          <div className="overview-priority-list">
            {(urgentItems.length ? urgentItems : openItems).slice(0, 4).map((action) => (
              <button type="button" onClick={openActions} key={action.id}>
                <span className={`priority-dot ${action.priority}`} />
                <span><strong>{action.title}</strong><small>{action.priority} · {action.status.replaceAll("_", " ")}</small></span>
                <ArrowRight size={14} />
              </button>
            ))}
            {!openItems.length ? <div className="overview-clear-state"><CheckCircle2 size={22} /><span><strong>{text("No open actions", "Geen open acties")}</strong><small>{text("New assigned work will appear here.", "Nieuw toegewezen werk verschijnt hier.")}</small></span></div> : null}
          </div>
          <button className="overview-text-link" type="button" onClick={openActions}>{text("View the complete action center", "Bekijk het volledige actiecentrum")} <ArrowRight size={14} /></button>
        </article>
      </div>

      <div className="overview-secondary-grid">
        <article className="overview-panel overview-activity-panel">
          <header className="overview-panel-heading">
            <div><span>{text("Traceability", "Traceerbaarheid")}</span><h2>{text("Recent activity", "Recente activiteit")}</h2></div>
          </header>
          <div className="overview-activity-list">
            {activityEntries.length ? activityEntries.map((entry) => (
              <button type="button" onClick={entry.kind === "photo" ? openQuickAdd : openActions} key={entry.id}>
                <i className={entry.badgeTone === "red" ? "alert" : entry.kind}><EntryIcon kind={entry.kind} alert={entry.badgeTone === "red"} /></i>
                <span><strong>{entry.title}</strong><small>{entry.person} · {entry.location || buildingName}</small></span>
                <time>{entry.time}</time>
              </button>
            )) : <p className="overview-inline-empty">{text("Activity appears after the first project record.", "Activiteit verschijnt na de eerste projectregistratie.")}</p>}
          </div>
        </article>

        <article className="overview-panel overview-evidence-panel">
          <header className="overview-panel-heading">
            <div><span>{text("Visual evidence", "Visueel bewijs")}</span><h2>{text("Latest photo records", "Laatste fotoregistraties")}</h2></div>
            <button type="button" onClick={openQuickAdd}><Camera size={14} /> {text("Add", "Toevoegen")}</button>
          </header>
          <div className="overview-evidence-grid">
            {evidenceEntries.length ? evidenceEntries.map((entry, index) => (
              <button type="button" onClick={openQuickAdd} key={entry.id}>
                <span className={`evidence-placeholder tone-${(index % 4) + 1}`}><Camera size={20} /><i>{String(index + 1).padStart(2, "0")}</i></span>
                <span><strong>{entry.title}</strong><small>{entry.location || buildingName} · {entry.time}</small></span>
              </button>
            )) : [0, 1, 2, 3].map((index) => (
              <button className="empty" type="button" onClick={openQuickAdd} key={index}>
                <span className={`evidence-placeholder tone-${index + 1}`}><Camera size={20} /><i>+</i></span>
                <span><strong>{text("Photo position available", "Fotopositie beschikbaar")}</strong><small>{text("Add verified site evidence", "Voeg gecontroleerd bouwplaatsbewijs toe")}</small></span>
              </button>
            ))}
          </div>
        </article>

        <article className="overview-panel overview-site-panel">
          <header className="overview-panel-heading">
            <div><span>{text("Live weather register", "Actueel weerregister")}</span><h2>{text("Conditions & location", "Condities & locatie")}</h2></div>
            <button className="overview-weather-icon" type="button" onClick={() => void loadLiveWeather()} disabled={weatherLoading} aria-label={text("Refresh live weather", "Ververs actueel weer")}><RefreshCw className={weatherLoading ? "spin" : ""} size={18} /></button>
          </header>
          <div className="overview-weather">
            <span><strong>{liveWeather ? `${liveWeather.temperatureC}°C` : weather ? `${weather.temperatureC}°C` : "—"}</strong><small>{liveWeather ? liveWeather.resolvedLocation : weatherLabel}</small></span>
            <span className="overview-weather-status"><ShieldCheck size={14} /> {liveWeather ? text(`Live · ${liveWeather.source}`, `Actueel · ${liveWeather.source}`) : weather ? text("Recorded start check", "Vastgelegde startcontrole") : text("Confirm at project start", "Bevestig bij projectstart")}</span>
          </div>
          {liveWeather ? <div className="overview-weather-register">
            <span><small>{text("Feels like", "Gevoelstemperatuur")}</small><strong>{liveWeather.apparentTemperatureC}°C</strong></span>
            <span><small>{text("Humidity", "Luchtvochtigheid")}</small><strong>{liveWeather.relativeHumidityPercent}%</strong></span>
            <span><small>{text("Wind", "Wind")}</small><strong>{liveWeather.windSpeedKph} km/h</strong></span>
            <span><small>{text("Rain", "Regen")}</small><strong>{liveWeather.precipitationMm} mm</strong></span>
          </div> : weatherError ? <p className="overview-weather-error">{weatherError}</p> : null}
          <button className="overview-plan-placeholder" type="button" onClick={openWorkspace}>
            <span className="plan-grid-lines" />
            <span className="plan-mass mass-one" />
            <span className="plan-mass mass-two" />
            <span className="plan-mass mass-three" />
            <i className="plan-pin pin-one"><MapPin size={14} /></i>
            <i className="plan-pin pin-two"><MapPin size={14} /></i>
            <span className="plan-caption"><Sparkles size={13} /> {text("Open linked project drawing", "Open gekoppelde projecttekening")}</span>
          </button>
          <div className="overview-site-meta"><span><TimerReset size={14} /> {text("Current report context", "Actuele rapportcontext")}</span><strong>{buildingName}</strong></div>
        </article>
      </div>
    </section>
  );
}
