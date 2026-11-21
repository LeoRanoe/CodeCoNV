import assert from "node:assert/strict";
import test from "node:test";
import { actionReferenceDate, defaultPeriod, inPeriod, projectDay } from "../lib/reports/report-period.mjs";

test("F11: report periods compare project-local days, not UTC dates", () => {
  // 22:30 in Paramaribo on 30 November is already 1 December in UTC.
  assert.equal(projectDay("2026-12-01T01:30:00Z"), "2026-11-30");
  assert.equal(inPeriod("2026-12-01T01:30:00Z", "2026-11-01", "2026-11-30"), true);
  assert.equal(inPeriod("2026-12-01T03:30:00Z", "2026-11-01", "2026-11-30"), false);
  assert.equal(inPeriod("", "2026-11-01", "2026-11-30"), false);
  assert.equal(inPeriod("2026-11-15", "", ""), true);
});

test("F11: the default period ends on today's project day; actions without a due date use their raised date", () => {
  assert.deepEqual(defaultPeriod(new Date("2026-12-01T01:30:00Z"), 30), { from: "2026-10-31", to: "2026-11-30" });
  assert.equal(actionReferenceDate({ due_at: null, created_at: "2026-11-02T10:00:00Z" }), "2026-11-02T10:00:00Z");
});
