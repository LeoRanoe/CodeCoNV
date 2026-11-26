import assert from "node:assert/strict";
import test from "node:test";
import { formTabOrder } from "../lib/forms/record-defaults.mjs";
import { buildFormLog, filterFormLog, formLogColumns, formLogCsv, formLogFilters, formLogReport, formLogTotals, periodRange, recordsByForm } from "../lib/records/form-logs.mjs";

const snapshot = {
  buildings: [{ id: "b1", name: "Building A" }, { id: "b2", name: "Building B" }],
  parties: [{ id: "p1", name: "BouwCo N.V." }],
  findings: [
    { id: "f1", finding_type: "issue", finding_number: "ISS-1", title: "Late steel", status: "open", created_at: "2026-11-20T08:00:00Z", building_id: "b1", responsible_party_id: "p1", issue_management: { spec: { issue_type: "Materials", issue_category: "Delayed Delivery", priority: "High", target_date: "2026-11-23" } } },
    { id: "f2", finding_type: "issue", finding_number: "ISS-2", title: "Cracked slab", status: "closed", created_at: "2026-11-10T08:00:00Z", building_id: "b2", issue_management: { spec: { issue_type: "Quality", issue_category: "Concrete Works", priority: "Low" } } },
    { id: "f3", finding_type: "ncr", finding_number: "NCR-1", title: "Cover too thin", status: "open", created_at: "2026-11-22T08:00:00Z", issue_management: { spec: { ncr_type: "Workmanship", severity: "Major" } } },
  ],
  hseEvents: [
    { id: "h1", event_type: "observation", event_number: "HSE-1", title: "No harness", status: "open", created_at: "2026-11-21T08:00:00Z", details: { spec: { risk_rating: "High" } } },
    { id: "h2", event_type: "near_miss", event_number: "INC-1", title: "Dropped brick", status: "open", created_at: "2026-11-21T09:00:00Z", details: { spec: { incident_severity: "Level 1 - Minor", injury_classification: "First aid" } } },
  ],
  registerEntries: [
    { id: "r1", register_type: "works_ongoing", entry_number: "WO-1", title: "Pour", status: "submitted", created_at: "2026-11-23T08:00:00Z", building_id: "b1", details: { spec: { activity: "Concrete Pouring", quantity: "12", quantity_unit: "m3", progress_status: "In Progress" } } },
    { id: "r2", register_type: "works_ongoing", entry_number: "WO-2", title: "Pour 2", status: "submitted", created_at: "2026-11-23T09:00:00Z", building_id: "b1", details: { spec: { activity: "Concrete Pouring", quantity: "8", quantity_unit: "m3" } } },
    { id: "r3", register_type: "change_order", entry_number: "CO-1", title: "Extra", status: "pending", created_at: "2026-11-23T10:00:00Z", details: { spec: { cost_impact: "1000", cost_currency: "USD", time_impact: "3", time_impact_unit: "Days" } } },
    { id: "r4", register_type: "change_order", entry_number: "CO-2", title: "Less", status: "pending", created_at: "2026-11-23T11:00:00Z", details: { spec: { cost_impact: "500", cost_currency: "USD", time_impact: "2", time_impact_unit: "Days" } } },
    { id: "r5", register_type: "delivery", entry_number: "MAT-1", title: "Draft one", status: "draft", created_at: "2026-11-23T12:00:00Z", details: { spec: {} } },
  ],
  dayReports: [{ id: "d1", report_date: "2026-11-23", report_number: "DR-1" }],
  attendance: [
    { day_report_id: "d1", building_id: "b1", headcount: 5, trade: "Mason", party_name: "BouwCo N.V." },
    { day_report_id: "d1", building_id: "b1", headcount: 3, trade: "Electrician", party_name: "ElectroCo" },
    { day_report_id: "d1", building_id: "b1", entry_type: "visitor", headcount: 9 },
  ],
};

test("every one of the 15 forms has a log with columns", () => {
  assert.equal(Object.keys(formLogColumns).length, 15);
  for (const form of formTabOrder) {
    assert.ok(formLogColumns[form].length >= 4, form);
    assert.ok(formLogFilters[form], form);
  }
});

