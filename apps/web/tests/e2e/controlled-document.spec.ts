import { expect, type Page, test } from "@playwright/test";

/**
 * A controlled document from request to formal response, through the screens a project
 * team uses: an RFI is recorded against a party, appears in the register with its number
 * and status, receives a formal response from a named respondent, and still shows that
 * response after the app is reloaded.
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

function field(page: Page, label: string) {
  return page.locator("main label.form-field").filter({ has: page.locator("span", { hasText: label }) }).locator("input, textarea, select").first();
}

test("an RFI is recorded, answered by a named respondent and keeps its response", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The document workflow is the same on every viewport.");
  test.setTimeout(120_000);
  const title = `Release gate RFI ${Date.now().toString(36)} · slab penetrations level 2`;
  await signIn(page);

  // Record the request.
  await page.locator(".sidebar").getByRole("button", { name: "Management", exact: true }).click();
  await page.getByRole("button", { name: "Record external submission" }).click();
  await expect(page.getByRole("heading", { name: "Formal documents & registers" })).toBeVisible();
  // The button opens the submission form it names, not the default register.
  await expect(page.getByRole("heading", { name: "RFI", exact: true })).toBeVisible();
  await field(page, "Title / reference").fill(title);
  await field(page, "Formal request / instruction / observation").fill("Please confirm the size and position of the slab penetrations on level 2 before the pour.");
  await field(page, "Submitted by").fill("J. Contractor");
  // The addressee is a project party, shown with its role in words.
  const addressee = field(page, "To:");
  await expect(addressee.locator("option", { hasText: "Hoofdaannemer E2E · Contractor" })).toHaveCount(1);
  await addressee.selectOption({ label: "Hoofdaannemer E2E · Contractor" });
  await page.getByRole("button", { name: "Create controlled document" }).click();

  // It is in the register with a number and a status in words.
  const card = page.locator(".controlled-document-card").filter({ hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(/RFI-E2E-001-\d{3}/);
  await expect(card).toContainText("Open");

  // Formal response by a named respondent.
  await card.getByRole("button", { name: "Record formal response" }).click();
  const confirm = card.getByRole("button", { name: "Confirm human response" });
  await expect(confirm).toBeDisabled();
  await card.locator("label.form-field").filter({ hasText: "Decision / response code" }).locator("select").selectOption("approved_with_comments");
  await card.locator("label.form-field").filter({ hasText: "Position" }).locator("input").fill("Lead supervisor");
  await card.locator("label.form-field").filter({ hasText: "Formal comments / remarks" }).locator("textarea").fill("Penetrations per drawing S-201 rev C; sleeve diameters confirmed, core drilling not allowed.");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(card).toContainText("Approved with comments", { timeout: 20_000 });

  // The response is on the record, not only on this screen.
  await page.reload();
  // Contractor submissions are listed under Management, not in the supervision workspace.
  await page.locator(".sidebar").getByRole("button", { name: "Management", exact: true }).click();
  await page.getByRole("button", { name: "Record external submission" }).click();
  const reloaded = page.locator(".controlled-document-card").filter({ hasText: title }).first();
  await expect(reloaded).toBeVisible({ timeout: 30_000 });
  await expect(reloaded).toContainText("Approved with comments");
  await expect(reloaded).not.toContainText(/approved_with_comments|in_review/);
});
