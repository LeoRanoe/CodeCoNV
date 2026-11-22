import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";

/**
 * Every approved photo format through the photo library: JPEG, PNG, WebP, GIF, HEIC, HEIF and AVIF.
 * Choose the file, see the preview, mark it, save it, send it after a lost connection, and check what was kept:
 * the original's bytes (SHA-256, size and type), one visible gallery entry per photo, and the original
 * downloadable, byte for byte.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const url = process.env.CODECO_E2E_SUPABASE_URL;
const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
const photoPath = process.env.CODECO_E2E_PHOTO_1;
const uploads = process.env.CODECO_E2E_FAKE_BLOB === "1";
test.skip(!email || !password || !url || !key || !photoPath || !uploads, "A fixture account, the Supabase keys, a fixture photo and the fake Blob stack are required.");

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await form.locator("input[type='email']").fill(email!);
  await form.locator("input[type='password']").fill(password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  return new URL(page.url()).searchParams.get("project")!;
}

test("each approved photo format is previewed, marked, saved, kept as the exact original and downloadable", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "Runs on Chromium with local storage fixtures.");
  test.setTimeout(540_000);
  const stamp = Date.now().toString(36);
  const colour = (index: number) => ({ r: 40 + index * 25, g: 90, b: 160 - index * 15 });
  const heic = readFileSync(new URL("./fixtures/site-photo.heic", import.meta.url));
  const heif = Buffer.from(heic);
  heif.write("mif1", 8, "ascii");
  const gif = Buffer.concat([Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"), Buffer.from(`codeco-${stamp}`)]);
  const raster = (index: number) => sharp({ create: { width: 96, height: 64, channels: 3, background: colour(index) } });
  const formats: Array<{ ext: string; mime: string; bytes: Buffer }> = [
    { ext: "jpg", mime: "image/jpeg", bytes: Buffer.concat([readFileSync(photoPath!), Buffer.from(`codeco-${stamp}`)]) },
    { ext: "png", mime: "image/png", bytes: await raster(1).png().toBuffer() },
    { ext: "webp", mime: "image/webp", bytes: await raster(2).webp().toBuffer() },
    { ext: "gif", mime: "image/gif", bytes: gif },
    { ext: "heic", mime: "image/heic", bytes: heic },
    { ext: "heif", mime: "image/heif", bytes: heif },
    { ext: "avif", mime: "image/avif", bytes: await raster(3).avif().toBuffer() },
  ];
  const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

  const project = await signIn(page);
  const api = createClient(url!, key!, { auth: { persistSession: false } });
  expect((await api.auth.signInWithPassword({ email: email!, password: password! })).error).toBeNull();
  await page.goto(`/supervisie?project=${project}&nav=project&tab=files`);
  await expect(page.getByRole("heading", { name: "Project photos" })).toBeVisible();
  const review = page.locator(".media-capture-review");

  const choose = async (name: string, mime: string, buffer: Buffer) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /^Upload photos/ }).click();
    await (await chooser).setFiles({ name, mimeType: mime, buffer });
    await expect(review).toBeVisible({ timeout: 30_000 });
  };
  const preview = async () => {
    // The photo is shown, not a broken image.
    const image = review.locator("img").first();
    await expect(image).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth), { timeout: 30_000 }).toBeGreaterThan(0);
  };
  const markAndDescribe = async () => {
    await review.getByLabel(/Photo purpose/).selectOption("Site Conditions");
    await page.getByRole("button", { name: "Open the details of photo 1" }).click();
    await page.getByRole("button", { name: "Mark on photo" }).click();
    const markup = page.locator(".photo-markup-modal");
    await markup.getByRole("button", { name: "Photo. Tap to place a marker." }).press("Enter");
    await markup.getByRole("button", { name: "Save markings on the photo" }).click();
    await expect(markup).toHaveCount(0);
    await expect(review).toContainText("1 marked");
  };

  for (const [index, format] of formats.entries()) {
    const name = `fmt-${stamp}-${format.ext}.${format.ext}`;
    await choose(name, format.mime, format.bytes);
    await preview();
    await markAndDescribe();
    await review.locator(".ui-button--primary").first().click();
    await expect(review).toHaveCount(0, { timeout: 120_000 });
    console.log(`${index + 1}/${formats.length} ${format.ext} saved`);
  }

  // A connection that drops while a converted photo is saved: it waits on the device and is sent when the connection returns.
  const offline = { name: `fmt-${stamp}-offline.heic`, mime: "image/heic", bytes: heic };
  await choose(offline.name, offline.mime, offline.bytes);
  await preview();
  await review.getByLabel(/Photo purpose/).selectOption("Site Conditions");
  await context.setOffline(true);
  await review.locator(".ui-button--primary").first().click();
  await expect(page.locator(".offline-queue")).toContainText("1 upload(s) waiting", { timeout: 60_000 });
  await context.setOffline(false);
  await expect(page.locator(".offline-queue")).toHaveCount(0, { timeout: 180_000 });

  // What was kept.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Project photos" })).toBeVisible({ timeout: 60_000 });
  for (const format of [...formats, { ext: "heic", mime: offline.mime, bytes: offline.bytes, offline: true }]) {
    const name = "offline" in format ? offline.name : `fmt-${stamp}-${format.ext}.${format.ext}`;
    const find = async () => (await api.from("files").select("id,sha256,size_bytes,mime_type,original_name").eq("project_id", project).eq("original_name", name)).data?.[0] ?? null;
    await expect.poll(find, { timeout: 90_000, message: `${name} is stored` }).not.toBeNull();
    const original = (await find())!;
    expect(original.sha256, `${name}: SHA-256 of the original`).toBe(sha(format.bytes));
    expect(original.size_bytes, `${name}: size of the original`).toBe(format.bytes.length);
    expect(original.mime_type, `${name}: type of the original`).toBe(format.mime);
  }

  // One visible gallery entry per photo, and its original downloads byte for byte.
  for (const format of formats) {
    const name = `fmt-${stamp}-${format.ext}.${format.ext}`;
    // A marked photo is listed once, as its marked picture; the original is kept beside it, not listed again.
    const entries = page.getByRole("button", { name: new RegExp(`^Open the details of fmt-${stamp}-${format.ext}[.-]`) });
    await expect(entries, `${name}: one gallery entry`).toHaveCount(1, { timeout: 30_000 });
    await entries.first().click();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download original", exact: true }).click();
    const download = await downloadEvent;
    const saved = readFileSync((await download.path())!);
    expect(sha(saved), `${name}: downloaded original`).toBe(sha(format.bytes));
    await page.keyboard.press("Escape");
  }
});
