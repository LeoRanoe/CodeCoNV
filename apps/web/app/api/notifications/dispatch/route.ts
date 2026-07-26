import { z } from "zod";
import { isNotificationEmailConfigured, sendPendingNotificationEmails } from "@/lib/notifications/email";
import { sendPendingPushNotifications } from "@/lib/notifications/push";
import {
  authenticateStorageRequest,
  createStorageAdminClient,
  storageErrorResponse,
  storageJson,
} from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({ projectId: z.uuid() });

export async function POST(request: Request) {
  try {
    const { userClient } = await authenticateStorageRequest(request);
    const input = requestSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return storageJson({ error: "Ongeldig project voor meldingen." }, 400);
    const projectResult = await userClient.from("projects").select("id").eq("id", input.data.projectId).maybeSingle();
    if (projectResult.error || !projectResult.data) return storageJson({ error: "Geen toegang tot dit project." }, 403);
    const rateLimit = await userClient.rpc("consume_security_rate_limit", {
      p_action_code: "notification_push_dispatch",
      p_max_requests: 30,
      p_window_minutes: 10,
    });
    if (rateLimit.error || rateLimit.data !== true) return storageJson({ error: "Te veel meldingsverzoeken. De geplande taak probeert automatisch opnieuw." }, 429);
    const refresh = await userClient.rpc("refresh_project_notifications", { p_project_id: input.data.projectId });
    if (refresh.error) throw new Error("Projectmeldingen konden niet worden bijgewerkt.");
    const admin = createStorageAdminClient();
    const push = await sendPendingPushNotifications(admin, input.data.projectId);
    const email = isNotificationEmailConfigured() ? await sendPendingNotificationEmails(admin) : null;
    if (!push.configured) return storageJson({ error: "De pushsleutels zijn nog niet geconfigureerd.", push, email }, 503);
    const failed = push.failed > 0 || Boolean(email?.failed);
    return storageJson({ ok: !failed, created: Number(refresh.data ?? 0), push, email }, failed ? 502 : 200);
  } catch (error) {
    return storageErrorResponse(error);
  }
}
