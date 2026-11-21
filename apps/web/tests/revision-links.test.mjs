import assert from "node:assert/strict";
import test from "node:test";
import { revisionRefId, revisionStanding, revisionReferenceText } from "../lib/documents/document-register.mjs";

const documents = [{ id: "d1", document_number: "DWG-101", title: "Ground floor plan", current_revision_id: "c" }];
const revisions = [
  { id: "a", document_id: "d1", revision: "A", review_status: "approved", uploaded_at: "2026-11-01T10:00:00Z" },
  { id: "b", document_id: "d1", revision: "B", review_status: "rejected", uploaded_at: "2026-11-05T10:00:00Z" },
  { id: "c", document_id: "d1", revision: "C", review_status: "submitted", uploaded_at: "2026-11-10T10:00:00Z" },
];

test("F11: a record pinned to A stays current while B is rejected and C is under review", () => {
  assert.equal(revisionRefId("revision:a"), "a");
  assert.equal(revisionRefId("register:a"), "");
  const standing = revisionStanding("a", documents, revisions);
  assert.equal(standing.stale, false);
  assert.equal(standing.label, "DWG-101 rev A");
  assert.equal(revisionReferenceText(documents[0], revisions[0]), "DWG-101 rev A");
});

test("F11: uploading B marks A superseded, but A stays the one to use until B is approved", () => {
  const uploaded = [
    { id: "a", document_id: "d1", revision: "A", review_status: "superseded", superseded_at: "2026-11-05T10:00:00Z", uploaded_at: "2026-11-01T10:00:00Z" },
    { id: "b", document_id: "d1", revision: "B", review_status: "submitted", uploaded_at: "2026-11-05T10:00:00Z" },
  ];
  assert.equal(revisionStanding("a", documents, uploaded).stale, false);
  uploaded[1].review_status = "approved";
  assert.equal(revisionStanding("a", documents, uploaded).stale, true);
});

test("F11: approving C makes the A reference stale and names C; a rejected pin is stale", () => {
  const approved = revisions.map((item) => (item.id === "c" ? { ...item, review_status: "for_construction" } : item));
  const standing = revisionStanding("a", documents, approved);
  assert.equal(standing.stale, true);
  assert.equal(standing.newerApproved.revision, "C");
  assert.equal(revisionStanding("b", documents, revisions).stale, true);
  assert.equal(revisionStanding("missing", documents, revisions), null);
});
