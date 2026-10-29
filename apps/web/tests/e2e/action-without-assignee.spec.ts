import { expect, test } from "@playwright/test";

/**
 * QA M4. "New action" could not be saved without choosing a company employee, and a project
 * without one had no way forward. The employee is optional now: the action is created, stays
 * with the manager who made it and can be assigned later from the Action center.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

test("a manager creates an action without choosing an employee", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The form is the same on every width.");
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
  await page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("button", { name: "New action" }).click();

  const dialog = page.getByRole("dialog", { name: "Create central action" });
  await expect(dialog).toBeVisible();
  const title = `Unassigned action ${Date.now().toString(36)}`;
  await dialog.getByRole("button", { name: "Complete unfinished work" }).click();
  await dialog.locator("summary", { hasText: "Different action" }).click();
  await dialog.getByPlaceholder("What must demonstrably be completed?").fill(title);
  await dialog.getByRole("combobox", { name: /Assigned company employee/ }).selectOption("");
  await dialog.getByRole("button", { name: "Save and assign" }).click();
  await expect(page.getByText("Action created.")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("tab", { name: /All project work/ }).click();
  await expect(page.locator(".unified-action-list").getByText(title)).toBeVisible();
  await expect(page.locator(".unified-action-list").getByText(/Yours/).first()).toBeVisible();
});
