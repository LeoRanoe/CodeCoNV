import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The Sign-off Workflow sheet of the client's specification: one append-only event per
 * action, many rounds, many signatories. The database writes and checks every event
 * (record_signoff_action); this file only describes the profiles and reads the log.
 */
export type SignoffAction =
  | "submit" | "acknowledge" | "review" | "approve" | "accept" | "reject" | "return"
  | "respond" | "resubmit" | "verify" | "close" | "withdraw" | "reopen" | "witness";

export type SignoffRecordKind = "finding" | "hse_event" | "register_entry" | "inspection" | "day_report";

export type SignoffEvent = {
  id: string;
  record_kind: SignoffRecordKind;
  record_id: string;
  workflow_profile: string;
  round_number: number;
  stage_number: number;
  action: SignoffAction;
  actor_user_id: string;
  actor_name: string;
  actor_organization: string | null;
  actor_role: string;
  /** The step role chosen in the screen (F16); actor_role is the server-derived project role. */
  stage_role?: string | null;
  attestation_method: "account" | "external_representative" | "signed_document";
  signature_image: string | null;
  evidence_file_id?: string | null;
  comments: string | null;
  return_reason: string | null;
  next_actor: string | null;
  due_at: string | null;
  previous_status: string | null;
  new_status: string;
  created_at: string;
  /** What the Close / Verify / Approve dialog carried (closure note, verification result, approved amount and days). */
  details?: Record<string, string> | null;
};

type Words = { en: string; nl: string };
const w = (en: string, nl: string): Words => ({ en, nl });

export type SignoffStage = { number: number; label: Words; actions: SignoffAction[]; role: Words };

export type SignoffProfile = {
  code: string;
  label: Words;
  stages: SignoffStage[];
  rule: Words;
};

const supervision = w("Supervision", "Supervisie");
const contractor = w("Contractor", "Aannemer");

/**
 * Stage 1–4 of every profile, as in the sheet's table (v5.0, 25-11-2026): there is no Supervision
 * review or accept step. A submission by Supervision is final; only the Change Order has an approval,
 * by the Project Manager. Stage 4 is the return / resubmit loop where the profile has one.
 */
