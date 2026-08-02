/**
 * The two decisions behind the offline record queue, without React or IndexedDB so they can
 * be tested on their own. Both are the kind of rule that is dangerous when it is subtly
 * wrong: one decides whether a registration is allowed to wait on the device, the other
 * decides whether a row in a list is central yet.
 */

const pendingPrefix = "pending:";

export function isPendingRecordId(id) {
  return typeof id === "string" && id.startsWith(pendingPrefix);
}

export function newPendingRecordId(uuid) {
  return `${pendingPrefix}${uuid}`;
}

/**
 * A failure that means "no connection", not "the database refused this".
 *
 * Only the first kind may be queued. A registration the database rejects — a missing
 * building, a value outside its check constraint, a permission it does not have — has to be
 * corrected by the person who wrote it. Queueing it would retry it forever in the
 * background and tell the supervisor it is safe when it never will be.
 */
export function isConnectionFailure(error, online = true) {
  if (!online) return true;
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return error.name === "TypeError"
    || error.name === "AbortError"
    || message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("network request failed")
    || message.includes("load failed")
    || message.includes("fetch failed");
}
