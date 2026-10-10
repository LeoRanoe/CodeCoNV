import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

/**
 * A technical instruction signed by two different people: the issuer signs under their own
 * account name, the recipient signs the formal response by hand. Reloading shows both, the
 * issuer's signature can no longer be replaced, the recipient cannot be the issuer, and the
 * PDF and Word files are generated.
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

test("technical instruction: the issuer signs as themself, the recipient signs the response", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The document workflow is the same on every viewport.");
  test.setTimeout(180_000);
  const title = `Two-party TI ${Date.now().toString(36)} · anchor bolt torque`;
  await signIn(page);

  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator('[data-workspace-destination="technical-instructions"]').click();
  const form = page.locator(".controlled-document-form");
  await expect(form).toBeVisible();
  await form.locator(".controlled-document-primary input").fill(title);
  await form.locator(".controlled-document-primary textarea").fill("Torque every cast-in anchor to the value on the approved drawing before the base plate is grouted.");
  const deadline = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await form.locator(".controlled-document-deadline input[type=date]").fill(deadline);
  await form.locator("label.form-field").filter({ hasText: "To:" }).locator("select").selectOption({ label: "Hoofdaannemer E2E · Contractor" });

  // The issuer's name on the signature is the account's own name; it cannot be typed over.
  await form.getByRole("button", { name: "Sign now" }).click();
  await expect(page.locator(".signature-modal input").first()).toHaveAttribute("readonly", "");
  await drawSignature(page);
  await form.getByRole("button", { name: "Create controlled document" }).click();

  const card = page.locator(".controlled-document-card").filter({ hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: /Open record/ }).click();
  await expect(card.locator(".controlled-history-signatures")).toContainText("Issued · awaiting acknowledgement");
  await expect(card.locator(".controlled-history-signatures")).toContainText("Recipient: not signed");

  // The recipient cannot be the issuer.
  await card.getByRole("button", { name: "Record formal response" }).click();
  await card.locator("label.form-field").filter({ hasText: "Position" }).locator("input").fill("Site manager");
  await card.locator("label.form-field").filter({ hasText: "Formal comments / remarks" }).locator("textarea").fill("Received; torque wrench calibration certificate attached to the site file.");
  const confirm = card.getByRole("button", { name: "Confirm human response" });
  await expect(confirm).toBeDisabled(); // a technical instruction is acknowledged with a signature

  // The recipient's company starts as the party the document is addressed to, not CODECO.
  await expect(card.locator("label.form-field").filter({ hasText: "Company" }).locator("input")).toHaveValue("Hoofdaannemer E2E");
  await card.getByRole("button", { name: "Sign now" }).click();
  await page.locator(".signature-modal input").first().fill("Supervisor Alpha");
  await drawSignature(page);
  await expect(card.getByText("The recipient cannot be the issuer of the document.")).toBeVisible();
  await expect(confirm).toBeDisabled();

  // A different person signs on this device.
  await card.getByRole("button", { name: "Sign again" }).click();
  await page.locator(".signature-modal input").first().fill("Cees Contractor");
  await drawSignature(page);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(card).toContainText("Acknowledged", { timeout: 20_000 });

  // Both signatures are on the record after a reload.
  await page.reload();
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator('[data-workspace-destination="technical-instructions"]').click();
  const reloaded = page.locator(".controlled-document-card").filter({ hasText: title }).first();
  await expect(reloaded).toBeVisible({ timeout: 30_000 });
  await reloaded.getByRole("button", { name: /Open record/ }).click();
  const signatures = reloaded.locator(".controlled-history-signatures");
  await expect(signatures).toContainText("Acknowledged");
  await expect(signatures).toContainText("Issuer: Supervisor Alpha");
  await expect(signatures).toContainText("Recipient: Cees Contractor");
  await expect(signatures).toContainText("signed on the device of Supervisor Alpha");

  // The formal files are generated from the same record.
  await mkdir(testInfo.outputPath("documents"), { recursive: true });
  const [pdf] = await Promise.all([page.waitForEvent("download"), reloaded.getByRole("button", { name: /PDF/ }).click()]);
  await pdf.saveAs(testInfo.outputPath("documents", "technical-instruction.pdf"));
  const [docx] = await Promise.all([page.waitForEvent("download"), reloaded.getByRole("button", { name: /Word/ }).click()]);
  await docx.saveAs(testInfo.outputPath("documents", "technical-instruction.docx"));
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(docx.suggestedFilename()).toMatch(/\.docx$/);
});

test("change order: title and description once, one issuer signature, contractor acknowledgement kept", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The document workflow is the same on every viewport.");
  test.setTimeout(180_000);
  const title = `Two-party CO ${Date.now().toString(36)} · extra anchor row`;
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.getByRole("button", { name: /^Change order/ }).click();
  const form = page.locator(".controlled-document-form");
  await expect(form).toBeVisible();

  // The title and the description are asked once, at the top; section 1 does not ask them again.
  await expect(form.getByText("Title / subject", { exact: true })).toHaveCount(0);
  await expect(form.getByText("Description of change", { exact: true })).toHaveCount(0);
  // One issuer signature: the supervision approval; there is no second author signature.
  await expect(form.getByText("Sign as the author of this document")).toHaveCount(0);

  await form.locator(".controlled-document-primary input").fill(title);
  await form.locator(".controlled-document-primary textarea").fill("Add a second row of cast-in anchors along gridline C.");
  await form.locator("label.form-field").filter({ hasText: "Change order type" }).locator("select").selectOption("addition");
  await form.locator("label.form-field").filter({ hasText: "Reason for change" }).locator("select").selectOption("design_development");
  await form.getByText("Work scope", { exact: true }).click();
  await form.locator("label.form-field").filter({ hasText: "Details / what will change?" }).locator("textarea").fill("Eight additional anchors, 16 mm, at 400 mm centres.");
  await form.locator("label.form-field").filter({ hasText: "To:" }).locator("select").selectOption({ label: "Hoofdaannemer E2E · Contractor" });

  // Issuer: the account's own name. Contractor: a different person, signing on this device.
  await form.locator(".signature-field").filter({ hasText: "Signature · supervision (issuer)" }).getByRole("button", { name: "Sign now" }).click();
  await expect(page.locator(".signature-modal input").first()).toHaveAttribute("readonly", "");
  await drawSignature(page);
  await form.locator("label.form-field").filter({ hasText: "Contractor representative" }).locator("input").fill("Cees Contractor");
  await form.locator("label.form-field").filter({ hasText: "Position" }).locator("input").first().fill("Site manager");
  await form.locator(".signature-field").filter({ hasText: "Signature · contractor representative" }).getByRole("button", { name: "Sign now" }).click();
  await drawSignature(page);
  await form.getByRole("button", { name: "Create controlled document" }).click();

  const card = page.locator(".controlled-document-card").filter({ hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: /Open record/ }).click();
  await expect(card.locator(".controlled-history-signatures")).toContainText("Issuer: Supervisor Alpha");

  await mkdir(testInfo.outputPath("documents"), { recursive: true });
  const [pdf] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: /PDF/ }).click()]);
  await pdf.saveAs(testInfo.outputPath("documents", "change-order.pdf"));
});
