/**
 * The formal day report as the client's own 19-point form lays it out, built once from the
 * frozen snapshot and rendered by the PDF and the Word document alike.
 *
 * Only recorded data goes in. A figure that was never entered is "Niet geregistreerd", never
 * a default, and nothing is counted from a standard value. Tables use the same Dutch words as
 * the screens (lib/status-labels.ts), never a stored code.
 */
import { labelFor, partyTypeLabels, recordStatusLabels, recordTypeLabels, severityLabels } from "../status-labels.ts";
import { reportDay, reportDelayCause, reportInspection, reportVariation, reportWeather, reportWind } from "./report-vocabulary.ts";

export const NOT_RECORDED = "Niet geregistreerd";

type Row = Record<string, unknown>;

/** The rows of a frozen day report, in the shape `build_day_report_snapshot` writes them. */
export type ReportRecords = {
  report?: Row;
  project?: Row;
  created_by_profile?: Row;
  buildings?: Row[];
  parties?: Row[];
  start_checks?: Row[];
  closeouts?: Row[];
  attendance?: Row[];
  registrations?: Row[];
  inspections?: Row[];
  findings?: Row[];
  hse_events?: Row[];
  register_entries?: Row[];
  open_actions?: Row[];
  visual_captures?: Row[];
  file_manifest?: Row[];
};

export type ReportTable = { columns: string[]; rows: string[][]; widths?: number[] };

export type ReportSection = {
  number: number;
  title: string;
  /** Label / value lines above the table. */
  facts?: Array<[string, string]>;
  paragraphs?: string[];
  tables?: Array<{ caption?: string; table: ReportTable }>;
  /** Written signatures that belong to the section (the contractor's acknowledgement of a delay). */
  signatures?: Array<{ label: string; name: string; signedAt: string; image: string | null }>;
  /** Said when the section has no recorded content at all. */
  empty?: string;
};

export type ReportKpi = { label: string; value: string };

export type DailyReportModel = {
  kpis: ReportKpi[];
  head: Array<[string, string]>;
  sections: ReportSection[];
};

const INVISIBLE = [0x00ad, 0x2028, 0x2029, 0x2060, 0xfeff];

function stripInvisible(value: string) {
  let result = "";
  for (const character of value) {
    const code = character.codePointAt(0)!;
    // Soft hyphen, zero-width space/joiners, direction marks and line separators.
    if (INVISIBLE.includes(code) || (code >= 0x200b && code <= 0x200f)) continue;
    result += character;
  }
  return result;
}

/** Zero-width and soft-hyphen characters are invisible in the form and break text search. */
export function cleanReportText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return stripInvisible(String(value)).replace(/[ \t]+\n/g, "\n").trim();
}

const text = cleanReportText;
const rows = (value: Row[] | undefined) => Array.isArray(value) ? value : [];

/** "1 persoon", "2 personen". */
export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function hhmm(value: unknown) {
  const raw = text(value);
  return /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : raw;
}

function timeOnly(iso: unknown) {
  const raw = text(iso);
  if (!raw) return "";
  const moment = new Date(raw);
  if (Number.isNaN(moment.getTime())) return raw;
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(moment);
}

function dayOnly(iso: unknown) {
  const raw = text(iso);
  if (!raw) return NOT_RECORDED;
  const moment = new Date(raw);
  if (Number.isNaN(moment.getTime())) return raw;
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(moment);
}

const statusWord = (code: unknown) => labelFor(recordStatusLabels, text(code), "nl", NOT_RECORDED);
const severityWord = (code: unknown) => labelFor(severityLabels, text(code), "nl", NOT_RECORDED);
const typeWord = (code: unknown) => labelFor(recordTypeLabels, text(code), "nl", NOT_RECORDED);

function table(columns: string[], body: string[][], widths?: number[]): ReportTable {
  return { columns, rows: body, widths };
}

const orDash = (value: unknown) => text(value) || "—";

