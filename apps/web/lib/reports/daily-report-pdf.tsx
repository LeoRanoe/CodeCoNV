/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { DailyCloseoutAnswers, ProjectStartAnswers } from "@/lib/forms/daily-report";

export type BuildingReportBreakdown = {
  name: string;
  projectStart: ProjectStartAnswers;
  closeout: DailyCloseoutAnswers;
};

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
  formal?: { revision: number; sha256: string; frozenAt: string };
  buildings?: BuildingReportBreakdown[];
};

export type FormalReportSnapshot = {
  frozen_at?: string;
  report?: Record<string, unknown>;
  project?: Record<string, unknown>;
  created_by_profile?: Record<string, unknown>;
  attendance?: Array<Record<string, unknown>>;
  registrations?: Array<Record<string, unknown>>;
  // Current (multi-building) shape: one row per building.
  buildings?: Array<Record<string, unknown>>;
  start_checks?: Array<Record<string, unknown>>;
  closeouts?: Array<Record<string, unknown>>;
  // Legacy shape, kept so older frozen report versions still render.
  building?: Record<string, unknown>;
  start_check?: Record<string, unknown>;
  closeout?: Record<string, unknown>;
};

const styles = StyleSheet.create({
  page: { paddingBottom: 50, paddingHorizontal: 36, paddingTop: 36, fontFamily: "Helvetica", fontSize: 9, color: "#183646", lineHeight: 1.45 },
  header: { borderBottomWidth: 2, borderBottomColor: "#10a6a0", paddingBottom: 12, marginBottom: 18 },
  brandRow: { alignItems: "center", flexDirection: "row", marginBottom: 6 },
  logoPlate: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#d9e5e9", borderWidth: 1, justifyContent: "center", padding: 2, width: 86 },
  logo: { height: 31, objectFit: "contain", width: 67 },
  brand: { fontSize: 10, color: "#0d8885", fontWeight: 700, marginLeft: 9 },
  title: { fontSize: 21, color: "#123747", fontWeight: 700, lineHeight: 1.1 },
  subtitle: { marginTop: 7, color: "#5c7480" },
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
  footer: { position: "absolute", bottom: 22, left: 36, right: 36, color: "#78909a", fontSize: 7, textAlign: "center" },
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

export function DailyReportDocument({ snapshot, logoSource = "/codeco-logo-pdf.png" }: { snapshot: DailyReportPdfSnapshot; logoSource?: string }) {
  const { projectStart: start, closeout } = snapshot;
  return (
    <Document title={`${snapshot.reportNumber} - ${snapshot.projectName}`} author="CODECO N.V.">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}><View style={styles.logoPlate}><Image src={logoSource} style={styles.logo} /></View><Text style={styles.brand}>CONSTRUCTIESUPERVISIE</Text></View>
          <Text style={styles.title}>Dagrapport</Text>
          <Text style={styles.subtitle}>{snapshot.formal ? `Formele immutable revisie ${snapshot.formal.revision}` : "Vaste, controleerbare samenvatting uit bevestigde projectregistraties"}</Text>
        </View>

        <View style={styles.metadata}>
          {[
            ["Rapport", snapshot.reportNumber],
            ["Datum", snapshot.reportDate],
            ["Project", `${snapshot.projectCode} · ${snapshot.projectName}`],
            ["Gebouw", snapshot.buildingName],
            ["Locatie", snapshot.location],
            ["Supervisor", snapshot.supervisorName],
            ...(snapshot.formal ? [["Snapshot SHA-256", `${snapshot.formal.sha256.slice(0, 16)}…`]] : []),
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
          <Row label="Werk lopend" value={closeout.workOngoing || "Niet geregistreerd"} />
          <Row label="Werk afgerond" value={closeout.workPerformed} />
          <Row label="Voortgang" value={`${closeout.progressPercent}%`} />
        </Section>
        <Text style={styles.footer} fixed>CODECO Supervisie · gegenereerd uit centrale Supabase-data · Pagina 1 van {snapshot.buildings?.length ? 3 : 2}</Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}><View style={styles.logoPlate}><Image src={logoSource} style={styles.logo} /></View><Text style={styles.brand}>CONSTRUCTIESUPERVISIE</Text></View>
          <Text style={styles.title}>Dagrapport · vervolg</Text>
          <Text style={styles.subtitle}>{snapshot.reportNumber} · {snapshot.reportDate} · {snapshot.projectCode} · {snapshot.buildingName}</Text>
        </View>

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
          <Text style={styles.confirmation}>{snapshot.formal ? `Deze PDF is uitsluitend opgebouwd uit de immutable snapshot van ${snapshot.formal.frozenAt}. Volledige SHA-256: ${snapshot.formal.sha256}` : "Werk-PDF uit bevestigde dagregistraties. Formele status en verklaringen staan in de rapporthistorie."}</Text>
        </Section>

        <Text style={styles.footer} fixed>CODECO Supervisie · gegenereerd uit centrale Supabase-data · Pagina 2 van {snapshot.buildings?.length ? 3 : 2}</Text>
      </Page>

      {snapshot.buildings?.length ? (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <View style={styles.brandRow}><View style={styles.logoPlate}><Image src={logoSource} style={styles.logo} /></View><Text style={styles.brand}>CONSTRUCTIESUPERVISIE</Text></View>
            <Text style={styles.title}>Dagrapport · per gebouw</Text>
            <Text style={styles.subtitle}>{snapshot.reportNumber} · {snapshot.reportDate} · {snapshot.buildings.length} gebouwen in dit projectrapport</Text>
          </View>
          {snapshot.buildings.map((building) => (
            <Section title={building.name} key={building.name}>
              <Row label="Weer" value={`${building.projectStart.weatherCondition}; ${building.projectStart.temperatureC} °C`} />
              <Row label="Werk lopend" value={building.closeout.workOngoing || "Niet geregistreerd"} />
              <Row label="Werk afgerond" value={building.closeout.workPerformed} />
              <Row label="Voortgang" value={`${building.closeout.progressPercent}%`} />
              <Row label="Kwaliteit" value={building.closeout.qualityIssues === "yes" ? building.closeout.qualityDetails : "Geen afwijking gemeld"} />
              <Row label="HSE" value={building.closeout.hseEvent === "none" ? "Geen incident of near miss gemeld" : building.closeout.hseDetails} />
              <Row label="Planning morgen" value={building.closeout.tomorrowPlan} />
            </Section>
          ))}
          <Text style={styles.footer} fixed>CODECO Supervisie · gegenereerd uit centrale Supabase-data · Pagina 3 van 3</Text>
        </Page>
      ) : null}
    </Document>
  );
}

export async function downloadDailyReportPdf(snapshot: DailyReportPdfSnapshot) {
  const blob = await pdf(<DailyReportDocument snapshot={snapshot} />).toBlob();
  downloadBlob(blob, `${snapshot.reportNumber}.pdf`);
}

function value(record: Record<string, unknown> | undefined, key: string, fallback = ""): string {
  const result = record?.[key];
  return result === null || result === undefined ? fallback : String(result);
}

function truth(valueToCheck: unknown): "yes" | "no" {
  return valueToCheck === true ? "yes" : "no";
}

function projectStartAnswersFromSnapshotRow(start: Record<string, unknown> | undefined): ProjectStartAnswers {
  return {
    weatherCondition: value(start, "weather_condition", "cloudy") as ProjectStartAnswers["weatherCondition"],
    temperatureC: Number(start?.temperature_c ?? 0),
    windCondition: value(start, "wind_condition", "calm") as ProjectStartAnswers["windCondition"],
    shiftStart: value(start, "shift_start", "00:00").slice(0, 5),
    shiftEnd: value(start, "shift_end", "00:00").slice(0, 5),
    plannedWork: value(start, "planned_work", "Niet geregistreerd"),
    expectedWorkers: Number(start?.expected_workers ?? 0),
    inspectionPlanned: truth(start?.inspection_planned),
    highRiskWork: truth(start?.high_risk_work),
    concreteWork: truth(start?.concrete_work),
    workPermit: value(start, "work_permit_status", "not_required") as ProjectStartAnswers["workPermit"],
    drawingStatus: value(start, "drawing_status", "not_required") as ProjectStartAnswers["drawingStatus"],
    drawingIssueReported: start?.drawing_issue_reported === true,
    riskNotes: value(start, "risk_notes"),
  };
}

function dailyCloseoutAnswersFromSnapshotRow(closeout: Record<string, unknown> | undefined): DailyCloseoutAnswers {
  return {
    daySummary: value(closeout, "day_summary", "Geen dagsamenvatting in deze vastgezette versie."),
    weatherSummary: value(closeout, "weather_summary", "Niet geregistreerd"),
    workOngoing: value(closeout, "work_ongoing"),
    workPerformed: value(closeout, "work_performed", "Niet geregistreerd"),
    progressPercent: Number(closeout?.progress_percent ?? 0),
    inspectionResult: value(closeout, "inspection_result", "none") as DailyCloseoutAnswers["inspectionResult"],
    qualityIssues: truth(closeout?.quality_issues),
    qualityDetails: value(closeout, "quality_details"),
    hseEvent: value(closeout, "hse_event", "none") as DailyCloseoutAnswers["hseEvent"],
    hseDetails: value(closeout, "hse_details"),
    equipmentStatus: value(closeout, "equipment_status"),
    deliveries: value(closeout, "deliveries"),
    testsMeasurements: value(closeout, "tests_measurements"),
    variationWork: value(closeout, "variation_work_status", "none") as DailyCloseoutAnswers["variationWork"],
    delayCause: value(closeout, "delay_cause", "none") as DailyCloseoutAnswers["delayCause"],
    delayHours: Number(closeout?.delay_hours ?? 0),
    communication: value(closeout, "communication"),
    risks: value(closeout, "risks"),
    tomorrowPlan: value(closeout, "tomorrow_plan", "Niet geregistreerd"),
    photoCount: Number(closeout?.photo_count ?? 0),
    attachmentsConfirmed: closeout?.attachments_confirmed === true,
  };
}

export function immutableDailySnapshot(snapshot: FormalReportSnapshot, revision: number, sha256: string): DailyReportPdfSnapshot {
  const report = snapshot.report;
  const project = snapshot.project;
  const profile = snapshot.created_by_profile;

  // Snapshots frozen after the multi-building change carry `buildings` /
  // `start_checks` / `closeouts` arrays (one entry per building). Snapshots
  // frozen before it carry the older singular `building` / `start_check` /
  // `closeout` keys -- both must keep rendering correctly from their own
  // immutable snapshot.
  const buildingRows = Array.isArray(snapshot.buildings) ? snapshot.buildings : null;
  const startCheckRows = Array.isArray(snapshot.start_checks) ? snapshot.start_checks : null;
  const closeoutRows = Array.isArray(snapshot.closeouts) ? snapshot.closeouts : null;

  const primaryBuilding = buildingRows?.[0] ?? snapshot.building;
  const primaryStart = (buildingRows && startCheckRows
    ? startCheckRows.find((row) => row.building_id === primaryBuilding?.id)
    : undefined) ?? snapshot.start_check;
  const primaryCloseout = (buildingRows && closeoutRows
    ? closeoutRows.find((row) => row.building_id === primaryBuilding?.id)
    : undefined) ?? snapshot.closeout;

  const buildingBreakdown = buildingRows && buildingRows.length > 1
    ? buildingRows.map((buildingRow) => ({
        name: value(buildingRow, "name", "—"),
        projectStart: projectStartAnswersFromSnapshotRow(startCheckRows?.find((row) => row.building_id === buildingRow.id)),
        closeout: dailyCloseoutAnswersFromSnapshotRow(closeoutRows?.find((row) => row.building_id === buildingRow.id)),
      }))
    : undefined;

  return {
    reportNumber: value(report, "report_number", `Dagrapport-revisie-${revision}`),
    reportDate: value(report, "report_date"),
    projectName: value(project, "name", "Onbekend project"),
    projectCode: value(project, "code", "—"),
    buildingName: buildingRows && buildingRows.length > 1
      ? `${buildingRows.length} gebouwen`
      : value(primaryBuilding, "name", value(report, "building_id", "—")),
    location: value(project, "location", "—"),
    supervisorName: value(profile, "display_name", value(report, "created_by", "Geauthenticeerde gebruiker")),
    attendanceTotal: (snapshot.attendance ?? []).reduce((total, entry) => total + Number(entry.headcount ?? 0), 0),
    registrationCount: snapshot.registrations?.length ?? 0,
    projectStart: projectStartAnswersFromSnapshotRow(primaryStart),
    closeout: dailyCloseoutAnswersFromSnapshotRow(primaryCloseout),
    formal: { revision, sha256, frozenAt: snapshot.frozen_at ?? "onbekend tijdstip" },
    buildings: buildingBreakdown,
  };
}

export async function downloadFormalReportPdf(snapshot: FormalReportSnapshot, revision: number, sha256: string) {
  const normalized = immutableDailySnapshot(snapshot, revision, sha256);
  const blob = await pdf(<DailyReportDocument snapshot={normalized} />).toBlob();
  downloadBlob(blob, `${normalized.reportNumber}-revisie-${revision}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
