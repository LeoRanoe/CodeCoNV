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
  issuerName: string;
  responsiblePartyName: string;
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
            ["Subject", finding.title],
            ["Reference checklist", value(issue.reference_checklist)],
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
          sectionHeading("Quality control verification"),
          labelValue("Latest inspection progress", `${progress?.progress_percent ?? 0}%`),
          labelValue("Disposition", (progress?.disposition ?? issue.disposition ?? "to_be_corrected").replaceAll("_", " ")),
          labelValue("Status", finding.status.replaceAll("_", " ")),
          new Paragraph({ children: [new TextRun({ text: resolved ? "Issue resolved" : "Issue not resolved", bold: true, size: 18 })], spacing: { before: 120, after: 160 } }),
          signatureBlock([
            ["Issued by", issue.signed_by || context.issuerName],
            ["Received / contractor", issue.correction_signed_by || issue.completion_signed_by || ""],
            ["QC verification", resolved ? context.issuerName : ""],
          ]),
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
