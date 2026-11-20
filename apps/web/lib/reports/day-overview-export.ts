import { specFacts, specForms, type SpecFormKey, type SpecValues } from "../forms/spec-forms.ts";
import { specLabel } from "../forms/spec-labels-nl.ts";
/**
 * The day report the user exports from Reports · Day overview. It is built from exactly the
 * records the screen shows for that day, so the file and the screen can never disagree: every
 * form of Workspace gets its own section — with its count, also when nothing was recorded —
 * and every record carries its own boxes and the signatures that were written on it.
 *
 * Pure: the screen hands in the records and the words; the PDF and the Word file only lay
 * the result out (day-overview-pdf.tsx, day-overview-docx.ts).
 */

type Translate = (en: string, nl: string) => string;
type Row = Record<string, unknown>;

export type DayExportSignature = { label: string; name: string; signedAt: string; image: string | null };
/** One event of the record's sign-off history, oldest first. */
export type DayExportHistory = { line: string; comments: string; signature: string | null };
export type DayExportItem = {
  code: string;
  title: string;
  status: string;
  facts: Array<[string, string]>;
  signatures: DayExportSignature[];
  /** The chronological sign-off history (Sign-off sheet: exported with the form record). */
  history?: DayExportHistory[];
};
export type DayExportPhoto = { title: string; meta: string; image: string | null };
export type DayExportSection = {
  key: string;
  title: string;
  count: number;
  /** Shown above the records, e.g. the workforce total. */
  summary?: string;
  table?: { columns: string[]; rows: string[][] };
  items: DayExportItem[];
  photos?: DayExportPhoto[];
};
export type DayExportDocument = {
  title: string;
  subtitle: string;
  head: Array<[string, string]>;
  sections: DayExportSection[];
  /** "Nothing recorded" line, in the words of the form names. */
  emptyNote: string;
  footer: string;
  fileName: string;
  /** Heading of each record's sign-off history. */
  historyTitle?: string;
};

const clean = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "✓" : "";
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value).replace(/\s+\n/g, "\n").trim();
};

