import assert from "node:assert/strict";
import test from "node:test";
import { periodDetailKeys, periodDetailsLine, periodFieldLabel, periodHours, periodProjectHead, periodTime, periodToken } from "../lib/reports/period-report-text.ts";

const date = (iso) => iso;

test("stored codes are written as Dutch words, free text is left alone", () => {
  assert.equal(periodToken("near_miss"), "Bijna-ongeval");
  assert.equal(periodToken("in_progress"), "In uitvoering");
  assert.equal(periodToken("recorded"), "Vastgelegd");
  assert.equal(periodToken("assigned"), "Toegewezen");
  assert.equal(periodToken("open"), "Open");
  assert.equal(periodToken("critical"), "Kritiek");
  assert.equal(periodToken("high"), "Hoog");
  assert.equal(periodToken("to_be_corrected"), "Te herstellen");
  assert.equal(periodToken("Roof leak at gridline C"), "Roof leak at gridline C");
  assert.equal(periodToken(""), "");
});

test("an unknown code never shows an underscore", () => {
  assert.doesNotMatch(periodToken("some_new_code"), /_/);
});

test("labels are Dutch and have no English key left", () => {
  for (const key of ["building_name", "due_date", "progress_percent", "hse_category", "responsible_person", "immediate_measure", "disposition", "action_required"]) {
    assert.doesNotMatch(periodFieldLabel(key), /_|:$/, key);
  }
  assert.equal(periodFieldLabel("building_name"), "Gebouw");
  assert.equal(periodFieldLabel("due_date"), "Deadline");
});

test("working hours read 07:00–16:00, not 07:00:00 16:00:00", () => {
  assert.equal(periodTime("07:00:00"), "07:00");
  assert.equal(periodHours("07:00:00", "16:00:00"), "07:00–16:00");
});

test("a record's detail line uses the Dutch labels and values", () => {
  const line = periodDetailsLine(
    { details: { building_name: "Hoofdgebouw", disposition: "to_be_corrected", progress_percent: 40, hse_category: "near_miss", status: "in_progress" } },
    periodDetailKeys,
    date,
  );
  assert.equal(line, "Gebouw: Hoofdgebouw | HSE-categorie: Bijna-ongeval | Beoordeling: Te herstellen | Voortgang: 40% | Status: In uitvoering");
  assert.doesNotMatch(line, /_/);
});

test("the project head names client, contractor and supervisor, or says so", () => {
  const head = periodProjectHead({
    project: { client_name: "Telesur" },
    parties: [{ party_type: "contractor", name: "Hoofdaannemer" }],
  });
  assert.deepEqual(head, [["Opdrachtgever", "Telesur"], ["Aannemer", "Hoofdaannemer"], ["Supervisor", "Niet geregistreerd"]]);
});
