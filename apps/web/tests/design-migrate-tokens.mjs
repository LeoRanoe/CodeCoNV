/* One-time, deterministic migration of legacy declarations to the CODECO token set.
   The OKLab nearest-neighbour pass is intentionally followed by screen review. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";

const app = new URL("../app/", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const legacy = join(app, "styles", "legacy");
const tokens = readFileSync(join(app, "styles", "tokens.css"), "utf8");
const palette = [...tokens.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)]
  .filter(([, name]) => !["--landing-yellow", "--signal-dark", "--signal-soft"].includes(name))
  .map(([, name, hex]) => ({ name, lab: toOKLab(hex) }));
const sizes = [12, 14, 16, 18, 22, 28];
const sizeName = ["--text-xs", "--text-sm", "--text-md", "--text-lg", "--text-xl", "--text-2xl"];
const radius = [6, 10];
const counts = { hex: 0, fontSize: 0, fontWeight: 0, radius: 0, shadows: 0, gradients: 0, blurs: 0, breakpoints: 0 };

function toOKLab(hex) {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((ch) => ch + ch).join("")}` : hex;
  const rgb = [1, 3, 5].map((at) => parseInt(full.slice(at, at + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = 0.4122214708 * rgb[0] + 0.5363325363 * rgb[1] + 0.0514459929 * rgb[2];
  const m = 0.2119034982 * rgb[0] + 0.6806995451 * rgb[1] + 0.1073969566 * rgb[2];
  const s = 0.0883024619 * rgb[0] + 0.2817188376 * rgb[1] + 0.6299787005 * rgb[2];
  return [
    0.2104542553 * Math.cbrt(l) + 0.793617785 * Math.cbrt(m) - 0.0040720468 * Math.cbrt(s),
    1.9779984951 * Math.cbrt(l) - 2.428592205 * Math.cbrt(m) + 0.4505937099 * Math.cbrt(s),
    0.0259040371 * Math.cbrt(l) + 0.7827717662 * Math.cbrt(m) - 0.808675766 * Math.cbrt(s),
  ];
}

function nearestColor(value) {
  const lab = toOKLab(value);
  return palette.reduce((best, entry) => {
    const distance = lab.reduce((sum, channel, i) => sum + (channel - entry.lab[i]) ** 2, 0);
    return distance < best.distance ? { name: entry.name, distance } : best;
  }, { distance: Infinity }).name;
}

function nearestSize(value) {
  const px = Number(value[1]) * (value[2] === "rem" ? 16 : 1);
  const index = sizes.reduce((best, size, i) => Math.abs(size - px) < Math.abs(sizes[best] - px) ? i : best, 0);
  return `var(${sizeName[index]})`;
}

for (const name of readdirSync(legacy).filter((file) => file.endsWith(".css"))) {
  const file = join(legacy, name);
  const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  root.walkAtRules("media", (rule) => {
    rule.params = rule.params.replace(/(min|max)-width\s*:\s*(\d+)px/g, (match, kind, width) => {
      const n = Number(width);
      const closest = [640, 1024, 1280].reduce((best, option) => Math.abs(option - n) < Math.abs(best - n) ? option : best, 640);
      if (closest !== n) counts.breakpoints++;
      return `${kind}-width: ${closest}px`;
    });
  });
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    const parent = decl.parent?.selector ?? "";
    if (prop.includes("backdrop-filter")) { decl.remove(); counts.blurs++; return; }
    if (/(?:linear|radial)-gradient\s*\(/.test(decl.value)) {
      if (!(parent.includes("photo") && /linear-gradient\(transparent/.test(decl.value))) {
        if (prop === "background" || prop === "background-color") decl.value = "var(--paper)";
        else if (prop === "background-image") decl.value = "none";
        counts.gradients++;
      }
    }
    if (prop === "box-shadow" && decl.value !== "none" && !decl.value.includes("var(")) {
      decl.value = /modal|dialog|menu|popover|tooltip|sheet/.test(parent) ? "var(--shadow-overlay)" : "none";
      counts.shadows++;
    }
    decl.value = decl.value.replace(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g, (hex) => {
      counts.hex++;
      return `var(${nearestColor(hex)})`;
    });
    if (prop === "font-size") {
      decl.value = decl.value.replace(/(?<![\d.])(\d*\.?\d+)(px|rem)\b/g, (...match) => {
        counts.fontSize++;
        return nearestSize(match);
      });
    }
    if (prop === "font-weight") {
      decl.value = decl.value.replace(/\b([1-9]\d{2})\b/g, (match) => {
        const n = Number(match);
        counts.fontWeight++;
        return `var(${n >= 620 ? "--weight-bold" : n >= 500 ? "--weight-semibold" : "--weight-normal"})`;
      });
    }
    if (prop === "border-radius") {
      decl.value = decl.value.replace(/(\d+(?:\.\d+)?)px\b/g, (match, value) => {
        counts.radius++;
        const n = Number(value);
        return `var(${Math.abs(radius[0] - n) <= Math.abs(radius[1] - n) ? "--radius-sm" : "--radius-md"})`;
      }).replace(/\b50%\b/g, "var(--radius-pill)");
    }
  });
  writeFileSync(file, root.toString());
}
console.log(JSON.stringify(counts, null, 2));
