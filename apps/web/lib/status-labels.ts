/**
 * The one place a stored status or severity code becomes words on a screen.
 *
 * The same domain state must read the same everywhere — the workspace, the action centre,
 * the contractor's shared link and the reports — and a raw code such as
 * "ready_for_verification" must never reach a user. Wording is copied from the screens that
 * already used it; nothing here is new vocabulary.
 */

export type StatusLanguage = "en" | "nl";

type Labels = Record<string, { en: string; nl: string }>;

export const findingStatusLabels: Labels = {
  draft: { en: "Draft", nl: "Concept" },
  open: { en: "Open", nl: "Open" },
  assigned: { en: "Assigned", nl: "Toegewezen" },
  in_progress: { en: "In progress", nl: "In uitvoering" },
  ready_for_verification: { en: "Ready for verification", nl: "Gereed voor verificatie" },
  closed: { en: "Closed", nl: "Gesloten" },
  rejected: { en: "Rejected", nl: "Afgewezen" },
  reopened: { en: "Reopened", nl: "Heropend" },
  cancelled: { en: "Cancelled", nl: "Geannuleerd" },
};

export const actionStatusLabels: Labels = {
  open: { en: "Open", nl: "Open" },
  accepted: { en: "Accepted", nl: "Geaccepteerd" },
  in_progress: { en: "In progress", nl: "In uitvoering" },
  ready_for_verification: { en: "Ready for verification", nl: "Gereed voor verificatie" },
  verified: { en: "Verified", nl: "Geverifieerd" },
  cancelled: { en: "Cancelled", nl: "Geannuleerd" },
};

export const severityLabels: Labels = {
  low: { en: "Low", nl: "Laag" },
  medium: { en: "Medium", nl: "Middel" },
  normal: { en: "Normal", nl: "Normaal" },
  high: { en: "High", nl: "Hoog" },
  critical: { en: "Critical", nl: "Kritiek" },
};

