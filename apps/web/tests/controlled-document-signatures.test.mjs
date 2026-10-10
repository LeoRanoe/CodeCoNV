import test from "node:test";
import assert from "node:assert/strict";
import { controlledDocumentSignatures, documentSignatureState, recipientCaptureNote, signatureMoment } from "../lib/reports/controlled-document-signatures.mjs";

const ink = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

test("signature moments are Suriname time, not UTC", () => {
  // 02:30 UTC on 11 October is still the evening of 10 October in Paramaribo (UTC-3).
  assert.equal(signatureMoment("2026-10-11T02:30:00Z"), "10 Oct 2026, 23:30 SRT");
  assert.equal(signatureMoment(""), "");
  assert.equal(signatureMoment("not a date"), "");
});

test("issuer and recipient are separate signers with their own ink and moment", () => {
  const entry = {
    signed_by: "Issuer Ivo", signed_at: "2026-10-10T17:00:00Z", signature_image: ink,
    details: {
      issuer_position: "Lead supervisor", issuer_company: "CODECO N.V.",
      response: {
        decision: "acknowledged", comments: "Received.", respondent_name: "Contractor Cees", respondent_position: "Site manager",
        respondent_company: "Hoofdaannemer", signature_image: ink, signed_at: "2026-10-10T18:00:00Z",
        responded_at: "2026-10-10T18:00:01Z", responded_by_name: "Issuer Ivo", signature_capture: "on_device",
      },
    },
  };
  const result = controlledDocumentSignatures(entry);
  assert.equal(result.issuer.name, "Issuer Ivo");
  assert.equal(result.issuer.signedAt, "10 Oct 2026, 14:00 SRT");
  assert.equal(result.recipient.name, "Contractor Cees");
  assert.equal(result.recipient.signedAt, "10 Oct 2026, 15:00 SRT");
  assert.equal(result.recipient.ink, ink);
  assert.notEqual(result.issuer.name, result.recipient.name);
  assert.equal(recipientCaptureNote(result.recipient), "Signed on the device of Issuer Ivo");
  assert.equal(documentSignatureState(entry), "acknowledged");
});

test("lifecycle: unsigned, issued, acknowledged", () => {
  assert.equal(documentSignatureState({ details: {} }), "draft");
  assert.equal(documentSignatureState({ signature_image: ink, details: {} }), "issued");
  assert.equal(documentSignatureState({ signature_image: ink, details: { response: { decision: "approved", comments: "ok" } } }), "issued");
  assert.equal(documentSignatureState({ signature_image: ink, details: { response: { decision: "acknowledged" } } }), "acknowledged");
});

test("a signature that is not a PNG data URL is never drawn", () => {
  const result = controlledDocumentSignatures({ details: { signature_image: "javascript:alert(1)", contractor_signature_image: "http://example.test/x.png" } });
  assert.equal(result.issuer.ink, null);
  assert.equal(result.contractor.ink, null);
});

test("change order signatures come from the record", () => {
  const result = controlledDocumentSignatures({
    details: {
      contractor_signed_by: "Cees", contractor_position: "Foreman", contractor_signature_image: ink, contractor_signed_at: "2026-10-10T12:00:00Z",
      supervision_signed_by: "Ivo", supervision_signature_image: ink, supervision_signed_at: "2026-10-10T13:00:00Z",
    },
  });
  assert.equal(result.contractor.ink, ink);
  assert.equal(result.contractor.signedAt, "10 Oct 2026, 09:00 SRT");
  assert.equal(result.supervision.name, "Ivo");
});

test("the release identifier names the newest migration the build expects", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const names = (await readdir(new URL("../../../supabase/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort();
  const newest = names.at(-1).split("_")[0];
  const source = await readFile(new URL("../lib/release.ts", import.meta.url), "utf8");
  assert.match(source, new RegExp(`expectedSchemaVersion = "${newest}"`));
});

test("editing a document never rewrites what was answered", async () => {
  const { detailsForEdit } = await import("../lib/forms/edit-details.mjs");
  const history = [{ decision: "acknowledged", signature_image: ink }];
  const answered = detailsForEdit(
    { description: "old", response: history[0], response_history: history, signed_by: "Ivo" },
    { description: "new", response: {}, signed_by: "Ivo" },
  );
  assert.equal(answered.description, "new");
  assert.deepEqual(answered.response, history[0]);
  assert.deepEqual(answered.response_history, history);
  // A record that was never answered does not gain a response key.
  const unanswered = detailsForEdit({ description: "old" }, { description: "new", response: {} });
  assert.equal("response" in unanswered, false);
  assert.equal("response_history" in unanswered, false);
  assert.deepEqual(detailsForEdit(undefined, { a: 1, response: {} }), { a: 1 });
});
