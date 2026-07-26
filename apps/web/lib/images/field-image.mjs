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