/** Turns an unknown code into readable words instead of leaking it with underscores. */
function humanize(code: string) {
  const words = code.replaceAll("_", " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : words;
}

export function labelFor(labels: Labels, code: string | null | undefined, language: StatusLanguage, fallback = "") {
  if (!code) return fallback;
  return labels[code]?.[language] ?? humanize(code);
}

/** Plain maps for screens that already index a Record<string, string> by code. */
export function labelMap(labels: Labels, language: StatusLanguage): Record<string, string> {
  return Object.fromEntries(Object.entries(labels).map(([code, label]) => [code, label[language]]));
}

/**
 * Every record status the database stores (findings, actions, inspections, HSE events,
 * registers, day reports, files, distributions). The same code means the same thing in
 * each module, so one table keeps the wording identical wherever a status is shown.
 */
export const recordStatusLabels: Labels = {
  ...findingStatusLabels,
  ...actionStatusLabels,
  planned: { en: "Planned", nl: "Gepland" },
  passed: { en: "Passed", nl: "Goedgekeurd" },
  failed: { en: "Failed", nl: "Afgekeurd" },
  ready_for_reinspection: { en: "Ready for reinspection", nl: "Gereed voor herinspectie" },
  investigating: { en: "Investigating", nl: "In onderzoek" },
  action_required: { en: "Action required", nl: "Actie vereist" },
  ready_for_review: { en: "Ready for review", nl: "Gereed voor review" },
  in_review: { en: "In review", nl: "In review" },
  approved: { en: "Approved", nl: "Goedgekeurd" },
  signed: { en: "Signed", nl: "Ondertekend" },
  sent: { en: "Sent", nl: "Verzonden" },
  revised: { en: "Revision", nl: "Revisie" },
  returned: { en: "Returned", nl: "Teruggestuurd" },
  recorded: { en: "Recorded", nl: "Vastgelegd" },
  confirmed: { en: "Confirmed", nl: "Bevestigd" },
  pending: { en: "Pending", nl: "In afwachting" },
  uploading: { en: "Uploading", nl: "Wordt geüpload" },
  available: { en: "Available", nl: "Beschikbaar" },
  archived: { en: "Archived", nl: "Gearchiveerd" },
  deleted: { en: "Deleted", nl: "Verwijderd" },
  active: { en: "Active", nl: "Actief" },
  void: { en: "Void", nl: "Vervallen" },
  completed: { en: "Completed", nl: "Afgerond" },
  on_hold: { en: "On hold", nl: "Gepauzeerd" },
  queued: { en: "Queued", nl: "In wachtrij" },
  delivered: { en: "Delivered", nl: "Afgeleverd" },
  acknowledged: { en: "Acknowledged", nl: "Bevestigd ontvangen" },
  started: { en: "Started", nl: "Gestart" },
  published: { en: "Published", nl: "Gepubliceerd" },
  retired: { en: "Retired", nl: "Ingetrokken" },
};

/**
 * What kind of record something is. Register names are the names on the client's own
 * forms (kept as the client writes them, abbreviations included).
 */
export const recordTypeLabels: Labels = {
  // Findings
  observation: { en: "Observation", nl: "Observatie" },
  deficiency: { en: "Deficiency", nl: "Tekortkoming" },
  deviation: { en: "Deviation", nl: "Afwijking" },
  ncr: { en: "NCR", nl: "NCR" },
  improvement: { en: "Improvement", nl: "Verbetering" },
  // HSE
  positive_observation: { en: "Positive observation", nl: "Positieve observatie" },
  unsafe_act: { en: "Unsafe act", nl: "Onveilige handeling" },
  unsafe_condition: { en: "Unsafe condition", nl: "Onveilige situatie" },
  near_miss: { en: "Near miss", nl: "Bijna-ongeval" },
  incident: { en: "Incident", nl: "Incident" },
  stop_work: { en: "Stop work", nl: "Werk stilgelegd" },
  toolbox: { en: "Toolbox meeting", nl: "Toolboxmeeting" },
  safety: { en: "Safety", nl: "Veiligheid" },
  health: { en: "Health", nl: "Gezondheid" },
  environment: { en: "Environment", nl: "Milieu" },
  other: { en: "Other", nl: "Overig" },
  // Registers and controlled documents
  equipment: { en: "Equipment", nl: "Materieel" },
  delivery: { en: "Materials delivery", nl: "Materiaallevering" },
  test: { en: "Test / measurement", nl: "Test / meting" },
  variation: { en: "Variation", nl: "Meer-/minderwerk" },
  delay: { en: "Delay", nl: "Vertraging" },
  communication: { en: "Communication / decision", nl: "Communicatie / besluit" },
  risk: { en: "Risk", nl: "Risico" },
  document: { en: "Document", nl: "Document" },
  drawing: { en: "Drawing", nl: "Tekening" },
  wcr: { en: "WCR", nl: "WCR" },
  rfi: { en: "RFI", nl: "RFI" },
  rfa: { en: "RFA", nl: "RFA" },
  submittal: { en: "Submittal", nl: "Submittal" },
  site_instruction: { en: "Site instruction", nl: "Site instruction" },
  meeting: { en: "Meeting", nl: "Vergadering" },
  correspondence: { en: "Correspondence", nl: "Correspondentie" },
  cost: { en: "Cost control", nl: "Kostenbewaking" },
  declaration: { en: "Contractor payment claim", nl: "Aannemersdeclaratie" },
  inspection_request: { en: "WIR", nl: "WIR" },
  boq: { en: "BOQ / progress", nl: "BOQ / voortgang" },
  punch_list: { en: "Punch list", nl: "Punch list" },
  notepad: { en: "Notepad", nl: "Notitieblok" },
  agreement: { en: "Agreements made", nl: "Gemaakte afspraken" },
  technical_instruction: { en: "Technical instruction (TI)", nl: "Technische instructie (TI)" },
  change_order: { en: "Change order (CO)", nl: "Change order (CO)" },
  contract: { en: "Contract", nl: "Contract" },
  specification: { en: "Technical specification", nl: "Technische specificatie" },
  environmental_report: { en: "Environmental report (ER)", nl: "Milieurapport (ER)" },
  lessons_learned: { en: "Lessons learned (LL)", nl: "Geleerde lessen (LL)" },
  delay_report: { en: "Project delay report (PDR)", nl: "Vertragingsrapport (PDR)" },
  // Other records, locations and media
  registration: { en: "Site registration", nl: "Dagregistratie" },
  inspection: { en: "Inspection", nl: "Inspectie" },
  finding: { en: "Finding", nl: "Bevinding" },
  action: { en: "Action", nl: "Actie" },
  hse: { en: "HSE", nl: "HSE" },
  report: { en: "Report", nl: "Rapport" },
  visual: { en: "Visual marker", nl: "Visuele markering" },
  activity: { en: "Activity", nl: "Activiteit" },
  photo: { en: "Photo", nl: "Foto" },
  panorama: { en: "360° photo", nl: "360°-foto" },
  note: { en: "Note", nl: "Notitie" },
  zone: { en: "Zone", nl: "Zone" },
  floor: { en: "Floor", nl: "Verdieping" },
  room: { en: "Room", nl: "Ruimte" },
  element: { en: "Element", nl: "Element" },
  work_package: { en: "Work package", nl: "Werkpakket" },
  image: { en: "Image", nl: "Afbeelding" },
  video: { en: "Video", nl: "Video" },
  pdf: { en: "PDF", nl: "PDF" },
  manual: { en: "Manual", nl: "Handmatig" },
};

export const priorityLabels: Labels = {
  low: { en: "Low", nl: "Laag" },
  normal: { en: "Normal", nl: "Normaal" },
  high: { en: "High", nl: "Hoog" },
  critical: { en: "Critical", nl: "Kritiek" },
};

/** The `text(english, dutch)` function every screen already gets from `useLanguage()`. */
type Translate = (english: string, dutch: string) => string;

function translated(labels: Labels, code: string | null | undefined, text: Translate) {
  if (!code) return "";
  const label = labels[code];
  return label ? text(label.en, label.nl) : humanize(code);
}

/** A stored record status in the words of the interface language. */
export const statusText = (code: string | null | undefined, text: Translate) => translated(recordStatusLabels, code, text);
/** A stored record, register or location type in the words of the interface language. */
export const typeText = (code: string | null | undefined, text: Translate) => translated(recordTypeLabels, code, text);
export const priorityText = (code: string | null | undefined, text: Translate) => translated(priorityLabels, code, text);
export const severityText = (code: string | null | undefined, text: Translate) => translated(severityLabels, code, text);

const decisionLabels: Labels = {
  approved_as_noted: { en: "Approved as noted", nl: "Goedgekeurd met opmerkingen" },
  revise_resubmit: { en: "Revise and resubmit", nl: "Herzien en opnieuw indienen" },
  for_information: { en: "For information", nl: "Ter informatie" },
  answered: { en: "Answered", nl: "Beantwoord" },
  accepted: { en: "Accepted", nl: "Geaccepteerd" },
  not_accepted: { en: "Not accepted", nl: "Niet geaccepteerd" },
  repair: { en: "Repair", nl: "Herstellen" },
  rework: { en: "Rework", nl: "Opnieuw uitvoeren" },
  replace: { en: "Replace", nl: "Vervangen" },
  use_as_is: { en: "Use as is", nl: "Accepteren zoals uitgevoerd" },
  proposed_correction: { en: "Proposed correction", nl: "Voorgestelde correctie" },
  issue: { en: "Issue reported", nl: "Probleem gemeld" },
};

const anyCodeLabels: Labels = { ...recordTypeLabels, ...priorityLabels, ...decisionLabels, ...recordStatusLabels };

/** For a code whose vocabulary is not known at the call site (a decision, a subtitle). */
export const codeText = (code: string | null | undefined, text: Translate) => translated(anyCodeLabels, code, text);

/** The words of a ticked option (a root cause, an action taken) instead of its stored id. */
export function optionText(options: ReadonlyArray<{ id: string; en: string; nl: string }>, id: string | null | undefined, text: Translate) {
  if (!id) return "";
  const option = options.find((candidate) => candidate.id === id);
  return option ? text(option.en, option.nl) : humanize(id);
}
