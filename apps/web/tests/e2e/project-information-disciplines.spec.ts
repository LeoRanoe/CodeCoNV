import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

/**
 * Word 13 and 4.2, end to end on the local fixture stack:
 *  - Management > Project information: client, site address, dates, currency and status persist
 *    after a reload; a role without project.configure cannot change them (database refuses, the
 *    screen shows them read-only);
 *  - Management > Workflows & lists > Project disciplines: the workbook's 18 stay, the project adds
 *    its own, and the addition belongs to this project only;
 *  - Project Documents: the register uses that list on create and edit, keeps an older free-text
 *    discipline, and the filter and the Excel export return the saved discipline.
 */
const supervisor = { email: process.env.CODECO_E2E_EMAIL, password: process.env.CODECO_E2E_PASSWORD };
const second = { email: process.env.CODECO_E2E_SECOND_EMAIL, password: process.env.CODECO_E2E_SECOND_PASSWORD };
const contractor = { email: process.env.CODECO_E2E_CONTRACTOR_EMAIL, password: process.env.CODECO_E2E_CONTRACTOR_PASSWORD };
const clientAccount = { email: process.env.CODECO_E2E_CLIENT_EMAIL, password: process.env.CODECO_E2E_CLIENT_PASSWORD };
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const secondProject = process.env.CODECO_E2E_SECOND_PROJECT ?? "Other Organisation Project";
const url = process.env.CODECO_E2E_SUPABASE_URL;
const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
const secret = process.env.CODECO_E2E_SECRET_KEY;
const uploads = process.env.CODECO_E2E_FAKE_BLOB === "1";
// A plain supervisor (no project.configure) is created locally by this spec, like seed-ui-demo-data does for the other roles.
// Its password is derived from the local service key, so it is never written in the repository and every worker agrees on it.
const fieldSupervisor = { email: "field-supervisor-a@codeco.test", password: `Fx-${createHash("sha256").update(`${secret ?? ""}:field-supervisor-a`).digest("base64url").slice(0, 28)}!1`, name: "Field Supervisor" };

test.skip(!supervisor.email || !url || !key || !secret, "The fixture accounts and the local Supabase keys are required.");
test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString(36).slice(-5).toUpperCase();
const ownDiscipline = `Marine Works ${suffix}`;
const olderDiscipline = `grondwerk (oud ${suffix})`;
const documentNumber = `D-${suffix}`;
const documentTitle = `Quay wall section ${suffix}`;

async function api(account: { email?: string; password?: string }): Promise<SupabaseClient> {
  const client = createClient(url!, key!, { auth: { persistSession: false } });
  const result = await client.auth.signInWithPassword({ email: account.email!, password: account.password! });
  if (result.error) throw new Error(`sign in failed: ${result.error.message}`);
  return client;
}

async function projectId(client: SupabaseClient, name = projectName) {
  const result = await client.from("projects").select("id").eq("name", name).single();
  if (result.error) throw result.error;
  return result.data.id as string;
}

