// @ts-check

/**
 * What §4.3 of the product plan calls the automation of "aanwezige partijen en mankracht":
 * totals per organisation and per discipline, and a signal when today's manning deviates
 * sharply from what was planned or from the last workday.
 *
 * Kept away from the screen on purpose: a supervisor reads these numbers into a report that
 * a contractor gets held to, so they have to be checkable without opening a browser.
 */

/** The threshold the daily report already uses for a workforce deviation. */
export const workforceDeviationThreshold = 0.2;

/**
 * @typedef {object} WorkforceCountRow
 * @property {string} [partyId]
 * @property {string} [party]
 * @property {string} [discipline]
 * @property {number} [count]
 * @property {string} [entryType]
 */

/**
 * Only the people who are working; a visitor is on site but is not manning the work.
 *
 * @param {WorkforceCountRow[]} rows
 * @returns {WorkforceCountRow[]}
 */
function workforceOnly(rows) {
  return (rows ?? []).filter((row) => (row?.entryType ?? "workforce") === "workforce");
}

/**
 * @param {WorkforceCountRow[]} rows
 */
export function workforceHeadcount(rows) {
  return workforceOnly(rows).reduce((sum, row) => sum + (Number(row?.count) || 0), 0);
}

/**
 * Totals per organisation, largest first. The report says "who did the contractor have on
 * site", and that question is answered per organisation, not per line.
 *
 * @param {WorkforceCountRow[]} rows
 */
export function workforceByParty(rows) {
  return groupTotals(workforceOnly(rows), (row) => ({ key: row.partyId ?? row.party ?? "", label: row.party ?? "" }));
}

/**
 * Totals per discipline across all organisations, largest first. Two contractors both
 * supplying masons is one masonry total in the report.
 *
 * @param {WorkforceCountRow[]} rows
 */
export function workforceByDiscipline(rows) {
  return groupTotals(workforceOnly(rows), (row) => ({ key: row.discipline ?? "", label: row.discipline ?? "" }));
}

/**
 * @param {WorkforceCountRow[]} rows
 * @param {(row: WorkforceCountRow) => { key: string, label: string }} pick
 */
function groupTotals(rows, pick) {
  /** @type {Map<string, { key: string, label: string, count: number }>} */
  const totals = new Map();
  for (const row of rows) {
    const { key, label } = pick(row);
    if (!key) continue;
    const current = totals.get(key);
    if (current) current.count += Number(row?.count) || 0;
    else totals.set(key, { key, label, count: Number(row?.count) || 0 });
  }
  return [...totals.values()]
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

/**
 * The signal §4.3 asks for: is today's manning far off what was planned, or far off the last
 * workday? Both are reported as facts with the number behind them, never as a verdict — a
 * crew that is half the size can be perfectly correct on a day of finishing work.
 *
 * @param {object} input
 * @param {number} input.total
 * @param {number | null} [input.expected] Planned workforce from the project start.
 * @param {number | null} [input.previous] The last workday that had a recorded crew.
 * @returns {Array<{ id: string, kind: "planned" | "previous", direction: "above" | "below", total: number, reference: number, share: number }>}
 */
export function workforceDeviations({ total, expected = null, previous = null }) {
  /** @type {Array<{ id: string, kind: "planned" | "previous", direction: "above" | "below", total: number, reference: number, share: number }>} */
  const signals = [];
  /** @type {Array<[string, "planned" | "previous", number | null]>} */
  const references = [["WF-PLAN", "planned", expected], ["WF-PREV", "previous", previous]];
  for (const [id, kind, reference] of references) {
    if (typeof reference !== "number" || !Number.isFinite(reference) || reference <= 0) continue;
    const share = Math.abs(total - reference) / reference;
    if (share < workforceDeviationThreshold) continue;
    signals.push({
      id: `${id}-01`,
      kind,
      direction: total >= reference ? "above" : "below",
      total,
      reference,
      share: Math.round(share * 100) / 100,
    });
  }
  return signals;
}

/**
 * A deviation has to be explained, which is what the client's own report asks for. This says
 * whether that explanation is still missing, so the screen can ask for it instead of letting
 * a bare number travel into the report.
 *
 * @param {ReturnType<typeof workforceDeviations>} deviations
 * @param {string} note
 */
export function workforceNoteRequired(deviations, note) {
  return deviations.length > 0 && (note ?? "").trim().length < 3;
}
