import assert from "node:assert/strict";
import test from "node:test";
import { linkFirstFields, linkPrefillPatch, pickLinkSpec } from "../lib/forms/link-prefill.mjs";
import { buildRecordDirectory } from "../lib/records/record-directory.mjs";

const source = { linkSpec: { discipline: "Concrete & Structural", activity: "Concrete pour", exact_location: "Grid B-3, level 2" } };

test("the linked record gives its discipline, activity and location to the empty fields of the form", () => {
  const patch = linkPrefillPatch(source, ["discipline", "activity", "exact_location", "title"], {});
  assert.deepEqual(patch, source.linkSpec);
});

test("a field that was already filled is never replaced, and an activity follows its discipline", () => {
  assert.deepEqual(linkPrefillPatch(source, ["discipline", "activity", "exact_location"], { discipline: "Finishes" }), { exact_location: "Grid B-3, level 2" });
  assert.deepEqual(linkPrefillPatch(source, ["discipline", "activity"], { discipline: "Concrete & Structural", activity: "Rebar" }), {});
  assert.deepEqual(linkPrefillPatch(source, ["activity"], {}), {}, "an activity without a discipline would be unusable");
});

test("fields the form does not have are not added, and a record without detail gives nothing", () => {
  assert.deepEqual(linkPrefillPatch(source, ["exact_location"], {}), { exact_location: "Grid B-3, level 2" });
  assert.deepEqual(linkPrefillPatch({ linkSpec: null }, ["discipline"], {}), {});
  assert.deepEqual(linkPrefillPatch(undefined, ["discipline"], {}), {});
});

test("the directory offers a record's linkable detail and the link-first fields are the ones of the specification", () => {
  assert.deepEqual(pickLinkSpec({ discipline: " Concrete ", other: "x", activity: "" }), { discipline: "Concrete" });
  assert.equal(pickLinkSpec({}), null);
  const entries = buildRecordDirectory({ registerEntries: [{ id: "w1", entry_number: "P-WO-2026-0001", title: "Slab", register_type: "works_ongoing", details: { spec: { discipline: "Concrete & Structural", activity: "Concrete pour" } } }] });
  assert.deepEqual(entries[0].linkSpec, { discipline: "Concrete & Structural", activity: "Concrete pour" });
  assert.deepEqual(linkFirstFields, ["related_inspection", "related_record", "affected_activity"]);
});

test("Works Completed offers only Works Ongoing that is not completed yet, the same activity first", async () => {
  const { candidatesNotYetCompleted } = await import("../lib/forms/link-prefill.mjs");
  const records = [
    { id: "a", kind: "register", linkSpec: { activity: "Rebar" } },
    { id: "b", kind: "register", linkSpec: { activity: "Concrete pour" } },
    { id: "c", kind: "register", linkSpec: { activity: "Concrete pour" } },
    { id: "wc1", kind: "register", linkedRefs: ["register:c"] },
  ];
  assert.deepEqual(candidatesNotYetCompleted(records, { activity: "Concrete pour" }).map((r) => r.id), ["b", "a", "wc1"]);
  assert.deepEqual(candidatesNotYetCompleted(records, { keep: "register:c" }).map((r) => r.id), ["a", "b", "c", "wc1"]);
});
