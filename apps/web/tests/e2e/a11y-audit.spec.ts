import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, type Page, test } from "@playwright/test";

/**
 * QA sweep M11, M22, M23, M25: text contrast (WCAG AA), controls without a name and landmarks
 * are measured with axe-core on the screens a supervisor works in. The same rules ran in the
 * manual sweep (62 contrast nodes on 16 screens, 6 unnamed selects); here they gate the build.
 *
 * The contrast rule compares the text colour with the nearest opaque background, which is the
 * measurement the sweep used; a violation names the node and both colours.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const rules = [
  "color-contrast",
  "select-name",
  "label",
  "button-name",
  "link-name",
  "landmark-complementary-is-top-level",
  "landmark-unique",
  "aria-valid-attr-value",
  "aria-allowed-attr",
  "heading-order",
];

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
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function goTo(page: Page, module: string) {
  const sidebar = page.locator(".sidebar").getByRole("button", { name: module, exact: true });
  if (await sidebar.isVisible().catch(() => false)) return sidebar.click();
  const bottom = page.locator(".mobile-bottom-nav").getByRole("button", { name: module, exact: true });
  if (await bottom.count()) return bottom.click();
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" }).click();
  await page.locator(".mobile-module-sheet").getByRole("button", { name: new RegExp(module) }).first().click();
}

async function audit(page: Page, screen: string) {
  await page.waitForTimeout(500);
  const require = createRequire(import.meta.url);
  const source = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  await page.evaluate(source);
  const results = await page.evaluate(async (ruleIds) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axe = (window as any).axe;
    return axe.run(document, { runOnly: { type: "rule", values: ruleIds }, resultTypes: ["violations"] });
  }, rules);
  const violations = results.violations.flatMap((violation: { id: string; nodes: Array<{ target: string[]; any: Array<{ message: string }> }> }) =>
    violation.nodes.map((node) => `${violation.id} · ${node.target.join(" ")} · ${node.any[0]?.message ?? ""}`));
  expect(violations, `${screen}: ${violations.length} accessibility violation(s)`).toEqual([]);
}

const screens: Array<{ name: string; open: (page: Page) => Promise<void> }> = [
  // The project opens on the Overview; the phone bar has no separate entry for it.
  { name: "Overview", open: async () => undefined },
  { name: "Workspace", open: (page) => goTo(page, "Workspace") },
  { name: "Actions", open: (page) => goTo(page, "Actions") },
  { name: "Rapid Verify", open: (page) => goTo(page, "Rapid Verify") },
  { name: "Reports", open: (page) => goTo(page, "Reports") },
  {
    name: "Issues",
    open: async (page) => {
      await goTo(page, "Workspace");
      const back = page.locator(".workspace-back-button");
      if (await back.isVisible().catch(() => false)) await back.click();
      await page.locator("[data-workspace-destination='issues']").click();
    },
  },
  {
    name: "NCR",
    open: async (page) => {
      await goTo(page, "Workspace");
      const back = page.locator(".workspace-back-button");
      if (await back.isVisible().catch(() => false)) await back.click();
      await page.locator("[data-workspace-destination='ncr']").click();
    },
  },
  {
    name: "Project Docs",
    open: async (page) => {
      await goTo(page, "Workspace");
      const back = page.locator(".workspace-back-button");
      if (await back.isVisible().catch(() => false)) await back.click();
      await page.locator(".workspace-support-strip").getByRole("button", { name: "Project Docs", exact: true }).click();
    },
  },
];

for (const screen of screens) {
  test(`axe: ${screen.name} has no contrast, naming or landmark violations`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "tablet-field", "Desktop and phone cover the two layouts.");
    test.setTimeout(120_000);
    await signIn(page);
    await screen.open(page);
    await audit(page, screen.name);
  });
}
