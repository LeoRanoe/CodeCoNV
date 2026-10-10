"use client";

import { idbClear, idbGet, idbGetAll, idbKeys, idbPut, activeOfflineUser } from "@/lib/offline/idb";

type CachedFile = {
  id: string;
  ownerUserId: string;
  projectId: string;
  mimeType: string;
  sizeBytes: number;
  savedAt: string;
  blob: Blob;
};

/**
 * Evidence lives behind an authorized route, so the service worker cannot cache it: every
 * request carries a bearer token and the answer is private to one project. The blobs are
 * therefore kept here, in the same private per-origin storage as the rest of the offline
 * copy, and are thrown away together with it.
 */
export async function cacheProjectFile(fileId: string, projectId: string, blob: Blob, ownerUserId = activeOfflineUser()) {
  if (!ownerUserId || ownerUserId !== activeOfflineUser()) throw new Error("The signed-in account changed while loading this file.");
  await idbPut<CachedFile>("files", {
    id: fileId,
    ownerUserId,
    projectId,
    mimeType: blob.type || "application/octet-stream",
    sizeBytes: blob.size,
    savedAt: new Date().toISOString(),
    blob,
  });
}

export async function readCachedProjectFile(fileId: string) {
  const cached = await idbGet<CachedFile>("files", fileId);
  return cached?.blob ?? null;
}

export async function hasCachedProjectFile(fileId: string) {
  const keys = await idbKeys("files").catch(() => [] as string[]);
  return keys.includes(fileId);
}

export async function cachedFileIds() {
  return idbKeys("files").catch(() => [] as string[]);
}

/**
 * How much of the device is being used by the offline copy of the evidence. It reads every
 * stored record, which is affordable because IndexedDB keeps a blob out of line and hands
 * back a handle rather than the bytes. It is called when the offline screen is opened and
 * when a sync finishes, never while scrolling a list.
 */
export async function cachedFileUsage() {
  const files = await idbGetAll<CachedFile>("files").catch(() => [] as CachedFile[]);
  return { count: files.length, bytes: files.reduce((total, file) => total + (file.sizeBytes || 0), 0) };
}

export async function clearCachedProjectFiles() {
  await idbClear("files");
}
