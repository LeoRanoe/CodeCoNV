import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { periodReportSheets, periodReportWorkbook } from "../lib/reports/period-report-xlsx.mjs";

const snapshot = {
  generated_at: "2026-11-21T18:00:00Z",
  period: { start_date: "2026-11-16", end_date: "2026-11-21" },
  buildings: [{ id: "b1", name: "Block A" }], parties: [{ id: "p1", name: "Contractor A NV" }],
  day_reports: [{ report_date: "2026-11-20", building_id: "b1", status: "approved" }],
  attendance: [{ work_date: "2026-11-20", party_id: "p1", headcount: 12 }],
  inspections: [], findings: [{ finding_number: "NCR-1", title: "=SUM(A1)", status: "open", building_id: "b1" }],
  hse_events: [], register_entries: [], open_actions: [],
};

test("decision #13: a period report is one workbook with a sheet per section, names resolved, numbers kept", async () => {
  const sheets = periodReportSheets(snapshot);
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Day reports", "Workforce", "Inspections", "NCRs and issues", "HSE", "Register records", "Open actions"]);
  assert.deepEqual(sheets[0].rows[0], ["2026-11-20", "Block A", "approved"]);
  assert.deepEqual(sheets[1].rows[0], ["2026-11-20", "Contractor A NV", 12]);
  const zip = await JSZip.loadAsync(await (await periodReportWorkbook(snapshot, { title: "Weekly report", filters: "Discipline: Concrete" })).arrayBuffer());
  const workbook = await zip.file("xl/workbook.xml").async("string");
  assert.equal((workbook.match(/<sheet /g) ?? []).length, 7);
  const ncr = await zip.file("xl/worksheets/sheet4.xml").async("string");
  assert.match(ncr, /Period: 2026-11-16 – 2026-11-21/);
  assert.match(ncr, /Filters: Discipline: Concrete/);
  assert.match(ncr, /t="inlineStr"><is><t xml:space="preserve">=SUM\(A1\)/, "formula-like text stays literal");
  const workforce = await zip.file("xl/worksheets/sheet2.xml").async("string");
  assert.match(workforce, /<v>12<\/v>/);
});
