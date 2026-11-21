/**
 * Writes the rule table into supabase/migrations/202611240001_spec_conditional_validation.sql.
 *
 *   node scripts/write-spec-rules-migration.mjs
 *
 * The migration body lives between the markers; only the JSON literal is regenerated.
 */
import { readFile, writeFile } from "node:fs/promises";
import { specServerRules } from "./generate-spec-server-rules.mjs";

const file = new URL("../../../supabase/migrations/202611240001_spec_conditional_validation.sql", import.meta.url);
const sql = await readFile(file, "utf8");
const json = JSON.stringify(specServerRules()).replace(/'/g, "''");
const next = sql.replace(/select '(\{.*?\})'::jsonb;\n\$rules\$/s, () => `select '${json}'::jsonb;\n$rules$`);
if (next === sql && !sql.includes(json)) throw new Error("rule literal not found");
await writeFile(file, next);
