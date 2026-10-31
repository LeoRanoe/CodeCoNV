import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";

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
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
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
  const input = page.getByLabel("Add photo").first();
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
  await expect(page.getByText(/IMG_0001\.HEIC: HEIC photo this browser cannot open\. Not added\./)).toBeVisible();
  await expect(page.locator(".media-capture-review")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Save photo stack" }).click();
  await expect(page.locator(".media-capture-review")).toHaveCount(0, { timeout: 60_000 });
  await expect.poll(() => deviceQueue(page), { timeout: 30_000 }).toEqual([]);
  await expect(page.getByText("Sending failed")).toHaveCount(0);
});
