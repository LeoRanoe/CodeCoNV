import assert from "node:assert/strict";
import test from "node:test";
import { buildRecordDirectory } from "../lib/records/record-directory.mjs";

test("F04: Workforce is indexed per day report and building, visitors excluded", () => {
  const entries = buildRecordDirectory({
    dayReports: [{ id: "r1", report_number: "DR-0012", report_date: "2026-11-20", status: "submitted" }],
    attendance: [
      { id: "a1", day_report_id: "r1", building_id: "b1", party_id: "p1", headcount: 6, entry_type: "workforce", created_at: "2026-11-20T08:00:00Z" },
      { id: "a2", day_report_id: "r1", building_id: "b1", party_id: "p1", headcount: 4, entry_type: "workforce", signed_by: "Sam", created_at: "2026-11-20T09:00:00Z" },
      { id: "a3", day_report_id: "r1", building_id: "b2", party_id: "p2", headcount: 3, entry_type: "workforce", created_at: "2026-11-20T08:30:00Z" },
      { id: "a4", day_report_id: "r1", building_id: "b2", party_id: null, headcount: 2, entry_type: "visitor", created_at: "2026-11-20T10:00:00Z" },
    ],
  });
  const workforce = entries.filter((entry) => entry.kind === "workforce");
  assert.equal(workforce.length, 2);
  const first = workforce.find((entry) => entry.buildingIds[0] === "b1");
  assert.equal(first.code, "DR-0012");
  assert.equal(first.tab, "workforce");
  assert.equal(first.subtitle, "10 · 2");
  assert.equal(first.status, "signed");
  assert.equal(first.partyId, "p1");
  assert.equal(workforce.find((entry) => entry.buildingIds[0] === "b2").subtitle, "3 · 1");
});

test("F04: register subtypes, HSE observation/incident and responsible facets are on each entry", () => {
  const entries = buildRecordDirectory({
    registerEntries: [{ id: "e1", entry_number: "CO-0001", title: "Extra column", register_type: "change_order", status: "open", responsible_party_id: "p1", details: { spec: { discipline: "Structural" } } }],
    hseEvents: [
      { id: "h1", event_number: "HSE-0001", title: "Fall", event_type: "incident", status: "open", spec: { action_owner: "Lena Lead" } },
      { id: "h2", event_number: "HSE-0002", title: "Loose cable", event_type: "unsafe_condition", status: "open" },
    ],
  });
  const change = entries.find((entry) => entry.id === "e1");
  assert.equal(change.subtype, "change_order");
  assert.equal(change.partyId, "p1");
  assert.equal(change.facets.discipline, "Structural");
  assert.equal(entries.find((entry) => entry.id === "h1").subtype, "incident");
  assert.equal(entries.find((entry) => entry.id === "h1").responsible, "Lena Lead");
  assert.equal(entries.find((entry) => entry.id === "h2").subtype, "observation");
});
