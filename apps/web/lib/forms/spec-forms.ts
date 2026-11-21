/**
 * The fields of the client's developer specification (workbook FINAL v2) that the app's own
 * screens did not have yet, per form, in the workbook's order. Every list comes from
 * spec-catalogue.ts, which is generated from that workbook.
 *
 * Fields the screens already had (record number, project, date/time, title, description,
 * photos, reporter, signatures) are not repeated here. Where the client's handwritten notes of
 * 19-11-2026 struck a workbook field (Change Order "Reason for change", HSE "Root cause",
 * Lessons Learned drawing location), the note wins and the field is absent.
 *
 * START HERE: "Project, location, user, contractor, supplier, crew and linked-record selections
 * must come from live app registers." Those fields are pickers (person, people, record,
 * location) fed by the project's people, parties, records and location tree; a person not in
 * the register is "Other" with a short name. The picker stores the name in the field itself and
 * the register reference beside it (`<key>_ref`, `<key>_refs`), so lists, exports and older
 * records keep reading a plain name.
 */
import * as catalogue from "./spec-catalogue.ts";
import type { SpecActivity, SpecOption } from "./spec-catalogue.ts";

export type SpecRow = Record<string, string>;
export type SpecValue = string | string[] | SpecRow[];
export type SpecValues = Record<string, SpecValue | undefined>;

export type SpecFormKey =
  | "issue"
  | "ncr"
  | "hse"
  | "hse_incident"
  | "delivery"
  | "technical_instruction"
  | "change_order"
  | "delay_report"
  | "lessons_learned"
  | "agreement"
  | "photo"
  | "works_ongoing"
  | "works_completed"
  | "workforce"
  | "inspection";

type Words = { en: string; nl: string };

/** The lists the workbook marks "project-configurable", with the workbook's values as defaults. */
export type SpecListKey = "shifts" | "units" | "crews" | "storage_locations" | "risk_likelihoods" | "risk_severities" | "notification_authorities";
export type SpecListConfig = { added?: string[]; retired?: string[]; descriptions?: Record<string, string> };
export type SpecStageConfig = { required_approvals?: number; approver_user_ids?: string[]; due_days?: number; role_en?: string; role_nl?: string };
export type SpecWorkflowConfig = {
  stages?: Record<string, SpecStageConfig>;
  approval_limit?: number | null;
  above_limit_user_ids?: string[];
  delegations?: Array<{ from: string; to: string; until?: string }>;
};
export type SpecConfiguration = {
  lists?: Partial<Record<SpecListKey, SpecListConfig>>;
  /** Likelihood × severity → rating, approved by HSE management. Without it nothing is calculated. */
  risk_matrix?: { enabled?: boolean; cells?: Record<string, string>; ratings?: string[] };
  workflows?: Record<string, SpecWorkflowConfig>;
  /** Raised on every change of the lists, stored with each record (controlled classifications). */
  lists_version?: number;
  /** Project Documents folders (requirements 4.1); empty means the default 00-13. */
  document_folders?: Array<{ code: string; en: string; nl: string }>;
  /** Project document numbering convention as a regular expression (4.2), checked on registration. */
  document_number_pattern?: string;
  /** Days a submitted revision may wait for review before reviewers are reminded (section 14). */
  document_review_days?: number;
};

/** The Unit list of the form sheets (Works Ongoing row 11, Works Completed row 10, Materials Delivery row 12). */
const formUnits = ["m", "m²", "m³", "kg", "tonne", "pcs", "number", "lot", "hours", "set", "other"];

export const specListDefaults: Record<SpecListKey, string[]> = {
  shifts: catalogue.shifts,
  units: formUnits,
  crews: [],
  storage_locations: [],
  risk_likelihoods: catalogue.riskLikelihoods,
  risk_severities: catalogue.riskSeverities,
  notification_authorities: [],
};

export const specListLabels: Record<SpecListKey, Words> = {
  shifts: { en: "Shifts", nl: "Diensten" },
  units: { en: "Units", nl: "Eenheden" },
  crews: { en: "Crews", nl: "Ploegen" },
  storage_locations: { en: "Storage locations", nl: "Opslaglocaties" },
  risk_likelihoods: { en: "Risk likelihood definitions", nl: "Definities waarschijnlijkheid" },
  risk_severities: { en: "Severity definitions", nl: "Definities ernst" },
  notification_authorities: { en: "Authorities to notify", nl: "Te melden instanties" },
};

/** The workbook's values plus the project's own, without the retired ones; "Other" stays last. */
export function projectList(key: SpecListKey, config?: SpecConfiguration | null): SpecOption[] {
  const list = config?.lists?.[key];
  const retired = new Set(list?.retired ?? []);
  const values = [...specListDefaults[key], ...(list?.added ?? [])].filter((value, index, all) => value.trim() && all.indexOf(value) === index && !retired.has(value));
  const other = values.filter(isOtherOption);
  return [...values.filter((value) => !isOtherOption(value)), ...other].map((value) => ({ value, description: list?.descriptions?.[value] ?? "" }));
}

/** A column of a repeatable row (one corrective action, one notification, one containment step). */
export type SpecColumn = {
  key: string;
  label: Words;
  kind: "text" | "person" | "date" | "datetime";
  required?: boolean;
};

export type SpecField = {
  key: string;
  label: Words;
  kind:
    | "select" | "dependent" | "multi" | "text" | "textarea" | "number" | "date" | "datetime" | "time" | "activity" | "completion"
    /** One person from the project's people and parties, or "Other" with a short name. */
    | "person"
    /** Several people and/or companies. */
    | "people"
    /** A record of this project: stores its number in the field and `<kind>:<id>` in `<key>_ref`. */
    | "record"
    /** A building or a node of the Project Location Register. */
    | "location"
    /** Risk rating: from the project's approved matrix, else a controlled rating list. */
    | "rating"
    /** Repeatable rows, e.g. one corrective action per row with its owner and due date. */
    | "rows"
    /** A yes/no tick box. */
    | "toggle";
  /** Flat list for select / multi. */
  options?: string[];
  /** A project-configurable list (Management · Project rules); `options` is ignored. */
  listKey?: SpecListKey;
  /** Type → category list for a dependent field, filtered by the value of `parent`. */
  groups?: Record<string, SpecOption[]>;
  parent?: string;
  required?: boolean | ((values: SpecValues) => boolean);
  visible?: (values: SpecValues) => boolean;
  /** Choosing "Other" (or an option starting with it) reveals a required explanation. */
  otherExplanation?: boolean;
  hint?: Words;
  min?: number;
  max?: number;
  /** The value a new record starts with, e.g. a new issue is Open (workbook status lists). */
  initial?: string;
  /** Person pickers: which people are offered. Default: users and every party. */
  people?: { users?: boolean; partyTypes?: string[]; listKey?: SpecListKey };
  /** Record pickers: which kinds of record are offered (`finding`, `ncr`, `hse`, `inspection`, `register:<type>`). */
  recordKinds?: string[];
  /** Values only a reviewer may choose ("any" = any value). The database enforces the same. */
  decision?: string[] | "any";
  /** Written by the database when the decision is taken (who and when); shown, never typed. */
  auto?: boolean;
  /** The workbook Status: set by the sign-off actions, shown read-only. */
  derived?: boolean;
  /** Restricted personal data: kept out of exports and shown only to HSE managers. */
  sensitive?: boolean;
  /** Row columns of a `rows` field. */
  columns?: SpecColumn[];
  /** Rows of this field become linked action records (owner + due date each). */
  followUp?: boolean;
  /** One row per chosen value of this multi field (containment steps). */
  rowsFrom?: string;
  /** Starts with the signed-in user ("Auto-filled user … allow supervisor confirmation"). */
  defaultsToCurrentUser?: boolean;
  /** "Date default" / "Date/time default": starts with today or now, the user may correct it. */
  defaultsToNow?: boolean;
};

const w = (en: string, nl: string): Words => ({ en, nl });
const isString = (value: unknown): value is string => typeof value === "string";
const val = (values: SpecValues, key: string): string[] => {
  const value = values[key];
  return Array.isArray(value) ? value.filter(isString) : isString(value) && value ? [value] : [];
};
const one = (values: SpecValues, key: string) => {
  const value = values[key];
  return typeof value === "string" ? value : "";
};
const has = (values: SpecValues, key: string) => val(values, key).length > 0;
export const specRows = (values: SpecValues, key: string): SpecRow[] => {
  const value = values[key];
  return Array.isArray(value) ? value.filter((item): item is SpecRow => Boolean(item) && typeof item === "object") : [];
};

export const isOtherOption = (option: string) => /^other\b/i.test(option.trim());

const discipline = (key = "discipline", required = true, label = w("Work discipline", "Werkdiscipline")): SpecField => ({
  key,
  label,
  kind: "select",
  options: catalogue.workDisciplines,
  required,
});

const unitField = (quantityKey: string): SpecField => ({
  key: `${quantityKey}_unit`,
  label: w("Unit", "Eenheid"),
  kind: "select",
  listKey: "units",
  required: (values) => has(values, quantityKey),
  visible: (values) => one(values, `${quantityKey}_na`) !== "yes",
  otherExplanation: true,
});

