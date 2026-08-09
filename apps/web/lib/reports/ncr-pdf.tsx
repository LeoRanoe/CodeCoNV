/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { Finding, FindingProgressUpdate } from "@/lib/supabase/operations";

export type NcrContext = {
  projectName: string;
  projectCode: string;
  buildingName: string;
  /** The person who drew the report up, taken from the record itself. */
  issuerName: string;
  /** The signature that person wrote on the form, printed where they signed. */
  signatureImage?: string | null;
  responsiblePartyName: string;
  /** Who actually verified the close-out. Never the person downloading the file. */
  verifierName?: string;
};

const styles = StyleSheet.create({
  page: { color: "#171717", fontFamily: "Helvetica", fontSize: 8.2, padding: 24 },
  header: { borderColor: "#222", borderWidth: 1, flexDirection: "row", minHeight: 58 },
  brand: { alignItems: "center", backgroundColor: "#f6cf31", justifyContent: "center", width: "28%" },
  logoPlate: { alignItems: "center", backgroundColor: "#ffffff", justifyContent: "center", padding: 3, width: "90%" },
  logo: { height: 37, objectFit: "contain", width: 78 },
  heading: { alignItems: "center", flex: 1, justifyContent: "center", padding: 6 },
  title: { fontSize: 13, fontWeight: 700 },
  number: { fontSize: 9, fontWeight: 700, marginTop: 4 },
  row: { borderBottomColor: "#222", borderLeftColor: "#222", borderLeftWidth: 1, borderRightColor: "#222", borderRightWidth: 1, flexDirection: "row" },
  cell: { minHeight: 34, padding: 5, width: "50%" },
  right: { borderRightColor: "#222", borderRightWidth: 1 },
  label: { color: "#555", fontSize: 6.2, fontWeight: 700, marginBottom: 2, textTransform: "uppercase" },
  value: { fontSize: 8.2, lineHeight: 1.3 },
  sectionTitle: { backgroundColor: "#ececec", borderBottomColor: "#222", borderBottomWidth: 1, borderLeftColor: "#222", borderLeftWidth: 1, borderRightColor: "#222", borderRightWidth: 1, fontSize: 8, fontWeight: 700, padding: 5 },
  section: { borderBottomColor: "#222", borderBottomWidth: 1, borderLeftColor: "#222", borderLeftWidth: 1, borderRightColor: "#222", borderRightWidth: 1, minHeight: 66, padding: 7 },
  photoGrid: { flexDirection: "row", gap: 6, marginTop: 6 },
  photo: { alignItems: "center", backgroundColor: "#f4f4f4", borderColor: "#bbb", borderWidth: 1, color: "#777", height: 70, justifyContent: "center", width: "32%" },
  checks: { flexDirection: "row", gap: 16, marginTop: 7 },
  signatures: { flexDirection: "row" },
  signature: { minHeight: 54, padding: 6, width: "33.333%" },
  signatureInk: { height: 26, marginBottom: 2, objectFit: "contain", width: "90%" },
  signatureLine: { borderBottomColor: "#555", borderBottomWidth: 1, marginBottom: 4, marginTop: 23 },
  note: { color: "#666", fontSize: 6.5, lineHeight: 1.3, marginTop: 8 },
  footer: { bottom: 10, color: "#666", fontSize: 6, left: 24, position: "absolute", right: 24, textAlign: "center" },
});

function value(result: string | null | undefined, fallback = "—") {
  return result && result.trim() ? result : fallback;
}

function Cell({ label, result, right = false }: { label: string; result: string; right?: boolean }) {
  return <View style={[styles.cell, right ? styles.right : {}]}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value(result)}</Text></View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <><Text style={styles.sectionTitle}>{title}</Text><View style={styles.section}>{children}</View></>;
}

