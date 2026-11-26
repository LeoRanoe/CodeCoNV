/**
 * Form Logs (developer specification v5.0, sheet "Form Logs"; Word 5.4): one logbook per form
 * type with the default columns of the sheet, filters, totals and an export. A log is a live view
 * of the stored records: nothing is re-entered, drafts are not in it. Pure functions over the
 * project snapshot; the screen is app/form-logs.tsx.
 */
import { formTabOrder } from "../forms/record-defaults.mjs";

const str = (value) => (value === null || value === undefined ? "" : String(value).trim());
const spec = (record) => {
  const found = record?.issue_management?.spec ?? record?.details?.spec ?? record?.spec;
  return found && typeof found === "object" && !Array.isArray(found) ? found : {};
};
const first = (...values) => values.map(str).find(Boolean) ?? "";
const list = (value) => (Array.isArray(value) ? value.map(str).filter(Boolean) : str(value) ? [str(value)] : []);
const dayOf = (value) => str(value).slice(0, 10);
const quantity = (s) => (str(s.quantity) ? `${s.quantity}${str(s.quantity_unit) ? ` ${s.quantity_unit}` : ""}` : "");
const number = (value) => {
  const parsed = Number(str(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Statuses that mean the record no longer needs follow-up. */
const closedStatuses = new Set(["closed", "cancelled", "approved", "rejected", "completed", "resolved", "verified"]);
export const isClosedStatus = (status) => closedStatuses.has(str(status).toLowerCase());

export function daysOpen(record, status, nowIso) {
  if (isClosedStatus(status)) return "";
  const from = dayOf(record?.created_at ?? record?.occurred_at);
  const now = dayOf(nowIso ?? new Date().toISOString());
  if (!from || !now) return "";
  return String(Math.max(0, Math.round((Date.parse(now) - Date.parse(from)) / 86_400_000)));
}

const column = (key, en, nl, get) => ({ key, label: { en, nl }, get });

/** A row of one log: the stored record plus the cells of the columns of its form. */
const issueColumns = [
  column("id", "Issue ID", "Issue-ID", (r) => r.finding_number),
  column("date", "Date identified", "Datum vastgesteld", (r, s) => first(s.identified_at, r.created_at)),
  column("title", "Title", "Titel", (r) => r.title),
  column("type", "Type", "Soort", (r, s) => s.issue_type),
  column("category", "Category", "Categorie", (r, s) => s.issue_category),
  column("discipline", "Discipline", "Discipline", (r, s) => s.discipline),
  column("location", "Location", "Locatie", (r, s, c) => c.location(r, s)),
  column("priority", "Priority", "Prioriteit", (r, s) => first(s.priority, r.severity)),
  column("party", "Responsible party", "Verantwoordelijke partij", (r, s, c) => first(s.responsible_party, c.party(r))),
  column("person", "Responsible person", "Verantwoordelijke persoon", (r, s) => first(s.responsible_person, r.issue_management?.responsible_person)),
  column("target", "Target date", "Streefdatum", (r, s) => first(s.target_date, r.due_date)),
  column("status", "Status", "Status", (r) => r.status),
  column("open", "Days open", "Dagen open", (r, s, c) => daysOpen(r, r.status, c.now)),
];

const ncrColumns = [
  column("id", "NCR no.", "NCR-nr.", (r) => r.finding_number),
  column("date", "Date raised", "Datum gemeld", (r, s) => first(s.raised_at, r.created_at)),
  column("title", "Title", "Titel", (r) => r.title),
  column("type", "Type", "Soort", (r, s) => s.ncr_type),
  column("category", "Category", "Categorie", (r, s) => s.ncr_category),
  column("discipline", "Discipline", "Discipline", (r, s) => s.discipline),
  column("location", "Location", "Locatie", (r, s, c) => c.location(r, s)),
  column("severity", "Severity", "Ernst", (r, s) => first(s.severity, r.severity)),
  column("detected", "Detected during", "Vastgesteld tijdens", (r, s) => s.detected_during),
  column("inspection", "Related inspection", "Gekoppelde inspectie", (r, s) => s.related_inspection),
  column("disposition", "Disposition", "Dispositie", (r, s) => s.disposition),
  column("owner", "Action owner", "Actiehouder", (r, s) => s.action_owner),
  column("target", "Target date", "Streefdatum", (r, s) => first(s.target_date, r.due_date)),
  column("status", "Status", "Status", (r) => r.status),
  column("open", "Days open", "Dagen open", (r, s, c) => daysOpen(r, r.status, c.now)),
];

const hseColumns = [
  column("id", "HSE ID", "HSE-ID", (r) => r.event_number),
  column("date", "Date observed", "Datum waargenomen", (r, s) => first(s.observed_at, r.occurred_at, r.created_at)),
  column("title", "Title", "Titel", (r) => r.title),
  column("type", "Type", "Soort", (r, s) => s.hse_type),
  column("category", "Category", "Categorie", (r, s) => s.hse_category),
  column("location", "Location", "Locatie", (r, s, c) => c.location(r, s)),
  column("contractor", "Contractor involved", "Betrokken aannemer", (r, s) => s.person_involved),
  column("rating", "Risk rating", "Risicoklasse", (r, s) => s.risk_rating),
  column("owner", "Action owner", "Actiehouder", (r, s) => s.action_owner),
  column("due", "Due date", "Uiterste datum", (r, s) => first(s.due_date, r.due_date)),
  column("status", "Status", "Status", (r) => r.status),
  column("open", "Days open", "Dagen open", (r, s, c) => daysOpen(r, r.status, c.now)),
];

const incidentColumns = [
  column("id", "Incident ID", "Incident-ID", (r) => r.event_number),
  column("date", "Incident date/time", "Datum/tijd incident", (r, s) => first(s.incident_at, r.occurred_at, r.created_at)),
  column("title", "Title", "Titel", (r) => r.title),
  column("type", "Type", "Soort", (r, s) => s.incident_type),
  column("category", "Category", "Categorie", (r, s) => s.incident_category),
  column("location", "Location", "Locatie", (r, s, c) => c.location(r, s)),
  column("injury", "Injury classification", "Classificatie letsel", (r, s, c) => (c.sensitive ? s.injury_classification : "")),
  column("severity", "Severity", "Ernst", (r, s) => s.incident_severity),
  column("investigation", "Investigation required", "Onderzoek nodig", (r, s) => s.investigation_required),
  column("authorities", "Authorities notified", "Autoriteiten gemeld", (r, s) => s.authorities_notified),
  column("status", "Status", "Status", (r) => r.status),
];

const registerColumns = {
  works_ongoing: [
    column("date", "Date", "Datum", (r, s) => first(s.report_date, r.occurred_at, r.created_at)),
    column("id", "Record ID", "Registratie-ID", (r) => r.entry_number),
    column("title", "Title", "Titel", (r) => r.title),
    column("shift", "Shift", "Dienst", (r, s) => s.shift),
    column("weather", "Weather", "Weer", (r, s) => first(s.weather, r.details?.weather)),
    column("discipline", "Discipline", "Discipline", (r, s) => s.discipline),
    column("activity", "Activity", "Activiteit", (r, s) => s.activity),
    column("location", "Building / level / location", "Gebouw / niveau / locatie", (r, s, c) => c.location(r, s)),
    column("quantity", "Quantity + unit", "Hoeveelheid + eenheid", (r, s) => quantity(s)),
    column("progress", "Progress status", "Voortgangsstatus", (r, s) => s.progress_status),
    column("percent", "Progress %", "Voortgang %", (r, s) => s.progress_percent),
    column("crew", "Contractor / crew", "Aannemer / ploeg", (r, s) => list(s.crew).join(", ")),
    column("blocker", "Blocker", "Belemmering", (r, s) => s.blocker),
    column("by", "Reported by", "Gemeld door", (r, s, c) => c.author(r)),
  ],
  works_completed: [
    column("date", "Completion date", "Datum gereed", (r, s) => first(s.completion_date, r.occurred_at, r.created_at)),
    column("id", "Record ID", "Registratie-ID", (r) => r.entry_number),
    column("title", "Title", "Titel", (r) => r.title),
    column("discipline", "Discipline", "Discipline", (r, s) => s.discipline),
    column("activity", "Activity", "Activiteit", (r, s) => s.activity),
    column("location", "Location", "Locatie", (r, s, c) => c.location(r, s)),
    column("quantity", "Quantity + unit", "Hoeveelheid + eenheid", (r, s) => quantity(s)),
    column("status", "Completion / inspection status", "Status gereed / keuring", (r, s) => s.inspection_status),
    column("linked", "Linked WO", "Gekoppeld WO", (r, s) => first(s.works_ongoing_record, s.based_on)),
    column("inspection", "Inspection ref.", "Inspectieref.", (r, s) => s.inspection_reference),
    column("crew", "Contractor", "Aannemer", (r, s) => list(s.crew).join(", ")),
    column("outstanding", "Outstanding work", "Openstaand werk", (r, s) => s.outstanding),
  ],
  delay_report: [
    column("id", "PDR no.", "PDR-nr.", (r) => r.entry_number),
    column("start", "Delay start", "Begin vertraging", (r, s) => first(s.delay_start_at, r.occurred_at)),
    column("activity", "Affected activity", "Getroffen activiteit", (r, s) => first(s.affected_activity, s.affected_activity_text)),
    column("location", "Location", "Locatie", (r, s, c) => c.location(r, s)),
    column("cause", "Cause type", "Soort oorzaak", (r, s) => s.delay_cause_type),
    column("category", "Cause category", "Categorie oorzaak", (r, s) => s.delay_cause_category),
    column("party", "Responsible party", "Verantwoordelijke partij", (r, s, c) => first(s.responsible_party, c.party(r))),
    column("duration", "Duration + unit", "Duur + eenheid", (r, s) => (str(s.delay_duration) ? `${s.delay_duration} ${str(s.duration_unit)}`.trim() : "")),
    column("critical", "Critical path impact", "Impact kritiek pad", (r, s) => s.critical_path),
    column("owner", "Action owner", "Actiehouder", (r, s) => s.action_owner),
    column("recovery", "Target recovery date", "Streefdatum herstel", (r, s) => s.target_recovery_date),
    column("status", "Status", "Status", (r) => r.status),
  ],
  delivery: [
    column("id", "Delivery ID", "Leverings-ID", (r) => r.entry_number),
    column("date", "Date/time", "Datum/tijd", (r, s) => first(s.delivery_at, r.occurred_at, r.created_at)),
    column("supplier", "Supplier", "Leverancier", (r, s) => s.supplier),
    column("po", "PO", "Inkooporder", (r, s) => s.purchase_order),
    column("note", "Delivery note no.", "Pakbonnr.", (r, s) => s.delivery_note_number),
    column("material", "Material group / category", "Materiaalgroep / categorie", (r, s) => [s.material_group, s.material_category].map(str).filter(Boolean).join(" / ")),
    column("description", "Description", "Omschrijving", (r, s) => s.material_specification),
    column("quantity", "Ordered / delivered + unit", "Besteld / geleverd + eenheid", (r, s) => `${str(s.ordered_quantity)} / ${str(s.delivered_quantity)} ${str(s.unit)}`.trim()),
    column("delivery", "Delivery status", "Leveringsstatus", (r, s) => s.delivery_status),
    column("condition", "Condition", "Staat", (r, s) => s.arrival_condition),
    column("inspection", "Inspection result", "Resultaat keuring", (r, s) => s.inspection_result),
    column("storage", "Storage location", "Opslaglocatie", (r, s) => s.storage_location),
    column("by", "Received by", "Ontvangen door", (r, s) => first(s.received_by, r.signed_by)),
  ],
  technical_instruction: [
    column("id", "TI ID", "TI-ID", (r) => r.entry_number),
    column("date", "Date", "Datum", (r, s) => first(s.instruction_date, r.occurred_at, r.created_at)),
    column("title", "Title", "Titel", (r) => r.title),
    column("type", "Type", "Soort", (r, s) => s.instruction_type),
    column("discipline", "Discipline", "Discipline", (r, s) => s.discipline),
    column("category", "Category", "Categorie", (r, s) => s.instruction_category),
    column("location", "Location", "Locatie", (r, s, c) => c.location(r, s)),
    column("to", "Issued to", "Uitgegeven aan", (r, s) => s.issued_to),
    column("owner", "Action owner", "Actiehouder", (r, s) => s.action_owner),
    column("by", "Response required by", "Antwoord vereist voor", (r, s) => s.response_required_by),
    column("ack", "Acknowledged (date)", "Ontvangst bevestigd (datum)", (r, s) => s.acknowledged_by),
    column("status", "Status", "Status", (r) => r.status),
  ],
  change_order: [
    column("id", "CO ID", "CO-ID", (r) => r.entry_number),
    column("date", "Request date", "Datum aanvraag", (r, s) => first(s.request_date, r.occurred_at, r.created_at)),
    column("title", "Title", "Titel", (r) => r.title),
    column("type", "Type", "Soort", (r, s) => s.change_type),
    column("category", "Category", "Categorie", (r, s) => s.change_category),
    column("originator", "Originator", "Aanvrager", (r, s) => s.originator),
    column("cost", "Cost impact + currency", "Kostenimpact + valuta", (r, s) => (str(s.cost_impact) ? `${s.cost_impact} ${str(s.cost_currency)}`.trim() : "")),
    column("time", "Time impact", "Tijdsimpact", (r, s) => (str(s.time_impact) ? `${s.time_impact} ${str(s.time_impact_unit)}`.trim() : "")),
    column("approval", "Approval status", "Goedkeuringsstatus", (r, s) => first(s.approval_status, r.status)),
    column("approved", "Approved amount / days", "Goedgekeurd bedrag / dagen", (r, s) => [s.approved_amount, s.approved_days].map(str).filter(Boolean).join(" / ")),
    column("proceed", "Instruction to proceed", "Opdracht tot uitvoering", (r, s) => s.instruction_to_proceed),
  ],
  lessons_learned: [
    column("id", "Lesson ID", "Les-ID", (r) => r.entry_number),
    column("date", "Date recorded", "Datum vastgelegd", (r, s) => first(s.recorded_on, r.occurred_at, r.created_at)),
    column("title", "Title", "Titel", (r) => r.title),
    column("phase", "Project phase", "Projectfase", (r, s) => s.project_phase),
    column("category", "Category", "Categorie", (r, s) => s.lesson_category),
    column("applicability", "Applicability", "Toepasbaarheid", (r, s) => s.applicability),
    column("discipline", "Discipline", "Discipline", (r, s) => s.discipline),
    column("owner", "Action owner", "Actiehouder", (r, s) => s.action_owner),
    column("status", "Status", "Status", (r) => r.status),
  ],
  agreement: [
    column("id", "Agreement ID", "Afspraak-ID", (r) => r.entry_number),
    column("date", "Meeting date", "Datum overleg", (r, s) => first(s.agreement_at, r.occurred_at, r.created_at)),
    column("title", "Title", "Titel", (r) => r.title),
    column("source", "Meeting / source", "Overleg / bron", (r, s) => s.meeting_source),
    column("type", "Type", "Soort", (r, s) => s.agreement_type),
    column("category", "Category", "Categorie", (r, s) => s.agreement_category),
    column("agreed", "Agreed by", "Overeengekomen door", (r, s) => list(s.agreed_by).join(", ")),
    column("action", "Action required", "Actie nodig", (r, s) => s.action_required),
    column("owner", "Action owner", "Actiehouder", (r, s) => s.action_owner),
    column("due", "Due date", "Uiterste datum", (r, s) => s.due_date),
    column("ack", "Acknowledgements (x / y)", "Bevestigingen (x / y)", (r) => str(r.details?.acknowledgements_summary)),
    column("status", "Status", "Status", (r) => r.status),
  ],
};

const inspectionColumns = [
  column("id", "Inspection ID", "Inspectie-ID", (r) => r.inspection_number),
  column("date", "Date/time", "Datum/tijd", (r) => first(r.completed_at, r.started_at, r.planned_at)),
  column("type", "Type", "Soort", (r, s) => first(s.inspection_type, r.inspection_type)),
  column("category", "Category", "Categorie", (r, s) => s.inspection_category),
  column("discipline", "Discipline", "Discipline", (r, s) => s.discipline),
  column("activity", "Activity / material", "Activiteit / materiaal", (r, s) => first(s.related_record, s.work_activity)),
  column("location", "Location", "Locatie", (r, s, c) => c.location(r, s)),
  column("checklist", "Checklist + version", "Checklist + versie", (r, s) => [r.checklist_name ?? r.title, s.checklist_version].map(str).filter(Boolean).join(" v")),
  column("items", "Pass / fail items", "Geslaagd / gefaald", (r) => (r.pass_count !== undefined ? `${r.pass_count} / ${r.fail_count ?? 0}` : "")),
  column("result", "Result", "Resultaat", (r, s) => first(s.inspection_result, r.result, r.status)),
  column("reinspection", "Re-inspection date", "Datum herkeuring", (r, s) => s.reinspection_date),
  column("ncr", "NCR ref.", "NCR-ref.", (r, s) => s.ncr_reference),
  column("contractor", "Responsible contractor", "Verantwoordelijke aannemer", (r, s) => first(s.responsible_contractor, s.contractor_witness)),
  column("by", "Inspected by", "Gekeurd door", (r) => first(r.signed_by, r.inspector_name)),
];

const photoColumns = [
  column("date", "Date/time", "Datum/tijd", (r) => first(r.captured_at, r.created_at)),
  column("id", "Photo ID", "Foto-ID", (r, s, c) => c.photoCode(r)),
  column("thumb", "Thumbnail", "Miniatuur", (r) => r.file_id),
  column("purpose", "Purpose", "Doel", (r, s) => s.photo_purpose),
  column("category", "Category", "Categorie", (r) => r.category),
  column("discipline", "Work discipline", "Werkdiscipline", (r, s) => s.discipline),
  column("location", "Location (drawing pin)", "Locatie (tekeningpin)", (r, s, c) => c.location(r, s)),
  column("related", "Related record", "Gekoppelde registratie", (r, s) => s.related_record),
  column("caption", "Caption", "Onderschrift", (r) => first(r.description, r.title)),
  column("by", "Taken by", "Genomen door", (r, s, c) => c.author(r)),
];

const workforceColumns = [
  column("date", "Date", "Datum", (r) => r.date),
  column("id", "Record ID", "Registratie-ID", (r) => r.code),
  column("total", "Total workers", "Totaal werknemers", (r) => String(r.total)),
  column("disciplines", "Workers per discipline", "Werknemers per discipline", (r) => Object.entries(r.byDiscipline).map(([name, count]) => `${name}: ${count}`).join("; ")),
  column("contractors", "Workers per contractor", "Werknemers per aannemer", (r) => Object.entries(r.byContractor).map(([name, count]) => `${name}: ${count}`).join("; ")),
  column("remarks", "Remarks", "Opmerkingen", (r) => r.remarks),
  column("by", "Submitted by", "Ingediend door", (r) => r.by),
];

/** The default columns per log, in the order of the sheet. */
export const formLogColumns = {
  photo: photoColumns,
  works_ongoing: registerColumns.works_ongoing,
  works_completed: registerColumns.works_completed,
  workforce: workforceColumns,
  delay_report: registerColumns.delay_report,
  issue: issueColumns,
  hse: hseColumns,
  delivery: registerColumns.delivery,
  inspection: inspectionColumns,
  technical_instruction: registerColumns.technical_instruction,
  change_order: registerColumns.change_order,
  ncr: ncrColumns,
  lessons_learned: registerColumns.lessons_learned,
  agreement: registerColumns.agreement,
  hse_incident: incidentColumns,
};

export const formLogLabels = {
  photo: { en: "Photos", nl: "Foto's" },
  works_ongoing: { en: "Works Ongoing", nl: "Werk in uitvoering" },
  works_completed: { en: "Works Completed", nl: "Werk gereed" },
  workforce: { en: "Workforce", nl: "Personeel" },
  delay_report: { en: "Project Delay Report", nl: "Vertragingsrapport" },
  issue: { en: "Issues", nl: "Issues" },
  hse: { en: "HSE", nl: "HSE" },
  delivery: { en: "Materials Delivery", nl: "Materiaallevering" },
  inspection: { en: "Inspections", nl: "Inspecties" },
  technical_instruction: { en: "Technical Instructions", nl: "Technische instructies" },
  change_order: { en: "Change Order", nl: "Wijzigingsopdracht" },
  ncr: { en: "NCR", nl: "NCR" },
  lessons_learned: { en: "Lessons Learned", nl: "Lessen" },
  agreement: { en: "Agreements Made", nl: "Gemaakte afspraken" },
  hse_incident: { en: "HSE Incident", nl: "HSE-incident" },
};

/** Form-specific filters of the sheet: [filter key, column key it matches]. */
export const formLogFilters = {
  photo: [["purpose", "purpose"], ["category", "category"], ["discipline", "discipline"], ["location", "location"]],
  works_ongoing: [["discipline", "discipline"], ["activity", "activity"], ["location", "location"], ["contractor", "crew"], ["progress", "progress"]],
  works_completed: [["discipline", "discipline"], ["activity", "activity"], ["location", "location"], ["contractor", "crew"], ["status", "status"]],
  workforce: [],
  delay_report: [["cause", "cause"], ["party", "party"], ["critical", "critical"], ["status", "status"]],
  issue: [["type", "type"], ["category", "category"], ["priority", "priority"], ["party", "party"], ["status", "status"]],
  hse: [["type", "type"], ["category", "category"], ["rating", "rating"], ["contractor", "contractor"], ["status", "status"]],
  delivery: [["supplier", "supplier"], ["material", "material"], ["delivery", "delivery"], ["inspection", "inspection"]],
  inspection: [["type", "type"], ["category", "category"], ["discipline", "discipline"], ["result", "result"], ["contractor", "contractor"]],
  technical_instruction: [["type", "type"], ["discipline", "discipline"], ["to", "to"], ["status", "status"]],
  change_order: [["type", "type"], ["category", "category"], ["approval", "approval"], ["originator", "originator"]],
  ncr: [["type", "type"], ["severity", "severity"], ["discipline", "discipline"], ["status", "status"]],
  lessons_learned: [["phase", "phase"], ["category", "category"], ["applicability", "applicability"], ["discipline", "discipline"]],
  agreement: [["type", "type"], ["category", "category"], ["action", "action"], ["owner", "owner"], ["status", "status"]],
  hse_incident: [["type", "type"], ["category", "category"], ["severity", "severity"], ["investigation", "investigation"], ["status", "status"]],
};

const incidentTypes = new Set(["incident", "near_miss"]);

/**
 * The stored records of every form type, as [form, record] pairs. Drafts are never in a log.
 * `workforce` has no stored record of its own: one row per report day and building from the attendance.
 */
export function recordsByForm(snapshot) {
  const data = snapshot ?? {};
  const out = Object.fromEntries(formTabOrder.map((form) => [form, []]));
  for (const finding of data.findings ?? []) out[finding.finding_type === "ncr" ? "ncr" : "issue"].push(finding);
  for (const event of data.hseEvents ?? []) out[incidentTypes.has(event.event_type) ? "hse_incident" : "hse"].push(event);
  for (const entry of data.registerEntries ?? []) {
    const form = entry.register_type;
    if (out[form] && !["issue", "ncr", "hse", "hse_incident", "inspection", "photo", "workforce"].includes(form) && entry.status !== "draft") out[form].push(entry);
  }
  for (const inspection of data.inspections ?? []) out.inspection.push(inspection);
  for (const capture of data.visualCaptures ?? []) out.photo.push(capture);
  const reports = new Map((data.dayReports ?? []).map((report) => [report.id, report]));
  const days = new Map();
  for (const row of data.attendance ?? []) {
    if (row.entry_type === "visitor") continue;
    const key = `${row.day_report_id ?? ""}:${row.building_id ?? ""}`;
    const report = reports.get(row.day_report_id);
    const day = days.get(key) ?? { id: key, date: dayOf(report?.report_date ?? row.created_at), code: report?.report_number ?? "", total: 0, byDiscipline: {}, byContractor: {}, remarks: "", by: "", building_id: row.building_id, created_at: row.created_at };
    const count = number(row.headcount);
    day.total += count;
    const discipline = first(row.discipline, row.trade, row.crew_name, row.role) || "-";
    day.byDiscipline[discipline] = (day.byDiscipline[discipline] ?? 0) + count;
    const contractor = first(row.party_name, row.contractor, row.party_id) || "-";
    day.byContractor[contractor] = (day.byContractor[contractor] ?? 0) + count;
    if (str(row.notes)) day.remarks = day.remarks ? `${day.remarks}; ${str(row.notes)}` : str(row.notes);
    if (row.signed_by) day.by = str(row.signed_by);
    days.set(key, day);
  }
  out.workforce = [...days.values()];
  return out;
}

/** Helpers the columns use: location label, responsible party name, author and photo code from the snapshot. */
export function logContext(snapshot, { now, canSeeSensitive = false } = {}) {
  const data = snapshot ?? {};
  const buildings = new Map((data.buildings ?? []).map((building) => [building.id, building.name]));
  const parties = new Map((data.parties ?? []).map((party) => [party.id, party.name]));
  const files = new Map((data.files ?? []).map((file) => [file.id, file]));
  return {
    now: now ?? new Date().toISOString(),
    sensitive: canSeeSensitive,
    location(record, s) {
      const ids = record?.building_ids?.length ? record.building_ids : record?.building_id ? [record.building_id] : [];
      const names = ids.map((id) => buildings.get(id)).filter(Boolean);
      return [names.join(" + "), first(s?.exact_location, s?.location_detail, record?.location_label)].filter(Boolean).join(" · ");
    },
    party: (record) => parties.get(record?.responsible_party_id) ?? "",
    author: (record) => first(record?.signed_by, record?.created_by_name, record?.issue_management?.issued_by, record?.details?.issued_by),
    photoCode: (capture) => files.get(capture?.file_id)?.document_code ?? "",
    buildingNames: buildings,
  };
}

/** One row per record: `cells` by column key, plus the raw record and its sort date. */
export function buildFormLog(snapshot, form, options = {}) {
  const context = logContext(snapshot, options);
  const columns = formLogColumns[form] ?? [];
  const rows = (recordsByForm(snapshot)[form] ?? []).map((record) => {
    const s = spec(record);
    const cells = {};
    for (const item of columns) cells[item.key] = str(item.get(record, s, context));
    const status = str(record.status ?? cells.status ?? cells.approval ?? "");
    const buildingIds = record?.building_ids?.length ? record.building_ids : record?.building_id ? [record.building_id] : [];
    return {
      id: record.id,
      record,
      cells,
      status,
      date: dayOf(first(cells.date, cells.start, record.created_at, record.occurred_at)),
      buildingIds,
      discipline: first(s.discipline, cells.discipline),
      contractor: first(cells.party, cells.contractor, cells.crew, cells.to, cells.supplier, context.party(record)),
      author: context.author(record),
      text: Object.values(cells).join(" ").toLowerCase(),
    };
  });
  rows.sort((a, b) => b.date.localeCompare(a.date) || str(b.cells.id).localeCompare(str(a.cells.id)));
  return { form, columns, rows, context };
}

/** Period presets of the logs (Today, This week, Last week, This month, custom). Weeks run Monday to Sunday. */
export function periodRange(preset, nowIso, custom = {}) {
  const today = dayOf(nowIso ?? new Date().toISOString());
  const date = new Date(`${today}T00:00:00Z`);
  const iso = (value) => value.toISOString().slice(0, 10);
  const shift = (days) => { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + days); return copy; };
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") return { from: iso(shift(-1)), to: iso(shift(-1)) };
  if (preset === "week") return { from: iso(shift(-mondayOffset)), to: iso(shift(-mondayOffset + 6)) };
  if (preset === "last_week") return { from: iso(shift(-mondayOffset - 7)), to: iso(shift(-mondayOffset - 1)) };
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))) };
  if (preset === "last_month") return { from: iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1))), to: iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0))) };
  if (preset === "custom") return { from: str(custom.from), to: str(custom.to) };
  return { from: "", to: "" };
}

