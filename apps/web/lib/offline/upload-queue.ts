"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { idbDelete, idbGetAll, idbPut } from "@/lib/offline/idb";
import { uploadProjectFile } from "@/lib/storage/gateway";
import { createFinding, createMediaFolder, createVisualCapture, linkFileToRecord } from "@/lib/supabase/operations";

export type QueuedFindingDraft = {
  organizationId: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  responsiblePartyId?: string;
  issueType?: string;
  impactSummary?: string;
  actionSteps?: string;
  escalationRequired?: boolean;
  disposition?: "validated" | "to_be_corrected" | "alternative_solution";
  expectedResolutionDate?: string;
  sourceCatalogSubject?: string;
  locationNodeId?: string;
};

export type OfflineFindingGroup = {
  id: string;
  organizationId: string;
  draft: QueuedFindingDraft;
  findingId?: string;
};

export type OfflineUpload = {
  id: string;
  projectId: string;
  buildingId: string;
  reportId: string | null;
  folderId: string | null;
  folderName?: string | null;
  kind: "photo" | "panorama" | "drawing";
  file: Blob;
  fileName: string;
  mimeType: string;
  title: string;
  locationLabel: string;
  locationNodeId?: string | null;
  description?: string;
  tourName?: string | null;
  tourOrder?: number | null;
  capturedAt: string;
  originalSize: number;
  queuedSize: number;
  compressed: boolean;
  findingGroup?: OfflineFindingGroup | null;
  recordLink?: {
    organizationId: string;
    recordType: "inspection" | "hse";
    recordId: string;
    relationship: "evidence";
  } | null;
  /** @deprecated Retained so previously queued single-photo findings still synchronize. */
  findingDraft?: QueuedFindingDraft | null;
  createdAt: string;
  lastError: string | null;
};

type NetworkInformation = { saveData?: boolean; effectiveType?: string; type?: string };

export function dataSaverEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("codeco-data-saver") !== "false";
}

export function setDataSaverEnabled(enabled: boolean) {
  window.localStorage.setItem("codeco-data-saver", enabled ? "true" : "false");
}

export function connectionIsMetered() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return false;
  return connection.saveData === true
    || ["slow-2g", "2g", "3g"].includes(connection.effectiveType ?? "")
    || connection.type === "cellular";
}

function photoName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140) || "site-photo";
  return `${base}.jpg`;
}

export async function compressFieldPhoto(file: File, enabled = dataSaverEnabled()) {
  if (!enabled || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || typeof createImageBitmap !== "function") {
    return { blob: file as Blob, fileName: file.name, mimeType: file.type || "image/jpeg", compressed: false };
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && file.size <= 900_000) {
      bitmap.close();
      return { blob: file as Blob, fileName: file.name, mimeType: file.type, compressed: false };
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      bitmap.close();
      return { blob: file as Blob, fileName: file.name, mimeType: file.type, compressed: false };
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    bitmap = null;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
    if (!blob || blob.size >= file.size) return { blob: file as Blob, fileName: file.name, mimeType: file.type, compressed: false };
    return { blob, fileName: photoName(file.name), mimeType: "image/jpeg", compressed: true };
  } catch {
    bitmap?.close();
    return { blob: file as Blob, fileName: file.name, mimeType: file.type || "image/jpeg", compressed: false };
  }
}

export async function queueOfflineUpload(input: Omit<OfflineUpload, "id" | "createdAt" | "lastError">) {
  const queued: OfflineUpload = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    lastError: null,
  };
  await idbPut("uploads", queued);
  return queued;
}

