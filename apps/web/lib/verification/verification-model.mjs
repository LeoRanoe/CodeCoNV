/**
 * Rapid Verify (requirements section 10): which records wait for a supervisor's verification,
 * grouped the way the client's menu names them. Pure, so the screen and the tests agree.
 */

export const verificationResultLabels = Object.freeze({
  pass: { en: "Pass", nl: "Akkoord" },
  partial: { en: "Partially complete", nl: "Gedeeltelijk gereed" },
  further_action: { en: "Further action required", nl: "Verdere actie nodig" },
  fail: { en: "Fail", nl: "Afgekeurd" },
});

const closedSpecStatuses = new Set(["Closed", "Cancelled"]);

/**
 * @param {{ findings?: any[], inspections?: any[], registerEntries?: any[], actions?: any[], shares?: any[] }} input
 */
export function buildVerificationQueue({ findings = [], inspections = [], registerEntries = [], actions = [], shares = [] } = {}) {
  const work = registerEntries
    .filter((entry) => ["works_completed", "wcr"].includes(entry.register_type))
    .filter((entry) => !["closed", "cancelled", "approved", "rejected"].includes(entry.status))
    .filter((entry) => !closedSpecStatuses.has(entry.details?.spec?.workflow_status))
    // F02: the Works Completed form stores its decision as spec.inspection_status; completion_status
    // is read only for older records that used that key.
    .filter((entry) => !["Inspected - Accepted", "Inspected - Rejected"].includes(entry.details?.spec?.inspection_status ?? entry.details?.spec?.completion_status ?? ""))
    .map((entry) => ({
      key: `register_entry:${entry.id}`, kind: "work", recordType: "register_entry", recordId: entry.id, code: entry.entry_number,
      title: entry.title, status: entry.status, buildingId: entry.building_id ?? null, partyId: entry.responsible_party_id ?? null, since: entry.occurred_at ?? entry.created_at ?? null,
    }));
  const ncr = findings
    .filter((finding) => finding.status === "ready_for_verification")
    .map((finding) => ({
      key: `finding:${finding.id}`, kind: "ncr", recordType: "finding", recordId: finding.id, code: finding.finding_number,
      title: finding.title, status: finding.status, buildingId: finding.building_id ?? null, partyId: finding.responsible_party_id ?? null, since: finding.updated_at ?? finding.created_at ?? null,
    }));
  const action = actions
    .filter((item) => item.status === "ready_for_verification")
    .map((item) => ({
      key: `action:${item.id}`, kind: "action", recordType: "action", recordId: item.id, code: item.action_number,
      title: item.title, status: item.status, buildingId: item.building_id ?? null, partyId: item.owner_party_id ?? null, since: item.updated_at ?? item.due_at ?? null,
    }));
  const inspection = inspections
    .filter((item) => ["failed", "ready_for_reinspection"].includes(item.status))
    .map((item) => ({
      key: `inspection:${item.id}`, kind: "inspection", recordType: "inspection", recordId: item.id, code: item.inspection_number,
      title: item.title, status: item.status, buildingId: item.building_id ?? null, partyId: null, since: item.completed_at ?? item.updated_at ?? null,
    }));
  // Contractor evidence for an item that is not itself in the queue above (an NCR or action
  // reported complete in the portal already stands there as that record).
  const queued = new Set([...ncr, ...action].map((item) => item.recordId));
  const evidence = shares
    .filter((share) => share.audience === "contractor" && ["responded", "submitted_for_verification"].includes(share.status))
    .filter((share) => !queued.has(share.record_id))
    .map((share) => ({
      key: `portal_share:${share.id}`, kind: "evidence", recordType: "portal_share", recordId: share.id, code: share.record_code ?? "",
      title: share.title, status: share.status, buildingId: share.building_id ?? null, partyId: share.party_id, since: share.updated_at ?? null,
      sourceRecordType: share.record_type, sourceRecordId: share.record_id,
    }));
  const all = [...ncr, ...action, ...work, ...inspection, ...evidence]
    .sort((a, b) => String(a.since ?? "").localeCompare(String(b.since ?? "")));
  return { work, ncr, action, inspection, evidence, all };
}
