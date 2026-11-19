/**
 * The fields of the client's developer specification (workbook FINAL v2) that the app's own
 * screens did not have yet, per form, in the workbook's order. Every list comes from
 * spec-catalogue.ts, which is generated from that workbook.
 *
 * Fields the screens already had (record number, project, date/time, location, title,
 * description, photos, reporter, signatures) are not repeated here. Where the client's
 * handwritten notes of 19-11-2026 struck a workbook field (Change Order "Reason for change",
 * HSE "Root cause", Lessons Learned drawing location), the note wins and the field is absent.
 */
import * as catalogue from "./spec-catalogue.ts";
import type { SpecActivity, SpecOption } from "./spec-catalogue.ts";

export type SpecValue = string | string[];
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
  | "workforce";

type Words = { en: string; nl: string };

export type SpecField = {
  key: string;
  label: Words;
  kind: "select" | "dependent" | "multi" | "text" | "textarea" | "number" | "date" | "datetime" | "time" | "activity" | "completion";
  /** Flat list for select / multi. */
  options?: string[];
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
};

const w = (en: string, nl: string): Words => ({ en, nl });
const val = (values: SpecValues, key: string) => {
  const value = values[key];
  return Array.isArray(value) ? value : value ? [value] : [];
};
const one = (values: SpecValues, key: string) => {
  const value = values[key];
  return typeof value === "string" ? value : "";
};
const has = (values: SpecValues, key: string) => val(values, key).length > 0;

export const isOtherOption = (option: string) => /^other\b/i.test(option.trim());

const discipline = (key = "discipline", required = true): SpecField => ({
  key,
  label: w("Work discipline", "Werkdiscipline"),
  kind: "select",
  options: catalogue.workDisciplines,
  required,
});

const unitField = (quantityKey: string): SpecField => ({
  key: `${quantityKey}_unit`,
  label: w("Unit", "Eenheid"),
  kind: "select",
  options: catalogue.sharedUnits,
  required: (values) => has(values, quantityKey),
  otherExplanation: true,
});

const recordStatus: SpecField = {
  key: "workflow_status",
  label: w("Status", "Status"),
  kind: "select",
  options: catalogue.recordStatuses,
  required: true,
  initial: "Open",
};

const closureNote = (label = w("Resolution / closure note", "Oplossing / afsluitnotitie")): SpecField => ({
  key: "closure_note",
  label,
  kind: "textarea",
  required: (values) => one(values, "workflow_status") === "Closed",
  visible: (values) => ["Pending Verification", "Closed", "Cancelled"].includes(one(values, "workflow_status")),
});

const relatedRecord: SpecField = {
  key: "related_record",
  label: w("Related record", "Gekoppelde registratie"),
  kind: "text",
  hint: w("Number of the linked record, e.g. NCR-004 or TI-012", "Nummer van de gekoppelde registratie, bv. NCR-004 of TI-012"),
};

const actionOwner: SpecField = {
  key: "action_owner",
  label: w("Action owner", "Actiehouder"),
  kind: "text",
  required: true,
  hint: w("One accountable person or company", "Eén verantwoordelijke persoon of bedrijf"),
};

/** Activity-specific technical fields of the Activity Detail Guide, for Concrete Pouring. */
const concretePouring = (values: SpecValues) => one(values, "activity") === "Concrete Pouring";

