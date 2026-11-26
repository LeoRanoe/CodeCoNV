import { choosePhotoPurpose } from "./photo-purpose";
import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

/**
 * Launch audit 31-10-2026, camera and saved images.
 *
 * 1. The photo button inside the Issue and HSE forms judged a photo by the label the browser gave
 *    it. An Android camera that calls a JPEG "image/jpg" or gives it no type was refused with
 *    "Use JPEG, PNG or WebP files", so the photo was never added.
 * 2. A HEIC photo (an iPhone or iPad photo copied to a computer) was dropped by the camera button
 *    without a word.
 * 3. A photo stack saved from the photo library stayed "Sending failed" on the device: the files
 *    reached storage, then grouping them was refused (signed-in users only read visual_captures).
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const photoPath = process.env.CODECO_E2E_PHOTO_1;
const fakeBlob = process.env.CODECO_E2E_FAKE_BLOB === "1";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password || !photoPath, "A fixture account and CODECO_E2E_PHOTO_1 are required.");
test.setTimeout(180_000);

const heic = {
  name: "IMG_0001.HEIC",
  mimeType: "image/heic",
  buffer: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(12), Buffer.alloc(2000, 7)]),
};

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  await page.locator(".access-form, .project-selection-grid").first().waitFor({ state: "visible" });
  const form = page.locator(".access-form");
  if (await form.isVisible().catch(() => false)) {
    await form.locator("input[type='email']").fill(email!);
    await form.locator("input[type='password']").fill(password!);
    await form.locator("button[type='submit']").click();
  }
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  return new URL(page.url()).searchParams.get("project")!;
}

async function deviceQueue(page: Page) {
  return page.evaluate(() => new Promise<string[]>((resolve) => {
    const open = indexedDB.open("codeco-field-v1");
    open.onsuccess = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains("uploads")) { resolve([]); return; }
      const request = database.transaction("uploads").objectStore("uploads").getAll();
      request.onsuccess = () => { resolve(request.result.map((entry) => `${entry.fileName}: ${entry.lastError ?? "waiting"}`)); database.close(); };
    };
    open.onerror = () => resolve(["indexedDB unavailable"]);
  }));
}

test("the issue form takes a camera JPEG whatever label the browser gives it", async ({ page }) => {
  const project = await signIn(page);
  await page.goto(`/supervisie?project=${project}&nav=project`);
  const back = page.locator(".workspace-back-button");
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.locator('[data-workspace-destination="issues"]').click();
  await expect(page.getByRole("heading", { name: "Create issue" })).toBeVisible();
  const input = page.getByLabel("Take a picture").first();
  const bytes = readFileSync(photoPath!);
  await input.setInputFiles({ name: "labelled.jpg", mimeType: "image/jpeg", buffer: bytes });
  await input.setInputFiles({ name: "android.jpg", mimeType: "image/jpg", buffer: bytes });
  await input.setInputFiles({ name: "untyped", mimeType: "application/octet-stream", buffer: bytes });
  await expect(page.getByText("Describe", { exact: true })).toHaveCount(3);
  await expect(page.getByText("Use JPEG, PNG or WebP files")).toHaveCount(0);
});

test("a HEIC photo from the camera button is named instead of dropped", async ({ page }) => {
  await signIn(page);
  const chooser = page.waitForEvent("filechooser");
  await page.locator(".quick-add-side:visible, .mobile-nav-button.quick:visible").first().click();
  await (await chooser).setFiles(heic);
  await expect(page.getByText(/IMG_0001\.HEIC: this HEIC, HEIF or AVIF photo could not be decoded/)).toBeVisible();
  await expect(page.locator(".media-capture-review")).toHaveCount(0);
});

test("the photo library saves approved formats and keeps the exact originals", async ({ page }, testInfo) => {
  test.skip(!fakeBlob || testInfo.project.name !== "desktop-office", "Runs on Chromium with local storage fixtures.");
  const project = await signIn(page);
  await page.goto(`/supervisie?project=${project}&nav=project&tab=files`);
  await expect(page.getByRole("heading", { name: "Project photos" })).toBeVisible();

  const heicBytes = readFileSync(new URL("./fixtures/site-photo.heic", import.meta.url));
  const heifBytes = Buffer.from(heicBytes);
  heifBytes.write("mif1", 8, "ascii");
  const avifBytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#803a18" } }).avif().toBuffer();
  const gifBytes = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  const batch = [
    ["heic", heicBytes], ["heif", heifBytes], ["avif", avifBytes], ["gif", gifBytes],
  ] as const;
  const stamp = Date.now().toString(36);
  const input = page.locator("input[type='file'][accept^='image/jpeg'][multiple]").first();
  await expect(input).toHaveAttribute("accept", /image\/gif.*image\/heic.*image\/heif.*image\/avif/);
  for (const [extension, buffer] of batch) {
    const name = `approved-${stamp}.${extension}`;
    await input.setInputFiles({ name, mimeType: `image/${extension}`, buffer });
    const review = page.locator(".media-capture-review");
    await choosePhotoPurpose(review, "Site Conditions");
    await review.getByRole("button", { name: "Save with date" }).click();
    await expect(review).toHaveCount(0, { timeout: 60_000 });
    await expect.poll(() => deviceQueue(page), { timeout: 60_000 }).toEqual([]);
  }

  const api = createClient(process.env.CODECO_E2E_SUPABASE_URL!, process.env.CODECO_E2E_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const session = await api.auth.signInWithPassword({ email: email!, password: password! });
  expect(session.error).toBeNull();
  for (const [extension, buffer] of batch) {
    const hash = createHash("sha256").update(buffer).digest("hex");
    const { data: files, error } = await api.from("files").select("id,mime_type,sha256,size_bytes,original_name")
      .eq("project_id", project).eq("original_name", `approved-${stamp}.${extension}`);
    expect(error).toBeNull();
    expect(files?.some((file) => file.sha256 === hash && file.mime_type === `image/${extension}` && file.size_bytes === buffer.length)).toBe(true);
  }
  const { data: derivatives, error } = await api.from("files").select("id,mime_type")
    .eq("project_id", project).eq("original_name", `approved-${stamp}.jpg`);
  expect(error).toBeNull();
  expect(derivatives?.filter((file) => file.mime_type === "image/jpeg")).toHaveLength(4);
  await page.getByRole("button", { name: `Open the details of approved-${stamp}.jpg` }).first().click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download original", exact: true }).click();
  const download = await downloadEvent;
  const original = batch.find(([extension]) => download.suggestedFilename().endsWith(`.${extension}`));
  expect(original).toBeDefined();
  expect(await readFile((await download.path())!)).toEqual(original![1]);
});

test("a photo stack is saved centrally and leaves nothing waiting on the device", async ({ page }) => {
  test.skip(!fakeBlob, "Saving needs a Blob store (CODECO_E2E_FAKE_BLOB=1 or a real one).");
  const project = await signIn(page);
  await page.goto(`/supervisie?project=${project}&nav=project&tab=files`);
  await expect(page.getByRole("heading", { name: "Project photos" })).toBeVisible();
  const bytes = readFileSync(photoPath!);
  await page.locator("input[type='file'][accept^='image/jpeg'][multiple]").first().setInputFiles([
    { name: "stack-a.jpg", mimeType: "image/jpeg", buffer: bytes },
    { name: "stack-b.jpg", mimeType: "image/jpeg", buffer: bytes },
  ]);
  await page.getByLabel(/Keep together as one photo stack/).check();
  await choosePhotoPurpose(page.locator(".media-capture-review"), "Progress Documentation");
  await page.getByRole("button", { name: "Save photo stack" }).click();
  await expect(page.locator(".media-capture-review")).toHaveCount(0, { timeout: 60_000 });
  await expect.poll(() => deviceQueue(page), { timeout: 30_000 }).toEqual([]);
  await expect(page.getByText("Sending failed")).toHaveCount(0);
});

test("photos taken one after another are reviewed together and saved as separate photos", async ({ page }) => {
  test.skip(!fakeBlob, "Saving needs a Blob store (CODECO_E2E_FAKE_BLOB=1 or a real one).");
  await signIn(page);
  const bytes = readFileSync(photoPath!);
  const chooser = page.waitForEvent("filechooser");
  await page.locator(".quick-add-side:visible, .mobile-nav-button.quick:visible").first().click();
  await (await chooser).setFiles({ name: "round-1.jpg", mimeType: "image/jpeg", buffer: bytes });
  await expect(page.getByText("1 photo to review")).toBeVisible();
  // The next picture goes into the same review.
  const again = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Take another" }).click();
  await (await again).setFiles({ name: "round-2.jpg", mimeType: "image/jpeg", buffer: bytes });
  await expect(page.getByText("2 photos to review")).toBeVisible();
  // Each photo is described in one pass, stepping from one to the next.
  await page.getByRole("button", { name: "Open the details of photo 1" }).click();
  await expect(page.getByText("Photo 1 of 2")).toBeVisible();
  await page.getByRole("dialog").getByLabel("Caption / observation").fill("Scheur in de kolom bij as B-3");
  await page.getByRole("button", { name: "Next photo" }).click();
  await expect(page.getByText("Photo 2 of 2")).toBeVisible();
  await page.getByRole("dialog").getByLabel("Caption / observation").fill("Wapening zichtbaar aan de onderzijde");
  await page.getByRole("button", { name: "Close" }).click();
  await choosePhotoPurpose(page.locator(".media-capture-review"), "Technical / Quality Evidence");
  await page.getByRole("button", { name: "Save 2 photos" }).click();
  await expect(page.locator(".media-capture-review")).toHaveCount(0, { timeout: 60_000 });
  await expect.poll(() => deviceQueue(page), { timeout: 30_000 }).toEqual([]);
});