async function signIn(page: Page, account: { email?: string; password?: string }, project = projectName) {
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
  await page.getByRole("button", { name: new RegExp(project) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" }).or(page.locator(".portal-shell")).first()).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(600);
}

/** After a reload the app resumes where it was; a project picker appears only when it cannot. */
async function reopen(page: Page) {
  await page.reload();
  await page.locator(".sidebar, .project-selection-grid").first().waitFor({ state: "visible", timeout: 60_000 });
  if (await page.locator(".project-selection-grid").isVisible().catch(() => false)) await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function openSection(page: Page, name: RegExp) {
  await page.locator("#main-content").locator("[role='tablist'], button[aria-haspopup='true']").first().waitFor({ timeout: 60_000 });
  const tab = page.getByRole("tab", { name }).first();
  if (!(await tab.isVisible().catch(() => false))) await page.locator("#main-content button[aria-haspopup='true']").first().click();
  await page.getByRole("tab", { name }).first().click();
}

async function openManagement(page: Page, section: RegExp) {
  await page.locator(".sidebar").getByRole("button", { name: "Management", exact: true }).click();
  await openSection(page, section);
}

type Original = { client_name: string | null; location: string; start_date: string | null; end_date: string | null; currency: string | null; status: string };
let admin: SupabaseClient;
let originalInformation: Original;
let originalConfiguration: Record<string, unknown> = {};
let mainProjectId = "";

test.beforeAll(async () => {
  const supervisorApi = await api(supervisor);
  mainProjectId = await projectId(supervisorApi);
  const info = await supervisorApi.from("projects").select("client_name,location,start_date,end_date,currency,status").eq("id", mainProjectId).single();
  if (info.error) throw info.error;
  originalInformation = info.data as Original;
  const settings = await supervisorApi.from("project_settings").select("spec_configuration").eq("project_id", mainProjectId).single();
  if (settings.error) throw settings.error;
  originalConfiguration = (settings.data.spec_configuration ?? {}) as Record<string, unknown>;
  // The plain supervisor: created once, provisioned for this project only.
  admin = createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  let userId = listed.data.users.find((user) => user.email === fieldSupervisor.email)?.id;
  if (!userId) {
    const created = await admin.auth.admin.createUser({ email: fieldSupervisor.email, password: fieldSupervisor.password, email_confirm: true, user_metadata: { display_name: fieldSupervisor.name } });
    if (created.error) throw created.error;
    userId = created.data.user.id;
  } else {
    const updated = await admin.auth.admin.updateUserById(userId, { password: fieldSupervisor.password });
    if (updated.error) throw updated.error;
  }
  const organization = await supervisorApi.from("projects").select("organization_id").eq("id", mainProjectId).single();
  const provisioned = await supervisorApi.rpc("provision_internal_user", { p_organization_id: organization.data!.organization_id, p_user_id: userId, p_display_name: fieldSupervisor.name, p_role_code: "supervisor", p_project_id: mainProjectId });
  if (provisioned.error && !/already/i.test(provisioned.error.message)) throw provisioned.error;
});

test.afterAll(async () => {
  // Leave the fixture as it was found.
  const supervisorApi = await api(supervisor);
  await supervisorApi.from("projects").update(originalInformation).eq("id", mainProjectId);
  await supervisorApi.from("project_settings").update({ spec_configuration: originalConfiguration }).eq("project_id", mainProjectId);
});

test("Project information persists after a reload and rejects an impossible date range", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page, supervisor);
  await openManagement(page, /^Project information$/);
  const panel = page.locator("[data-project-information]");
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Project code")).toHaveAttribute("readonly", "");
  await expect(panel.getByLabel("Time zone")).toHaveValue("America/Paramaribo");

  const client = `Ministerie ${suffix}`;
  const address = `Gravenstraat ${suffix}, Paramaribo`;
  await panel.locator("[data-project-field='client']").fill(client);
  await panel.locator("[data-project-field='address']").fill(address);
  await panel.locator("[data-project-field='start']").fill("2027-02-01");
  await panel.locator("[data-project-field='end']").fill("2027-01-15");
  await expect(panel.getByRole("alert").first()).toContainText("before the start date");
  await expect(panel.getByRole("button", { name: "Save project information" })).toBeDisabled();
  await panel.locator("[data-project-field='end']").fill("2027-11-30");
  await panel.locator("[data-project-field='currency']").fill("usd");
  await panel.locator("[data-project-field='status']").selectOption("on_hold");
  await panel.getByRole("button", { name: "Save project information" }).click();
  await expect(panel.locator("[data-project-information-message]")).toHaveText("Project information saved.");
  await page.screenshot({ path: testInfo.outputPath("project-information.png"), fullPage: true });

  // After a reload the values come from the database.
  await reopen(page);
  await openManagement(page, /^Project information$/);
  const again = page.locator("[data-project-information]");
  await expect(again.locator("[data-project-field='client']")).toHaveValue(client);
  await expect(again.locator("[data-project-field='address']")).toHaveValue(address);
  await expect(again.locator("[data-project-field='start']")).toHaveValue("2027-02-01");
  await expect(again.locator("[data-project-field='end']")).toHaveValue("2027-11-30");
  await expect(again.locator("[data-project-field='currency']")).toHaveValue("USD");
  await expect(again.locator("[data-project-field='status']")).toHaveValue("on_hold");

  const stored = await (await api(supervisor)).from("projects").select("client_name,location,start_date,end_date,currency,status").eq("id", mainProjectId).single();
  expect(stored.data).toMatchObject({ client_name: client, location: address, start_date: "2027-02-01", end_date: "2027-11-30", currency: "USD", status: "on_hold" });
});

test("a role without project.configure cannot change the project information", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  const before = (await (await api(supervisor)).from("projects").select("client_name,currency,version").eq("id", mainProjectId).single()).data!;
  // The database refuses the write for every role that is not a project manager: the update touches no row.
  for (const account of [fieldSupervisor, contractor, clientAccount]) {
    const unauthorized = await api(account);
    const result = await unauthorized.from("projects").update({ client_name: "Changed by the wrong role", currency: "EUR" }).eq("id", mainProjectId).select("id");
    expect(result.error, account.email).toBeNull();
    expect(result.data ?? [], `${account.email} updated no row`).toHaveLength(0);
  }
  const after = (await (await api(supervisor)).from("projects").select("client_name,currency,version").eq("id", mainProjectId).single()).data!;
  expect(after).toEqual(before);

  // On screen: the plain supervisor reads the values and is offered no save.
  await signIn(page, fieldSupervisor);
  await openManagement(page, /^Project information$/);
  const panel = page.locator("[data-project-information]");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-project-information-readonly]")).toBeVisible();
  await expect(panel.locator("[data-project-field='client']")).toHaveValue(String(before.client_name));
  await expect(panel.locator("[data-project-field='client']")).toHaveAttribute("readonly", "");
  await expect(panel.locator("[data-project-field='status']")).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Save project information" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("project-information-readonly.png"), fullPage: true });
  await expect(page.getByRole("tab", { name: "Workflows & lists" })).toHaveCount(0);
});

