/**
 * How a period report is organised beyond its period and forms (Word 11.1): "group by" date, form, location or
 * contractor, "summary versus full", and the contractor responses of the records that are printed. The same lines
 * feed the PDF, the Word file and the Excel workbook, so the three formats group and count identically.
 */
export const reportGroupings = ["none", "date", "form", "location", "contractor"];
export const reportDetails = ["full", "summary"];

export const reportGroupingLabels = {
  none: { en: "No grouping", nl: "Niet groeperen" },
  date: { en: "Date", nl: "Datum" },
  form: { en: "Form", nl: "Formulier" },
  location: { en: "Location (building)", nl: "Locatie (gebouw)" },
  contractor: { en: "Contractor", nl: "Aannemer" },
};

export const reportDetailLabels = {
  full: { en: "Full report", nl: "Volledig rapport" },
  summary: { en: "Summary", nl: "Samenvatting" },
};

const registerFormLabels = {
  works_ongoing: "Works Ongoing", works_completed: "Works Completed", delivery: "Materials delivery", delay_report: "Project delay report",
  technical_instruction: "Technical instruction", site_instruction: "Site instruction", change_order: "Change order", variation: "Variation",
  agreement: "Agreement", communication: "Communication", lessons_learned: "Lessons learned", environmental_report: "Environmental report",
  rfa: "RFA", rfi: "RFI", inspection_request: "Inspection request", boq: "BOQ", declaration: "Declaration", cost: "Cost",
};

const registerFormLabelsNl = {
  works_ongoing: "Werk in uitvoering", works_completed: "Afgerond werk", delivery: "Materiaallevering", delay_report: "Vertragingsmelding",
  technical_instruction: "Technische instructie", site_instruction: "Werkinstructie", change_order: "Wijzigingsopdracht", variation: "Meer-/minderwerk",
  agreement: "Afspraak", communication: "Communicatie", lessons_learned: "Lessons learned", environmental_report: "Milieurapport",
  rfa: "RFA", rfi: "RFI", inspection_request: "Inspectieverzoek", boq: "BOQ", declaration: "Declaratie", cost: "Kosten",
};
const fixedFormsNl = { Inspection: "Inspectie", Issue: "Issue", NCR: "NCR", HSE: "HSE" };

const text = (value) => (typeof value === "string" ? value.trim() : "");
const first = (...values) => values.map(text).find(Boolean) ?? "";

const specOf = (record) => {
  const issue = record?.issue_management;
  const details = record?.details;
  const spec = (issue && typeof issue === "object" ? issue.spec : undefined) ?? (details && typeof details === "object" ? details.spec : undefined) ?? record?.spec;
  return spec && typeof spec === "object" && !Array.isArray(spec) ? spec : {};
};

/**
 * One line per printed record of the four record kinds.
 * @param {Record<string, any>} snapshot  a period report snapshot
 * @param {{ building?: (id: string) => string, party?: (id: string) => string, unassigned?: string, language?: "en" | "nl" }} [lookup]
 */
