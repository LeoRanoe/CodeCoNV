/**
 * The words of the period report (PDF and Word). The report used to print stored values as
 * they are in the database ("near_miss", "to_be_corrected", "building name:", "07:00:00");
 * every field now goes through this module.
 */
import { actionStatusLabels, findingStatusLabels, labelFor, priorityLabels, recordStatusLabels, recordTypeLabels, severityLabels } from "../status-labels.ts";

const dispositions: Record<string, string> = {
  validated: "Goedgekeurd",
  to_be_corrected: "Te herstellen",
  alternative_solution: "Alternatieve oplossing",
};

const immediateActions: Record<string, string> = {
  stop_work: "Werk stilgelegd",
  area_secured: "Gebied afgezet",
  first_aid: "Eerste hulp verleend",
  informed_supervisor: "Supervisor ingelicht",
  informed_management: "Management ingelicht",
  equipment_isolated: "Materieel buiten gebruik gesteld",
  other: "Overig",
};

const labels: Record<string, string> = {
  building_name: "Gebouw",
  location_path: "Locatie",
  requested_to: "Gericht aan",
  due_date: "Deadline",
  revision: "Revisie",
  related_reference: "Referentie",
  reference_documents: "Referentiedocumenten",
  attachments: "Bijlagen",
  discipline: "Discipline",
  priority: "Prioriteit",
  schedule_impact: "Planningimpact",
  cost_impact: "Kostenimpact",
  period_start: "Periode van",
  period_end: "Periode tot",
  description: "Omschrijving",
  hse_category: "HSE-categorie",
  issue_category: "Categorie",
  responsible_person: "Verantwoordelijke",
  immediate_measure: "Directe maatregel",
  root_cause: "Oorzaak",
  corrective_action: "Corrigerende maatregel",
  disposition: "Beoordeling",
  progress_percent: "Voortgang",
  inspected_at: "Geïnspecteerd",
  status: "Status",
  action_required: "Actie vereist",
  weather_condition: "Weer",
  wind_condition: "Wind",
  planned_work: "Gepland werk",
};

const generic = {
  ...recordStatusLabels,
  ...findingStatusLabels,
  ...actionStatusLabels,
  ...recordTypeLabels,
  ...severityLabels,
  ...priorityLabels,
};

/** A stored code such as "in_progress" in words; free text is left as it was typed. */
export function periodToken(raw: string | null | undefined) {
  const token = (raw ?? "").trim();
  if (!token) return "";
  if (dispositions[token]) return dispositions[token];
  if (immediateActions[token]) return immediateActions[token];
  if (generic[token]) return labelFor(generic, token, "nl");
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(token) || /^[a-z]+$/.test(token) && token.length < 24 && !token.includes(" ")) {
    const words = token.replaceAll("_", " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return token;
}

export const periodStatus = periodToken;
export const periodSeverity = periodToken;

export function periodFieldLabel(key: string) {
  return labels[key] ?? periodToken(key);
}

/** "07:00:00" becomes "07:00". */
export function periodTime(raw: string | null | undefined) {
  const time = (raw ?? "").trim();
  return /^\d{2}:\d{2}(:\d{2})?$/.test(time) ? time.slice(0, 5) : time;
}

export function periodHours(start: string | null | undefined, end: string | null | undefined) {
  const from = periodTime(start);
  const to = periodTime(end);
  if (!from && !to) return "";
  return `${from}–${to}`;
}

const dateKeys = (key: string) => key.endsWith("_at") || key.endsWith("_date") || key === "period_start" || key === "period_end";

export function periodFieldValue(key: string, raw: unknown, formatDate: (iso: string) => string) {
  const item = String(raw);
  if (dateKeys(key)) return formatDate(item);
  if (key === "progress_percent") return `${item}%`;
  if (typeof raw === "boolean") return raw ? "Ja" : "Nee";
  if (["disposition", "status", "priority", "hse_category", "issue_category", "discipline", "schedule_impact", "cost_impact"].includes(key)) return periodToken(item);
  return item;
}

/** The "Gebouw: Hoofdgebouw | Deadline: 2 nov 2026" line under a record. */
export function periodDetailsLine(record: Record<string, unknown>, preferredKeys: string[], formatDate: (iso: string) => string) {
  const details = record.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const values = details as Record<string, unknown>;
  return preferredKeys
    .filter((key) => {
      const item = values[key];
      return item !== "" && item !== null && item !== undefined && (typeof item === "string" || typeof item === "number" || typeof item === "boolean");
    })
    .slice(0, 7)
    .map((key) => `${periodFieldLabel(key)}: ${periodFieldValue(key, values[key], formatDate)}`)
    .join(" | ");
}

export const periodDetailKeys = [
  "building_name", "location_path", "requested_to", "due_date", "revision", "related_reference",
  "reference_documents", "attachments", "discipline", "priority", "schedule_impact", "cost_impact",
  "period_start", "period_end", "description",
  // The boxes of the client's own HSE and issue screens.
  "hse_category", "issue_category", "responsible_person", "immediate_measure", "root_cause",
  "corrective_action", "disposition", "progress_percent", "inspected_at", "status",
];

/** Client, contractor and supervisor as they appear in the head of the report. */
export function periodProjectHead(snapshot: { project: Record<string, unknown>; parties: Array<Record<string, unknown>> }): Array<[string, string]> {
  const named = (type: string) => snapshot.parties.filter((party) => party.party_type === type).map((party) => String(party.name ?? "").trim()).filter(Boolean).join(", ");
  const client = String(snapshot.project.client_name ?? "").trim() || named("client");
  return [
    ["Opdrachtgever", client || "Niet geregistreerd"],
    ["Aannemer", named("contractor") || "Niet geregistreerd"],
    ["Supervisor", named("supervisor") || "Niet geregistreerd"],
  ];
}

/** The three roles that sign off a period report; the lines stay open until it is signed. */
export const periodSignatureRoles = ["Supervisor", "Aannemer", "Opdrachtgever"];
