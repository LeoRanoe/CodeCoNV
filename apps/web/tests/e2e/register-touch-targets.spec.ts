import { expect, type Page, test } from "@playwright/test";

/**
 * Walkthrough finding (L13 follow-up). The people counter of the Workforce register, its remove
 * button and shift lists, the "Remove this line" button of the delivery register and the
 * Online chip of the record forms were 33-38 px on a phone and a tablet. A thumb needs 44 px.
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

async function openDestination(page: Page, destination: string) {
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "Workspace" }).click();
  await page.locator(`[data-workspace-destination='${destination}']`).click();
}

async function sizes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height) };
  }));
}

test("the register steppers, remove buttons and sync chip are 44 px on a phone and a tablet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop-office", "Touch targets are a rule up to 1024 px.");
  test.setTimeout(90_000);

  await signIn(page);
  await openDestination(page, "workforce");
  await page.getByRole("button", { name: "Add person" }).first().click();
  await expect(page.locator(".workforce-row").first()).toBeVisible();
  for (const selector of [".workforce-row .counter-control button", ".workforce-row-remove", ".workforce-shift select"]) {
    const found = await sizes(page, selector);
    expect(found.length, `${selector} exists`).toBeGreaterThan(0);
    for (const size of found) {
      expect(size.height, `${selector} height`).toBeGreaterThanOrEqual(44);
      expect(size.width, `${selector} width`).toBeGreaterThanOrEqual(44);
    }
  }

  await openDestination(page, "materials-delivery");
  const lineRemove = await sizes(page, ".register-line-remove");
  expect(lineRemove.length).toBeGreaterThan(0);
  for (const size of lineRemove) {
    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);
  }

  await openDestination(page, "issues");
  for (const size of await sizes(page, ".record-sync-chip")) expect(size.height, "sync chip height").toBeGreaterThanOrEqual(44);
});
