/**
 * Project figures for the Overview and for the register reports, computed from stored records
 * only (requirements sections 11 and 12). Pure, so screen, export and tests agree.
 */

const closedFinding = new Set(["closed", "cancelled", "rejected"]);
const closedAction = new Set(["verified", "cancelled"]);
const closedRegister = new Set(["closed", "cancelled", "approved", "rejected", "completed"]);
const closedShare = new Set(["closed", "withdrawn", "superseded"]);
const DAY = 86_400_000;

function before(value, now) {
  return Boolean(value) && new Date(value).getTime() < now.getTime();
}

/**
 * @param {{ findings?: any[], hseEvents?: any[], registerEntries?: any[], inspections?: any[], boqProgressUpdates?: any[],
 *   actions?: any[], shares?: any[], documents?: any[], revisions?: any[], parties?: any[] }} input
 * @param {Date} [now]
 */
export function summarizeProject(input, now = new Date()) {
  const { findings = [], hseEvents = [], registerEntries = [], inspections = [], boqProgressUpdates = [], actions = [], shares = [], documents = [], revisions = [], parties = [] } = input;
  const openFindings = findings.filter((finding) => !closedFinding.has(finding.status) && finding.status !== "draft");
  const ncr = openFindings.filter((finding) => finding.finding_type === "ncr");
  const contractorParties = parties.filter((party) => ["contractor", "subcontractor"].includes(party.type ?? party.party_type));

  // Progress: the latest recorded percentage per BOQ item, averaged. No planned figure exists.
  const latest = new Map();
  for (const update of boqProgressUpdates) {
    const previous = latest.get(update.register_entry_id);
    if (!previous || String(update.recorded_at) > String(previous.recorded_at)) latest.set(update.register_entry_id, update);
  }
  const values = [...latest.values()].map((update) => Number(update.progress_percent)).filter((value) => Number.isFinite(value));
  const actual = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

  const incidentTypes = new Set(["incident", "near_miss", "stop_work", "hse_incident", "accident"]);
  const openHse = hseEvents.filter((event) => !["closed", "cancelled"].includes(event.status));

  const openActions = actions.filter((action) => !closedAction.has(action.status));
  const awaiting = (share) => share.audience === "contractor" && ["assigned", "acknowledged", "returned"].includes(share.status);

  const contractors = contractorParties.map((party) => {
    const partyFindings = openFindings.filter((finding) => finding.responsible_party_id === party.id);
    const partyActions = openActions.filter((action) => action.owner_party_id === party.id);
    const partyShares = shares.filter((share) => share.party_id === party.id && !closedShare.has(share.status));
    return {
      id: party.id,
      name: party.name,
      open: partyFindings.length + partyActions.length,
      overdue: [...partyFindings, ...partyActions].filter((item) => before(item.due_at, now)).length,
      awaiting: partyShares.filter(awaiting).length,
    };
  }).filter((row) => row.open || row.awaiting);

  const currentRevisions = new Map(revisions.map((revision) => [revision.id, revision]));
  const documentLabel = new Map(documents.map((document) => [document.id, document.document_number || document.title]));
  const awaitingReview = documents.filter((document) => ["submitted", "under_review"].includes(currentRevisions.get(document.current_revision_id)?.review_status)).length;
  const recentRevisions = revisions
    .filter((revision) => now.getTime() - new Date(revision.uploaded_at).getTime() <= 7 * DAY)
    .map((revision) => ({ id: revision.id, label: `${documentLabel.get(revision.document_id) ?? ""} · rev. ${revision.revision}`, uploaded_at: revision.uploaded_at }));

  return {
    progress: { actual, items: values.length },
    quality: {
      openNcr: ncr.length,
      severe: ncr.filter((finding) => ["critical", "high"].includes(finding.severity)).length,
      openIssues: openFindings.length - ncr.length,
      byContractor: contractorParties
        .map((party) => ({ name: party.name, count: ncr.filter((finding) => finding.responsible_party_id === party.id).length }))
        .filter((row) => row.count)
        .sort((a, b) => b.count - a.count),
    },
    hse: {
      openObservations: openHse.filter((event) => !incidentTypes.has(event.event_type)).length,
      incidents30: hseEvents.filter((event) => incidentTypes.has(event.event_type) && now.getTime() - new Date(event.occurred_at ?? event.created_at).getTime() <= 30 * DAY).length,
      openFollowUp: openActions.filter((action) => action.source_type === "hse").length + openHse.filter((event) => incidentTypes.has(event.event_type)).length,
    },
    actions: {
      open: openActions.length,
      overdue: openActions.filter((action) => before(action.due_at, now)).length,
    },
    registers: {
      changeOrders: registerEntries.filter((entry) => entry.register_type === "change_order" && !closedRegister.has(entry.status)).length,
      instructions: registerEntries.filter((entry) => entry.register_type === "technical_instruction" && !closedRegister.has(entry.status)).length,
    },
    inspections: {
      upcoming: inspections.filter((inspection) => inspection.status === "planned" && inspection.planned_at && !before(inspection.planned_at, now) && new Date(inspection.planned_at).getTime() - now.getTime() <= 7 * DAY).length,
      overdue: inspections.filter((inspection) => inspection.status === "planned" && before(inspection.planned_at, now)).length,
      followUp: inspections.filter((inspection) => ["failed", "ready_for_reinspection"].includes(inspection.status)).length,
    },
    contractors,
    documents: { awaitingReview, recentRevisions },
  };
}

