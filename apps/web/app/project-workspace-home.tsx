"use client";

import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  CloudSun,
  DatabaseBackup,
  FileCheck2,
  FileText,
  FolderOpen,
  HardDrive,
  MapPin,
  MessageCircle,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  WifiOff,
  Wrench,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type WorkspaceDestination = "inspections" | "findings" | "hse" | "documents" | "registers" | "visual" | "drawings" | "tools" | "files";
type RegisterShortcut = "wcr" | "rfi" | "rfa" | "inspection_request" | "boq";

type ProjectWorkspaceHomeProps = {
  inspectionCount: number;
  openFindingCount: number;
  hseCount: number;
  documentCount: number;
  drawingCount: number;
  visualCount: number;
  fileCount: number;
  openQuickCamera: () => void;
  openQuickRegister: () => void;
  openTask: (destination: WorkspaceDestination, create?: boolean) => void;
  openRegister: (type: RegisterShortcut) => void;
};

function WorkspaceLink({
  icon,
  label,
  copy,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  copy: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button className="workspace-module-link" type="button" onClick={onClick}>
      <span className="workspace-module-icon">{icon}</span>
      <span><strong>{label}</strong><small>{copy}</small></span>
      {typeof count === "number" ? <b>{count}</b> : <ArrowRight size={15} />}
    </button>
  );
}

