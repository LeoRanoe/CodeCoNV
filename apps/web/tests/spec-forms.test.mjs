import assert from "node:assert/strict";
import test from "node:test";
import * as catalogue from "../lib/forms/spec-catalogue.ts";
import { activitiesFor, canChooseDecision, cleanSpecValues, fieldOptions, isSheetRow, isSheetSlot, matrixRating, projectList, sensitiveKeys, setSpecValue, sheetKeys, sheetLayouts, specFacts, specFollowUps, specForms, specLinks, specMissing, upgradeSpecValues, workflowProfiles } from "../lib/forms/spec-forms.ts";
import { availableActions, effectiveProfile, signoffHistoryEntries, signoffProfiles, signoffState } from "../lib/forms/signoff.ts";
import { facetOptions, filterPeriodSnapshot, matchesSpecFacets, recordSpec, specFacets } from "../lib/forms/spec-facets.ts";
import { specLabel } from "../lib/forms/spec-labels-nl.ts";
import { specValueNl } from "../lib/forms/spec-catalogue-nl.ts";
import { buildRecordDirectory, filterRecordDirectory } from "../lib/records/record-directory.mjs";

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
  assert.ok(empty.includes("Delay cause type"));
  // The PDR is its sheet, row by row: the critical-path question is asked on it.
  assert.ok(empty.includes("Critical path impact"));
  // Closed needs a closure note; an open record does not.
  assert.ok(!specMissing("issue", { workflow_status: "Open" }).includes("Resolution / closure note"));
  assert.ok(specMissing("issue", { workflow_status: "Closed" }).includes("Resolution / closure note"));
  // An approved change order needs the approved amount and days; who approved and when is
  // recorded by the database, never typed.
  const approved = specMissing("change_order", { approval_status: "Approved" });
  for (const label of ["Approved amount", "Approved days"]) assert.ok(approved.includes(label), label);
  for (const label of ["Approved by", "Approval date"]) assert.ok(!approved.includes(label), label);
  // A rejected completion needs a linked NCR or issue.
  assert.ok(specMissing("works_completed", { inspection_status: "Inspected - Rejected" }).includes("Linked NCR / issue"));
  // Agreements Made rows 11 and 12: an action needs its owner and due date.
  for (const label of ["Action owner", "Due date"]) {
    assert.ok(specMissing("agreement", { action_required: "Yes" }).includes(label), label);
    assert.ok(!specMissing("agreement", { action_required: "No" }).includes(label), label);
  }
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

test("people, suppliers, crews and records are chosen from the registers and stored with their reference", () => {
  for (const [form, key, kind] of [["ncr", "action_owner", "person"], ["technical_instruction", "issued_to", "person"], ["delivery", "supplier", "person"], ["agreement", "agreed_by", "people"], ["works_ongoing", "crew", "people"], ["change_order", "originator", "person"], ["hse_incident", "hse_reviewer", "person"], ["issue", "related_record", "record"], ["ncr", "related_inspection", "record"], ["works_completed", "ncr_reference", "record"], ["hse", "related_record", "record"], ["works_ongoing", "building_area", "location"]]) {
    assert.equal(specForms[form].find((field) => field.key === key)?.kind, kind, `${form}.${key}`);
  }
  assert.deepEqual(specForms.delivery.find((field) => field.key === "supplier").people.partyTypes, ["supplier"]);
  const cleaned = cleanSpecValues("ncr", { action_owner: "Jan Aannemer", action_owner_ref: "party:p1", related_inspection: "INS-0003", related_inspection_ref: "inspection:i1" });
  assert.equal(cleaned.action_owner_ref, "party:p1");
  assert.equal(cleaned.related_inspection_ref, "inspection:i1");
  assert.deepEqual(specLinks("ncr", cleaned), [{ label: "Related inspection", number: "INS-0003", ref: "inspection:i1" }]);
  // A name typed before the registers existed still reads back.
  assert.deepEqual(specFacts("ncr", { action_owner: "Old typed name" }).find(([label]) => label === "Action owner"), ["Action owner", "Old typed name"]);
});

