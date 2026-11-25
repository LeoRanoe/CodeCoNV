import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProjectFileBlob } from "@/lib/storage/gateway";

/**
 * Photos in a period report (Word 11.1, "Photos: none / thumbnails / large"). The report prints a photo as a small
 * JPEG made in the browser, so a hundred camera originals never sit in memory at once and the file stays a size
 * that can be e-mailed. The limit keeps one report from growing without bound; the report says how many were left out.
 */
export type ReportPhotoMode = "none" | "thumbnails" | "large";
export type ReportPhoto = { dataUrl: string; width: number; height: number };
export type ReportPhotos = { photos: Record<string, ReportPhoto>; omitted: number };

/** Longest edge in pixels. */
export const reportPhotoEdge: Record<Exclude<ReportPhotoMode, "none">, number> = { thumbnails: 320, large: 1000 };
export const maxReportPhotos = 60;
const concurrency = 3;

async function scaled(blob: Blob, edge: number): Promise<ReportPhoto> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", mode(edge));
    canvas.width = 0;
    canvas.height = 0;
    return { dataUrl, width, height };
  } finally {
    bitmap.close();
  }
}

const mode = (edge: number) => (edge > reportPhotoEdge.thumbnails ? 0.82 : 0.75);

/** The captures of a report that have a stored image, newest first as the snapshot lists them. */
export function reportPhotoCaptures(captures: Array<Record<string, unknown>>) {
  return captures.filter((capture) => typeof capture.file_id === "string" && capture.file_id && capture.capture_type !== "panorama_360");
}

export async function loadReportPhotos(client: SupabaseClient, captures: Array<Record<string, unknown>>, photoMode: ReportPhotoMode): Promise<ReportPhotos> {
  if (photoMode === "none") return { photos: {}, omitted: 0 };
  const candidates = reportPhotoCaptures(captures);
  const wanted = candidates.slice(0, maxReportPhotos);
  const photos: Record<string, ReportPhoto> = {};
  let next = 0;
  const worker = async () => {
    while (next < wanted.length) {
      const capture = wanted[next++];
      try {
        const blob = await loadProjectFileBlob(client, String(capture.file_id));
        if (!blob.type.startsWith("image/")) continue;
        photos[String(capture.id)] = await scaled(blob, reportPhotoEdge[photoMode]);
      } catch {
        // A photo that cannot be read is left out; its row is still printed.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, wanted.length) }, worker));
  return { photos, omitted: candidates.length - Object.keys(photos).length };
}

/** The bytes of a JPEG data URL, for the Word document. */
export function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
