import "server-only";

import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { gunzip as gunzipCallback, gzip as gzipCallback } from "node:zlib";
import { del, get, head, put } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";

const gzip = promisify(gzipCallback);
const gunzip = promisify(gunzipCallback);
const BACKUP_SCHEMA_VERSION = "202607190003";

type BackupManifest = {
  schema_version: string;
  organization_id: string;
  backup_run_id: string;
  record_counts: Record<string, number>;
  data: Record<string, unknown[]>;
};

type ScheduledBackupRow = {
  id: string;
  organization_id: string;
  status: string;
  storage_object_key: string | null;
  verified_at: string | null;
  created_at: string;
};

export type ScheduledBackupResult = {
  organizationId: string;
  backupRunId: string;
  status: "verified" | "skipped";
  sizeBytes: number;
  sha256: string;
  pathname: string;
  restoreDryRun: boolean;
  rotated: number;
};

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function dateKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Paramaribo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isoWeekKey(date: Date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function retentionAssignments(rows: ScheduledBackupRow[]) {
  const sorted = [...rows].sort((left, right) =>
    new Date(right.verified_at ?? right.created_at).getTime() - new Date(left.verified_at ?? left.created_at).getTime());
  const assignments = new Map<string, "daily" | "weekly" | "monthly">();

  for (const row of sorted.slice(0, 7)) assignments.set(row.id, "daily");

  const weeks = new Set<string>();
  for (const row of sorted) {
    const key = isoWeekKey(new Date(row.verified_at ?? row.created_at));
    if (weeks.has(key) || assignments.has(row.id)) continue;
    weeks.add(key);
    assignments.set(row.id, "weekly");
    if (weeks.size >= 4) break;
  }

  const months = new Set<string>();
  for (const row of sorted) {
    const date = new Date(row.verified_at ?? row.created_at);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (months.has(key) || assignments.has(row.id)) continue;
    months.add(key);
    assignments.set(row.id, "monthly");
    if (months.size >= 3) break;
  }
  return assignments;
}

function validateManifest(manifest: unknown, organizationId: string, backupRunId: string): asserts manifest is BackupManifest {
  if (!manifest || typeof manifest !== "object") throw new Error("BACKUP_MANIFEST_INVALID");
  const candidate = manifest as Partial<BackupManifest>;
  if (candidate.schema_version !== BACKUP_SCHEMA_VERSION
    || candidate.organization_id !== organizationId
    || candidate.backup_run_id !== backupRunId
    || !candidate.record_counts
    || !candidate.data) {
    throw new Error("BACKUP_MANIFEST_INVALID");
  }
  for (const [table, count] of Object.entries(candidate.record_counts)) {
    const rows = candidate.data[table];
    if (!Array.isArray(rows) || rows.length !== count) throw new Error(`BACKUP_COUNT_MISMATCH:${table}`);
  }
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(next.value);
    length += next.value.byteLength;
  }
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

async function reserveBackupRun(admin: SupabaseClient, organizationId: string, key: string) {
  const existing = await admin.from("backup_runs")
    .select("id,status,size_bytes,sha256,storage_object_key,verified_at")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.status === "verified") return { ...existing.data, existing: true };
  if (existing.data) {
    const reset = await admin.from("backup_runs").update({
      status: "exporting",
      error_summary: null,
      verified_at: null,
    }).eq("id", existing.data.id).select("id,status,size_bytes,sha256,storage_object_key,verified_at").single();
    if (reset.error) throw reset.error;
    return { ...reset.data, existing: false };
  }

  const inserted = await admin.from("backup_runs").insert({
    organization_id: organizationId,
    project_id: null,
    run_type: "scheduled",
    status: "exporting",
    schema_version: BACKUP_SCHEMA_VERSION,
    idempotency_key: key,
    created_by: null,
  }).select("id,status,size_bytes,sha256,storage_object_key,verified_at").single();
  if (!inserted.error) return { ...inserted.data, existing: false };
  if (inserted.error.code !== "23505") throw inserted.error;

  const raced = await admin.from("backup_runs")
    .select("id,status,size_bytes,sha256,storage_object_key,verified_at")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", key)
    .single();
  if (raced.error) throw raced.error;
  return { ...raced.data, existing: raced.data.status === "verified" };
}

async function rotateBackups(admin: SupabaseClient, organizationId: string) {
  const history = await admin.from("backup_runs")
    .select("id,organization_id,status,storage_object_key,verified_at,created_at")
    .eq("organization_id", organizationId)
    .eq("run_type", "scheduled")
    .eq("status", "verified")
    .order("verified_at", { ascending: false })
    .limit(500);
  if (history.error) throw history.error;
  const rows = (history.data ?? []) as ScheduledBackupRow[];
  const assignments = retentionAssignments(rows);

  await Promise.all(Array.from(assignments.entries()).map(async ([id, tier]) => {
    const update = await admin.from("backup_runs").update({ retention_tier: tier }).eq("id", id);
    if (update.error) throw update.error;
  }));

  const expired = rows.filter((row) => !assignments.has(row.id) && row.storage_object_key);
  if (expired.length === 0) return 0;
  await del(expired.map((row) => row.storage_object_key!));
  const rotated = await admin.from("backup_runs").update({
    status: "rotated",
    retention_tier: null,
    error_summary: "Automatisch verwijderd volgens 7-dag/4-week/3-maand-retentie.",
  }).in("id", expired.map((row) => row.id));
  if (rotated.error) throw rotated.error;
  return expired.length;
}

