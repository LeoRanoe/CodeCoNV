import assert from "node:assert/strict";
import test from "node:test";
import { logEvent, requestIdFrom } from "../lib/observability/log.ts";

function capture(run) {
  const lines = [];
  const original = { error: console.error, warn: console.warn, info: console.info };
  console.error = console.warn = console.info = (line) => lines.push(JSON.parse(line));
  try { run(); } finally { Object.assign(console, original); }
  return lines;
}

test("structured logs never carry secrets, tokens or inline signatures", () => {
  const [line] = capture(() => logEvent("error", "external_share", "response_rejected", {
    requestId: "req-1",
    token: "a".repeat(48),
    authorization: "Bearer secret",
    nested: { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x", signature_image: "data:image/png;base64,AAAA" },
    note: "data:image/png;base64,BBBB",
    error: Object.assign(new Error("permission denied for table files"), { code: "42501" }),
  }));
  assert.equal(line.level, "error");
  assert.equal(line.category, "external_share");
  assert.equal(line.event, "response_rejected");
  assert.equal(line.requestId, "req-1");
  assert.equal(line.token, "[redacted]");
  assert.equal(line.authorization, "[redacted]");
  assert.equal(line.nested.BLOB_READ_WRITE_TOKEN, "[redacted]");
  assert.equal(line.nested.signature_image, "[redacted]");
  assert.equal(line.note, "[inline data omitted]");
  assert.deepEqual(line.error, { name: "Error", message: "permission denied for table files", code: "42501" });
  assert.doesNotMatch(JSON.stringify(line), /secret|vercel_blob_rw|AAAA|BBBB/);
});

test("a request id comes from the platform when present", () => {
  assert.equal(requestIdFrom(new Request("https://x.test", { headers: { "x-vercel-id": "iad1::abc-123" } })), "abc-123");
  assert.match(requestIdFrom(null), /^[0-9a-f-]{36}$/);
});
