import { reportWorkbook } from "./register-xlsx.mjs";
import { groupCounts, groupReportLines, reportGroupingLabels, reportRecordLines, snapshotLookup } from "./report-structure.mjs";

/**
 * Decision #13 (21-11-2026, Word 4.4 and 11 "PDF/Excel exports must respect permissions"): every
 * period report (daily, weekly, monthly and the topic reports) also downloads as a native Excel
 * workbook with one sheet per section, from the same permission-scoped snapshot and filters as its
 * PDF and Word versions. Each sheet states the period, cut-off, filters and generation time.
 */
const sections = [
  { key: "day_reports", en: "Day reports", nl: "Dagrapporten", columns: ["report_date", "building_id", "status", "submitted_at", "approved_at"] },
  { key: "attendance", en: "Workforce", nl: "Bezetting", columns: ["work_date", "report_date", "building_id", "party_id", "trade", "discipline", "role", "headcount", "hours"] },
  { key: "inspections", en: "Inspections", nl: "Inspecties", columns: ["inspection_number", "title", "building_id", "status", "result", "scheduled_at", "completed_at"] },
  { key: "findings", en: "NCRs and issues", nl: "NCR's en issues", columns: ["finding_number", "finding_type", "title", "building_id", "severity", "priority", "status", "responsible_party_id", "due_at", "closed_at"] },
  { key: "hse_events", en: "HSE", nl: "HSE", columns: ["event_number", "event_type", "title", "building_id", "severity", "status", "occurred_at"] },
  { key: "register_entries", en: "Register records", nl: "Registerrecords", columns: ["entry_number", "register_type", "title", "building_id", "status", "created_at"] },
  { key: "open_actions", en: "Open actions", nl: "Open acties", columns: ["action_number", "title", "building_id", "owner_party_id", "priority", "status", "due_at"] },
];

const label = (key) => key.replace(/_id$/, "").replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());

/**
 * @param {Record<string, any>} snapshot  PeriodReportSnapshot
 * @param {{ language?: "en" | "nl" }} [options]
 */
export function periodReportSheets(snapshot, { language = "en" } = {}) {
  const names = new Map([...(snapshot.buildings ?? []), ...(snapshot.parties ?? [])].map((item) => [String(item.id), String(item.name ?? item.code ?? item.id)]));
  return sections.map((section) => {
    const rows = Array.isArray(snapshot[section.key]) ? snapshot[section.key] : [];
    const columns = section.columns.filter((column) => rows.some((row) => row?.[column] !== undefined && row?.[column] !== null && row?.[column] !== ""));
    const used = columns.length ? columns : section.columns.slice(0, 3);
    return {
      name: section[language] ?? section.en,
      headers: used.map(label),
      rows: rows.map((row) => used.map((column) => {
        const value = row?.[column];
        if (value === null || value === undefined) return "";
        if (column.endsWith("_id")) return names.get(String(value)) ?? String(value);
        if (typeof value === "number") return value;
        return typeof value === "object" ? JSON.stringify(value) : String(value);
      })),
    };
  });
}

/** The sheets that organise the records: the summary (counts per group and form) or the grouped list of every record. */
export function structureSheets(snapshot, { language = "en", groupBy = "none", detail = "full" } = {}) {
  const nl = language === "nl";
  const groups = groupReportLines(reportRecordLines(snapshot, snapshotLookup(snapshot, language)), detail === "summary" && groupBy === "none" ? "form" : groupBy);
  const groupName = reportGroupingLabels[detail === "summary" && groupBy === "none" ? "form" : groupBy]?.[language] ?? "";
  const result = [];
  if (detail === "summary" || groupBy !== "none") {
    result.push({
      name: nl ? "Samenvatting" : "Summary",
      headers: [groupName || (nl ? "Groep" : "Group"), nl ? "Formulier" : "Form", nl ? "Aantal" : "Count"],
      rows: groups.flatMap((group) => groupCounts(group).map((item) => [group.label, item.form, item.count])),
    });
  }
  if (groupBy !== "none") {
    result.push({
      name: nl ? "Gegroepeerd" : "Grouped",
      headers: [groupName, nl ? "Formulier" : "Form", nl ? "Nummer" : "Number", nl ? "Titel" : "Title", "Status", nl ? "Datum" : "Date", nl ? "Gebouw" : "Building", nl ? "Aannemer" : "Contractor", nl ? "Eerder geopend" : "Carried over"],
      rows: groups.flatMap((group) => group.lines.map((line) => [group.label, line.form, line.code, line.title, line.status, line.date, line.building, line.contractor, line.carriedOver ? (nl ? "Ja" : "Yes") : ""])),
    });
  }
  return result;
}