test("the workbook status is shown, never asked; decisions are a reviewer's and recorded by the database", () => {
  const status = specForms.issue.find((field) => field.key === "workflow_status");
  assert.equal(status.derived, true);
  assert.ok(!specMissing("issue", {}).includes("Status"));
  const approval = specForms.change_order.find((field) => field.key === "approval_status");
  assert.equal(canChooseDecision(approval, "Approved", false), false);
  assert.equal(canChooseDecision(approval, "Submitted", false), true);
  assert.equal(canChooseDecision(approval, "Approved", true), true);
  for (const [form, key] of [["lessons_learned", "review_status"], ["works_completed", "inspection_status"], ["delivery", "inspection_result"], ["ncr", "verification_result"]]) {
    assert.ok(specForms[form].find((field) => field.key === key)?.decision, `${form}.${key}`);
  }
  for (const [form, key] of [["change_order", "approved_by"], ["change_order", "approved_on"], ["ncr", "verified_by"], ["lessons_learned", "reviewed_by"]]) {
    assert.equal(specForms[form].find((field) => field.key === key)?.auto, true, `${form}.${key}`);
  }
});

test("works: crossing midnight, quantity N/A, secondary discipline and the location register", () => {
  const base = { start_time: "22:00", finish_time: "02:00" };
  assert.ok(specMissing("works_ongoing", base).some((item) => item.startsWith("Finish time is earlier")));
  assert.ok(!specMissing("works_ongoing", { ...base, crosses_midnight: "yes" }).some((item) => item.startsWith("Finish time is earlier")));
  assert.equal(cleanSpecValues("works_ongoing", { ...base, crosses_midnight: "yes" }).crosses_midnight, "yes");
  assert.ok(specMissing("works_completed", {}).includes("Quantity completed"));
  assert.ok(!specMissing("works_completed", { quantity_na: "yes" }).includes("Quantity completed"));
  assert.ok(specForms.works_ongoing.some((field) => field.key === "secondary_discipline"));
  assert.ok(specMissing("works_ongoing", {}).includes("Building / area"));
  assert.ok(specForms.works_completed.find((field) => field.key === "completed_items").hint.en.includes("Photo evidence is recommended"));
});

test("risk rating: the approved matrix calculates it, otherwise a controlled rating is chosen", () => {
  const values = { risk_likelihood: "Likely", risk_severity: "Major" };
  assert.ok(specMissing("hse", values).includes("Risk rating"));
  assert.equal(matrixRating(values, null), "");
  const config = { risk_matrix: { enabled: true, cells: { "Likely|Major": "High" } } };
  assert.equal(matrixRating(values, config), "High");
  assert.equal(cleanSpecValues("hse", values, config).risk_rating, "High");
  assert.equal(cleanSpecValues("hse", values, config).risk_rating_basis, "matrix");
  assert.deepEqual(fieldOptions(specForms.hse.find((field) => field.key === "risk_rating"), values, null).map((option) => option.value), ["Low", "Medium", "High", "Critical"]);
});

test("project lists add and retire values; a retired value stays on the records that carry it", () => {
  const config = { lists: { shifts: { added: ["Weekend"], retired: ["Evening"] } } };
  assert.deepEqual(projectList("shifts", config).map((option) => option.value), ["Day", "Night", "Weekend", "Other"]);
  assert.ok(specFacts("works_ongoing", { shift: "Evening" }).some(([, value]) => value === "Evening"));
  assert.equal(cleanSpecValues("photo", { photo_purpose: "Site Conditions" }, { lists_version: 4 }).lists_version, "4");
});