export const signoffProfiles: Record<string, SignoffProfile> = {
  "WO-DAILY": {
    code: "WO-DAILY", label: w("Daily progress", "Dagvoortgang"),
    stages: [
      { number: 1, label: w("Supervision records and submits daily progress", "Supervisie legt dagvoortgang vast en dient in"), actions: ["submit"], role: supervision },
    ],
    rule: w("Final on submit; a correction is a new version by Supervision.", "Definitief bij indienen; een correctie is een nieuwe versie door Supervisie."),
  },
  "WC-COMPLETION": {
    code: "WC-COMPLETION", label: w("Completed work", "Gereed werk"),
    stages: [
      { number: 1, label: w("Supervision records the completed work", "Supervisie legt het gereedgekomen werk vast"), actions: ["submit"], role: supervision },
    ],
    rule: w("Physical completion is not quality acceptance.", "Fysiek gereed is geen kwaliteitsacceptatie."),
  },
  "WF-ATTENDANCE": {
    code: "WF-ATTENDANCE", label: w("Workforce count", "Bezetting"),
    stages: [
      { number: 1, label: w("Supervision records the daily workforce count", "Supervisie legt de dagelijkse bezetting vast"), actions: ["submit"], role: supervision },
    ],
    rule: w("Final on submit; the contractor does not complete this form.", "Definitief bij indienen; de aannemer vult dit formulier niet in."),
  },
  "PDR-REVIEW": {
    code: "PDR-REVIEW", label: w("Delay report", "Vertragingsrapport"),
    stages: [
      { number: 1, label: w("Supervision records delay facts and submits", "Supervisie legt de feiten van de vertraging vast en dient in"), actions: ["submit"], role: supervision },
      { number: 2, label: w("Responsible party may respond", "Verantwoordelijke partij kan reageren"), actions: ["acknowledge", "respond"], role: w("Responsible party", "Verantwoordelijke partij") },
      { number: 3, label: w("Supervision updates and closes", "Supervisie werkt bij en sluit"), actions: ["verify", "close", "return"], role: supervision },
      { number: 4, label: w("Update after a return", "Bijwerken na terugsturen"), actions: ["resubmit"], role: supervision },
    ],
    rule: w("Delay facts are recorded separately from any entitlement or claim.", "Feiten van de vertraging staan los van een aanspraak of claim."),
  },
  "ISSUE-CLOSEOUT": {
    code: "ISSUE-CLOSEOUT", label: w("Issue close-out", "Afhandeling issue"),
    stages: [
      { number: 1, label: w("Issue raised / assigned", "Issue gemeld / toegewezen"), actions: ["submit"], role: supervision },
      { number: 2, label: w("Contractor acknowledges and responds", "Aannemer bevestigt en reageert"), actions: ["acknowledge", "respond"], role: contractor },
      { number: 3, label: w("Supervision verifies", "Supervisie verifieert"), actions: ["verify", "close", "return"], role: supervision },
      { number: 4, label: w("Contractor resubmits", "Aannemer dient opnieuw in"), actions: ["resubmit"], role: contractor },
    ],
    rule: w("Acknowledgement is not acceptance of fault.", "Bevestiging is geen erkenning van schuld."),
  },
  "HSE-OBSERVATION": {
    code: "HSE-OBSERVATION", label: w("HSE observation close-out", "Afhandeling HSE-observatie"),
    stages: [
      { number: 1, label: w("Observation raised", "Observatie gemeld"), actions: ["submit"], role: w("Reporter", "Melder") },
      { number: 2, label: w("Contractor acknowledges and responds", "Aannemer bevestigt en reageert"), actions: ["acknowledge", "respond"], role: contractor },
      { number: 3, label: w("HSE/supervision verifies", "HSE/supervisie verifieert"), actions: ["verify", "close", "return"], role: w("HSE / supervision", "HSE / supervisie") },
      { number: 4, label: w("Contractor resubmits", "Aannemer dient opnieuw in"), actions: ["resubmit"], role: contractor },
    ],
    rule: w("High-risk items are escalated by project rules.", "Hoog risico wordt geëscaleerd volgens projectregels."),
  },
  "MAT-RECEIPT": {
    code: "MAT-RECEIPT", label: w("Material receipt", "Materiaalontvangst"),
    stages: [
      { number: 1, label: w("Supervision records delivery, quantity, condition and inspection result", "Supervisie legt levering, hoeveelheid, staat en keuring vast"), actions: ["submit"], role: supervision },
    ],
    rule: w("Final on submit; the delivery note is attached as evidence.", "Definitief bij indienen; de pakbon wordt als bewijs bijgevoegd."),
  },
  "INSPECTION-WITNESS": {
    code: "INSPECTION-WITNESS", label: w("Inspection witness", "Inspectie met getuige"),
    stages: [
      { number: 1, label: w("Inspector records and signs result", "Inspecteur legt resultaat vast"), actions: ["submit"], role: w("Inspector", "Inspecteur") },
      { number: 2, label: w("Contractor witness acknowledges (optional)", "Getuige aannemer bevestigt (optioneel)"), actions: ["witness", "acknowledge"], role: contractor },
    ],
    rule: w("A witness acknowledgement never changes the inspection result.", "Een getuigenbevestiging verandert het inspectieresultaat niet."),
  },
  "TECH-INSTRUCTION": {
    code: "TECH-INSTRUCTION", label: w("Technical instruction", "Technische instructie"),
    stages: [
      { number: 1, label: w("Supervision issues instruction", "Supervisie geeft instructie"), actions: ["submit"], role: supervision },
      { number: 2, label: w("Contractor acknowledges receipt", "Aannemer bevestigt ontvangst"), actions: ["acknowledge"], role: contractor },
      { number: 3, label: w("Contractor responds / implements", "Aannemer reageert / voert uit"), actions: ["respond"], role: contractor },
      { number: 4, label: w("Clarification, return or verification", "Verduidelijking, terugsturen of verificatie"), actions: ["return", "resubmit", "verify", "close"], role: supervision },
    ],
    rule: w("Acknowledgement confirms receipt, not commercial acceptance.", "Bevestiging is ontvangst, geen commerciële acceptatie."),
  },
  "CHANGE-APPROVAL": {
    code: "CHANGE-APPROVAL", label: w("Change approval", "Goedkeuring wijziging"),
    stages: [
      { number: 1, label: w("Supervision records the change request", "Supervisie legt de wijzigingsaanvraag vast"), actions: ["submit"], role: w("Originator", "Aanvrager") },
      { number: 3, label: w("Project Manager approves, rejects or returns", "Projectmanager keurt goed, af of stuurt terug"), actions: ["approve", "reject", "return"], role: w("Project Manager", "Projectmanager") },
      { number: 4, label: w("Revise and resubmit to the Project Manager", "Herzien en opnieuw indienen bij de projectmanager"), actions: ["resubmit", "withdraw"], role: w("Originator", "Aanvrager") },
    ],
    rule: w("No client signature and no separate reviewer; the Project Manager does not approve a change they submitted. The instruction to proceed is recorded separately.", "Geen handtekening opdrachtgever en geen aparte beoordelaar; de projectmanager keurt geen wijziging goed die zij zelf indiende. De opdracht tot uitvoering wordt apart vastgelegd."),
  },
  "NCR-CORRECTIVE": {
    code: "NCR-CORRECTIVE", label: w("NCR corrective action", "Corrigerende maatregel NCR"),
    stages: [
      { number: 1, label: w("Supervision raises NCR", "Supervisie stelt NCR op"), actions: ["submit"], role: supervision },
      { number: 2, label: w("Contractor acknowledges and responds", "Aannemer bevestigt en reageert"), actions: ["acknowledge", "respond"], role: contractor },
      { number: 3, label: w("Supervision verifies the corrective action and closes", "Supervisie verifieert de maatregel en sluit"), actions: ["return", "verify", "close"], role: supervision },
      { number: 4, label: w("Contractor revises", "Aannemer herziet"), actions: ["resubmit"], role: contractor },
    ],
    rule: w("Acknowledgement is receipt only, not an admission of liability.", "Bevestiging is alleen ontvangst, geen erkenning van aansprakelijkheid."),
  },
  "AGREEMENT-ACK": {
    code: "AGREEMENT-ACK", label: w("Agreement acknowledgement", "Bevestiging afspraak"),
    stages: [
      { number: 1, label: w("Supervision records the agreement and actions", "Supervisie legt afspraak en acties vast"), actions: ["submit"], role: supervision },
      { number: 2, label: w("Parties acknowledge separately", "Partijen bevestigen apart"), actions: ["acknowledge"], role: w("Party", "Partij") },
      { number: 3, label: w("Supervision tracks the actions and closes", "Supervisie volgt de acties en sluit"), actions: ["close"], role: supervision },
    ],
    rule: w("One record may carry many acknowledging parties.", "Eén registratie kan veel bevestigende partijen hebben."),
  },
  "LESSON-REVIEW": {
    code: "LESSON-REVIEW", label: w("Lesson learned", "Les"),
    stages: [
      { number: 1, label: w("Supervision author records and submits the lesson", "Supervisie-auteur legt de les vast en dient in"), actions: ["submit"], role: w("Author", "Auteur") },
    ],
    rule: w("Final on submit; a correction is a new version by the author.", "Definitief bij indienen; een correctie is een nieuwe versie door de auteur."),
  },
  "HSE-INCIDENT": {
    code: "HSE-INCIDENT", label: w("Incident", "Incident"),
    stages: [
      { number: 1, label: w("Supervision / HSE Officer records incident and investigation", "Supervisie / HSE-officer legt incident en onderzoek vast"), actions: ["submit"], role: w("Reporter", "Melder") },
      { number: 3, label: w("Responsible party submits actions", "Verantwoordelijke dient maatregelen in"), actions: ["respond", "acknowledge"], role: contractor },
      { number: 4, label: w("HSE Officer verifies the actions and closes", "HSE-officer verifieert de maatregelen en sluit"), actions: ["resubmit", "verify", "close", "return"], role: w("HSE Officer", "HSE-officer") },
    ],
    rule: w("Sensitive incident details stay restricted by role.", "Gevoelige incidentgegevens blijven beperkt per rol."),
  },
};

