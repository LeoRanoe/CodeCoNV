/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
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

const styles = StyleSheet.create({
  page: { backgroundColor: "#ffffff", color: "#111111", fontFamily: "Helvetica", fontSize: 8.2, padding: 22 },
  top: { borderColor: "#222222", borderWidth: 1, flexDirection: "row", marginBottom: 0, minHeight: 55 },
  brand: { alignItems: "center", backgroundColor: "#f6cf31", justifyContent: "center", padding: 5, width: "28%" },
  logoPlate: { alignItems: "center", backgroundColor: "#ffffff", justifyContent: "center", padding: 3, width: "94%" },
  logo: { height: 35, objectFit: "contain", width: 75 },
  documentHeading: { alignItems: "center", flex: 1, justifyContent: "center", padding: 7 },
  title: { fontSize: 13, fontWeight: 700, textAlign: "center" },
  number: { fontSize: 9, fontWeight: 700, marginTop: 4 },
  grid: { borderColor: "#222222", borderLeftWidth: 1, borderRightWidth: 1, flexDirection: "row" },
  cell: { borderBottomColor: "#222222", borderBottomWidth: 1, padding: 5 },
  label: { color: "#4a4a4a", fontSize: 6.2, fontWeight: 700, marginBottom: 2, textTransform: "uppercase" },
  value: { fontSize: 8.2, lineHeight: 1.25 },
  half: { width: "50%" },
  third: { width: "33.333%" },
  twoThirds: { width: "66.667%" },
  borderRight: { borderRightColor: "#222222", borderRightWidth: 1 },
  sectionTitle: { backgroundColor: "#ececec", borderColor: "#222222", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, fontSize: 8.2, fontWeight: 700, padding: 5 },
  section: { borderBottomColor: "#222222", borderBottomWidth: 1, borderLeftColor: "#222222", borderLeftWidth: 1, borderRightColor: "#222222", borderRightWidth: 1, minHeight: 55, padding: 7 },
  sectionText: { fontSize: 8.5, lineHeight: 1.35 },
  checks: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 5 },
  check: { fontSize: 7.5 },
  response: { borderColor: "#222222", borderWidth: 1, marginTop: 10 },
  responseHeader: { backgroundColor: "#f6cf31", borderBottomColor: "#222222", borderBottomWidth: 1, fontSize: 8.5, fontWeight: 700, padding: 5 },
  signatureGrid: { flexDirection: "row" },
  signature: { minHeight: 48, padding: 6, width: "33.333%" },
  signatureLine: { borderBottomColor: "#555555", borderBottomWidth: 1, marginBottom: 4, marginTop: 20 },
  signatureInk: { height: 26, marginBottom: 3, marginTop: 4, objectFit: "contain", width: "88%" },
  notice: { color: "#555555", fontSize: 6.5, lineHeight: 1.3, marginTop: 8 },
  footer: { bottom: 10, color: "#666666", fontSize: 6, left: 22, position: "absolute", right: 22, textAlign: "center" },
});

function text(details: Details, key: string, fallback = "—") {
  const result = details[key];
  return result === null || result === undefined || result === "" ? fallback : String(result);
}

function Cell({ label, value, width = "half", right = false }: {
  label: string;
  value: string;
  width?: "half" | "third" | "twoThirds";
  right?: boolean;
}) {
  return <View style={[styles.cell, styles[width], right ? styles.borderRight : {}]}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <><Text style={styles.sectionTitle}>{title}</Text><View style={styles.section}>{children}</View></>;
}

function Options({ values }: { values: string[] }) {
  return <View style={styles.checks}>{values.map((item) => <Text style={styles.check} key={item}>[ ] {item}</Text>)}</View>;
}

