/**
 * Workbook dropdown audit: for every dropdown row of the client's form sheets, compares the values the
 * workbook lists (in its order, with its Type -> Category groups) with the values the form offers.
 *
 *   python scripts/export-workbook-forms.py <workbook.xlsx> <out.json>
 *   node --experimental-strip-types scripts/audit-workbook-options.mjs <out.json>
 */
import { readFile } from "node:fs/promises";
import { projectList, sheetLayouts, specForms } from "../lib/forms/spec-forms.ts";

const source = JSON.parse(await readFile(process.argv[2], "utf8"));
const norm = (value) => String(value ?? "").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/[?:*]/g, "").trim();
// A workbook bullet is "Value" or "Value — what it means"; the value is what the form stores.
const valueOf = (line) => line.replace(/^[•\-\s]+/, "").split(/\s—\s/)[0].trim();

function workbookOptions(text) {
  const flat = [];
  const groups = {};
  let group = null;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[•\-]/.test(line)) {
      const value = valueOf(line);
      if (group) (groups[group] ??= []).push(value); else flat.push(value);
    } else if (line.endsWith(":")) {
      group = line.slice(0, -1).trim();
    }
  }
  if (!flat.length && !Object.keys(groups).length) {
    // A list written without bullets: one value per line, or "A / B / C" on one line.
    const lines = String(text ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((line) => !/register|project-|see developer|not a dropdown|list/i.test(line))) flat.push(...lines);
    else if (lines.length === 1 && /^[^;()]+( \/ [^;()]+){2,}$/.test(lines[0]) && !/register|project|list/i.test(lines[0])) flat.push(...lines[0].split(" / ").map((value) => value.trim()));
  }
  return { flat, groups };
}

const fieldsOf = (form) => new Map(specForms[form].map((field) => [field.key, field]));
function appItems(form) {
  const fields = fieldsOf(form);
  const layout = sheetLayouts[form] ?? specForms[form].map((field) => field.key);
  return layout.map((item) => {
    const parts = typeof item === "string" ? [item] : "items" in item ? item.items : [];
    const label = typeof item === "string" ? fields.get(item)?.label.en : item.label?.en ?? (typeof item.items?.[0] === "string" ? fields.get(item.items[0])?.label.en : item.items?.[0]?.label?.en);
    return { label, fields: parts.filter((part) => typeof part === "string").map((key) => fields.get(key)).filter(Boolean) };
  });
}

function offered(field) {
  if (field.listKey) return { flat: projectList(field.listKey, null).map((option) => option.value), groups: {} };
  const groups = {};
  for (const [name, list] of Object.entries(field.groups ?? {})) groups[name] = list.map((option) => (typeof option === "string" ? option : option.value));
  const only = Object.keys(groups);
  if (only.length === 1 && only[0] === "all") return { flat: groups.all, groups: {} };
  return { flat: field.options ?? [], groups };
}

const compare = (expected, actual) => {
  const a = expected.map(norm);
  const b = actual.map(norm);
  const missing = expected.filter((value) => !b.includes(norm(value)));
  const extra = actual.filter((value) => !a.includes(norm(value)));
  const order = !missing.length && !extra.length && a.join("|") !== b.join("|");
  return { missing, extra, order };
};

let rows = 0;
let clean = 0;
const problems = [];
const manual = [];
for (const [form, list] of Object.entries(source)) {
  if (form === "photo") continue;
  const items = appItems(form);
  for (const row of list) {
    if (!/dropdown|multi/i.test(row.control)) continue;
    rows += 1;
    const wb = workbookOptions(row.values);
    if (!wb.flat.length && !Object.keys(wb.groups).length) { manual.push(`${form} row ${row.excel_row} "${row.label}": ${String(row.values).slice(0, 80).replace(/\n/g, " ")}`); clean += 1; continue; }
    const item = items.find((candidate) => norm(candidate.label) === norm(row.label));
    const field = item?.fields.find((candidate) => candidate.options || candidate.groups || candidate.listKey);
    if (!field) { problems.push(`${form} row ${row.excel_row} "${row.label}": no dropdown field found on the form`); continue; }
    const app = offered(field);
    const notes = [];
    if (wb.flat.length) {
      const result = compare(wb.flat, app.flat);
      if (result.missing.length) notes.push(`missing: ${result.missing.join(" | ")}`);
      if (result.extra.length) notes.push(`extra: ${result.extra.join(" | ")}`);
      if (result.order) notes.push("same values, different order");
    }
    for (const [name, values] of Object.entries(wb.groups)) {
      const key = Object.keys(app.groups).find((candidate) => norm(candidate) === norm(name));
      if (!key) { notes.push(`group "${name}" not on the form`); continue; }
      const result = compare(values, app.groups[key]);
      if (result.missing.length) notes.push(`${name} missing: ${result.missing.join(" | ")}`);
      if (result.extra.length) notes.push(`${name} extra: ${result.extra.join(" | ")}`);
      if (result.order) notes.push(`${name}: same values, different order`);
    }
    for (const name of Object.keys(app.groups)) if (wb.flat.length === 0 && !Object.keys(wb.groups).some((candidate) => norm(candidate) === norm(name))) notes.push(`group "${name}" is on the form but not in the workbook`);
    if (notes.length) problems.push(`${form} row ${row.excel_row} "${row.label}": ${notes.join("; ")}`); else clean += 1;
  }
}
console.log(`${clean}/${rows} dropdown rows match the workbook (${manual.length} have no value list in the workbook).`);
for (const line of problems) console.log("DIFF", line);
for (const line of manual) console.log("NOTE", line);
