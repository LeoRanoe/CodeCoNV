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
const releaseUser = users.data.users.find((user) => user.user_metadata?.release_demo === true);
if (!releaseUser?.email) throw new Error("No release-demo user.");

const password = `Cd!${randomBytes(24).toString("base64url")}7a`;
const updated = await admin.auth.admin.updateUserById(releaseUser.id, { password });
if (updated.error) throw updated.error;

const userClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const signedIn = await userClient.auth.signInWithPassword({ email: releaseUser.email, password });
if (signedIn.error) throw signedIn.error;

const result = await userClient.rpc("consume_security_rate_limit", {
  p_action_code: "blob_upload",
  p_max_requests: 60,
  p_window_minutes: 60,
});
process.stdout.write(JSON.stringify({ data: result.data, error: result.error }, null, 2));
