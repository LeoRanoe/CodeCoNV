const minimumScale = 1;
const maximumScale = 6;

export function clampDrawingScale(scale) {
  return Math.min(maximumScale, Math.max(minimumScale, Number.isFinite(scale) ? scale : minimumScale));
}

export function drawingPointFromClient(clientPoint, bounds, viewport) {
  const scale = clampDrawingScale(viewport.scale);
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  return {
    x: Math.min(1, Math.max(0, (clientPoint.x - bounds.left - viewport.offset.x) / (width * scale))),
    y: Math.min(1, Math.max(0, (clientPoint.y - bounds.top - viewport.offset.y) / (height * scale))),
  };
}

export function drawingPointToClient(point, bounds, viewport) {
  const scale = clampDrawingScale(viewport.scale);
  return {
    x: bounds.left + viewport.offset.x + point.x * bounds.width * scale,
    y: bounds.top + viewport.offset.y + point.y * bounds.height * scale,
  };
}

export function panDrawingViewport(viewport, delta) {
  return {
    ...viewport,
    offset: { x: viewport.offset.x + delta.x, y: viewport.offset.y + delta.y },
  };
}

/** Zoom around the fingers/cursor, rather than around a distant page origin. */
export function zoomDrawingViewport(viewport, nextScale, focalPoint) {
  const scale = clampDrawingScale(nextScale);
  const ratio = scale / clampDrawingScale(viewport.scale);
  return {
    ...viewport,
    scale,
    offset: {
      x: focalPoint.x - (focalPoint.x - viewport.offset.x) * ratio,
      y: focalPoint.y - (focalPoint.y - viewport.offset.y) * ratio,
    },
  };
}

export function resetDrawingViewport(page = 1) {
  return { scale: 1, offset: { x: 0, y: 0 }, page };
}

/** How far a finger may travel and still count as a tap rather than a drag. */
export const tapSlopPixels = 4;

/**
 * Whether lifting a finger should place a pin. A pinch is two fingers, and the second one
 * comes up on its own: without this the last lift of a pinch-zoom looked exactly like a
 * tap and dropped a pin the supervisor never asked for.
 */
export function pointerLiftPlacesPin({ tool, activePointerCount, gesture }) {
  if (tool !== "pin" || activePointerCount !== 1 || !gesture) return false;
  return !gesture.moved && !gesture.multiTouch;
}

/**
 * Whether a pin that was touched actually has to be written back. Selecting a pin is a tap
 * on it, and a tap used to save the position it already had: a request and a confirmation
 * toast for a move that never happened.
 */
export function pinDragMoved(from, to, slop = 1e-4) {
  if (!from || !to) return false;
  return Math.abs(from.xRatio - to.xRatio) > slop || Math.abs(from.yRatio - to.yRatio) > slop;
}
