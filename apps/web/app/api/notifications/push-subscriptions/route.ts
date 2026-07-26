import { z } from "zod";
import { authenticateStorageRequest, createStorageAdminClient, storageErrorResponse, storageJson } from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  p256dh: z.string().min(20).max(500),
  auth: z.string().min(8).max(250),
});

export async function POST(request: Request) {
  try {
    const { user, userClient } = await authenticateStorageRequest(request);
    const input = subscriptionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return storageJson({ error: "Ongeldige pushregistratie." }, 400);
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
    return storageJson({ ok: true });
  } catch (error) {
    return storageErrorResponse(error);
  }
}
