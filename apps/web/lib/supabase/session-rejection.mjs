/**
 * Whether the server answered and refused the session, as opposed to not answering at all.
 *
 * The workspace falls back to the copy on the device when the server cannot be reached, which
 * is what makes the app usable on a site without signal. It used to do the same for *any*
 * error, so an account that had been removed or suspended, or whose session was revoked,
 * kept seeing its cached projects on a device under "Online · Live workspace · synchronized".
 * A refusal ends the session; only silence keeps the offline copy.
 */
const rejectionCodes = [
  "user_not_found",
  "session_not_found",
  "session_expired",
  "bad_jwt",
  "invalid_jwt",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "PGRST301",
  "PGRST303",
];

/** @param {unknown} error */
export function isSessionRejected(error) {
  if (!error || typeof error !== "object") return false;
  const { status, code, name, message } = /** @type {{ status?: unknown, code?: unknown, name?: unknown, message?: unknown }} */ (error);
  if (typeof code === "string" && rejectionCodes.includes(code)) return true;
  if (name === "AuthApiError" && (status === 401 || status === 403)) return true;
  return (status === 401 || status === 403) && /jwt|token|session|sub claim/i.test(String(message ?? ""));
}
