import assert from "node:assert/strict";
import test from "node:test";
import { closeoutFromToday, recordInBuilding } from "../lib/forms/closeout-from-today.ts";
import { buildDailyReportModel, cleanReportText, NOT_RECORDED, plural } from "../lib/reports/daily-report-model.ts";

const hoofd = "b-1";
const oost = "b-2";

/** Two buildings, one finding and one HSE record per building, nothing entered for the second. */
const records = {
  report: { report_number: "DR-20261028", report_date: "2026-10-28" },
  project: { code: "E2E-001", name: "Demo", location: "Paramaribo", client_name: "Opdrachtgever NV" },
  created_by_profile: { display_name: "Supervisor Alpha" },
  buildings: [{ id: hoofd, name: "Hoofdgebouw" }, { id: oost, name: "Nieuwbouw Oost" }],
  parties: [
    { id: "p-1", name: "Hoofdaannemer BV", party_type: "contractor" },
    { id: "p-2", name: "Staalbouw NV", party_type: "subcontractor" },
  ],
  start_checks: [
    { building_id: hoofd, weather_condition: "partly_cloudy", temperature_c: 31, wind_condition: "moderate", shift_start: "07:00:00", shift_end: "16:00:00", expected_workers: null },
  ],
  closeouts: [
    { building_id: hoofd, day_summary: "Wapening gestort.", work_ongoing: "Wapening kolommen", work_performed: "", progress_percent: 40, inspection_result: "none", delay_cause: "none", delay_hours: 0, tomorrow_plan: "Storten dek", attachments_confirmed: false },
    { building_id: oost, day_summary: "Voorbereiding.", work_ongoing: "", work_performed: "Uitzetten", progress_percent: null, inspection_result: "none", delay_cause: "weather", delay_hours: 2, delay_reason: "Regen", tomorrow_plan: "", attachments_confirmed: false },
  ],
  attendance: [
    { building_id: hoofd, party_id: "p-1", discipline: "Ruwbouw", headcount: 1, entry_type: "worker" },
    { building_id: hoofd, party_id: "p-2", discipline: "Staal", headcount: 3, entry_type: "worker" },
  ],
  findings: [
    { finding_number: "Q-2026-0001", title: "Dekking te gering", severity: "critical", status: "open", building_id: hoofd, responsible_party_id: "p-1", due_at: "2026-11-02T12:00:00Z" },
    { finding_number: "Q-2026-0002", title: "Scheur in wand", severity: "high", status: "in_progress", building_id: oost, due_at: null },
  ],
  hse_events: [
    { event_number: "HSE-2026-0001", event_type: "near_miss", title: "Vallend object", severity: "high", status: "open", building_id: hoofd },
  ],
  open_actions: [{ action_number: "ACT-1", title: "Herstel dekking", owner_party_id: "p-1", due_at: "2026-11-03T12:00:00Z", status: "open" }],
  visual_captures: [{ id: "c-1", file_id: "f-1", building_id: oost, capture_type: "photo", title: "Voorbereiding", description: "", location_label: "Terrein", captured_at: "2026-10-28T14:05:00Z" }],
  file_manifest: [{ id: "f-1", original_name: "foto.jpg", category: "photo", created_at: "2026-10-28T14:05:00Z" }],
};

const model = buildDailyReportModel(records);
const section = (number) => model.sections.find((entry) => entry.number === number);
const allCells = () => model.sections.flatMap((entry) => [
  entry.title, ...(entry.paragraphs ?? []), ...(entry.facts ?? []).flat(), entry.empty ?? "",
  ...(entry.tables ?? []).flatMap(({ table }) => [...table.columns, ...table.rows.flat()]),
]);

test("the report has the client's numbered sections 1 to 18 here and a KPI block of ten figures", () => {
  assert.deepEqual(model.sections.map((entry) => entry.number), Array.from({ length: 18 }, (_, index) => index + 1));
  assert.deepEqual(model.kpis.map((kpi) => kpi.label), ["Voortgang", "Inspecties", "Afwijkingen", "Kritiek", "Incidenten", "Open acties", "Foto's", "Weervertraging", "Arbeiders", "Machines"]);
});

