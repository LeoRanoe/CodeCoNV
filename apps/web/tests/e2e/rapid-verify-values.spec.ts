import { expect, type Page, test } from "@playwright/test";

/**
 * Client example (handwritten update): SPECS says 12 mm laminated glass, grey; INGEDIEND says
 * 13 mm. Rapid Verify has to flag the 13 mm, not only report how many words the two share.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

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

test("a submitted 13 mm is flagged against a prescribed 12 mm", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Rapid Verify", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rapid Verify", exact: true })).toBeVisible();

  await page.locator("#main-content input[type='file']").setInputFiles({
    name: "glass-spec.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Glazing specification. Laminated glass, thickness 12 mm, colour grey. Fire rating 30 minutes."),
  });
  await page.getByRole("tab", { name: /Compare specification/ }).click();
  await page.locator("textarea").first().fill("Submitted: laminated glass, thickness 13 mm, colour grey.");
  await page.getByRole("button", { name: "Verify against sources" }).click();

  const checks = page.getByRole("region", { name: "Values compared" });
  await expect(checks).toContainText("13 mm");
  await expect(checks.locator("li[data-status='differs']")).toContainText("12 mm");
  await expect(checks.locator("li[data-status='matches']")).toContainText("grey");
  await expect(page.getByText("Submitted values differ from the specification")).toBeVisible();
  await expect(page.getByText(/Human technical verification remains required/).first()).toBeVisible();
});
