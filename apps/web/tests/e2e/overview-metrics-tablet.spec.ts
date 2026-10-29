import { expect, test } from "@playwright/test";

/**
 * Walkthrough finding at 768 px: the four counts on the overview sit in two columns, but the
 * left cell of the second row started 16 px further in than the one above it.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

test("the overview counts line up in two columns on a tablet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The width is set by the test itself.");
  await page.setViewportSize({ width: 768, height: 900 });
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
  const cells = page.locator(".overview-metrics > *");
  await expect(cells).toHaveCount(4);
  const lefts = await cells.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(element).paddingInlineStart);
    return Math.round(box.left + padding);
  }));
  expect(lefts[2], `left cells start at the same x: ${lefts.join(", ")}`).toBe(lefts[0]);
  expect(lefts[3]).toBe(lefts[1]);
});
