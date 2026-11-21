/**
 * F03: the server's copy of each form's unconditional rules, generated from lib/forms/spec-forms.ts.
 *
 *   node scripts/generate-spec-server-rules.mjs            prints the JSON
 *
 * Only rules that hold whatever else is entered are exported: fields that are always required,
 * required rows, and the controlled values of fixed lists (dropdowns, multi-selects and dependent
 * lists). Conditional requirements stay in the form (specMissing) because they depend on other
 * answers; project-configurable lists (listKey) and ratings are left to the project's settings.
 * tests/spec-server-rules.test.mjs checks that the migration carries exactly this output.
 */
import { sheetLayouts, specForms } from "../lib/forms/spec-forms.ts";

// Stored on the record itself, not in the spec object (building and location columns).
const storedElsewhere = new Set(["building_area"]);

export function specServerRules() {
  const rules = {};
  for (const [form, fields] of Object.entries(specForms)) {
    if (!sheetLayouts[form]) continue;
    const required = [];
    const rows = [];
    const options = {};
    const dependent = {};
    const labels = {};
    for (const field of fields) {
      if (field.derived || field.auto || storedElsewhere.has(field.key)) continue;
      labels[field.key] = field.label.en;
      const always = field.required === true && !field.visible;
      if (always && field.kind === "rows" && !field.rowsFrom) rows.push(field.key);
      else if (always && field.kind !== "rows") required.push(field.key);
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
    rules[form] = { required, rows, options, dependent, labels };
  }
  return rules;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("generate-spec-server-rules.mjs")) {
  process.stdout.write(JSON.stringify(specServerRules()));
}
