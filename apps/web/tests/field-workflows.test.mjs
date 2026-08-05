import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  externalShareUrl,
  normalizeExternalShareToken,
} from "../lib/external-share/token.mjs";
import {
  isConnectionFailure,
  isPendingRecordId,
  newPendingRecordId,
} from "../lib/offline/record-rules.mjs";
import {
  compareActionItems,
  daysUntilOnSite,
  isEscalatedItem,
  isOverdueItem,
  nextStepFor,
} from "../lib/actions/action-center.mjs";
import { exifImageDirection } from "../lib/images/exif-direction.mjs";
import {
  workforceByDiscipline,
  workforceByParty,
  workforceDeviations,
  workforceHeadcount,
  workforceNoteRequired,
} from "../lib/forms/workforce.mjs";
import {
  compassPointFromDegrees,
  compassPoints,
  fieldPhotoMimeTypes,
  markedPhotoName,
  markupCanvasSize,
  markupScale,
  normalizedImagePoint,
  photoMarkupPlacement,
  photoMarkupReport,
  photoMarkupSummary,
  photoMarkupToneColors,
  photoTitleFromDescription,
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

test("gives every attached photo one written field, its location and an automatic direction", async () => {
  const [evidence, entry, dailyLog, operations, media, visualCapture, css] = await Promise.all([
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // §4.16 of the client's product plan asks for a location, a direction and a description per
  // photo, next to the picture instead of drawn on it. The feedback of 2 August cut that back
  // to one written field: "voor nr is 1 invoer voldoende". The title, the category and the
  // typed room name are gone; the description carries the words and names the file.
  assert.match(evidence, /What is on this photo, and why does it matter\?/);
  assert.match(evidence, /Exact location/);
  assert.match(evidence, /<FacingDirectionField/);
  assert.doesNotMatch(evidence, /placeholder=\{text\("For example: rebar column line B/);
  assert.doesNotMatch(evidence, /\{text\("Category", "Categorie"\)\}/);
  assert.match(evidence, /export function photoTitle/);
  // §4.16 also: the original photo is always kept, so marking never destroys it.
  assert.match(evidence, /original: File;/);
  assert.match(evidence, /Restore original/);
  assert.match(evidence, /onChange\(\{ \.\.\.photo, file: photo\.original, markerCount: 0 \}\)/);

  // The record form stays short: a photo is one row, and everything that belongs to it opens
  // on its own screen when the picture is tapped.
  assert.match(evidence, /export function PhotoDetailSheet/);
  assert.match(evidence, /className="photo-evidence-open"/);
  assert.match(evidence, /Open the details of photo/);
  // A photo can name its own building; one picture can cover another than the record does.
  assert.match(evidence, /\{text\("Building", "Gebouw"\)\}/);

  // One photo block for every module; the client asked for one way of working, not five.
  for (const [name, source] of [["entry record", entry], ["daily log", dailyLog], ["issues, inspections, HSE and register", operations], ["photo library", media]]) {
    assert.match(source, /<PhotoEvidenceList/, `${name} must use the shared photo block`);
    assert.match(source, /toPhotoEvidence\(/, `${name} must wrap a taken photo so it carries its own words`);
  }
  assert.equal(operations.match(/<PhotoEvidenceList/g)?.length, 4);
  // The old one-off stacks are gone rather than left behind next to the shared block.
  assert.doesNotMatch(operations, /FindingPhotoStack/);
  assert.doesNotMatch(entry, /entry-photo-strip/);
  assert.doesNotMatch(dailyLog, /daily-log-photo-list/);

  // The photo's own words travel into the register, not the record's title for all of them.
  assert.match(evidence, /export function photoUploadDescription/);
  assert.equal(operations.match(/photoUploadDescription\(photo,/g)?.length, 4);

  // The capture screen in the photo workspace asks the same single question, and never the
  // three fields the client struck through on it.
  assert.match(visualCapture, /What is on this photo, and why does it matter\?/);
  assert.doesNotMatch(visualCapture, /photoCategories/);
  assert.doesNotMatch(visualCapture, /Room \/ location in your own words/);
  assert.doesNotMatch(visualCapture, /Adjust title, location or context/);
  // The building is a row of buttons that can hold more than one building, not a dropdown.
  assert.match(visualCapture, /<BuildingChoiceField/);
  // The direction is measured, not asked, and the spot can be pointed at on the drawing.
  assert.match(visualCapture, /<FacingDirectionField/);
  assert.match(visualCapture, /<DrawingLocationPicker/);
  assert.match(visualCapture, /readPhotoDirection/);

  // A phone zooms in on a field below 16px; that guard has to beat every component rule.
  assert.match(css, /@media \(max-width: 860px\), \(pointer: coarse\)[\s\S]{0,400}font-size: max\(16px, 1em\) !important/);
});

test("offers marking on the photo everywhere a photo can be attached", async () => {
  const [markup, evidencePad, entry, dailyLog, operations, media, visual, css] = await Promise.all([
    readFile(new URL("../app/photo-markup.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The client reported that marking existed but was not reachable from the forms. Every
  // screen that can attach a photo reaches the same marking pad — through the shared photo
  // block, or directly where the photo has its own full form already.
  for (const [name, source] of [["entry record", entry], ["daily log", dailyLog], ["issues, inspections, HSE and register", operations], ["photo library", media]]) {
    assert.match(source, /<PhotoEvidenceList/, `${name} must reach the marking pad through the shared photo block`);
    assert.match(source, /markupContext=\{/, `${name} must tell the marking pad about the project`);
  }
  assert.match(visual, /<PhotoMarkupPad/);
  assert.match(visual, /<MarkPhotoButton/);
  assert.match(visual, /\bcontext=\{/);
  // The shared block is the only place the pad is opened for the forms.
  assert.match(evidencePad, /<PhotoMarkupPad/);
  // Every one of the four operational photo blocks knows which buildings, rooms and parties
  // a marker can be attached to.
  assert.equal(operations.match(/markupContext=\{\{ \.\.\.markupOptions/g)?.length, 4);

  // A marker carries more than a pin: words, severity, and where it belongs.
  for (const field of [/Full description/, /Severity/, /Where does this belong\?/, /Responsible party/, /Work package/, /Floor \/ room \/ element/]) {
    assert.match(markup, field);
  }
  // Draw, arrow and frame are offered next to the marker tool.
  for (const tool of ['{ id: "pen"', '{ id: "arrow"', '{ id: "box"']) {
    assert.ok(markup.includes(tool), `the marking pad must offer ${tool}`);
  }

  // The colour chips choose the colour of the next marking. They must never recolour a marker
  // that is already on the photo: that silently reclassified a marker while drawing a frame.
  assert.match(markup, /onClick=\{\(\) => setTone\(option\)\}/);
  assert.doesNotMatch(markup, /setTone\(option\);\s*\n\s*if \(activeMarker\)/);
  // Nothing in this screen is pinned: the client asked for a form that simply scrolls.
  assert.match(css, /\.photo-markup-pinned \{ display: grid; gap: 11px; \}/);
  assert.doesNotMatch(css, /\.photo-markup-stage \{[\s\S]{0,200}position: sticky/);

  // Words never end up on the picture: no text tool, and no legend printed over the photo.
  // What a number means is a detail of the photo, kept beside it.
  assert.doesNotMatch(markup, /kind: "text"/);
  assert.doesNotMatch(markup, /photo-markup-label/);
  assert.doesNotMatch(markup, /legendFontSize/);
  assert.match(markup, /type Tool = "marker" \| "pen" \| "arrow" \| "box";/);
  assert.match(evidencePad, /description: appendPhotoDetail\(photo\.details\.description, report\)/);

  // Markings are positioned against the picture, not against the black bars beside a portrait
  // photo, so a marker lands exactly where it was tapped.
  assert.match(markup, /className="photo-markup-frame"/);
  assert.match(css, /\.photo-markup-frame \{[\s\S]{0,120}position: relative/);

  // The toolbar rows are fixed columns, so no font size can push them past the screen edge.
  assert.match(css, /\.photo-markup-modes, \.photo-markup-tones, \.photo-markup-history \{[\s\S]{0,160}grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /text-size-adjust: 100%/);

  // Dragging the pen must not turn into dragging the photo, which cancels the stroke.
  assert.match(markup, /draggable=\{false\}/);
  assert.match(markup, /event\.preventDefault\(\);\r?\n\s*event\.currentTarget\.setPointerCapture/);
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

test("walks the back button through the screens the field user actually visited", async () => {
  const {
    closesOverlay,
    emptyScreen,
    historyActionFor,
    sameScreen,
    screenFromSearch,
    screenToSearch,
  } = await import("../lib/navigation/screen-url.mjs");

  const screen = (parts) => ({ ...emptyScreen, ...parts });

  // A screen is written into the address bar, so a reload or a reopened installed app
  // lands where the user was instead of at the beginning.
  assert.equal(screenToSearch(emptyScreen), "");
  assert.equal(
    screenToSearch(screen({ project: "p1", nav: "project", tab: "ncr" })),
    "?project=p1&nav=project&tab=ncr",
  );
  assert.deepEqual(screenFromSearch("?project=p1&nav=project&tab=ncr"), {
    project: "p1", nav: "project", tab: "ncr", modal: null, menu: false,
  });
  // A drawer never comes back from a link.
  assert.equal(screenFromSearch("?project=p1").menu, false);

  // The first screen replaces; nothing that did not change touches the history.
  assert.equal(historyActionFor(null, emptyScreen, false), "replace");
  assert.equal(historyActionFor(emptyScreen, screen({}), false), "none");

  // A simulated phone: every step the user takes is one entry, and back returns the
  // screen before it instead of the landing page.
  const stack = [];
  let current = null;
  let restoring = false;
  const go = (next) => {
    const action = historyActionFor(current, next, restoring);
    restoring = false;
    if (action === "none") return;
    if (action === "replace") stack[Math.max(stack.length - 1, 0)] = next;
    if (action === "push") stack.push(next);
    if (action === "back") stack.pop();
    current = action === "back" ? stack[stack.length - 1] : next;
  };
  const back = () => {
    stack.pop();
    const restored = stack[stack.length - 1];
    restoring = true;
    current = restored;
    // The app puts itself back on that screen, which the sync sees as "nothing changed".
    go(restored);
    return current;
  };

  go(emptyScreen);                                                   // project selection
  go(screen({ project: "p1" }));                                     // opened a project
  go(screen({ project: "p1", nav: "project" }));                     // workspace
  go(screen({ project: "p1", nav: "project", tab: "ncr" }));         // NCR module
  assert.equal(stack.length, 4);

  // A dialog is a screen too: back closes it and leaves the module underneath.
  go(screen({ project: "p1", nav: "project", tab: "ncr", modal: "quick" }));
  assert.equal(stack.length, 5);
  assert.ok(sameScreen(back(), screen({ project: "p1", nav: "project", tab: "ncr" })));
  assert.equal(stack.length, 4);

  // Closing that same dialog with its own button spends the entry it added, so the back
  // button afterwards goes to the module before it — not back into the dialog.
  go(screen({ project: "p1", nav: "project", tab: "ncr", modal: "quick" }));
  assert.equal(stack.length, 5);
  go(screen({ project: "p1", nav: "project", tab: "ncr" }));
  assert.equal(stack.length, 4);
  assert.ok(sameScreen(back(), screen({ project: "p1", nav: "project" })));

  // And back keeps walking: workspace → project → the project list.
  assert.ok(sameScreen(back(), screen({ project: "p1" })));
  assert.ok(sameScreen(back(), emptyScreen));
  assert.equal(stack.length, 1);

  // Only an overlay closing counts as spending an entry; changing module does not.
  assert.equal(closesOverlay(screen({ modal: "quick" }), screen({})), true);
  assert.equal(closesOverlay(screen({ menu: true }), screen({})), true);
  assert.equal(closesOverlay(screen({ tab: "ncr" }), screen({ tab: "home" })), false);
  assert.equal(closesOverlay(screen({ modal: "quick" }), screen({ nav: "acties" })), false);
});

test("says what has to happen next with a record in the action centre", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date("2026-08-02T14:00:00Z");
  const record = (extra) => ({ status: "open", priority: "normal", dueAt: null, ownerUserId: null, ownerLabel: "", ...extra });

  // The one instruction on a row. A record that is waiting on somebody says what that
  // somebody has to do; a finished record says nothing has to happen.
  assert.equal(nextStepFor(record({ status: "closed" })), "done");
  assert.equal(nextStepFor(record({ status: "verified" })), "done");
  assert.equal(nextStepFor(record({ status: "draft" })), "finish");
  assert.equal(nextStepFor(record({ status: "ready_for_verification" })), "verify");
  assert.equal(nextStepFor(record({ status: "in_review" })), "decide");
  assert.equal(nextStepFor(record()), "assign");
  assert.equal(nextStepFor(record({ ownerLabel: "Aannemer B" })), "start");
  assert.equal(nextStepFor(record({ ownerUserId: "u1", status: "in_progress" })), "progress");
  // Being late is already visible on the deadline itself, so the more specific expectation
  // stays the instruction.
  assert.equal(nextStepFor(record({ status: "ready_for_verification", dueAt: "2020-01-01T00:00:00Z" })), "verify");

  // Late, urgent and explicitly escalated are one group: on site they mean the same thing.
  assert.equal(isEscalatedItem(record({ dueAt: new Date(now.getTime() - day).toISOString() }), now), true);
  assert.equal(isEscalatedItem(record({ priority: "critical" }), now), true);
  assert.equal(isEscalatedItem(record({ escalationRequired: true }), now), true);
  assert.equal(isEscalatedItem(record({ dueAt: new Date(now.getTime() + 3 * day).toISOString() }), now), false);
  // A closed record with a date in the past is not an arrear.
  assert.equal(isEscalatedItem(record({ status: "closed", priority: "critical", dueAt: "2020-01-01T00:00:00Z" }), now), false);
  assert.equal(isOverdueItem(record({ status: "closed", dueAt: "2020-01-01T00:00:00Z" }), now), false);

  // The day that counts is the day on site, not the day of a phone in another timezone.
  assert.equal(daysUntilOnSite("2026-08-02T23:00:00-03:00", now), 0);
  assert.equal(daysUntilOnSite("2026-08-05T09:00:00-03:00", now), 3);
  assert.equal(daysUntilOnSite("2026-07-30T09:00:00-03:00", now), -3);

  // The row that needs a decision today stands on top: open before closed, escalations
  // before the rest, then the closest deadline, and no deadline last.
  const items = [
    record({ status: "closed" }),
    record({ dueAt: new Date(now.getTime() + 10 * day).toISOString() }),
    record({ dueAt: new Date(now.getTime() - day).toISOString() }),
    record(),
  ];
  const sorted = [...items].sort((left, right) => compareActionItems(left, right, now));
  assert.equal(sorted[0], items[2]);
  assert.equal(sorted[1], items[1]);
  assert.equal(sorted[2], items[3]);
  assert.equal(sorted[3], items[0]);
});

test("only lets a connection failure put a field record in the offline queue", () => {
  // No connection: the registration waits on the device, whatever the error looked like.
  assert.equal(isConnectionFailure(new Error("anything"), false), true);
  assert.equal(isConnectionFailure(null, false), true);

  // With a connection, a browser that could not reach the server is still a queue case.
  const fetchFailure = new TypeError("Failed to fetch");
  assert.equal(isConnectionFailure(fetchFailure, true), true);
  assert.equal(isConnectionFailure(new Error("NetworkError when attempting to fetch resource"), true), true);
  assert.equal(isConnectionFailure(new Error("Load failed"), true), true);
  const aborted = new Error("aborted");
  aborted.name = "AbortError";
  assert.equal(isConnectionFailure(aborted, true), true);

  // A database that refuses the record must never be queued: retrying it forever would
  // tell the supervisor it is safe when it never will be.
  assert.equal(isConnectionFailure(new Error("new row violates row-level security policy"), true), false);
  assert.equal(isConnectionFailure(new Error("null value in column \"building_id\""), true), false);
  assert.equal(isConnectionFailure(new Error("permission denied for table findings"), true), false);
  assert.equal(isConnectionFailure("not an error", true), false);

  // A record on the device is recognisable, so a list can keep it read-only.
  assert.equal(isPendingRecordId(newPendingRecordId("abc-123")), true);
  assert.equal(newPendingRecordId("abc-123"), "pending:abc-123");
  assert.equal(isPendingRecordId("6f1a2c34-0000-4000-8000-000000000000"), false);
  assert.equal(isPendingRecordId(undefined), false);
});

test("turns a compass reading into the eight points a supervisor uses", () => {
  assert.deepEqual(compassPoints, ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  assert.equal(compassPointFromDegrees(0), "N");
  assert.equal(compassPointFromDegrees(45), "NE");
  assert.equal(compassPointFromDegrees(200), "S");
  assert.equal(compassPointFromDegrees(359), "N");
  // A camera may report a bearing that ran past a full circle, or a negative one.
  assert.equal(compassPointFromDegrees(365), "N");
  assert.equal(compassPointFromDegrees(-90), "W");
  // Nothing measured stays empty, so the field can still be answered by hand.
  assert.equal(compassPointFromDegrees(null), "");
  assert.equal(compassPointFromDegrees(Number.NaN), "");
  assert.equal(compassPointFromDegrees(undefined), "");
});

test("names a photo from the one sentence the supervisor wrote", () => {
  // The client asked for a single text box per photo; the report still needs a file name.
  assert.equal(
    photoTitleFromDescription("Rebar column line B is bent. It has to be replaced before pouring."),
    "Rebar column line B is bent",
  );
  assert.equal(photoTitleFromDescription("Scheur in de wand\nTweede regel"), "Scheur in de wand");
  // A photo without words falls back to the name the screen already gave it.
  assert.equal(photoTitleFromDescription("   ", "Veldfoto"), "Veldfoto");
  assert.equal(photoTitleFromDescription(""), "");

  // A long opening sentence is cut on a word rather than in the middle of one.
  const long = `${"steel ".repeat(40)}end`;
  const title = photoTitleFromDescription(long);
  assert.ok(title.length <= 91, title);
  assert.ok(title.endsWith("…"));
  assert.ok(!title.includes("stee…"));
});

test("reads the facing direction the camera wrote into the photo", () => {
  // A photo with a bearing of 135 degrees was taken facing south-east, in both byte orders.
  assert.equal(exifImageDirection(jpegWithDirection(135, true)), 135);
  assert.equal(exifImageDirection(jpegWithDirection(135, false)), 135);
  assert.equal(compassPointFromDegrees(exifImageDirection(jpegWithDirection(135, true))), "SE");

  // Indoors a phone often records no bearing at all, and that is not an error.
  assert.equal(exifImageDirection(jpegWithoutExif()), null);
  assert.equal(exifImageDirection(new ArrayBuffer(0)), null);
  assert.equal(exifImageDirection(new Uint8Array([1, 2, 3]).buffer), null);
});

/**
 * A minimal JPEG that carries one EXIF field: the bearing the camera was pointing at. Built by
 * hand so the reader is tested against the bytes a phone actually writes, in both byte orders,
 * without pulling a photo of several megabytes into the test suite.
 */
function jpegWithDirection(degrees, littleEndian) {
  const tiff = new DataView(new ArrayBuffer(52));
  const setShort = (offset, value) => tiff.setUint16(offset, value, littleEndian);
  const setLong = (offset, value) => tiff.setUint32(offset, value, littleEndian);

  tiff.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  setShort(2, 0x002a);
  setLong(4, 8);

  // IFD0: one entry, the pointer to the GPS directory.
  setShort(8, 1);
  setShort(10, 0x8825);
  setShort(12, 4);
  setLong(14, 1);
  setLong(18, 26);
  setLong(22, 0);

  // GPS directory: one entry, the image direction as a rational number.
  setShort(26, 1);
  setShort(28, 0x0011);
  setShort(30, 5);
  setLong(32, 1);
  setLong(36, 44);
  setLong(40, 0);
  setLong(44, degrees);
  setLong(48, 1);

  const bytes = new Uint8Array(2 + 2 + 2 + 6 + tiff.byteLength + 2);
  const file = new DataView(bytes.buffer);
  file.setUint16(0, 0xffd8);
  file.setUint16(2, 0xffe1);
  file.setUint16(4, 2 + 6 + tiff.byteLength);
  bytes.set(new TextEncoder().encode("Exif"), 6);
  bytes.set(new Uint8Array(tiff.buffer), 12);
  file.setUint16(bytes.length - 2, 0xffd9);
  return bytes.buffer;
}

/** The same file without the EXIF segment: a camera that recorded no bearing at all. */
function jpegWithoutExif() {
  const bytes = new Uint8Array(4);
  const file = new DataView(bytes.buffer);
  file.setUint16(0, 0xffd8);
  file.setUint16(2, 0xffd9);
  return bytes.buffer;
}

test("totals the workforce per organisation and per trade, and signals a deviation", () => {
  const rows = [
    { partyId: "a", party: "Bouwbedrijf A", discipline: "Metselaar", count: 4 },
    { partyId: "a", party: "Bouwbedrijf A", discipline: "Timmerman", count: 3 },
    { partyId: "b", party: "Installateur B", discipline: "Metselaar", count: 2 },
    { partyId: "c", party: "Inspectie C", discipline: "Inspecteur", count: 1, entryType: "visitor" },
  ];

  // §4.3: a visitor is on site but is not manning the work, so no total counts them.
  assert.equal(workforceHeadcount(rows), 9);
  assert.deepEqual(workforceByParty(rows), [
    { key: "a", label: "Bouwbedrijf A", count: 7 },
    { key: "b", label: "Installateur B", count: 2 },
  ]);
  // Two contractors both supplying masons is one masonry total, largest trade first.
  assert.deepEqual(workforceByDiscipline(rows), [
    { key: "Metselaar", label: "Metselaar", count: 6 },
    { key: "Timmerman", label: "Timmerman", count: 3 },
  ]);
  assert.deepEqual(workforceByParty([]), []);

  // §4.3: signal a large deviation against the plan and against the last workday.
  assert.deepEqual(workforceDeviations({ total: 9, expected: 9, previous: 9 }), []);
  // Within the threshold nothing is said; a crew is never exactly the same two days running.
  assert.deepEqual(workforceDeviations({ total: 10, expected: 9, previous: null }), []);
  const [planned] = workforceDeviations({ total: 4, expected: 10, previous: null });
  assert.equal(planned.kind, "planned");
  assert.equal(planned.direction, "below");
  assert.equal(planned.reference, 10);
  assert.equal(planned.share, 0.6);
  const [above] = workforceDeviations({ total: 15, expected: null, previous: 10 });
  assert.equal(above.kind, "previous");
  assert.equal(above.direction, "above");
  // A missing or nonsensical reference never produces a signal.
  assert.deepEqual(workforceDeviations({ total: 9, expected: 0, previous: null }), []);
  assert.deepEqual(workforceDeviations({ total: 9 }), []);

  // The explanation is only demanded when there is something to explain.
  assert.equal(workforceNoteRequired([], ""), false);
  assert.equal(workforceNoteRequired(workforceDeviations({ total: 4, expected: 10 }), ""), true);
  assert.equal(workforceNoteRequired(workforceDeviations({ total: 4, expected: 10 }), "  "), true);
  assert.equal(workforceNoteRequired(workforceDeviations({ total: 4, expected: 10 }), "Twee ploegen elders."), false);
});
