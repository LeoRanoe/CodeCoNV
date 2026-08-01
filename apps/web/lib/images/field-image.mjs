// @ts-check

export const fieldPhotoMimeTypes = Object.freeze(["image/jpeg", "image/png", "image/webp"]);

/**
 * @param {number} width
 * @param {number} height
 */
export function validatePanoramaDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { valid: false, reason: "unreadable" };
  }
  if (Math.abs((width / height) - 2) > 0.04) {
    return { valid: false, reason: "ratio" };
  }
  if (width < 3840 || height < 1920) {
    return { valid: false, reason: "resolution" };
  }
  return { valid: true, reason: null };
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ left: number, top: number, width: number, height: number }} bounds
 */
export function normalizedImagePoint(clientX, clientY, bounds) {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0.5, y: 0.5 };
  return {
    x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
  };
}

/** The three marker classifications the client uses on a punch list. */
export const photoMarkupTones = Object.freeze(["to_be_corrected", "alternative_solution", "validated"]);

/** @type {Record<string, string>} */
export const photoMarkupToneColors = Object.freeze({
  to_be_corrected: "#f07400",
  alternative_solution: "#d92d20",
  validated: "#0f8a5f",
});

/**
 * A marked photo is drawn at its own resolution, not at the size of the phone screen it was
 * marked on. Very large camera files are stepped down first so a mid-range phone can still
 * flatten the markings without running out of memory.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} [maxEdge]
 */
export function markupCanvasSize(width, height, maxEdge = 2400) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0, scale: 1 };
  }
  const longest = Math.max(width, height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Markings must stay readable on a printed report page as well as on a phone, so their size
 * follows the shortest edge of the image instead of a fixed pixel count.
 *
 * @param {number} width
 * @param {number} height
 */
export function markupScale(width, height) {
  const shortest = Math.max(1, Math.min(width, height));
  return {
    markerRadius: Math.max(14, Math.round(shortest * 0.038)),
    strokeWidth: Math.max(3, Math.round(shortest * 0.008)),
    fontSize: Math.max(13, Math.round(shortest * 0.042)),
    legendFontSize: Math.max(11, Math.round(shortest * 0.028)),
  };
}

/**
 * The written side of a marking: the numbered list that travels into the description or
 * caption of the record, so a reader who only has the text still knows what was marked.
 *
 * @param {Array<{ label?: string }>} markers
 */
export function photoMarkupSummary(markers) {
  return markers
    .map((marker, index) => ({ index, label: (marker.label ?? "").trim() }))
    .filter((marker) => marker.label.length > 0)
    .map((marker) => `${marker.index + 1}. ${marker.label}`)
    .join(" · ");
}

/**
 * A marked photo keeps the name of the photo it came from, so the same picture is not filed
 * twice under two unrelated names.
 *
 * @param {string} name
 */
export function markedPhotoName(name) {
  const base = (name || "photo").replace(/\.[^.]+$/, "").replace(/-marked(-\d+)?$/, "").slice(0, 80);
  return `${base || "photo"}-marked.jpg`;
}
