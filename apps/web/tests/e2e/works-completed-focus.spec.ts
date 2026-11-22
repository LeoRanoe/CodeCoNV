import { expect, type Page, test } from "@playwright/test";

/**
 * Client feedback of 01-11-2026 and 19-11-2026: "Works completed" is what was finished today.
 * The plan for tomorrow, what is still running, QC, advice, HSE, workforce, delay and the
 * signature are left out of this form, also on the first entry of the day.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

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
}

test("Works completed asks what was finished, nothing else", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='works-completed']").click();
  // The tile opens the workbook activity record (20-11-2026); the day log is one tap away.
  await page.getByRole("button", { name: "Day log for the whole day" }).click();

  const form = page.locator(".daily-log-form");
  await expect(form.getByLabel("Work completed today")).toBeVisible();
  for (const absent of ["What happens tomorrow", "What is in progress, and where?", "Advice recorded for the contractor", "Delay cause"]) {
    await expect(form.getByLabel(absent)).toHaveCount(0);
  }
  await expect(form.getByRole("button", { name: "Confirm project start" })).toHaveCount(0);
  await expect(form.getByText("Sign this day")).toHaveCount(0);

  await form.getByLabel("All buildings").check();
  await form.getByLabel("Work completed today").fill("Formwork of axis A to C");
  await form.getByRole("button", { name: "Save daily log" }).click();
  await expect(page.getByText(/Daily log saved/)).toBeVisible();
  await expect(form.locator(".record-form-validation")).toHaveCount(0);
});
