import assert from "node:assert/strict";
import test from "node:test";
import { issueDecisionMinimum, issueDecisionReady, noSignoffLogYet } from "../lib/forms/issue-decision-rules.mjs";

test("verifying an issue needs a closure note; returning needs a reason and who acts next", () => {
  assert.equal(issueDecisionReady({ action: "verify", note: "" }), false);
  assert.equal(issueDecisionReady({ action: "verify", note: "  ok " }), false, "padding does not count");
  assert.equal(issueDecisionReady({ action: "verify", note: "Checked on site." }), true);
  assert.equal(issueDecisionReady({ action: "return", note: "Crack still visible.", nextActor: "" }), false);
  assert.equal(issueDecisionReady({ action: "return", note: "Crak", nextActor: "Alex" }), false, "the reason is at least 5 characters");
  assert.equal(issueDecisionReady({ action: "return", note: "Crack still visible.", nextActor: "Alex" }), true);
  assert.deepEqual(issueDecisionMinimum, { verify: 3, return: 5 });
});

test("an issue without a sign-off log is recognised so the status can still move", () => {
  assert.equal(noSignoffLogYet("The first sign-off action on a record is a submission"), true);
  assert.equal(noSignoffLogYet("Only an authorised reviewer can verify this record"), false);
});
