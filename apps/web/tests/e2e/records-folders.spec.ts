import { expect, type Page, test } from "@playwright/test";

/**
 * Records & Photos opens on folders: one for every Workspace item, with the same name. A folder lists the
 * submitted records of that item; Photos opens the photo library.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
test.skip(!email || !password, "A fixture account is required.");

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await form.locator("input[type='email']").fill(email!);
  await form.locator("input[type='password']").fill(password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  return new URL(page.url()).searchParams.get("project")!;
}

test("Records & Photos folders carry the Workspace names and open their records", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "One viewport is enough for the folder names.");
  test.setTimeout(180_000);
  const project = await signIn(page);

  await page.locator(".sidebar .nav-button", { hasText: "Workspace" }).first().click();
  await expect(page.locator("[data-workspace-destination]").first()).toBeVisible({ timeout: 30_000 });
  const tiles = (await page.locator("[data-workspace-destination] strong").allTextContents()).map((name) => name.trim());
  expect(tiles.length).toBeGreaterThanOrEqual(10);

  // The folders of Records & Photos.
  await page.goto(`/supervisie?project=${project}&nav=records`);
  await expect(page.getByRole("heading", { name: "Records & Photos" })).toBeVisible();
  const folders = page.locator("[data-records-folder]").filter({ hasNot: page.locator("xpath=self::*[@data-records-folder='all' or @data-records-folder='back']") });
  await expect(folders.first()).toBeVisible();
  const names = (await page.locator(".records-folders [data-records-folder] strong").allTextContents()).map((name) => name.trim());
  for (const tile of tiles) expect(names, `folder "${tile}"`).toContain(tile);
  expect(names[0]).toBe("Photos");

  // A folder lists its records, and the way back returns to the folders.
  await page.locator('[data-records-folder="issues"]').click();
  await expect(page.getByRole("heading", { name: "Issues", exact: true })).toBeVisible();
  await expect(page.locator("[data-archive-source]")).toBeVisible();
  await page.locator('[data-records-folder="back"]').click();
  await expect(page.locator('[data-records-folder="issues"]')).toBeVisible();

  // Photos opens the photo library.
  await page.locator('[data-records-folder="photos"]').click();
  await expect(page.getByRole("heading", { name: "Project photos" })).toBeVisible();
});
