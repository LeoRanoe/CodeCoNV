import { expect, test } from "@playwright/test";

/**
 * The installed app has to behave like an application, not like a page that needs a
 * connection. These checks need no account: they prove the shell itself boots, hydrates and
 * reacts with the network switched off, which is the part a login cannot rescue.
 */
const shellCache = "codeco-field-shell-v5";

test.describe("offline field app", () => {
  test("boots, hydrates and reacts with the network switched off", async ({ page, context }) => {
    await page.goto("/supervisie", { waitUntil: "networkidle" });

    // The worker takes control on the first visit, and the code this page is running is
    // handed to it: an app opened exactly once must still open again without a connection.
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 25_000 });
    await page.waitForFunction(() => document.documentElement.dataset.offlineShellReady === "true", null, { timeout: 25_000 });
    await expect.poll(
      () => page.evaluate(async (cacheName) => {
        const cache = await caches.open(cacheName);
        return (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith("/_next/static/")).length;
      }, shellCache),
      { timeout: 20_000, message: "the app's own code must be stored for offline use" },
    ).toBeGreaterThan(0);

    const storedDocuments = await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      return (await cache.keys()).map((request) => new URL(request.url).pathname);
    }, shellCache);
    expect(storedDocuments).toContain("/supervisie");
    expect(storedDocuments).toContain("/manifest.webmanifest");

    await context.setOffline(true);

    // A reload with no network at all.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Supervisie/i);

    // A cold start: a new tab, still offline, as when the phone reopens the installed app.
    const coldPage = await context.newPage();
    await coldPage.goto("/supervisie", { waitUntil: "domcontentloaded" });

    // Hydrated is not the same as painted: the React state has to answer an interaction.
    // Do not wait on a private Next.js global; Next 16 no longer exposes the old `next`
    // object even though the application is fully hydrated.
    const languageSelect = coldPage.locator(".language-switcher select").first();
    await expect(languageSelect).toBeVisible();
    await languageSelect.selectOption("en");
    await expect(coldPage.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    await context.setOffline(false);
  });

  test("keeps the landing page reachable offline as well", async ({ page, context }) => {
    // The worker is registered by the workspace, which is where the installed app starts.
    // The landing page is stored along with it, so a bookmark on "/" is not a dead end.
    await page.goto("/supervisie", { waitUntil: "networkidle" });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 25_000 });
    await page.waitForTimeout(1500);

    await context.setOffline(true);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/CODECO/i);
    await context.setOffline(false);
  });
});
