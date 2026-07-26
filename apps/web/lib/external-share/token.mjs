// @ts-check

export const externalShareTokenPattern = /^[a-f0-9]{48}$/;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeExternalShareToken(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return externalShareTokenPattern.test(normalized) ? normalized : null;
}

/**
 * @param {string} origin
 * @param {unknown} token
 */
export function externalShareUrl(origin, token) {
  const normalized = normalizeExternalShareToken(token);
  if (!normalized) throw new Error("De externe link bevat geen geldige toegangscode.");
  return `${origin.replace(/\/+$/, "")}/share/${normalized}`;
}