/** "Yes where measurable": a quantity unless the activity cannot be measured (N/A). */
const quantityFields = (label: Words): SpecField[] => [
  { key: "quantity_na", label: w("Quantity not measurable (N/A)", "Hoeveelheid niet meetbaar (n.v.t.)"), kind: "toggle" },
  { key: "quantity", label, kind: "number", min: 0, required: (values) => one(values, "quantity_na") !== "yes", visible: (values) => one(values, "quantity_na") !== "yes" },
  unitField("quantity"),
];

const recordStatus: SpecField = {
  key: "workflow_status",
  label: w("Status", "Status"),
  kind: "select",
  options: catalogue.recordStatuses,
  initial: "Open",
  derived: true,
  hint: w("Set by the sign-off actions; earlier states stay in the sign-off history.", "Volgt uit de ondertekeningsacties; eerdere statussen blijven in de geschiedenis."),
};

const closureNote = (label = w("Resolution / closure note", "Oplossing / afsluitnotitie")): SpecField => ({
  key: "closure_note",
  label,
  kind: "textarea",
  required: (values) => one(values, "workflow_status") === "Closed",
  visible: (values) => ["Pending Verification", "Closed", "Cancelled"].includes(one(values, "workflow_status")),
});

const relatedRecord = (label = w("Related record", "Gekoppelde registratie"), recordKinds?: string[]): SpecField => ({
  key: "related_record",
  label,
  kind: "record",
  recordKinds,
  hint: w("Search by number or title; the link can be added later.", "Zoek op nummer of titel; de koppeling kan later worden toegevoegd."),
});

const person = (key: string, label: Words, extra: Partial<SpecField> = {}): SpecField => ({ key, label, kind: "person", ...extra });

const actionRequired = (values: SpecValues) => one(values, "action_required") === "Yes";

const actionOwner = person("action_owner", w("Action owner", "Actiehouder"), {
  required: true,
  hint: w("One accountable person or company", "Eén verantwoordelijke persoon of bedrijf"),
});

const followUpColumns: SpecColumn[] = [
  { key: "action", label: w("Action", "Maatregel"), kind: "text", required: true },
  { key: "owner", label: w("Owner", "Eigenaar"), kind: "person", required: true },
  { key: "due", label: w("Due date", "Uiterste datum"), kind: "date", required: true },
];

/** Building / area and the exact spot, from the Project Location Register. */
const locationFields = (detailHint = w("e.g. Level 1, grids A-D/1-4, slab S1", "bv. Niveau 1, stramien A-D/1-4, vloer S1")): SpecField[] => [
  { key: "building_area", label: w("Building / area", "Gebouw / gebied"), kind: "location", required: true },
  { key: "exact_location", label: w("Exact location / grid / level", "Exacte locatie / stramien / niveau"), kind: "text", required: true, hint: detailHint },
];

const decisionStatuses = ["Approved", "Rejected"];

/** Activity-specific technical fields of the Activity Detail Guide, for Concrete Pouring. */
const concretePouring = (values: SpecValues) => one(values, "activity") === "Concrete Pouring";

/** Change Order row 8 "Reason for change", the sheet's own values. */
const changeReasons = [
  "Client Request", "Consultant Instruction", "Design Development", "Design Error / Omission", "Unforeseen Site Condition",
  "Regulatory Requirement", "Material Unavailability", "Quality Improvement", "Value Engineering", "HSE Requirement",
  "Contractor Proposal", "Coordination Requirement", "Other",
];

