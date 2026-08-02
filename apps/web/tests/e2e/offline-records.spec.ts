import { expect, test, type Page } from "@playwright/test";

/**
 * The storage a field record waits in. These checks need no account: they prove the device
 * really keeps a registration written without a connection, and still has it after the
 * installed app is reopened with the network switched off.
 */
const databaseName = "codeco-field-v1";

type StoredRecord = { id: string; kind: string; createdAt: string; preview: { title: string } };

function openStores(page: Page) {
  return page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = Array.from(database.objectStoreNames);
    database.close();
    return names;
  }, databaseName);
}

function putRecord(page: Page, record: Record<string, unknown>) {
  return page.evaluate(async ({ name, value }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("records", "readwrite");
      transaction.objectStore("records").put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { name: databaseName, value: record });
}

function readRecords(page: Page) {
  return page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
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
  }, databaseName);
}

test.describe("field records written without a connection", () => {
  test("are kept on the device and survive reopening the app offline", async ({ page, context }) => {
    await page.goto("/supervisie", { waitUntil: "networkidle" });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 25_000 });
    await page.waitForTimeout(1000);

    // The app opens its storage at start-up, so the upgrade never lands in the middle of
    // saving a record. Version 3 is the one that added "records".
    const stores = await openStores(page);
    expect(stores).toContain("records");
    expect(stores).toContain("uploads");
    expect(stores).toContain("files");

    await context.setOffline(true);

    await putRecord(page, {
      id: "pending:e2e-1",
      projectId: "e2e-project",
      kind: "finding",
      input: { title: "Scheur kolom B2" },
      preview: {
        title: "Scheur kolom B2",
        description: "",
        buildingId: null,
        locationNodeId: null,
        severity: "high",
        priority: "normal",
        dueAt: null,
        recordType: "deficiency",
      },
      createdAt: "2026-08-02T12:00:00.000Z",
      lastError: null,
    });

    // Reopening the installed app, still offline, must not lose it.
    const reopened = await context.newPage();
    await reopened.goto("/supervisie", { waitUntil: "domcontentloaded" });
    await reopened.waitForTimeout(1500);
    const kept = await readRecords(reopened) as StoredRecord[];
    expect(kept).toHaveLength(1);
    expect(kept[0].preview.title).toBe("Scheur kolom B2");
    expect(kept[0].id.startsWith("pending:")).toBe(true);

    await context.setOffline(false);
  });
});
