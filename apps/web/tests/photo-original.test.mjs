import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { fingerprintOriginal, originalRecord } from "../lib/offline/original-fingerprint.ts";
import { cleanSpecValues } from "../lib/forms/spec-forms.ts";

test("F05: the original's fingerprint is the SHA-256 of the bytes as received", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
  const file = new File([bytes], "IMG_0001.jpg", { type: "image/jpeg", lastModified: Date.parse("2026-11-20T08:15:00Z") });
  const print = await fingerprintOriginal(file);
  assert.equal(print.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(print.size, 9);
  assert.equal(print.lastModified, "2026-11-20T08:15:00.000Z");
  assert.equal(originalRecord({ original: print, compressed: true }).stored, "reduced_copy");
  assert.equal(originalRecord({ original: print, compressed: false }).stored, "original");
  assert.equal(originalRecord({ original: null, compressed: true }), null);
});

test("F05: editing the photo classification keeps the record of the original", () => {
  const stored = { photo_purpose: "Progress Documentation", _original: { sha256: "a".repeat(64), size: 10, stored: "reduced_copy" } };
  assert.deepEqual(cleanSpecValues("photo", { ...stored, photo_purpose: "Site Condition" })._original, stored._original);
});
