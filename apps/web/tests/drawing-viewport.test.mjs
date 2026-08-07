import test from "node:test";
import assert from "node:assert/strict";
import {
  drawingPointFromClient,
  drawingPointToClient,
  panDrawingViewport,
  pinDragMoved,
  pointerLiftPlacesPin,
  resetDrawingViewport,
  zoomDrawingViewport,
} from "../lib/drawings/viewport.mjs";
import {
  arrowHeadPoints,
  arrowLineEnd,
  cloudPath,
  polylinePoints,
  textBoxSize,
  toPagePoint,
} from "../lib/drawings/markup-geometry.mjs";

const bounds = { left: 80, top: 40, width: 800, height: 600 };

test("drawing coordinates survive zoom and pan without pin drift", () => {
  const point = { x: 0.37, y: 0.64 };
  const zoomed = zoomDrawingViewport(resetDrawingViewport(2), 2.5, { x: 400, y: 300 });
  const viewport = panDrawingViewport(zoomed, { x: -77, y: 38 });
  const client = drawingPointToClient(point, bounds, viewport);
  const restored = drawingPointFromClient(client, bounds, viewport);
  assert.ok(Math.abs(restored.x - point.x) < 1e-10);
  assert.ok(Math.abs(restored.y - point.y) < 1e-10);
  assert.equal(viewport.page, 2);
});

test("drawing coordinates and scale are clamped", () => {
  const viewport = zoomDrawingViewport(resetDrawingViewport(), 100, { x: 0, y: 0 });
  assert.equal(viewport.scale, 6);
  assert.deepEqual(drawingPointFromClient({ x: -200, y: 9999 }, bounds, viewport), { x: 0, y: 1 });
});

test("a tap in pin mode places a pin, and panning or pinching never does", () => {
  const tap = { moved: false, multiTouch: false };
  assert.equal(pointerLiftPlacesPin({ tool: "pin", activePointerCount: 1, gesture: tap }), true);
  // The last finger of a pinch-zoom comes up alone and has not travelled itself; without
  // the pinch flag that lift used to drop a pin nobody asked for.
  assert.equal(pointerLiftPlacesPin({ tool: "pin", activePointerCount: 1, gesture: { moved: false, multiTouch: true } }), false);
  assert.equal(pointerLiftPlacesPin({ tool: "pin", activePointerCount: 1, gesture: { moved: true, multiTouch: false } }), false);
  assert.equal(pointerLiftPlacesPin({ tool: "pin", activePointerCount: 2, gesture: tap }), false);
  assert.equal(pointerLiftPlacesPin({ tool: "pan", activePointerCount: 1, gesture: tap }), false);
  assert.equal(pointerLiftPlacesPin({ tool: "pin", activePointerCount: 1, gesture: null }), false);
});

test("only a pin that actually travelled is written back", () => {
  const at = { xRatio: 0.4, yRatio: 0.7 };
  assert.equal(pinDragMoved(at, { ...at }), false);
  assert.equal(pinDragMoved(at, { xRatio: 0.4000001, yRatio: 0.7 }), false);
  assert.equal(pinDragMoved(at, { xRatio: 0.52, yRatio: 0.7 }), true);
  assert.equal(pinDragMoved(at, { xRatio: 0.4, yRatio: 0.61 }), true);
});

test("markup shapes are built in the page's own pixels, without stretching", () => {
  const size = { width: 800, height: 600 };
  assert.deepEqual(toPagePoint({ x: 0.5, y: 0.25 }, size), { x: 400, y: 150 });
  assert.equal(polylinePoints([{ x: 0, y: 0 }, { x: 1, y: 1 }], size), "0,0 800,600");
});

test("an arrowhead is a triangle at the tip, sized from its own stroke", () => {
  const head = arrowHeadPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 3);
  const [tip, left, right] = head.split(" ").map((pair) => pair.split(",").map(Number));
  assert.deepEqual(tip, [100, 0]);
  // The two wings sit behind the tip, mirrored across the line.
  assert.ok(left[0] < 100 && right[0] < 100);
  assert.ok(Math.abs(left[1] + right[1]) < 1e-9);
  assert.ok(Math.abs(left[1]) > 1);

  // A thicker stroke gets a bigger head, but it is clamped so it stays an arrowhead.
  const thin = arrowHeadPoints({ x: 0, y: 0 }, { x: 300, y: 0 }, 2).split(" ")[1].split(",").map(Number);
  const thick = arrowHeadPoints({ x: 0, y: 0 }, { x: 300, y: 0 }, 8).split(" ")[1].split(",").map(Number);
  assert.ok(thick[0] < thin[0]);
  assert.ok(300 - thick[0] <= 28);

  // A head never grows longer than the line it belongs to.
  const shortLine = arrowHeadPoints({ x: 0, y: 0 }, { x: 6, y: 0 }, 8).split(" ")[1].split(",").map(Number);
  assert.ok(shortLine[0] >= 0);

  // The line stops short of the tip so the head is not drawn over its own line.
  const stop = arrowLineEnd({ x: 0, y: 0 }, { x: 100, y: 0 }, 3);
  assert.ok(stop.x < 100 && stop.x > 80);
  assert.deepEqual(arrowLineEnd({ x: 5, y: 5 }, { x: 5, y: 5 }, 3), { x: 5, y: 5 });
});

test("a revision cloud is a scalloped arc path, not a dashed line", () => {
  const path = cloudPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }]);
  assert.match(path, /^M 0 0/);
  // Arcs, one per scallop, and enough of them to read as a cloud.
  assert.ok((path.match(/ A /g) ?? []).length >= 6);
  assert.equal(cloudPath([{ x: 1, y: 1 }]), "");
  assert.equal(cloudPath([]), "");
});

test("a text note gets a box that fits its words", () => {
  const small = textBoxSize("Ok");
  const large = textBoxSize("A much longer drawing note that runs on");
  assert.ok(large.width > small.width);
  assert.ok(large.width <= 420);
  assert.ok(small.width >= 60);
  assert.equal(small.height, large.height);
});
