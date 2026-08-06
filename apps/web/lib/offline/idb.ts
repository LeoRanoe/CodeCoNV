"use client";

const databaseName = "codeco-field-v1";
// v2 adds the "files" store: the photos, drawings and documents themselves, so a project
// that was made available offline still shows its evidence without a connection.
// v3 adds "records": field registrations written without a connection, waiting to be sent.
// v4 adds normalized drawing-pin mutations. They are tiny, ordered and safe to replay.
const databaseVersion = 4;

export type OfflineStore = "uploads" | "snapshots" | "settings" | "files" | "records" | "drawingPins";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline opslag wordt niet ondersteund door deze browser."));
      return;
    }
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("uploads")) database.createObjectStore("uploads", { keyPath: "id" });
      if (!database.objectStoreNames.contains("snapshots")) database.createObjectStore("snapshots", { keyPath: "id" });
      if (!database.objectStoreNames.contains("settings")) database.createObjectStore("settings", { keyPath: "id" });
      if (!database.objectStoreNames.contains("files")) database.createObjectStore("files", { keyPath: "id" });
      if (!database.objectStoreNames.contains("records")) database.createObjectStore("records", { keyPath: "id" });
      if (!database.objectStoreNames.contains("drawingPins")) database.createObjectStore("drawingPins", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline opslag kon niet worden geopend."));
  });
}

/**
 * Opens the device storage once when the app starts, so the version upgrade happens while
 * nothing is being saved. Discovering an upgrade at the moment a supervisor saves a
 * registration — with another tab possibly blocking it — is the worst possible time.
 */
export async function ensureOfflineDatabase() {
  const database = await openDatabase();
  const stores = Array.from(database.objectStoreNames);
  database.close();
  return stores;
}

export async function idbPut<T>(store: OfflineStore, value: T) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline gegevens konden niet worden opgeslagen."));
  });
  database.close();
}

export async function idbGet<T>(store: OfflineStore, id: string) {
  const database = await openDatabase();
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const request = database.transaction(store, "readonly").objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error("Offline gegevens konden niet worden gelezen."));
  });
  database.close();
  return value;
}

export async function idbGetAll<T>(store: OfflineStore) {
  const database = await openDatabase();
  const values = await new Promise<T[]>((resolve, reject) => {
    const request = database.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error("Offline gegevens konden niet worden gelezen."));
  });
  database.close();
  return values;
}

/** The keys in a store, without reading the values: a blob store must stay cheap to inspect. */
export async function idbKeys(store: OfflineStore) {
  const database = await openDatabase();
  const keys = await new Promise<string[]>((resolve, reject) => {
    const request = database.transaction(store, "readonly").objectStore(store).getAllKeys();
    request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(String));
    request.onerror = () => reject(request.error ?? new Error("Offline gegevens konden niet worden gelezen."));
  });
  database.close();
  return keys;
}

export async function idbDelete(store: OfflineStore, id: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline gegeven kon niet worden verwijderd."));
  });
  database.close();
}

/**
 * Empties a store. Used to throw away the offline copy of a project without touching the
 * field uploads that are still waiting to be synchronized — those are the only records
 * that exist nowhere else.
 */
export async function idbClear(store: OfflineStore) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline gegevens konden niet worden gewist."));
  });
  database.close();
}