export const specForms: Record<SpecFormKey, SpecField[]> = {
  issue: [
    { key: "issue_type", label: w("Issue type", "Soort issue"), kind: "select", options: catalogue.issueTypes, required: true },
    { key: "issue_category", label: w("Category", "Categorie"), kind: "dependent", groups: catalogue.issueCategories, parent: "issue_type", required: true },
    discipline("discipline", false),
    { key: "priority", label: w("Priority", "Prioriteit"), kind: "select", options: catalogue.priorities, required: true, hint: w("Critical notifies the project team at once", "Kritiek meldt het projectteam direct") },
    { key: "impact_types", label: w("Impact type", "Soort impact"), kind: "multi", options: catalogue.impactTypes, otherExplanation: true },
    { key: "responsible_party", label: w("Responsible party", "Verantwoordelijke partij"), kind: "select", options: catalogue.responsibleParties, required: true },
    { key: "corrective_action", label: w("Corrective action required", "Vereiste corrigerende maatregel"), kind: "textarea", required: true },
    { key: "target_date", label: w("Target completion date", "Streefdatum gereed"), kind: "date", required: true },
    relatedRecord,
    recordStatus,
    closureNote(),
  ],
  ncr: [
    { key: "ncr_type", label: w("NCR type", "NCR-soort"), kind: "select", options: catalogue.ncrTypes, required: true },
    { key: "ncr_category", label: w("Category", "Categorie"), kind: "dependent", groups: catalogue.ncrCategories, parent: "ncr_type", required: true },
    discipline("discipline", true),
    { key: "requirement_reference", label: w("Requirement reference", "Referentie eis"), kind: "text", required: true, hint: w("Document number, revision and clause", "Documentnummer, revisie en artikel") },
    { key: "detected_during", label: w("Detected during", "Vastgesteld tijdens"), kind: "select", options: catalogue.ncrDetectedDuring, required: true, otherExplanation: true },
    { key: "related_inspection", label: w("Related inspection", "Gekoppelde inspectie"), kind: "text" },
    { key: "severity", label: w("Severity / classification", "Ernst / classificatie"), kind: "select", options: catalogue.ncrSeverities, required: true },
    { key: "containment", label: w("Immediate containment", "Directe beheersmaatregel"), kind: "multi", options: catalogue.ncrContainment, required: true, otherExplanation: true },
    { key: "containment_justification", label: w("Why no containment applies", "Waarom geen beheersmaatregel nodig is"), kind: "text", required: (values) => val(values, "containment").includes("Not applicable (justification required)"), visible: (values) => val(values, "containment").includes("Not applicable (justification required)") },
    { key: "disposition", label: w("Disposition", "Dispositie"), kind: "select", options: catalogue.ncrDispositions, required: true },
    { key: "root_cause_category", label: w("Root cause category", "Categorie grondoorzaak"), kind: "select", options: catalogue.rootCauseCategories, otherExplanation: true },
    { key: "root_cause_analysis", label: w("Root cause analysis", "Grondoorzaakanalyse"), kind: "textarea" },
    { key: "corrective_action", label: w("Corrective action", "Corrigerende maatregel"), kind: "textarea", required: true },
    actionOwner,
    { key: "target_date", label: w("Target completion date", "Streefdatum gereed"), kind: "date", required: true },
    recordStatus,
    { key: "verification_result", label: w("Verification result", "Resultaat verificatie"), kind: "select", options: catalogue.verificationResults, required: (values) => one(values, "workflow_status") === "Closed", visible: (values) => ["Pending Verification", "Closed"].includes(one(values, "workflow_status")) },
    { key: "verified_by", label: w("Verified by", "Geverifieerd door"), kind: "text", required: (values) => one(values, "workflow_status") === "Closed", visible: (values) => ["Pending Verification", "Closed"].includes(one(values, "workflow_status")) },
    { key: "verified_on", label: w("Verified on", "Geverifieerd op"), kind: "date", required: (values) => one(values, "workflow_status") === "Closed", visible: (values) => ["Pending Verification", "Closed"].includes(one(values, "workflow_status")) },
  ],
  hse: [
    { key: "hse_type", label: w("Issue type", "Soort melding"), kind: "select", options: catalogue.hseTypes, required: true },
    { key: "hse_category", label: w("Category", "Categorie"), kind: "dependent", groups: catalogue.hseCategories, parent: "hse_type", required: true },
    { key: "person_involved", label: w("Person / contractor involved", "Betrokken persoon / aannemer"), kind: "text", hint: w("No medical details here", "Geen medische gegevens hier") },
    { key: "potential_consequences", label: w("Potential consequence", "Mogelijk gevolg"), kind: "multi", options: [...catalogue.potentialConsequences, "Not Applicable"], required: true, otherExplanation: true },
    { key: "risk_likelihood", label: w("Risk likelihood", "Waarschijnlijkheid"), kind: "select", options: catalogue.riskLikelihoods, required: true },
    { key: "risk_severity", label: w("Potential severity", "Mogelijke ernst"), kind: "select", options: catalogue.riskSeverities, required: true },
    actionOwner,
    relatedRecord,
    recordStatus,
    closureNote(w("Verification / closure note", "Verificatie / afsluitnotitie")),
  ],
  hse_incident: [
    { key: "incident_at", label: w("Incident date/time", "Datum/tijd incident"), kind: "datetime", required: true, hint: w("When it happened, not when it is reported", "Wanneer het gebeurde, niet wanneer het gemeld wordt") },
    { key: "incident_type", label: w("Incident type", "Soort incident"), kind: "select", options: catalogue.incidentTypes, required: true },
    { key: "incident_category", label: w("Incident category", "Categorie incident"), kind: "dependent", groups: catalogue.incidentCategories, parent: "incident_type", required: true },
    { key: "people_involved", label: w("People involved / affected", "Betrokken personen"), kind: "text", hint: w("Name and role only; access is restricted", "Alleen naam en functie; toegang is beperkt") },
    { key: "injury_classification", label: w("Injury classification", "Classificatie letsel"), kind: "select", options: catalogue.injuryClassifications, required: (values) => one(values, "incident_type") === "Injury / Illness", visible: (values) => one(values, "incident_type") === "Injury / Illness" },
    { key: "injury_nature", label: w("Nature of injury / illness", "Aard letsel / ziekte"), kind: "select", options: catalogue.injuryNatures, otherExplanation: true, required: (values) => one(values, "incident_type") === "Injury / Illness", visible: (values) => one(values, "incident_type") === "Injury / Illness" },
    { key: "body_part", label: w("Body part affected", "Getroffen lichaamsdeel"), kind: "select", options: catalogue.bodyParts, otherExplanation: true, required: (values) => one(values, "incident_type") === "Injury / Illness", visible: (values) => one(values, "incident_type") === "Injury / Illness" },
    { key: "environmental_impact", label: w("Environmental impact", "Milieu-impact"), kind: "select", options: catalogue.environmentalImpacts, otherExplanation: true, required: (values) => one(values, "incident_type") === "Environmental Incident", visible: (values) => one(values, "incident_type") === "Environmental Incident" },
    { key: "property_damage", label: w("Property / equipment damage", "Schade eigendom / materieel"), kind: "select", options: catalogue.propertyDamage, required: (values) => one(values, "incident_type") === "Property / Equipment Damage", visible: (values) => ["Property / Equipment Damage", "Fire / Explosion", "Vehicle / Traffic Incident"].includes(one(values, "incident_type")) },
    { key: "property_damage_detail", label: w("Affected asset and estimated impact", "Getroffen object en geschatte impact"), kind: "text", visible: (values) => has(values, "property_damage") && one(values, "property_damage") !== "None" },
    { key: "authorities_notified", label: w("Authorities / client notified", "Autoriteiten / opdrachtgever gemeld"), kind: "select", options: catalogue.notificationStates },
    { key: "notified_at", label: w("Notified at", "Gemeld op"), kind: "datetime", visible: (values) => one(values, "authorities_notified") === "Notified", required: (values) => one(values, "authorities_notified") === "Notified" },
    { key: "witnesses", label: w("Witnesses", "Getuigen"), kind: "text" },
    { key: "incident_severity", label: w("Potential / actual severity", "Mogelijke / werkelijke ernst"), kind: "select", options: catalogue.riskSeverities, required: true },
    { key: "investigation_required", label: w("Investigation required", "Onderzoek nodig"), kind: "select", options: catalogue.investigationRequired, required: true },
    { key: "investigation_findings", label: w("Investigation findings / root cause", "Onderzoeksbevindingen / grondoorzaak"), kind: "textarea", visible: (values) => one(values, "investigation_required") === "Yes" },
    { key: "corrective_actions", label: w("Corrective / preventive actions", "Corrigerende / preventieve maatregelen"), kind: "textarea", required: true, hint: w("One action per line: action — owner — due date", "Eén maatregel per regel: maatregel — eigenaar — datum") },
    { key: "related_observation", label: w("Related HSE observation", "Gekoppelde HSE-observatie"), kind: "text" },
    { key: "hse_reviewer", label: w("HSE reviewer", "HSE-beoordelaar"), kind: "text", required: true },
    recordStatus,
    closureNote(w("Closure note", "Afsluitnotitie")),
  ],
  delivery: [
    { key: "supplier", label: w("Supplier", "Leverancier"), kind: "text", required: true },
    { key: "purchase_order", label: w("Purchase order / requisition", "Inkooporder / aanvraag"), kind: "text", required: true },
    { key: "delivery_note_number", label: w("Delivery note number", "Pakbonnummer"), kind: "text" },
    { key: "material_group", label: w("Material group", "Materiaalgroep"), kind: "select", options: (catalogue.materialCategories["Material Group"] ?? []).map((option) => option.value), required: true, otherExplanation: true },
    { key: "material_specification", label: w("Material description / specification", "Materiaalomschrijving / specificatie"), kind: "text", required: true },
    { key: "ordered_quantity", label: w("Ordered quantity", "Bestelde hoeveelheid"), kind: "number", required: true, min: 0 },
    { key: "delivery_status", label: w("Delivery status", "Leveringsstatus"), kind: "select", options: catalogue.deliveryStatuses, required: true },
    { key: "revised_delivery_date", label: w("Revised delivery date", "Nieuwe leverdatum"), kind: "date", visible: (values) => ["Delayed", "Partial Delivery"].includes(one(values, "delivery_status")), required: (values) => ["Delayed", "Partial Delivery"].includes(one(values, "delivery_status")) },
    { key: "arrival_condition", label: w("Condition on arrival", "Staat bij aankomst"), kind: "select", options: catalogue.arrivalConditions, required: true, otherExplanation: true },
    { key: "inspection_result", label: w("Inspection result", "Resultaat keuring"), kind: "select", options: catalogue.deliveryInspectionResults, required: true },
    { key: "storage_location", label: w("Storage location", "Opslaglocatie"), kind: "text", visible: (values) => ["Accepted", "Accepted with Comments"].includes(one(values, "inspection_result")) },
    { key: "discrepancy_type", label: w("Discrepancy", "Afwijking"), kind: "select", options: (catalogue.materialCategories["Delivery Discrepancy"] ?? []).map((option) => option.value), visible: (values) => deliveryException(values), otherExplanation: true },
    { key: "discrepancy_remarks", label: w("Discrepancy / remarks", "Afwijking / opmerkingen"), kind: "text", required: (values) => deliveryException(values), visible: (values) => deliveryException(values) },
  ],
  technical_instruction: [
    { key: "instruction_type", label: w("Instruction type", "Soort instructie"), kind: "select", options: catalogue.instructionTypes, required: true, otherExplanation: true },
    discipline("discipline", true),
    { key: "instruction_category", label: w("Category / subject", "Categorie / onderwerp"), kind: "dependent", groups: catalogue.instructionCategories, parent: "discipline", required: true, otherExplanation: true },
    { key: "drawing_reference", label: w("Drawing / document reference (with revision)", "Tekening- / documentreferentie (met revisie)"), kind: "text" },
    { key: "reason", label: w("Reason / background", "Reden / achtergrond"), kind: "select", options: catalogue.instructionReasons, otherExplanation: true },
    { key: "reason_detail", label: w("Supporting explanation", "Toelichting"), kind: "text", visible: (values) => has(values, "reason") },
    { key: "issued_to", label: w("Issued to", "Uitgegeven aan"), kind: "text", required: true },
    actionOwner,
    { key: "response_required_by", label: w("Response required by", "Antwoord vereist voor"), kind: "date" },
    relatedRecord,
    recordStatus,
    { key: "closed_verified_by", label: w("Closed / verified by", "Gesloten / geverifieerd door"), kind: "text", visible: (values) => ["Pending Verification", "Closed"].includes(one(values, "workflow_status")) },
  ],
  change_order: [
    { key: "change_type", label: w("Change type", "Soort wijziging"), kind: "select", options: catalogue.changeTypes, required: true },
    { key: "change_category", label: w("Change category", "Categorie wijziging"), kind: "dependent", groups: catalogue.changeCategories, parent: "change_type", required: true },
    { key: "originator", label: w("Originator / requester", "Aanvrager"), kind: "text", required: true },
    { key: "drawing_reference", label: w("Drawing / specification reference (with revision)", "Tekening- / bestekreferentie (met revisie)"), kind: "text" },
    { key: "added_quantity", label: w("Added quantity", "Toegevoegde hoeveelheid"), kind: "number", min: 0 },
    { key: "omitted_quantity", label: w("Omitted quantity", "Vervallen hoeveelheid"), kind: "number", min: 0 },
    { key: "quantity_unit", label: w("Unit", "Eenheid"), kind: "select", options: catalogue.sharedUnits, required: (values) => has(values, "added_quantity") || has(values, "omitted_quantity"), otherExplanation: true },
    { key: "cost_currency", label: w("Currency", "Valuta"), kind: "select", options: ["SRD", "USD", "EUR"], required: true },
    { key: "cost_impact", label: w("Cost impact (estimated)", "Kostenimpact (geschat)"), kind: "number", required: true },
    { key: "time_impact", label: w("Time impact (estimated)", "Tijdsimpact (geschat)"), kind: "number", required: true },
    { key: "time_impact_unit", label: w("Time unit", "Tijdseenheid"), kind: "select", options: catalogue.durationUnits, required: true },
    { key: "assessment", label: w("Cost / schedule assessment", "Kosten- / planningsbeoordeling"), kind: "textarea" },
    { key: "approval_status", label: w("Approval status", "Goedkeuringsstatus"), kind: "select", options: catalogue.changeApprovalStatuses, required: true, initial: "Draft" },
    { key: "approved_amount", label: w("Approved amount", "Goedgekeurd bedrag"), kind: "number", visible: (values) => ["Approved", "Implemented", "Closed"].includes(one(values, "approval_status")), required: (values) => one(values, "approval_status") === "Approved" },
    { key: "approved_days", label: w("Approved days", "Goedgekeurde dagen"), kind: "number", visible: (values) => ["Approved", "Implemented", "Closed"].includes(one(values, "approval_status")), required: (values) => one(values, "approval_status") === "Approved" },
    { key: "approved_by", label: w("Approved by", "Goedgekeurd door"), kind: "text", visible: (values) => ["Approved", "Rejected", "Implemented", "Closed"].includes(one(values, "approval_status")), required: (values) => ["Approved", "Rejected"].includes(one(values, "approval_status")) },
    { key: "approved_on", label: w("Approval date", "Datum goedkeuring"), kind: "date", visible: (values) => ["Approved", "Rejected", "Implemented", "Closed"].includes(one(values, "approval_status")), required: (values) => ["Approved", "Rejected"].includes(one(values, "approval_status")) },
    { key: "instruction_to_proceed", label: w("Instruction to proceed", "Opdracht tot uitvoering"), kind: "select", options: catalogue.instructionToProceed, required: true, initial: "Not Issued" },
    relatedRecord,
  ],
  // The client's own PDR form already asks for the activity, the cause, the duration in days,
  // the critical-path impact and the recovery plan; only what it lacks is added here.
  delay_report: [
    { key: "delay_start_at", label: w("Delay start date/time", "Begin vertraging"), kind: "datetime", required: true },
    { key: "delay_cause_type", label: w("Delay cause type", "Soort oorzaak"), kind: "select", options: catalogue.delayCauseTypes, required: true },
    { key: "delay_cause_category", label: w("Delay cause category", "Categorie oorzaak"), kind: "dependent", groups: catalogue.delayCauseCategories, parent: "delay_cause_type", required: true, otherExplanation: true },
    { key: "responsible_party", label: w("Responsible party", "Verantwoordelijke partij"), kind: "select", options: catalogue.responsibleParties },
    { key: "duration_basis", label: w("Duration is", "Duur is"), kind: "select", options: ["Actual", "Estimated"], required: true },
    { key: "milestone_impact", label: w("Schedule / milestone impact", "Impact planning / mijlpaal"), kind: "text" },
    actionOwner,
    { key: "target_recovery_date", label: w("Target recovery date", "Streefdatum herstel"), kind: "date" },
    recordStatus,
    closureNote(w("Closure note and reviewer", "Afsluitnotitie en beoordelaar")),
  ],
  lessons_learned: [
    { key: "project_phase", label: w("Project phase", "Projectfase"), kind: "select", options: catalogue.lessonPhases, required: true },
    { key: "lesson_category", label: w("Lesson category", "Categorie les"), kind: "dependent", groups: catalogue.lessonCategories, parent: "project_phase", required: true },
    { key: "situation", label: w("Situation / context", "Situatie / context"), kind: "textarea", required: true },
    { key: "impact_types", label: w("Impact / consequence", "Impact / gevolg"), kind: "multi", options: catalogue.impactTypes, required: true, otherExplanation: true },
    { key: "impact_detail", label: w("Actual consequence", "Werkelijk gevolg"), kind: "text", required: true },
    { key: "applicability", label: w("Applicability", "Toepasbaarheid"), kind: "select", options: catalogue.lessonApplicability, required: true },
    discipline("discipline", false),
    { key: "action_owner", label: w("Action owner", "Actiehouder"), kind: "text" },
    { key: "review_status", label: w("Review status", "Beoordelingsstatus"), kind: "select", options: catalogue.lessonReviewStatuses, required: true, initial: "Draft" },
    { key: "reviewed_by", label: w("Reviewed by", "Beoordeeld door"), kind: "text", visible: (values) => ["Reviewed", "Approved for Sharing", "Archived"].includes(one(values, "review_status")), required: (values) => ["Reviewed", "Approved for Sharing"].includes(one(values, "review_status")) },
  ],
  agreement: [
    { key: "agreement_at", label: w("Meeting / agreement date and time", "Datum en tijd overleg / afspraak"), kind: "datetime", required: true },
    { key: "meeting_source", label: w("Meeting / source", "Overleg / bron"), kind: "select", options: catalogue.agreementSources, otherExplanation: true },
    { key: "meeting_reference", label: w("Meeting number / reference", "Overlegnummer / referentie"), kind: "text", visible: (values) => has(values, "meeting_source") },
    { key: "agreement_type", label: w("Agreement type", "Soort afspraak"), kind: "select", options: catalogue.agreementTypes, required: true },
    { key: "agreement_category", label: w("Agreement category", "Categorie afspraak"), kind: "dependent", groups: catalogue.agreementCategories, parent: "agreement_type", required: true },
    { key: "agreed_by", label: w("Agreed by", "Overeengekomen door"), kind: "text", required: true, hint: w("Every party that explicitly agreed, separated by commas", "Elke partij die uitdrukkelijk akkoord ging, gescheiden door komma's") },
    { key: "action_required", label: w("Action required", "Actie nodig"), kind: "select", options: ["Yes", "No"], required: true },
    { key: "action_owner", label: w("Action owner", "Actiehouder"), kind: "text", visible: (values) => one(values, "action_required") === "Yes", required: (values) => one(values, "action_required") === "Yes" },
    { key: "action_due", label: w("Due date", "Uiterste datum"), kind: "date", visible: (values) => one(values, "action_required") === "Yes", required: (values) => one(values, "action_required") === "Yes" },
    discipline("discipline", false),
    relatedRecord,
    recordStatus,
    closureNote(w("Confirmation / closure note", "Bevestiging / afsluitnotitie")),
  ],
  photo: [
    { key: "photo_purpose", label: w("Photo purpose", "Doel van de foto"), kind: "select", options: catalogue.photoPurposes, required: true, otherExplanation: true },
    discipline("discipline", false),
    relatedRecord,
  ],
  works_ongoing: [
    { key: "shift", label: w("Shift", "Dienst"), kind: "select", options: catalogue.shifts, otherExplanation: true },
    discipline("discipline", true),
    { key: "activity", label: w("Activity", "Activiteit"), kind: "activity", parent: "discipline", required: true },
    { key: "work_item", label: w("What exactly is being worked on?", "Waar wordt precies aan gewerkt?"), kind: "text", required: true },
    { key: "exact_location", label: w("Exact location / grid / level", "Exacte locatie / stramien / niveau"), kind: "text", required: true, hint: w("e.g. Level 1, grids A-D/1-4, slab S1", "bv. Niveau 1, stramien A-D/1-4, vloer S1") },
    { key: "quantity", label: w("Quantity completed (this period)", "Hoeveelheid gereed (deze periode)"), kind: "number", min: 0 },
    unitField("quantity"),
    { key: "progress_status", label: w("Progress status", "Voortgangsstatus"), kind: "select", options: catalogue.progressStatuses, required: true },
    { key: "progress_percent", label: w("Progress percentage", "Voortgangspercentage"), kind: "number", min: 0, max: 100 },
    { key: "crew", label: w("Crew / contractor", "Ploeg / aannemer"), kind: "text", required: true },
    { key: "start_time", label: w("Start time", "Begintijd"), kind: "time" },
    { key: "finish_time", label: w("Finish time", "Eindtijd"), kind: "time" },
    { key: "element_type", label: w("Element", "Element"), kind: "select", options: ["Slab", "Beam", "Column", "Footing", "Wall", "Other"], visible: concretePouring, required: concretePouring, otherExplanation: true },
    { key: "element_id", label: w("Element ID", "Element-ID"), kind: "text", visible: concretePouring, required: concretePouring },
    { key: "concrete_grade", label: w("Concrete grade / mix", "Betonsterkte / mengsel"), kind: "text", visible: concretePouring, required: concretePouring },
    { key: "concrete_volume", label: w("Volume (m³)", "Volume (m³)"), kind: "number", visible: concretePouring, required: concretePouring, min: 0 },
    { key: "delivery_tickets", label: w("Delivery ticket / batch references", "Leverbon- / batchreferenties"), kind: "text", visible: concretePouring },
    { key: "slump_cube_refs", label: w("Slump and cube sample references", "Referenties zetmaat en kubussen"), kind: "text", visible: concretePouring },
    { key: "activity_details", label: w("Activity-specific technical details", "Activiteitspecifieke technische gegevens"), kind: "textarea", visible: (values) => has(values, "activity") && !concretePouring(values) },
    { key: "inspection_reference", label: w("Inspection / test reference", "Inspectie- / testreferentie"), kind: "text" },
    { key: "blocker", label: w("Blocker / issue", "Belemmering"), kind: "select", options: catalogue.workBlockers, otherExplanation: true, visible: (values) => one(values, "progress_status") === "On Hold" || has(values, "blocker"), required: (values) => one(values, "progress_status") === "On Hold" },
    { key: "remarks", label: w("Remarks", "Opmerkingen"), kind: "text" },
  ],
  works_completed: [
    discipline("discipline", true),
    { key: "activity", label: w("Activity", "Activiteit"), kind: "activity", parent: "discipline", required: true },
    { key: "completed_items", label: w("What was completed?", "Wat is gereed?"), kind: "completion", parent: "activity", required: true, otherExplanation: true },
    { key: "exact_location", label: w("Exact location / grid / level", "Exacte locatie / stramien / niveau"), kind: "text", required: true },
    { key: "quantity", label: w("Quantity completed", "Hoeveelheid gereed"), kind: "number", min: 0 },
    unitField("quantity"),
    { key: "inspection_status", label: w("Completion / inspection status", "Status gereed / keuring"), kind: "select", options: catalogue.completionInspectionStatuses, required: true, hint: w("Completed is not the same as accepted", "Gereed is niet hetzelfde als geaccepteerd") },
    { key: "inspection_reference", label: w("Inspection reference", "Inspectiereferentie"), kind: "text", visible: (values) => one(values, "inspection_status").startsWith("Inspected") },
    { key: "ncr_reference", label: w("Linked NCR / issue", "Gekoppelde NCR / issue"), kind: "text", visible: (values) => one(values, "inspection_status") === "Inspected - Rejected", required: (values) => one(values, "inspection_status") === "Inspected - Rejected" },
    { key: "crew", label: w("Contractor / crew", "Aannemer / ploeg"), kind: "text", required: true },
    { key: "outstanding", label: w("Outstanding work / defects", "Openstaand werk / gebreken"), kind: "text", visible: (values) => one(values, "inspection_status") !== "Inspected - Accepted" },
    { key: "activity_details", label: w("Activity-specific technical details", "Activiteitspecifieke technische gegevens"), kind: "textarea", visible: (values) => has(values, "activity") },
    { key: "remarks", label: w("Remarks", "Opmerkingen"), kind: "text" },
  ],
  workforce: [
    { key: "shift", label: w("Shift", "Dienst"), kind: "select", options: catalogue.shifts, otherExplanation: true },
    { key: "attendance_status", label: w("Attendance status", "Aanwezigheidsstatus"), kind: "select", options: catalogue.attendanceStatuses },
    { key: "competency_status", label: w("Competency / authorization status", "Status bevoegdheid / autorisatie"), kind: "select", options: catalogue.competencyStatuses },
  ],
};

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

