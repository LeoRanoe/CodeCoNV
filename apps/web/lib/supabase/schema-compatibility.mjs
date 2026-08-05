/**
 * PostgREST uses more than one error shape for a schema that is still refreshing or
 * has not received the latest migration. Keep the matcher independent from Supabase so
 * the real responses can be covered by the fast node:test suite.
 *
 * @param {{ message?: string } | null | undefined} error
 * @param {string | string[]} features
 */
export function schemaFeatureMissing(error, features) {
  const message = error?.message?.toLowerCase() ?? "";
  const candidates = (Array.isArray(features) ? features : [features])
    .map((feature) => String(feature).trim().toLowerCase())
    .filter(Boolean);

  if (!candidates.some((feature) => message.includes(feature))) return false;
  return message.includes("does not exist")
    || message.includes("schema cache")
    || message.includes("could not find");
}
