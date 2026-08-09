import { expect, test } from "@playwright/test";

/**
 * Two kinds of sloppiness kept coming back by hand, so they are measured here instead.
 *
 * 1. A name the app did not choose — a camera file name, a project name, a record title —
 *    is one long unbreakable word. Where a wrapper between the row and the text cannot
 *    shrink, the shortening never happens and the name runs through whatever sits beside
 *    it, or pushes the whole page sideways.
 *
 * 2. A strip of tiles folds to two columns on a narrow screen. With an odd number of them
 *    the last one sits alone beside a hole.
 *
 * Both are measured against the real stylesheet, on markup that mirrors what the
 * components render. No account is needed: the workspace stylesheet ships with the app
 * route, so the fixture is mounted there.
 */

const LONG = "1785783668026208549797892070719202685497978920707192-marked.jpg";
const ICON = `<svg width="16" height="16" viewBox="0 0 24 24"></svg>`;

/** Rows that carry a name the app did not choose, in the shape their component renders. */
const nameCarryingRows: Record<string, string> = {
  "drawing-file-list": `<aside class="drawing-file-list"><button type="button" class="active"><span class="visual-list-icon">${ICON}</span><span><strong>${LONG}</strong><small>3 gekoppelde pins</small></span></button></aside>`,
  "drawing-unplaced-list": `<section class="drawing-unplaced-list"><header>${ICON} <strong>Nog niet op een tekening</strong> <b>2</b></header><button type="button"><span class="drawing-unplaced-dot tone-amber">${ICON}</span><span><strong>NCR-001</strong><small>${LONG}</small></span>${ICON}</button></section>`,
  "overview-evidence-grid": `<div class="overview-evidence-grid"><button type="button"><span class="evidence-placeholder"></span><span><strong>${LONG}</strong><small>3 aug</small></span></button><button type="button"><span class="evidence-placeholder"></span><span><strong>${LONG}</strong><small>3 aug</small></span></button></div>`,
  "overview-work-list": `<div class="overview-work-list"><button type="button"><i class="finding">${ICON}</i><span><strong>${LONG}</strong><small>Supervisor · ${LONG}</small></span><time>16:03</time></button></div>`,
  "project-switcher-list": `<div class="project-switcher-list"><button class="project-switcher-row" type="button"><span class="project-switcher-icon">${ICON}</span><span class="project-switcher-copy"><strong>${LONG}</strong><small>${ICON} ${LONG}</small><small class="project-switcher-meta">${LONG}</small></span><span class="project-switcher-state">${ICON}</span></button></div>`,
  "overview-search-list": `<div class="overview-search-list"><button type="button"><span><strong>${LONG}</strong><small>${LONG}</small></span>${ICON}</button></div>`,
  "rapid-source-list": `<div class="rapid-source-list"><article><span>${ICON}</span><div><strong>${LONG}</strong><small>4 pagina's</small></div><button type="button">x</button></article></div>`,
  "unified-action-list": `<div class="unified-action-list"><button type="button"><span class="unified-action-copy"><strong>${LONG}</strong><small>${LONG}</small></span></button></div>`,
};

/** Strips that fold to two columns, with the width at which they do it. */
const foldingStrips: Array<{ selector: string; width: number; child: string }> = [
  { selector: "action-center-views", width: 820, child: "button" },
  { selector: "action-center-summary", width: 820, child: "button" },
  { selector: "action-record-shortcuts", width: 390, child: "button" },
  { selector: "daily-work-tabs", width: 390, child: "button" },
  { selector: "overview-metrics", width: 820, child: "button" },
  { selector: "project-document-tabs", width: 390, child: "button" },
  { selector: "quick-grid", width: 390, child: "button" },
  { selector: "workspace-launcher-grid", width: 390, child: "button" },
];

