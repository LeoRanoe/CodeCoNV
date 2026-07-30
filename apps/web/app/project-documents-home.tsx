"use client";

import {
  Archive,
  ArrowRight,
  DatabaseBackup,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import type { OperationSnapshot } from "@/lib/supabase/operations";

type DocumentView = "all" | "drawings" | "renders" | "boq" | "specifications" | "contracts";

export function ProjectDocumentsHome({
  data,
  openDrawings,
  openFiles,
  openRegisters,
  createDocument,
}: {
  data: OperationSnapshot;
  openDrawings: () => void;
  openFiles: () => void;
  openRegisters: () => void;
  createDocument: () => void;
}) {
  const { locale, text } = useLanguage();
  const [view, setView] = useState<DocumentView>("all");
  const [query, setQuery] = useState("");
  const availableFiles = data.files.filter((file) => file.status === "available");
  const drawings = availableFiles.filter((file) => file.category === "drawing");
  const renders = availableFiles.filter((file) => file.mime_type.startsWith("image/") && file.category !== "photo");
  const boq = data.registerEntries.filter((entry) => entry.register_type === "boq");
  const specifications = data.registerEntries.filter((entry) => entry.register_type === "specification");
  const contracts = data.registerEntries.filter((entry) => entry.register_type === "contract");
  const controlled = data.registerEntries.filter((entry) => ["document", "drawing", "specification", "contract", "boq"].includes(entry.register_type));

  const items = useMemo(() => {
    const registerSource = view === "boq" ? boq : view === "specifications" ? specifications : view === "contracts" ? contracts : view === "all" ? controlled : [];
    const fileSource = view === "drawings" ? drawings : view === "renders" ? renders : view === "all" ? availableFiles : [];
    const normalized = [
      ...fileSource.map((file) => ({ id: file.id, title: file.original_name, type: file.category || "file", status: file.status, date: file.created_at, source: "file" as const })),
      ...registerSource.map((entry) => ({ id: entry.id, title: entry.title, type: entry.register_type, status: entry.status, date: entry.occurred_at, source: "register" as const })),
    ];
    const term = query.trim().toLocaleLowerCase(locale);
    return term ? normalized.filter((item) => `${item.title} ${item.type} ${item.status}`.toLocaleLowerCase(locale).includes(term)) : normalized;
  }, [availableFiles, boq, contracts, controlled, drawings, locale, query, renders, specifications, view]);

  const tabs: Array<{ id: DocumentView; label: string; count: number; icon: React.ReactNode }> = [
    { id: "all", label: text("All documents", "Alle documenten"), count: availableFiles.length + controlled.length, icon: <Archive size={17} /> },
    { id: "drawings", label: text("Drawings", "Tekeningen"), count: drawings.length, icon: <MapPin size={17} /> },
    { id: "renders", label: "Renders", count: renders.length, icon: <ImageIcon size={17} /> },
    { id: "boq", label: "BOQ", count: boq.length, icon: <FileSpreadsheet size={17} /> },
    { id: "specifications", label: text("Technical specs", "Technische specs"), count: specifications.length, icon: <FileText size={17} /> },
    { id: "contracts", label: text("Contracts", "Contracten"), count: contracts.length, icon: <ShieldCheck size={17} /> },
  ];

  const openCurrent = () => {
    if (view === "drawings") openDrawings();
    else if (view === "renders") openFiles();
    else openRegisters();
  };

  return (
    <section className="project-documents">
      <div className="project-documents-summary">
        <div><span>{text("Controlled project information", "Beheerde projectinformatie")}</span><h2>{text("Project document center", "Projectdocumentencentrum")}</h2><p>{text("Find the current approved source, then continue in the correct controlled workflow.", "Vind de actuele goedgekeurde bron en ga daarna verder in de juiste gecontroleerde workflow.")}</p></div>
        <div className="project-documents-actions">
          <button className="secondary-button" type="button" onClick={openFiles}><Upload size={15} /> {text("Upload file", "Upload bestand")}</button>
          <button className="primary-button" type="button" onClick={createDocument}><Plus size={15} /> {text("New controlled record", "Nieuw beheerd record")}</button>
        </div>
      </div>

      <div className="project-document-tabs" role="tablist" aria-label={text("Document category", "Documentcategorie")}>
        {tabs.map((tab) => <button className={view === tab.id ? "active" : ""} type="button" role="tab" aria-selected={view === tab.id} onClick={() => setView(tab.id)} key={tab.id}>{tab.icon}<span><strong>{tab.label}</strong><small>{tab.count} {text("items", "items")}</small></span></button>)}
      </div>

      <div className="project-document-browser">
        <header>
          <div><h3>{tabs.find((tab) => tab.id === view)?.label}</h3><span>{items.length} {text("visible records", "zichtbare records")}</span></div>
          <label><Search size={15} /><span className="sr-only">{text("Search project documents", "Doorzoek projectdocumenten")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("Search name, type or status", "Zoek naam, type of status")} /></label>
        </header>
        <div className="project-document-list">
          {items.length ? items.slice(0, 12).map((item) => (
            <button type="button" onClick={item.source === "file" && item.type === "drawing" ? openDrawings : item.source === "file" ? openFiles : openRegisters} key={`${item.source}:${item.id}`}>
              <span className={`document-type-icon ${item.type}`}>{item.source === "file" ? <FolderOpen size={18} /> : item.type === "boq" ? <DatabaseBackup size={18} /> : <FileText size={18} />}</span>
              <span><strong>{item.title}</strong><small>{item.type.replaceAll("_", " ")} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(item.date))}</small></span>
              <span className={`document-status ${["approved", "closed", "available"].includes(item.status) ? "approved" : ""}`}>{item.status.replaceAll("_", " ")}</span>
              <ArrowRight size={15} />
            </button>
          )) : (
            <div className="project-document-empty"><span><FolderOpen size={25} /></span><div><strong>{text("No documents in this category yet", "Nog geen documenten in deze categorie")}</strong><p>{text("Use a real project file or controlled record; the overview intentionally shows no sample content.", "Gebruik een echt projectbestand of beheerd record; dit overzicht toont bewust geen voorbeeldinhoud.")}</p></div><button className="secondary-button" type="button" onClick={view === "drawings" || view === "renders" ? openFiles : createDocument}><Plus size={14} /> {text("Add first item", "Voeg eerste item toe")}</button></div>
          )}
        </div>
        {items.length ? <button className="project-document-footer" type="button" onClick={openCurrent}>{text("Open the complete controlled workflow", "Open de volledige gecontroleerde workflow")} <ArrowRight size={14} /></button> : null}
      </div>
    </section>
  );
}
