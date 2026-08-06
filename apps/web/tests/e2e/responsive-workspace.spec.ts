import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect.poll(() => page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1);
}

test("workspace tiles keep their field grid at phone, tablet and desktop widths", async ({ page }, testInfo) => {
  // Load the actual production stylesheet without requiring a client account. The fixture
  // uses the same classes and destination attributes as ProjectWorkspaceHome.
  // The public route loads the same globals.css without registering the field service
  // worker, so a worker takeover cannot replace this small CSS fixture mid-assertion.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.innerHTML = `<main style="padding:12px">
      <section class="workspace-launcher-grid client-workspace-grid">
        ${Array.from({ length: 10 }, (_, index) => `<button class="workspace-launcher-tile" data-workspace-destination="fixture-${index}"><strong>Long workspace destination ${index + 1}</strong><small>Field module</small></button>`).join("")}
      </section>
    </main>`;
  });

  const grid = page.locator(".client-workspace-grid");
  const columnCount = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length);
  if (testInfo.project.name === "mobile-field") expect(columnCount).toBe(2);
  else if (testInfo.project.name === "tablet-field") expect(columnCount).toBe(3);
  else expect(columnCount).toBe(5);

  const firstTile = page.locator("[data-workspace-destination]").first();
  const tileBox = await firstTile.boundingBox();
  expect(tileBox).not.toBeNull();
  expect(tileBox!.width).toBeGreaterThanOrEqual(44);
  expect(tileBox!.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);

  if (testInfo.project.name === "mobile-field") {
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await page.setViewportSize({ width: 320, height: 844 });
    await expect.poll(() => grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length)).toBe(2);
    await expectNoHorizontalOverflow(page);
  }
});
