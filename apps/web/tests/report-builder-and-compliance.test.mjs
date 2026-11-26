import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addReportDays,
  reportPresetRange,
  reportPresets,
  reportTypeForms,
  reportTypeSections,
  reportTypes,
  weekStart,
} from "../lib/reports/report-builder.mjs";
import { complianceVerdict, deliveryMayBeAccepted, flagSupersededChecks } from "../lib/verification/spec-compliance.mjs";

// 2026-11-25 is a Wednesday.
const today = "2026-11-25";

test("quick periods follow Monday to Sunday weeks and calendar months", () => {
  assert.deepEqual(reportPresetRange("today", today), { start: today, end: today });
  assert.deepEqual(reportPresetRange("yesterday", today), { start: "2026-11-24", end: "2026-11-24" });
  assert.deepEqual(reportPresetRange("this_week", today), { start: "2026-11-23", end: today });
  assert.deepEqual(reportPresetRange("last_week", today), { start: "2026-11-16", end: "2026-11-22" });
  assert.deepEqual(reportPresetRange("this_month", today), { start: "2026-11-01", end: today });
  assert.deepEqual(reportPresetRange("last_month", today), { start: "2026-10-01", end: "2026-10-31" });
  for (const preset of reportPresets) assert.ok(reportPresetRange(preset, today).start <= reportPresetRange(preset, today).end);
  assert.throws(() => reportPresetRange("next_year", today));
});

test("periods cross month and year ends", () => {
  assert.deepEqual(reportPresetRange("last_month", "2027-01-15"), { start: "2026-12-01", end: "2026-12-31" });
  assert.deepEqual(reportPresetRange("last_month", "2026-03-10"), { start: "2026-02-01", end: "2026-02-28" });
  assert.equal(addReportDays("2026-12-31", 1), "2027-01-01");
  assert.equal(weekStart("2026-11-29"), "2026-11-23");
  assert.equal(weekStart("2026-11-23"), "2026-11-23");
});

test("every report type pre-selects forms and maps them to report sections", () => {
  assert.ok(reportTypes.length >= 10);
  assert.deepEqual(reportTypeForms("photos"), ["photos"]);
  assert.deepEqual(reportTypeSections("photos"), ["visual"]);
  assert.ok(reportTypeForms("daily").includes("works_ongoing"));
  assert.ok(reportTypeForms("unknown").length > 5, "an unknown type falls back to all forms");
  for (const type of reportTypes) {
    assert.ok(type.en && type.nl, `${type.id} has an English and a Dutch name`);
    assert.ok(reportTypeSections(type.id).length > 0, `${type.id} prints at least one section`);
  }
});

test("the overall compliance result follows from the rows and the comment", () => {
  assert.equal(complianceVerdict([{ result: "complies" }, { result: "not_applicable" }]), "complies");
  assert.equal(complianceVerdict([{ result: "complies" }, { result: "not_stated" }]), "complies_with_comments");
  assert.equal(complianceVerdict([{ result: "complies" }], "Check the cover on site"), "complies_with_comments");
  assert.equal(complianceVerdict([{ result: "complies" }, { result: "does_not_comply" }, { result: "not_stated" }], "x"), "does_not_comply");
  assert.equal(complianceVerdict([]), "complies");
});

test("a check on a replaced document is flagged as based on a superseded revision", () => {
  const checks = [
    { id: "a", subject_file_id: "old", requirement_file_id: "spec" },
    { id: "b", subject_file_id: "current", requirement_file_id: "spec" },
    { id: "c", subject_file_id: null, requirement_file_id: null },
  ];
  const flagged = flagSupersededChecks(checks, (fileId) => fileId === "old");
  assert.deepEqual(flagged.map((item) => item.superseded), [true, false, false]);
});

test("a delivery is accepted only when its required compliance check complies", () => {
  const checks = [
    { subject_record_id: "d1", overall_result: "does_not_comply", signed_at: "2026-11-20T10:00:00Z" },
    { subject_record_id: "d1", overall_result: "complies_with_comments", signed_at: "2026-11-21T10:00:00Z" },
    { subject_record_id: "d2", overall_result: "does_not_comply", signed_at: "2026-11-21T10:00:00Z" },
  ];
  assert.equal(deliveryMayBeAccepted(checks, "d1", true), true, "the latest check decides");
  assert.equal(deliveryMayBeAccepted(checks, "d2", true), false);
  assert.equal(deliveryMayBeAccepted(checks, "d3", true), false, "a required check must exist");
  assert.equal(deliveryMayBeAccepted(checks, "d3", false), true, "no check is needed when none is required");
});

test("open from before: records opened earlier and still open are added once and marked", async () => {
  const { addOpenFromBefore } = await import("../lib/reports/report-builder.mjs");
  const snapshot = { findings: [{ id: "a", status: "open", created_at: "2026-11-10T08:00:00Z" }], inspections: [], register_entries: [], hse_events: [], visual_captures: [{ id: "v" }] };
  const open = {
    findings: [
      { id: "a", status: "open", created_at: "2026-11-10T08:00:00Z" },
      { id: "b", status: "open", created_at: "2026-10-01T08:00:00Z", details: { note: "x" } },
      { id: "c", status: "closed", created_at: "2026-10-01T08:00:00Z" },
      { id: "d", status: "open", created_at: "2026-11-20T08:00:00Z" },
    ],
    inspections: [{ id: "i1", status: "failed", created_at: "2026-09-01T08:00:00Z" }, { id: "i2", status: "passed", created_at: "2026-09-01T08:00:00Z" }],
    register_entries: [{ id: "r1", status: "draft", created_at: "2026-09-01T08:00:00Z" }, { id: "r2", status: "submitted", created_at: "2026-09-01T08:00:00Z" }],
  };
  const next = addOpenFromBefore(snapshot, open, "2026-11-16");
  assert.deepEqual(next.findings.map((row) => row.id), ["a", "b"]);
  assert.equal(next.findings[1].details.carried_over, "Open sinds vóór deze periode");
  assert.equal(next.findings[1].details.note, "x");
  assert.deepEqual(next.inspections.map((row) => row.id), ["i1"]);
  assert.deepEqual(next.register_entries.map((row) => row.id), ["r2"]);
  assert.equal(next.visual_captures, snapshot.visual_captures);
  assert.equal(snapshot.findings.length, 1, "the snapshot itself is not changed");
});
