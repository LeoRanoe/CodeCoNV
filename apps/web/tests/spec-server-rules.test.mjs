import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { specServerRules } from "../scripts/generate-spec-server-rules.mjs";

test("F03: the database's form rules are the rules of lib/forms/spec-forms.ts", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/202611230004_spec_server_validation.sql", import.meta.url), "utf8");
  const stored = JSON.parse(sql.match(/select '(\{.*?\})'::jsonb;\n\$rules\$/s)[1].replace(/''/g, "'"));
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
