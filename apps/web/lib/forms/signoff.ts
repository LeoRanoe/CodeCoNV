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

/** Stage 1–4 of every profile, as in the sheet's table; stage 4 is the return / resubmit loop. */
export const signoffProfiles: Record<string, SignoffProfile> = {
  "WO-DAILY": {
    code: "WO-DAILY", label: w("Daily progress review", "Beoordeling dagvoortgang"),
    stages: [
      { number: 1, label: w("Contractor/foreman submits", "Aannemer/uitvoerder dient in"), actions: ["submit"], role: contractor },
      { number: 2, label: w("Supervision reviews", "Supervisie beoordeelt"), actions: ["review"], role: supervision },
      { number: 3, label: w("Accept or return", "Accepteren of terugsturen"), actions: ["accept", "return"], role: supervision },
      { number: 4, label: w("Contractor corrects and resubmits", "Aannemer corrigeert en dient opnieuw in"), actions: ["resubmit"], role: contractor },
    ],
    rule: w("Required for submitted daily progress records.", "Vereist voor ingediende dagvoortgang."),
  },
  "WC-COMPLETION": {
    code: "WC-COMPLETION", label: w("Completion inspection", "Opleveringskeuring"),
    stages: [
      { number: 1, label: w("Contractor submits completion", "Aannemer meldt gereed"), actions: ["submit"], role: contractor },
      { number: 2, label: w("Supervision inspects", "Supervisie keurt"), actions: ["review", "witness"], role: supervision },
      { number: 3, label: w("Accept, reject or return", "Accepteren, afkeuren of terugsturen"), actions: ["accept", "reject", "return"], role: supervision },
      { number: 4, label: w("Rectification and re-inspection", "Herstel en herkeuring"), actions: ["resubmit"], role: contractor },
    ],
    rule: w("Physical completion is not quality acceptance.", "Fysiek gereed is geen kwaliteitsacceptatie."),
  },
  "WF-ATTENDANCE": {
    code: "WF-ATTENDANCE", label: w("Attendance verification", "Verificatie aanwezigheid"),
    stages: [
      { number: 1, label: w("Contractor/foreman submits", "Aannemer/uitvoerder dient in"), actions: ["submit"], role: contractor },
      { number: 2, label: w("Supervision verifies", "Supervisie verifieert"), actions: ["verify", "return"], role: supervision },
      { number: 4, label: w("Correction and resubmission", "Correctie en opnieuw indienen"), actions: ["resubmit"], role: contractor },
    ],
    rule: w("Daily verification of the workforce.", "Dagelijkse verificatie van de bezetting."),
  },
  "PDR-REVIEW": {
    code: "PDR-REVIEW", label: w("Delay report review", "Beoordeling vertragingsrapport"),
    stages: [
      { number: 1, label: w("Reporting party submits", "Melder dient in"), actions: ["submit"], role: w("Reporting party", "Melder") },
      { number: 2, label: w("Supervision reviews", "Supervisie beoordeelt"), actions: ["review", "respond"], role: supervision },
      { number: 3, label: w("Validate, return or reject", "Valideren, terugsturen of afwijzen"), actions: ["accept", "return", "reject"], role: supervision },
      { number: 4, label: w("Clarification and resubmission", "Verduidelijking en opnieuw indienen"), actions: ["resubmit"], role: w("Reporting party", "Melder") },
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
      { number: 1, label: w("Delivery details recorded", "Levering vastgelegd"), actions: ["submit", "acknowledge"], role: w("Receiving representative / supplier", "Ontvanger / leverancier") },
      { number: 2, label: w("Receiving party confirms quantities and condition", "Ontvanger bevestigt hoeveelheden en staat"), actions: ["acknowledge", "review"], role: w("Receiving representative", "Ontvanger") },
      { number: 3, label: w("QA/supervision inspects", "QA/supervisie keurt"), actions: ["accept", "reject", "return"], role: w("QA / supervision", "QA / supervisie") },
      { number: 4, label: w("Discrepancy action and re-inspection", "Afwijking en herkeuring"), actions: ["resubmit"], role: w("Receiving representative", "Ontvanger") },
    ],
    rule: w("Supplier signature is optional; keep the delivery note as evidence.", "Handtekening leverancier is optioneel; bewaar de pakbon als bewijs."),
  },
  "INSPECTION-WITNESS": {
    code: "INSPECTION-WITNESS", label: w("Inspection witness", "Inspectie met getuige"),
    stages: [
      { number: 1, label: w("Inspector records and signs result", "Inspecteur legt resultaat vast"), actions: ["submit"], role: w("Inspector", "Inspecteur") },
      { number: 2, label: w("Contractor witness acknowledges", "Getuige aannemer bevestigt"), actions: ["witness", "acknowledge"], role: contractor },
      { number: 3, label: w("Reviewer accepts", "Beoordelaar accepteert"), actions: ["accept", "return"], role: supervision },
      { number: 4, label: w("Corrective work and re-inspection", "Herstel en herinspectie"), actions: ["resubmit"], role: w("Inspector", "Inspecteur") },
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
      { number: 1, label: w("Originator submits", "Aanvrager dient in"), actions: ["submit"], role: w("Originator", "Aanvrager") },
      { number: 2, label: w("Technical review", "Technische beoordeling"), actions: ["review", "return"], role: w("Technical reviewer", "Technisch beoordelaar") },
      { number: 3, label: w("Commercial review / client approval", "Commerciële beoordeling / goedkeuring opdrachtgever"), actions: ["review", "approve", "reject", "return"], role: w("Authorised approver", "Bevoegd goedkeurder") },
      { number: 4, label: w("Revise and resubmit", "Herzien en opnieuw indienen"), actions: ["resubmit", "withdraw"], role: w("Originator", "Aanvrager") },
    ],
    rule: w("Approval and the instruction to proceed are separate.", "Goedkeuring en opdracht tot uitvoering zijn gescheiden."),
  },
  "NCR-CORRECTIVE": {
    code: "NCR-CORRECTIVE", label: w("NCR corrective action", "Corrigerende maatregel NCR"),
    stages: [
      { number: 1, label: w("Supervision raises NCR", "Supervisie stelt NCR op"), actions: ["submit"], role: supervision },
      { number: 2, label: w("Contractor acknowledges and responds", "Aannemer bevestigt en reageert"), actions: ["acknowledge", "respond"], role: contractor },
      { number: 3, label: w("Supervision reviews response", "Supervisie beoordeelt reactie"), actions: ["review", "return", "verify", "close"], role: supervision },
      { number: 4, label: w("Contractor revises", "Aannemer herziet"), actions: ["resubmit"], role: contractor },
    ],
    rule: w("Acknowledgement is receipt only, not an admission of liability.", "Bevestiging is alleen ontvangst, geen erkenning van aansprakelijkheid."),
  },
  "AGREEMENT-ACK": {
    code: "AGREEMENT-ACK", label: w("Agreement acknowledgement", "Bevestiging afspraak"),
    stages: [
      { number: 1, label: w("Agreement recorded", "Afspraak vastgelegd"), actions: ["submit"], role: w("Chair / recorder", "Voorzitter / notulist") },
      { number: 2, label: w("Parties acknowledge", "Partijen bevestigen"), actions: ["acknowledge"], role: w("Party", "Partij") },
      { number: 3, label: w("Action owner accepts", "Actiehouder accepteert"), actions: ["accept"], role: w("Action owner", "Actiehouder") },
      { number: 4, label: w("Re-acknowledgement", "Opnieuw bevestigen"), actions: ["return", "resubmit", "close"], role: w("Chair / recorder", "Voorzitter / notulist") },
    ],
    rule: w("One record may carry many signatories.", "Eén registratie kan veel ondertekenaars hebben."),
  },
  "LESSON-REVIEW": {
    code: "LESSON-REVIEW", label: w("Lesson review", "Beoordeling les"),
    stages: [
      { number: 1, label: w("Author records lesson", "Auteur legt les vast"), actions: ["submit"], role: w("Author", "Auteur") },
      { number: 2, label: w("Reviewer reviews", "Beoordelaar beoordeelt"), actions: ["review"], role: w("Reviewer", "Beoordelaar") },
      { number: 3, label: w("Approve or return", "Goedkeuren of terugsturen"), actions: ["approve", "return"], role: w("Reviewer", "Beoordelaar") },
      { number: 4, label: w("Revise and resubmit", "Herzien en opnieuw indienen"), actions: ["resubmit"], role: w("Author", "Auteur") },
    ],
    rule: w("Contractor sign-off only when the project asks for it.", "Ondertekening aannemer alleen als het project dat vraagt."),
  },
  "HSE-INCIDENT": {
    code: "HSE-INCIDENT", label: w("Incident review", "Beoordeling incident"),
    stages: [
      { number: 1, label: w("Incident reported", "Incident gemeld"), actions: ["submit"], role: w("Reporter", "Melder") },
      { number: 2, label: w("Supervisor/HSE reviews", "Supervisor/HSE beoordeelt"), actions: ["review", "return"], role: w("HSE reviewer", "HSE-beoordelaar") },
      { number: 3, label: w("Responsible party submits actions", "Verantwoordelijke dient maatregelen in"), actions: ["respond", "acknowledge"], role: contractor },
      { number: 4, label: w("Verify and close", "Verifiëren en sluiten"), actions: ["resubmit", "verify", "close", "return"], role: w("HSE reviewer", "HSE-beoordelaar") },
    ],
    rule: w("Sensitive incident details stay restricted by role.", "Gevoelige incidentgegevens blijven beperkt per rol."),
  },
};

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

const signoffColumns = "id,record_kind,record_id,workflow_profile,round_number,stage_number,action,actor_user_id,actor_name,actor_organization,actor_role,attestation_method,signature_image,evidence_file_id,comments,return_reason,next_actor,due_at,previous_status,new_status,created_at";

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
    comments: event.comments ?? "",
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
