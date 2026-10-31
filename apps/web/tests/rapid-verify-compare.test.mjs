import assert from "node:assert/strict";
import test from "node:test";
import { coloursIn, compareSpecificationValues, quantitiesIn } from "../lib/rapid-verify/compare-values.mjs";

const prescribed = "Beglazing: gelaagd glas, dikte 12 mm, kleur grijs. Windbelasting 1,2 kN/m2.";

test("12 mm prescribed against 13 mm submitted is flagged as different", () => {
  const rows = compareSpecificationValues("Ingediend: gelaagd glas, dikte 13 mm, kleur grijs.", prescribed);
  const thickness = rows.find((row) => row.submitted === "13 mm");
  assert.equal(thickness.status, "differs");
  assert.deepEqual(thickness.prescribed, ["12 mm"]);
  assert.equal(rows.find((row) => row.kind === "colour").status, "matches");
});

test("equal values match, whatever the decimal mark", () => {
  const rows = compareSpecificationValues("dikte 12,0 mm", "dikte 12 mm");
  assert.equal(rows[0].status, "matches");
});

test("a unit the sources never mention is reported as not found, not as a difference", () => {
  const rows = compareSpecificationValues("gewicht 40 kg", prescribed);
  assert.equal(rows[0].status, "not_found");
});

test("a different colour is flagged, in either language", () => {
  const rows = compareSpecificationValues("colour: black", prescribed);
  assert.equal(rows[0].status, "differs");
  assert.deepEqual(coloursIn("Kleur zwart en wit"), ["black", "white"]);
});

test("units are read as whole words", () => {
  assert.deepEqual(quantitiesIn("12 mm, 3 meter, 61%"), [{ number: 12, unit: "mm" }, { number: 61, unit: "%" }]);
});