export const specForms: Record<SpecFormKey, SpecField[]> = {
  issue: [
    { key: "identified_at", label: w("Date/time identified", "Datum/tijd vastgesteld"), kind: "datetime", required: true, defaultsToNow: true, hint: w("When the issue was observed or raised", "Wanneer het issue is waargenomen of gemeld") },
    { key: "issue_type", label: w("Issue type", "Soort issue"), kind: "select", options: catalogue.issueTypes, required: true },
    { key: "issue_category", label: w("Category", "Categorie"), kind: "dependent", groups: catalogue.issueCategories, parent: "issue_type", required: true },
    discipline("discipline", false, w("Discipline / work package", "Discipline / werkpakket")),
    // Row 13: the sheet's own list; the name of the person or company follows in the same row.
    { key: "responsible_party", label: w("Responsible party", "Verantwoordelijke partij"), kind: "select", options: catalogue.responsibleParties, required: true },
    { key: "priority", label: w("Priority", "Prioriteit"), kind: "select", options: catalogue.priorities, required: true, hint: w("Critical notifies the project team at once", "Kritiek meldt het projectteam direct") },
    { key: "impact_types", label: w("Impact type", "Soort impact"), kind: "multi", options: catalogue.impactTypes, otherExplanation: true },
    { key: "immediate_action", label: w("Immediate action taken", "Directe maatregel"), kind: "text" },
    // Responsible party (row 13, "Contractor / user dropdown") is the screen's own picker of
    // the project's people and companies; it is stored on the record, not here.
    { key: "corrective_action", label: w("Corrective action required", "Vereiste corrigerende maatregel"), kind: "textarea", required: true },
    { key: "target_date", label: w("Target completion date", "Streefdatum gereed"), kind: "date", required: true },
    relatedRecord(),
    recordStatus,
    closureNote(),
  ],
  ncr: [
    { key: "raised_at", label: w("Date raised", "Datum gemeld"), kind: "datetime", required: true, defaultsToNow: true },
    { key: "ncr_type", label: w("NCR type", "NCR-soort"), kind: "select", options: catalogue.ncrTypes, required: true },
    { key: "ncr_category", label: w("Category", "Categorie"), kind: "dependent", groups: catalogue.ncrCategories, parent: "ncr_type", required: true },
    discipline("discipline", true, w("Discipline / work package", "Discipline / werkpakket")),
    { key: "requirement_reference", label: w("Requirement reference", "Referentie eis"), kind: "text", required: true, hint: w("Document number, revision and clause", "Documentnummer, revisie en artikel") },
    { key: "detected_during", label: w("Detected during", "Vastgesteld tijdens"), kind: "select", options: catalogue.ncrDetectedDuring, required: true, otherExplanation: true },
    { key: "related_inspection", label: w("Related inspection", "Gekoppelde inspectie"), kind: "record", recordKinds: ["inspection"] },
    { key: "severity", label: w("Severity / classification", "Ernst / classificatie"), kind: "select", options: catalogue.ncrSeverities, required: true },
    { key: "containment", label: w("Immediate containment", "Directe beheersmaatregel"), kind: "multi", options: catalogue.ncrContainment, required: true, otherExplanation: true },
    { key: "containment_justification", label: w("Why no containment applies", "Waarom geen beheersmaatregel nodig is"), kind: "text", required: (values) => val(values, "containment").includes("Not applicable (justification required)"), visible: (values) => val(values, "containment").includes("Not applicable (justification required)") },
    {
      key: "containment_details",
      label: w("Containment carried out", "Uitgevoerde beheersmaatregelen"),
      kind: "rows",
      rowsFrom: "containment",
      columns: [
        { key: "person", label: w("Responsible person", "Verantwoordelijke"), kind: "person", required: true },
        { key: "implemented_at", label: w("Implemented at", "Uitgevoerd op"), kind: "datetime", required: true },
        { key: "evidence", label: w("Evidence (photo / document reference)", "Bewijs (foto- / documentreferentie)"), kind: "text" },
      ],
      visible: (values) => val(values, "containment").some((item) => !/^not applicable/i.test(item)),
      required: (values) => val(values, "containment").some((item) => !/^not applicable/i.test(item)),
    },
    { key: "disposition", label: w("Disposition", "Dispositie"), kind: "select", options: catalogue.ncrDispositions, required: true },
    { key: "root_cause_category", label: w("Root cause category", "Categorie grondoorzaak"), kind: "select", options: catalogue.rootCauseCategories, otherExplanation: true },
    { key: "root_cause_analysis", label: w("Root cause analysis", "Grondoorzaakanalyse"), kind: "textarea" },
    { key: "corrective_action", label: w("Corrective action", "Corrigerende maatregel"), kind: "textarea", required: true },
    actionOwner,
    { key: "target_date", label: w("Target completion date", "Streefdatum gereed"), kind: "date", required: true },
    recordStatus,
    {
      key: "verification_result", label: w("Verification result", "Resultaat verificatie"), kind: "select", options: catalogue.verificationResults, decision: "any",
      required: (values) => one(values, "workflow_status") === "Closed", visible: (values) => ["Pending Verification", "Closed"].includes(one(values, "workflow_status")) || has(values, "verification_result"),
      hint: w("Not Effective or Rework Required reopens the corrective action.", "Niet effectief of Herstel vereist heropent de corrigerende maatregel."),
    },
    { key: "verified_by", label: w("Verified by", "Geverifieerd door"), kind: "text", auto: true, visible: (values) => has(values, "verified_by") },
    { key: "verified_on", label: w("Verified on", "Geverifieerd op"), kind: "date", auto: true, visible: (values) => has(values, "verified_on") },
  ],
  hse: [
    { key: "observed_at", label: w("Date/time observed", "Datum/tijd waargenomen"), kind: "datetime", required: true, defaultsToNow: true },
    { key: "hse_type", label: w("Issue type", "Soort melding"), kind: "select", options: catalogue.hseTypes, required: true },
    { key: "hse_category", label: w("Category", "Categorie"), kind: "dependent", groups: catalogue.hseCategories, parent: "hse_type", required: true },
    person("person_involved", w("Person / contractor involved", "Betrokken persoon / aannemer"), { hint: w("No medical details here", "Geen medische gegevens hier") }),
    { key: "potential_consequences", label: w("Potential consequence", "Mogelijk gevolg"), kind: "multi", options: [...catalogue.potentialConsequences, "Not Applicable"], required: true, otherExplanation: true },
    { key: "risk_likelihood", label: w("Risk likelihood", "Waarschijnlijkheid"), kind: "select", listKey: "risk_likelihoods", required: true },
    { key: "risk_severity", label: w("Potential severity", "Mogelijke ernst"), kind: "select", listKey: "risk_severities", required: true },
    { key: "risk_rating", label: w("Risk rating", "Risicoklasse"), kind: "rating", required: true, visible: (values) => has(values, "risk_likelihood") && has(values, "risk_severity") },
    { key: "immediate_action", label: w("Immediate action taken", "Directe maatregel"), kind: "textarea" },
    { key: "corrective_action", label: w("Corrective / preventive action", "Corrigerende / preventieve maatregel"), kind: "textarea", required: true },
    actionOwner,
    { key: "due_date", label: w("Due date", "Uiterste datum"), kind: "date", required: true },
    relatedRecord(w("Related incident", "Gekoppeld incident"), ["hse"]),
    recordStatus,
    closureNote(w("Verification / closure note", "Verificatie / afsluitnotitie")),
  ],
  hse_incident: [
    { key: "incident_at", label: w("Incident date/time", "Datum/tijd incident"), kind: "datetime", required: true, hint: w("When it happened, not when it is reported", "Wanneer het gebeurde, niet wanneer het gemeld wordt") },
    { key: "incident_type", label: w("Incident type", "Soort incident"), kind: "select", options: catalogue.incidentTypes, required: true },
    { key: "incident_category", label: w("Incident category", "Categorie incident"), kind: "dependent", groups: catalogue.incidentCategories, parent: "incident_type", required: true },
    { key: "people_involved", label: w("People involved / affected", "Betrokken personen"), kind: "people", sensitive: true, hint: w("Name and role only; only HSE managers see this", "Alleen naam en functie; alleen HSE-beheerders zien dit") },
    { key: "injury_classification", label: w("Injury classification", "Classificatie letsel"), kind: "select", sensitive: true, options: catalogue.injuryClassifications, required: (values) => one(values, "incident_type") === "Injury / Illness", visible: (values) => one(values, "incident_type") === "Injury / Illness" },
    { key: "injury_nature", label: w("Nature of injury / illness", "Aard letsel / ziekte"), kind: "select", sensitive: true, options: catalogue.injuryNatures, otherExplanation: true, required: (values) => one(values, "incident_type") === "Injury / Illness", visible: (values) => one(values, "incident_type") === "Injury / Illness" },
    { key: "body_part", label: w("Body part affected", "Getroffen lichaamsdeel"), kind: "select", sensitive: true, options: catalogue.bodyParts, otherExplanation: true, required: (values) => one(values, "incident_type") === "Injury / Illness", visible: (values) => one(values, "incident_type") === "Injury / Illness" },
    { key: "environmental_impact", label: w("Environmental impact", "Milieu-impact"), kind: "select", options: catalogue.environmentalImpacts, otherExplanation: true, required: (values) => one(values, "incident_type") === "Environmental Incident", visible: (values) => one(values, "incident_type") === "Environmental Incident" },
    { key: "property_damage", label: w("Property / equipment damage", "Schade eigendom / materieel"), kind: "select", options: catalogue.propertyDamage, required: (values) => one(values, "incident_type") === "Property / Equipment Damage", visible: (values) => ["Property / Equipment Damage", "Fire / Explosion", "Vehicle / Traffic Incident"].includes(one(values, "incident_type")) },
    { key: "property_damage_detail", label: w("Affected asset and estimated impact", "Getroffen object en geschatte impact"), kind: "text", visible: (values) => has(values, "property_damage") && one(values, "property_damage") !== "None" },
    { key: "immediate_response", label: w("Immediate response", "Directe reactie"), kind: "textarea", required: true, hint: w("First aid, isolation, evacuation, spill control, area made safe", "Eerste hulp, afzetten, evacuatie, lekbestrijding, gebied veilig gemaakt") },
    { key: "authorities_notified", label: w("Authorities / client notified", "Autoriteiten / opdrachtgever gemeld"), kind: "select", options: catalogue.notificationStates },
    {
      key: "notification_log",
      label: w("Notification log", "Meldingslog"),
      kind: "rows",
      columns: [
        { key: "authority", label: w("Authority / party", "Instantie / partij"), kind: "text", required: true },
        { key: "notified_at", label: w("Notified at", "Gemeld op"), kind: "datetime", required: true },
        { key: "reference", label: w("Reference / contact", "Referentie / contactpersoon"), kind: "text" },
      ],
      visible: (values) => ["Notified", "Pending"].includes(one(values, "authorities_notified")),
      required: (values) => one(values, "authorities_notified") === "Notified",
    },
    { key: "witnesses", label: w("Witnesses", "Getuigen"), kind: "people", sensitive: true },
    { key: "incident_severity", label: w("Potential / actual severity", "Mogelijke / werkelijke ernst"), kind: "select", listKey: "risk_severities", required: true },
    { key: "investigation_required", label: w("Investigation required", "Onderzoek nodig"), kind: "select", options: catalogue.investigationRequired, required: true },
    { key: "investigation_findings", label: w("Investigation findings / root cause", "Onderzoeksbevindingen / grondoorzaak"), kind: "textarea", visible: (values) => one(values, "investigation_required") === "Yes", required: (values) => one(values, "investigation_required") === "Yes" },
    {
      key: "corrective_actions",
      label: w("Corrective / preventive actions", "Corrigerende / preventieve maatregelen"),
      kind: "rows",
      columns: followUpColumns,
      followUp: true,
      required: true,
      hint: w("Each action becomes its own action record with its owner and due date.", "Elke maatregel wordt een eigen actie met eigenaar en uiterste datum."),
    },
    { key: "related_observation", label: w("Related HSE observation", "Gekoppelde HSE-observatie"), kind: "record", recordKinds: ["hse"] },
    person("hse_reviewer", w("HSE reviewer", "HSE-beoordelaar"), { required: true, people: { users: true, partyTypes: [] } }),
    recordStatus,
    closureNote(w("Closure note", "Afsluitnotitie")),
  ],
  delivery: [
    { key: "delivery_at", label: w("Delivery date/time", "Datum/tijd levering"), kind: "datetime", required: true, defaultsToNow: true, hint: w("Actual arrival time", "Werkelijke aankomsttijd") },
    person("supplier", w("Supplier", "Leverancier"), { required: true, people: { users: false, partyTypes: ["supplier"] }, hint: w("From the project's supplier register (Management · Structure and parties)", "Uit het leveranciersregister van het project (Beheer · Structuur en partijen)") }),
    { key: "purchase_order", label: w("Purchase order / requisition", "Inkooporder / aanvraag"), kind: "text", required: true },
    { key: "delivery_note_number", label: w("Delivery note number", "Pakbonnummer"), kind: "text" },
    { key: "material_group", label: w("Material group", "Materiaalgroep"), kind: "dependent", groups: { all: catalogue.materialCategories["Material Group"] ?? [] }, parent: "__all", required: true, otherExplanation: true },
    { key: "material_specification", label: w("Material description / specification", "Materiaalomschrijving / specificatie"), kind: "text", required: true },
    { key: "ordered_quantity", label: w("Ordered quantity", "Bestelde hoeveelheid"), kind: "number", required: true, min: 0 },
    { key: "delivered_quantity", label: w("Delivered quantity", "Geleverde hoeveelheid"), kind: "number", required: true, min: 0, hint: w("Zero when nothing was delivered", "Nul als niets is geleverd") },
    { key: "unit", label: w("Unit", "Eenheid"), kind: "select", listKey: "units", required: true, otherExplanation: true },
    { key: "delivery_status", label: w("Delivery status", "Leveringsstatus"), kind: "dependent", groups: { all: catalogue.deliveryStatuses.map((value) => ({ value, description: catalogue.materialCategories["Delivery Status"]?.find((option) => option.value === value)?.description ?? "" })) }, parent: "__all", required: true },
    { key: "revised_delivery_date", label: w("Revised delivery date", "Nieuwe leverdatum"), kind: "date", visible: (values) => ["Delayed", "Partial Delivery"].includes(one(values, "delivery_status")), required: (values) => ["Delayed", "Partial Delivery"].includes(one(values, "delivery_status")) },
    { key: "arrival_condition", label: w("Condition on arrival", "Staat bij aankomst"), kind: "select", options: catalogue.arrivalConditions, required: true, otherExplanation: true },
    { key: "inspection_result", label: w("Inspection result", "Resultaat keuring"), kind: "select", options: catalogue.deliveryInspectionResults, required: true, decision: ["Accepted", "Accepted with Comments", "Rejected"], hint: w("Accepted only after the required checks; QA / supervision decides.", "Pas geaccepteerd na de vereiste controles; QA / supervisie beslist.") },
    { key: "accepted_by", label: w("Inspection decided by", "Keuring besloten door"), kind: "text", auto: true, visible: (values) => has(values, "accepted_by") },
    { key: "storage_location", label: w("Storage location", "Opslaglocatie"), kind: "select", listKey: "storage_locations", otherExplanation: true, visible: (values) => ["Accepted", "Accepted with Comments"].includes(one(values, "inspection_result")) },
    { key: "discrepancy_type", label: w("Discrepancy", "Afwijking"), kind: "dependent", groups: { all: catalogue.materialCategories["Delivery Discrepancy"] ?? [] }, parent: "__all", visible: (values) => deliveryException(values), otherExplanation: true },
    { key: "discrepancy_remarks", label: w("Discrepancy / remarks", "Afwijking / opmerkingen"), kind: "text", required: (values) => deliveryException(values), visible: (values) => deliveryException(values) },
    person("received_by", w("Received by", "Ontvangen door"), { required: true, defaultsToCurrentUser: true, people: { users: true, partyTypes: [] }, hint: w("Filled with your name; a supervisor confirms receipt in the sign-off.", "Ingevuld met uw naam; een supervisor bevestigt de ontvangst in de ondertekening.") }),
  ],
  technical_instruction: [
    { key: "instruction_date", label: w("Instruction date", "Datum instructie"), kind: "date", required: true, defaultsToNow: true },
    { key: "instruction_type", label: w("Instruction type", "Soort instructie"), kind: "select", options: catalogue.instructionTypes, required: true, otherExplanation: true },
    discipline("discipline", true, w("Discipline", "Discipline")),
    { key: "instruction_category", label: w("Category / subject", "Categorie / onderwerp"), kind: "dependent", groups: catalogue.instructionCategories, parent: "discipline", required: true, otherExplanation: true },
    { key: "drawing_reference", label: w("Drawing / document reference", "Tekening- / documentreferentie"), kind: "text", hint: w("With its revision", "Met de revisie") },
    { key: "reason", label: w("Reason / background", "Reden / achtergrond"), kind: "select", options: catalogue.instructionReasons, otherExplanation: true },
    { key: "reason_detail", label: w("Supporting explanation", "Toelichting"), kind: "text", visible: (values) => has(values, "reason") },
    person("issued_to", w("Issued to", "Uitgegeven aan"), { required: true }),
    actionOwner,
    { key: "response_required_by", label: w("Response required by", "Antwoord vereist voor"), kind: "date" },
    { key: "acknowledged_by", label: w("Acknowledged by / date", "Ontvangst bevestigd door / datum"), kind: "text", auto: true, visible: (values) => has(values, "acknowledged_by"), hint: w("Acknowledgement is not acceptance of cost or time impact.", "Ontvangstbevestiging is geen akkoord met kosten- of tijdsimpact.") },
    relatedRecord(),
    recordStatus,
    person("closed_verified_by", w("Closed / verified by", "Gesloten / geverifieerd door"), { people: { users: true, partyTypes: [] }, visible: (values) => ["Pending Verification", "Closed"].includes(one(values, "workflow_status")) }),
  ],
  change_order: [
    { key: "request_date", label: w("Request date", "Datum aanvraag"), kind: "date", required: true, defaultsToNow: true },
    { key: "change_type", label: w("Change type", "Soort wijziging"), kind: "select", options: catalogue.changeTypes, required: true },
    { key: "change_category", label: w("Change category", "Categorie wijziging"), kind: "dependent", groups: catalogue.changeCategories, parent: "change_type", required: true },
    // Workbook row 8. The client struck it on 19-11-2026; on 20-11-2026 they asked for every row of the sheet.
    { key: "change_reason", label: w("Reason for change", "Reden voor wijziging"), kind: "select", options: changeReasons, required: true, otherExplanation: true },
    person("originator", w("Originator / requester", "Aanvrager"), { required: true }),
    { key: "drawing_reference", label: w("Drawing / specification reference", "Tekening- / bestekreferentie"), kind: "text", hint: w("With its revision", "Met de revisie") },
    { key: "added_quantity", label: w("Added quantity", "Toegevoegde hoeveelheid"), kind: "number", min: 0 },
    { key: "omitted_quantity", label: w("Omitted quantity", "Vervallen hoeveelheid"), kind: "number", min: 0 },
    { key: "quantity_unit", label: w("Unit", "Eenheid"), kind: "select", listKey: "units", required: (values) => has(values, "added_quantity") || has(values, "omitted_quantity"), otherExplanation: true },
    { key: "cost_currency", label: w("Currency", "Valuta"), kind: "select", options: ["SRD", "USD", "EUR"], required: true },
    { key: "cost_impact", label: w("Cost impact", "Kostenimpact"), kind: "number", required: true, hint: w("Estimated; the approved amount is recorded separately", "Geschat; het goedgekeurde bedrag wordt apart vastgelegd") },
    { key: "time_impact", label: w("Time impact", "Tijdsimpact"), kind: "number", required: true, hint: w("Estimated", "Geschat") },
    { key: "time_impact_unit", label: w("Time unit", "Tijdseenheid"), kind: "select", options: catalogue.durationUnits, required: true },
    { key: "assessment", label: w("Cost / schedule assessment", "Kosten- / planningsbeoordeling"), kind: "textarea" },
    { key: "approval_status", label: w("Approval status", "Goedkeuringsstatus"), kind: "select", options: catalogue.changeApprovalStatuses, required: true, initial: "Draft", decision: decisionStatuses },
    { key: "approved_amount", label: w("Approved amount", "Goedgekeurd bedrag"), kind: "number", visible: (values) => ["Approved", "Implemented", "Closed"].includes(one(values, "approval_status")), required: (values) => one(values, "approval_status") === "Approved" },
    { key: "approved_days", label: w("Approved days", "Goedgekeurde dagen"), kind: "number", visible: (values) => ["Approved", "Implemented", "Closed"].includes(one(values, "approval_status")), required: (values) => one(values, "approval_status") === "Approved" },
    { key: "approved_by", label: w("Approved by", "Goedgekeurd door"), kind: "text", auto: true },
    { key: "approved_on", label: w("Approval date", "Datum goedkeuring"), kind: "date", auto: true, visible: (values) => has(values, "approved_on") },
    { key: "instruction_to_proceed", label: w("Instruction to proceed", "Opdracht tot uitvoering"), kind: "select", options: catalogue.instructionToProceed, required: true, initial: "Not Issued" },
    relatedRecord(w("Related records", "Gekoppelde registraties")),
  ],
  // The client's own PDR form already asks for the activity, the cause, the duration in days,
  // the critical-path impact and the recovery plan; only what it lacks is added here.
  delay_report: [
    { key: "delay_start_at", label: w("Delay start date/time", "Begin vertraging"), kind: "datetime", required: true },
    { key: "affected_activity", label: w("Affected activity", "Getroffen activiteit"), kind: "record", recordKinds: ["register:works_ongoing", "register:works_completed"], hint: w("The planned or running work record; or write the activity below", "Het geplande of lopende werk; of schrijf de activiteit hieronder") },
    { key: "affected_activity_text", label: w("Affected activity (not in the list)", "Getroffen activiteit (niet in de lijst)"), kind: "text", required: (values) => !has(values, "affected_activity") },
    { key: "delay_cause_type", label: w("Delay cause type", "Soort oorzaak"), kind: "select", options: catalogue.delayCauseTypes, required: true },
    { key: "delay_cause_category", label: w("Delay cause category", "Categorie oorzaak"), kind: "dependent", groups: catalogue.delayCauseCategories, parent: "delay_cause_type", required: true, otherExplanation: true },
    { key: "detailed_cause", label: w("Detailed cause", "Gedetailleerde oorzaak"), kind: "text", required: true, hint: w("What happened and why it delayed the activity", "Wat er gebeurde en waarom het de activiteit vertraagde") },
    { key: "responsible_party", label: w("Responsible party", "Verantwoordelijke partij"), kind: "select", options: catalogue.responsibleParties },
    { key: "delay_duration", label: w("Delay duration", "Duur vertraging"), kind: "number", required: true, min: 0 },
    { key: "duration_unit", label: w("Duration unit", "Eenheid duur"), kind: "select", options: catalogue.durationUnits, required: true },
    { key: "duration_basis", label: w("Duration is", "Duur is"), kind: "select", options: ["Actual", "Estimated"], required: true },
    { key: "critical_path", label: w("Critical path impact", "Impact kritiek pad"), kind: "select", options: catalogue.criticalPathImpacts, required: true },
    { key: "milestone_impact", label: w("Schedule / milestone impact", "Impact planning / mijlpaal"), kind: "text" },
    { key: "recovery_action", label: w("Mitigation / recovery action", "Beperkende / herstelmaatregel"), kind: "text", required: true },
    actionOwner,
    { key: "target_recovery_date", label: w("Target recovery date", "Streefdatum herstel"), kind: "date" },
    recordStatus,
    closureNote(w("Closure note and reviewer", "Afsluitnotitie en beoordelaar")),
  ],
  lessons_learned: [
    { key: "recorded_on", label: w("Date recorded", "Datum vastgelegd"), kind: "date", required: true, defaultsToNow: true },
    { key: "project_phase", label: w("Project phase", "Projectfase"), kind: "select", options: catalogue.lessonPhases, required: true },
    { key: "lesson_category", label: w("Lesson category", "Categorie les"), kind: "dependent", groups: catalogue.lessonCategories, parent: "project_phase", required: true },
    { key: "situation", label: w("Situation / context", "Situatie / context"), kind: "textarea", required: true },
    { key: "what_happened", label: w("What happened?", "Wat is er gebeurd?"), kind: "textarea", required: true },
    { key: "impact_types", label: w("Impact / consequence", "Impact / gevolg"), kind: "multi", options: catalogue.impactTypes, required: true, otherExplanation: true },
    { key: "impact_detail", label: w("Actual consequence", "Werkelijk gevolg"), kind: "text", required: true },
    { key: "root_cause", label: w("Root cause / contributing factors", "Grondoorzaak / bijdragende factoren"), kind: "textarea" },
    { key: "lesson_learned", label: w("Lesson learned", "Geleerde les"), kind: "textarea", required: true },
    { key: "recommendation", label: w("Recommendation / preventive action", "Aanbeveling / preventieve maatregel"), kind: "textarea", required: true },
    { key: "applicability", label: w("Applicability", "Toepasbaarheid"), kind: "select", options: catalogue.lessonApplicability, required: true },
    discipline("discipline", false, w("Discipline", "Discipline")),
    person("action_owner", w("Action owner", "Actiehouder")),
    { key: "review_status", label: w("Review status", "Beoordelingsstatus"), kind: "select", options: catalogue.lessonReviewStatuses, required: true, initial: "Draft", decision: ["Approved for Sharing"], hint: w("Approved for Sharing makes the lesson visible to every project of the organisation.", "Goedgekeurd voor delen maakt de les zichtbaar voor alle projecten van de organisatie.") },
    { key: "reviewed_by", label: w("Reviewed by", "Beoordeeld door"), kind: "text", auto: true },
  ],
  agreement: [
    { key: "agreement_at", label: w("Meeting / agreement date", "Datum overleg / afspraak"), kind: "datetime", required: true },
    { key: "meeting_source", label: w("Meeting / source", "Overleg / bron"), kind: "select", options: catalogue.agreementSources, otherExplanation: true },
    { key: "meeting_reference", label: w("Meeting number / reference", "Overlegnummer / referentie"), kind: "text", visible: (values) => has(values, "meeting_source") },
    { key: "agreement_type", label: w("Agreement type", "Soort afspraak"), kind: "select", options: catalogue.agreementTypes, required: true },
    { key: "agreement_category", label: w("Agreement category", "Categorie afspraak"), kind: "dependent", groups: catalogue.agreementCategories, parent: "agreement_type", required: true },
    { key: "agreed_by", label: w("Agreed by", "Overeengekomen door"), kind: "people", required: true, hint: w("Every party that explicitly agreed; attendance alone is not agreement", "Elke partij die uitdrukkelijk akkoord ging; aanwezigheid alleen is geen akkoord") },
    { key: "action_required", label: w("Action required", "Actie nodig"), kind: "select", options: ["Yes", "No"], required: true },
    { ...actionOwner, required: actionRequired, visible: actionRequired, hint: w("One accountable owner; the action becomes its own action record.", "Eén verantwoordelijke; de actie wordt een eigen actie.") },
    { key: "due_date", label: w("Due date", "Uiterste datum"), kind: "date", required: actionRequired, visible: actionRequired },
    discipline("discipline", false, w("Related discipline", "Gerelateerde discipline")),
    { key: "related_location", label: w("Related location", "Gerelateerde locatie"), kind: "location" },
    relatedRecord(),
    recordStatus,
    { ...closureNote(w("Confirmation / closure note", "Bevestiging / afsluitnotitie")), kind: "text", required: false },
  ],
  photo: [
    { key: "photo_purpose", label: w("Photo purpose", "Doel van de foto"), kind: "select", options: catalogue.photoPurposes, required: true, otherExplanation: true },
    // Photo category (workbook row 4): the 17 disciplines, after the purpose, when the photo
    // documents construction work.
    { ...discipline("discipline", false, w("Photo category / work discipline", "Fotocategorie / werkdiscipline")), visible: (values) => ["Progress Documentation", "Technical / Quality Evidence"].includes(one(values, "photo_purpose")) },
    { key: "building_area", label: w("Work location", "Werklocatie"), kind: "location" },
    { key: "location_detail", label: w("Location detail", "Locatiedetail"), kind: "text" },
    relatedRecord(),
  ],
  works_ongoing: [
    { key: "report_date", label: w("Report date", "Rapportdatum"), kind: "date", required: true, defaultsToNow: true },
    { key: "shift", label: w("Shift", "Dienst"), kind: "select", listKey: "shifts", otherExplanation: true },
    discipline("discipline", true),
    discipline("secondary_discipline", false, w("Secondary discipline", "Tweede discipline")),
    { key: "activity", label: w("Activity", "Activiteit"), kind: "activity", parent: "discipline", required: true },
    ...locationFields(),
    { key: "work_item", label: w("What exactly is being worked on?", "Waar wordt precies aan gewerkt?"), kind: "text", required: true },
    ...quantityFields(w("Quantity completed", "Hoeveelheid gereed")),
    { key: "progress_status", label: w("Progress status", "Voortgangsstatus"), kind: "select", options: catalogue.progressStatuses, required: true },
    { key: "progress_percent", label: w("Progress percentage", "Voortgangspercentage"), kind: "number", min: 0, max: 100 },
    { key: "crew", label: w("Crew / contractor", "Ploeg / aannemer"), kind: "people", required: true, people: { users: false, partyTypes: ["contractor", "subcontractor"], listKey: "crews" } },
    { key: "start_time", label: w("Start time", "Begintijd"), kind: "time" },
    { key: "finish_time", label: w("Finish time", "Eindtijd"), kind: "time" },
    { key: "crosses_midnight", label: w("Work crosses midnight", "Werk loopt over middernacht"), kind: "toggle", visible: (values) => Boolean(one(values, "start_time") && one(values, "finish_time") && one(values, "finish_time") < one(values, "start_time")) },
    { key: "element_type", label: w("Element", "Element"), kind: "select", options: ["Slab", "Beam", "Column", "Footing", "Wall", "Other"], visible: concretePouring, required: concretePouring, otherExplanation: true },
    { key: "element_id", label: w("Element ID", "Element-ID"), kind: "text", visible: concretePouring, required: concretePouring },
    { key: "concrete_grade", label: w("Concrete grade / mix", "Betonsterkte / mengsel"), kind: "text", visible: concretePouring, required: concretePouring },
    { key: "concrete_volume", label: w("Volume (m³)", "Volume (m³)"), kind: "number", visible: concretePouring, required: concretePouring, min: 0 },
    { key: "delivery_tickets", label: w("Delivery ticket / batch references", "Leverbon- / batchreferenties"), kind: "text", visible: concretePouring },
    { key: "slump_cube_refs", label: w("Slump and cube sample references", "Referenties zetmaat en kubussen"), kind: "text", visible: concretePouring },
    { key: "activity_details", label: w("Details for this activity", "Gegevens voor deze activiteit"), kind: "textarea", visible: (values) => has(values, "activity") && !concretePouring(values) },
    { key: "inspection_reference", label: w("Inspection / test reference", "Inspectie- / testreferentie"), kind: "record", recordKinds: ["inspection", "register:test", "register:inspection_request"] },
    { key: "blocker", label: w("Blocker / issue", "Belemmering"), kind: "select", options: catalogue.workBlockers, otherExplanation: true, visible: (values) => one(values, "progress_status") === "On Hold" || has(values, "blocker") },
    { key: "blocker_record", label: w("Linked issue or delay report", "Gekoppeld issue of vertragingsrapport"), kind: "record", recordKinds: ["finding", "ncr", "register:delay_report"], visible: (values) => has(values, "blocker") && one(values, "blocker") !== "None" },
    { key: "remarks", label: w("Remarks", "Opmerkingen"), kind: "text" },
    { ...recordStatus, label: w("Workflow status", "Workflowstatus") },
  ],
  works_completed: [
    { key: "completion_date", label: w("Completion date", "Datum gereed"), kind: "date", required: true, defaultsToNow: true },
    discipline("discipline", true),
    discipline("secondary_discipline", false, w("Secondary discipline", "Tweede discipline")),
    { key: "activity", label: w("Activity", "Activiteit"), kind: "activity", parent: "discipline", required: true },
    ...locationFields(w("The exact completed section, e.g. Level 1, grids A-D/1-4", "Het exacte gereedgekomen deel, bv. Niveau 1, stramien A-D/1-4")),
    { key: "completed_items", label: w("What was completed?", "Wat is gereed?"), kind: "completion", parent: "activity", required: true, otherExplanation: true, hint: w("Photo evidence is recommended: add before/after or completion photos to this record.", "Fotobewijs wordt aanbevolen: voeg voor/na- of opleverfoto's toe aan deze registratie.") },
    ...quantityFields(w("Quantity completed", "Hoeveelheid gereed")),
    { key: "inspection_status", label: w("Completion / inspection status", "Status gereed / keuring"), kind: "select", options: catalogue.completionInspectionStatuses, required: true, decision: ["Inspected - Accepted", "Inspected - Rejected"], hint: w("Completed is not the same as accepted; a reviewer records the inspection.", "Gereed is niet hetzelfde als geaccepteerd; een beoordelaar legt de keuring vast.") },
    { key: "inspected_by", label: w("Inspected by", "Gekeurd door"), kind: "text", auto: true, visible: (values) => has(values, "inspected_by") },
    { key: "inspection_reference", label: w("Inspection reference", "Inspectiereferentie"), kind: "record", recordKinds: ["inspection", "register:test", "register:inspection_request"], visible: (values) => one(values, "inspection_status").startsWith("Inspected") },
    { key: "ncr_reference", label: w("Linked NCR / issue", "Gekoppelde NCR / issue"), kind: "record", recordKinds: ["ncr", "finding"], visible: (values) => one(values, "inspection_status") === "Inspected - Rejected" || has(values, "outstanding"), required: (values) => one(values, "inspection_status") === "Inspected - Rejected" },
    { key: "crew", label: w("Contractor / crew", "Aannemer / ploeg"), kind: "people", required: true, people: { users: false, partyTypes: ["contractor", "subcontractor"], listKey: "crews" } },
    { key: "outstanding", label: w("Outstanding work / defects", "Openstaand werk / gebreken"), kind: "text", visible: (values) => one(values, "inspection_status") !== "Inspected - Accepted" },
    { key: "remarks", label: w("Remarks", "Opmerkingen"), kind: "text" },
    { ...recordStatus, label: w("Workflow status", "Workflowstatus") },
  ],
  workforce: [
    { key: "shift", label: w("Shift", "Dienst"), kind: "select", listKey: "shifts", otherExplanation: true },
    { key: "attendance_status", label: w("Attendance status", "Aanwezigheidsstatus"), kind: "select", options: catalogue.attendanceStatuses },
    { key: "competency_status", label: w("Competency / authorization status", "Status bevoegdheid / autorisatie"), kind: "select", options: catalogue.competencyStatuses },
  ],
  // The workbook has no Inspections sheet; the client confirmed the checklist stays as it is
  // (20-11-2026). These are the workbook's shared classifications, so inspections filter like
  // every other record, and the links to the work they inspect.
  inspection: [
    discipline("discipline", false),
    { key: "related_record", label: w("Inspected work / related record", "Gekeurd werk / gekoppelde registratie"), kind: "record", recordKinds: ["register:works_ongoing", "register:works_completed", "register:delivery", "ncr", "finding"] },
    person("contractor_witness", w("Contractor witness", "Getuige aannemer"), { people: { users: true, partyTypes: ["contractor", "subcontractor"] } }),
  ],
};