/**
 * The Close / Verify / Approve dialog (v5.0, Word 3.1): the closure note of an Issue and of an Agreement,
 * the verification result of an NCR and the approved amount and days of a Change Order are entered with the
 * action, not in the form, and stored in the sign-off log. The database checks them (record_signoff_action);
 * tests/close-verify-approve.test.mjs keeps this list identical to app_private.signoff_outcome_fields.
 */
export type SignoffOutcomeField = {
  key: "closure_note" | "verification_result" | "approved_amount" | "approved_days";
  label: Words;
  kind: "textarea" | "text" | "select" | "number";
  required: boolean;
  options?: string[];
  max?: number;
  hint?: Words;
};

const closureNoteField = (required: boolean, kind: "textarea" | "text", label: Words, max: number): SignoffOutcomeField => ({ key: "closure_note", label, kind, required, max });

export const signoffOutcomeFields: Record<string, Partial<Record<SignoffAction, SignoffOutcomeField[]>>> = {
  "ISSUE-CLOSEOUT": {
    verify: [closureNoteField(true, "textarea", w("Resolution / closure note", "Oplossing / afsluitnotitie"), 4000)],
    close: [closureNoteField(true, "textarea", w("Resolution / closure note", "Oplossing / afsluitnotitie"), 4000)],
  },
  "NCR-CORRECTIVE": {
    verify: [{ key: "verification_result", label: w("Verification result", "Resultaat verificatie"), kind: "select", required: true, options: ["Effective"], hint: w("An NCR is closed only when the corrective action is Effective. Otherwise return it.", "Een NCR wordt alleen gesloten als de corrigerende maatregel effectief is. Anders stuur je hem terug.") }],
    close: [{ key: "verification_result", label: w("Verification result", "Resultaat verificatie"), kind: "select", required: true, options: ["Effective"], hint: w("An NCR is closed only when the corrective action is Effective. Otherwise return it.", "Een NCR wordt alleen gesloten als de corrigerende maatregel effectief is. Anders stuur je hem terug.") }],
    return: [{ key: "verification_result", label: w("Verification result", "Resultaat verificatie"), kind: "select", required: false, options: ["Not Effective", "Rework Required", "Pending"], hint: w("Not Effective or Rework Required reopens the corrective action.", "Niet effectief of Herstel vereist heropent de corrigerende maatregel.") }],
  },
  "AGREEMENT-ACK": {
    close: [closureNoteField(false, "text", w("Confirmation / closure note", "Bevestiging / afsluitnotitie"), 250)],
  },
  "CHANGE-APPROVAL": {
    approve: [
      { key: "approved_amount", label: w("Approved amount", "Goedgekeurd bedrag"), kind: "number", required: true },
      { key: "approved_days", label: w("Approved days", "Goedgekeurde dagen"), kind: "number", required: true },
    ],
  },
};

