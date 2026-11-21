"use client";

import { AlertTriangle, Download, Eye, FileSpreadsheet, FileUp, Link2, Loader2, Plus, Printer, Search, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { PortalSharePanel } from "@/app/portal-share-panel";
import { useLanguage } from "@/lib/i18n";
import { pageAll } from "@/lib/supabase/page-all.mjs";
import { useBackToClose } from "@/lib/navigation/app-history";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { downloadBlob } from "@/lib/browser/download";
import { downloadProjectFile, openProjectFile, uploadProjectFile } from "@/lib/storage/gateway";
import {
  documentFoldersFor,
  documentStatuses,
  documentTypes,
  filterRegister,
  registerCsv,
  registerRows,
  reviewerStatuses,
  revisionStanding,
  sortRegister,
  statusesNeedingReason,
  statusMeta,
  suggestNextRevision,
  uploaderStatuses,
} from "@/lib/documents/document-register.mjs";
import { saveSpecConfiguration, type OperationSnapshot } from "@/lib/supabase/operations";
import type { SpecConfiguration } from "@/lib/forms/spec-forms";

type Party = { id: string; name: string; type: string };
type Building = { id: string; name: string };
type DocumentRow = {
  id: string; project_id: string; document_number: string | null; title: string; folder_code: string; discipline: string | null;
  document_type: string | null; originator_party_id: string | null; originator_name: string | null; building_ids: string[];
  work_package: string | null; current_revision_id: string | null; created_at: string; updated_at: string;
};
type RevisionRow = {
  id: string; document_id: string; revision: string; file_id: string; review_status: string; issue_date: string | null;
  transmittal_ref: string | null; notes: string | null; uploaded_by: string; uploaded_at: string; reviewed_by: string | null;
  reviewed_at: string | null; review_comment: string | null; superseded_by: string | null; superseded_at: string | null;
};
type RegisterRow = { document: DocumentRow; current: RevisionRow | null; history: RevisionRow[]; fileName?: string };

const toneClass: Record<string, string> = {
  red: "ui-status-badge ui-status-badge--red",
  amber: "ui-status-badge ui-status-badge--amber",
  green: "ui-status-badge ui-status-badge--green",
  blue: "ui-status-badge ui-status-badge--blue",
  neutral: "ui-status-badge portal-badge-neutral",
};

function StatusBadge({ status, language }: { status: string; language: "en" | "nl" }) {
  const meta = statusMeta(status);
  return <span className={toneClass[meta.tone] ?? toneClass.neutral}>{language === "nl" ? meta.nl : meta.en}</span>;
}

function day(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "America/Paramaribo" });
}

async function loadRegister(client: SupabaseClient, projectId: string) {
  const [documents, revisions, people, files] = await Promise.all([
    // F11: paged past the API's 1,000-row response cap, in a stable order.
    pageAll((from: number, to: number) => client.from("project_documents").select("*").eq("project_id", projectId).order("folder_code").order("id").range(from, to), 50000),
    pageAll((from: number, to: number) => client.from("project_document_revisions").select("*").eq("project_id", projectId).order("uploaded_at", { ascending: false }).order("id").range(from, to), 100000),
    client.rpc("list_project_people", { p_project_id: projectId }),
    pageAll((from: number, to: number) => client.from("project_document_revisions").select("file_id,files(original_name)").eq("project_id", projectId).order("id").range(from, to), 100000),
  ]);
  if (documents.error) throw documents.error;
  if (revisions.error) throw revisions.error;
  const names = new Map<string, string>(((people.data ?? []) as Array<{ user_id: string; display_name: string }>).map((person) => [person.user_id, person.display_name]));
  const fileNames = new Map<string, string>();
  for (const row of (files.data ?? []) as Array<{ file_id: string; files: { original_name: string } | { original_name: string }[] | null }>) {
    const file = Array.isArray(row.files) ? row.files[0] : row.files;
    if (file?.original_name) fileNames.set(row.file_id, file.original_name);
  }
  return { documents: (documents.data ?? []) as DocumentRow[], revisions: (revisions.data ?? []) as RevisionRow[], names, fileNames };
}

/**
 * Project Documents, requirements section 4: the controlled register. One record per document,
 * revisions that are never overwritten, a review status only a reviewer changes, superseded
 * revisions marked, links to the records that use them, and the register as a search, a filter
 * and an export.
 */
