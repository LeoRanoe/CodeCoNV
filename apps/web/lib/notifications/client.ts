import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestProjectNotificationDispatch(client: SupabaseClient, projectId: string) {
  const sessionResult = await client.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (sessionResult.error || !token) return false;
  const response = await fetch("/api/notifications/dispatch", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  return response.ok;
}

export const requestProjectNotificationEmailDispatch = requestProjectNotificationDispatch;
