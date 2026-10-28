import { expect, type Page, test } from "@playwright/test";

/**
 * QA sweep H1. A contractor has no right to create a day report, yet every save first asked
 * for one, so an RFI came back 403 and the screen stayed silent. The contractor submits an
 * RFI, sees it in the list, and a refused save says why.
 *
 * Runs against the local fixture stack with the accounts from seed-ui-demo-data.mjs.
 */
const email = process.env.CODECO_E2E_CONTRACTOR_EMAIL;
const password = process.env.CODECO_E2E_CONTRACTOR_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("The contractor account is required for the release gate.");
}
test.skip(!email || !password, "A contractor account is required (tests/e2e/seed-ui-demo-data.mjs).");

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
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function openSubmissionForm(page: Page) {
  const settings = page.locator(".sidebar").getByRole("button", { name: /^(Settings|Management)$/ });
  if (await settings.isVisible().catch(() => false)) await settings.click();
  else {
    await page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" }).click();
    await page.locator(".mobile-module-sheet").getByRole("button", { name: /Settings|Management/ }).first().click();
  }
  await page.getByRole("button", { name: "Record external submission" }).first().click();
  await expect(page.locator(".controlled-document-form")).toBeVisible();
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

test("a contractor submits an RFI and sees it in the register", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The submission flow is the same on every viewport.");
  test.setTimeout(150_000);
  const title = `Contractor RFI ${Date.now().toString(36)}`;
  const dayReportRequests: Array<{ url: string; status: number }> = [];
  page.on("response", (response) => {
    if (/\/rpc\/(create_day_report|ensure_day_report_for_record)/.test(response.url())) {
      dayReportRequests.push({ url: response.url(), status: response.status() });
    }
  });

  await signIn(page);
  await openSubmissionForm(page);
  const form = page.locator(".controlled-document-form");
  await form.locator(".controlled-document-primary input").fill(title);
  await form.locator(".controlled-document-primary textarea").fill("Which anchor type applies in the stair core?");
  await form.getByLabel(/^To:/).selectOption({ index: 1 });
  await form.getByLabel("Submitted by · name on the form").fill("P. Aannemer");
  await form.getByLabel("Position").fill("Site manager");
  await form.locator(".signature-field").getByRole("button", { name: "Sign now" }).click();
  await drawSignature(page);

  const create = page.getByRole("button", { name: "Create controlled document" });
  await expect(create).toBeEnabled();
  await create.click();

  await expect(page.locator(".operation-alert.error")).toHaveCount(0);
  await expect(page.getByText(/RFI.*saved\./)).toBeVisible();
  // One request per tap, answered with 200, never the 403 of the old create_day_report.
  expect(dayReportRequests.length, "one day-report request per save").toBe(1);
  expect(dayReportRequests[0].url).toContain("ensure_day_report_for_record");
  expect(dayReportRequests[0].status).toBe(200);

  // The form closes once the document is saved and its draft is gone.
  await expect(page.locator(".controlled-document-form")).toHaveCount(0);

  await page.reload();
  const projectCard = page.getByRole("button", { name: new RegExp(projectName) }).first();
  if (await projectCard.isVisible().catch(() => false)) await projectCard.click();
  await expect(page.locator(".sidebar, .mobile-bottom-nav").first()).toBeVisible();
  await openSubmissionForm(page);
  await expect(page.locator("main").getByText(title).first()).toBeVisible({ timeout: 20_000 });
});
