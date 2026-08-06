import { expect, type Page, test } from "@playwright/test";

const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

test.skip(!email || !password, "CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required.");

async function openAuthenticatedWorkspace(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => localStorage.setItem("codeco-field-guide-seen-v3", "yes"));
  await page.locator(".access-form, .project-selection-grid").first().waitFor({ state: "visible" });

  const accessForm = page.locator(".access-form");
  if (await accessForm.isVisible().catch(() => false)) {
    await accessForm.locator("input[type='email']").fill(email!);
    await accessForm.locator("input[type='password']").fill(password!);
    await page.getByRole("button", { name: "Sign in securely" }).click();
  }

  const project = page.getByRole("button", { name: new RegExp(projectName) });
  await expect(project).toBeVisible();
  await project.click();

  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  await page.waitForTimeout(500);
  const guideClose = page.getByRole("button", { name: "Close guide" });
  if (await guideClose.isVisible().catch(() => false)) await guideClose.click();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

async function expectMinimumTarget(page: Page, selector: string, minimum = 44) {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} must be visible`).not.toBeNull();
  expect(box!.width, `${selector} width`).toBeGreaterThanOrEqual(minimum);
  expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(minimum);
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith("mobile ")) test.skip(testInfo.project.name !== "mobile-field");
  if (testInfo.title.startsWith("desktop ")) test.skip(testInfo.project.name !== "desktop-office");
  await openAuthenticatedWorkspace(page);
});

test("responsive workspace keeps a multi-column tile grid without horizontal overflow", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop-office") await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  else await page.locator(".mobile-bottom-nav").getByRole("button", { name: "Workspace", exact: true }).click();
  const grid = page.locator(".client-workspace-grid");
  await expect(grid).toBeVisible();
  const columns = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length);
  if (testInfo.project.name === "mobile-field") expect(columns).toBe(2);
  else if (testInfo.project.name === "tablet-field") expect(columns).toBeGreaterThanOrEqual(2);
  else expect(columns).toBeGreaterThanOrEqual(4);
  await expectMinimumTarget(page, ".client-workspace-grid [data-workspace-destination]");
  await expectNoHorizontalOverflow(page);
  if (testInfo.project.name === "mobile-field") {
    await page.setViewportSize({ width: 320, height: 844 });
    await expect(grid).toHaveCSS("grid-template-columns", /\S+px \S+px/);
    await expectNoHorizontalOverflow(page);
  }
});

test("mobile navigation exposes reports, management and uncluttered report steps", async ({ page }) => {
  const bottomNav = page.locator(".mobile-bottom-nav");
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByRole("button")).toHaveCount(5);
  await expect(bottomNav).toContainText("Overview");
  await expect(bottomNav).toContainText("Workspace");
  await expect(bottomNav).toContainText("Photo");
  await expect(bottomNav).toContainText("Actions");
  await expect(bottomNav).toContainText("More");

  await expectMinimumTarget(page, ".management-button");
  await expectMinimumTarget(page, ".top-actions button[aria-label^='Notifications']");
  await expectMinimumTarget(page, ".field-guide-trigger");
  await expectNoHorizontalOverflow(page);

  const managementBox = await page.locator(".management-button").boundingBox();
  const helpBox = await page.locator(".field-guide-trigger").boundingBox();
  const bottomBox = await bottomNav.boundingBox();
  expect(managementBox && helpBox && bottomBox).toBeTruthy();
  expect(helpBox!.y + helpBox!.height).toBeLessThanOrEqual(bottomBox!.y);

  await bottomNav.getByRole("button", { name: "More", exact: true }).click();
  const moduleMenu = page.getByRole("dialog", { name: "All project modules" });
  await expect(moduleMenu).toBeVisible();
  await moduleMenu.getByRole("button", { name: /Reports/ }).click();
  await expect(page.getByRole("heading", { name: "Client reports" })).toBeVisible();
  await expect(page.locator(".report-section-tabs [role='tab']")).toHaveCount(3);
  await expect(page.locator(".period-report-card")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("tab", { name: /Review & sign/ }).click();
  await expect(page.locator(".report-next-step")).toContainText(/Current next step|Next:/);
  await expect(page.locator(".workflow-grid")).toBeVisible();
  await expect(page.locator(".period-report-card")).toBeHidden();

  await page.getByRole("tab", { name: /Versions & history/ }).click();
  await expect(page.locator(".report-history-grid")).toBeVisible();
  await expect(page.locator(".workflow-grid")).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test("mobile workspace keeps daily work within two taps and action uses the correct form", async ({ page }) => {
  const bottomNav = page.locator(".mobile-bottom-nav");
  await bottomNav.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
  await expect(page.locator(".workspace-launcher-grid [data-workspace-destination]")).toHaveCount(15);
  await expect(page.locator('[data-workspace-destination="works-ongoing"]')).toBeVisible();
  await expect(page.locator('[data-workspace-destination="works-completed"]')).toBeVisible();
  await expect(page.locator('[data-workspace-destination="agreements-made"]')).toBeVisible();
  await expect(page.locator('[data-workspace-destination="rfi"]')).toHaveCount(0);
  await page.locator('[data-workspace-destination="issues"]').click();
  await expect(page.getByRole("tab", { name: /Issues/ })).toHaveAttribute("aria-selected", "true");
  await page.locator(".workspace-back-button").click();

  await bottomNav.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("button", { name: /^(Add|New) action$/ }).click();
  await expect(page.getByRole("dialog", { name: /Create central action|Centrale actie maken/ })).toBeVisible();
  await expect(page.getByRole("dialog").getByText(/Take photo|Maak foto/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("desktop workspace exposes every client module through a working destination", async ({ page }) => {
  const sidebar = page.locator(".sidebar");
  const openWorkspace = async () => {
    await sidebar.getByRole("button", { name: "Workspace", exact: true }).click();
    await expect(page.locator(".workspace-launcher-grid")).toBeVisible();
  };
  const openTile = async (id: string) => {
    const tile = page.locator(`[data-workspace-destination="${id}"]`);
    await expect(tile).toBeVisible();
    await expect(tile).toBeEnabled();
    await tile.click();
  };
  const returnFromWorkspaceModule = async () => {
    const back = page.locator(".workspace-back-button");
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.locator(".workspace-launcher-grid")).toBeVisible();
  };

  await openWorkspace();
  await expect(page.locator(".workspace-launcher-grid [data-workspace-destination]")).toHaveCount(15);

  const taskDestinations = [
    ["inspections", "Inspections"],
    ["hse", "HSE"],
  ] as const;
  for (const [id, heading] of taskDestinations) {
    await openTile(id);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await returnFromWorkspaceModule();
  }

  for (const id of ["issues", "ncr"] as const) {
    await openTile(id);
    await expect(page.getByRole("tab", { name: id === "ncr" ? /NCR/ : /Issues/ })).toHaveAttribute("aria-selected", "true");
    await returnFromWorkspaceModule();
  }

  const registerDestinations = ["materials-delivery", "technical-instructions", "change-order", "agreements-made"] as const;
  for (const id of registerDestinations) {
    await openTile(id);
    await expect(page.getByRole("heading", { name: "Formal documents & registers", exact: true })).toBeVisible();
    await returnFromWorkspaceModule();
  }

  await openTile("deadlines");
  await expect(page.getByRole("heading", { name: "Action center", exact: true })).toBeVisible();
  await openWorkspace();

  await page.getByRole("button", { name: /Rapid Verify/ }).click();
  await expect(page.getByRole("heading", { name: "Rapid Verify", exact: true })).toBeVisible();
  await openWorkspace();

  await page.getByRole("button", { name: "Reports", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Client reports", exact: true })).toBeVisible();
  await openWorkspace();

  await page.getByRole("button", { name: /Submissions & management/ }).click();
  await expect(page.getByRole("heading", { name: "Management overview", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("desktop reports show one calm task area at a time and secondary actions are visible", async ({ page }) => {
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
  await page.locator(".sidebar").getByRole("button", { name: "Reports", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Client reports" })).toBeVisible();
  await expect(page.locator(".period-report-card")).toBeVisible();
  await expect(page.locator(".workflow-grid")).toHaveCount(0);

  await page.getByRole("tab", { name: /Review & sign/ }).click();
  await expect(page.locator(".period-report-card")).toHaveCount(0);
  await expect(page.locator(".workflow-grid")).toBeVisible();
  await expect(page.locator(".workflow-card.current, .workflow-card.locked, .workflow-card.complete")).toHaveCount(3);

  const secondary = page.locator(".workflow-grid .secondary-button").first();
  const style = await secondary.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, border: computed.borderTopColor };
  });
  expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.border).not.toBe("rgba(0, 0, 0, 0)");

  await page.getByRole("tab", { name: /Versions & history/ }).click();
  await expect(page.locator(".report-history-grid")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
