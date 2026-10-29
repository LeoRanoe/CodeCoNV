import assert from "node:assert/strict";
import test from "node:test";
import { changeOrderMissing, changeOrderReady, emptyChangeOrder } from "../lib/forms/change-order.ts";
import { delayReportMissing, delayReportReady, emptyDelayReport } from "../lib/forms/delay-report.ts";

// QA M19: the "still needed" line names the fields the form is really waiting for.
test("a delay report names every field it still needs, and the list agrees with the ready rule", () => {
  const names = delayReportMissing(emptyDelayReport).map((item) => item.nl);
  assert.deepEqual(names, [
    "geplande werkzaamheid", "omschrijving", "categorie", "soort", "impact",
    "oorspronkelijke einddatum", "status op die datum", "inloopplan", "vertegenwoordiger aannemer",
  ]);
  assert.equal(delayReportReady(emptyDelayReport), false);
  const filled = {
    ...emptyDelayReport, activity: "a", description: "vertraging", categories: ["weather"], types: ["x"], impacts: ["time"],
    originalFinishDate: "2026-10-01", statusOnFinishDate: "behind", recoveryPlan: "extra ploeg", contractorRepresentative: "Jan",
  };
  assert.deepEqual(delayReportMissing(filled), []);
  assert.equal(delayReportReady(filled), true);
});

test("a change order asks for the scope area, not just 'details'", () => {
  assert.deepEqual(changeOrderMissing(emptyChangeOrder).map((item) => item.nl), [
    "soort wijzigingsopdracht", "reden", "scope-gebied", "omschrijving van de scope",
  ]);
  const withSchedule = { ...emptyChangeOrder, changeOrderType: "a", reason: "b", scopeAreas: ["c"], scopeDetails: "details", affectsSchedule: true };
  assert.deepEqual(changeOrderMissing(withSchedule).map((item) => item.nl), ["oorspronkelijke einddatum"]);
  assert.equal(changeOrderReady({ ...withSchedule, originalFinishDate: "2026-10-01" }), true);
});
