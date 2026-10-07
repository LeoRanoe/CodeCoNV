import { logEvent, requestIdFrom, type LogCategory } from "@/lib/observability/log";
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
  const dedicatedToken = process.env.BACKUP_BLOB_READ_WRITE_TOKEN?.trim();
  if (dedicatedToken) return true;
  // Local development may share the primary store so the backup workflow can be
  // exercised. Production must use a separate store so one storage incident cannot
  // destroy both live uploads and disaster-recovery copies.
  return process.env.NODE_ENV !== "production" && Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
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

/**
 * Errors that this code throws on purpose carry a Dutch sentence meant for the user. Anything
 * else — a PostgREST/Postgres error, a provider failure, a network error — is a technical
 * detail: it goes to the log under a reference, and the user gets a plain sentence with that
 * reference instead of database internals.
 */
function isTechnicalError(error: unknown, message: string) {
  if (!message) return true;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code.length > 0) return true;
  return /permission denied|violates|relation |column |syntax|does not exist|duplicate key|JWT|PGRST|fetch failed|ECONN|ETIMEDOUT|socket|undefined|null value|BLOB_|STORED_BLOB/i.test(message);
}

export function storageErrorResponse(error: unknown, request?: Request, category: LogCategory = "api") {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? "");
  if (message === "STORAGE_AUTH_REQUIRED") return storageJson({ error: "Aanmelden is vereist." }, 401);
  if (message === "STORAGE_AUTH_EXPIRED") return storageJson({ error: "Je sessie is verlopen." }, 401);
  const requestId = requestIdFrom(request);
  logEvent("error", category, "request_failed", {
    requestId,
    path: request ? new URL(request.url).pathname : undefined,
    error,
  });
  if (message === "STORAGE_SUPABASE_CONFIGURATION_MISSING") {
    return storageJson({ error: "De beveiligde koppeling voor bestandsopslag ontbreekt.", reference: requestId }, 503);
  }
  const userMessage = isTechnicalError(error, message)
    ? "De aanvraag kon niet worden verwerkt. Er is niets als opgeslagen gemarkeerd; probeer het opnieuw."
    : message;
  return storageJson({ error: `${userMessage} (referentie ${requestId.slice(0, 12)})`, reference: requestId }, 500);
}
