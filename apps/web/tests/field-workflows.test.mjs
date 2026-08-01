import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  externalShareUrl,
  normalizeExternalShareToken,
} from "../lib/external-share/token.mjs";
import {
  fieldPhotoMimeTypes,
  markedPhotoName,
  markupCanvasSize,
  markupScale,
  normalizedImagePoint,
  photoMarkupPlacement,
  photoMarkupReport,
  photoMarkupSummary,
  photoMarkupToneColors,
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

test("burns photo markings in at the resolution of the photo, not of the phone screen", () => {
  assert.deepEqual(markupCanvasSize(1200, 900), { width: 1200, height: 900, scale: 1 });
  const stepped = markupCanvasSize(4032, 3024);
  assert.equal(stepped.width, 2400);
  assert.equal(stepped.height, 1800);
  assert.ok(stepped.scale < 1);
  assert.deepEqual(markupCanvasSize(0, 0), { width: 0, height: 0, scale: 1 });

  // Markings scale with the picture, and never shrink below a readable size on a small one.
  const large = markupScale(2400, 1800);
  const small = markupScale(320, 240);
  assert.ok(large.markerRadius > small.markerRadius);
  assert.ok(small.markerRadius >= 14);
  assert.ok(small.strokeWidth >= 3);
  assert.ok(small.fontSize >= 13);
});

test("writes what was marked on a photo back into the record's own words", () => {
  assert.equal(
    photoMarkupSummary([{ label: "Scheur of beschadiging" }, { label: "  " }, { label: "Veiligheidsrisico" }]),
    "1. Scheur of beschadiging · 3. Veiligheidsrisico",
  );
  assert.equal(photoMarkupSummary([{ label: "" }, {}]), "");

  // Where a marking belongs; missing parts are left out instead of printed as a dash.
  assert.equal(
    photoMarkupPlacement({ buildingName: "Main building", locationLabel: "2e verdieping", element: "kolom lijn B", workPackage: "Beton" }),
    "Main building → 2e verdieping → kolom lijn B → Beton",
  );
  assert.equal(photoMarkupPlacement({ buildingName: "  ", locationLabel: "Dak" }), "Dak");
  assert.equal(photoMarkupPlacement({}), "");

  // The full detail block: number, title, severity, where it belongs, who is responsible and
  // the sentences the supervisor spoke or typed.
  const report = photoMarkupReport(
    [
      {
        label: "Scheur of beschadiging",
        description: "Scheur over de volle hoogte; herstellen en laten herkeuren.",
        severity: "high",
        buildingName: "Main building",
        locationLabel: "2e verdieping",
        responsiblePartyName: "Aannemer B",
      },
      { label: "", description: "" },
      { label: "Afwerking", severity: "low" },
    ],
    { severityLabels: { high: "Hoog", low: "Laag" }, responsibleLabel: "Verantwoordelijke" },
  );
  assert.equal(
    report,
    "1. Scheur of beschadiging · Hoog · Main building → 2e verdieping · Verantwoordelijke: Aannemer B\n"
    + "Scheur over de volle hoogte; herstellen en laten herkeuren.\n"
    + "3. Afwerking · Laag",
  );
  assert.equal(photoMarkupReport([{ label: "  " }]), "");

  // A marked photo replaces the photo it came from instead of piling up new names.
  assert.equal(markedPhotoName("IMG_7112.jpeg"), "IMG_7112-marked.jpg");
  assert.equal(markedPhotoName("IMG_7112-marked.jpg"), "IMG_7112-marked.jpg");
  assert.equal(markedPhotoName(""), "photo-marked.jpg");

  // The three punch-list classifications keep the colours the client already reads.
  assert.deepEqual(Object.keys(photoMarkupToneColors), ["to_be_corrected", "alternative_solution", "validated"]);
});

test("offers marking on the photo everywhere a photo can be attached", async () => {
  const [markup, entry, dailyLog, operations, media, visual, css] = await Promise.all([
    readFile(new URL("../app/photo-markup.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The client reported that marking existed but was not reachable from the forms. Every
  // screen that can attach a photo has to open the same marking pad.
  for (const [name, source] of [["entry record", entry], ["daily log", dailyLog], ["issues, inspections, HSE and register", operations], ["photo library", media], ["visual evidence", visual]]) {
    assert.match(source, /from "@\/app\/photo-markup"/, `${name} must import the photo marking pad`);
    assert.match(source, /<PhotoMarkupPad/, `${name} must open the photo marking pad`);
    assert.match(source, /<MarkPhotoButton/, `${name} must show the way into marking`);
  }
  // All four photo stacks in the operational workspace hand a replacement back, and know
  // which buildings, rooms and parties the marker can be attached to.
  assert.equal(operations.match(/onReplace=\{\(index, file\)/g)?.length, 4);
  assert.equal(operations.match(/markupContext=\{\{ \.\.\.markupOptions/g)?.length, 4);
  // Issues, HSE and register items get the full written detail in their own description.
  assert.equal(operations.match(/onDetail=\{\(report\)/g)?.length, 3);
  for (const [name, source] of [["entry record", entry], ["daily log", dailyLog], ["photo library", media], ["visual evidence", visual]]) {
    assert.match(source, /\bcontext=\{/, `${name} must tell the marking pad about the project`);
  }

  // A marker carries more than a pin: words, severity, and where it belongs.
  for (const field of [/Full description/, /Severity/, /Where does this belong\?/, /Responsible party/, /Work package/, /Floor \/ room \/ element/]) {
    assert.match(markup, field);
  }
  // Draw, arrow, frame and text are offered next to the marker tool.
  for (const tool of ['{ id: "pen"', '{ id: "arrow"', '{ id: "box"', '{ id: "text"']) {
    assert.ok(markup.includes(tool), `the marking pad must offer ${tool}`);
  }

  // The colour chips choose the colour of the next marking. They must never recolour a marker
  // that is already on the photo: that silently reclassified a marker while drawing a frame.
  assert.match(markup, /onClick=\{\(\) => setTone\(option\)\}/);
  assert.doesNotMatch(markup, /setTone\(option\);\s*\n\s*if \(activeMarker\)/);
  // Tools and photo are pinned together, under a header that does not cover the picture; the
  // sticky header used to sit on top of the photo and swallow taps meant for it.
  assert.match(markup, /className="photo-markup-pinned"/);
  assert.match(css, /\.photo-markup-modal \.modal-header \{ position: static/);
  assert.match(css, /\.photo-markup-pinned \{[\s\S]{0,200}position: sticky/);

  // Dragging the pen must not turn into dragging the photo, which cancels the stroke.
  assert.match(markup, /draggable=\{false\}/);
  assert.match(markup, /event\.preventDefault\(\);\n\s*event\.currentTarget\.setPointerCapture/);
  // The markings are burnt into the picture, so it still says what is wrong outside the app.
  assert.match(markup, /canvas\.toBlob\(resolve, "image\/jpeg", 0\.9\)/);
  assert.match(css, /\.photo-markup-stage img \{[\s\S]{0,220}user-select: none/);
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
