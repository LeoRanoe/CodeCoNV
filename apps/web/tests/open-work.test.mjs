import assert from "node:assert/strict";
import test from "node:test";
import {
  isWorklistRegister,
  summarizeOpenWork,
  workItemFromAction,
  workItemFromFinding,
  workItemFromRegister,
} from "../lib/actions/open-work.mjs";

const now = new Date("2026-10-10T15:00:00Z");

test("a project whose only open work is overdue findings is not 'under control'", () => {
  // The live case: no rows in the actions table, seven findings far past their deadline.
  const findings = Array.from({ length: 7 }, (_, index) => workItemFromFinding({
    id: `f${index}`,
    finding_number: `Q-2026-000${index + 1}`,
    title: `Finding ${index + 1}`,
    status: "open",
    priority: "normal",
    due_at: "2026-07-20T00:00:00Z",
  }));
  const summary = summarizeOpenWork(findings, now);
  assert.equal(summary.open, 7);
  assert.equal(summary.overdue, 7);
  assert.equal(summary.escalated, 7);
  assert.equal(summary.top.length, 4);
});

test("settled records are not open work, whatever their deadline", () => {
  const items = [
    workItemFromFinding({ id: "a", title: "Closed", status: "closed", due_at: "2026-07-01T00:00:00Z" }),
    workItemFromFinding({ id: "b", title: "Verified", status: "verified", due_at: "2026-07-01T00:00:00Z" }),
    workItemFromFinding({ id: "c", title: "Rejected", status: "rejected" }),
    workItemFromAction({ id: "d", title: "Cancelled", status: "cancelled", priority: "critical" }),
  ];
  const summary = summarizeOpenWork(items, now);
  assert.equal(summary.open, 0);
  assert.equal(summary.escalated, 0);
  assert.deepEqual(summary.top, []);
});

test("urgent actions, flagged findings and registers are counted once each", () => {
  const items = [
    workItemFromAction({ id: "a", title: "Urgent action", status: "open", priority: "critical" }),
    workItemFromFinding({ id: "f", title: "Flagged", status: "assigned", issue_management: { escalation_required: true } }),
    workItemFromRegister({ id: "r", title: "RFI", status: "submitted", due_at: "2026-10-30T00:00:00Z" }),
  ];
  const summary = summarizeOpenWork(items, now);
  assert.equal(summary.open, 3);
  assert.equal(summary.urgent, 1);
  assert.equal(summary.escalated, 2);
  assert.equal(summary.overdue, 0);
});

test("only registers somebody has to act on belong on the worklist", () => {
  assert.equal(isWorklistRegister({ register_type: "rfi", due_at: null }), true);
  assert.equal(isWorklistRegister({ register_type: "agreement", due_at: "2026-11-01T00:00:00Z" }), true);
  assert.equal(isWorklistRegister({ register_type: "agreement", due_at: null }), false);
});

test("the overview reads project-wide counts, never the day's timeline", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/client-dashboard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /entries\.filter\(\(entry\) => entry\.kind === "inspection"\)/);
  assert.doesNotMatch(source, /entries\.filter\(\(entry\) => entry\.kind === "photo"\)\.length/);
  assert.match(source, /summarizeOpenWork/);
});
