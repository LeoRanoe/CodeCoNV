"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  HardHat,
  Hash,
  Lightbulb,
  MessageSquareText,
  PackageCheck,
  Search,
  ShieldAlert,
  ShieldCheck,
  TimerOff,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { filterRecordDirectory } from "@/lib/records/record-directory.mjs";
import type { BuildingOption } from "@/app/building-picker";

type WorkspaceDestination = "inspections" | "findings" | "ncr" | "hse" | "daily" | "documents" | "registers" | "visual" | "drawings" | "tools" | "files" | "assets";

/** One record in the project, as the code search knows it. */
export type WorkspaceRecord = {
  id: string;
  kind: string;
  tab: string;
  code: string;
  title: string;
  subtitle: string;
  buildingIds: string[];
  date: string;
  status: string;
  author: string;
};

type ProjectWorkspaceHomeProps = {
  counts: {
    inspections: number;
    issues: number;
    ncr: number;
    hse: number;
    photos: number;
    deliveries: number;
    agreements: number;
    deadlines: number;
  };
  modules: Record<string, boolean>;
  /** Everything in this project that carries a unique code, for the search box. */
  records: WorkspaceRecord[];
  buildings: BuildingOption[];
  openRecord: (tab: string, recordId: string, kind: string) => void;
  openPhotoLibrary: () => void;
  openTask: (destination: WorkspaceDestination, create?: boolean, preset?: { registerType?: string; hseEventType?: string }) => void;
  /** The workforce register itself: organisation, crew, discipline, headcount, visitors. */
  openWorkforce: () => void;
  openFinding: (scope: "issue" | "ncr", create?: boolean) => void;
  openDailyWork: (view: "works_ongoing" | "works_completed" | "delays") => void;
  openActionCenter: (view?: "work" | "deadlines") => void;
  openRapidVerify: () => void;
  openReports: () => void;
  openManagement: () => void;
};

type WorkspaceTile = {
  id: string;
  label: string;
  copy: string;
  icon: LucideIcon;
  tone: "orange" | "blue" | "teal" | "green" | "purple" | "slate";
  count?: number;
  module?: string;
  action: () => void;
};

