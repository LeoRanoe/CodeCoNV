/**
 * Actions, the automatic follow-up list (developer specification v5.0, Word chapter 9).
 * Every submitted form that still needs follow-up is listed here without being entered a second
 * time: a row is a live view of its source record and leaves the list when that record is closed,
 * approved or verified. The rules are the table "Records that appear automatically in Actions".
 * Pure functions over the project snapshot; the screen is the "Follow-up" view of the action centre.
 */
import { formTabOrder } from "../forms/record-defaults.mjs";
import { buildFormLog, formLogLabels, isClosedStatus } from "../records/form-logs.mjs";

const str = (value) => (value === null || value === undefined ? "" : String(value).trim());
const spec = (record) => {
  const found = record?.issue_management?.spec ?? record?.details?.spec ?? record?.spec;
  return found && typeof found === "object" && !Array.isArray(found) ? found : {};
};
const dayOf = (value) => str(value).slice(0, 10);
const is = (value, ...options) => options.some((option) => str(value).toLowerCase() === option.toLowerCase());

/** The tab a row opens in (record-directory.mjs). */
export const autoActionTabs = {
  issue: "findings",
  ncr: "ncr",
  hse: "hse",
  hse_incident: "hse",
  inspection: "inspections",
};

const pendingPm = (row, s) => is(str(s.approval_status) || row.status, "Pending PM Approval", "pending");

/**
 * Per form: whether the record still needs follow-up, who is responsible and which column holds the
 * due date. `owner` and `due` read the form-log cells so the list and the logs always agree.
 */
export const autoActionRules = {
  issue: { needs: (row) => !isClosedStatus(row.status), owner: (row) => row.cells.party || row.cells.person, due: (row) => row.cells.target },
  hse: { needs: (row) => !isClosedStatus(row.status), owner: (row) => row.cells.owner, due: (row) => row.cells.due },
  ncr: { needs: (row) => !isClosedStatus(row.status), owner: (row) => row.cells.owner || row.contractor, due: (row) => row.cells.target },
  technical_instruction: { needs: (row) => !isClosedStatus(row.status), owner: (row) => row.cells.owner || row.cells.to, due: (row) => row.cells.by },
  change_order: {
    needs: (row, s) => pendingPm(row, s) || (is(row.cells.approval, "approved") && is(s.instruction_to_proceed, "Not Issued")),
    owner: (row, s) => (pendingPm(row, s) ? "Project Manager" : row.cells.originator),
    due: () => "",
  },
  agreement: { needs: (row, s) => is(s.action_required, "Yes") && !isClosedStatus(row.status), owner: (row) => row.cells.owner, due: (row) => row.cells.due },
  delay_report: { needs: (row) => !isClosedStatus(row.status), owner: (row) => row.cells.owner, due: (row) => row.cells.recovery },
  inspection: { needs: (row) => is(row.cells.result, "Rejected", "Re-inspection Required", "Not Ready") || ["failed", "ready_for_reinspection"].includes(str(row.status)), owner: (row) => row.cells.contractor, due: (row) => row.cells.reinspection },
  works_completed: {
    needs: (row, s) => (Boolean(str(s.outstanding)) || /reject|fail|re-inspection|not passed/i.test(str(s.inspection_status))) && !isClosedStatus(row.status),
    owner: (row) => row.cells.crew,
    due: (row, s) => s.supervisor_due_date,
  },
  works_ongoing: {
    needs: (row, s) => is(s.progress_status, "On Hold") || (Boolean(str(s.blocker)) && !is(s.blocker, "None")),
    owner: (row) => row.cells.crew,
    due: () => "",
  },
  delivery: {
    needs: (row, s) => is(s.delivery_status, "Partial Delivery", "Received with Discrepancy", "Rejected") || is(s.inspection_result, "Rejected"),
    owner: (row) => row.cells.supplier,
    due: (row, s) => s.revised_delivery_date,
  },
  hse_incident: { needs: (row) => !isClosedStatus(row.status), owner: (row, s) => s.action_owner || row.contractor, due: () => "" },
  lessons_learned: { needs: (row, s) => Boolean(str(s.action_owner)) && !isClosedStatus(row.status), owner: (row) => row.cells.owner, due: () => "" },
};

/** Rapid Verify spec compliance checks are listed in Actions too (Word chapter 9, last row of the table). */
export const complianceCheckForm = "compliance_check";

/** Forms that appear in Actions, in the order of the left menu. */
export const autoActionForms = [...formTabOrder.filter((form) => autoActionRules[form]), complianceCheckForm];

/**
 * A signed check that does not comply, or complies with comments, stays in Actions until it is
 * resolved: a follow-up NCR exists, or a later check of the same subject complies.
 */
