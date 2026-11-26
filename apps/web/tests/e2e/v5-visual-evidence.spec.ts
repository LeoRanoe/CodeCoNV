import { openSavedRecords } from "./section-nav";
import { openSection } from "./section-nav";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

/**
 * Developer package v5: screenshots of the screens added in the overnight run, taken at a desktop and a phone width, and
 * a check that none of them scrolls sideways. The pictures are attached to the report (test-results) so they can be looked at.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const supabaseUrl = process.env.CODECO_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.CODECO_E2E_PUBLISHABLE_KEY;

test.skip(!email || !password || !publishableKey, "A fixture account and the local Supabase keys are required.");
test.skip(!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Seeds data: local Supabase only.");

const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const widths = [{ name: "desktop", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844 }];

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
    localStorage.setItem("codeco-language-choice", "nl");
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
  await expect(page.getByRole("region", { name: /Project command center|Projectcommandocentrum|Project/ }).first()).toBeVisible();
}

async function readyIssue(title: string) {
  const client = createClient(supabaseUrl, publishableKey!, { auth: { persistSession: false } });
  expect((await client.auth.signInWithPassword({ email: email!, password: password! })).error).toBeNull();
  const project = (await client.from("projects").select("id").eq("name", projectName).single()).data!;
  const building = (await client.from("buildings").select("id").eq("project_id", project.id).limit(1).single()).data!;
  const today = new Date().toISOString().slice(0, 10);
  const report = await client.rpc("create_day_report", { p_project_id: project.id, p_report_date: today, p_idempotency_key: `report:${project.id}:${today}` });
  const created = await client.rpc("create_project_finding", {
    p_project_id: project.id, p_building_id: building.id, p_day_report_id: report.data?.id ?? report.data, p_inspection_id: null,
    p_inspection_response_id: null, p_finding_type: "deficiency", p_title: title, p_description: "Visual evidence fixture.",
    p_severity: "medium", p_responsible_party_id: null, p_assigned_user_id: null,
    p_idempotency_key: `finding:${title}`, p_issue_management: { issue_type: "quality", disposition: "to_be_corrected" },
  });
  expect(created.error).toBeNull();
  const id = created.data.id as string;
  await client.rpc("record_signoff_action", {
    p_project_id: project.id, p_record_kind: "finding", p_record_id: id, p_workflow_profile: "ISSUE-CLOSEOUT", p_stage_number: 2,
    p_action: "acknowledge", p_actor_role: "Contractor", p_attestation_method: "external_representative", p_actor_name: "Alex Contractor", p_signature_image: signature,
  });
  for (const [status, finalMeasure] of [["in_progress", null], ["ready_for_verification", "Hersteld volgens tekening."]] as const) {
    await client.rpc("transition_project_finding", { p_finding_id: id, p_next_status: status, p_note: "Fixture.", p_cause: null, p_correction: null, p_final_measure: finalMeasure });
  }
}

const noSidewaysScroll = async (page: Page, what: string) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${what} does not scroll sideways`).toBeLessThanOrEqual(1);
};

for (const size of widths) {
  test(`v5 screens at ${size.name}: Issue dialog, report options, Actions filter, numbered sheet`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-office", "This test sets the widths itself.");
    test.setTimeout(240_000);
    const title = `Visual ${size.name} ${Date.now()}`;
    await readyIssue(title);
    await page.setViewportSize({ width: size.width, height: size.height });
    await signIn(page);
    const open = async (sidebarName: string, mobileName: string) => {
      const sidebar = page.locator(".sidebar").getByRole("button", { name: new RegExp(`^${sidebarName}$`) });
      if (await sidebar.isVisible().catch(() => false)) return sidebar.click();
      await page.locator(".mobile-bottom-nav").getByRole("button", { name: new RegExp(mobileName) }).first().click();
    };

    // 1. The Issue card dialog.
    await open("Werkruimte", "^Werkruimte");
    await page.locator("[data-workspace-destination='issues']").click();
    await openSavedRecords(page);
    const card = page.locator("article", { hasText: title });
    await card.getByRole("button", { name: /Verifiëren|Verify/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(700);
    await page.screenshot({ path: testInfo.outputPath(`issue-dialog-${size.name}.png`) });
    const box = await dialog.boundingBox();
    expect(box!.width, "the dialog fits the window").toBeLessThanOrEqual(size.width);
    await dialog.getByRole("button", { name: /Annuleren|Cancel/ }).click();

    // 2. A numbered sheet (Works Ongoing).
    await open("Werkruimte", "^Werkruimte");
    await page.locator("[data-workspace-destination='works-ongoing']").click();
    await expect(page.locator("[data-sheet-form='works_ongoing']")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`works-ongoing-${size.name}.png`), fullPage: true });
    await noSidewaysScroll(page, "Works Ongoing");

    // 3. Actions with the contractor filter.
    await open("Acties", "^Acties");
    await page.waitForTimeout(800);
    await page.screenshot({ path: testInfo.outputPath(`actions-${size.name}.png`) });
    await noSidewaysScroll(page, "Actions");

    // 4. The report builder options.
    await open("Rapporten", "^Rapporten|^Meer");
    if (size.name === "phone") {
      const reports = page.getByRole("button", { name: /^Rapporten/ });
      if (await reports.first().isVisible().catch(() => false)) await reports.first().click();
    }
    await openSection(page, /Rapport maken|Create report/);
    const options = page.locator("[data-report-options]");
    await options.scrollIntoViewIfNeeded();
    await expect(options).toBeVisible();
    await options.screenshot({ path: testInfo.outputPath(`report-options-${size.name}.png`) });
    await noSidewaysScroll(page, "Report options");
  });
}
