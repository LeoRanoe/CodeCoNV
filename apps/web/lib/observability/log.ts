/**
 * Structured server logging.
 *
 * Every line is one JSON object on stdout/stderr, which Vercel keeps as runtime logs (and
 * forwards to a log drain when one is configured). Operators search by `category`, `event`
 * or `requestId`; the requestId is also returned to the user as a support reference, so a
 * screenshot of an error message leads straight to the log line.
 *
 * Never log secrets or evidence content: values under sensitive keys are replaced, long
 * strings are truncated and inline images (signatures) are dropped.
 */

export type LogCategory =
  | "api"
  | "auth"
  | "storage"
  | "external_share"
  | "backup"
  | "cron"
  | "notification"
  | "offline_sync";

const sensitiveKey = /token|secret|password|authorization|cookie|signature|apikey|api_key|p256dh|auth_secret|service_role|private/i;

function redact(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.startsWith("data:")) return "[inline data omitted]";
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message), code: (value as { code?: unknown }).code };
  }
  if (depth > 3) return "[nested]";
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => redact(entry, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = sensitiveKey.test(key) ? "[redacted]" : redact(entry, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function requestIdFrom(request?: Request | null) {
  return request?.headers.get("x-vercel-id")?.split("::").pop()
    || request?.headers.get("x-request-id")
    || crypto.randomUUID();
}

export function logEvent(
  level: "info" | "warn" | "error",
  category: LogCategory,
  event: string,
  fields: Record<string, unknown> = {},
) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    category,
    event,
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
