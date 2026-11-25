import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedWorkflowMoves,
  canMoveWorkflow,
  dueDateFromRiskRating,
  eventDateInFuture,
  fileProblem,
  formCodes,
  formTabOrder,
  nextRecordId,
  recordId,
  suggestTitle,
  targetDateFromPriority,
  titleFollowsSuggestion,
} from "../lib/forms/record-defaults.mjs";

test("record IDs follow <PROJECT>-<FORM>-<YYYY>-<NNNN> and are never reused", () => {
  assert.equal(recordId("cdc01", "works_ongoing", 2026, 1), "CDC01-WO-2026-0001");
  assert.deepEqual(Object.values(formCodes).sort(), ["AGR", "CO", "INC", "INS", "ISS", "HSE", "LL", "MAT", "NCR", "PDR", "PH", "TI", "WC", "WF", "WO"].sort());
  const existing = ["CDC01-ISS-2026-0001", "CDC01-ISS-2026-0007", "CDC01-ISS-2025-0099", "CDC01-NCR-2026-0050", "OTHER-ISS-2026-0200"];
  assert.equal(nextRecordId(existing, "CDC01", "issue", 2026), "CDC01-ISS-2026-0008");
  assert.equal(nextRecordId([], "CDC01", "issue", 2027), "CDC01-ISS-2027-0001");
  assert.throws(() => recordId("", "issue", 2026, 1));
});

test("the 15 forms are in the order of the left menu", () => {
  assert.equal(formTabOrder.length, 15);
  assert.equal(new Set(formTabOrder).size, 15);
  assert.deepEqual(formTabOrder.slice(0, 3), ["photo", "works_ongoing", "works_completed"]);
  assert.equal(formTabOrder.at(-1), "agreement");
});

test("target dates follow the priority: Low +14, Medium +7, High +3, Critical +1", () => {
  assert.equal(targetDateFromPriority("Low", "2026-11-23"), "2026-12-07");
  assert.equal(targetDateFromPriority("Medium", "2026-11-23"), "2026-11-30");
  assert.equal(targetDateFromPriority("High", "2026-11-23"), "2026-11-26");
  assert.equal(targetDateFromPriority("Critical", "2026-11-30"), "2026-12-01");
  assert.equal(targetDateFromPriority("", "2026-11-23"), "");
  assert.equal(dueDateFromRiskRating("Critical", "2026-11-23"), "2026-11-23");
  assert.equal(dueDateFromRiskRating("Low", "2026-12-25"), "2027-01-08");
});

test("the title is suggested from type, location and date and stays the user's once edited", () => {
  assert.equal(suggestTitle({ typeOrCategory: "Concrete Works", location: "Building A Level 1", date: "23 Nov 2026" }), "Concrete Works – Building A Level 1 – 23 Nov 2026");
  assert.equal(suggestTitle({ typeOrCategory: "Concrete Works", date: "23 Nov 2026" }), "Concrete Works – 23 Nov 2026");
  assert.equal(suggestTitle({ typeOrCategory: "x".repeat(200) }).length, 120);
  assert.equal(titleFollowsSuggestion("", "A"), true);
  assert.equal(titleFollowsSuggestion("A", "A"), true);
  assert.equal(titleFollowsSuggestion("My own title", "A"), false);
});

test("files are limited to the listed types and 20 MB", () => {
  assert.equal(fileProblem({ name: "a.JPG", size: 1000 }), "");
  assert.equal(fileProblem({ name: "plan.pdf", size: 1000 }), "");
  assert.equal(fileProblem({ name: "sheet.xlsx", size: 1000 }), "");
  assert.equal(fileProblem({ name: "movie.mov", size: 1000 }), "type");
  assert.equal(fileProblem({ name: "big.pdf", size: 21 * 1024 * 1024 }), "size");
});

test("event dates cannot be in the future", () => {
  assert.equal(eventDateInFuture("2026-11-26", "2026-11-25T10:00:00Z"), true);
  assert.equal(eventDateInFuture("2026-11-25", "2026-11-25T10:00:00Z"), false);
  assert.equal(eventDateInFuture("2026-11-25T09:00", "2026-11-25T10:00:00Z"), false);
  assert.equal(eventDateInFuture("2026-11-25T11:00", "2026-11-25T10:00:00Z"), true);
});

test("the workflow has no review stage and only the Change Order is approved by the Project Manager", () => {
  assert.equal(canMoveWorkflow("issue", "Draft", "Submitted"), true);
  assert.equal(canMoveWorkflow("issue", "Submitted", "Under review"), false);
  assert.equal(canMoveWorkflow("issue", "Response received", "Returned"), true);
  assert.equal(canMoveWorkflow("issue", "Closed", "Submitted"), false);
  assert.deepEqual(allowedWorkflowMoves("change_order", "Pending PM Approval"), ["Approved", "Rejected", "Returned"]);
  assert.equal(canMoveWorkflow("change_order", "Draft", "Approved"), false);
});