/** The details an action takes in the dialog; none for most actions. */
export function outcomeFields(profile: string, action: SignoffAction | ""): SignoffOutcomeField[] {
  return action ? signoffOutcomeFields[profile]?.[action] ?? [] : [];
}

/** Whether the entered details satisfy the dialog (the database checks the same again). */
export function outcomeReady(fields: SignoffOutcomeField[], values: Record<string, string>) {
  return fields.every((field) => {
    const value = (values[field.key] ?? "").trim();
    if (!value) return !field.required;
    if (field.kind === "number") return /^-?\d{1,12}([.,]\d{1,4})?$/.test(value);
    if (field.kind === "select") return field.options?.includes(value) ?? false;
    return value.length <= (field.max ?? 4000) && (!field.required || value.length >= 3);
  });
}

/** The details as the database takes them: trimmed, empty ones left out, a decimal comma written as a point. */
export function outcomeDetails(fields: SignoffOutcomeField[], values: Record<string, string>) {
  const details: Record<string, string> = {};
  for (const field of fields) {
    const value = (values[field.key] ?? "").trim();
    if (value) details[field.key] = field.kind === "number" ? value.replace(",", ".") : value;
  }
  return details;
}

export const signoffActionLabels: Record<SignoffAction, Words> = {
  submit: w("Submit", "Indienen"),
  acknowledge: w("Acknowledge receipt", "Ontvangst bevestigen"),
  review: w("Review", "Beoordelen"),
  approve: w("Approve", "Goedkeuren"),
  accept: w("Accept", "Accepteren"),
  reject: w("Reject", "Afkeuren"),
  return: w("Return for correction", "Terugsturen ter correctie"),
  respond: w("Respond", "Reageren"),
  resubmit: w("Resubmit", "Opnieuw indienen"),
  verify: w("Verify", "Verifiëren"),
  close: w("Close", "Sluiten"),
  withdraw: w("Withdraw", "Intrekken"),
  reopen: w("Reopen", "Heropenen"),
  witness: w("Witness", "Getuige"),
};

export const commentRequired = (action: SignoffAction) => ["return", "reject", "withdraw", "reopen"].includes(action);
export const authorityActions: SignoffAction[] = ["approve", "accept", "reject", "verify", "close", "reopen"];

