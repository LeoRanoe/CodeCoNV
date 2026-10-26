import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const app = new URL("../app/", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const baselinePath = new URL("./design-baseline.json", import.meta.url);
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

function files(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path, extension) : entry.name.endsWith(extension) ? [path] : [];
  });
}

const cssFiles = files(app, ".css");
const tsxFiles = files(app, ".tsx");
const css = cssFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const tsx = tsxFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const matches = (value, pattern) => [...value.matchAll(pattern)].length;
const defined = new Set([...css.matchAll(/(^|[;{\s])(--[\w-]+)\s*:/gm)].map((match) => match[2]));
const used = new Set([...`${css}\n${tsx}`.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]));
const runtimeProperties = new Set(["--font-geist-mono", "--font-hind", "--font-jost", "--markup-tone", "--pin-inverse-scale"]);
const undefinedProperties = [...used].filter((name) => !defined.has(name) && !runtimeProperties.has(name)).sort();
const invalidWeights = [...css.matchAll(/font-weight\s*:\s*(\d{3})(?!\d)/g)].filter((match) => ![400, 600, 700].includes(Number(match[1]))).length;
const inlineColours = matches(tsx, /style\s*=\s*\{\{[^}]*?(?:color|backgroundColor|borderColor)\s*:/gs);
const gradients = matches(css, /(?:linear|radial)-gradient\s*\(/g);
const blurs = matches(css, /(?:-webkit-)?backdrop-filter\s*:/g);
const metric = { gradients, blurs, invalidWeights, inlineColours, undefinedProperties: undefinedProperties.length };

if (process.argv.includes("--print-baseline")) {
  console.log(JSON.stringify(metric, null, 2));
  process.exit(0);
}

for (const [name, current] of Object.entries(metric)) {
  test(`${name} does not exceed its baseline`, () => {
    assert.ok(current <= baseline[name], `${name}: ${current} exceeds baseline ${baseline[name]}`);
  });
}

test("all runtime or token custom properties are accounted for", () => {
  assert.deepEqual(undefinedProperties, baseline.undefinedPropertyNames ?? []);
});
