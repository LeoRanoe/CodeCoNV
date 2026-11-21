/**
 * The Project Documents register (requirements section 4): the folder taxonomy, the review
 * statuses and the register's search, filters, sort and export. Pure functions, so the
 * register screen and the tests read the same rules.
 */

/** Recommended folder structure 00-13 (4.1). A project may rename or add folders. */
export const defaultDocumentFolders = Object.freeze([
  { code: "00", en: "Document Register & Transmittals", nl: "Documentregister & transmittals" },
  { code: "01", en: "Drawings", nl: "Tekeningen" },
  { code: "02", en: "Technical Specifications", nl: "Technische specificaties" },
  { code: "03", en: "Project Schedules", nl: "Projectplanningen" },
  { code: "04", en: "BOQ & Contract Documents", nl: "Bestek, BOQ & contract" },
  { code: "05", en: "Method Statements & Procedures", nl: "Werkmethoden & procedures" },
  { code: "06", en: "Material Submittals", nl: "Materiaalgoedkeuringen" },
  { code: "07", en: "Shop Drawings", nl: "Werkplaatstekeningen" },
  { code: "08", en: "Permits & Certificates", nl: "Vergunningen & certificaten" },
  { code: "09", en: "Correspondence", nl: "Correspondentie" },
  { code: "10", en: "HSE & Environmental Documents", nl: "HSE- & milieudocumenten" },
  { code: "11", en: "Testing & Commissioning", nl: "Testen & inbedrijfstelling" },
  { code: "12", en: "Handover & Close-out", nl: "Oplevering & afsluiting" },
  { code: "13", en: "Other Project Documents", nl: "Overige projectdocumenten" },
]);

/** Suggested statuses (4.3). Meanings and authority are confirmed with CODECO. */
export const documentStatuses = Object.freeze([
  { id: "draft", en: "Draft / Internal", nl: "Concept / intern", tone: "neutral" },
  { id: "submitted", en: "Submitted", nl: "Ingediend", tone: "blue" },
  { id: "under_review", en: "Under Review", nl: "In beoordeling", tone: "amber" },
  { id: "approved", en: "Approved", nl: "Goedgekeurd", tone: "green" },
  { id: "approved_with_comments", en: "Approved with Comments", nl: "Goedgekeurd met opmerkingen", tone: "green" },
  { id: "revise_resubmit", en: "Revise and Resubmit", nl: "Aanpassen en opnieuw indienen", tone: "red" },
  { id: "rejected", en: "Rejected", nl: "Afgewezen", tone: "red" },
  { id: "for_information", en: "For Information", nl: "Ter informatie", tone: "neutral" },
  { id: "for_construction", en: "Issued for Construction", nl: "Vrijgegeven voor uitvoering", tone: "green" },
  { id: "superseded", en: "Superseded", nl: "Vervangen", tone: "neutral" },
  { id: "withdrawn", en: "Withdrawn", nl: "Ingetrokken", tone: "neutral" },
]);

/** What an uploader without review rights may give a new revision; the database enforces it. */
export const uploaderStatuses = Object.freeze(["draft", "submitted", "for_information"]);
/** What a reviewer can set on a current revision. */
export const reviewerStatuses = Object.freeze(["under_review", "approved", "approved_with_comments", "revise_resubmit", "rejected", "for_information", "for_construction", "withdrawn"]);
/** A reason is required for these (the database refuses an empty one). */
export const statusesNeedingReason = Object.freeze(["rejected", "revise_resubmit", "withdrawn"]);

export const documentTypes = Object.freeze([
  { id: "drawing", en: "Drawing", nl: "Tekening" },
  { id: "specification", en: "Specification", nl: "Specificatie" },
  { id: "schedule", en: "Schedule", nl: "Planning" },
  { id: "report", en: "Report", nl: "Rapport" },
  { id: "method_statement", en: "Method statement", nl: "Werkmethode" },
  { id: "certificate", en: "Certificate", nl: "Certificaat" },
  { id: "correspondence", en: "Correspondence", nl: "Correspondentie" },
  { id: "contract", en: "Contract / BOQ", nl: "Contract / BOQ" },
  { id: "submittal", en: "Submittal", nl: "Indiening" },
  { id: "other", en: "Other", nl: "Overig" },
]);

/** The project's folders: its own list when configured, otherwise 00-13. */
export function documentFoldersFor(configured) {
  if (!Array.isArray(configured) || configured.length === 0) return defaultDocumentFolders;
  const valid = configured
    .filter((folder) => folder && typeof folder.code === "string" && /^[0-9A-Za-z][0-9A-Za-z_-]{0,15}$/.test(folder.code))
    .map((folder) => ({ code: folder.code, en: String(folder.en || folder.name || folder.code), nl: String(folder.nl || folder.name || folder.en || folder.code) }));
  return valid.length ? valid : defaultDocumentFolders;
}

export function statusMeta(id) {
  return documentStatuses.find((status) => status.id === id) ?? { id, en: id, nl: id, tone: "neutral" };
}

