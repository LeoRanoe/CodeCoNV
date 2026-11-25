/**
 * Report builder (Word 11.1): the quick periods and the report types with the forms they pre-select.
 * Pure functions on YYYY-MM-DD project-local days.
 */

export const reportPresets = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month"];

const pad = (value) => String(value).padStart(2, "0");
const toDay = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const fromDay = (day) => new Date(`${day}T12:00:00Z`);

/** A project-local day moved by a number of days. */
export function addReportDays(day, days) {
  const date = fromDay(day);
  date.setUTCDate(date.getUTCDate() + days);
  return toDay(date);
}

/** Monday (ISO week start) of the week the day is in. */
export function weekStart(day) {
  const date = fromDay(day);
  const weekday = (date.getUTCDay() + 6) % 7;
  return addReportDays(day, -weekday);
}

/** The period a quick preset stands for, relative to `today` (YYYY-MM-DD). Weeks run Monday to Sunday. */
export function reportPresetRange(preset, today) {
  if (preset === "today") return { start: today, end: today };
  if (preset === "yesterday") { const day = addReportDays(today, -1); return { start: day, end: day }; }
  if (preset === "this_week") { const start = weekStart(today); return { start, end: addReportDays(start, 6) < today ? addReportDays(start, 6) : today }; }
  if (preset === "last_week") { const start = addReportDays(weekStart(today), -7); return { start, end: addReportDays(start, 6) }; }
  if (preset === "this_month") return { start: `${today.slice(0, 8)}01`, end: today };
  if (preset === "last_month") {
    const first = fromDay(`${today.slice(0, 8)}01`);
    first.setUTCMonth(first.getUTCMonth() - 1);
    const start = toDay(first);
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
    return { start, end: toDay(last) };
  }
  throw new Error(`Unknown report preset: ${preset}`);
}

/** The forms (option ids of the builder) every report type includes by default. */
const allForms = ["photos", "works_ongoing", "works_completed", "workforce", "delays", "issues", "hse", "materials_delivery", "inspections", "technical_instructions", "change_order", "ncr", "deadlines", "hse_incident", "agreements_made"];

export const reportTypes = [
  { id: "daily", en: "Daily Supervision Report", nl: "Dagrapport supervisie", forms: allForms, preset: "day" },
  { id: "weekly", en: "Weekly Progress Report", nl: "Weekrapport voortgang", forms: allForms, preset: "week" },
  { id: "monthly", en: "Monthly Progress Report", nl: "Maandrapport voortgang", forms: allForms, preset: "month" },
  { id: "quality", en: "Quality Report / NCR Summary", nl: "Kwaliteitsrapport / NCR-overzicht", forms: ["inspections", "ncr", "issues", "photos", "deadlines"] },
  { id: "inspection", en: "Inspection Report", nl: "Inspectierapport", forms: ["inspections", "photos", "ncr"] },
  { id: "hse", en: "HSE Report and Incident Summary", nl: "HSE-rapport en incidentoverzicht", forms: ["hse", "hse_incident", "photos", "deadlines"] },
  { id: "delay", en: "Delay Analysis / Schedule Status", nl: "Vertragingsanalyse / planningsstatus", forms: ["delays", "works_ongoing", "works_completed"] },
  { id: "workforce", en: "Workforce / Manpower Report", nl: "Bezettingsrapport", forms: ["workforce"] },
  { id: "materials", en: "Materials Delivery Report", nl: "Leveringsrapport materialen", forms: ["materials_delivery", "inspections"] },
  { id: "change_orders", en: "Change Order Register", nl: "Register wijzigingsopdrachten", forms: ["change_order", "technical_instructions"] },
  { id: "photos", en: "Photo Report", nl: "Fotorapport", forms: ["photos"] },
  // Word 11.2, the report types that read across several forms.
  { id: "contractor_performance", en: "Contractor Performance Summary", nl: "Prestatieoverzicht aannemer", forms: ["workforce", "works_completed", "delays", "inspections", "ncr", "issues", "hse", "deadlines"] },
  { id: "actions", en: "Action Register / Overdue Actions", nl: "Actieregister / achterstallige acties", forms: ["deadlines", "issues", "ncr", "hse", "delays"] },
  { id: "documents", en: "Document Register / Outstanding Submittals", nl: "Documentregister / openstaande indieningen", forms: ["document_register", "technical_instructions", "change_order"] },
];

/** The report sections each form belongs to (what the period report prints for that form). */
export const formSections = {
  photos: ["visual"], works_ongoing: ["work"], works_completed: ["work"], workforce: ["workforce"], delays: ["logistics"],
  issues: ["quality"], hse: ["hse"], materials_delivery: ["logistics"], inspections: ["quality"], technical_instructions: ["instructions"],
  change_order: ["commercial"], ncr: ["quality"], deadlines: ["actions"], hse_incident: ["hse"], agreements_made: ["communications"],
  document_register: ["documents"],
};

export const reportTypeSections = (id) => [...new Set(reportTypeFormsOf(id).flatMap((form) => formSections[form] ?? []))];
const reportTypeFormsOf = (id) => reportTypes.find((type) => type.id === id)?.forms ?? allForms;

/** Whether the builder offers the type (id) and which forms it pre-selects. */
export const reportTypeForms = (id) => reportTypes.find((type) => type.id === id)?.forms ?? allForms;

/** The rows that are still open although they began before the period (Word 11.1, "open from before"). */
const stillOpen = {
  findings: (row) => !["closed", "cancelled"].includes(row.status),
  hse_events: (row) => !["closed", "cancelled", "resolved"].includes(row.status),
  register_entries: (row) => !["closed", "cancelled", "draft", "resolved", "completed"].includes(row.status),
  inspections: (row) => ["planned", "in_progress", "failed", "ready_for_reinspection"].includes(row.status),
};

/**
 * The snapshot of a period plus what was opened earlier and is still open, each marked `details.carried_over`.
 * `open` holds the project's current records per kind; a record already in the period is not added twice.
 * @template {Record<string, any>} T
 * @param {T} snapshot
 * @param {Record<string, Array<Record<string, any>>>} open
 * @param {string} start first day of the period (YYYY-MM-DD)
 * @returns {T}
 */
export function addOpenFromBefore(snapshot, open, start) {
  /** @type {Record<string, any>} */
  const next = { ...snapshot };
  for (const [kind, isOpen] of Object.entries(stillOpen)) {
    const present = new Set((snapshot[kind] ?? []).map((row) => row.id));
    const earlier = (open[kind] ?? [])
      .filter((row) => row.id && !present.has(row.id) && isOpen(row) && String(row.created_at ?? "").slice(0, 10) < start)
      .map((row) => ({ ...row, details: { ...(row.details && typeof row.details === "object" && !Array.isArray(row.details) ? row.details : {}), carried_over: "Open sinds vóór deze periode" } }));
    if (earlier.length) next[kind] = [...(snapshot[kind] ?? []), ...earlier];
  }
  return /** @type {T} */ (next);
}
