"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  CloudSun,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  ShieldCheck,
  TimerReset,
  Wrench,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { useLanguage } from "@/lib/i18n";
import { isOpenItem } from "@/lib/actions/action-center.mjs";
import { isWorklistRegister, summarizeOpenWork, workItemFromAction, workItemFromFinding, workItemFromRegister } from "@/lib/actions/open-work.mjs";
import { getCachedProjectSnapshot, cacheProjectSnapshot } from "@/lib/offline/project-cache";
import { loadProjectFileObjectUrl } from "@/lib/storage/gateway";
import type { ProjectRecentPhoto } from "@/lib/supabase/data";
import { loadProjectOperations } from "@/lib/supabase/operations";
import { pageAll } from "@/lib/supabase/page-all.mjs";
import { useLiveProjectWeather } from "@/lib/weather-client";
import { statusText, typeText, priorityText } from "@/lib/status-labels";

/** One dashboard thumbnail, fetched through the private storage gateway like everywhere else. */
function EvidenceThumbnail({ client, fileId, alt }: { client: SupabaseClient | null; fileId: string; alt: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!client) return;
    let active = true;
    let objectUrl = "";
    void loadProjectFileObjectUrl(client, fileId).then((url) => {
      objectUrl = url;
      if (active) setSource(url);
      else URL.revokeObjectURL(url);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, fileId]);
  // A private object URL cannot pass through the Next image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return source ? <img src={source} alt={alt} loading="lazy" /> : <Camera size={20} />;
}

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
  due_at?: string | null;
};

type DashboardWeather = {
  temperatureC: number;
  weatherCondition: string;
} | null;

/** The workspace modules a search result can send the user to. */
export type SearchDestination = "files" | "assets" | "documents" | "drawings" | "findings" | "ncr" | "inspections" | "hse" | "registers";

type SearchHit = {
  key: string;
  title: string;
  detail: string;
  open: () => void;
};

type SearchGroup = {
  id: string;
  label: string;
  icon: React.ReactNode;
  hits: SearchHit[];
};

/** Below this the term matches half the project and the answer is noise. */
const minimumSearchLength = 2;
/** Enough to find the record without turning the overview into a scrolling list. */
const hitsPerGroup = 6;

function matches(term: string, ...fields: Array<string | null | undefined>) {
  return fields.some((field) => String(field ?? "").toLowerCase().includes(term));
}

/** The day a found record carries, in the reader's own language and the project's timezone. */
function formatDay(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "America/Paramaribo" }).format(day);
}

