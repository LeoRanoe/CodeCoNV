import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// The helper is plain ESM, so the test loads the real thing.
const { pageAll } = await import("../lib/supabase/page-all.mjs");

/** A table of `total` rows behind an API that never returns more than `cap` rows per request. */
function table(total, cap = 1000) {
  const calls = [];
  const query = async (from, to) => {
    calls.push([from, to]);
    const end = Math.min(to, from + cap - 1, total - 1);
    return { data: from > end ? [] : Array.from({ length: end - from + 1 }, (_, index) => ({ id: from + index })), error: null };
  };
  return { query, calls };
}

test("reads past the 1000-row API limit and past the old 100-row caps", async () => {
  const { query, calls } = table(2450);
  const result = await pageAll(query);
  assert.equal(result.data.length, 2450);
  assert.equal(result.truncated, false);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.deepEqual(result.data.map((row) => row.id), Array.from({ length: 2450 }, (_, index) => index));
});

test("a table that fits in one page costs one request, an exact multiple costs one extra", async () => {
  const small = table(124);
  assert.equal((await pageAll(small.query)).data.length, 124);
  assert.equal(small.calls.length, 1);
  const exact = table(2000);
  assert.equal((await pageAll(exact.query)).data.length, 2000);
  assert.equal(exact.calls.length, 3);
});

test("an empty table is an empty list, not an error", async () => {
  const result = await pageAll(table(0).query);
  assert.deepEqual(result, { data: [], error: null, truncated: false });
});

test("the first failing page fails the whole read instead of returning part of it", async () => {
  const failure = { message: "boom", code: "XX000", details: "", hint: "", name: "PostgrestError" };
  let call = 0;
  const result = await pageAll(async () => (++call === 2 ? { data: null, error: failure } : { data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }));
  assert.equal(result.data, null);
  assert.equal(result.error, failure);
});

test("reaching the ceiling is reported, not hidden", async () => {
  const result = await pageAll(table(5000).query, 2000);
  assert.equal(result.data.length, 2000);
  assert.equal(result.truncated, true);
});

test("no list the app shows is cut at a fixed small row count any more", async () => {
  const source = await readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8");
  const loader = source.slice(source.indexOf("export async function loadProjectOperations"), source.indexOf("const registerWithoutSignatureResult"));
  assert.doesNotMatch(loader, /\.limit\((100|250|500|1000|2000|5000)\)/);
  assert.match(loader, /pageAll\(\(from, to\) => client\.from\("findings"\)/);
});