/**
 * START HERE: "Use the relevant form sheet to build each screen in the stated field order."
 * Each form is laid out row by row in the order of its sheet. A string is a field of
 * `specForms`; a slot is a row whose control belongs to the screen itself because it is stored
 * on the record (title, description, location, photos, people that own the record). System
 * rows (record ID, project, reported by, the sign-off panel) stand in the form's head or on the
 * saved record and are not repeated here.
 */
export type SheetSlot = { slot: string; label: Words; required?: boolean; hint?: Words };
/**
 * One row of the sheet made of several controls, e.g. "Start / finish time" or a dropdown
 * with its short text. `label` is the sheet's row label; without it the first control's own
 * label (which is the sheet's) heads the row.
 */
export type SheetRow = { row: string; label?: Words; required?: boolean; items: Array<string | SheetSlot> };
export type SheetItem = string | SheetSlot | SheetRow;
const slot = (name: string, en: string, nl: string, required = false, hint?: Words): SheetSlot => ({ slot: name, label: w(en, nl), required, hint });
const row = (name: string, items: Array<string | SheetSlot>, label?: Words, required = false): SheetRow => ({ row: name, items, label, required });

/** The version of the server rule table (app_private.spec_form_rules) this form is written for. */
export const specRulesVersion = "1";

export const sheetLayouts: Partial<Record<SpecFormKey, SheetItem[]>> = {
  issue: [
    "identified_at",
    "issue_type",
    "issue_category",
    slot("title", "Title", "Titel", true),
    slot("description", "Description", "Omschrijving", true),
    slot("location", "Location", "Locatie", true),
    "discipline",
    "priority",
    "impact_types",
    "immediate_action",
    row("responsible", ["responsible_party", slot("responsible", "Responsible person / company", "Verantwoordelijke persoon / bedrijf", true)]),
    "corrective_action",
    "target_date",
    "related_record",
    slot("attachments", "Attachments", "Bijlagen"),
    "workflow_status",
    "closure_note",
  ],
  ncr: [
    "raised_at",
    "ncr_type",
    "ncr_category",
    slot("title", "Title", "Titel", true),
    slot("description", "Non-conformance description", "Omschrijving van de afwijking", true),
    "discipline",
    slot("location", "Location / element", "Locatie / element", true),
    "requirement_reference",
    "detected_during",
    "related_inspection",
    "severity",
    row("containment", ["containment", "containment_justification", "containment_details"]),
    "disposition",
    "root_cause_category",
    "root_cause_analysis",
    "corrective_action",
    "action_owner",
    "target_date",
    "verification_result",
    row("verified", ["verified_by", "verified_on"], w("Verified by / date", "Geverifieerd door / datum")),
    slot("attachments", "Attachments", "Bijlagen"),
    "workflow_status",
  ],
  hse: [
    "observed_at",
    "hse_type",
    "hse_category",
    slot("title", "Title", "Titel", true),
    slot("description", "Observation / hazard description", "Omschrijving observatie / gevaar", true),
    slot("location", "Location", "Locatie", true),
    "person_involved",
    "potential_consequences",
    "risk_likelihood",
    "risk_severity",
    "risk_rating",
    "immediate_action",
    "corrective_action",
    "action_owner",
    "due_date",
    slot("photos", "Photo evidence", "Fotobewijs", false, w("Recommended", "Aanbevolen")),
    "related_record",
    row("status", ["workflow_status", "closure_note"]),
  ],
  hse_incident: [
    "incident_at",
    "incident_type",
    "incident_category",
    slot("title", "Incident title", "Titel incident", true),
    slot("description", "Detailed event description", "Gedetailleerde omschrijving van de gebeurtenis", true),
    slot("location", "Exact location", "Exacte locatie", true),
    "people_involved",
    "injury_classification",
    "injury_nature",
    "body_part",
    "environmental_impact",
    row("damage", ["property_damage", "property_damage_detail"]),
    "immediate_response",
    row("notified", ["authorities_notified", "notification_log"]),
    "witnesses",
    "incident_severity",
    "investigation_required",
    "investigation_findings",
    "corrective_actions",
    slot("photos", "Photo / document evidence", "Foto- / documentbewijs"),
    "related_observation",
    row("status", ["workflow_status", "closure_note"]),
    row("reviewer", ["hse_reviewer"], w("Reported by / HSE reviewer", "Gemeld door / HSE-beoordelaar"), true),
  ],
  works_ongoing: [
    "report_date",
    "shift",
    row("discipline", ["discipline", "secondary_discipline"]),
    "activity",
    slot("location", "Building / area", "Gebouw / gebied", true),
    "exact_location",
    "work_item",
    row("quantity", ["quantity", "quantity_na"]),
    "quantity_unit",
    "progress_status",
    "progress_percent",
    "crew",
    row("times", ["start_time", "finish_time", "crosses_midnight"], w("Start / finish time", "Begin- / eindtijd")),
    row("details", ["element_type", "element_id", "concrete_grade", "concrete_volume", "delivery_tickets", "slump_cube_refs", "activity_details"], w("Activity-specific technical details", "Activiteitspecifieke technische gegevens")),
    "inspection_reference",
    slot("photos", "Photos", "Foto's"),
    row("blocker", ["blocker", "blocker_record"]),
    "remarks",
    "workflow_status",
  ],
  works_completed: [
    "completion_date",
    row("discipline", ["discipline", "secondary_discipline"]),
    "activity",
    slot("location", "Building / area", "Gebouw / gebied", true),
    "exact_location",
    "completed_items",
    row("quantity", ["quantity", "quantity_na"]),
    "quantity_unit",
    row("inspection", ["inspection_status", "inspected_by"]),
    row("reference", ["inspection_reference", "ncr_reference"]),
    "crew",
    slot("photos", "Photo evidence", "Fotobewijs", false, w("Recommended: before/after or the inspected element", "Aanbevolen: voor/na of het gekeurde element")),
    "outstanding",
    "remarks",
    "workflow_status",
  ],
  delivery: [
    "delivery_at",
    "supplier",
    "purchase_order",
    "delivery_note_number",
    "material_group",
    "material_specification",
    "ordered_quantity",
    "delivered_quantity",
    "unit",
    row("delivery_status", ["delivery_status", "revised_delivery_date"]),
    "arrival_condition",
    row("inspection", ["inspection_result", "accepted_by"]),
    "storage_location",
    row("discrepancy", ["discrepancy_remarks", "discrepancy_type"]),
    slot("photos", "Photos / documents", "Foto's / documenten"),
    "received_by",
  ],
  technical_instruction: [
    "instruction_date",
    "instruction_type",
    "discipline",
    "instruction_category",
    slot("location", "Location / element", "Locatie / element", true),
    "drawing_reference",
    slot("description", "Instruction description", "Omschrijving instructie", true),
    row("reason", ["reason", "reason_detail"]),
    "issued_to",
    "action_owner",
    "response_required_by",
    "workflow_status",
    slot("attachments", "Attachments", "Bijlagen"),
    "related_record",
    "acknowledged_by",
    "closed_verified_by",
  ],
  change_order: [
    "request_date",
    "change_type",
    "change_category",
    slot("title", "Change title", "Titel wijziging", true),
    slot("description", "Change description", "Omschrijving wijziging", true),
    "change_reason",
    "originator",
    slot("location", "Location / work package", "Locatie / werkpakket", true),
    "drawing_reference",
    row("quantity", ["added_quantity", "omitted_quantity", "quantity_unit"], w("Quantity / unit", "Hoeveelheid / eenheid")),
    row("cost", ["cost_impact", "cost_currency"]),
    row("time", ["time_impact", "time_impact_unit"]),
    "assessment",
    "approval_status",
    row("approved", ["approved_amount", "approved_days"], w("Approved amount / days", "Goedgekeurd bedrag / dagen")),
    "instruction_to_proceed",
    "related_record",
    slot("attachments", "Attachments", "Bijlagen"),
    row("approvers", ["approved_by", "approved_on"], w("Prepared / reviewed / approved by", "Opgesteld / beoordeeld / goedgekeurd door")),
  ],
  delay_report: [
    "delay_start_at",
    row("activity", ["affected_activity", "affected_activity_text"], undefined, true),
    slot("location", "Location", "Locatie", true),
    "delay_cause_type",
    "delay_cause_category",
    "detailed_cause",
    "responsible_party",
    row("duration", ["delay_duration", "duration_basis"]),
    "duration_unit",
    "critical_path",
    "milestone_impact",
    "recovery_action",
    "action_owner",
    "target_recovery_date",
    slot("photos", "Evidence", "Bewijs"),
    row("status", ["workflow_status", "closure_note"]),
  ],
  lessons_learned: [
    "recorded_on",
    "project_phase",
    "lesson_category",
    slot("title", "Title", "Titel", true),
    "situation",
    "what_happened",
    row("impact", ["impact_types", "impact_detail"]),
    "root_cause",
    "lesson_learned",
    "recommendation",
    "applicability",
    "discipline",
    "action_owner",
    slot("photos", "Attachments", "Bijlagen"),
    "review_status",
    row("reviewed", ["reviewed_by"], w("Recorded by / reviewed by", "Vastgelegd door / beoordeeld door")),
  ],
  agreement: [
    "agreement_at",
    row("source", ["meeting_source", "meeting_reference"]),
    "agreement_type",
    "agreement_category",
    slot("title", "Agreement / decision title", "Titel afspraak / besluit", true),
    slot("description", "Agreement details", "Details afspraak", true),
    "agreed_by",
    "action_required",
    "action_owner",
    "due_date",
    row("related", ["discipline", "related_location"], w("Related discipline / location", "Gerelateerde discipline / locatie")),
    "related_record",
    "workflow_status",
    slot("photos", "Evidence / minutes", "Bewijs / notulen"),
    "closure_note",
  ],
};

