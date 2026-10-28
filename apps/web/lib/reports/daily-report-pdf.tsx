import { downloadBlob } from "@/lib/browser/download";
/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { buildDailyReportModel, cleanReportText, NOT_RECORDED, type ReportRecords, type ReportSection, type ReportTable } from "@/lib/reports/daily-report-model";
import { reportMoment, reportRole } from "@/lib/reports/report-vocabulary";

// A heading that wraps must not be cut in the middle of a word ("Readi-ness").
Font.registerHyphenationCallback((word) => [word]);

/** A recorded signing declaration, so the report the client hands over shows it. */
export type ReportSignatureLine = {
  name: string;
  role: string;
  declaration: string;
  signedAt: string;
  legalLevel: string;
  /** The signature the signer wrote in the app, printed on the signature line. */
  signatureImage?: string | null;
};

export type DailyReportPdfSnapshot = {
  reportNumber: string;
  reportDate: string;
  projectName: string;
  projectCode: string;
  supervisorName: string;
  /** Everything the tables are built from: the rows of the frozen (or current) report. */
  records: ReportRecords;
  formal?: { revision: number; sha256: string; frozenAt: string };
  /** A working version that has not been frozen; the document says so. */
  draft?: boolean;
  /** Recorded declarations. Empty means the report is not signed yet. */
  signatures?: ReportSignatureLine[];
};

export type FormalReportSnapshot = ReportRecords & {
  frozen_at?: string;
  // Legacy shape, kept so older frozen report versions still render.
  building?: Record<string, unknown>;
  start_check?: Record<string, unknown>;
  closeout?: Record<string, unknown>;
};

const ink = "#1b2227";
const muted = "#5a646c";
const hairline = "#c9cfd4";

const styles = StyleSheet.create({
  page: { paddingBottom: 50, paddingHorizontal: 32, paddingTop: 32, fontFamily: "Helvetica", fontSize: 8.5, color: ink, lineHeight: 1.35 },
  header: { borderBottomWidth: 1.5, borderBottomColor: ink, paddingBottom: 10, marginBottom: 12 },
  brandRow: { alignItems: "center", flexDirection: "row", marginBottom: 6 },
  logoPlate: { alignItems: "center", backgroundColor: "#ffffff", borderColor: hairline, borderWidth: 1, justifyContent: "center", padding: 2, width: 86 },
  logo: { height: 31, objectFit: "contain", width: 67 },
  brand: { fontSize: 9, color: muted, marginLeft: 9 },
  title: { fontSize: 20, fontWeight: 700, lineHeight: 1.15 },
  subtitle: { marginTop: 5, color: muted },
  headGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: hairline, marginBottom: 10 },
  headCell: { width: "33.33%", borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: hairline, paddingHorizontal: 6, paddingVertical: 4 },
  headLabel: { color: muted, fontSize: 7, marginBottom: 1 },
  headValue: { fontWeight: 700, fontSize: 9 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: hairline, marginBottom: 12 },
  kpiCell: { width: "20%", borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: hairline, paddingHorizontal: 6, paddingVertical: 5 },
  kpiLabel: { color: muted, fontSize: 7 },
  kpiValue: { fontSize: 11, fontWeight: 700, marginTop: 1 },
  section: { marginBottom: 10 },
  sectionHeader: { borderBottomWidth: 0.75, borderBottomColor: ink, paddingBottom: 2, marginBottom: 4, fontSize: 10, fontWeight: 700 },
  fact: { flexDirection: "row", marginBottom: 2 },
  factLabel: { width: "34%", color: muted },
  factValue: { width: "66%" },
  caption: { color: muted, fontSize: 7.5, marginTop: 4, marginBottom: 2 },
  tableHeadRow: { flexDirection: "row", backgroundColor: "#eef0f2", borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: hairline },
  tableRow: { flexDirection: "row", borderLeftWidth: 0.5, borderColor: hairline },
  th: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: hairline, paddingHorizontal: 3, paddingVertical: 2, fontWeight: 700, fontSize: 7.5 },
  td: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: hairline, paddingHorizontal: 3, paddingVertical: 2, fontSize: 8 },
  empty: { color: muted },
  // Anchored from the top of an A4 page (842pt) rather than from the bottom: with the page's
  // inherited lineHeight, react-pdf 4 does not draw bottom-anchored text that is rendered
  // dynamically (the page numbers), while a top-anchored one is drawn on every page.
  footer: { position: "absolute", top: 812, left: 32, right: 32, color: muted, fontSize: 7, textAlign: "center" },
  confirmation: { marginTop: 8, borderTopWidth: 0.5, borderTopColor: hairline, paddingTop: 6, color: muted },
  signatureGrid: { flexDirection: "row", gap: 8, marginTop: 4 },
  signatureCell: { borderColor: hairline, borderWidth: 0.5, padding: 8, width: "32%" },
  signatureRole: { color: muted, fontSize: 7, marginBottom: 2 },
  signatureName: { fontSize: 9, fontWeight: 700 },
  signatureLine: { borderBottomColor: muted, borderBottomWidth: 1, marginBottom: 4, marginTop: 20 },
  signatureInk: { height: 26, marginBottom: 3, marginTop: 4, objectFit: "contain", width: "88%" },
  signatureMeta: { color: muted, fontSize: 7 },
  declaration: { color: muted, fontSize: 7.5, marginTop: 4 },
});

