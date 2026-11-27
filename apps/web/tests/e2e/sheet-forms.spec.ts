import { expect, type Page, test } from "@playwright/test";
import { finishSigning } from "./sign-popup";
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

async function openTile(page: Page, id: string) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator(`[data-workspace-destination='${id}']`).click();
}

/** The first rows of each sheet, in the order of the mockups v6 (the title bar first; labels as the screen shows them). */
const sheets: Array<{ tile: string; form: string; heading: string; save: RegExp; first: string[] }> = [
  { tile: "issues", form: "issue", heading: "Issues", save: /^Sign, submit & notify$/, first: ["Title", "Issue type", "Category", "Discipline / work package", "Description", "Location"] },
  { tile: "ncr", form: "ncr", heading: "NCR", save: /^Raise & notify contractor$/, first: ["Title", "NCR type", "Category", "Non-conformance description", "Discipline / work package", "Requirement reference"] },
  { tile: "hse", form: "hse", heading: "HSE", save: /^Sign, submit & notify$/, first: ["Title", "Issue type", "Category", "Person / contractor involved", "Observation / hazard description"] },
  { tile: "hse-incident", form: "hse_incident", heading: "HSE incident registration", save: /^Sign, submit & notify$/, first: ["Incident title", "Incident type", "Incident category", "Detailed event description"] },
  { tile: "materials-delivery", form: "delivery", heading: "Materials delivery", save: /^Sign, submit & notify$/, first: ["Title", "Purchase order / requisition", "Supplier", "Delivery note number", "Planned delivery date/time", "Material group"] },
  { tile: "technical-instructions", form: "technical_instruction", heading: "Technical instructions", save: /^Issue & notify contractor$/, first: ["Title", "Instruction type", "Discipline"] },
  { tile: "change-order", form: "change_order", heading: "Change order (CO)", save: /^Sign, submit & notify$/, first: ["Change title", "Change type", "Change category", "Change description", "Reason for change", "Originator / requester"] },
  { tile: "delay-report", form: "delay_report", heading: "Project Delay Report (PDR)", save: /^Sign, submit & notify$/, first: ["Title", "Delay start date/time", "Affected activity"] },
  { tile: "lessons-learned", form: "lessons_learned", heading: "Lessons Learned (LL)", save: /^Sign, submit & notify$/, first: ["Title", "Project phase", "Lesson category", "Situation / context", "What happened?"] },
  { tile: "agreements-made", form: "agreement", heading: "Agreements Made", save: /^Sign, submit & notify$/, first: ["Agreement / decision title", "Meeting / source", "Agreed by", "Agreement type", "Agreement category"] },
  { tile: "works-ongoing", form: "works_ongoing", heading: "Works ongoing", save: /^Sign, submit & notify$/, first: ["Title", "Drawing location (PDF + pin)", "Building / area", "Exact location / grid / level", "Shift", "Weather"] },
  { tile: "works-completed", form: "works_completed", heading: "Works completed", save: /^Sign, submit & notify$/, first: ["Title", "Based on Works Ongoing record", "Work discipline", "Activity"] },
];

/** The label of each row of the sheet form, top to bottom: the title bar, then the rows of the numbered cards. */
async function rowLabels(page: Page, form: string) {
  return page.locator(`[data-sheet-form='${form}'] .sheet-title-row, [data-sheet-form='${form}'] .sheet-cell`).evaluateAll((rows) => rows.map((row) => {
    // A sheet row with several controls is headed by its sheet label or its first control's.
    const label = row.querySelector(".sheet-slot-label") ?? row.querySelector("legend") ?? row.querySelector("label") ?? row.querySelector("span");
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

    if (sheet.form === "delivery") {
      const group = form.locator('[data-spec-field="material_group"] select');
      const category = form.locator('[data-spec-field="material_category"]');
      const tile = (name: string) => category.locator(".choice-tile", { hasText: name });
      await group.selectOption("Cement & Binders");
      await tile("Portland cement (bags)").click();
      await group.selectOption("Insulation");
      await expect(category.locator(".choice-tile input:checked")).toHaveCount(0);
      await expect(tile("Portland cement (bags)")).toHaveCount(0);
      await tile("Thermal insulation").click();
      const unit = form.locator('[data-spec-field="unit"] select');
      await expect(unit.locator('option[value="bags"]')).toHaveCount(1);
      await unit.selectOption("kg");
      await expect(form.locator('[data-spec-field="planned_delivery_at"] input')).not.toHaveValue("");
      const stored = form.locator('[data-spec-field="stored_on_site"] input');
      if (await stored.isVisible()) await stored.uncheck();
    }

    const labels = await rowLabels(page, sheet.form);
    expect(labels.slice(0, sheet.first.length)).toEqual(sheet.first);
    // Mockups v6: a form is one page of numbered cards (Works ongoing six, Works completed five), the last one the sign-off.
    if (sheet.form === "works_ongoing" || sheet.form === "works_completed") {
      const titles = form.locator(".sheet-section-title");
      await expect(titles).toHaveCount(sheet.form === "works_ongoing" ? 6 : 5);
      await expect(titles.first()).toContainText(sheet.form === "works_ongoing" ? "Location" : "Work");
      await expect(titles.last()).toContainText("Sign-off");
    }
    // Every sheet form is numbered 1..n and ends with the sign-off card.
    const sections = await form.locator(".sheet-section-title").evaluateAll((nodes) => nodes.map((node) => ({ number: node.getAttribute("data-sheet-section"), title: node.textContent ?? "" })));
    expect(sections.length, `${sheet.form} has numbered cards`).toBeGreaterThanOrEqual(4);
    expect(sections.map((section) => section.number)).toEqual(sections.map((_, index) => String(index + 1)));
    expect(sections.at(-1)!.title).toContain("Sign-off");
    await page.screenshot({ path: testInfo.outputPath(`${sheet.form}.png`), fullPage: true });

    await expect(page.locator(".confirm-needs, .record-still-needed")).toHaveCount(0);
    const save = page.locator("main").getByRole("button", { name: sheet.save }).last();
    await expect(save).toBeEnabled();
    await save.click();
    await finishSigning(page);
    await expect(page.locator(".operation-alert.success")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".operation-alert.error")).toHaveCount(0);
  });
}
