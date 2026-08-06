import { expect, test } from "@playwright/test";

/**
 * The grid round made tiles and cards multi-column on phone and tablet, and caught a few
 * rows it should have left alone. This walks the real stylesheet at the widths the client
 * actually holds: a filter row must never squeeze two fields onto a phone line, a tab strip
 * must keep its reading order, and nothing may push the page sideways.
 */
const widths = [
  { name: "small phone", width: 320, height: 844, phone: true },
  { name: "phone", width: 390, height: 844, phone: true },
  { name: "tablet", width: 820, height: 1180, phone: false },
  { name: "desktop", width: 1280, height: 800, phone: false },
];

const fixture = `<main style="padding:12px">
  <section class="workspace-search-filters">
    ${["Kind", "Building", "Status", "From", "To", "Author"].map((label) => `<label><span>${label}</span><select><option>All of them, spelled out</option></select></label>`).join("")}
  </section>
  <section class="project-document-filters">
    ${["Folder", "Building", "Type", "From date", "Sort"].map((label) => `<label><span>${label}</span><select><option>Everything</option></select></label>`).join("")}
  </section>
  <div class="project-document-tabs">
    ${["All documents", "Drawings", "Renders", "BOQ", "Technical specs", "Contracts"].map((label) => `<button type="button"><span><strong>${label}</strong><small>12 items</small></span></button>`).join("")}
  </div>
  <nav class="daily-work-tabs">
    ${["Works ongoing", "Works completed", "Delays"].map((label) => `<button type="button"><span><strong>${label}</strong><small>3 days</small></span></button>`).join("")}
  </nav>
  <div class="workspace-module-groups">
    ${[1, 2, 3].map((index) => `<div class="workspace-module-group"><h3>Group ${index}</h3><p>A list of modules that belongs in one column on a phone.</p></div>`).join("")}
  </div>
  <section class="workspace-launcher-grid client-workspace-grid">
    ${Array.from({ length: 10 }, (_, index) => `<button class="workspace-launcher-tile" data-workspace-destination="fixture-${index}"><strong>Long workspace destination ${index + 1}</strong><small>Field module</small></button>`).join("")}
  </section>
</main>`;

function columnCount(page: import("@playwright/test").Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const columns = getComputedStyle(element).gridTemplateColumns;
    return columns === "none" ? 0 : columns.split(" ").filter(Boolean).length;
  });
}

/**
 * The page this fixture borrows its stylesheet from is a React app that hydrates after
 * load and rewrites the body while doing so. Mounting is therefore retried until the
 * fixture is still standing a moment later, instead of racing that first render.
 */
async function mountFixture(page: import("@playwright/test").Page, html: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect.poll(async () => {
    await page.evaluate((markup) => {
      document.getElementById("responsive-audit-fixture")?.remove();
      const host = document.createElement("div");
      host.id = "responsive-audit-fixture";
      host.innerHTML = markup;
      document.body.appendChild(host);
    }, html);
    await page.waitForTimeout(250);
    return page.locator("#responsive-audit-fixture .workspace-search-filters").count();
  }, { timeout: 30_000 }).toBe(1);
}

for (const size of widths) {
  test(`layout holds at ${size.name} (${size.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await mountFixture(page, fixture);

    // A form row never puts two fields on one phone line.
    for (const selector of ["#responsive-audit-fixture .workspace-search-filters", "#responsive-audit-fixture .project-document-filters"]) {
      const columns = await columnCount(page, selector);
      if (size.phone) expect(columns, `${selector} at ${size.width}px`).toBe(1);
      else expect(columns, `${selector} at ${size.width}px`).toBeGreaterThan(1);
    }

    // The tab strip keeps its reading order: it scrolls on a phone instead of wrapping.
    const documentTabs = page.locator("#responsive-audit-fixture .project-document-tabs");
    const tabDisplay = await documentTabs.evaluate((element) => getComputedStyle(element).display);
    expect(tabDisplay, `document tabs at ${size.width}px`).toBe(size.phone ? "flex" : "grid");

    // Module groups are lists, so one column on a phone.
    if (size.phone) expect(await columnCount(page, "#responsive-audit-fixture .workspace-module-groups")).toBe(1);

    // Tiles keep their grid everywhere; that is what the round was for.
    const tileColumns = await columnCount(page, "#responsive-audit-fixture .client-workspace-grid");
    expect(tileColumns, `tiles at ${size.width}px`).toBeGreaterThanOrEqual(2);

    // Touch targets stay reachable and nothing clips or scrolls sideways.
    for (const selector of ["#responsive-audit-fixture .workspace-launcher-tile", "#responsive-audit-fixture .project-document-tabs > button", "#responsive-audit-fixture .daily-work-tabs button"]) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box, `${selector} at ${size.width}px`).not.toBeNull();
      expect(box!.height, `${selector} height at ${size.width}px`).toBeGreaterThanOrEqual(36);
    }

    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${size.width}px`).toBeLessThanOrEqual(1);
  });
}
