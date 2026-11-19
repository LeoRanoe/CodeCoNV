import type { Locator, Page } from "@playwright/test";

/**
 * Opens a section of the current screen whichever way it is shown: a tab that is in view
 * (segmented control, underlined bar) or one inside the section menu that a phone, or a
 * section list that is too long for one line, opens from a single bar.
 */
export async function openSection(page: Page, name: string | RegExp) {
  const visibleTab = page.getByRole("tab", { name }).filter({ visible: true });
  if (await visibleTab.count()) {
    await visibleTab.first().click();
    return;
  }
  const menu: Locator = page.locator(".section-nav--menu").filter({ has: page.getByRole("tab", { name, includeHidden: true }) });
  await menu.first().locator(".section-nav__trigger").click();
  await menu.first().getByRole("tab", { name }).click();
}

/**
 * A module opens with its entry form, and the saved records then fold shut under one bar
 * ("Saved records"). Opens that bar when it is shut; does nothing when no form is open.
 */
export async function openSavedRecords(page: Page) {
  const fold = page.locator("details.saved-records-fold").first();
  // The module may still be loading; give the bar a moment to appear before deciding.
  await fold.waitFor({ state: "attached", timeout: 15_000 }).catch(() => undefined);
  if (!(await fold.count())) return;
  if (await fold.evaluate((element) => (element as HTMLDetailsElement).open)) return;
  await fold.locator("summary").click();
}
