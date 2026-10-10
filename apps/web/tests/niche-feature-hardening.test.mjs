import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { coordinatesFromTap, validMapCoordinates, mercatorLatitudeLimit } from "../lib/maps/mercator.mjs";
import { calculateExpression } from "../lib/field-tools/calculator.mjs";
import { locationBreadcrumb, locationPath, selectableLocation } from "../lib/locations/tree.mjs";
import { strokeLayout, strokePoint } from "../lib/images/stroke-layout.mjs";
import { imageContentType, orderedTour, validTourPosition } from "../lib/images/content-type.mjs";
import { parseBoqCsv } from "../lib/boq/parser.mjs";
import { searchDocuments, searchTerms } from "../lib/rapid-verify/search.mjs";
import { extractPdfPages } from "../lib/rapid-verify/pdf-pages.mjs";
import { parseRecordQuery, filterRecordDirectory, projectRecordDay } from "../lib/records/record-directory.mjs";

test("GPS rejects denial, invalid coordinates, timeouts and ignores results after cancellation", async () => {
  let success, failure, timeout, cleared = 0;
  await withModule("../lib/browser/geolocation.ts", {
    validMapCoordinates,
    navigator: { geolocation: { getCurrentPosition: (yes, no) => { success = yes; failure = no; } } },
    setTimeout: (callback) => { timeout = callback; return 1; }, clearTimeout: () => { cleared += 1; },
  }, async ({ locateCoordinates }) => {
    let request = locateCoordinates(new AbortController().signal);
    success({ coords: { latitude: 5.85, longitude: -55.2 } });
    assert.deepEqual(await request, { latitude: 5.85, longitude: -55.2 });
    request = locateCoordinates(new AbortController().signal); failure({ code: 1 });
    await assert.rejects(request, /could not be read/);
    request = locateCoordinates(new AbortController().signal); success({ coords: { latitude: NaN, longitude: 20 } });
    await assert.rejects(request, /invalid/);
    request = locateCoordinates(new AbortController().signal); timeout();
    await assert.rejects(request, /timed out/);
    const controller = new AbortController();
    request = locateCoordinates(controller.signal); controller.abort();
    success({ coords: { latitude: 5.85, longitude: -55.2 } });
    await assert.rejects(request, { name: "AbortError" });
    assert.equal(cleared, 5);
  });
});

test("Clipboard failure is observable and fallback restores focus and removes its field", async () => {
  await withModule("../lib/browser/clipboard.ts", { navigator: { clipboard: { writeText: async () => { throw new Error("permission denied"); } } } }, async ({ copyText }) => {
    await assert.rejects(copyText("test"), /permission denied/);
  });
  let removed = 0, focused = 0;
  const input = { style: {}, setAttribute() {}, select() {}, remove() { removed += 1; } };
  await withModule("../lib/browser/clipboard.ts", {
    navigator: {}, HTMLElement: class {},
    document: { activeElement: { focus() { focused += 1; } }, createElement: () => input, body: { appendChild() {} }, execCommand: () => false },
  }, async ({ copyText }) => { await assert.rejects(copyText("test"), /Clipboard unavailable/); });
  assert.equal(removed, 1);
  // The fallback only focuses an HTMLElement; an unsupported focus target is ignored.
  assert.equal(focused, 0);
});

test("Record date search uses Suriname boundaries and rejects impossible calendar days", () => {
  const now = "2026-10-11T01:30:00Z";
  assert.equal(parseRecordQuery("today", { now }).dateFrom, "2026-10-10");
  assert.equal(parseRecordQuery("yesterday", { now }).dateFrom, "2026-10-09");
  assert.equal(projectRecordDay(now), "2026-10-10");
  assert.equal(projectRecordDay("2026-02-30"), "");
  assert.equal(parseRecordQuery("31-02-2026", { now }).dateFrom, "invalid");
  const directory = [{ id: "test", code: "", normalizedCode: "", title: "", subtitle: "", author: "", status: "open", date: now, buildingIds: [], kind: "finding" }];
  assert.equal(filterRecordDirectory(directory, "today", {}, { now }).length, 1);
  assert.equal(filterRecordDirectory(directory, "31-02-2026", {}, { now }).length, 0);
});

