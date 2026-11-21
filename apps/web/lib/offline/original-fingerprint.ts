/** F05: the fingerprint of a photo as received, before any data-saver reduction. */
export type OriginalFingerprint = { sha256: string; size: number; name: string; type: string; lastModified: string | null };

/** The fingerprint of a file as received from the camera or the file chooser (F05). */
export async function fingerprintOriginal(file: File): Promise<OriginalFingerprint | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return { sha256, size: file.size, name: file.name, type: file.type || "", lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null };
  } catch {
    return null;
  }
}

/** What the stored photo says about its original (kept inside the photo's spec as `_original`). */
export function originalRecord(upload: { original?: OriginalFingerprint | null; compressed: boolean; sourcePhoto?: { id: string } }) {
  if (upload.original && upload.sourcePhoto) return { ...upload.original, stored: "original_and_markup", file_id: upload.sourcePhoto.id };
  return upload.original ? { ...upload.original, stored: upload.compressed ? "reduced_copy" : "original" } : null;
}

