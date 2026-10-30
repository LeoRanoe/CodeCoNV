import { expect, test } from "@playwright/test";

/**
 * QA L24 (the slow first load). A direct link to a project's workspace, opened by someone who is
 * already signed in, shows its records within a budget, makes no request that is refused, and
 * leaves nothing in the console that is the app's own doing. The budget is generous (a laptop, the
 * local stack); a request chain that grows or a page that waits on a refused call fails it.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

test("a direct workspace link opens quickly, without a refused request or a console error", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "One width is enough; the loading does not depend on it.");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
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
  const link = page.url();
  expect(link).toContain("project=");

  const refused: string[] = [];
  const consoleErrors: string[] = [];
  let requests = 0;
  page.on("response", (response) => {
    requests += 1;
    // The daily backup check answers 503 on a stack without a backup store; that is its own, known
    // answer and the page does not wait on it.
    if (response.status() >= 400 && !/\/api\/backups\/ensure-daily/.test(response.url())) refused.push(`${response.status()} ${response.url().replace(/\?.*$/, "")}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !/status of 503/.test(message.text())) consoleErrors.push(message.text());
    // The warning the QA sweep saw six times on production: a font or sheet preloaded and not used.
    if (message.type() === "warning" && /preloaded using link preload but not used/.test(message.text())) consoleErrors.push(message.text());
  });

  const started = Date.now();
  await page.goto(link);
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Loading project (records|registers)/)).toHaveCount(0, { timeout: 30_000 });
  const elapsed = Date.now() - started;

  expect(refused, `refused requests: ${refused.join(", ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(elapsed, `time to the project overview: ${elapsed} ms over ${requests} requests`).toBeLessThan(8_000);
});
