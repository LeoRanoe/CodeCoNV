import type { SupabaseClient } from "@supabase/supabase-js";
import { validAccessToken } from "@/lib/supabase/access-token";

export async function requestProjectNotificationDispatch(client: SupabaseClient, projectId: string) {
  const token = await validAccessToken(client).catch(() => "");
  if (!token) return false;
  const response = await fetch("/api/notifications/dispatch", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  return response.ok;
}

export const requestProjectNotificationEmailDispatch = requestProjectNotificationDispatch;