test("incident and agreement actions are rows that each become a linked action", () => {
  const values = { corrective_actions: [{ action: "Replace ladder", owner: "Sam", owner_ref: "user:u1", due: "2026-12-01" }, { action: "", owner: "" }] };
  assert.deepEqual(specFollowUps("hse_incident", values).map((item) => item.row.action), ["Replace ladder"]);
  assert.equal(cleanSpecValues("hse_incident", values).corrective_actions.length, 1);
  // The incident's older one-box text becomes rows.
  assert.deepEqual(upgradeSpecValues("hse_incident", { corrective_actions: "Fix rail — Jan — 2026-12-02" }).corrective_actions, [{ action: "Fix rail", owner: "Jan", due: "2026-12-02" }]);
  // Agreements Made rows 11 and 12: one Action owner and one Due date.
  assert.deepEqual(upgradeSpecValues("agreement", { action_owner: "Jan", action_due: "2026-12-03" }), { action_owner: "Jan", due_date: "2026-12-03" });
  assert.deepEqual(upgradeSpecValues("agreement", { actions: [{ action: "Send", owner: "Piet", owner_ref: "party:p1", due: "2026-12-04" }] }), { action_owner: "Piet", action_owner_ref: "party:p1", due_date: "2026-12-04" });
  // NCR containment: one row per step, with person, time and evidence.
  const ncr = { containment: ["Stop affected work / suspend activity"] };
  assert.ok(specMissing("ncr", ncr).some((item) => item.includes("Stop affected work / suspend activity · Responsible person")));
});

test("restricted incident data stays out of exports unless asked for", () => {
  const values = { incident_type: "Injury / Illness", people_involved: ["P. Jansen"], body_part: "Hand", witnesses: ["K. de Vries"] };
  assert.ok(!specFacts("hse_incident", values).some(([label]) => /People involved|Body part|Witnesses/.test(label)));
  assert.ok(specFacts("hse_incident", values, "en", { includeSensitive: true }).some(([label]) => label === "Body part affected"));
  assert.ok(sensitiveKeys("hse_incident").includes("people_involved"));
});

test("reporting filters read the same four facets from every form", () => {
  const ncr = { finding_type: "ncr", issue_management: { spec: { discipline: "Concrete & Reinforced Concrete", ncr_type: "Workmanship", workflow_status: "Open", severity: "Major" } } };
  const register = { details: { spec: { change_type: "Scope Change", approval_status: "Draft" } } };
  const facets = specFacets(recordSpec(ncr));
  assert.deepEqual(facets, { discipline: "Concrete & Reinforced Concrete", type: "Workmanship", category: "", status: "Open", priority: "Major" });
  assert.ok(matchesSpecFacets(facets, { discipline: "Concrete & Reinforced Concrete", status: "Open" }));
  assert.ok(!matchesSpecFacets(specFacets(recordSpec(register)), { status: "Open" }));
  assert.deepEqual(facetOptions([facets]).priority, ["Major"]);
  const filtered = filterPeriodSnapshot({ findings: [ncr], register_entries: [register], day_reports: [1] }, { type: "Scope Change" });
  assert.equal(filtered.findings.length, 0);
  assert.equal(filtered.register_entries.length, 1);
  assert.equal(filtered.day_reports.length, 1);
  const directory = buildRecordDirectory({ findings: [{ ...ncr, id: "f1", finding_number: "NCR-0001", title: "Honeycombing", status: "open", created_at: "2026-11-20" }] });
  assert.equal(filterRecordDirectory(directory, "", { discipline: "Concrete & Reinforced Concrete" }).length, 1);
  assert.equal(filterRecordDirectory(directory, "", { discipline: "Masonry & Wall Construction" }).length, 0);
});

test("every workbook value has a Dutch label; the stored value stays English", () => {
  const values = new Set();
  for (const value of Object.values(catalogue)) {
    if (Array.isArray(value)) value.forEach((item) => values.add(item));
    else for (const [group, options] of Object.entries(value)) { values.add(group); for (const option of options) { values.add(option.value); for (const item of option.completionOptions ?? []) values.add(item); } }
  }
  const missing = [...values].filter((value) => !specValueNl[value]);
  assert.deepEqual(missing, []);
  assert.equal(specLabel("Near Miss", "nl"), "Bijna-ongeval");
  assert.equal(specLabel("Near Miss", "en"), "Near Miss");
  assert.deepEqual(specFacts("photo", { photo_purpose: "Site Conditions" }, "nl", { translate: (value) => specLabel(value, "nl") }), [["Doel van de foto", "Terreinomstandigheden"]]);
});

