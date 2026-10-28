import { expect, type Page, test } from "@playwright/test";

/**
 * A form that is half filled in survives leaving it: switching module, reloading the page.
 * The draft is put back with a notice, can be thrown away, and does not outlive the record.
 *
 * Runs against the local fixture stack (tests/e2e/seed-local-fixtures.mjs).
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

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

test("an issue that is half filled in comes back after a reload and can be started over", async ({ page }) => {
  await signIn(page);
  const projectUrl = page.url();
  await page.goto(`${projectUrl}${projectUrl.includes("?") ? "&" : "?"}nav=project&tab=findings`);

  const description = page.locator(".operation-form textarea").first();
  await expect(description).toBeVisible();
  await description.fill("Crack in the north facade, stair 2");
  // The draft is written shortly after the last keystroke.
  await expect(page.getByText(/Draft saved on this device/)).toBeVisible();

  await page.reload();
  const restored = page.locator(".operation-form textarea").first();
  await expect(restored).toHaveValue("Crack in the north facade, stair 2");
  await expect(page.getByText(/Draft from .* put back\./)).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.locator(".operation-form textarea").first()).toHaveValue("");
  await page.reload();
  await expect(page.locator(".operation-form textarea").first()).toHaveValue("");
  await expect(page.getByText(/put back\./)).toHaveCount(0);
});
