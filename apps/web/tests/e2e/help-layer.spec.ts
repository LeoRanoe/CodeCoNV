import { expect, test } from "@playwright/test";

/**
 * QA sweep M1. The Help window was drawn inside the header's layer, so its left edge sat under
 * the fixed sidebar. At every point of its left edge the element on top must be the dialog.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

test("the Help window is on top of the sidebar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The sidebar is a desktop layout.");
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

  await page.getByRole("button", { name: /Help/ }).first().click();
  const dialog = page.getByRole("dialog", { name: /.+/ }).first();
  await expect(dialog).toBeVisible();
  const covered = await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const points = [0.1, 0.3, 0.5, 0.7, 0.9].map((fraction) => [box.left + 6, box.top + box.height * fraction] as const);
    return points.filter(([x, y]) => !element.contains(document.elementFromPoint(x, y)));
  });
  expect(covered, "points on the dialog's left edge that another element covers").toEqual([]);
});
