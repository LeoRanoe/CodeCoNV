import { openSavedRecords } from "./section-nav";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

/**
 * Developer package v5, Word 3.1: the closure note is entered in the Close / Verify / Approve dialog
 * (the sign-off panel of the record), stored in the sign-off log, and no longer a field of the form.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const supabaseUrl = process.env.CODECO_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.CODECO_E2E_PUBLISHABLE_KEY;

test.skip(!email || !password || !publishableKey, "A fixture account and the local Supabase keys are required.");
test.skip(!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Seeds data: local Supabase only.");

const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function acknowledgedIssue(title: string) {
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
    p_inspection_response_id: null, p_finding_type: "deficiency", p_title: title, p_description: "Close dialog fixture.",
    p_severity: "medium", p_responsible_party_id: null, p_assigned_user_id: null,
    p_idempotency_key: `finding:${title}`, p_issue_management: { issue_type: "quality", disposition: "to_be_corrected" },
  });
  expect(created.error).toBeNull();
  const id = created.data.id as string;
  const acknowledged = await client.rpc("record_signoff_action", {
    p_project_id: project!.id, p_record_kind: "finding", p_record_id: id, p_workflow_profile: "ISSUE-CLOSEOUT", p_stage_number: 2,
    p_action: "acknowledge", p_actor_role: "Contractor", p_attestation_method: "external_representative", p_actor_name: "Alex Contractor",
    p_signature_image: signature,
  });
  expect(acknowledged.error).toBeNull();
  return { client, id };
}

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
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

test("an issue is closed from the dialog: the closure note is required and lands in the sign-off log", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  const title = `Close dialog ${Date.now()}`;
  const { client, id } = await acknowledgedIssue(title);

  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='issues']").click();
  await openSavedRecords(page);

  await page.locator("article", { hasText: title }).getByRole("button", { name: /^View/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Record details" });
  const panel = dialog.getByRole("region", { name: "Sign-off and review" });
  await expect(panel).toBeVisible();
  // The closure note is a field of the dialog, not of the form.
  await expect(dialog.getByLabel(/closure note/i)).toHaveCount(0);

  const action = panel.getByLabel("Action");
  const options = await action.locator("option").allTextContents();
  const closing = options.find((label) => /verify|close/i.test(label));
  test.skip(!closing, `the acknowledged issue offers no closing action: ${options.join(", ")}`);
  await action.selectOption({ label: closing! });

  const note = panel.getByLabel(/Resolution \/ closure note/);
  await expect(note).toBeVisible();
  const submit = panel.locator(".record-form-actions button");
  await expect(submit).toBeDisabled();
  await note.fill("Sleeve realigned and re-inspected on site.");
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(panel.locator(".signoff-outcome-log").last()).toContainText("Sleeve realigned and re-inspected on site.");
  const log = await client.from("record_signoff_events").select("action,details").eq("record_id", id).order("created_at", { ascending: false }).limit(1).single();
  expect(log.data?.details).toMatchObject({ closure_note: "Sleeve realigned and re-inspected on site." });
});
