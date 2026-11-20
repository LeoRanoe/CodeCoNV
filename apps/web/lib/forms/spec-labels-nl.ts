/**
 * Dutch labels for the workbook's dropdown values. The stored value stays the workbook's English
 * value (reports, filters and older records keep reading it); only the label on screen changes.
 * A value without a Dutch label is shown as the workbook wrote it.
 */
import { specValueNl } from "./spec-catalogue-nl.ts";

export function specLabel(value: string, language: "en" | "nl") {
  if (language !== "nl") return value;
  return specValueNl[value] ?? value;
}
