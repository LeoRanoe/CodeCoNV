import { expect, type Locator, type Page, test } from "@playwright/test";
import { fillSpecFields } from "./spec-fill";

/**
 * Opus audit F30 / F31: a popup or menu opened from inside a form or a record card is drawn on top of everything.
 * - The signing popup lived inside the form's sticky action bar, so on a phone (and a phone on its side) the top bar
 *   and the bottom bar covered it and its "Sign & submit" button.
 * - The "More actions" menu of an Issue card was clipped by its card and drawn under the next card.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    for (const key of ["codeco-field-guide-seen-v3", "codeco-portal-guide-seen-v1-contractor", "codeco-portal-guide-seen-v1-client"]) localStorage.setItem(key, "yes");
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
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

/** The element is drawn on top at the given points of its box (fractions of its width and height): nothing covers it there. */
const onTop = (target: Locator, points: Array<[number, number]> = [[0.5, 0.5]]) => target.evaluate((element, spots) => {
  const box = element.getBoundingClientRect();
  return spots.every(([x, y]) => {
    const hit = document.elementFromPoint(box.left + box.width * x, Math.min(box.top + box.height * y, window.innerHeight - 1));
    return Boolean(hit && (hit === element || element.contains(hit)));
  });
}, points);

async function openWorkspaceTile(page: Page, id: string) {
  const sidebar = page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true });
  if (await sidebar.isVisible().catch(() => false)) await sidebar.click();
  else await page.locator(".mobile-bottom-nav").getByRole("button", { name: "Workspace" }).click();
  await page.locator(`[data-workspace-destination='${id}']`).click();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
  test(`the signing popup and its button are on top at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-office", "Sets its own viewports.");
    await page.setViewportSize(viewport);
    await signIn(page);
    await openWorkspaceTile(page, "works-ongoing");
    await fillSpecFields(page.locator(".record-form-shell, [data-sheet-form]").first());
    await page.locator("main").getByRole("button", { name: /Save register item|Sign, submit/ }).last().click();
    await expect(page.locator(".signature-modal")).toBeVisible();
    // The cause of F31: inside the form the popup shares the sticky action bar's layer (z-index 3) and the form's
    // container-query box, under the top bar and the bottom bar. It must be drawn at the root of the page.
    expect(await page.locator(".signature-modal").evaluate((element) => Boolean(element.closest(".record-form-shell, .record-form-actions, main"))), "the popup is not inside the form").toBe(false);
    // The top and the bottom edge of the popup, where the top bar and the phone's bottom bar used to lie over it.
    expect(await onTop(page.locator(".signature-modal"), [[0.5, 0.03], [0.5, 0.97], [0.1, 0.5]]), "the popup is on top at its edges").toBe(true);
    await page.keyboard.press("Escape");
  });
}

test("the More actions menu of an Issue card opens over the cards under it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "One width is enough for the stacking rule.");
  await page.setViewportSize({ width: 1280, height: 720 });
  await signIn(page);
  await openWorkspaceTile(page, "issues");
  const create = page.locator(".workspace-module-create.ui-button--secondary");
  if (await create.isVisible().catch(() => false)) await create.click();
  const cards = page.locator(".finding-card");
  test.skip((await cards.count()) < 2, "Needs two issues (seed-ui-demo-data.mjs).");
  const trigger = cards.first().locator(".more-actions-trigger");
  await trigger.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await page.mouse.wheel(0, -120);
  await trigger.click();
  const menu = cards.first().locator(".more-actions-menu");
  await expect(menu).toBeVisible();
  expect(await onTop(menu, [[0.5, 0.15], [0.5, 0.5], [0.5, 0.85]]), "the menu is on top of the card under it").toBe(true);
});
