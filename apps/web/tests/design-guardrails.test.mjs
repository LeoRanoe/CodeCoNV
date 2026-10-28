import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const app = new URL("../app/", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const targets = { colors: 40, sizes: 6, weights: 3, radii: 3, shadows: 1, breakpoints: 3 };

function files(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path, extension) : entry.name.endsWith(extension) ? [path] : [];
  });
}

// The public landing route has its own Jost type system. Supervisie rules
// cover globals.css and the imported app styles,.
const cssFiles = [join(app, "globals.css"), ...files(join(app, "styles"), ".css")];
const css = cssFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const tsx = files(app, ".tsx").map((file) => readFileSync(file, "utf8")).join("\n");
const tokens = readFileSync(join(app, "styles", "tokens.css"), "utf8");
const matches = (value, pattern) => [...value.matchAll(pattern)].length;
const values = (value, pattern) => new Set([...value.matchAll(pattern)].map((match) => match[1].toLowerCase()));
const defined = new Set([...css.matchAll(/(^|[;{\s])(--[\w-]+)\s*:/gm)].map((match) => match[2]));
const used = new Set([...`${css}\n${tsx}`.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]));
const runtimeProperties = new Set(["--font-geist-mono", "--font-hind", "--font-jost", "--markup-tone", "--pin-inverse-scale"]);
const undefinedProperties = [...used].filter((name) => !defined.has(name) && !runtimeProperties.has(name)).sort();
const invalidWeights = [...css.matchAll(/font-weight\s*:\s*(\d{3})(?!\d)/g)].filter((match) => ![400, 600, 700].includes(Number(match[1]))).length;
const inlineColours = matches(tsx, /style\s*=\s*\{\{[^}]*?(?:color|backgroundColor|borderColor)\s*:/gs);
const photoScrim = "linear-gradient(transparent, rgba(16,36,42,.86))";
const gradients = matches(css.replace(photoScrim, ""), /(?:linear|radial)-gradient\s*\(/g);
const blurs = matches(css, /(?:-webkit-)?backdrop-filter\s*:/g);
const metric = {
  colors: values(tokens, /(#[0-9a-fA-F]{3,8})\b/g).size,
  sizes: values(tokens, /--text-[\w-]+:\s*(\d+)px\s*;/g).size,
  weights: values(tokens, /--weight-[\w-]+:\s*(\d+)\s*;/g).size,
  radii: values(tokens, /--radius-[\w-]+:\s*(\d+)px\s*;/g).size,
  shadows: values(tokens, /--shadow-overlay:\s*([^;]+);/g).size,
  breakpoints: values(css, /@media[^\{]*?(?:min|max)-width\s*:\s*(\d+)px/g).size,
};

if (process.argv.includes("--print-baseline")) {
  console.log(JSON.stringify({ ...metric, gradients, blurs, invalidWeights, inlineColours, undefinedProperties }, null, 2));
  process.exit(0);
}

for (const [name, limit] of Object.entries(targets)) {
  test(`${name} stays within its design target`, () => {
    assert.ok(metric[name] <= limit, `${name}: ${metric[name]} exceeds target ${limit}`);
  });
}

test("only the photo legibility scrim uses a gradient", () => {
  assert.equal(matches(css, /(?:linear|radial)-gradient\s*\(/g), 1);
  assert.equal(gradients, 0);
});

test("app CSS has no blur or unsupported font weight", () => {
  assert.equal(blurs, 0);
  assert.equal(invalidWeights, 0);
});

test("TSX has no inline colours and every custom property is defined", () => {
  assert.equal(inlineColours, 0);
  assert.deepEqual(undefinedProperties, []);
});
