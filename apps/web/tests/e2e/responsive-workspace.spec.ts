import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect.poll(() => page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1);
}

test("workspace register rows stay readable at phone, tablet and desktop widths", async ({ page }, testInfo) => {
  // Load the actual production stylesheet without requiring a client account. The fixture
  // uses the same classes and destination attributes as ProjectWorkspaceHome.
  // The workspace stylesheet is bundled with the app route, not with the public landing
  // page, so the fixture is mounted there; no account is needed to reach the sign-in shell.
  await page.goto("/supervisie", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(() => {
    document.body.innerHTML = `<main style="padding:12px">
      <section class="workspace-launcher-grid client-workspace-grid">
        ${Array.from({ length: 10 }, (_, index) => `<button class="workspace-launcher-tile ui-list-row" data-workspace-destination="fixture-${index}"><strong>Long workspace destination ${index + 1}</strong><span class="workspace-launcher-count">3</span></button>`).join("")}
      </section>
    </main>`;
  });

  const grid = page.locator(".client-workspace-grid");
  const columnCount = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length);
  if (testInfo.project.name === "mobile-field") expect(columnCount).toBe(1);
  else if (testInfo.project.name === "tablet-field") expect(columnCount).toBe(2);
  else expect(columnCount).toBe(3);

  const firstTile = page.locator("[data-workspace-destination]").first();
  const tileBox = await firstTile.boundingBox();
  expect(tileBox).not.toBeNull();
  expect(tileBox!.width).toBeGreaterThanOrEqual(44);
  expect(tileBox!.height).toBeGreaterThanOrEqual(44);
  await expect(firstTile.locator("strong")).toBeVisible();
  expect(await firstTile.locator("strong").evaluate((label) => label.scrollWidth <= label.clientWidth + 1)).toBe(true);
  await expectNoHorizontalOverflow(page);

  if (testInfo.project.name === "mobile-field") {
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await page.setViewportSize({ width: 320, height: 844 });
    await expect.poll(() => grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length)).toBe(1);
    expect(await firstTile.locator("strong").evaluate((label) => label.scrollWidth <= label.clientWidth + 1)).toBe(true);
    await expectNoHorizontalOverflow(page);
  }
});
