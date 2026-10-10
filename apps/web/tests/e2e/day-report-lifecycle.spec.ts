import { expect, type Locator, type Page, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * One multi-building day, end to end, through the screens a supervisor uses: start the day
 * for both buildings, count the workforce per building, answer the daily questions, check
 * and submit the report, approve (which freezes the snapshot), sign by hand, and download
 * the formal PDF and Word document from the immutable version.
 *
 * Runs against the local fixture stack (tests/e2e/seed-local-fixtures.mjs). The downloaded
 * documents are kept under test-results/documents for visual inspection.
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

async function drawSignature(page: Page) {
  const canvas = page.locator(".signature-canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height * 0.7);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(box.x + 30 + step * 22, box.y + box.height * (0.7 - Math.sin(step / 2) * 0.3));
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "Sign the document" }).click();
  await expect(page.locator(".signature-modal")).toHaveCount(0);
}

function dialog(page: Page): Locator {
  return page.getByRole("dialog").last();
}

test("a two-building day is started, closed, submitted, approved, frozen, signed and exported", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The document workflow is the same on every viewport.");
  test.setTimeout(300_000);
  await signIn(page);

  // 1. Start the day for every building at once.
  await page.getByRole("button", { name: "Start today" }).click();
  await expect(dialog(page).getByRole("heading", { name: /Start the workday/ })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Install formwork" }).first().click();
  await dialog(page).getByRole("button", { name: "Start daily report centrally" }).click();
  await expect(page.getByRole("button", { name: "Start today" })).toHaveCount(0);

  // 2. Workforce per building.
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator('[data-workspace-destination="workforce"]').click();
  const workforce = dialog(page);
  const selects = workforce.locator("select");
  for (const [building, discipline, count] of [["Hoofdgebouw", "Timmerlieden", 4], ["Nieuwbouw Oost", "Elektriciens", 3]] as const) {
    await workforce.getByRole("tab", { name: new RegExp(`^${building}`) }).click();
    await selects.nth(0).selectOption({ label: "Hoofdaannemer E2E" });
    await selects.nth(1).selectOption({ label: discipline });
    for (let person = 0; person < count; person += 1) await workforce.getByRole("button", { name: "Add person" }).click();
  }
  // Fewer people than planned: the screen asks why before it confirms.
  await workforce.getByPlaceholder("For example: two crews moved to the other building.")
    .fill("Concrete crew starts tomorrow; today only formwork and reinforcement.");
  await workforce.getByRole("button", { name: /Confirm attendance/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 3. Daily questions for all buildings.
  await page.locator(".sidebar").getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Daily questions" }).click();
  const questions = dialog(page);
  await questions.getByRole("button", { name: "Work proceeded according to plan." }).click();
  await questions.getByRole("button", { name: "Install formwork" }).last().click();
  await questions.getByRole("button", { name: "Next questions" }).click();
  await questions.getByRole("button", { name: "Next questions" }).click();
  await questions.getByRole("button", { name: "Next questions" }).click();
  await questions.getByRole("button", { name: "Concrete pour" }).click();
  await questions.getByLabel("Attachments checked").check();
  await questions.getByRole("button", { name: "Confirm daily questions" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 4. Check and submit.
  await page.getByRole("button", { name: "Check report" }).click();
  await expect(dialog(page).getByText("All checks passed")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Ready for review" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 5. Approve (freezes the snapshot) and sign.
  await page.locator(".sidebar").getByRole("button", { name: "Reports", exact: true }).click();
  await page.getByRole("tab", { name: /Review & sign/ }).click();
  await page.getByLabel("Review comment").fill("Workforce, daily questions and the start of both buildings match the site.");
  await page.getByRole("button", { name: /Approve and freeze/ }).click();
  await expect(page.getByText(/approved and frozen/i)).toBeVisible();
  await page.getByRole("button", { name: "Sign now" }).click();
  await drawSignature(page);
  await page.getByRole("button", { name: "Record signed declaration" }).click();
  await expect(page.getByText(/Signing declaration immutably linked/i)).toBeVisible();

  // 6. Formal PDF and Word straight from the immutable version.
  await page.getByRole("tab", { name: /Versions & history/ }).click();
  const fixedVersion = page.locator(".history-version").first();
  await expect(fixedVersion).toContainText("SHA");
  await mkdir(testInfo.outputPath("documents"), { recursive: true });
  const [pdf] = await Promise.all([page.waitForEvent("download"), fixedVersion.getByRole("button", { name: /PDF/ }).click()]);
  await pdf.saveAs(testInfo.outputPath("documents", "formal-day-report.pdf"));
  const [docx] = await Promise.all([page.waitForEvent("download"), fixedVersion.getByRole("button", { name: /Word/ }).click()]);
  await docx.saveAs(testInfo.outputPath("documents", "formal-day-report.docx"));
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(docx.suggestedFilename()).toMatch(/\.docx$/);
});
