import { expect, type Page, test } from "@playwright/test";
import { fillSpecFields } from "./spec-fill";

/**
 * The client's workbook (FINAL v2), START HERE: "Use the relevant form sheet to build each
 * screen in the stated field order." Every Workspace tile opens its sheet, row by row; this
 * walks each one, fills it the way a supervisor would and saves it.
 *
 * Runs against the local fixture stack (tests/e2e/seed-local-fixtures.mjs).
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
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

async function openTile(page: Page, id: string) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator(`[data-workspace-destination='${id}']`).click();
}

/** The first rows of each sheet, in the workbook's order (labels as the screen shows them). */
const sheets: Array<{ tile: string; form: string; heading: string; save: RegExp; first: string[] }> = [
  { tile: "issues", form: "issue", heading: "Issues", save: /^Submit issue$/, first: ["Date/time identified", "Issue type", "Category", "Title", "Description", "Location", "Discipline / work package", "Priority"] },
  { tile: "ncr", form: "ncr", heading: "NCR", save: /^Submit NCR$/, first: ["Date raised", "NCR type", "Category", "Title", "Non-conformance description", "Discipline / work package", "Location / element"] },
  { tile: "hse", form: "hse", heading: "HSE", save: /^Submit issue$/, first: ["Date/time observed", "Issue type", "Category", "Title", "Observation / hazard description", "Location"] },
  { tile: "hse-incident", form: "hse_incident", heading: "HSE incident registration", save: /^Submit issue$/, first: ["Incident date/time", "Incident type", "Incident category", "Incident title", "Detailed event description", "Exact location"] },
  { tile: "materials-delivery", form: "delivery", heading: "Materials delivery", save: /^Save register item$/, first: ["Delivery date/time", "Supplier", "Purchase order / requisition", "Delivery note number", "Material group"] },
  { tile: "technical-instructions", form: "technical_instruction", heading: "Technical instructions", save: /^Create controlled document$/, first: ["Instruction date", "Instruction type", "Discipline"] },
  { tile: "change-order", form: "change_order", heading: "Change order (CO)", save: /^Create controlled document$/, first: ["Request date", "Change type", "Change category", "Change title", "Change description", "Reason for change", "Originator / requester"] },
  { tile: "delay-report", form: "delay_report", heading: "Project Delay Report (PDR)", save: /^Save delay report$/, first: ["Delay start date/time", "Affected activity"] },
  { tile: "lessons-learned", form: "lessons_learned", heading: "Lessons Learned (LL)", save: /^Save lesson learned$/, first: ["Date recorded", "Project phase", "Lesson category", "Title", "Situation / context", "What happened?"] },
  { tile: "agreements-made", form: "agreement", heading: "Agreements Made", save: /^Save agreement$/, first: ["Meeting / agreement date", "Meeting / source", "Agreement type", "Agreement category", "Agreement / decision title", "Agreement details"] },
  { tile: "works-ongoing", form: "works_ongoing", heading: "Works ongoing", save: /^Save register item$/, first: ["Report date", "Shift", "Work discipline", "Activity", "Building / area", "Exact location / grid / level", "What exactly is being worked on?"] },
  { tile: "works-completed", form: "works_completed", heading: "Works completed", save: /^Save register item$/, first: ["Completion date", "Work discipline", "Activity", "Building / area", "Exact location / grid / level", "What was completed?"] },
];

/** The label of each row of the sheet form, top to bottom. */
async function rowLabels(page: Page, form: string) {
  return page.locator(`[data-sheet-form='${form}'] > *`).evaluateAll((rows) => rows.map((row) => {
    // A sheet row with several controls is headed by its sheet label or its first control's.
    const label = row.querySelector(".sheet-slot-label") ?? row.querySelector("legend") ?? row.querySelector("span");
    return (label?.textContent ?? "").replace(/\s*\*\s*$/, "").trim();
  }).filter(Boolean));
}

for (const sheet of sheets) {
  test(`${sheet.form}: the Workspace form is its sheet, row by row, and saves`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-office", "The order is the same on every viewport.");
    test.setTimeout(150_000);
    await signIn(page);
    await openTile(page, sheet.tile);
    const form = page.locator(`[data-sheet-form='${sheet.form}']`);
    await expect(form).toBeVisible();
    // F17: the page is headed by the form's own Workspace name, not the generic register.
    await expect(page.locator(".workspace-current-module h1")).toHaveText(sheet.heading);
    // Nothing is added underneath the sheet any more: one section is the whole form.
    await expect(page.locator("main [data-spec-form]")).toHaveCount(1);

    const stamp = Date.now().toString(36);
    const title = form.locator("[data-sheet-slot='title'] input");
    if (await title.count()) await title.fill(`Sheet ${sheet.form.replace(/_/g, " ")} ${stamp}`);
    const description = form.locator("[data-sheet-slot='description'] textarea");
    if (await description.count()) await description.fill(`Sheet ${sheet.form.replace(/_/g, " ")} described on site ${stamp}.`);
    // Responsible party (Issue row 13): the sheet's list (filled below) and the name.
    const responsible = form.locator("[data-sheet-slot='responsible']");
    if (await responsible.count()) await responsible.locator("input").last().fill("E2E Contractor");
    await fillSpecFields(page.locator("main"));
    await fillSpecFields(page.locator("main"));

    const labels = await rowLabels(page, sheet.form);
    expect(labels.slice(0, sheet.first.length)).toEqual(sheet.first);
    await page.screenshot({ path: testInfo.outputPath(`${sheet.form}.png`), fullPage: true });

    await expect(page.locator(".confirm-needs, .record-still-needed")).toHaveCount(0);
    const save = page.locator("main").getByRole("button", { name: sheet.save }).last();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.locator(".operation-alert.success")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".operation-alert.error")).toHaveCount(0);
  });
}
