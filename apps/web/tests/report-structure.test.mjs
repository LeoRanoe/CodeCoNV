import assert from "node:assert/strict";
import test from "node:test";
import { contractorResponses, groupCounts, groupReportLines, reportGroupings, reportRecordLines } from "../lib/reports/report-structure.mjs";

const snapshot = {
  inspections: [{ id: "i1", inspection_number: "INS-001", title: "Slab check", building_id: "b1", status: "planned", scheduled_at: "2026-11-03T08:00:00Z", responsible_party_id: "p1" }],
  findings: [
    { id: "f1", finding_number: "NCR-001", finding_type: "ncr", title: "Cracks", building_id: "b2", status: "open", created_at: "2026-11-01T09:00:00Z", responsible_party_id: "p2" },
    { id: "f2", finding_number: "ISS-002", finding_type: "deficiency", title: "Paint", building_id: "b1", status: "open", created_at: "2026-11-03T09:00:00Z", responsible_party_id: "p1" },
  ],
  hse_events: [{ id: "h1", event_number: "HSE-001", title: "No helmet", building_id: "b1", status: "open", occurred_at: "2026-11-02T07:00:00Z" }],
  register_entries: [{ id: "r1", entry_number: "WO-001", register_type: "works_ongoing", title: "Columns", building_id: "b2", status: "open", created_at: "2026-11-02T06:00:00Z", details: { carried_over: "Open sinds vóór deze periode", spec: { crew: "Crew Noord" } } }],
};
const lookup = { building: (id) => ({ b1: "Tower A", b2: "Tower B" })[id] ?? "", party: (id) => ({ p1: "Alfa BV", p2: "Beta NV" })[id] ?? "", unassigned: "Niet toegewezen" };

test("every printed record becomes one line with its form, building and contractor", () => {
  const lines = reportRecordLines(snapshot, lookup);
  assert.equal(lines.length, 5);
  const byCode = Object.fromEntries(lines.map((line) => [line.code, line]));
  assert.equal(byCode["NCR-001"].form, "NCR");
  assert.equal(byCode["ISS-002"].form, "Issue");
  assert.equal(byCode["WO-001"].form, "Works Ongoing");
  assert.equal(byCode["WO-001"].contractor, "Crew Noord", "a register record names its crew when it has no party");
  assert.equal(byCode["HSE-001"].contractor, "Niet toegewezen");
  assert.equal(byCode["WO-001"].carriedOver, true);
  assert.equal(byCode["INS-001"].building, "Tower A");
  assert.equal(byCode["INS-001"].date, "2026-11-03");
});

test("grouping by contractor, location, form and date is complete, stable and ordered", () => {
  const lines = reportRecordLines(snapshot, lookup);
  for (const groupBy of reportGroupings) {
    const groups = groupReportLines(lines, groupBy);
    assert.equal(groups.reduce((total, group) => total + group.lines.length, 0), lines.length, `${groupBy} keeps every record exactly once`);
  }
  assert.deepEqual(groupReportLines(lines, "none").map((group) => group.label), [""]);
  assert.deepEqual(groupReportLines(lines, "contractor").map((group) => group.label), ["Alfa BV", "Beta NV", "Crew Noord", "Niet toegewezen"]);
  assert.deepEqual(groupReportLines(lines, "location").map((group) => group.label), ["Tower A", "Tower B"]);
  assert.deepEqual(groupReportLines(lines, "date").map((group) => group.label), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  const towerA = groupReportLines(lines, "location")[0];
  assert.deepEqual(towerA.lines.map((line) => line.code), ["HSE-001", "INS-001", "ISS-002"], "inside a group: oldest first");
  assert.deepEqual(groupCounts(towerA), [{ form: "HSE", count: 1 }, { form: "Inspection", count: 1 }, { form: "Issue", count: 1 }]);
});

test("a record with no building or date is still listed, under a dash", () => {
  const lines = reportRecordLines({ findings: [{ id: "x", finding_number: "ISS-009", title: "Loose", status: "open" }] }, lookup);
  assert.equal(groupReportLines(lines, "location")[0].label, "-");
  assert.equal(groupReportLines(lines, "date")[0].label, "-");
});

test("contractor responses list only the answered records, with who answered and what they said", () => {
  const records = [{ id: "f1", code: "NCR-001", title: "Cracks" }, { id: "f2", code: "ISS-002", title: "Paint" }];
  const history = new Map([
    ["f1", [
      { action: "submit", actor_name: "Supervisor", created_at: "2026-11-01T10:00:00Z" },
      { action: "acknowledge", actor_name: "Alex Contractor", actor_organization: "Beta NV", created_at: "2026-11-02T10:00:00Z", comments: "" },
      { action: "respond", actor_name: "Alex Contractor", actor_organization: "Beta NV", created_at: "2026-11-04T10:00:00Z", comments: "Repaired with epoxy." },
    ]],
    ["f2", [{ action: "submit", actor_name: "Supervisor", created_at: "2026-11-03T10:00:00Z" }]],
  ]);
  const result = contractorResponses(records, history);
  assert.equal(result.length, 1, "an unanswered record is not listed");
  assert.equal(result[0].code, "NCR-001");
  assert.deepEqual(result[0].responses.map((item) => item.action), ["acknowledge", "respond"]);
  assert.equal(result[0].responses[1].comments, "Repaired with epoxy.");
  assert.equal(result[0].responses[1].at, "2026-11-04");
  assert.equal(result[0].responses[1].organization, "Beta NV");
});
