import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

/**
 * Requirements FINAL (with Client Portal) and the client's menu mind map, end to end on the
 * local fixture stack: the main menu, the overview, the document register with real uploads,
 * a contractor answering in its portal with a photo, Rapid Verify closing the loop, a client
 * approving in its portal, Records & Photos, the register reports, the action views and the
 * document settings.
 */
const supervisor = { email: process.env.CODECO_E2E_EMAIL, password: process.env.CODECO_E2E_PASSWORD };
const contractor = { email: process.env.CODECO_E2E_CONTRACTOR_EMAIL, password: process.env.CODECO_E2E_CONTRACTOR_PASSWORD };
const clientPortal = { email: process.env.CODECO_E2E_CLIENT_PORTAL_EMAIL, password: process.env.CODECO_E2E_CLIENT_PORTAL_PASSWORD };
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const photo = process.env.CODECO_E2E_PHOTO_1;
const uploads = process.env.CODECO_E2E_FAKE_BLOB === "1";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(supervisor.email && contractor.email && clientPortal.email)) {
  throw new Error("The supervisor, contractor and client portal accounts are required for the release gate.");
}
test.skip(!supervisor.email || !contractor.email || !clientPortal.email, "Role accounts are required (tests/e2e/seed-ui-demo-data.mjs).");
test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString(36).slice(-5).toUpperCase();
const documentNumber = `A-${suffix}`;
const actionTitle = `Clear debris ${suffix}`;

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
  await expect(page.getByRole("region", { name: "Project command center" }).or(page.locator(".portal-shell")).first()).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

/** A section bar shows its tabs, or one button that opens them on a narrow screen. */
async function openSection(page: Page, scope: string, name: RegExp) {
  // Wait for the section bar itself: on a slow first load the screen is still rendering.
  await page.locator(scope).locator("[role='tablist'], button[aria-haspopup='true']").first().waitFor({ timeout: 60_000 });
  const tab = page.locator(scope).getByRole("tab", { name }).first();
  if (!(await tab.isVisible().catch(() => false))) await page.locator(`${scope} button[aria-haspopup='true']`).first().click();
  await page.locator(scope).getByRole("tab", { name }).first().click();
}

async function nav(page: Page, name: string) {
  await page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
}

/** Seeds one action through the database API as the supervisor (the UI form is covered elsewhere). */
async function seedAction() {
  const url = process.env.CODECO_E2E_SUPABASE_URL;
  const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email: supervisor.email!, password: supervisor.password! });
  if (signedIn.error) throw signedIn.error;
  const project = (await client.from("projects").select("id").eq("name", projectName).single()).data!;
  const building = (await client.from("buildings").select("id").eq("project_id", project.id).order("code").limit(1).single()).data!;
  const party = (await client.from("parties").select("id").eq("project_id", project.id).eq("party_type", "contractor").limit(1).single()).data!;
  const created = await client.rpc("create_project_action", {
    p_project_id: project.id, p_building_id: building.id, p_owner_party_id: party.id, p_owner_user_id: null,
    p_title: actionTitle, p_description: "Level 2 slab", p_due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), p_priority: "normal",
    p_idempotency_key: `e2e-final-${suffix}`, p_location_node_id: null,
  });
  if (created.error) throw created.error;
  const action = created.data as { id: string };
  const shared = await client.rpc("share_to_portal", {
    p_project_id: project.id, p_audience: "contractor", p_party_id: party.id, p_record_type: "action", p_record_id: action.id,
    p_title: actionTitle, p_summary: "Clear the slab and report complete with a photo.", p_requested_action: "implement",
    p_priority: "normal", p_due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), p_file_ids: [], p_contact_user_id: null,
  });
  if (shared.error) throw shared.error;
  return action.id;
}

test("the main menu follows the client's mind map and the overview shows every panel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The menu order and panels do not depend on the viewport.");
  test.setTimeout(120_000);
  await signIn(page, supervisor);
  const labels = (await page.locator(".sidebar .nav-button").allInnerTexts()).map((label) => label.trim());
  expect(labels).toEqual(["Overview", "Workspace", "Actions", "Rapid Verify", "Project Documents", "Records & Photos", "Reports", "Management"]);
  const panels = page.locator(".overview-panels");
  await expect(panels).toBeVisible();
  for (const heading of ["Progress", "Quality", "HSE", "Inspections", "Verification", "Contractors", "Documents"]) {
    await expect(panels.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  // A planned figure is never invented without a schedule.
  await expect(panels.getByText("No baseline schedule in the app")).toBeVisible();
});

