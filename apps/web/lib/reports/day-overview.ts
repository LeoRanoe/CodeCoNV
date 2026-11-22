/**
 * The central day report: every record filled in under Workspace on one site day, grouped by
 * the form it was made with. The client asked for one place, under Reports, that shows
 * "everything that happened on the day" — workforce, works, delays, issues, NCRs, HSE,
 * inspections, deliveries, instructions, change orders, lessons, agreements and photos.
 *
 * Pure and self-contained: it sorts records that are already loaded into days, so the screen
 * shows the day instantly, offline included, and a test can check the sorting on its own.
 * A day is a calendar day on site, in Suriname time, never the viewer's own time zone.
 */

import { isOnSiteWorkforce } from "../forms/workforce.mjs";
export const SITE_TIME_ZONE = "America/Paramaribo";

const siteDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The site day (YYYY-MM-DD) a moment falls on; "" for a missing or unreadable moment. */
export function siteDay(value: string | null | undefined): string {
  if (!value) return "";
  // A plain date is already a site day; parsing it as UTC midnight would shift it back a day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return "";
  return siteDayFormat.format(moment);
}

/** Today on site. */
export function todayOnSite(now = new Date()): string {
  return siteDayFormat.format(now);
}

type WithStatus = { id: string; status?: string | null };
type FindingLike = WithStatus & { created_at: string; finding_type: string };
type HseLike = WithStatus & { occurred_at: string };
type RegisterLike = WithStatus & { occurred_at: string; register_type: string };
type WorkLike = { id: string; day_report_id?: string | null; created_at: string; work_ongoing?: string | null; work_performed?: string | null; delay_cause?: string | null; delay_hours?: number | null };
type AttendanceLike = { id: string; day_report_id?: string | null; created_at: string; headcount: number; entry_type?: string | null; spec?: unknown };
type InspectionLike = WithStatus & { completed_at?: string | null; started_at?: string | null; planned_at?: string | null };
type CaptureLike = WithStatus & { captured_at: string };

/** Register types that have their own block; every other type is listed under "other registers". */
export const dayOverviewRegisterTypes = ["delivery", "technical_instruction", "change_order", "lessons_learned", "agreement", "delay_report", "works_ongoing", "works_completed"] as const;

export type DayOverview<F, H, R, W, A, I, V> = {
  day: string;
  workforce: { headcount: number; visitors: number; entries: A[] };
  worksOngoing: W[];
  worksCompleted: W[];
  delays: W[];
  issues: F[];
  ncrs: F[];
  hse: H[];
  inspections: I[];
  /** Registers by type, the six with their own block first. */
  registers: Record<string, R[]>;
  photos: V[];
  /** How many records the day holds, workforce lines and photos included. */
  total: number;
};

const live = (record: WithStatus) => record.status !== "cancelled" && record.status !== "archived";

export function buildDayOverview<
  F extends FindingLike,
  H extends HseLike,
  R extends RegisterLike,
  W extends WorkLike,
  A extends AttendanceLike,
  I extends InspectionLike,
  V extends CaptureLike,
