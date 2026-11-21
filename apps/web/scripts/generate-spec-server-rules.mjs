/**
 * F03: the server's copy of each form's rules, generated from lib/forms/spec-forms.ts.
 *
 *   node scripts/generate-spec-server-rules.mjs            prints the JSON
 *
 * Exported per workbook form:
 * - required / rows: fields and row lists that are always required;
 * - conditional: fields and row lists that are required when their condition holds (the form's own
 *   `visible`/`required` conditions, written as SpecCondition so the database evaluates the same);
 * - columns: required columns of each filled row;
 * - other: fields whose "Other" choice needs the short explanation (`<key>_other`);
 * - numbers: number fields with their bounds;
 * - options / dependent: the controlled values of fixed lists.
 * Left to the form: sensitive incident fields (moved to the restricted table before this check runs),
 * project-configurable lists (listKey) and ratings (the project's matrix), activity-guide lists and
 * fields stored outside the spec object. `clientOnly` names every conditional field the server
 * cannot evaluate; tests/spec-server-rules.test.mjs keeps that list explicit.
 * tests/spec-server-rules.test.mjs checks that the migration carries exactly this output.
 */
import { sheetLayouts, specForms } from "../lib/forms/spec-forms.ts";

// Stored on the record itself, not in the spec object (building and location columns).
const storedElsewhere = new Set(["building_area"]);

/** The condition under which a field must be filled, or undefined when it never is / cannot be exported. */
function requirement(field) {
  const parts = [];
  if (field.visible) {
    if (!field.visible.rule) return { clientOnly: true };
    parts.push(field.visible.rule);
  }
  if (typeof field.required === "function") {
    if (!field.required.rule) return { clientOnly: true };
    parts.push(field.required.rule);
  } else if (field.required !== true) {
    return undefined;
  }
  if (parts.length === 2 && JSON.stringify(parts[0]) === JSON.stringify(parts[1])) parts.pop();
  if (!parts.length) return { always: true };
  return { when: parts.length === 1 ? parts[0] : { all: parts } };
}

export function specServerRules() {
  const rules = {};
  for (const [form, fields] of Object.entries(specForms)) {
    if (!sheetLayouts[form]) continue;
    const required = [];
    const rows = [];
    const conditional = [];
    const columns = {};
    const other = [];
    const numbers = {};
    const options = {};
    const dependent = {};
    const labels = {};
    const clientOnly = [];
    for (const field of fields) {
      if (field.derived || field.auto || storedElsewhere.has(field.key)) continue;
      labels[field.key] = field.label.en;
      if (field.sensitive) {
        if (field.visible || typeof field.required === "function" || field.required === true) clientOnly.push(field.key);
        continue;
      }
      const need = requirement(field);
      if (need?.clientOnly) clientOnly.push(field.key);
      else if (need?.always && field.kind === "rows" && !field.rowsFrom) rows.push(field.key);
      else if (need?.always && field.kind !== "rows") required.push(field.key);
      else if (need?.when) conditional.push({ key: field.key, rows: field.kind === "rows" || undefined, when: need.when });
      if (field.kind === "rows") {
        const needed = (field.columns ?? []).filter((column) => column.required).map((column) => column.key);
        if (needed.length) {
          columns[field.key] = needed;
          for (const column of field.columns ?? []) if (column.required) labels[`${field.key}.${column.key}`] = column.label.en;
        }
      }
      if (field.otherExplanation && !field.sensitive) other.push(field.key);
      if (field.kind === "number") numbers[field.key] = { min: field.min ?? null, max: field.max ?? null };
      if ((field.kind === "select" || field.kind === "multi") && field.options?.length && !field.listKey) {
        options[field.key] = [...field.options];
      }
      if (field.kind === "dependent" && field.groups && !field.listKey) {
        dependent[field.key] = {
          parent: field.parent === "__all" ? null : field.parent,
          groups: Object.fromEntries(Object.entries(field.groups).map(([group, values]) => [group, values.map((item) => item.value)])),
        };
      }
    }
    // specMissing's own check: a finish before the start needs "Work crosses midnight" ticked.
    if (form === "works_ongoing") conditional.push({ key: "crosses_midnight", when: { earlier: ["finish_time", "start_time"] } });
    // JSON drops `undefined`, so the in-memory value and the stored copy compare equal.
    rules[form] = JSON.parse(JSON.stringify({ required, rows, conditional, columns, other, numbers, options, dependent, labels, clientOnly }));
  }
  return rules;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("generate-spec-server-rules.mjs")) {
  process.stdout.write(JSON.stringify(specServerRules()));
}