export const isSheetRow = (item: SheetItem): item is SheetRow => typeof item !== "string" && "row" in item;
export const isSheetSlot = (item: SheetItem | string): item is SheetSlot => typeof item !== "string" && "slot" in item;
/** The spec fields of a sheet layout, top to bottom (rows flattened). */
export const sheetKeys = (form: SpecFormKey): string[] => (sheetLayouts[form] ?? []).flatMap((item) => (isSheetRow(item) ? item.items : [item])).filter((item): item is string => typeof item === "string");

function deliveryException(values: SpecValues) {
  const status = one(values, "delivery_status");
  const condition = one(values, "arrival_condition");
  const result = one(values, "inspection_result");
  const ordered = Number(one(values, "ordered_quantity"));
  const delivered = Number(one(values, "delivered_quantity"));
  return ["Delayed", "Partial Delivery"].includes(status)
    || (condition !== "" && condition !== "Good")
    || ["Rejected", "Quarantined"].includes(result)
    || (one(values, "ordered_quantity") !== "" && one(values, "delivered_quantity") !== "" && ordered !== delivered);
}

/** The activities of one discipline, each with its Activity Detail Guide row. */
export function activitiesFor(disciplineName: string): SpecActivity[] {
  return catalogue.activities[disciplineName] ?? [];
}