/** The options a field offers given the other values of the form. */
export function fieldOptions(field: SpecField, values: SpecValues): SpecOption[] {
  if (field.kind === "dependent") return field.groups?.[one(values, field.parent ?? "")] ?? [];
  if (field.kind === "activity") return activitiesFor(one(values, field.parent ?? ""));
  if (field.kind === "completion") return (activityGuide(one(values, "discipline"), one(values, "activity"))?.completionOptions ?? []).map((value) => ({ value, description: "" }));
  return (field.options ?? []).map((value) => ({ value, description: "" }));
}

export const isVisible = (field: SpecField, values: SpecValues) => (field.visible ? field.visible(values) : true)
  && (field.kind !== "dependent" && field.kind !== "activity" && field.kind !== "completion" ? true : fieldOptions(field, values).length > 0 || !field.parent || has(values, field.parent));

export const isRequired = (field: SpecField, values: SpecValues) => typeof field.required === "function" ? field.required(values) : Boolean(field.required);

export const otherKey = (field: SpecField) => `${field.key}_other`;

export function needsOtherExplanation(field: SpecField, values: SpecValues) {
  return Boolean(field.otherExplanation) && val(values, field.key).some(isOtherOption);
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
      if (!field.parent && field.kind !== "completion") continue;
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
  const next: SpecValues = { ...values };
  for (const field of specForms[form]) if (field.initial && next[field.key] === undefined) next[field.key] = field.initial;
  return next;
}

