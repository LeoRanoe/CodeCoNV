import assert from "node:assert/strict";
import test from "node:test";
import { autoActionCounts, autoActionForms, autoActionRows, filterAutoActions, inView, waitingOn } from "../lib/actions/auto-list.mjs";

const NOW = "2026-11-25T10:00:00Z";
const snapshot = {
  buildings: [{ id: "b1", name: "Building A" }, { id: "b2", name: "Building B" }],
  parties: [{ id: "p1", name: "BouwCo N.V." }],
  findings: [
    { id: "f1", finding_type: "issue", finding_number: "ISS-1", title: "Late steel", status: "open", created_at: "2026-11-20T08:00:00Z", building_id: "b1", responsible_party_id: "p1", issue_management: { spec: { priority: "High", target_date: "2026-11-23", discipline: "Structural Steel & Metal Works" } } },
    { id: "f2", finding_type: "issue", finding_number: "ISS-2", title: "Closed one", status: "closed", created_at: "2026-11-10T08:00:00Z", issue_management: { spec: { target_date: "2026-11-12" } } },
    { id: "f3", finding_type: "ncr", finding_number: "NCR-1", title: "Cover too thin", status: "ready_for_verification", created_at: "2026-11-22T08:00:00Z", building_id: "b2", issue_management: { spec: { target_date: "2026-11-28" } } },
  ],
  registerEntries: [
    { id: "r1", register_type: "change_order", entry_number: "CO-1", title: "Extra", status: "pending", created_at: "2026-11-23T10:00:00Z", details: { spec: { approval_status: "Pending PM Approval" } } },
    { id: "r2", register_type: "change_order", entry_number: "CO-2", title: "Done", status: "approved", created_at: "2026-11-23T10:00:00Z", details: { spec: { approval_status: "Approved", instruction_to_proceed: "Issued" } } },
    { id: "r3", register_type: "change_order", entry_number: "CO-3", title: "Approved, not instructed", status: "approved", created_at: "2026-11-23T10:00:00Z", details: { spec: { approval_status: "Approved", instruction_to_proceed: "Not Issued" } } },
    { id: "r4", register_type: "agreement", entry_number: "AGR-1", title: "Agree", status: "submitted", created_at: "2026-11-23T10:00:00Z", details: { spec: { action_required: "Yes", action_owner: "Foreman", due_date: "2026-12-01" } } },
    { id: "r5", register_type: "agreement", entry_number: "AGR-2", title: "No action", status: "submitted", created_at: "2026-11-23T10:00:00Z", details: { spec: { action_required: "No" } } },
    { id: "r6", register_type: "works_ongoing", entry_number: "WO-1", title: "Held", status: "submitted", created_at: "2026-11-23T10:00:00Z", details: { spec: { progress_status: "On Hold", blocker: "Weather" } } },
    { id: "r7", register_type: "works_ongoing", entry_number: "WO-2", title: "Fine", status: "submitted", created_at: "2026-11-23T10:00:00Z", details: { spec: { progress_status: "In Progress", blocker: "None" } } },
    { id: "r8", register_type: "delivery", entry_number: "MAT-1", title: "Short", status: "submitted", created_at: "2026-11-23T10:00:00Z", details: { spec: { delivery_status: "Partial Delivery", supplier: "SteelCo" } } },
    { id: "r9", register_type: "lessons_learned", entry_number: "LL-1", title: "Lesson", status: "submitted", created_at: "2026-11-23T10:00:00Z", details: { spec: { action_owner: "QA" } } },
    { id: "r10", register_type: "lessons_learned", entry_number: "LL-2", title: "No owner", status: "submitted", created_at: "2026-11-23T10:00:00Z", details: { spec: {} } },
    { id: "r11", register_type: "works_ongoing", entry_number: "WO-3", title: "Draft", status: "draft", created_at: "2026-11-23T10:00:00Z", details: { spec: { progress_status: "On Hold" } } },
  ],
  inspections: [
    { id: "i1", inspection_number: "INS-1", title: "Rebar", status: "failed", completed_at: "2026-11-24T10:00:00Z", spec: { inspection_result: "Re-inspection Required", reinspection_date: "2026-11-30", responsible_contractor: "BouwCo N.V." } },
    { id: "i2", inspection_number: "INS-2", title: "Slab", status: "passed", completed_at: "2026-11-24T10:00:00Z", spec: { inspection_result: "Accepted" } },
  ],
};

const rows = autoActionRows(snapshot, { now: NOW });
const codes = rows.map((row) => row.code);

