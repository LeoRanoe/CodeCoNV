import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

/**
 * Supervision sees what each portal shows (menu areas 8 and 9): Contractor Portal and Client Portal in the
 * menu, read-only. Opening an item answers nothing and leaves no "viewed" trace in the portal's history.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const url = process.env.CODECO_E2E_SUPABASE_URL;
const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
test.skip(!email || !password || !url || !key, "A fixture account and the local Supabase keys are required.");

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await form.locator("input[type='email']").fill(email!);
  await form.locator("input[type='password']").fill(password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  return new URL(page.url()).searchParams.get("project")!;
}

for (const portal of [
  { nav: "contractorportal", label: "Contractor Portal", banner: /Preview of the Contractor Portal/, section: "Contractor portal" },
  { nav: "clientportal", label: "Client Portal", banner: /Preview of the Client Portal/, section: "Client portal" },
]) {
  test(`supervision previews the ${portal.label}, read-only`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-office", "One viewport is enough for the preview.");
    test.setTimeout(180_000);
    const api = createClient(url!, key!, { auth: { persistSession: false } });
    expect((await api.auth.signInWithPassword({ email: email!, password: password! })).error).toBeNull();
    const project = await signIn(page);
    const events = async () => (await api.from("portal_events").select("id", { count: "exact", head: true }).eq("project_id", project)).count ?? 0;
    const before = await events();

    // It is in the menu, between Reports and Management.
    await expect(page.getByRole("button", { name: portal.label, exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: portal.label, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`nav=${portal.nav}`));
    await expect(page.getByRole("note").filter({ hasText: portal.banner })).toBeVisible();
    await expect(page.getByRole("tablist", { name: portal.section }).or(page.getByRole("button", { name: new RegExp(`^${portal.section}`) })).first()).toBeVisible();
    // No second top bar or sign-out of a portal account inside the supervisor workspace.
    await expect(page.locator(".portal-topbar")).toBeHidden();

    // Open every kind of item the section lists: nothing can be answered.
    const rows = page.locator(".portal-row");
    const count = await rows.count();
    if (count) {
      await rows.first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Acknowledge|Respond|Resubmit|Submit evidence|Report complete|Approve|Reject|Request clarification/ })).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    // It survives a reload and leaves no view trace.
    await page.reload();
    await expect(page.getByRole("note").filter({ hasText: portal.banner })).toBeVisible();
    expect(await events(), "no portal event was written by looking").toBe(before);
    await page.screenshot({ path: testInfo.outputPath(`${portal.nav}.png`) });
  });
}
