import { openSavedRecords } from "./section-nav";
import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { fillSpecFields } from "./spec-fill";

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
  // The Technical Instructions sheet, row by row: the record is read back by its description.
  const sheet = form.locator("[data-sheet-form='technical_instruction']");
  await sheet.locator("[data-sheet-slot='description'] textarea").fill(`${title}. Torque every cast-in anchor to the value on the approved drawing before the base plate is grouted.`);
  await sheet.locator("[data-spec-field='issued_to'] select").selectOption({ label: "Hoofdaannemer E2E" });

  // The issuer's name on the signature is the account's own name; it cannot be typed over.
  // (The contractor's own signature box stands beside it since 19-11-2026.)
  await form.locator(".signature-field").filter({ hasText: "Sign as the author of this document" }).getByRole("button", { name: "Sign now" }).click();
  await expect(page.locator(".signature-modal input").first()).toHaveAttribute("readonly", "");
  await drawSignature(page);
  await fillSpecFields(page.locator(".record-form-shell").first());
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
  await openSavedRecords(page);
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
  // Send and export are one tap behind "Send or export" (OPUS-F07).
  await reloaded.getByRole("button", { name: "Send or export" }).click();
  const [pdf] = await Promise.all([page.waitForEvent("download"), reloaded.getByRole("button", { name: /PDF/ }).click()]);
  await pdf.saveAs(testInfo.outputPath("documents", "technical-instruction.pdf"));
  await reloaded.getByRole("button", { name: "Send or export" }).click();
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

  // The Change Order sheet, row by row (client, 20-11-2026): the change title and description
  // once, in rows 6 and 7, and the reason for change in row 8.
  const sheet = form.locator("[data-sheet-form='change_order']");
  await expect(sheet.locator("[data-sheet-slot='title'] input")).toHaveCount(1);
  await expect(sheet.locator("[data-sheet-slot='description'] textarea")).toHaveCount(1);
  await expect(sheet.locator("[data-spec-field='change_reason']")).toBeVisible();
  await sheet.locator("[data-sheet-slot='title'] input").fill(title);
  await sheet.locator("[data-sheet-slot='description'] textarea").fill("Add a second row of cast-in anchors along gridline C.");

  // Issuer: the account's own name. Contractor: a different person, signing on this device.
  await form.locator(".signature-field").filter({ hasText: "Sign as the author of this document" }).getByRole("button", { name: "Sign now" }).click();
  await expect(page.locator(".signature-modal input").first()).toHaveAttribute("readonly", "");
  await drawSignature(page);
  await form.locator("label.form-field").filter({ hasText: "Contractor representative" }).locator("input").fill("Cees Contractor");
  await form.locator(".signature-field").filter({ hasText: "Signature · contractor" }).getByRole("button", { name: "Sign now" }).click();
  await drawSignature(page);
  await fillSpecFields(page.locator(".record-form-shell").first());
  await form.getByRole("button", { name: "Create controlled document" }).click();

  const card = page.locator(".controlled-document-card").filter({ hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: /Open record/ }).click();
  await expect(card.locator(".controlled-history-signatures")).toContainText("Issuer: Supervisor Alpha");

  await mkdir(testInfo.outputPath("documents"), { recursive: true });
  await card.getByRole("button", { name: "Send or export" }).click();
  const [pdf] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: /PDF/ }).click()]);
  await pdf.saveAs(testInfo.outputPath("documents", "change-order.pdf"));
});
