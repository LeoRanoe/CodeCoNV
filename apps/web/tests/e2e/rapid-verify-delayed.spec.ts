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

// Requests made by the service worker are not seen by page.route, so the delay needs it out of the way.
test.use({ serviceWorkers: "block" });

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
    test.skip(testInfo.project.name !== "desktop-office", "The test sets the tablet width itself, like the stability audit.");
    test.setTimeout(120_000);
    await signIn(page);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    // Find the screen's address at desktop width (the sidebar is there), then open that address on a tablet.
    const button = page.locator(".sidebar").getByRole("button", { name: "Rapid Verify", exact: true });
    await button.click();
    await expect(button).toHaveClass(/active/);
    const address = new URL(page.url()).pathname + new URL(page.url()).search;
    await page.setViewportSize({ width: 820, height: 1024 });
    if (delay) {
      const slow = async (route: import("@playwright/test").Route) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        await route.continue();
      };
      for (const table of ["portal_shares", "portal_events", "portal_share_files", "verifications"]) await page.context().route(`**/rest/v1/${table}*`, slow);
    }
    await page.goto(address);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    const loading = page.getByRole("status").filter({ hasText: /Loading verification/ });
    const queue = page.locator(".verification-row, .record-list-empty, .portal-table");
    if (delay) {
      await expect(loading).toBeVisible({ timeout: 30_000 });
      // While it loads there is no half-filled queue.
      await expect(page.locator(".verification-row")).toHaveCount(0);
    } else {
      await expect(queue.first().or(loading)).toBeVisible({ timeout: 30_000 });
    }
    // Count the shift from here on: the swap from the loading line to the queue is what this test is about.
    await page.evaluate(() => { (window as unknown as Cls).__cls = 0; });
    await expect(loading).toHaveCount(0, { timeout: 20_000 });
    await page.waitForTimeout(1_200);
    const shift = await page.evaluate(() => (window as unknown as Cls).__cls);
    await page.screenshot({ path: testInfo.outputPath(`rapid-verify-${delay}.png`), fullPage: true });
    testInfo.annotations.push({ type: "layout-shift", description: shift.toFixed(4) });
    console.log(`RAPID_VERIFY_SHIFT delay=${delay} shift=${shift.toFixed(4)}`);
    expect(shift, `layout shift of Rapid Verify with ${delay} ms delay`).toBeLessThan(0.05);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