export function activityGuide(disciplineName: string, activityName: string): SpecActivity | undefined {
  return activitiesFor(disciplineName).find((activity) => activity.value === activityName);
}

/** The options a field offers given the other values of the form and the project's lists. */
export function fieldOptions(field: SpecField, values: SpecValues, config?: SpecConfiguration | null): SpecOption[] {
  if (field.listKey) return projectList(field.listKey, config);
  if (field.kind === "dependent") return field.groups?.[field.parent === "__all" ? "all" : one(values, field.parent ?? "")] ?? [];
  if (field.kind === "activity") return activitiesFor(one(values, field.parent ?? ""));
  if (field.kind === "completion") return (activityGuide(one(values, "discipline"), one(values, "activity"))?.completionOptions ?? []).map((value) => ({ value, description: "" }));
  if (field.kind === "rating") return riskRatings(config).map((value) => ({ value, description: "" }));
  return (field.options ?? []).map((value) => ({ value, description: "" }));
}

/** The controlled ratings: the project's approved list, else the workbook's priority scale. */
export function riskRatings(config?: SpecConfiguration | null) {
  const ratings = config?.risk_matrix?.ratings?.filter((item) => item.trim()) ?? [];
  return ratings.length ? ratings : catalogue.priorities;
}

/** The rating of the project's approved matrix, or "" when no matrix is configured. */
export function matrixRating(values: SpecValues, config?: SpecConfiguration | null) {
  if (!config?.risk_matrix?.enabled) return "";
  return config.risk_matrix.cells?.[`${one(values, "risk_likelihood")}|${one(values, "risk_severity")}`] ?? "";
}

