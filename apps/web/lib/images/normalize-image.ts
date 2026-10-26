import { imageContentType } from "@/lib/images/content-type.mjs";

/**
 * The file a camera handed over, with the type its bytes actually have. Some Android cameras
 * label a JPEG "image/jpg" or give it no type at all; refusing those meant a photo taken on
 * site was never saved. Returns null for anything that is not a JPEG, PNG or WebP image.
 */
export async function normalizeImageFile(file: File): Promise<File | null> {
  const detected = imageContentType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!detected) return null;
  if (detected === file.type) return file;
  return new File([file], file.name, { type: detected, lastModified: file.lastModified });
}