test("Management keeps the project's disciplines: the workbook's 18 stay, the project adds its own, for this project only", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page, supervisor);
  await openManagement(page, /^Workflows & lists$/);
  const panel = page.getByRole("region", { name: "Specification settings" });
  await panel.locator("label.form-field", { hasText: "List" }).first().locator("select").selectOption({ label: "Project disciplines" });
  const values = panel.locator(".spec-config-values li");
  await expect(values.first()).toBeVisible();
  // The 18 workbook disciplines (v5 added Timber Structures & Carpentry) cannot be switched off: the Works forms depend on them.
  await expect(panel.locator(".spec-config-values input[type='checkbox'][disabled]")).toHaveCount(18);
  await expect(panel.locator(".spec-config-values").getByText("workbook standard").first()).toBeVisible();
  await panel.getByLabel("New value").fill(ownDiscipline);
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel.getByText(ownDiscipline)).toBeVisible();
  await panel.getByRole("button", { name: "Save specification settings" }).click();
  await expect(page.getByText("Specification settings saved.")).toBeVisible();

  const stored = await (await api(supervisor)).from("project_settings").select("spec_configuration").eq("project_id", mainProjectId).single();
  expect((stored.data!.spec_configuration as { lists?: { disciplines?: { added?: string[] } } }).lists?.disciplines?.added).toContain(ownDiscipline);

  // The other organisation's project has its own list and never sees this one.
  if (second.email) {
    const other = await api(second);
    const otherId = await projectId(other, secondProject);
    const otherSettings = await other.from("project_settings").select("spec_configuration").eq("project_id", otherId).maybeSingle();
    expect(JSON.stringify(otherSettings.data?.spec_configuration ?? {})).not.toContain(ownDiscipline);
    const mainFromOther = await other.from("project_settings").select("spec_configuration").eq("project_id", mainProjectId);
    expect(mainFromOther.data ?? []).toHaveLength(0);
  }
});

