"use client";

import { idbDelete, idbGet, idbPut } from "@/lib/offline/idb";

/**
 * A form that is half filled in when the supervisor presses back, reloads, or the phone drops
 * the tab while the camera is open. It lives on the device, per account, until the form is
 * saved or the supervisor throws it away. Photos are stored as the files themselves, so a
 * picture taken in a form is never only in memory.
 */
export type FormDraft<Value> = {
  id: string;
  value: Value;
  savedAt: string;
};

/** One key per form and per subject: `daily-log:<project>:<date>`, `quick-photo:<project>`. */
export function formDraftKey(form: string, ...scope: string[]) {
  return [form, ...scope].join(":");
}

export async function loadFormDraft<Value>(id: string) {
  try {
    return (await idbGet<FormDraft<Value>>("drafts", id)) ?? null;
  } catch {
    // A browser without device storage still fills the form in; it only loses the safety net.
    return null;
  }
}

export async function saveFormDraft<Value>(id: string, value: Value) {
  try {
    await idbPut<FormDraft<Value>>("drafts", { id, value, savedAt: new Date().toISOString() });
    return true;
  } catch {
    return false;
  }
}

export async function clearFormDraft(id: string) {
  try {
    await idbDelete("drafts", id);
  } catch {
    // Nothing to do: the draft is a convenience, never the record.
  }
}
