import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const traceZip = resolve(
  workspace,
  "apps/web/test-results/artifacts/media-and-sharing-photo-st-4e964-ree-sharing-work-end-to-end-desktop-office/trace.zip",
);

function archiveText(entry) {
  return execFileSync("tar", ["-xOf", traceZip, entry], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).replace(/^\uFEFF/, "");
}

function loadEnvironment(path) {
  const values = new Map();
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const name = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(name, value);
  }
  return values;
}

const snapshots = archiveText("1-trace.network")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((entry) => entry.type === "resource-snapshot")
  .map((entry) => entry.snapshot);

const responseRequest = snapshots.find((snapshot) => (
  snapshot.request.method === "POST" && /\/api\/external-share\/[^/]+\/response$/.test(snapshot.request.url)
));
if (!responseRequest) throw new Error("External response request was not found in the trace.");

const traceUrl = new URL(responseRequest.request.url);
const token = traceUrl.pathname.split("/").at(-2);
const requestResource = responseRequest.request.postData?._sha1;
if (!token || !requestResource) throw new Error("Trace request is incomplete.");

const requestBody = JSON.parse(archiveText(`resources/${requestResource}`));
const env = loadEnvironment(resolve(workspace, "apps/web/.env"));
const supabaseUrl = env.get("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = env.get("SUPABASE_SECRET_KEY");
if (!supabaseUrl || !secretKey) throw new Error("Local Supabase debug configuration is missing.");

const result = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_external_share_response`, {
  method: "POST",
  headers: {
    apikey: secretKey,
    authorization: `Bearer ${secretKey}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    p_token: token,
    p_response_type: requestBody.responseType,
    p_note: requestBody.note,
    p_contact_name: requestBody.contactName || null,
    p_evidence_file_id: requestBody.evidenceFileId || null,
    p_idempotency_key: requestBody.idempotencyKey,
  }),
});
const payload = await result.json().catch(() => ({}));
process.stdout.write(JSON.stringify({
  status: result.status,
  code: payload.code ?? null,
  message: payload.message ?? null,
  details: payload.details ?? null,
  hint: payload.hint ?? null,
}, null, 2));
