import { expect, type Page, test } from "@playwright/test";

/**
 * QA sweep H5. From 1025 px up the panel that holds the photo stack (description, "Save photo
 * stack") was display:none, so a desk worker who chose photos had nothing to describe or save.
 * Choosing a photo must show the stack and its save button at 1280 px, and saving it must put
 * the photo in the library or say plainly why it could not.
 *
 * The file is a one-pixel JPEG made in the test; no storage service is needed to see the stack.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const onePixelJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(email!);
  await form.locator("input[type='password']").fill(password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

test("on a desktop a chosen photo shows its stack and the save button", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "This is the desktop layout (above 1024 px).");
  await signIn(page);
  const project = new URL(page.url()).searchParams.get("project");
  await page.goto(`/supervisie?project=${project}&nav=project&tab=files`);
  await expect(page.getByRole("button", { name: /Upload photos/ })).toBeVisible();

  await page.locator("input[type='file'][accept^='image/jpeg'][multiple]").setInputFiles({ name: "desktop-photo.jpg", mimeType: "image/jpeg", buffer: onePixelJpeg });

  const panel = page.locator(".media-actions-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByRole("button", { name: /Save with date|Save photo stack/ })).toBeVisible();
  // It is on the screen, not just in the document: inside the viewport width, with a real size.
  const box = (await page.getByRole("button", { name: /Save with date|Save photo stack/ }).boundingBox())!;
  expect(box.width).toBeGreaterThan(40);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
