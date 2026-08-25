// @ts-check

export const fieldPhotoMimeTypes = Object.freeze(["image/jpeg", "image/png", "image/webp"]);

/**
 * The file endings a 360° camera writes. Insta360 stores a still as `.insp`, which is an
 * ordinary JPEG under another name; the browser hands such a file over without a type, so the
 * app has to name the type itself instead of turning the picture away.
 */
export const panoramaFileExtensions = Object.freeze([".jpg", ".jpeg", ".png", ".webp", ".insp"]);

/** @type {Record<string, string>} */
const panoramaExtensionMimeTypes = Object.freeze({
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".insp": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
});

/**
 * The type and name a 360° file has to travel under. A camera that writes its own extension or
 * no type at all still produces a normal JPEG, so it is renamed rather than refused; a file the
 * viewer genuinely cannot read comes back with an empty type so the screen can say so.
 *
 * @param {string} fileName
 * @param {string} [mimeType]
 */
export function panoramaUploadSource(fileName, mimeType = "") {
  const name = (fileName ?? "").trim();
  const extension = (name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
  const declared = (mimeType ?? "").trim().toLowerCase();
  const byExtension = panoramaExtensionMimeTypes[extension] ?? "";
  if (fieldPhotoMimeTypes.includes(declared) && extension !== ".insp") {
    return { mimeType: declared, fileName: name, renamed: false };
  }
  if (!byExtension) return { mimeType: "", fileName: name, renamed: false };
  // `.insp` is a JPEG; keeping the camera name would leave the file unopenable everywhere else.
  const renamed = extension === ".insp";
  return {
    mimeType: byExtension,
    fileName: renamed ? `${name.slice(0, -extension.length)}.jpg` : name,
    renamed,
  };
}

/**
 * What kind of 360° image this is, and what is worth saying about it — never whether it is
 * allowed. Every readable image can be uploaded and viewed: a full equirectangular export
 * shows a whole sphere, a wider or narrower export shows the part of the sphere it covers, and
 * a small export simply shows less detail. The notice is the sentence the upload screen puts
 * under the file, so a supervisor knows what he will get before he saves it.
 *
 * @param {number} width
 * @param {number} height
 */
export function describePanoramaImage(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { valid: false, reason: "unreadable", projection: "unknown", notice: null };
  }
  const ratio = width / height;
  const projection = Math.abs(ratio - 2) <= 0.04
    ? "equirectangular"
    : ratio > 2
      ? "partial-vertical"
      : "partial-horizontal";
  const notice = projection !== "equirectangular"
    ? projection
    : width < 3840
      ? "resolution"
      : null;
  return { valid: true, reason: null, projection, notice };
}

/**
 * Whether a 2:1 image is in fact the raw output of a two-lens camera — the two round pictures
 * side by side that an Insta360 writes into a `.insp` — instead of a stitched sphere. Such a
 * file has to be projected differently, and the picture itself is the only thing that says so:
 * both lenses leave the corners of their half black while their middles carry the scene.
 *
 * The judgement is deliberately strict. A stitched export that is merely dark stays stitched;
 * only an image whose eight half-corners are all but black while both middles are clearly lit
 * is treated as a two-lens original.
 *
 * @param {{ ratio: number, corners: number[], centers: number[] }} samples luminance 0–255
 */
export function looksLikeDualFisheye(samples) {
  const { ratio, corners, centers } = samples;
  if (!Number.isFinite(ratio) || Math.abs(ratio - 2) > 0.04) return false;
  if (!Array.isArray(corners) || corners.length < 8 || !Array.isArray(centers) || centers.length < 2) return false;
  if (corners.some((value) => !Number.isFinite(value)) || centers.some((value) => !Number.isFinite(value))) return false;
  const brightestCorner = Math.max(...corners);
  const dimmestCenter = Math.min(...centers);
  return brightestCorner <= 26 && dimmestCenter - brightestCorner >= 45;
}

/**
 * A 360° export that is larger than the project limit is made to fit instead of being refused:
 * the whole picture is kept and only its scale changes, so the projection — and every marker
 * placed in it — stays exactly where it was. An image that already fits is never touched.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} sizeBytes
 * @param {number} maxBytes
 * @param {number} [maxEdge]
 */
