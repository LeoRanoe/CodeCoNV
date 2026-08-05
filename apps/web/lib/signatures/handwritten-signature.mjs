/**
 * A signature is something somebody writes, at the moment they agree to what is on the
 * document. The app used to ask for a tick in a box, which says only that a checkbox was
 * clicked; the client asked for the signature itself, on every document that carries one.
 *
 * What is stored is small on purpose: the drawn ink, trimmed to what was actually written
 * and scaled down, plus the name and the moment. It travels inside the record's own JSON,
 * so a signed document stays one record instead of a record plus a file somewhere else.
 */

/** A drawn signature above this size is refused: it belongs in a record, not in storage. */
export const maxSignatureBytes = 120_000;

/** The size the trimmed ink is scaled into before it is stored. */
export const signatureExportSize = { width: 520, height: 180 };

const imagePattern = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Roughly how many bytes a data URL costs once it is decoded. */
export function signatureImageBytes(image) {
  const base64 = String(image ?? "").split(",")[1] ?? "";
  return Math.floor((base64.length * 3) / 4);
}

export function isSignatureImage(image) {
  const value = String(image ?? "");
  return imagePattern.test(value) && signatureImageBytes(value) <= maxSignatureBytes;
}

/**
 * The signature as it is kept in a form and in a record: who signed, what they wrote and
 * when. A signature without a name or without ink is not a signature, so it is null.
 */
export function handwrittenSignature(name, image, signedAt) {
  const signer = String(name ?? "").trim();
  if (signer.length < 2 || !isSignatureImage(image)) return null;
  return {
    name: signer.slice(0, 120),
    image: String(image),
    signedAt: signedAt || new Date().toISOString(),
  };
}

export function isSigned(signature) {
  return Boolean(signature && signature.name && signature.image);
}

/** What lands in the record's own JSON, under the keys that document already uses. */
export function signatureDetails(signature, prefix = "signature") {
  return {
    [`${prefix}_image`]: isSigned(signature) ? signature.image : null,
  };
}

/** Reads a stored signature back into the shape the form and the pad work with. */
export function signatureFromDetails(name, signedAt, image) {
  return handwrittenSignature(name, image, signedAt || null);
}

/**
 * The box the ink actually occupies. Signing on a wide pad usually leaves most of the
 * canvas empty; storing that empty space is bytes for nothing and makes the signature
 * look tiny on a printed form.
 */
export function signatureInkBounds(strokes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes ?? []) {
    for (const point of stroke?.points ?? []) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * The part of the pad that is exported, with room around the ink so a signature is not
 * cut off by its own line thickness, and never outside the pad itself.
 */
export function signatureExportBox(bounds, canvasWidth, canvasHeight, padding = 12) {
  if (!bounds) return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  const x = Math.max(0, bounds.minX - padding);
  const y = Math.max(0, bounds.minY - padding);
  return {
    x,
    y,
    width: Math.max(1, Math.min(canvasWidth - x, bounds.maxX - bounds.minX + (padding * 2))),
    height: Math.max(1, Math.min(canvasHeight - y, bounds.maxY - bounds.minY + (padding * 2))),
  };
}