export function buildDailyReportModel(records: ReportRecords): DailyReportModel {
  const report = records.report ?? {};
  const project = records.project ?? {};
  const buildingName = new Map(rows(records.buildings).map((building) => [text(building.id), text(building.name)]));
  const partyName = new Map(rows(records.parties).map((party) => [text(party.id), text(party.name)]));
  const building = (id: unknown) => buildingName.get(text(id)) || "—";
  const parties = (type: string) => rows(records.parties).filter((party) => party.party_type === type).map((party) => text(party.name));
  const starts = rows(records.start_checks);
  const closeouts = rows(records.closeouts);
  const attendance = rows(records.attendance);
  const inspections = rows(records.inspections);
  const findings = rows(records.findings).filter((row) => row.status !== "cancelled");
  const hse = rows(records.hse_events).filter((row) => row.status !== "cancelled");
  const registers = rows(records.register_entries);
  const openActions = rows(records.open_actions);
  const captures = rows(records.visual_captures);
  const reportDate = text(report.report_date);

  // ---- attendance -----------------------------------------------------------------------
  const workers = attendance.filter((entry) => entry.entry_type !== "visitor");
  const visitors = attendance.filter((entry) => entry.entry_type === "visitor");
  const workerTotal = workers.reduce((total, entry) => total + (Number(entry.headcount) || 0), 0);
  const attendanceByGroup = new Map<string, { organisation: string; discipline: string; building: string; headcount: number }>();
  for (const entry of workers) {
    const organisation = partyName.get(text(entry.party_id)) || NOT_RECORDED;
    const discipline = text(entry.discipline) || NOT_RECORDED;
    const buildingLabel = building(entry.building_id);
    const key = `${organisation}|${discipline}|${buildingLabel}`;
    const group = attendanceByGroup.get(key) ?? { organisation, discipline, building: buildingLabel, headcount: 0 };
    group.headcount += Number(entry.headcount) || 0;
    attendanceByGroup.set(key, group);
  }

  // ---- delays ---------------------------------------------------------------------------
  const delayRows: string[][] = [];
  for (const closeout of closeouts) {
    const cause = text(closeout.delay_cause);
    if (!cause || cause === "none") continue;
    delayRows.push([building(closeout.building_id), reportDelayCause(cause), text(closeout.delay_hours) ? `${Number(closeout.delay_hours)} uur` : NOT_RECORDED, orDash(closeout.delay_reason)]);
  }
  for (const entry of registers.filter((row) => row.register_type === "delay")) {
    const details = (entry.details ?? {}) as Row;
    delayRows.push([building(entry.building_id), text(entry.title) || "Vertraging", text(details.hours) ? `${Number(details.hours)} uur` : NOT_RECORDED, orDash(details.description)]);
  }
  const weatherDelayHours = closeouts
    .filter((closeout) => closeout.delay_cause === "weather")
    .reduce((total, closeout) => total + (Number(closeout.delay_hours) || 0), 0);

  // ---- progress -------------------------------------------------------------------------
  const progressEntered = closeouts.filter((closeout) => closeout.progress_percent !== null && closeout.progress_percent !== undefined && closeout.progress_percent !== "");
  const progressAverage = progressEntered.length
    ? progressEntered.reduce((total, closeout) => total + Number(closeout.progress_percent), 0) / progressEntered.length
    : null;

  const criticalFindings = findings.filter((row) => row.severity === "critical").length;
  const incidents = hse.filter((row) => row.event_type === "incident").length;
  const nearMisses = hse.filter((row) => row.event_type === "near_miss").length;
  const photoCount = captures.length;

  const kpis: ReportKpi[] = [
    { label: "Voortgang", value: progressAverage === null ? NOT_RECORDED : `${Math.round(progressAverage)}%${progressEntered.length > 1 ? ` (gem. ${progressEntered.length} gebouwen)` : ""}` },
    { label: "Inspecties", value: String(inspections.length) },
    { label: "Afwijkingen", value: String(findings.length) },
    { label: "Kritiek", value: String(criticalFindings) },
    { label: "Incidenten", value: String(incidents) },
    { label: "Open acties", value: String(openActions.length) },
    { label: "Foto's", value: String(photoCount) },
    { label: "Weervertraging", value: weatherDelayHours ? `${weatherDelayHours} uur` : "0 uur" },
    { label: "Arbeiders", value: attendance.length ? String(workerTotal) : NOT_RECORDED },
    { label: "Machines", value: NOT_RECORDED },
  ];

  // ---- head and weather -----------------------------------------------------------------
  const weatherLines = starts.map((start) => [
    building(start.building_id),
    start.weather_condition ? reportWeather(text(start.weather_condition)) : NOT_RECORDED,
    start.temperature_c !== null && start.temperature_c !== undefined ? `${Number(start.temperature_c)} °C` : NOT_RECORDED,
    // Cloud cover and rainfall are not captured separately; the condition above covers them.
    NOT_RECORDED,
    NOT_RECORDED,
    start.wind_condition ? reportWind(text(start.wind_condition)) : NOT_RECORDED,
    start.shift_start ? `${hhmm(start.shift_start)}–${hhmm(start.shift_end)}` : NOT_RECORDED,
  ]);
  const listOf = (names: string[]) => names.length ? names.join(", ") : NOT_RECORDED;
  const head: Array<[string, string]> = [
    ["Rapport", text(report.report_number) || NOT_RECORDED],
    ["Datum", reportDay(reportDate) || NOT_RECORDED],
    ["Project", [text(project.code), text(project.name)].filter(Boolean).join(" · ") || NOT_RECORDED],
    ["Locatie", text(project.location) || NOT_RECORDED],
    ["Opdrachtgever", text(project.client_name) || listOf(parties("client"))],
    ["Aannemer", listOf([...parties("contractor")])],
    ["Supervisor", text(records.created_by_profile?.display_name) || listOf(parties("supervisor"))],
  ];

  const sections: ReportSection[] = [];

  sections.push({
    number: 1,
    title: "Projectgegevens, weer en werktijden",
    facts: head,
    tables: [{
      caption: "Weer en werktijden per gebouw",
      table: table(["Gebouw", "Conditie", "Temperatuur", "Bewolking", "Regen", "Wind", "Werktijden"], weatherLines, [14, 16, 14, 14, 10, 14, 18]),
    }],
    empty: weatherLines.length ? undefined : "Projectstart niet ingevuld: weer en werktijden zijn niet geregistreerd.",
  });

  const summaries = closeouts.map((closeout) => [building(closeout.building_id), orDash(closeout.day_summary)]);
  sections.push({
    number: 2,
    title: "Samenvatting van de dag",
    tables: summaries.length ? [{ table: table(["Gebouw", "Samenvatting"], summaries, [20, 80]) }] : undefined,
    empty: summaries.length ? undefined : NOT_RECORDED,
  });

  sections.push({
    number: 3,
    title: "Aanwezigheid per organisatie en discipline",
    facts: [
      ["Arbeiders aanwezig", attendance.length ? plural(workerTotal, "persoon", "personen") : NOT_RECORDED],
      ["Bezoekers", visitors.length ? plural(visitors.length, "bezoeker", "bezoekers") : "Geen"],
      ["Verwachte bezetting", starts.some((start) => start.expected_workers !== null && start.expected_workers !== undefined)
        ? plural(starts.reduce((total, start) => total + (Number(start.expected_workers) || 0), 0), "persoon", "personen")
        : NOT_RECORDED],
    ],
    tables: attendanceByGroup.size
      ? [{ table: table(["Organisatie", "Discipline", "Gebouw", "Aantal"], Array.from(attendanceByGroup.values()).map((group) => [group.organisation, group.discipline, group.building, String(group.headcount)]), [34, 28, 24, 14]) }]
      : undefined,
  });

  const workRows = closeouts.flatMap((closeout) => {
    const lines = [
      ...(text(closeout.work_ongoing) ? [["Lopend", text(closeout.work_ongoing)]] : []),
      ...(text(closeout.work_performed) ? [["Afgerond", text(closeout.work_performed)]] : []),
    ];
    const progress = closeout.progress_percent === null || closeout.progress_percent === undefined || closeout.progress_percent === "" ? NOT_RECORDED : `${Number(closeout.progress_percent)}%`;
    return lines.map(([state, activity]) => [activity, building(closeout.building_id), state, progress]);
  });
  sections.push({
    number: 4,
    title: "Werkzaamheden",
    tables: workRows.length ? [{ table: table(["Activiteit", "Locatie", "Stand", "% gereed"], workRows, [50, 20, 15, 15]) }] : undefined,
    empty: workRows.length ? undefined : NOT_RECORDED,
  });

  sections.push({
    number: 5,
    title: "Inspecties",
    facts: closeouts.length ? closeouts.map((closeout): [string, string] => [building(closeout.building_id), reportInspection(text(closeout.inspection_result) || "none")]) : undefined,
    tables: inspections.length
      ? [{ table: table(["Nr", "Omschrijving", "Gebouw", "Status", "Resultaat / meetwaarde"], inspections.map((inspection) => [
        text(inspection.inspection_number),
        text(inspection.title),
        building(inspection.building_id),
        statusWord(inspection.status),
        NOT_RECORDED,
      ]), [14, 36, 18, 14, 18]) }]
      : undefined,
    empty: inspections.length ? undefined : "Geen inspecties vastgelegd.",
  });

  sections.push({
    number: 6,
    title: "Kwaliteitsbevindingen",
    tables: findings.length
      ? [{
        caption: "— betekent: niet geregistreerd",
        table: table(["Nr", "Omschrijving", "Ernst", "Status", "Locatie", "Foto · tekening", "Verantwoordelijke", "Deadline"], findings.map((finding) => [
          text(finding.finding_number),
          text(finding.title),
          severityWord(finding.severity),
          statusWord(finding.status),
          building(finding.building_id),
          "—",
          partyName.get(text(finding.responsible_party_id)) || "—",
          finding.due_at ? dayOnly(finding.due_at) : "—",
        ]), [9, 25, 9, 12, 12, 9, 14, 10]),
      }]
      : undefined,
    empty: findings.length ? undefined : "Geen kwaliteitsbevindingen vastgelegd.",
  });

  const hseRows = (list: Row[]) => list.map((event) => [
    text(event.event_number),
    typeWord(event.event_type),
    text(event.title),
    severityWord(event.severity),
    statusWord(event.status),
    building(event.building_id),
    orDash(event.immediate_measure ?? event.immediate_actions),
  ]);
  const hseColumns = ["Nr", "Soort", "Omschrijving", "Ernst", "Status", "Gebouw", "Directe maatregel"];
  const hseWidths = [10, 13, 25, 9, 12, 13, 18];
  const hseWithoutNearMiss = hse.filter((event) => event.event_type !== "near_miss");
  const nearMissEvents = hse.filter((event) => event.event_type === "near_miss");
  sections.push({
    number: 7,
    title: "HSE",
    facts: [
      ["HSE-checklist (PBM, steigers, valbeveiliging)", NOT_RECORDED],
      ["Incidenten", String(incidents)],
      ["Near misses", String(nearMisses)],
    ],
    tables: [
      ...(hseWithoutNearMiss.length ? [{ caption: "HSE-meldingen", table: table(hseColumns, hseRows(hseWithoutNearMiss), hseWidths) }] : []),
      ...(nearMissEvents.length ? [{ caption: "Near misses", table: table(hseColumns, hseRows(nearMissEvents), hseWidths) }] : []),
    ],
  });

  const equipment = [
    ...closeouts.filter((closeout) => text(closeout.equipment_status)).map((closeout) => [building(closeout.building_id), text(closeout.equipment_status), "—"]),
    ...registers.filter((row) => row.register_type === "equipment").map((row) => [building(row.building_id), text(row.title), statusWord(row.status)]),
  ];
  sections.push({
    number: 8,
    title: "Materieel",
    tables: equipment.length ? [{ table: table(["Gebouw", "Materieel / stand", "Status"], equipment, [20, 62, 18]) }] : undefined,
    empty: equipment.length ? undefined : NOT_RECORDED,
  });

  const deliveries = [
    ...closeouts.filter((closeout) => text(closeout.deliveries)).map((closeout) => [building(closeout.building_id), text(closeout.deliveries), "—", "—"]),
    ...registers.filter((row) => row.register_type === "delivery").flatMap((row) => {
      const details = (row.details ?? {}) as Row;
      const lines = Array.isArray(details.lines) ? details.lines as Row[] : [];
      const supplier = text(details.supplier) || partyName.get(text(row.responsible_party_id)) || "—";
      if (!lines.length) return [[building(row.building_id), text(row.title), "—", supplier]];
      return lines.map((line) => [
        building(row.building_id),
        [text(row.title), text(line.description)].filter(Boolean).join(" · "),
        [text(line.quantity), text(line.unit)].filter(Boolean).join(" ") || "—",
        supplier,
      ]);
    }),
  ];
  sections.push({
    number: 9,
    title: "Leveringen",
    tables: deliveries.length ? [{ table: table(["Gebouw", "Omschrijving", "Hoeveelheid", "Leverancier"], deliveries, [16, 46, 18, 20]) }] : undefined,
    empty: deliveries.length ? undefined : NOT_RECORDED,
  });

  const tests = [
    ...closeouts.filter((closeout) => text(closeout.tests_measurements)).map((closeout) => [building(closeout.building_id), text(closeout.tests_measurements), "—"]),
    ...registers.filter((row) => row.register_type === "test").map((row) => [building(row.building_id), text(row.title), statusWord(row.status)]),
  ];
  sections.push({
    number: 10,
    title: "Testen en metingen",
    tables: tests.length ? [{ table: table(["Gebouw", "Test / meting en resultaat", "Status"], tests, [20, 62, 18]) }] : undefined,
    empty: tests.length ? undefined : NOT_RECORDED,
  });

  const variations = [
    ...closeouts.filter((closeout) => closeout.variation_work_status && closeout.variation_work_status !== "none").map((closeout) => [building(closeout.building_id), "Dagafsluiting", reportVariation(text(closeout.variation_work_status))]),
    ...registers.filter((row) => ["variation", "change_order"].includes(text(row.register_type))).map((row) => [building(row.building_id), `${text(row.entry_number)} ${text(row.title)}`.trim(), statusWord(row.status)]),
  ];
  sections.push({
    number: 11,
    title: "Meer- en minderwerk",
    tables: variations.length ? [{ table: table(["Gebouw", "Omschrijving", "Status"], variations, [20, 62, 18]) }] : undefined,
    empty: variations.length ? undefined : "Geen meer- of minderwerk vastgelegd.",
  });

  const delaySignatures = closeouts
    .filter((closeout) => closeout.delay_cause && closeout.delay_cause !== "none" && text(closeout.contractor_signed_by))
    .map((closeout) => ({
      label: `Aannemer · ${building(closeout.building_id)}${text(closeout.contractor_company) ? ` · ${text(closeout.contractor_company)}` : ""}`,
      name: text(closeout.contractor_signed_by),
      signedAt: text(closeout.contractor_signed_at),
      image: text(closeout.contractor_signature_image) || null,
    }));
  sections.push({
    number: 12,
    title: "Vertragingen",
    signatures: delaySignatures.length ? delaySignatures : undefined,
    tables: delayRows.length ? [{ table: table(["Gebouw", "Oorzaak", "Duur", "Toelichting"], delayRows, [16, 24, 12, 48]) }] : undefined,
    empty: delayRows.length ? undefined : "Geen vertraging gemeld.",
  });

  const communication = closeouts.filter((closeout) => text(closeout.communication)).map((closeout) => [building(closeout.building_id), text(closeout.communication)]);
  sections.push({
    number: 13,
    title: "Communicatie",
    tables: communication.length ? [{ table: table(["Gebouw", "Mededeling"], communication, [20, 80]) }] : undefined,
    empty: communication.length ? undefined : NOT_RECORDED,
  });

  sections.push({
    number: 14,
    title: "Openstaande acties",
    tables: openActions.length
      ? [{
        table: table(["Nr", "Actie", "Verantwoordelijke", "Deadline", "Status"], openActions.map((action) => [
          text(action.action_number),
          text(action.title),
          partyName.get(text(action.owner_party_id)) || "—",
          action.due_at ? dayOnly(action.due_at) : "—",
          statusWord(action.status),
        ]), [12, 42, 20, 14, 12]),
      }]
      : undefined,
    empty: openActions.length ? undefined : "Geen openstaande acties.",
  });

  const risks = [
    ...closeouts.filter((closeout) => text(closeout.risks)).map((closeout) => [building(closeout.building_id), text(closeout.risks)]),
    ...starts.filter((start) => text(start.risk_notes)).map((start) => [building(start.building_id), text(start.risk_notes)]),
    ...registers.filter((row) => row.register_type === "risk").map((row) => [building(row.building_id), text(row.title)]),
  ];
  sections.push({
    number: 15,
    title: "Risico's",
    tables: risks.length ? [{ table: table(["Gebouw", "Risico"], risks, [20, 80]) }] : undefined,
    empty: risks.length ? undefined : NOT_RECORDED,
  });

  const tomorrow = closeouts.filter((closeout) => text(closeout.tomorrow_plan)).map((closeout) => [building(closeout.building_id), text(closeout.tomorrow_plan)]);
  sections.push({
    number: 16,
    title: "Planning morgen",
    tables: tomorrow.length ? [{ table: table(["Gebouw", "Planning"], tomorrow, [20, 80]) }] : undefined,
    empty: tomorrow.length ? undefined : NOT_RECORDED,
  });

  const fileById = new Map(rows(records.file_manifest).map((file) => [text(file.id), file]));
  sections.push({
    number: 17,
    title: "Foto's",
    tables: captures.length
      ? [{
        caption: "GPS wordt niet bij een foto vastgelegd.",
        table: table(["Nr", "Tijd", "GPS", "Locatie", "Omschrijving", "Categorie"], captures.map((capture, index) => [
          String(index + 1),
          timeOnly(capture.captured_at) || "—",
          NOT_RECORDED,
          [building(capture.building_id), text(capture.location_label)].filter((part) => part && part !== "—").join(" · ") || "—",
          [text(capture.title), text(capture.description)].filter(Boolean).join(" · "),
          capture.capture_type === "panorama" ? "360°-beeld" : text(fileById.get(text(capture.file_id))?.category) === "drawing" ? "Tekening" : "Foto",
        ]), [6, 8, 16, 24, 34, 12]),
      }]
      : undefined,
    empty: captures.length ? undefined : "Geen foto's vastgelegd voor deze dag.",
  });

  const attachments = rows(records.file_manifest).filter((file) => {
    if (text(file.category) === "photo") return false;
    const created = text(file.created_at).slice(0, 10);
    return !reportDate || !created || created === reportDate;
  });
  sections.push({
    number: 18,
    title: "Bijlagen",
    facts: [["Bijlagen gecontroleerd", closeouts.length ? (closeouts.every((closeout) => closeout.attachments_confirmed === true) ? "Door supervisor gecontroleerd" : "Nog niet bevestigd") : NOT_RECORDED]],
    tables: attachments.length
      ? [{ table: table(["Bestand", "Soort", "Datum"], attachments.map((file) => [text(file.original_name), typeWord(file.category), dayOnly(file.created_at)]), [58, 22, 20]) }]
      : undefined,
  });

  // Item 19, the signatures, is drawn by the renderer from the recorded declarations.
  return { kpis, head, sections };
}

/** Wording used by the renderers for the party types in a project head. */
export const partyTypeWord = (code: string) => labelFor(partyTypeLabels, code, "nl");