const hasParent = (field: SpecField) => field.parent && field.parent !== "__all";

export const isVisible = (field: SpecField, values: SpecValues) => (field.visible ? field.visible(values) : true)
  && (field.kind !== "dependent" && field.kind !== "activity" && field.kind !== "completion" ? true : !hasParent(field) || fieldOptions(field, values).length > 0 || has(values, field.parent!));

export const isRequired = (field: SpecField, values: SpecValues) => !field.auto && !field.derived && (typeof field.required === "function" ? field.required(values) : Boolean(field.required));

export const otherKey = (field: SpecField) => `${field.key}_other`;
export const refKey = (field: SpecField | string) => `${typeof field === "string" ? field : field.key}_ref`;
export const refsKey = (field: SpecField | string) => `${typeof field === "string" ? field : field.key}_refs`;

export function needsOtherExplanation(field: SpecField, values: SpecValues) {
  return Boolean(field.otherExplanation) && val(values, field.key).some(isOtherOption);
}

/** The rows a rows field shows: one per chosen value of its source field, else the stored rows. */
export function rowsFor(field: SpecField, values: SpecValues): SpecRow[] {
  const stored = specRows(values, field.key);
  if (!field.rowsFrom) return stored;
  return val(values, field.rowsFrom)
    .filter((item) => !/^not applicable/i.test(item))
    .map((item) => ({ ...(stored.find((row) => row.step === item) ?? {}), step: item }));
}

/**
 * Older records stored a few fields differently: an agreement kept its actions as rows (the
 * sheet asks one Action owner and one Due date, rows 11 and 12) or its due date as
 * `action_due`; the incident's corrective actions ("action — owner — date" per line) become rows.
 */
export function upgradeSpecValues(form: SpecFormKey, values: SpecValues): SpecValues {
  const next: SpecValues = { ...values };
  if (form === "agreement") {
    const first = specRows(next, "actions")[0];
    if (first && !one(next, "action_owner")) {
      next.action_owner = first.owner ?? "";
      if (first.owner_ref) next.action_owner_ref = first.owner_ref;
    }
    const due = first?.due || one(next, "action_due");
    if (!one(next, "due_date") && due) next.due_date = due;
    delete next.actions;
    delete next.action_due;
  }
  if (form === "hse_incident" && typeof next.corrective_actions === "string") {
    next.corrective_actions = next.corrective_actions.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [action, owner = "", due = ""] = line.split(/\s+[—-]\s+/);
      return { action, owner, due: /^\d{4}-\d{2}-\d{2}$/.test(due.trim()) ? due.trim() : "" };
    });
  }
  return next;
}

/**
 * Changing a parent clears every dependent value that no longer belongs to it: a category of
 * another type, an activity of another discipline, completion items and activity prompts.
 */
export function setSpecValue(form: SpecFormKey, rawValues: SpecValues, key: string, value: SpecValue): SpecValues {
  const values = withInitial(form, rawValues);
  const next: SpecValues = { ...values, [key]: value };
  const fields = specForms[form];
  let changed = true;
  while (changed) {
    changed = false;
    for (const field of fields) {
      if (!hasParent(field) && field.kind !== "completion") continue;
      const current = val(next, field.key);
      if (!current.length) continue;
      const allowed = new Set(fieldOptions(field, next).map((option) => option.value));
      const kept = current.filter((item) => allowed.has(item));
      if (kept.length !== current.length) {
        next[field.key] = field.kind === "completion" || field.kind === "multi" ? kept : "";
        if (!kept.length) delete next[otherKey(field)];
        changed = true;
      }
    }
  }
  // An activity that changes takes its activity-specific answers with it.
  if (key === "activity" || key === "discipline") {
    for (const field of fields) {
      if (field.visible && !field.visible(next) && field.key !== key) delete next[field.key];
    }
  }
  // "Not applicable" is never combined with another selection.
  for (const field of fields) {
    if (field.kind !== "multi") continue;
    const current = val(next, field.key);
    const exclusive = current.find((item) => /^not applicable/i.test(item));
    if (exclusive && current.length > 1) next[field.key] = key === field.key && val(values, field.key).includes(exclusive) ? current.filter((item) => item !== exclusive) : [exclusive];
  }
  return next;
}

