"use client";

import {
  idbClear,
  idbDelete,
  idbGet,
  idbGetAllUnscoped,
  idbPut,
  setActiveOfflineUser,
  userOwnedStores,
} from "@/lib/offline/idb";

/**
 * Who may read what this device holds.
 *
 * Two kinds of data live on a field device:
 *
 * - The readable project copy (the "snapshots" and "files" stores, plus unsent form drafts in
 *   localStorage). It can always be downloaded again, so it is thrown away whenever the
 *   device changes hands: on every sign-out and whenever a different account signs in.
 * - Unsent work (the "uploads", "records" and "drawingPins" stores). It exists nowhere else,
 *   so it is never silently deleted. Each item carries the account that wrote it; the IndexedDB
 *   layer only shows and sends the active account's items (see idb.ts).
 *
 * This is a browser-storage boundary, not encryption: IndexedDB is protected by the device's
 * own lock screen and disk encryption. docs/operations/offline-security-model.md describes the
 * device requirements that follow from that.
 */

const deviceOwnerId = "device-owner";
const offlineSummaryId = "offline-sync-summary";
const recordDraftPrefix = "codeco:";
const recordDraftMarker = "-draft:";

type DeviceOwner = { id: string; userId: string; since: string };
type Owned = { id: string; ownerUserId?: string | null };

function removeRecordDrafts() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if ((key?.startsWith(recordDraftPrefix) && key.includes(recordDraftMarker)) || key?.startsWith("codeco-permissions:")) keys.push(key as string);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Private browsing may block localStorage; then there is nothing stored to remove either.
  }
}

/**
 * Removes everything readable that can be downloaded again. Unsent work stays.
 * Returns once the stores are empty, so callers can rely on it before showing a message.
 */
export async function purgeReadableOfflineData() {
  await Promise.all([idbClear("snapshots"), idbClear("files")]);
  await idbPut("settings", { id: offlineSummaryId, summary: null });
  removeRecordDrafts();
}

/**
 * Called with the signed-in account before any cached data is shown.
 *
 * A device that predates account isolation has no recorded owner: its unsent work is
 * attributed to the first account that signs in, which is the only account that could have
 * written it on a single-user device. Its readable copy is kept, so a supervisor who opens the
 * updated app offline in the field still has the project.
 */
export async function prepareOfflineStorageForUser(userId: string) {
  const owner = await idbGet<DeviceOwner>("settings", deviceOwnerId).catch(() => undefined);
  if (owner && owner.userId !== userId) {
    await purgeReadableOfflineData();
  }
  if (!owner) {
    for (const store of [...userOwnedStores, "files"] as const) {
      const items = await idbGetAllUnscoped<Owned>(store).catch(() => [] as Owned[]);
      for (const item of items) {
        if (!item.ownerUserId) await idbPut(store, { ...item, ownerUserId: userId });
      }
    }
  }
  if (!owner || owner.userId !== userId) {
    await idbPut<DeviceOwner>("settings", { id: deviceOwnerId, userId, since: new Date().toISOString() });
  }
  setActiveOfflineUser(userId);
}

/** How much of this account's work is still only on this device. */
export async function unsentWorkCount(userId: string) {
  let count = 0;
  for (const store of userOwnedStores) {
    const items = await idbGetAllUnscoped<Owned>(store).catch(() => [] as Owned[]);
    count += items.filter((item) => item.ownerUserId === userId).length;
  }
  return count;
}

/**
 * Removes the readable copy and stops showing this account's unsent work. The unsent items
 * themselves stay on the device and are sent the next time the same account signs in.
 */
export async function releaseOfflineStorageOnSignOut() {
  try {
    await purgeReadableOfflineData();
  } finally {
    setActiveOfflineUser(null);
  }
}

/** Permanently removes this account's unsent work. Only after an explicit confirmation. */
export async function discardUnsentWork(userId: string) {
  for (const store of userOwnedStores) {
    const items = await idbGetAllUnscoped<Owned>(store).catch(() => [] as Owned[]);
    for (const item of items) {
      if (item.ownerUserId === userId) await idbDelete(store, item.id);
    }
  }
}
