import { Document, Paragraph, TextRun } from "docx";
import {
  bodyText,
  brandHeader,
  documentFooter,
  downloadDocxBlob,
  labelValue,
  loadLogoImageBytes,
  metadataTable,
  sectionHeading,
  signatureBlock,
} from "@/lib/reports/docx-shared";
import type { Finding, FindingProgressUpdate } from "@/lib/supabase/operations";

export type NcrContext = {
  projectName: string;
  projectCode: string;
  buildingName: string;
  /** The person who drew the report up, taken from the record itself. */
  issuerName: string;
  /** The signature that person wrote on the form, placed on the signature line. */
  signatureImage?: string | null;
  responsiblePartyName: string;
  /** Who actually verified the close-out. Never the person downloading the file. */
  verifierName?: string;
};

function value(result: string | null | undefined, fallback = "—") {
  return result && result.trim() ? result : fallback;
}

const recommendedActionLabels: Record<string, string> = {
  rework: "Rework",
  repair: "Repair",
  alternative: "Alternative solution for approval",
};

export function buildNcrDocxDocument(finding: Finding, progress: FindingProgressUpdate | undefined, context: NcrContext, logoBytes: ArrayBuffer): Document {
  const issue = finding.issue_management ?? {};
  const resolved = finding.status === "closed";

  return new Document({
    title: `${finding.finding_number} ${finding.title}`,
    creator: "CODECO N.V.",
    sections: [
      {
        footers: { default: documentFooter("CODECO N.V. · Non-conformance report") },
        children: [
          ...brandHeader(logoBytes, "Non-conformance report", finding.finding_number),
          metadataTable([
            ["Project name and number", `${context.projectCode} · ${context.projectName}`],
            ["Building / location", context.buildingName],
            ["Contractor / responsible party", context.responsiblePartyName],
            ["Date / due date", `${finding.created_at.slice(0, 10)} / ${finding.due_at?.slice(0, 10) ?? "—"}`],
            ["Drawn up by", issue.issued_by || context.issuerName],
            ["Subject", finding.title],
            ["Reference checklist", value(issue.reference_checklist)],
            // The two lists at the head of the client's own form; "Source" is struck off.
            ["Category", value(issue.ncr_category)],
            ["Type of work", value(issue.ncr_work_type)],
            ["Severity / issue type", `${finding.severity} / ${issue.issue_type ?? finding.finding_type}`],
            ["Remarks", value(issue.remarks)],
          ], 2),
          sectionHeading("Description of non-conformance"),
          bodyText(finding.description),
          sectionHeading("Engineer's recommended action"),
          labelValue("Recommended", recommendedActionLabels[issue.recommended_action ?? ""] ?? "—"),
          bodyText(value(issue.recommended_action_detail || issue.action_steps, "Rework / repair in accordance with the approved drawings and specifications.")),
          sectionHeading("Proposed corrective action by contractor"),
          bodyText(value(finding.proposed_correction, "Pending contractor proposal and acknowledgement.")),
          ...(issue.correction_signed_by ? [labelValue("Signed by contractor", `${issue.correction_signed_by} · ${String(issue.correction_signed_at ?? "").slice(0, 10)}`)] : []),
          ...(finding.final_measure ? [labelValue("Completed corrective action", finding.final_measure)] : []),
          sectionHeading("Quality control / verification"),
          labelValue("Latest inspection progress", `${progress?.progress_percent ?? 0}%`),
          labelValue("Disposition", (progress?.disposition ?? issue.disposition ?? "to_be_corrected").replaceAll("_", " ")),
          labelValue("Status", finding.status.replaceAll("_", " ")),
          // The date the re-inspection was actually carried out, and what it saw: the
          // sentence that settles a disputed NCR a year later.
          labelValue("Date of QC inspection", value(issue.qc_inspection_date)),
          labelValue("Date verified", value(finding.verified_at?.slice(0, 10))),
          labelValue("Remarks / observations", value(issue.qc_remarks)),
          labelValue("Verification comments", value(issue.verification_comments || finding.final_measure)),
          new Paragraph({ children: [new TextRun({ text: (issue.qc_issue_resolved ?? resolved) ? "Issue resolved" : "Issue not resolved", bold: true, size: 18 })], spacing: { before: 120, after: 160 } }),
          signatureBlock([
            ["Issued by", issue.signed_by || issue.issued_by || context.issuerName, issue.signature_image || context.signatureImage || null],
            ["Received / contractor", issue.correction_signed_by || issue.completion_signed_by || "", issue.correction_signature_image || issue.completion_signature_image || null],
            ["QC verification", resolved ? issue.verification_signed_by || context.verifierName || "" : "", resolved ? issue.verification_signature_image || null : null],
          ]),
          // Name and position under every signature line, as the printed form has them.
          ...[
            ["Issued by", issue.signed_position],
            ["Received / contractor", issue.correction_signed_position],
            ["QC verification", resolved ? issue.verification_signed_position : ""],
          ].flatMap(([label, position]) => position ? [labelValue(`${label} · position`, String(position))] : []),
          new Paragraph({
            children: [new TextRun({ text: "Linked evidence photos remain in the central project record; images are not duplicated into this generated document unless selected as report attachments. Closing remains a separate authorized human verification.", italics: true, color: "666666", size: 14 })],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });
}

export async function downloadNcrDocx(finding: Finding, progress: FindingProgressUpdate | undefined, context: NcrContext): Promise<void> {
  const logoBytes = await loadLogoImageBytes();
  const doc = buildNcrDocxDocument(finding, progress, context, logoBytes);
  const filename = `${finding.finding_number}-${finding.title}`.replace(/[^a-z0-9._-]+/gi, "-") + ".docx";
  await downloadDocxBlob(doc, filename);
}