test("every finding and HSE line names its own building", () => {
  const findings = section(6).tables[0].table.rows;
  assert.equal(findings.find((row) => row[0] === "Q-2026-0001")[4], "Hoofdgebouw");
  assert.equal(findings.find((row) => row[0] === "Q-2026-0002")[4], "Nieuwbouw Oost");
  const nearMiss = section(7).tables.find((entry) => entry.caption === "Near misses").table.rows;
  assert.equal(nearMiss[0][5], "Hoofdgebouw");
});

test("a figure nobody entered is never replaced by a default", () => {
  assert.equal(section(3).facts.find(([label]) => label === "Verwachte bezetting")[1], NOT_RECORDED);
  const work = section(4).tables[0].table.rows;
  assert.equal(work.find((row) => row[1] === "Nieuwbouw Oost")[3], NOT_RECORDED);
  assert.equal(work.find((row) => row[1] === "Hoofdgebouw")[3], "40%");
  assert.equal(model.kpis.find((kpi) => kpi.label === "Voortgang").value, "40%");
  assert.equal(model.kpis.find((kpi) => kpi.label === "Machines").value, NOT_RECORDED);
});

test("the KPI block counts the recorded records", () => {
  const kpi = Object.fromEntries(model.kpis.map((entry) => [entry.label, entry.value]));
  assert.equal(kpi.Afwijkingen, "2");
  assert.equal(kpi.Kritiek, "1");
  assert.equal(kpi["Open acties"], "1");
  assert.equal(kpi["Foto's"], "1");
  assert.equal(kpi.Arbeiders, "4");
  assert.equal(kpi.Weervertraging, "2 uur");
});

test("an empty inspection result stays 'none' and no building borrows another's data", () => {
  assert.equal(section(5).empty, "Geen inspecties vastgelegd.");
  assert.deepEqual(section(5).facts.map(([, value]) => value), ["Geen inspectie", "Geen inspectie"]);
});

test("attendance is one line per organisation and discipline", () => {
  const rows = section(3).tables[0].table.rows;
  assert.deepEqual(rows.map((row) => [row[0], row[1], row[3]]), [["Hoofdaannemer BV", "Ruwbouw", "1"], ["Staalbouw NV", "Staal", "3"]]);
});

test("no cell shows a stored code or an English key", () => {
  for (const cell of allCells()) {
    assert.doesNotMatch(cell, /[a-z]+_[a-z]+/, `"${cell}" looks like a stored code`);
  }
  assert.ok(allCells().includes("Kritiek") && allCells().includes("In uitvoering"));
});

test("plural and invisible characters", () => {
  assert.equal(plural(1, "persoon", "personen"), "1 persoon");
  assert.equal(plural(2, "persoon", "personen"), "2 personen");
  assert.equal(cleanReportText(`Rea${String.fromCharCode(0xad)}di${String.fromCharCode(0x200b)}ness`), "Readiness");
});

const today = (overrides) => ({ inspections: [], findings: [], hse: [], ...overrides });
const inspection = { id: "i1", code: "INS-1", title: "Wapening", status: "completed" };
const finding = { id: "f1", code: "Q-1", title: "Dekking", type: "ncr" };

test("closeoutFromToday: no inspections means no inspection result, whatever else was found", () => {
  assert.equal(closeoutFromToday(today({})).inspectionResult, "none");
  const withFinding = closeoutFromToday(today({ findings: [finding] }));
  assert.equal(withFinding.inspectionResult, "none");
  assert.equal(withFinding.qualityIssues, "yes");
});

test("closeoutFromToday: inspections decide all_ok or issues", () => {
  assert.equal(closeoutFromToday(today({ inspections: [inspection] })).inspectionResult, "all_ok");
  assert.equal(closeoutFromToday(today({ inspections: [inspection], findings: [finding] })).inspectionResult, "issues");
});

test("a day log lists only the records of its own building, also for records filed under several", () => {
  const all = "all";
  assert.equal(recordInBuilding({ building_id: hoofd }, hoofd, all), true);
  assert.equal(recordInBuilding({ building_id: oost }, hoofd, all), false);
  assert.equal(recordInBuilding({ building_id: oost, building_ids: [oost, hoofd] }, hoofd, all), true);
  assert.equal(recordInBuilding({ building_id: hoofd, building_ids: [oost] }, hoofd, all), false);
  assert.equal(recordInBuilding({ building_id: oost }, all, all), true);
});
