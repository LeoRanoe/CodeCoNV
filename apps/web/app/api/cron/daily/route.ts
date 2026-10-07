import { logEvent, requestIdFrom } from "@/lib/observability/log";
import { timingSafeEqual } from "node:crypto";
import { runScheduledOrganizationBackup } from "@/lib/backups/server";
import { isNotificationEmailConfigured, sendPendingNotificationEmails } from "@/lib/notifications/email";
import { sendPendingPushNotifications } from "@/lib/notifications/push";
import { createStorageAdminClient, isBackupStoreConfigured } from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Vercel documents 16 characters as the minimum for CRON_SECRET; a shorter value is
// treated as unconfigured rather than as a guessable bearer secret.
const minimumCronSecretLength = 16;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function authorized(request: Request) {
  const secret = configuredCronSecret();
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function configuredCronSecret() {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  return secret.length >= minimumCronSecretLength ? secret : "";
}

export async function GET(request: Request) {
  if (!configuredCronSecret()) return json({ error: "De geplande taak is niet geconfigureerd." }, 503);
  if (!authorized(request)) {
    logEvent("warn", "cron", "unauthorized_request", { requestId: requestIdFrom(request) });
    return json({ error: "Ongeldige geplande taak." }, 401);
  }
  const requestId = requestIdFrom(request);
  const admin = createStorageAdminClient();
  const backupConfigured = isBackupStoreConfigured();
  const organizationResult = await admin.from("organizations").select("id").order("id");
  if (organizationResult.error) {
    logEvent("error", "cron", "organizations_unavailable", { requestId, error: organizationResult.error });
    return json({ error: "Organisaties konden niet worden geladen." }, 503);
  }

  const results: Array<{ organizationId: string; status: string; backupRunId?: string }> = [];
  let failures = 0;
  for (const organization of organizationResult.data ?? []) {
    if (!backupConfigured) {
      failures += 1;
      results.push({ organizationId: organization.id, status: "backup_store_not_configured" });
      continue;
    }
    try {
      const backup = await runScheduledOrganizationBackup(admin, organization.id);
      results.push({ organizationId: organization.id, status: backup.status, backupRunId: backup.backupRunId });
    } catch (error) {
      failures += 1;
      results.push({ organizationId: organization.id, status: "failed" });
      logEvent("error", "backup", "scheduled_backup_failed", { requestId, organizationId: organization.id, error });
      try {
        await admin.rpc("record_scheduled_backup_failure", {
          p_organization_id: organization.id,
          p_error_summary: "De dagelijkse back-up kon niet worden geverifieerd. Controleer de Vercel-functielogs en start na herstel een nieuwe run.",
        });
      } catch (error) {
        // A secondary notification failure must not hide the original backup result.
        logEvent("error", "backup", "backup_failure_not_recorded", { requestId, organizationId: organization.id, error });
      }
    }
  }

  const notificationResult = await admin.rpc("refresh_all_project_notifications");
  if (notificationResult.error) {
    failures += 1;
    logEvent("error", "notification", "notification_refresh_failed", { requestId, error: notificationResult.error });
  }
  let pushResult = null;
  try {
    pushResult = await sendPendingPushNotifications(admin);
    if (!pushResult.configured || pushResult.failed > 0) failures += 1;
  } catch (error) {
    failures += 1;
    logEvent("error", "notification", "push_dispatch_failed", { requestId, error });
  }
  let emailResult = null;
  try {
    if (isNotificationEmailConfigured()) {
      emailResult = await sendPendingNotificationEmails(admin);
      if (emailResult.failed > 0) failures += 1;
    }
  } catch (error) {
    failures += 1;
    logEvent("error", "notification", "email_dispatch_failed", { requestId, error });
  }
  // One summary line per run, so a missed or partly failed night is visible in the logs and
  // in the 500 status Vercel Cron records.
  logEvent(failures === 0 ? "info" : "error", "cron", "daily_run_finished", {
    requestId,
    failures,
    backupConfigured,
    backups: results,
    push: pushResult,
    email: emailResult,
  });
  return json({
    ok: failures === 0,
    backups: results,
    notificationsCreated: notificationResult.error ? null : Number(notificationResult.data ?? 0),
    notificationPush: pushResult,
    notificationEmail: emailResult,
    backupConfigured,
    failures,
  }, failures === 0 ? 200 : 500);
}