export function panoramaFitSize(width, height, sizeBytes, maxBytes, maxEdge = 8192) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0, scale: 1, resize: false };
  }
  const fits = !Number.isFinite(maxBytes) || maxBytes <= 0 || sizeBytes <= maxBytes;
  // An export that already fits is left at its own size, however large that is: the detail a
  // supervisor zooms into is the reason a 360° image is uploaded at all.
  if (fits) return { width: Math.round(width), height: Math.round(height), scale: 1, resize: false };
  // File size follows the pixel count, so the edge is scaled by the square root of the
  // reduction that is needed, with a margin for the header and a rounder re-encode. The edge
  // cap keeps the redraw within what a phone canvas can hold.
  const scale = Math.min(1, width > maxEdge ? maxEdge / width : 1, Math.sqrt((maxBytes * 0.85) / sizeBytes));
  if (scale >= 1) return { width: Math.round(width), height: Math.round(height), scale: 1, resize: false };
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
    resize: true,
  };
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

export const compassPoints = Object.freeze(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);

/**
 * The compass reading of a photo, as one of the eight points a supervisor uses on site.
 * The camera gives degrees; the report says "facing NE". Anything unreadable stays empty
 * so the field can still be filled by hand.
 *
 * @param {number | null | undefined} degrees
 */
export function compassPointFromDegrees(degrees) {
  if (typeof degrees !== "number" || !Number.isFinite(degrees)) return "";
  const normalized = ((degrees % 360) + 360) % 360;
  return compassPoints[Math.round(normalized / 45) % 8];
}

/**
 * The client asked for one text box per photo instead of a title and a description. The
 * report still needs a name per file, so the first sentence of what the supervisor wrote
 * becomes that name, and the fallback keeps a photo without words findable by its number.
 *
 * @param {string} description
 * @param {string} [fallback]
 */
export function photoTitleFromDescription(description, fallback = "") {
  const written = (description ?? "").trim();
  if (!written) return fallback.trim();
  const firstLine = written.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  const title = firstSentence.trim().replace(/[.,;:]+$/, "");
  if (title.length <= 90) return title || fallback.trim();
  // A long opening sentence is cut on a word, so the file name never ends mid-word.
  const cut = title.slice(0, 90);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
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
 * @typedef {object} PhotoMarkupNoteInput
 * @property {string} [label]
 * @property {string} [description]
 * @property {string} [severity]
 * @property {string} [buildingName]
 * @property {string} [locationLabel]
 * @property {string} [element]
 * @property {string} [workPackage]
 * @property {string} [responsiblePartyName]
 */

/**
 * Where a marking belongs, in one readable line: the building, the room, the element and the
 * work package it was found in. Empty parts are left out instead of printed as a dash.
 *
 * @param {PhotoMarkupNoteInput} note
 */
export function photoMarkupPlacement(note) {
  return [note.buildingName, note.locationLabel, note.element, note.workPackage]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" → ");
}

/**
 * The full written record of what was marked on a photo. One block per marker: the number as
 * it is drawn on the picture, the title, how serious it is, where it belongs, who is
 * responsible, and the sentences the supervisor spoke or typed. This is the text that ends up
 * in the record itself, so the file and the register keep saying the same thing.
 *
 * @param {PhotoMarkupNoteInput[]} notes
 * @param {{ severityLabels?: Record<string, string>, responsibleLabel?: string }} [labels]
 */
export function photoMarkupReport(notes, labels = {}) {
  const severityLabels = labels.severityLabels ?? {};
  return notes
    .map((note, index) => ({ note, number: index + 1 }))
    .filter((entry) => (entry.note.label ?? "").trim() || (entry.note.description ?? "").trim())
    .map((entry) => {
      const heading = [
        `${entry.number}. ${(entry.note.label ?? "").trim() || "—"}`,
        severityLabels[entry.note.severity ?? ""] ?? "",
        photoMarkupPlacement(entry.note),
        (entry.note.responsiblePartyName ?? "").trim()
          ? `${labels.responsibleLabel ?? "Responsible"}: ${(entry.note.responsiblePartyName ?? "").trim()}`
          : "",
      ].filter((part) => part.length > 0).join(" · ");
      const description = (entry.note.description ?? "").trim();
      return description ? `${heading}\n${description}` : heading;
    })
    .join("\n");
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
