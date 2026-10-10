import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reportDay, reportDelayCause, reportInspection, reportMoment, reportRole, reportVariation, reportWeather, reportWind } from "../lib/reports/report-vocabulary.ts";

test("stored codes are written as Dutch words on a formal document", () => {
  assert.equal(reportWeather("partly_cloudy"), "Licht bewolkt");
  assert.equal(reportWind("moderate"), "matig");
  assert.equal(reportInspection("all_ok"), "Uitgevoerd · alles akkoord");
  assert.equal(reportVariation("none"), "Niet van toepassing");
  assert.equal(reportDelayCause("delivery"), "Levering te laat");
  assert.equal(reportRole("project_manager"), "Projectleider");
});

test("an unknown code is still readable and never shows an underscore", () => {
  assert.equal(reportRole("site_safety_officer"), "site safety officer");
  assert.equal(reportWeather(""), "");
});

test("moments are shown in Suriname time, whatever the device or server time zone", () => {
  // 10:14 UTC is 07:14 in Paramaribo (UTC-3, no daylight saving).
  assert.equal(reportMoment("2026-10-07T10:14:00.000Z"), "7 okt 2026, 07:14 (SRT)");
  // Late evening on site is already the next day in UTC; the report keeps the site's day.
  assert.equal(reportMoment("2026-10-08T01:30:00.000Z"), "7 okt 2026, 22:30 (SRT)");
  assert.equal(reportMoment(null), "");
  assert.equal(reportMoment("not a date"), "not a date");
});

test("the report day is written out and does not shift across time zones", () => {
  assert.equal(reportDay("2026-10-07"), "woensdag 7 oktober 2026");
  assert.equal(reportDay("2026-01-01"), "donderdag 1 januari 2026");
  assert.equal(reportDay(""), "");
});

test("PDF and Word use the shared vocabulary instead of raw codes and UTC slices", async () => {
  for (const file of ["daily-report-pdf.tsx", "daily-report-docx.ts"]) {
    const source = (await readFile(new URL(`../lib/reports/${file}`, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
    assert.ok(/from "@\/lib\/reports\/report-vocabulary"/.test(source), file);
    assert.doesNotMatch(source, /\.slice\(0, 16\)\.replace\("T", " "\)/, `${file} still prints a UTC timestamp`);
    assert.doesNotMatch(source, /role\.replaceAll\("_", " "\)/, `${file} still prints a stored role code`);
    assert.ok(!/Formele immutable|immutable snapshot van/.test(source), `${file} still mixes English into the Dutch document`);
  }
  const pdf = (await readFile(new URL("../lib/reports/daily-report-pdf.tsx", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  assert.ok(!/Pagina \d van/.test(pdf), "page numbers must be counted by the renderer, not typed in");
  assert.ok(/Pagina \$\{pageNumber\} van \$\{totalPages\}/.test(pdf), "the footer counts pages");
});
