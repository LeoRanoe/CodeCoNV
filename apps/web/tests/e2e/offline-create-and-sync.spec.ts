import { expect, type Page, test } from "@playwright/test";

/**
 * A record made in the real form, with and without a connection.
 *
 * Online: the action is saved centrally and is still there after the app is reloaded.
 * Offline: the same form keeps the action on the device, shows it in the list, and sends it
 * by itself when the connection returns — after which the device queue is empty and the
 * action comes back from the server on a fresh load.
 *
 * Runs against the local fixture stack (tests/e2e/seed-local-fixtures.mjs).
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

type QueuedRecord = { id: string; kind: string; ownerUserId?: string; preview: { title: string } };

function queuedRecords(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("codeco-field-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const request = database.transaction("records", "readonly").objectStore("records").getAll();
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return values;
  }) as Promise<QueuedRecord[]>;
}

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(email!);
  await form.locator("input[type='password']").fill(password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

async function openActionCentre(page: Page) {
  await page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true }).click();
  await expect(page.getByRole("button", { name: "New action" })).toBeVisible();
}

async function createAction(page: Page, title: string) {
  await page.getByRole("button", { name: "New action" }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("heading", { name: "Create central action" })).toBeVisible();
  // The form offers ready-made actions first; a free one is behind "Different action".
  await dialog.getByText("Different action", { exact: true }).click();
  await dialog.getByPlaceholder("What must demonstrably be completed?").fill(title);
  await dialog.getByPlaceholder("Describe the location, required measure and completion criterion.").fill("Written by the browser release gate; safe to ignore.");
  const employee = dialog.locator("select[name='ownerUserId']");
  if (!(await employee.inputValue())) await employee.selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Save and assign" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("an action is saved online, and one written offline is sent when the connection returns", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The queue is the same on every viewport.");
  test.setTimeout(240_000);
  const stamp = Date.now().toString(36);
  const onlineTitle = `Release gate online action ${stamp}`;
  const offlineTitle = `Release gate offline action ${stamp}`;

  await signIn(page);
  await openActionCentre(page);

  // Online: saved centrally, visible, and still there after a reload.
  await createAction(page, onlineTitle);
  await expect(page.getByText(onlineTitle).first()).toBeVisible();
  expect(await queuedRecords(page)).toHaveLength(0);
  await page.reload();
  await expect(page.getByText(onlineTitle).first()).toBeVisible({ timeout: 30_000 });

  // Offline: the same form keeps the action on this device, for this account.
  await context.setOffline(true);
  await createAction(page, offlineTitle);
  await expect(page.getByText(offlineTitle).first()).toBeVisible();
  const waiting = await queuedRecords(page);
  expect(waiting).toHaveLength(1);
  expect(waiting[0].kind).toBe("action");
  expect(waiting[0].id.startsWith("pending:")).toBe(true);
  expect(waiting[0].preview.title).toBe(offlineTitle);
  expect(waiting[0].ownerUserId, "a queued record belongs to the account that wrote it").toBeTruthy();
  // The header says what is true: nothing was lost, one registration waits on this device.
  await expect(page.locator(".storage-state")).toHaveAttribute("title", /1 waiting on this device/);

  // Connection back: it is sent by itself, exactly once, and the queue is empty afterwards.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await queuedRecords(page)).length, { timeout: 60_000, message: "the queued action is sent" }).toBe(0);
  await page.reload();
  await expect(page.getByText(offlineTitle).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(offlineTitle)).toHaveCount(await page.getByText(onlineTitle).count());
  expect(await queuedRecords(page)).toHaveLength(0);
});
