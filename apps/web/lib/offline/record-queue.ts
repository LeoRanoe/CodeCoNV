"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { idbDelete, idbGet, idbGetAll, idbPut } from "@/lib/offline/idb";
import {
  isConnectionFailure as connectionFailure,
  isPendingRecordId as pendingRecordId,
  newPendingRecordId as newLocalId,
} from "@/lib/offline/record-rules.mjs";
import { createProjectAction } from "@/lib/supabase/data";
import { createFinding, createHseEvent, createRegisterEntry } from "@/lib/supabase/operations";

/**
 * A field registration written without a connection.
 *
 * Photos already waited on the device; the registration they belong to did not, so a
 * supervisor on a site without coverage could photograph a defect but not report it. A
 * queued record is stored here with everything the create call needs, shows up in the lists
 * marked as waiting, and is sent by itself the moment there is a connection.
 *
 * Only *new* registrations are queued. Changing a record that already exists centrally —
 * a status transition, a verification, a signature, a decision on a submission — is
 * deliberately not queued: offline this device cannot know the current state of that
 * record, and replaying the change blind would overwrite whatever somebody else did.
 */
export type OfflineRecordKind = "finding" | "hse" | "register" | "action";

export type OfflineRecord = {
  /** Also the id the record carries in the lists until it is central. */
  id: string;
  projectId: string;
  kind: OfflineRecordKind;
  /** Exactly the input the create function would have been called with online. */
  input: Record<string, unknown>;
  /** What the row says while it waits. */
  preview: {
    title: string;
    description: string;
    buildingId: string | null;
    locationNodeId: string | null;
    severity: string;
    priority: string;
    dueAt: string | null;
    recordType: string;
  };
  createdAt: string;
  lastError: string | null;
};

const idMapId = "offline-record-ids";

export const isPendingRecordId = pendingRecordId;

export function newPendingRecordId() {
  return newLocalId(crypto.randomUUID());
}

/**
 * Where a queued record ended up once it was sent. A photo that was attached to it still
 * carries the local id, so the upload queue looks the real one up here.
 */
async function readRecordIdMap() {
  const stored = await idbGet<{ id: string; map: Record<string, string> }>("settings", idMapId).catch(() => null);
  return stored?.map ?? {};
}

async function rememberRecordId(localId: string, realId: string) {
  const map = await readRecordIdMap();
  map[localId] = realId;
  await idbPut("settings", { id: idMapId, map });
}

export async function resolvePendingRecordId(localId: string) {
  if (!isPendingRecordId(localId)) return localId;
  const map = await readRecordIdMap();
  return map[localId] ?? null;
}

export async function queueOfflineRecord(record: Omit<OfflineRecord, "createdAt" | "lastError">) {
  const queued: OfflineRecord = { ...record, createdAt: new Date().toISOString(), lastError: null };
  await idbPut("records", queued);
  return queued;
}

export async function listOfflineRecords(projectId?: string) {
  const records = await idbGetAll<OfflineRecord>("records").catch(() => [] as OfflineRecord[]);
  return records
    .filter((record) => !projectId || record.projectId === projectId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function removeOfflineRecord(id: string) {
  await idbDelete("records", id);
}

/** See `record-rules.mjs`: only a connection failure may be queued. */
export function isConnectionFailure(error: unknown) {
  return connectionFailure(error, typeof navigator === "undefined" || navigator.onLine);
}

/** The create call behind each kind, with an idempotency key that survives a retry. */
async function sendOfflineRecord(client: SupabaseClient, record: OfflineRecord) {
  const idempotencyKey = `offline-${record.kind}:${record.id}`;
  if (record.kind === "finding") {
    const created = await createFinding(client, { ...(record.input as Parameters<typeof createFinding>[1]), idempotencyKey });
    return created.id;
  }
  if (record.kind === "hse") {
    const created = await createHseEvent(client, { ...(record.input as Parameters<typeof createHseEvent>[1]), idempotencyKey });
    return created.id;
  }
  if (record.kind === "register") {
    const created = await createRegisterEntry(client, { ...(record.input as Parameters<typeof createRegisterEntry>[1]), idempotencyKey });
    return created.id;
  }
  const created = await createProjectAction(client, { ...(record.input as Parameters<typeof createProjectAction>[1]), idempotencyKey });
  return created.id;
}

export type OfflineRecordSyncResult = { synced: number; failed: number; paused: boolean };

const projectLocks = new Map<string, Promise<OfflineRecordSyncResult>>();

async function syncUnlocked(client: SupabaseClient, projectId: string): Promise<OfflineRecordSyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0, paused: true };
  const records = await listOfflineRecords(projectId);
  let synced = 0;
  let failed = 0;
  for (const record of records) {
    try {
      const realId = await sendOfflineRecord(client, record);
      // The photos that were attached to this record still carry its local id.
      await rememberRecordId(record.id, realId);
      await removeOfflineRecord(record.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      await idbPut("records", {
        ...record,
        lastError: error instanceof Error ? error.message : "Synchronisatie mislukt.",
      });
      // Without a connection there is no point in trying the rest; with one, the next
      // record may well be fine, so only a connection failure stops the run.
      if (isConnectionFailure(error)) break;
    }
  }
  return { synced, failed, paused: false };
}

/** One run per project at a time, so a reconnect and a manual retry cannot both send. */
export function syncOfflineRecords(client: SupabaseClient, projectId: string) {
  const running = projectLocks.get(projectId);
  if (running) return running;
  const pending = syncUnlocked(client, projectId);
  projectLocks.set(projectId, pending);
  return pending.finally(() => {
    if (projectLocks.get(projectId) === pending) projectLocks.delete(projectId);
  });
}

/**
 * Saves centrally when that is possible and on the device when it is not. The caller gets
 * the id either way, so a photo can be attached to the registration in both cases.
 */
export async function saveRecordOnlineOrQueue<T extends { id: string }>(
  options: {
    kind: OfflineRecordKind;
    projectId: string;
    input: Record<string, unknown>;
    preview: OfflineRecord["preview"];
    /** The call that would have been made with a connection. */
    send: () => Promise<T>;
  },
): Promise<{ id: string; queued: boolean; record: T | null }> {
  const localId = newPendingRecordId();
  const queue = async () => {
    await queueOfflineRecord({ id: localId, projectId: options.projectId, kind: options.kind, input: options.input, preview: options.preview });
    return { id: localId, queued: true, record: null };
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  try {
    const created = await options.send();
    return { id: created.id, queued: false, record: created };
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    return queue();
  }
}
