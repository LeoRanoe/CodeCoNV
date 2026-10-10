/**
 * What a screen may offer while it does not (yet) know the signed-in user's permissions.
 *
 * Until the database has answered (loading, offline without an earlier answer, the call
 * missing or failing) only reading is offered. Every control that writes stays hidden, so a
 * broken permission service can never show more than the user was granted. The database
 * remains the authority for every write regardless of what a screen shows.
 */
const readCode = /\.(read|readapproved)$/;

export const restrictedPermissions = Object.freeze({
  known: false,
  can: (code) => readCode.test(code),
  canAny: (...codes) => codes.some((code) => readCode.test(code)),
});

export function permissionsFrom(codes) {
  if (!Array.isArray(codes)) return restrictedPermissions;
  const granted = new Set(codes.filter((code) => typeof code === "string"));
  return {
    known: true,
    can: (code) => granted.has(code),
    canAny: (...wanted) => wanted.some((code) => granted.has(code)),
  };
}