test("sign-off history prints one line per event; the project's role names replace the sheet's", () => {
  const events = [
    { action: "submit", new_status: "Submitted", previous_status: null, stage_number: 1, round_number: 1, actor_name: "Ada", actor_organization: "CODECO", actor_role: "Supervision", attestation_method: "account", comments: null, created_at: "2026-11-20T12:00:00Z", signature_image: null },
    { action: "acknowledge", new_status: "Acknowledged", previous_status: "Submitted", stage_number: 2, round_number: 1, actor_name: "Jan", actor_organization: "Bouw NV", actor_role: "Contractor", attestation_method: "signed_document", comments: "Received", created_at: "2026-11-20T13:00:00Z", signature_image: null },
  ];
  const lines = signoffHistoryEntries(events, "en");
  assert.equal(lines.length, 2);
  assert.match(lines[0].line, /Submit · Ada \(CODECO\) · Supervision · round 1 · — → Submitted/);
  assert.match(lines[1].line, /signed document/);
  assert.equal(lines[1].comments, "Received");
  const profile = effectiveProfile(signoffProfiles["CHANGE-APPROVAL"], { stages: { 3: { role_en: "Project director" } } });
  assert.equal(profile.stages.find((stage) => stage.number === 3).role.en, "Project director");
  assert.equal(signoffState(profile, [{ ...events[0], new_status: "Partially Approved (1/2)", action: "approve", stage_number: 3 }]).closed, false);
});

test("every short list and tick-box choice has its own picture (client, 20-11-2026)", async () => {
  const { readFile } = await import("node:fs/promises");
  const pictures = await readFile(new URL("../lib/forms/choice-icons.tsx", import.meta.url), "utf8");
  const scaleKeys = new Set(["priority", "severity", "risk_likelihood", "risk_severity", "risk_rating", "incident_severity", "property_damage", "injury_classification"]);
  const missing = [];
  for (const [form, fields] of Object.entries(specForms)) {
    for (const field of fields) {
      const short = ["select", "rating", "dependent"].includes(field.kind);
      if (!short && !["multi", "completion"].includes(field.kind)) continue;
      const options = fieldOptions(field, {}, undefined);
      if (short && options.length > 6) continue;
      if (scaleKeys.has(field.key)) continue;
      for (const option of options) if (!pictures.includes(`"${option.value}":`)) missing.push(`${form}.${field.key}: ${option.value}`);
      // Two choices of one list never share a picture.
      const shapes = options.map((option) => pictures.match(new RegExp(`"${option.value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}": (\\w+)`))?.[1]);
      const repeated = shapes.filter((shape, index) => shape && shapes.indexOf(shape) !== index);
      if (repeated.length) missing.push(`${form}.${field.key} repeats ${repeated.join(", ")}`);
    }
  }
  assert.deepEqual(missing, []);
});

/**
 * START HERE: "Use the relevant form sheet to build each screen in the stated field order."
 * Every Workspace form is laid out from its sheet: each row in the sheet's order, nothing
 * appended underneath and no field of the form left out.
 */
