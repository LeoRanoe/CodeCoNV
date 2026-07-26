import type { SupabaseClient } from "@supabase/supabase-js";
import { validAccessToken } from "@/lib/supabase/access-token";

export async function ensureDailyBackup(client: SupabaseClient, organizationId: string) {
  const token = await validAccessToken(client);

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
