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
