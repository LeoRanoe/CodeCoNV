import { expect, test } from "@playwright/test";

/**
 * The grid round made tiles and cards multi-column on phone and tablet, and caught a few
 * rows it should have left alone. This walks the real stylesheet at the widths the client
 * actually holds: a filter row must never squeeze two fields onto a phone line, a tab strip
 * must keep its reading order, a list row's actions belong on one line, and nothing may
 * push the page sideways.
 *
 * The page these fixtures borrow the stylesheet from is a React app that rewrites the body
 * while it hydrates, so each fixture is injected and measured inside a single evaluate:
 * there is no await for hydration to slip through.
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
  <div class="record-stack">
    ${[1, 2].map((index) => `<article class="record-row record-row-clickable">
      <span class="action-icon"></span>
      <div><strong>Cast-in anchors · installation · Main building</strong><span>INS-2026-000${index} · Main building · 4 aug 2026</span></div>
      <div class="record-row-actions">
        <button class="secondary-button record-row-open" type="button">Bekijken</button>
        <button class="secondary-button record-row-edit" type="button">Bewerken</button>
        <button class="ghost-button record-row-withdraw" type="button">Intrekken</button>
      </div>
      <span class="task-status">in progress</span>
    </article>`).join("")}
  </div>
  <div class="punchlist-command">
    <div class="punchlist-stages">
      ${[["Open", 1], ["In uitvoering", 0], ["Gereed voor verificatie", 0], ["Geverifieerd", 0]].map(([label, count], index) => `<div${index === 2 ? ' class="attention"' : ""}><span>${index + 1}</span><strong>${count}</strong><small>${label}</small></div>`).join("")}
    </div>
  </div>
  <div class="record-form-sections workforce-sections">
    <section class="record-form-section workforce-section">
      <header class="record-form-section-heading">
        <span class="record-form-section-number">1</span>
        <div><h3>Bezetting per discipline</h3><p>Kies de discipline die er echt is en zet het aantal van vandaag.</p></div>
        <div class="record-form-section-aside"><span class="workforce-section-count"><span class="workforce-section-icon"></span><strong>24</strong></span></div>
      </header>
      <div class="record-form-section-body"><p>Body</p></div>
    </section>
  </div>
  <section class="drawing-unplaced-list">
    <header><strong>Nog niet op een tekening</strong><b>12</b></header>
    ${["INS-2026-0007", "PHOTO", "INS-2026-0006"].map((code, index) => `<button type="button"><span class="drawing-unplaced-dot tone-${index === 1 ? "cyan" : "green"}"></span><span><strong>${code}</strong><small>Cast-in anchors installation</small></span></button>`).join("")}
  </section>
</main>`;

type Measurements = {
  searchFilterColumns: number;
  documentFilterColumns: number;
  documentTabsDisplay: string;
  moduleGroupColumns: number;
  tileColumns: number;
  actionRowCount: number;
  actionsHeight: number;
  dotEscapesRow: boolean;
  dotHeight: number;
  clippedStageLabels: number;
  shortTargets: number;
  /** Gap between the section's running count and the right edge of its card. */
  workforceCountGap: number;
  workforceHeadingRows: number;
  overflow: number;
};

