import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

/**
 * Client spec (handwritten update, punch list): the contractor reports a repair done, the
 * supervision either accepts it or sends it back, and an issue can go round 2 to 3 times. The
 * database always allowed ready_for_verification -> reopened; the screen only offered "Verify".
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const supabaseUrl = process.env.CODECO_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.CODECO_E2E_PUBLISHABLE_KEY;

test.skip(!email || !password || !publishableKey, "A fixture account and the local Supabase keys are required.");
test.skip(!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Seeds data: local Supabase only.");

async function repairReadyIssue(title: string) {
  const client = createClient(supabaseUrl, publishableKey!, { auth: { persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email: email!, password: password! });
  expect(signedIn.error).toBeNull();
  const project = (await client.from("projects").select("id").eq("name", projectName).single()).data;
  const building = (await client.from("buildings").select("id").eq("project_id", project!.id).limit(1).single()).data;
  const today = new Date().toISOString().slice(0, 10);
  const report = await client.rpc("create_day_report", { p_project_id: project!.id, p_report_date: today, p_idempotency_key: `report:${project!.id}:${today}` });
  expect(report.error).toBeNull();
  const created = await client.rpc("create_project_finding", {
    p_project_id: project!.id, p_building_id: building!.id, p_day_report_id: report.data?.id ?? report.data, p_inspection_id: null,
    p_inspection_response_id: null, p_finding_type: "deficiency", p_title: title, p_description: "Return-for-correction fixture.",
    p_severity: "medium", p_responsible_party_id: null, p_assigned_user_id: null,
    p_idempotency_key: `finding:${title}`, p_issue_management: { issue_type: "quality", disposition: "to_be_corrected" },
  });
  expect(created.error).toBeNull();
  const id = created.data.id as string;
  for (const [status, finalMeasure] of [["in_progress", null], ["ready_for_verification", "Repaired as drawn."]] as const) {
    const step = await client.rpc("transition_project_finding", {
      p_finding_id: id, p_next_status: status, p_note: "Fixture step.", p_cause: null, p_correction: null, p_final_measure: finalMeasure,
    });
    expect(step.error).toBeNull();
  }
}

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

test("supervision sends a finished repair back with a reason, and the issue is open again", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  const title = `Return round ${Date.now()}`;
  await repairReadyIssue(title);

  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='issues']").click();

  const card = page.locator("article", { hasText: title });
  await expect(card).toContainText("Ready for verification");
  await card.getByRole("button", { name: "Return for correction" }).click();

  const send = card.getByRole("button", { name: "Send back for correction" });
  await expect(send).toBeDisabled();
  await card.getByLabel("What still has to be corrected").fill("Crack is still visible on the left side.");
  await send.click();

  await expect(card).toContainText("Reopened");
  await expect(card.getByRole("button", { name: "Return for correction" })).toHaveCount(0);
});
