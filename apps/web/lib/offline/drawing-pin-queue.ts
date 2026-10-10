"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { activeOfflineUser, idbDelete, idbGetAll, idbPut } from "@/lib/offline/idb";
import { isConnectionFailure } from "@/lib/offline/record-queue";
import {
  createDrawingPin,
  moveDrawingPin,
  voidDrawingPin,
  type DrawingPin,
} from "@/lib/supabase/operations";

type CreateInput = Parameters<typeof createDrawingPin>[1];
type MoveInput = Parameters<typeof moveDrawingPin>[1];
type VoidInput = Parameters<typeof voidDrawingPin>[1];

export type DrawingPinMutation =
  | { id: string; projectId: string; kind: "create"; input: CreateInput; createdAt: string; lastError: string | null }
  | { id: string; projectId: string; kind: "move"; input: MoveInput; createdAt: string; lastError: string | null }
  | { id: string; projectId: string; kind: "void"; input: VoidInput; createdAt: string; lastError: string | null };

export async function listDrawingPinMutations(projectId?: string) {
  const mutations = await idbGetAll<DrawingPinMutation>("drawingPins");
  return mutations
    .filter((mutation) => !projectId || mutation.projectId === projectId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

async function queueMutation(mutation: Omit<DrawingPinMutation, "createdAt" | "lastError">, ownerUserId: string) {
  if (activeOfflineUser() !== ownerUserId) throw new Error("The signed-in account changed before saving this pin.");
  const queued = { ...mutation, createdAt: new Date().toISOString(), lastError: null } as DrawingPinMutation;
  await idbPut("drawingPins", { ...queued, ownerUserId });
  return queued;
}

async function sendMutation(client: SupabaseClient, mutation: DrawingPinMutation) {
  if (mutation.kind === "create") return createDrawingPin(client, {
    ...mutation.input,
    idempotencyKey: mutation.input.idempotencyKey ?? `offline-drawing-pin:${mutation.id}`,
  });
  if (mutation.kind === "move") return moveDrawingPin(client, mutation.input);
  return voidDrawingPin(client, mutation.input);
}

export async function saveDrawingPinOnlineOrQueue(
  client: SupabaseClient,
  mutation: Omit<DrawingPinMutation, "createdAt" | "lastError">,
): Promise<{ queued: boolean; pin: DrawingPin | null }> {
  const owner = activeOfflineUser();
  if (!owner) throw new Error("Sign in before saving this pin.");
  const queue = async () => {
    await queueMutation(mutation, owner);
    return { queued: true, pin: null };
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  try {
    const pin = await sendMutation(client, mutation as DrawingPinMutation);
    if (activeOfflineUser() !== owner) throw new Error("The signed-in account changed while saving this pin.");
    return { queued: false, pin };
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    return queue();
  }
}

export type DrawingPinSyncResult = { synced: number; failed: number; paused: boolean };
const locks = new Map<string, Promise<DrawingPinSyncResult>>();

async function syncUnlocked(client: SupabaseClient, projectId: string): Promise<DrawingPinSyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0, paused: true };
  const owner = activeOfflineUser();
  if (!owner) return { synced: 0, failed: 0, paused: true };
  const mutations = await listDrawingPinMutations(projectId);
  let synced = 0;
  let failed = 0;
  for (const mutation of mutations) {
    if (activeOfflineUser() !== owner) return { synced, failed, paused: true };
    try {
      await sendMutation(client, mutation);
      if (activeOfflineUser() !== owner) return { synced, failed, paused: true };
      await idbDelete("drawingPins", mutation.id);
      synced += 1;
    } catch (error) {
      if (activeOfflineUser() !== owner) return { synced, failed, paused: true };
      failed += 1;
      await idbPut("drawingPins", {
        ...mutation,
        lastError: error instanceof Error ? error.message : "Drawing pin synchronization failed.",
      });
      if (isConnectionFailure(error)) return { synced, failed, paused: true };
      // Keep dependent moves/voids behind the failed create instead of reordering them.
      break;
    }
  }
  return { synced, failed, paused: false };
}

export function syncDrawingPinMutations(client: SupabaseClient, projectId: string) {
  const lockKey = `${activeOfflineUser() ?? "signed-out"}:${projectId}`;
  const running = locks.get(lockKey);
  if (running) return running;
  const pending = syncUnlocked(client, projectId);
  locks.set(lockKey, pending);
  return pending.finally(() => {
    if (locks.get(lockKey) === pending) locks.delete(lockKey);
  });
}