/** Injects the fixture and reads every measurement from it without yielding in between. */
async function measure(page: import("@playwright/test").Page, html: string): Promise<Measurements> {
  return page.evaluate((markup): Measurements => {
    document.body.innerHTML = markup;
    const columns = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return -1;
      const value = getComputedStyle(element).gridTemplateColumns;
      return value === "none" ? 0 : value.split(" ").filter(Boolean).length;
    };
    const actions = document.querySelector(".record-row-actions");
    const actionButtons = [...(actions?.querySelectorAll("button") ?? [])];
    const workforceCard = document.querySelector(".workforce-section");
    const workforceCount = document.querySelector(".workforce-section-count");
    const workforceNumber = document.querySelector(".workforce-section .record-form-section-number");
    const cardBox = workforceCard?.getBoundingClientRect();
    const countBox = workforceCount?.getBoundingClientRect();
    const numberBox = workforceNumber?.getBoundingClientRect();
    const dot = document.querySelector(".drawing-unplaced-dot");
    const dotRow = document.querySelector(".drawing-unplaced-list > button");
    const dotBox = dot?.getBoundingClientRect();
    const rowBox = dotRow?.getBoundingClientRect();
    return {
      searchFilterColumns: columns(".workspace-search-filters"),
      documentFilterColumns: columns(".project-document-filters"),
      documentTabsDisplay: getComputedStyle(document.querySelector(".project-document-tabs")!).display,
      moduleGroupColumns: columns(".workspace-module-groups"),
      tileColumns: columns(".client-workspace-grid"),
      actionRowCount: new Set(actionButtons.map((button) => Math.round(button.getBoundingClientRect().y))).size,
      actionsHeight: actions?.getBoundingClientRect().height ?? 0,
      dotEscapesRow: !dotBox || !rowBox ? true : dotBox.top < rowBox.top - 1 || dotBox.bottom > rowBox.bottom + 1,
      dotHeight: dotBox?.height ?? 0,
      clippedStageLabels: [...document.querySelectorAll(".punchlist-stages > div small")]
        .filter((label) => label.scrollWidth > label.clientWidth + 1).length,
      shortTargets: [
        ...document.querySelectorAll(".workspace-launcher-tile, .project-document-tabs > button, .daily-work-tabs button, .record-row-actions button"),
      ].filter((element) => element.getBoundingClientRect().height < 36).length,
      workforceCountGap: !cardBox || !countBox ? Number.POSITIVE_INFINITY : cardBox.right - countBox.right,
      // The step number and the count sit on one line with the title between them; when the
      // heading breaks into two rows the count has been pushed under the title.
      workforceHeadingRows: !numberBox || !countBox ? -1
        : new Set([Math.round(numberBox.top / 8), Math.round(countBox.top / 8)]).size,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
    };
  }, html);
}

for (const size of widths) {
  test(`layout holds at ${size.name} (${size.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    // The workspace stylesheet lives on the app route, not the public landing page.
    await page.goto("/supervisie", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const seen = await measure(page, fixture);

    // A form row never puts two fields on one phone line, and stays multi-column above it.
    if (size.phone) {
      expect(seen.searchFilterColumns, `search filters at ${size.width}px`).toBe(1);
      expect(seen.documentFilterColumns, `document filters at ${size.width}px`).toBe(1);
      expect(seen.moduleGroupColumns, `module groups at ${size.width}px`).toBe(1);
    } else {
      expect(seen.searchFilterColumns, `search filters at ${size.width}px`).toBeGreaterThan(1);
      expect(seen.documentFilterColumns, `document filters at ${size.width}px`).toBeGreaterThan(1);
    }

    // The tab strip keeps its reading order: it scrolls on a phone instead of wrapping.
    expect(seen.documentTabsDisplay, `document tabs at ${size.width}px`).toBe(size.phone ? "flex" : "grid");

    // Tiles keep the grid the round was for.
    expect(seen.tileColumns, `tiles at ${size.width}px`).toBeGreaterThanOrEqual(2);

    // The three row actions share one line rather than becoming three stacked buttons.
    expect(seen.actionRowCount, `action rows at ${size.width}px`).toBe(1);
    expect(seen.actionsHeight, `actions height at ${size.width}px`).toBeLessThan(120);

    // A dot in the unplaced list stays inside its row instead of escaping as a map pin.
    expect(seen.dotEscapesRow, `unplaced dot escapes its row at ${size.width}px`).toBe(false);
    expect(seen.dotHeight, `unplaced dot height at ${size.width}px`).toBeLessThanOrEqual(30);

    // Workforce is the shared record-form card now: its running count stays pinned to the
    // right edge of the heading instead of sitting against the title or dropping a line.
    expect(seen.workforceCountGap, `workforce count gap at ${size.width}px`).toBeLessThan(40);
    expect(seen.workforceHeadingRows, `workforce heading rows at ${size.width}px`).toBe(1);

    // Stage labels are readable, touch targets reachable, and the page never scrolls sideways.
    expect(seen.clippedStageLabels, `clipped stage labels at ${size.width}px`).toBe(0);
    expect(seen.shortTargets, `targets under 36px at ${size.width}px`).toBe(0);
    expect(seen.overflow, `horizontal overflow at ${size.width}px`).toBeLessThanOrEqual(1);
  });
}
