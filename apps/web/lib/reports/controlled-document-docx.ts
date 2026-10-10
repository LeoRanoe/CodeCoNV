import { Document, Paragraph, type Table, TextRun } from "docx";
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
import { controlledDocumentSignatures, recipientCaptureNote } from "@/lib/reports/controlled-document-signatures.mjs";
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

const optionKey = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

function options(values: string[], selected = ""): Paragraph {
  const chosen = optionKey(selected);
  return new Paragraph({ children: [new TextRun({ text: values.map((item) => `[${chosen && optionKey(item) === chosen ? "X" : " "}] ${item}`).join("   "), size: 16 })], spacing: { before: 80, after: 80 } });
}

function typeSpecificDetails(type: ControlledDocumentType, details: Details, entry: RegisterEntry): Array<Paragraph | Table> {
  const signatures = controlledDocumentSignatures(entry);
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
      ...(text(details, "reason").trim() !== text(details, "description").trim() ? [sectionHeading("Reason for instruction"), bodyText(text(details, "reason"))] : []),
      sectionHeading("Required action"),
      options(["Proceed", "Stop work", "Revise", "Submit revised document", "Carry out inspection", "Other"], text(details, "required_action", "")),
    ];
  }
  if (type === "change_order") {
    // The client's own CO form: what changes, why, and what it does to the finish date.
    const scopeAreas = Array.isArray(details.scope_areas)
      ? (details.scope_areas as unknown[]).map((area) => String(area).replaceAll("_", " ")).join(", ")
      : "";
    const affectsSchedule = details.affects_schedule === true;
    return [
      labelValue("Change order type", text(details, "change_order_type").replaceAll("_", " ")),
      labelValue("Reason for change", text(details, "change_reason").replaceAll("_", " ")),
      labelValue("Requested by", text(details, "requested_by")),
      labelValue("Scope of change", scopeAreas || "—"),
      sectionHeading("Details / what will change"),
      bodyText(text(details, "scope_details", text(details, "description"))),
      sectionHeading("Schedule impact"),
      labelValue("Affects the schedule", affectsSchedule ? "Yes" : "No"),
      ...(affectsSchedule ? [
        labelValue("Original finish date (baseline)", text(details, "original_finish_date")),
        labelValue("New expected finish date (revised)", text(details, "new_expected_finish_date")),
        labelValue("Extension of time (days)", text(details, "extension_days", "0")),
      ] : []),
      ...(text(details, "impact_explanation") === "—" ? [] : [bodyText(text(details, "impact_explanation"))]),
      // Section 5 and 6: the contractor acknowledges, supervision approves. The developer
      // and contractor-acceptance columns are struck off the client's own form.
      sectionHeading("Acknowledgement · contractor"),
      signatureBlock([
        ["Contractor representative", signatures.contractor.name, signatures.contractor.ink],
        ["Position", signatures.contractor.position],
        ["Signed", signatures.contractor.signedAt || "Not acknowledged yet"],
      ]),
      ...(signatures.contractor.remarks ? [bodyText(signatures.contractor.remarks)] : []),
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
  const signatures = controlledDocumentSignatures(entry);

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
          ...typeSpecificDetails(type, details, entry),
          labelValue("Reference documents", text(details, "reference_documents")),
          labelValue("Attachments / pages", text(details, "attachments")),
          // Issuer and recipient sign separately; both come from the record, in Suriname time.
          sectionHeading(["wcr", "rfi", "rfa", "inspection_request"].includes(type) ? "Submitted and signed by" : type === "change_order" ? "Issued and approved by · supervision" : "Issued and signed by"),
          signatureBlock([
            ["Name", signatures.issuer.name, signatures.issuer.ink],
            ["Position / company", [signatures.issuer.position, signatures.issuer.company].filter(Boolean).join(" · ")],
            ["Date signed", signatures.issuer.signed ? signatures.issuer.signedAt : "Not signed yet"],
          ]),
          ...(type === "change_order" && !signatures.recipient.decision ? [] : [
            sectionHeading(type === "technical_instruction" || type === "change_order" ? "Recipient acknowledgement / closeout" : "Engineer / client response"),
            labelValue("Decision / status", humanizeToken(signatures.recipient.decision || "Pending formal response")),
            bodyText(signatures.recipient.comments || "No response recorded yet."),
            signatureBlock([
              ["Name", signatures.recipient.name, signatures.recipient.ink],
              ["Position / company", [signatures.recipient.position, signatures.recipient.company].filter(Boolean).join(" · ")],
              [signatures.recipient.signed ? "Signed" : "Responded", [signatures.recipient.signedAt, recipientCaptureNote(signatures.recipient)].filter(Boolean).join(" · ")],
            ]),
          ]),
          new Paragraph({
            children: [new TextRun({ text: "Generated from the controlled project register. Number, revision, signatures and the recorded response come from the audit trail; times are Suriname time.", italics: true, color: "666666", size: 14 })],
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
