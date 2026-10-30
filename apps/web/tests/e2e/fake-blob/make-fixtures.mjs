/**
 * Writes the picture files the media spec uploads (three photos, a 360° image, a drawing) into
 * a folder and prints the CODECO_E2E_* variables that point at them:
 *
 *   node tests/e2e/fake-blob/make-fixtures.mjs <folder>
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const folder = resolve(process.argv[2] ?? "tmp/e2e-fixtures");
mkdirSync(folder, { recursive: true });

function svg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
}

async function photo(name, hue) {
  const body = `<rect width="1200" height="800" fill="hsl(${hue},30%,70%)"/>
    <rect x="120" y="500" width="960" height="220" fill="hsl(${hue},25%,45%)"/>
    <rect x="260" y="180" width="140" height="320" fill="hsl(${hue},20%,35%)"/>
    <rect x="620" y="240" width="320" height="260" fill="hsl(${hue},25%,55%)"/>
    <text x="60" y="90" font-size="48" font-family="sans-serif" fill="#222">${name}</text>`;
  const file = join(folder, `${name}.jpg`);
  await sharp(svg(1200, 800, body)).jpeg({ quality: 82 }).toFile(file);
  return file;
}

const photoOne = await photo("site-photo-one", 30);
const photoTwo = await photo("site-photo-two", 150);
const photoThree = await photo("site-photo-three", 260);

const panoramaFile = join(folder, "tour-360.jpg");
await sharp(svg(2048, 1024, `<rect width="2048" height="1024" fill="#9bb7c9"/>
  <rect y="560" width="2048" height="464" fill="#6d7f4f"/>
  <rect x="300" y="300" width="360" height="300" fill="#b0a58f"/>
  <rect x="1200" y="260" width="460" height="340" fill="#a39b88"/>
  <text x="80" y="120" font-size="64" font-family="sans-serif" fill="#222">360 tour</text>`)).jpeg({ quality: 80 }).toFile(panoramaFile);

const drawingFile = join(folder, "floor-plan.png");
await sharp(svg(1600, 1000, `<rect width="1600" height="1000" fill="#ffffff"/>
  <g stroke="#222" stroke-width="4" fill="none">
    <rect x="120" y="120" width="1360" height="760"/>
    <line x1="560" y1="120" x2="560" y2="880"/>
    <line x1="1020" y1="120" x2="1020" y2="500"/>
    <line x1="560" y1="500" x2="1480" y2="500"/>
  </g>
  <text x="140" y="170" font-size="36" font-family="sans-serif" fill="#222">B1 ground floor</text>`)).png().toFile(drawingFile);

const lines = {
  CODECO_E2E_PHOTO_1: photoOne,
  CODECO_E2E_PHOTO_2: photoTwo,
  CODECO_E2E_PHOTO_3: photoThree,
  CODECO_E2E_360: panoramaFile,
  CODECO_E2E_DRAWING: drawingFile,
};
for (const [key, value] of Object.entries(lines)) console.log(`export ${key}="${value.replace(/\\/g, "/")}"`);
