"use client";

import type { OperationSnapshot } from "@/lib/supabase/operations";
import { idbGet, idbPut } from "@/lib/offline/idb";

type CachedProjectSnapshot = {
  id: string;
  projectId: string;
  reportId: string;
  savedAt: string;
  data: OperationSnapshot;
};

function cacheId(projectId: string, reportId?: string | null) {
  return `operations:${projectId}:${reportId ?? "project"}`;
}

export async function cacheProjectSnapshot(projectId: string, reportId: string | null | undefined, data: OperationSnapshot) {
  await idbPut<CachedProjectSnapshot>("snapshots", {
    id: cacheId(projectId, reportId),
    projectId,
    reportId: reportId ?? "",
    savedAt: new Date().toISOString(),
    data: { ...data, _offlineCached: false },
  });
}

export async function getCachedProjectSnapshot(projectId: string, reportId?: string | null) {
  const cached = await idbGet<CachedProjectSnapshot>("snapshots", cacheId(projectId, reportId));
  if (!cached) return null;
  return { ...cached.data, _offlineCached: true, _offlineSavedAt: cached.savedAt } satisfies OperationSnapshot;
}
