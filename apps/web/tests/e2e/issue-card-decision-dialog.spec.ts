import { openSavedRecords } from "./section-nav";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

/**
 * Developer package v5, Word 3.1 and 10: Verify and Return on an Issue card are a dialog. The closure note or the reason
 * is required, is written to the sign-off log with the actor, and the issue moves; Cancel changes nothing.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const supabaseUrl = process.env.CODECO_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.CODECO_E2E_PUBLISHABLE_KEY;

test.skip(!email || !password || !publishableKey, "A fixture account and the local Supabase keys are required.");
test.skip(!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Seeds data: local Supabase only.");

const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function readyIssue(title: string) {
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
    p_inspection_response_id: null, p_finding_type: "deficiency", p_title: title, p_description: "Decision dialog fixture.",
    p_severity: "medium", p_responsible_party_id: null, p_assigned_user_id: null,
    p_idempotency_key: `finding:${title}`, p_issue_management: { issue_type: "quality", disposition: "to_be_corrected" },
  });
  expect(created.error).toBeNull();
  const id = created.data.id as string;
  // The contractor acknowledged through the sign-off workflow, so the issue has a log to extend.
  const acknowledged = await client.rpc("record_signoff_action", {
    p_project_id: project!.id, p_record_kind: "finding", p_record_id: id, p_workflow_profile: "ISSUE-CLOSEOUT", p_stage_number: 2,
    p_action: "acknowledge", p_actor_role: "Contractor", p_attestation_method: "external_representative", p_actor_name: "Alex Contractor",
    p_signature_image: signature,
  });
  expect(acknowledged.error).toBeNull();
  for (const [status, finalMeasure] of [["in_progress", null], ["ready_for_verification", "Repaired as drawn."]] as const) {
    const step = await client.rpc("transition_project_finding", { p_finding_id: id, p_next_status: status, p_note: "Fixture step.", p_cause: null, p_correction: null, p_final_measure: finalMeasure });
    expect(step.error).toBeNull();
  }
  return { client, id };
}

async function log(client: SupabaseClient, id: string) {
  const { data, error } = await client.from("record_signoff_events").select("action,new_status,details,comments,next_actor,actor_name").eq("record_id", id).order("sequence_number");
  expect(error).toBeNull();
  return data ?? [];
}

async function open(page: Page, title: string, status = "Pending verification") {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
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
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='issues']").click();
  await openSavedRecords(page);
  const card = page.locator("article", { hasText: title });
  await expect(card).toContainText(status);
  return card;
}

test("Verify on the Issue card is a dialog: the closure note is required and lands in the sign-off log", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  const title = `Verify dialog ${Date.now()}`;
  const { client, id } = await readyIssue(title);
  const card = await open(page, title);

  await card.getByRole("button", { name: "Verify", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Verify issue" });
  const confirm = dialog.getByRole("button", { name: "Confirm verification" });
  await expect(confirm).toBeDisabled();
  await expect(dialog).toContainText("Still needed");

  // Cancel changes nothing.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await log(client, id)).map((event) => event.action)).toEqual(["acknowledge"]);

  await card.getByRole("button", { name: "Verify", exact: true }).click();
  await dialog.getByLabel(/closure note/i).fill("Checked on site; repaired as drawn.");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toContainText("Closed");

  const events = await log(client, id);
  const verified = events.at(-1)!;
  expect(verified.action).toBe("verify");
  expect(verified.new_status).toBe("Verified");
  expect(verified.details).toMatchObject({ closure_note: "Checked on site; repaired as drawn." });
  expect((await client.from("findings").select("status").eq("id", id).single()).data?.status).toBe("closed");

  // The decision survives a fresh load: the stored record says closed, and so does the card.
  const reloaded = await open(page, title, "Closed");
  await expect(reloaded.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
});

test("Return on the Issue card is a dialog: the reason and the next responsible are required and logged", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  const title = `Return dialog ${Date.now()}`;
  const { client, id } = await readyIssue(title);
  const card = await open(page, title);

  await card.getByRole("button", { name: "Return for correction" }).click();
  const dialog = page.getByRole("dialog", { name: "Return issue for correction" });
  const send = dialog.getByRole("button", { name: "Send back for correction" });
  await dialog.getByLabel(/What still has to be corrected/).fill("Crack is still visible.");
  await expect(send).toBeDisabled();
  await dialog.getByLabel(/Next responsible/).fill("Alex Contractor");
  await send.click();
  await expect(dialog).toHaveCount(0);

  const returned = (await log(client, id)).at(-1)!;
  expect(returned.action).toBe("return");
  expect(returned.new_status).toBe("Returned for Correction");
  expect(returned.comments).toContain("Crack is still visible.");
  expect(returned.next_actor).toBe("Alex Contractor");
  expect(["reopened", "in_progress"]).toContain((await client.from("findings").select("status").eq("id", id).single()).data?.status);
});
