import assert from "node:assert/strict";
import test from "node:test";
import { isSessionRejected } from "../lib/supabase/session-rejection.mjs";

test("a server that answers and refuses the session ends it", () => {
  // What GoTrue answers for a token whose user was deleted: HTTP 403, code user_not_found.
  assert.equal(isSessionRejected(Object.assign(new Error("User from sub claim in JWT does not exist"), { name: "AuthApiError", status: 403, code: "user_not_found" })), true);
  assert.equal(isSessionRejected({ name: "AuthApiError", status: 401, message: "invalid claim: missing sub claim" }), true);
  assert.equal(isSessionRejected({ code: "session_not_found", message: "Session from session_id claim in JWT does not exist" }), true);
  assert.equal(isSessionRejected({ code: "PGRST301", message: "JWT expired" }), true);
  assert.equal(isSessionRejected({ status: 401, message: "Invalid token" }), true);
});

test("silence, rules and ordinary failures keep the offline copy", () => {
  assert.equal(isSessionRejected(new TypeError("Failed to fetch")), false);
  assert.equal(isSessionRejected({ message: "Load failed" }), false);
  assert.equal(isSessionRejected({ code: "42501", message: "permission denied for table findings" }), false);
  assert.equal(isSessionRejected({ status: 500, message: "Internal Server Error" }), false);
  assert.equal(isSessionRejected({ status: 403, message: "Forbidden by row-level security" }), false);
  assert.equal(isSessionRejected(null), false);
  assert.equal(isSessionRejected("boom"), false);
});
