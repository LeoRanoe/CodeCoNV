import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { notificationPath, notificationRecordScreen } from "../../lib/notifications/record-link.mjs";
import { emptyScreen } from "../../lib/navigation/screen-url.mjs";

/**
 * A delivery link names a notification, not a record. After sign-in the app reads the notification as the
 * signed-in recipient and opens what it points at: the screen for its type with that record in the address.
 * Every notification type the fixtures hold for each role is opened this way (inspections have their own spec).
 */
const url = process.env.CODECO_E2E_SUPABASE_URL;
const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
const accounts = [
  { role: "supervisor", email: process.env.CODECO_E2E_EMAIL, password: process.env.CODECO_E2E_PASSWORD, portal: false },
  { role: "contractor", email: process.env.CODECO_E2E_CONTRACTOR_EMAIL, password: process.env.CODECO_E2E_CONTRACTOR_PASSWORD, portal: true },
  { role: "client portal", email: process.env.CODECO_E2E_CLIENT_PORTAL_EMAIL, password: process.env.CODECO_E2E_CLIENT_PORTAL_PASSWORD, portal: true },
  { role: "client", email: process.env.CODECO_E2E_CLIENT_EMAIL, password: process.env.CODECO_E2E_CLIENT_PASSWORD, portal: true },
];
test.skip(!url || !key || accounts.some((account) => !account.email || !account.password), "The fixture accounts and the local Supabase keys are required.");

for (const account of accounts) {
  test(`${account.role}: every kind of notification they hold opens its record from a delivery link`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-office", "desktop route");
    test.setTimeout(240_000);
    const api = createClient(url!, key!, { auth: { persistSession: false } });
    const signedIn = await api.auth.signInWithPassword({ email: account.email!, password: account.password! });
    expect(signedIn.error).toBeNull();
    const held = (await api.from("notifications").select("id,project_id,source_type,source_id,notification_type").not("source_id", "is", null).order("created_at", { ascending: false }).limit(200)).data ?? [];
    // One notification of every source type this account holds.
    const byType = new Map<string, (typeof held)[number]>();
    for (const row of held) if (row.source_type && !byType.has(row.source_type) && row.source_type !== "inspection") byType.set(row.source_type, row);
    test.skip(byType.size === 0, `${account.role} holds no notification of another type in this fixture database.`);
    console.log(`${account.role}: ${[...byType.keys()].join(", ")}`);

    for (const [sourceType, row] of byType) {
      const expected = notificationRecordScreen(row.project_id, sourceType, row.source_id, account.portal);
      await page.goto(notificationPath(row.project_id, row.id));
      await page.evaluate(() => {
        localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
        localStorage.setItem("codeco-language-choice", "en");
      });
      await page.reload();
      const form = page.locator(".access-form");
      if (await form.isVisible()) {
        await form.locator("input[type='email']").fill(account.email!);
        await form.locator("input[type='password']").fill(account.password!);
        await form.locator("button[type='submit']").click();
      }
      await expect(page, `${account.role} ${sourceType}`).toHaveURL(new RegExp(`[?&]record=${row.source_id}`), { timeout: 60_000 });
      const opened = new URL(page.url()).searchParams;
      // The start screen is the default and is left out of the address.
      expect(opened.get("nav") ?? emptyScreen.nav, `${sourceType} destination`).toBe(expected.nav);
      await expect(page.getByText("This notification is unavailable to this account.")).toHaveCount(0);
      await expect(page.locator(".access-form")).toHaveCount(0);
      // The same record after a reload.
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`[?&]record=${row.source_id}`));
      await expect(page.locator(".access-form")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`${account.role.replace(/ /g, "-")}-${sourceType}.png`) });
      // A fresh sign-in for the next link: this tab is already signed in, which is how a second e-mail link behaves too.
    }
  });
}
