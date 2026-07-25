"use client";

const databaseName = "codeco-field-v1";
const databaseVersion = 1;

export type OfflineStore = "uploads" | "snapshots" | "settings";

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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline opslag kon niet worden geopend."));
  });
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
