"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Calculator,
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
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { useLanguage } from "@/lib/i18n";
import { filterRecordDirectory } from "@/lib/records/record-directory.mjs";
import type { BuildingOption } from "@/app/building-picker";
import { codeText } from "@/lib/status-labels";

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
    technicalInstructions: number;
    changeOrders: number;
    lessons: number;
    delayReports: number;
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
};

type WorkspaceTile = {
  id: string;
  label: string;
  icon: LucideIcon;
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
}: ProjectWorkspaceHomeProps) {
  const { locale, text } = useLanguage();
  const permissions = useProjectPermissions();
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
      icon: Camera,
      count: counts.photos,
      module: "visual_evidence",
      action: openPhotoLibrary,
    },
    {
      id: "works-ongoing",
      label: text("Works ongoing", "Werkzaamheden gaande"),
      icon: HardHat,
      action: () => openDailyWork("works_ongoing"),
    },
    {
      id: "works-completed",
      label: text("Works completed", "Werkzaamheden afgerond"),
      icon: CheckCircle2,
      action: () => openDailyWork("works_completed"),
    },
    {
      id: "workforce",
      label: text("Workforce", "Workforce"),
      icon: Users,
      // §4.3 of the product plan: the workforce register, not the day's work list.
      action: openWorkforce,
    },
    {
      /* Daily delays remain available in the daily work register. The PDR is the
         separate formal report for schedule changes that need evidence and sign-off. */
      id: "delay-report",
      label: text("Project Delay Report (PDR)", "Vertragingsrapport (PDR)"),
      icon: CalendarClock,
      count: counts.delayReports,
      action: () => openTask("registers", false, { registerType: "delay_report" }),
    },
    {
      id: "issues",
      label: text("Issues", "Issues"),
      icon: AlertTriangle,
      count: counts.issues,
      module: "quality",
      action: () => openFinding("issue", false),
    },
    {
      id: "hse",
      label: "HSE",
      icon: ShieldCheck,
      count: counts.hse,
      module: "hse",
      action: () => openTask("hse", false),
    },
    {
      id: "materials-delivery",
      label: text("Materials delivery", "Materiaallevering"),
      icon: PackageCheck,
      count: counts.deliveries,
      action: () => openTask("registers", false, { registerType: "delivery" }),
    },
    {
      id: "inspections",
      label: text("Inspections", "Inspecties"),
      icon: ClipboardCheck,
      count: counts.inspections,
      module: "inspections",
      action: () => openTask("inspections", false),
    },
    {
      id: "technical-instructions",
      label: text("Technical instructions", "Technische instructies"),
      icon: Wrench,
      count: counts.technicalInstructions,
      action: () => openTask("registers", false, { registerType: "technical_instruction" }),
    },
    {
      id: "change-order",
      label: text("Change order (CO)", "Change order (CO)"),
      icon: FileCheck2,
      count: counts.changeOrders,
      action: () => openTask("registers", false, { registerType: "change_order" }),
    },
    {
      id: "ncr",
      label: "NCR",
      icon: ShieldAlert,
      count: counts.ncr,
      module: "quality",
      action: () => openFinding("ncr", false),
    },
    {
      /* The client struck Deadlines off this grid and wrote Lessons Learned over it:
         a deadline is not a thing you record here, it is a state the action centre
         already keeps. It moved to the supporting tools, below the grid. */
      id: "lessons-learned",
      label: text("Lessons Learned (LL)", "Geleerde lessen (LL)"),
      icon: Lightbulb,
      count: counts.lessons,
      action: () => openTask("registers", false, { registerType: "lessons_learned" }),
    },
    {
      id: "hse-incident",
      label: text("HSE incident", "HSE-incident"),
      icon: ShieldAlert,
      module: "hse",
      action: () => openTask("hse", false, { hseEventType: "incident" }),
    },
    {
      id: "agreements-made",
      label: text("Agreements Made", "Gemaakte afspraken"),
      icon: MessageSquareText,
      count: counts.agreements,
      action: () => openTask("registers", false, { registerType: "agreement" }),
    },
  ], [counts, openDailyWork, openFinding, openPhotoLibrary, openTask, openWorkforce, text]);

  // A tile opens a module the user must be able to read; otherwise it is an empty page.
  const readPermission: Record<string, string> = {
    photos: "files.read",
    workforce: "attendance.read",
    issues: "findings.read",
    ncr: "findings.read",
    hse: "hse.read",
    "hse-incident": "hse.read",
    inspections: "inspections.read",
  };
  const visibleTiles = tiles.filter((tile) => {
    if (!moduleEnabled(tile.module)) return false;
    if (!permissions.can(readPermission[tile.id] ?? "records.read")) return false;
    const term = query.trim().toLocaleLowerCase(locale);
    return !term || tile.label.toLocaleLowerCase(locale).includes(term);
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
      <div className="workspace-launcher-toolbar ui-page-header">
        <h2 id="workspace-launcher-title">{text("Field records and project control", "Veldregistratie en projectsturing")}</h2>
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
        {authors.length ? <label><span>{text("Author", "Auteur")}</span><select value={filters.author} onChange={(event) => setFilters({ ...filters, author: event.target.value })}><option value="">{text("All authors", "Alle auteurs")}</option>{authors.map((author) => <option value={author} key={author}>{author}</option>)}</select></label> : null}
        {filtersActive ? <button className="ui-button ui-button--quiet ui-button--sm" type="button" onClick={() => setFilters({ kind: "", buildingId: "", status: "", dateFrom: "", dateTo: "", author: "" })}>{text("Clear filters", "Wis filters")}</button> : null}
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
            <button className="ui-list-row" type="button" onClick={() => openRecord(record.tab, record.id, record.kind)} key={`${record.kind}:${record.id}`}>
              <span className="workspace-code-chip">{record.code || text("no code yet", "nog geen code")}</span>
              <span><strong>{record.title}</strong><small>{kindLabels[record.kind] ?? record.kind}{record.subtitle ? ` · ${codeText(record.subtitle, text)}` : ""}</small></span>
              <ArrowRight size={15} />
            </button>
          ))}</section>)}
        </div>
      ) : null}

      <div className="workspace-launcher-grid client-workspace-grid">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button className="workspace-launcher-tile ui-list-row" type="button" onClick={tile.action} data-workspace-destination={tile.id} key={tile.id}>
              <span className="workspace-launcher-icon"><Icon size={23} /></span>
              {typeof tile.count === "number" ? <span className="workspace-launcher-count" aria-hidden="true">{tile.count}</span> : null}
              <strong>{tile.label}</strong>
              <ArrowRight className="workspace-launcher-arrow" size={15} />
            </button>
          );
        })}
      </div>

      {!visibleTiles.length && !matches.length ? <div className="workspace-launcher-empty"><span>{text("No workspace item found. Try another term.", "Geen werkruimte-item gevonden. Probeer een andere zoekterm.")}</span><button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => setQuery("")}>{text("Clear", "Wissen")}</button></div> : null}

      <div className="workspace-support-strip" aria-label={text("Supporting project tools", "Ondersteunende projecttools")}>
        <span><Clock3 size={15} /> {text("Supporting tools", "Ondersteunende tools")}</span>
        <button type="button" onClick={openRapidVerify}><BookOpenCheck size={15} /> Rapid Verify</button>
        <button type="button" onClick={() => openTask("documents", false)}><FileText size={15} /> Project Docs</button>
        <button type="button" onClick={() => openTask("assets", false)}><FolderOpen size={15} /> {text("Assets & folders", "Middelen & mappen")}</button>
        <button type="button" onClick={() => openTask("drawings", false)}><AlertTriangle size={15} /> {text("Drawings & pins", "Tekeningen & pins")}</button>
        {/* The calculator and the notepad of the field tools had no way in from here. */}
        <button type="button" onClick={() => openTask("tools", false)}><Calculator size={15} /> {text("Calculator & notes", "Rekenmachine & notities")}</button>
        {/* Deadlines lost their tile, not their way in: the action centre still opens
            on the deadline view, next to the other supporting tools. */}
        <button type="button" onClick={() => openActionCenter("deadlines")}><CalendarClock size={15} /> {text("Deadlines", "Deadlines")}{counts.deadlines ? <span className="workspace-support-count">{counts.deadlines}</span> : null}</button>
        {/* Reports and Management are in the main navigation; they are not repeated here. */}
      </div>
    </section>
  );
}
