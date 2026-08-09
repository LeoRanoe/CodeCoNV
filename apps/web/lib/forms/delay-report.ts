/**
 * The client's own Project Delay Report (PDR). A delay in the daily log is "we lost three
 * hours to rain today"; this is the other kind — the one that moves the finish date of the
 * works and has to be evidenced, acknowledged and closed out.
 *
 * Four things on the client's mockup are struck through, and each for the same reason:
 * they were asked twice.
 *  - The delay start date. The report is written on the day the delay is recorded, and the
 *    header already carries that date.
 *  - The actual completed date in section 2. It belongs in the completion box, section 5,
 *    where it is asked for together with the photo that proves it.
 *  - The baseline finish date repeated at the top of section 3. Section 2 already states
 *    it; repeating it is how two different dates end up on one form.
 *  - The contractor's proposed finish date and likely completion date. The revised finish
 *    date follows from the baseline and the delay duration, and is agreed once.
 */

export const delayActivities = [
  { id: "site_setup", en: "Site setup and temporary works", nl: "Bouwplaatsinrichting en tijdelijke voorzieningen" },
  { id: "earthworks", en: "Earthworks and excavation", nl: "Grondwerk en ontgraving" },
  { id: "piling_foundations", en: "Piling and foundations", nl: "Heiwerk en fundering" },
  { id: "formwork_scaffolding", en: "Formwork and scaffolding", nl: "Bekisting en steigerwerk" },
  { id: "concrete_rebar", en: "Concrete and rebar", nl: "Beton en wapening" },
  { id: "masonry", en: "Masonry", nl: "Metselwerk" },
  { id: "steel_structure", en: "Steel structure", nl: "Staalconstructie" },
  { id: "roofing", en: "Roof structure and roofing", nl: "Dakconstructie en dakbedekking" },
  { id: "facade", en: "Facade and cladding", nl: "Gevel en gevelbekleding" },
  { id: "electrical", en: "Electrical installation", nl: "Elektrotechnische installatie" },
  { id: "mechanical_hvac", en: "Mechanical installation and HVAC", nl: "Mechanische installatie en HVAC" },
  { id: "plumbing", en: "Plumbing and sanitary", nl: "Loodgieterswerk en sanitair" },
  { id: "finishes", en: "Plastering, tiling and finishes", nl: "Stucwerk, tegelwerk en afwerking" },
  { id: "site_works", en: "Paving, roads and site works", nl: "Bestrating, wegen en terreinwerk" },
  { id: "commissioning", en: "Testing, commissioning and handover", nl: "Testen, inbedrijfstelling en oplevering" },
  { id: "other", en: "Other activity", nl: "Andere activiteit" },
] as const;