export async function listOfflineUploads(projectId?: string) {
  const uploads = await idbGetAll<OfflineUpload>("uploads");
  return uploads
    .filter((upload) => !projectId || upload.projectId === projectId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function removeOfflineUpload(id: string) {
  await idbDelete("uploads", id);
}

function asFile(upload: OfflineUpload) {
  return new File([upload.file], upload.fileName, { type: upload.mimeType, lastModified: new Date(upload.capturedAt).getTime() });
}

export type OfflineSyncResult = { synced: number; failed: number; paused: boolean };
export type OfflineSyncOptions = {
  force?: boolean;
  onItem?: (upload: OfflineUpload, state: "uploading" | "done" | "failed") => void;
};
export type OfflineSyncFailureMessages = {
  paused: string;
  failed: (pendingCount: number) => string;
};
const projectSyncLocks = new Map<string, Promise<OfflineSyncResult>>();

async function syncOfflineUploadsUnlocked(
  client: SupabaseClient,
  projectId: string,
  options: OfflineSyncOptions = {},
): Promise<OfflineSyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0, paused: true };
  if (!options.force && dataSaverEnabled() && connectionIsMetered()) return { synced: 0, failed: 0, paused: true };
  const uploads = await listOfflineUploads(projectId);
  const findingIds = new Map<string, string>();
  const resolvedFolderIds = new Map<string, string>();
  uploads.forEach((upload) => {
    if (upload.findingGroup?.findingId) findingIds.set(upload.findingGroup.id, upload.findingGroup.findingId);
  });
  let synced = 0;
  let failed = 0;
  for (const upload of uploads) {
    options.onItem?.(upload, "uploading");
    try {
      let folderId = upload.folderId;
      if (!folderId && upload.folderName) {
        const folderKey = `${upload.projectId}:${upload.buildingId}:${upload.folderName.toLocaleLowerCase()}`;
        folderId = resolvedFolderIds.get(folderKey) ?? null;
        if (!folderId) {
          const existingFolders = await client
            .from("media_folders")
            .select("id,name")
            .eq("project_id", upload.projectId)
            .eq("building_id", upload.buildingId)
            .eq("status", "active")
            .limit(500);
          if (existingFolders.error) throw existingFolders.error;
          const existing = existingFolders.data?.find((folder) => folder.name.toLocaleLowerCase() === upload.folderName?.toLocaleLowerCase());
          const resolvedFolderId = existing?.id ?? (await createMediaFolder(client, {
            projectId: upload.projectId,
            buildingId: upload.buildingId,
            name: upload.folderName,
            folderType: upload.kind === "drawing" ? "drawings" : "images",
          })).id;
          folderId = resolvedFolderId;
          resolvedFolderIds.set(folderKey, resolvedFolderId);
        }
      }
      const stored = await uploadProjectFile(client, {
        fileId: upload.id,
        projectId: upload.projectId,
        buildingId: upload.buildingId,
        folderId,
        category: upload.kind === "drawing" ? "drawing" : "photo",
        file: asFile(upload),
      });
      if (upload.findingGroup && upload.reportId) {
        let findingId = upload.findingGroup.findingId ?? findingIds.get(upload.findingGroup.id);
        if (!findingId) {
          const draft = upload.findingGroup.draft;
          const finding = await createFinding(client, {
            projectId: upload.projectId,
            buildingId: upload.buildingId,
            reportId: upload.reportId,
            type: draft.type,
            title: draft.title,
            description: draft.description,
            severity: draft.severity,
            responsiblePartyId: draft.responsiblePartyId,
            issueType: draft.issueType,
            impactSummary: draft.impactSummary,
            actionSteps: draft.actionSteps,
            escalationRequired: draft.escalationRequired,
            disposition: draft.disposition,
            expectedResolutionDate: draft.expectedResolutionDate,
            sourceCatalogSubject: draft.sourceCatalogSubject,
            locationNodeId: draft.locationNodeId || upload.locationNodeId || undefined,
            idempotencyKey: `offline-finding:${upload.findingGroup.id}`,
          });
          findingId = finding.id;
          findingIds.set(upload.findingGroup.id, findingId);
          await Promise.all(uploads
            .filter((candidate) => candidate.findingGroup?.id === upload.findingGroup?.id)
            .map((candidate) => idbPut("uploads", {
              ...candidate,
              findingGroup: { ...candidate.findingGroup!, findingId },
            })));
        }
        await linkFileToRecord(client, {
          organizationId: upload.findingGroup.organizationId,
          projectId: upload.projectId,
          fileId: stored.fileId,
          recordType: "finding",
          recordId: findingId,
          relationship: "evidence",
        });
      } else if (upload.findingDraft && upload.reportId) {
        const finding = await createFinding(client, {
          projectId: upload.projectId,
          buildingId: upload.buildingId,
          reportId: upload.reportId,
          type: upload.findingDraft.type,
          title: upload.findingDraft.title,
          description: upload.findingDraft.description,
          severity: upload.findingDraft.severity,
          responsiblePartyId: upload.findingDraft.responsiblePartyId,
          issueType: upload.findingDraft.issueType,
          impactSummary: upload.findingDraft.impactSummary,
          actionSteps: upload.findingDraft.actionSteps,
          escalationRequired: upload.findingDraft.escalationRequired,
          disposition: upload.findingDraft.disposition,
          expectedResolutionDate: upload.findingDraft.expectedResolutionDate,
          sourceCatalogSubject: upload.findingDraft.sourceCatalogSubject,
          locationNodeId: upload.findingDraft.locationNodeId || upload.locationNodeId || undefined,
          idempotencyKey: `offline-finding:${upload.id}`,
        });
        await linkFileToRecord(client, {
          organizationId: upload.findingDraft.organizationId,
          projectId: upload.projectId,
          fileId: stored.fileId,
          recordType: "finding",
          recordId: finding.id,
          relationship: "before",
        });
      } else if (upload.recordLink) {
        await linkFileToRecord(client, {
          organizationId: upload.recordLink.organizationId,
          projectId: upload.projectId,
          fileId: stored.fileId,
          recordType: upload.recordLink.recordType,
          recordId: upload.recordLink.recordId,
          relationship: upload.recordLink.relationship,
        });
      } else if (upload.kind === "photo" || upload.kind === "panorama") {
        const existingCapture = await client
          .from("visual_captures")
          .select("id")
          .eq("file_id", stored.fileId)
          .maybeSingle();
        if (existingCapture.error) throw existingCapture.error;
        if (!existingCapture.data) {
          await createVisualCapture(client, {
            projectId: upload.projectId,
            buildingId: upload.buildingId,
            dayReportId: upload.reportId,
            fileId: stored.fileId,
            locationNodeId: upload.locationNodeId || undefined,
            captureType: upload.kind === "panorama" ? "panorama" : "photo",
            title: upload.title,
            description: upload.description,
            locationLabel: upload.locationLabel,
            tourName: upload.tourName || undefined,
            tourOrder: upload.tourOrder ?? null,
            capturedAt: upload.capturedAt,
          });
        }
      }
      await idbDelete("uploads", upload.id);
      options.onItem?.(upload, "done");
      synced += 1;
    } catch (error) {
      failed += 1;
      const lastError = error instanceof Error ? error.message : "Synchronisatie mislukt.";
      await idbPut("uploads", { ...upload, lastError });
      options.onItem?.({ ...upload, lastError }, "failed");
    }
  }
  return { synced, failed, paused: false };
}