test("Project Documents uses the project's list on create and edit, keeps older values, filters and exports the saved discipline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office" || !uploads, "Needs the fake Blob stack for uploads.");
  test.setTimeout(240_000);
  await signIn(page, supervisor);
  await page.locator(".sidebar").getByRole("button", { name: "Project Documents", exact: true }).click();
  const register = page.locator(".document-register");
  await expect(register).toBeVisible();
  await register.getByRole("button", { name: "Register document" }).click();
  const dialog = page.getByRole("dialog", { name: "Register document" });
  const select = dialog.locator("[data-document-field='discipline'] select");
  const options = await select.locator("option").allTextContents();
  expect(options).toContain(ownDiscipline);
  for (const standard of ["Preliminaries & Site Establishment", "Testing, Commissioning & Handover", "Structural", "External Works"]) expect(options, standard).toContain(standard);
  await dialog.getByLabel("Document number").fill(documentNumber);
  await dialog.getByLabel("Title (required)").fill(documentTitle);
  await select.selectOption(ownDiscipline);
  await dialog.getByLabel("File").setInputFiles({ name: `${documentNumber}.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
  await dialog.getByRole("button", { name: "Register", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 60_000 });

  // Create: the saved discipline is the one chosen.
  const row = register.getByRole("row").filter({ hasText: documentNumber });
  await expect(row).toContainText(ownDiscipline);
  const stored = await (await api(supervisor)).from("project_documents").select("id,discipline").eq("document_number", documentNumber).single();
  expect(stored.data!.discipline).toBe(ownDiscipline);

  // Filter: the project's discipline is offered and returns the document.
  const filter = register.locator(".document-register-filters label", { hasText: "Discipline" }).locator("select");
  await filter.selectOption(ownDiscipline);
  await expect(register.getByRole("row").filter({ hasText: documentNumber })).toHaveCount(1);
  await expect(register.getByRole("row").filter({ hasText: ownDiscipline })).not.toHaveCount(0);

  // Export: the Excel file carries the saved discipline.
  const [download] = await Promise.all([page.waitForEvent("download"), register.getByRole("button", { name: /Excel/ }).click()]);
  const path = testInfo.outputPath("document-register.xlsx");
  await download.saveAs(path);
  const zip = await JSZip.loadAsync(await (await import("node:fs/promises")).readFile(path));
  const strings = (await Promise.all(Object.keys(zip.files).filter((name) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(name)).map((name) => zip.file(name)!.async("string")))).join(" ");
  expect(strings).toContain(ownDiscipline);
  expect(strings).toContain(documentNumber);

  // Edit: change to a workbook discipline, then back to the project's own.
  await filter.selectOption("");
  await register.getByRole("button", { name: documentTitle }).click();
  const detail = page.locator(".document-detail");
  await expect(detail).toBeVisible({ timeout: 60_000 });
  await detail.getByRole("button", { name: "Edit details" }).click();
  const editSelect = detail.locator("[data-document-edit] [data-document-field='discipline'] select");
  await expect(editSelect).toHaveValue(ownDiscipline);
  await editSelect.selectOption("Structural");
  await detail.getByRole("button", { name: "Save details" }).click();
  await expect(detail.locator(".portal-facts")).toContainText("Structural");
  expect((await (await api(supervisor)).from("project_documents").select("discipline").eq("document_number", documentNumber).single()).data!.discipline).toBe("Structural");
  await detail.getByRole("button", { name: "Edit details" }).click();
  await detail.locator("[data-document-edit] [data-document-field='discipline'] select").selectOption(ownDiscipline);
  await detail.getByRole("button", { name: "Save details" }).click();
  await expect(detail.locator(".portal-facts")).toContainText(ownDiscipline);
  await expect(detail.getByText("Details changed").first()).toBeVisible();

  // Older free text (from before the list) is kept: it stays selectable, marked, and survives an unrelated edit.
  const supervisorApi = await api(supervisor);
  const id = stored.data!.id as string;
  const doc = (await supervisorApi.from("project_documents").select("*").eq("id", id).single()).data!;
  const older = await supervisorApi.rpc("update_project_document", { p_document_id: id, p_document_number: doc.document_number, p_title: doc.title, p_folder_code: doc.folder_code, p_discipline: olderDiscipline, p_document_type: doc.document_type, p_originator_party_id: doc.originator_party_id, p_originator_name: doc.originator_name, p_building_ids: doc.building_ids, p_work_package: doc.work_package });
  expect(older.error).toBeNull();
  await reopen(page);
  await page.locator(".sidebar").getByRole("button", { name: "Project Documents", exact: true }).click();
  const filterAgain = page.locator(".document-register .document-register-filters label", { hasText: "Discipline" }).locator("select");
  expect(await filterAgain.locator("option").allTextContents()).toContain(olderDiscipline);
  await page.locator(".document-register").getByRole("button", { name: documentTitle }).click();
  const detailAgain = page.locator(".document-detail");
  await detailAgain.getByRole("button", { name: "Edit details" }).click();
  const olderSelect = detailAgain.locator("[data-document-edit] [data-document-field='discipline'] select");
  await expect(olderSelect).toHaveValue(olderDiscipline);
  await expect(olderSelect.locator("option", { hasText: "older value, not on the project list" })).toHaveCount(1);
  await detailAgain.getByLabel("Work package").fill(`WP ${suffix}`);
  await detailAgain.getByRole("button", { name: "Save details" }).click();
  await expect(detailAgain.locator(".portal-facts")).toContainText(`WP ${suffix}`);
  expect((await supervisorApi.from("project_documents").select("discipline,work_package").eq("id", id).single()).data).toMatchObject({ discipline: olderDiscipline, work_package: `WP ${suffix}` });
  await page.screenshot({ path: testInfo.outputPath("document-discipline-edit.png"), fullPage: true });
});

test("another project's register does not offer this project's discipline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office" || !second.email, "desktop route with the second organisation account");
  await signIn(page, second, secondProject);
  await page.locator(".sidebar").getByRole("button", { name: "Project Documents", exact: true }).click();
  const register = page.locator(".document-register");
  await expect(register).toBeVisible();
  await register.getByRole("button", { name: "Register document" }).click();
  const options = await page.getByRole("dialog", { name: "Register document" }).locator("[data-document-field='discipline'] select option").allTextContents();
  expect(options).toContain("Structural");
  expect(options).not.toContain(ownDiscipline);
});

// ---- Phone, tablet and desktop: the new screens fit and pass the accessibility rules ----
async function goTo(page: Page, module: string) {
  const sidebar = page.locator(".sidebar").getByRole("button", { name: module, exact: true });
  if (await sidebar.isVisible().catch(() => false)) return sidebar.click();
  const bottom = page.locator(".mobile-bottom-nav").getByRole("button", { name: module, exact: true });
  if (await bottom.count()) return bottom.click();
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "More" }).click();
  await page.locator(".mobile-module-sheet").getByRole("button", { name: new RegExp(module) }).first().click();
}

async function checkScreen(page: Page, screen: string) {
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${screen} scrolls sideways`).toBe(true);
  const require = createRequire(import.meta.url);
  await page.evaluate(await readFile(require.resolve("axe-core/axe.min.js"), "utf8"));
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).axe.run(document, { runOnly: { type: "rule", values: ["color-contrast", "select-name", "label", "button-name", "aria-valid-attr-value", "aria-allowed-attr", "landmark-unique", "heading-order"] }, resultTypes: ["violations"] });
  });
  const violations = results.violations.flatMap((violation: { id: string; nodes: Array<{ target: string[]; any: Array<{ message: string }> }> }) => violation.nodes.map((node) => `${violation.id} · ${node.target.join(" ")} · ${node.any[0]?.message ?? ""}`));
  expect(violations, `${screen}: accessibility violations`).toEqual([]);
  // Every control a finger has to hit is at least 24 CSS pixels (WCAG 2.2 target size, minimum).
  const small = await page.evaluate(() => [...document.querySelectorAll("main button, main select, main input:not([type=checkbox]):not([type=radio]):not([type=hidden])")].filter((element) => { const box = element.getBoundingClientRect(); const visible = box.width > 0 && box.height > 0; return visible && (box.height < 24 || box.width < 24); }).map((element) => (element.getAttribute("aria-label") ?? element.textContent ?? element.tagName).slice(0, 40)));
  expect(small, `${screen}: controls below 24px`).toEqual([]);
}

