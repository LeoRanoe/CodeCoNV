/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { downloadBlob } from "@/lib/browser/download";
import type { DayExportDocument, DayExportItem, DayExportSection } from "@/lib/reports/day-overview-export";
import { SignoffHistoryPdf } from "@/lib/reports/signoff-history-pdf";

Font.registerHyphenationCallback((word) => [word]);

const ink = "#1b2227";
const muted = "#5a646c";
const hairline = "#c9cfd4";

const styles = StyleSheet.create({
  page: { paddingBottom: 50, paddingHorizontal: 32, paddingTop: 32, fontFamily: "Helvetica", fontSize: 8.5, color: ink, lineHeight: 1.35 },
  header: { borderBottomWidth: 1.5, borderBottomColor: ink, paddingBottom: 10, marginBottom: 12 },
  brandRow: { alignItems: "center", flexDirection: "row", marginBottom: 6 },
  logo: { height: 31, objectFit: "contain", width: 67 },
  title: { fontSize: 20, fontWeight: 700, lineHeight: 1.15 },
  subtitle: { marginTop: 5, color: muted },
  headGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: hairline, marginBottom: 12 },
  headCell: { width: "33.33%", borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: hairline, paddingHorizontal: 6, paddingVertical: 4 },
  headLabel: { color: muted, fontSize: 7, marginBottom: 1 },
  headValue: { fontWeight: 700, fontSize: 9 },
  contents: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: hairline, marginBottom: 14 },
  contentsCell: { width: "25%", flexDirection: "row", justifyContent: "space-between", borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: hairline, paddingHorizontal: 5, paddingVertical: 3 },
  contentsCount: { fontWeight: 700 },
  section: { marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.75, borderBottomColor: ink, paddingBottom: 2, marginBottom: 5 },
  sectionTitle: { fontSize: 11, fontWeight: 700 },
  sectionCount: { fontSize: 11, fontWeight: 700, color: muted },
  empty: { color: muted },
  summary: { marginBottom: 4, fontWeight: 700 },
  item: { borderBottomWidth: 0.5, borderBottomColor: hairline, paddingVertical: 5 },
  itemHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  itemTitle: { fontWeight: 700, fontSize: 9.5, width: "78%" },
  itemStatus: { color: muted, fontSize: 7.5, textAlign: "right", width: "22%" },
  itemCode: { color: muted, fontSize: 7.5, marginBottom: 2 },
  fact: { flexDirection: "row", marginBottom: 1.5 },
  factLabel: { width: "30%", color: muted },
  factValue: { width: "70%" },
  signatureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  signatureCell: { borderColor: hairline, borderWidth: 0.5, padding: 5, width: "32%" },
  signatureRole: { color: muted, fontSize: 7, marginBottom: 1 },
  signatureInk: { height: 24, marginVertical: 2, objectFit: "contain", width: "90%" },
  signatureName: { fontSize: 8, fontWeight: 700 },
  signatureMeta: { color: muted, fontSize: 7 },
  tableRow: { flexDirection: "row", borderLeftWidth: 0.5, borderColor: hairline },
  tableHead: { flexDirection: "row", backgroundColor: "#eef0f2", borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: hairline },
  cell: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: hairline, paddingHorizontal: 4, paddingVertical: 2 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  photo: { width: "31.5%", marginBottom: 4 },
  photoImage: { width: "100%", height: 110, objectFit: "cover", borderWidth: 0.5, borderColor: hairline },
  photoCaption: { fontSize: 7.5, marginTop: 2 },
  photoMeta: { fontSize: 7, color: muted },
  note: { marginTop: 6, color: muted },
  footer: { position: "absolute", top: 812, left: 32, right: 32, color: muted, fontSize: 7, textAlign: "center" },
});