test("a document is registered, revised and superseded without losing the earlier revision", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office" || !uploads, "Needs the fake Blob stack for uploads.");
  test.setTimeout(180_000);
  await signIn(page, supervisor);
  await nav(page, "Project Documents");
  const register = page.locator(".document-register");
  await expect(register).toBeVisible();
  await expect(register.getByRole("button", { name: /Shop Drawings/ })).toBeVisible();
  await register.getByRole("button", { name: "Register document" }).click();
  const dialog = page.getByRole("dialog", { name: "Register document" });
  await dialog.getByLabel("Document number").fill(documentNumber);
  await dialog.getByLabel("Title (required)").fill(`Ground floor plan ${suffix}`);
  await dialog.getByLabel("Revision (as on the document)").fill("A");
  await dialog.getByLabel("File").setInputFiles({ name: `${documentNumber}-A.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
  await dialog.getByRole("button", { name: "Register", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 60_000 });
  await register.getByRole("button", { name: `Ground floor plan ${suffix}` }).click();
  const detail = page.locator(".document-detail");
  await expect(detail).toBeVisible({ timeout: 60_000 });
  await expect(detail.getByText("This revision is not issued for construction.")).toBeVisible();

  await detail.getByRole("button", { name: "Upload new revision" }).click();
  await expect(detail.getByLabel("Revision mark")).toHaveValue("B");
  await detail.locator("input[type='file']").setInputFiles({ name: `${documentNumber}-B.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n2 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
  const history = detail.locator("table").first();
  // Nothing is approved yet, so the newest live revision is shown as current; A keeps its status (Word 4.3).
  await expect(history.getByText("B · current")).toBeVisible({ timeout: 60_000 });
  await expect(history.getByRole("row").filter({ hasText: /^A/ }).getByText("Superseded")).toHaveCount(0);

  // F15: a revision under review is never sent out. Routing now is refused with the reason.
  await detail.getByRole("button", { name: "Assign or share" }).click();
  const share = detail.locator(".portal-share-form");
  await share.getByLabel("Portal").selectOption("client");
  await share.getByLabel("Requested action").selectOption("approve");
  await share.getByRole("button", { name: "Route to client" }).click();
  await expect(share.getByText("This document has no approved revision to release")).toBeVisible();
  await share.getByRole("button", { name: "Cancel" }).click();

  // The reviewer approves revision B; routing then releases exactly that revision.
  await detail.getByRole("button", { name: "Review status" }).click();
  await detail.getByLabel(/New status for revision/).selectOption("approved");
  await detail.getByRole("button", { name: "Save status" }).click();
  await expect(history.getByRole("row").filter({ hasText: /^B/ }).getByText("Approved")).toBeVisible({ timeout: 30_000 });
  // Approving B supersedes A, which stays in the history.
  await expect(history.getByRole("row").filter({ hasText: /^A/ }).getByText("Superseded")).toBeVisible();
  await detail.getByRole("button", { name: "Assign or share" }).click();
  await share.getByLabel("Portal").selectOption("client");
  await share.getByLabel("Requested action").selectOption("approve");
  await share.getByRole("button", { name: "Route to client" }).click();
  const routed = detail.locator(".portal-share-item").first();
  await expect(routed).toContainText("Awaiting response");
  await routed.locator(".portal-share-summary").click();
  await expect(routed.getByText(/Revision B · Approved/)).toBeVisible();
});

test("a client approver approves the routed document in the client portal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office" || !uploads, "Follows the document registered above.");
  test.setTimeout(120_000);
  await signIn(page, clientPortal);
  await expect(page.locator(".portal-shell")).toBeVisible();
  await expect(page.getByText("Client portal").first()).toBeVisible();
  await openSection(page, ".portal-main", /Items for client review/);
  await page.getByRole("button", { name: /Ground floor plan/ }).first().click();
  const detail = page.locator(".portal-detail");
  await detail.getByRole("button", { name: "Approve", exact: true }).click();
  await detail.getByLabel("Comment", { exact: true }).fill("Approved by the employer.");
  await detail.locator(".portal-response-actions .ui-button--primary").click();
  await expect(detail.getByText("Approved").first()).toBeVisible();
  // The client never sees contractor items.
  await expect(page.getByText(actionTitle)).toHaveCount(0);
});