function humanizeToken(result: string) {
  return result
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function typeSpecificDetails(type: ControlledDocumentType, details: Details) {
  if (type === "inspection_request") {
    return <>
      <View style={styles.grid}><Cell label="Inspection category" value={text(details, "inspection_category")} right /><Cell label="Work ready" value={`${text(details, "ready_date")} ${text(details, "ready_time", "")}`} /></View>
      <Section title="INSPECTION DECISION"><Options values={["A Approved", "B Approved with comments / proceed", "C Correct and resubmit / do not proceed", "D Rejected"]} /></Section>
    </>;
  }
  if (type === "technical_instruction") {
    return <>
      <View style={styles.grid}><Cell label="Discipline / priority" value={`${text(details, "discipline")} / ${text(details, "priority")}`} right /><Cell label="Related RFI / NCR / drawing" value={text(details, "related_reference")} /></View>
      <Section title="REASON FOR INSTRUCTION"><Text style={styles.sectionText}>{text(details, "reason")}</Text></Section>
      <Section title="REQUIRED ACTION"><Text style={styles.sectionText}>{text(details, "required_action")}</Text><Options values={["Proceed", "Stop work", "Revise", "Submit revised document", "Carry out inspection", "Other"]} /></Section>
    </>;
  }
  if (type === "change_order") {
    // The client's own CO form: what changes, why, and what it does to the finish date.
    const scopeAreas = Array.isArray(details.scope_areas)
      ? (details.scope_areas as unknown[]).map((area) => humanizeToken(String(area))).join(", ")
      : "";
    const affectsSchedule = details.affects_schedule === true;
    return <>
      <View style={styles.grid}><Cell label="Change order type" value={humanizeToken(text(details, "change_order_type"))} right /><Cell label="Reason for change" value={humanizeToken(text(details, "change_reason"))} /></View>
      <View style={styles.grid}><Cell label="Requested by" value={text(details, "requested_by")} right /><Cell label="Scope of change" value={scopeAreas || "—"} /></View>
      <Section title="DETAILS / WHAT WILL CHANGE"><Text style={styles.sectionText}>{text(details, "scope_details", text(details, "description"))}</Text></Section>
      <Section title="SCHEDULE IMPACT">
        <Options values={affectsSchedule ? ["[X] Yes", "[ ] No"] : ["[ ] Yes", "[X] No"]} />
        {affectsSchedule ? (
          <View style={styles.grid}><Cell label="Original finish date (baseline)" value={text(details, "original_finish_date")} right /><Cell label="New expected finish date · extension" value={`${text(details, "new_expected_finish_date")} · ${text(details, "extension_days", "0")} days`} /></View>
        ) : null}
        {text(details, "impact_explanation") !== "—" ? <Text style={styles.sectionText}>{text(details, "impact_explanation")}</Text> : null}
      </Section>
      {/* Section 5 and 6 of the client's form: the contractor acknowledges, supervision
          approves. The developer and contractor-acceptance columns are struck off. */}
      <Section title="ACKNOWLEDGEMENT · CONTRACTOR">
        <Text style={styles.sectionText}>{[text(details, "contractor_representative"), text(details, "contractor_position")].filter((item) => item !== "—").join(" · ") || "Not acknowledged yet."}</Text>
        {text(details, "contractor_remarks") !== "—" ? <Text style={styles.sectionText}>{text(details, "contractor_remarks")}</Text> : null}
        {text(details, "contractor_signed_at") !== "—" ? <Text style={styles.sectionText}>Signed {String(text(details, "contractor_signed_at")).slice(0, 10)}</Text> : null}
      </Section>
      <Section title="APPROVAL · SUPERVISION">
        <Text style={styles.sectionText}>{text(details, "supervision_signed_by", text(details, "supervision_name")) === "—" ? "Not approved yet." : `${text(details, "supervision_signed_by", text(details, "supervision_name"))}${text(details, "supervision_signed_at") === "—" ? "" : ` · ${String(text(details, "supervision_signed_at")).slice(0, 10)}`}`}</Text>
      </Section>
    </>;
  }
  if (type === "environmental_report") {
    return <>
      <View style={styles.grid}><Cell label="Reporting period" value={`${text(details, "period_start")} – ${text(details, "period_end")}`} right /><Cell label="Lost hours" value={`${text(details, "lost_hours", "0")} · ${text(details, "lost_hours_reason", "")}`} /></View>
      <Section title="ENVIRONMENTAL / HOUSEKEEPING OBSERVATIONS"><Text style={styles.sectionText}>{text(details, "description")}</Text></Section>
    </>;
  }
  if (type === "rfa") {
    return <Section title="APPROVAL CODES"><Options values={["Approved", "Conditionally approved", "Rejected", "Clarification needed", "Approved with comments"]} /></Section>;
  }
  return null;
}

export function ControlledDocument({ entry, logoSource = "/codeco-logo-pdf.png" }: { entry: RegisterEntry; logoSource?: string }) {
  const type = entry.register_type as ControlledDocumentType;
  const details = entry.details ?? {};
  const response = details.response && typeof details.response === "object" && !Array.isArray(details.response)
    ? details.response as Details
    : {};
  return (
    <Document title={`${entry.entry_number} ${entry.title}`} author="CODECO N.V.">
      <Page size="A4" style={styles.page}>
        <View style={styles.top}>
          <View style={styles.brand}><View style={styles.logoPlate}><Image src={logoSource} style={styles.logo} /></View></View>
          <View style={styles.documentHeading}><Text style={styles.title}>{documentTitles[type]}</Text><Text style={styles.number}>{entry.entry_number} · Revision {text(details, "revision", "0")}</Text></View>
        </View>
        <View style={styles.grid}><Cell label="Project name" value={text(details, "project_name")} right /><Cell label="Project number" value={text(details, "project_number")} /></View>
        <View style={styles.grid}><Cell label="Building / location" value={text(details, "building_name")} right /><Cell label="Issue date / due date" value={`${text(details, "issue_date")} / ${text(details, "due_date")}`} /></View>
        <View style={styles.grid}><Cell label="Issued by" value={`${text(details, "issued_by")} · ${text(details, "issuer_position")}`} right /><Cell label="Requested to / involved party" value={text(details, "requested_to")} /></View>
        <Section title="SUBJECT"><Text style={styles.sectionText}>{entry.title}</Text></Section>
        {type !== "environmental_report" ? <Section title={type === "technical_instruction" ? "INSTRUCTION" : type === "change_order" ? "CHANGE DESCRIPTION" : "REQUEST / DESCRIPTION"}><Text style={styles.sectionText}>{text(details, "description")}</Text></Section> : null}
        {typeSpecificDetails(type, details)}
        <View style={styles.grid}><Cell label="Reference documents" value={text(details, "reference_documents")} right /><Cell label="Attachments / pages" value={text(details, "attachments")} /></View>

        {/* The author signs this document in the app; the paper has to say so, otherwise
            signing changes nothing for the party that receives it. */}
        <Text style={styles.sectionTitle}>{["wcr", "rfi", "rfa", "inspection_request"].includes(type) ? "SUBMITTED AND SIGNED BY" : "ISSUED AND SIGNED BY"}</Text>
        <View style={styles.signatureGrid}>
          {[
            // The name line carries the signature that was actually written in the app.
            { label: "Name", result: text(details, "signed_by", text(details, "issued_by")), ink: typeof details.signature_image === "string" ? details.signature_image : null },
            { label: "Position / company", result: [text(details, "signed_by_position", text(details, "issuer_position")), text(details, "issuer_company")].filter((item) => item !== "—" && item !== "").join(" · "), ink: null },
            { label: "Date signed", result: text(details, "signed_at") === "—" ? "Not signed yet" : String(text(details, "signed_at")).slice(0, 10), ink: null },
          ].map((line, index) => <View style={[styles.signature, index < 2 ? styles.borderRight : {}]} key={line.label}><Text style={styles.label}>{line.label}</Text>{line.ink ? <Image src={line.ink} style={styles.signatureInk} /> : <View style={styles.signatureLine} />}<Text>{line.result || " "}</Text></View>)}
        </View>

        <View style={styles.response} wrap={false}>
          <Text style={styles.responseHeader}>{type === "technical_instruction" || type === "change_order" ? "CONTRACTOR ACKNOWLEDGEMENT / CLOSEOUT" : "ENGINEER / CLIENT RESPONSE"}</Text>
          <View style={styles.section}>
            <Text style={styles.label}>Decision / status</Text>
            <Text style={styles.sectionText}>{humanizeToken(text(response, "decision", "Pending formal response"))}</Text>
            <Text style={[styles.label, { marginTop: 6 }]}>Comments / remarks</Text>
            <Text style={styles.sectionText}>{text(response, "comments", "No response recorded yet.")}</Text>
          </View>
          <View style={styles.signatureGrid}>
            {[
              ["Name", text(response, "respondent_name", "")],
              ["Position / company", [text(response, "respondent_position", ""), text(response, "respondent_company", "")].filter((item) => item !== "—").join(" · ")],
              ["Date / signature", text(response, "response_date", "")],
            ].map(([label, result], index) => <View style={[styles.signature, index < 2 ? styles.borderRight : {}]} key={label}><Text style={styles.label}>{label}</Text><View style={styles.signatureLine} /><Text>{result || " "}</Text></View>)}
          </View>
        </View>
        <Text style={styles.notice}>This PDF is generated from the controlled project register. Number, revision, project metadata, the author signature and the recorded response come from the central audit trail. A signature line stays blank until that human signatory confirms the document.</Text>
        <Text style={styles.footer} fixed>CODECO N.V. · Controlled project document</Text>
      </Page>
    </Document>
  );
}

export async function downloadControlledDocumentPdf(entry: RegisterEntry) {
  const blob = await pdf(<ControlledDocument entry={entry} />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${entry.entry_number}-${entry.title}`.replace(/[^a-z0-9._-]+/gi, "-") + ".pdf";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
