/**
 * A time of day as "HH:MM" on a 24-hour clock. The native time input follows the browser's
 * clock setting and shows "05:16 PM" next to a site report that reads 17:16, so the forms pick
 * the hour and the minute themselves.
 */
export const hourChoices = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
export const minuteChoices = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

const pattern = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?:\.\d+)?$/;

/** Splits "07:30" (or "07:30:00" from the database) into its hour and minute; "" when it is no time. */
export function splitTime(value) {
  const match = pattern.exec(String(value ?? "").trim());
  return match ? { hour: match[1], minute: match[2] } : { hour: "", minute: "" };
}

/** Joins a chosen hour and minute; a missing minute is 00, a missing hour gives "" (no time). */
export function joinTime(hour, minute) {
  if (!hour) return "";
  return `${hour}:${minute || "00"}`;
}
