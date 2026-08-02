"use client";

import { idbGet, idbPut } from "@/lib/offline/idb";

type CachedQuery<T> = { id: string; savedAt: string; data: T };

function cacheId(key: string) {
  return `query:${key}`;
}

/**
 * The answer to one project query, kept exactly as the database gave it. The workspace, the
 * day report and the project snapshot already had their own caches; this is the same idea for
 * the smaller reads that a screen needs to be usable — project settings, the location tree,
 * the drawing list, the notifications and the member list. Without them the app opened
 * offline with empty pickers and default settings, which looks like data loss.
 */
export async function cacheQueryResult<T>(key: string, data: T) {
  await idbPut<CachedQuery<T>>("snapshots", { id: cacheId(key), savedAt: new Date().toISOString(), data });
}

export async function readCachedQueryResult<T>(key: string) {
  return (await idbGet<CachedQuery<T>>("snapshots", cacheId(key))) ?? null;
}

/**
 * Load from the database, keep a copy, and fall back to that copy when the request fails.
 * A failure is almost always "no connection"; a real error still surfaces when nothing was
 * ever cached, so a broken query is never silently hidden behind stale data.
 */
export async function loadWithOfflineCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  try {
    const data = await loader();
    await cacheQueryResult(key, data).catch(() => undefined);
    return data;
  } catch (error) {
    const cached = await readCachedQueryResult<T>(key).catch(() => null);
    if (cached) return cached.data;
    throw error;
  }
}
