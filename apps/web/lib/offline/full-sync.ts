"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheProjectSnapshot } from "@/lib/offline/project-cache";
import { cacheQueryResult } from "@/lib/offline/query-cache";
import { offlineQueryKeys } from "@/lib/offline/query-keys";
import { cacheProjectDay, cacheWorkspace } from "@/lib/offline/workspace-cache";
import { cachedFileUsage } from "@/lib/offline/file-cache";
import { purgeReadableOfflineData } from "@/lib/offline/account-isolation";
import { idbGet, idbKeys, idbPut } from "@/lib/offline/idb";
import { storeProjectFileOffline } from "@/lib/storage/gateway";
import {
  loadInternalAccess,
  loadProjectConfiguration,
  loadProjectDay,
  loadProjectDrawings,
  loadProjectLocations,
  loadProjectNotifications,
  loadWorkspace,
  reportDateInSuriname,
} from "@/lib/supabase/data";
import { loadProjectOperations } from "@/lib/supabase/operations";

/**
 * Where the sync is, so the screen can say it in its own words. The step is a name, not a
 * sentence: the interface has to exist in Dutch and English.
 */
export type OfflineSyncProgress = {
  step: "workspace" | "project" | "files" | "code" | "done";
  /** The project being worked on, when the step is about one. */
  projectName: string;
  completed: number;
  total: number;
  /** Bytes of evidence stored so far. */
  bytes: number;
};

export type OfflineSyncSummary = {
  finishedAt: string;
  projects: number;
  files: number;
  bytes: number;
  /** Files that could not be fetched; the records themselves are still complete. */
  skippedFiles: number;
};

const summaryId = "offline-sync-summary";

export async function readOfflineSyncSummary() {
  const stored = await idbGet<{ id: string; summary: OfflineSyncSummary }>("settings", summaryId).catch(() => null);
  return stored?.summary ?? null;
}

async function writeOfflineSyncSummary(summary: OfflineSyncSummary) {
  await idbPut("settings", { id: summaryId, summary }).catch(() => undefined);
}

/**
 * The lazily loaded parts of the application: the 360° viewer, the drawing renderer and the
 * report generators. They are separate downloads that only happen the first time somebody
 * opens them — which offline is never. Touching them here puts their code in the service
 * worker cache while there still is a connection.
 */
async function warmLazyModules() {
  await Promise.allSettled([
    import("@photo-sphere-viewer/core"),
    import("@photo-sphere-viewer/markers-plugin"),
    import("@photo-sphere-viewer/autorotate-plugin"),
    import("@photo-sphere-viewer/compass-plugin"),
    import("@photo-sphere-viewer/gyroscope-plugin"),
    import("pdfjs-dist"),
    import("@/lib/reports/daily-report-pdf"),
    import("@/lib/reports/daily-report-docx"),
    import("@/lib/reports/period-report-pdf"),
    import("@/lib/reports/period-report-docx"),
    import("@/lib/reports/ncr-pdf"),
    import("@/lib/reports/ncr-docx"),
    import("@/lib/reports/controlled-document-pdf"),
    import("@/lib/reports/controlled-document-docx"),
  ]);
}

/**
 * Puts everything this account can read onto the device: every project with its registers,
 * findings, inspections, documents, day report, settings, locations, drawings and
 * notifications, and — unless the user asks for records only — the photos, 360° images and
 * drawing files themselves.
 *
 * It is deliberately one explicit action instead of a background trickle. A supervisor
 * leaves for a site with no coverage and needs to know, before leaving, that the project is
 * on the phone.
 */
