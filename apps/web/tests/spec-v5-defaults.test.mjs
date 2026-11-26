import assert from "node:assert/strict";
import test from "node:test";
import { setSpecValue } from "../lib/forms/spec-forms.ts";

test("Issue: the category fixes the discipline when the workbook gives it one (v5.0 field 9)", () => {
  let values = setSpecValue("issue", {}, "issue_type", "Quality");
  values = setSpecValue("issue", values, "issue_category", "Concrete Works");
  assert.equal(values.discipline, "Concrete & Reinforced Concrete");
  values = setSpecValue("issue", values, "issue_category", "Welding & Fabrication");
  assert.equal(values.discipline, "Structural Steel & Metal Works");
  // A category without a fixed discipline releases the discipline that came from the mapping.
  values = setSpecValue("issue", values, "issue_category", "Workmanship");
  assert.equal(values.discipline, "");
  // ... and keeps one the user picked.
  values = setSpecValue("issue", values, "discipline", "Electrical Works");
  values = setSpecValue("issue", values, "issue_category", "Dimensional Accuracy");
  assert.equal(values.discipline, "Electrical Works");
});

test("Issue: the target date follows the priority until the user sets their own (v5.0 field 15)", () => {
  let values = { identified_at: "2026-11-23T11:02" };
  values = setSpecValue("issue", values, "priority", "High");
  assert.equal(values.target_date, "2026-11-26");
  values = setSpecValue("issue", values, "priority", "Critical");
  assert.equal(values.target_date, "2026-11-24");
  values = setSpecValue("issue", values, "target_date", "2026-12-24");
  values = setSpecValue("issue", values, "priority", "Low");
  assert.equal(values.target_date, "2026-12-24");
});

test("HSE: the due date follows the risk rating until the user sets their own", () => {
  let values = { observed_at: "2026-11-23T08:00" };
  values = setSpecValue("hse", values, "risk_rating", "High");
  assert.equal(values.due_date, "2026-11-26");
  values = setSpecValue("hse", values, "risk_rating", "Medium");
  assert.equal(values.due_date, "2026-11-30");
});

test("the Workforce form offers the 72 predefined worker disciplines, most used first", async () => {
  const { workerDisciplines } = await import("../lib/forms/disciplines.ts");
  assert.equal(workerDisciplines.length, 72);
  assert.equal(new Set(workerDisciplines).size, 72);
  assert.equal(workerDisciplines[0], "Foreman / supervisor");
  assert.ok(workerDisciplines.includes("Plasterer (pleisteraar)"));
});
