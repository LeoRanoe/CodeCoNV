"use client";

import { idbGet, idbPut } from "@/lib/offline/idb";
import type { ProjectDaySnapshot, WorkspaceSnapshot } from "@/lib/supabase/data";

type Cached<T> = { id: string; savedAt: string; data: T };

export async function cacheWorkspace(userId: string, data: WorkspaceSnapshot) {
  await idbPut<Cached<WorkspaceSnapshot>>("snapshots", { id: `workspace:${userId}`, savedAt: new Date().toISOString(), data });
}

export async function getCachedWorkspace(userId: string) {
  const cached = await idbGet<Cached<WorkspaceSnapshot>>("snapshots", `workspace:${userId}`);
  return cached ? { ...cached.data, _offlineCached: true, _offlineSavedAt: cached.savedAt } : null;
}

export async function cacheProjectDay(projectId: string, reportDate: string, data: ProjectDaySnapshot) {
  await idbPut<Cached<ProjectDaySnapshot>>("snapshots", { id: `day:${projectId}:${reportDate}`, savedAt: new Date().toISOString(), data });
}

export async function getCachedProjectDay(projectId: string, reportDate: string) {
  const cached = await idbGet<Cached<ProjectDaySnapshot>>("snapshots", `day:${projectId}:${reportDate}`);
  return cached ? { ...cached.data, _offlineCached: true, _offlineSavedAt: cached.savedAt } : null;
}