export function complianceActionRows(checks = []) {
  const rows = [];
  const list = Array.isArray(checks) ? checks : [];
  const newest = (check) => str(check.signed_at);
  for (const check of list) {
    if (!["does_not_comply", "complies_with_comments"].includes(str(check.overall_result))) continue;
    if (str(check.follow_up_finding_id)) continue;
    const subject = str(check.subject_file_id) || str(check.subject_record_id) || str(check.subject_label);
    const superseded = list.some((other) => other !== check
      && (str(other.subject_file_id) || str(other.subject_record_id) || str(other.subject_label)) === subject
      && str(other.requirement_label) === str(check.requirement_label)
      && newest(other) > newest(check) && str(other.overall_result) === "complies");
    if (superseded) continue;
    rows.push({
      key: `${complianceCheckForm}:${check.id}`,
      form: complianceCheckForm,
      id: str(check.id),
      tab: "verify",
      code: str(check.check_number),
      title: `${str(check.subject_label)} - ${str(check.requirement_label)}${str(check.clause) ? ` (${str(check.clause)})` : ""}`,
      status: str(check.overall_result) === "does_not_comply" ? "Does not comply" : "Complies with comments",
      owner: "Submitting contractor",
      due: "",
      priority: str(check.overall_result) === "does_not_comply" ? "High" : "",
      discipline: "",
      buildingIds: [],
      contractor: "",
      date: dayOf(check.signed_at),
      waitingOn: "contractor",
    });
  }
  return rows;
}

/** Who has to move next: the Project Manager (CO), Supervision (response received) or the contractor. */
export function waitingOn(row) {
  if (row.form === "change_order") return "pm";
  if (/response received|ready_for_verification|waiting for verification|submitted for verification|verification/i.test(`${row.status} ${row.stage ?? ""}`)) return "supervision";
  return "contractor";
}

/** The auto-list rows of a snapshot, most urgent first (due date, rows without one last). */
export function autoActionRows(snapshot, { now } = {}) {
  const rows = [];
  for (const form of autoActionForms) {
    const rule = autoActionRules[form];
    const log = buildFormLog(snapshot, form, { now });
    for (const row of log.rows) {
      const s = spec(row.record);
      if (!rule.needs(row, s)) continue;
      const item = {
        key: `${form}:${row.id}`,
        form,
        id: row.id,
        tab: autoActionTabs[form] ?? "registers",
        code: str(row.cells.id),
        title: str(row.cells.title) || str(row.record.title),
        status: row.status,
        owner: str(rule.owner(row, s)),
        due: dayOf(rule.due(row, s)),
        priority: str(row.cells.priority ?? row.cells.rating ?? row.cells.severity),
        discipline: str(row.discipline),
        buildingIds: row.buildingIds,
        contractor: str(row.contractor),
        date: row.date,
      };
      item.waitingOn = waitingOn({ ...item, record: row.record });
      rows.push(item);
    }
  }
  rows.push(...complianceActionRows(snapshot?.specComplianceChecks));
  return rows.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.code.localeCompare(b.code));
}

/** The views of the page: All open, Overdue, Due this week, Waiting for contractor / Supervision, Pending PM approval. */
export const autoActionViews = ["all", "overdue", "week", "contractor", "supervision", "pm"];

export function inView(row, view, todayIso) {
  const today = dayOf(todayIso ?? new Date().toISOString());
  if (view === "overdue") return Boolean(row.due) && row.due < today;
  if (view === "week") {
    if (!row.due || row.due < today) return false;
    const end = new Date(`${today}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    return row.due <= end.toISOString().slice(0, 10);
  }
  if (view === "contractor") return row.waitingOn === "contractor";
  if (view === "supervision") return row.waitingOn === "supervision";
  if (view === "pm") return row.waitingOn === "pm";
  return true;
}

/** Filters of the page: form, contractor, location, discipline, priority. */
export function filterAutoActions(rows, { form = "", contractor = "", buildingId = "", discipline = "", priority = "", search = "" } = {}) {
  const needle = str(search).toLowerCase();
  return rows.filter((row) => (!form || row.form === form)
    && (!contractor || `${row.owner} ${row.contractor}`.toLowerCase().includes(contractor.toLowerCase()))
    && (!buildingId || row.buildingIds.includes(buildingId))
    && (!discipline || row.discipline === discipline)
    && (!priority || row.priority.toLowerCase() === priority.toLowerCase())
    && (!needle || `${row.code} ${row.title} ${row.owner}`.toLowerCase().includes(needle)));
}

/** The badge counts per form shown in the left menu. */
export function autoActionCounts(rows) {
  const counts = Object.fromEntries(autoActionForms.map((form) => [form, 0]));
  for (const row of rows) counts[row.form] += 1;
  return counts;
}

export const autoActionFormLabel = (form, language = "en") => (form === complianceCheckForm
  ? (language === "nl" ? "Bestekcontrole" : "Spec compliance check")
  : formLogLabels[form]?.[language] ?? form);
