import { timingSafeEqual } from "node:crypto";
import { logEvent, requestIdFrom } from "@/lib/observability/log";
import { sendPendingNotificationEmails } from "@/lib/notifications/email";
import { createStorageAdminClient } from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const minimumCronSecretLength = 16;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function configuredCronSecret() {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  return secret.length >= minimumCronSecretLength ? secret : "";
}

function authorized(request: Request) {
  const secret = configuredCronSecret();
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const given = Buffer.from(supplied);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Word 11.1: scheduled reports. Runs at 08:00 and 18:00 project time (see vercel.json). Every
 * schedule that has come due tells its recipients, in the app and by e-mail, that the report is ready
 * to be made from its template.
 */
export async function GET(request: Request) {
  if (!configuredCronSecret()) return json({ error: "De geplande taak is niet geconfigureerd." }, 503);
  if (!authorized(request)) {
    logEvent("warn", "cron", "unauthorized_request", { requestId: requestIdFrom(request) });
    return json({ error: "Ongeldige geplande taak." }, 401);
  }
  const requestId = requestIdFrom(request);
  const admin = createStorageAdminClient();
  const due = await admin.rpc("run_due_report_schedules");
  if (due.error) {
    logEvent("error", "cron", "report_schedules_failed", { requestId, error: due.error });
    return json({ error: "De geplande rapporten konden niet worden verwerkt." }, 503);
  }
  let email: unknown = null;
  try {
    email = await sendPendingNotificationEmails(admin);
  } catch (error) {
    logEvent("error", "cron", "report_schedule_email_failed", { requestId, error });
  }
  return json({ schedulesRun: due.data ?? 0, email });
}