test("records are sorted into their own log and drafts are never in a log", () => {
  const records = recordsByForm(snapshot);
  assert.equal(records.issue.length, 2);
  assert.equal(records.ncr.length, 1);
  assert.equal(records.hse.length, 1);
  assert.equal(records.hse_incident.length, 1);
  assert.equal(records.works_ongoing.length, 2);
  assert.equal(records.delivery.length, 0);
  assert.equal(records.workforce.length, 1);
});

test("the Issue log shows the default columns of the sheet with days open", () => {
  const log = buildFormLog(snapshot, "issue", { now: "2026-11-25T10:00:00Z" });
  assert.deepEqual(log.columns.map((column) => column.key), ["id", "date", "title", "type", "category", "discipline", "location", "priority", "party", "person", "target", "status", "open"]);
  const late = log.rows.find((row) => row.cells.id === "ISS-1");
  assert.equal(late.cells.party, "BouwCo N.V.");
  assert.equal(late.cells.location, "Building A");
  assert.equal(late.cells.open, "5");
  assert.equal(log.rows.find((row) => row.cells.id === "ISS-2").cells.open, "");
  assert.equal(log.rows[0].cells.id, "ISS-1");
});

test("filters: period, status, building, form-specific and full-text search", () => {
  const log = buildFormLog(snapshot, "issue", { now: "2026-11-25T10:00:00Z" });
  assert.equal(filterFormLog(log, { status: "open" }).length, 1);
  assert.equal(filterFormLog(log, { status: "closed" }).length, 1);
  assert.equal(filterFormLog(log, { from: "2026-11-15", to: "2026-11-25" }).length, 1);
  assert.equal(filterFormLog(log, { buildingId: "b2" }).length, 1);
  assert.equal(filterFormLog(log, { extra: { priority: "high" } }).length, 1);
  assert.equal(filterFormLog(log, { search: "slab" }).length, 1);
  assert.equal(filterFormLog(log, { contractor: "bouwco" }).length, 1);
});

test("periods: weeks run Monday to Sunday", () => {
  assert.deepEqual(periodRange("week", "2026-11-25T10:00:00Z"), { from: "2026-11-23", to: "2026-11-29" });
  assert.deepEqual(periodRange("last_week", "2026-11-25T10:00:00Z"), { from: "2026-11-16", to: "2026-11-22" });
  assert.deepEqual(periodRange("month", "2026-11-25T10:00:00Z"), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(periodRange("today", "2026-11-25T10:00:00Z"), { from: "2026-11-25", to: "2026-11-25" });
});

test("totals per log: quantity per activity, cost per currency, workforce, counts", () => {
  const wo = buildFormLog(snapshot, "works_ongoing");
  assert.ok(formLogTotals("works_ongoing", wo.rows).some((item) => item.key === "Quantity:Concrete Pouring (m3)" && item.value === "20"));
  const co = buildFormLog(snapshot, "change_order");
  const coTotals = formLogTotals("change_order", co.rows);
  assert.ok(coTotals.some((item) => item.key === "Cost impact:USD" && item.value === "1500"));
  assert.equal(coTotals.find((item) => item.key === "co-days").value, "5");
  const wf = buildFormLog(snapshot, "workforce");
  assert.equal(wf.rows[0].cells.total, "8");
  assert.ok(formLogTotals("workforce", wf.rows).some((item) => item.key === "workers" && item.value === "8"));
  const issues = buildFormLog(snapshot, "issue", { now: "2026-11-25T10:00:00Z" });
  const totals = formLogTotals("issue", issues.rows);
  assert.equal(totals.find((item) => item.key === "open").value, "1");
  assert.equal(totals.find((item) => item.key === "closed").value, "1");
});

test("personal injury data is only shown to HSE roles", () => {
  const hidden = buildFormLog(snapshot, "hse_incident", { canSeeSensitive: false });
  assert.equal(hidden.rows[0].cells.injury, "");
  const shown = buildFormLog(snapshot, "hse_incident", { canSeeSensitive: true });
  assert.equal(shown.rows[0].cells.injury, "First aid");
});

test("the export carries the headers and the filtered rows", () => {
  const log = buildFormLog(snapshot, "ncr");
  const report = formLogReport(log, log.rows, { language: "en", filtersText: "Period: all", generatedAt: "2026-11-25 10:00" });
  assert.equal(report.title, "NCR");
  assert.equal(report.headers[0], "NCR no.");
  assert.equal(report.rows.length, 1);
  assert.match(formLogCsv(report), /^"NCR no\."/);
});
