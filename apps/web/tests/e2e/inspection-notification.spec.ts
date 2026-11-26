import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";
import { notificationPath } from "../../lib/notifications/record-link.mjs";
import { createHash } from "node:crypto";

/**
 * Word 14 / WD-192: "Inspection scheduled or updated" reaches the person who must carry it out.
 * Driven through the app with local fixtures only (nothing is sent anywhere: notifications are rows
 * in the local database and the e-mail sender is not configured):
 *  - a supervisor plans an inspection for a colleague; the colleague gets one notification;
 *  - moving it to another time notifies once more; saving without a change sends nothing;
 *  - the person making the change is never notified of it (assigning it to themselves, or the
 *    executor moving their own inspection);
 *  - the colleague opens the exact inspection from the list or a delivery link after sign-in.
 * The database trigger has its own test (supabase/tests/041_inspection_notifications.pgtap.sql).
 */
const planner = { email: process.env.CODECO_E2E_EMAIL, password: process.env.CODECO_E2E_PASSWORD };
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const url = process.env.CODECO_E2E_SUPABASE_URL;
const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
const secret = process.env.CODECO_E2E_SECRET_KEY;
// A second member who may manage inspections: created locally by this spec, provisioned for this project only.
// The password is derived from the local service key (same as project-information-disciplines.spec.ts), never written in the repository.
const executor = { email: "field-supervisor-a@codeco.test", password: `Fx-${createHash("sha256").update(`${secret ?? ""}:field-supervisor-a`).digest("base64url").slice(0, 28)}!1`, name: "Field Supervisor" };

test.skip(!planner.email || !url || !key || !secret, "The fixture account and the local Supabase keys are required.");
test.describe.configure({ mode: "serial" });

async function api(account: { email?: string; password?: string }): Promise<SupabaseClient> {
  const client = createClient(url!, key!, { auth: { persistSession: false } });
  const result = await client.auth.signInWithPassword({ email: account.email!, password: account.password! });
  if (result.error) throw new Error(`sign in failed: ${result.error.message}`);
  return client;
}

let executorId = "";
let plannerId = "";
let projectId = "";
let inspectionId = "";
let inspectionNumber = "";

test.beforeAll(async () => {
  const plannerApi = await api(planner);
  plannerId = (await plannerApi.auth.getUser()).data.user!.id;
  const project = await plannerApi.from("projects").select("id,organization_id").eq("name", projectName).single();
  if (project.error) throw project.error;
  projectId = project.data.id;
  const admin = createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  let id = listed.data.users.find((user) => user.email === executor.email)?.id;
  if (!id) {
    const created = await admin.auth.admin.createUser({ email: executor.email, password: executor.password, email_confirm: true, user_metadata: { display_name: executor.name } });
    if (created.error) throw created.error;
    id = created.data.user.id;
  } else {
    const updated = await admin.auth.admin.updateUserById(id, { password: executor.password });
    if (updated.error) throw updated.error;
  }
  executorId = id;
  const provisioned = await plannerApi.rpc("provision_internal_user", { p_organization_id: project.data.organization_id, p_user_id: id, p_display_name: executor.name, p_role_code: "supervisor", p_project_id: projectId });
  if (provisioned.error && !/already/i.test(provisioned.error.message)) throw provisioned.error;
});

async function signIn(page: Page, account: { email?: string; password?: string }) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(account.email!);
  await form.locator("input[type='password']").fill(account.password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function openInspections(page: Page) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination=inspections]").click();
}

/** Notifications about this inspection, as the recipient sees them. */
async function countFor(recipient: { email?: string; password?: string }) {
  const result = await (await api(recipient)).from("notifications").select("id,recipient_user_id,notification_type,title,source_id").eq("notification_type", "inspection_scheduled").eq("source_id", inspectionId);
  if (result.error) throw result.error;
  return result.data ?? [];
}

test("planning an inspection in the app notifies the executor once, and not the planner", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  test.setTimeout(180_000);
  await signIn(page, planner);
  await openInspections(page);
  const subject = `Inspection notification ${crypto.randomUUID()}`;
  await page.locator(".inspection-subject-details summary").click();
  await page.getByLabel("Subject / element").fill(subject);
  const plan = page.locator("[data-inspection-plan]");
  await expect(plan).toBeVisible();
  await plan.locator("summary").click();
  await plan.getByLabel("Carried out by").selectOption({ label: executor.name });
  await plan.getByLabel("Planned for").fill("2027-03-01T09:00");
  await plan.getByRole("button", { name: "Plan inspection" }).click();
  await expect(page.getByText("Inspection planned. The colleague has been notified.")).toBeVisible();
  const planned = page.locator("[data-planned-inspection]", { hasText: subject });
  await expect(planned).toBeVisible();
  inspectionNumber = (await planned.getAttribute("data-planned-inspection"))!;
  await expect(planned).toContainText(executor.name);
  await page.screenshot({ path: testInfo.outputPath("planned-inspection.png"), fullPage: true });

  const found = await (await api(planner)).from("inspections").select("id,status,planned_at,executed_by").eq("inspection_number", inspectionNumber).single();
  expect(found.data).toMatchObject({ status: "planned", executed_by: executorId });
  inspectionId = found.data!.id as string;

  // One notification, to the executor; none for the person who planned it.
  const forExecutor = await countFor(executor);
  expect(forExecutor).toHaveLength(1);
  expect(forExecutor[0].recipient_user_id).toBe(executorId);
  expect(forExecutor[0].title).toBe(`Inspectie ingepland: ${inspectionNumber}`);
  expect(await countFor(planner)).toHaveLength(0);
});

