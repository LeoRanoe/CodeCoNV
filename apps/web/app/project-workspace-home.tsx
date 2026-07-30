"use client";

import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  DatabaseBackup,
  FileCheck2,
  FileText,
  FolderOpen,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type WorkspaceDestination = "inspections" | "findings" | "hse" | "documents" | "registers" | "visual" | "drawings" | "tools" | "files";
type RegisterShortcut =
  | "wcr"
  | "rfi"
  | "rfa"
  | "inspection_request"
  | "boq"
  | "change_order"
  | "submittal"
  | "meeting"
  | "equipment"
  | "delivery"
  | "test";

type ProjectWorkspaceHomeProps = {
  inspectionCount: number;
  openFindingCount: number;
  hseCount: number;
  documentCount: number;
  drawingCount: number;
  visualCount: number;
  fileCount: number;
  actionCount: number;
  modules: Record<string, boolean>;
  openQuickCamera: () => void;
  openQuickRegister: () => void;
  openTask: (destination: WorkspaceDestination, create?: boolean) => void;
  openRegister: (type: RegisterShortcut) => void;
  openOverview: () => void;
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
  inspectionCount,
  openFindingCount,
  hseCount,
  documentCount,
  drawingCount,
  visualCount,
  fileCount,
  actionCount,
  modules,
  openQuickCamera,
  openQuickRegister,
  openTask,
  openRegister,
  openOverview,
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
      id: "daily-log",
      label: text("Daily log", "Daglog"),
      copy: text("Today, attendance and site questions", "Vandaag, aanwezigheid en dagvragen"),
      icon: CalendarDays,
      tone: "orange",
      action: openOverview,
    },
    {
      id: "actions",
      label: text("Action center", "Actiecentrum"),
      copy: text("All assigned follow-up in one list", "Alle toegewezen opvolging in één lijst"),
      icon: ClipboardList,
      tone: "blue",
      count: actionCount,
      action: openActionCenter,
    },
    {
      id: "inspections",
      label: text("Inspections", "Inspecties"),
      copy: text("Approved checklists and results", "Goedgekeurde checklists en resultaten"),
      icon: ClipboardCheck,
      tone: "purple",
      count: inspectionCount,
      module: "inspections",
      action: () => openTask("inspections"),
    },
    {
      id: "issues",
      label: text("Issues / NCR", "Issues / NCR"),
      copy: text("Record, assign and verify defects", "Vastleggen, toewijzen en verifiëren"),
      icon: AlertTriangle,
      tone: "orange",
      count: openFindingCount,
      module: "quality",
      action: () => openTask("findings"),
    },
    {
      id: "punchlist",
      label: "Punchlist",
      copy: text("Contractor close-out and supervisor review", "Gereedmelding aannemer en controle supervisor"),
      icon: CheckCircle2,
      tone: "green",
      count: openFindingCount,
      module: "quality",
      action: () => openTask("findings"),
    },
    {
      id: "hse",
      label: text("HSE / incidents", "HSE / incidenten"),
      copy: text("Observations, near misses and stop work", "Observaties, near misses en werkstop"),
      icon: ShieldCheck,
      tone: "orange",
      count: hseCount,
      module: "hse",
      action: () => openTask("hse"),
    },
    {
      id: "wcr",
      label: "WCR",
      copy: text("Work completion request", "Gereedmelding werk"),
      icon: FileCheck2,
      tone: "teal",
      module: "documents",
      action: () => openRegister("wcr"),
    },
    {
      id: "rfi",
      label: "RFI",
      copy: text("Request for information", "Informatieverzoek"),
      icon: MessageCircle,
      tone: "blue",
      module: "documents",
      action: () => openRegister("rfi"),
    },
    {
      id: "rfa",
      label: "RFA",
      copy: text("Request for approval", "Goedkeuringsverzoek"),
      icon: PackageCheck,
      tone: "purple",
      module: "documents",
      action: () => openRegister("rfa"),
    },
    {
      id: "wir",
      label: "WIR",
      copy: text("Work inspection request", "Werkinspectieverzoek"),
      icon: ClipboardCheck,
      tone: "purple",
      module: "documents",
      action: () => openRegister("inspection_request"),
    },
    {
      id: "change-orders",
      label: text("Change orders", "Wijzigingen / CO"),
      copy: text("Controlled scope changes", "Beheerde scopewijzigingen"),
      icon: Activity,
      tone: "orange",
      module: "documents",
      action: () => openRegister("change_order"),
    },
    {
      id: "submittals",
      label: "Submittals",
      copy: text("Submitted material and document review", "Beoordeling van ingediende stukken"),
      icon: Archive,
      tone: "teal",
      module: "documents",
      action: () => openRegister("submittal"),
    },
    {
      id: "meetings",
      label: text("Meetings", "Vergaderingen"),
      copy: text("Decisions, minutes and follow-up", "Besluiten, notulen en opvolging"),
      icon: Users,
      tone: "blue",
      module: "documents",
      action: () => openRegister("meeting"),
    },
    {
      id: "equipment",
      label: text("Equipment", "Materieel"),
      copy: text("Availability, checks and downtime", "Beschikbaarheid, controles en uitval"),
      icon: Wrench,
      tone: "slate",
      module: "documents",
      action: () => openRegister("equipment"),
    },
    {
      id: "deliveries",
      label: text("Deliveries", "Leveringen"),
      copy: text("Materials, quantities and certificates", "Materialen, aantallen en certificaten"),
      icon: PackageCheck,
      tone: "green",
      module: "documents",
      action: () => openRegister("delivery"),
    },
    {
      id: "tests",
      label: text("Tests & measurements", "Tests & metingen"),
      copy: text("Results, tolerance and evidence", "Resultaten, tolerantie en bewijs"),
      icon: FileCheck2,
      tone: "blue",
      module: "documents",
      action: () => openRegister("test"),
    },
    {
      id: "documents",
      label: "Project Docs",
      copy: text("Drawings, specifications and contracts", "Tekeningen, specificaties en contracten"),
      icon: FolderOpen,
      tone: "teal",
      count: documentCount,
      module: "documents",
      action: () => openTask("documents"),
    },
    {
      id: "drawings",
      label: text("Drawings & pins", "Tekeningen & pins"),
      copy: text("Open the plan and link exact positions", "Open de plattegrond en koppel posities"),
      icon: MapPin,
      tone: "orange",
      count: drawingCount,
      module: "documents",
      action: () => openTask("drawings"),
    },
    {
      id: "photos",
      label: text("Photos & folders", "Foto’s & mappen"),
      copy: text("Evidence filed automatically by day", "Bewijs automatisch per dag geordend"),
      icon: Camera,
      tone: "blue",
      count: fileCount,
      module: "visual_evidence",
      action: () => openTask("files"),
    },
    {
      id: "visual-evidence",
      label: text("360° evidence", "360°-bewijs"),
      copy: text("Interactive tours with linked issues", "Interactieve tours met gekoppelde punten"),
      icon: RotateCcw,
      tone: "purple",
      count: visualCount,
      module: "visual_evidence",
      action: () => openTask("visual"),
    },
    {
      id: "boq",
      label: "BOQ / Finance",
      copy: text("Import quantities and measured progress", "Importeer hoeveelheden en voortgang"),
      icon: DatabaseBackup,
      tone: "green",
      module: "documents",
      action: () => openRegister("boq"),
    },
    {
      id: "field-tools",
      label: text("Field tools", "Veldtools"),
      copy: text("Notes, agreements and instructions", "Notities, afspraken en instructies"),
      icon: Wrench,
      tone: "slate",
      module: "documents",
      action: () => openTask("tools"),
    },
    {
      id: "rapid-verify",
      label: "Rapid Verify",
      copy: text("Check questions against project sources", "Toets vragen aan projectbronnen"),
      icon: BookOpenCheck,
      tone: "purple",
      action: openRapidVerify,
    },
    {
      id: "reports",
      label: text("Client reports", "Klantrapporten"),
      copy: text("Daily, weekly and monthly output", "Dag-, week- en maandrapportage"),
      icon: FileText,
      tone: "teal",
      action: openReports,
    },
    {
      id: "management",
      label: text("Team & directory", "Team & directory"),
      copy: text("People, roles and project settings", "Mensen, rollen en projectinstellingen"),
      icon: Users,
      tone: "slate",
      action: openManagement,
    },
  ], [
    actionCount,
    documentCount,
    drawingCount,
    fileCount,
    hseCount,
    inspectionCount,
    openActionCenter,
    openFindingCount,
    openManagement,
    openOverview,
    openRapidVerify,
    openRegister,
    openReports,
    openTask,
    text,
    visualCount,
  ]);

  const visibleTiles = tiles.filter((tile) => {
    if (!moduleEnabled(tile.module)) return false;
    const term = query.trim().toLocaleLowerCase(locale);
    return !term || `${tile.label} ${tile.copy}`.toLocaleLowerCase(locale).includes(term);
  });

  return (
    <section className="workspace-launcher" aria-labelledby="workspace-launcher-title">
      <div className="workspace-launcher-toolbar">
        <div>
          <span>{text("Project tools", "Projecttools")}</span>
          <h2 id="workspace-launcher-title">{text("Choose what you want to do", "Kies wat je wilt doen")}</h2>
          <p>{text("Every tile opens the real project workflow with the current project, building and audit context.", "Elke tegel opent de echte projectworkflow met het huidige project, gebouw en auditcontext.")}</p>
        </div>
        <div className="workspace-launcher-actions">
          <label className="workspace-launcher-search">
            <Search size={16} />
            <span className="sr-only">{text("Search project tools", "Zoek projecttools")}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("Search tools", "Zoek tools")} />
          </label>
          <button className="secondary-button" type="button" onClick={openQuickRegister}><Plus size={16} /> {text("Other record", "Andere registratie")}</button>
          <button className="primary-button" type="button" onClick={openQuickCamera}><Camera size={16} /> {text("Take photo", "Foto maken")}</button>
        </div>
      </div>

      <div className="workspace-launcher-grid">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              className={`workspace-launcher-tile tone-${tile.tone}`}
              type="button"
              onClick={tile.action}
              aria-label={tile.label}
              data-workspace-destination={tile.id}
              key={tile.id}
            >
              <span className="workspace-launcher-icon"><Icon size={23} /></span>
              {typeof tile.count === "number" ? <span className="workspace-launcher-count">{tile.count}</span> : null}
              <strong>{tile.label}</strong>
              <small>{tile.copy}</small>
              <ArrowRight className="workspace-launcher-arrow" size={15} />
            </button>
          );
        })}
      </div>

      {!visibleTiles.length ? (
        <div className="workspace-launcher-empty">
          <Search size={22} />
          <div><strong>{text("No tool found", "Geen tool gevonden")}</strong><p>{text("Try another name or clear the search.", "Probeer een andere naam of wis de zoekopdracht.")}</p></div>
          <button className="secondary-button" type="button" onClick={() => setQuery("")}>{text("Clear search", "Zoekopdracht wissen")}</button>
        </div>
      ) : null}
    </section>
  );
}
