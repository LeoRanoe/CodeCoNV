import { expect, type Page, test } from "@playwright/test";
import { fillSpecFields } from "./spec-fill";

/**
 * QA M20. A Project Delay Report is a formal document and its photo on the original finish date is
 * required. It used to be saved first and its photos sent afterwards, so a failed upload left a
 * formal report without its evidence. Now it is saved only with a connection, and when the photo is
 * not confirmed the report is withdrawn again and the form keeps what was typed.
 *
 * Needs the fake Blob store (tests/e2e/fake-blob/run-stack.mjs) for the saved case; the failed
 * case breaks the upload itself.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const photo = process.env.CODECO_E2E_PHOTO_1;
const supabaseUrl = process.env.CODECO_E2E_SUPABASE_URL;
const publishableKey = process.env.CODECO_E2E_PUBLISHABLE_KEY;

test.skip(!email || !password || !photo || !supabaseUrl || !publishableKey, "Needs the fixture account, a photo and the fake Blob store.");
test.setTimeout(180_000);

async function openDelayReport(page: Page) {
  await page.setViewportSize({ width: 1280, height: 1100 });
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
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='delay-report']").click();
  await expect(page.getByRole("heading", { name: "Project Delay Report (PDR)" })).toBeVisible();
}

/** The PDR sheet's photo field (PR #21): one button that opens the camera or the library. */
async function addPhoto(page: Page) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Take or choose a photo/ }).first().click();
  await (await chooser).setFiles(photo!);
}

async function fillDelayReport(page: Page, description: string) {
  // The PDR sheet (PR #22): the fixture project has no work record yet, so the activity is
  // typed; the cause carries the same words so the saved record can be found by them. The
  // sheet's lists, dates and choices are filled by fillSpecFields.
  await page.getByRole("textbox", { name: /Affected activity \(not in the list\)/ }).fill(description);
  await page.getByRole("textbox", { name: /^Detailed cause/ }).fill(description);
  await page.getByRole("spinbutton", { name: /Delay duration/ }).fill("5");
  await page.getByRole("textbox", { name: /^Mitigation \/ recovery action/ }).fill("Two extra crews from Monday until the work is back on schedule.");
}

/** The delay reports of this title that are still alive, read as the supervisor does. */
async function liveReports(page: Page, title: string) {
  const login = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publishableKey! },
    data: { email, password },
  });
  const { access_token: accessToken } = await login.json() as { access_token: string };
  const response = await page.request.get(
    `${supabaseUrl}/rest/v1/project_register_entries?select=id,title,status&register_type=eq.delay_report&status=neq.cancelled&title=ilike.*${encodeURIComponent(title)}*`,
    { headers: { apikey: publishableKey!, authorization: `Bearer ${accessToken}` } },
  );
  expect(response.ok()).toBe(true);
  return await response.json() as Array<{ id: string }>;
}

test("a delay report is saved with its required photo confirmed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "One width is enough; the rule is the same everywhere.");
  await openDelayReport(page);
  const description = `Rain stopped the pour ${Date.now().toString(36)}`;
  await fillDelayReport(page, description);
  await addPhoto(page);
  await fillSpecFields(page.locator(".record-form-shell").first());
  await page.getByRole("button", { name: "Save delay report" }).click();
  await expect(page.locator(".operation-alert.success")).toBeVisible({ timeout: 90_000 });
  expect((await liveReports(page, description)).length, "the report is saved").toBe(1);
  expect(await page.locator(".offline-queue").count(), "the photo is confirmed, nothing waits on the device").toBe(0);
});

test("a delay report whose required photo is not confirmed is not left behind", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "One width is enough; the rule is the same everywhere.");
  // The photo cannot reach the store: every write to it is refused.
  await page.route(/\/\?pathname=.*vercel-blob-signature/, (route) => route.fulfill({ status: 500, body: "refused" }));
  await openDelayReport(page);
  const description = `Rain stopped the pour ${Date.now().toString(36)}`;
  await fillDelayReport(page, description);
  await addPhoto(page);
  await fillSpecFields(page.locator(".record-form-shell").first());
  await page.getByRole("button", { name: "Save delay report" }).click();
  await expect(page.getByText(/Not saved: the required photos were not confirmed/)).toBeVisible({ timeout: 90_000 });
  expect((await liveReports(page, description)).length, "no formal report without its photo").toBe(0);
  // What was typed is still there for the next try.
  await expect(page.getByRole("textbox", { name: /^Detailed cause/ })).toHaveValue(description);
  expect(await page.locator(".offline-queue").count(), "the failed photo is not waiting in a queue for a report that does not exist").toBe(0);
});
