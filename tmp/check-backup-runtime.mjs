import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "../apps/web/node_modules/@supabase/supabase-js/dist/index.mjs";

const envText = await readFile(new URL("../apps/web/.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const users = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
if (users.error) throw users.error;
const releaseUsers = users.data.users
  .filter((user) => user.user_metadata?.release_demo === true && user.email)
  .sort((left, right) => right.created_at.localeCompare(left.created_at));

let fixture = null;
for (const user of releaseUsers) {
  const memberships = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (memberships.error) throw memberships.error;
  for (const membership of memberships.data ?? []) {
    const project = await admin
      .from("projects")
      .select("id,name")
      .eq("organization_id", membership.organization_id)
      .eq("name", "Paramaribo Field Readiness Demo")
      .maybeSingle();
    if (project.error) throw project.error;
    if (project.data) {
      fixture = { user, organizationId: membership.organization_id };
      break;
    }
  }
  if (fixture) break;
}
if (!fixture?.user.email) throw new Error("Isolated release backup fixture was not found.");

const password = `Cd!${randomBytes(24).toString("base64url")}7a`;
const updated = await admin.auth.admin.updateUserById(fixture.user.id, { password });
if (updated.error) throw updated.error;

const browserClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const signedIn = await browserClient.auth.signInWithPassword({ email: fixture.user.email, password });
if (signedIn.error || !signedIn.data.session?.access_token) {
  throw signedIn.error ?? new Error("Release backup fixture could not sign in.");
}

const response = await fetch("http://127.0.0.1:3000/api/backups/ensure-daily", {
  method: "POST",
  headers: {
    authorization: `Bearer ${signedIn.data.session.access_token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ organizationId: fixture.organizationId }),
});
const payload = await response.json().catch(() => ({}));
const latest = await admin
  .from("backup_runs")
  .select("status,run_type,sha256,size_bytes,storage_object_key,verified_at")
  .eq("organization_id", fixture.organizationId)
  .order("created_at", { ascending: false })
  .limit(5);
if (latest.error) throw latest.error;

process.stdout.write(JSON.stringify({
  httpStatus: response.status,
  responseStatus: payload.status ?? null,
  verified: payload.verified === true,
  runs: (latest.data ?? []).map((run) => ({
    status: run.status,
    runType: run.run_type,
    checksumPresent: Boolean(run.sha256),
    bytes: Number(run.size_bytes ?? 0),
    privatePathPresent: String(run.storage_object_key ?? "").startsWith("backups/organizations/"),
    verifiedAtPresent: Boolean(run.verified_at),
  })),
}, null, 2));
