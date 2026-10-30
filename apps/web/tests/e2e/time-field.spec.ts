import { expect, test } from "@playwright/test";

/**
 * QA L1. The native time input shows "05:16 PM" in a browser set to a 12-hour clock, beside a
 * report that reads 17:16. The workforce shift is picked on a 24-hour clock and the pick is
 * kept: the lists carry no AM or PM and 17:05 is what the row holds after choosing it.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

test.use({ locale: "en-US" });

test("a shift time is picked on a 24-hour clock whatever the browser language", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "One width is enough; the lists are the same everywhere.");
  await page.setViewportSize({ width: 1280, height: 900 });
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
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='workforce']").click();
  await page.getByRole("button", { name: "Add person" }).first().click();

  const row = page.locator(".workforce-row").first();
  await expect(row.locator(".workforce-shift")).toBeVisible();
  expect(await row.locator("input[type='time']").count(), "no native time input is left").toBe(0);
  const hours = row.locator(".workforce-shift select").nth(2);
  const minutes = row.locator(".workforce-shift select").nth(3);
  await hours.selectOption("17");
  await minutes.selectOption("05");
  await expect(hours).toHaveValue("17");
  await expect(minutes).toHaveValue("05");
  const shiftText = await row.locator(".workforce-shift").innerText();
  expect(shiftText).not.toMatch(/\b(AM|PM)\b/i);
  const options = await hours.locator("option").allInnerTexts();
  expect(options).toContain("23");
  expect(options.join(" ")).not.toMatch(/AM|PM/i);
});
