import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDocumentFolders,
  documentFoldersFor,
  filterRegister,
  registerCsv,
  registerRows,
  sortRegister,
  suggestNextRevision,
} from "../lib/documents/document-register.mjs";
import {
  clientSections,
  contractorSections,
  eventsByRound,
  isOverdueShare,
  portalModeFor,
  portalStepsFor,
  reviewStepsFor,
} from "../lib/portal/portal-model.mjs";

const now = new Date("2026-11-20T15:00:00Z");
const share = (overrides) => ({
  id: "s1", audience: "contractor", record_type: "finding", requested_action: "propose", status: "assigned",
  due_at: null, round: 1, assigned_at: "2026-11-18T10:00:00Z", publication_type: null, ...overrides,
});
const permissions = (codes) => ({ known: true, can: (code) => codes.includes(code), canAny: (...wanted) => wanted.some((code) => codes.includes(code)) });

test("the register has the fourteen recommended folders, and a project list replaces them", () => {
  assert.deepEqual(defaultDocumentFolders.map((folder) => folder.code), ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"]);
  assert.equal(documentFoldersFor([{ code: "A1", en: "Site", nl: "Terrein" }]).length, 1);
  assert.equal(documentFoldersFor([{ code: "bad code" }]).length, 14, "an invalid project list falls back to the defaults");
});

test("a register row shows the current revision and keeps the history", () => {
  const rows = registerRows(
    [{ id: "d1", document_number: "A-101", title: "Ground floor", folder_code: "01", current_revision_id: "r2", building_ids: [] }],
    [
      { id: "r1", document_id: "d1", revision: "A", review_status: "superseded", uploaded_at: "2026-11-01T10:00:00Z" },
      { id: "r2", document_id: "d1", revision: "B", review_status: "submitted", uploaded_at: "2026-11-10T10:00:00Z" },
    ],
  );
  assert.equal(rows[0].current.revision, "B");
  assert.equal(rows[0].history.length, 2);
});

test("the register searches by number, title or file name and filters by status and date", () => {
  const rows = [
    { document: { id: "1", document_number: "S-201", title: "Column schedule", folder_code: "01", discipline: "Structural", building_ids: ["b1"] }, current: { revision: "0", review_status: "approved", uploaded_at: "2026-11-05T00:00:00Z" }, history: [], fileName: "S201.pdf" },
    { document: { id: "2", document_number: "A-101", title: "Ground floor", folder_code: "01", discipline: "Architectural", building_ids: [] }, current: { revision: "B", review_status: "submitted", uploaded_at: "2026-11-15T00:00:00Z" }, history: [] },
  ];
  assert.deepEqual(filterRegister(rows, { search: "s201" }).map((row) => row.document.id), ["1"]);
  assert.deepEqual(filterRegister(rows, { search: "ground" }).map((row) => row.document.id), ["2"]);
  assert.deepEqual(filterRegister(rows, { status: "approved" }).map((row) => row.document.id), ["1"]);
  assert.deepEqual(filterRegister(rows, { building: "b1" }).map((row) => row.document.id), ["1"]);
  assert.deepEqual(filterRegister(rows, { from: "2026-11-10" }).map((row) => row.document.id), ["2"]);
  assert.deepEqual(sortRegister(rows, "number").map((row) => row.document.document_number), ["A-101", "S-201"]);
  assert.deepEqual(sortRegister(rows, "received", "desc").map((row) => row.document.id), ["2", "1"]);
});

test("the CSV export opens in Excel and cannot run a formula", () => {
  const csv = registerCsv([{ document: { document_number: "=HYPERLINK(1)", title: "Plan, rev", folder_code: "01", building_ids: [] }, current: { revision: "A", review_status: "approved" }, history: [{}] }]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.includes('"Plan, rev"'));
});

test("the next revision mark follows the convention on the document", () => {
  assert.equal(suggestNextRevision("A"), "B");
  assert.equal(suggestNextRevision("0"), "1");
  assert.equal(suggestNextRevision("Rev.02"), "Rev.03");
  assert.equal(suggestNextRevision(""), "A");
});

test("a contractor or client account gets its portal; CODECO staff never do", () => {
  assert.equal(portalModeFor(permissions(["portal.contractor", "portal.contractor.respond"])), "contractor");
  assert.equal(portalModeFor(permissions(["portal.client"])), "client");
  assert.equal(portalModeFor(permissions(["records.read", "portal.share", "portal.client"])), null, "an organisation admin holds every right but works in the workspace");
  assert.equal(portalModeFor({ known: false, can: () => false }), null);
});

test("a read-only contractor has no step; a returned item can be answered again", () => {
  assert.deepEqual(portalStepsFor(share({}), { respond: false }), []);
  assert.deepEqual(portalStepsFor(share({}), { respond: true }), ["acknowledge", "respond", "submit_evidence", "comment"]);
  assert.ok(portalStepsFor(share({ status: "returned" }), { respond: true }).includes("respond"));
  assert.deepEqual(portalStepsFor(share({ status: "closed" }), { respond: true }), []);
  assert.ok(portalStepsFor(share({ record_type: "action", requested_action: "implement" }), { respond: true }).includes("mark_complete"));
});

test("a client viewer cannot act and only an approver sees approve and reject", () => {
  const routed = share({ audience: "client", record_type: "document", requested_action: "approve" });
  assert.deepEqual(portalStepsFor(routed, { review: false }), []);
  assert.ok(!portalStepsFor(routed, { review: true, approve: false }).includes("approve"));
  assert.ok(portalStepsFor(routed, { review: true, approve: true }).includes("approve"));
  assert.deepEqual(portalStepsFor({ ...routed, status: "approved" }, { review: true, approve: true }), ["comment"]);
});

test("CODECO closes a proposal only after accepting or verifying it", () => {
  assert.ok(!reviewStepsFor(share({ status: "responded" })).includes("close"));
  assert.ok(reviewStepsFor(share({ status: "accepted" })).includes("close"));
  assert.ok(reviewStepsFor(share({ requested_action: "acknowledge", status: "acknowledged" })).includes("close"));
  assert.deepEqual(reviewStepsFor(share({ status: "withdrawn" })), ["reopen"]);
});

test("overdue counts only items still waiting on the organisation", () => {
  assert.equal(isOverdueShare(share({ due_at: "2026-11-19T00:00:00Z" }), now), true);
  assert.equal(isOverdueShare(share({ due_at: "2026-11-19T00:00:00Z", status: "responded" }), now), false);
  assert.equal(isOverdueShare(share({ due_at: "2026-11-19T00:00:00Z", status: "closed" }), now), false);
});

test("the contractor dashboard and the client sections read the same shares", () => {
  const shares = [
    share({ id: "a", status: "returned", due_at: "2026-11-19T00:00:00Z" }),
    share({ id: "b", record_type: "action", requested_action: "implement" }),
    share({ id: "c", status: "closed" }),
  ];
  const sections = contractorSections(shares, now);
  assert.deepEqual(sections.assigned.map((item) => item.id), ["a"]);
  assert.deepEqual(sections.pendingActions.map((item) => item.id), ["b"]);
  assert.deepEqual(sections.history.map((item) => item.id), ["c"]);
  assert.deepEqual(sections.returned.map((item) => item.id), ["a"]);
  assert.deepEqual(sections.overdue.map((item) => item.id), ["a"]);

  const client = clientSections([
    share({ id: "p1", audience: "client", record_type: "publication", status: "superseded", publication_type: "weekly", assigned_at: "2026-11-10T00:00:00Z" }),
    share({ id: "p2", audience: "client", record_type: "publication", status: "published", publication_type: "weekly", assigned_at: "2026-11-17T00:00:00Z" }),
    share({ id: "r", audience: "client", record_type: "document", requested_action: "approve", status: "assigned" }),
    share({ id: "w", audience: "client", record_type: "finding", status: "withdrawn" }),
  ], now);
  assert.deepEqual(client.publications.map((item) => item.id), ["p2", "p1"]);
  assert.deepEqual(client.currentPublications.map((item) => item.id), ["p2"]);
  assert.deepEqual(client.openReview.map((item) => item.id), ["r"]);
  assert.equal(client.issues.length, 0, "a withdrawn item is gone from the client portal");
});

test("the history is grouped by workflow round and leaves views out", () => {
  const rounds = eventsByRound([
    { sequence: 3, round: 2, action: "resubmit" },
    { sequence: 1, round: 1, action: "assign" },
    { sequence: 2, round: 1, action: "return" },
    { sequence: 4, round: 2, action: "view" },
  ]);
  assert.deepEqual(rounds.map((round) => [round.round, round.events.map((event) => event.action)]), [[1, ["assign", "return"]], [2, ["resubmit"]]]);
});

test("F15: only a current, reviewer-approved revision is offered for portal release", async () => {
  const { revisionReleasable, releasableRevisionStatuses } = await import("../lib/portal/portal-model.mjs");
  assert.deepEqual([...releasableRevisionStatuses], ["approved", "approved_with_comments", "for_construction"]);
  for (const status of ["draft", "submitted", "under_review", "rejected", "revise_resubmit", "for_information", "withdrawn", "superseded"]) {
    assert.equal(revisionReleasable({ review_status: status, superseded_at: null }), false, status);
  }
  assert.equal(revisionReleasable({ review_status: "approved", superseded_at: null }), true);
  assert.equal(revisionReleasable({ review_status: "approved", superseded_at: "2026-11-21T10:00:00Z" }), false);
});