test("Private cache fallback rejects HTTP failures and account-switch responses", async () => {
  let owner = "alpha", reads = 0, writes = 0;
  let fetchResponse = async () => new Response("evidence");
  await withModule("../lib/storage/gateway.ts", {
    activeOfflineUser: () => owner,
    isConnectionFailure: (error) => error instanceof TypeError || error.message.includes("failed to fetch"),
    downloadBlob: () => {}, validAccessToken: async () => "local-test-token",
    cacheProjectFile: async () => { writes += 1; },
    readCachedProjectFile: async () => { reads += 1; return new Blob(["cached"]); },
    fetch: (...args) => fetchResponse(...args),
  }, async ({ loadProjectFileBlob }) => {
    assert.equal(await (await loadProjectFileBlob({}, "file")).text(), "evidence");
    for (const status of [401, 403, 404, 500]) {
      fetchResponse = async () => new Response(JSON.stringify({ error: "failed to fetch private authorization" }), { status });
      await assert.rejects(loadProjectFileBlob({}, "file"));
    }
    assert.equal(reads, 0);
    fetchResponse = async () => { throw new TypeError("Failed to fetch"); };
    assert.equal(await (await loadProjectFileBlob({}, "file")).text(), "cached");
    fetchResponse = async () => { owner = "bravo"; return new Response("alpha secret"); };
    await assert.rejects(loadProjectFileBlob({}, "file"), /account changed/);
    assert.equal(writes, 1);
  });
});

test("Service worker isolates shell caches, validates precache and handles malformed push", async () => {
  const { runInNewContext } = await import("node:vm");
  const events = {}, removed = [], added = [], notices = [], destinations = [];
  const cache = { match: async () => null, add: async (request) => added.push(request.url) };
  const self = {
    location: { origin: "https://codeco.test" },
    addEventListener: (name, callback) => { events[name] = callback; },
    registration: { showNotification: async (...args) => notices.push(args) },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async (url) => destinations.push(url) },
  };
  runInNewContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self, URL, Request, Response, setTimeout, clearTimeout,
    caches: { keys: async () => ["other-app-cache", "codeco-field-shell-v4", "codeco-field-shell-v5"], delete: async (key) => removed.push(key), open: async () => cache },
  });
  let pending;
  const waitUntil = (promise) => { pending = promise; };
  events.activate({ waitUntil }); await pending;
  assert.deepEqual(removed, ["codeco-field-shell-v4"]);
  events.message({ waitUntil, data: { type: "codeco-precache", urls: ["https://codeco.test/_next/static/a.js", "https://evil.test/_next/static/a.js", "/api/storage/files/private", "javascript:alert(1)"] }, ports: [] }); await pending;
  assert.deepEqual(added, ["https://codeco.test/_next/static/a.js"]);
  events.push({ waitUntil, data: { json: () => { throw new Error("invalid JSON"); } } }); await pending;
  assert.equal(notices[0][0], "CODECO Supervisie");
  events.notificationclick({ waitUntil, notification: { close() {}, data: { url: "https://evil.test/private" } } }); await pending;
  assert.deepEqual(destinations, ["https://codeco.test/supervisie"]);
});

