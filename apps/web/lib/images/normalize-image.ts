import { imageContentType, isHeifImage } from "@/lib/images/content-type.mjs";

/**
 * The file a camera handed over, with the type its bytes actually have. Some Android cameras
 * label a JPEG "image/jpg" or give it no type at all; refusing those meant a photo taken on
 * site was never saved. A HEIC or AVIF photo (an iPhone or iPad photo copied to a computer) is
 * turned into a JPEG when this browser can open it. Returns null for anything else.
 */
export async function normalizeImageFile(file: File): Promise<File | null> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detected = imageContentType(head);
  if (detected) {
    if (detected === file.type) return file;
    return new File([file], file.name, { type: detected, lastModified: file.lastModified });
  }
  if (isHeifImage(head)) return convertToJpeg(file);
  return null;
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
    const head = new Uint8Array(await file.slice(0, 32).arrayBuffer().catch(() => new ArrayBuffer(0)));
    const normalized = await normalizeImageFile(file).catch(() => null);
    if (!normalized) {
      refused.push({ name: file.name || "photo", reason: isHeifImage(head) || /\.(heic|heif|avif)$/i.test(file.name) ? "heic" : "unsupported" });
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
      `${name}: HEIC photo this browser cannot open. Not added. Choose a JPEG, or set the camera to "Most compatible".`,
      `${name}: HEIC-foto die deze browser niet kan openen. Niet toegevoegd. Kies een JPEG, of zet de camera op "Meest compatibel".`,
    )
    : reason === "too-large"
      ? text(`${name}: larger than ${maxMegabytes ?? ""} MB. Not added.`, `${name}: groter dan ${maxMegabytes ?? ""} MB. Niet toegevoegd.`)
      : text(`${name}: not a JPEG, PNG or WebP photo. Not added.`, `${name}: geen JPEG-, PNG- of WebP-foto. Niet toegevoegd.`)).join(" ");
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
