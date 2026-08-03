"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { idbDelete, idbGetAll, idbPut } from "@/lib/offline/idb";
import { isPendingRecordId, resolvePendingRecordId } from "@/lib/offline/record-queue";
import { uploadProjectFile } from "@/lib/storage/gateway";
import { createDrawingPin, createFinding, createMediaFolder, createVisualCapture, linkFileToRecord } from "@/lib/supabase/operations";

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
  dateIdentified?: string;
  /** The extra boxes of the client's own NCR form travel with an offline NCR. */
  referenceChecklist?: string;
  recommendedAction?: "rework" | "repair" | "alternative";
  recommendedActionDetail?: string;
  remarks?: string;
  signedBy?: string;
  signedAt?: string;
  locationNodeId?: string;
};

export type OfflineFindingGroup = {
  id: string;
  organizationId: string;
  draft: QueuedFindingDraft;
  findingId?: string;
  /**
   * The local id of a finding that is waiting in the record queue. The record queue sends
   * it first and remembers the real id, so this photo only has to be linked.
   */
  pendingRecordId?: string;
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
  /**
   * The spot the supervisor pointed at on the building drawing. It becomes a pin on that
   * drawing as soon as the photo reaches the server, so the picture can be found back from
   * the plan and not only from a list of file names.
   */
  drawingPin?: {
    fileId: string;
    pageNumber: number;
    xRatio: number;
    yRatio: number;
  } | null;
  findingGroup?: OfflineFindingGroup | null;
  recordLink?: {
    organizationId: string;
    /** A registration link keeps a photo taken inside a field record attached to it. */
    recordType: "inspection" | "hse" | "registration" | "register_entry";
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

/** Creates the visual capture for an uploaded image once, so a retry never duplicates it. */
async function ensureVisualCapture(client: SupabaseClient, upload: OfflineUpload, fileId: string) {
  const existingCapture = await client
    .from("visual_captures")
    .select("id")
    .eq("file_id", fileId)
    .maybeSingle();
  if (existingCapture.error) throw existingCapture.error;
  if (existingCapture.data) return;
  const capture = await createVisualCapture(client, {
    projectId: upload.projectId,
    buildingId: upload.buildingId,
    dayReportId: upload.reportId,
    fileId,
    locationNodeId: upload.locationNodeId || undefined,
    captureType: upload.kind === "panorama" ? "panorama" : "photo",
    title: upload.title,
    description: upload.description,
    locationLabel: upload.locationLabel,
    tourName: upload.tourName || undefined,
    tourOrder: upload.tourOrder ?? null,
    capturedAt: upload.capturedAt,
  });
  if (!upload.drawingPin || !capture?.id) return;
  // The pin is a second recording of the same fact. The photo is already filed with its
  // location, so a drawing that has meanwhile been replaced must never send the picture
  // itself back into the queue.
  try {
    await createDrawingPin(client, {
      drawingFileId: upload.drawingPin.fileId,
      pageNumber: upload.drawingPin.pageNumber,
      xRatio: upload.drawingPin.xRatio,
      yRatio: upload.drawingPin.yRatio,
      linkedRecordType: "visual",
      linkedRecordId: capture.id,
      note: upload.title,
    });
  } catch {
    // Intentionally silent: the photo is safe, and the location is on it in words as well.
  }
}

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
      if (upload.findingGroup) {
        let findingId = upload.findingGroup.findingId ?? findingIds.get(upload.findingGroup.id);
        // The record itself waited in the record queue and has been sent by now; this
        // photo only has to find the number it ended up with.
        if (!findingId && upload.findingGroup.pendingRecordId) {
          findingId = (await resolvePendingRecordId(upload.findingGroup.pendingRecordId)) ?? undefined;
          if (!findingId) throw new Error("De bijbehorende registratie wacht nog op verzending.");
        }
        if (!findingId && upload.reportId) {
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
            dateIdentified: draft.dateIdentified,
            referenceChecklist: draft.referenceChecklist,
            recommendedAction: draft.recommendedAction,
            recommendedActionDetail: draft.recommendedActionDetail,
            remarks: draft.remarks,
            signedBy: draft.signedBy,
            signedAt: draft.signedAt,
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
        if (!findingId) throw new Error("De bijbehorende registratie is nog niet aangemaakt.");
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
          dateIdentified: upload.findingDraft.dateIdentified,
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
        // A photo taken inside a registration that itself waited on the device carries the
        // local id of that registration; the record queue has since given it a real one.
        const linkedRecordId = isPendingRecordId(upload.recordLink.recordId)
          ? await resolvePendingRecordId(upload.recordLink.recordId)
          : upload.recordLink.recordId;
        if (!linkedRecordId) throw new Error("De bijbehorende registratie wacht nog op verzending.");
        await linkFileToRecord(client, {
          organizationId: upload.recordLink.organizationId,
          projectId: upload.projectId,
          fileId: stored.fileId,
          recordType: upload.recordLink.recordType,
          recordId: linkedRecordId,
          relationship: upload.recordLink.relationship,
        });
        // A photo taken inside a field record is also site evidence, so it has to show up
        // in Photos & folders with its context instead of only hanging off the record.
        if (["registration", "register_entry"].includes(upload.recordLink.recordType) && (upload.kind === "photo" || upload.kind === "panorama")) {
          await ensureVisualCapture(client, upload, stored.fileId);
        }
      } else if (upload.kind === "photo" || upload.kind === "panorama") {
        await ensureVisualCapture(client, upload, stored.fileId);
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
