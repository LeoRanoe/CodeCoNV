"use client";

import { SectionNav } from "@/app/section-nav";
import {
  Archive,
  ArrowRight,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  FolderOpen,
  Image as ImageIcon,
  MapPin,
  Loader2,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BuildingPicker, resolveDefaultBuildingId, type BuildingOption } from "@/app/building-picker";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { useLanguage } from "@/lib/i18n";
import { queueOfflineUpload, syncOfflineUploads } from "@/lib/offline/upload-queue";
import { normalizeRecordCode } from "@/lib/records/record-directory.mjs";
import { downloadProjectFile, loadProjectFileBlob } from "@/lib/storage/gateway";
import { createMediaFolder, linkFileToRecord, updateProjectFile, type OperationSnapshot } from "@/lib/supabase/operations";
import { statusText, typeText } from "@/lib/status-labels";

type DocumentView = "all" | "drawings" | "renders" | "boq" | "specifications" | "contracts";

export function ProjectDocumentsHome({
  data,
  client,
  organizationId,
  projectId,
  reportId,
  buildingId,
  buildings,
  busy,
  run,
  openDrawings,
  openFiles,
  openRegisters,
  createDocument,
}: {
  data: OperationSnapshot;
  client: SupabaseClient;
  organizationId: string;
  projectId: string;
  reportId: string | null;
  buildingId: string;
  buildings: BuildingOption[];
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
  openDrawings: () => void;
  openFiles: () => void;
  openRegisters: () => void;
  createDocument: () => void;
}) {
  const { locale, text } = useLanguage();
  const permissions = useProjectPermissions();
  const canManageFiles = permissions.can("files.manage");
  const canCreateRecords = permissions.can("records.create");
  const [view, setView] = useState<DocumentView>("all");
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest" | "name">("recent");
  /* Open where there is room, folded away on a phone. Read once, at mount. */
  const [docFiltersOpen, setDocFiltersOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 761px)").matches);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderBuildingId, setFolderBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [uploadBuildingId, setUploadBuildingId] = useState(() => resolveDefaultBuildingId(buildings, buildingId));
  const [uploadFolderId, setUploadFolderId] = useState("");
  const [uploadKind, setUploadKind] = useState<"document" | "drawing">("document");
  const [dragging, setDragging] = useState(false);
  const [linkFolderId, setLinkFolderId] = useState("");
  const [linkRecordId, setLinkRecordId] = useState("");
  const [openingFileId, setOpeningFileId] = useState("");
  const [openError, setOpenError] = useState("");
  const [preview, setPreview] = useState<{ fileId: string; title: string; url: string } | null>(null);
  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);
  const availableFiles = data.files.filter((file) => file.status === "available");
  const drawings = availableFiles.filter((file) => file.category === "drawing");
  const renders = availableFiles.filter((file) => file.mime_type.startsWith("image/") && file.category !== "photo");
  const boq = data.registerEntries.filter((entry) => entry.register_type === "boq");
  const specifications = data.registerEntries.filter((entry) => entry.register_type === "specification");
  const contracts = data.registerEntries.filter((entry) => entry.register_type === "contract");
  const controlled = data.registerEntries.filter((entry) => ["document", "drawing", "specification", "contract", "boq"].includes(entry.register_type));
  const folders = data.mediaFolders.filter((folder) => folder.status === "active");
  const documentTypes = Array.from(new Set([...availableFiles.map((file) => file.category || "file"), ...controlled.map((entry) => entry.register_type)])).sort();

  const items = (() => {
    const registerSource = view === "boq" ? boq : view === "specifications" ? specifications : view === "contracts" ? contracts : view === "all" ? controlled : [];
    const fileSource = view === "drawings" ? drawings : view === "renders" ? renders : view === "all" ? availableFiles : [];
    const normalized = [
      ...fileSource.map((file) => ({ id: file.id, code: file.document_code ?? "", title: file.original_name, type: file.category || "file", status: file.status, date: file.created_at, source: "file" as const, folderId: file.folder_id, buildingIds: file.building_ids?.length ? file.building_ids : file.building_id ? [file.building_id] : [] })),
      ...registerSource.map((entry) => ({ id: entry.id, code: entry.entry_number, title: entry.title, type: entry.register_type, status: entry.status, date: entry.occurred_at, source: "register" as const, folderId: null, buildingIds: entry.building_ids?.length ? entry.building_ids : [entry.building_id] })),
    ];
    const term = query.trim().toLocaleLowerCase(locale);
    const normalizedCode = normalizeRecordCode(query);
    return normalized
      .filter((item) => !term || `${item.code} ${item.title} ${item.type} ${item.status}`.toLocaleLowerCase(locale).includes(term) || normalizeRecordCode(item.code).includes(normalizedCode))
      .filter((item) => folderFilter === "all" || item.folderId === folderFilter)
      .filter((item) => buildingFilter === "all" || item.buildingIds.includes(buildingFilter))
      .filter((item) => typeFilter === "all" || item.type === typeFilter)
      .filter((item) => !dateFrom || item.date.slice(0, 10) >= dateFrom)
      .sort((left, right) => {
        const leftExact = normalizedCode && normalizeRecordCode(left.code) === normalizedCode ? 0 : 1;
        const rightExact = normalizedCode && normalizeRecordCode(right.code) === normalizedCode ? 0 : 1;
        if (leftExact !== rightExact) return leftExact - rightExact;
        if (sort === "name") return left.title.localeCompare(right.title, locale);
        return sort === "oldest" ? left.date.localeCompare(right.date) : right.date.localeCompare(left.date);
      });
  })();

  const tabs: Array<{ id: DocumentView; label: string; count: number; icon: React.ReactNode }> = [
    { id: "all", label: text("All documents", "Alle documenten"), count: availableFiles.length + controlled.length, icon: <Archive size={17} /> },
    { id: "drawings", label: text("Drawings", "Tekeningen"), count: drawings.length, icon: <MapPin size={17} /> },
    { id: "renders", label: "Renders", count: renders.length, icon: <ImageIcon size={17} /> },
    { id: "boq", label: "BOQ", count: boq.length, icon: <FileSpreadsheet size={17} /> },
    { id: "specifications", label: text("Technical specs", "Technische specs"), count: specifications.length, icon: <FileText size={17} /> },
    { id: "contracts", label: text("Contracts", "Contracten"), count: contracts.length, icon: <ShieldCheck size={17} /> },
  ];

  const createFolderHere = async () => {
    if (newFolderName.trim().length < 2 || !folderBuildingId) return;
    let createdId = "";
    const okay = await run(async () => {
      const created = await createMediaFolder(client, {
        projectId,
        buildingId: folderBuildingId,
        name: newFolderName.trim(),
        folderType: uploadKind === "drawing" ? "drawings" : "mixed",
      });
      createdId = created.id;
      return created;
    }, text("Folder created and linked to this project.", "Map aangemaakt en aan dit project gekoppeld."));
    if (okay) {
      setUploadFolderId(createdId);
      setFolderFilter(createdId);
      setNewFolderName("");
    }
  };

  const uploadFiles = async (selected: FileList | File[]) => {
    const files = Array.from(selected);
    if (!files.length || !uploadFolderId || !uploadBuildingId) return;
    const okay = await run(async () => {
      for (const file of files) {
        await queueOfflineUpload({
          projectId,
          buildingId: uploadBuildingId,
          reportId,
          folderId: uploadFolderId,
          folderName: folders.find((folder) => folder.id === uploadFolderId)?.name ?? null,
          kind: uploadKind,
          file,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          locationLabel: buildings.find((building) => building.id === uploadBuildingId)?.name ?? "",
          capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
          originalSize: file.size,
          queuedSize: file.size,
          compressed: false,
        });
      }
      if (navigator.onLine) return syncOfflineUploads(client, projectId, { force: true });
      return { synced: 0, failed: 0, paused: true };
    }, text("Documents saved.", "Documenten opgeslagen."));
    if (okay) setDragging(false);
  };

  const connectPreviewFile = async () => {
    if (!preview) return;
    await run(async () => {
      if (linkFolderId) await updateProjectFile(client, preview.fileId, { folderId: linkFolderId, buildingId: uploadBuildingId });
      if (linkRecordId) await linkFileToRecord(client, {
        organizationId,
        projectId,
        fileId: preview.fileId,
        recordType: "register_entry",
        recordId: linkRecordId,
      });
    }, text("Document linked without copying the file.", "Document gekoppeld zonder het bestand te kopiëren."));
  };

  const openCurrent = () => {
    if (view === "drawings") openDrawings();
    else if (view === "renders") openFiles();
    else openRegisters();
  };

  const openItem = async (item: (typeof items)[number]) => {
    if (item.source === "register") {
      openRegisters();
      return;
    }
    setOpeningFileId(item.id);
    setOpenError("");
    try {
      const blob = await loadProjectFileBlob(client, item.id);
      const url = URL.createObjectURL(blob);
      setPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { fileId: item.id, title: item.title, url };
      });
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : text("The document could not be opened.", "Het document kon niet worden geopend."));
    } finally {
      setOpeningFileId("");
    }
  };

  return (
    <section className="project-documents">
      <div className="project-documents-summary">
        <div><h1>{text("Project document center", "Projectdocumentencentrum")}</h1><p>{text("Controlled project information", "Beheerde projectinformatie")}</p></div>
        <div className="project-documents-actions">
          {canManageFiles ? <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => document.getElementById("project-document-upload")?.scrollIntoView({ behavior: "smooth", block: "center" })}><Upload size={15} /> {text("Upload file", "Upload bestand")}</button> : null}
          {canCreateRecords ? <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={createDocument}><Plus size={15} /> {text("New controlled record", "Nieuw beheerd record")}</button> : null}
        </div>
      </div>

      {canManageFiles ? <section className="project-document-intake" id="project-document-upload" aria-label={text("Create a folder and upload", "Map maken en uploaden")}>
        <div className="project-document-folder-create">
          <span className="record-number">{text("1. Folder and project link", "1. Map en projectkoppeling")}</span>
          <h2>{text("Create the destination here", "Maak de bestemming hier")}</h2>
          <div className="project-document-intake-row">
            <label className="form-field"><span>{text("New folder name", "Naam nieuwe map")}</span><input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder={text("Example: Approved drawings", "Bijvoorbeeld: Goedgekeurde tekeningen")} /></label>
            <BuildingPicker id="document-folder-building" buildings={buildings} value={folderBuildingId} onChange={setFolderBuildingId} />
            <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || newFolderName.trim().length < 2 || !folderBuildingId} onClick={() => void createFolderHere()}><FolderPlus size={15} /> {text("Create and link folder", "Map maken en koppelen")}</button>
          </div>
        </div>
        <div className="project-document-upload-flow">
          <span className="record-number">{text("2. Upload directly into it", "2. Upload er direct naartoe")}</span>
          <div className="project-document-intake-row">
            <BuildingPicker id="document-upload-building" buildings={buildings} value={uploadBuildingId} onChange={setUploadBuildingId} />
            <label className="form-field"><span>{text("Folder", "Map")}</span><select value={uploadFolderId} onChange={(event) => setUploadFolderId(event.target.value)}><option value="">{text("Choose a folder first", "Kies eerst een map")}</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>
            <label className="form-field"><span>{text("Document type", "Documenttype")}</span><select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as "document" | "drawing")}><option value="document">{text("Document", "Document")}</option><option value="drawing">{text("Drawing", "Tekening")}</option></select></label>
          </div>
          <label
            className={`project-document-dropzone ${dragging ? "dragging" : ""} ${!uploadFolderId ? "disabled" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); if (uploadFolderId) void uploadFiles(event.dataTransfer.files); }}
          >
            {busy ? <Loader2 className="spin" size={24} /> : <Upload size={24} />}
            <span><strong>{text("Drop files here or tap to choose", "Sleep bestanden hierheen of tik om te kiezen")}</strong><small>{uploadFolderId ? folders.find((folder) => folder.id === uploadFolderId)?.name : text("Choose the folder above before uploading", "Kies hierboven eerst de map voor de upload")}</small></span>
            <input type="file" multiple disabled={busy || !uploadFolderId} accept={uploadKind === "drawing" ? ".pdf,.dwg,image/png,image/jpeg,image/webp" : ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"} onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); event.target.value = ""; }} />
          </label>
        </div>
      </section> : null}

      <SectionNav
        className="project-document-tabs"
        label={text("Document category", "Documentcategorie")}
        items={tabs.map((tab) => ({ id: tab.id, label: tab.label, count: tab.count, icon: tab.icon, selected: view === tab.id, onSelect: () => setView(tab.id) }))}
      />

      <div className="project-document-browser">
        {openError ? <div className="operation-alert error" role="alert">{openError}</div> : null}
        <header>
          <div><h3>{tabs.find((tab) => tab.id === view)?.label}</h3><span>{items.length} {text("visible records", "zichtbare records")}</span></div>
          <label><Search size={15} /><span className="sr-only">{text("Search project documents", "Doorzoek projectdocumenten")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("Search name, type or status", "Zoek naam, type of status")} /></label>
        </header>
        {/* Folded away on a phone so the documents themselves are what fills the screen. */}
        <details className="workspace-search-filters-block" open={docFiltersOpen} onToggle={(event) => setDocFiltersOpen(event.currentTarget.open)}>
        <summary><SlidersHorizontal size={15} /> {text("Filters", "Filters")}</summary>
        <div className="project-document-filters">
          <label><span>{text("Folder", "Map")}</span><select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}><option value="all">{text("All folders", "Alle mappen")}</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>
          <label><span>{text("Building", "Gebouw")}</span><select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="all">{text("All buildings", "Alle gebouwen")}</option>{buildings.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}</select></label>
          <label><span>{text("Type", "Type")}</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">{text("All types", "Alle typen")}</option>{documentTypes.map((type) => <option value={type} key={type}>{typeText(type, text)}</option>)}</select></label>
          <label><span>{text("From date", "Vanaf datum")}</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>{text("Sort", "Sorteren")}</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recent">{text("Newest", "Nieuwste")}</option><option value="oldest">{text("Oldest", "Oudste")}</option><option value="name">{text("Name", "Naam")}</option></select></label>
        </div>
        </details>
        <div className="project-document-list">
          {items.length ? items.slice(0, 12).map((item) => (
            <button type="button" disabled={openingFileId === item.id} onClick={() => void openItem(item)} key={`${item.source}:${item.id}`}>
              <span className={`document-type-icon ${item.type}`}>{item.source === "file" ? <FolderOpen size={18} /> : item.type === "boq" ? <DatabaseBackup size={18} /> : <FileText size={18} />}</span>
              <span><strong>{item.code ? `${item.code} · ` : ""}{item.title}</strong><small>{typeText(item.type, text)} · {item.folderId ? folders.find((folder) => folder.id === item.folderId)?.name : text("No folder", "Geen map")} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(item.date))}</small></span>
              <span className={`document-status ${["approved", "closed", "available"].includes(item.status) ? "approved" : ""}`}>{statusText(item.status, text)}</span>
              <ArrowRight size={15} />
            </button>
          )) : (
            <div className="project-document-empty"><span><FolderOpen size={25} /></span><div><strong>{text("No documents in this category yet", "Nog geen documenten in deze categorie")}</strong></div><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={view === "drawings" || view === "renders" ? openFiles : createDocument}><Plus size={14} /> {text("Add first item", "Voeg eerste item toe")}</button></div>
          )}
        </div>
        {items.length ? <button className="project-document-footer" type="button" onClick={openCurrent}>{text("Open the complete controlled workflow", "Open de volledige gecontroleerde workflow")} <ArrowRight size={14} /></button> : null}
      </div>
      {preview ? <div className="document-preview-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreview(null)}>
        <section className="document-preview-modal" role="dialog" aria-modal="true" aria-labelledby="document-preview-title">
          <header><div><span>{text("Secure project document", "Beveiligd projectdocument")}</span><h3 id="document-preview-title">{preview.title}</h3></div><div><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => void downloadProjectFile(client, preview.fileId, preview.title)}><Download size={15} /> {text("Download", "Downloaden")}</button><button className="modal-close" type="button" onClick={() => setPreview(null)} aria-label={text("Close document", "Sluit document")}><X size={18} /></button></div></header>
          <div className="document-preview-body">
            <iframe src={preview.url} title={preview.title} />
            <div className="document-link-panel">
              <h4>{text("Link without copying", "Koppel zonder te kopiëren")}</h4>
              <label className="form-field"><span>{text("Folder", "Map")}</span><select value={linkFolderId} onChange={(event) => setLinkFolderId(event.target.value)}><option value="">{text("Keep current folder", "Huidige map behouden")}</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>
              <label className="form-field"><span>{text("Controlled record", "Beheerde registratie")}</span><select value={linkRecordId} onChange={(event) => setLinkRecordId(event.target.value)}><option value="">{text("No extra record link", "Geen extra registratiekoppeling")}</option>{controlled.map((record) => <option value={record.id} key={record.id}>{record.entry_number} · {record.title}</option>)}</select></label>
              <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || (!linkFolderId && !linkRecordId)} onClick={() => void connectPreviewFile()}><Link2 size={15} /> {text("Apply links", "Koppelingen toepassen")}</button>
            </div>
          </div>
        </section>
      </div> : null}
    </section>
  );
}
