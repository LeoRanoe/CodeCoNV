import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

/**
 * Developer package v5, "link first, then fill" (Excel START HERE, Word 3): choosing the record a form is about copies
 * what that record already says. An NCR that points at an inspection takes its discipline and location; a value the
 * person typed first is never replaced; every copied value stays editable.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const url = process.env.CODECO_E2E_SUPABASE_URL;
const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

test.skip(!email || !password || !url || !key, "The fixture account and the local Supabase keys are required.");
test.describe.configure({ mode: "serial" });

const discipline = "Concrete & Reinforced Concrete";
const location = "Axis B-4, level 2";
let inspection: { id: string; inspection_number: string; spec: unknown } | null = null;

// The fixture supervisor edits the inspection itself; the service role has no table grants on it.
async function api() {
  const client = createClient(url!, key!, { auth: { persistSession: false } });
  const result = await client.auth.signInWithPassword({ email: email!, password: password! });
  if (result.error) throw new Error(`sign in failed: ${result.error.message}`);
  return client;
}

test.beforeAll(async ({ }, testInfo) => {
  if (testInfo.project.name !== "desktop-office") return;
  const admin = await api();
  const project = await admin.from("projects").select("id").eq("name", projectName).single();
  if (project.error) throw project.error;
  const found = await admin.from("inspections").select("id,inspection_number,spec").eq("project_id", project.data.id).order("inspection_number").limit(1).single();
  if (found.error) throw found.error;
  inspection = found.data;
  const updated = await admin.from("inspections").update({ spec: { discipline, exact_location: location } }).eq("id", found.data.id);
  if (updated.error) throw updated.error;
});

test.afterAll(async () => {
  if (!inspection) return;
  const admin = await api();
  await admin.from("inspections").update({ spec: inspection.spec ?? {} }).eq("id", inspection.id);
});

async function signIn(page: Page) {
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
}

async function openNcr(page: Page) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='ncr']").click();
  await expect(page.locator("[data-sheet-form='ncr']")).toBeVisible();
}

const linkInspection = async (page: Page) => {
  const picker = page.locator("[data-sheet-form='ncr'] [data-spec-field='related_inspection']");
  await picker.locator("select").selectOption({ index: 1 });
  await expect(picker.locator(".spec-record-chip")).toBeVisible();
  return picker;
};

test("an NCR linked to an inspection takes its discipline, and the person can still change it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await openNcr(page);
  const form = page.locator("[data-sheet-form='ncr']");
  const picker = form.locator("[data-spec-field='related_inspection']");
  await picker.locator(".spec-record-search input").fill(inspection!.inspection_number);
  await picker.locator("select").selectOption({ index: 1 });
  await expect(picker.locator(".spec-record-chip")).toContainText(inspection!.inspection_number);
  await expect(form.locator("[data-spec-field='discipline'] select")).toHaveValue(discipline);
  // The copied value is a starting point: the person can pick another discipline.
  const other = await form.locator("[data-spec-field='discipline'] select option").evaluateAll((options, current) => options.map((option) => (option as HTMLOptionElement).value).find((value) => value && value !== current), discipline);
  await form.locator("[data-spec-field='discipline'] select").selectOption(other!);
  await expect(form.locator("[data-spec-field='discipline'] select")).toHaveValue(other!);
});

test("a discipline chosen before linking is kept", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await openNcr(page);
  const form = page.locator("[data-sheet-form='ncr']");
  const select = form.locator("[data-spec-field='discipline'] select");
  const own = await select.locator("option").evaluateAll((options, wanted) => options.map((option) => (option as HTMLOptionElement).value).find((value) => value && value !== wanted), discipline);
  await select.selectOption(own!);
  await linkInspection(page);
  await expect(select).toHaveValue(own!);
});
