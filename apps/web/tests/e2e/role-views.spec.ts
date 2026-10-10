import { expect, type Page, test } from "@playwright/test";

/**
 * A role sees what it can use. The database refuses every write the role may not do; the
 * screens must not offer those writes in the first place (a client with a "New issue" button
 * that always answers 403 is a broken screen, not a protected one).
 *
 * Runs against the local fixture stack with the accounts from seed-ui-demo-data.mjs
 * (CODECO_E2E_DEMO_DATA=0 is enough: no records are needed to see what is offered).
 */
const clientEmail = process.env.CODECO_E2E_CLIENT_EMAIL;
const clientPassword = process.env.CODECO_E2E_CLIENT_PASSWORD;
const contractorEmail = process.env.CODECO_E2E_CONTRACTOR_EMAIL;
const contractorPassword = process.env.CODECO_E2E_CONTRACTOR_PASSWORD;
const supervisorEmail = process.env.CODECO_E2E_EMAIL;
const supervisorPassword = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(clientEmail && contractorEmail && supervisorEmail)) {
  throw new Error("The client, contractor and supervisor accounts are required for the release gate.");
}
test.skip(!clientEmail || !contractorEmail || !supervisorEmail, "Role accounts are required (tests/e2e/seed-ui-demo-data.mjs).");

async function signInAs(page: Page, email: string, password: string) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(email);
  await form.locator("input[type='password']").fill(password);
  await form.locator("button[type='submit']").click();
  const project = page.getByRole("button", { name: new RegExp(projectName) }).first();
  await project.click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  // The permissions arrive with their own request; wait until the screen has applied them.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(800);
}

async function goTo(page: Page, module: string) {
  const sidebar = page.locator(".sidebar").getByRole("button", { name: module, exact: true });
  if (await sidebar.isVisible().catch(() => false)) return sidebar.click();
  const bottom = page.locator(".mobile-bottom-nav").getByRole("button", { name: module, exact: true });
  if (await bottom.count()) return bottom.click();
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" }).click();
  await page.locator(".mobile-module-sheet").getByRole("button", { name: new RegExp(module) }).first().click();
}

const modules = (page: Page) => page.locator(".sidebar .nav-button, .mobile-module-grid button");

test("a client reads and signs; nothing offers to write", async ({ page }, testInfo) => {
  await signInAs(page, clientEmail!, clientPassword!);
  const desktop = testInfo.project.name === "desktop-office";

  // The overview does not offer to start or answer the day, nor to take a photo.
  await expect(page.getByRole("button", { name: "Daily questions" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check report" })).toHaveCount(0);
  await expect(page.locator(".quick-add-side, .mobile-nav-button.quick")).toHaveCount(0);

  await goTo(page, "Actions");
  await expect(page.getByRole("button", { name: /New action/ })).toHaveCount(0);

  await goTo(page, "Project Docs");
  await expect(page.getByRole("button", { name: /Upload file|New controlled record/ })).toHaveCount(0);
  await expect(page.getByLabel("Create a folder and upload")).toHaveCount(0);

  await goTo(page, "Issues");
  // The module opens on its list: there is no form to fill in and no "New" button.
  await expect(page.getByRole("button", { name: /^New$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Submit issue|Save draft/ })).toHaveCount(0);

  if (desktop) {
    await expect(modules(page).filter({ hasText: "Settings" })).toHaveCount(1);
  }
});

test("a contractor only gets the modules it can read", async ({ page }) => {
  await signInAs(page, contractorEmail!, contractorPassword!);
  const labels = await modules(page).allInnerTexts();
  const joined = labels.join(" | ");
  expect(joined).not.toMatch(/Issues/);
  expect(joined).not.toMatch(/Reports/);
  await goTo(page, "Workspace");
  // Tiles for modules it cannot read are not offered.
  await expect(page.locator("[data-workspace-destination='issues']")).toHaveCount(0);
  await expect(page.locator("[data-workspace-destination='ncr']")).toHaveCount(0);
  await expect(page.locator("[data-workspace-destination='hse']")).toHaveCount(0);
});

test("a supervisor keeps every control a supervisor needs", async ({ page }) => {
  await signInAs(page, supervisorEmail!, supervisorPassword!);
  await expect(page.getByRole("button", { name: "Daily questions" })).toBeVisible();
  await goTo(page, "Actions");
  await expect(page.getByRole("button", { name: /New action/ })).toBeVisible();
  await goTo(page, "Project Docs");
  await expect(page.getByRole("button", { name: /New controlled record/ })).toBeVisible();
  await goTo(page, "Issues");
  await expect(page.getByRole("button", { name: /^New$/ })).toBeVisible();
});