/** A register row joins the document with its current revision. */
export function registerRows(documents, revisions) {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const byDocument = new Map();
  for (const revision of revisions) {
    const list = byDocument.get(revision.document_id) ?? [];
    list.push(revision);
    byDocument.set(revision.document_id, list);
  }
  return documents.map((document) => {
    const history = (byDocument.get(document.id) ?? []).slice().sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
    const current = byId.get(document.current_revision_id) ?? history[0] ?? null;
    return { document, current, history };
  });
}

function matchesSearch(row, needle) {
  if (!needle) return true;
  const haystack = [
    row.document.document_number, row.document.title, row.document.discipline, row.document.originator_name,
    row.current?.revision, row.current?.transmittal_ref, row.fileName,
  ].filter(Boolean).join(" ").toLowerCase();
  return needle.split(/\s+/).every((part) => haystack.includes(part));
}

/** Search by number, title, keyword or file name; filter by folder, discipline, building,
 * originator, status, revision and date range (4.4). */
export function filterRegister(rows, filters = {}) {
  const needle = String(filters.search ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (!matchesSearch(row, needle)) return false;
    if (filters.folder && row.document.folder_code !== filters.folder) return false;
    if (filters.discipline && (row.document.discipline ?? "") !== filters.discipline) return false;
    if (filters.status && (row.current?.review_status ?? "") !== filters.status) return false;
    if (filters.originator && (row.document.originator_party_id ?? row.document.originator_name ?? "") !== filters.originator) return false;
    if (filters.building && !(row.document.building_ids ?? []).includes(filters.building)) return false;
    if (filters.revision && (row.current?.revision ?? "").toLowerCase() !== String(filters.revision).toLowerCase()) return false;
    const received = String(row.current?.uploaded_at ?? row.document.created_at ?? "").slice(0, 10);
    if (filters.from && received && received < filters.from) return false;
    if (filters.to && received && received > filters.to) return false;
    return true;
  });
}

/** Sort by number, title, received date, revision or status (4.4). */
export function sortRegister(rows, key = "number", direction = "asc") {
  const value = (row) => {
    if (key === "title") return row.document.title ?? "";
    if (key === "received") return String(row.current?.uploaded_at ?? row.document.created_at ?? "");
    if (key === "revision") return row.current?.revision ?? "";
    if (key === "status") return row.current?.review_status ?? "";
    return row.document.document_number ?? row.document.title ?? "";
  };
  const sorted = rows.slice().sort((a, b) => value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: "base" }));
  return direction === "desc" ? sorted.reverse() : sorted;
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  // A leading =, +, - or @ makes Excel run the cell as a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The register as CSV for Excel: one row per document, current revision. */
/**
 * @param {any[]} rows
 * @param {{ language?: string, folders?: ReadonlyArray<{ code: string, en: string, nl: string }>, buildingName?: (id: string) => string, partyName?: (id: string) => string }} [options]
 */
export function registerCsv(rows, options = {}) {
  const { language = "en", folders = defaultDocumentFolders, buildingName = () => "", partyName = () => "" } = options;
  const header = language === "nl"
    ? ["Documentnummer", "Titel", "Map", "Discipline", "Type", "Gebouw", "Opsteller", "Revisie", "Status", "Datum document", "Ontvangen", "Transmittal", "Revisies"]
    : ["Document number", "Title", "Folder", "Discipline", "Type", "Building", "Originator", "Revision", "Status", "Issue date", "Received", "Transmittal", "Revisions"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    const folder = folders.find((item) => item.code === row.document.folder_code);
    const status = statusMeta(row.current?.review_status ?? "");
    lines.push([
      row.document.document_number ?? "",
      row.document.title,
      folder ? `${folder.code} ${language === "nl" ? folder.nl : folder.en}` : row.document.folder_code,
      row.document.discipline ?? "",
      row.document.document_type ?? "",
      (row.document.building_ids ?? []).map(buildingName).filter(Boolean).join(" / "),
      row.document.originator_party_id ? partyName(row.document.originator_party_id) : row.document.originator_name ?? "",
      row.current?.revision ?? "",
      language === "nl" ? status.nl : status.en,
      row.current?.issue_date ?? "",
      String(row.current?.uploaded_at ?? "").slice(0, 10),
      row.current?.transmittal_ref ?? "",
      row.history.length,
    ].map(csvCell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** The next revision mark after the current one: A→B, 0→1, Rev.02→Rev.03; otherwise empty. */
export function suggestNextRevision(current) {
  const value = String(current ?? "").trim();
  if (!value) return "A";
  const numeric = value.match(/^(.*?)(\d+)$/);
  if (numeric) {
    const next = String(Number(numeric[2]) + 1).padStart(numeric[2].length, "0");
    return `${numeric[1]}${next}`;
  }
  if (/^[A-Y]$/i.test(value)) return String.fromCharCode(value.charCodeAt(0) + 1);
  return "";
}
