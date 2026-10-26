"use client";

const databaseName = "codeco-field-v1";
// v2 adds the "files" store: the photos, drawings and documents themselves, so a project
// that was made available offline still shows its evidence without a connection.
// v3 adds "records": field registrations written without a connection, waiting to be sent.
// v4 adds normalized drawing-pin mutations. They are tiny, ordered and safe to replay.
// v5 adds "drafts": half-filled forms and the photos taken in them, so a back press, a reload
// or a phone that drops the tab while the camera is open does not throw the work away.
const databaseVersion = 5;

export type OfflineStore = "uploads" | "snapshots" | "settings" | "files" | "records" | "drawingPins" | "drafts";

/**
 * Work written on this device that exists nowhere else yet. Each item belongs to the person
 * who wrote it: on a shared device another account must neither see it nor send it under its
 * own identity. Files also carry an owner to reject late downloads. The readable project copy is
 * removed whenever the device changes hands (see account-isolation.ts).
 */
export const userOwnedStores: readonly OfflineStore[] = ["uploads", "records", "drawingPins", "drafts"];
const ownedStores = new Set<OfflineStore>([...userOwnedStores, "files"]);

let activeUserId: string | null = null;

/** Set once the signed-in account is known; null after sign-out. */
export function setActiveOfflineUser(userId: string | null) {
  activeUserId = userId;
}

export function activeOfflineUser() {
  return activeUserId;
}

type Owned = { ownerUserId?: string | null };

function visibleToActiveUser(store: OfflineStore, value: unknown) {
  if (!ownedStores.has(store)) return true;
  return Boolean(activeUserId) && (value as Owned | undefined)?.ownerUserId === activeUserId;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline opslag wordt niet ondersteund door deze browser."));
      return;
    }
    const request = indexedDB.open(databaseName, databaseVersion);
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new Error("Offline opslag is geblokkeerd. Sluit andere app-tabbladen en probeer opnieuw."));
    }, 10_000);
    request.onupgradeneeded = () => {
      if (expired) { request.transaction?.abort(); return; }
      const database = request.result;
      if (!database.objectStoreNames.contains("uploads")) database.createObjectStore("uploads", { keyPath: "id" });
      if (!database.objectStoreNames.contains("snapshots")) database.createObjectStore("snapshots", { keyPath: "id" });
      if (!database.objectStoreNames.contains("settings")) database.createObjectStore("settings", { keyPath: "id" });
      if (!database.objectStoreNames.contains("files")) database.createObjectStore("files", { keyPath: "id" });
      if (!database.objectStoreNames.contains("records")) database.createObjectStore("records", { keyPath: "id" });
      if (!database.objectStoreNames.contains("drawingPins")) database.createObjectStore("drawingPins", { keyPath: "id" });
      if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts", { keyPath: "id" });
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (expired) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => { clearTimeout(timer); reject(request.error ?? new Error("Offline opslag kon niet worden geopend.")); };
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
  let stored: unknown = value;
  if (ownedStores.has(store)) {
    const owner = (value as Owned).ownerUserId ?? activeUserId;
    // Unsent work without an author could later be sent by whoever signs in next.
    if (!owner) throw new Error("Offline werk kan alleen worden opgeslagen terwijl u bent aangemeld.");
    stored = { ...(value as object), ownerUserId: owner };
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).put(stored);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline gegevens konden niet worden opgeslagen."));
    transaction.onabort = transaction.onerror;
  }).finally(() => database.close());
}

export async function idbGet<T>(store: OfflineStore, id: string) {
  const database = await openDatabase();
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const request = database.transaction(store, "readonly").objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error("Offline gegevens konden niet worden gelezen."));
  }).finally(() => database.close());
  return visibleToActiveUser(store, value) ? value : undefined;
}

/** Every item in a store, regardless of who wrote it. Only account-isolation may use this. */
export async function idbGetAllUnscoped<T>(store: OfflineStore) {
  const database = await openDatabase();
  const values = await new Promise<T[]>((resolve, reject) => {
    const request = database.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error("Offline gegevens konden niet worden gelezen."));
  }).finally(() => database.close());
  return values;
}

export async function idbGetAll<T>(store: OfflineStore) {
  const values = await idbGetAllUnscoped<T>(store);
  return values.filter((value) => visibleToActiveUser(store, value));
}

/** The keys in a store, without reading the values: a blob store must stay cheap to inspect. */
export async function idbKeys(store: OfflineStore) {
  if (ownedStores.has(store)) {
    return (await idbGetAll<{ id: string }>(store)).map((value) => String(value.id));
  }
  const database = await openDatabase();
  const keys = await new Promise<string[]>((resolve, reject) => {
    const request = database.transaction(store, "readonly").objectStore(store).getAllKeys();
    request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(String));
    request.onerror = () => reject(request.error ?? new Error("Offline gegevens konden niet worden gelezen."));
  }).finally(() => database.close());
  return keys;
}

export async function idbDelete(store: OfflineStore, id: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline gegeven kon niet worden verwijderd."));
    transaction.onabort = transaction.onerror;
  }).finally(() => database.close());
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
    transaction.onabort = transaction.onerror;
  }).finally(() => database.close());
}