export function syncOfflineUploads(
  client: SupabaseClient,
  projectId: string,
  options: OfflineSyncOptions = {},
): Promise<OfflineSyncResult> {
  const running = projectSyncLocks.get(projectId);
  if (running) {
    return running.then(async (firstResult) => {
      await Promise.resolve();
      if (!(await listOfflineUploads(projectId)).length) return firstResult;
      const followUp = await syncOfflineUploads(client, projectId, options);
      return {
        synced: firstResult.synced + followUp.synced,
        failed: followUp.failed,
        paused: firstResult.paused || followUp.paused,
      };
    });
  }
  const pending = syncOfflineUploadsUnlocked(client, projectId, options);
  projectSyncLocks.set(projectId, pending);
  return pending.finally(() => {
    if (projectSyncLocks.get(projectId) === pending) projectSyncLocks.delete(projectId);
  });
}

/**
 * Interactive uploads must not report central success while any project file is
 * still queued. The queue itself remains the source of truth and is never
 * removed here when connectivity or storage fails.
 */
export async function forceSyncOfflineUploads(
  client: SupabaseClient,
  projectId: string,
  messages: OfflineSyncFailureMessages,
  options: Omit<OfflineSyncOptions, "force"> = {},
) {
  const result = await syncOfflineUploads(client, projectId, { ...options, force: true });
  const pendingCount = (await listOfflineUploads(projectId)).length;
  if (pendingCount === 0) return result;
  if (result.paused) throw new Error(messages.paused);
  throw new Error(messages.failed(Math.max(result.failed, pendingCount)));
}