export async function syncEverythingForOffline(
  client: SupabaseClient,
  options: {
    userId: string;
    /** false stores the records only, for a device or a bundle that cannot take the images. */
    includeFiles?: boolean;
    onProgress?: (progress: OfflineSyncProgress) => void;
    signal?: AbortSignal;
  },
): Promise<OfflineSyncSummary> {
  const { userId, includeFiles = true, onProgress, signal } = options;
  const stopped = () => {
    if (signal?.aborted) throw new Error("offline-sync-cancelled");
  };
  const reportDate = reportDateInSuriname();
  let bytes = 0;
  let files = 0;
  let skippedFiles = 0;

  onProgress?.({ step: "workspace", projectName: "", completed: 0, total: 1, bytes });
  const workspace = await loadWorkspace(client);
  await cacheWorkspace(userId, workspace);

  // The member list belongs to the organization, not to a project, and the action centre
  // needs it to put a name behind an assignment.
  for (const organization of workspace.organizations) {
    stopped();
    if (!workspace.manageableOrganizationIds.includes(organization.id)) continue;
    await loadInternalAccess(client, organization.id)
      .then((access) => cacheQueryResult(offlineQueryKeys.internalAccess(organization.id), access))
      .catch(() => undefined);
  }

  const projects = workspace.projects;
  for (const [index, project] of projects.entries()) {
    stopped();
    onProgress?.({ step: "project", projectName: project.name, completed: index, total: projects.length, bytes });

    const day = await loadProjectDay(client, project.id, reportDate);
    await cacheProjectDay(project.id, reportDate, day);

    const reportId = day.report?.id ? String(day.report.id) : null;
    const snapshot = await loadProjectOperations(client, project.id, project.organizationId, reportId);
    // The screen asks for the snapshot under the report of the day it is opened on, and the
    // workspace asks for it without one. Both keys get the same answer.
    await cacheProjectSnapshot(project.id, reportId, snapshot);
    if (reportId) await cacheProjectSnapshot(project.id, null, snapshot);

    await Promise.allSettled([
      loadProjectConfiguration(client, project.id).then((data) => cacheQueryResult(offlineQueryKeys.projectConfiguration(project.id), data)),
      loadProjectLocations(client, project.id).then((data) => cacheQueryResult(offlineQueryKeys.projectLocations(project.id), data)),
      loadProjectDrawings(client, project.id).then((data) => cacheQueryResult(offlineQueryKeys.projectDrawings(project.id), data)),
      loadProjectNotifications(client, project.id).then((data) => cacheQueryResult(offlineQueryKeys.projectNotifications(project.id), data)),
    ]);

    if (includeFiles) {
      const available = snapshot.files.filter((file) => file.status === "available");
      for (const [fileIndex, file] of available.entries()) {
        stopped();
        onProgress?.({ step: "files", projectName: project.name, completed: fileIndex, total: available.length, bytes });
        try {
          const stored = await storeProjectFileOffline(client, file.id, project.id);
          bytes += stored.bytes;
          files += 1;
        } catch {
          // One unreachable file must not stop the rest of the project from being stored.
          skippedFiles += 1;
        }
      }
    }
    onProgress?.({ step: "project", projectName: project.name, completed: index + 1, total: projects.length, bytes });
  }

  stopped();
  onProgress?.({ step: "code", projectName: "", completed: 0, total: 1, bytes });
  await warmLazyModules();

  const usage = await cachedFileUsage();
  const summary: OfflineSyncSummary = {
    finishedAt: new Date().toISOString(),
    projects: projects.length,
    files: includeFiles ? usage.count : files,
    bytes: includeFiles ? usage.bytes : bytes,
    skippedFiles,
  };
  await writeOfflineSyncSummary(summary);
  onProgress?.({ step: "done", projectName: "", completed: projects.length, total: projects.length, bytes: summary.bytes });
  return summary;
}

/**
 * Throws away the readable offline copy: every cached project, day, query result and file,
 * and unsent form drafts. Queued field work (records, photos, drawing pins) is untouched on
 * purpose: it exists nowhere but on this device. Resolves only once the stores are empty, so
 * "the offline copy has been removed" is true when the user reads it.
 */
export async function clearOfflineCopy() {
  await purgeReadableOfflineData();
}

/** What the device is holding, for the line under the button. */
export async function offlineStorageUsage() {
  const [files, snapshots, estimate] = await Promise.all([
    cachedFileUsage(),
    // Project data cached on its own, including a download that was stopped half-way.
    idbKeys("snapshots").then((keys) => keys.length).catch(() => 0),
    typeof navigator !== "undefined" && navigator.storage?.estimate
      ? navigator.storage.estimate().catch(() => null)
      : Promise.resolve(null),
  ]);
  return {
    files: files.count,
    snapshots,
    bytes: files.bytes,
    quotaBytes: estimate?.quota ?? 0,
    usedBytes: estimate?.usage ?? 0,
  };
}
