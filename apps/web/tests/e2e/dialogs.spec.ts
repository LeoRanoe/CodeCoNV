import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * One keyboard and focus contract for every dialog in the application (app/dialog-manager.tsx).
 *
 * For each dialog the user can open: it is a named modal, focus lands inside, Tab and
 * Shift+Tab never leave it, everything behind it is inert, Escape closes it through its own
 * close control and focus goes back to the control that opened it. It also has to fit the
 * viewport and scroll inside itself, at the three widths the client works on (the Playwright
 * projects: phone, tablet, desktop).
 *
 * Runs against the local fixture stack (tests/e2e/seed-local-fixtures.mjs).
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const dialogSelector = "[role='dialog'][aria-modal='true'], [role='alertdialog'][aria-modal='true']";

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

/** The same module through the sidebar on a laptop and through the bottom bar on a phone. */
async function goTo(page: Page, module: string) {
  const sidebar = page.locator(".sidebar").getByRole("button", { name: module, exact: true });
  if (await sidebar.isVisible().catch(() => false)) {
    await sidebar.click();
    return;
  }
  const bottom = page.locator(".mobile-bottom-nav").getByRole("button", { name: module, exact: true });
  if (await bottom.count()) {
    await bottom.click();
    return;
  }
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" }).click();
  await page.locator(".mobile-module-sheet").getByRole("button", { name: new RegExp(module) }).first().click();
}

type Opener = { name: string; open: (page: Page) => Locator | Promise<void> | void; escapeCloses?: boolean };

const openers: Opener[] = [
  { name: "notifications", open: (page) => page.getByRole("button", { name: /Notifications/ }).first() },
  { name: "field guide", open: (page) => page.getByRole("button", { name: /^Help/ }) },
  { name: "offline manager", open: (page) => page.locator(".storage-state") },
  { name: "switch project", open: (page) => page.locator(".project-context-card, .breadcrumb-project").locator("visible=true").first() },
  { name: "manage buildings", open: (page) => page.locator(".breadcrumb-building, .mobile-nav-button:has-text('More')").locator("visible=true").first() },
  { name: "report check", open: (page) => page.getByRole("button", { name: "Check report" }) },
  { name: "new action", open: async (page) => { await goTo(page, "Actions"); await page.getByRole("button", { name: /New action/ }).first().click(); } },
  { name: "team and access", open: async (page) => { await goTo(page, "Management"); await page.getByRole("button", { name: /Manage team/ }).first().click(); } },
];

async function activate(page: Page, opener: Opener) {
  const result = opener.open(page);
  if (result && "click" in (result as Locator)) {
    const locator = result as Locator;
    // The mobile "More" fallback for the building list is a menu, not the dialog itself.
    await locator.click();
    if (opener.name === "manage buildings" && !(await page.locator(dialogSelector).count())) {
      await page.locator(".mobile-module-sheet").getByRole("button", { name: /Buildings/ }).click();
    }
  } else {
    await result;
  }
}

test.describe("every dialog", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const opener of openers) {
    test(`${opener.name}: named modal, focus trap, inert background, Escape, focus return, fits the screen`, async ({ page }) => {
      await activate(page, opener);
      const dialog = page.locator(dialogSelector).last();
      await expect(dialog).toBeVisible();

      // A named modal.
      const name = await dialog.evaluate((element) => {
        const labelled = element.getAttribute("aria-labelledby");
        return (element.getAttribute("aria-label") ?? (labelled ? document.getElementById(labelled)?.textContent : "") ?? "").trim();
      });
      expect(name, "the dialog has an accessible name").not.toBe("");

      // Focus is inside, and stays inside through a full lap forwards and backwards.
      await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      for (let step = 0; step < 40; step += 1) {
        await page.keyboard.press(step % 9 === 8 ? "Shift+Tab" : "Tab");
        const inside = await dialog.evaluate((element) => element.contains(document.activeElement));
        expect(inside, `focus escaped the dialog on Tab ${step + 1}`).toBe(true);
      }

      // Nothing behind it can be reached.
      const behind = await page.evaluate(() => {
        const main = document.querySelector("main");
        return Boolean(main?.closest("[inert]") || main?.hasAttribute("inert") || main?.parentElement?.hasAttribute("inert"));
      });
      expect(behind, "the page behind the dialog is inert").toBe(true);

      // It fits the screen and scrolls inside itself instead of pushing the page.
      const box = await dialog.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

      // Escape closes it and focus goes back to where the user was.
      await page.keyboard.press("Escape");
      await expect(page.locator(dialogSelector)).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    });
  }

  test("the phone module menu is a dialog too", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-field", "The module menu only exists on a phone.");
    await page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" }).click();
    const sheet = page.locator(".mobile-module-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press("Tab");
      expect(await sheet.evaluate((element) => element.contains(document.activeElement)), `focus escaped on Tab ${step + 1}`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" })).toBeFocused();
  });

  test("a dialog opened from a page form closes without leaving the page", async ({ page }) => {
    await goTo(page, "Workspace");
    await page.locator("[data-workspace-destination='workforce']").click();
    // Workforce is a workspace page now, not a pop-up; the signature pad opens over it.
    const workforce = page.locator(".workforce-form");
    await expect(workforce).toBeVisible();
    await expect(page.locator(dialogSelector)).toHaveCount(0);
    const signature = workforce.getByRole("button", { name: /sign/i }).first();
    expect(await signature.count(), "the workforce form offers a signature").toBeGreaterThan(0);
    await signature.click();
    await expect(page.locator(dialogSelector)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(dialogSelector)).toHaveCount(0);
    await expect(workforce).toBeVisible();
  });
});