/**
 * Item 19 of the client's own day report: control, name/position and signature. The
 * declarations are recorded in the app; without this block the report that is handed
 * over does not show that anyone signed it.
 */
function SignatureSection({ signatures }: { signatures: ReportSignatureLine[] }) {
  const roles = signatures.length
    ? signatures
    : [
      { name: "", role: "Supervisor", declaration: "", signedAt: "", legalLevel: "" },
      { name: "", role: "Aannemer", declaration: "", signedAt: "", legalLevel: "" },
      { name: "", role: "Opdrachtgever", declaration: "", signedAt: "", legalLevel: "" },
    ];
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionHeader}>19. Controle, naam/functie en ondertekening</Text>
      <View style={styles.signatureGrid}>
        {roles.slice(0, 3).map((signature, index) => (
          <View style={styles.signatureCell} key={`${signature.role}:${index}`}>
            <Text style={styles.signatureRole}>{reportRole(signature.role)}</Text>
            {signature.signatureImage ? <Image src={signature.signatureImage} style={styles.signatureInk} /> : <View style={styles.signatureLine} />}
            <Text style={styles.signatureName}>{signature.name || " "}</Text>
            <Text style={styles.signatureMeta}>{signature.signedAt ? `Ondertekend ${reportMoment(signature.signedAt)}` : "Nog niet ondertekend"}</Text>
          </View>
        ))}
      </View>
      {signatures.map((signature, index) => (
        <Text style={styles.declaration} key={`declaration:${index}`}>
          {signature.name} · {reportRole(signature.role)}: “{signature.declaration}”
        </Text>
      ))}
      {signatures.length > 3 ? <Text style={styles.declaration}>{signatures.length - 3} verdere verklaringen staan in de rapporthistorie.</Text> : null}
    </View>
  );
}

/** Page numbers are counted by the renderer: a section that flows onto an extra page used
 * to repeat the previous page's typed-in page number. */
function PageFooter() {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `CODECO Supervisie · gegenereerd uit de centrale projectadministratie · Pagina ${pageNumber} van ${totalPages}`}
    />
  );
}

function Table({ table }: { table: ReportTable }) {
  const widths = table.widths && table.widths.length === table.columns.length
    ? table.widths
    : table.columns.map(() => 100 / table.columns.length);
  return (
    <View>
      <View style={styles.tableHeadRow} wrap={false} minPresenceAhead={30}>
        {table.columns.map((column, index) => <Text key={column} style={[styles.th, { width: `${widths[index]}%` }]}>{column}</Text>)}
      </View>
      {table.rows.map((row, rowIndex) => (
        <View style={styles.tableRow} key={rowIndex} wrap={false}>
          {row.map((cell, index) => <Text key={index} style={[styles.td, { width: `${widths[index]}%` }]}>{cell}</Text>)}
        </View>
      ))}
    </View>
  );
}

function SectionView({ section }: { section: ReportSection }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader} minPresenceAhead={70}>{section.number}. {section.title}</Text>
      {section.facts?.map(([label, value]) => (
        <View style={styles.fact} key={label} wrap={false}>
          <Text style={styles.factLabel}>{label}</Text>
          <Text style={styles.factValue}>{value}</Text>
        </View>
      ))}
      {section.paragraphs?.map((paragraph, index) => <Text key={index}>{paragraph}</Text>)}
      {section.tables?.map(({ caption, table }, index) => (
        <View key={index}>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          <Table table={table} />
        </View>
      ))}
      {section.signatures?.map((signature) => (
        <View style={styles.fact} key={signature.label} wrap={false}>
          <Text style={styles.factLabel}>{signature.label}</Text>
          <View style={styles.factValue}>
            {signature.image ? <Image src={signature.image} style={styles.signatureInk} /> : null}
            <Text>{signature.name}{signature.signedAt ? ` · ${reportMoment(signature.signedAt)}` : ""}</Text>
          </View>
        </View>
      ))}
      {section.empty && !section.tables?.length ? <Text style={styles.empty}>{section.empty}</Text> : null}
    </View>
  );
}

