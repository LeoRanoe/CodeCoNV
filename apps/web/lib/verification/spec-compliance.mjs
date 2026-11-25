/**
 * Word 10.1 "Spec compliance check": the rules around the comparison table, kept free of the screen so they can be tested.
 */

export const complianceRowResults = ["complies", "does_not_comply", "not_stated", "not_applicable"];

/**
 * The overall result follows from the rows: any failure fails the check; a requirement that is not stated,
 * or a comment on the check, makes it "complies with comments". The database computes the same value.
 */
export function complianceVerdict(rows, comments = "") {
  const results = (rows ?? []).map((row) => row.result);
  if (results.includes("does_not_comply")) return "does_not_comply";
  if (results.includes("not_stated") || String(comments ?? "").trim()) return "complies_with_comments";
  return "complies";
}

/**
 * "If the bestek or the submittal gets a new revision, earlier checks are flagged 'based on superseded revision'."
 * `isSuperseded(fileId)` says whether the stored document has been replaced since.
 */
export function flagSupersededChecks(checks, isSuperseded) {
  return (checks ?? []).map((check) => ({
    check,
    superseded: Boolean((check.subject_file_id && isSuperseded(check.subject_file_id)) || (check.requirement_file_id && isSuperseded(check.requirement_file_id))),
  }));
}

/** A Materials Delivery may only be "Accepted" when its compliance check, where one is required, complies. */
export function deliveryMayBeAccepted(checks, deliveryRecordId, required) {
  if (!required) return true;
  const own = (checks ?? []).filter((check) => check.subject_record_id === deliveryRecordId);
  if (!own.length) return false;
  const latest = own.reduce((best, check) => (String(check.signed_at) > String(best.signed_at) ? check : best));
  return latest.overall_result === "complies" || latest.overall_result === "complies_with_comments";
}
