import { expect, type Page, test } from "@playwright/test";

/**
 * Third round of the client's developer specification (21-11-2026): people and records are
 * chosen from the project's registers, an incident's corrective actions are rows with owner and
 * due date, the risk rating follows the likelihood and severity, and the project's own lists and
 * workflow settings are kept in Management.
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
  await page.locator(".access-form, .project-selection-grid").first().waitFor({ state: "visible" });
  const form = page.locator(".access-form");
  if (await form.isVisible().catch(() => false)) {
    await form.locator("input[type='email']").fill(email!);
    await form.locator("input[type='password']").fill(password!);
    await form.locator("button[type='submit']").click();
  }
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

async function openTile(page: Page, id: string) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator(`[data-workspace-destination='${id}']`).click();
}

test("an incident's people, reviewer and corrective actions come from the registers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await openTile(page, "hse-incident");
  const spec = page.locator("[data-spec-form='hse_incident']").last();
  await expect(spec).toBeVisible();
  // The reviewer is a person of this project, chosen from the register; "Other" stays possible.
  const reviewer = spec.locator("[data-spec-field='hse_reviewer'] select");
  await expect(reviewer.locator("optgroup")).not.toHaveCount(0);
  await expect(reviewer.locator("option[value='other']")).toHaveCount(1);
  // Each corrective action is a row with its owner and due date.
  // They stand in section 10 of the client's own form, where the corrective action was asked.
  const rows = page.locator("[data-spec-rows='corrective_actions']");
  await expect(rows).toHaveCount(1);
  await expect(rows.locator("[data-spec-field='corrective_actions.0.action'] input")).toBeVisible();
  await expect(rows.locator("[data-spec-field='corrective_actions.0.owner'] select")).toBeVisible();
  await expect(rows.locator("[data-spec-field='corrective_actions.0.due'] input[type='date']")).toBeVisible();
  await rows.getByRole("button", { name: "Add a row" }).click();
  await expect(rows.locator("[data-spec-field='corrective_actions.1.action'] input")).toBeVisible();
  // The status is shown, never typed.
  await expect(spec.locator("[data-spec-readonly='workflow_status']")).toContainText("Open");
  await page.screenshot({ path: testInfo.outputPath("hse-incident-spec.png"), fullPage: true });
});

test("the risk rating appears once likelihood and severity are chosen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await openTile(page, "hse");
  const spec = page.locator("[data-spec-form='hse']").last();
  await expect(spec.locator("[data-spec-field='risk_rating']")).toHaveCount(0);
  // Short lists are pictured tiles (client, 20-11-2026): each a radio with its own picture.
  await spec.locator("[data-spec-field='risk_likelihood']").getByRole("radio", { name: "Likely", exact: true }).check();
  await spec.locator("[data-spec-field='risk_severity']").getByRole("radio", { name: "Major", exact: true }).check();
  await expect(spec.locator("[data-spec-field='risk_rating'] .choice-tile")).toHaveText(["Low", "Medium", "High", "Critical"]);
  await expect(spec.locator("[data-spec-field='risk_likelihood'] .choice-tile svg")).toHaveCount(5);
});

test("Management keeps the project's lists and workflow settings", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Management", exact: true }).click();
  await page.getByRole("tab", { name: "Workflows & lists" }).click();
  const panel = page.getByRole("region", { name: "Specification settings" });
  await expect(panel).toBeVisible();
  const value = `Weekend ${Date.now().toString(36)}`;
  await panel.getByLabel("New value").fill(value);
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel.getByText(value)).toBeVisible();
  await panel.getByLabel("Workflow profile").selectOption("CHANGE-APPROVAL");
  await panel.getByLabel("Approval limit (amount)").fill("25000");
  await page.screenshot({ path: testInfo.outputPath("management-spec-settings.png"), fullPage: true });
  await panel.getByRole("button", { name: "Save specification settings" }).click();
  await expect(page.getByText("Specification settings saved.")).toBeVisible();
});
