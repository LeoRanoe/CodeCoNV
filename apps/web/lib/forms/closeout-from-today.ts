import type { DailyCloseoutAnswers } from "../forms/daily-report.ts";

/**
 * What the other workspace modules recorded today. The day log reads these for its quality
 * and safety blocks instead of asking for them a second time.
 */
export type DayLogToday = {
  inspections: Array<{ id: string; code: string; title: string; status: string }>;
  findings: Array<{ id: string; code: string; title: string; type: "issue" | "ncr" }>;
  hse: Array<{ id: string; code: string; title: string; eventType: string }>;
};

/** The quality and safety lines of the day report, taken from the records of today. */
export function closeoutFromToday(today: DayLogToday) {
  const qualityLines = [
    ...today.inspections.map((inspection) => `${inspection.code} ${inspection.title}`.trim()),
    ...today.findings.map((finding) => `${finding.code} ${finding.title}`.trim()),
  ];
  const hseLines = today.hse.map((event) => `${event.code} ${event.title}`.trim());
  // The result of the day's inspections says something only when there were inspections: a
  // finding raised without one (a photo, a walk-round) is a quality issue, not an inspection result.
  const inspectionResult: DailyCloseoutAnswers["inspectionResult"] = !today.inspections.length
    ? "none"
    : today.findings.length ? "issues" : "all_ok";
  const hseEvent: DailyCloseoutAnswers["hseEvent"] = today.hse.some((event) => event.eventType === "incident")
    ? "incident"
    : today.hse.some((event) => event.eventType === "near_miss") ? "near_miss" : "none";
  return {
    inspectionResult,
    qualityIssues: (today.findings.length ? "yes" : "no") as DailyCloseoutAnswers["qualityIssues"],
    qualityDetails: qualityLines.join("; ").slice(0, 1000),
    hseEvent,
    hseDetails: hseLines.join("; ").slice(0, 1000),
  };
}


/**
 * Whether a record belongs to the building a day log is written for. A record can be filed
 * under several buildings; "all buildings" takes every record. Without this filter every
 * building's day log listed the findings and HSE reports of the whole project.
 */
export function recordInBuilding(
  record: { building_ids?: string[]; building_id?: string | null },
  buildingId: string,
  allBuildings: string,
) {
  if (buildingId === allBuildings) return true;
  return record.building_ids?.length ? record.building_ids.includes(buildingId) : record.building_id === buildingId;
}
