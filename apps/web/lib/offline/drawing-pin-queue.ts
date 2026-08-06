"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { idbDelete, idbGetAll, idbPut } from "@/lib/offline/idb";
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
  const mutations = await idbGetAll<DrawingPinMutation>("drawingPins").catch(() => [] as DrawingPinMutation[]);
  return mutations
    .filter((mutation) => !projectId || mutation.projectId === projectId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

async function queueMutation(mutation: Omit<DrawingPinMutation, "createdAt" | "lastError">) {
  const queued = { ...mutation, createdAt: new Date().toISOString(), lastError: null } as DrawingPinMutation;
  await idbPut("drawingPins", queued);
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
  const queue = async () => {
    await queueMutation(mutation);
    return { queued: true, pin: null };
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  try {
    return { queued: false, pin: await sendMutation(client, mutation as DrawingPinMutation) };
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    return queue();
  }
}

export type DrawingPinSyncResult = { synced: number; failed: number; paused: boolean };
const locks = new Map<string, Promise<DrawingPinSyncResult>>();

async function syncUnlocked(client: SupabaseClient, projectId: string): Promise<DrawingPinSyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0, paused: true };
  const mutations = await listDrawingPinMutations(projectId);
  let synced = 0;
  let failed = 0;
  for (const mutation of mutations) {
    try {
      await sendMutation(client, mutation);
      await idbDelete("drawingPins", mutation.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      await idbPut("drawingPins", {
        ...mutation,
        lastError: error instanceof Error ? error.message : "Drawing pin synchronization failed.",
      });
      if (isConnectionFailure(error)) break;
    }
  }
  return { synced, failed, paused: false };
}

export function syncDrawingPinMutations(client: SupabaseClient, projectId: string) {
  const running = locks.get(projectId);
  if (running) return running;
  const pending = syncUnlocked(client, projectId);
  locks.set(projectId, pending);
  return pending.finally(() => {
    if (locks.get(projectId) === pending) locks.delete(projectId);
  });
}
