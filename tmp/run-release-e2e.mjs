import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "../apps/web/node_modules/@supabase/supabase-js/dist/index.mjs";

const envText = await readFile(new URL("../apps/web/.env", import.meta.url), "utf8");
const localEnv = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const admin = createClient(localEnv.NEXT_PUBLIC_SUPABASE_URL, localEnv.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const users = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
if (users.error) throw users.error;
const releaseUser = users.data.users
  .filter((user) => user.user_metadata?.release_demo === true)
  .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
if (!releaseUser?.email) throw new Error("No isolated release-demo user is available.");

const ephemeralPassword = `Cd!${randomBytes(24).toString("base64url")}7a`;
const updated = await admin.auth.admin.updateUserById(releaseUser.id, { password: ephemeralPassword });
if (updated.error) throw updated.error;

const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--reporter=list", ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)),
  env: {
    ...process.env,
    CODECO_E2E_BASE_URL: "http://127.0.0.1:3000",
    CODECO_E2E_REUSE_SERVER: "1",
    CODECO_E2E_EMAIL: releaseUser.email,
    CODECO_E2E_PASSWORD: ephemeralPassword,
    CODECO_E2E_PHOTO_1: fileURLToPath(new URL("./client_context/pdf_pages/ncr/page-1.png", import.meta.url)),
    CODECO_E2E_PHOTO_2: fileURLToPath(new URL("./client_context/pdf_pages/rfa/page-1.png", import.meta.url)),
    CODECO_E2E_PHOTO_3: fileURLToPath(new URL("./client_context/pdf_pages/wir/page-1.png", import.meta.url)),
    CODECO_E2E_360: fileURLToPath(new URL("./release-fixtures/official-photo-sphere-viewer-demo.jpg", import.meta.url)),
    CODECO_E2E_DRAWING: "C:\\Users\\lrano\\Desktop\\RfA SU-L1054-L-519.4 Lighting switch layout of Building B1.pdf",
  },
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
