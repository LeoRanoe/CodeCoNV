import { logEvent } from "@/lib/observability/log";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

type QueuedPush = {
  id: string;
  project_id: string;
  recipient_user_id: string;
  title: string;
  body: string;
  due_at: string | null;
  push_attempts: number;
};

export type NotificationPushResult = { configured: boolean; queued: number; sent: number; failed: number; skipped: number; revoked: number };

function configuration() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey && /^(mailto:|https:\/\/)/.test(subject)) };
}

export function isPushConfigured() {
  return configuration().configured;
}

function configureWebPush() {
  const config = configuration();
  if (!config.configured) throw new Error("De server voor pushmeldingen is nog niet volledig geconfigureerd.");
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return config;
}

function destination(projectId: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  return `${base}/supervisie?project=${encodeURIComponent(projectId)}`;
}

export async function sendPushVerification(subscription: { endpoint: string; p256dh: string; auth: string }) {
  configureWebPush();
  try {
    await webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }, JSON.stringify({
      title: "Pushmeldingen zijn actief",
      body: "Dit apparaat ontvangt voortaan CODECO-projectmeldingen.",
      tag: "codeco-push-verification",
      url: "/supervisie",
    }), { TTL: 60 * 5, urgency: "high" });
  } catch {
    throw new Error("De pushregistratie is opgeslagen, maar de verificatiemelding kon niet worden bezorgd. Controleer of het VAPID-sleutelpaar bij elkaar hoort.");
  }
}

export async function sendPendingPushNotifications(admin: SupabaseClient, projectId?: string): Promise<NotificationPushResult> {
  const config = configuration();
  const result: NotificationPushResult = { configured: config.configured, queued: 0, sent: 0, failed: 0, skipped: 0, revoked: 0 };
  if (!config.configured) return result;
  configureWebPush();

  let builder = admin
    .from("notifications")
    .select("id,project_id,recipient_user_id,title,body,due_at,push_attempts")
    .in("push_status", ["pending", "failed", "sending"])
    .lt("push_attempts", 5)
    .order("created_at")
    .limit(50);
  if (projectId) builder = builder.eq("project_id", projectId);
  const queueResult = await builder;
  if (queueResult.error) throw new Error(queueResult.error.message);
  const queue = (queueResult.data ?? []) as QueuedPush[];
  result.queued = queue.length;
  if (!queue.length) return result;

  const projectIds = [...new Set(queue.map((item) => item.project_id))];
  const userIds = [...new Set(queue.map((item) => item.recipient_user_id))];
  const [settingsResult, subscriptionsResult] = await Promise.all([
    admin.from("project_settings").select("project_id,push_notifications_enabled").in("project_id", projectIds),
    admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth_secret,failure_count").in("user_id", userIds).eq("status", "active"),
  ]);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (subscriptionsResult.error) throw new Error(subscriptionsResult.error.message);
  const enabled = new Map((settingsResult.data ?? []).map((row) => [String(row.project_id), row.push_notifications_enabled !== false]));

  for (const notification of queue) {
    if (enabled.get(notification.project_id) === false) {
      await admin.from("notifications").update({ push_status: "skipped", push_last_error: null }).eq("id", notification.id);
      result.skipped += 1;
      continue;
    }
    const subscriptions = (subscriptionsResult.data ?? []).filter((row) => row.user_id === notification.recipient_user_id);
    if (!subscriptions.length) {
      await admin.from("notifications").update({ push_status: "skipped", push_last_error: "Geen actieve pushregistratie op een apparaat." }).eq("id", notification.id);
      result.skipped += 1;
      continue;
    }

    await admin.from("notifications").update({ push_status: "sending", push_attempts: notification.push_attempts + 1, push_last_error: null }).eq("id", notification.id);
    let delivered = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: String(subscription.endpoint), keys: { p256dh: String(subscription.p256dh), auth: String(subscription.auth_secret) } }, JSON.stringify({
          title: notification.title,
          body: notification.body,
          tag: `codeco-${notification.id}`,
          url: destination(notification.project_id),
        }), { TTL: 60 * 60 * 12, urgency: "high" });
        delivered += 1;
        await admin.from("push_subscriptions").update({ failure_count: 0, last_used_at: new Date().toISOString() }).eq("id", subscription.id);
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
        logEvent("warn", "notification", "push_delivery_failed", { notificationId: notification.id, subscriptionId: subscription.id, statusCode });
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").update({ status: "revoked", failure_count: Number(subscription.failure_count ?? 0) + 1 }).eq("id", subscription.id);
          result.revoked += 1;
        } else {
          await admin.from("push_subscriptions").update({ failure_count: Math.min(100, Number(subscription.failure_count ?? 0) + 1) }).eq("id", subscription.id);
        }
      }
    }
    if (delivered) {
      await admin.from("notifications").update({ push_status: "sent", push_sent_at: new Date().toISOString(), push_last_error: null }).eq("id", notification.id);
      result.sent += 1;
    } else {
      await admin.from("notifications").update({ push_status: "failed", push_last_error: "Pushaflevering is mislukt; de geplande taak probeert opnieuw." }).eq("id", notification.id);
      result.failed += 1;
    }
  }
  return result;
}