/** A stored code ("to_be_corrected") as words ("To be corrected"); prose stays as written. */
export function humanize(value: unknown): string {
  if (Array.isArray(value)) return value.map(humanize).filter(Boolean).join(", ");
  const text = clean(value);
  if (!text || /\s/.test(text) || !/^[a-z0-9_]+$/.test(text)) return text;
  const words = text.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const isDataImage = (value: unknown) => typeof value === "string" && value.startsWith("data:image/");

/**
 * The boxes a register record can carry in its details, in the order a reader expects them,
 * with the words of the form. A box that is empty on the record is left out; a box nobody
 * knows yet is never invented.
 */
const registerDetailLabels: Array<[string, string, string]> = [
  ["description", "Description / request", "Omschrijving / verzoek"],
  ["discipline", "Discipline", "Discipline"],
  ["requested_to", "To", "Aan"],
  ["requested_by", "Requested by", "Aangevraagd door"],
  ["change_order_type", "Change order type", "Type wijzigingsopdracht"],
  ["scope_areas", "Scope of change", "Omvang van de wijziging"],
  ["scope_area_other", "Scope · other", "Scope · overig"],
  ["affects_schedule", "Affects the schedule", "Invloed op de planning"],
  ["original_finish_date", "Original finish date", "Oorspronkelijke einddatum"],
  ["extension_days", "Extension of time (days)", "Termijnverlenging (dagen)"],
  ["new_expected_finish_date", "New expected finish date", "Nieuwe verwachte einddatum"],
  ["cost_impact", "Cost impact", "Kostenimpact"],
  ["cost_impact_explanation", "Cost explanation", "Toelichting kosten"],
  ["schedule_impact", "Schedule impact", "Planningimpact"],
  ["impact_explanation", "Impact explanation", "Toelichting impact"],
  ["outcome", "Outcome", "Resultaat"],
  ["activity", "Activity / work affected", "Activiteit / getroffen werk"],
  ["delay_duration_days", "Delay (calendar days)", "Vertraging (kalenderdagen)"],
  ["delay_categories", "Delay category", "Categorie van de vertraging"],
  ["delay_types", "Delay type", "Soort vertraging"],
  ["delay_impacts", "Delay impact", "Impact van de vertraging"],
  ["delay_category_other", "Delay category · other", "Categorie · overig"],
  ["delay_type_other", "Delay type · other", "Soort · overig"],
  ["status_description", "Status description", "Toelichting status"],
  ["agreed_between", "Agreed between", "Afgesproken tussen"],
  ["agreement_priority", "Priority", "Prioriteit"],
  ["agreement_remarks", "Remarks", "Opmerkingen"],
  ["actual_completion_date", "Actual completion date", "Werkelijke afrondingsdatum"],
  ["status_on_finish_date", "Status on the original finish date", "Status op de oorspronkelijke einddatum"],
  ["recovery_plan", "Recovery plan", "Inloopplan"],
  ["actual_completed_date", "Actual completed date", "Werkelijke afrondingsdatum"],
  ["completion_status", "Completion status", "Status van afronding"],
  ["project_phase", "Project phase", "Projectfase"],
  ["issue", "1 · Issue", "1 · Probleem"],
  ["cause", "2 · Cause", "2 · Oorzaak"],
  ["solution_improvement", "3 · Solution / improvement", "3 · Oplossing / verbetering"],
  ["expected_results", "4 · Expected results", "4 · Verwacht resultaat"],
  ["follow_up_action", "Follow-up action", "Vervolgactie"],
  ["responsible_person", "Responsible person", "Verantwoordelijke"],
  ["lesson_status", "Status", "Status"],
  ["agreement_status", "Status", "Status"],
  ["priority", "Priority", "Prioriteit"],
  ["ready_date", "Ready date", "Gereeddatum"],
  ["inspection_category", "Inspection category", "Inspectiecategorie"],
  ["period_start", "Period start", "Periode start"],
  ["period_end", "Period end", "Periode einde"],
  ["lost_hours", "Lost hours", "Verloren uren"],
  ["lost_hours_reason", "Reason for lost hours", "Reden verloren uren"],
  ["contractor_remarks", "Contractor remarks", "Opmerkingen aannemer"],
  ["completion_remarks", "Remarks", "Opmerkingen"],
  ["remarks", "Remarks", "Opmerkingen"],
  ["drawing_name", "Location on drawing", "Locatie op tekening"],
];

type BuildingNames = (primary: string | null | undefined, all?: string[]) => string;
type Moment = (value: string | null | undefined) => string;

export type DayExportContext = {
  text: Translate;
  projectName: string;
  projectCode: string;
  dayLabel: string;
  day: string;
  generatedBy: string;
  generatedAt: string;
  buildingNames: BuildingNames;
  partyName: (id: string | null | undefined) => string;
  registerNames: Record<string, string>;
  statusText: (code: string | null | undefined) => string;
  severityText: (code: string | null | undefined) => string;
  delayCause: (code: string | null | undefined) => string;
  /** "15:40" in site time. */
  timeOf: Moment;
  /** A full date and time in site time, for signatures. */
  momentOf: Moment;
  /** The sign-off history of a record, loaded in bulk for the day. */
  history?: (recordId: string) => DayExportHistory[];
};

const signature = (label: string, name: unknown, signedAt: unknown, image: unknown, momentOf: Moment): DayExportSignature | null => {
  const written = clean(name);
  const ink = isDataImage(image) ? String(image) : null;
  if (!written && !ink) return null;
  return { label, name: written, signedAt: momentOf(clean(signedAt)), image: ink };
};

/** The developer specification's own fields of a record, in the workbook's order. */
const specFactsOf = (form: SpecFormKey, spec: unknown, language: "en" | "nl"): Array<[string, string]> =>
  // Restricted incident data is never printed; workbook values read in the export's language.
  spec && typeof spec === "object" ? specFacts(form, spec as SpecValues, language, { translate: (value) => specLabel(value, language) }) : [];

const facts = (pairs: Array<[string, unknown]>): Array<[string, string]> =>
  pairs.map(([label, value]) => [label, humanize(value)] as [string, string]).filter(([, value]) => Boolean(value));

/** Any record that went through the day overview's sorting; the export only reads it. */
export type DayExportInput = {
  workforce: { headcount: number; visitors: number; entries: Row[] };
  worksOngoing: Row[];
  worksCompleted: Row[];
  delays: Row[];
  issues: Row[];
  ncrs: Row[];
  hse: Row[];
  inspections: Row[];
  registers: Record<string, Row[]>;
  photos: Array<{ title: string; meta: string; image: string | null }>;
};

export function buildDayExport(day: DayExportInput, context: DayExportContext): DayExportDocument {
  const { text, buildingNames, momentOf, timeOf } = context;
  const language: "en" | "nl" = text("en", "nl") === "nl" ? "nl" : "en";
  const str = (value: unknown) => clean(value);
  const ids = (row: Row) => (Array.isArray(row.building_ids) ? row.building_ids as string[] : undefined);
  const historyOf = (row: Row) => context.history?.(str(row.id)) ?? [];

  // ---- daily work -----------------------------------------------------------------------
  const workItem = (row: Row, kind: "ongoing" | "completed" | "delay"): DayExportItem => ({
    code: timeOf(str(row.created_at)),
    title: kind === "ongoing" ? str(row.work_ongoing) : kind === "completed" ? str(row.work_performed) : `${context.delayCause(str(row.delay_cause))} · ${Number(row.delay_hours) || 0} ${text("hours lost", "uur verlies")}`,
    status: row.signed_by ? text("Signed", "Ondertekend") : text("Saved", "Opgeslagen"),
    facts: facts([
      [text("Buildings", "Gebouwen"), buildingNames(str(row.building_id), ids(row))],
      [text("Day summary", "Samenvatting van de dag"), kind !== "delay" ? row.day_summary : ""],
      [text("Progress", "Voortgang"), kind === "completed" && row.progress_percent !== null && row.progress_percent !== undefined ? `${Number(row.progress_percent)}%` : ""],
      [text("What caused it", "Oorzaak"), kind === "delay" ? row.delay_reason : ""],
      [text("Responsible contractor", "Verantwoordelijke aannemer"), kind === "delay" ? row.contractor_company : ""],
    ]),
    signatures: [
      signature(text("Supervisor", "Supervisor"), row.signed_by, row.signed_at, row.signature_image, momentOf),
      kind === "delay" ? signature(text("Contractor", "Aannemer"), row.contractor_signed_by, row.contractor_signed_at, row.contractor_signature_image, momentOf) : null,
    ].filter(Boolean) as DayExportSignature[],
  });

  // ---- issues and NCRs ---------------------------------------------------------------------
  const findingItem = (row: Row, ncr: boolean): DayExportItem => {
    const issue = (row.issue_management ?? {}) as Row;
    const responsible = [humanize(issue.responsible_role), str(issue.responsible_person)].filter(Boolean).join(" · ");
    return {
      code: str(row.finding_number),
      title: str(row.title),
      status: context.statusText(str(row.status)),
      facts: facts([
        [text("Time", "Tijd"), timeOf(str(row.created_at))],
        [text("Buildings", "Gebouwen"), buildingNames(str(row.building_id), ids(row))],
        [text("Description", "Omschrijving"), row.description],
        [ncr ? text("Category", "Categorie") : text("Issue type", "Issuetype"), ncr ? issue.ncr_category : issue.issue_type],
        [ncr ? text("Type of work", "Soort werk") : text("Category", "Categorie"), ncr ? issue.ncr_work_type : issue.issue_category],
        [text("Severity", "Ernst"), context.severityText(str(row.severity))],
        [text("Responsible", "Verantwoordelijke"), responsible],
        [text("Contractor", "Aannemer"), ncr ? context.partyName(str(row.responsible_party_id)) : ""],
        [text("Due", "Deadline"), str(row.due_at).slice(0, 10)],
        [text("Immediate action taken", "Directe maatregel"), [humanize(issue.immediate_actions), str(issue.immediate_action_other)].filter(Boolean).join(", ")],
        [text("Disposition", "Beoordeling"), ncr ? issue.disposition : ""],
        [text("Recommended action", "Aanbevolen actie"), ncr ? [humanize(issue.recommended_action), str(issue.recommended_action_detail)].filter(Boolean).join(" · ") : ""],
        [text("Impact", "Impact"), issue.impact_summary],
        [text("Reference", "Referentie"), issue.reference_checklist],
        [text("Root cause", "Oorzaak"), issue.root_cause],
        [text("Escalation required", "Escalatie nodig"), issue.escalation_required ? text("Yes", "Ja") : ""],
        [text("Corrective action proposed", "Voorgestelde correctie"), row.proposed_correction],
        [text("Remarks", "Opmerkingen"), issue.remarks],
      ]).concat(specFactsOf(ncr ? "ncr" : "issue", issue.spec, language)),
      signatures: [
        signature(ncr ? text("Engineer (issued by)", "Ingenieur (uitgegeven door)") : text("Supervisor", "Supervisor"), issue.signed_by, issue.signed_at, issue.signature_image, momentOf),
        signature(text("Contractor", "Aannemer"), issue.contractor_signed_by, issue.contractor_signed_at, issue.contractor_signature_image, momentOf),
        signature(text("Contractor · correction", "Aannemer · correctie"), issue.correction_signed_by, issue.correction_signed_at, issue.correction_signature_image, momentOf),
        signature(text("Verification", "Verificatie"), issue.verification_signed_by, issue.verification_signed_at, issue.verification_signature_image, momentOf),
      ].filter(Boolean) as DayExportSignature[],
      history: historyOf(row),
    };
  };

  // ---- HSE ---------------------------------------------------------------------------------
  const hseItem = (row: Row): DayExportItem => {
    const confidential = Boolean(row.confidential);
    return {
      code: str(row.event_number),
      title: confidential ? `${str(row.title)} · ${text("confidential", "vertrouwelijk")}` : str(row.title),
      status: context.statusText(str(row.status)),
      // A confidential incident is listed, never spelled out in a file that travels.
      facts: confidential ? facts([[text("Time", "Tijd"), timeOf(str(row.occurred_at))], [text("Buildings", "Gebouwen"), buildingNames(str(row.building_id), ids(row))]]) : facts([
        [text("Time", "Tijd"), timeOf(str(row.occurred_at))],
        [text("Buildings", "Gebouwen"), buildingNames(str(row.building_id), ids(row))],
        [text("Issue type", "Issuetype"), row.issue_type ?? row.event_type],
        [text("Category", "Categorie"), row.issue_category ?? row.hse_category],
        [text("Severity", "Ernst"), context.severityText(str(row.severity))],
        [text("Description", "Omschrijving"), row.description],
        [text("Immediate action taken", "Directe maatregel"), [humanize(row.immediate_actions), str(row.immediate_action_other)].filter(Boolean).join(", ") || row.immediate_measure],
        [text("Responsible", "Verantwoordelijke"), [humanize(row.responsible_role), str(row.responsible_person)].filter(Boolean).join(" · ")],
        [text("Due", "Deadline"), str(row.due_at).slice(0, 10)],
        [text("Corrective action required", "Vereiste correctieve actie"), row.corrective_action],
        [text("Notes", "Notities"), row.notes],
      ]).concat(specFactsOf(row.event_type === "incident" || row.event_type === "near_miss" ? "hse_incident" : "hse", row.spec, language)),
      signatures: confidential ? [] : [
        signature(text("Supervisor", "Supervisor"), row.signed_by, row.signed_at, row.signature_image, momentOf),
        signature(text("Contractor", "Aannemer"), row.contractor_signed_by, row.contractor_signed_at, row.contractor_signature_image, momentOf),
      ].filter(Boolean) as DayExportSignature[],
      history: confidential ? [] : historyOf(row),
    };
  };

  // ---- inspections -------------------------------------------------------------------------
  const inspectionItem = (row: Row): DayExportItem => ({
    code: str(row.inspection_number),
    title: str(row.title),
    status: context.statusText(str(row.status)),
    facts: facts([
      [text("Time", "Tijd"), timeOf(str(row.completed_at ?? row.started_at))],
      [text("Buildings", "Gebouwen"), buildingNames(str(row.building_id), ids(row))],
    ]),
    signatures: [signature(text("Inspector", "Inspecteur"), row.signed_by, row.signed_at, row.signature_image, momentOf)].filter(Boolean) as DayExportSignature[],
    history: historyOf(row),
  });

  // ---- registers ---------------------------------------------------------------------------
  const registerItem = (row: Row): DayExportItem => {
    const details = (row.details ?? {}) as Row;
    const lines = Array.isArray(details.lines)
      ? (details.lines as Row[]).map((line) => [clean(line.quantity), clean(line.unit), clean(line.description)].filter(Boolean).join(" ")).filter(Boolean).join("; ")
      : "";
    return {
      code: str(row.entry_number),
      title: str(row.title),
      status: context.statusText(str(details.lesson_status ?? details.agreement_status ?? row.status)),
      facts: facts([
        [text("Time", "Tijd"), timeOf(str(row.occurred_at))],
        [text("Buildings", "Gebouwen"), buildingNames(str(row.building_id), ids(row))],
        [text("Due", "Deadline"), str(row.due_at).slice(0, 10)],
        [text("Quantities", "Hoeveelheden"), lines],
        ...registerDetailLabels.map(([key, en, nl]): [string, unknown] => [text(en, nl), details[key]]),
      ]).concat(str(row.register_type) in specForms ? specFactsOf(str(row.register_type) as SpecFormKey, details.spec, language) : []),
      signatures: [
        signature(text("Signed by", "Ondertekend door"), row.signed_by ?? details.signed_by, row.signed_at ?? details.signed_at, row.signature_image ?? details.signature_image, momentOf),
        signature(text("Supervision", "Supervisie"), details.supervision_signed_by, details.supervision_signed_at, details.supervision_signature_image, momentOf),
        signature(text("Contractor", "Aannemer"), details.contractor_signed_by ?? details.contractor_representative, details.contractor_signed_at, details.contractor_signature_image, momentOf),
        signature(text("Party 1", "Partij 1"), details.signed_by_first, details.signed_at_first, details.signature_first_image, momentOf),
        signature(text("Party 2", "Partij 2"), details.signed_by_second, details.signed_at_second, details.signature_second_image, momentOf),
      ].filter(Boolean) as DayExportSignature[],
      history: historyOf(row),
    };
  };

  // ---- workforce ---------------------------------------------------------------------------
  const groups = new Map<string, number>();
  for (const entry of day.workforce.entries) {
    if (entry.entry_type === "visitor") continue;
    const label = [context.partyName(str(entry.party_id)) || text("Unknown organisation", "Onbekende organisatie"), str(entry.discipline), buildingNames(str(entry.building_id))].filter(Boolean).join(" · ");
    groups.set(label, (groups.get(label) ?? 0) + (Number(entry.headcount) || 0));
  }

  const registerOrder = ["delivery", "technical_instruction", "change_order", "delay_report", "lessons_learned", "agreement"];
  const worksTypes = ["works_ongoing", "works_completed"];
  const otherTypes = Object.keys(day.registers).filter((type) => !registerOrder.includes(type) && !worksTypes.includes(type) && day.registers[type].length);
  const worksRecords = (type: string) => day.registers[type] ?? [];
  const sections: DayExportSection[] = [
    {
      key: "workforce",
      title: text("Workforce", "Workforce"),
      count: day.workforce.headcount,
      summary: day.workforce.entries.length
        ? text(`${day.workforce.headcount} on site · ${day.workforce.visitors} visitor(s)`, `${day.workforce.headcount} aanwezig · ${day.workforce.visitors} bezoeker(s)`)
        : undefined,
      table: groups.size ? { columns: [text("Organisation · trade · building", "Organisatie · discipline · gebouw"), text("People", "Personen")], rows: [...groups.entries()].map(([label, count]) => [label, String(count)]) } : undefined,
      items: [],
    },
    { key: "works_ongoing", title: text("Works ongoing", "Werkzaamheden gaande"), count: day.worksOngoing.length + worksRecords("works_ongoing").length, items: [...worksRecords("works_ongoing").map(registerItem), ...day.worksOngoing.map((row) => workItem(row, "ongoing"))] },
    { key: "works_completed", title: text("Works completed", "Werkzaamheden afgerond"), count: day.worksCompleted.length + worksRecords("works_completed").length, items: [...worksRecords("works_completed").map(registerItem), ...day.worksCompleted.map((row) => workItem(row, "completed"))] },
    { key: "delays", title: text("Delays", "Vertragingen"), count: day.delays.length, items: day.delays.map((row) => workItem(row, "delay")) },
    { key: "issues", title: text("Issues", "Issues"), count: day.issues.length, items: day.issues.map((row) => findingItem(row, false)) },
    { key: "ncr", title: "NCR", count: day.ncrs.length, items: day.ncrs.map((row) => findingItem(row, true)) },
    { key: "hse", title: "HSE", count: day.hse.length, items: day.hse.map(hseItem) },
    { key: "inspections", title: text("Inspections", "Inspecties"), count: day.inspections.length, items: day.inspections.map(inspectionItem) },
    ...registerOrder.map((type) => ({ key: type, title: context.registerNames[type] ?? humanize(type), count: day.registers[type]?.length ?? 0, items: (day.registers[type] ?? []).map(registerItem) })),
    ...(otherTypes.length ? [{
      key: "other_registers",
      title: text("Other registers", "Overige registers"),
      count: otherTypes.reduce((total, type) => total + day.registers[type].length, 0),
      items: otherTypes.flatMap((type) => day.registers[type].map((row) => ({ ...registerItem(row), title: `${context.registerNames[type] ?? humanize(type)} · ${str(row.title)}` }))),
    }] : []),
    { key: "photos", title: text("Photos", "Foto's"), count: day.photos.length, items: [], photos: day.photos },
  ];
  const empty = sections.filter((section) => !section.count && !section.items.length && !section.table && !section.photos?.length);

  return {
    title: text("Day report", "Dagrapport"),
    subtitle: `${context.projectName} · ${context.dayLabel}`,
    head: [
      [text("Project", "Project"), [context.projectName, context.projectCode].filter(Boolean).join(" · ")],
      [text("Day", "Dag"), context.dayLabel],
      [text("Exported by", "Geëxporteerd door"), context.generatedBy],
      [text("Exported at", "Geëxporteerd op"), context.generatedAt],
      [text("Forms with records", "Formulieren met registraties"), `${sections.length - empty.length} / ${sections.length}`],
      [text("On site", "Aanwezig"), String(day.workforce.headcount)],
    ],
    sections,
    emptyNote: empty.length ? `${text("Nothing recorded", "Niets geregistreerd")}: ${empty.map((section) => section.title).join(" · ")}` : "",
    footer: text("CODECO Supervision · day report from the records in Workspace", "CODECO Supervisie · dagrapport uit de registraties in Workspace"),
    historyTitle: text("Sign-off history", "Ondertekeningsgeschiedenis"),
    fileName: `${text("Day-report", "Dagrapport")}-${(context.projectCode || context.projectName).replace(/[^\w-]+/g, "-")}-${context.day}`,
  };
}
