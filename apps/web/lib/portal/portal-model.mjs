/**
 * The Contractor Portal and Client Portal (requirements sections 6, 7 and 21): which section
 * an item stands in, which step the portal user may take next, and the words for every state.
 * The database decides; these rules only keep the screen from offering a step it will refuse.
 */

export const shareStatusLabels = Object.freeze({
  assigned: { en: "Awaiting response", nl: "Wacht op reactie", tone: "amber" },
  acknowledged: { en: "Acknowledged", nl: "Ontvangst bevestigd", tone: "blue" },
  responded: { en: "Response submitted", nl: "Reactie ingediend", tone: "blue" },
  returned: { en: "Returned for correction", nl: "Teruggestuurd voor correctie", tone: "red" },
  submitted_for_verification: { en: "Submitted for verification", nl: "Ingediend voor verificatie", tone: "blue" },
  accepted: { en: "Accepted", nl: "Geaccepteerd", tone: "green" },
  verified: { en: "Verified", nl: "Geverifieerd", tone: "green" },
  approved: { en: "Approved", nl: "Goedgekeurd", tone: "green" },
  rejected: { en: "Rejected", nl: "Afgewezen", tone: "red" },
  clarification_requested: { en: "Clarification requested", nl: "Verduidelijking gevraagd", tone: "amber" },
  published: { en: "Published to client", nl: "Gepubliceerd voor opdrachtgever", tone: "green" },
  closed: { en: "Closed", nl: "Gesloten", tone: "neutral" },
  withdrawn: { en: "Withdrawn", nl: "Ingetrokken", tone: "neutral" },
  superseded: { en: "Superseded", nl: "Vervangen", tone: "neutral" },
});

export const requestedActionLabels = Object.freeze({
  acknowledge: { en: "Acknowledge receipt", nl: "Ontvangst bevestigen" },
  comment: { en: "Comment", nl: "Opmerking geven" },
  propose: { en: "Submit a proposal", nl: "Voorstel indienen" },
  submit_evidence: { en: "Submit evidence", nl: "Bewijs indienen" },
  implement: { en: "Implement and report", nl: "Uitvoeren en melden" },
  sign: { en: "Sign", nl: "Ondertekenen" },
  attend: { en: "Attend", nl: "Aanwezig zijn" },
  review: { en: "Review", nl: "Beoordelen" },
  approve: { en: "Approve or reject", nl: "Goedkeuren of afwijzen" },
  information: { en: "For information", nl: "Ter informatie" },
});

export const eventLabels = Object.freeze({
  assign: { en: "Assigned", nl: "Toegewezen" },
  publish: { en: "Published", nl: "Gepubliceerd" },
  acknowledge: { en: "Receipt acknowledged", nl: "Ontvangst bevestigd" },
  comment: { en: "Comment", nl: "Opmerking" },
  respond: { en: "Response", nl: "Reactie" },
  resubmit: { en: "Resubmitted", nl: "Opnieuw ingediend" },
  submit_evidence: { en: "Evidence submitted", nl: "Bewijs ingediend" },
  mark_complete: { en: "Reported complete", nl: "Gereed gemeld" },
  approve: { en: "Approved", nl: "Goedgekeurd" },
  reject: { en: "Rejected", nl: "Afgewezen" },
  request_clarification: { en: "Clarification requested", nl: "Verduidelijking gevraagd" },
  accept: { en: "Accepted", nl: "Geaccepteerd" },
  return: { en: "Returned for correction", nl: "Teruggestuurd" },
  verify: { en: "Verified", nl: "Geverifieerd" },
  close: { en: "Closed", nl: "Gesloten" },
  withdraw: { en: "Withdrawn", nl: "Ingetrokken" },
  reopen: { en: "Reopened", nl: "Heropend" },
  supersede: { en: "Superseded", nl: "Vervangen" },
  add_files: { en: "Files added", nl: "Bestanden toegevoegd" },
  release: { en: "Revision released", nl: "Revisie vrijgegeven" },
  withdraw_release: { en: "Revision release withdrawn", nl: "Vrijgave revisie ingetrokken" },
  view: { en: "Viewed", nl: "Bekeken" },
  download: { en: "Downloaded", nl: "Gedownload" },
});