export function reportRecordLines(snapshot, lookup = {}) {
  const building = (id) => (id ? lookup.building?.(String(id)) ?? "" : "");
  const party = (id) => (id ? lookup.party?.(String(id)) ?? "" : "");
  const unassigned = lookup.unassigned ?? "Niet toegewezen";
  const nl = lookup.language === "nl";
  const formName = (form) => (nl ? fixedFormsNl[form] ?? form : form);
  const make = (kind, row, form, code, partyId, dateKeys) => {
    const spec = specOf(row);
    return {
      id: String(row.id ?? code),
      kind,
      form: formName(form),
      code: String(code ?? ""),
      title: text(row.title) || text(spec.title) || "",
      status: String(row.status ?? ""),
      date: dateKeys.map((key) => String(row[key] ?? "").slice(0, 10)).find(Boolean) ?? "",
      building: building(row.building_id) || "",
      contractor: first(party(partyId), spec.responsible_contractor, spec.contractor, spec.contractor_witness, spec.crew) || unassigned,
      carriedOver: Boolean(row.details && typeof row.details === "object" && row.details.carried_over),
    };
  };
  const rows = (key) => (Array.isArray(snapshot?.[key]) ? snapshot[key] : []);
  return [
    ...rows("inspections").map((row) => make("inspection", row, "Inspection", row.inspection_number, row.responsible_party_id ?? row.contractor_party_id, ["scheduled_at", "created_at"])),
    ...rows("findings").map((row) => make("finding", row, row.finding_type === "ncr" ? "NCR" : "Issue", row.finding_number, row.responsible_party_id, ["created_at", "due_at"])),
    ...rows("hse_events").map((row) => make("hse", row, "HSE", row.event_number, row.responsible_party_id, ["occurred_at", "created_at"])),
    ...rows("register_entries").map((row) => make("register", row, (nl ? registerFormLabelsNl : registerFormLabels)[row.register_type] ?? String(row.register_type ?? "Register").replace(/_/g, " "), row.entry_number, row.party_id ?? row.responsible_party_id ?? row.contractor_party_id, ["created_at"])),
  ];
}

const groupKey = {
  date: (line) => line.date || "-",
  form: (line) => line.form,
  location: (line) => line.building || "-",
  contractor: (line) => line.contractor,
};

/**
 * The lines in groups: date groups run oldest first, the others alphabetically; inside a group the lines keep date and code order.
 * "none" is a single group without a label.
 */
export function groupReportLines(lines, groupBy = "none") {
  const byDateThenCode = (left, right) => left.date.localeCompare(right.date) || left.code.localeCompare(right.code, undefined, { numeric: true });
  if (groupBy === "none" || !groupKey[groupBy]) return [{ label: "", lines: [...lines].sort(byDateThenCode) }];
  const groups = new Map();
  for (const line of lines) {
    const label = groupKey[groupBy](line);
    groups.set(label, [...(groups.get(label) ?? []), line]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([label, members]) => ({ label, lines: members.sort(byDateThenCode) }));
}

/** Counts of a group's lines per form, for the summary table. */
export function groupCounts(group) {
  const counts = new Map();
  for (const line of group.lines) counts.set(line.form, (counts.get(line.form) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([form, count]) => ({ form, count }));
}

/** The sign-off actions that are the contractor's answer to a record. */
export const contractorResponseActions = ["acknowledge", "respond", "resubmit", "witness"];

/**
 * The contractor's responses to the printed records, from each record's sign-off history (`history` maps a record id to its
 * events). A record without a response is left out, so the section lists what was actually answered.
 * @param {Array<{ id: string, code: string, title: string }>} records
 * @param {Map<string, Array<Record<string, any>>>} history
 */
export function contractorResponses(records, history) {
  return records.flatMap((record) => {
    const events = (history.get(record.id) ?? []).filter((event) => contractorResponseActions.includes(String(event.action)));
    if (!events.length) return [];
    return [{
      code: record.code,
      title: record.title,
      responses: events.map((event) => ({
        action: String(event.action),
        by: first(event.actor_name, event.actor_organization) || "-",
        organization: text(event.actor_organization),
        at: String(event.created_at ?? event.occurred_at ?? "").slice(0, 10),
        comments: text(event.comments),
      })),
    }];
  });
}

/** The lookups that turn the ids of a snapshot into names, shared by the three report formats. */
/** @param {Record<string, any>} snapshot @param {"en" | "nl"} [language] */
export function snapshotLookup(snapshot, language = "nl") {
  const names = new Map([...(snapshot.buildings ?? []), ...(snapshot.parties ?? [])].map((item) => [String(item.id), String(item.name ?? item.code ?? item.id)]));
  return { building: (id) => names.get(id) ?? "", party: (id) => names.get(id) ?? "", unassigned: language === "nl" ? "Niet toegewezen" : "Not assigned", language };
}
