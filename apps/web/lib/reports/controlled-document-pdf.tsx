/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { ControlledDocumentType } from "@/lib/forms/controlled-project-documents";
import type { RegisterEntry } from "@/lib/supabase/operations";
import { controlledDocumentSignatures, recipientCaptureNote } from "@/lib/reports/controlled-document-signatures.mjs";

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

const optionKey = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

function Options({ values, selected = "" }: { values: string[]; selected?: string }) {
  const chosen = optionKey(selected);
  return <View style={styles.checks}>{values.map((item) => <Text style={styles.check} key={item}>[{chosen && optionKey(item) === chosen ? "X" : " "}] {item}</Text>)}</View>;
}

function humanizeToken(result: string) {
  return result
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function typeSpecificDetails(type: ControlledDocumentType, details: Details, entry: RegisterEntry) {
  if (type === "inspection_request") {
    return <>
      <View style={styles.grid}><Cell label="Inspection category" value={text(details, "inspection_category")} right /><Cell label="Work ready" value={`${text(details, "ready_date")} ${text(details, "ready_time", "")}`} /></View>
      <Section title="INSPECTION DECISION"><Options values={["A Approved", "B Approved with comments / proceed", "C Correct and resubmit / do not proceed", "D Rejected"]} /></Section>
    </>;
  }
  if (type === "technical_instruction") {
    return <>
      <View style={styles.grid}><Cell label="Discipline / priority" value={`${text(details, "discipline")} / ${text(details, "priority")}`} right /><Cell label="Related RFI / NCR / drawing" value={text(details, "related_reference")} /></View>
      {/* The reason is derived from the instruction when nobody wrote a separate one; do not print it twice. */}
      {text(details, "reason").trim() !== text(details, "description").trim() ? <Section title="REASON FOR INSTRUCTION"><Text style={styles.sectionText}>{text(details, "reason")}</Text></Section> : null}
      <Section title="REQUIRED ACTION"><Options values={["Proceed", "Stop work", "Revise", "Submit revised document", "Carry out inspection", "Other"]} /></Section>
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
        <Options values={["Yes", "No"]} selected={affectsSchedule ? "Yes" : "No"} />
        {affectsSchedule ? (
          <View style={styles.grid}><Cell label="Original finish date (baseline)" value={text(details, "original_finish_date")} right /><Cell label="New expected finish date · extension" value={`${text(details, "new_expected_finish_date")} · ${text(details, "extension_days", "0")} days`} /></View>
        ) : null}
        {text(details, "impact_explanation") !== "—" ? <Text style={styles.sectionText}>{text(details, "impact_explanation")}</Text> : null}
      </Section>
      <Section title="COST IMPACT">
        <Options values={["None", "Possible", "Confirmed", "To be assessed"]} selected={humanizeToken(text(details, "cost_impact", "none")).replace("Unknown", "To be assessed")} />
        {text(details, "cost_impact_explanation") !== "—" ? <Text style={styles.sectionText}>{text(details, "cost_impact_explanation")}</Text> : null}
      </Section>
      {/* Section 5 and 6 of the client's form: the contractor acknowledges, supervision
          approves. The developer and contractor-acceptance columns are struck off. */}
      <Section title="ACKNOWLEDGEMENT · CONTRACTOR">
        {(() => {
          const { contractor } = controlledDocumentSignatures(entry);
          return <>
            <Text style={styles.sectionText}>{[contractor.name, contractor.position].filter(Boolean).join(" · ") || "Not acknowledged yet."}</Text>
            {contractor.remarks ? <Text style={styles.sectionText}>{contractor.remarks}</Text> : null}
            {contractor.ink ? <Image src={contractor.ink} style={styles.signatureInk} /> : null}
            {contractor.signedAt ? <Text style={styles.sectionText}>Signed {contractor.signedAt}</Text> : null}
          </>;
        })()}
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
  const signatures = controlledDocumentSignatures(entry);
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
        {typeSpecificDetails(type, details, entry)}
        <View style={styles.grid}><Cell label="Reference documents" value={text(details, "reference_documents")} right /><Cell label="Attachments / pages" value={text(details, "attachments")} /></View>

        {/* Issuer and recipient sign separately. The issuer's signature comes from the record, the
            recipient's from the formal response, with the moment the server recorded in Suriname time. */}
        {(() => {
          const { issuer, recipient } = signatures;
          const external = ["wcr", "rfi", "rfa", "inspection_request"].includes(type);
          const recipientRows = [
            { label: "Name", result: recipient.name || " ", ink: recipient.ink },
            { label: "Position / company", result: [recipient.position, recipient.company].filter(Boolean).join(" · ") || " ", ink: null },
            { label: recipient.signed ? "Signed" : "Responded", result: [recipient.signedAt, recipientCaptureNote(recipient)].filter(Boolean).join(" · ") || " ", ink: null },
          ];
          return <>
            <Text style={styles.sectionTitle}>{external ? "SUBMITTED AND SIGNED BY" : type === "change_order" ? "ISSUED AND APPROVED BY · SUPERVISION" : "ISSUED AND SIGNED BY"}</Text>
            <View style={styles.signatureGrid}>
              {[
                { label: "Name", result: issuer.name || " ", ink: issuer.ink },
                { label: "Position / company", result: [issuer.position, issuer.company].filter(Boolean).join(" · ") || " ", ink: null },
                { label: "Date signed", result: issuer.signed ? issuer.signedAt || " " : "Not signed yet", ink: null },
              ].map((line, index) => <View style={[styles.signature, index < 2 ? styles.borderRight : {}]} key={line.label}><Text style={styles.label}>{line.label}</Text>{line.ink ? <Image src={line.ink} style={styles.signatureInk} /> : <View style={styles.signatureLine} />}<Text>{line.result}</Text></View>)}
            </View>

            {type === "change_order" && !recipient.decision ? null : <View style={styles.response} wrap={false}>
              <Text style={styles.responseHeader}>{type === "technical_instruction" || type === "change_order" ? "RECIPIENT ACKNOWLEDGEMENT / CLOSEOUT" : "ENGINEER / CLIENT RESPONSE"}</Text>
              <View style={styles.section}>
                <Text style={styles.label}>Decision / status</Text>
                <Text style={styles.sectionText}>{humanizeToken(recipient.decision || "Pending formal response")}</Text>
                <Text style={[styles.label, { marginTop: 6 }]}>Comments / remarks</Text>
                <Text style={styles.sectionText}>{recipient.comments || "No response recorded yet."}</Text>
              </View>
              <View style={styles.signatureGrid}>
                {recipientRows.map((line, index) => <View style={[styles.signature, index < 2 ? styles.borderRight : {}]} key={line.label}><Text style={styles.label}>{line.label}</Text>{line.ink ? <Image src={line.ink} style={styles.signatureInk} /> : <View style={styles.signatureLine} />}<Text>{line.result}</Text></View>)}
              </View>
            </View>}
          </>;
        })()}
        <Text style={styles.notice}>Generated from the controlled project register. Number, revision, signatures and the recorded response come from the audit trail; times are Suriname time.</Text>
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
