import { quantitiesIn } from "../rapid-verify/compare-values.mjs";

/**
 * The Rapid Verify assistant (Word 10.1) is deterministic: it reads the requirement document and the submittal, lists the
 * requirements that state a figure with a unit ("min. 500 MPa", "cover 40 mm"), finds the same parameter in the submittal and
 * proposes the row. It never decides: every proposed row is shown for the supervisor to confirm or change, the result is
 * signed by the supervisor, and the check records that the assistant was used.
 */
const maxRows = 30;
const minimumWords = /(?:at least|not less than|min(?:imum)?\.?|≥|>=|ten minste|minimaal|minimum)/i;
const maximumWords = /(?:at most|not more than|not exceeding|max(?:imum)?\.?|≤|<=|hoogstens|maximaal|niet meer dan)/i;
const noise = new Set(["the", "of", "a", "an", "is", "are", "shall", "be", "to", "for", "and", "or", "with", "de", "het", "een", "van", "voor", "en", "of", "moet", "zijn", "is"]);

/** Units are compared in lower case; the supervisor reads them as written (MPa, not mpa). */
const displayUnit = { mpa: "MPa", kpa: "kPa", gpa: "GPa", kn: "kN", knm: "kNm", c: "°C", m2: "m²", m3: "m³", l: "L" };
const shown = (unit) => displayUnit[unit] ?? unit;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

/** The sentences and list items of the pages, each with its page number. */
export function segmentsOf(pages) {
  // `lines` keeps the line breaks of the page (one requirement per line); `text` is the same words on one line.
  return (pages ?? []).flatMap((page) => String(page.lines ?? page.text).replace(/[•·▪]/g, "\n")
    .split(/(?<=[.;])\s+(?=[A-ZÀ-Ý0-9])|\n+/)
    .map((segment) => ({ page: page.page, text: clean(segment) }))
    .filter((segment) => segment.text.length >= 6));
}

/** A text as its significant words, so "strength of the bars" and "strength bars" are the same parameter. */
const significant = (value) => String(value).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word && !noise.has(word)).join(" ");

/** The words before the first figure of a requirement: the parameter it speaks about. */
export function parameterOf(segment) {
  const match = /\d+(?:[.,]\d+)?\s*[a-z%°²³]/i.exec(segment);
  const head = match ? segment.slice(0, match.index) : segment;
  const words = head.replace(minimumWords, " ").replace(maximumWords, " ").replace(/[:=()]/g, " ").split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((word) => word && !noise.has(word.toLowerCase()));
  return words.slice(-4).join(" ");
}

/** How the figure is limited: a minimum, a maximum, or exactly this. */
export function limitOf(segment) {
  if (minimumWords.test(segment)) return "min";
  if (maximumWords.test(segment)) return "max";
  return "exact";
}

function verdict(limit, required, submitted) {
  if (!submitted.length) return "not_stated";
  const wanted = required[0];
  const found = submitted.find((item) => item.unit === wanted.unit);
  if (!found) return "not_stated";
  if (limit === "min") return found.number >= wanted.number ? "complies" : "does_not_comply";
  if (limit === "max") return found.number <= wanted.number ? "complies" : "does_not_comply";
  return found.number === wanted.number ? "complies" : "does_not_comply";
}

/**
 * @param {Array<{ page: number, text: string }>} requirementPages
 * @param {Array<{ page: number, text: string }>} submittalPages
 * @returns {Array<{ parameter: string, required: string, submitted: string, result: "complies" | "does_not_comply" | "not_stated", comment: string, page: string }>}
 */
export function proposeComplianceRows(requirementPages, submittalPages) {
  const submittal = segmentsOf(submittalPages);
  const seen = new Set();
  const rows = [];
  for (const segment of segmentsOf(requirementPages)) {
    const required = quantitiesIn(segment.text);
    if (!required.length) continue;
    const parameter = parameterOf(segment.text);
    const key = `${parameter.toLowerCase()}|${required[0].number}${required[0].unit}`;
    if (!parameter || seen.has(key)) continue;
    seen.add(key);
    const tail = parameter.toLowerCase().split(" ").slice(-2).join(" ");
    const match = submittal.find((item) => significant(item.text).includes(significant(tail)) && quantitiesIn(item.text).length);
    const found = match ? quantitiesIn(match.text) : [];
    const limit = limitOf(segment.text);
    const figure = `${required[0].number} ${shown(required[0].unit)}`.replace(".", ",");
    rows.push({
      parameter,
      required: `${limit === "min" ? "min. " : limit === "max" ? "max. " : ""}${figure}`,
      submitted: match && found.length ? `${found[0].number} ${shown(found[0].unit)}`.replace(".", ",") : "",
      result: verdict(limit, required, found),
      comment: "",
      page: match ? String(match.page) : "",
    });
    if (rows.length >= maxRows) break;
  }
  return rows;
}
