/**
 * The rules behind the action centre, without React so they can be tested on their own.
 *
 * The action centre answers one question for a supervisor standing on site: what is expected
 * of me, and what has to happen next with it. Everything here serves that question — which
 * records are still expecting something, whose turn it is, and which single instruction
 * belongs on the row.
 */

/** Statuses that mean the record is finished: nobody is waiting for anything any more. */
export const settledStatuses = ["closed", "verified", "approved", "cancelled", "rejected", "completed"];

/** Priorities and severities that mean it cannot wait for the normal turn. */
export const urgentPriorities = ["high", "critical", "urgent"];

/** The day that counts is the day on site, not the day of a phone in another timezone. */
export const siteTimeZone = "America/Paramaribo";

const dayInMilliseconds = 24 * 60 * 60 * 1000;

function siteDay(value) {
  return Date.parse(`${new Intl.DateTimeFormat("en-CA", { timeZone: siteTimeZone }).format(value)}T00:00:00Z`);
}

/**
 * Whole days between today on site and the deadline: negative is overdue, 0 is today.
 */
export function daysUntilOnSite(dueAt, now = new Date()) {
  return Math.round((siteDay(new Date(dueAt)) - siteDay(now)) / dayInMilliseconds);
}

export function isSettledStatus(status) {
  return settledStatuses.includes(String(status));
}

/** Still expecting something from somebody. */
export function isOpenItem(item) {
  return !isSettledStatus(item.status);
}

export function isOverdueItem(item, now = new Date()) {
  return isOpenItem(item) && Boolean(item.dueAt) && daysUntilOnSite(item.dueAt, now) < 0;
}

/**
 * An escalation in the sense of the product plan: an open record that is either past its
 * deadline, marked urgent, or explicitly flagged for escalation on the client's issue form.
 * On site "late" and "urgent" are the same thing, so they live in one group.
 */
export function isEscalatedItem(item, now = new Date()) {
  if (!isOpenItem(item)) return false;
  return Boolean(item.escalationRequired)
    || urgentPriorities.includes(String(item.priority))
    || isOverdueItem(item, now);
}

/**
 * The single instruction that belongs on a row. It is deliberately one thing: a worklist
 * that shows a status but never says what to do with it is the thing the client could not
 * read. The words themselves stay in the interface, because they have to exist in both
 * languages; this decides which of them applies.
 *
 * Order matters. The most specific expectation wins, so a record that is waiting for
 * verification says so even when it is also late — being late is already visible on the
 * deadline itself.
 */
export function nextStepFor(item) {
  if (!isOpenItem(item)) return "done";
  if (item.status === "draft") return "finish";
  if (item.status === "ready_for_verification") return "verify";
  if (item.status === "in_review" || item.status === "submitted" || item.status === "under_review") return "decide";
  if (!item.ownerUserId && !item.ownerLabel) return "assign";
  if (item.status === "in_progress") return "progress";
  return "start";
}

/**
 * Sort so the row that needs a decision today is the row on top: escalations first, then the
 * closest deadline, then records without a deadline, and finished work last.
 */
export function compareActionItems(left, right, now = new Date()) {
  const openOrder = Number(isOpenItem(right)) - Number(isOpenItem(left));
  if (openOrder) return openOrder;
  const escalationOrder = Number(isEscalatedItem(right, now)) - Number(isEscalatedItem(left, now));
  if (escalationOrder) return escalationOrder;
  if (left.dueAt && right.dueAt) return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  if (left.dueAt) return -1;
  if (right.dueAt) return 1;
  return 0;
}
