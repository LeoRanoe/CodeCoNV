import { expect, type Page, test } from "@playwright/test";

/**
 * Word v2.0, key decision 1 (client, 27-11-2026): every form is filled in and submitted by Supervision only. The
 * contractor only responds (acknowledge, comment, upload evidence, witness / sign where the Sign-off sheet says), so
 * its portal offers no way to create an RFI, RFA, WCR or inspection request (OPUS-F16, Q-1).
 *
 * Runs against the local fixture stack with the accounts from seed-ui-demo-data.mjs.
 */
const email = process.env.CODECO_E2E_CONTRACTOR_EMAIL;
const password = process.env.CODECO_E2E_CONTRACTOR_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("The contractor account is required for the release gate.");
}
test.skip(!email || !password, "A contractor account is required (tests/e2e/seed-ui-demo-data.mjs).");

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
  // A contractor works in the contractor portal, not in the supervisor workspace.
  await expect(page.locator(".portal-shell")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

test("a contractor responds in its portal but cannot create a form", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The portal offers the same on every viewport.");
  await signIn(page);
  const tab = page.getByRole("tab", { name: /Responses & submissions/ }).first();
  if (!(await tab.isVisible().catch(() => false))) await page.locator(".portal-main button[aria-haspopup='true']").first().click();
  await page.getByRole("tab", { name: /Responses & submissions/ }).first().click();
  await expect(page.locator(".portal-shell")).toBeVisible();
  await expect(page.getByRole("button", { name: /New submission/ })).toHaveCount(0);
  await expect(page.locator(".controlled-document-form, .record-form-shell")).toHaveCount(0);
});
