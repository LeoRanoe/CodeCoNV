import { expect, type Page, test } from "@playwright/test";
import { fillSpecFields } from "./spec-fill";

/**
 * Decision 18 (XL-16-005): CODECO approved all 13 values of the workbook's Shared Dropdown Lists Units row,
 * including mm and cm. Works Ongoing, Works Completed and Materials Delivery offer exactly those 13, in the
 * workbook's order, and Materials Delivery saves a delivery in mm and one in cm.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const approved = ["m", "m²", "m³", "mm", "cm", "kg", "tonne", "pcs", "number", "lot", "hours", "set", "other"];

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

async function openTile(page: Page, id: string) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator(`[data-workspace-destination='${id}']`).click();
}

const unitKey: Record<string, string> = { works_ongoing: "quantity_unit", works_completed: "quantity_unit", delivery: "unit" };
const unitOptions = (page: Page, form: string) =>
  page.locator(`[data-sheet-form='${form}'] [data-spec-field="${unitKey[form]}"] select option`).evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));

test("the three forms that ask for a unit offer the 13 approved values, in the workbook's order", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The lists are the same on every viewport.");
  test.setTimeout(150_000);
  await signIn(page);
  for (const [tile, form] of [["works-ongoing", "works_ongoing"], ["works-completed", "works_completed"], ["materials-delivery", "delivery"]] as const) {
    await openTile(page, tile);
    await expect(page.locator(`[data-sheet-form='${form}']`)).toBeVisible();
    expect(await unitOptions(page, form), `${form} units`).toEqual(approved);
  }
});

for (const unit of ["mm", "cm"]) {
  test(`Materials Delivery saves a delivery in ${unit}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-office", "One route is enough.");
    test.setTimeout(150_000);
    await signIn(page);
    await openTile(page, "materials-delivery");
    const form = page.locator("[data-sheet-form='delivery']");
    await expect(form).toBeVisible();
    const stamp = `${unit}-${Date.now().toString(36)}`;
    const title = form.locator("[data-sheet-slot='title'] input");
    if (await title.count()) await title.fill(`Launch units ${stamp}`);
    const description = form.locator("[data-sheet-slot='description'] textarea");
    if (await description.count()) await description.fill(`Launch unit check ${stamp}.`);
    await fillSpecFields(page.locator("main"));
    await fillSpecFields(page.locator("main"));
    await form.locator('[data-spec-field="material_group"] select').selectOption("Delivery Discrepancy");
    await form.locator('[data-spec-field="material_category"] select').selectOption("Quantity Shortage");
    await form.locator('[data-spec-field="unit"] select').selectOption(unit);
    const stored = form.locator('[data-spec-field="stored_on_site"] input');
    if (await stored.isVisible()) await stored.uncheck();
    await expect(page.locator(".confirm-needs, .record-still-needed")).toHaveCount(0);
    await page.getByRole("button", { name: /^Save register item$/ }).click();
    await expect(page.getByText(/saved|opgeslagen/i).first()).toBeVisible({ timeout: 30_000 });
  });
}
