import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * A role sees what it can use. The database refuses every write the role may not do; the
 * screens must not offer those writes in the first place (a client with a "New issue" button
 * that always answers 403 is a broken screen, not a protected one).
 *
 * Runs against the local fixture stack with the accounts from seed-ui-demo-data.mjs
 * (CODECO_E2E_DEMO_DATA=0). The assignment wording checks arrange their own record.
 */
const clientEmail = process.env.CODECO_E2E_CLIENT_EMAIL;
const clientPassword = process.env.CODECO_E2E_CLIENT_PASSWORD;
const contractorEmail = process.env.CODECO_E2E_CONTRACTOR_EMAIL;
const contractorPassword = process.env.CODECO_E2E_CONTRACTOR_PASSWORD;
const supervisorEmail = process.env.CODECO_E2E_EMAIL;
const supervisorPassword = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const unassignedFindingTitle = "Role views fixture · owner pending";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(clientEmail && contractorEmail && supervisorEmail)) {
  throw new Error("The client, contractor and supervisor accounts are required for the release gate.");
}
test.skip(!clientEmail || !contractorEmail || !supervisorEmail, "Role accounts are required (tests/e2e/seed-ui-demo-data.mjs).");

async function signInAs(page: Page, email: string, password: string) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(email);
  await form.locator("input[type='password']").fill(password);
  await form.locator("button[type='submit']").click();
  const project = page.getByRole("button", { name: new RegExp(projectName) }).first();
  await project.click();
  // CODECO staff land in the workspace; a contractor portal account in its own portal.
  await expect(page.getByRole("region", { name: "Project command center" }).or(page.locator(".portal-shell")).first()).toBeVisible();
  // The permissions arrive with their own request; wait until the screen has applied them.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(800);
}

async function goTo(page: Page, module: string) {
  const sidebar = page.locator(".sidebar").getByRole("button", { name: module, exact: true });
  if (await sidebar.isVisible().catch(() => false)) return sidebar.click();
  const bottom = page.locator(".mobile-bottom-nav").getByRole("button", { name: module, exact: true });
  if (await bottom.count()) return bottom.click();
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" }).click();
  await page.locator(".mobile-module-sheet").getByRole("button", { name: new RegExp(module) }).first().click();
}

const modules = (page: Page) => page.locator(".sidebar .nav-button, .mobile-module-grid button");

async function ensureUnassignedFinding(page: Page) {
  const url = process.env.CODECO_E2E_SUPABASE_URL;
  const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
  const projectId = new URL(page.url()).searchParams.get("project");
  if (!url || !key || !projectId || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
    throw new Error("The assignment wording checks require a local project and fixture API.");
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email: supervisorEmail!, password: supervisorPassword! });
  if (signInError) throw signInError;
  const building = await client.from("buildings").select("id").eq("project_id", projectId).order("id").limit(1).single();
  if (building.error) throw building.error;
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Paramaribo" });
  const report = await client.rpc("ensure_day_report_for_record", { p_project_id: projectId, p_report_date: date, p_idempotency_key: `role-views-day:${date}` });
  if (report.error) throw report.error;
  const { error } = await client.rpc("create_project_finding", {
    p_project_id: projectId,
    p_building_id: building.data.id,
    p_day_report_id: report.data,
    p_inspection_id: null,
    p_inspection_response_id: null,
    p_finding_type: "deficiency",
    p_title: unassignedFindingTitle,
    p_description: "Open finding with no responsible party or assigned user.",
    p_severity: "medium",
    p_responsible_party_id: null,
    p_assigned_user_id: null,
    p_idempotency_key: "role-views-unassigned-finding",
    p_issue_management: { issue_type: "quality", disposition: "to_be_corrected" },
  });
  if (error) throw error;
}

/** Project Docs and Issues are reached from the workspace, like every other module. */
async function openWorkspaceModule(page: Page, module: "Project Docs" | "Issues") {
  await goTo(page, "Workspace");
  const back = page.locator(".workspace-back-button");
  if (await back.isVisible().catch(() => false)) await back.click();
  if (module === "Issues") await page.locator("[data-workspace-destination='issues']").click();
  else await page.locator(".workspace-support-strip").getByRole("button", { name: "Project Docs", exact: true }).click();
}

