import { expect, type Page, test } from "@playwright/test";

/**
 * An inspection from start to signed completion, the way a supervisor really works it:
 * a failed point is recorded, "Approve section" never overwrites that exception, leaving for the
 * NCR form keeps the answers, the checklist is resumed, signed under the account's own name and
 * completed, and the signature is still there after a reload.
 *
 * Runs against the local fixture stack (tests/e2e/seed-local-fixtures.mjs).
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

async function openInspections(page: Page) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination=inspections]").click();
}

test("inspection: failed point, approve section, NCR detour, resume, sign and complete", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The workflow is the same on every viewport.");
  test.setTimeout(240_000);
  await signIn(page);
  await openInspections(page);
  await page.getByRole("button", { name: "Start recommended checklist" }).click();
  const questions = page.locator(".checklist-question");
  await expect(questions.first()).toBeVisible();
  const total = await questions.count();

  // The generic per-point instruction is gone.
  await expect(page.getByText(/Choose Yes, No or N\/A/)).toHaveCount(0);

  // A failed point is an exception; "Approve section" must leave it alone.
  const failedPrompt = (await questions.first().locator("legend").innerText()).replace(/\s*\*$/, "");
  await questions.first().getByLabel("No", { exact: true }).check();
  await questions.first().locator(".checklist-remark").fill("Two operators without a helmet.");
  await page.locator(".checklist-section").first().getByRole("button", { name: "Approve section" }).click();
  await expect(questions.first().getByLabel("No", { exact: true })).toBeChecked();
  await expect(questions.nth(1).getByLabel("Yes", { exact: true })).toBeChecked();
  // Nothing left to approve in that section.
  await expect(page.locator(".checklist-section").first().getByRole("button", { name: "Approve section" })).toHaveCount(0);

  // Not complete: unanswered points and no signature.
  const complete = page.getByRole("button", { name: "Complete inspection" });
  await expect(complete).toBeDisabled();

  // Raising an NCR keeps the answers: the NCR form opens with the failed point in it.
  await page.getByRole("button", { name: /Raise an NCR/ }).click();
  await expect(page.getByRole("heading", { name: "Non-conformance report" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("textarea").filter({ hasText: failedPrompt }).first()).toBeVisible();

  // Back to the inspection: the same checklist is resumed with the answers still there.
  await openInspections(page);
  await page.getByRole("button", { name: /Fill in checklist/ }).first().click();
  await expect(questions.first()).toBeVisible();
  await expect(questions.first().getByLabel("No", { exact: true })).toBeChecked();
  await expect(questions.first().locator(".checklist-remark")).toHaveValue("Two operators without a helmet.");
  await expect(questions.nth(1).getByLabel("Yes", { exact: true })).toBeChecked();

  // Answer the rest, sign under the account's own name, complete.
  for (const section of await page.locator(".checklist-section").all()) {
    const approve = section.getByRole("button", { name: "Approve section" });
    if (await approve.count()) await approve.click();
  }
  await expect(page.locator(".checklist-progress")).toContainText(`${total} / ${total}`);
  await expect(complete).toBeDisabled(); // still unsigned
  await page.getByRole("button", { name: "Sign now" }).click();
  await expect(page.locator(".signature-modal input").first()).toHaveAttribute("readonly", "");
  await drawSignature(page);
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.getByText("Inspection completed and signed.")).toBeVisible({ timeout: 30_000 });

  // After a reload the inspection is completed and carries the signature.
  await page.reload();
  await openInspections(page);
  const row = page.locator("main").getByText(/signed by Supervisor Alpha/).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
});
