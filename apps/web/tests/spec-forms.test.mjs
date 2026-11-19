import assert from "node:assert/strict";
import test from "node:test";
import * as catalogue from "../lib/forms/spec-catalogue.ts";
import { activitiesFor, cleanSpecValues, fieldOptions, setSpecValue, specFacts, specForms, specMissing, workflowProfiles } from "../lib/forms/spec-forms.ts";
import { availableActions, signoffProfiles, signoffState } from "../lib/forms/signoff.ts";

/**
 * The client's developer specification (workbook FINAL v2), generated into
 * lib/forms/spec-catalogue.ts and applied per form by lib/forms/spec-forms.ts.
 */
test("the catalogue carries the workbook's lists exactly", () => {
  assert.equal(catalogue.workDisciplines.length, 17);
  assert.equal(catalogue.workDisciplines[0], "Preliminaries & Site Establishment");
  // Every discipline has its activities, and the Activity Detail Guide has a row for each.
  for (const discipline of catalogue.workDisciplines) assert.ok(activitiesFor(discipline).length > 0, discipline);
  assert.equal(Object.values(catalogue.activities).flat().length, 147);
  const pour = activitiesFor("Concrete & Reinforced Concrete").find((activity) => activity.value === "Concrete Pouring");
  assert.ok(pour?.description.startsWith("Place, compact"));
  assert.ok(pour?.completionOptions.includes("Other"));
  // Technical Instructions use the same 17 disciplines for their category list.
  assert.deepEqual(Object.keys(catalogue.instructionCategories), catalogue.workDisciplines);
  assert.deepEqual(catalogue.issueTypes, ["Quality", "Equipment", "Materials", "Schedule", "Operational", "Technical / Design", "Commercial / Contractual"]);
  assert.deepEqual(catalogue.recordStatuses, ["Open", "Assigned", "In Progress", "Pending Verification", "Closed", "Cancelled"]);
  assert.equal(catalogue.changeTypes.length, 10);
  assert.ok(catalogue.ncrContainment.includes("Not applicable (justification required)"));
  for (const [types, groups] of [[catalogue.issueTypes, catalogue.issueCategories], [catalogue.hseTypes, catalogue.hseCategories], [catalogue.ncrTypes, catalogue.ncrCategories], [catalogue.changeTypes, catalogue.changeCategories], [catalogue.lessonPhases, catalogue.lessonCategories], [catalogue.agreementTypes, catalogue.agreementCategories], [catalogue.incidentTypes, catalogue.incidentCategories], [catalogue.delayCauseTypes, catalogue.delayCauseCategories]]) {
    assert.deepEqual(Object.keys(groups), types);
    for (const type of types) assert.ok(groups[type].length > 0, type);
  }
});

test("a category only offers the chosen type's values and is cleared when the type changes", () => {
  const field = specForms.ncr.find((item) => item.key === "ncr_category");
  let values = { ncr_type: "Workmanship" };
  assert.ok(fieldOptions(field, values).some((option) => option.value === "Incorrect Work Method"));
  values = setSpecValue("ncr", values, "ncr_category", "Incorrect Work Method");
  values = setSpecValue("ncr", values, "ncr_type", "Materials & Products");
  assert.equal(values.ncr_category, "");
});

test("changing the discipline clears the activity, its completion items and its prompts", () => {
  let values = setSpecValue("works_completed", {}, "discipline", "Concrete & Reinforced Concrete");
  values = setSpecValue("works_completed", values, "activity", "Concrete Pouring");
  const option = fieldOptions(specForms.works_completed.find((item) => item.key === "completed_items"), values)[0].value;
  values = setSpecValue("works_completed", values, "completed_items", [option]);
  values = setSpecValue("works_completed", values, "discipline", "Masonry & Wall Construction");
  assert.equal(values.activity, "");
  assert.deepEqual(values.completed_items, []);
});

