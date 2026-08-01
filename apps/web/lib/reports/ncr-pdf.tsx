/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { Finding, FindingProgressUpdate } from "@/lib/supabase/operations";

export type NcrContext = {
  projectName: string;
  projectCode: string;
  buildingName: string;
  issuerName: string;
  responsiblePartyName: string;
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
  return <Document title={`${finding.finding_number} ${finding.title}`} author="CODECO N.V.">
    <Page size="A4" style={styles.page}>
      <View style={styles.header}><View style={styles.brand}><View style={styles.logoPlate}><Image src={logoSource} style={styles.logo} /></View></View><View style={styles.heading}><Text style={styles.title}>NON-CONFORMANCE REPORT</Text><Text style={styles.number}>{finding.finding_number}</Text></View></View>
      <View style={styles.row}><Cell label="Project name and number" result={`${context.projectCode} · ${context.projectName}`} right /><Cell label="Building / location" result={context.buildingName} /></View>
      <View style={styles.row}><Cell label="Contractor / responsible party" result={context.responsiblePartyName} right /><Cell label="Date / due date" result={`${finding.created_at.slice(0, 10)} / ${finding.due_at?.slice(0, 10) ?? "—"}`} /></View>
      <View style={styles.row}><Cell label="Subject" result={finding.title} right /><Cell label="Reference checklist" result={value(issue.reference_checklist)} /></View>
      <View style={styles.row}><Cell label="Severity / issue type" result={`${finding.severity} / ${issue.issue_type ?? finding.finding_type}`} right /><Cell label="Remarks" result={value(issue.remarks)} /></View>
      <Section title="DESCRIPTION OF NON-CONFORMANCE"><Text style={styles.value}>{finding.description}</Text><View style={styles.photoGrid}>{[1, 2, 3].map((item) => <View style={styles.photo} key={item}><Text>Linked evidence photo {item}</Text></View>)}</View></Section>
      {/* The engineer's chosen box is ticked here, exactly as on the client's own form. */}
      <Section title="ENGINEER'S RECOMMENDED ACTION"><Text style={styles.value}>{value(issue.recommended_action_detail || issue.action_steps, "Rework / repair in accordance with the approved drawings and specifications.")}</Text><View style={styles.checks}><Text>{issue.recommended_action === "rework" ? "[X]" : "[ ]"} Rework</Text><Text>{issue.recommended_action === "repair" ? "[X]" : "[ ]"} Repair</Text><Text>{issue.recommended_action === "alternative" ? "[X]" : "[ ]"} Alternative solution for approval</Text></View></Section>
      <Section title="PROPOSED CORRECTIVE ACTION BY CONTRACTOR"><Text style={styles.value}>{value(finding.proposed_correction, "Pending contractor proposal and acknowledgement.")}</Text>{finding.final_measure ? <Text style={styles.value}>Completed: {finding.final_measure}</Text> : null}{issue.correction_signed_by ? <Text style={styles.value}>Signed: {issue.correction_signed_by} · {String(issue.correction_signed_at ?? "").slice(0, 10)}</Text> : null}</Section>
      <Section title="QUALITY CONTROL VERIFICATION"><Text style={styles.value}>Latest inspection progress: {progress?.progress_percent ?? 0}% · disposition: {(progress?.disposition ?? issue.disposition ?? "to_be_corrected").replaceAll("_", " ")}</Text><View style={styles.checks}><Text>{resolved ? "[X]" : "[ ]"} Issue resolved</Text><Text>{resolved ? "[ ]" : "[X]"} Issue not resolved</Text><Text>Status: {finding.status.replaceAll("_", " ")}</Text></View></Section>
      <View style={styles.signatures}>{[["Issued by", issue.signed_by || context.issuerName], ["Received / contractor", issue.correction_signed_by || issue.completion_signed_by || ""], ["QC verification", resolved ? context.issuerName : ""]].map(([label, result], index) => <View style={[styles.signature, index < 2 ? styles.right : {}]} key={label}><Text style={styles.label}>{label}</Text><View style={styles.signatureLine} /><Text>{result || " "}</Text></View>)}</View>
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