export function DocumentRegister({
  client,
  projectId,
  projectName,
  buildings,
  parties,
  data,
  defaultBuildingId,
}: {
  client: SupabaseClient;
  projectId: string;
  projectName: string;
  buildings: Building[];
  parties: Party[];
  data: OperationSnapshot;
  defaultBuildingId: string;
}) {
  const { language, locale, text } = useLanguage();
  const permissions = useProjectPermissions();
  const queryClient = useQueryClient();
  const canManage = permissions.can("documents.manage");
  const folders = documentFoldersFor((data.settings as { spec_configuration?: { document_folders?: unknown } } | null)?.spec_configuration?.document_folders) as Array<{ code: string; en: string; nl: string }>;
  const [folder, setFolder] = useState("");
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [status, setStatus] = useState("");
  const [originator, setOriginator] = useState("");
  const [building, setBuilding] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState("number");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const queryKey = ["document-register", projectId];
  const query = useQuery({ queryKey, queryFn: () => loadRegister(client, projectId) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey });

  const rows = useMemo(() => {
    const base = registerRows(query.data?.documents ?? [], query.data?.revisions ?? []) as RegisterRow[];
    return base.map((row) => ({ ...row, fileName: row.current ? query.data?.fileNames.get(row.current.file_id) : undefined }));
  }, [query.data]);
  const filtered = sortRegister(filterRegister(rows, { folder, search, discipline, status, originator, building, from, to }), sortKey, direction) as RegisterRow[];
  const disciplines = [...new Set(rows.map((row) => row.document.discipline).filter(Boolean))].sort() as string[];
  const partyName = (id: string | null) => parties.find((party) => party.id === id)?.name ?? "";
  const buildingName = (id: string) => buildings.find((item) => item.id === id)?.name ?? "";
  const folderName = (code: string) => {
    const item = folders.find((entry) => entry.code === code);
    return item ? `${item.code} ${language === "nl" ? item.nl : item.en}` : code;
  };
  const originators = [...new Map(rows.map((row) => [row.document.originator_party_id ?? row.document.originator_name ?? "", row.document.originator_party_id ? partyName(row.document.originator_party_id) : row.document.originator_name ?? ""])).entries()].filter(([key]) => key);
  const openRow = rows.find((row) => row.document.id === openId) ?? null;

  const exportCsv = () => {
    const csv = registerCsv(filtered, { language, folders, buildingName, partyName });
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${projectName.replace(/[^a-z0-9]+/gi, "-")}-document-register.csv`);
  };
  const printRegister = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const escape = (value: unknown) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
    const generated = new Date().toLocaleString(locale, { timeZone: "America/Paramaribo" });
    const filters = [folder && folderName(folder), discipline, status && statusMeta(status)[language], from && `≥ ${from}`, to && `≤ ${to}`, search && `“${search}”`].filter(Boolean).join(" · ") || text("none", "geen");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(projectName)} – ${escape(text("Document register", "Documentregister"))}</title>
      <style>body{font:12px system-ui,sans-serif;margin:24px;color:#161a20}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#4a5a66}table{border-collapse:collapse;width:100%}th,td{border:1px solid #b3c1c9;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f2f6f7}</style></head><body>
      <h1>${escape(projectName)} · ${escape(text("Document register", "Documentregister"))}</h1>
      <p>${escape(text("Generated", "Gegenereerd"))} ${escape(generated)} · ${escape(text("Filters", "Filters"))}: ${escape(filters)} · ${filtered.length} ${escape(text("documents", "documenten"))}</p>
      <table><thead><tr><th>${escape(text("Number", "Nummer"))}</th><th>${escape(text("Title", "Titel"))}</th><th>${escape(text("Folder", "Map"))}</th><th>${escape(text("Discipline", "Discipline"))}</th><th>${escape(text("Rev.", "Rev."))}</th><th>${escape(text("Status", "Status"))}</th><th>${escape(text("Received", "Ontvangen"))}</th></tr></thead><tbody>
      ${filtered.map((row) => `<tr><td>${escape(row.document.document_number)}</td><td>${escape(row.document.title)}</td><td>${escape(folderName(row.document.folder_code))}</td><td>${escape(row.document.discipline)}</td><td>${escape(row.current?.revision)}</td><td>${escape(statusMeta(row.current?.review_status ?? "")[language])}</td><td>${escape(day(row.current?.uploaded_at, locale))}</td></tr>`).join("")}
      </tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.document.folder_code, (counts.get(row.document.folder_code) ?? 0) + 1);

  return (
    <section className="document-register" aria-label={text("Document register", "Documentregister")}>
      <div className="document-register-layout">
        <nav className="document-folders" aria-label={text("Folders", "Mappen")}>
          <button type="button" className={folder === "" ? "active" : ""} aria-current={folder === "" ? "true" : undefined} onClick={() => setFolder("")}>
            <span>{text("All folders", "Alle mappen")}</span><b>{rows.length}</b>
          </button>
          {folders.map((item) => (
            <button key={item.code} type="button" className={folder === item.code ? "active" : ""} aria-current={folder === item.code ? "true" : undefined} onClick={() => setFolder(item.code)}>
              <span><small>{item.code}</small> {language === "nl" ? item.nl : item.en}</span><b>{counts.get(item.code) ?? 0}</b>
            </button>
          ))}
        </nav>
        <div className="document-register-main">
          <div className="document-register-toolbar">
            <label className="document-register-search"><Search size={15} /><span className="sr-only">{text("Search the register", "Doorzoek het register")}</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Number, title, keyword or file name", "Nummer, titel, trefwoord of bestandsnaam")} />
            </label>
            <div className="document-register-actions">
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={exportCsv} disabled={!filtered.length}><FileSpreadsheet size={15} /> Excel (CSV)</button>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={printRegister} disabled={!filtered.length}><Printer size={15} /> PDF</button>
              {canManage ? <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={() => setCreating(true)}><Plus size={15} /> {text("Register document", "Document registreren")}</button> : null}
            </div>
          </div>
          <div className="document-register-filters">
            <label className="form-field"><span>{text("Discipline", "Discipline")}</span><select value={discipline} onChange={(event) => setDiscipline(event.target.value)}><option value="">{text("All", "Alle")}</option>{disciplines.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="form-field"><span>{text("Status", "Status")}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{text("All", "Alle")}</option>{documentStatuses.map((item) => <option key={item.id} value={item.id}>{item[language]}</option>)}</select></label>
            <label className="form-field"><span>{text("Originator", "Opsteller")}</span><select value={originator} onChange={(event) => setOriginator(event.target.value)}><option value="">{text("All", "Alle")}</option>{originators.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
            <label className="form-field"><span>{text("Building", "Gebouw")}</span><select value={building} onChange={(event) => setBuilding(event.target.value)}><option value="">{text("All", "Alle")}</option>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>{text("Received from", "Ontvangen vanaf")}</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="form-field"><span>{text("Received to", "Ontvangen tot")}</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
            <label className="form-field"><span>{text("Sort", "Sorteren")}</span>
              <select value={`${sortKey}:${direction}`} onChange={(event) => { const [key, dir] = event.target.value.split(":"); setSortKey(key); setDirection(dir as "asc" | "desc"); }}>
                <option value="number:asc">{text("Number", "Nummer")}</option>
                <option value="title:asc">{text("Title", "Titel")}</option>
                <option value="received:desc">{text("Newest received", "Laatst ontvangen")}</option>
                <option value="received:asc">{text("Oldest received", "Eerst ontvangen")}</option>
                <option value="revision:desc">{text("Revision", "Revisie")}</option>
                <option value="status:asc">{text("Status", "Status")}</option>
              </select>
            </label>
          </div>
          {query.isLoading ? <p className="portal-loading"><Loader2 className="spin" size={15} /> {text("Loading…", "Laden…")}</p> : query.isError ? (
            <p className="field-warning" role="alert">{text("The register could not be loaded.", "Het register kon niet worden geladen.")}</p>
          ) : filtered.length ? (
            <div className="portal-table-wrap">
              <table className="portal-table document-register-table">
                <thead><tr>
                  <th>{text("Number", "Nummer")}</th><th>{text("Title", "Titel")}</th><th>{text("Folder", "Map")}</th><th>{text("Discipline", "Discipline")}</th>
                  <th>{text("Rev.", "Rev.")}</th><th>{text("Status", "Status")}</th><th>{text("Received", "Ontvangen")}</th>
                </tr></thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.document.id}>
                      <td>{row.document.document_number ?? "–"}</td>
                      <td><button className="portal-link" type="button" onClick={() => setOpenId(row.document.id)}>{row.document.title}</button>
                        <small className="portal-cell-meta">{row.document.originator_party_id ? partyName(row.document.originator_party_id) : row.document.originator_name ?? ""}{row.history.length > 1 ? ` · ${row.history.length} ${text("revisions", "revisies")}` : ""}</small></td>
                      <td>{folderName(row.document.folder_code)}</td>
                      <td>{row.document.discipline ?? ""}</td>
                      <td>{row.current?.revision ?? ""}</td>
                      <td>{row.current ? <StatusBadge status={row.current.review_status} language={language} /> : null}</td>
                      <td>{day(row.current?.uploaded_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="record-list-empty">{rows.length ? text("No document matches these filters.", "Geen document voldoet aan deze filters.") : text("No documents registered yet.", "Nog geen documenten geregistreerd.")}</p>}
        </div>
      </div>
      {creating ? (
        <RegisterDocumentDialog client={client} projectId={projectId} folders={folders} parties={parties} buildings={buildings} defaultFolder={folder || "01"}
          defaultBuildingId={defaultBuildingId} numberPattern={(data.settings as { spec_configuration?: { document_number_pattern?: string } } | null)?.spec_configuration?.document_number_pattern}
          close={() => setCreating(false)} done={() => { setCreating(false); refresh(); }} />
      ) : null}
      {openRow ? (
        <DocumentDetail client={client} projectId={projectId} row={openRow} names={query.data?.names ?? new Map()} fileNames={query.data?.fileNames ?? new Map()}
          folderName={folderName} partyName={partyName} buildingName={buildingName} parties={parties} data={data} defaultBuildingId={defaultBuildingId}
          close={() => setOpenId(null)} changed={refresh} />
      ) : null}
    </section>
  );
}

function RegisterDocumentDialog({ client, projectId, folders, parties, buildings, defaultFolder, defaultBuildingId, numberPattern, close, done }: {
  client: SupabaseClient; projectId: string; folders: Array<{ code: string; en: string; nl: string }>; parties: Party[]; buildings: Building[];
  defaultFolder: string; defaultBuildingId: string; numberPattern?: string; close: () => void; done: (id: string) => void;
}) {
  const { language, text } = useLanguage();
  const permissions = useProjectPermissions();
  useBackToClose(true, close);
  const statuses = permissions.can("documents.review") ? [...uploaderStatuses, ...reviewerStatuses.filter((id: string) => id !== "withdrawn")] : uploaderStatuses;
  const [form, setForm] = useState({ number: "", title: "", folder: defaultFolder, discipline: "", type: "drawing", originatorParty: "", originatorName: "", workPackage: "", revision: "A", status: "submitted", issueDate: "", transmittal: "", notes: "" });
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>(defaultBuildingId ? [defaultBuildingId] : []);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async () => {
    if (!file) { setError(text("Choose the document file.", "Kies het documentbestand.")); return; }
    if (form.title.trim().length < 2) { setError(text("Add a title.", "Voeg een titel toe.")); return; }
    if (numberPattern && form.number.trim()) {
      let matches = true;
      try { matches = new RegExp(numberPattern).test(form.number.trim()); } catch { matches = true; }
      if (!matches) { setError(text(`The number does not follow the project's convention (${numberPattern}).`, `Het nummer volgt de projectconventie niet (${numberPattern}).`)); return; }
    }
    setBusy(true); setError("");
    try {
      const uploaded = await uploadProjectFile(client, { projectId, buildingId: selectedBuildings[0] ?? defaultBuildingId, category: form.type === "drawing" ? "drawing" : "document", file, onProgress: setProgress });
      const result = await client.rpc("register_project_document", {
        p_project_id: projectId, p_document_number: form.number, p_title: form.title, p_folder_code: form.folder, p_discipline: form.discipline,
        p_document_type: form.type, p_originator_party_id: form.originatorParty || null, p_originator_name: form.originatorParty ? null : form.originatorName,
        p_building_ids: selectedBuildings, p_work_package: form.workPackage, p_revision: form.revision, p_review_status: form.status,
        p_issue_date: form.issueDate || null, p_transmittal_ref: form.transmittal, p_notes: form.notes, p_file_id: uploaded.fileId,
      });
      if (result.error) throw result.error;
      done(String(result.data));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String((caught as { message?: string })?.message ?? caught));
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <aside className="modal portal-detail" role="dialog" aria-modal="true" aria-label={text("Register document", "Document registreren")}>
        <div className="portal-detail-head"><h2>{text("Register document", "Document registreren")}</h2><button className="icon-button" type="button" aria-label={text("Close", "Sluiten")} onClick={close}><X size={18} /></button></div>
        <div className="form-grid form-grid-2">
          <label className="form-field"><span>{text("Document number", "Documentnummer")}</span><input value={form.number} maxLength={80} onChange={set("number")} /></label>
          <label className="form-field"><span>{text("Title (required)", "Titel (verplicht)")}</span><input value={form.title} maxLength={240} onChange={set("title")} /></label>
          <label className="form-field"><span>{text("Folder", "Map")}</span><select value={form.folder} onChange={set("folder")}>{folders.map((item) => <option key={item.code} value={item.code}>{item.code} {language === "nl" ? item.nl : item.en}</option>)}</select></label>
          <label className="form-field"><span>{text("Document type", "Documenttype")}</span><select value={form.type} onChange={set("type")}>{documentTypes.map((item) => <option key={item.id} value={item.id}>{item[language]}</option>)}</select></label>
          <label className="form-field"><span>{text("Discipline", "Discipline")}</span><input value={form.discipline} maxLength={80} onChange={set("discipline")} list="document-disciplines" />
            <datalist id="document-disciplines">{["Architectural", "Structural", "Civil", "Mechanical", "HVAC", "Electrical", "Plumbing & Sanitary", "Fire Protection", "External Works"].map((item) => <option key={item} value={item} />)}</datalist>
          </label>
          <label className="form-field"><span>{text("Originator / contractor", "Opsteller / aannemer")}</span>
            <select value={form.originatorParty} onChange={set("originatorParty")}><option value="">{text("Other (type below)", "Anders (hieronder typen)")}</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select>
          </label>
          {form.originatorParty ? null : <label className="form-field"><span>{text("Originator name", "Naam opsteller")}</span><input value={form.originatorName} maxLength={180} onChange={set("originatorName")} /></label>}
          <label className="form-field"><span>{text("Revision (as on the document)", "Revisie (zoals op het document)")}</span><input value={form.revision} maxLength={20} onChange={set("revision")} /></label>
          <label className="form-field"><span>{text("Status", "Status")}</span><select value={form.status} onChange={set("status")}>{statuses.map((id: string) => <option key={id} value={id}>{statusMeta(id)[language]}</option>)}</select></label>
          <label className="form-field"><span>{text("Issue date", "Datum document")}</span><input type="date" value={form.issueDate} onChange={set("issueDate")} /></label>
          <label className="form-field"><span>{text("Transmittal", "Transmittal")}</span><input value={form.transmittal} maxLength={80} onChange={set("transmittal")} /></label>
          <label className="form-field"><span>{text("Work package", "Werkpakket")}</span><input value={form.workPackage} maxLength={120} onChange={set("workPackage")} /></label>
        </div>
        {buildings.length > 1 ? (
          <fieldset className="portal-file-choice"><legend>{text("Buildings / locations", "Gebouwen / locaties")}</legend>
            {buildings.map((item) => <label key={item.id} className="portal-check"><input type="checkbox" checked={selectedBuildings.includes(item.id)} onChange={(event) => setSelectedBuildings((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{item.name}</span></label>)}
          </fieldset>
        ) : null}
        <label className="form-field"><span>{text("Notes", "Notities")}</span><textarea rows={2} maxLength={2000} value={form.notes} onChange={set("notes")} /></label>
        <label className="form-field"><span>{text("File", "Bestand")}</span><input type="file" accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.csv,.txt,image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        {progress !== null ? <p role="status">{text("Uploading", "Uploaden")} {progress}%</p> : null}
        <p className="portal-note">{text("An uploaded drawing is not approved for construction until a reviewer sets that status.", "Een geüploade tekening is pas vrijgegeven voor uitvoering als een beoordelaar die status zet.")}</p>
        {error ? <p className="field-warning" role="alert">{error}</p> : null}
        <div className="portal-response-actions">
          <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => void submit()}>{busy ? <Loader2 className="spin" size={15} /> : <FileUp size={15} />} {text("Register", "Registreren")}</button>
        </div>
      </aside>
    </div>
  );
}

function DocumentDetail({ client, projectId, row, names, fileNames, folderName, partyName, buildingName, parties, data, defaultBuildingId, close, changed }: {
  client: SupabaseClient; projectId: string; row: RegisterRow; names: Map<string, string>; fileNames: Map<string, string>;
  folderName: (code: string) => string; partyName: (id: string | null) => string; buildingName: (id: string) => string; parties: Party[];
  data: OperationSnapshot; defaultBuildingId: string; close: () => void; changed: () => void;
}) {
  const { language, locale, text } = useLanguage();
  const permissions = useProjectPermissions();
  useBackToClose(true, close);
  const canManage = permissions.can("documents.manage");
  const canReview = permissions.can("documents.review");
  const [mode, setMode] = useState<"" | "revision" | "status" | "link">("");
  const [revision, setRevision] = useState(suggestNextRevision(row.current?.revision));
  const [revisionStatus, setRevisionStatus] = useState("submitted");
  const [issueDate, setIssueDate] = useState("");
  const [transmittal, setTransmittal] = useState("");
  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState("approved");
  const [comment, setComment] = useState("");
  const [linkRecord, setLinkRecord] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const eventsQuery = useQuery({
    queryKey: ["document-events", row.document.id],
    queryFn: async () => {
      const [events, links] = await Promise.all([
        client.from("project_document_events").select("*").eq("document_id", row.document.id).order("sequence", { ascending: false }).limit(500),
        client.from("project_document_links").select("*").eq("document_id", row.document.id).limit(500),
      ]);
      if (events.error) throw events.error;
      return { events: events.data ?? [], links: links.data ?? [] };
    },
  });
  const refreshAll = () => { changed(); void eventsQuery.refetch(); };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await operation(); setMode(""); setComment(""); refreshAll(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String((caught as { message?: string })?.message ?? caught)); }
    finally { setBusy(false); setProgress(null); }
  };
  const uploadRevision = (file: File) => run(async () => {
    if (!revision.trim()) throw new Error(text("Enter the revision mark.", "Vul de revisie in."));
    const uploaded = await uploadProjectFile(client, { projectId, buildingId: row.document.building_ids[0] ?? defaultBuildingId, category: row.document.document_type === "drawing" ? "drawing" : "document", file, onProgress: setProgress });
    const result = await client.rpc("add_project_document_revision", { p_document_id: row.document.id, p_revision: revision.trim(), p_file_id: uploaded.fileId, p_review_status: revisionStatus, p_issue_date: issueDate || null, p_transmittal_ref: transmittal, p_notes: notes });
    if (result.error) throw result.error;
  });
  const setStatus = () => run(async () => {
    if (!row.current) return;
    if (statusesNeedingReason.includes(newStatus) && comment.trim().length < 3) throw new Error(text("A reason is required.", "Een reden is verplicht."));
    const result = await client.rpc("set_project_document_revision_status", { p_revision_id: row.current.id, p_status: newStatus, p_comment: comment });
    if (result.error) throw result.error;
  });
  const recordOptions = [
    ...data.findings.map((item) => ({ key: `finding:${item.id}`, type: "finding", id: item.id, code: item.finding_number, title: item.title })),
    ...data.inspections.map((item) => ({ key: `inspection:${item.id}`, type: "inspection", id: item.id, code: item.inspection_number, title: item.title })),
    ...data.registerEntries.map((item) => ({ key: `register_entry:${item.id}`, type: "register_entry", id: item.id, code: item.entry_number, title: item.title })),
  ];
  const link = (unlink: boolean, target?: { record_type: string; record_id: string; record_code: string | null }) => run(async () => {
    const option = target ? { type: target.record_type, id: target.record_id, code: target.record_code ?? "" } : recordOptions.find((item) => item.key === linkRecord);
    if (!option) throw new Error(text("Choose a record.", "Kies een record."));
    const result = await client.rpc("link_project_document", { p_document_id: row.document.id, p_record_type: option.type, p_record_id: option.id, p_record_code: option.code, p_unlink: unlink });
    if (result.error) throw result.error;
  });
  const reviewChoices = reviewerStatuses as string[];
  const eventLabel = (action: string) => ({
    register: text("Registered", "Geregistreerd"), revision: text("New revision", "Nieuwe revisie"), status: text("Status changed", "Status gewijzigd"),
    supersede: text("Superseded", "Vervangen"), update: text("Details changed", "Gegevens gewijzigd"), link: text("Linked", "Gekoppeld"), unlink: text("Unlinked", "Ontkoppeld"), share: text("Shared", "Gedeeld"),
  } as Record<string, string>)[action] ?? action;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <aside className="modal portal-detail document-detail" role="dialog" aria-modal="true" aria-label={row.document.title}>
        <div className="portal-detail-head">
          <div><span className="record-number">{row.document.document_number ?? text("No number", "Geen nummer")} · {folderName(row.document.folder_code)}</span><h2>{row.document.title}</h2></div>
          <button className="icon-button" type="button" aria-label={text("Close", "Sluiten")} onClick={close}><X size={18} /></button>
        </div>
        {row.current ? (
          <div className={`document-current${row.current.review_status === "superseded" || row.current.review_status === "withdrawn" ? " document-current--stale" : ""}`}>
            <div>
              <small>{text("Current revision", "Actuele revisie")}</small>
              <strong>{row.current.revision}</strong>
              <StatusBadge status={row.current.review_status} language={language} />
              <small>{fileNames.get(row.current.file_id) ?? ""}{row.current.issue_date ? ` · ${day(row.current.issue_date, locale)}` : ""}{row.current.transmittal_ref ? ` · ${row.current.transmittal_ref}` : ""}</small>
            </div>
            <div className="document-current-actions">
              <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => void openProjectFile(client, row.current!.file_id, fileNames.get(row.current!.file_id) ?? "document").catch((caught) => setError(String(caught?.message ?? caught)))}><Eye size={14} /> {text("Open", "Openen")}</button>
              <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => void downloadProjectFile(client, row.current!.file_id, fileNames.get(row.current!.file_id) ?? "document").catch((caught) => setError(String(caught?.message ?? caught)))}><Download size={14} /> {text("Download", "Downloaden")}</button>
            </div>
          </div>
        ) : null}
        {row.current && !["for_construction", "approved", "approved_with_comments", "for_information"].includes(row.current.review_status) ? (
          <p className="portal-note"><AlertTriangle size={14} /> {text("This revision is not issued for construction.", "Deze revisie is niet vrijgegeven voor uitvoering.")}</p>
        ) : null}
        <dl className="portal-facts">
          <div><dt>{text("Discipline", "Discipline")}</dt><dd>{row.document.discipline ?? "–"}</dd></div>
          <div><dt>{text("Type", "Type")}</dt><dd>{documentTypes.find((item) => item.id === row.document.document_type)?.[language] ?? row.document.document_type ?? "–"}</dd></div>
          <div><dt>{text("Originator", "Opsteller")}</dt><dd>{row.document.originator_party_id ? partyName(row.document.originator_party_id) : row.document.originator_name ?? "–"}</dd></div>
          <div><dt>{text("Buildings", "Gebouwen")}</dt><dd>{row.document.building_ids.map(buildingName).filter(Boolean).join(", ") || "–"}</dd></div>
          {row.document.work_package ? <div><dt>{text("Work package", "Werkpakket")}</dt><dd>{row.document.work_package}</dd></div> : null}
        </dl>

        <div className="portal-steps">
          {canManage ? <button className={`ui-button ui-button--sm ${mode === "revision" ? "ui-button--primary" : "ui-button--secondary"}`} type="button" onClick={() => setMode(mode === "revision" ? "" : "revision")}><FileUp size={14} /> {text("Upload new revision", "Nieuwe revisie uploaden")}</button> : null}
          {canReview && row.current && !row.current.superseded_at ? <button className={`ui-button ui-button--sm ${mode === "status" ? "ui-button--primary" : "ui-button--secondary"}`} type="button" onClick={() => setMode(mode === "status" ? "" : "status")}>{text("Review status", "Beoordelingsstatus")}</button> : null}
          {canManage || permissions.can("records.edit") ? <button className={`ui-button ui-button--sm ${mode === "link" ? "ui-button--primary" : "ui-button--secondary"}`} type="button" onClick={() => setMode(mode === "link" ? "" : "link")}><Link2 size={14} /> {text("Link a record", "Record koppelen")}</button> : null}
        </div>
        {mode === "revision" ? (
          <div className="portal-response-form">
            <div className="form-grid form-grid-2">
              <label className="form-field"><span>{text("Revision mark", "Revisie")}</span><input value={revision} maxLength={20} onChange={(event) => setRevision(event.target.value)} /></label>
              <label className="form-field"><span>{text("Status", "Status")}</span><select value={revisionStatus} onChange={(event) => setRevisionStatus(event.target.value)}>{(canReview ? [...uploaderStatuses, ...reviewerStatuses.filter((id: string) => id !== "withdrawn")] : uploaderStatuses).map((id: string) => <option key={id} value={id}>{statusMeta(id)[language]}</option>)}</select></label>
              <label className="form-field"><span>{text("Issue date", "Datum document")}</span><input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
              <label className="form-field"><span>{text("Transmittal", "Transmittal")}</span><input value={transmittal} maxLength={80} onChange={(event) => setTransmittal(event.target.value)} /></label>
            </div>
            <label className="form-field"><span>{text("What changed", "Wat is gewijzigd")}</span><textarea rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            <input ref={fileInput} className="visually-hidden" type="file" accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.csv,.txt,image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadRevision(file); event.target.value = ""; }} />
            <p className="portal-note">{text("The earlier revisions stay in the history, marked superseded.", "De eerdere revisies blijven in de historie, gemarkeerd als vervangen.")}</p>
            <div className="portal-response-actions">
              {progress !== null ? <span role="status">{text("Uploading", "Uploaden")} {progress}%</span> : null}
              <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? <Loader2 className="spin" size={15} /> : <FileUp size={15} />} {text("Choose file and upload", "Bestand kiezen en uploaden")}</button>
            </div>
          </div>
        ) : null}
        {mode === "status" ? (
          <div className="portal-response-form">
            <label className="form-field"><span>{text("New status for revision", "Nieuwe status voor revisie")} {row.current?.revision}</span>
              <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)}>{reviewChoices.map((id) => <option key={id} value={id}>{statusMeta(id)[language]}</option>)}</select>
            </label>
            <label className="form-field"><span>{statusesNeedingReason.includes(newStatus) ? text("Reason (required)", "Reden (verplicht)") : text("Review comment", "Opmerking beoordeling")}</span><textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
            <div className="portal-response-actions"><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => void setStatus()}>{busy ? <Loader2 className="spin" size={15} /> : null} {text("Save status", "Status opslaan")}</button></div>
          </div>
        ) : null}
        {mode === "link" ? (
          <div className="portal-response-form">
            <label className="form-field"><span>{text("Record", "Record")}</span>
              <select value={linkRecord} onChange={(event) => setLinkRecord(event.target.value)}><option value="">{text("Choose…", "Kies…")}</option>{recordOptions.map((item) => <option key={item.key} value={item.key}>{item.code} · {item.title}</option>)}</select>
            </label>
            <div className="portal-response-actions"><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !linkRecord} onClick={() => void link(false)}><Link2 size={15} /> {text("Link", "Koppelen")}</button></div>
          </div>
        ) : null}
        {error ? <p className="field-warning" role="alert">{error}</p> : null}

        <section className="portal-detail-section">
          <h3>{text("Revision history", "Revisiehistorie")}</h3>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>{text("Rev.", "Rev.")}</th><th>{text("Status", "Status")}</th><th>{text("Uploaded", "Geüpload")}</th><th>{text("Review", "Beoordeling")}</th><th>{text("File", "Bestand")}</th></tr></thead>
              <tbody>
                {row.history.map((item) => (
                  <tr key={item.id} className={item.id === row.document.current_revision_id ? "portal-current" : ""}>
                    <td>{item.revision}{item.id === row.document.current_revision_id ? ` · ${text("current", "actueel")}` : ""}</td>
                    <td><StatusBadge status={item.review_status} language={language} />{item.superseded_by ? <small className="portal-cell-meta">{text("by", "door")} {row.history.find((other) => other.id === item.superseded_by)?.revision ?? ""}</small> : null}</td>
                    <td>{day(item.uploaded_at, locale)}<small className="portal-cell-meta">{names.get(item.uploaded_by) ?? ""}</small></td>
                    <td>{item.reviewed_at ? <>{day(item.reviewed_at, locale)}<small className="portal-cell-meta">{names.get(item.reviewed_by ?? "") ?? ""}{item.review_comment ? ` · ${item.review_comment}` : ""}</small></> : "–"}</td>
                    <td><button className="ui-button ui-button--quiet ui-button--sm" type="button" onClick={() => void downloadProjectFile(client, item.file_id, fileNames.get(item.file_id) ?? `revision-${item.revision}`).catch((caught) => setError(String(caught?.message ?? caught)))}><Download size={14} /> <span className="sr-only">{text("Download revision", "Revisie downloaden")} {item.revision}</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="portal-detail-section">
          <h3>{text("Related records", "Gerelateerde records")}</h3>
          {eventsQuery.data?.links.length ? (
            <ul className="portal-files">
              {eventsQuery.data.links.map((item) => (
                <li key={String(item.id)}><span>{String(item.record_code ?? item.record_type)}</span>
                  {(() => {
                    // F11: the exact revision the record was written against, and whether it is still the one to use.
                    const pinned = item.revision_id ? row.history.find((revision) => revision.id === item.revision_id) : null;
                    if (!pinned) return null;
                    const standing = revisionStanding(pinned.id, [row.document], row.history);
                    return <small className={`portal-cell-meta${standing?.stale ? " document-link-stale" : ""}`} data-link-revision={pinned.revision}>
                      {text(`rev ${pinned.revision}`, `rev ${pinned.revision}`)}{standing?.stale ? text(standing.newerApproved ? ` · rev ${standing.newerApproved.revision} approved since` : " · no longer valid", standing.newerApproved ? ` · sindsdien rev ${standing.newerApproved.revision} goedgekeurd` : " · niet meer geldig") : ""}
                    </small>;
                  })()}
                  {canManage ? <button className="ui-button ui-button--quiet ui-button--sm" type="button" onClick={() => void link(true, item as { record_type: string; record_id: string; record_code: string | null })}>{text("Unlink", "Ontkoppelen")}</button> : null}
                </li>
              ))}
            </ul>
          ) : <p className="record-list-empty">{text("No linked records.", "Geen gekoppelde records.")}</p>}
        </section>

        <PortalSharePanel client={client} projectId={projectId} recordType="document" recordId={row.document.id} recordTitle={row.document.title} parties={parties.map((party) => ({ ...party, party_type: party.type }))} />

        <section className="portal-detail-section">
          <h3>{text("Document history", "Documenthistorie")}</h3>
          <ol className="portal-timeline">
            {(eventsQuery.data?.events ?? []).map((event) => (
              <li key={String(event.id)}>
                <strong>{eventLabel(String(event.action))}</strong>
                <small>{names.get(String(event.actor_user_id)) ?? ""} · {new Date(String(event.created_at)).toLocaleString(locale, { timeZone: "America/Paramaribo" })}
                  {event.to_status ? ` · ${event.from_status ? `${statusMeta(String(event.from_status))[language]} → ` : ""}${statusMeta(String(event.to_status))[language]}` : ""}
                  {(event.details as { revision?: string } | null)?.revision ? ` · ${text("rev.", "rev.")} ${(event.details as { revision?: string }).revision}` : ""}</small>
                {event.comment ? <p>{String(event.comment)}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

/**
 * Management → Document settings (requirements 4.1, 4.2 and 13): the project's folders, the
 * numbering convention and the review period. Stored with the project's specification settings.
 */
export function DocumentSettings({ client, projectId, configuration }: {
  client: SupabaseClient;
  projectId: string;
  configuration: Record<string, unknown> | null | undefined;
}) {
  const { language, text } = useLanguage();
  const permissions = useProjectPermissions();
  const queryClient = useQueryClient();
  const initial = documentFoldersFor((configuration as { document_folders?: unknown } | null)?.document_folders) as Array<{ code: string; en: string; nl: string }>;
  const [folders, setFolders] = useState(() => initial.map((folder) => ({ ...folder })));
  const [pattern, setPattern] = useState(String((configuration as { document_number_pattern?: string } | null)?.document_number_pattern ?? ""));
  const [days, setDays] = useState(String((configuration as { document_review_days?: number } | null)?.document_review_days ?? 7));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canEdit = permissions.can("project.configure");
  const update = (index: number, key: "code" | "en" | "nl", value: string) => setFolders((current) => current.map((folder, position) => position === index ? { ...folder, [key]: value } : folder));
  const save = async () => {
    setError(""); setMessage("");
    const codes = folders.map((folder) => folder.code.trim());
    if (!codes.length || codes.some((code) => !/^[0-9A-Za-z][0-9A-Za-z_-]{0,15}$/.test(code))) { setError(text("Every folder needs a short code (letters, digits, - or _).", "Elke map heeft een korte code nodig (letters, cijfers, - of _).")); return; }
    if (new Set(codes).size !== codes.length) { setError(text("Folder codes must be unique.", "Mapcodes moeten uniek zijn.")); return; }
    if (pattern.trim()) { try { new RegExp(pattern.trim()); } catch { setError(text("The numbering pattern is not a valid expression.", "Het nummeringspatroon is geen geldige expressie.")); return; } }
    const reviewDays = Number(days);
    if (!Number.isInteger(reviewDays) || reviewDays < 1 || reviewDays > 120) { setError(text("Review period: 1 to 120 days.", "Beoordelingstermijn: 1 tot 120 dagen.")); return; }
    setBusy(true);
    try {
      await saveSpecConfiguration(client, projectId, {
        ...((configuration ?? {}) as SpecConfiguration),
        document_folders: folders.map((folder) => ({ code: folder.code.trim(), en: folder.en.trim() || folder.code.trim(), nl: folder.nl.trim() || folder.en.trim() || folder.code.trim() })),
        document_number_pattern: pattern.trim() || undefined,
        document_review_days: reviewDays,
      });
      setMessage(text("Document settings saved.", "Documentinstellingen opgeslagen."));
      void queryClient.invalidateQueries({ queryKey: ["project-operations", projectId] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ui-panel document-settings" aria-label={text("Document settings", "Documentinstellingen")}>
      <div className="ui-panel__heading"><h2>{text("Document settings", "Documentinstellingen")}</h2></div>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead><tr><th>{text("Code", "Code")}</th><th>{text("Folder (English)", "Map (Engels)")}</th><th>{text("Folder (Dutch)", "Map (Nederlands)")}</th><th><span className="sr-only">{text("Remove", "Verwijderen")}</span></th></tr></thead>
          <tbody>
            {folders.map((folder, index) => (
              <tr key={index}>
                <td><input aria-label={`${text("Code of folder", "Code van map")} ${index + 1}`} value={folder.code} maxLength={16} disabled={!canEdit} onChange={(event) => update(index, "code", event.target.value)} /></td>
                <td><input aria-label={`${text("English name of folder", "Engelse naam van map")} ${index + 1}`} value={folder.en} maxLength={80} disabled={!canEdit} onChange={(event) => update(index, "en", event.target.value)} /></td>
                <td><input aria-label={`${text("Dutch name of folder", "Nederlandse naam van map")} ${index + 1}`} value={folder.nl} maxLength={80} disabled={!canEdit} onChange={(event) => update(index, "nl", event.target.value)} /></td>
                <td>{canEdit ? <button className="ui-button ui-button--quiet ui-button--sm" type="button" aria-label={`${text("Remove folder", "Map verwijderen")} ${folder.code}`} onClick={() => setFolders((current) => current.filter((_, position) => position !== index))}><X size={14} /></button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? <div className="portal-steps"><button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => setFolders((current) => [...current, { code: String(current.length).padStart(2, "0"), en: "", nl: "" }])}><Plus size={14} /> {text("Add folder", "Map toevoegen")}</button></div> : null}
      <p className="portal-note">{text("A document keeps the folder code it was registered with. Removing a folder here does not move its documents.", "Een document houdt de mapcode waarmee het is geregistreerd. Een map verwijderen verplaatst de documenten niet.")}</p>
      <div className="form-grid form-grid-2">
        <label className="form-field"><span>{text("Document numbering pattern (regular expression, optional)", "Nummeringspatroon documenten (reguliere expressie, optioneel)")}</span>
          <input value={pattern} disabled={!canEdit} placeholder={"^[A-Z]{1,4}-[0-9]{3}$"} onChange={(event) => setPattern(event.target.value)} />
        </label>
        <label className="form-field"><span>{text("Review reminder after (days)", "Herinnering beoordeling na (dagen)")}</span>
          <input type="number" min={1} max={120} value={days} disabled={!canEdit} onChange={(event) => setDays(event.target.value)} />
        </label>
      </div>
      <p className="portal-note">{language === "nl" ? "Wie mag registreren en vrijgeven volgt de rechten documents.manage en documents.review onder Team & regels." : "Who may register and issue follows the documents.manage and documents.review rights under Team & rules."}</p>
      {error ? <p className="field-warning" role="alert">{error}</p> : null}
      {message ? <p className="portal-note" role="status">{message}</p> : null}
      {canEdit ? <div className="portal-response-actions"><button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="spin" size={15} /> : null} {text("Save document settings", "Documentinstellingen opslaan")}</button></div> : null}
    </section>
  );
}
