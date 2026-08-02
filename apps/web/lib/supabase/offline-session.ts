"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/supabase/data";

/**
 * The key Supabase itself writes the session under. It is derived from the project
 * reference in the public URL, exactly as the client library does, so reading it back never
 * needs a second copy of the session anywhere.
 */
function sessionStorageKey() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const reference = url.replace(/^https?:\/\//, "").split(".")[0];
  return reference ? `sb-${reference}-auth-token` : "";
}

function parseStoredSession(raw: string): Session | null {
  const json = raw.startsWith("base64-") ? atob(raw.slice("base64-".length)) : raw;
  const parsed = JSON.parse(json) as Partial<Session> & { currentSession?: Session };
  const session = parsed.currentSession ?? (parsed as Session);
  return session?.user && session?.access_token ? session as Session : null;
}

/**
 * The session as it was last written to this device. It is only used when the library
 * cannot answer, which offline is always: `getSession` tries to refresh an expired access
 * token, and a refresh needs the network. Without this an installed app that had been
 * open for over an hour showed the login screen in the field — with all the project data
 * sitting on the device, unreachable.
 *
 * The token in it may well be expired. That is fine and deliberate: every request would
 * fail offline anyway, and Supabase refreshes it by itself the moment the connection
 * returns. It never grants access on its own — the database still checks the token.
 */
export function storedSessionOnThisDevice(): Session | null {
  if (typeof window === "undefined") return null;
  const key = sessionStorageKey();
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? parseStoredSession(raw) : null;
  } catch {
    return null;
  }
}

/**
 * The session for starting the app: from the library when it can be reached, from this
 * device when it cannot.
 */
export async function getSessionWithOfflineFallback(client: SupabaseClient): Promise<Session | null> {
  try {
    const session = await getSession(client);
    return session ?? storedSessionOnThisDevice();
  } catch {
    return storedSessionOnThisDevice();
  }
}
