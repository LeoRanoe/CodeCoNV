import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./trace-upload-failure-4/0-trace.network", import.meta.url), "utf8");
const rows = source
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((entry) => entry.type === "resource-snapshot")
  .map((entry) => entry.snapshot)
  .filter((snapshot) => /storage|blob|upload/i.test(snapshot.request.url))
  .map((snapshot) => ({
    status: snapshot.response.status,
    method: snapshot.request.method,
    url: snapshot.request.url.replace(/[?].*$/, "?<redacted>"),
    responseBodySha1: snapshot.response.content?._sha1 ?? null,
  }));

process.stdout.write(JSON.stringify(rows, null, 2));