>(day: string, input: {
  dayReports?: Array<{ id: string; report_date: string }>;
  findings?: F[];
  hseEvents?: H[];
  registerEntries?: R[];
  dailyWork?: W[];
  attendance?: A[];
  inspections?: I[];
  visualCaptures?: V[];
}): DayOverview<F, H, R, W, A, I, V> {
  const reportDay = new Map((input.dayReports ?? []).map((report) => [report.id, report.report_date]));
  // Work and attendance belong to the day report they were written in; the moment they were
  // saved only decides when that report is unknown on this device.
  const dayOfReport = (record: { day_report_id?: string | null; created_at: string }) =>
    (record.day_report_id && reportDay.get(record.day_report_id)) || siteDay(record.created_at);
  const byMoment = <T>(moment: (record: T) => string | null | undefined) => (left: T, right: T) =>
    String(moment(left) ?? "").localeCompare(String(moment(right) ?? ""));

  const findings = (input.findings ?? []).filter((record) => live(record) && siteDay(record.created_at) === day).sort(byMoment((record) => record.created_at));
  const work = (input.dailyWork ?? []).filter((record) => dayOfReport(record) === day).sort(byMoment((record) => record.created_at));
  const attendance = (input.attendance ?? []).filter((record) => dayOfReport(record) === day);
  const workers = attendance.filter((record) => isOnSiteWorkforce(record.entry_type, record.spec));
  const registers = (input.registerEntries ?? [])
    .filter((record) => live(record) && record.register_type !== "boq" && siteDay(record.occurred_at) === day)
    .sort(byMoment((record) => record.occurred_at));
  const registerGroups: Record<string, R[]> = {};
  for (const type of dayOverviewRegisterTypes) registerGroups[type] = [];
  for (const record of registers) (registerGroups[record.register_type] ??= []).push(record);
  const inspectionMoment = (record: I) => record.completed_at ?? record.started_at ?? record.planned_at ?? "";

  const overview: DayOverview<F, H, R, W, A, I, V> = {
    day,
    workforce: {
      headcount: workers.reduce((total, record) => total + (Number(record.headcount) || 0), 0),
      visitors: attendance.filter((record) => record.entry_type === "visitor").reduce((total, record) => total + (Number(record.headcount) || 0), 0),
      entries: attendance,
    },
    worksOngoing: work.filter((record) => Boolean(record.work_ongoing?.trim())),
    worksCompleted: work.filter((record) => Boolean(record.work_performed?.trim())),
    delays: work.filter((record) => (record.delay_cause ?? "none") !== "none" && Number(record.delay_hours) > 0),
    issues: findings.filter((record) => record.finding_type !== "ncr"),
    ncrs: findings.filter((record) => record.finding_type === "ncr"),
    hse: (input.hseEvents ?? []).filter((record) => live(record) && siteDay(record.occurred_at) === day).sort(byMoment((record) => record.occurred_at)),
    inspections: (input.inspections ?? []).filter((record) => live(record) && siteDay(inspectionMoment(record)) === day).sort(byMoment(inspectionMoment)),
    registers: registerGroups,
    photos: (input.visualCaptures ?? []).filter((record) => live(record) && siteDay(record.captured_at) === day).sort(byMoment((record) => record.captured_at)),
    total: 0,
  };
  overview.total = attendance.length
    + overview.worksOngoing.length + overview.worksCompleted.length + overview.delays.length
    + findings.length + overview.hse.length + overview.inspections.length
    + registers.length + overview.photos.length;
  return overview;
}

/** The site days that hold at least one record, newest first, for the day picker. */
export function daysWithRecords(input: {
  dayReports?: Array<{ id: string; report_date: string }>;
  findings?: Array<{ created_at: string; status?: string | null }>;
  hseEvents?: Array<{ occurred_at: string; status?: string | null }>;
  registerEntries?: Array<{ occurred_at: string; register_type: string; status?: string | null }>;
  visualCaptures?: Array<{ captured_at: string; status?: string | null }>;
}): string[] {
  const days = new Set<string>();
  for (const report of input.dayReports ?? []) if (report.report_date) days.add(report.report_date);
  for (const record of input.findings ?? []) if (record.status !== "cancelled") days.add(siteDay(record.created_at));
  for (const record of input.hseEvents ?? []) if (record.status !== "cancelled") days.add(siteDay(record.occurred_at));
  for (const record of input.registerEntries ?? []) if (record.status !== "cancelled" && record.register_type !== "boq") days.add(siteDay(record.occurred_at));
  for (const record of input.visualCaptures ?? []) if (record.status !== "archived") days.add(siteDay(record.captured_at));
  days.delete("");
  return [...days].sort((left, right) => right.localeCompare(left));
}
