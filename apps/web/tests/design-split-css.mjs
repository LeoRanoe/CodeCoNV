import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";

const app = new URL("../app/", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const cssPath = join(app, "globals.css");
const source = readFileSync(cssPath, "utf8");
const root = postcss.parse(source, { from: cssPath });
const tokenRule = root.nodes.find((node) => node.type === "rule" && node.selector === ":root");
if (!tokenRule?.source?.start?.offset || !tokenRule.source.end?.offset) {
  throw new Error("Could not locate the original :root token block");
}

const start = tokenRule.source.end.offset + 1;
const legacy = source.slice(start);
const nodes = root.nodes.filter((node) => node.source?.start?.offset >= start);
const desiredParts = 12;
const targetLength = legacy.length / desiredParts;
const fragments = [];
let lastOffset = start;
let partStart = start;
for (const node of nodes) {
  const end = node.source.end.offset + 1;
  if (end - partStart >= targetLength && fragments.length < desiredParts - 1) {
    fragments.push(source.slice(lastOffset, end));
    lastOffset = end;
    partStart = end;
  }
}
fragments.push(source.slice(lastOffset));

const hash = (value) => createHash("sha256").update(value).digest("hex");
if (fragments.join("") !== legacy) throw new Error("Split changed the CSS declaration stream");

mkdirSync(join(app, "styles", "legacy"), { recursive: true });
const imports = fragments.map((value, index) => {
  const name = `legacy-${String(index + 1).padStart(2, "0")}.css`;
  writeFileSync(join(app, "styles", "legacy", name), value);
  return `@import "./styles/legacy/${name}";`;
});

const areas = [
  "shell", "overview", "workspace", "projects", "management", "reports",
  "forms", "records", "media", "field-tools", "share", "misc",
];
for (const area of areas) writeFileSync(join(app, "styles", `${area}.css`), `/* ${area} screen refinements. */\n`);

const originalImports = source.slice(0, tokenRule.source.start.offset).trimEnd();
writeFileSync(cssPath, [
  originalImports,
  '@import "./styles/tokens.css";',
  ...imports,
  '@import "./styles/components.css";',
  ...areas.map((area) => `@import "./styles/${area}.css";`),
  "",
].join("\n"));

writeFileSync(join(app, "..", "tests", "design-css-split.json"), JSON.stringify({
  originalSha256: hash(source),
  legacySha256: hash(legacy),
  combinedSha256: hash(fragments.join("")),
  fragmentCount: fragments.length,
  declarationOrderPreserved: true,
}, null, 2) + "\n");
console.log(`Split ${legacy.length} bytes into ${fragments.length} ordered fragments; sha256 ${hash(legacy)}`);
