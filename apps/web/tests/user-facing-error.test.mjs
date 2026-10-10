import assert from "node:assert/strict";
import test from "node:test";
import { userFacingError } from "../lib/user-facing-error.ts";

const nl = (_english, dutch) => dutch;
const en = (english) => english;
const dbError = (message, code) => Object.assign(new Error(message), { code });

test("business rules are explained in the interface language", () => {
  assert.equal(userFacingError(dbError("Project start check is required", "23514"), nl), "De projectstart ontbreekt nog; start eerst de werkdag.");
  assert.equal(userFacingError(dbError("Project start check is required", "23514"), en), "Project start check is required.");
  assert.match(userFacingError(dbError("Invalid finding transition: open -> closed", "23514"), nl), /statuswijziging/);
});

test("database internals never reach the screen", () => {
  for (const [message, code] of [
    ["permission denied for table organization_memberships", "42501"],
    ["new row violates row-level security policy for table \"files\"", "42501"],
    ["duplicate key value violates unique constraint \"files_pkey\"", "23505"],
    ["JWT expired", "PGRST301"],
    ["Failed to fetch", undefined],
    ["null value in column \"weather_condition\" violates not-null constraint", "23502"],
  ]) {
    const shown = userFacingError(dbError(message, code), nl);
    assert.doesNotMatch(shown, /permission denied|violates|duplicate key|JWT|Failed to fetch|null value|_/, `${message} -> ${shown}`);
  }
});

test("a sentence the app wrote itself is kept", () => {
  assert.equal(userFacingError(new Error("De reactie kon niet veilig worden opgeslagen."), nl), "De reactie kon niet veilig worden opgeslagen.");
});
