import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";

const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for UI audit screenshots.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

const modules = [
  { name: "Overview", file: "overview" },
  { name: "Workspace", file: "workspace" },
  { name: "Actions", file: "actions" },
  { name: "Rapid Verify", file: "rapid-verify" },
  { name: "Reports", file: "reports" },
  { name: "Management", file: "management" },
] as const;

// These destinations are reached from Workspace rather than the main navigation. They
// include the record, media, field-tool and share surfaces changed in the UI pass.
const workspaceTiles = [
  "Photos", "Works ongoing", "Works completed", "Workforce", "Project Delay Report", "Issues", "HSE", "Materials delivery",
  "Inspections", "Technical instructions", "Change order", "NCR", "Lessons Learned", "HSE incident", "Agreements Made",
  "Rapid Verify", "Project Docs", "Assets & folders", "Drawings & pins", "Deadlines",
] as const;

const screenshotDirectory = join(process.cwd(), "test-results", "ui-audit", "after");

async function capture(page: Page, name: string) {
  await mkdir(screenshotDirectory, { recursive: true });
  // Module navigation may start a smooth scroll after the destination renders. Reset
  // every scroll container, then check again after that navigation has settled.
  const resetScroll = () => page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    for (const element of document.querySelectorAll<HTMLElement>("*")) {
      if (element.scrollTop || element.scrollLeft) {
        element.style.scrollBehavior = "auto";
        element.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  await resetScroll();
  await page.waitForTimeout(200);
  await resetScroll();
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 3_000 }).toBe(0);
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  await sharp(png)
    .resize({ width: 1000, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toFile(join(screenshotDirectory, `${name}.jpg`));
}

test("capture signed-in UI audit screens at desktop and phone widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "This test sets both audit viewports itself.");
  test.setTimeout(600_000);

  await page.setViewportSize(viewports[0]);
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const accessForm = page.locator(".access-form");
  await expect(accessForm).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await capture(page, `sign-in-${viewport.name}`);
  }

  await page.setViewportSize(viewports[0]);
  await accessForm.locator("input[type='email']").fill(email!);
  await accessForm.locator("input[type='password']").fill(password!);
  await accessForm.locator("button[type='submit']").click();
  await expect(page.locator(".project-selection-grid")).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await capture(page, `projects-${viewport.name}`);
  }

  await page.setViewportSize(viewports[0]);
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();

  const addresses: Array<{ file: string; search: string }> = [];
  for (const item of modules) {
    const button = page.locator(".sidebar").getByRole("button", { name: item.name, exact: true });
    await button.click();
    await expect(button).toHaveClass(/active/);
    await page.waitForTimeout(350);
    addresses.push({ file: item.file, search: new URL(page.url()).search });
    await capture(page, `${item.file}-desktop`);
  }

  await page.setViewportSize(viewports[1]);
  for (const address of addresses) {
    await page.goto(`/supervisie${address.search}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !document.querySelector(".access-form") && (document.querySelector("main")?.textContent?.length ?? 0) > 200,
      null,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(350);
    await capture(page, `${address.file}-phone`);
  }

  const workspaceAddress = addresses.find(({ file }) => file === "workspace")?.search;
  expect(workspaceAddress).toBeTruthy();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const tile of workspaceTiles) {
      await page.goto(`/supervisie${workspaceAddress}`, { waitUntil: "domcontentloaded" });
      const entry = page.locator("main").getByRole("button", {
        name: new RegExp(`^(\\d+\\s*)?${tile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      }).first();
      await expect(entry, `${tile} should be present on Workspace`).toBeVisible();
      await entry.click();
      await page.waitForTimeout(900);
      await capture(page, `workspace-${tile.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${viewport.name}`);
    }
  }
});
