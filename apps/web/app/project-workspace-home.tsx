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
  HardHat,
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

type WorkspaceDestination = "inspections" | "findings" | "hse" | "daily" | "documents" | "registers" | "visual" | "drawings" | "tools" | "files";
type RegisterShortcut = "change_order" | "delivery" | "technical_instruction" | "agreement";
type DailyShortcut = "works_ongoing" | "works_completed" | "workforce" | "delay";

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
  openQuickCamera: () => void;
  openTask: (destination: WorkspaceDestination, create?: boolean) => void;
  openFinding: (scope: "issue" | "ncr", create?: boolean) => void;
  openRegister: (type: RegisterShortcut) => void;
  openDailyRecord: (type: DailyShortcut) => void;
  openDailyWork: (view: "works_ongoing" | "works_completed" | "delays") => void;
  openActionCenter: () => void;
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
  openQuickCamera,
  openTask,
  openFinding,
  openRegister,
  openDailyRecord,
  openDailyWork,
  openActionCenter,
  openRapidVerify,
  openReports,
  openManagement,
}: ProjectWorkspaceHomeProps) {
  const { locale, text } = useLanguage();
  const [query, setQuery] = useState("");
  const moduleEnabled = (module?: string) => !module || modules[module] !== false;

  const tiles = useMemo<WorkspaceTile[]>(() => [
    {
      id: "photos",
      label: text("Photos", "Foto's"),
      copy: text("Capture, classify and mark a finding", "Maken, koppelen en een bevinding markeren"),
      icon: Camera,
      tone: "blue",
      count: counts.photos,
      module: "visual_evidence",
      action: openQuickCamera,
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
      action: () => openDailyRecord("workforce"),
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
      action: () => openFinding("issue"),
    },
    {
      id: "hse",
      label: "HSE",
      copy: text("Safety observations and controls", "Veiligheidsobservaties en maatregelen"),
      icon: ShieldCheck,
      tone: "green",
      count: counts.hse,
      module: "hse",
      action: () => openTask("hse"),
    },
    {
      id: "materials-delivery",
      label: text("Materials delivery", "Materiaallevering"),
      copy: text("Quantity, condition and certificates", "Hoeveelheid, staat en certificaten"),
      icon: PackageCheck,
      tone: "teal",
      count: counts.deliveries,
      action: () => openRegister("delivery"),
    },
    {
      id: "inspections",
      label: text("Inspections", "Inspecties"),
      copy: text("Checklist, result and supporting evidence", "Checklist, resultaat en onderbouwend bewijs"),
      icon: ClipboardCheck,
      tone: "purple",
      count: counts.inspections,
      module: "inspections",
      action: () => openTask("inspections"),
    },
    {
      id: "technical-instructions",
      label: text("Technical instructions", "Technische instructies"),
      copy: text("Controlled instruction with deadline", "Beheerde instructie met deadline"),
      icon: Wrench,
      tone: "blue",
      action: () => openRegister("technical_instruction"),
    },
    {
      id: "change-order",
      label: text("Change order · CO", "Wijzigingsopdracht · CO"),
      copy: text("Controlled scope, cost and schedule change", "Beheerde scope-, kosten- en planningswijziging"),
      icon: FileCheck2,
      tone: "purple",
      action: () => openRegister("change_order"),
    },
    {
      id: "ncr",
      label: "NCR",
      copy: text("Formal non-conformance and close-out", "Formele afwijking met correctie en afsluiting"),
      icon: ShieldAlert,
      tone: "orange",
      count: counts.ncr,
      module: "quality",
      action: () => openFinding("ncr"),
    },
    {
      id: "deadlines",
      label: text("Deadlines", "Deadlines"),
      copy: text("Due actions, overdue items and escalations", "Open acties, achterstanden en escalaties"),
      icon: CalendarClock,
      tone: "slate",
      count: counts.deadlines,
      action: openActionCenter,
    },
    {
      id: "hse-incident",
      label: text("HSE incident", "HSE-incident"),
      copy: text("Incident, near miss or stop-work record", "Incident, near miss of werkstop registreren"),
      icon: ShieldAlert,
      tone: "orange",
      module: "hse",
      action: () => openTask("hse", true),
    },
    {
      id: "agreements-made",
      label: text("Agreements made", "Gemaakte afspraken"),
      copy: text("Decision, owner, deadline and audit trail", "Besluit, eigenaar, deadline en historie"),
      icon: MessageSquareText,
      tone: "blue",
      count: counts.agreements,
      action: () => openRegister("agreement"),
    },
  ], [counts, openActionCenter, openDailyRecord, openDailyWork, openFinding, openQuickCamera, openRegister, openTask, text]);

  const visibleTiles = tiles.filter((tile) => {
    if (!moduleEnabled(tile.module)) return false;
    const term = query.trim().toLocaleLowerCase(locale);
    return !term || `${tile.label} ${tile.copy}`.toLocaleLowerCase(locale).includes(term);
  });

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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("Search workspace", "Zoek in werkruimte")} />
        </label>
      </div>

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

      {!visibleTiles.length ? <div className="workspace-launcher-empty"><Search size={22} /><div><strong>{text("No workspace item found", "Geen werkruimte-item gevonden")}</strong><p>{text("Try another term.", "Probeer een andere zoekterm.")}</p></div><button className="secondary-button" type="button" onClick={() => setQuery("")}>{text("Clear", "Wissen")}</button></div> : null}

      <div className="workspace-support-strip" aria-label={text("Supporting project tools", "Ondersteunende projecttools")}>
        <span><Clock3 size={15} /> {text("Supporting tools", "Ondersteunende tools")}</span>
        <button type="button" onClick={openRapidVerify}><BookOpenCheck size={15} /> Rapid Verify</button>
        <button type="button" onClick={() => openTask("documents")}><FileText size={15} /> Project Docs</button>
        <button type="button" onClick={() => openTask("drawings")}><AlertTriangle size={15} /> {text("Drawings & pins", "Tekeningen & pins")}</button>
        <button type="button" onClick={openReports}><FileText size={15} /> {text("Reports", "Rapporten")}</button>
        <button type="button" onClick={openManagement}><Users size={15} /> {text("Submissions & management", "Indieningen & management")}</button>
      </div>
    </section>
  );
}
