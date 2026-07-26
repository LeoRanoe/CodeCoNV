import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureDailyBackup(client: SupabaseClient, organizationId: string) {
  const session = await client.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Je sessie is verlopen.");

  const response = await fetch("/api/backups/ensure-daily", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ organizationId }),
  });
  const body = await response.json().catch(() => ({})) as {
    error?: string;
    backupRunId?: string;
    status?: string;
    verified?: boolean;
  };
  if (!response.ok) throw new Error(body.error ?? "De dagelijkse back-upcontrole is mislukt.");
  return body;
}