test("a contractor reports an action complete with a photo and Rapid Verify closes it", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office" || !uploads || !photo, "Needs the fake Blob stack and a fixture photo.");
  test.setTimeout(240_000);
  const actionId = await seedAction();
  test.skip(!actionId, "Needs the local database API.");

  const contractorPage = await (await browser.newContext()).newPage();
  await signIn(contractorPage, contractor);
  await openSection(contractorPage, ".portal-main", /Pending actions/);
  await contractorPage.getByRole("button", { name: new RegExp(actionTitle) }).first().click();
  const item = contractorPage.locator(".portal-detail");
  await item.getByRole("button", { name: "Report complete", exact: true }).click();
  await item.getByLabel("Comment", { exact: true }).fill("Slab cleared.");
  await item.locator("input[type='file']").setInputFiles(photo!);
  await expect(item.locator(".portal-upload-list li")).toHaveCount(1, { timeout: 60_000 });
  await item.locator(".portal-response-actions .ui-button--primary").click();
  await expect(item.getByText("Submitted for verification").first()).toBeVisible();
  await contractorPage.context().close();

  const page = await (await browser.newContext()).newPage();
  await signIn(page, supervisor);
  await nav(page, "Rapid Verify");
  await openSection(page, ".verification-workspace", /Action verification/);
  const row = page.locator(".verification-row").filter({ hasText: actionTitle });
  // The history lists record numbers, not titles: remember this action's own number to find its row afterwards.
  const recordNumber = ((await row.innerText()).match(/ACT-\d{4}-\d{4}/) ?? [])[0];
  expect(recordNumber, "the action's record number on its verification row").toBeTruthy();
  await row.getByRole("button", { name: "Verify" }).click();
  const dialog = page.getByRole("dialog", { name: /Verify/ });
  await dialog.getByRole("radio", { name: "Pass" }).click();
  await dialog.getByLabel("Comment").fill("Checked on site.");
  await dialog.getByRole("button", { name: "Record verification" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".verification-row").filter({ hasText: actionTitle })).toHaveCount(0);
  await openSection(page, ".verification-workspace", /Verification history/);
  await expect(page.locator(".portal-table tr").filter({ hasText: recordNumber! }).getByText("Checked on site.", { exact: true })).toBeVisible();
  await page.context().close();
});

test("Records & Photos, the register reports, the action views and document settings open", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "Screen structure does not depend on the viewport.");
  test.setTimeout(150_000);
  await signIn(page, supervisor);

  await nav(page, "Records & Photos");
  const archive = page.locator(".records-archive");
  await expect(archive.getByRole("heading", { name: "Records & Photos" })).toBeVisible();
  for (const section of [/Photo library/, /Attachments/, /Record history/, /Submitted forms/]) await openSection(page, ".records-archive", section);
  await expect(archive.getByLabel("Form type")).toBeVisible();

  await nav(page, "Reports");
  // Reports opens on the day overview; the register reports stand under "Create report".
  await openSection(page, "#main-content", /^Create report$/);
  const reports = page.getByRole("region", { name: "Register reports" });
  await expect(reports).toBeVisible();
  for (const option of ["Action register / overdue actions", "Document register / outstanding submittals", "Contractor performance summary"]) {
    await reports.getByLabel("Report").selectOption({ label: option });
    await expect(reports.getByText(/data cut-off/)).toBeVisible();
  }

  await nav(page, "Actions");
  const focus = page.getByLabel("Show actions");
  await expect(focus.locator("option")).toHaveText(["All responsible parties and kinds", "Contractor actions", "Corrective actions", "Preventive actions"]);
  await expect(page.locator(".action-center-summary button", { hasText: "Completed / closed" })).toBeVisible();

  await nav(page, "Management");
  await openSection(page, "#main-content", /Document settings/);
  const settings = page.getByRole("region", { name: "Document settings" });
  await expect(settings.getByLabel("Code of folder 1", { exact: true })).toHaveValue("00");
  await expect(settings.getByLabel("Code of folder 14", { exact: true })).toHaveValue("13");
  await openSection(page, "#main-content", /Portals/);
  await expect(page.getByRole("heading", { name: "Portal register" })).toBeVisible();
});
