import { expect, type Page, test } from "@playwright/test";

/**
 * Client feedback of 20-11-2026 asked for one field per row; the mockups of 25-11-2026 (v6) replace that
 * with up to four short fields per row on a wide card. So: only fields of a two-column group (.form-grid-2, at most
 * two) or of a numbered card (.sheet-card-grid, at most four) may share a row, and a narrow card (under 760 px)
 * stacks them. Tick boxes and choice tiles are not fields.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const tiles = [
  "Works ongoing", "Works completed", "Workforce", "Project Delay Report", "Issues", "HSE", "Materials delivery",
  "Inspections", "Technical instructions", "Change order", "NCR", "Lessons Learned", "HSE incident", "Agreements Made",
] as const;

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  await page.locator(".access-form, .project-selection-grid").first().waitFor({ state: "visible" });
  const form = page.locator(".access-form");
  if (await form.isVisible().catch(() => false)) {
    await form.locator("input[type='email']").fill(email!);
    await form.locator("input[type='password']").fill(password!);
    await form.locator("button[type='submit']").click();
  }
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

/** Fields of the open form that share a row with another field. */
const fieldsSideBySide = (page: Page) => page.evaluate(() => {
  const name = (element: Element) => {
    const field = element.closest(".form-field, label, fieldset") ?? element;
    const caption = field.querySelector(":scope > span, :scope > label, :scope > legend")?.textContent
      ?? element.getAttribute("aria-label") ?? element.getAttribute("placeholder") ?? element.tagName;
    return caption.replace(/\s+/g, " ").replace(/\*/g, "").trim().slice(0, 50);
  };
  const boxes = Array.from(document.querySelectorAll<HTMLElement>("main input, main textarea, main select"))
    .filter((element) => {
      if (element.tagName === "INPUT" && ["checkbox", "radio", "file", "hidden", "search", "range", "color"].includes((element.getAttribute("type") ?? "").toLowerCase())) return false;
      if (element.closest(".workspace-launcher-search, .workspace-search-filters, .inspection-search, .spec-facet-filter, .time-field, [role=search], .record-form-actions")) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 40 && rect.height > 10 && style.visibility !== "hidden" && style.display !== "none" && !element.closest("details:not([open])");
    })
    .map((element) => ({ element, rect: element.getBoundingClientRect() }));
  const pairs: string[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]; const b = boxes[j];
      const overlap = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      const apart = a.rect.right <= b.rect.left + 2 || b.rect.right <= a.rect.left + 2;
      const grid = a.element.closest(".sheet-card-grid, .form-grid-2");
      const limit = grid?.classList.contains("sheet-card-grid") ? (grid.getBoundingClientRect().width >= 760 ? 4 : 1) : 2;
      const sameRow = (box: { rect: DOMRect }) => Math.min(a.rect.bottom, box.rect.bottom) - Math.max(a.rect.top, box.rect.top) > Math.min(a.rect.height, box.rect.height) * 0.5;
      const allowed = grid !== null && grid === b.element.closest(".sheet-card-grid, .form-grid-2") && boxes.filter((box) => grid.contains(box.element) && sameRow(box)).length <= limit;
      if (overlap > Math.min(a.rect.height, b.rect.height) * 0.5 && apart && !allowed) pairs.push(`"${name(a.element)}" beside "${name(b.element)}" [${(() => { let node: HTMLElement | null = a.element.parentElement; while (node && !node.contains(b.element)) node = node.parentElement; return node ? `${node.tagName}.${String(node.className)} ${getComputedStyle(node).display}` : ""; })()}]`);
    }
  }
  return pairs;
});

test("fields share a row only in a two-column group, at most two, on every form", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "This test sets the widths itself.");
  test.setTimeout(600_000);
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  const workspace = new URL(page.url()).search;
  const found: string[] = [];
  for (const width of [820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tile of tiles) {
      await page.goto(`/supervisie${workspace}`, { waitUntil: "domcontentloaded" });
      const entry = page.locator("main").getByRole("button", { name: new RegExp(`^(\\d+\\s*)?${tile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first();
      await expect(entry, `${tile} should be on Workspace`).toBeVisible();
      await entry.click();
      await page.waitForTimeout(900);
      for (const pair of await fieldsSideBySide(page)) found.push(`${tile} · ${width}px: ${pair}`);
    }
  }
  console.log(found.join("\n"));
  expect(found, "fields side by side outside a two-column group").toEqual([]);
});
