/**
 * Starts the fake Blob store and the app against it:
 *
 *   node tests/e2e/fake-blob/run-stack.mjs dev     (next dev)
 *   node tests/e2e/fake-blob/run-stack.mjs start   (next build, then next start)
 *
 * Both talk to the local Supabase stack only. The Blob and backup tokens are fake and the Blob API
 * address is a port on this machine, so a photo or drawing saved through the app never leaves it.
 * It refuses to run when the Supabase address is not local.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startFakeBlob } from "./server.mjs";

const mode = process.argv[2] === "start" ? "start" : "dev";
const port = Number(process.env.FAKE_BLOB_PORT || 3411);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(supabaseUrl)) {
  console.error(`Refusing to start: NEXT_PUBLIC_SUPABASE_URL (${supabaseUrl}) is not a local address.`);
  process.exit(1);
}

await startFakeBlob(port);
const fakeToken = "vercel_blob_rw_fakestore0001_localonlynotarealsecret";
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  BLOB_READ_WRITE_TOKEN: fakeToken,
  BACKUP_BLOB_READ_WRITE_TOKEN: fakeToken,
  VERCEL_BLOB_API_URL: `http://127.0.0.1:${port}`,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${join(root, "tests", "e2e", "fake-blob", "preload.cjs").replace(/\\/g, "/")}`.trim(),
};

const next = join(root, "node_modules", "next", "dist", "bin", "next");
function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [next, ...args], { cwd: root, env, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

if (mode === "start") {
  const built = await run(["build"]);
  if (built !== 0) process.exit(built);
  process.exit(await run(["start"]));
} else {
  process.exit(await run(["dev"]));
}
