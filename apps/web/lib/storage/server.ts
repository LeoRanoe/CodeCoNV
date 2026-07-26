import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type StorageAuthContext = {
  accessToken: string;
  user: User;
  userClient: SupabaseClient;
};

function supabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  return { url, publishableKey, secretKey };
}

export function isBlobServerConfigured() {
  const oidcConfigured = Boolean(process.env.BLOB_STORE_ID?.trim() && process.env.VERCEL_OIDC_TOKEN?.trim());
  return oidcConfigured || Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function isBackupStoreConfigured() {
  return Boolean(
    process.env.BACKUP_BLOB_READ_WRITE_TOKEN?.trim()
    || process.env.BLOB_READ_WRITE_TOKEN?.trim(),
  );
}

export function storageJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function authenticateStorageRequest(request: Request): Promise<StorageAuthContext> {
  const { url, publishableKey } = supabaseConfiguration();
  if (!url || !publishableKey) throw new Error("STORAGE_SUPABASE_CONFIGURATION_MISSING");

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) throw new Error("STORAGE_AUTH_REQUIRED");

  const validationClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const userResult = await validationClient.auth.getUser(accessToken);
  if (userResult.error || !userResult.data.user) throw new Error("STORAGE_AUTH_EXPIRED");

  const userClient = createClient(url, publishableKey, {
    accessToken: async () => accessToken,
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return { accessToken, user: userResult.data.user, userClient };
}

export function createStorageAdminClient() {
  const { url, secretKey } = supabaseConfiguration();
  if (!url || !secretKey) throw new Error("STORAGE_SUPABASE_CONFIGURATION_MISSING");
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

export function storageErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "STORAGE_AUTH_REQUIRED") return storageJson({ error: "Aanmelden is vereist." }, 401);
  if (message === "STORAGE_AUTH_EXPIRED") return storageJson({ error: "Je sessie is verlopen." }, 401);
  if (message === "STORAGE_SUPABASE_CONFIGURATION_MISSING") {
    return storageJson({ error: "De beveiligde Supabase-koppeling voor bestandsopslag ontbreekt." }, 503);
  }
  return storageJson({ error: message || "De private bestandsopslag kon de aanvraag niet verwerken." }, 500);
}
