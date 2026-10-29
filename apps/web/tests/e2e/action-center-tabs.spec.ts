import { expect, type Page, test } from "@playwright/test";

/**
 * QA sweep H2. On every width up to 1024 px the Action center's three tabs were laid out by
 * three CSS rules that disagreed: four 82 px columns, tabs 160 px high and the word "Mijn werk"
 * written letter by letter downwards. Three equal tabs, at least 44 px high, whose names are
 * horizontal words, on every width a phone, a tablet or a zoomed window can have.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

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

async function openActions(page: Page) {
  const sidebar = page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true });
  if (await sidebar.isVisible().catch(() => false)) return sidebar.click();
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "Actions" }).click();
}

const widths = [320, 360, 375, 390, 414, 600, 768, 1024];

test("the Action center tabs are three equal, tall, horizontal tabs on every width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The widths are set by the test itself.");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page);
  await openActions(page);
  const tabs = page.locator(".action-center-views [role='tab']");
  await expect(tabs).toHaveCount(3);

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const boxes = await tabs.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      const label = element.querySelector(".section-nav__label")!.getBoundingClientRect();
      return { width: box.width, height: box.height, labelWidth: label.width, labelHeight: label.height };
    }));
    const where = `at ${width} px: ${JSON.stringify(boxes)}`;
    for (const box of boxes) {
      expect(box.height, `tab height ${where}`).toBeGreaterThanOrEqual(44);
      // A word written downwards is taller than it is wide.
      expect(box.labelWidth, `label is a horizontal word ${where}`).toBeGreaterThan(box.labelHeight);
      expect(Math.abs(box.width - boxes[0].width), `equal tabs ${where}`).toBeLessThanOrEqual(2);
    }
    expect(boxes.reduce((total, box) => total + box.width, 0), `the three tabs share one row ${where}`).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll ${where}`).toBe(true);
  }
});

/**
 * QA L23. "Still open 7" next to "All work 9" read as a disagreement. A tile counts within the
 * chosen type and a tab within the chosen state, so each number is the number of rows its
 * button leaves in the list.
 */
test("a number on a tile or a tab is the number of rows it leaves", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "Layout is not under test.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page);
  await openActions(page);
  await page.getByRole("tab", { name: /All project work/ }).click();
  const rows = page.locator(".unified-action-list > button");
  const countOf = async (locator: ReturnType<Page["locator"]>) => Number((await locator.innerText()).match(/(\d+)\s*$/m)?.[1] ?? "NaN");
  const allWorkTab = page.locator(".action-type-tabs [role='tab']").first();
  const tile = (name: string) => page.locator(".action-center-summary button", { hasText: name }).locator("strong");

  // The default state is "Still open": tile, tab and list agree.
  const open = Number(await tile("Still open").innerText());
  await expect(rows).toHaveCount(open);
  expect(await countOf(allWorkTab), "tab 'All work' within the state 'Still open'").toBe(open);

  // Every record: the tab follows the state, the tile counts the whole type.
  await page.locator(".action-center-summary button", { hasText: "All records" }).click();
  const all = Number(await tile("All records").innerText());
  await expect(rows).toHaveCount(all);
  expect(await countOf(allWorkTab), "tab 'All work' within the state 'All records'").toBe(all);
  expect(all).toBeGreaterThanOrEqual(open);
});

/**
 * QA L23, seen in the walkthrough. A stale rule painted the label of every tab, and its count,
 * in the red of a late record, and the type menu added "1/9" next to the count. Navigation
 * keeps the text colour; red stays with record state.
 */
test("the Action center tabs are not coloured like a late record and show no 'n/9' next to a count", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The widths are set by the test itself.");
  await page.setViewportSize({ width: 1024, height: 800 });
  await signIn(page);
  await openActions(page);
  const labels = page.locator(".action-center-views .section-nav__label");
  await expect(labels).toHaveCount(3);
  const colours = await labels.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { colour: style.color, background: style.backgroundColor };
  }));
  for (const { colour, background } of colours) {
    const [red, green, blue] = colour.match(/\d+/g)!.map(Number);
    expect(red - Math.max(green, blue), `label colour ${colour} is not red`).toBeLessThan(40);
    expect(background, "the label has no pill of its own").toBe("rgba(0, 0, 0, 0)");
  }
  await expect(page.locator(".section-nav__position")).toHaveCount(0);
});