test("required fields follow the workbook, conditional ones only when their trigger applies", () => {
  const empty = specMissing("delay_report", {});
  assert.ok(empty.includes("Delay start date/time"));
  assert.ok(empty.includes("Critical path impact"));
  // Closed needs a closure note; an open record does not.
  assert.ok(!specMissing("issue", { workflow_status: "Open" }).includes("Resolution / closure note"));
  assert.ok(specMissing("issue", { workflow_status: "Closed" }).includes("Resolution / closure note"));
  // An approved change order needs the approved amount, days, approver and date.
  const approved = specMissing("change_order", { approval_status: "Approved" });
  for (const label of ["Approved amount", "Approved days", "Approved by", "Approval date"]) assert.ok(approved.includes(label), label);
  // A rejected completion needs a linked NCR or issue.
  assert.ok(specMissing("works_completed", { inspection_status: "Inspected - Rejected" }).includes("Linked NCR / issue"));
  // An agreement with an action needs its owner and due date.
  assert.ok(specMissing("agreement", { action_required: "Yes" }).includes("Due date"));
  assert.ok(!specMissing("agreement", { action_required: "No" }).includes("Due date"));
});

test("Other always asks for an explanation and Not applicable is never combined", () => {
  assert.ok(specMissing("photo", { photo_purpose: "Other" }).some((item) => item.includes("explanation for Other")));
  assert.ok(!specMissing("photo", { photo_purpose: "Other", photo_purpose_other: "Drone" }).some((item) => item.includes("explanation for Other")));
  const values = setSpecValue("ncr", { containment: ["Stop affected work / suspend activity"] }, "containment", ["Stop affected work / suspend activity", "Not applicable (justification required)"]);
  assert.deepEqual(values.containment, ["Not applicable (justification required)"]);
  assert.ok(specMissing("ncr", values).includes("Why no containment applies"));
});

test("a delivery that differs from its order asks for a discrepancy note", () => {
  const base = { supplier: "S", purchase_order: "PO-1", material_group: "Cement & Binders", material_specification: "CEM I", ordered_quantity: "10", delivery_status: "Arrived On Time", arrival_condition: "Good", inspection_result: "Accepted" };
  assert.ok(!specMissing("delivery", { ...base, delivered_quantity: "10" }).includes("Discrepancy / remarks"));
  assert.ok(specMissing("delivery", { ...base, delivered_quantity: "8" }).includes("Discrepancy / remarks"));
});

test("stored values keep only the form's own fields and read back as labelled facts", () => {
  const cleaned = cleanSpecValues("photo", { photo_purpose: "Site Conditions", stray: "x", discipline: "" });
  assert.deepEqual(cleaned, { photo_purpose: "Site Conditions" });
  assert.deepEqual(specFacts("photo", cleaned), [["Photo purpose", "Site Conditions"]]);
  assert.deepEqual(specFacts("photo", cleaned, "nl"), [["Doel van de foto", "Site Conditions"]]);
});

test("every form has its workflow profile and every profile its stages", () => {
  for (const form of Object.keys(specForms)) {
    if (form === "photo") continue;
    assert.ok(signoffProfiles[workflowProfiles[form]], form);
  }
  assert.ok(signoffProfiles[workflowProfiles.inspection]);
});

test("the sign-off state comes from the events: rounds, returns and closure", () => {
  const profile = signoffProfiles["NCR-CORRECTIVE"];
  const event = (action, new_status, stage_number, round_number = 1) => ({ action, new_status, stage_number, round_number, next_actor: null, due_at: null });
  assert.deepEqual(availableActions(profile, []).map((item) => item.action), ["submit"]);
  let events = [event("submit", "Submitted", 1)];
  assert.equal(signoffState(profile, events).stage.number, 2);
  assert.ok(availableActions(profile, events).some((item) => item.action === "acknowledge"));
  assert.ok(!availableActions(profile, events).some((item) => item.action === "resubmit"));
  events = [...events, event("acknowledge", "Acknowledged", 2), event("return", "Returned for Correction", 3)];
  assert.ok(availableActions(profile, events).some((item) => item.action === "resubmit"));
  events = [...events, event("resubmit", "Resubmitted", 4, 2), event("close", "Closed", 3, 2)];
  const state = signoffState(profile, events);
  assert.equal(state.closed, true);
  assert.equal(state.round, 2);
  assert.deepEqual(availableActions(profile, events).map((item) => item.action), ["reopen"]);
});
