/**
 * One definition of an open issue or NCR for every counter on the screen: not verified and not
 * withdrawn. The workspace tile and the section tab used to disagree because one of them still
 * counted withdrawn records.
 */
const finishedStatuses = new Set(["closed", "cancelled"]);

export function countOpenFindings(findings, type) {
  return (findings ?? []).filter((finding) => (type === "ncr" ? finding.finding_type === "ncr" : finding.finding_type !== "ncr")
    && !finishedStatuses.has(finding.status)).length;
}
