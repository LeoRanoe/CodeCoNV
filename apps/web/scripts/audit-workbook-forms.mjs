/**
 * Workbook audit: compares every form sheet of the client's workbook (exported to JSON by
 * scripts/export-workbook-forms.py) with the Workspace form the app builds from it.
 *
 *   python scripts/export-workbook-forms.py <workbook.xlsx> <out.json>
 *   node scripts/audit-workbook-forms.mjs <out.json>
 *
 * For each sheet row it reports whether the row is on screen with the sheet's label, in the
 * sheet's order, and whether "Required? = Yes" is required in the app. System rows (record ID,
 * project, reported by, workflow panel and status) are in the form head and the saved record.
 */
import { readFile } from "node:fs/promises";
import { sheetLayouts, specForms } from "../lib/forms/spec-forms.ts";

const source = JSON.parse(await readFile(process.argv[2], "utf8"));
const systemControl = /system-generated|auto-filled user|auto-filled date\/time|linked workflow panel|^auto-filled$/i;
const norm = (value) => String(value ?? "").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/[?:*]/g, "").trim();

function appRows(form) {
  const fields = new Map(specForms[form].map((field) => [field.key, field]));
  const layout = sheetLayouts[form] ?? specForms[form].map((field) => field.key);
  return layout.map((item) => {
    if (typeof item === "string") {
      const field = fields.get(item);
      // A derived status with an initial value (set only by workflow actions) always holds a value.
      const held = Boolean(field?.derived && field?.initial);
      return { label: field?.label.en ?? item, required: field?.required === true || held ? "yes" : typeof field?.required === "function" ? "conditional" : "no", keys: [item] };
    }
    if ("slot" in item) return { label: item.label.en, required: item.required ? "yes" : "no", keys: [item.slot] };
    const first = item.items[0];
    const firstField = typeof first === "string" ? fields.get(first) : undefined;
    const label = item.label?.en ?? (typeof first === "string" ? firstField?.label.en : first.label.en) ?? item.row;
    const anyRequired = item.required || item.items.some((part) => typeof part === "string" ? fields.get(part)?.required === true : part.required);
    const anyConditional = item.items.some((part) => typeof part === "string" && typeof fields.get(part)?.required === "function");
    return { label, required: anyRequired ? "yes" : anyConditional ? "conditional" : "no", keys: item.items.map((part) => (typeof part === "string" ? part : part.slot)) };
  });
}

const report = [];
let passed = 0;
let total = 0;
for (const [form, rows] of Object.entries(source)) {
  const app = appRows(form);
  let cursor = -1;
  for (const row of rows) {
    total += 1;
    if (systemControl.test(row.control)) {
      passed += 1;
      report.push({ form, ...row, result: "system", note: "form head / saved record" });
      continue;
    }
    const index = app.findIndex((item) => norm(item.label) === norm(row.label));
    const notes = [];
    if (index < 0) notes.push("label not on screen");
    else {
      if (index < cursor) notes.push("out of sheet order");
      cursor = Math.max(cursor, index);
      const wbRequired = norm(row.required);
      const appRequired = app[index].required;
      if (wbRequired === "yes" && appRequired === "no") notes.push("workbook requires it; app optional");
      if (wbRequired === "no" && appRequired === "yes") notes.push("workbook optional; app requires it");
    }
    if (!notes.length) passed += 1;
    report.push({ form, ...row, result: notes.length ? "check" : "pass", note: notes.join("; "), app: index >= 0 ? app[index] : null });
  }
}
for (const item of report.filter((entry) => entry.result === "check")) {
  console.log(`${item.form} row ${item.excel_row} "${item.label}" (${item.required}) — ${item.note}${item.app ? ` · app: "${item.app.label}" ${item.app.required}` : ""}`);
}
console.log(`\n${passed}/${total} workbook rows pass (system rows counted as in the form head).`);
