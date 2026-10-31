import { expect, type Page, test } from "@playwright/test";

/**
 * Client feedback of 30-10-2026 13:31-13:32: "Works ongoing" is one input box plus ticking where
 * it takes place - only point 1, and from it only "What is in progress, and where?". The form
 * must not ask for the rest of the day (weather, work completed, plan for tomorrow, QC, HSE,
 * workforce, delay, photos, signature), also not on the first entry of the day.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

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

test("Works ongoing is one text box and the buildings it happens in", async ({ page }, testInfo) => {
  // The sidebar route is the desktop one; the form is the same on every width.
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='works-ongoing']").click();

  const form = page.locator(".daily-log-form");
  await expect(form.getByLabel("What is in progress, and where?")).toBeVisible();
  // The one section holds the box and the buildings; nothing else of the day log.
  await expect(form.locator(".record-form-section")).toHaveCount(1);
  for (const absent of ["Work completed today", "Plan for tomorrow", "Advice recorded for the contractor", "Delay cause"]) {
    await expect(form.getByLabel(absent)).toHaveCount(0);
  }
  await expect(form.getByRole("button", { name: "Confirm project start" })).toHaveCount(0);
  await expect(form.getByText("Sign this day")).toHaveCount(0);

  // Ticking where it happens, writing what happens, saving: nothing else is asked for.
  await form.getByLabel("All buildings").check();
  await form.getByLabel("What is in progress, and where?").fill("Columns of block B");
  await form.getByRole("button", { name: "Save daily log" }).click();
  await expect(page.getByText(/Daily log saved/)).toBeVisible();
  await expect(form.locator(".record-form-validation")).toHaveCount(0);
});
