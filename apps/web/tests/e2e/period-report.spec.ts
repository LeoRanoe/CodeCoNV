import { mkdir, readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

/**
 * QA sweep M12. The period report ("Dagrapport / Week / Maand" → PDF) printed stored values:
 * "Weer: cloudy", "HSE: near_miss", "disposition: to be corrected", "07:00:00 16:00:00". The
 * PDF text is read back and must carry Dutch words only, a project head and a signature block.
 *
 * Runs against the local fixture stack; the richer the demo data (seed-ui-demo-data.mjs with
 * CODECO_E2E_DEMO_DATA=1), the more of the report is exercised.
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

test("the period report PDF is Dutch, has a project head and a signature block", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The document is the same on every viewport.");
  test.setTimeout(120_000);
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Reports", exact: true }).click();
  await expect(page.locator(".period-report-card")).toBeVisible();
  // A window that contains the demo data.
  await page.locator(".period-report-card input[type='date']").first().fill("2026-09-01");

  await mkdir(testInfo.outputPath("documents"), { recursive: true });
  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".period-report-card").getByRole("button", { name: /PDF/ }).click(),
  ]);
  const path = testInfo.outputPath("documents", "period-report.pdf");
  await pdf.saveAs(path);
  const text = await pdfText(path);

  expect(text).toContain("Opdrachtgever");
  expect(text).toContain("Aannemer");
  expect(text).toContain("Supervisor");
  expect(text).toContain("Ondertekening");
  expect(text).toContain("Nog niet ondertekend");
  // A stored value or an English key in the text is a failure: no underscore words, no raw weather
  // or severity codes, no seconds in working hours.
  expect(text).not.toMatch(/[A-Za-z]+_[A-Za-z]+/);
  expect(text).not.toMatch(/\b(cloudy|sunny|heavy_rain|moderate|critical|medium|in progress|to be corrected|building name|due date|progress percent|hse category|responsible person|immediate measure|action required)\b/i);
  expect(text).not.toMatch(/\b\d{2}:\d{2}:\d{2}\b/);
});