/**
 * Common filters of every log: period, status, building, discipline, contractor / company, created
 * by and full-text search, plus the form-specific filters of the sheet (`extra`: filter key -> value).
 */
export function filterFormLog(log, filters = {}) {
  const { from = "", to = "", status = "", buildingId = "", discipline = "", contractor = "", author = "", search = "", extra = {} } = filters;
  const needle = str(search).toLowerCase();
  const specific = formLogFilters[log.form] ?? [];
  return log.rows.filter((row) => {
    if (from && (!row.date || row.date < from)) return false;
    if (to && (!row.date || row.date > to)) return false;
    if (status === "open" && isClosedStatus(row.status)) return false;
    if (status === "closed" && !isClosedStatus(row.status)) return false;
    if (status && status !== "open" && status !== "closed" && row.status.toLowerCase() !== status.toLowerCase()) return false;
    if (buildingId && !row.buildingIds.includes(buildingId)) return false;
    if (discipline && row.discipline !== discipline) return false;
    if (contractor && !row.contractor.toLowerCase().includes(contractor.toLowerCase())) return false;
    if (author && !row.author.toLowerCase().includes(author.toLowerCase())) return false;
    if (needle && !row.text.includes(needle)) return false;
    for (const [filterKey, columnKey] of specific) {
      const wanted = str(extra[filterKey]);
      if (wanted && !str(row.cells[columnKey]).toLowerCase().includes(wanted.toLowerCase())) return false;
    }
    return true;
  });
}

