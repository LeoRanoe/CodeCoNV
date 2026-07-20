import { timingSafeEqual } from "node:crypto";
import { runScheduledOrganizationBackup } from "@/lib/backups/server";
import { createStorageAdminClient, isBackupStoreConfigured } from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) return json({ error: "De geplande taak is niet geconfigureerd." }, 503);
  if (!authorized(request)) return json({ error: "Ongeldige geplande taak." }, 401);
  if (!isBackupStoreConfigured()) return json({ error: "De afzonderlijke private back-upstore is niet geconfigureerd." }, 503);

  const admin = createStorageAdminClient();
  const organizationResult = await admin.from("organizations").select("id").order("id");
  if (organizationResult.error) return json({ error: "Organisaties konden niet worden geladen." }, 503);

  const results: Array<{ organizationId: string; status: string; backupRunId?: string }> = [];
  let failures = 0;
  for (const organization of organizationResult.data ?? []) {
    try {
      const backup = await runScheduledOrganizationBackup(admin, organization.id);
      results.push({ organizationId: organization.id, status: backup.status, backupRunId: backup.backupRunId });
    } catch {
      failures += 1;
      results.push({ organizationId: organization.id, status: "failed" });
      try {
        await admin.rpc("record_scheduled_backup_failure", {
          p_organization_id: organization.id,
          p_error_summary: "De dagelijkse back-up kon niet worden geverifieerd. Controleer de Vercel-functielogs en start na herstel een nieuwe run.",
        });
      } catch {
        // A secondary notification failure must not hide the original backup result.
      }
    }
  }

  const notificationResult = await admin.rpc("refresh_all_project_notifications");
  if (notificationResult.error) failures += 1;
  return json({
    ok: failures === 0,
    backups: results,
    notificationsCreated: notificationResult.error ? null : Number(notificationResult.data ?? 0),
    failures,
  }, failures === 0 ? 200 : 500);
}
