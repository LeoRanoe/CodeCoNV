import assert from "node:assert/strict";
import test from "node:test";
import { limitOf, parameterOf, proposeComplianceRows } from "../lib/verification/compliance-assistant.mjs";

const requirement = [{ page: 1, text: "5.1.2 Reinforcement. Yield strength of the bars: minimum 500 MPa. Concrete cover shall be 40 mm. Maximum slump 120 mm. Surface finish is smooth." }];

test("the parameter is the words before the figure and the limit is read from the wording", () => {
  assert.equal(parameterOf("Yield strength of the bars: minimum 500 MPa"), "Yield strength bars");
  assert.equal(limitOf("minimum 500 MPa"), "min");
  assert.equal(limitOf("Maximum slump 120 mm"), "max");
  assert.equal(limitOf("Concrete cover shall be 40 mm"), "exact");
});

test("the assistant proposes a row for every requirement that states a figure, and decides nothing it cannot read", () => {
  const submittal = [{ page: 3, text: "Product data. Yield strength of the bars: 520 MPa. Concrete cover of 35 mm is delivered. Slump measured at 110 mm." }];
  const rows = proposeComplianceRows(requirement, submittal);
  const byParameter = Object.fromEntries(rows.map((row) => [row.parameter, row]));
  assert.equal(rows.length, 3, "a requirement without a figure gets no row");
  assert.equal(byParameter["Yield strength bars"].result, "complies", "520 is at least 500");
  assert.equal(byParameter["Yield strength bars"].page, "3");
  const cover = rows.find((row) => /cover/i.test(row.parameter));
  assert.equal(cover.result, "does_not_comply", "35 mm is not 40 mm");
  assert.equal(cover.submitted, "35 mm");
  const slump = rows.find((row) => /slump/i.test(row.parameter));
  assert.equal(slump.result, "complies", "110 is at most 120");
});

test("a parameter the submittal does not mention is Not stated, never Complies", () => {
  const rows = proposeComplianceRows(requirement, [{ page: 1, text: "Cover page. Project documents." }]);
  assert.ok(rows.length >= 1);
  for (const row of rows) {
    assert.equal(row.result, "not_stated");
    assert.equal(row.submitted, "");
  }
});

test("a figure in another unit is not compared as if it were the same", () => {
  const rows = proposeComplianceRows([{ page: 1, text: "Wall thickness: 200 mm." }], [{ page: 1, text: "Wall thickness: 20 cm." }]);
  assert.equal(rows[0].result, "not_stated");
});

test("a requirement that stands on its own line of the page is read as its own requirement", () => {
  const rows = proposeComplianceRows(
    [{ page: 1, text: "Clause 5.2 Concrete Concrete strength class minimum 30 MPa Reinforcement cover minimum 40 mm Slump 80 mm", lines: "Clause 5.2 Concrete\nConcrete strength class minimum 30 MPa\nReinforcement cover minimum 40 mm\nSlump 80 mm" }],
    [{ page: 1, text: "Supplier datasheet Concrete strength class 35 MPa Reinforcement cover 45 mm", lines: "Supplier datasheet\nConcrete strength class 35 MPa\nReinforcement cover 45 mm" }],
  );
  const strength = rows.find((row) => /strength/i.test(row.parameter));
  assert.ok(strength, `a strength row is proposed (${rows.map((row) => row.parameter).join(" | ")})`);
  assert.equal(strength.result, "complies", "35 MPa is at least 30 MPa");
  const cover = rows.find((row) => /cover/i.test(row.parameter));
  assert.equal(cover.result, "complies", "45 mm is at least 40 mm");
});