async function recordRestoreDryRun(
  admin: SupabaseClient,
  organizationId: string,
  manifest: BackupManifest,
  pathname: string,
  checksum: string,
  sizeBytes: number,
  now: Date,
) {
  const month = dateKey(now).slice(0, 7);
  const latest = await admin.from("backup_runs")
    .select("id,verified_at")
    .eq("organization_id", organizationId)
    .eq("run_type", "restore_test")
    .eq("status", "dry_run_passed")
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) throw latest.error;
  const recent = latest.data?.verified_at
    && Date.now() - new Date(latest.data.verified_at).getTime() < 28 * 86_400_000;
  if (recent) return false;

  const inserted = await admin.from("backup_runs").upsert({
    organization_id: organizationId,
    project_id: null,
    run_type: "restore_test",
    status: "dry_run_passed",
    schema_version: manifest.schema_version,
    idempotency_key: `scheduled-dry-run:${month}`,
    record_counts: manifest.record_counts,
    size_bytes: sizeBytes,
    sha256: checksum,
    storage_provider: "vercel_blob",
    storage_object_key: pathname,
    created_by: null,
    verified_at: new Date().toISOString(),
  }, { onConflict: "organization_id,idempotency_key", ignoreDuplicates: true });
  if (inserted.error) throw inserted.error;
  return true;
}

export async function runScheduledOrganizationBackup(
  admin: SupabaseClient,
  organizationId: string,
  now = new Date(),
): Promise<ScheduledBackupResult> {
  const day = dateKey(now);
  const key = `scheduled:${day}:organization:${organizationId}`;
  const run = await reserveBackupRun(admin, organizationId, key);
  if (run.existing) {
    return {
      organizationId,
      backupRunId: run.id,
      status: "skipped",
      sizeBytes: Number(run.size_bytes ?? 0),
      sha256: String(run.sha256 ?? ""),
      pathname: String(run.storage_object_key ?? ""),
      restoreDryRun: false,
      rotated: 0,
    };
  }

  try {
    const exported = await admin.rpc("build_scheduled_backup_export", {
      p_organization_id: organizationId,
      p_backup_run_id: run.id,
    });
    if (exported.error) throw exported.error;
    validateManifest(exported.data, organizationId, run.id);
    const manifest = exported.data;
    const compressed = await gzip(Buffer.from(JSON.stringify(manifest)), { level: 9 });
    const checksum = sha256(compressed);
    const pathname = `backups/organizations/${organizationId}/daily/${day}/codeco-${BACKUP_SCHEMA_VERSION}-${run.id}.json.gz`;

    const uploading = await admin.from("backup_runs").update({ status: "uploading" }).eq("id", run.id);
    if (uploading.error) throw uploading.error;
    await put(pathname, compressed, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/gzip",
      cacheControlMaxAge: 60,
    });

    const stored = await head(pathname);
    if (stored.pathname !== pathname || stored.size !== compressed.byteLength) throw new Error("BACKUP_BLOB_METADATA_MISMATCH");
    const downloaded = await get(pathname, { access: "private", useCache: false });
    if (!downloaded || downloaded.statusCode !== 200) throw new Error("BACKUP_BLOB_READBACK_FAILED");
    const readback = await readStream(downloaded.stream);
    if (sha256(readback) !== checksum) throw new Error("BACKUP_BLOB_CHECKSUM_MISMATCH");
    const parsed = JSON.parse((await gunzip(readback)).toString("utf8")) as unknown;
    validateManifest(parsed, organizationId, run.id);

    const verifiedAt = new Date().toISOString();
    const verified = await admin.from("backup_runs").update({
      status: "verified",
      schema_version: manifest.schema_version,
      record_counts: manifest.record_counts,
      size_bytes: compressed.byteLength,
      sha256: checksum,
      storage_provider: "vercel_blob",
      storage_object_key: pathname,
      retention_tier: "daily",
      error_summary: null,
      verified_at: verifiedAt,
    }).eq("id", run.id);
    if (verified.error) throw verified.error;

    const restoreDryRun = await recordRestoreDryRun(
      admin, organizationId, manifest, pathname, checksum, compressed.byteLength, now,
    );
    const rotated = await rotateBackups(admin, organizationId);
    return {
      organizationId,
      backupRunId: run.id,
      status: "verified",
      sizeBytes: compressed.byteLength,
      sha256: checksum,
      pathname,
      restoreDryRun,
      rotated,
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Scheduled backup failed";
    await admin.from("backup_runs").update({
      status: "failed",
      error_summary: summary.slice(0, 500),
    }).eq("id", run.id);
    throw error;
  }
}
