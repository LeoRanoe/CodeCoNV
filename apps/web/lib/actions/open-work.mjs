/**
 * One reading of "what is still open on this project", shared by every screen that shows a
 * number for it. The action centre lists project actions, findings/NCRs and the registers
 * that carry a deadline as one worklist; the overview and the project card used to count only
 * the actions table, so a project with seven overdue issues read "0 open actions" and
 * "Under control" next to a worklist of seven escalations.
 */
import { compareActionItems, isEscalatedItem, isOpenItem, isOverdueItem, urgentPriorities } from "./action-center.mjs";

/** Register types that are somebody's turn to act even when no deadline was typed in. */
export const worklistRegisterTypes = ["wcr", "rfi", "rfa", "inspection_request", "punch_list"];

/** Whether a register entry belongs on the worklist (same rule as the action centre). */
export function isWorklistRegister(entry) {
  return Boolean(entry.due_at) || worklistRegisterTypes.includes(String(entry.register_type));
}

/**
 * @param {{ id: string, title: string, status: string, priority?: string | null, due_at?: string | null }} action
 */
export function workItemFromAction(action) {
  return {
    id: action.id,
    source: "action",
    title: action.title,
    reference: "",
    status: action.status,
    priority: action.priority ?? "normal",
    dueAt: action.due_at ?? null,
    escalationRequired: false,
  };
}

/**
 * @param {{ id: string, finding_number?: string, title: string, status: string, priority?: string | null, due_at?: string | null, issue_management?: { escalation_required?: boolean } | null }} finding
 */
export function workItemFromFinding(finding) {
  return {
    id: finding.id,
    source: "finding",
    title: finding.title,
    reference: finding.finding_number ?? "",
    status: finding.status,
    priority: finding.priority ?? "normal",
    dueAt: finding.due_at ?? null,
    escalationRequired: Boolean(finding.issue_management?.escalation_required),
  };
}

/**
 * @param {{ id: string, entry_number?: string, title: string, status: string, due_at?: string | null, details?: { priority?: unknown } | null }} entry
 */
export function workItemFromRegister(entry) {
  return {
    id: entry.id,
    source: "register",
    title: entry.title,
    reference: entry.entry_number ?? "",
    status: entry.status,
    priority: String(entry.details?.priority ?? "normal"),
    dueAt: entry.due_at ?? null,
    escalationRequired: false,
  };
}

/**
 * Counts and the rows that matter most, from work items in the shape above.
 * `escalated` is the action centre's own definition: urgent, past its deadline or flagged.
 */
export function summarizeOpenWork(items, now = new Date()) {
  const open = items.filter((item) => isOpenItem(item));
  const escalated = open.filter((item) => isEscalatedItem(item, now));
  const urgent = open.filter((item) => urgentPriorities.includes(String(item.priority)));
  const overdue = open.filter((item) => isOverdueItem(item, now));
  const top = [...(escalated.length ? escalated : open)].sort((left, right) => compareActionItems(left, right, now)).slice(0, 4);
  return { open: open.length, urgent: urgent.length, overdue: overdue.length, escalated: escalated.length, top };
}