/**
 * Contractor performance (section 11): per contractor, what was assigned in the period, how
 * much was answered and how fast, what was returned, and what is overdue.
 * @param {{ shares?: any[], events?: any[], findings?: any[], actions?: any[], parties?: any[] }} input
 * @param {{ from?: string, to?: string }} [period]
 * @param {Date} [now]
 */
export function contractorPerformance(input, period = {}, now = new Date()) {
  const { shares = [], events = [], findings = [], actions = [], parties = [] } = input;
  const inPeriod = (value) => {
    const day = String(value ?? "").slice(0, 10);
    return (!period.from || day >= period.from) && (!period.to || day <= period.to);
  };
  return parties
    .filter((party) => ["contractor", "subcontractor"].includes(party.type ?? party.party_type))
    .map((party) => {
      const partyShares = shares.filter((share) => share.party_id === party.id && share.audience === "contractor" && inPeriod(share.assigned_at));
      const ids = new Set(partyShares.map((share) => share.id));
      const partyEvents = events.filter((event) => ids.has(event.share_id));
      const firstAnswer = new Map();
      for (const event of partyEvents.slice().sort((a, b) => Number(a.sequence) - Number(b.sequence))) {
        if (event.actor_side === "contractor" && !["view", "download"].includes(event.action) && !firstAnswer.has(event.share_id)) firstAnswer.set(event.share_id, event.created_at);
      }
      const answered = partyShares.filter((share) => firstAnswer.has(share.id));
      const onTime = answered.filter((share) => !share.due_at || String(firstAnswer.get(share.id)) <= String(share.due_at));
      const days = answered.map((share) => (new Date(firstAnswer.get(share.id)).getTime() - new Date(share.assigned_at).getTime()) / DAY);
      const ncrs = findings.filter((finding) => finding.finding_type === "ncr" && finding.responsible_party_id === party.id && inPeriod(finding.created_at));
      const partyActions = actions.filter((action) => action.owner_party_id === party.id);
      return {
        id: party.id,
        name: party.name,
        assigned: partyShares.length,
        answered: answered.length,
        onTime: onTime.length,
        averageDays: days.length ? Math.round((days.reduce((sum, value) => sum + value, 0) / days.length) * 10) / 10 : null,
        returned: partyEvents.filter((event) => event.action === "return").length,
        overdue: partyShares.filter((share) => !closedShare.has(share.status) && ["assigned", "acknowledged", "returned"].includes(share.status) && before(share.due_at, now)).length,
        ncrRaised: ncrs.length,
        ncrClosed: ncrs.filter((finding) => finding.status === "closed").length,
        openActions: partyActions.filter((action) => !closedAction.has(action.status)).length,
        overdueActions: partyActions.filter((action) => !closedAction.has(action.status) && before(action.due_at, now)).length,
      };
    })
    .filter((row) => row.assigned || row.ncrRaised || row.openActions);
}
