import { mkdir, readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { fillSpecFields } from "./spec-fill";
import { finishSigning } from "./sign-popup";

/**
 * Client, 19-11-2026: "the user must be able to export their own report of everything — all
 * forms filled in under Workspace that day". Reports opens on the day overview; its PDF and
 * Word file carry every form of Workspace, with the records of the day and their boxes.
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

async function pdfText(path: string) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join(" ").replace(/\s+/g, " ");
}

test("the day overview exports every Workspace form of the day as PDF and Word", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The document is the same on every viewport.");
  test.setTimeout(180_000);
  await signIn(page);

  // A record of today, so the export has something of the day in it.
  const title = `Day export ${Date.now().toString(36)}`;
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='materials-delivery']").click();
  const form = page.locator(".record-form-shell").first();
  // The Materials Delivery sheet: the record is read back by its material description.
  await form.locator("[data-spec-field='material_specification'] input").fill(title);
  await form.locator("[data-spec-field='delivered_quantity'] input").fill("12");
  await form.locator("[data-spec-field='unit'] select").selectOption("m³");
  await fillSpecFields(page.locator(".record-form-shell").first());
  // The fixture project has no storage locations configured (an administrator maintains that list), so the delivery is not stored on site.
  const storedOnSite = form.locator("[data-spec-field='stored_on_site'] input");
  if (await storedOnSite.isVisible().catch(() => false)) await storedOnSite.uncheck();
  await page.getByRole("button", { name: "Save register item" }).click();
  await finishSigning(page);
  await expect(page.getByText(/saved/i).first()).toBeVisible();

  await page.locator(".sidebar").getByRole("button", { name: "Reports", exact: true }).click();
  const overview = page.locator(".day-overview");
  await expect(overview).toBeVisible();
  await expect(overview.getByRole("button", { name: new RegExp(title) })).toBeVisible();

  await mkdir(testInfo.outputPath("documents"), { recursive: true });
  const [pdf] = await Promise.all([page.waitForEvent("download"), overview.getByRole("button", { name: /PDF/ }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^Day-report-.+\.pdf$/);
  const pdfPath = testInfo.outputPath("documents", "day-report.pdf");
  await pdf.saveAs(pdfPath);
  const text = await pdfText(pdfPath);
  for (const form of ["Workforce", "Works ongoing", "Works completed", "Delays", "Issues", "NCR", "HSE", "Inspections", "Materials delivery", "Technical instruction (TI)", "Change order (CO)", "Project Delay Report (PDR)", "Lessons Learned (LL)", "Agreements Made", "Photos"]) {
    expect(text, `the export has a section for ${form}`).toContain(form);
  }
  expect(text).toContain(title);
  expect(text).toContain("12 m³");

  const [word] = await Promise.all([page.waitForEvent("download"), overview.getByRole("button", { name: /Word/ }).click()]);
  expect(word.suggestedFilename()).toMatch(/^Day-report-.+\.docx$/);
});