export const recordTypeLabels = Object.freeze({
  finding: { en: "Issue / NCR", nl: "Issue / NCR" },
  action: { en: "Action", nl: "Actie" },
  hse: { en: "HSE", nl: "HSE" },
  inspection: { en: "Inspection", nl: "Inspectie" },
  register_entry: { en: "Register record", nl: "Registerrecord" },
  document: { en: "Project document", nl: "Projectdocument" },
  publication: { en: "Report", nl: "Rapport" },
  file: { en: "Photo / file", nl: "Foto / bestand" },
});

export const publicationTypes = Object.freeze([
  { id: "daily", en: "Daily supervision report", nl: "Dagelijks supervisierapport" },
  { id: "weekly", en: "Weekly progress report", nl: "Wekelijks voortgangsrapport" },
  { id: "monthly", en: "Monthly progress report", nl: "Maandelijks voortgangsrapport" },
  { id: "quality", en: "Quality report / NCR summary", nl: "Kwaliteitsrapport / NCR-overzicht" },
  { id: "hse", en: "HSE report", nl: "HSE-rapport" },
  { id: "inspection", en: "Inspection report", nl: "Inspectierapport" },
  { id: "delay", en: "Delay analysis / schedule status", nl: "Vertragingsanalyse / planningsstatus" },
  { id: "contractor_performance", en: "Contractor performance summary", nl: "Prestaties aannemer" },
  { id: "progress", en: "Progress update", nl: "Voortgangsupdate" },
  { id: "schedule", en: "Milestones & schedule", nl: "Mijlpalen & planning" },
  { id: "other", en: "Other", nl: "Overig" },
]);

const closedStatuses = new Set(["closed", "withdrawn", "superseded"]);
const decidedStatuses = new Set(["approved", "rejected"]);
/** States in which the portal party is the one who has to act. */
const waitingOnParty = new Set(["assigned", "returned", "clarification_requested", "published"]);

/**
 * Review statuses an authorised reviewer sets that may be released to a portal (F15). For information
 * is excluded: an uploader without review rights can set it. Mirrors
 * app_private.document_revision_releasable in the database, which is what enforces it.
 */
export const releasableRevisionStatuses = Object.freeze(["approved", "approved_with_comments", "for_construction"]);

export function revisionReleasable(revision) {
  return Boolean(revision) && !revision.superseded_at && releasableRevisionStatuses.includes(revision.review_status);
}

export function label(table, key, language) {
  const entry = table[key];
  if (!entry) return String(key ?? "").replaceAll("_", " ");
  return language === "nl" ? entry.nl : entry.en;
}

export function isClosedShare(share) {
  return closedStatuses.has(share.status);
}

export function isOverdueShare(share, now = new Date()) {
  if (!share.due_at || isClosedShare(share) || decidedStatuses.has(share.status)) return false;
  if (!waitingOnParty.has(share.status) && share.status !== "acknowledged") return false;
  return new Date(share.due_at).getTime() < now.getTime();
}

/** Whether the portal party still has to act on the item. */
export function awaitsParty(share) {
  if (isClosedShare(share)) return false;
  if (share.record_type === "publication") return false;
  if (share.requested_action === "information") return share.status === "assigned";
  if (share.audience === "client") return !decidedStatuses.has(share.status) && share.status !== "acknowledged";
  return waitingOnParty.has(share.status) || share.status === "acknowledged";
}

/**
 * The steps the portal user may take now. `rights` = { respond, review, approve }.
 * Mirrors respond_in_portal(); the database still refuses anything else.
 */
export function portalStepsFor(share, rights) {
  if (!share || isClosedShare(share)) return [];
  if (share.audience === "contractor") {
    if (!rights.respond) return [];
    if (share.status === "accepted" || share.status === "verified") return ["comment"];
    const steps = [];
    if (share.status === "assigned") steps.push("acknowledge");
    if (share.requested_action !== "acknowledge" && share.requested_action !== "information") {
      steps.push("respond", "submit_evidence");
      if (["implement", "submit_evidence"].includes(share.requested_action) || share.record_type === "action") steps.push("mark_complete");
    }
    steps.push("comment");
    return steps;
  }
  if (!rights.review) return [];
  if (decidedStatuses.has(share.status)) return ["comment"];
  const steps = [];
  if (["assigned", "published"].includes(share.status)) steps.push("acknowledge");
  if (share.requested_action === "approve" && rights.approve && share.record_type !== "publication") steps.push("approve", "reject");
  if (share.record_type !== "publication") steps.push("request_clarification");
  steps.push("comment");
  return steps;
}

