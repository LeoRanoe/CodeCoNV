/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { PeriodReportSnapshot } from "@/lib/supabase/operations";

export type PeriodReportSection = "management" | "workforce" | "work" | "quality" | "hse" | "actions" | "logistics" | "instructions" | "commercial" | "communications" | "requests" | "boq" | "visual" | "documents" | "environment" | "buildings";
export const allPeriodReportSections: PeriodReportSection[] = ["management", "workforce", "work", "quality", "hse", "actions", "logistics", "instructions", "commercial", "communications", "requests", "boq", "visual", "documents", "environment", "buildings"];
export type PeriodReportOptions = { sections?: PeriodReportSection[]; reportTitle?: string };

const styles = StyleSheet.create({
  page: { backgroundColor: "#ffffff", color: "#20252b", fontFamily: "Helvetica", fontSize: 9, paddingBottom: 42, paddingHorizontal: 34, paddingTop: 88 },
  brand: { alignItems: "center", backgroundColor: "#f6cf31", flexDirection: "row", left: 34, minHeight: 34, padding: 4, position: "absolute", right: 34, top: 34 },
  brandLogoPlate: { alignItems: "center", backgroundColor: "#ffffff", justifyContent: "center", padding: 2, width: 73 },
  brandLogo: { height: 26, objectFit: "contain", width: 58 },
  brandText: { color: "#171717", flex: 1, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, marginLeft: 10 },
  title: { color: "#16242c", fontSize: 23, fontWeight: 700, lineHeight: 1.15, marginBottom: 5 },
  subtitle: { color: "#5e707b", fontSize: 10, marginBottom: 18 },
  meta: { backgroundColor: "#f3f6f7", borderLeftColor: "#178064", borderLeftWidth: 4, display: "flex", gap: 5, marginBottom: 18, padding: 12 },
  metaLabel: { color: "#60727d", fontSize: 7, letterSpacing: .7, textTransform: "uppercase" },
  metaValue: { color: "#172c37", fontSize: 10, fontWeight: 700 },
  heading: { borderBottomColor: "#dce4e7", borderBottomWidth: 1, color: "#162c37", fontSize: 14, fontWeight: 700, marginBottom: 9, marginTop: 17, paddingBottom: 5 },
  statGrid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 7 },
  stat: { backgroundColor: "#f5f8f8", borderColor: "#dce4e7", borderRadius: 4, borderWidth: 1, minHeight: 44, padding: 8, width: "23.5%" },
  statNumber: { color: "#14755d", fontSize: 16, fontWeight: 700 },
  statLabel: { color: "#5e707b", fontSize: 7.5, marginTop: 3 },
  row: { borderBottomColor: "#e4eaec", borderBottomWidth: 1, display: "flex", flexDirection: "row", gap: 8, paddingBottom: 6, paddingTop: 6 },
  rowNumber: { color: "#a52b24", fontSize: 7.5, fontWeight: 700, width: "17%" },
  rowBody: { flex: 1 },
  rowTitle: { color: "#1c303a", fontSize: 9, fontWeight: 700, lineHeight: 1.25 },
  rowMeta: { color: "#65747d", fontSize: 7.5, lineHeight: 1.3, marginTop: 2 },
  empty: { color: "#74848d", fontStyle: "italic", paddingBottom: 8, paddingTop: 4 },
  dailyCard: { borderColor: "#dce4e7", borderRadius: 4, borderWidth: 1, marginBottom: 7, padding: 9 },
  dailyDate: { color: "#a52b24", fontSize: 8, fontWeight: 700, marginBottom: 4 },
  dailySummary: { color: "#1c303a", fontSize: 9, fontWeight: 700, lineHeight: 1.35 },
  dailyDetail: { color: "#5e707b", fontSize: 8, lineHeight: 1.35, marginTop: 3 },
  callout: { backgroundColor: "#fff9db", borderColor: "#e2bd25", borderWidth: 1, marginBottom: 8, padding: 8 },
  calloutTitle: { color: "#5b4a00", fontSize: 9, fontWeight: 700 },
  calloutText: { color: "#5e583d", fontSize: 7.5, lineHeight: 1.35, marginTop: 3 },
  footer: { bottom: 18, color: "#7a8991", fontSize: 7, left: 34, position: "absolute", right: 34 },
});

function value(record: Record<string, unknown>, key: string, fallback = "") {
  const result = record[key];
  if (result === null || result === undefined) return fallback;
  if (typeof result === "string" || typeof result === "number") return String(result);
  return fallback;
}

