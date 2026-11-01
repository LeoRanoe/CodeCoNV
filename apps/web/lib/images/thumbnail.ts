"use client";

import { useEffect, useState, type RefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProjectFileBlob } from "@/lib/storage/gateway";

/**
 * Small previews for lists of photos.
 *
 * A grid that showed every photo as its full camera original decoded each one at full size: a
 * 12-megapixel photo takes about 48 MB in memory once decoded. Two dozen of those on an iPhone
 * exhaust the tab, and iOS then kills and reloads the page (client, 01-11-2026: "it loads
 * constantly and refreshes when I press something", and the camera did not come back). A
 * preview here is a JPEG of at most `THUMBNAIL_EDGE` pixels, made one or two at a time, and the
 * original is let go as soon as the preview exists.
 */
export const THUMBNAIL_EDGE = 480;
const CONCURRENCY = 2;
const MAX_CACHED = 400;

let running = 0;
const waiting: Array<() => void> = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= CONCURRENCY) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await work();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // Asking for the small size while decoding keeps the full-size bitmap out of memory where
      // the browser supports it; where it ignores the option the bitmap is closed right after use.
      const bitmap = await createImageBitmap(blob, { resizeWidth: THUMBNAIL_EDGE * 2, resizeQuality: "medium" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall through to an <img>.
    }
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ""; URL.revokeObjectURL(url); } };
}

/** A small JPEG object URL for an image blob. The caller does not need to keep the blob. */
export function thumbnailUrlFromBlob(blob: Blob): Promise<string> {
  return slot(async () => {
    const decoded = await decode(blob);
    try {
      const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No canvas");
      context.drawImage(decoded.source, 0, 0, width, height);
      const small = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      canvas.width = 0;
      canvas.height = 0;
      if (!small) throw new Error("No thumbnail");
      return URL.createObjectURL(small);
    } finally {
      decoded.close();
    }
  });
}

// One preview per stored file for the whole session: a grid that re-renders or a photo shown in
// two places does not download and decode the original again.
const stored = new Map<string, Promise<string>>();

export function loadProjectThumbnailUrl(client: SupabaseClient, fileId: string): Promise<string> {
  const known = stored.get(fileId);
  if (known) return known;
  const made = loadProjectFileBlob(client, fileId).then((blob) => {
    if (!blob.type.startsWith("image/")) throw new Error("The selected file is not a supported image.");
    return thumbnailUrlFromBlob(blob);
  });
  made.catch(() => stored.delete(fileId));
  stored.set(fileId, made);
  if (stored.size > MAX_CACHED) {
    const oldest = stored.keys().next().value;
    if (oldest) {
      void stored.get(oldest)?.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
      stored.delete(oldest);
    }
  }
  return made;
}

/** True once the element is on screen or close to it; it stays true afterwards. */
export function useNearViewport(ref: RefObject<Element | null>, margin = "400px") {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no observer: show at once
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: margin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [margin, near, ref]);
  return near;
}