test("moving it notifies the executor again; an unchanged save and the actor's own changes send nothing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  test.setTimeout(180_000);
  await signIn(page, planner);
  await openInspections(page);
  const planned = page.locator(`[data-planned-inspection='${inspectionNumber}']`);
  // A cold CI runner can take longer than the default 15 s to load the project's inspections after sign-in.
  await expect(planned).toBeVisible({ timeout: 60_000 });
  // The control is disabled while nothing has changed: an unchanged save cannot be made from the screen.
  await expect(planned.getByRole("button", { name: `Reschedule ${inspectionNumber}` })).toBeDisabled();
  await planned.getByLabel(`Planned for ${inspectionNumber}`).fill("2027-03-02T10:30");
  await planned.getByRole("button", { name: `Reschedule ${inspectionNumber}` }).click();
  await expect(page.getByText("Inspection rescheduled. The colleague has been notified.")).toBeVisible();
  expect(await countFor(executor)).toHaveLength(2);
  expect(await countFor(planner)).toHaveLength(0);

  // The same call again (an unchanged save), and a change that is not about who, when or status.
  const plannerApi = await api(planner);
  const current = (await plannerApi.from("inspections").select("planned_at,executed_by,title").eq("id", inspectionId).single()).data!;
  const unchanged = await plannerApi.rpc("reschedule_project_inspection", { p_inspection_id: inspectionId, p_planned_at: current.planned_at, p_executed_by: current.executed_by });
  expect(unchanged.error).toBeNull();
  const retitled = await plannerApi.from("inspections").update({ title: `${current.title} · checked` }).eq("id", inspectionId).select("id");
  expect(retitled.error).toBeNull();
  expect(await countFor(executor)).toHaveLength(2);

  await planned.getByLabel(`Planned for ${inspectionNumber}`).fill("2027-03-01T09:00");
  await planned.getByRole("button", { name: `Reschedule ${inspectionNumber}` }).click();
  await expect.poll(async () => (await countFor(executor)).length).toBe(3);

  // The executor changing their own inspection does not notify themselves.
  const executorApi = await api(executor);
  const own = await executorApi.rpc("reschedule_project_inspection", { p_inspection_id: inspectionId, p_planned_at: "2027-03-03T13:00:00Z", p_executed_by: executorId });
  expect(own.error).toBeNull();
  expect(await countFor(executor)).toHaveLength(3);

  // Giving it to the planner: the planner made the change, so the planner is not notified.
  const reassigned = await plannerApi.rpc("reschedule_project_inspection", { p_inspection_id: inspectionId, p_planned_at: "2027-03-04T13:00:00Z", p_executed_by: plannerId });
  expect(reassigned.error).toBeNull();
  expect(await countFor(planner)).toHaveLength(0);
  // ...and giving it back notifies the executor again, once.
  const back = await plannerApi.rpc("reschedule_project_inspection", { p_inspection_id: inspectionId, p_planned_at: "2027-03-05T13:00:00Z", p_executed_by: executorId });
  expect(back.error).toBeNull();
  expect(await countFor(executor)).toHaveLength(4);
});

test("the executor opens the exact inspection from the notification list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  test.setTimeout(180_000);
  await signIn(page, executor);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const dialog = page.getByRole("dialog");
  const rows = dialog.locator(".notification-row", { hasText: inspectionNumber });
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText(/Inspection (planned|updated): /);
  await page.screenshot({ path: testInfo.outputPath("executor-notifications.png"), fullPage: true });
  await rows.first().click();
  await expect(page.getByRole("dialog", { name: "Record details" })).toContainText(inspectionNumber);
  // Nothing was sent anywhere: the e-mail and push columns stay untouched.
  const sent = await (await api(executor)).from("notifications").select("email_sent_at,push_sent_at").eq("source_id", inspectionId);
  for (const row of sent.data ?? []) { expect(row.email_sent_at).toBeNull(); }
});

test("a delivery link survives sign-in and opens only the recipient's inspection", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  test.setTimeout(180_000);
  const notifications = await countFor(executor);
  const target = notificationPath(projectId, notifications[0].id);
  const freshContext = await browser.newContext();
  const wrongAccount = await freshContext.newPage();
  try {
    for (const [tab, account] of [[page, executor], [wrongAccount, planner]] as const) {
      await tab.goto(target);
      await tab.evaluate(() => {
        localStorage.setItem("codeco-field-guide-seen-v3", "yes");
        localStorage.setItem("codeco-language-choice", "en");
      });
      await tab.reload();
      const form = tab.locator(".access-form");
      await form.locator("input[type='email']").fill(account.email!);
      await form.locator("input[type='password']").fill(account.password!);
      await form.locator("button[type='submit']").click();
    }
    await Promise.all([
      expect(page.getByRole("dialog", { name: "Record details" })).toContainText(inspectionNumber, { timeout: 60_000 }),
      expect(wrongAccount.getByText("This notification is unavailable to this account.")).toBeVisible({ timeout: 60_000 }),
    ]);
    await expect(page).toHaveURL(new RegExp(`[?&]record=${inspectionId}`));
    await expect(wrongAccount.getByRole("dialog", { name: "Record details" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Record details" })).toContainText(inspectionNumber, { timeout: 60_000 });
  } finally {
    await freshContext.close();
  }
});

test("a role that cannot manage inspections cannot plan one", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  const contractorApi = await api({ email: process.env.CODECO_E2E_CONTRACTOR_EMAIL, password: process.env.CODECO_E2E_CONTRACTOR_PASSWORD });
  const before = await countFor(executor);
  const refused = await contractorApi.rpc("reschedule_project_inspection", { p_inspection_id: inspectionId, p_planned_at: "2027-04-01T09:00:00Z", p_executed_by: executorId });
  expect(refused.error?.message ?? "").toMatch(/not found or not editable/i);
  expect(await countFor(executor)).toHaveLength(before.length);
});
