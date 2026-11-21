/**
 * F11 report period rule (Word section 11): every register report filters on one named reference
 * date per row, compared as a project-local calendar day (America/Paramaribo), in every state
 * filter. The cut-off is the moment the report was generated; "overdue" is judged at the cut-off.
 * Reports state the reference date, so a reader knows what the period means.
 */
import { projectRecordDay } from "../records/record-directory.mjs";

/** The project-local calendar day of a timestamp or date (YYYY-MM-DD), or "". */
export const projectDay = (value) => projectRecordDay(value);

/** Today's project-local day, and the day `days` before it: the default report period. */
export function defaultPeriod(now = new Date(), days = 30) {
  return { from: projectDay(new Date(now.getTime() - days * 86_400_000).toISOString()), to: projectDay(now.toISOString()) };
}

/** Whether a reference date falls in the period (inclusive, project-local days). An empty date never does. */
export function inPeriod(value, from, to) {
  const day = projectDay(value);
  return Boolean(day) && (!from || day >= from) && (!to || day <= to);
}

/** Actions are reported by due date; an action without one by the day it was raised. */
export const actionReferenceDate = (action) => action.due_at || action.created_at || "";

/** Documents are reported by the day their current revision was received. */
export const documentReferenceDate = (current) => current?.uploaded_at || "";