export function DailyReportDocument({ snapshot, logoSource = "/codeco-logo-pdf.png" }: { snapshot: DailyReportPdfSnapshot; logoSource?: string }) {
  const model = buildDailyReportModel(snapshot.records);
  const subtitle = snapshot.formal
    ? `Formele, onveranderbare revisie ${snapshot.formal.revision}`
    : "Conceptversie uit de actuele projectregistraties · nog niet vastgezet";
  return (
    <Document title={`${snapshot.reportNumber} - ${snapshot.projectName}`} author="CODECO N.V.">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}><View style={styles.logoPlate}><Image src={logoSource} style={styles.logo} /></View><Text style={styles.brand}>CONSTRUCTIESUPERVISIE</Text></View>
          <Text style={styles.title}>Dagrapport</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.headGrid}>
          {model.head.map(([label, value]) => (
            <View style={styles.headCell} key={label}>
              <Text style={styles.headLabel}>{label}</Text>
              <Text style={styles.headValue}>{value}</Text>
            </View>
          ))}
          {snapshot.formal ? (
            <View style={styles.headCell}>
              <Text style={styles.headLabel}>Snapshot SHA-256</Text>
              <Text style={styles.headValue}>{snapshot.formal.sha256.slice(0, 16)}…</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.kpiGrid}>
          {model.kpis.map((kpi) => (
            <View style={styles.kpiCell} key={kpi.label}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
            </View>
          ))}
        </View>

        {model.sections.map((section) => <SectionView section={section} key={section.number} />)}
        <SignatureSection signatures={snapshot.signatures ?? []} />
        <Text style={styles.confirmation}>
          {snapshot.formal
            ? `Deze PDF is uitsluitend opgebouwd uit de onveranderbare momentopname van ${reportMoment(snapshot.formal.frozenAt)}. Volledige SHA-256: ${snapshot.formal.sha256}`
            : "Werk-PDF uit de actuele dagregistraties. De formele status staat in de rapporthistorie."}
        </Text>
        <PageFooter />
      </Page>
    </Document>
  );
}

function value(record: Record<string, unknown> | undefined, key: string, fallback = ""): string {
  const result = record?.[key];
  return result === null || result === undefined ? fallback : cleanReportText(result);
}

/**
 * Snapshots frozen before the multi-building change carry the older singular `building` /
 * `start_check` / `closeout` keys. They keep rendering from their own immutable snapshot.
 */
function normalizeRecords(snapshot: FormalReportSnapshot): ReportRecords {
  const buildingId = snapshot.building?.id;
  return {
    ...snapshot,
    buildings: Array.isArray(snapshot.buildings) ? snapshot.buildings : snapshot.building ? [snapshot.building] : [],
    start_checks: Array.isArray(snapshot.start_checks) ? snapshot.start_checks : snapshot.start_check ? [{ building_id: buildingId, ...snapshot.start_check }] : [],
    closeouts: Array.isArray(snapshot.closeouts) ? snapshot.closeouts : snapshot.closeout ? [{ building_id: buildingId, ...snapshot.closeout }] : [],
  };
}

export function immutableDailySnapshot(snapshot: FormalReportSnapshot, revision: number, sha256: string): DailyReportPdfSnapshot & { frozenAt?: string } {
  const report = snapshot.report;
  const project = snapshot.project;
  const profile = snapshot.created_by_profile;
  return {
    reportNumber: value(report, "report_number", `Dagrapport-revisie-${revision}`),
    reportDate: value(report, "report_date"),
    projectName: value(project, "name", "Onbekend project"),
    projectCode: value(project, "code", "—"),
    supervisorName: value(profile, "display_name", NOT_RECORDED),
    records: normalizeRecords(snapshot),
    formal: { revision, sha256, frozenAt: snapshot.frozen_at ?? "onbekend tijdstip" },
  };
}

/** The working version: the same layout from the current rows, not yet frozen. */
export function draftDailySnapshot(snapshot: FormalReportSnapshot, signatures: ReportSignatureLine[] = []): DailyReportPdfSnapshot {
  const frozen = immutableDailySnapshot(snapshot, 0, "");
  return { ...frozen, formal: undefined, draft: true, signatures };
}

export async function downloadDailyReportPdf(snapshot: DailyReportPdfSnapshot) {
  const blob = await pdf(<DailyReportDocument snapshot={snapshot} />).toBlob();
  downloadBlob(blob, `${snapshot.reportNumber}${snapshot.draft ? "-concept" : ""}.pdf`);
}

export async function downloadFormalReportPdf(snapshot: FormalReportSnapshot, revision: number, sha256: string, signatures: ReportSignatureLine[] = []) {
  // A frozen version is signed after it is frozen, so the declarations travel next to
  // the snapshot instead of inside it.
  const normalized = { ...immutableDailySnapshot(snapshot, revision, sha256), signatures };
  const blob = await pdf(<DailyReportDocument snapshot={normalized} />).toBlob();
  downloadBlob(blob, `${normalized.reportNumber}-revisie-${revision}.pdf`);
}