export function ProjectWorkspaceHome({
  inspectionCount,
  openFindingCount,
  hseCount,
  documentCount,
  drawingCount,
  visualCount,
  fileCount,
  openQuickCamera,
  openQuickRegister,
  openTask,
  openRegister,
}: ProjectWorkspaceHomeProps) {
  const { text } = useLanguage();
  return (
    <section className="workspace-command">
      <div className="workspace-command-intro">
        <div><span>{text("Start in the field", "Start in het veld")}</span><h2>{text("What needs to be recorded now?", "Wat moet nu worden vastgelegd?")}</h2><p>{text("Choose the task, then CODECO carries project, building, date and audit context through the complete flow.", "Kies de taak; CODECO neemt project, gebouw, datum en auditcontext automatisch mee door de volledige flow.")}</p></div>
        <div className="workspace-command-trust">
          <span><CloudSun size={15} /> {text("Weather context", "Weercontext")}</span>
          <span><CheckCircle2 size={15} /> {text("Automatic numbering", "Automatische nummering")}</span>
          <span><WifiOff size={15} /> {text("Offline-safe evidence", "Offline-veilig bewijs")}</span>
        </div>
      </div>

      <div className="workspace-primary-flow">
        <button className="workspace-primary-card photo" type="button" onClick={openQuickCamera}>
          <span><Camera size={25} /></span>
          <div><small>{text("Fastest route", "Snelste route")}</small><strong>{text("Take site photo", "Maak bouwplaatsfoto")}</strong><p>{text("Review, describe and file by day.", "Controleer, omschrijf en archiveer per dag.")}</p></div>
          <ArrowRight size={18} />
        </button>
        <button className="workspace-primary-card inspection" type="button" onClick={() => openTask("inspections", true)}>
          <span><ClipboardCheck size={25} /></span>
          <div><small>{inspectionCount} {text("recorded", "geregistreerd")}</small><strong>{text("Start inspection", "Start inspectie")}</strong><p>{text("Run the approved checklist at the exact location.", "Doorloop de goedgekeurde checklist op de exacte locatie.")}</p></div>
          <ArrowRight size={18} />
        </button>
        <button className="workspace-primary-card issue" type="button" onClick={() => openTask("findings", true)}>
          <span><AlertTriangle size={25} /></span>
          <div><small>{openFindingCount} open</small><strong>{text("Report issue", "Meld probleem")}</strong><p>{text("Capture evidence, assign ownership and set urgency.", "Leg bewijs vast, wijs verantwoordelijkheid toe en bepaal urgentie.")}</p></div>
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="workspace-module-groups">
        <section className="workspace-module-group">
          <header><span><FileCheck2 size={17} /></span><div><h3>{text("Quality & approvals", "Kwaliteit & goedkeuring")}</h3><p>{text("Formal requests and close-out control", "Formele verzoeken en oplevercontrole")}</p></div></header>
          <div>
            <WorkspaceLink icon={<FileCheck2 size={18} />} label="WCR" copy={text("Work completion request", "Gereedmelding werk")} onClick={() => openRegister("wcr")} />
            <WorkspaceLink icon={<MessageCircle size={18} />} label="RFI" copy={text("Request for information", "Informatieverzoek")} onClick={() => openRegister("rfi")} />
            <WorkspaceLink icon={<PackageCheck size={18} />} label="RFA" copy={text("Request for approval", "Goedkeuringsverzoek")} onClick={() => openRegister("rfa")} />
            <WorkspaceLink icon={<ClipboardCheck size={18} />} label="WIR" copy={text("Work inspection request", "Werkinspectieverzoek")} onClick={() => openRegister("inspection_request")} />
            <WorkspaceLink icon={<CheckCircle2 size={18} />} label="Punchlist" copy={text("Contractor review cycle", "Reviewcyclus aannemer")} count={openFindingCount} onClick={() => openTask("findings")} />
          </div>
        </section>

        <section className="workspace-module-group">
          <header><span><Archive size={17} /></span><div><h3>{text("Evidence & project control", "Bewijs & projectbeheersing")}</h3><p>{text("One source for drawings, documents and progress", "Eén bron voor tekeningen, documenten en voortgang")}</p></div></header>
          <div>
            <WorkspaceLink icon={<MapPin size={18} />} label={text("Drawings & pins", "Tekeningen & pins")} copy={text("Open the coordinated plan", "Open de gecoördineerde plattegrond")} count={drawingCount} onClick={() => openTask("drawings")} />
            <WorkspaceLink icon={<FolderOpen size={18} />} label="Project Docs" copy={text("Controlled document register", "Beheerd documentenregister")} count={documentCount} onClick={() => openTask("documents")} />
            <WorkspaceLink icon={<DatabaseBackup size={18} />} label="BOQ / Finance" copy={text("Import and measured progress", "Import en gemeten voortgang")} onClick={() => openRegister("boq")} />
            <WorkspaceLink icon={<RotateCcw size={18} />} label={text("360° evidence", "360°-bewijs")} copy={text("Panoramas with linked findings", "Panorama's met gekoppelde punten")} count={visualCount} onClick={() => openTask("visual")} />
            <WorkspaceLink icon={<HardDrive size={18} />} label={text("Photo library", "Fotobibliotheek")} copy={text("Daily folders and drawings", "Dagmappen en tekeningen")} count={fileCount} onClick={() => openTask("files")} />
          </div>
        </section>

        <section className="workspace-module-group compact">
          <header><span><ShieldCheck size={17} /></span><div><h3>{text("Site operations", "Bouwplaatsbeheer")}</h3><p>{text("Safety and daily coordination", "Veiligheid en dagelijkse coördinatie")}</p></div></header>
          <div>
            <WorkspaceLink icon={<ShieldCheck size={18} />} label="HSE" copy={text("Observation, near miss or incident", "Observatie, near miss of incident")} count={hseCount} onClick={() => openTask("hse", true)} />
            <WorkspaceLink icon={<Wrench size={18} />} label={text("Field tools", "Veldtools")} copy={text("Notes, agreements and instructions", "Notities, afspraken en instructies")} onClick={() => openTask("tools")} />
            <WorkspaceLink icon={<FileText size={18} />} label={text("Other field record", "Andere veldregistratie")} copy={text("Delivery, test, delay or activity", "Levering, test, vertraging of activiteit")} onClick={openQuickRegister} />
          </div>
        </section>
      </div>
    </section>
  );
}
