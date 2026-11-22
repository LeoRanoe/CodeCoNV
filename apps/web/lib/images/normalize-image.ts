import { heifContentType, imageContentType } from "@/lib/images/content-type.mjs";

export const photoAccept = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.avif";

/**
 * The file a camera handed over, with the type its bytes actually have. Some Android cameras
 * label a JPEG "image/jpg" or give it no type at all; refusing those meant a photo taken on
 * site was never saved. A HEIC or AVIF photo (an iPhone or iPad photo copied to a computer) is
 * turned into a JPEG when this browser can open it. Returns null for anything else.
 */
export async function normalizeImageFile(file: File): Promise<File | null> {
  const head = new Uint8Array(await file.slice(0, 256).arrayBuffer());
  const detected = imageContentType(head);
  if (detected && detected !== "image/gif") {
    if (detected === file.type) return file;
    return new File([file], file.name, { type: detected, lastModified: file.lastModified });
  }
  const originalType = detected || heifContentType(head);
  if (originalType) {
    const type = originalType === "image/heic" && (file.type === "image/heif" || /\.heif$/i.test(file.name)) ? "image/heif" : originalType;
    const source = file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
    const converted = await convertToJpeg(source) ?? (type === "image/heic" || type === "image/heif" ? await convertHeicToJpeg(source) : null);
    if (converted) untouchedSources.set(converted, source);
    return converted;
  }
  return null;
}

/**
 * Decision #3 (Word 5.2 "Preserve original evidence files", Photos workbook row 8 "retain original
 * file"): a GIF/HEIC/HEIF/AVIF photo is shown and marked up as a JPEG, and its untouched bytes are stored
 * next to it as the original. Keyed by the JPEG this module made, so nothing else can claim it.
 */
const untouchedSources = new WeakMap<File, File>();
export function untouchedSourceOf(file: File): File | undefined {
  return untouchedSources.get(file);
}

async function convertHeicToJpeg(file: File) {
  if (typeof document === "undefined") return null;
  const { heicTo } = await import("heic-to/csp");
  const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
  return new File([jpeg], `${(file.name || "photo").replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
}

export type PhotoRefusal = { name: string; reason: "heic" | "unsupported" | "too-large" };

/**
 * Every photo the camera or the file chooser handed over, judged one by one. The photos that
 * can be stored come back ready to stage; every other photo is named with the reason, so a
 * picture is never dropped without a word.
 */
export async function prepareCameraPhotos(files: FileList | File[] | null | undefined, maxBytes = Infinity) {
  const photos: File[] = [];
  const refused: PhotoRefusal[] = [];
  for (const file of Array.from(files ?? [])) {
    if (file.size > maxBytes) {
      refused.push({ name: file.name || "photo", reason: "too-large" });
      continue;
    }
    const normalized = await normalizeImageFile(file).catch(() => null);
    if (!normalized) {
      refused.push({ name: file.name || "photo", reason: /\.(heic|heif|avif)$/i.test(file.name) || /^image\/(heic|heif|avif)$/.test(file.type) ? "heic" : "unsupported" });
      continue;
    }
    if (normalized.size > maxBytes) {
      refused.push({ name: file.name || "photo", reason: "too-large" });
      continue;
    }
    photos.push(normalized);
  }
  return { photos, refused };
}

/** One line per refused photo: what it is, and that it was not added. */
export function photoRefusalMessage(
  refused: PhotoRefusal[],
  text: (english: string, dutch: string) => string,
  maxMegabytes?: number,
) {
  return refused.map(({ name, reason }) => reason === "heic"
    ? text(
      `${name}: this HEIC, HEIF or AVIF photo could not be decoded. Try reopening the original or choosing a JPEG.`,
      `${name}: deze HEIC-, HEIF- of AVIF-foto kon niet worden geopend. Probeer het origineel opnieuw of kies een JPEG.`,
    )
    : reason === "too-large"
      ? text(`${name}: larger than ${maxMegabytes ?? ""} MB. Not added.`, `${name}: groter dan ${maxMegabytes ?? ""} MB. Niet toegevoegd.`)
      : text(`${name}: choose a JPEG, PNG, WebP, GIF, HEIC, HEIF or AVIF photo.`, `${name}: kies een JPEG-, PNG-, WebP-, GIF-, HEIC-, HEIF- of AVIF-foto.`)).join(" ");
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to an image element; Safari opens HEIC there.
    }
  }
  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (!image.naturalWidth) return null;
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

async function convertToJpeg(file: File): Promise<File | null> {
  if (typeof document === "undefined") return null;
  const decoded = await decode(file);
  if (!decoded) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return null;
    context.drawImage(decoded.source, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return null;
    const name = `${(file.name || "photo").replace(/\.[^.]+$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    decoded.release();
  }
}
