import { Document, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 28, paddingBottom: 42, fontSize: 8, color: "#1a2430" },
  title: { fontSize: 16, marginBottom: 7 },
  meta: { fontSize: 9, marginBottom: 3 },
  header: { flexDirection: "row", backgroundColor: "#eef2f4", marginTop: 9 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#c2cad0" },
  cell: { padding: 4 },
  pageNumber: { position: "absolute", bottom: 20, right: 28, fontSize: 8 },
});

export async function registerPdf(report: {
  title: string;
  metadata: string[];
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  const column = { width: `${100 / report.headers.length}%` as const };
  return pdf(
    <Document title={report.title}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{report.title}</Text>
        {report.metadata.map((line, index) => <Text key={index} style={styles.meta}>{line}</Text>)}
        <View style={styles.header} minPresenceAhead={25}>
          {report.headers.map((label, index) => <Text key={index} style={[styles.cell, column]}>{label}</Text>)}
        </View>
        {report.rows.map((row, index) => (
          <View key={index} style={styles.row} wrap={false}>
            {row.map((value, cell) => <Text key={cell} style={[styles.cell, column]}>{String(value ?? "")}</Text>)}
          </View>
        ))}
        <Text fixed style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>,
  ).toBlob();
}
