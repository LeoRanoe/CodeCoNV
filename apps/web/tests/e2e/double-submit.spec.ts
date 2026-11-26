import { openSavedRecords } from "./section-nav";
import { expect, type Page, test } from "@playwright/test";
import { fillSpecFields } from "./spec-fill";
import { finishSigning } from "./sign-popup";

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
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
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

  // The TI sheet has no title row: the record is read back by its subject and description.
  const title = `Double tap ${Date.now()}`;
  const form = page.locator("[data-sheet-form='technical_instruction']");
  await form.locator("[data-sheet-slot='description'] textarea").fill(title);

  await fillSpecFields(page.locator(".record-form-shell").first());
  const create = page.getByRole("button", { name: "Create controlled document" });
  await expect(create).toBeEnabled();
  await create.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  // A form with a signature field opens the signing popup first; the second tap must not open a second record.
  await finishSigning(page);
  await expect(page.getByText("Technical instruction (TI) saved.")).toBeVisible();

  await page.reload();
  await openSavedRecords(page);
  await page.locator("main").getByText(title).first().waitFor({ timeout: 20_000 });
  expect(await page.locator("main .controlled-document-card").filter({ hasText: title }).count(), "one document, not two").toBe(1);
});
