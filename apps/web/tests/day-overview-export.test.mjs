import assert from "node:assert/strict";
import test from "node:test";
import { buildDayExport, humanize } from "../lib/reports/day-overview-export.ts";

const ink = `data:image/png;base64,${"A".repeat(60)}`;
const context = {
  text: (en) => en,
  projectName: "Demo",
  projectCode: "E2E-001",
  dayLabel: "Wednesday 18 November 2026",
  day: "2026-11-18",
  generatedBy: "Supervisor Alpha",
  generatedAt: "18 Nov 2026, 17:00",
  buildingNames: (primary) => (primary === "b1" ? "Main building" : ""),
  partyName: (id) => (id === "p1" ? "Main contractor" : ""),
  registerNames: { delivery: "Materials delivery", technical_instruction: "Technical instruction (TI)", change_order: "Change order (CO)", delay_report: "Project Delay Report (PDR)", lessons_learned: "Lessons Learned (LL)", agreement: "Agreements Made", meeting: "Meeting" },
  statusText: (code) => humanize(code),
  severityText: (code) => humanize(code),
  delayCause: (code) => humanize(code),
  timeOf: () => "10:00",
  momentOf: (value) => (value ? "18 Nov 2026, 10:00" : ""),
};

const empty = { workforce: { headcount: 0, visitors: 0, entries: [] }, worksOngoing: [], worksCompleted: [], delays: [], issues: [], ncrs: [], hse: [], inspections: [], registers: { delivery: [], technical_instruction: [], change_order: [], delay_report: [], lessons_learned: [], agreement: [] }, photos: [] };

test("every Workspace form is a section of the export, also when nothing was recorded", () => {
  const document = buildDayExport(empty, context);
  assert.deepEqual(document.sections.map((section) => section.key), [
    "workforce", "works_ongoing", "works_completed", "delays", "issues", "ncr", "hse", "inspections",
    "delivery", "technical_instruction", "change_order", "delay_report", "lessons_learned", "agreement", "photos",
  ]);
  assert.match(document.emptyNote, /Nothing recorded: Workforce · Works ongoing/);
  assert.equal(document.fileName, "Day-report-E2E-001-2026-11-18");
});

test("a record carries its own boxes and every signature written on it", () => {
  const document = buildDayExport({
    ...empty,
    workforce: { headcount: 5, visitors: 1, entries: [{ party_id: "p1", discipline: "Masonry", building_id: "b1", headcount: 5, entry_type: "workforce" }, { headcount: 1, entry_type: "visitor" }] },
    ncrs: [{ finding_number: "Q-1", title: "Rebar", description: "Spacing wrong", status: "open", severity: "high", responsible_party_id: "p1", building_id: "b1", issue_management: { ncr_category: "Workmanship", disposition: "to_be_corrected", responsible_role: "contractor", responsible_person: "Jan", signed_by: "Eng", signed_at: "2026-11-18T13:00:00Z", signature_image: ink, contractor_signed_by: "Jan", contractor_signed_at: "2026-11-18T13:05:00Z", contractor_signature_image: ink } }],
    hse: [{ event_number: "HSE-1", title: "Fall", description: "Secret details", status: "open", confidential: true, signature_image: ink, signed_by: "Sup" }],
    registers: { ...empty.registers, lessons_learned: [{ entry_number: "LL-1", title: "Cover rebar", status: "open", occurred_at: "2026-11-18T13:00:00Z", details: { issue: "Rust", cause: "Rain", solution_improvement: "Tarp", expected_results: "Clean", lesson_status: "in_progress" } }], meeting: [{ entry_number: "M-1", title: "Kick-off", status: "open", occurred_at: "2026-11-18T13:00:00Z", details: { description: "Planning" } }] },
  }, context);
  const section = (key) => document.sections.find((item) => item.key === key);

  assert.equal(section("workforce").summary, "5 on site · 1 visitor(s)");
  assert.deepEqual(section("workforce").table.rows, [["Main contractor · Masonry · Main building", "5"]]);

  const ncr = section("ncr").items[0];
  assert.ok(ncr.facts.some(([label, value]) => label === "Description" && value === "Spacing wrong"));
  assert.ok(ncr.facts.some(([label, value]) => label === "Responsible" && value === "Contractor · Jan"));
  assert.ok(ncr.facts.some(([label, value]) => label === "Disposition" && value === "To be corrected"));
  assert.deepEqual(ncr.signatures.map((signature) => signature.label), ["Engineer (issued by)", "Contractor"]);

  // A confidential HSE record is listed, never spelled out in the file.
  const hse = section("hse").items[0];
  assert.match(hse.title, /confidential/);
  assert.ok(!hse.facts.some(([, value]) => value.includes("Secret")));
  assert.equal(hse.signatures.length, 0);

  const lesson = section("lessons_learned").items[0];
  assert.deepEqual(lesson.facts.filter(([label]) => /^\d · /.test(label)).map(([label]) => label), ["1 · Issue", "2 · Cause", "3 · Solution / improvement", "4 · Expected results"]);
  assert.equal(lesson.status, "In progress");

  // A register type without a section of its own is not lost.
  assert.equal(section("other_registers").items[0].title, "Meeting · Kick-off");
});

test("stored codes read as words, written prose stays as written", () => {
  assert.equal(humanize("to_be_corrected"), "To be corrected");
  assert.equal(humanize("Gescheurde kolom bij as B"), "Gescheurde kolom bij as B");
  assert.equal(humanize(["ppe_provided", "area_barricaded"]), "Ppe provided, Area barricaded");
  assert.equal(humanize(null), "");
});