/** Where the record stands, derived only from its events. */
export function signoffState(profile: SignoffProfile, events: SignoffEvent[]) {
  const last = events.at(-1);
  const status = last?.new_status ?? "Not submitted";
  const closed = status === "Closed" || status === "Withdrawn";
  let stage: SignoffStage | undefined;
  if (!last) stage = profile.stages[0];
  else if (closed) stage = undefined;
  else if (status === "Returned for Correction" || status === "Rejected" || status === "Reopened") stage = profile.stages.find((item) => item.actions.includes("resubmit"));
  else {
    const index = profile.stages.findIndex((item) => item.number === last.stage_number);
    stage = profile.stages[Math.min(profile.stages.length - 1, index + 1)] ?? profile.stages.at(-1);
    if (["Approved", "Accepted", "Verified"].includes(status)) stage = profile.stages.find((item) => item.actions.includes("close")) ?? stage;
  }
  return {
    status,
    round: last?.round_number ?? 1,
    stage,
    pending: last?.next_actor ?? (stage ? stage.role : null),
    dueAt: last?.due_at ?? null,
    last,
    closed,
  };
}

/** The actions offered now: the next stage's, plus withdraw/reopen where they apply. */
export function availableActions(profile: SignoffProfile, events: SignoffEvent[]): Array<{ action: SignoffAction; stage: number }> {
  const state = signoffState(profile, events);
  if (state.closed) return [{ action: "reopen", stage: 1 }];
  if (!events.length) return [{ action: "submit", stage: 1 }, ...(profile.stages[0].actions.includes("acknowledge") ? [{ action: "acknowledge" as const, stage: 1 }] : [])];
  const offered = new Map<SignoffAction, number>();
  // Every stage after the first stays reachable: parallel reviews and several signatories
  // at one stage are separate events on the same record.
  for (const stage of profile.stages.slice(1)) {
    for (const action of stage.actions) {
      if (action === "resubmit" && !["Returned for Correction", "Rejected", "Reopened"].includes(state.status)) continue;
      if (!offered.has(action)) offered.set(action, stage.number);
    }
  }
  if (!offered.has("withdraw")) offered.set("withdraw", state.stage?.number ?? 1);
  return [...offered].map(([action, stage]) => ({ action, stage }));
}

const signoffColumns = "id,record_kind,record_id,workflow_profile,round_number,stage_number,action,actor_user_id,actor_name,actor_organization,actor_role,stage_role,attestation_method,signature_image,evidence_file_id,comments,return_reason,next_actor,due_at,previous_status,new_status,created_at,details";

export async function loadSignoffEvents(client: SupabaseClient, recordKind: SignoffRecordKind, recordId: string) {
  const result = await client
    .from("record_signoff_events")
    .select(signoffColumns)
    .eq("record_kind", recordKind)
    .eq("record_id", recordId)
    .order("sequence_number", { ascending: true });
  if (result.error) {
    // An app version ahead of its database shows no history rather than breaking the record.
    if (/record_signoff_events/.test(result.error.message)) return [] as SignoffEvent[];
    throw new Error(result.error.message);
  }
  return (result.data ?? []) as SignoffEvent[];
}

