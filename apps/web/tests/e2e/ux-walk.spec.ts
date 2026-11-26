import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { fillSpecFields } from "./spec-fill";

/**
 * A review aid, not a regression test: opens the screens a supervisor works in at a desktop, a tablet and a phone width,
 * writes a screenshot of each to tmp/ux-walk/<width>/ and records what it could not open. Run it on purpose:
 *   UX_WALK=1 npx playwright test ux-walk --project=desktop-office
 * It writes nothing to the database except one signed-out form (nothing is submitted).
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const supabaseUrl = process.env.CODECO_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";

test.skip(!process.env.UX_WALK, "A review aid: set UX_WALK=1 to run it.");
test.skip(!email || !password, "A fixture account is required.");
test.skip(!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Local Supabase only.");

const sizes = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "phone", width: 390, height: 844 },
];

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    for (const key of ["codeco-field-guide-seen-v3", "codeco-portal-guide-seen-v1-contractor", "codeco-portal-guide-seen-v1-client"]) localStorage.setItem(key, "yes");
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
  return new URL(page.url()).searchParams.get("project")!;
}

for (const size of sizes) {
  test(`ux walk at ${size.name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-office", "Sets the widths itself.");
    test.setTimeout(900_000);
    const dir = `D:/CodeCoNV/tmp/ux-walk/${size.name}`;
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: size.width, height: size.height });
    page.setDefaultTimeout(15_000);
    const project = await signIn(page);
    const report: string[] = [];

    const shoot = async (name: string, options: { full?: boolean; settle?: number } = {}) => {
      await page.waitForTimeout(options.settle ?? 900);
      await page.screenshot({ path: `${dir}/${name}.png`, fullPage: options.full ?? false });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      report.push(`${name}: ${overflow > 1 ? `SIDEWAYS SCROLL ${overflow}px` : "no sideways scroll"}`);
    };
    const step = async (name: string, body: () => Promise<void>) => {
      try { await body(); } catch (error) { report.push(`${name}: COULD NOT OPEN (${String((error as Error).message).split("\n")[0].slice(0, 120)})`); }
    };
    const nav = async (id: string, extra = "") => {
      await page.goto(`/supervisie?project=${project}&nav=${id}${extra}`);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const back = page.locator(".workspace-back-button");
      if (await back.isVisible().catch(() => false)) await back.click();
    };
    const form = async (destination: string) => {
      await nav("project");
      await page.locator(`[data-workspace-destination="${destination}"]`).click();
      await expect(page.locator(".record-form-shell, [data-sheet-form], .workforce-form").first()).toBeVisible({ timeout: 20_000 });
    };

    await step("overview", async () => { await nav("vandaag"); await shoot("01-overview"); });
    await step("workspace", async () => { await nav("project"); await shoot("02-workspace-launcher", { full: true }); });
    const forms: Array<[string, string]> = [
      ["issues", "03-form-issue"], ["ncr", "04-form-ncr"], ["hse", "05-form-hse"], ["materials-delivery", "06-form-delivery"],
      ["works-ongoing", "07-form-works-ongoing"], ["works-completed", "08-form-works-completed"], ["workforce", "09-form-workforce"],
      ["technical-instructions", "10-form-technical-instruction"], ["delay-report", "11-form-delay-report"],
    ];
    for (const [destination, name] of forms) await step(name, async () => { await form(destination); await shoot(name, { full: true }); });

    // The signing popup of a sheet form: filled, then Save, and the picture is taken before signing.
    await step("sign popup", async () => {
      await form("works-ongoing");
      await fillSpecFields(page.locator(".record-form-shell, [data-sheet-form]").first());
      await page.locator("main").getByRole("button", { name: /Save register item|Save/ }).last().click();
      await page.locator(".signature-modal").waitFor({ state: "visible", timeout: 15_000 });
      await shoot("12-sign-popup");
      await page.keyboard.press("Escape");
    });
    // The drawing picker inside a form: a dialog over the form.
    await step("drawing picker", async () => {
      await form("works-ongoing");
      const pick = page.locator(".sheet-drawing-location button").first();
      await pick.click();
      await page.getByRole("dialog").first().waitFor({ state: "visible", timeout: 10_000 });
      await shoot("13-drawing-picker-dialog");
      await page.keyboard.press("Escape");
    });
    await step("actions", async () => { await nav("acties"); await shoot("14-actions"); });
    await step("rapid verify", async () => { await nav("verify"); await shoot("15-rapid-verify", { full: true }); });
    await step("rapid verify compliance", async () => {
      await nav("verify");
      await page.locator(".section-nav__trigger").first().click();
      await page.getByRole("tab", { name: /Spec compliance check/i }).first().click();
      await shoot("16-rapid-verify-compliance", { full: true });
    });
    await step("project documents", async () => { await nav("projectdocs"); await shoot("17-project-documents", { full: true }); });
    await step("records", async () => { await nav("records"); await shoot("18-records-and-photos", { full: true }); });
    await step("reports", async () => { await nav("rapporten"); await shoot("19-reports", { full: true }); });
    await step("contractor portal", async () => { await nav("contractorportal"); await shoot("20-contractor-portal-view-as", { full: true }); });
    await step("client portal", async () => { await nav("clientportal"); await shoot("21-client-portal-view-as", { full: true }); });
    await step("management", async () => { await nav("meer"); await shoot("22-management", { full: true }); });

    testInfo.annotations.push({ type: "ux-walk", description: report.join("\n") });
    console.log(`UX-WALK ${size.name}\n${report.join("\n")}`);
  });
}
