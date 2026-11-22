import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { specServerRules } from "../scripts/generate-spec-server-rules.mjs";
import { specConditionHolds, specForms, specMissing } from "../lib/forms/spec-forms.ts";

test("F03: the database's form rules are the rules of lib/forms/spec-forms.ts", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/202611250005_approved_launch_units.sql", import.meta.url), "utf8");
  const stored = JSON.parse(sql.match(/select '(\{.*?\})'::jsonb;\r?\n\$rules\$/s)[1].replace(/''/g, "'"));
  assert.deepEqual(stored, specServerRules());
});

test("F03: the six workbook decisions are server rules", () => {
  const rules = specServerRules();
  assert.ok(rules.change_order.required.includes("change_reason"), "Change Order reason is required");
  assert.equal(rules.issue.options.responsible_party.length, 10, "Issue has the ten responsible parties");
  assert.ok(rules.issue.required.includes("responsible_party"));
  assert.ok(rules.hse.required.includes("action_owner"), "HSE observation has a register Action owner");
  assert.ok(!rules.delay_report.required.includes("evidence") && !rules.delay_report.required.includes("photos"), "PDR evidence stays optional");
  assert.ok(rules.lessons_learned.required.includes("what_happened") && !rules.lessons_learned.required.includes("issue"), "Lessons Learned follows the sheet");
  assert.ok(rules.ncr.required.indexOf("ncr_type") < rules.ncr.required.indexOf("requirement_reference"));
});

test("F03: every conditional requirement is a server rule, except the listed sensitive incident fields", () => {
  const rules = specServerRules();
  const clientOnly = Object.entries(rules).flatMap(([form, rule]) => rule.clientOnly.map((key) => `${form}.${key}`));
  assert.deepEqual(clientOnly, ["hse_incident.injury_classification", "hse_incident.injury_nature", "hse_incident.body_part"]);
  for (const [form, rule] of Object.entries(rules)) {
    for (const key of rule.clientOnly) assert.ok(specForms[form].find((field) => field.key === key).sensitive, `${form}.${key} is sensitive`);
  }
  assert.ok(rules.issue.conditional.some((item) => item.key === "closure_note"), "Issue closure note when Closed");
  assert.ok(rules.change_order.conditional.some((item) => item.key === "approved_amount"));
  assert.ok(rules.works_ongoing.conditional.some((item) => item.key === "crosses_midnight"));
  assert.deepEqual(rules.ncr.columns.containment_details, ["person", "implemented_at"]);
});

test("F03: the server condition and the form agree on each conditional field", () => {
  const rules = specServerRules();
  const samples = {
    issue: [{ workflow_status: "Closed" }, { workflow_status: "Open" }],
    ncr: [{ containment: ["Not applicable (justification required)"] }, { containment: ["Stop work"] }, { workflow_status: "Closed" }],
    delivery: [{ delivery_status: "Delayed" }, { ordered_quantity: "5", delivered_quantity: "4" }, { ordered_quantity: "5", delivered_quantity: "5", arrival_condition: "Good" }],
    change_order: [{ approval_status: "Approved" }, { approval_status: "Draft", added_quantity: "3" }],
    agreement: [{ action_required: "Yes" }, { action_required: "No" }],
    works_ongoing: [{ activity: "Concrete Pouring" }, { quantity_na: "yes" }, {}],
    works_completed: [{ inspection_status: "Inspected - Rejected" }, { inspection_status: "Inspected - Accepted" }],
  };
  for (const [form, list] of Object.entries(samples)) {
    for (const values of list) {
      const missing = specMissing(form, values, "en");
      for (const item of rules[form].conditional.filter((entry) => entry.key !== "crosses_midnight" && !entry.rows)) {
        const label = rules[form].labels[item.key];
        assert.equal(specConditionHolds(item.when, values), missing.includes(label), `${form}.${item.key} with ${JSON.stringify(values)}`);
      }
    }
  }
});
