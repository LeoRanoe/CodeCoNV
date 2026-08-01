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
import type { ControlledDocumentType } from "@/lib/forms/controlled-project-documents";
import type { RegisterEntry } from "@/lib/supabase/operations";

type Details = Record<string, unknown>;

const documentTitles: Record<ControlledDocumentType, string> = {
  wcr: "WORK COMPLETION REQUEST",
  rfi: "REQUEST FOR INFORMATION",
  rfa: "REQUEST FOR APPROVAL",
  inspection_request: "WORK INSPECTION REQUEST",
  technical_instruction: "TECHNICAL INSTRUCTION",
  change_order: "CHANGE ORDER",
  environmental_report: "ENVIRONMENTAL REPORT",
};

function text(details: Details, key: string, fallback = "—") {
  const result = details[key];
  return result === null || result === undefined || result === "" ? fallback : String(result);
}

function humanizeToken(result: string) {
  return result.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function options(values: string[]): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: values.map((item) => `[ ] ${item}`).join("   "), size: 16 })], spacing: { before: 80, after: 80 } });
}

function typeSpecificDetails(type: ControlledDocumentType, details: Details): Paragraph[] {
  if (type === "inspection_request") {
    return [
      labelValue("Inspection category", text(details, "inspection_category")),
      labelValue("Work ready", `${text(details, "ready_date")} ${text(details, "ready_time", "")}`),
      sectionHeading("Inspection decision"),
      options(["A Approved", "B Approved with comments / proceed", "C Correct and resubmit / do not proceed", "D Rejected"]),
    ];
  }
  if (type === "technical_instruction") {
    return [
      labelValue("Discipline / priority", `${text(details, "discipline")} / ${text(details, "priority")}`),
      labelValue("Related RFI / NCR / drawing", text(details, "related_reference")),
      sectionHeading("Reason for instruction"),
      bodyText(text(details, "reason")),
      sectionHeading("Required action"),
      bodyText(text(details, "required_action")),
      options(["Proceed", "Stop work", "Revise", "Submit revised document", "Carry out inspection", "Other"]),
    ];
  }
  if (type === "change_order") {
    return [
      labelValue("Schedule impact", text(details, "schedule_impact")),
      labelValue("Cost impact", text(details, "cost_impact")),
      sectionHeading("Impact explanation"),
      bodyText(text(details, "impact_explanation")),
    ];
  }
  if (type === "environmental_report") {
    return [
      labelValue("Reporting period", `${text(details, "period_start")} – ${text(details, "period_end")}`),
      labelValue("Lost hours", `${text(details, "lost_hours", "0")} · ${text(details, "lost_hours_reason", "")}`),
      sectionHeading("Environmental / housekeeping observations"),
      bodyText(text(details, "description")),
    ];
  }
  if (type === "rfa") {
    return [
      sectionHeading("Approval codes"),
      options(["Approved", "Conditionally approved", "Rejected", "Clarification needed", "Approved with comments"]),
    ];
  }
  return [];
}

export function buildControlledDocumentDocx(entry: RegisterEntry, logoBytes: ArrayBuffer): Document {
  const type = entry.register_type as ControlledDocumentType;
  const details = entry.details ?? {};
  const response = details.response && typeof details.response === "object" && !Array.isArray(details.response)
    ? details.response as Details
    : {};

  return new Document({
    title: `${entry.entry_number} ${entry.title}`,
    creator: "CODECO N.V.",
    sections: [
      {
        footers: { default: documentFooter("CODECO N.V. · Controlled project document") },
        children: [
          ...brandHeader(logoBytes, documentTitles[type] ?? "CONTROLLED DOCUMENT", `${entry.entry_number} · Revision ${text(details, "revision", "0")}`),
          metadataTable([
            ["Project name", text(details, "project_name")],
            ["Project number", text(details, "project_number")],
            ["Building / location", text(details, "building_name")],
            ["Issue date / due date", `${text(details, "issue_date")} / ${text(details, "due_date")}`],
            ["Issued by", `${text(details, "issued_by")} · ${text(details, "issuer_position")}`],
            ["Requested to / involved party", text(details, "requested_to")],
          ], 2),
          sectionHeading("Subject"),
          bodyText(entry.title),
          ...(type !== "environmental_report" ? [
            sectionHeading(type === "technical_instruction" ? "Instruction" : type === "change_order" ? "Change description" : "Request / description"),
            bodyText(text(details, "description")),
          ] : []),
          ...typeSpecificDetails(type, details),
          labelValue("Reference documents", text(details, "reference_documents")),
          labelValue("Attachments / pages", text(details, "attachments")),
          // The author signs in the app; the document that leaves the app has to show it.
          sectionHeading(["wcr", "rfi", "rfa", "inspection_request"].includes(type) ? "Submitted and signed by" : "Issued and signed by"),
          signatureBlock([
            ["Name", text(details, "signed_by", text(details, "issued_by"))],
            ["Position / company", [text(details, "signed_by_position", text(details, "issuer_position")), text(details, "issuer_company")].filter((item) => item !== "—" && item !== "").join(" · ")],
            ["Date signed", text(details, "signed_at") === "—" ? "Not signed yet" : String(text(details, "signed_at")).slice(0, 10)],
          ]),
          sectionHeading(type === "technical_instruction" || type === "change_order" ? "Contractor acknowledgement / closeout" : "Engineer / client response"),
          labelValue("Decision / status", humanizeToken(text(response, "decision", "Pending formal response"))),
          bodyText(text(response, "comments", "No response recorded yet.")),
          signatureBlock([
            ["Name", text(response, "respondent_name", "")],
            ["Position / company", [text(response, "respondent_position", ""), text(response, "respondent_company", "")].filter((item) => item !== "—").join(" · ")],
            ["Date / signature", text(response, "response_date", "")],
          ]),
          new Paragraph({
            children: [new TextRun({ text: "This document is generated from the controlled project register. Number, revision, project metadata, the author's signature and the recorded response come from the central audit trail. A signature line stays blank until that human signatory confirms the document.", italics: true, color: "666666", size: 14 })],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });
}

export async function downloadControlledDocumentDocx(entry: RegisterEntry): Promise<void> {
  const logoBytes = await loadLogoImageBytes();
  const doc = buildControlledDocumentDocx(entry, logoBytes);
  const filename = `${entry.entry_number}-${entry.title}`.replace(/[^a-z0-9._-]+/gi, "-") + ".docx";
  await downloadDocxBlob(doc, filename);
}
