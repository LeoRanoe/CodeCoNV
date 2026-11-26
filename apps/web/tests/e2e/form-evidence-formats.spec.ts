import { finishSigning } from "./sign-popup";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { fillSpecFields } from "./spec-fill";

/**
 * Photos attached to a named form (the Issue form): every approved format is accepted and previewed, the
 * original's bytes are kept (SHA-256 checked after the issue is saved), and a photo can be marked.
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

test("the Issue form takes every approved photo format, previews it, marks one and keeps the exact originals", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "Runs on Chromium with local storage fixtures.");
  test.setTimeout(420_000);
  const stamp = Date.now().toString(36);
  const heic = readFileSync(new URL("./fixtures/site-photo.heic", import.meta.url));
  const heif = Buffer.from(heic);
  heif.write("mif1", 8, "ascii");
  const raster = (red: number) => sharp({ create: { width: 96, height: 64, channels: 3, background: { r: red, g: 90, b: 160 } } });
  const formats: Array<{ ext: string; mime: string; bytes: Buffer }> = [
    { ext: "jpg", mime: "image/jpeg", bytes: Buffer.concat([readFileSync(photoPath!), Buffer.from(`form-${stamp}`)]) },
    { ext: "png", mime: "image/png", bytes: await raster(60).png().toBuffer() },
    { ext: "webp", mime: "image/webp", bytes: await raster(90).webp().toBuffer() },
    { ext: "gif", mime: "image/gif", bytes: Buffer.concat([Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"), Buffer.from(`form-${stamp}`)]) },
    { ext: "heic", mime: "image/heic", bytes: heic },
    { ext: "heif", mime: "image/heif", bytes: heif },
    { ext: "avif", mime: "image/avif", bytes: await raster(120).avif().toBuffer() },
  ];
  const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

  const project = await signIn(page);
  const api = createClient(url!, key!, { auth: { persistSession: false } });
  expect((await api.auth.signInWithPassword({ email: email!, password: password! })).error).toBeNull();
  await page.goto(`/supervisie?project=${project}&nav=project`);
  const back = page.locator(".workspace-back-button");
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.locator('[data-workspace-destination="issues"]').click();
  await expect(page.getByRole("heading", { name: "Create issue" })).toBeVisible();
  const title = `Format evidence ${stamp}`;
  await page.getByRole("combobox", { name: /Issue type/ }).selectOption({ label: "Quality" });
  await page.getByRole("combobox", { name: /^Category/ }).first().selectOption({ index: 1 });
  await page.getByRole("radio", { name: "High", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page.locator("textarea").first().fill(`${title}. One photo in every approved format.`);
  await page.getByRole("combobox", { name: /^Responsible party/ }).selectOption({ index: 1 });
  await page.getByRole("textbox", { name: /^Corrective action required/ }).fill("Check each attached photo.");

  const input = page.getByLabel("Add a file").first();
  for (const format of formats) {
    await input.setInputFiles({ name: `form-${stamp}-${format.ext}.${format.ext}`, mimeType: format.mime, buffer: format.bytes });
  }
  // Seven photos waiting, each with a picture and none refused.
  await expect(page.getByText("Describe", { exact: true })).toHaveCount(formats.length, { timeout: 60_000 });
  await expect(page.getByText(/could not be decoded|Use JPEG|Not added/)).toHaveCount(0);
  const previews = page.locator("img.photo-evidence-thumb");
  await expect.poll(() => previews.evaluateAll((images) => images.filter((image) => (image as HTMLImageElement).naturalWidth > 0).length), { timeout: 60_000 }).toBeGreaterThanOrEqual(formats.length);

  // Mark the first photo.
  await page.getByRole("button", { name: "Open the details of photo 1" }).click();
  await page.getByRole("button", { name: "Mark on photo" }).click();
  const markup = page.locator(".photo-markup-modal");
  await markup.getByRole("button", { name: "Photo. Tap to place a marker." }).press("Enter");
  await markup.getByRole("button", { name: "Save markings on the photo" }).click();
  await expect(markup).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByPlaceholder("First and last name").fill("Demo Hoofdaannemer");
  await fillSpecFields(page.locator(".record-form-shell").first());
  await page.getByRole("button", { name: "Submit issue" }).click();
  await finishSigning(page);
  await expect(page.locator(".operation-alert.success")).toContainText(/Issue|saved|secured/i, { timeout: 120_000 });

  // The originals' bytes are in storage.
  for (const format of formats) {
    await expect.poll(async () => (await api.from("files").select("id,sha256,size_bytes,mime_type").eq("project_id", project).eq("sha256", sha(format.bytes))).data?.length ?? 0, { timeout: 120_000, message: `${format.ext} original is stored` }).toBeGreaterThanOrEqual(1);
    const stored = (await api.from("files").select("size_bytes,mime_type").eq("project_id", project).eq("sha256", sha(format.bytes)).limit(1).single()).data!;
    expect(stored.size_bytes, `${format.ext} size`).toBe(format.bytes.length);
    expect(stored.mime_type, `${format.ext} type`).toBe(format.mime);
  }
});