/**
 * The extra sheets of the builder options: contractor responses, the sign-off log and the photos (as real pictures).
 * @param {{ language?: "en" | "nl", responses?: any[], signoffLog?: Array<{ code: string, title: string, history: Array<{ line: string, comments: string }> }>, photos?: Array<{ code: string, caption: string, building: string, date: string, bytes: Uint8Array, width: number, height: number }> }} extra
 */
export function optionSheets({ language = "en", responses = [], signoffLog = [], photos = [] } = {}) {
  const nl = language === "nl";
  const result = [];
  if (responses.length) {
    result.push({
      name: nl ? "Reacties aannemers" : "Contractor responses",
      headers: [nl ? "Nummer" : "Number", nl ? "Titel" : "Title", nl ? "Actie" : "Action", nl ? "Door" : "By", nl ? "Datum" : "Date", nl ? "Toelichting" : "Comments"],
      rows: responses.flatMap((record) => record.responses.map((item) => [record.code, record.title, item.action, item.by, item.at, item.comments])),
    });
  }
  if (signoffLog.length) {
    result.push({
      name: nl ? "Ondertekeningslog" : "Sign-off log",
      headers: [nl ? "Nummer" : "Number", nl ? "Titel" : "Title", nl ? "Stap" : "Step", nl ? "Toelichting" : "Comments"],
      rows: signoffLog.flatMap((entry) => entry.history.map((step) => [entry.code, entry.title, step.line, step.comments])),
    });
  }
  if (photos.length) {
    result.push({
      name: nl ? "Foto's" : "Photos",
      headers: [nl ? "Nummer" : "Number", nl ? "Omschrijving" : "Caption", nl ? "Gebouw" : "Building", nl ? "Datum" : "Date", nl ? "Foto" : "Photo"],
      rows: photos.map((photo) => [photo.code, photo.caption, photo.building, photo.date, ""]),
      images: photos.map((photo, index) => ({ row: index, column: 4, bytes: photo.bytes, extension: "jpeg", width: photo.width, height: photo.height, name: photo.code })),
    });
  }
  return result;
}

/**
 * @param {Record<string, any>} snapshot
 * @param {{ title: string, language?: "en" | "nl", filters?: string, cutoff?: string, groupBy?: string, detail?: string, responses?: any[], signoffLog?: any[], photos?: any[] }} options
 */
export async function periodReportWorkbook(snapshot, { title, language = "en", filters = "", cutoff = "", groupBy = "none", detail = "full", responses = [], signoffLog = [], photos = [] }) {
  const nl = language === "nl";
  const metadata = [
    `${nl ? "Periode" : "Period"}: ${snapshot.period?.start_date ?? ""} – ${snapshot.period?.end_date ?? ""}`,
    `${nl ? "Peildatum" : "Data cut-off"}: ${cutoff || snapshot.generated_at || ""}`,
    `${nl ? "Filters" : "Filters"}: ${filters || (nl ? "geen" : "none")}`,
    `${nl ? "Weergave" : "Detail"}: ${detail === "summary" ? (nl ? "samenvatting" : "summary") : (nl ? "volledig" : "full")}${groupBy !== "none" ? `; ${nl ? "gegroepeerd op" : "grouped by"} ${reportGroupingLabels[groupBy]?.[language] ?? groupBy}` : ""}`,
    `${nl ? "Gegenereerd" : "Generated"}: ${snapshot.generated_at ?? new Date().toISOString()}`,
  ];
  const record = periodReportSheets(snapshot, { language });
  const structure = structureSheets(snapshot, { language, groupBy, detail });
  const openActions = record.filter((sheet) => sheet.name === (nl ? "Open acties" : "Open actions"));
  const sheets = detail === "summary"
    ? [...structure, ...openActions]
    : [...record, ...structure, ...optionSheets({ language, responses, signoffLog, photos })];
  return reportWorkbook({ title, metadata, sheets });
}