const count = (rows, get) => {
  const totals = {};
  for (const row of rows) {
    const key = str(get(row)) || "-";
    totals[key] = (totals[key] ?? 0) + 1;
  }
  return totals;
};
const entries = (object) => Object.entries(object).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const sum = (rows, get, group) => {
  const totals = {};
  for (const row of rows) {
    const key = str(group(row)) || "-";
    totals[key] = (totals[key] ?? 0) + number(get(row));
  }
  return totals;
};

/** Totals / special view per log, as { label, value } pairs. Counts and sums of the filtered rows. */
export function formLogTotals(form, rows, { nowIso } = {}) {
  const items = [{ key: "records", label: { en: "Records", nl: "Registraties" }, value: String(rows.length) }];
  const add = (en, nl, pairs) => pairs.forEach(([name, value]) => items.push({ key: `${en}:${name}`, label: { en: `${en}: ${name}`, nl: `${nl}: ${name}` }, value: String(value) }));
  const open = rows.filter((row) => !isClosedStatus(row.status)).length;
  if (["issue", "ncr", "hse", "technical_instruction", "agreement", "hse_incident", "delay_report"].includes(form)) {
    items.push({ key: "open", label: { en: "Open", nl: "Open" }, value: String(open) }, { key: "closed", label: { en: "Closed", nl: "Gesloten" }, value: String(rows.length - open) });
  }
  if (["issue", "ncr", "hse"].includes(form)) {
    const buckets = { "0-7 days": 0, "8-14 days": 0, "15+ days": 0 };
    for (const row of rows) {
      const days = Number(row.cells.open);
      if (!Number.isFinite(days) || row.cells.open === "") continue;
      buckets[days <= 7 ? "0-7 days" : days <= 14 ? "8-14 days" : "15+ days"] += 1;
    }
    if (form !== "hse") add("Ageing", "Veroudering", Object.entries(buckets));
  }
  if (form === "hse") add("Risk level", "Risiconiveau", entries(count(rows, (row) => row.cells.rating)));
  if (form === "works_ongoing" || form === "works_completed") {
    const totals = {};
    for (const row of rows) {
      const parts = str(row.cells.quantity).split(" ");
      const amount = number(parts[0]);
      const key = `${row.cells.activity || "-"} (${parts.slice(1).join(" ") || "-"})`;
      if (amount) totals[key] = (totals[key] ?? 0) + amount;
    }
    add("Quantity", "Hoeveelheid", entries(totals));
  }
  if (form === "workforce") {
    const total = rows.reduce((sumValue, row) => sumValue + number(row.cells.total), 0);
    items.push({ key: "workers", label: { en: "Worker-days", nl: "Mandagen" }, value: String(total) });
    if (rows.length) items.push({ key: "average", label: { en: "Average per day", nl: "Gemiddeld per dag" }, value: (total / rows.length).toFixed(1) });
  }
  if (form === "delay_report") {
    const days = (row) => (/day/i.test(row.cells.duration) ? number(str(row.cells.duration).split(" ")[0]) : 0);
    add("Delay days per cause", "Vertragingsdagen per oorzaak", entries(sum(rows, days, (row) => row.cells.cause)));
    add("Delay days per party", "Vertragingsdagen per partij", entries(sum(rows, days, (row) => row.cells.party)));
  }
  if (form === "delivery") add("Delivered", "Geleverd", entries(sum(rows, (row) => str(row.cells.quantity).split("/")[1], (row) => row.cells.description)));
  if (form === "inspection") {
    const decided = rows.filter((row) => /accepted|rejected|passed|failed/i.test(row.cells.result));
    const passed = decided.filter((row) => /accepted|passed/i.test(row.cells.result) && !/rejected/i.test(row.cells.result)).length;
    items.push({ key: "pass-rate", label: { en: "Pass rate", nl: "Slagingspercentage" }, value: decided.length ? `${Math.round((passed / decided.length) * 100)}%` : "-" });
  }
  if (form === "change_order") {
    const cost = {};
    let days = 0;
    for (const row of rows) {
      const parts = str(row.cells.cost).split(" ");
      if (parts[0]) cost[parts[1] || "-"] = (cost[parts[1] || "-"] ?? 0) + number(parts[0]);
      if (/day/i.test(row.cells.time)) days += number(str(row.cells.time).split(" ")[0]);
    }
    add("Cost impact", "Kostenimpact", entries(cost));
    items.push({ key: "co-days", label: { en: "Time impact (days)", nl: "Tijdsimpact (dagen)" }, value: String(days) });
  }
  if (form === "lessons_learned") add("Category", "Categorie", entries(count(rows, (row) => row.cells.category)));
  if (form === "technical_instruction" || form === "agreement") add("Status", "Status", entries(count(rows, (row) => row.status)));
  if (form === "hse_incident") add("Type", "Soort", entries(count(rows, (row) => row.cells.type)));
  void nowIso;
  return items;
}

/** The report shape RegisterExportButtons and the Excel / PDF exporters take. */
export function formLogReport(log, rows, { language = "en", filtersText = "", generatedAt = "" } = {}) {
  const columns = log.columns.filter((item) => item.key !== "thumb");
  return {
    title: formLogLabels[log.form]?.[language] ?? log.form,
    metadata: [filtersText, generatedAt ? `${language === "nl" ? "Gegenereerd" : "Generated"}: ${generatedAt}` : ""].filter(Boolean),
    headers: columns.map((item) => item.label[language]),
    rows: rows.map((row) => columns.map((item) => row.cells[item.key] ?? "")),
  };
}

export function formLogCsv(report) {
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [report.headers, ...report.rows].map((line) => line.map(quote).join(",")).join("\r\n");
}
