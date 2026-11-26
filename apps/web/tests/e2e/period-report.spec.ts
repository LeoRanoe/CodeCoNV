import { mkdir, readFile, stat } from "node:fs/promises";
import { openSection } from "./section-nav";
import { expect, type Page, test } from "@playwright/test";
import { choosePhotoPurpose } from "./photo-purpose";

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
  await openSection(page, /^Create report$/);
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

test("Word 11.1 options: photos, signatures, sign-off log and records still open from before the period", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The document is the same on every viewport.");
  test.setTimeout(150_000);
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Reports", exact: true }).click();
  await openSection(page, /^Create report$/);
  const card = page.locator(".period-report-card");
  const options = card.locator("[data-report-options]");
  await expect(options.getByLabel("Photos")).toHaveValue("thumbnails");
  await expect(options.getByLabel("Signatures")).toBeChecked();
  await expect(options.getByLabel("Sign-off log")).not.toBeChecked();
  await options.getByLabel("Photos").selectOption("large");
  await options.getByLabel("Sign-off log").check();

  // A period long before any record: only what is still open from before can appear, and it is marked.
  const dates = card.locator("input[type='date']");
  await dates.first().fill("2020-01-01");
  await dates.nth(1).fill("2020-01-31");
  const download = async () => {
    const [file] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: /PDF/ }).click()]);
    const path = testInfo.outputPath("documents", `options-${Date.now()}.pdf`);
    await mkdir(testInfo.outputPath("documents"), { recursive: true });
    await file.saveAs(path);
    return pdfText(path);
  };
  const empty = await download();
  expect(empty).not.toContain("Eerder geopend");

  await options.getByLabel("Include records still open from before the period").check();
  const withOpen = await download();
  expect(withOpen).toContain("Eerder geopend");
  expect(withOpen).toContain("Open sinds vóór deze periode");
});

test("a stored photo is printed in the report as a thumbnail or large, and not at all when the option is none", async ({ page }, testInfo) => {
  const photo = process.env.CODECO_E2E_PHOTO_1;
  test.skip(testInfo.project.name !== "desktop-office" || !photo || process.env.CODECO_E2E_FAKE_BLOB !== "1", "Needs the fake Blob stack and a fixture photo.");
  test.setTimeout(240_000);
  await signIn(page);
  const project = new URL(page.url()).searchParams.get("project");
  await page.goto(`/supervisie?project=${project}&nav=project&tab=files`);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Upload photos/ }).click();
  await (await chooser).setFiles(photo!);
  const review = page.locator(".media-capture-review");
  await choosePhotoPurpose(review, "Progress Documentation");
  await review.locator(".ui-button--primary").first().click();
  await expect(page.locator(".offline-queue")).toHaveCount(0, { timeout: 90_000 });

  await page.locator(".sidebar").getByRole("button", { name: "Reports", exact: true }).click();
  await openSection(page, /^Create report$/);
  const card = page.locator(".period-report-card");
  await card.locator("input[type='date']").first().fill("2026-01-01");
  await mkdir(testInfo.outputPath("documents"), { recursive: true });
  const sizeWith = async (mode: string) => {
    await card.locator("[data-report-options]").getByLabel("Photos").selectOption(mode);
    const [file] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: /PDF/ }).click()]);
    const path = testInfo.outputPath("documents", `photos-${mode}.pdf`);
    await file.saveAs(path);
    return { bytes: (await stat(path)).size, text: await pdfText(path) };
  };
  const none = await sizeWith("none");
  const small = await sizeWith("thumbnails");
  const large = await sizeWith("large");
  expect(small.bytes, "a thumbnail adds image bytes").toBeGreaterThan(none.bytes + 2_000);
  expect(large.bytes, "a large photo is bigger than a thumbnail").toBeGreaterThan(small.bytes);
  expect(none.text).toContain("Foto");
});

test("Word 11.1 structure: group by contractor, summary versus full and contractor responses, in PDF, Word and Excel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The document is the same on every viewport.");
  test.setTimeout(240_000);
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Reports", exact: true }).click();
  await openSection(page, /^Create report$/);
  const card = page.locator(".period-report-card");
  const options = card.locator("[data-report-options]");
  await card.locator("input[type='date']").first().fill("2026-09-01");
  await options.getByLabel("Photos").selectOption("none");
  await mkdir(testInfo.outputPath("documents"), { recursive: true });
  const download = async (button: RegExp, extension: string) => {
    const [file] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: button }).click()]);
    const path = testInfo.outputPath("documents", `structure-${Date.now()}.${extension}`);
    await file.saveAs(path);
    return path;
  };

  // Full and ungrouped: the day-by-day pages are there, no overview and no responses.
  const plain = await pdfText(await download(/PDF/, "pdf"));
  expect(plain).toContain("Dagverloop, werkzaamheden en voortgang");
  expect(plain).not.toContain("Overzicht per");
  expect(plain).not.toContain("Reacties van aannemers");

  // Grouped by contractor, with the responses.
  await options.locator("[data-report-group-by]").selectOption("contractor");
  await options.getByLabel("Contractor responses").check();
  const grouped = await pdfText(await download(/PDF/, "pdf"));
  expect(grouped).toContain("Overzicht per aannemer");
  expect(grouped).toContain("Reacties van aannemers");
  expect(grouped).toContain("Dagverloop, werkzaamheden en voortgang");

  // The Excel workbook of the same choice has the grouped sheet and the responses sheet.
  const JSZip = (await import("jszip")).default;
  const workbook = await JSZip.loadAsync(await readFile(await download(/Excel/, "xlsx")));
  const sheets = [...(await workbook.file("xl/workbook.xml")!.async("string")).matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);
  expect(sheets).toEqual(expect.arrayContaining(["Summary", "Grouped", "Contractor responses"]));
  expect(sheets).toContain("Day reports");

  // A summary leaves the record pages out and counts per group.
  await options.locator("[data-report-detail]").selectOption("summary");
  const summary = await pdfText(await download(/PDF/, "pdf"));
  expect(summary).toContain("Samenvatting per aannemer");
  expect(summary).not.toContain("Dagverloop, werkzaamheden en voortgang");
  expect(summary).not.toContain("Reacties van aannemers");
  const summaryBook = await JSZip.loadAsync(await readFile(await download(/Excel/, "xlsx")));
  const summarySheets = [...(await summaryBook.file("xl/workbook.xml")!.async("string")).matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);
  expect(summarySheets).toEqual(["Summary", "Grouped", "Open actions"]);

  // The Word file is built from the same structure.
  const docx = await JSZip.loadAsync(await readFile(await download(/Word/, "docx")));
  const body = await docx.file("word/document.xml")!.async("string");
  expect(body).toContain("Samenvatting per aannemer");
  expect(body).not.toContain("Dagverloop, werkzaamheden en voortgang");
});
