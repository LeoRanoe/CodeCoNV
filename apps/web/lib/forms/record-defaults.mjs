/**
 * Shared rules of developer specification v5.0 (25-11-2026) that every form uses:
 * START HERE "Record IDs", "Field validation", "Status model", "Form title", and the
 * "Risk & Severity Scales" sheet (target dates from priority). Pure functions, no I/O.
 */

/** Form codes of the record IDs: <PROJECT CODE>-<FORM CODE>-<YYYY>-<NNNN>. */
export const formCodes = {
  photo: "PH",
  works_ongoing: "WO",
  works_completed: "WC",
  workforce: "WF",
  delay_report: "PDR",
  issue: "ISS",
  hse: "HSE",
  delivery: "MAT",
  inspection: "INS",
  technical_instruction: "TI",
  change_order: "CO",
  ncr: "NCR",
  lessons_learned: "LL",
  agreement: "AGR",
  hse_incident: "INC",
};

/** The tab order of the left menu and the form logs (mockups v6, README). */
export const formTabOrder = [
  "photo",
  "works_ongoing",
  "works_completed",
  "workforce",
  "delay_report",
  "issue",
  "hse",
  "delivery",
  "inspection",
  "technical_instruction",
  "change_order",
  "ncr",
  "lessons_learned",
  "hse_incident",
  "agreement",
];

const pad = (value, width) => String(value).padStart(width, "0");

/** CDC01-WO-2026-0001. */
export function recordId(projectCode, form, year, sequence) {
  const code = formCodes[form];
  if (!code) throw new Error(`Unknown form: ${form}`);
  const project = String(projectCode ?? "").trim().toUpperCase();
  if (!project) throw new Error("A project code is required for a record ID");
  return `${project}-${code}-${year}-${pad(sequence, 4)}`;
}

/** The next sequence for project + form + year: one more than the highest used, never reused. */
export function nextSequence(existingIds, projectCode, form, year) {
  const prefix = `${String(projectCode ?? "").trim().toUpperCase()}-${formCodes[form]}-${year}-`;
  let highest = 0;
  for (const id of existingIds ?? []) {
    if (typeof id !== "string" || !id.toUpperCase().startsWith(prefix)) continue;
    const sequence = Number(id.slice(prefix.length));
    if (Number.isInteger(sequence) && sequence > highest) highest = sequence;
  }
  return highest + 1;
}

export function nextRecordId(existingIds, projectCode, form, year) {
  return recordId(projectCode, form, year, nextSequence(existingIds, projectCode, form, year));
}

/** Issue field 15: Low +14 days, Medium +7, High +3, Critical +1 (Risk & Severity Scales). */
export const priorityDays = { Low: 14, Medium: 7, High: 3, Critical: 1 };

/** HSE risk rating target (Risk & Severity Scales): Low 14 days, Medium 7, High 3, Critical immediate. */
export const riskRatingDays = { Low: 14, Medium: 7, High: 3, Critical: 0 };

export function addDays(isoDate, days) {
  const [year, month, day] = String(isoDate).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/** The default target completion date for a priority, from the day the record is made; "" when unknown. */
export function targetDateFromPriority(priority, fromIsoDate) {
  const days = priorityDays[priority];
  return days === undefined ? "" : addDays(fromIsoDate, days);
}

export function dueDateFromRiskRating(rating, fromIsoDate) {
  const days = riskRatingDays[rating];
  return days === undefined ? "" : addDays(fromIsoDate, days);
}

/**
 * START HERE "Form title": auto-suggested as "<Type / Category> – <Location> – <date>" as soon as
 * those are chosen; the user may overwrite it. Missing parts are left out; max 120 characters.
 */
export function suggestTitle({ typeOrCategory, location, date } = {}) {
  const parts = [typeOrCategory, location, date].map((part) => String(part ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const title = parts.join(" – ");
  return title.length > 120 ? `${title.slice(0, 119).trimEnd()}…` : title;
}

/** Whether a title may still be replaced by a new suggestion: empty, or still the last suggestion. */
export function titleFollowsSuggestion(currentTitle, lastSuggestion) {
  const current = String(currentTitle ?? "").trim();
  return !current || current === String(lastSuggestion ?? "").trim();
}

/** Field validation (START HERE): short text 250, long text 4,000, files 20 MB, listed types only. */
export const validationLimits = {
  shortText: 250,
  longText: 4000,
  fileBytes: 20 * 1024 * 1024,
  fileExtensions: ["jpg", "jpeg", "png", "heic", "pdf", "docx", "xlsx"],
};

export function fileProblem(file) {
  const name = String(file?.name ?? "");
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (!validationLimits.fileExtensions.includes(extension)) return "type";
  if (Number(file?.size ?? 0) > validationLimits.fileBytes) return "size";
  return "";
}

/** Event dates cannot be in the future; planned and target dates may. Compares ISO date or date-time strings. */
export function eventDateInFuture(value, nowIso) {
  const entered = String(value ?? "");
  if (!entered) return false;
  const now = String(nowIso ?? new Date().toISOString());
  return entered.length <= 10 ? entered > now.slice(0, 10) : entered > now.slice(0, entered.length);
}

/**
 * Status model (START HERE): "Workflow status" is the sign-off stage; users never pick it.
 * Supervision forms: Draft -> Submitted (final) -> Awaiting contractor response -> Response received
 * -> Returned -> Closed. Change Order: Draft -> Pending PM Approval -> Approved / Rejected / Returned.
 * There is no review stage.
 */
export const workflowStages = ["Draft", "Submitted", "Awaiting contractor response", "Response received", "Returned", "Closed"];
export const changeOrderStages = ["Draft", "Pending PM Approval", "Approved", "Rejected", "Returned"];

const supervisionMoves = {
  Draft: ["Submitted"],
  Submitted: ["Awaiting contractor response", "Closed"],
  "Awaiting contractor response": ["Response received"],
  "Response received": ["Returned", "Closed"],
  Returned: ["Awaiting contractor response", "Response received"],
  Closed: [],
};

const changeOrderMoves = {
  Draft: ["Pending PM Approval"],
  "Pending PM Approval": ["Approved", "Rejected", "Returned"],
  Returned: ["Pending PM Approval"],
  Approved: [],
  Rejected: [],
};

export function allowedWorkflowMoves(form, stage) {
  const moves = form === "change_order" ? changeOrderMoves : supervisionMoves;
  return moves[stage] ?? [];
}

export function canMoveWorkflow(form, from, to) {
  return allowedWorkflowMoves(form, from).includes(to);
}

/** Forms whose submission is final with nothing for the contractor to answer (profiles WO, WC, WF, PH, LL). */
export const finalOnSubmit = ["photo", "works_ongoing", "works_completed", "workforce", "lessons_learned"];

/** Only the Change Order has an approval step, by the Project Manager (Supervision); never a client signature. */
export const approvalForms = ["change_order"];