test("only submitted forms that still need follow-up are listed", () => {
  assert.ok(codes.includes("ISS-1"));
  assert.ok(!codes.includes("ISS-2"), "a closed issue leaves the list");
  assert.ok(codes.includes("NCR-1"));
  assert.ok(codes.includes("CO-1"));
  assert.ok(!codes.includes("CO-2"), "approved with the instruction issued is done");
  assert.ok(codes.includes("CO-3"), "approved but instruction to proceed not issued stays");
  assert.ok(codes.includes("AGR-1"));
  assert.ok(!codes.includes("AGR-2"), "no action required");
  assert.ok(codes.includes("WO-1"));
  assert.ok(!codes.includes("WO-2") && !codes.includes("WO-3"), "no blocker, and drafts are never listed");
  assert.ok(codes.includes("MAT-1"));
  assert.ok(codes.includes("LL-1") && !codes.includes("LL-2"));
  assert.ok(codes.includes("INS-1") && !codes.includes("INS-2"));
});

test("every form of the table has a rule", () => {
  assert.equal(autoActionForms.length, 14, "13 forms plus the spec compliance check");
});

test("owner and due date come from the source record, most urgent first", () => {
  const issue = rows.find((row) => row.code === "ISS-1");
  assert.equal(issue.owner, "BouwCo N.V.");
  assert.equal(issue.due, "2026-11-23");
  assert.equal(rows[0].code, "ISS-1");
  assert.equal(rows.find((row) => row.code === "AGR-1").due, "2026-12-01");
  assert.equal(rows.find((row) => row.code === "INS-1").due, "2026-11-30");
});

test("views: overdue, due this week, and who the item waits for", () => {
  const overdue = rows.filter((row) => inView(row, "overdue", NOW)).map((row) => row.code);
  assert.deepEqual(overdue, ["ISS-1"]);
  const week = rows.filter((row) => inView(row, "week", NOW)).map((row) => row.code);
  assert.ok(week.includes("NCR-1") && !week.includes("ISS-1"));
  assert.equal(waitingOn(rows.find((row) => row.code === "NCR-1")), "supervision");
  assert.equal(waitingOn(rows.find((row) => row.code === "ISS-1")), "contractor");
  assert.deepEqual(rows.filter((row) => inView(row, "pm", NOW)).map((row) => row.form), ["change_order", "change_order"]);
});

test("filters and the badge counts per form", () => {
  assert.equal(filterAutoActions(rows, { form: "issue" }).length, 1);
  assert.equal(filterAutoActions(rows, { buildingId: "b2" }).length, 1);
  assert.equal(filterAutoActions(rows, { contractor: "bouwco" }).length, 2);
  assert.equal(filterAutoActions(rows, { search: "rebar" }).length, 1);
  const counts = autoActionCounts(rows);
  assert.equal(counts.change_order, 2);
  assert.equal(counts.issue, 1);
});

test("an unresolved spec compliance check is listed in Actions until a follow-up exists or a later check complies", async () => {
  const { autoActionRows, complianceActionRows, autoActionFormLabel } = await import("../lib/actions/auto-list.mjs");
  const checks = [
    { id: "c1", check_number: "P-SPC-2026-0001", subject_file_id: "f1", subject_label: "Rebar R-12", requirement_label: "Bestek 05.1", clause: "5.1.2", overall_result: "does_not_comply", signed_at: "2026-11-20T10:00:00Z", follow_up_finding_id: null },
    { id: "c2", check_number: "P-SPC-2026-0002", subject_file_id: "f2", subject_label: "Cement", requirement_label: "Bestek 03", clause: "", overall_result: "complies_with_comments", signed_at: "2026-11-21T10:00:00Z", follow_up_finding_id: null },
    { id: "c3", check_number: "P-SPC-2026-0003", subject_file_id: "f3", subject_label: "Pipes", requirement_label: "Bestek 07", clause: "", overall_result: "does_not_comply", signed_at: "2026-11-21T10:00:00Z", follow_up_finding_id: "ncr-1" },
    { id: "c4", check_number: "P-SPC-2026-0004", subject_file_id: "f4", subject_label: "Paint", requirement_label: "Bestek 09", clause: "", overall_result: "complies", signed_at: "2026-11-21T10:00:00Z", follow_up_finding_id: null },
    { id: "c5", check_number: "P-SPC-2026-0005", subject_file_id: "f1", subject_label: "Rebar R-12", requirement_label: "Bestek 05.1", clause: "5.1.2", overall_result: "complies", signed_at: "2026-11-22T10:00:00Z", follow_up_finding_id: null },
  ];
  const rows = complianceActionRows(checks);
  assert.deepEqual(rows.map((row) => row.id), ["c2"], "resolved, followed-up and passing checks leave the list");
  assert.equal(rows[0].owner, "Submitting contractor");
  assert.equal(rows[0].tab, "verify");
  assert.equal(autoActionFormLabel("compliance_check", "nl"), "Bestekcontrole");
  assert.ok(autoActionRows({ specComplianceChecks: checks }).some((row) => row.form === "compliance_check"));
});