function ItemView({ item, historyTitle }: { item: DayExportItem; historyTitle: string }) {
  return (
    <View style={styles.item} wrap={false}>
      {item.code ? <Text style={styles.itemCode}>{item.code}</Text> : null}
      <View style={styles.itemHead}>
        <Text style={styles.itemTitle}>{item.title || "—"}</Text>
        <Text style={styles.itemStatus}>{item.status}</Text>
      </View>
      {item.facts.map(([label, value]) => (
        <View style={styles.fact} key={label}>
          <Text style={styles.factLabel}>{label}</Text>
          <Text style={styles.factValue}>{value}</Text>
        </View>
      ))}
      {item.signatures.length ? (
        <View style={styles.signatureGrid}>
          {item.signatures.map((signature) => (
            <View style={styles.signatureCell} key={`${signature.label}:${signature.name}`}>
              <Text style={styles.signatureRole}>{signature.label}</Text>
              {signature.image ? <Image src={signature.image} style={styles.signatureInk} /> : null}
              <Text style={styles.signatureName}>{signature.name || " "}</Text>
              {signature.signedAt ? <Text style={styles.signatureMeta}>{signature.signedAt}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {item.history?.length ? <SignoffHistoryPdf history={item.history} title={historyTitle} /> : null}
    </View>
  );
}

function SectionView({ section, emptyLabel, historyTitle }: { section: DayExportSection; emptyLabel: string; historyTitle: string }) {
  const hasContent = Boolean(section.items.length || section.table || section.photos?.length || section.summary);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.count}</Text>
      </View>
      {!hasContent ? <Text style={styles.empty}>{emptyLabel}</Text> : null}
      {section.summary ? <Text style={styles.summary}>{section.summary}</Text> : null}
      {section.table ? (
        <View>
          <View style={styles.tableHead}>
            <Text style={[styles.cell, { width: "80%", fontWeight: 700 }]}>{section.table.columns[0]}</Text>
            <Text style={[styles.cell, { width: "20%", fontWeight: 700 }]}>{section.table.columns[1]}</Text>
          </View>
          {section.table.rows.map((row) => (
            <View style={styles.tableRow} key={row[0]} wrap={false}>
              <Text style={[styles.cell, { width: "80%" }]}>{row[0]}</Text>
              <Text style={[styles.cell, { width: "20%" }]}>{row[1]}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {section.items.map((item, index) => <ItemView item={item} historyTitle={historyTitle} key={`${item.code}:${index}`} />)}
      {section.photos?.length ? (
        <View style={styles.photos}>
          {section.photos.map((photo, index) => (
            <View style={styles.photo} key={`${photo.title}:${index}`} wrap={false}>
              {photo.image ? <Image src={photo.image} style={styles.photoImage} /> : null}
              <Text style={styles.photoCaption}>{photo.title}</Text>
              {photo.meta ? <Text style={styles.photoMeta}>{photo.meta}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function DayExportPdf({ document, emptyLabel, pageLabel }: { document: DayExportDocument; emptyLabel: string; pageLabel: (page: number, total: number) => string }) {
  return (
    <Document title={`${document.title} · ${document.subtitle}`} author="CODECO N.V.">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}><Image src="/codeco-logo-pdf.png" style={styles.logo} /></View>
          <Text style={styles.title}>{document.title}</Text>
          <Text style={styles.subtitle}>{document.subtitle}</Text>
        </View>
        <View style={styles.headGrid}>
          {document.head.map(([label, value]) => (
            <View style={styles.headCell} key={label}>
              <Text style={styles.headLabel}>{label}</Text>
              <Text style={styles.headValue}>{value || "—"}</Text>
            </View>
          ))}
        </View>
        {/* Every form of Workspace with its count: the reader sees at once what the day holds. */}
        <View style={styles.contents}>
          {document.sections.map((section) => (
            <View style={styles.contentsCell} key={section.key}>
              <Text>{section.title}</Text>
              <Text style={styles.contentsCount}>{section.count}</Text>
            </View>
          ))}
        </View>
        {document.sections.map((section) => <SectionView section={section} emptyLabel={emptyLabel} historyTitle={document.historyTitle ?? "Sign-off history"} key={section.key} />)}
        {document.emptyNote ? <Text style={styles.note}>{document.emptyNote}</Text> : null}
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `${document.footer} · ${pageLabel(pageNumber, totalPages)}`} />
      </Page>
    </Document>
  );
}

export async function downloadDayExportPdf(document: DayExportDocument, emptyLabel: string, pageLabel: (page: number, total: number) => string) {
  const blob = await pdf(<DayExportPdf document={document} emptyLabel={emptyLabel} pageLabel={pageLabel} />).toBlob();
  downloadBlob(blob, `${document.fileName}.pdf`);
}
