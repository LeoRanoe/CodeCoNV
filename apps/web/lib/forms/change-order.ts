/**
 * The client's own Change Order form (CO), which is more than a controlled document with a
 * title and a body. A change order is a contract change: it says what changes, why, what
 * that does to the finish date, who acknowledges it and who approves it.
 *
 * Two things on the client's mockup are struck through and stay struck through:
 *  - The photo of the actual status on the original finish date. That belongs to the delay
 *    report, which is where the client drew it; a change order changes the scope, and a
 *    picture of a wall does not evidence a scope change.
 *  - Two of the three approval columns. The developer originates the change and the
 *    contractor acknowledges it in section 5, so approving it twice more is the same
 *    signature three times. Supervision is the one that approves.
 */

export const changeOrderTypes = [
  { id: "addition", en: "Addition to scope", nl: "Uitbreiding van de scope" },
  { id: "omission", en: "Omission from scope", nl: "Vermindering van de scope" },
  { id: "substitution", en: "Substitution", nl: "Vervanging" },
  { id: "design_change", en: "Design change", nl: "Ontwerpwijziging" },
  { id: "specification_change", en: "Specification change", nl: "Wijziging specificatie" },
  { id: "quantity_change", en: "Quantity change", nl: "Hoeveelheidswijziging" },
  { id: "time_extension", en: "Time extension", nl: "Termijnverlenging" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

export const changeOrderReasons = [
  { id: "client_request", en: "Client request", nl: "Verzoek van de opdrachtgever" },
  { id: "design_development", en: "Design development", nl: "Ontwerpuitwerking" },
  { id: "site_condition", en: "Unforeseen site condition", nl: "Onvoorziene situatie op locatie" },
  { id: "error_omission", en: "Error or omission in documents", nl: "Fout of omissie in documenten" },
  { id: "authority_requirement", en: "Authority requirement", nl: "Eis van bevoegd gezag" },
  { id: "material_availability", en: "Material availability", nl: "Beschikbaarheid van materiaal" },
  { id: "coordination", en: "Coordination between disciplines", nl: "Coördinatie tussen disciplines" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

/** Section 2: what exactly changes. More than one may be true at the same time. */
export const changeOrderScopeAreas = [
  { id: "work_scope", en: "Work scope", nl: "Werkomvang" },
  { id: "design_drawing", en: "Design / drawing", nl: "Ontwerp / tekening" },
  { id: "specification", en: "Specification", nl: "Specificatie" },
  { id: "quantity", en: "Quantity", nl: "Hoeveelheid" },
  { id: "time", en: "Time", nl: "Tijd" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

/** Section 4: what the change does to the cost. The same four answers a technical instruction uses for time. */
export const changeOrderCostImpacts = [
  { id: "none", en: "None", nl: "Geen" },
  { id: "possible", en: "Possible", nl: "Mogelijk" },
  { id: "confirmed", en: "Confirmed", nl: "Bevestigd" },
  { id: "unknown", en: "To be assessed", nl: "Nog te beoordelen" },
] as const;

export type ChangeOrderState = {
  changeOrderType: string;
  reason: string;
  requestedBy: string;
  /** Section 2, which may be more than one thing at once. */
  scopeAreas: string[];
  scopeAreaOther: string;
  scopeDetails: string;
  /**
   * Section 3 is a yes/no on the client's mockup: either this change moves the finish date
   * or it does not. Only when it does are the three dates below worth asking for.
   */
  affectsSchedule: boolean;
  originalFinishDate: string;
  newExpectedFinishDate: string;
  extensionDays: string;
  /** Section 4: the cost answer and its explanation. */
  costImpact: string;
  costImpactExplanation: string;
  /** Section 5: the contractor acknowledges the change and what it does to the schedule. */
  contractorRepresentative: string;
  contractorPosition: string;
  contractorRemarks: string;
  contractorSignedBy: string;
  contractorSignedAt: string;
  contractorSignatureImage: string;
  /** Section 6: the one approval column the client kept. */
  supervisionName: string;
  supervisionSignedBy: string;
  supervisionSignedAt: string;
  supervisionSignatureImage: string;
};

export const emptyChangeOrder: ChangeOrderState = {
  changeOrderType: "",
  reason: "",
  requestedBy: "",
  scopeAreas: [],
  scopeAreaOther: "",
  scopeDetails: "",
  affectsSchedule: false,
  originalFinishDate: "",
  newExpectedFinishDate: "",
  extensionDays: "0",
  costImpact: "none",
  costImpactExplanation: "",
  contractorRepresentative: "",
  contractorPosition: "",
  contractorRemarks: "",
  contractorSignedBy: "",
  contractorSignedAt: "",
  contractorSignatureImage: "",
  supervisionName: "",
  supervisionSignedBy: "",
  supervisionSignedAt: "",
  supervisionSignatureImage: "",
};

/**
 * The new expected finish date follows from the baseline and the extension, so the two can
 * never contradict each other on the form the contractor signs. An extension of zero days
 * leaves the baseline where it is.
 */
export function changeOrderFinishDate(originalFinishDate: string, extensionDays: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(originalFinishDate)) return "";
  const days = Number(extensionDays);
  if (!Number.isFinite(days)) return originalFinishDate;
  const moved = new Date(`${originalFinishDate}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + Math.trunc(days));
  return moved.toISOString().slice(0, 10);
}

/** The form state of a stored change order, so editing one never saves it back empty. */
export function changeOrderFromDetails(details: Record<string, unknown>): ChangeOrderState {
  const text = (key: string) => (typeof details[key] === "string" ? (details[key] as string) : "");
  return {
    ...emptyChangeOrder,
    changeOrderType: text("change_order_type"),
    reason: text("change_reason"),
    requestedBy: text("requested_by"),
    scopeAreas: Array.isArray(details.scope_areas) ? (details.scope_areas as unknown[]).map(String) : [],
    scopeAreaOther: text("scope_area_other"),
    scopeDetails: text("scope_details"),
    affectsSchedule: details.affects_schedule === true,
    originalFinishDate: text("original_finish_date"),
    newExpectedFinishDate: text("new_expected_finish_date"),
    extensionDays: String(details.extension_days ?? "0"),
    costImpact: text("cost_impact") || "none",
    costImpactExplanation: text("cost_impact_explanation"),
    contractorRepresentative: text("contractor_representative"),
    contractorPosition: text("contractor_position"),
    contractorRemarks: text("contractor_remarks"),
    contractorSignedBy: text("contractor_signed_by"),
    contractorSignedAt: text("contractor_signed_at"),
    contractorSignatureImage: text("contractor_signature_image"),
    supervisionName: text("supervision_name"),
    supervisionSignedBy: text("supervision_signed_by"),
    supervisionSignedAt: text("supervision_signed_at"),
    supervisionSignatureImage: text("supervision_signature_image"),
  };
}

/** What the register, the reports and the printed form read back. */
export function changeOrderDetails(state: ChangeOrderState) {
  const scheduled = state.affectsSchedule;
  return {
    change_order_type: state.changeOrderType || null,
    change_reason: state.reason || null,
    requested_by: state.requestedBy.trim() || null,
    scope_areas: state.scopeAreas,
    scope_area_other: state.scopeAreaOther.trim() || null,
    scope_details: state.scopeDetails.trim() || null,
    affects_schedule: scheduled,
    original_finish_date: scheduled ? state.originalFinishDate || null : null,
    new_expected_finish_date: scheduled
      ? state.newExpectedFinishDate || changeOrderFinishDate(state.originalFinishDate, state.extensionDays) || null
      : null,
    extension_days: scheduled ? Number(state.extensionDays || 0) : 0,
    cost_impact: state.costImpact || "none",
    cost_impact_explanation: state.costImpactExplanation.trim() || null,
    contractor_representative: state.contractorRepresentative.trim() || null,
    contractor_position: state.contractorPosition.trim() || null,
    contractor_remarks: state.contractorRemarks.trim() || null,
    contractor_signed_by: state.contractorSignedBy || null,
    contractor_signed_at: state.contractorSignedAt || null,
    contractor_signature_image: state.contractorSignatureImage || null,
    supervision_name: state.supervisionName.trim() || null,
    supervision_signed_by: state.supervisionSignedBy || null,
    supervision_signed_at: state.supervisionSignedAt || null,
    supervision_signature_image: state.supervisionSignatureImage || null,
  };
}

/**
 * A change order may only be saved once it says what changes and why. The signatures are
 * not required to save it: a change order is drawn up before it is signed, and holding the
 * draft hostage to a signature is how people keep them in their heads instead.
 */
export function changeOrderReady(state: ChangeOrderState) {
  return changeOrderMissing(state).length === 0;
}

/** The same rule as `changeOrderReady`, as the names of what is still empty. */
export function changeOrderMissing(state: ChangeOrderState): Array<{ en: string; nl: string }> {
  const missing: Array<{ en: string; nl: string }> = [];
  if (!state.changeOrderType) missing.push({ en: "type of change order", nl: "soort wijzigingsopdracht" });
  if (!state.reason) missing.push({ en: "reason", nl: "reden" });
  if (!state.scopeAreas.length) missing.push({ en: "affected scope area", nl: "scope-gebied" });
  if (state.scopeDetails.trim().length < 3) missing.push({ en: "scope description", nl: "omschrijving van de scope" });
  if (state.affectsSchedule && !state.originalFinishDate) missing.push({ en: "original finish date", nl: "oorspronkelijke einddatum" });
  return missing;
}

type Translate = (en: string, nl: string) => string;

const labelOf = (list: ReadonlyArray<{ id: string; en: string; nl: string }>, id: unknown, text: Translate) => {
  const found = list.find((item) => item.id === id);
  return found ? text(found.en, found.nl) : typeof id === "string" ? id.replaceAll("_", " ") : "";
};

/**
 * What a stored change order says, as label and value pairs for its record card: the type,
 * the reason, what changes, the schedule answer, the cost answer and whether the contractor
 * representative has signed. Empty answers are left out.
 */
export function changeOrderSummary(details: Record<string, unknown>, text: Translate): Array<{ label: string; value: string }> {
  const read = (key: string) => (typeof details[key] === "string" ? (details[key] as string).trim() : "");
  const areas = Array.isArray(details.scope_areas)
    ? (details.scope_areas as unknown[]).map((area) => labelOf(changeOrderScopeAreas, area, text)).filter(Boolean).join(", ")
    : "";
  const scheduled = details.affects_schedule === true;
  const costImpact = read("cost_impact");
  const contractorSigned = Boolean(read("contractor_signed_at") || read("contractor_signature_image") || read("contractor_signed_by"));
  const rows: Array<{ label: string; value: string }> = [
    { label: text("Type of change", "Soort wijziging"), value: labelOf(changeOrderTypes, details.change_order_type, text) },
    { label: text("Reason", "Reden"), value: labelOf(changeOrderReasons, details.change_reason, text) },
    { label: text("Requested by", "Aangevraagd door"), value: read("requested_by") },
    { label: text("Scope", "Scope"), value: [areas, read("scope_area_other")].filter(Boolean).join(" · ") },
    { label: text("What changes", "Wat verandert"), value: read("scope_details") },
    {
      label: text("Schedule impact", "Planningimpact"),
      value: scheduled
        ? [text("Yes", "Ja"), read("new_expected_finish_date") ? `${text("new finish", "nieuwe einddatum")} ${read("new_expected_finish_date")}` : "", Number(details.extension_days) ? `+${Number(details.extension_days)} ${text("days", "dagen")}` : ""].filter(Boolean).join(" · ")
        : text("No", "Nee"),
    },
    {
      label: text("Cost impact", "Kostenimpact"),
      value: [labelOf(changeOrderCostImpacts, costImpact || "none", text), read("cost_impact_explanation")].filter(Boolean).join(" · "),
    },
    {
      label: text("Contractor representative", "Vertegenwoordiger aannemer"),
      value: [
        read("contractor_representative") || read("contractor_signed_by"),
        contractorSigned ? text("signed", "ondertekend") : text("not signed yet", "nog niet ondertekend"),
      ].filter(Boolean).join(" · "),
    },
  ];
  return rows.filter((row) => row.value);
}
