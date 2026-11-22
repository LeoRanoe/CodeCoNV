import test from "node:test";
import assert from "node:assert/strict";
import { inQuietHours, quietHoursFor } from "../lib/notifications/quiet-hours.mjs";

test("pushes wait from 20:00 to 07:00 Paramaribo time by default (decision #12)", () => {
  const window = quietHoursFor(null);
  // Paramaribo is UTC-3.
  assert.equal(inQuietHours(new Date("2026-11-21T22:59:00Z"), window), false); // 19:59
  assert.equal(inQuietHours(new Date("2026-11-21T23:00:00Z"), window), true);  // 20:00
  assert.equal(inQuietHours(new Date("2026-11-22T09:59:00Z"), window), true);  // 06:59
  assert.equal(inQuietHours(new Date("2026-11-22T10:00:00Z"), window), false); // 07:00
  assert.equal(inQuietHours(new Date("2026-11-22T10:15:00Z"), window), false); // the daily job at 07:15
});

test("a project sets its own window or switches it off", () => {
  assert.equal(inQuietHours(new Date("2026-11-21T15:00:00Z"), quietHoursFor({ quiet_hours: { start: 12, end: 13 } })), true);
  assert.equal(inQuietHours(new Date("2026-11-22T02:00:00Z"), quietHoursFor({ quiet_hours: { start: 0, end: 0 } })), false);
  assert.deepEqual(quietHoursFor({ quiet_hours: { start: 99 } }), { start: 20, end: 7, timeZone: "America/Paramaribo" });
});