function formatDate(value: string) {
  if (!value) return "Geen datum";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-03:00`) : new Date(value);
  return new Intl.DateTimeFormat("nl-SR", { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(date);
}

function humanizeToken(result: string) {
  return result.replaceAll("_", " ");
}

function detailsText(record: Record<string, unknown>) {
  const details = record.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const values = details as Record<string, unknown>;
  const preferredKeys = [
    "building_name",
    "requested_to",
    "due_date",
    "revision",
    "related_reference",
    "reference_documents",
    "attachments",
    "discipline",
    "priority",
    "schedule_impact",
    "cost_impact",
    "period_start",
    "period_end",
    "description",
    "corrective_action",
    "disposition",
    "progress_percent",
    "inspected_at",
    "status",
  ];
  return preferredKeys
    .filter((key) => {
      const item = values[key];
      return item !== "" && item !== null && item !== undefined && (typeof item === "string" || typeof item === "number" || typeof item === "boolean");
    })
    .slice(0, 7)
    .map((key) => {
      const item = String(values[key]);
      const display = key.endsWith("_at") || key.endsWith("_date") || key === "period_start" || key === "period_end"
        ? formatDate(item)
        : ["disposition", "status"].includes(key) ? humanizeToken(item) : item;
      return `${humanizeToken(key)}: ${display}`;
    })
    .join(" | ");
}

function nested(record: Record<string, unknown>, key: string) {
  const result = record[key];
  return result && typeof result === "object" && !Array.isArray(result)
    ? result as Record<string, unknown>
    : {};
}

function RecordRows({ rows, empty = "Geen registraties in deze periode." }: { rows: Array<Record<string, unknown>>; empty?: string }) {
  if (!rows.length) return <Text style={styles.empty}>{empty}</Text>;
  return <View>{rows.map((row, index) => (
    <View style={styles.row} wrap={false} key={`${value(row, "id", String(index))}:${index}`}>
      <Text style={styles.rowNumber}>{value(row, "entry_number", value(row, "finding_number", value(row, "inspection_number", value(row, "event_number", `#${index + 1}`))))}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{value(row, "title", value(row, "day_summary", "Registratie"))}</Text>
        <Text style={styles.rowMeta}>{[humanizeToken(value(row, "status")), humanizeToken(value(row, "severity")), value(row, "occurred_at") ? formatDate(value(row, "occurred_at")) : "", detailsText(row)].filter(Boolean).join(" | ")}</Text>
      </View>
    </View>
  ))}</View>;
}

function ReportBrand({ label, logoSource }: { label: string; logoSource: string }) {
  return <View style={styles.brand} fixed>
    <View style={styles.brandLogoPlate}><Image src={logoSource} style={styles.brandLogo} /></View>
    <Text style={styles.brandText}>{label}</Text>
  </View>;
}