export const delayCategories = [
  { id: "labor_manpower", en: "Labor / manpower", nl: "Arbeid / mankracht" },
  { id: "material_equipment", en: "Material / equipment", nl: "Materiaal / materieel" },
  { id: "design_documentation", en: "Design / documentation", nl: "Ontwerp / documentatie" },
  { id: "site_condition", en: "Site condition", nl: "Situatie op locatie" },
  { id: "weather", en: "Weather", nl: "Weer" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

export const delayTypes = [
  { id: "concurrent", en: "Concurrent delay", nl: "Gelijktijdige vertraging" },
  { id: "excusable", en: "Excusable delay", nl: "Verschoonbare vertraging" },
  { id: "non_excusable", en: "Non-excusable delay", nl: "Niet-verschoonbare vertraging" },
  { id: "owner_employer_cause", en: "Owner / employer cause", nl: "Oorzaak bij opdrachtgever" },
  { id: "force_majeure", en: "Force majeure", nl: "Overmacht" },
  { id: "other", en: "Other", nl: "Overig" },
] as const;

export const delayImpacts = [
  { id: "critical_path", en: "Affects critical path", nl: "Beïnvloedt het kritieke pad" },
  { id: "milestone", en: "Affects milestone", nl: "Beïnvloedt een mijlpaal" },
  { id: "no_critical_path_impact", en: "No impact on critical path", nl: "Geen effect op het kritieke pad" },
] as const;

/** Section 3: what the works actually looked like on the day they should have been done. */
export const delayStatusOnFinishDate = [
  { id: "not_started", en: "Not started", nl: "Niet gestart" },
  { id: "in_progress_behind", en: "In progress · behind schedule", nl: "In uitvoering · achter op planning" },
  { id: "in_progress_on_track", en: "In progress · on track to recover", nl: "In uitvoering · haalt de inloop" },
  { id: "substantially_complete", en: "Substantially complete", nl: "Grotendeels gereed" },
  { id: "complete_with_defects", en: "Complete with defects", nl: "Gereed met gebreken" },
] as const;

/** Section 5: the client wrote "STATUS!" next to the completion box, so it says one. */
export const delayCompletionStatuses = [
  { id: "completed_on_revised_date", en: "Completed on the revised date", nl: "Afgerond op de herziene datum" },
  { id: "completed_late", en: "Completed after the revised date", nl: "Afgerond na de herziene datum" },
  { id: "completed_early", en: "Completed before the revised date", nl: "Afgerond vóór de herziene datum" },
  { id: "not_completed", en: "Not completed", nl: "Niet afgerond" },
] as const;

export type DelayReportState = {
  activity: string;
  description: string;
  categories: string[];
  categoryOther: string;
  types: string[];
  typeOther: string;
  impacts: string[];
  /** Calendar days, which is what moves the finish date. */
  durationDays: string;
  originalFinishDate: string;
  /** Derived from the baseline and the duration; kept so the stored record states it. */
  newExpectedFinishDate: string;
  /** Section 3. */
  statusOnFinishDate: string;
  statusDescription: string;
  /** Section 4. */
  recoveryPlan: string;
  contractorRepresentative: string;
  contractorSignedBy: string;
  contractorSignedAt: string;
  contractorSignatureImage: string;
  /** Section 5. */
  actualCompletedDate: string;
  completionStatus: string;
  completionRemarks: string;
};

export const emptyDelayReport: DelayReportState = {
  activity: "",
  description: "",
  categories: [],
  categoryOther: "",
  types: [],
  typeOther: "",
  impacts: [],
  durationDays: "0",
  originalFinishDate: "",
  newExpectedFinishDate: "",
  statusOnFinishDate: "",
  statusDescription: "",
  recoveryPlan: "",
  contractorRepresentative: "",
  contractorSignedBy: "",
  contractorSignedAt: "",
  contractorSignatureImage: "",
  actualCompletedDate: "",
  completionStatus: "",
  completionRemarks: "",
};

/**
 * The revised finish date is the baseline moved by the delay, in calendar days. The client
 * drew an arrow from the duration to the date for exactly this reason: two fields that can
 * disagree about the same fact are two chances to be wrong.
 */
export function delayRevisedFinishDate(originalFinishDate: string, durationDays: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(originalFinishDate)) return "";
  const days = Number(durationDays);
  if (!Number.isFinite(days)) return originalFinishDate;
  const moved = new Date(`${originalFinishDate}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + Math.trunc(days));
  return moved.toISOString().slice(0, 10);
}

/** Whether the completion box has been started; its photo is required once it has. */
export function delayCompletionStarted(state: DelayReportState) {
  return Boolean(state.actualCompletedDate || state.completionStatus || state.completionRemarks.trim());
}

/** What the register, the reports and the printed form read back. */
export function delayReportDetails(state: DelayReportState) {
  return {
    schema: "codeco.delay-report.v1",
    activity: state.activity || null,
    description: state.description.trim(),
    delay_categories: state.categories,
    delay_category_other: state.categoryOther.trim() || null,
    delay_types: state.types,
    delay_type_other: state.typeOther.trim() || null,
    delay_impacts: state.impacts,
    delay_duration_days: Number(state.durationDays || 0),
    original_finish_date: state.originalFinishDate || null,
    new_expected_finish_date: state.newExpectedFinishDate
      || delayRevisedFinishDate(state.originalFinishDate, state.durationDays)
      || null,
    status_on_finish_date: state.statusOnFinishDate || null,
    status_description: state.statusDescription.trim() || null,
    recovery_plan: state.recoveryPlan.trim() || null,
    contractor_representative: state.contractorRepresentative.trim() || null,
    contractor_signed_by: state.contractorSignedBy || null,
    contractor_signed_at: state.contractorSignedAt || null,
    contractor_signature_image: state.contractorSignatureImage || null,
    actual_completed_date: state.actualCompletedDate || null,
    completion_status: state.completionStatus || null,
    completion_remarks: state.completionRemarks.trim() || null,
  };
}

/**
 * What the form needs before it may be saved. The two photo slots are checked by the
 * screen, which is what holds them; everything else is checked here.
 */
export function delayReportReady(state: DelayReportState) {
  return Boolean(state.activity)
    && state.description.trim().length >= 3
    && state.categories.length > 0
    && state.types.length > 0
    && state.impacts.length > 0
    && Boolean(state.originalFinishDate)
    && Boolean(state.statusOnFinishDate)
    && state.recoveryPlan.trim().length >= 3
    && state.contractorRepresentative.trim().length >= 2;
}
