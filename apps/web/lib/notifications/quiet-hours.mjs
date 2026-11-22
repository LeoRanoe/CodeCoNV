/**
 * Decision #12 (21-11-2026, Word 14 "Reminder frequency, escalation recipients and quiet hours
 * should be configurable by project"): push messages wait during the project's quiet hours, by
 * default 20:00-07:00 in the project's time zone (Word 15: project-local time; Paramaribo). In-app
 * notifications appear at once. A project sets its own window in project_settings.spec_configuration
 * as { "quiet_hours": { "start": 20, "end": 7 } }; equal start and end switch quiet hours off.
 */
export const defaultQuietHours = Object.freeze({ start: 20, end: 7, timeZone: "America/Paramaribo" });

export function quietHoursFor(specConfiguration) {
  const configured = specConfiguration && typeof specConfiguration === "object" ? specConfiguration.quiet_hours : null;
  const hour = (value, fallback) => (Number.isInteger(value) && value >= 0 && value <= 23 ? value : fallback);
  return {
    start: hour(configured?.start, defaultQuietHours.start),
    end: hour(configured?.end, defaultQuietHours.end),
    timeZone: typeof configured?.time_zone === "string" && configured.time_zone ? configured.time_zone : defaultQuietHours.timeZone,
  };
}

/** True when `now` falls inside the window [start, end) in the window's time zone. */
export function inQuietHours(now, window = defaultQuietHours) {
  if (window.start === window.end) return false;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: window.timeZone }).format(now));
  return window.start < window.end ? hour >= window.start && hour < window.end : hour >= window.start || hour < window.end;
}