test("the new Management, Documents and Inspections screens fit every viewport and pass axe", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await signIn(page, supervisor);
  await goTo(page, "Management");
  await openSection(page, /^Project information$/);
  await expect(page.locator("[data-project-information]")).toBeVisible();
  await checkScreen(page, `${testInfo.project.name} · Project information`);
  await openSection(page, /^Workflows & lists$/);
  await page.getByRole("region", { name: "Specification settings" }).locator("label.form-field", { hasText: "List" }).first().locator("select").selectOption({ label: "Project disciplines" });
  await expect(page.getByText("workbook standard").first()).toBeVisible();
  await checkScreen(page, `${testInfo.project.name} · Project disciplines`);
  await goTo(page, "Workspace");
  const back = page.locator(".workspace-back-button");
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.locator("[data-workspace-destination=inspections]").click();
  const plan = page.locator("[data-inspection-plan]");
  await expect(plan).toBeVisible();
  await plan.locator("summary").click();
  await expect(page.locator("[data-planned-inspections]")).toHaveCount(await page.locator("[data-planned-inspections]").count());
  await checkScreen(page, `${testInfo.project.name} · Plan an inspection`);
});

test("the new screens read in Dutch", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page, supervisor);
  await page.evaluate(() => localStorage.setItem("codeco-language-choice", "nl"));
  await reopen(page);
  await page.locator(".sidebar").getByRole("button", { name: "Beheer", exact: true }).click();
  await openSection(page, /^Projectgegevens$/);
  const panel = page.locator("[data-project-information]");
  for (const label of ["Projectnaam", "Projectcode", "Opdrachtgever", "Adres projectlocatie", "Startdatum", "Geplande opleverdatum", "Valuta", "Tijdzone"]) await expect(panel.getByLabel(label, { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Projectgegevens opslaan" })).toBeVisible();
  await openSection(page, /^Workflows & lijsten$/);
  await page.getByRole("region", { name: "Specificatie-instellingen" }).locator("label.form-field", { hasText: "Lijst" }).first().locator("select").selectOption({ label: "Projectdisciplines" });
  await expect(page.getByText("standaard van het werkboek").first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem("codeco-language-choice", "en"));
});
