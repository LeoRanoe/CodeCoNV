import assert from "node:assert/strict";
import test from "node:test";
import { buildDayOverview, daysWithRecords, siteDay, todayOnSite } from "../lib/reports/day-overview.ts";

test("a moment is placed on the site day in Suriname time, not the viewer's", () => {
  // 01:30 UTC on the 19th is still 22:30 on the 18th in Paramaribo (UTC-3).
  assert.equal(siteDay("2026-11-19T01:30:00Z"), "2026-11-18");
  assert.equal(siteDay("2026-11-19T03:30:00Z"), "2026-11-19");
  // A plain date is already a site day.
  assert.equal(siteDay("2026-11-19"), "2026-11-19");
  assert.equal(siteDay(""), "");
  assert.equal(siteDay("not a date"), "");
  assert.match(todayOnSite(new Date("2026-11-19T12:00:00Z")), /^2026-11-19$/);
});

const day = "2026-11-18";
const input = {
  dayReports: [{ id: "r-18", report_date: "2026-11-18" }, { id: "r-17", report_date: "2026-11-17" }],
  findings: [
    { id: "f1", finding_type: "deficiency", status: "open", created_at: "2026-11-18T13:00:00Z" },
    { id: "f2", finding_type: "ncr", status: "open", created_at: "2026-11-18T14:00:00Z" },
    { id: "f3", finding_type: "deficiency", status: "cancelled", created_at: "2026-11-18T14:00:00Z" },
    { id: "f4", finding_type: "deficiency", status: "open", created_at: "2026-11-17T14:00:00Z" },
  ],
  hseEvents: [{ id: "h1", status: "open", occurred_at: "2026-11-18T12:00:00Z" }],
  registerEntries: [
    { id: "d1", register_type: "delivery", status: "open", occurred_at: "2026-11-18T12:00:00Z" },
    { id: "t1", register_type: "technical_instruction", status: "open", occurred_at: "2026-11-18T15:00:00Z" },
    { id: "m1", register_type: "meeting", status: "open", occurred_at: "2026-11-18T15:00:00Z" },
    { id: "b1", register_type: "boq", status: "open", occurred_at: "2026-11-18T15:00:00Z" },
  ],
  dailyWork: [
    // Saved after midnight UTC but written in the report of the 18th: it belongs to the 18th.
    { id: "w1", day_report_id: "r-18", created_at: "2026-11-19T02:00:00Z", work_ongoing: "Formwork", work_performed: "", delay_cause: "none", delay_hours: 0 },
    { id: "w2", day_report_id: "r-18", created_at: "2026-11-18T20:00:00Z", work_ongoing: "", work_performed: "Slab poured", delay_cause: "weather", delay_hours: 2 },
    { id: "w3", day_report_id: "r-17", created_at: "2026-11-17T20:00:00Z", work_ongoing: "Old", work_performed: "", delay_cause: "none", delay_hours: 0 },
  ],
  attendance: [
    { id: "a1", day_report_id: "r-18", created_at: "2026-11-18T11:00:00Z", headcount: 4, entry_type: "workforce" },
    { id: "a2", day_report_id: "r-18", created_at: "2026-11-18T11:00:00Z", headcount: 1, entry_type: null },
    { id: "a3", day_report_id: "r-18", created_at: "2026-11-18T11:00:00Z", headcount: 2, entry_type: "visitor" },
  ],
  inspections: [{ id: "i1", status: "passed", completed_at: "2026-11-18T16:00:00Z", started_at: "2026-11-17T16:00:00Z" }],
  visualCaptures: [{ id: "p1", status: "active", captured_at: "2026-11-18T10:00:00Z" }, { id: "p2", status: "archived", captured_at: "2026-11-18T10:00:00Z" }],
};

test("every workspace record of the day lands in the block of its own form", () => {
  const overview = buildDayOverview(day, input);
  assert.deepEqual(overview.issues.map((record) => record.id), ["f1"]);
  assert.deepEqual(overview.ncrs.map((record) => record.id), ["f2"]);
  assert.deepEqual(overview.hse.map((record) => record.id), ["h1"]);
  assert.deepEqual(overview.worksOngoing.map((record) => record.id), ["w1"]);
  assert.deepEqual(overview.worksCompleted.map((record) => record.id), ["w2"]);
  assert.deepEqual(overview.delays.map((record) => record.id), ["w2"]);
  assert.equal(overview.workforce.headcount, 5);
  assert.equal(overview.workforce.visitors, 2);
  assert.deepEqual(overview.inspections.map((record) => record.id), ["i1"]);
  assert.deepEqual(overview.registers.delivery.map((record) => record.id), ["d1"]);
  assert.deepEqual(overview.registers.technical_instruction.map((record) => record.id), ["t1"]);
  assert.deepEqual(overview.registers.meeting.map((record) => record.id), ["m1"]);
  assert.equal(overview.registers.boq, undefined, "the bill of quantities is not a day's record");
  assert.deepEqual(overview.registers.change_order, [], "every form block exists, empty or not");
  assert.deepEqual(overview.photos.map((record) => record.id), ["p1"]);
  // 3 attendance lines + 1 ongoing + 1 completed + 1 delay + 2 findings + 1 hse + 1 inspection + 3 registers + 1 photo
  assert.equal(overview.total, 14);
});

test("a day without records is empty, not filled with defaults", () => {
  const overview = buildDayOverview("2026-11-10", input);
  assert.equal(overview.total, 0);
  assert.equal(overview.workforce.headcount, 0);
});

test("the day picker offers the days that hold records, newest first", () => {
  assert.deepEqual(daysWithRecords(input), ["2026-11-18", "2026-11-17"]);
});
