import { Document, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import {
  brandHeader,
  documentFooter,
  downloadDocxBlob,
  loadLogoImageBytes,
  metadataTable,
  sectionHeading,
} from "@/lib/reports/docx-shared";
import { allPeriodReportSections, type PeriodReportOptions } from "@/lib/reports/period-report-pdf";
import type { PeriodReportSnapshot } from "@/lib/supabase/operations";

function value(record: Record<string, unknown>, key: string, fallback = "") {
  const result = record[key];
  if (result === null || result === undefined) return fallback;
  if (typeof result === "string" || typeof result === "number") return String(result);
  return fallback;
}

function formatDate(dateValue: string) {
  if (!dateValue) return "Geen datum";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? new Date(`${dateValue}T12:00:00-03:00`) : new Date(dateValue);
  return new Intl.DateTimeFormat("nl-SR", { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(date);
}

function humanizeToken(result: string) {
  return result.replaceAll("_", " ");
}

function nested(record: Record<string, unknown>, key: string) {
  const result = record[key];
  return result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {};
}

function detailsText(record: Record<string, unknown>) {
  const details = record.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const values = details as Record<string, unknown>;
  const preferredKeys = [
    "building_name", "requested_to", "due_date", "revision", "related_reference", "reference_documents",
    "attachments", "discipline", "priority", "schedule_impact", "cost_impact", "period_start", "period_end",
    "description", "corrective_action", "disposition", "progress_percent", "inspected_at", "status",
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

function heading(title: string): Paragraph {
  return sectionHeading(title);
}

function recordRows(rows: Array<Record<string, unknown>>, empty = "Geen registraties in deze periode."): Paragraph[] {
  if (!rows.length) return [new Paragraph({ children: [new TextRun({ text: empty, italics: true, color: "74848D", size: 16 })], spacing: { after: 120 } })];
  return rows.map((row, index) => {
    const number = value(row, "entry_number", value(row, "finding_number", value(row, "inspection_number", value(row, "event_number", `#${index + 1}`))));
    const title = value(row, "title", value(row, "day_summary", "Registratie"));
    const meta = [humanizeToken(value(row, "status")), humanizeToken(value(row, "severity")), value(row, "occurred_at") ? formatDate(value(row, "occurred_at")) : "", detailsText(row)].filter(Boolean).join(" | ");
    return new Paragraph({
      children: [
        new TextRun({ text: `${number} · `, bold: true, color: "A52B24", size: 16 }),
        new TextRun({ text: title, bold: true, size: 16 }),
        ...(meta ? [new TextRun({ text: `\n${meta}`, color: "65747D", size: 15 })] : []),
      ],
      spacing: { after: 100 },
    });
  });
}

function statTable(stats: Array<[number | string, string]>): Table {
  const perRow = 4;
  const rows: TableRow[] = [];
  for (let index = 0; index < stats.length; index += perRow) {
    const chunk = stats.slice(index, index + perRow);
    const cells = chunk.map(([number, label]) => new TableCell({
      width: { size: 100 / perRow, type: WidthType.PERCENTAGE },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [
        new Paragraph({ children: [new TextRun({ text: String(number), bold: true, color: "14755D", size: 26 })] }),
        new Paragraph({ children: [new TextRun({ text: label, color: "5E707B", size: 14 })] }),
      ],
    }));
    while (cells.length < perRow) cells.push(new TableCell({ width: { size: 100 / perRow, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [] })] }));
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

export function buildPeriodReportDocxDocument(snapshot: PeriodReportSnapshot, options: PeriodReportOptions, logoBytes: ArrayBuffer): Document {
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
    return action ? [{ id: value(finding, "id"), entry_number: value(issue, "source_catalog_subject", value(finding, "finding_number")), title: value(finding, "title"), status: value(finding, "status"), details: { corrective_action: action } }] : [];
  });
  const progressByFinding = new Map<string, Record<string, unknown>>();
  findingProgressUpdates.forEach((progress) => progressByFinding.set(value(progress, "finding_id"), progress));
  const averageProgress = findingProgressUpdates.length
    ? Math.round(findingProgressUpdates.reduce((total, progress) => total + Number(progress.progress_percent ?? 0), 0) / findingProgressUpdates.length)
    : 0;

  const children: Array<Paragraph | Table> = [
    ...brandHeader(logoBytes, options.reportTitle ?? "Perioderapport", "Dagelijks, wekelijks, maandelijks of vrij gekozen periode met zelfgekozen rapportonderdelen uit hetzelfde gecontroleerde projectdossier."),
    metadataTable([
      ["Project", projectName],
      ["Periode", `${formatDate(snapshot.period.start_date)} t/m ${formatDate(snapshot.period.end_date)}`],
      ["Gegenereerd", formatDate(snapshot.generated_at)],
    ], 3),
  ];

  if (sections.has("management")) {
    children.push(
      heading("Projectachtergrond en rapportbasis"),
      new Paragraph({ children: [new TextRun({ text: `${value(snapshot.project, "code")} · ${projectName}`, bold: true, size: 18 })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: `${value(snapshot.project, "location")} · opdrachtgever: ${value(snapshot.project, "client_name", "niet geregistreerd")} · ${buildings.length} gebouwen · ${parties.length} projectpartijen.`, color: "5E583D", size: 15 })], spacing: { after: 120 } }),
      heading("Managementsamenvatting"),
      statTable([
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
      ]),
    );
  }

  if (sections.has("workforce")) {
    children.push(heading("Bezetting per discipline"));
    if (workforce.length) {
      workforce.slice(0, 6).forEach(([discipline, count]) => children.push(new Paragraph({ children: [new TextRun({ text: `${count} · ${discipline}`, size: 16 })], spacing: { after: 40 } })));
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: "Geen bezetting geregistreerd.", italics: true, size: 16 })] }));
    }
  }

  if (sections.has("work")) {
    children.push(heading("Dagverloop, werkzaamheden en voortgang"));
    if (snapshot.day_reports.length) {
      snapshot.day_reports.forEach((report) => {
        const start = startsByReport.get(value(report, "id"));
        const closeout = closeoutsByReport.get(value(report, "id"));
        children.push(new Paragraph({
          children: [new TextRun({ text: `${formatDate(value(report, "report_date"))} · ${value(report, "report_number")} · ${humanizeToken(value(report, "status"))}`, bold: true, color: "A52B24", size: 16 })],
          spacing: { before: 100 },
        }));
        children.push(new Paragraph({ children: [new TextRun({ text: closeout ? value(closeout, "day_summary", "Geen dagsamenvatting") : "Dagafsluiting nog niet bevestigd", size: 16 })] }));
        if (start) children.push(new Paragraph({ children: [new TextRun({ text: `Weer: ${value(start, "weather_condition")} · ${value(start, "temperature_c")} °C · wind ${value(start, "wind_condition")} | Werkuren: ${value(start, "shift_start")}–${value(start, "shift_end")} | Gepland: ${value(start, "planned_work")}`, color: "5E707B", size: 14 })] }));
        if (closeout) children.push(new Paragraph({ children: [new TextRun({ text: `Lopend: ${value(closeout, "work_ongoing", "-")} | Afgerond: ${value(closeout, "work_performed", "-")} | Voortgang: ${value(closeout, "progress_percent", "0")}% | Morgen: ${value(closeout, "tomorrow_plan", "-")}`, color: "5E707B", size: 14 })], spacing: { after: 100 } }));
      });
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: "Geen dagrapporten in deze periode.", italics: true, size: 16 })] }));
    }
    children.push(heading("Dagregistraties, activiteiten en locatie"), ...recordRows(snapshot.registrations));
  }

  if (sections.has("quality")) {
    children.push(
      heading("Lessons learned / corrigerende standaard"), ...recordRows(lessonsLearned, "Nog geen issuegebonden lessons learned in deze periode."),
      heading("Inspecties"), ...recordRows(snapshot.inspections),
      heading("Issue control, bevindingen, afwijkingen en NCR"), ...recordRows(snapshot.findings.map((finding) => {
        const progress = progressByFinding.get(value(finding, "id"));
        return { ...finding, details: { disposition: progress ? value(progress, "disposition") : "", progress_percent: progress ? value(progress, "progress_percent") : "0", inspected_at: progress ? value(progress, "inspected_at") : "" } };
      })),
    );
  }
  if (sections.has("hse")) children.push(heading("HSE, incidenten en near misses"), ...recordRows(snapshot.hse_events));
  if (sections.has("environment")) children.push(heading("Milieu, social en housekeeping"), ...recordRows(register("environmental_report"), "Geen milieurapport of housekeepingobservatie in deze periode."));
  if (sections.has("actions")) children.push(heading("Open deadlines en acties"), ...recordRows(snapshot.open_actions));
  if (sections.has("logistics")) children.push(heading("Materialen en leveringen"), ...recordRows(register("delivery")), heading("Vertragingen"), ...recordRows(register("delay")));
  if (sections.has("instructions")) children.push(heading("Technische instructies"), ...recordRows([...register("technical_instruction"), ...register("site_instruction")]));
  if (sections.has("commercial")) children.push(heading("Change orders en meer-/minderwerk"), ...recordRows([...register("change_order"), ...register("variation")]));
  if (sections.has("communications")) children.push(heading("Afspraken, communicatie en besluiten"), ...recordRows([...register("agreement"), ...register("communication"), ...register("meeting")]));
  if (sections.has("requests")) children.push(heading("RFA, RFI en inspectieverzoeken"), ...recordRows([...register("rfa"), ...register("rfi"), ...register("inspection_request")]));
  if (sections.has("documents")) children.push(heading("Document control matrix"), ...recordRows(controlledDocuments, "Geen beheerde klantdocumenten in deze periode."));
  if (sections.has("boq")) children.push(heading("BOQ, voortgang en declaraties"), ...recordRows([...register("boq"), ...register("declaration"), ...register("cost")]));
  if (sections.has("visual")) children.push(heading("Foto's en 360°-camerabeelden"), ...recordRows(snapshot.visual_captures));

  if (sections.has("buildings")) {
    buildings.forEach((building) => {
      const buildingId = value(building, "id");
      const buildingFindings = snapshot.findings.filter((item) => value(item, "building_id") === buildingId);
      const buildingInspections = snapshot.inspections.filter((item) => value(item, "building_id") === buildingId);
      const buildingRegisters = snapshot.register_entries.filter((item) => value(item, "building_id") === buildingId);
      const buildingVisuals = snapshot.visual_captures.filter((item) => value(item, "building_id") === buildingId);
      children.push(
        heading(`${value(building, "code")} · ${value(building, "name")}`),
        statTable([
          [buildingInspections.length, "Inspecties"],
          [buildingFindings.filter((item) => !["closed", "cancelled"].includes(value(item, "status"))).length, "Open issues"],
          [buildingRegisters.length, "Registerregels"],
          [buildingVisuals.length, "Visuele registraties"],
        ]),
        new Paragraph({ children: [new TextRun({ text: "Actuele inspecties en issuevoortgang", bold: true, size: 16 })], spacing: { before: 100 } }),
        ...recordRows([...buildingInspections, ...buildingFindings]),
        new Paragraph({ children: [new TextRun({ text: "Documenten, instructies en verzoeken", bold: true, size: 16 })], spacing: { before: 100 } }),
        ...recordRows(buildingRegisters),
      );
    });
  }

  return new Document({
    title: `${options.reportTitle ?? "Perioderapport"} ${projectName}`,
    creator: "CODECO N.V.",
    sections: [{ footers: { default: documentFooter("CODECO Supervisie · bron: centraal, rechten-gefilterd periodsnapshot") }, children }],
  });
}

export async function downloadPeriodReportDocx(snapshot: PeriodReportSnapshot, options: PeriodReportOptions = {}): Promise<void> {
  const logoBytes = await loadLogoImageBytes();
  const doc = buildPeriodReportDocxDocument(snapshot, options, logoBytes);
  const filename = `CODECO-${(options.reportTitle ?? "perioderapport").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${snapshot.period.start_date}-${snapshot.period.end_date}.docx`;
  await downloadDocxBlob(doc, filename);
}