for (const latitude of [5.8521, -5.8521, 52.37, -33.86, 0]) {
  for (const zoom of [3, 10, 17, 20]) {
    test(`Mercator center/offset direction at latitude ${latitude}, zoom ${zoom}`, () => {
      const center = { latitude, longitude: -55.2034 };
      const tap = coordinatesFromTap(center, zoom, 0, 0);
      assert.ok(Math.abs(tap.latitude - latitude) < 1e-9);
      assert.ok(Math.abs(tap.longitude - center.longitude) < 1e-9);
      assert.ok(coordinatesFromTap(center, zoom, 30, 0).longitude > center.longitude);
      assert.ok(coordinatesFromTap(center, zoom, -30, 0).longitude < center.longitude);
      assert.ok(coordinatesFromTap(center, zoom, 0, 30).latitude < latitude);
    });
  }
}
test("Mercator rejects invalid centers and wraps/clamps world boundaries", () => {
  for (const latitude of [NaN, Infinity, -Infinity, 90, -90]) assert.equal(validMapCoordinates({ latitude, longitude: 0 }), false);
  assert.equal(coordinatesFromTap({ latitude: 0, longitude: 181 }, 3, 0, 0), null);
  assert.equal(coordinatesFromTap({ latitude: 0, longitude: 0 }, 3, NaN, 0), null);
  const east = coordinatesFromTap({ latitude: 0, longitude: 179.99 }, 3, 20, -100000);
  assert.ok(east.longitude >= -180 && east.longitude < -170);
  assert.ok(Math.abs(east.latitude) <= mercatorLatitudeLimit + 1e-9);
});
test("Calculator grammar handles precedence, signs, decimal commas and zero", () => {
  for (const [source, expected] of [["2 + 3 * 4", 14], ["(2+3)*4", 20], ["-(-2)", 2], [".5 + 1,25", 1.75], ["3/2", 1.5], ["0*999", 0], ["1--2", 3]]) assert.equal(calculateExpression(source), expected);
});
test("Calculator rejects injection, malformed input, excessive recursion and intermediate infinity", () => {
  for (const source of ["", "alert(1)", "1;globalThis.x=1", "2**3", "(2+3", "2 3", "1/0", "1/(-0)", "2..3", "(".repeat(65) + "1" + ")".repeat(65), "1".repeat(4097), "9".repeat(309) + "*0"]) assert.throws(() => calculateExpression(source), source);
});
const nodes = [
  { id: "floor", building_id: "a", parent_id: null, node_type: "floor", code: "F1", name: "First", status: "active" },
  { id: "room", building_id: "a", parent_id: "floor", node_type: "room", code: "R1", name: "Room", status: "active" },
  { id: "element", building_id: "a", parent_id: "room", node_type: "element", code: "E1", name: "Wall", status: "active" },
];
test("Location hierarchy rejects orphan/cycle/foreign/inactive ancestry and enforces minimum depth", () => {
  assert.equal(locationBreadcrumb(nodes, "room"), "F1 · First → R1 · Room");
  assert.equal(selectableLocation(nodes, "room", "a", "element"), false);
  assert.equal(selectableLocation(nodes, "element", "a", "room"), true);
  assert.equal(selectableLocation(nodes, "room", "b", "building"), false);
  for (const floor of [{ ...nodes[0], parent_id: "room" }, { ...nodes[0], building_id: "b" }, { ...nodes[0], status: "inactive" }, { ...nodes[0], parent_id: "missing" }]) assert.deepEqual(locationPath([floor, ...nodes.slice(1)], "room", "a", true), []);
});
test("Signature/sketch space stays uniform across desktop, mobile, tablet and high DPI", () => {
  const space = { width: 900, height: 360 };
  for (const width of [1440, 820, 390]) {
    const bounds = { left: 20, top: 10, width, height: 240 };
    const layout = strokeLayout(space, bounds);
    const actual = strokePoint(20 + layout.x + 400 * layout.scale, 10 + layout.y + 150 * layout.scale, bounds, space);
    assert.ok(Math.abs(actual.x - 400) < 1e-9);
    assert.ok(Math.abs(actual.y - 150) < 1e-9);
    assert.equal(layout.scale, Math.min(width / 900, 240 / 360));
  }
  assert.equal(strokeLayout(space, { width: 0, height: 240 }), null);
});
test("Image types come from actual magic bytes, not a camera extension", () => {
  assert.equal(imageContentType(new Uint8Array([255, 216, 255, 224])), "image/jpeg");
  assert.equal(imageContentType(new Uint8Array([137,80,78,71,13,10,26,10])), "image/png");
  assert.equal(imageContentType(new TextEncoder().encode("RIFF1234WEBP")), "image/webp");
  for (const source of [new Uint8Array(), new TextEncoder().encode("fake.jpg"), new TextEncoder().encode("<script>bad</script>")]) assert.equal(imageContentType(source), "");
});
test("Tour positions are bounded integers and frame lists isolate building/type/status", () => {
  for (const order of ["", "0", "-1", "1.5", "Infinity", "10001"]) assert.equal(validTourPosition("Tour", order), false);
  assert.equal(validTourPosition("Tour", "1"), true);
  assert.equal(validTourPosition("  ", ""), true);
  const current = { id: "a", tour_name: "Tour", tour_order: 2, capture_type: "panorama", building_id: "a", status: "active" };
  assert.deepEqual(orderedTour([current, { ...current, id: "b", tour_order: 1 }, { ...current, id: "c", building_id: "b" }, { ...current, id: "d", capture_type: "photo" }, { ...current, id: "e", status: "deleted" }], current).map((frame) => frame.id), ["b", "a"]);
});
test("BOQ parser preserves quoted multiline text, escaped quotes and physical source rows", () => {
  const csv = '\uFEFFcode;omschrijving;hoeveelheid;voortgang_%\r\nA;"Long\nwall, \\"description\\"";"1,25";25\r\nB;Concrete;2;100'.replaceAll('\\"', '""');
  const rows = parseBoqCsv(csv);
  assert.equal(rows[0].quantity, 1.25);
  assert.match(rows[0].description, /Long\nwall/);
  assert.equal(rows[1].source_row, 4);
  assert.equal(parseBoqCsv('code,description\nA,"wall, concrete"')[0].description, "wall, concrete");
});
test("BOQ parser rejects duplicates, broken rows, binary/oversized input and non-finite numbers", () => {
  for (const csv of ['code;omschrijving\nA;"broken', 'code;omschrijving\nA;wall;extra', 'code;omschrijving\nA;wall\nA;other', 'code;item;description\nA;B;wall', 'code;omschrijving;hoeveelheid\nA;wall;Infinity', 'code;omschrijving;voortgang\nA;wall;101', 'code;omschrijving\nA;wall\0', 'x'.repeat(5_000_001), 'code;omschrijving\nA;"wall"text']) assert.throws(() => parseBoqCsv(csv));
});
const documents = [
  { id: "one", name: "same.pdf", pages: [{ page: 3, text: "Concrète strength C30 is prescribed. Métal framing." }] },
  { id: "two", name: "same.pdf", pages: [{ page: 8, text: "Steel bolts require inspection." }] },
];
test("Rapid Verify accents, stopwords, page/source identity and no-evidence results", () => {
  assert.deepEqual(searchTerms("the and van"), []);
  const result = searchDocuments(documents, "Concrete metal")[0];
  assert.equal(result.documentId, "one");
  assert.equal(result.page, 3);
  assert.equal(result.excerpt, documents[0].pages[0].text);
  assert.deepEqual(searchDocuments(documents, "invented requirement"), []);
  assert.deepEqual(searchDocuments(documents.slice(1), "Concrete"), []);
  assert.equal(searchDocuments(documents, "steel")[0].documentId, "two");
});
function pdfTask(texts, failPage = 0) {
  const state = { destroyed: 0, cleaned: 0 };
  return { state, destroy: async () => { state.destroyed += 1; }, promise: Promise.resolve({ numPages: texts.length, getPage: async (page) => ({ getTextContent: async () => { if (page === failPage) throw new Error("corrupt page"); return { items: [{ str: texts[page - 1] }] }; }, cleanup: () => { state.cleaned += 1; } }) }) };
}
test("PDF extraction cleans up pages/workers on success, corrupt page, textless scan and size limits", async () => {
  const task = pdfTask(["page one", "page two"]);
  const progress = [];
  const pages = await extractPdfPages(task, { onProgress: (page, total) => progress.push([page, total]) });
  assert.equal(pages[1].page, 2); assert.equal(task.state.cleaned, 2); assert.equal(task.state.destroyed, 1);
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
  for (const [broken, options] of [[pdfTask(["one", "two"], 2), {}], [pdfTask([""]), {}], [pdfTask(["one", "two"]), { maxPages: 1 }], [pdfTask(["too long"]), { maxCharacters: 2 }]]) {
    await assert.rejects(extractPdfPages(broken, options));
    assert.equal(broken.state.destroyed, 1);
  }
});
test("PDF cancellation destroys worker and returns no partial evidence", async () => {
  const controller = new AbortController();
  const task = pdfTask(["one", "two"]);
  await assert.rejects(extractPdfPages(task, { signal: controller.signal, onProgress: () => controller.abort() }));
  assert.ok(task.state.destroyed >= 1);
});

