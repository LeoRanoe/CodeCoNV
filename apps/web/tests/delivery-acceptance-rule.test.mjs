import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { traceableMaterialGroups } from "../lib/forms/spec-forms.ts";

const sql = await readFile(new URL("../../../supabase/migrations/202611250014_delivery_acceptance_traceable_groups.sql", import.meta.url), "utf8");

test("the database requires a complying compliance check for exactly the material groups the form marks as traceable", () => {
  const listed = sql.match(/v_traceable := [\s\S]*?in \(([\s\S]*?)\);/)[1].match(/'([^']+)'/g).map((item) => item.slice(1, -1));
  assert.deepEqual([...listed].sort(), [...traceableMaterialGroups].sort());
});
