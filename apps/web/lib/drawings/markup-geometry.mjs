/**
 * The shapes drawn over a drawing, in the pixel space of the rendered page.
 *
 * The overlay used to be a 1000x1000 viewBox stretched over a page of any shape with
 * preserveAspectRatio="none". Everything in it was therefore squashed on one axis: an
 * arrowhead became a black wedge the size of a room, and a revision cloud became a row of
 * dots. Working in the page's own pixels removes the distortion at the source, and the
 * shapes below are built from points rather than from SVG markers, which scale with the
 * stroke and cannot be coloured reliably across browsers.
 *
 * Every stored coordinate stays normalised 0..1, so existing markups keep their place.
 */

/** A stored 0..1 point on the page, in the pixels of the page as it is rendered now. */
export function toPagePoint(point, size) {
  return {
    x: Number(point?.x ?? 0) * Math.max(1, size?.width ?? 1),
    y: Number(point?.y ?? 0) * Math.max(1, size?.height ?? 1),
  };
}

/** "x,y x,y" for a polyline, in page pixels. */
export function polylinePoints(points, size) {
  return (points ?? [])
    .map((point) => toPagePoint(point, size))
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(" ");
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * The triangle at the end of an arrow, as its own polygon. Drawn from the line's own
 * direction and sized from the stroke, so it stays a arrowhead at every zoom level and
 * never inherits a marker's scaling rules.
 */
export function arrowHeadPoints(start, end, strokeWidth = 3) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return "";
  const size = Math.max(9, Math.min(28, strokeWidth * 3.5));
  const ux = dx / length;
  const uy = dy / length;
  // Never longer than the line it sits on, or a short arrow becomes only a head.
  const head = Math.min(size, length);
  const baseX = end.x - ux * head;
  const baseY = end.y - uy * head;
  const wing = head * 0.42;
  return [
    `${round(end.x)},${round(end.y)}`,
    `${round(baseX - uy * wing)},${round(baseY + ux * wing)}`,
    `${round(baseX + uy * wing)},${round(baseY - ux * wing)}`,
  ].join(" ");
}

/** Where the arrow's line should stop so the head is not drawn on top of its own line. */
export function arrowLineEnd(start, end, strokeWidth = 3) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return end;
  const head = Math.min(Math.max(9, Math.min(28, strokeWidth * 3.5)), length) * 0.75;
  return { x: end.x - (dx / length) * head, y: end.y - (dy / length) * head };
}

/**
 * A revision cloud: the scalloped outline a drawing office recognises, built as arcs along
 * the path that was drawn. A dashed straight line — what this used to be — is not a cloud.
 */
export function cloudPath(points, { radius = 11 } = {}) {
  const trail = (points ?? []).filter(Boolean);
  if (trail.length < 2) return "";
  // Resample so the scallops are even, however fast the finger moved.
  const step = Math.max(8, radius * 1.5);
  const even = [trail[0]];
  let carry = 0;
  for (let index = 1; index < trail.length; index += 1) {
    const from = trail[index - 1];
    const to = trail[index];
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    if (!span) continue;
    let travelled = step - carry;
    while (travelled <= span) {
      const ratio = travelled / span;
      even.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
      travelled += step;
    }
    carry = (carry + span) % step;
  }
  const last = trail[trail.length - 1];
  const tail = even[even.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step / 2) even.push(last);
  if (even.length < 2) return "";

  let path = `M ${round(even[0].x)} ${round(even[0].y)}`;
  for (let index = 1; index < even.length; index += 1) {
    const from = even[index - 1];
    const to = even[index];
    const span = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    // A scallop bulges to the left of travel, which is what makes the outline read as a cloud.
    const arc = Math.max(radius, span * 0.6);
    path += ` A ${round(arc)} ${round(arc)} 0 0 1 ${round(to.x)} ${round(to.y)}`;
  }
  return path;
}

/** The box behind a text note, sized to the words it holds instead of a guessed width. */
export function textBoxSize(content, fontSize = 15) {
  const text = String(content ?? "");
  const width = Math.min(420, Math.max(60, text.length * fontSize * 0.58 + 16));
  return { width: round(width), height: round(fontSize * 1.9) };
}

function distanceToSegment(point, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - from.x, point.y - from.y);
  const along = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (from.x + along * dx), point.y - (from.y + along * dy));
}

/**
 * The markup under a tap, for the eraser: the shape whose line (or text box) passes closest
 * to the tapped spot, within `tolerance` page pixels. Null when the tap hit empty drawing.
 */
export function markupAtPoint(markups, point, size, tolerance = 24) {
  const tap = toPagePoint(point, size);
  let best = null;
  let bestDistance = Infinity;
  for (const markup of markups ?? []) {
    const geometry = markup?.geometry ?? {};
    let distance = Infinity;
    if (markup.markup_type === "text" && geometry.position) {
      const at = toPagePoint(geometry.position, size);
      const box = textBoxSize(markup.text_content);
      const dx = Math.max(at.x - tap.x, 0, tap.x - (at.x + box.width));
      const dy = Math.max(at.y - box.height - tap.y, 0, tap.y - at.y);
      distance = Math.hypot(dx, dy);
    } else if (markup.markup_type === "arrow" && geometry.start && geometry.end) {
      distance = distanceToSegment(tap, toPagePoint(geometry.start, size), toPagePoint(geometry.end, size));
    } else {
      const points = (geometry.points ?? []).map((item) => toPagePoint(item, size));
      for (let index = 1; index < points.length; index += 1) {
        distance = Math.min(distance, distanceToSegment(tap, points[index - 1], points[index]));
      }
      // A revision cloud is drawn closed, so its last side counts too.
      if (markup.markup_type === "cloud" && points.length > 2) {
        distance = Math.min(distance, distanceToSegment(tap, points[points.length - 1], points[0]));
      }
    }
    if (distance <= tolerance && distance < bestDistance) {
      best = markup;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The markups an Undo press steps back through on one drawing page, oldest first. Undo takes the
 * last of them; once it is voided (or hidden while the void is saved) the next press takes the one
 * before, so Undo walks back through every markup on the page one step at a time (image 2).
 */
export function undoableMarkups(markups, drawingFileId, pageNumber, hiddenIds = []) {
  const hidden = new Set(hiddenIds);
  return (markups ?? [])
    .filter((markup) => markup.drawing_file_id === drawingFileId && markup.page_number === pageNumber
      && markup.status === "active" && !hidden.has(markup.id))
    .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
}
