import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { outcomeDetails, outcomeFields, outcomeReady, signoffOutcomeFields, signoffProfiles } from "../lib/forms/signoff.ts";
import { specForms } from "../lib/forms/spec-forms.ts";

const sql = await readFile(new URL("../../../supabase/migrations/202611250008_close_verify_approve_dialog.sql", import.meta.url), "utf8");
const server = JSON.parse(sql.match(/function app_private\.signoff_outcome_fields\(\)[\s\S]*?select '(\{[\s\S]*?\})'::jsonb;/)[1]);

test("the dialog's fields are the fields the database asks for, per profile and action", () => {
  const client = Object.fromEntries(Object.entries(signoffOutcomeFields).map(([profile, actions]) => [
    profile,
    Object.fromEntries(Object.entries(actions).map(([action, fields]) => [action, fields.map((field) => ({
      key: field.key, required: field.required, kind: field.kind,
      ...(field.options ? { options: field.options } : {}),
      ...(field.max ? { max: field.max } : {}),
    }))])),
  ]));
  assert.deepEqual(client, server);
});

test("every action that carries details is an action its stage offers", () => {
  for (const [profile, actions] of Object.entries(signoffOutcomeFields)) {
    const offered = new Set(signoffProfiles[profile].stages.flatMap((stage) => stage.actions));
    for (const action of Object.keys(actions)) assert.ok(offered.has(action), `${profile} offers ${action}`);
  }
});

test("the moved fields are no longer fields of the forms", () => {
  const has = (form, key) => specForms[form].some((field) => field.key === key);
  assert.ok(!has("issue", "closure_note"));
  assert.ok(!has("agreement", "closure_note"));
  assert.ok(!has("ncr", "verification_result") && !has("ncr", "verified_by") && !has("ncr", "verified_on"));
  assert.ok(!has("change_order", "approved_amount") && !has("change_order", "approved_days"));
  // The approval itself (who and when) stays visible as written by the database.
  assert.ok(has("change_order", "approved_by"));
  // Other forms keep their own closure note.
  assert.ok(has("hse", "closure_note"));
});

test("an action asks for its details only when it has some", () => {
  assert.deepEqual(outcomeFields("ISSUE-CLOSEOUT", "verify").map((field) => field.key), ["closure_note"]);
  assert.deepEqual(outcomeFields("CHANGE-APPROVAL", "approve").map((field) => field.key), ["approved_amount", "approved_days"]);
  assert.deepEqual(outcomeFields("CHANGE-APPROVAL", "reject"), []);
  assert.deepEqual(outcomeFields("WO-DAILY", "submit"), []);
  assert.deepEqual(outcomeFields("ISSUE-CLOSEOUT", ""), []);
});

test("the dialog is ready only with its required details; a decimal comma is sent as a point", () => {
  const approve = outcomeFields("CHANGE-APPROVAL", "approve");
  assert.equal(outcomeReady(approve, {}), false);
  assert.equal(outcomeReady(approve, { approved_amount: "900,5", approved_days: "3" }), true);
  assert.equal(outcomeReady(approve, { approved_amount: "nine", approved_days: "3" }), false);
  assert.deepEqual(outcomeDetails(approve, { approved_amount: " 900,5 ", approved_days: "3" }), { approved_amount: "900.5", approved_days: "3" });
  const verify = outcomeFields("NCR-CORRECTIVE", "verify");
  assert.equal(outcomeReady(verify, { verification_result: "Not Effective" }), false, "only Effective closes an NCR");
  assert.equal(outcomeReady(verify, { verification_result: "Effective" }), true);
  const back = outcomeFields("NCR-CORRECTIVE", "return");
  assert.equal(outcomeReady(back, {}), true, "a return needs no result");
  assert.equal(outcomeReady(back, { verification_result: "Rework Required" }), true);
  const issue = outcomeFields("ISSUE-CLOSEOUT", "close");
  assert.equal(outcomeReady(issue, { closure_note: "ab" }), false);
  assert.equal(outcomeReady(issue, { closure_note: "Sleeve realigned" }), true);
  assert.deepEqual(outcomeDetails(outcomeFields("AGREEMENT-ACK", "close"), { closure_note: "  " }), {});
});
