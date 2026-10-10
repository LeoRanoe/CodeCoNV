import { expect, type Page, test } from "@playwright/test";

/**
 * A server that answers and refuses the session must end it. Found in the live audit: after the
 * account behind a signed-in device disappeared, the app answered GET /auth/v1/user with 403 and
 * kept showing the account's cached projects under "Online · Live workspace · synchronized".
 * The offline copy is for a server that cannot be reached, not for one that said no.
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
  await expect(page.getByRole("button", { name: new RegExp(projectName) }).first()).toBeVisible();
}

test("a refused session returns to sign-in instead of showing the cached workspace", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The behaviour does not depend on the viewport.");
  await signIn(page);

  await page.route("**/auth/v1/user", (route) => route.fulfill({
    status: 403,
    contentType: "application/json",
    body: JSON.stringify({ code: "user_not_found", error_code: "user_not_found", msg: "User from sub claim in JWT does not exist" }),
  }));
  await page.reload();

  await expect(page.locator(".access-form")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Live workspace")).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(projectName) })).toHaveCount(0);
});

test("an unreachable server still opens the workspace from the device", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The behaviour does not depend on the viewport.");
  await signIn(page);
  // Let the workspace be cached by opening the project once.
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  await page.goto("/supervisie");
  await expect(page.getByRole("button", { name: new RegExp(projectName) }).first()).toBeVisible();

  await page.route("**/auth/v1/user", (route) => route.abort("connectionrefused"));
  await page.route("**/rest/v1/**", (route) => route.abort("connectionrefused"));
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(projectName) }).first()).toBeVisible({ timeout: 20_000 });
});