export async function recordSignoffAction(client: SupabaseClient, input: {
  projectId: string;
  recordKind: SignoffRecordKind;
  recordId: string;
  profile: string;
  stage: number;
  action: SignoffAction;
  actorRole: string;
  attestation: "account" | "external_representative" | "signed_document";
  actorName?: string;
  actorOrganization?: string;
  signatureImage?: string | null;
  evidenceFileId?: string | null;
  comments?: string;
  returnReason?: string;
  nextActor?: string;
  nextActorUserId?: string | null;
  dueAt?: string | null;
  /** The Close / Verify / Approve dialog's fields (see outcomeFields). */
  details?: Record<string, string>;
}) {
  const result = await client.rpc("record_signoff_action", {
    p_project_id: input.projectId,
    p_record_kind: input.recordKind,
    p_record_id: input.recordId,
    p_workflow_profile: input.profile,
    p_stage_number: input.stage,
    p_action: input.action,
    p_actor_role: input.actorRole,
    p_attestation_method: input.attestation,
    p_actor_name: input.actorName || null,
    p_actor_organization: input.actorOrganization || null,
    p_signature_image: input.signatureImage || null,
    p_evidence_file_id: input.evidenceFileId || null,
    p_comments: input.comments || null,
    p_return_reason: input.returnReason || null,
    p_next_actor: input.nextActor || null,
    p_next_actor_user_id: input.nextActorUserId || null,
    p_due_at: input.dueAt || null,
    p_details: input.details && Object.keys(input.details).length ? input.details : null,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as SignoffEvent;
}

/**
 * Every sign-off event of a project (or of the given records), oldest first, grouped per record:
 * the history printed with the NCR, the controlled documents and the day export
 * ("Allow authorized users to export the history with the form record").
 */
export async function loadSignoffHistory(client: SupabaseClient, projectId: string, recordIds?: string[]) {
  const history = new Map<string, SignoffEvent[]>();
  const ids = recordIds ? [...new Set(recordIds.filter(Boolean))] : null;
  if (ids && !ids.length) return history;
  const chunks = ids ? Array.from({ length: Math.ceil(ids.length / 150) }, (_, index) => ids.slice(index * 150, index * 150 + 150)) : [null];
  for (const chunk of chunks) {
    let query = client.from("record_signoff_events").select(signoffColumns).eq("project_id", projectId);
    if (chunk) query = query.in("record_id", chunk);
    const result = await query.order("sequence_number", { ascending: true }).limit(5000);
    if (result.error) {
      if (/record_signoff_events|sequence_number/.test(result.error.message)) return history;
      throw new Error(result.error.message);
    }
    for (const event of (result.data ?? []) as SignoffEvent[]) {
      history.set(event.record_id, [...(history.get(event.record_id) ?? []), event]);
    }
  }
  return history;
}

export const outcomeLabels: Record<string, Words> = {
  closure_note: w("Closure note", "Afsluitnotitie"),
  verification_result: w("Verification result", "Resultaat verificatie"),
  verified_by: w("Verified by", "Geverifieerd door"),
  verified_on: w("Verified on", "Geverifieerd op"),
  approved_amount: w("Approved amount", "Goedgekeurd bedrag"),
  approved_days: w("Approved days", "Goedgekeurde dagen"),
};

/** What the Close / Verify / Approve dialog carried, as one sentence for printed history lines. */
export function outcomeSummary(details: SignoffEvent["details"], language: "en" | "nl" = "en") {
  if (!details) return "";
  return Object.keys(outcomeLabels).filter((key) => details[key]).map((key) => `${outcomeLabels[key][language]}: ${details[key]}`).join("; ");
}

/** One line per event for printed reports: action, who (organisation, role), round, time, status change, comments. */
export function signoffHistoryLines(events: SignoffEvent[], language: "en" | "nl" = "en") {
  const when = (value: string) => new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(value));
  return events.map((event) => ({
    action: signoffActionLabels[event.action]?.[language] ?? event.action,
    actor: `${event.actor_name}${event.actor_organization ? ` (${event.actor_organization})` : ""}`,
    role: event.actor_role,
    round: event.round_number,
    at: when(event.created_at),
    status: `${event.previous_status ?? "—"} → ${event.new_status}`,
    comments: [outcomeSummary(event.details, language), event.comments ?? ""].filter(Boolean).join(". "),
    attestation: event.attestation_method === "account"
      ? ""
      : event.attestation_method === "signed_document"
        ? (language === "nl" ? "ondertekend document" : "signed document")
        : (language === "nl" ? "getekend op dit apparaat" : "signed on this device"),
    signature: event.signature_image,
  }));
}

/** A profile with the project's own role names per stage (Management · Project rules). */
export function effectiveProfile(profile: SignoffProfile, config?: { stages?: Record<string, { role_en?: string; role_nl?: string }> } | null): SignoffProfile {
  if (!config?.stages) return profile;
  return {
    ...profile,
    stages: profile.stages.map((stage) => {
      const own = config.stages?.[String(stage.number)];
      return own?.role_en || own?.role_nl ? { ...stage, role: { en: own.role_en || stage.role.en, nl: own.role_nl || own.role_en || stage.role.nl } } : stage;
    }),
  };
}

/** A sign-off event as one printed line, its comments and the ink of an on-device signature. */
export type SignoffHistoryEntry = { line: string; comments: string; signature: string | null };

export function signoffHistoryEntries(events: SignoffEvent[], language: "en" | "nl" = "en"): SignoffHistoryEntry[] {
  const round = language === "nl" ? "ronde" : "round";
  return signoffHistoryLines(events, language).map((item) => ({
    line: [item.at, item.action, item.actor, item.role, `${round} ${item.round}`, item.status, item.attestation].filter(Boolean).join(" · "),
    comments: item.comments,
    signature: item.signature && item.signature.startsWith("data:image/") ? item.signature : null,
  }));
}
