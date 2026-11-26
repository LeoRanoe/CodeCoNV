/**
 * Writes the rule table into the current forward migration.
 *
 *   node scripts/write-spec-rules-migration.mjs
 *
 * The migration body lives between the markers; only the JSON literal is regenerated.
 */
import { readFile, writeFile } from "node:fs/promises";
import { specServerRules } from "./generate-spec-server-rules.mjs";

const file = new URL("../../../supabase/migrations/202611250009_close_verify_approve_dialog.sql", import.meta.url);
const sql = await readFile(file, "utf8");
const json = JSON.stringify(specServerRules()).replace(/'/g, "''");
// Only the literal inside spec_form_rules(); other functions of the migration also select a JSON literal.
const start = sql.indexOf("function app_private.spec_form_rules()");
if (start < 0) throw new Error("spec_form_rules not found");
const next = sql.slice(0, start) + sql.slice(start).replace(/select '(\{.*?\})'::jsonb;\n\$rules\$/s, () => `select '${json}'::jsonb;\n$rules$`);
if (next === sql && !sql.includes(json)) throw new Error("rule literal not found");
await writeFile(file, next);
