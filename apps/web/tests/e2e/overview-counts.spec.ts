import { expect, type Page, test } from "@playwright/test";

/**
 * The overview, the workspace and the action centre must agree about what the project holds.
 * Found on the live site: the overview read "Inspections 0" and "No open actions · Under
 * control" while the workspace listed seven inspections and the action centre seven overdue
 * issues, because the overview counted today's timeline and the actions table only.
 *
 * The check is an equality between screens, so it holds for any data the fixture stack has.
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

async function overviewMetric(page: Page, label: string) {
  const card = page.locator(".overview-metric", { hasText: label }).first();
  // The card shows a dash until the project's own count has arrived.
  await expect(card.locator("strong")).toHaveText(/^\d+$/, { timeout: 20_000 });
  return Number(await card.locator("strong").innerText());
}

test("overview inspections, photos and open follow-up equal what the other screens list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "Counts do not depend on the viewport.");
  await signIn(page);

  const overview = {
    inspections: await overviewMetric(page, "Inspections"),
    photos: await overviewMetric(page, "Pictures"),
    followUp: await overviewMetric(page, "Open follow-up"),
  };

  // Workspace tiles.
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  const tileCount = async (name: string) => {
    const tile = page.locator("button", { has: page.getByText(name, { exact: true }) }).first();
    const badge = tile.locator("span, em, strong").filter({ hasText: /^\d+$/ }).first();
    return (await badge.count()) ? Number(await badge.innerText()) : 0;
  };
  await expect(page.getByText("Inspections", { exact: true }).first()).toBeVisible();
  expect(await tileCount("Inspections"), "inspections: overview vs workspace tile").toBe(overview.inspections);
  expect(await tileCount("Photos"), "photos: overview vs workspace tile").toBe(overview.photos);

  // Action centre, whole project.
  await page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("tab", { name: /All project work/ }).click();
  const stillOpen = page.locator(".action-center-summary button", { hasText: "Still open" }).locator("strong");
  await expect(stillOpen).toBeVisible();
  expect(Number(await stillOpen.innerText()), "open work: overview vs action centre").toBe(overview.followUp);
});