/** What the search found, grouped by the kind of thing it is. */
function SearchResults({
  groups,
  hitCount,
  term,
  loading,
  failed,
  clear,
}: {
  groups: SearchGroup[];
  hitCount: number;
  term: string;
  loading: boolean;
  failed: boolean;
  clear: () => void;
}) {
  const { text } = useLanguage();
  return (
    <article className="overview-panel overview-search-panel">
      <header className="overview-panel-heading">
        <div>
          <span>{text("Search", "Zoeken")}</span>
          <h2>
            {loading && !hitCount
              ? text("Searching the project…", "Het project wordt doorzocht…")
              : text(`${hitCount} result(s) for “${term}”`, `${hitCount} resultaat(en) voor “${term}”`)}
          </h2>
        </div>
        <button type="button" onClick={clear}><X size={14} /> {text("Clear", "Wissen")}</button>
      </header>

      {/* The day's own records answer at once; the rest of the project follows when the
          snapshot lands, so the panel is never empty while it is still working. */}
      {loading ? (
        <p className="overview-inline-empty" role="status"><Loader2 className="spin" size={14} /> {text("Also searching files, documents and photos…", "Ook bestanden, documenten en foto’s doorzoeken…")}</p>
      ) : null}

      {failed && !hitCount ? (
        <p className="overview-inline-empty">{text("The project could not be searched. Check the connection and try again.", "Het project kon niet worden doorzocht. Controleer de verbinding en probeer opnieuw.")}</p>
      ) : null}

      <div className="overview-search-groups">
        {groups.map((group) => (
          <section className="overview-search-group" key={group.id}>
            <h3><span className="overview-search-group-icon">{group.icon}</span> {group.label} <b>{group.hits.length}</b></h3>
            <div className="overview-search-list">
              {group.hits.map((hit) => (
                <button type="button" onClick={hit.open} key={hit.key}>
                  <span><strong>{hit.title}</strong><small>{hit.detail}</small></span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {!loading && !failed && !hitCount ? (
        <p className="overview-inline-empty">{text("Nothing in this project matches that.", "Niets in dit project komt hiermee overeen.")}</p>
      ) : null}
    </article>
  );
}

function MetricCard({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  /** null while the project's own count is still on its way: a dash, never a false zero. */
  value: number | null;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className="overview-metric ui-stat" type="button" onClick={onClick}>
      <strong className="ui-stat__value">{value ?? "–"}</strong>
      <span className="ui-stat__label">{label}</span>
      <small>{detail}</small>
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
  recentPhotos,
  client,
  projectName,
  projectLocation,
  buildingName,
  buildingCount,
  weather,
  organizationId,
  projectId,
  reportId,
  openActions,
  openWorkspace,
  openDailyQuestions,
  openProjectStart,
  openReportCheck,
  dayStarted = true,
  openRecord,
}: {
  entries: DashboardEntry[];
  actions: DashboardAction[];
  /** The project's newest pictures, so the panel shows photos instead of empty slots. */
  recentPhotos: ProjectRecentPhoto[];
  client: SupabaseClient | null;
  projectName: string;
  projectLocation: string;
  buildingName: string;
  buildingCount: number;
  weather: DashboardWeather;
  organizationId: string;
  projectId: string;
  /** The day report this overview stands on, so the search shares the workspace's cache. */
  reportId: string | null;
  openActions: () => void;
  openWorkspace: () => void;
  openDailyQuestions: () => void;
  /** The day start (weather, hours, plan per building), required before the report. */
  openProjectStart?: () => void;
  /** The report check, where the day report is marked ready for review. */
  openReportCheck?: () => void;
  /** Whether today's project start is recorded; until then the start is offered first. */
  dayStarted?: boolean;
  /** Opens one found record in the module it lives in, scrolled to that record. */
  openRecord: (tab: SearchDestination, recordId: string) => void;
}) {
  const { locale, text } = useLanguage();
  // Starting the day, answering its questions and checking the report are the supervisor's; a reader does not get the buttons.
  const canWriteDay = useProjectPermissions().canAny("reports.create", "reports.edit");
  const [search, setSearch] = useState("");
  // Shared with the top bar so both show the same reading from one request.
  const { weather: liveWeather, error: weatherError, loading: weatherLoading, reload: loadLiveWeather } = useLiveProjectWeather(projectLocation);
  const completedItems = actions.filter((action) => ["verified", "cancelled"].includes(action.status));
  // Every number on this screen is the project's, not today's timeline: an issue written on the
  // Issues form never was a daily record, and an inspection from last week is still an inspection.
  // Open work is read the way the action centre reads it (actions, findings/NCRs and the
  // registers with a deadline), so the two screens cannot disagree about what is open.
  const projectCounts = useQuery({
    queryKey: ["project-operations", projectId, "overview-counts"],
    enabled: Boolean(client),
    staleTime: 30_000,
    queryFn: async () => {
      const [findings, registers, inspectionCount, photoCount] = await Promise.all([
        pageAll((from, to) => client!.from("findings").select("id,finding_number,title,status,finding_type,priority,due_at,issue_management").eq("project_id", projectId).order("id").range(from, to)),
        pageAll((from, to) => client!.from("project_register_entries").select("id,entry_number,title,status,register_type,due_at,details").eq("project_id", projectId).order("id").range(from, to)),
        client!.from("inspections").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        client!.from("files").select("id", { count: "exact", head: true }).eq("project_id", projectId).neq("status", "deleted").like("mime_type", "image/%"),
      ]);
      if (findings.error) throw findings.error;
      if (registers.error) throw registers.error;
      if (inspectionCount.error) throw inspectionCount.error;
      if (photoCount.error) throw photoCount.error;
      return {
        findings: findings.data ?? [],
        registers: (registers.data ?? []).filter(isWorklistRegister),
        inspections: inspectionCount.count ?? 0,
        photos: photoCount.count ?? 0,
      };
    },
  });
  const workItems = useMemo(() => [
    ...actions.map(workItemFromAction),
    ...(projectCounts.data?.findings ?? []).map(workItemFromFinding),
    ...(projectCounts.data?.registers ?? []).map(workItemFromRegister),
  ], [actions, projectCounts.data]);
  const openWork = useMemo(() => summarizeOpenWork(workItems), [workItems]);
  const openFindings = (projectCounts.data?.findings ?? []).filter((row) => isOpenItem(row));
  const qualityOpen = openFindings.length;
  const qualityNcr = openFindings.filter((row) => row.finding_type === "ncr").length;
  const inspectionTotal = projectCounts.data?.inspections ?? 0;
  const photoTotal = projectCounts.data?.photos ?? 0;
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

  /**
   * Searching from the overview reaches the whole project, not only the day on the screen:
   * the client asked to find "files, documents and photos and more" from here. The project
   * snapshot that answers it is the one the workspace already loads, under the same query
   * key, so opening a module after a search costs nothing — and the overview itself stays
   * as light as it was, because this only starts once something has actually been typed.
   */
  const term = search.trim().toLocaleLowerCase(locale);
  const searching = term.length >= minimumSearchLength;
  const projectSearch = useQuery({
    queryKey: ["project-operations", projectId, reportId],
    queryFn: async () => {
      if (!client) throw new Error("PROJECT_SEARCH_OFFLINE");
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
    enabled: searching && Boolean(client),
  });

  const searchGroups = useMemo<SearchGroup[]>(() => {
    if (!searching) return [];
    const snapshot = projectSearch.data;
    const groups: SearchGroup[] = [];
    const add = (id: string, label: string, icon: React.ReactNode, hits: SearchHit[]) => {
      if (hits.length) groups.push({ id, label, icon, hits: hits.slice(0, hitsPerGroup) });
    };

    if (snapshot) {
      const files = snapshot.files.filter((file) => file.status !== "deleted" && matches(term, file.original_name, file.document_code, file.category));
      const isPhoto = (mime: string) => mime.startsWith("image/");
      const isDrawing = (file: { mime_type: string; category: string }) => file.category === "drawing" || file.mime_type === "application/pdf";
      add("photos", text("Photos", "Foto's"), <Camera size={15} />, files.filter((file) => isPhoto(file.mime_type)).map((file) => ({
        key: `photo:${file.id}`,
        title: file.original_name,
        detail: [file.document_code, formatDay(file.created_at, locale)].filter(Boolean).join(" · "),
        open: () => openRecord("files", file.id),
      })));
      add("drawings", text("Drawings", "Tekeningen"), <Ruler size={15} />, files.filter((file) => !isPhoto(file.mime_type) && isDrawing(file)).map((file) => ({
        key: `drawing:${file.id}`,
        title: file.original_name,
        detail: [file.document_code, formatDay(file.created_at, locale)].filter(Boolean).join(" · "),
        open: () => openRecord("assets", file.id),
      })));
      add("documents", text("Documents", "Documenten"), <FileText size={15} />, files.filter((file) => !isPhoto(file.mime_type) && !isDrawing(file)).map((file) => ({
        key: `document:${file.id}`,
        title: file.original_name,
        detail: [file.document_code, formatDay(file.created_at, locale)].filter(Boolean).join(" · "),
        open: () => openRecord("assets", file.id),
      })));
      add("findings", text("Issues and NCRs", "Issues en NCR's"), <AlertTriangle size={15} />, snapshot.findings
        .filter((finding) => matches(term, finding.finding_number, finding.title, finding.description))
        .map((finding) => ({
          key: `finding:${finding.id}`,
          title: finding.title,
          detail: [finding.finding_number, statusText(finding.status, text)].filter(Boolean).join(" · "),
          open: () => openRecord(finding.finding_type === "ncr" ? "ncr" : "findings", finding.id),
        })));
      add("inspections", text("Inspections", "Inspecties"), <ClipboardCheck size={15} />, snapshot.inspections
        .filter((inspection) => matches(term, inspection.inspection_number, inspection.title))
        .map((inspection) => ({
          key: `inspection:${inspection.id}`,
          title: inspection.title,
          detail: [inspection.inspection_number, statusText(inspection.status, text)].filter(Boolean).join(" · "),
          open: () => openRecord("inspections", inspection.id),
        })));
      add("hse", "HSE", <ShieldCheck size={15} />, snapshot.hseEvents
        .filter((event) => matches(term, event.event_number, event.title, event.description))
        .map((event) => ({
          key: `hse:${event.id}`,
          title: event.title,
          detail: [event.event_number, formatDay(event.occurred_at, locale)].filter(Boolean).join(" · "),
          open: () => openRecord("hse", event.id),
        })));
      add("registers", text("Registers", "Registers"), <FileCheck2 size={15} />, snapshot.registerEntries
        .filter((entry) => matches(term, entry.entry_number, entry.title, entry.register_type))
        .map((entry) => ({
          key: `register:${entry.id}`,
          title: entry.title,
          detail: [entry.entry_number, typeText(entry.register_type, text)].filter(Boolean).join(" · "),
          open: () => openRecord("registers", entry.id),
        })));
    }

    // These two are already on this screen, so they answer instantly while the project
    // snapshot is still on its way.
    add("actions", text("Actions", "Acties"), <FileCheck2 size={15} />, actions
      .filter((action) => matches(term, action.title))
      .map((action) => ({
        key: `action:${action.id}`,
        title: action.title,
        detail: [statusText(action.status, text), priorityText(action.priority, text)].filter(Boolean).join(" · "),
        open: openActions,
      })));
    add("work", text("Recorded work", "Vastgelegd werk"), <Wrench size={15} />, entries
      .filter((entry) => matches(term, entry.title, entry.detail, entry.location, entry.person))
      .map((entry) => ({
        key: `entry:${entry.id}`,
        title: entry.title,
        detail: [entry.time, entry.location || buildingName].filter(Boolean).join(" · "),
        open: openWorkspace,
      })));

    return groups;
  }, [actions, buildingName, entries, locale, openActions, openRecord, openWorkspace, projectSearch.data, searching, term, text]);

  const searchHitCount = searchGroups.reduce((total, group) => total + group.hits.length, 0);

  const activityEntries = entries.slice(0, 6);
  const evidencePhotos = recentPhotos.slice(0, 4);
  const buildingContextLabel = buildingCount > 1 ? text(`${buildingCount} buildings`, `${buildingCount} gebouwen`) : buildingName;
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
          <h1>{projectName}</h1>
          <p>{buildingContextLabel}</p>
        </div>
        <div className="overview-hero-actions">
          <label className="overview-search">
            <Search size={16} />
            <span className="sr-only">{text("Search recent project records", "Doorzoek recente projectregistraties")}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Search today", "Zoek in vandaag")} />
          </label>
          {/* The day in its order: start it, answer the day's questions, check the report.
              The built-in guide and the report screen both point here. */}
          {canWriteDay && !dayStarted && openProjectStart ? <button className="overview-icon-button" type="button" aria-label={text("Start today", "Werkdag starten")} title={text("Start today", "Werkdag starten")} onClick={openProjectStart}><CloudSun size={17} /></button> : null}
          {canWriteDay ? <button className="overview-icon-button" type="button" aria-label={text("Daily questions", "Dagvragen")} title={text("Daily questions", "Dagvragen")} onClick={openDailyQuestions}><CalendarDays size={17} /></button> : null}
          {canWriteDay && openReportCheck ? <button className="overview-icon-button" type="button" aria-label={text("Check report", "Rapport controleren")} title={text("Check report", "Rapport controleren")} onClick={openReportCheck}><FileCheck2 size={17} /></button> : null}
          {/* This screen reads the day; it does not write it. Recording a photo or a field
              record has its own button in the bar at the bottom, on every screen. */}
          <button className="ui-button ui-button--secondary ui-button--md overview-create-button" type="button" onClick={openWorkspace}>{text("Open workspace", "Open werkruimte")} <ArrowRight size={15} /></button>
        </div>
      </header>

      {searching ? (
        <SearchResults
          groups={searchGroups}
          hitCount={searchHitCount}
          term={search.trim()}
          loading={projectSearch.isLoading}
          failed={projectSearch.isError}
          clear={() => setSearch("")}
        />
      ) : (
        <>

        <div className="overview-metrics">
          <MetricCard label={text("Open follow-up", "Open opvolging")} value={projectCounts.data ? openWork.open : null} detail={`${openWork.urgent} ${text("high priority", "hoge prioriteit")}`} onClick={openActions} />
          <MetricCard label={text("Quality issues", "Kwaliteitspunten")} value={projectCounts.data ? qualityOpen : null} detail={qualityNcr ? `${qualityNcr} NCR` : text("Open", "Open")} onClick={openActions} />
          <MetricCard label={text("Inspections", "Inspecties")} value={projectCounts.data ? inspectionTotal : null} detail={text("In project", "In project")} onClick={openWorkspace} />
          <MetricCard label={text("Pictures", "Foto's")} value={projectCounts.data ? photoTotal : null} detail={text("In project", "In project")} onClick={() => openRecord("files", "")} />
        </div>

        <div className="overview-primary-grid">
          <article className="overview-panel overview-work-panel">
            <header className="overview-panel-heading">
              <div><h2>{text("Latest recorded work", "Laatst vastgelegde werkzaamheden")}</h2></div>
            </header>
            <div className="overview-work-list">
              {visibleEntries.length ? visibleEntries.map((entry, index) => (
                <button type="button" key={entry.id} onClick={openWorkspace}>
                  <span className="overview-work-index">{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{entry.title}</strong><small>{entry.detail || text("No note", "Geen notitie")}</small></span>
                  <span className="overview-work-location"><MapPin size={13} /> {entry.location || buildingName}</span>
                  <time>{entry.time}</time>
                </button>
              )) : (
                <div className="overview-purposeful-empty">
                  <div><strong>{text("No work recorded", "Geen werk vastgelegd")}</strong></div>
                </div>
              )}
            </div>
          </article>

          <article className="overview-panel overview-priority-panel">
            <header className="overview-panel-heading">
              <div><h2>{text("Priority queue", "Prioriteitenlijst")}</h2></div>
              {projectCounts.data ? <span className={`overview-health ${openWork.escalated ? "attention" : "stable"}`}>{openWork.escalated ? text("Action needed", "Actie nodig") : text("Under control", "Onder controle")}</span> : null}
            </header>
            <div className="overview-progress">
              <div><span>{text("Action completion", "Actievoortgang")}</span><strong>{completion}%</strong></div>
              <span><i style={{ width: `${completion}%` }} /></span>
              <small>{completedItems.length} {text("completed", "afgerond")} · {actions.length - completedItems.length} open</small>
            </div>
            <div className="overview-priority-list">
              {openWork.top.map((item) => (
                <button className="ui-list-row" type="button" onClick={openActions} key={`${item.source}:${item.id}`}>
                  <span><strong className="ui-list-row__title">{item.title}</strong><small className="ui-list-row__meta">{[item.reference, statusText(item.status, text)].filter(Boolean).join(" · ")}</small></span>
                  <span className={`ui-status-badge ${item.priority === "critical" ? "ui-status-badge--red" : item.priority === "high" ? "ui-status-badge--amber" : ""}`}>{priorityText(item.priority, text)}</span>
                </button>
              ))}
              {projectCounts.data && !openWork.open ? <div className="overview-clear-state"><CheckCircle2 size={22} /><span><strong>{text("No open actions", "Geen open acties")}</strong></span></div> : null}
            </div>
            <button className="overview-text-link" type="button" onClick={openActions}>{text("All actions", "Alle acties")} <ArrowRight size={14} /></button>
          </article>
        </div>

        <div className="overview-secondary-grid">
          <article className="overview-panel overview-activity-panel">
            <header className="overview-panel-heading">
              <div><h2>{text("Recent activity", "Recente activiteit")}</h2></div>
            </header>
            {/* A line in this list is something that already happened. Tapping it opens the
                record, whatever it is; a photo line used to hand the user to the camera. */}
            <div className="overview-activity-list">
              {activityEntries.length ? activityEntries.map((entry) => (
                <button type="button" onClick={entry.kind === "photo" ? () => openRecord("files", "") : openActions} key={entry.id}>
                  <i className={entry.badgeTone === "red" ? "alert" : entry.kind}><EntryIcon kind={entry.kind} alert={entry.badgeTone === "red"} /></i>
                  <span><strong>{entry.title}</strong><small>{entry.person} · {entry.location || buildingName}</small></span>
                  <time>{entry.time}</time>
                </button>
              )) : <p className="overview-inline-empty">{text("No activity yet.", "Nog geen activiteit.")}</p>}
            </div>
          </article>

          <article className="overview-panel overview-evidence-panel">
            <header className="overview-panel-heading">
              <div><h2>{text("Latest photo records", "Laatste fotoregistraties")}</h2></div>
              <button type="button" onClick={() => openRecord("files", "")}>{text("View all", "Alles bekijken")} <ArrowRight size={14} /></button>
            </header>
            {/* Straight to the photo library, and to this exact picture in it, rather than
                to the workspace home screen the reader would have to navigate out of. */}
            <div className="overview-evidence-grid">
              {evidencePhotos.length ? evidencePhotos.map((photo) => (
                <button type="button" onClick={() => openRecord("files", photo.fileId)} key={photo.id}>
                  <span className="evidence-thumbnail">
                    <EvidenceThumbnail client={client} fileId={photo.fileId} alt={photo.title} />
                  </span>
                  <span><strong>{photo.title}</strong><small>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(new Date(photo.capturedAt))}</small></span>
                </button>
              )) : <button className="ui-button ui-button--quiet ui-button--md overview-evidence-empty" type="button" onClick={() => openRecord("files", "")}>{text("No photos yet · Take photo", "Nog geen foto’s · Maak een foto")}</button>}
            </div>
          </article>

          <article className="overview-panel overview-site-panel">
            <header className="overview-panel-heading">
              <div><h2>{text("Conditions & location", "Condities & locatie")}</h2></div>
              <button className="overview-weather-icon" type="button" onClick={loadLiveWeather} disabled={weatherLoading} aria-label={text("Refresh live weather", "Ververs actueel weer")}><RefreshCw className={weatherLoading ? "spin" : ""} size={18} /></button>
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
            <div className="overview-site-meta"><span><TimerReset size={14} /> {text("Current report context", "Actuele rapportcontext")}</span><strong>{buildingContextLabel}</strong></div>
          </article>
        </div>
        </>
      )}

    </section>
  );
}