/** Steps that need a written comment (the database refuses them without one). */
export function stepNeedsComment(step, audience) {
  if (audience === "client") return ["reject", "request_clarification", "comment"].includes(step);
  return ["comment"].includes(step);
}

/** CODECO's review steps on a share, mirroring review_portal_share(). */
export function reviewStepsFor(share) {
  if (!share) return [];
  if (share.status === "withdrawn" || share.status === "superseded") return ["reopen"];
  if (share.status === "closed") return ["reopen", "comment"];
  const steps = [];
  if (share.audience === "contractor") {
    if (["responded", "submitted_for_verification", "acknowledged"].includes(share.status)) steps.push("accept", "return");
    if (["responded", "submitted_for_verification", "accepted"].includes(share.status)) steps.push("verify");
    const needsAcceptance = ["propose", "submit_evidence", "implement"].includes(share.requested_action);
    if (!needsAcceptance || ["accepted", "verified"].includes(share.status)) steps.push("close");
  } else {
    steps.push("close");
  }
  steps.push("comment", "add_files", "withdraw");
  return steps;
}

/** Contractor portal sections (6.1). */
export function contractorSections(shares, now = new Date()) {
  const open = shares.filter((share) => !isClosedShare(share));
  return {
    assigned: open.filter((share) => share.record_type !== "action" && share.record_type !== "document"),
    pendingActions: open.filter((share) => share.record_type === "action"),
    sharedDocuments: shares.filter((share) => share.record_type === "document" && share.status !== "withdrawn"),
    history: shares.filter((share) => isClosedShare(share) || ["accepted", "verified"].includes(share.status)),
    awaiting: open.filter((share) => awaitsParty(share)),
    overdue: open.filter((share) => isOverdueShare(share, now)),
    returned: open.filter((share) => share.status === "returned"),
    upcoming: open
      .filter((share) => share.due_at && !isOverdueShare(share, now) && new Date(share.due_at).getTime() - now.getTime() < 7 * 86_400_000)
      .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at))),
  };
}

/** Client portal sections (21.1). */
export function clientSections(shares, now = new Date()) {
  const live = shares.filter((share) => share.status !== "withdrawn");
  const publications = live.filter((share) => share.record_type === "publication")
    .sort((a, b) => String(b.assigned_at).localeCompare(String(a.assigned_at)));
  const isSchedule = (share) => share.publication_type === "schedule" || share.publication_type === "progress";
  return {
    publications,
    currentPublications: publications.filter((share) => share.status !== "superseded"),
    progress: publications.filter(isSchedule),
    photos: live.filter((share) => share.record_type === "file"),
    documents: live.filter((share) => share.record_type === "document"),
    review: live.filter((share) => share.requested_action === "approve" || share.requested_action === "review"),
    openReview: live.filter((share) => (share.requested_action === "approve" || share.requested_action === "review") && awaitsParty(share)),
    overdueReview: live.filter((share) => (share.requested_action === "approve" || share.requested_action === "review") && isOverdueShare(share, now)),
    issues: live.filter((share) => ["finding", "hse", "inspection", "action"].includes(share.record_type)),
    correspondence: live.filter((share) => share.record_type === "register_entry"),
  };
}

/** Rows of the decision log: every approval, rejection, clarification and comment by the client. */
export function decisionLog(events) {
  return events
    .filter((event) => event.actor_side === "client" && ["approve", "reject", "request_clarification", "acknowledge", "comment"].includes(event.action))
    .sort((a, b) => Number(b.sequence) - Number(a.sequence));
}

/** Portal events of one share in order, grouped by workflow round (7.2). */
export function eventsByRound(events) {
  const rounds = new Map();
  for (const event of events.slice().sort((a, b) => Number(a.sequence) - Number(b.sequence))) {
    if (event.action === "view") continue;
    const list = rounds.get(event.round) ?? [];
    list.push(event);
    rounds.set(event.round, list);
  }
  return [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([round, list]) => ({ round, events: list }));
}

/** The portal a signed-in user gets, or null for CODECO's own workspace. */
export function portalModeFor(permissions) {
  if (!permissions?.known) return null;
  if (permissions.can("records.read") || permissions.can("records.edit")) return null;
  if (permissions.can("portal.client")) return "client";
  if (permissions.can("portal.contractor")) return "contractor";
  return null;
}
