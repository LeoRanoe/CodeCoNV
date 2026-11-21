import assert from "node:assert/strict";
import test from "node:test";
import { buildVerificationQueue } from "../lib/verification/verification-model.mjs";
import { contractorPerformance, summarizeProject } from "../lib/reports/project-summary.mjs";

const now = new Date("2026-11-20T15:00:00Z");

test("Rapid Verify queues what waits for a supervisor, once per record", () => {
  const queue = buildVerificationQueue({
    findings: [
      { id: "f1", finding_number: "NCR-1", title: "Cover", status: "ready_for_verification", building_id: "b1", responsible_party_id: "p1" },
      { id: "f2", finding_number: "NCR-2", title: "Crack", status: "open" },
    ],
    actions: [
      { id: "a1", action_number: "ACT-1", title: "Clean", status: "ready_for_verification" },
      { id: "a2", action_number: "ACT-2", title: "Paint", status: "in_progress" },
    ],
    inspections: [
      { id: "i1", inspection_number: "INS-1", title: "Rebar", status: "ready_for_reinspection" },
      { id: "i2", inspection_number: "INS-2", title: "Formwork", status: "passed" },
    ],
    registerEntries: [
      { id: "w1", register_type: "works_completed", entry_number: "WC-1", title: "Slab L2", status: "submitted", details: { spec: { workflow_status: "Pending Verification" } } },
      { id: "w2", register_type: "works_completed", entry_number: "WC-2", title: "Slab L1", status: "submitted", details: { spec: { workflow_status: "Closed" } } },
      { id: "r1", register_type: "rfi", entry_number: "RFI-1", title: "Anchor", status: "submitted", details: {} },
    ],
    shares: [
      { id: "s1", audience: "contractor", status: "submitted_for_verification", record_type: "action", record_id: "a1", party_id: "p1", title: "Clean" },
      { id: "s2", audience: "contractor", status: "responded", record_type: "register_entry", record_id: "x", party_id: "p1", title: "Delay explanation" },
      { id: "s3", audience: "client", status: "approved", record_type: "document", record_id: "d", party_id: "c", title: "Plan" },
    ],
  });
  assert.deepEqual(queue.ncr.map((item) => item.code), ["NCR-1"]);
  assert.deepEqual(queue.action.map((item) => item.code), ["ACT-1"]);
  assert.deepEqual(queue.inspection.map((item) => item.code), ["INS-1"]);
  assert.deepEqual(queue.work.map((item) => item.code), ["WC-1"], "a closed work record and an RFI are not work verification");
  assert.deepEqual(queue.evidence.map((item) => item.recordId), ["s2"], "an action already queued is not listed twice; client decisions are not evidence");
  assert.equal(queue.all.length, 5);
});

test("the overview counts only stored facts and never invents a planned figure", () => {
  const summary = summarizeProject({
    findings: [
      { id: "1", finding_type: "ncr", status: "open", severity: "high", responsible_party_id: "p1", due_at: "2026-11-01T00:00:00Z" },
      { id: "2", finding_type: "ncr", status: "closed", severity: "high", responsible_party_id: "p1" },
      { id: "3", finding_type: "deficiency", status: "open", severity: "low" },
    ],
    hseEvents: [
      { id: "h1", event_type: "observation", status: "open", occurred_at: "2026-11-10T00:00:00Z" },
      { id: "h2", event_type: "incident", status: "closed", occurred_at: "2026-11-15T00:00:00Z" },
      { id: "h3", event_type: "incident", status: "closed", occurred_at: "2026-09-01T00:00:00Z" },
    ],
    registerEntries: [
      { register_type: "change_order", status: "submitted" },
      { register_type: "change_order", status: "approved" },
      { register_type: "technical_instruction", status: "submitted" },
    ],
    inspections: [
      { status: "planned", planned_at: "2026-11-22T00:00:00Z" },
      { status: "planned", planned_at: "2026-11-18T00:00:00Z" },
      { status: "failed" },
    ],
    boqProgressUpdates: [
      { register_entry_id: "boq1", progress_percent: 40, recorded_at: "2026-11-01" },
      { register_entry_id: "boq1", progress_percent: 60, recorded_at: "2026-11-10" },
      { register_entry_id: "boq2", progress_percent: 20, recorded_at: "2026-11-05" },
    ],
    actions: [{ id: "a", status: "open", due_at: "2026-11-19T00:00:00Z", owner_party_id: "p1" }],
    shares: [{ party_id: "p1", audience: "contractor", status: "assigned" }],
    parties: [{ id: "p1", name: "Contractor A", type: "contractor" }],
  }, now);
  assert.equal(summary.progress.actual, 40, "the latest percentage per BOQ item, averaged");
  assert.equal(summary.quality.openNcr, 1);
  assert.equal(summary.quality.severe, 1);
  assert.equal(summary.quality.openIssues, 1);
  assert.equal(summary.hse.openObservations, 1);
  assert.equal(summary.hse.incidents30, 1);
  assert.equal(summary.registers.changeOrders, 1);
  assert.equal(summary.registers.instructions, 1);
  assert.deepEqual([summary.inspections.upcoming, summary.inspections.overdue, summary.inspections.followUp], [1, 1, 1]);
  assert.deepEqual(summary.contractors, [{ id: "p1", name: "Contractor A", open: 2, overdue: 2, awaiting: 1 }]);
  assert.equal(summarizeProject({}, now).progress.actual, null, "no BOQ progress means no figure");
});

test("contractor performance measures answers, timeliness and returns in the period", () => {
  const rows = contractorPerformance({
    parties: [{ id: "p1", name: "Contractor A", type: "contractor" }, { id: "c", name: "Client", type: "client" }],
    shares: [
      { id: "s1", party_id: "p1", audience: "contractor", status: "closed", assigned_at: "2026-11-02T00:00:00Z", due_at: "2026-11-05T00:00:00Z" },
      { id: "s2", party_id: "p1", audience: "contractor", status: "assigned", assigned_at: "2026-11-10T00:00:00Z", due_at: "2026-11-12T00:00:00Z" },
      { id: "s3", party_id: "p1", audience: "contractor", status: "closed", assigned_at: "2026-09-01T00:00:00Z" },
    ],
    events: [
      { share_id: "s1", sequence: 1, actor_side: "codeco", action: "assign", created_at: "2026-11-02T00:00:00Z" },
      { share_id: "s1", sequence: 2, actor_side: "contractor", action: "view", created_at: "2026-11-02T10:00:00Z" },
      { share_id: "s1", sequence: 3, actor_side: "contractor", action: "respond", created_at: "2026-11-04T00:00:00Z" },
      { share_id: "s1", sequence: 4, actor_side: "codeco", action: "return", created_at: "2026-11-04T05:00:00Z" },
    ],
    findings: [{ finding_type: "ncr", responsible_party_id: "p1", status: "closed", created_at: "2026-11-03T00:00:00Z" }],
    actions: [],
  }, { from: "2026-11-01", to: "2026-11-30" }, now);
  assert.equal(rows.length, 1, "only contractors, only with activity");
  assert.deepEqual(
    [rows[0].assigned, rows[0].answered, rows[0].onTime, rows[0].averageDays, rows[0].returned, rows[0].overdue, rows[0].ncrRaised, rows[0].ncrClosed],
    [2, 1, 1, 2, 1, 1, 1, 1],
  );
});
