/**
 * Which build is running, so an engineer can tell what a customer is using without reading code.
 * Nothing here is secret: a short commit, the Vercel environment and the database schema version
 * this build was written for. `expectedSchemaVersion` must equal the newest migration in
 * supabase/migrations (a test fails when it does not).
 */
export const expectedSchemaVersion = "202610290001";

export function releaseInfo(env: Record<string, string | undefined> = process.env) {
  const commit = (env.VERCEL_GIT_COMMIT_SHA ?? "").trim();
  return {
    commit: commit ? commit.slice(0, 12) : "local",
    branch: env.VERCEL_GIT_COMMIT_REF?.trim() || null,
    environment: env.VERCEL_ENV?.trim() || env.NODE_ENV || "unknown",
    deployment: env.VERCEL_DEPLOYMENT_ID?.trim() || null,
    expectedSchemaVersion,
  };
}
