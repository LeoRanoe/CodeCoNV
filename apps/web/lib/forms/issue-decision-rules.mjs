/** What the Verify / Return dialog of an Issue card needs before it can be confirmed (Word 3.1). */
export const issueDecisionMinimum = { verify: 3, return: 5 };

export function issueDecisionReady(decision) {
  const note = String(decision.note ?? "").trim();
  if (note.length < issueDecisionMinimum[decision.action]) return false;
  return decision.action === "verify" || String(decision.nextActor ?? "").trim().length >= 2;
}

/** The sign-off log starts with a submission or an acknowledgement; an issue that never had one has no log to extend. */
export const noSignoffLogYet = (message) => /first sign-off action/i.test(String(message));
