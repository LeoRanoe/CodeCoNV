import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  externalShareUrl,
  normalizeExternalShareToken,
} from "../lib/external-share/token.mjs";
import {
  fieldPhotoMimeTypes,
  normalizedImagePoint,
  validatePanoramaDimensions,
} from "../lib/images/field-image.mjs";

test("accepts only narrow normalized external share tokens", () => {
  const lowercase = "a1".repeat(24);
  const uppercase = lowercase.toUpperCase();
  assert.equal(normalizeExternalShareToken(lowercase), lowercase);
  assert.equal(normalizeExternalShareToken(`  ${uppercase}  `), lowercase);
  assert.equal(normalizeExternalShareToken("short"), null);
  assert.equal(normalizeExternalShareToken(`${lowercase}!`), null);
  assert.equal(
    externalShareUrl("https://code-co-nv.vercel.app/", uppercase),
    `https://code-co-nv.vercel.app/share/${lowercase}`,
  );
});

test("validates field photos and dedicated 360 degree exports", () => {
  assert.deepEqual(fieldPhotoMimeTypes, ["image/jpeg", "image/png", "image/webp"]);
  assert.deepEqual(validatePanoramaDimensions(3840, 1920), { valid: true, reason: null });
  assert.deepEqual(validatePanoramaDimensions(7680, 3840), { valid: true, reason: null });
  assert.equal(validatePanoramaDimensions(4000, 1800).reason, "ratio");
  assert.equal(validatePanoramaDimensions(1920, 960).reason, "resolution");
  assert.equal(validatePanoramaDimensions(0, 0).reason, "unreadable");
});

test("keeps image annotations within exact normalized bounds", () => {
  const bounds = { left: 100, top: 50, width: 400, height: 200 };
  assert.deepEqual(normalizedImagePoint(300, 150, bounds), { x: 0.5, y: 0.5 });
  assert.deepEqual(normalizedImagePoint(-20, 999, bounds), { x: 0, y: 1 });
  assert.deepEqual(normalizedImagePoint(10, 10, { ...bounds, width: 0 }), { x: 0.5, y: 0.5 });
});

test("refreshes expiring API bearer tokens and preserves every field image locally", async () => {
  const [tokenSource, operations, queue, visual, media, drawing, css, sharePage, guide] = await Promise.all([
    readFile(new URL("../lib/supabase/access-token.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/field-guide.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(tokenSource, /refreshMarginSeconds = 90/);
  assert.match(tokenSource, /client\.auth\.refreshSession\(\)/);
  assert.match(tokenSource, /WeakMap<SupabaseClient, Promise<string>>/);
  assert.match(operations, /Stuur naar externe partij/);
  assert.match(operations, /geen account nodig/);
  assert.match(operations, /Open WhatsApp en stuur/);
  assert.doesNotMatch(operations, /window\.location\.assign/);
  assert.match(operations, /recordLink: \{ organizationId, recordType: "inspection"/);
  assert.match(operations, /recordLink: \{ organizationId, recordType: "hse"/);
  assert.match(queue, /else if \(upload\.recordLink\)/);
  assert.match(visual, /validatePanoramaDimensions/);
  assert.match(visual, /queueOfflineUpload/);
  assert.match(visual, /forceSyncOfflineUploads/);
  assert.match(visual, /viewerState === "error"/);
  assert.match(media, /media-preview-error/);
  assert.match(drawing, /Drawing image could not be displayed/);
  assert.match(css, /\.finding-actions \{[\s\S]{0,120}flex-wrap: wrap/);
  assert.match(css, /\.visual-toolbar-actions \{[\s\S]{0,160}flex-wrap: wrap/);
  assert.match(sharePage, /normalizeExternalShareToken/);
  assert.match(sharePage, /ExternalSourceImage/);
  assert.match(guide, /Stuur naar een externe partij zonder account/);
  assert.match(guide, /vernieuwt de app een aflopende beveiligde sessie automatisch/);
});

test("enforces project configuration, exact locations and auditable BOQ progress", async () => {
  const [app, operations, picker, dataLayer, migration] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/location-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607270003_client_configuration_location_boq.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /New configured project/);
  assert.match(app, /Workforce disciplines/);
  assert.match(app, /requiredLocationDepth/);
  assert.match(app, /action-location/);
  assert.match(app, /authTimeout/);
  assert.match(operations, /Datums technische instructie/);
  assert.match(operations, /Change order \(CO\)/);
  assert.match(operations, /recordBoqProgress/);
  assert.match(operations, /findingLocationNodeId/);
  assert.match(picker, /locationBreadcrumb/);
  assert.match(dataLayer, /configuration_status: "setup"/);
  assert.match(dataLayer, /configuration_status: "active"/);
  assert.match(migration, /create table if not exists public\.boq_progress_updates/);
  assert.match(migration, /create or replace function public\.record_boq_progress/);
  assert.match(migration, /create or replace function app_private\.validate_record_location/);
  assert.match(migration, /create or replace function public\.create_project_action\([\s\S]*p_location_node_id uuid/);
});
