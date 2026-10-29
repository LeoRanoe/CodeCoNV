import { expect, type Page, test } from "@playwright/test";

/**
 * Two taps on a save button that land before React has disabled it must still create one
 * record. Found in the live audit: both taps started the save, and because every save carries
 * its own key the database created two numbered documents with the same content.
 *
 * The taps are fired inside one browser task, which is the worst case for a render-based
 * `busy` flag: no render can happen between them.
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

test("two taps on 'Create controlled document' create one document", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The timing does not depend on the viewport.");
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("main").getByRole("button", { name: /Technical instructions$/ }).click();

  const title = `Double tap ${Date.now()}`;
  const form = page.locator(".operation-form", { hasText: "Technical instruction" }).first();
  await form.getByLabel("Instruction title / reference").fill(title);
  await form.getByLabel("Instruction description").fill("One tap, one record.");
  await form.getByLabel(/deadline/i).fill("2026-12-31");
  await form.getByRole("combobox", { name: "To", exact: true }).selectOption({ index: 2 });

  const create = page.getByRole("button", { name: "Create controlled document" });
  await expect(create).toBeEnabled();
  await create.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByText("Technical instruction (TI) saved.")).toBeVisible();

  await page.reload();
  await page.locator("main").getByText(title).first().waitFor({ timeout: 20_000 });
  expect(await page.locator("main").getByText(title, { exact: false }).count(), "one document, not two").toBe(1);
});
