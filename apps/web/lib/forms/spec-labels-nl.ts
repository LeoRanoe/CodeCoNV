/**
 * Dutch labels for the workbook's dropdown values. The stored value stays the workbook's English
 * value (reports, filters and older records keep reading it); only the label on screen changes.
 * A value without a Dutch label is shown as the workbook wrote it. An activity completion option
 * is stored as "Heading: item"; its two parts are translated separately.
 */
import { specValueNl } from "./spec-catalogue-nl.ts";

const separator = ": ";

export function specLabel(value: string, language: "en" | "nl") {
  if (language !== "nl") return value;
  const whole = specValueNl[value];
  if (whole) return whole;
  const at = value.indexOf(separator);
  if (at > 0) {
    const head = specValueNl[value.slice(0, at)];
    const item = specValueNl[value.slice(at + separator.length)];
    if (head && item) return `${head}${separator}${item}`;
  }
  return value;
}

/** True when the value, or both parts of a "Heading: item" value, have a Dutch label. */
export function hasSpecLabelNl(value: string) {
  if (specValueNl[value]) return true;
  const at = value.indexOf(separator);
  return at > 0 && Boolean(specValueNl[value.slice(0, at)]) && Boolean(specValueNl[value.slice(at + separator.length)]);
}
