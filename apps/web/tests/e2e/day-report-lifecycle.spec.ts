import { expect, type Locator, type Page, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * One multi-building day, end to end, through the screens a supervisor uses: start the day
 * for both buildings, count the workforce per building on the Workforce page, write the day
 * log on its page for both buildings, check and submit the report, approve (which freezes the snapshot), sign by hand, and download
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

  // 2. Workforce per building, on the Workforce page itself — not a pop-up.
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator('[data-workspace-destination="workforce"]').click();
  await expect(page.getByRole("heading", { name: "Who is on site today?" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const workforce = page.locator(".workforce-form");
  const selects = workforce.locator(".workforce-sections select");
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
  await expect(page.getByText(/7 people recorded for today/)).toBeVisible();
  // The counted day is listed under the form, per building.
  await expect(page.locator(".record-row").filter({ hasText: "4 people on site" })).toBeVisible();
  await expect(page.locator(".record-row").filter({ hasText: "3 people on site" })).toBeVisible();

  // 3. The day log, for both buildings, on its own workspace page.
  await page.locator(".sidebar").getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Day log" }).click();
  await expect(page.getByRole("heading", { name: "Today on site" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const dayLog = page.locator(".daily-log-form");
  await dayLog.getByLabel("All buildings").check();
  // The crew is read from the Workforce register, not counted a second time.
  await expect(dayLog.getByText("7 people recorded today")).toBeVisible();
  await dayLog.getByLabel("What is in progress, and where?").fill("Formwork and reinforcement for the ground floor slab in both buildings.");
  await dayLog.getByLabel("Work completed today").fill("Formwork of axis A to C installed and checked.");
  await dayLog.getByLabel("Plan for tomorrow").fill("Concrete pour of the ground floor slab.");
  await dayLog.getByRole("button", { name: "Save daily log" }).click();
  await expect(page.getByText(/Daily log saved/)).toBeVisible();
  await expect(page.locator(".record-row").filter({ hasText: "Formwork and reinforcement" }).first()).toBeVisible();
  await page.locator(".sidebar").getByRole("button", { name: "Overview", exact: true }).click();

  // 4. Check and submit.
  await page.getByRole("button", { name: "Check report" }).click();
  await expect(dialog(page).getByText("All checks passed")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Ready for review" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 5. Approve (freezes the snapshot) and sign.
  await page.locator(".sidebar").getByRole("button", { name: "Reports", exact: true }).click();
  await page.getByRole("tab", { name: /Review & sign/ }).click();
  await page.getByLabel("Review comment").fill("Workforce, day log and the start of both buildings match the site.");
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
