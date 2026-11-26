import { expect, type Page, test } from "@playwright/test";

/**
 * Developer package v5, Word 21 and 22: the Client Portal has ten submenus and the Contractor Portal six. Every submenu
 * opens its own section (with a real empty state when there is nothing yet), the active one is marked, and the portal
 * never shows the internal workspace menus. Opened here through "View as", the supervision's read-only preview.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const clientMenus = ["Client dashboard", "Project progress", "Reports & publications", "Photos & site updates", "Shared project documents", "Items for client review", "Key issues & risks", "Milestones & schedule", "Correspondence & decisions", "History & notifications"];
const contractorMenus = ["Dashboard", "Assigned to me", "Responses & submissions", "Pending actions", "History", "Shared documents"];

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
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

async function walk(page: Page, label: string, menus: string[]) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator(".sidebar").getByRole("button", { name: label, exact: true }).click();
  await expect(page.locator(".portal-view-as")).toBeVisible({ timeout: 30_000 });
  // With more than a few submenus the navigation is one menu button; with few it is a bar of tabs.
  const trigger = page.locator(".portal-main .section-nav__trigger");
  for (const menu of menus) {
    if (await trigger.isVisible().catch(() => false)) await trigger.click();
    const tab = page.getByRole("tab").filter({ hasText: menu }).first();
    await expect(tab, `${menu} is a submenu`).toBeVisible();
    await tab.click();
    if (await trigger.isVisible().catch(() => false)) await expect(trigger, "the active submenu is named on the menu button").toContainText(menu);
    else await expect(tab).toHaveAttribute("aria-selected", "true");
    // Each submenu shows content or an honest empty state, never a blank panel.
    expect((await page.locator(".portal-section").innerText()).trim().length, `${menu} is not blank`).toBeGreaterThan(5);
  }
  // The portal does not carry the internal menus.
  const text = await page.locator(".portal-main").innerText();
  expect(text).not.toMatch(/\bManagement\b|User administration|Backups/);
  expect(errors, "no script error while walking the submenus").toEqual([]);
}

test("the Client Portal has its ten submenus and each one opens", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The widths are set by the test itself.");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await walk(page, "Client Portal", clientMenus);
});

test("the Contractor Portal has its six submenus and each one opens", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The widths are set by the test itself.");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await walk(page, "Contractor Portal", contractorMenus);
});