export function NcrDocument({ finding, progress, context, logoSource = "/codeco-logo-pdf.png" }: { finding: Finding; progress?: FindingProgressUpdate; context: NcrContext; logoSource?: string }) {
  const issue = finding.issue_management ?? {};
  const resolved = finding.status === "closed";
  // What the verifier signed for, which is not always what the status column says: an NCR
  // can be closed on a solution that only partly worked.
  const issueResolved = issue.qc_issue_resolved ?? resolved;
  return <Document title={`${finding.finding_number} ${finding.title}`} author="CODECO N.V.">
    <Page size="A4" style={styles.page}>
      <View style={styles.header}><View style={styles.brand}><View style={styles.logoPlate}><Image src={logoSource} style={styles.logo} /></View></View><View style={styles.heading}><Text style={styles.title}>NON-CONFORMANCE REPORT</Text><Text style={styles.number}>{finding.finding_number}</Text></View></View>
      <View style={styles.row}><Cell label="Project name and number" result={`${context.projectCode} · ${context.projectName}`} right /><Cell label="Building / location" result={context.buildingName} /></View>
      <View style={styles.row}><Cell label="Contractor / responsible party" result={context.responsiblePartyName} right /><Cell label="Date / due date" result={`${finding.created_at.slice(0, 10)} / ${finding.due_at?.slice(0, 10) ?? "—"}`} /></View>
      <View style={styles.row}><Cell label="Drawn up by" result={issue.issued_by || context.issuerName} right /><Cell label="Report number" result={finding.finding_number} /></View>
      <View style={styles.row}><Cell label="Subject" result={finding.title} right /><Cell label="Reference checklist" result={value(issue.reference_checklist)} /></View>
      {/* The two lists at the head of the client's own form. "Source" is not among them:
          the client struck that column through. */}
      <View style={styles.row}><Cell label="Category" result={value(issue.ncr_category)} right /><Cell label="Type of work" result={value(issue.ncr_work_type)} /></View>
      <View style={styles.row}><Cell label="Severity / issue type" result={`${finding.severity} / ${issue.issue_type ?? finding.finding_type}`} right /><Cell label="Remarks" result={value(issue.remarks)} /></View>
      <Section title="DESCRIPTION OF NON-CONFORMANCE"><Text style={styles.value}>{finding.description}</Text><View style={styles.photoGrid}>{[1, 2, 3].map((item) => <View style={styles.photo} key={item}><Text>Linked evidence photo {item}</Text></View>)}</View></Section>
      {/* The engineer's chosen box is ticked here, exactly as on the client's own form. */}
      <Section title="ENGINEER'S RECOMMENDED ACTION"><Text style={styles.value}>{value(issue.recommended_action_detail || issue.action_steps, "Rework / repair in accordance with the approved drawings and specifications.")}</Text><View style={styles.checks}><Text>{issue.recommended_action === "rework" ? "[X]" : "[ ]"} Rework</Text><Text>{issue.recommended_action === "repair" ? "[X]" : "[ ]"} Repair</Text><Text>{issue.recommended_action === "alternative" ? "[X]" : "[ ]"} Alternative solution for approval</Text></View></Section>
      <Section title="PROPOSED CORRECTIVE ACTION BY CONTRACTOR"><Text style={styles.value}>{value(finding.proposed_correction, "Pending contractor proposal and acknowledgement.")}</Text>{finding.final_measure ? <Text style={styles.value}>Completed: {finding.final_measure}</Text> : null}{issue.correction_signed_by ? <Text style={styles.value}>Signed: {issue.correction_signed_by} · {String(issue.correction_signed_at ?? "").slice(0, 10)}</Text> : null}</Section>
      {/* The Quality Control / Verification box, as the client's own form prints it: the
          date the re-inspection was carried out, what it observed, and the comments the
          verifier signed for — not only the status column. */}
      <Section title="QUALITY CONTROL / VERIFICATION">
        <Text style={styles.value}>Latest inspection progress: {progress?.progress_percent ?? 0}% · disposition: {(progress?.disposition ?? issue.disposition ?? "to_be_corrected").replaceAll("_", " ")}</Text>
        <View style={styles.checks}><Text>{issueResolved ? "[X]" : "[ ]"} Issue resolved</Text><Text>{issueResolved ? "[ ]" : "[X]"} Issue not resolved</Text><Text>Status: {finding.status.replaceAll("_", " ")}</Text></View>
        <View style={styles.row}><Cell label="Date of QC inspection" result={value(issue.qc_inspection_date)} right /><Cell label="Date verified" result={value(finding.verified_at?.slice(0, 10))} /></View>
        <Text style={styles.value}>Remarks / observations: {value(issue.qc_remarks)}</Text>
        <Text style={styles.value}>Verification comments: {value(issue.verification_comments || finding.final_measure)}</Text>
      </Section>
      {/* The engineer's own written signature is printed where it belongs: above the line
          that carries their name, exactly as on the client's paper form. */}
      {/* Name and position under every signature line, as the client's own form prints
          them: a signature nobody can place is a signature nobody can hold to account. */}
      <View style={styles.signatures}>{[
        { label: "Issued by", name: issue.signed_by || issue.issued_by || context.issuerName, position: issue.signed_position || "", ink: issue.signature_image || context.signatureImage || null },
        { label: "Received / contractor", name: issue.correction_signed_by || issue.completion_signed_by || "", position: issue.correction_signed_position || "", ink: issue.correction_signature_image || issue.completion_signature_image || null },
        { label: "QC verification", name: resolved ? issue.verification_signed_by || context.verifierName || "" : "", position: resolved ? issue.verification_signed_position || "" : "", ink: resolved ? issue.verification_signature_image || null : null },
      ].map((line, index) => <View style={[styles.signature, index < 2 ? styles.right : {}]} key={line.label}><Text style={styles.label}>{line.label}</Text>{line.ink ? <Image src={line.ink} style={styles.signatureInk} /> : <View style={styles.signatureLine} />}<Text>{line.name || " "}</Text><Text style={styles.label}>{line.position || " "}</Text></View>)}</View>
      <Text style={styles.note}>The photo boxes refer to evidence linked in the central project record; images are not duplicated into this generated form unless selected as report attachments. Closing remains a separate authorized human verification.</Text>
      <Text style={styles.footer} fixed>CODECO N.V. · Non-conformance report</Text>
    </Page>
  </Document>;
}

export async function downloadNcrPdf(finding: Finding, progress: FindingProgressUpdate | undefined, context: NcrContext) {
  const blob = await pdf(<NcrDocument finding={finding} progress={progress} context={context} />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${finding.finding_number}-${finding.title}`.replace(/[^a-z0-9._-]+/gi, "-") + ".pdf";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
