import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { codeText, optionText, priorityText, recordStatusLabels, recordTypeLabels, severityText, statusText, typeText } from "../lib/status-labels.ts";

const nl = (_english, dutch) => dutch;
const en = (english) => english;

/** The vocabularies the database accepts (check constraints in supabase/migrations). */
const storedStatuses = [
  // findings, actions, inspections, HSE events
  "draft", "open", "assigned", "in_progress", "ready_for_verification", "closed", "rejected", "reopened", "cancelled",
  "accepted", "verified", "planned", "passed", "failed", "ready_for_reinspection", "investigating", "action_required",
  // registers, day reports, registrations, files, distributions
  "in_review", "approved", "ready_for_review", "signed", "sent", "revised", "returned", "recorded", "confirmed",
  "pending", "uploading", "available", "archived", "deleted", "active", "void", "queued", "delivered", "acknowledged",
];
const storedTypes = [
  "observation", "deficiency", "deviation", "ncr", "improvement",
  "positive_observation", "unsafe_act", "unsafe_condition", "near_miss", "incident", "stop_work", "toolbox", "other",
  "equipment", "delivery", "test", "variation", "delay", "communication", "risk", "document", "drawing", "wcr", "rfi",
  "submittal", "site_instruction", "meeting", "correspondence", "cost", "declaration", "rfa", "inspection_request", "boq",
  "punch_list", "notepad", "agreement", "technical_instruction", "change_order", "contract", "specification",
  "environmental_report", "lessons_learned", "delay_report",
  "zone", "floor", "room", "element", "work_package", "registration", "inspection", "visual",
];

test("every stored status and record type has wording in both languages", () => {
  for (const code of storedStatuses) assert.ok(recordStatusLabels[code], `status ${code} has no label`);
  for (const code of storedTypes) assert.ok(recordTypeLabels[code], `type ${code} has no label`);
  for (const labels of [recordStatusLabels, recordTypeLabels]) {
    for (const [code, label] of Object.entries(labels)) {
      assert.ok(label.en && label.nl, code);
      assert.ok(!/_/.test(label.en + label.nl), `${code} leaks an underscore`);
    }
  }
});

test("the same state reads the same in every module, in the interface language", () => {
  assert.equal(statusText("ready_for_verification", nl), "Gereed voor verificatie");
  assert.equal(statusText("ready_for_verification", en), "Ready for verification");
  assert.equal(statusText("in_progress", nl), "In uitvoering");
  assert.equal(typeText("technical_instruction", nl), "Technische instructie (TI)");
  assert.equal(typeText("work_package", nl), "Werkpakket");
  assert.equal(priorityText("critical", nl), "Kritiek");
  assert.equal(severityText("medium", nl), "Middel");
  assert.equal(codeText("in_review", nl), "In review");
});

test("an unknown code is still readable and an empty one shows nothing", () => {
  assert.equal(statusText("waiting_for_parts", nl), "Waiting for parts");
  assert.equal(statusText(null, nl), "");
  assert.equal(optionText([{ id: "work_stopped", en: "Work stopped", nl: "Werk stilgelegd" }], "work_stopped", nl), "Werk stilgelegd");
  assert.equal(optionText([], "area_barricaded", nl), "Area barricaded");
});

test("no screen prints a stored status, type, priority or severity code directly", async () => {
  const directory = new URL("../app/", import.meta.url);
  const screens = (await readdir(directory)).filter((name) => name.endsWith(".tsx"));
  for (const name of screens) {
    const source = await readFile(new URL(name, directory), "utf8");
    assert.ok(!/\.(status|register_type|finding_type|event_type|node_type|linked_record_type|root_cause)\.replaceAll\("_", " "\)/.test(source), `${name} prints a stored code with the underscores removed`);
    // viewedRecord is the already-translated view of a record, not the stored row.
    assert.ok(!/>\{(?!viewedRecord\.)[a-zA-Z]+\.(priority|severity|status)\}</.test(source),`${name} prints a stored priority, severity or status as it is stored`);
  }
});
