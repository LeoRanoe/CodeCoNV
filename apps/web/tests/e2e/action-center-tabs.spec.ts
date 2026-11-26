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

async function openActions(page: Page) {
  const sidebar = page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true });
  if (await sidebar.isVisible().catch(() => false)) return sidebar.click();
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "Actions" }).click();
}

const widths = [320, 360, 375, 390, 414, 600, 768, 1024];

test("the Action center views are tall, horizontal and inside the window on every width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The widths are set by the test itself.");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page);
  await openActions(page);
  // v5: four views (my work, all work, deadlines and the automatic follow-up list per form). With more
  // than three, the navigation is a bar on a wide window and one menu button on a narrow one.
  await expect(page.locator(".action-center-views [role='tab']")).toHaveCount(4);

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const trigger = page.locator(".action-center-views .section-nav__trigger");
    if (await trigger.isVisible()) {
      const box = (await trigger.boundingBox())!;
      expect(box.height, `menu button height at ${width} px`).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width, `menu button inside the window at ${width} px`).toBeLessThanOrEqual(width);
    } else {
      const boxes = await page.locator(".action-center-views [role='tab']").evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        const label = element.querySelector(".section-nav__label")!.getBoundingClientRect();
        return { width: box.width, height: box.height, labelWidth: label.width, labelHeight: label.height };
      }));
      const where = `at ${width} px: ${JSON.stringify(boxes)}`;
      expect(boxes.length, `all four views are shown ${where}`).toBe(4);
      for (const box of boxes) {
        expect(box.height, `tab height ${where}`).toBeGreaterThanOrEqual(44);
        // A word written downwards is taller than it is wide.
        expect(box.labelWidth, `label is a horizontal word ${where}`).toBeGreaterThan(box.labelHeight);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll at ${width} px`).toBe(true);
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
  await expect(labels).toHaveCount(4);
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

/**
 * Developer package v5, Word 4: Actions can be narrowed to one contractor. The list, the tiles and the tabs follow the
 * chosen contractor; the option counts are the rows it leaves in the state "All records"; the filter resets.
 */
test("the Action center can be filtered to one contractor and reset", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "Layout is not under test.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page);
  await openActions(page);
  await page.getByRole("tab", { name: /All project work/ }).click();
  await page.locator(".action-center-summary button", { hasText: "All records" }).click();
  const rows = page.locator(".unified-action-list > button");
  const select = page.locator("[data-action-contractor]");
  await expect(select, "a project with contractor follow-up offers the filter").toBeVisible();
  const everything = await rows.count();

  const options = await select.locator("option").evaluateAll((items) => items.map((item) => ({ value: (item as HTMLOptionElement).value, label: item.textContent ?? "" })));
  expect(options[0].value).toBe("");
  const contractors = options.filter((option) => option.value);
  expect(contractors.length).toBeGreaterThan(0);
  let counted = 0;
  for (const option of contractors) {
    await select.selectOption(option.value);
    const expected = Number(option.label.match(/\((\d+)\)\s*$/)?.[1] ?? "NaN");
    await expect(rows, `${option.label} leaves exactly its own items`).toHaveCount(expected);
    await expect(page.locator(".action-center-summary button", { hasText: "All records" }).locator("strong")).toHaveText(String(expected));
    counted += expected;
  }
  expect(counted, "no item belongs to two contractors").toBeLessThanOrEqual(everything);

  // Combined with a type: the list is the intersection, and an empty result offers a reset.
  await select.selectOption(contractors[0].value);
  const typeTabs = page.locator(".action-type-tabs [role='tab']");
  for (let index = 1; index < await typeTabs.count(); index += 1) {
    if (Number((await typeTabs.nth(index).innerText()).match(/(\d+)\s*$/m)?.[1] ?? "0") === 0) {
      await typeTabs.nth(index).click();
      await expect(rows).toHaveCount(0);
      await page.getByRole("button", { name: "Clear filters" }).click();
      await expect(select).toHaveValue("");
      await expect(rows).toHaveCount(everything);
      return;
    }
  }
  await select.selectOption("");
  await expect(rows).toHaveCount(everything);
});
