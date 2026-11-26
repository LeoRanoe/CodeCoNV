import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";
import { openSection } from "./section-nav";

/**
 * Developer package v5, the screens that were added late, end to end on the local fixture stack:
 *  - Management > Project information: the company register (Word 13) keeps a contact per company
 *    and refuses an invalid e-mail address;
 *  - Reports > Create report: a template is saved, offered again and deleted; a schedule is saved,
 *    paused and deleted (Word 11.1), and the new report types pre-select their forms;
 *  - Actions: the menu item carries the number of open follow-ups, and an unresolved Rapid Verify
 *    compliance check is listed in the follow-up view until a later check complies (Word 9);
 *  - Workspace: "Open log" opens the Form Log of the form that is open (Word 3).
 */
const supervisor = { email: process.env.CODECO_E2E_EMAIL, password: process.env.CODECO_E2E_PASSWORD };
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const url = process.env.CODECO_E2E_SUPABASE_URL;
const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;

test.skip(!supervisor.email || !url || !key, "The fixture account and the local Supabase keys are required.");
test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString(36).slice(-5).toUpperCase();

async function api(): Promise<SupabaseClient> {
  const client = createClient(url!, key!, { auth: { persistSession: false } });
  const result = await client.auth.signInWithPassword({ email: supervisor.email!, password: supervisor.password! });
  if (result.error) throw new Error(`sign in failed: ${result.error.message}`);
  return client;
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
  await form.locator("input[type='email']").fill(supervisor.email!);
  await form.locator("input[type='password']").fill(supervisor.password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

const sidebar = (page: Page, name: string) => page.locator(".sidebar").getByRole("button", { name, exact: true });

test("the company register keeps a contact per company and refuses an invalid e-mail address", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await sidebar(page, "Management").click();
  await openSection(page, /^Project information$/);
  const register = page.locator(".company-register");
  await expect(register).toBeVisible();
  const first = register.locator("li").filter({ has: page.locator("header") }).first();
  const contact = `Contact ${suffix}`;
  await first.getByLabel("Contact name").fill(contact);
  await first.getByLabel("E-mail").fill("not-an-address");
  await first.getByRole("button", { name: "Add contact" }).click();
  await expect(register.getByRole("alert")).toBeVisible();
  await first.getByLabel("E-mail").fill(`contact-${suffix.toLowerCase()}@example.test`);
  await first.getByRole("button", { name: "Add contact" }).click();
  await expect(first.getByText(contact)).toBeVisible();
  await page.reload();
  await sidebar(page, "Management").click();
  await openSection(page, /^Project information$/);
  const again = page.locator(".company-register li li").filter({ hasText: contact });
  await expect(again).toBeVisible();
  await again.getByRole("button", { name: `Remove ${contact}` }).click();
  await expect(page.locator(".company-register").getByText(contact)).toHaveCount(0);
});

test("a report template and a schedule can be saved, used and removed, and the new report types pre-select their forms", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await sidebar(page, "Reports").click();
  await openSection(page, /^Create report$/);

  // The three report types of Word 11.2 that read across several forms.
  for (const type of ["Contractor Performance Summary", "Action Register / Overdue Actions", "Document Register / Outstanding Submittals"]) {
    await expect(page.locator("#main-content").getByText(type).first()).toBeAttached();
  }

  const templates = page.locator(".report-templates");
  const templateName = `Weekly ${suffix}`;
  await templates.getByLabel("Template name").fill(templateName);
  await templates.getByRole("button", { name: "Save as template" }).click();
  await expect(templates.getByRole("button", { name: templateName, exact: true })).toBeVisible();

  const schedules = page.locator(".report-schedules");
  const scheduleName = `Daily ${suffix}`;
  await schedules.getByLabel("Name", { exact: true }).fill(scheduleName);
  await schedules.getByLabel("Template").selectOption({ label: templateName });
  await schedules.locator(".report-recipients input[type='checkbox']").first().check();
  await schedules.getByRole("button", { name: "Schedule report" }).click();
  const row = schedules.locator("li").filter({ hasText: scheduleName });
  await expect(row).toBeVisible();
  await expect(row).toContainText(templateName);
  await row.getByRole("button", { name: "Pause" }).click();
  await expect(row.getByRole("button", { name: "Resume" })).toBeVisible();
  await row.getByRole("button", { name: `Delete schedule ${scheduleName}` }).click();
  await expect(schedules.getByText(scheduleName)).toHaveCount(0);

  await templates.getByRole("button", { name: `Delete template ${templateName}` }).click();
  await expect(templates.getByRole("button", { name: templateName, exact: true })).toHaveCount(0);
});

test("Actions shows its follow-up count and lists an unresolved compliance check until a later check complies", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  const client = await api();
  const project = await client.from("projects").select("id").eq("name", projectName).single();
  if (project.error) throw project.error;
  const subject = `Rebar submittal ${suffix}`;
  const check = (result: string, tag: string) => client.rpc("record_spec_compliance_check", {
    p_project_id: project.data.id, p_subject_kind: "document", p_subject_file_id: null, p_subject_record_id: null, p_subject_label: subject,
    p_requirement_file_id: null, p_requirement_label: "Bestek 05.1", p_clause: "5.1.2", p_material_group: "Rebar",
    p_rows: [{ parameter: "Yield strength", required: "B500B", submitted: result === "complies" ? "B500B" : "B400", result }],
    p_comments: null, p_proposed_by_assistant: false, p_signed_by: "Supervisor Alpha", p_signature_image: "data:image/png;base64,AAAA", p_idempotency_key: `e2e-v5-${suffix}-${tag}`,
  });
  const failed = await check("does_not_comply", "fail");
  if (failed.error) throw failed.error;

  await signIn(page);
  const actions = sidebar(page, "Actions");
  // The badge is a number beside the name; the name stays "Actions" and the count is its description.
  await expect(actions.locator(".nav-badge")).toBeVisible();
  await expect(actions).toHaveAccessibleDescription(/^\d+ open follow-ups?$/);
  await actions.click();
  await page.getByRole("tab", { name: /Follow-up per form/ }).or(page.getByRole("menuitem", { name: /Follow-up per form/ })).first().click();
  const list = page.locator("[data-auto-actions]");
  await expect(list.getByRole("tab", { name: /Spec compliance check/ })).toBeVisible();
  const row = list.locator("tbody tr").filter({ hasText: subject });
  await expect(row).toContainText("Spec compliance check");
  await expect(row).toContainText("Submitting contractor");
  await expect(row).toContainText("Does not comply");
  await row.getByRole("button").first().click();
  await expect(page.getByRole("heading", { name: "Rapid Verify" }).first()).toBeVisible();

  // A later check of the same subject that complies resolves the row, so the list stays what it was.
  const passed = await check("complies", "pass");
  if (passed.error) throw passed.error;
  await page.reload();
  await sidebar(page, "Actions").click();
  await page.getByRole("tab", { name: /Follow-up per form/ }).or(page.getByRole("menuitem", { name: /Follow-up per form/ })).first().click();
  await expect(page.locator("[data-auto-actions]")).toBeVisible();
  await expect(page.locator("[data-auto-actions] tbody tr").filter({ hasText: subject })).toHaveCount(0);
});

test("Open log in the Workspace opens the Form Log of the open form", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await sidebar(page, "Workspace").click();
  await page.getByRole("button", { name: /^\d*\s*Issues$/ }).first().click();
  await page.locator(".workspace-open-log").click();
  await expect(page.getByRole("heading", { name: "Records & Photos" })).toBeVisible();
  await expect(page.locator(".form-log-type.is-selected")).toContainText("Issues");
});
