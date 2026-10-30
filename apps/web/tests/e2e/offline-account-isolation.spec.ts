import { expect, type Page, test } from "@playwright/test";

/**
 * A field device is shared. What one account downloaded must not be readable by the next
 * account that signs in, "remove offline copy" must really remove it, and work that was not
 * sent yet must neither disappear silently nor be sent under somebody else's name.
 *
 * Needs the two local fixture accounts from tests/e2e/seed-local-fixtures.mjs. A release run
 * sets CODECO_E2E_REQUIRED=1 so missing fixtures fail the job instead of skipping it.
 */
const emailA = process.env.CODECO_E2E_EMAIL;
const passwordA = process.env.CODECO_E2E_PASSWORD;
const projectA = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const emailB = process.env.CODECO_E2E_SECOND_EMAIL;
const passwordB = process.env.CODECO_E2E_SECOND_PASSWORD;
const projectB = process.env.CODECO_E2E_SECOND_PROJECT ?? "Other Organisation Project";
const configured = Boolean(emailA && passwordA && emailB && passwordB);

if (process.env.CODECO_E2E_REQUIRED === "1" && !configured) {
  throw new Error("CODECO_E2E_EMAIL/PASSWORD and CODECO_E2E_SECOND_EMAIL/PASSWORD are required for the release gate.");
}
test.skip(!configured, "Two fixture accounts are required (tests/e2e/seed-local-fixtures.mjs).");

type StoreDump = Record<string, Array<{ id: string; ownerUserId?: string; title?: string }>>;

async function dumpOfflineStores(page: Page): Promise<StoreDump> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("codeco-field-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result: Record<string, Array<{ id: string; ownerUserId?: string; title?: string }>> = {};
    for (const store of Array.from(database.objectStoreNames)) {
      result[store] = await new Promise((resolve) => {
        const request = database.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve((request.result as Array<Record<string, unknown>>).map((value) => ({
          id: String(value.id),
          ownerUserId: value.ownerUserId as string | undefined,
          title: (value.preview as { title?: string } | undefined)?.title,
        })));
      });
    }
    database.close();
    return result;
  });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(email);
  await form.locator("input[type='password']").fill(password);
  await form.locator("button[type='submit']").click();
  await expect(page.locator(".context-shell")).toBeVisible();
}

async function openProject(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

async function downloadEverything(page: Page) {
  await page.getByRole("button", { name: /Offline availability|Offline beschikbaarheid/ }).click();
  await page.getByRole("button", { name: /Make everything available offline|Alles offline beschikbaar maken|Update offline copy|Offline kopie bijwerken/ }).click();
  // Closing the dialog stops a running download, so wait for it to finish.
  await expect(page.getByText("Everything this account can read is now on this device.")).toBeVisible({ timeout: 90_000 });
  expect((await dumpOfflineStores(page)).snapshots.length).toBeGreaterThan(2);
  await page.keyboard.press("Escape");
}

test("a second account on the same device cannot read the first account's offline data", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  test.skip(testInfo.project.name !== "desktop-office", "Storage behaviour is identical on every viewport.");

  await signIn(page, emailA!, passwordA!);
  await openProject(page, projectA);
  await downloadEverything(page);
  // The first service worker takes the page over and the app reloads once when it does; reading the
  // device storage in the middle of that reload fails with "execution context was destroyed".
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1500);

  const ownerA = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("codeco-field-v1");
      request.onsuccess = () => resolve(request.result);
    });
    const owner = await new Promise<string>((resolve) => {
      const request = database.transaction("settings").objectStore("settings").get("device-owner");
      request.onsuccess = () => resolve((request.result as { userId: string }).userId);
    });
    // One unsent registration written by A, exactly as the queue stores it.
    await new Promise<void>((resolve) => {
      const transaction = database.transaction("records", "readwrite");
      transaction.objectStore("records").put({
        id: "pending:e2e-isolation-probe",
        projectId: "probe",
        kind: "finding",
        input: {},
        preview: { title: "ISOLATION PROBE", description: "", buildingId: null, locationNodeId: null, severity: "low", priority: "normal", dueAt: null, recordType: "finding" },
        createdAt: new Date().toISOString(),
        lastError: null,
        ownerUserId: owner,
      });
      transaction.oncomplete = () => resolve();
    });
    database.close();
    return owner;
  });

  // Signing out with unsent work asks first, and keeping the work is the default action.
  await page.getByRole("button", { name: /Sign out|afmelden/i }).first().click();
  await expect(page.getByRole("alertdialog", { name: /unsent work|niet-verstuurd werk/i })).toBeVisible();
  await page.getByRole("button", { name: /Keep work and sign out|Werk bewaren en afmelden/ }).click();
  await expect(page.locator(".access-form")).toBeVisible();

  const afterSignOut = await dumpOfflineStores(page);
  expect(afterSignOut.snapshots, "readable project data is removed at sign-out").toEqual([]);
  expect(afterSignOut.files).toEqual([]);
  expect(afterSignOut.records.map((record) => record.id)).toEqual(["pending:e2e-isolation-probe"]);
  expect(afterSignOut.records[0].ownerUserId).toBe(ownerA);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("sb-"))), "the session is gone").toEqual([]);

  await signIn(page, emailB!, passwordB!);
  await expect(page.getByText(projectB)).toBeVisible();
  await expect(page.getByText(projectA)).toHaveCount(0);
  await expect(page.getByText("ISOLATION PROBE")).toHaveCount(0);
  const asB = await dumpOfflineStores(page);
  expect(asB.snapshots.every((snapshot) => !snapshot.id.includes(ownerA)), "no cached workspace of A").toBe(true);

  // B's own offline copy, then "remove offline copy" must leave nothing readable behind.
  await openProject(page, projectB);
  await downloadEverything(page);
  await page.getByRole("button", { name: /Offline availability|Offline beschikbaarheid/ }).click();
  await page.getByRole("button", { name: /Remove offline copy|Offline kopie verwijderen/ }).click();
  await page.getByRole("button", { name: /^(Remove|Verwijderen)$/ }).click();
  await expect(page.getByText(/The offline copy has been removed|De offline kopie is verwijderd/)).toBeVisible();
  const afterRemove = await dumpOfflineStores(page);
  expect(afterRemove.snapshots).toEqual([]);
  expect(afterRemove.files).toEqual([]);
  const cachedApi = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        if (new URL(request.url).pathname.startsWith("/api/")) urls.push(request.url);
      }
    }
    return urls;
  });
  expect(cachedApi, "project data never sits in the shared service-worker cache").toEqual([]);
  await page.keyboard.press("Escape");

  // A signs back in: the unsent work is A's again, and A may discard it explicitly.
  await page.getByRole("button", { name: /Sign out|afmelden/i }).first().click();
  await expect(page.locator(".access-form")).toBeVisible();
  await signIn(page, emailA!, passwordA!);
  await page.getByRole("button", { name: /Sign out|afmelden/i }).first().click();
  await page.getByRole("button", { name: /Discard unsent work|Niet-verstuurd werk weggooien/ }).click();
  await page.getByRole("button", { name: /Delete and sign out|Verwijderen en afmelden/ }).click();
  await expect(page.locator(".access-form")).toBeVisible();
  expect((await dumpOfflineStores(page)).records).toEqual([]);
});