test("every Workspace form is its workbook sheet, row by row", () => {
  const sheetForms = ["issue", "ncr", "hse", "hse_incident", "delivery", "technical_instruction", "change_order", "delay_report", "lessons_learned", "agreement", "works_ongoing", "works_completed"];
  for (const form of sheetForms) {
    const layout = sheetLayouts[form];
    assert.ok(layout, `${form} has a sheet layout`);
    const keys = sheetKeys(form);
    assert.equal(new Set(keys).size, keys.length, `${form}: no row twice`);
    for (const key of keys) assert.ok(specForms[form].some((field) => field.key === key), `${form}: ${key} is a field`);
    // Works place "Building / area" with the screen's own building and location picker.
    for (const field of specForms[form]) {
      if (field.key === "building_area" && form.startsWith("works_")) continue;
      assert.ok(keys.includes(field.key), `${form}: ${field.key} stands in the sheet order`);
    }
  }
  // Sheet order, spot-checked against the workbook rows.
  const order = (form) => sheetLayouts[form].map((item) => (isSheetRow(item) ? `#${item.row}` : isSheetSlot(item) ? `@${item.slot}` : item));
  assert.deepEqual(order("issue").slice(0, 8), ["identified_at", "issue_type", "issue_category", "@title", "@description", "@location", "discipline", "priority"]);
  assert.deepEqual(order("hse").slice(0, 6), ["observed_at", "hse_type", "hse_category", "@title", "@description", "@location"]);
  assert.deepEqual(order("change_order").slice(0, 8), ["request_date", "change_type", "change_category", "@title", "@description", "change_reason", "originator", "@location"]);
  assert.deepEqual(order("delivery").slice(0, 4), ["delivery_at", "supplier", "purchase_order", "delivery_note_number"]);
  assert.deepEqual(order("lessons_learned").slice(0, 6), ["recorded_on", "project_phase", "lesson_category", "@title", "situation", "what_happened"]);
  // Literal labels and lists of the sheets (checked 20-11-2026).
  const field = (form, key) => specForms[form].find((item) => item.key === key);
  assert.deepEqual(field("issue", "responsible_party").options, ["Client", "Consultant", "Main Contractor", "Subcontractor", "Supplier", "Utility Provider", "Authority", "Weather", "Shared", "Undetermined"]);
  assert.equal(field("issue", "responsible_party").required, true);
  assert.equal(field("issue", "discipline").label.en, "Discipline / work package");
  assert.equal(field("ncr", "discipline").label.en, "Discipline / work package");
  assert.equal(field("technical_instruction", "discipline").label.en, "Discipline");
  assert.equal(field("lessons_learned", "discipline").label.en, "Discipline");
  // Not rows of these sheets.
  assert.equal(field("works_completed", "activity_details"), undefined);
  assert.equal(field("delay_report", "related_record"), undefined);
});

test("F07: each activity's guide prompts are answered, stored with the prompt, reopened and cleared on a new activity", async () => {
  const { activityPrompts, cleanSpecValues, rowsFor, setSpecValue, specFacts, specForms, activitiesFor } = await import("../lib/forms/spec-forms.ts");
  const { workDisciplines } = await import("../lib/forms/spec-catalogue.ts");
  const activities = workDisciplines.flatMap((name) => activitiesFor(name).map((activity) => ({ name, activity })));
  assert.equal(activities.length, 147, "all 147 guide rows");
  for (const { name, activity } of activities) {
    const prompts = activityPrompts({ discipline: name, activity: activity.value });
    assert.ok(prompts.length >= 4, `${activity.value} has its prompts`);
    assert.ok(prompts.every((prompt) => !/quantity and unit/i.test(prompt)), "the quantity prompt is the Quantity field");
  }
  for (const form of ["works_ongoing", "works_completed"]) {
    const field = specForms[form].find((item) => item.key === "activity_answers");
    let values = { discipline: "Surveying & Setting Out", activity: "Building / Grid Setting Out" };
    const [first] = rowsFor(field, values);
    assert.equal(first.step, activityPrompts(values)[0]);
    values = { ...values, activity_answers: [{ step: first.step, answer: "Grid lines A-D" }] };
    const stored = cleanSpecValues(form, values);
    assert.deepEqual(stored.activity_answers, [{ step: first.step, answer: "Grid lines A-D" }], `${form} stores only answered prompts`);
    assert.ok(specFacts(form, stored).some(([label, text]) => label === "Activity details" && text.includes("Grid lines A-D")), "reopened and printed");
    const changed = setSpecValue(form, stored, "activity", "Topographic Survey");
    assert.equal(changed.activity_answers, undefined, `${form}: a new activity clears the answers`);
  }
});
