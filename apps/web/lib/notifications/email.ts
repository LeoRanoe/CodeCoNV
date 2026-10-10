import { logEvent } from "@/lib/observability/log";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type QueuedNotification = {
  id: string;
  project_id: string;
  recipient_user_id: string;
  title: string;
  body: string;
  due_at: string | null;
  email_attempts: number;
};

export type NotificationEmailResult = {
  configured: boolean;
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
};

function emailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim() ?? "";
  const configured = Boolean(apiKey && /^.+@.+\..+$/.test(from));
  return { apiKey, from, configured };
}

export function isNotificationEmailConfigured() {
  return emailConfiguration().configured;
}

function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const deployment = process.env.VERCEL_URL?.trim();
  return deployment ? `https://${deployment.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDueAt(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("nl-SR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Paramaribo",
  }).format(new Date(value));
}

async function markDelivery(
  admin: SupabaseClient,
  notificationId: string,
  update: Record<string, unknown>,
) {
  const result = await admin.from("notifications").update(update).eq("id", notificationId);
  if (result.error) throw new Error(result.error.message);
}

export async function sendPendingNotificationEmails(admin: SupabaseClient): Promise<NotificationEmailResult> {
  const config = emailConfiguration();
  if (!config.configured) return { configured: false, queued: 0, sent: 0, failed: 0, skipped: 0 };

  const queueResult = await admin
    .from("notifications")
    .select("id,project_id,recipient_user_id,title,body,due_at,email_attempts")
    .in("email_status", ["pending", "failed", "sending"])
    .lt("email_attempts", 5)
    .order("created_at")
    .limit(50);
  if (queueResult.error) throw new Error(queueResult.error.message);
  const queue = (queueResult.data ?? []) as QueuedNotification[];
  if (!queue.length) return { configured: true, queued: 0, sent: 0, failed: 0, skipped: 0 };

  const projectIds = [...new Set(queue.map((item) => item.project_id))];
  const settingsResult = await admin
    .from("project_settings")
    .select("project_id,email_notifications_enabled")
    .in("project_id", projectIds);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  const enabledProjects = new Map((settingsResult.data ?? []).map((item) => [item.project_id as string, item.email_notifications_enabled !== false]));

  const result: NotificationEmailResult = { configured: true, queued: queue.length, sent: 0, failed: 0, skipped: 0 };
  const destination = appUrl();
  for (const notification of queue) {
    if (enabledProjects.get(notification.project_id) === false) {
      await markDelivery(admin, notification.id, { email_status: "skipped", email_last_error: null });
      result.skipped += 1;
      continue;
    }

    const userResult = await admin.auth.admin.getUserById(notification.recipient_user_id);
    const recipient = userResult.data.user?.email?.trim() ?? "";
    if (userResult.error || !recipient) {
      await markDelivery(admin, notification.id, {
        email_status: "failed",
        email_attempts: notification.email_attempts + 1,
        email_last_error: "De interne ontvanger heeft geen afleverbaar e-mailadres.",
      });
      result.failed += 1;
      continue;
    }

    await markDelivery(admin, notification.id, {
      email_status: "sending",
      email_attempts: notification.email_attempts + 1,
      email_last_error: null,
    });
    const due = formatDueAt(notification.due_at);
    const text = [notification.title, "", notification.body, due ? `Deadline: ${due}` : "", destination ? `Open CODECO Supervisie: ${destination}/supervisie` : ""]
      .filter(Boolean)
      .join("\n");
    const action = destination
      ? `<p style="margin:24px 0"><a href="${escapeHtml(destination)}/supervisie" style="background:#b42318;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open CODECO Supervisie</a></p>`
      : "";
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": `codeco-notification-${notification.id}`,
        },
        body: JSON.stringify({
          from: config.from,
          to: [recipient],
          subject: `CODECO | ${notification.title}`,
          text,
          html: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#1f2937"><p style="color:#b42318;font-weight:700;letter-spacing:.08em">CODECO SUPERVISIE</p><h1 style="font-size:22px">${escapeHtml(notification.title)}</h1><p style="font-size:16px;line-height:1.55">${escapeHtml(notification.body)}</p>${due ? `<p><strong>Deadline:</strong> ${escapeHtml(due)}</p>` : ""}${action}<p style="color:#667085;font-size:13px">Deze melding is automatisch verstuurd vanuit het gecontroleerde projectdossier.</p></div>`,
        }),
      });
      const responseBody = await response.json().catch(() => ({})) as { id?: string };
      if (!response.ok || !responseBody.id) throw new Error(`E-mailprovider gaf status ${response.status}.`);
      await markDelivery(admin, notification.id, {
        email_status: "sent",
        email_sent_at: new Date().toISOString(),
        email_message_id: responseBody.id,
        email_last_error: null,
      });
      result.sent += 1;
    } catch (error) {
      logEvent("warn", "notification", "email_delivery_failed", { notificationId: notification.id, error });
      await markDelivery(admin, notification.id, {
        email_status: "failed",
        email_last_error: "Aflevering via de e-mailprovider is mislukt; de geplande taak probeert opnieuw.",
      });
      result.failed += 1;
    }
  }
  return result;
}
