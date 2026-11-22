import { reportWorkbook } from "./register-xlsx.mjs";

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
 * @param {{ title: string, language?: "en" | "nl", filters?: string, cutoff?: string }} options
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

export async function periodReportWorkbook(snapshot, { title, language = "en", filters = "", cutoff = "" }) {
  const nl = language === "nl";
  const metadata = [
    `${nl ? "Periode" : "Period"}: ${snapshot.period?.start_date ?? ""} – ${snapshot.period?.end_date ?? ""}`,
    `${nl ? "Peildatum" : "Data cut-off"}: ${cutoff || snapshot.generated_at || ""}`,
    `${nl ? "Filters" : "Filters"}: ${filters || (nl ? "geen" : "none")}`,
    `${nl ? "Gegenereerd" : "Generated"}: ${snapshot.generated_at ?? new Date().toISOString()}`,
  ];
  return reportWorkbook({ title, metadata, sheets: periodReportSheets(snapshot, { language }) });
}