/** The labels of every visible required field that is still empty, in form order. */
export function specMissing(form: SpecFormKey, rawValues: SpecValues, language: "en" | "nl" = "en", skip: readonly string[] = []): string[] {
  const values = withInitial(form, rawValues);
  const missing: string[] = [];
  for (const field of specForms[form]) {
    if (skip.includes(field.key) || !isVisible(field, values)) continue;
    const label = field.label[language];
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
    if (start && finish && finish < start && one(values, "crosses_midnight") !== "yes") missing.push(language === "nl" ? "Eindtijd ligt voor begintijd" : "Finish time is earlier than start time");
  }
  return missing;
}

/** Label/value pairs of the filled spec fields, for lists, the day overview and exports. */
export function specFacts(form: SpecFormKey, values: SpecValues | null | undefined, language: "en" | "nl" = "en"): Array<[string, string]> {
  if (!values) return [];
  const facts: Array<[string, string]> = [];
  for (const field of specForms[form]) {
    const entered = val(values, field.key).filter((item) => String(item).trim() !== "");
    if (!entered.length) continue;
    let text = entered.join(", ");
    const other = one(values, otherKey(field)).trim();
    if (other) text += ` (${other})`;
    if (field.kind === "number" && values[`${field.key}_unit`]) text += ` ${one(values, `${field.key}_unit`)}`;
    if (field.key.endsWith("_unit") && specForms[form].some((item) => `${item.key}_unit` === field.key)) continue;
    facts.push([field.label[language], text]);
  }
  return facts;
}

/** Keeps only the keys a form defines (and their "Other" explanations) before it is stored. */
export function cleanSpecValues(form: SpecFormKey, rawValues: SpecValues): Record<string, SpecValue> {
  const values = withInitial(form, rawValues);
  const out: Record<string, SpecValue> = {};
  for (const field of specForms[form]) {
    if (!isVisible(field, values)) continue;
    const value = values[field.key];
    if (Array.isArray(value) ? value.length : typeof value === "string" && value.trim() !== "") out[field.key] = Array.isArray(value) ? value : value!.trim();
    const other = one(values, otherKey(field)).trim();
    if (other && needsOtherExplanation(field, values)) out[otherKey(field)] = other;
  }
  if (form === "works_ongoing" && one(values, "crosses_midnight") === "yes") out.crosses_midnight = "yes";
  return out;
}

/** Workflow profile of the Sign-off Workflow sheet per form. */
export const workflowProfiles: Record<SpecFormKey | "inspection", string> = {
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
