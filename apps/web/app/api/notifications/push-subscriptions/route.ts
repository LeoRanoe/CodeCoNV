import { z } from "zod";
import { sendPushVerification } from "@/lib/notifications/push";
import { authenticateStorageRequest, createStorageAdminClient, storageErrorResponse, storageJson } from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  p256dh: z.string().min(20).max(500),
  auth: z.string().min(8).max(250),
});

const pushEndpointHosts = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
  "push.microsoft.com",
];

function isAllowedPushEndpoint(value: string) {
  try {
    const endpoint = new URL(value);
    const hostname = endpoint.hostname.toLowerCase();
    return endpoint.protocol === "https:"
      && !endpoint.username
      && !endpoint.password
      && (!endpoint.port || endpoint.port === "443")
      && pushEndpointHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { user, userClient } = await authenticateStorageRequest(request);
    const input = subscriptionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return storageJson({ error: "Ongeldige pushregistratie." }, 400);
    if (!isAllowedPushEndpoint(input.data.endpoint)) {
      return storageJson({ error: "Ongeldige pushprovider." }, 400);
    }
    const rateLimit = await userClient.rpc("consume_security_rate_limit", {
      p_action_code: "push_subscription",
      p_max_requests: 10,
      p_window_minutes: 60,
    });
    if (rateLimit.error) return storageJson({ error: "De pushbeveiligingslimiet kon niet worden gecontroleerd." }, 503);
    if (rateLimit.data !== true) return storageJson({ error: "Te veel pushregistraties. Probeer het later opnieuw." }, 429);
    const saved = await userClient.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: input.data.endpoint,
      p256dh: input.data.p256dh,
      auth_secret: input.data.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      status: "active",
      failure_count: 0,
      last_used_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (saved.error) throw new Error(saved.error.message);
    const reset = await createStorageAdminClient().from("notifications").update({ push_status: "pending", push_last_error: null }).eq("recipient_user_id", user.id).in("push_status", ["skipped", "failed"]);
    if (reset.error) throw new Error(reset.error.message);
    await sendPushVerification(input.data);
    return storageJson({ ok: true, verified: true });
  } catch (error) {
    return storageErrorResponse(error);
  }
}
