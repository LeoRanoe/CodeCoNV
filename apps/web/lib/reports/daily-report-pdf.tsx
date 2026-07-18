import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { DailyCloseoutAnswers, ProjectStartAnswers } from "@/lib/forms/daily-report";

export type DailyReportPdfSnapshot = {
  reportNumber: string;
  reportDate: string;
  projectName: string;
  projectCode: string;
  buildingName: string;
  location: string;
  supervisorName: string;
  attendanceTotal: number;
  registrationCount: number;
  projectStart: ProjectStartAnswers;
  closeout: DailyCloseoutAnswers;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 9, color: "#183646", lineHeight: 1.45 },
  header: { borderBottomWidth: 2, borderBottomColor: "#10a6a0", paddingBottom: 12, marginBottom: 18 },
  brand: { fontSize: 10, color: "#0d8885", fontWeight: 700, marginBottom: 3 },
  title: { fontSize: 21, color: "#123747", fontWeight: 700 },
  subtitle: { marginTop: 4, color: "#5c7480" },
  metadata: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  metaCard: { width: "31%", borderWidth: 1, borderColor: "#d9e5e9", borderRadius: 4, padding: 8 },
  metaLabel: { color: "#69828d", fontSize: 7, textTransform: "uppercase", marginBottom: 2 },
  metaValue: { color: "#173b4b", fontSize: 9, fontWeight: 700 },
  section: { marginBottom: 11, borderWidth: 1, borderColor: "#dce8eb", borderRadius: 4 },
  sectionHeader: { backgroundColor: "#edf8f7", color: "#0d7372", paddingHorizontal: 9, paddingVertical: 6, fontWeight: 700 },
  sectionBody: { padding: 9 },
  row: { flexDirection: "row", gap: 8, marginBottom: 4 },
  rowLabel: { width: "30%", color: "#69828d" },
  rowValue: { width: "70%", color: "#183646" },
  footer: { position: "absolute", bottom: 22, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", color: "#78909a", fontSize: 7 },
  confirmation: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#d9e5e9", paddingTop: 8, color: "#526c77" },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value === undefined || value === null || value === "" ? "Niet geregistreerd" : String(value)}</Text>
    </View>
  );
}

function DailyReportDocument({ snapshot }: { snapshot: DailyReportPdfSnapshot }) {
  const { projectStart: start, closeout } = snapshot;
  return (
    <Document title={`${snapshot.reportNumber} - ${snapshot.projectName}`} author="CODECO N.V.">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>CODECO N.V. · CONSTRUCTIESUPERVISIE</Text>
          <Text style={styles.title}>Dagrapport</Text>
          <Text style={styles.subtitle}>Vaste, controleerbare samenvatting uit bevestigde projectregistraties</Text>
        </View>

        <View style={styles.metadata}>
          {[
            ["Rapport", snapshot.reportNumber],
            ["Datum", snapshot.reportDate],
            ["Project", `${snapshot.projectCode} · ${snapshot.projectName}`],
            ["Gebouw", snapshot.buildingName],
            ["Locatie", snapshot.location],
            ["Supervisor", snapshot.supervisorName],
          ].map(([label, value]) => (
            <View style={styles.metaCard} key={label}>
              <Text style={styles.metaLabel}>{label}</Text>
              <Text style={styles.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Section title="1. Projectinformatie, weer en werkuren">
          <Row label="Weer" value={`${start.weatherCondition}; ${start.temperatureC} °C; wind ${start.windCondition}`} />
          <Row label="Werkuren" value={`${start.shiftStart}–${start.shiftEnd}`} />
          <Row label="Verwachte bezetting" value={start.expectedWorkers} />
        </Section>
        <Section title="2. Samenvatting van de dag"><Text>{closeout.daySummary}</Text></Section>
        <Section title="3–4. Aanwezigheid, werkzaamheden en voortgang">
          <Row label="Aanwezig" value={`${snapshot.attendanceTotal} personen`} />
          <Row label="Werkzaamheden" value={closeout.workPerformed} />
          <Row label="Voortgang" value={`${closeout.progressPercent}%`} />
        </Section>
        <Section title="5–7. Inspecties, kwaliteit en HSE">
          <Row label="Inspecties" value={closeout.inspectionResult} />
          <Row label="Kwaliteit" value={closeout.qualityIssues === "yes" ? closeout.qualityDetails : "Geen afwijking gemeld"} />
          <Row label="HSE" value={closeout.hseEvent === "none" ? "Geen incident of near miss gemeld" : closeout.hseDetails} />
        </Section>
        <Section title="8–12. Materieel, leveringen, testen, wijzigingen en vertraging">
          <Row label="Materieel" value={closeout.equipmentStatus} />
          <Row label="Leveringen" value={closeout.deliveries} />
          <Row label="Testen/meten" value={closeout.testsMeasurements} />
          <Row label="Wijzigingswerk" value={closeout.variationWork} />
          <Row label="Vertraging" value={closeout.delayCause === "none" ? "Geen vertraging" : `${closeout.delayCause}; ${closeout.delayHours} uur`} />
        </Section>
        <Section title="13–16. Communicatie, acties, risico's en morgen">
          <Row label="Communicatie" value={closeout.communication} />
          <Row label="Registraties" value={`${snapshot.registrationCount} dagregistraties`} />
          <Row label="Risico's" value={closeout.risks} />
          <Row label="Planning morgen" value={closeout.tomorrowPlan} />
        </Section>
        <Section title="17–19. Foto's, bijlagen en controle">
          <Row label="Foto's" value={closeout.photoCount} />
          <Row label="Bijlagen" value={closeout.attachmentsConfirmed ? "Door supervisor gecontroleerd" : "Nog niet bevestigd"} />
          <Text style={styles.confirmation}>Concept-PDF. Formele ondertekening en distributie vereisen de ingestelde review- en vrijgaveflow.</Text>
        </Section>

        <View style={styles.footer} fixed>
          <Text>CODECO Supervisie · gegenereerd uit centrale Supabase-data</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} van ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadDailyReportPdf(snapshot: DailyReportPdfSnapshot) {
  const blob = await pdf(<DailyReportDocument snapshot={snapshot} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${snapshot.reportNumber}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
