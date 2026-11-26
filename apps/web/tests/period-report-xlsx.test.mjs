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

const jpeg = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAoADwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCrRRRXkH0gUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/2Q==", "base64"));

const structured = {
  ...snapshot,
  buildings: [{ id: "b1", name: "Block A" }, { id: "b2", name: "Block B" }],
  parties: [{ id: "p1", name: "Contractor A NV" }, { id: "p2", name: "Contractor B NV" }],
  findings: [
    { id: "f1", finding_number: "NCR-1", finding_type: "ncr", title: "Cracks", status: "open", building_id: "b1", responsible_party_id: "p1", created_at: "2026-11-17T08:00:00Z" },
    { id: "f2", finding_number: "ISS-2", finding_type: "deficiency", title: "Paint", status: "closed", building_id: "b2", responsible_party_id: "p2", created_at: "2026-11-18T08:00:00Z" },
    { id: "f3", finding_number: "ISS-3", finding_type: "deficiency", title: "Door", status: "open", building_id: "b1", responsible_party_id: "p1", created_at: "2026-11-19T08:00:00Z" },
  ],
};

test("grouped by contractor, the workbook has a summary and a grouped sheet with every record once", async () => {
  const zip = await JSZip.loadAsync(await (await periodReportWorkbook(structured, { title: "Quality", language: "nl", groupBy: "contractor" })).arrayBuffer());
  const names = [...(await zip.file("xl/workbook.xml").async("string")).matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names.slice(-2), ["Samenvatting", "Gegroepeerd"]);
  const grouped = await zip.file(`xl/worksheets/sheet${names.indexOf("Gegroepeerd") + 1}.xml`).async("string");
  for (const code of ["NCR-1", "ISS-2", "ISS-3"]) assert.equal((grouped.match(new RegExp(`>${code}<`, "g")) ?? []).length, 1, `${code} appears once`);
  assert.match(grouped, /Contractor A NV/);
  assert.match(grouped, /gegroepeerd op|Gegroepeerd/i);
});

test("a summary workbook holds counts only, not the record sheets", async () => {
  const zip = await JSZip.loadAsync(await (await periodReportWorkbook(structured, { title: "Quality", language: "en", detail: "summary" })).arrayBuffer());
  const names = [...(await zip.file("xl/workbook.xml").async("string")).matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, ["Summary", "Open actions"]);
  const summary = await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.match(summary, /<v>2<\/v>/, "two issues");
  assert.match(summary, /Detail: summary/);
});

test("photos are real pictures anchored in their own rows, and the responses and the sign-off log get sheets", async () => {
  const blob = await periodReportWorkbook(structured, {
    title: "Photos", language: "en",
    photos: [{ code: "PH-1", caption: "Crack at axis B", building: "Block A", date: "2026-11-17", bytes: jpeg, width: 60, height: 40 }, { code: "PH-2", caption: "Paint", building: "Block B", date: "2026-11-18", bytes: jpeg, width: 60, height: 40 }],
    responses: [{ code: "NCR-1", title: "Cracks", responses: [{ action: "respond", by: "Alex", at: "2026-11-18", comments: "Repaired." }] }],
    signoffLog: [{ code: "NCR-1", title: "Cracks", history: [{ line: "17-11 · Submitted", comments: "" }] }],
  });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(zip.file("xl/media/image1.jpeg") && zip.file("xl/media/image2.jpeg"), "both pictures are in the package");
  assert.deepEqual([...await zip.file("xl/media/image1.jpeg").async("uint8array")], [...jpeg]);
  const drawing = await zip.file("xl/drawings/drawing1.xml").async("string");
  assert.equal((drawing.match(/<xdr:pic>/g) ?? []).length, 2);
  const types = await zip.file("[Content_Types].xml").async("string");
  assert.match(types, /Extension="jpeg"/);
  assert.match(types, /drawing1\.xml/);
  const names = [...(await zip.file("xl/workbook.xml").async("string")).matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names.slice(-3), ["Contractor responses", "Sign-off log", "Photos"]);
  const photoSheet = await zip.file(`xl/worksheets/sheet${names.indexOf("Photos") + 1}.xml`).async("string");
  assert.match(photoSheet, /<drawing r:id="rId1"\/>/);
  assert.match(photoSheet, /customHeight="1"/, "a picture row is as tall as the picture");
});