test("a client reads and signs; nothing offers to write", async ({ page }, testInfo) => {
  await signInAs(page, clientEmail!, clientPassword!);
  const desktop = testInfo.project.name === "desktop-office";

  // The overview does not offer to start or answer the day, nor to take a photo.
  await expect(page.getByRole("button", { name: "Day log" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check report" })).toHaveCount(0);
  await expect(page.locator(".quick-add-side, .mobile-nav-button.quick")).toHaveCount(0);

  await goTo(page, "Actions");
  await expect(page.getByRole("button", { name: /New action/ })).toHaveCount(0);

  await openWorkspaceModule(page, "Project Docs");
  await expect(page.getByRole("button", { name: /Upload file|New controlled record/ })).toHaveCount(0);
  await expect(page.getByLabel("Create a folder and upload")).toHaveCount(0);

  await openWorkspaceModule(page, "Issues");
  // The module opens on its list: there is no form to fill in and no "New" button.
  await expect(page.getByRole("button", { name: /^New$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Submit issue|Save draft/ })).toHaveCount(0);

  if (desktop) {
    await expect(modules(page).filter({ hasText: "Management" })).toHaveCount(1);
  }
});

test("a contractor works in the contractor portal, never in the supervisor workspace", async ({ page }) => {
  await signInAs(page, contractorEmail!, contractorPassword!);
  await expect(page.locator(".portal-shell")).toBeVisible();
  await expect(page.getByText("Contractor portal").first()).toBeVisible();
  // No supervisor navigation, modules or settings (requirements 6).
  await expect(page.locator(".sidebar, .mobile-bottom-nav")).toHaveCount(0);
  await expect(modules(page)).toHaveCount(0);
  await expect(page.locator("[data-workspace-destination]")).toHaveCount(0);
});

test("a supervisor keeps every control a supervisor needs", async ({ page }) => {
  await signInAs(page, supervisorEmail!, supervisorPassword!);
  await expect(page.getByRole("button", { name: "Day log" })).toBeVisible();
  await goTo(page, "Actions");
  await expect(page.getByRole("button", { name: /New action/ })).toBeVisible();
  await openWorkspaceModule(page, "Project Docs");
  await expect(page.getByRole("button", { name: /New controlled record/ })).toBeVisible();
  await openWorkspaceModule(page, "Issues");
  await expect(page.getByRole("button", { name: /^New$/ })).toBeVisible();
});

/** The project's own address, for a role that types or follows a link into a screen. */
function addressOf(page: Page, nav: string) {
  const project = new URL(page.url()).searchParams.get("project");
  return `/supervisie?project=${project}&nav=${nav}`;
}

test("a contractor who types the Reports address lands back on the overview, with the reason", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The address check does not depend on the viewport.");
  await signInAs(page, contractorEmail!, contractorPassword!);
  await page.goto(addressOf(page, "rapporten"));
  await expect(page.locator(".portal-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Client reports" })).toHaveCount(0);
  await expect(page.locator(".period-report-card")).toHaveCount(0);
});

test("Management offers a contractor and a client only what their role may do", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The address check does not depend on the viewport.");
  const admin = ["Team and access", "Project rules", "Structure and parties", "Continuity controls", "Manage tasks", "Assign follow-up", "Manage employees"];

  await signInAs(page, contractorEmail!, contractorPassword!);
  await page.goto(addressOf(page, "meer"));
  // The address of Management opens the contractor portal: no management screen at all.
  await expect(page.locator(".portal-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Management overview" })).toHaveCount(0);
  for (const name of admin) await expect(page.getByRole("button", { name: new RegExp(name) }), `contractor: ${name}`).toHaveCount(0);
  // The contractor's own way to submit a document stays, inside its portal.
  const responses = page.getByRole("tab", { name: /Responses & submissions/ }).first();
  if (!(await responses.isVisible().catch(() => false))) await page.locator(".portal-main button[aria-haspopup='true']").first().click();
  await page.getByRole("tab", { name: /Responses & submissions/ }).first().click();
  await expect(page.getByRole("button", { name: /New submission/ })).toBeVisible();

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signInAs(page, clientEmail!, clientPassword!);
  await page.goto(addressOf(page, "meer"));
  await expect(page.getByRole("heading", { name: "Management overview" })).toBeVisible();
  for (const name of [...admin, "Record external submission"]) await expect(page.getByRole("button", { name: new RegExp(name) }), `client: ${name}`).toHaveCount(0);
});

test("a link to a project the account cannot open says so", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The address check does not depend on the viewport.");
  await signInAs(page, supervisorEmail!, supervisorPassword!);
  await page.goto("/supervisie?project=00000000-0000-4000-8000-000000000000&nav=project");
  await expect(page.getByText("That project is not available to this account.")).toBeVisible();
});

test("a client is not told to assign a record nobody owns", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The wording does not depend on the viewport.");
  await signInAs(page, clientEmail!, clientPassword!);
  await ensureUnassignedFinding(page);
  await page.reload();
  await expect(page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true })).toBeVisible();
  await goTo(page, "Actions");
  await page.getByRole("tab", { name: /All project work/ }).click();
  await page.locator(".action-center-summary button", { hasText: "All records" }).click();
  const row = page.locator(".unified-action-list > button").filter({ hasText: unassignedFindingTitle });
  // A client cannot assign; the list says what the record waits for instead of giving an order.
  await expect(page.getByText("Assign who has to do this")).toHaveCount(0);
  await expect(row.getByText("Waiting for someone to be assigned")).toBeVisible();
});

test("a supervisor is still told to assign a record nobody owns", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The wording does not depend on the viewport.");
  await signInAs(page, supervisorEmail!, supervisorPassword!);
  await ensureUnassignedFinding(page);
  await page.reload();
  await expect(page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true })).toBeVisible();
  await goTo(page, "Actions");
  await page.getByRole("tab", { name: /All project work/ }).click();
  await page.locator(".action-center-summary button", { hasText: "All records" }).click();
  await expect(page.locator(".unified-action-list > button").filter({ hasText: unassignedFindingTitle }).getByText("Assign who has to do this")).toBeVisible();
});
