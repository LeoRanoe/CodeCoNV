import type { SupabaseClient } from "@supabase/supabase-js";
import { transitionFinding, type Finding } from "@/lib/supabase/operations";
import { recordSignoffAction } from "@/lib/forms/signoff";
import { issueDecisionReady, noSignoffLogYet } from "./issue-decision-rules.mjs";

/**
 * Developer package v5 (Word 3.1, 10): Verify and Return on an Issue card are decisions of the Close / Verify / Approve
 * dialog. They are written to the sign-off log with the closure note or the reason, the actor and the time, and they
 * move the issue the same way the dialog in Record details does.
 */
export type IssueDecision = { action: "verify" | "return"; note: string; nextActor?: string };

export { issueDecisionMinimum, issueDecisionReady, noSignoffLogYet } from "./issue-decision-rules.mjs";

export async function decideIssue(client: SupabaseClient, projectId: string, finding: Pick<Finding, "id" | "finding_type">, decision: IssueDecision, actorName: string) {
  if (!issueDecisionReady(decision)) throw new Error("Complete the dialog before confirming.");
  const note = decision.note.trim();
  try {
    return await recordSignoffAction(client, {
      projectId,
      recordKind: "finding",
      recordId: finding.id,
      profile: "ISSUE-CLOSEOUT",
      stage: 3,
      action: decision.action,
      actorRole: "Supervision",
      attestation: "account",
      actorName,
      comments: decision.action === "return" ? note : undefined,
      returnReason: decision.action === "return" ? note : undefined,
      nextActor: decision.action === "return" ? decision.nextActor?.trim() : undefined,
      details: decision.action === "verify" ? { closure_note: note } : undefined,
    });
  } catch (error) {
    // An issue closed out before the log existed still has to be closable: the status moves and says so in its note.
    if (!(error instanceof Error) || !noSignoffLogYet(error.message)) throw error;
    return transitionFinding(client, finding.id, decision.action === "verify" ? "closed" : "reopened", note);
  }
}