export function PeriodReportDocument({ snapshot, options = {}, logoSource = "/codeco-logo-pdf.png" }: { snapshot: PeriodReportSnapshot; options?: PeriodReportOptions; logoSource?: string }) {
  const projectName = value(snapshot.project, "name", "CODECO-project");
  const sections = new Set(options.sections?.length ? options.sections : allPeriodReportSections);
  const register = (type: string) => snapshot.register_entries.filter((entry) => value(entry, "register_type") === type);
  const openFindings = snapshot.findings.filter((entry) => !["closed", "cancelled"].includes(value(entry, "status")));
  const attendanceTotal = snapshot.attendance.reduce((total, entry) => total + Number(entry.headcount ?? 0), 0);
  const workforce = Object.entries(snapshot.attendance.reduce<Record<string, number>>((groups, entry) => {
    const discipline = value(entry, "discipline", "Onbekend");
    groups[discipline] = (groups[discipline] ?? 0) + Number(entry.headcount ?? 0);
    return groups;
  }, {})).sort((a, b) => b[1] - a[1]);
  const startsByReport = new Map(snapshot.day_starts.map((item) => [value(item, "day_report_id"), item]));
  const closeoutsByReport = new Map(snapshot.day_closeouts.map((item) => [value(item, "day_report_id"), item]));
  const buildings = snapshot.buildings ?? [];
  const parties = snapshot.parties ?? [];
  const files = snapshot.files ?? [];
  const findingProgressUpdates = snapshot.finding_progress_updates ?? [];
  const controlledDocuments = snapshot.register_entries.filter((entry) => ["rfi", "rfa", "inspection_request", "technical_instruction", "change_order", "environmental_report"].includes(value(entry, "register_type")));
  const lessonsLearned = snapshot.findings.flatMap((finding) => {
    const issue = nested(finding, "issue_management");
    const action = value(issue, "action_steps");
    return action ? [{
      id: value(finding, "id"),
      entry_number: value(issue, "source_catalog_subject", value(finding, "finding_number")),
      title: value(finding, "title"),
      status: value(finding, "status"),
      details: { corrective_action: action },
    }] : [];
  });
  const progressByFinding = new Map<string, Record<string, unknown>>();
  findingProgressUpdates.forEach((progress) => progressByFinding.set(value(progress, "finding_id"), progress));
  const averageProgress = findingProgressUpdates.length
    ? Math.round(findingProgressUpdates.reduce((total, progress) => total + Number(progress.progress_percent ?? 0), 0) / findingProgressUpdates.length)
    : 0;
  const coverBuildings = buildings.slice(0, 4).map((building) => ({
    ...building,
    entry_number: value(building, "code"),
    title: value(building, "name"),
    details: { status: value(building, "status") },
  }));
  if (buildings.length > coverBuildings.length) {
    coverBuildings.push({
      entry_number: `+${buildings.length - coverBuildings.length}`,
      title: "Overige gebouwen staan in de gebouwbijlagen",
      details: { status: "" },
    });
  }

  return (
    <Document title={`${options.reportTitle ?? "Perioderapport"} ${projectName}`} author="CODECO N.V." subject={`${snapshot.period.start_date} t/m ${snapshot.period.end_date}`}>
      <Page size="A4" style={styles.page} wrap={false}>
        <ReportBrand label="CONSTRUCTIESUPERVISIE" logoSource={logoSource} />
        <Text style={styles.title}>{options.reportTitle ?? "Perioderapport"}</Text>
        <Text style={styles.subtitle}>Dagelijks, wekelijks, maandelijks of vrij gekozen periode met zelfgekozen rapportonderdelen uit hetzelfde gecontroleerde projectdossier.</Text>
        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Project</Text><Text style={styles.metaValue}>{projectName}</Text>
          <Text style={styles.metaLabel}>Periode</Text><Text style={styles.metaValue}>{formatDate(snapshot.period.start_date)} t/m {formatDate(snapshot.period.end_date)}</Text>
          <Text style={styles.metaLabel}>Gegenereerd</Text><Text style={styles.metaValue}>{formatDate(snapshot.generated_at)}</Text>
        </View>

        {sections.has("management") ? <><Text style={styles.heading}>Projectachtergrond en rapportbasis</Text>
        <View style={styles.callout}><Text style={styles.calloutTitle}>{value(snapshot.project, "code")} · {projectName}</Text><Text style={styles.calloutText}>{value(snapshot.project, "location")} · opdrachtgever: {value(snapshot.project, "client_name", "niet geregistreerd")} · {buildings.length} gebouwen · {parties.length} projectpartijen. Dit rapport gebruikt uitsluitend de centrale projectdata binnen de gekozen periode.</Text></View>
        <RecordRows rows={coverBuildings} empty="Geen gebouwen beschikbaar." /></> : null}

        {sections.has("management") ? <><Text style={styles.heading}>Managementsamenvatting</Text>
        <View style={styles.statGrid}>
          {[
            [snapshot.day_reports.length, "Dagrapporten"],
            [attendanceTotal, "Mensen/diensten totaal"],
            [snapshot.inspections.length, "Inspecties"],
            [openFindings.length, "Open bevindingen/NCR"],
            [snapshot.hse_events.length, "HSE-gebeurtenissen"],
            [register("delivery").length, "Leveringen"],
            [register("technical_instruction").length + register("site_instruction").length, "Technische instructies"],
            [register("change_order").length + register("variation").length, "Change orders"],
            [controlledDocuments.length, "Beheerde klantdocumenten"],
            [averageProgress, "Gem. issuevoortgang (%)"],
            [files.length, "Bestanden/foto's"],
            [buildings.length, "Gebouwen"],
          ].map(([number, label]) => <View style={styles.stat} key={String(label)}><Text style={styles.statNumber}>{number}</Text><Text style={styles.statLabel}>{label}</Text></View>)}
        </View></> : null}

        {sections.has("workforce") ? <><Text style={styles.heading}>Bezetting per discipline</Text>
        {workforce.length ? <>
          {workforce.slice(0, 6).map(([discipline, count]) => <View style={styles.row} key={discipline}><Text style={styles.rowNumber}>{count}</Text><Text style={styles.rowTitle}>{discipline}</Text></View>)}
          {workforce.length > 6 ? <Text style={styles.empty}>Nog {workforce.length - 6} disciplines staan in de bronregistraties.</Text> : null}
        </> : <Text style={styles.empty}>Geen bezetting geregistreerd.</Text>}</> : null}

        <Text style={styles.footer} fixed>CODECO Supervisie | bron: centraal, rechten-gefilterd periodsnapshot</Text>
      </Page>

      {sections.has("work") ? <Page size="A4" style={styles.page}>
        <ReportBrand label="DAGVERLOOP EN WERKZAAMHEDEN" logoSource={logoSource} />
        <Text style={styles.heading}>Dagverloop, werkzaamheden en voortgang</Text>
        {snapshot.day_reports.length ? snapshot.day_reports.map((report, index) => {
          const start = startsByReport.get(value(report, "id"));
          const closeout = closeoutsByReport.get(value(report, "id"));
          return <View style={styles.dailyCard} wrap={false} key={value(report, "id", String(index))}>
            <Text style={styles.dailyDate}>{formatDate(value(report, "report_date"))} | {value(report, "report_number")} | {humanizeToken(value(report, "status"))}</Text>
            <Text style={styles.dailySummary}>{closeout ? value(closeout, "day_summary", "Geen dagsamenvatting") : "Dagafsluiting nog niet bevestigd"}</Text>
            {start ? <Text style={styles.dailyDetail}>Weer: {value(start, "weather_condition")} · {value(start, "temperature_c")} °C · wind {value(start, "wind_condition")} | Werkuren: {value(start, "shift_start")}–{value(start, "shift_end")} | Gepland: {value(start, "planned_work")}</Text> : null}
            {closeout ? <Text style={styles.dailyDetail}>Uitgevoerd: {value(closeout, "work_performed", "-")} | Voortgang: {value(closeout, "progress_percent", "0")}% | Morgen: {value(closeout, "tomorrow_plan", "-")}</Text> : null}
            {closeout ? <Text style={styles.dailyDetail}>QC: {value(closeout, "inspection_result")} · {value(closeout, "quality_details", "geen afwijking")} | HSE: {value(closeout, "hse_event")} · {value(closeout, "hse_details", "geen bijzonderheden")} | Advies/besluit: {value(closeout, "communication", "-")}</Text> : null}
          </View>;
        }) : <Text style={styles.empty}>Geen dagrapporten in deze periode.</Text>}
        <Text style={styles.heading} minPresenceAhead={40}>Dagregistraties, activiteiten en locatie</Text><RecordRows rows={snapshot.registrations} />
        <Text style={styles.footer} fixed>CODECO Supervisie | dagverloop</Text>
      </Page> : null}

      <Page size="A4" style={styles.page}>
        <ReportBrand label="KWALITEIT EN VEILIGHEID" logoSource={logoSource} />
        {sections.has("quality") ? <><Text style={styles.heading}>Lessons learned / corrigerende standaard</Text><RecordRows rows={lessonsLearned} empty="Nog geen issuegebonden lessons learned in deze periode." /><Text style={styles.heading}>Inspecties</Text><RecordRows rows={snapshot.inspections} /><Text style={styles.heading}>Issue control, bevindingen, afwijkingen en NCR</Text><RecordRows rows={snapshot.findings.map((finding) => {
          const progress = progressByFinding.get(value(finding, "id"));
          return { ...finding, details: { disposition: progress ? value(progress, "disposition") : "", progress_percent: progress ? value(progress, "progress_percent") : "0", inspected_at: progress ? value(progress, "inspected_at") : "" } };
        })} /></> : null}
        {sections.has("hse") ? <><Text style={styles.heading}>HSE, incidenten en near misses</Text><RecordRows rows={snapshot.hse_events} /></> : null}
        {sections.has("environment") ? <><Text style={styles.heading}>Milieu, social en housekeeping</Text><RecordRows rows={register("environmental_report")} empty="Geen milieurapport of housekeepingobservatie in deze periode." /></> : null}
        {sections.has("actions") ? <><Text style={styles.heading}>Open deadlines en acties</Text><RecordRows rows={snapshot.open_actions} /></> : null}
        <Text style={styles.footer} fixed>CODECO Supervisie | kwaliteit en HSE</Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <ReportBrand label="PROJECTLOGS" logoSource={logoSource} />
        {sections.has("logistics") ? <><Text style={styles.heading}>Materialen en leveringen</Text><RecordRows rows={register("delivery")} /><Text style={styles.heading}>Vertragingen</Text><RecordRows rows={register("delay")} /></> : null}
        {sections.has("instructions") ? <><Text style={styles.heading}>Technische instructies</Text><RecordRows rows={[...register("technical_instruction"), ...register("site_instruction")]} /></> : null}
        {sections.has("commercial") ? <><Text style={styles.heading}>Change orders en meer-/minderwerk</Text><RecordRows rows={[...register("change_order"), ...register("variation")]} /></> : null}
        {sections.has("communications") ? <><Text style={styles.heading}>Afspraken, communicatie en besluiten</Text><RecordRows rows={[...register("agreement"), ...register("communication"), ...register("meeting")]} /></> : null}
        {sections.has("requests") ? <><Text style={styles.heading}>RFA, RFI en inspectieverzoeken</Text><RecordRows rows={[...register("rfa"), ...register("rfi"), ...register("inspection_request")]} /></> : null}
        {sections.has("documents") ? <><Text style={styles.heading}>Document control matrix</Text><RecordRows rows={controlledDocuments} empty="Geen beheerde klantdocumenten in deze periode." /></> : null}
        {sections.has("boq") ? <><Text style={styles.heading}>BOQ, voortgang en declaraties</Text><RecordRows rows={[...register("boq"), ...register("declaration"), ...register("cost")]} /></> : null}
        <Text style={styles.footer} fixed>CODECO Supervisie | projectlogs</Text>
      </Page>

      {sections.has("visual") ? <Page size="A4" style={styles.page}>
        <ReportBrand label="VISUEEL PROJECTDOSSIER" logoSource={logoSource} />
        <Text style={styles.heading}>Foto&apos;s en 360°-camerabeelden</Text>
        <RecordRows rows={snapshot.visual_captures} />
        <Text style={styles.footer} fixed>CODECO Supervisie | visueel bewijs</Text>
      </Page> : null}

      {sections.has("buildings") ? buildings.map((building, buildingIndex) => {
        const buildingId = value(building, "id");
        const buildingFindings = snapshot.findings.filter((item) => value(item, "building_id") === buildingId);
        const buildingInspections = snapshot.inspections.filter((item) => value(item, "building_id") === buildingId);
        const buildingRegisters = snapshot.register_entries.filter((item) => value(item, "building_id") === buildingId);
        const buildingVisuals = snapshot.visual_captures.filter((item) => value(item, "building_id") === buildingId);
        return <Page size="A4" style={styles.page} key={buildingId || String(buildingIndex)}>
          <ReportBrand label="GEBOUWVOORTGANG" logoSource={logoSource} />
          <Text style={styles.title}>{value(building, "code")} · {value(building, "name")}</Text>
          <Text style={styles.subtitle}>Gecombineerde gebouwstatus uit dagrapporten, inspecties, issues, beheerde documenten en visueel bewijs.</Text>
          <View style={styles.statGrid}>{[
            [buildingInspections.length, "Inspecties"],
            [buildingFindings.filter((item) => !["closed", "cancelled"].includes(value(item, "status"))).length, "Open issues"],
            [buildingRegisters.length, "Registerregels"],
            [buildingVisuals.length, "Visuele registraties"],
          ].map(([number, label]) => <View style={styles.stat} key={String(label)}><Text style={styles.statNumber}>{number}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View>
          <Text style={styles.heading}>Actuele inspecties en issuevoortgang</Text><RecordRows rows={[...buildingInspections, ...buildingFindings]} />
          <Text style={styles.heading}>Documenten, instructies en verzoeken</Text><RecordRows rows={buildingRegisters} />
          <Text style={styles.heading}>Visueel bewijs</Text><RecordRows rows={buildingVisuals} />
          <Text style={styles.footer} fixed>CODECO Supervisie | gebouwstatus</Text>
        </Page>;
      }) : null}
    </Document>
  );
}

export async function downloadPeriodReportPdf(snapshot: PeriodReportSnapshot, options: PeriodReportOptions = {}) {
  const blob = await pdf(<PeriodReportDocument snapshot={snapshot} options={options} />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `CODECO-${(options.reportTitle ?? "perioderapport").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${snapshot.period.start_date}-${snapshot.period.end_date}.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
