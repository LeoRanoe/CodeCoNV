import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

/**
 * Developer package v5, Word 10.1: Rapid Verify "Check against specs" with two real PDFs. The bestek and the submittal are
 * registered as project documents, opened side by side, and the assistant proposes rows from the numbers in both texts.
 * Needs the fake Blob stack (document uploads). Screenshots at three widths go to tmp/compliance-viewer for review.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const uploads = Boolean(process.env.CODECO_E2E_FAKE_BLOB);

test.skip(!email || !password, "A fixture account is required.");
test.skip(!uploads, "Needs the fake Blob stack for document uploads.");

/** A one-page PDF with the given lines of text (valid cross-reference table, built from the byte offsets). */
function textPdf(lines: string[]) {
  const stream = `BT /F1 12 Tf 50 780 Td 16 TL ${lines.map((line) => `(${line.replace(/[()\\]/g, "")}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(body.length); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    for (const key of ["codeco-field-guide-seen-v3"]) localStorage.setItem(key, "yes");
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
  return new URL(page.url()).searchParams.get("project")!;
}

test("the bestek and the submittal open side by side and the assistant proposes rows", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "Sets the widths itself.");
  test.setTimeout(420_000);
  const dir = "D:/CodeCoNV/tmp/compliance-viewer";
  mkdirSync(dir, { recursive: true });
  const stamp = Date.now().toString(36);
  await page.setViewportSize({ width: 1280, height: 900 });
  const project = await signIn(page);

  // Register the two documents (Project Documents opens on the register).
  await page.goto(`/supervisie?project=${project}&nav=projectdocs`);
  const register = page.locator(".document-register");
  const registerDocument = async (title: string, kind: string, lines: string[]) => {
    await register.getByRole("button", { name: "Register document" }).click();
    const dialog = page.getByRole("dialog", { name: "Register document" });
    await dialog.getByLabel("Document number").fill(`CV-${stamp}-${title.slice(0, 3).toUpperCase()}`);
    await dialog.getByLabel("Title (required)").fill(title);
    await dialog.getByLabel("Revision (as on the document)").fill("A");
    await dialog.getByLabel("Document type").selectOption(kind);
    await dialog.getByLabel("File").setInputFiles({ name: `${title}.pdf`, mimeType: "application/pdf", buffer: textPdf(lines) });
    await dialog.getByRole("button", { name: "Register", exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 60_000 });
  };
  await expect(register).toBeVisible({ timeout: 30_000 });
  await registerDocument(`Bestek ${stamp}`, "specification", ["Clause 5.2 Concrete", "Concrete strength class minimum 30 MPa", "Reinforcement cover minimum 40 mm", "Slump 80 mm"]);
  await registerDocument(`Datasheet ${stamp}`, "submittal", ["Supplier datasheet", "Concrete strength class 35 MPa", "Reinforcement cover 45 mm", "Slump 70 mm"]);

  await page.goto(`/supervisie?project=${project}&nav=verify`);
  await page.locator(".section-nav__trigger").first().click();
  await page.getByRole("tab", { name: /Spec compliance check/i }).first().click();
  const check = page.locator(".spec-compliance");
  await expect(check).toBeVisible();
  const subject = check.getByLabel(/Submittal \/ datasheet to check/);
  await subject.selectOption(await subject.locator("option", { hasText: `Datasheet ${stamp}` }).first().getAttribute("value") ?? "");
  const requirement = check.getByLabel(/Bestek \/ specification/);
  await requirement.selectOption(await requirement.locator("option", { hasText: `Bestek ${stamp}` }).first().getAttribute("value") ?? "");
  await check.getByLabel(/Section \/ clause/).fill("5.2");

  const viewer = page.locator(".compliance-viewer");
  await expect(viewer).toBeVisible({ timeout: 30_000 });
  // pdf.js draws the first page of each PDF (an <iframe> would stay blank on phones and is blocked by the CSP).
  await expect(viewer.locator("canvas")).toHaveCount(2, { timeout: 30_000 });
  const assistant = check.getByRole("button", { name: /assistant|Propose|Suggest/i }).first();
  await assistant.click();
  await expect(check.locator(".spec-compliance-row").first()).toBeVisible({ timeout: 60_000 });

  for (const size of [{ name: "desktop", width: 1280, height: 900 }, { name: "tablet", width: 820, height: 1180 }, { name: "phone", width: 390, height: 844 }]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(800);
    await viewer.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/${size.name}-viewer.png` });
    await page.screenshot({ path: `${dir}/${size.name}-full.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${size.name} does not scroll sideways`).toBeLessThanOrEqual(1);
  }
  const rows = await check.locator(".spec-compliance-row").count();
  console.log(`COMPLIANCE-VIEWER rows proposed: ${rows}`);
  expect(rows, "the assistant proposes a row per requirement with a figure").toBeGreaterThanOrEqual(2);
});
