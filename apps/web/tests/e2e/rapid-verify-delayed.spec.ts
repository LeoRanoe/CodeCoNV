import { expect, type Page, test } from "@playwright/test";

/**
 * Rapid Verify on a tablet while its queries are slow. The queue is filled when the portal shares and the
 * verification history arrive; until then the screen says it is loading and shows no half-filled list, and when
 * the data arrives nothing on the screen jumps (layout shift stays under the audit's 0.05 limit).
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

type Cls = { __cls: number };

async function signIn(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Cls).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<{ hadRecentInput: boolean; value: number }>) {
        if (!entry.hadRecentInput) (window as unknown as Cls).__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
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
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

for (const delay of [0, 3_000]) {
  test(`Rapid Verify on a tablet with ${delay} ms of delay on its queries`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "tablet-field", "The tablet is the viewport under test.");
    test.setTimeout(120_000);
    await signIn(page);
    if (delay) {
      await page.route(/\/rest\/v1\/(portal_shares|portal_events|portal_share_files|verifications)\b/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        await route.continue();
      });
    }
    await page.evaluate(() => { (window as unknown as Cls).__cls = 0; });
    // On a tablet the module is behind the bottom navigation's More menu.
    const more = page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" });
    if (await more.isVisible().catch(() => false)) await more.click();
    await page.getByRole("button", { name: "Rapid Verify" }).first().click();
    const loading = page.getByRole("status").filter({ hasText: /Loading verification/ });
    if (delay) {
      await expect(loading).toBeVisible();
      await expect(page.locator(".verification-row")).toHaveCount(0);
    }
    await expect(loading).toHaveCount(0, { timeout: 20_000 });
    await page.waitForTimeout(1_200);
    const shift = await page.evaluate(() => (window as unknown as Cls).__cls);
    await page.screenshot({ path: testInfo.outputPath(`rapid-verify-${delay}.png`), fullPage: true });
    expect(shift, `layout shift of Rapid Verify with ${delay} ms delay`).toBeLessThan(0.05);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
