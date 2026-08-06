import test from "node:test";
import assert from "node:assert/strict";
import {
  drawingPointFromClient,
  drawingPointToClient,
  panDrawingViewport,
  resetDrawingViewport,
  zoomDrawingViewport,
} from "../lib/drawings/viewport.mjs";

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