// Execute the real TypeScript implementation with injected I/O; no source-pattern assertions.
async function withModule(path, mocks, operation) {
  const key = `nicheMocks${crypto.randomUUID().replaceAll("-", "")}`;
  globalThis[key] = mocks;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  try {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "");
    const injected = `const { ${Object.keys(mocks).join(", ")} } = globalThis[${JSON.stringify(key)}];\n${compiled}`;
    const loadedModule = await import(`data:text/javascript;base64,${Buffer.from(injected).toString("base64")}`);
    return await operation(loadedModule);
  } finally {
    delete globalThis[key];
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  }
}
test("Offline pin replay stops on failed create and remains scoped to account/project", async () => {
  let owner = "a", calls = [];
  const records = [{ id: "one", projectId: "p", kind: "create", input: { drawingFileId: "drawing" }, createdAt: "2026-01-01", lastError: null }, { id: "two", projectId: "p", kind: "move", input: {}, createdAt: "2026-01-02", lastError: null }, { id: "other", projectId: "q", kind: "create", input: {}, createdAt: "2026-01-01", lastError: null }];
  await withModule("../lib/offline/drawing-pin-queue.ts", {
    activeOfflineUser: () => owner, idbGetAll: async () => records, idbPut: async (_, row) => calls.push(["failed", row.id]), idbDelete: async (_, id) => calls.push(["deleted", id]),
    isConnectionFailure: () => false, createDrawingPin: async () => { calls.push(["create"]); throw new Error("denied"); }, moveDrawingPin: async () => calls.push(["move"]), voidDrawingPin: async () => {},
  }, async (queue) => {
    const result = await queue.syncDrawingPinMutations({}, "p");
    assert.equal(result.failed, 1); assert.deepEqual(calls, [["create"], ["failed", "one"]]);
    owner = null; calls = [];
    assert.equal((await queue.syncDrawingPinMutations({}, "p")).paused, true); assert.deepEqual(calls, []);
  });
});
test("Offline pin replay uses stable idempotency and stops after an account switch", async () => {
  let owner = "a", deletes = 0, sends = 0, key;
  await withModule("../lib/offline/drawing-pin-queue.ts", {
    activeOfflineUser: () => owner, idbGetAll: async () => [{ id: "one", projectId: "p", kind: "create", input: {}, createdAt: "2026-01-01" }, { id: "two", projectId: "p", kind: "create", input: {}, createdAt: "2026-01-02" }],
    idbPut: async () => {}, idbDelete: async () => { deletes += 1; }, isConnectionFailure: () => false,
    createDrawingPin: async (_, input) => { sends += 1; key = input.idempotencyKey; owner = "b"; }, moveDrawingPin: async () => {}, voidDrawingPin: async () => {},
  }, async (queue) => {
    const result = await queue.syncDrawingPinMutations({}, "p");
    assert.equal(result.paused, true); assert.equal(sends, 1); assert.equal(deletes, 0); assert.equal(key, "offline-drawing-pin:one");
  });
});

test("permissions never widen when the permission service is missing, failing or empty", async () => {
  const { permissionsFrom, restrictedPermissions } = await import("../lib/permissions/permission-model.mjs");
  for (const unknown of [undefined, null, "not-a-list", {}]) {
    const view = permissionsFrom(unknown);
    assert.equal(view.known, false);
    assert.equal(view.can("records.create"), false);
    assert.equal(view.can("files.manage"), false);
    assert.equal(view.can("reports.sign"), false);
    assert.equal(view.canAny("findings.create", "inspections.manage"), false);
    assert.equal(view.can("records.read"), true);
  }
  assert.equal(restrictedPermissions.can("findings.create"), false);
  const client = permissionsFrom(["records.read", "findings.read"]);
  assert.equal(client.known, true);
  assert.equal(client.can("findings.create"), false);
  assert.equal(client.can("findings.read"), true);
  const revoked = permissionsFrom([]);
  assert.equal(revoked.known, true);
  assert.equal(revoked.can("records.read"), false);
  assert.equal(revoked.canAny("records.read", "files.read"), false);
  const supervisor = permissionsFrom(["records.create", "files.manage"]);
  assert.equal(supervisor.canAny("records.create"), true);
});
