"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { idbDelete, idbGetAll, idbPut } from "@/lib/offline/idb";
import { uploadProjectFile } from "@/lib/storage/gateway";
import { createFinding, createVisualCapture, linkFileToRecord } from "@/lib/supabase/operations";

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
};

export type OfflineUpload = {
  id: string;
  projectId: string;
  buildingId: string;
  reportId: string | null;
  folderId: string | null;
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
  const bitmap = await createImageBitmap(file);
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
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob || blob.size >= file.size) return { blob: file as Blob, fileName: file.name, mimeType: file.type, compressed: false };
  return { blob, fileName: photoName(file.name), mimeType: "image/jpeg", compressed: true };
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

export async function syncOfflineUploads(
  client: SupabaseClient,
  projectId: string,
  options: { force?: boolean; onItem?: (upload: OfflineUpload, state: "uploading" | "done" | "failed") => void } = {},
) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0, paused: true };
  if (!options.force && dataSaverEnabled() && connectionIsMetered()) return { synced: 0, failed: 0, paused: true };
  const uploads = await listOfflineUploads(projectId);
  let synced = 0;
  let failed = 0;
  for (const upload of uploads) {
    options.onItem?.(upload, "uploading");
    try {
      const stored = await uploadProjectFile(client, {
        projectId: upload.projectId,
        buildingId: upload.buildingId,
        folderId: upload.folderId,
        category: upload.kind === "drawing" ? "drawing" : "photo",
        file: asFile(upload),
      });
      if (upload.findingDraft && upload.reportId) {
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
        });
        await linkFileToRecord(client, {
          organizationId: upload.findingDraft.organizationId,
          projectId: upload.projectId,
          fileId: stored.fileId,
          recordType: "finding",
          recordId: finding.id,
          relationship: "before",
        });
      } else if (upload.kind === "photo" || upload.kind === "panorama") {
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
