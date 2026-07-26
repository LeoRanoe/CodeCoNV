import type { Session, SupabaseClient } from "@supabase/supabase-js";

const refreshes = new WeakMap<SupabaseClient, Promise<string>>();
const refreshMarginSeconds = 90;

function usableAccessToken(session: Session | null) {
  if (!session?.access_token) return "";
  if (!session.expires_at) return session.access_token;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return session.expires_at > nowSeconds + refreshMarginSeconds ? session.access_token : "";
}

async function refreshAccessToken(client: SupabaseClient) {
  const existingRefresh = refreshes.get(client);
  if (existingRefresh) return existingRefresh;

  const pending = client.auth.refreshSession().then(({ data, error }) => {
    const token = data.session?.access_token ?? "";
    if (error || !token) {
      throw new Error("Je veilige sessie kon niet worden vernieuwd. Meld je één keer opnieuw aan.");
    }
    return token;
  }).finally(() => {
    refreshes.delete(client);
  });
  refreshes.set(client, pending);
  return pending;
}

/**
 * Returns a bearer token that will remain valid long enough to finish an
 * upload or same-origin API call. Concurrent callers share one refresh.
 */
export async function validAccessToken(client: SupabaseClient) {
  const current = await client.auth.getSession();
  const token = usableAccessToken(current.data.session);
  if (!current.error && token) return token;
  return refreshAccessToken(client);
}
