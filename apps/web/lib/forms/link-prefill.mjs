/**
 * Link first, then fill (developer package v5, Excel START HERE and Word chapter 3): choosing the
 * record a form is about (the inspected work, the related inspection, the affected activity) copies what
 * that record already says, so nothing is typed twice. Every copied field stays editable, and a field the
 * person already filled is never replaced.
 */

/** The form fields that link to a record and so start a prefill. */
export const linkFirstFields = ["related_inspection", "related_record", "affected_activity"];

/** What a linked record can give: its discipline, activity and exact location. */
export const linkPrefillKeys = ["discipline", "secondary_discipline", "activity", "exact_location"];

const text = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * The part of a record's specification that is offered to a form that links to it.
 * @returns {Record<string, string> | null}
 */
export function pickLinkSpec(spec) {
  if (!spec || typeof spec !== "object") return null;
  /** @type {Record<string, string>} */
  const picked = {};
  for (const key of linkPrefillKeys) if (text(spec[key])) picked[key] = text(spec[key]);
  return Object.keys(picked).length ? picked : null;
}

/**
 * Works Completed row 3.1: the Works Ongoing records that can still be completed. A record that an earlier
 * Works Completed record is based on is done; the ones for the activity being entered come first.
 * @template {{ id: string, kind: string, linkedRefs?: string[] | null, linkSpec?: Record<string, string> | null }} T
 * @param {T[]} records the directory
 * @returns {T[]}
 * @param {{ activity?: string, keep?: string }} options `keep` is the record the form already points at
 */
export function candidatesNotYetCompleted(records, { activity = "", keep = "" } = {}) {
  const done = new Set(records.flatMap((record) => record.linkedRefs ?? []));
  const open = records.filter((record) => !done.has(`${record.kind}:${record.id}`) || `${record.kind}:${record.id}` === keep);
  const wanted = text(activity).toLowerCase();
  if (!wanted) return open;
  const same = (record) => text(record.linkSpec?.activity).toLowerCase() === wanted;
  return [...open.filter(same), ...open.filter((record) => !same(record))];
}

/**
 * The values to add to a form when `source` (a directory record with `linkSpec`) is linked.
 * `formKeys` are the field keys of the target form, `values` what it holds now.
 */
export function linkPrefillPatch(source, formKeys, values) {
  const given = source?.linkSpec;
  if (!given) return {};
  const keys = new Set(formKeys);
  const patch = {};
  for (const key of linkPrefillKeys) {
    if (!keys.has(key) || !given[key] || text(values?.[key])) continue;
    // An activity belongs to a discipline: it is copied only with, or into, the same discipline.
    if (key === "activity") {
      const discipline = text(values?.discipline) || patch.discipline;
      if (!discipline || (given.discipline && discipline !== given.discipline)) continue;
    }
    patch[key] = given[key];
  }
  return patch;
}