export function ProjectWorkspaceHome({
  counts,
  modules,
  records,
  buildings,
  openRecord,
  openPhotoLibrary,
  openTask,
  openWorkforce,
  openFinding,
  openDailyWork,
  openActionCenter,
  openRapidVerify,
  openReports,
  openManagement,
}: ProjectWorkspaceHomeProps) {
  const { locale, text } = useLanguage();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ kind: "", buildingId: "", status: "", dateFrom: "", dateTo: "", author: "" });
  /* Open where there is room for them, folded away on a phone. Read once, at mount. */
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 761px)").matches);
  const moduleEnabled = (module?: string) => !module || modules[module] !== false;

  const tiles = useMemo<WorkspaceTile[]>(() => [
    {
      id: "photos",
      // The camera used to open on this tap, before anybody had said what the photo was
      // for. It opens the photo library instead: the photos that are already there, with
      // taking one, uploading one and a 360° upload as the choices on top of them.
      label: text("Photos", "Foto's"),
      copy: text("Library, camera, upload and 360°", "Bibliotheek, camera, upload en 360°"),
      icon: Camera,
      tone: "blue",
      count: counts.photos,
      module: "visual_evidence",
      action: openPhotoLibrary,
    },
    {
      id: "works-ongoing",
      label: text("Works ongoing", "Werkzaamheden gaande"),
      copy: text("Work in progress visible to the owner", "Lopend werk zichtbaar voor de eigenaar"),
      icon: HardHat,
      tone: "orange",
      action: () => openDailyWork("works_ongoing"),
    },
    {
      id: "works-completed",
      label: text("Works completed", "Werkzaamheden afgerond"),
      copy: text("Completed work with date and context", "Afgerond werk met datum en context"),
      icon: CheckCircle2,
      tone: "green",
      action: () => openDailyWork("works_completed"),
    },
    {
      id: "workforce",
      label: text("Workforce", "Workforce"),
      copy: text("Attendance by contractor and trade", "Bezetting per aannemer en vakdiscipline"),
      icon: Users,
      tone: "teal",
      // §4.3 of the product plan: the workforce register, not the day's work list.
      action: openWorkforce,
    },
    {
      id: "delays",
      label: text("Delays", "Vertragingen"),
      copy: text("Cause, time lost and schedule effect", "Oorzaak, tijdverlies en planningimpact"),
      icon: TimerOff,
      tone: "orange",
      action: () => openDailyWork("delays"),
    },
    {
      id: "issues",
      label: text("Issues", "Issues"),
      copy: text("Coordination issues, risks and follow-up", "Coördinatiepunten, risico's en opvolging"),
      icon: AlertTriangle,
      tone: "orange",
      count: counts.issues,
      module: "quality",
      action: () => openFinding("issue", false),
    },
    {
      id: "hse",
      label: "HSE",
      copy: text("Safety observations and controls", "Veiligheidsobservaties en maatregelen"),
      icon: ShieldCheck,
      tone: "green",
      count: counts.hse,
      module: "hse",
      action: () => openTask("hse", false),
    },
    {
      id: "materials-delivery",
      label: text("Materials delivery", "Materiaallevering"),
      copy: text("Quantity, condition and certificates", "Hoeveelheid, staat en certificaten"),
      icon: PackageCheck,
      tone: "teal",
      count: counts.deliveries,
      action: () => openTask("registers", false, { registerType: "delivery" }),
    },
    {
      id: "inspections",
      label: text("Inspections", "Inspecties"),
      copy: text("Checklist, result and supporting evidence", "Checklist, resultaat en onderbouwend bewijs"),
      icon: ClipboardCheck,
      tone: "purple",
      count: counts.inspections,
      module: "inspections",
      action: () => openTask("inspections", false),
    },
    {
      id: "technical-instructions",
      label: text("Technical instructions", "Technische instructies"),
      copy: text("Controlled instruction with deadline", "Beheerde instructie met deadline"),
      icon: Wrench,
      tone: "blue",
      action: () => openTask("registers", false, { registerType: "technical_instruction" }),
    },
    {
      id: "change-order",
      label: text("Change order · CO", "Wijzigingsopdracht · CO"),
      copy: text("Controlled scope, cost and schedule change", "Beheerde scope-, kosten- en planningswijziging"),
      icon: FileCheck2,
      tone: "purple",
      action: () => openTask("registers", false, { registerType: "change_order" }),
    },
    {
      id: "ncr",
      label: "NCR",
      copy: text("Formal non-conformance and close-out", "Formele afwijking met correctie en afsluiting"),
      icon: ShieldAlert,
      tone: "orange",
      count: counts.ncr,
      module: "quality",
      action: () => openFinding("ncr", false),
    },
    {
      id: "deadlines",
      label: text("Deadlines", "Deadlines"),
      copy: text("Due actions, overdue items and escalations", "Open acties, achterstanden en escalaties"),
      icon: CalendarClock,
      tone: "slate",
      count: counts.deadlines,
      // The same action centre, opened on its deadline view.
      action: () => openActionCenter("deadlines"),
    },
    {
      id: "hse-incident",
      label: text("HSE incident", "HSE-incident"),
      copy: text("Incident, near miss or stop-work record", "Incident, near miss of werkstop registreren"),
      icon: ShieldAlert,
      tone: "orange",
      module: "hse",
      action: () => openTask("hse", false, { hseEventType: "incident" }),
    },
    {
      id: "agreements-made",
      label: text("Agreements made", "Gemaakte afspraken"),
      copy: text("Decision, owner, deadline and audit trail", "Besluit, eigenaar, deadline en historie"),
      icon: MessageSquareText,
      tone: "blue",
      count: counts.agreements,
      action: () => openTask("registers", false, { registerType: "agreement" }),
    },
    {
      id: "lessons-learned",
      label: text("Lessons learned", "Geleerde lessen"),
      copy: text("Capture, learn and improve", "Vastleggen, leren en verbeteren"),
      icon: Lightbulb,
      tone: "purple",
      action: () => openTask("registers", false, { registerType: "lessons_learned" }),
    },
  ], [counts, openActionCenter, openDailyWork, openFinding, openPhotoLibrary, openTask, openWorkforce, text]);

  const visibleTiles = tiles.filter((tile) => {
    if (!moduleEnabled(tile.module)) return false;
    const term = query.trim().toLocaleLowerCase(locale);
    return !term || `${tile.label} ${tile.copy}`.toLocaleLowerCase(locale).includes(term);
  });

  /**
   * The same box that filters the modules also looks up a record by the unique code that
   * stands on the document: type Q-2026-0004, NCR - 51 or PHO-2026-0031 and the record
   * itself is one tap away, instead of hunting through the module it happens to live in.
   */
  const matches = useMemo(() => filterRecordDirectory(records, query, {
    kind: filters.kind,
    buildingIds: filters.buildingId ? [filters.buildingId] : [],
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    author: filters.author,
  }, { buildings }, 50) as WorkspaceRecord[], [buildings, filters, query, records]);
  const filtersActive = Object.values(filters).some(Boolean);
  const authors = useMemo(() => Array.from(new Set(records.map((record) => record.author).filter(Boolean))).sort(), [records]);
  const groupedMatches = useMemo(() => Array.from(matches.reduce((groups, record) => {
    const group = groups.get(record.kind) ?? [];
    group.push(record);
    groups.set(record.kind, group);
    return groups;
  }, new Map<string, WorkspaceRecord[]>()).entries()), [matches]);
  const kindLabels: Record<string, string> = {
    ncr: "NCR",
    finding: text("Issue", "Issue"),
    inspection: text("Inspection", "Inspectie"),
    hse: "HSE",
    register: text("Register document", "Registerdocument"),
    report: text("Day report", "Dagrapport"),
    photo: text("Photo", "Foto"),
    drawing: text("Drawing", "Tekening"),
    file: text("File", "Bestand"),
    folder: text("Folder", "Map"),
    building: text("Building", "Gebouw"),
    daily_work: text("Daily work", "Dagwerk"),
    delay: text("Delay", "Vertraging"),
  };

  return (
    <section className="workspace-launcher" aria-labelledby="workspace-launcher-title">
      <div className="workspace-launcher-toolbar">
        <div>
          <span>{text("Project workspace", "Projectwerkruimte")}</span>
          <h2 id="workspace-launcher-title">{text("Field records and project control", "Veldregistratie en projectsturing")}</h2>
          <p>{text("The workspace follows the client's reporting structure. Formal contractor submissions are handled under Management.", "De werkruimte volgt de rapportstructuur van de klant. Formele aannemersindieningen worden onder Management afgehandeld.")}</p>
        </div>
        <label className="workspace-launcher-search">
          <Search size={16} />
          <span className="sr-only">{text("Search workspace", "Doorzoek werkruimte")}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("Search a code, number or module", "Zoek een code, nummer of module")} />
        </label>
      </div>

      {/* Six filters stacked full width filled a phone screen before anything was found.
          They fold away behind their own summary there, and stand open on a desktop. */}
      <details className="workspace-search-filters-block" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
        <summary>
          <Filter size={15} /> {text("Filters", "Filters")}
          {filtersActive ? <b>{Object.values(filters).filter(Boolean).length}</b> : null}
        </summary>
      <div className="workspace-search-filters" aria-label={text("Search filters", "Zoekfilters")}>
        <label><span>{text("Kind", "Soort")}</span><select value={filters.kind} onChange={(event) => setFilters({ ...filters, kind: event.target.value })}><option value="">{text("All kinds", "Alle soorten")}</option>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>{text("Building", "Gebouw")}</span><select value={filters.buildingId} onChange={(event) => setFilters({ ...filters, buildingId: event.target.value })}><option value="">{text("All buildings", "Alle gebouwen")}</option>{buildings.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}</select></label>
        <label><span>{text("Status", "Status")}</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">{text("All statuses", "Alle statussen")}</option><option value="open">Open</option><option value="closed">{text("Closed", "Gesloten")}</option><option value="completed">{text("Completed", "Afgerond")}</option><option value="urgent">Urgent</option></select></label>
        <label><span>{text("From", "Vanaf")}</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
        <label><span>{text("To", "Tot")}</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
        <label><span>{text("Author", "Auteur")}</span><select value={filters.author} onChange={(event) => setFilters({ ...filters, author: event.target.value })}><option value="">{text("All authors", "Alle auteurs")}</option>{authors.map((author) => <option value={author} key={author}>{author}</option>)}</select></label>
        {filtersActive ? <button className="ghost-button" type="button" onClick={() => setFilters({ kind: "", buildingId: "", status: "", dateFrom: "", dateTo: "", author: "" })}>{text("Clear filters", "Wis filters")}</button> : null}
      </div>
      </details>

      {query.trim().length >= 2 || filtersActive ? (
        <div className="workspace-code-results" aria-label={text("Records found by code", "Gevonden registraties op code")}>
          <header><Hash size={15} /> <strong>{matches.length
            ? text(`${matches.length} record${matches.length === 1 ? "" : "s"} with this code`, `${matches.length} registratie${matches.length === 1 ? "" : "s"} met deze code`)
            : text("No record with this code", "Geen registratie met deze code")}</strong></header>
          {groupedMatches.map(([kind, group]) => <section className="workspace-code-group" key={kind}>
            <h3>{kindLabels[kind] ?? kind} <span>{group.length}</span></h3>
          {group.map((record) => (
            <button type="button" onClick={() => openRecord(record.tab, record.id, record.kind)} key={`${record.kind}:${record.id}`}>
              <span className="workspace-code-chip">{record.code || text("no code yet", "nog geen code")}</span>
              <span><strong>{record.title}</strong><small>{kindLabels[record.kind] ?? record.kind}{record.subtitle ? ` · ${record.subtitle.replaceAll("_", " ")}` : ""}</small></span>
              <ArrowRight size={15} />
            </button>
          ))}</section>)}
        </div>
      ) : null}

      <div className="workspace-launcher-grid client-workspace-grid">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button className={`workspace-launcher-tile tone-${tile.tone}`} type="button" onClick={tile.action} data-workspace-destination={tile.id} key={tile.id}>
              <span className="workspace-launcher-icon"><Icon size={23} /></span>
              {typeof tile.count === "number" ? <span className="workspace-launcher-count">{tile.count}</span> : null}
              <strong>{tile.label}</strong>
              <small>{tile.copy}</small>
              <ArrowRight className="workspace-launcher-arrow" size={15} />
            </button>
          );
        })}
      </div>

      {!visibleTiles.length && !matches.length ? <div className="workspace-launcher-empty"><Search size={22} /><div><strong>{text("No workspace item found", "Geen werkruimte-item gevonden")}</strong><p>{text("Try another term.", "Probeer een andere zoekterm.")}</p></div><button className="secondary-button" type="button" onClick={() => setQuery("")}>{text("Clear", "Wissen")}</button></div> : null}

      <div className="workspace-support-strip" aria-label={text("Supporting project tools", "Ondersteunende projecttools")}>
        <span><Clock3 size={15} /> {text("Supporting tools", "Ondersteunende tools")}</span>
        <button type="button" onClick={openRapidVerify}><BookOpenCheck size={15} /> Rapid Verify</button>
        <button type="button" onClick={() => openTask("documents", false)}><FileText size={15} /> Project Docs</button>
        <button type="button" onClick={() => openTask("assets", false)}><FolderOpen size={15} /> {text("Assets & folders", "Middelen & mappen")}</button>
        <button type="button" onClick={() => openTask("drawings", false)}><AlertTriangle size={15} /> {text("Drawings & pins", "Tekeningen & pins")}</button>
        <button type="button" onClick={openReports}><FileText size={15} /> {text("Reports", "Rapporten")}</button>
        <button type="button" onClick={openManagement}><Users size={15} /> {text("Submissions & management", "Indieningen & management")}</button>
      </div>
    </section>
  );
}