async function mountFixture(page: import("@playwright/test").Page) {
  await page.goto("/supervisie", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // The measurements below are meaningless against an unstyled page, and a stale build can
  // serve HTML whose stylesheet 500s. Prove the sheet is live before trusting a single 0.
  const styled = await page.evaluate(() => {
    document.body.innerHTML = `<div class="modal-backdrop"><div class="project-switcher-list"></div></div>`;
    return getComputedStyle(document.querySelector(".modal-backdrop")!).position;
  });
  expect(styled, "the workspace stylesheet must be loaded for this measurement").toBe("fixed");
}

/**
 * How far the widest descendant sticks out past its container's content edge. Anything a
 * parent clips is skipped: that is the shortening doing its job, not a spill.
 */
async function widestSpill(page: import("@playwright/test").Page, markup: string) {
  return page.evaluate((html) => {
    document.body.innerHTML = `<main class="main-content">${html}</main>`;
    const host = document.querySelector("main > *")!;
    const style = getComputedStyle(host);
    const edge = host.getBoundingClientRect().right
      - parseFloat(style.paddingRight || "0")
      - parseFloat(style.borderRightWidth || "0");
    let worst = 0;
    for (const node of host.querySelectorAll("*")) {
      let clipped = false;
      for (let parent = node.parentElement; parent && parent !== host.parentElement; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowX !== "visible") { clipped = true; break; }
      }
      if (clipped) continue;
      worst = Math.max(worst, node.getBoundingClientRect().right - edge);
    }
    const pageSpill = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      - document.documentElement.clientWidth;
    return { worst: Math.round(worst), pageSpill };
  }, markup);
}

for (const [name, markup] of Object.entries(nameCarryingRows)) {
  test(`${name} keeps a long unchosen name inside its own column`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-field", "one viewport is enough; the fixture sets its own widths");
    await mountFixture(page);
    for (const width of [320, 390, 820, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const { worst, pageSpill } = await widestSpill(page, markup);
      expect(worst, `${name} spills past its container at ${width}px`).toBeLessThanOrEqual(1);
      expect(pageSpill, `${name} widens the page at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}

test("a strip with an odd number of tiles ends on a straight edge", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-field", "one viewport is enough; the fixture sets its own widths");
  await mountFixture(page);
  for (const { selector, width, child } of foldingStrips) {
    await page.setViewportSize({ width, height: 900 });
    const result = await page.evaluate(({ selector, child }) => {
      const children = Array.from({ length: 3 }, () => `<${child} type="button">tile</${child}>`).join("");
      document.body.innerHTML = `<main class="main-content"><div class="${selector}">${children}</div></main>`;
      const host = document.querySelector<HTMLElement>(`.${selector}`)!;
      if (getComputedStyle(host).display !== "grid") return { skipped: true, columns: 0, gap: 0 };
      const columns = getComputedStyle(host).gridTemplateColumns.split(" ").filter(Boolean).length;
      const style = getComputedStyle(host);
      const edge = host.getBoundingClientRect().right
        - parseFloat(style.paddingRight || "0")
        - parseFloat(style.borderRightWidth || "0");
      const last = host.lastElementChild!.getBoundingClientRect();
      return { skipped: false, columns, gap: Math.round(edge - last.right) };
    }, { selector, child });

    if (result.skipped) continue;
    // Only two columns can orphan a third tile; wider layouts fit all three on one row.
    if (result.columns !== 2) continue;
    expect(result.gap, `${selector} leaves a hole beside its last tile at ${width}px`).toBeLessThanOrEqual(1);
  }
});

/** Sets of filters and choices, with the number of chips their component can hand them. */
const wrappingChipSets: Array<{ selector: string; child: string; chips: string[] }> = [
  { selector: "quick-issue-presets", child: "button", chips: ["Werkzaamheden gaande", "Werkzaamheden afgerond", "Vertraging"] },
  { selector: "work-option-grid", child: "button", chips: ["Fundering oost", "Wapening kolommen", "Storten dek 3", "Gevelbekleding"] },
  { selector: "workforce-buildings", child: "button", chips: ["Main building", "Annex noord", "Parkeerdek"] },
  { selector: "building-choice-options", child: "button", chips: ["Main building", "Annex noord", "Parkeerdek", "Trafo"] },
];

test("a wrapped set of filter chips ends flush on both sides", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-field", "one viewport is enough; the fixture sets its own widths");
  await mountFixture(page);
  await page.setViewportSize({ width: 390, height: 900 });
  for (const { selector, child, chips } of wrappingChipSets) {
    const shortfall = await page.evaluate(({ selector, child, chips }) => {
      const markup = chips.map((label) => `<${child} type="button">${label} <b>3</b></${child}>`).join("");
      document.body.innerHTML = `<main class="main-content"><div class="${selector}">${markup}</div></main>`;
      const host = document.querySelector<HTMLElement>(`.${selector}`)!;
      const style = getComputedStyle(host);
      const edge = host.getBoundingClientRect().right
        - parseFloat(style.paddingRight || "0")
        - parseFloat(style.borderRightWidth || "0");
      return Math.round(edge - host.lastElementChild!.getBoundingClientRect().right);
    }, { selector, child, chips });
    expect(shortfall, `${selector} leaves its last row short of the right edge`).toBeLessThanOrEqual(2);
  }
});