/** The values with the starting value of every field that was never touched. */
export function withInitial(form: SpecFormKey, values: SpecValues): SpecValues {
  const next: SpecValues = upgradeSpecValues(form, values);
  for (const field of specForms[form]) if (field.initial && next[field.key] === undefined) next[field.key] = field.initial;
  return next;
}

// row_id and action_id are identities (F08), not answers: a row holding only those is empty.
const rowFilled = (row: SpecRow) => Object.entries(row).some(([key, value]) => key !== "step" && key !== "action_id" && key !== "row_id" && !key.endsWith("_ref") && String(value ?? "").trim() !== "");

/** The labels of every visible required field that is still empty, in form order. */
export function specMissing(form: SpecFormKey, rawValues: SpecValues, language: "en" | "nl" = "en", skip: readonly string[] = []): string[] {
  const values = withInitial(form, rawValues);
  const missing: string[] = [];
  for (const field of specForms[form]) {
    if (skip.includes(field.key) || !isVisible(field, values)) continue;
    const label = field.label[language];
    if (field.kind === "rows") {
      const rows = rowsFor(field, values);
      const filled = field.rowsFrom ? rows : rows.filter(rowFilled);
      if (isRequired(field, values) && !filled.length) missing.push(label);
      filled.forEach((row, index) => {
        for (const column of field.columns ?? []) {
          if (column.required && !String(row[column.key] ?? "").trim()) missing.push(`${label} ${field.rowsFrom ? `· ${row.step}` : index + 1} · ${column.label[language]}`);
        }
      });
      continue;
    }
    const entered = val(values, field.key).filter((item) => String(item).trim() !== "");
    if (isRequired(field, values) && !entered.length) missing.push(label);
    if (needsOtherExplanation(field, values) && !one(values, otherKey(field)).trim()) missing.push(`${label} · ${language === "nl" ? "toelichting bij Overig" : "explanation for Other"}`);
    if (field.kind === "number" && entered.length) {
      const number = Number(entered[0]);
      if (!Number.isFinite(number) || (field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) missing.push(`${label} · ${language === "nl" ? "ongeldige waarde" : "invalid value"}`);
    }
  }
  if (form === "works_ongoing") {
    const start = one(values, "start_time");
    const finish = one(values, "finish_time");
    if (start && finish && finish < start && one(values, "crosses_midnight") !== "yes") missing.push(language === "nl" ? "Eindtijd ligt voor begintijd (vink 'loopt over middernacht' aan)" : "Finish time is earlier than start time (tick 'crosses midnight')");
  }
  return missing;
}

const formatRow = (field: SpecField, row: SpecRow) => [row.step, ...(field.columns ?? []).map((column) => {
  const value = String(row[column.key] ?? "").trim();
  return column.kind === "datetime" && value ? value.replace("T", " ") : value;
})].filter(Boolean).join(" — ");

/** Label/value pairs of the filled spec fields, for lists, the day overview and exports. */
export function specFacts(
  form: SpecFormKey,
  rawValues: SpecValues | null | undefined,
  language: "en" | "nl" = "en",
  options: { includeSensitive?: boolean; translate?: (value: string) => string } = {},
): Array<[string, string]> {
  if (!rawValues) return [];
  const values = upgradeSpecValues(form, rawValues);
  const show = options.translate ?? ((value: string) => value);
  const facts: Array<[string, string]> = [];
  for (const field of specForms[form]) {
    if (field.sensitive && !options.includeSensitive) continue;
    if (field.key.endsWith("_unit") && specForms[form].some((item) => `${item.key}_unit` === field.key)) continue;
    if (field.kind === "rows") {
      const rows = rowsFor(field, values).filter(rowFilled);
      if (rows.length) facts.push([field.label[language], rows.map((row) => formatRow(field, row)).join("; ")]);
      continue;
    }
    if (field.kind === "toggle") {
      if (one(values, field.key) === "yes") facts.push([field.label[language], language === "nl" ? "Ja" : "Yes"]);
      continue;
    }
    const entered = val(values, field.key).filter((item) => String(item).trim() !== "");
    if (!entered.length) continue;
    let text = entered.map(show).join(", ");
    const other = one(values, otherKey(field)).trim();
    if (other) text += ` (${other})`;
    if (field.kind === "number" && values[`${field.key}_unit`]) text += ` ${show(one(values, `${field.key}_unit`))}`;
    facts.push([field.label[language], text]);
  }
  return facts;
}

/** The linked records of a record's spec fields, for the tappable chips in the record viewer. */
export function specLinks(form: SpecFormKey, values: SpecValues | null | undefined, language: "en" | "nl" = "en") {
  if (!values) return [] as Array<{ label: string; number: string; ref: string }>;
  return specForms[form]
    .filter((field) => field.kind === "record" && one(values, field.key))
    .map((field) => ({ label: field.label[language], number: one(values, field.key), ref: one(values, refKey(field)) }));
}

/** The rows of a record that become linked action records. */
export function specFollowUps(form: SpecFormKey, values: SpecValues) {
  return specForms[form]
    .filter((field) => field.followUp && isVisible(field, values))
    .flatMap((field) => specRows(values, field.key).map((row, index) => ({ field: field.key, index, row })))
    .filter(({ row }) => row.action?.trim() && !row.action_id);
}

/** Keeps only the keys a form defines (and their "Other" explanations and references) before it is stored. */
export function cleanSpecValues(form: SpecFormKey, rawValues: SpecValues, config?: SpecConfiguration | null): Record<string, SpecValue> {
  const values = withInitial(form, rawValues);
  const out: Record<string, SpecValue> = {};
  for (const field of specForms[form]) {
    if (!isVisible(field, values)) continue;
    if (field.kind === "rows") {
      const rows = rowsFor(field, values).filter((row) => field.rowsFrom || rowFilled(row))
        .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()]).filter(([, value]) => value !== "")));
      if (rows.length) out[field.key] = rows;
      continue;
    }
    if (field.kind === "rating") {
      const computed = matrixRating(values, config);
      const value = computed || one(values, field.key).trim();
      if (value) out[field.key] = value;
      if (computed) out.risk_rating_basis = "matrix";
      continue;
    }
    const value = values[field.key];
    if (Array.isArray(value) ? value.length : typeof value === "string" && value.trim() !== "") out[field.key] = Array.isArray(value) ? value.filter(isString) : String(value).trim();
    else continue;
    const other = one(values, otherKey(field)).trim();
    if (other && needsOtherExplanation(field, values)) out[otherKey(field)] = other;
    if (one(values, refKey(field))) out[refKey(field)] = one(values, refKey(field));
    if (Array.isArray(values[refsKey(field)])) out[refsKey(field)] = val(values, refsKey(field));
    if (field.auto) {
      const by = `${field.key}_user_id`;
      if (one(values, by)) out[by] = one(values, by);
    }
  }
  // Who decided is recorded by the database; it is carried along so an edit keeps it.
  for (const key of ["approved_by_user_id", "reviewed_by_user_id", "verified_by_user_id", "inspected_by_user_id", "accepted_by_user_id", "corrective_action_reopened", "reviewed_on", "inspected_on", "accepted_on"]) {
    if (one(values, key) && !(key in out)) out[key] = one(values, key);
  }
  if (config?.lists_version) out.lists_version = String(config.lists_version);
  // F03: written by the current form, so the server also checks the always-required fields on save
  // (older offline payloads without it are checked at their formal submission instead).
  if (sheetLayouts[form]) out._rules = specRulesVersion;
  return out;
}

/** Workflow profile of the Sign-off Workflow sheet per form. */
export const workflowProfiles: Record<SpecFormKey, string> = {
  works_ongoing: "WO-DAILY",
  works_completed: "WC-COMPLETION",
  workforce: "WF-ATTENDANCE",
  delay_report: "PDR-REVIEW",
  issue: "ISSUE-CLOSEOUT",
  hse: "HSE-OBSERVATION",
  delivery: "MAT-RECEIPT",
  inspection: "INSPECTION-WITNESS",
  technical_instruction: "TECH-INSTRUCTION",
  change_order: "CHANGE-APPROVAL",
  ncr: "NCR-CORRECTIVE",
  agreement: "AGREEMENT-ACK",
  lessons_learned: "LESSON-REVIEW",
  hse_incident: "HSE-INCIDENT",
  photo: "",
};

/** Whether a user may choose this field's reviewer-only values (the database checks the same). */
export function canChooseDecision(field: SpecField, option: string, canDecide: boolean) {
  if (!field.decision || canDecide) return true;
  return field.decision === "any" ? false : !field.decision.includes(option);
}

/** Keys of a form's sensitive fields, with their Other explanations and references. */
export function sensitiveKeys(form: SpecFormKey) {
  return specForms[form].filter((field) => field.sensitive).flatMap((field) => [field.key, otherKey(field), refKey(field), refsKey(field)]);
}
