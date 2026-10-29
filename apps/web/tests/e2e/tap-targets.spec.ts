import { expect, type Page, test } from "@playwright/test";

/**
 * QA sweep L13. On a phone the controls of the Issue form that a thumb has to hit — the
 * "Immediate action" tiles, the "Other" box and the dictation button — are at least 44 px high
 * and wide, and the tick boxes carry the name of their tile.
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

test("the Issue form's thumb targets are 44 px and its tick boxes are named", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-field", "Touch targets are a phone rule (up to 1024 px).");
  await signIn(page);
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "Workspace" }).click();
  await page.locator("[data-workspace-destination='issues']").click();
  await expect(page.locator(".record-action-check").first()).toBeVisible();

  const sizes = await page.evaluate(() => {
    const measure = (selector: string) => Array.from(document.querySelectorAll(selector)).map((element) => {
      const box = element.getBoundingClientRect();
      return { selector, width: Math.round(box.width), height: Math.round(box.height) };
    });
    return [
      ...measure(".record-action-check"),
      ...measure(".record-action-other input[type='text']"),
      ...measure(".dictate-button"),
    ];
  });
  expect(sizes.length).toBeGreaterThan(3);
  for (const size of sizes) {
    expect(size.height, `${size.selector} height`).toBeGreaterThanOrEqual(44);
    expect(size.width, `${size.selector} width`).toBeGreaterThanOrEqual(44);
  }

  const names = await page.locator(".record-action-check input[type='checkbox']").evaluateAll((inputs) => inputs.map((input) => input.getAttribute("aria-label") ?? ""));
  expect(names.length).toBeGreaterThan(2);
  for (const name of names) expect(name.length, "every tick box is named").toBeGreaterThan(2);
  expect(names).not.toContain("on");
});
