"use client";

import { AlertTriangle, Download, Loader2, Send, Share2, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShareStatusBadge } from "@/app/portal-app";
import { useLanguage } from "@/lib/i18n";
import { statusMeta as documentStatusMeta } from "@/lib/documents/document-register.mjs";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { downloadProjectFile, uploadProjectFile } from "@/lib/storage/gateway";
import {
  eventLabels,
  eventsByRound,
  isClosedShare,
  isOverdueShare,
  label,
  publicationTypes,
  recordTypeLabels,
  requestedActionLabels,
  revisionReleasable,
  reviewStepsFor,
  shareStatusLabels,
} from "@/lib/portal/portal-model.mjs";
import {
  loadPortalSnapshot,
  loadRecordFiles,
  releaseDocumentRevision,
  reviewPortalShare,
  setMemberPortalParty,
  shareToPortal,
  withdrawDocumentRelease,
  type PortalAudience,
  type PortalEvent,
  type PortalShare,
  type PortalSnapshot,
} from "@/lib/portal/portal-data";

type Party = { id: string; name: string; type?: string; party_type?: string };

const contractorActions = ["acknowledge", "comment", "propose", "submit_evidence", "implement", "sign", "attend", "information"];
const clientActions = ["information", "acknowledge", "comment", "review", "approve"];

function partyType(party: Party) {
  return party.party_type ?? party.type ?? "";
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Paramaribo" });
}

/**
 * CODECO's side of the portals on one record: assign it to a contractor, route it to the client,
 * and review what comes back (7.1 steps 2, 5, 7, 8; 21.3 steps 2 and 5). The record is never
 * copied; the share points at it and carries only what that organisation may see.
 */
export function PortalSharePanel({
  client,
  projectId,
  recordType,
  recordId,
  recordTitle,
  parties: givenParties,
  defaultAudience = "contractor",
  fixedFileIds,
}: {
  client: SupabaseClient;
  projectId: string;
  recordType: PortalShare["record_type"];
  recordId: string;
  recordTitle: string;
  /** The project's parties; loaded here when the caller has none at hand. */
  parties?: Party[];
  defaultAudience?: PortalAudience;
  /** Files that always go with the share (a document's current revision is added by the database). */
  fixedFileIds?: string[];
}) {
  const { text } = useLanguage();
  const permissions = useProjectPermissions();
  const queryClient = useQueryClient();
  const canShare = permissions.can("portal.share");
  const canSee = canShare || permissions.can("records.edit");
  const [formOpen, setFormOpen] = useState(false);
  const partiesQuery = useQuery({
    queryKey: ["portal-parties", projectId],
    queryFn: async () => {
      const result = await client.from("parties").select("id,name,party_type").eq("project_id", projectId).eq("active", true).order("name");
      if (result.error) throw result.error;
      return (result.data ?? []) as Party[];
    },
    enabled: !givenParties && canSee,
    staleTime: 5 * 60_000,
  });
  const parties = givenParties ?? partiesQuery.data ?? [];
  const key = ["portal-record", projectId, recordType, recordId];
  const sharesQuery = useQuery({
    queryKey: key,
    queryFn: () => loadPortalSnapshot(client, projectId, { recordType, recordId }),
    enabled: canSee,
  });
  if (!canSee) return null;
  const snapshot = sharesQuery.data;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["portal-register", projectId] });
  };

  return (
    <section className="portal-share-panel" aria-label={text("Contractor and client portal", "Aannemers- en opdrachtgeversportaal")}>
      <div className="portal-share-head">
        <h3><Share2 size={15} /> {text("Portals", "Portalen")}</h3>
        {canShare && !formOpen ? <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => setFormOpen(true)}>{text("Assign or share", "Toewijzen of delen")}</button> : null}
      </div>
      {sharesQuery.isLoading ? <p className="portal-loading"><Loader2 className="spin" size={14} /> {text("Loading…", "Laden…")}</p> : null}
      {snapshot?.shares.length ? (
        <div className="portal-share-list">
          {snapshot.shares.map((share) => (
            <ShareReview key={share.id} client={client} share={share} snapshot={snapshot} partyName={parties.find((party) => party.id === share.party_id)?.name ?? ""} canReview={canShare} changed={refresh} />
          ))}
        </div>
      ) : !sharesQuery.isLoading ? <p className="record-list-empty">{text("Not shared with a contractor or the client.", "Niet gedeeld met een aannemer of de opdrachtgever.")}</p> : null}
      {formOpen ? (
        <ShareForm
          client={client}
          projectId={projectId}
          recordType={recordType}
          recordId={recordId}
          recordTitle={recordTitle}
          parties={parties}
          defaultAudience={defaultAudience}
          fixedFileIds={fixedFileIds}
          close={() => setFormOpen(false)}
          done={() => { setFormOpen(false); refresh(); }}
        />
      ) : null}
    </section>
  );
}

function ShareForm({ client, projectId, recordType, recordId, recordTitle, parties, defaultAudience, fixedFileIds, close, done }: {
  client: SupabaseClient; projectId: string; recordType: PortalShare["record_type"]; recordId: string; recordTitle: string;
  parties: Party[]; defaultAudience: PortalAudience; fixedFileIds?: string[]; close: () => void; done: () => void;
}) {
  const { language, text } = useLanguage();
  const [audience, setAudience] = useState<PortalAudience>(recordType === "publication" ? "client" : defaultAudience);
  const eligible = useMemo(() => parties.filter((party) => audience === "client" ? partyType(party) === "client" : !["client", "supervisor"].includes(partyType(party))), [audience, parties]);
  const [partyId, setPartyId] = useState("");
  const [requested, setRequested] = useState(audience === "client" ? "information" : "acknowledge");
  const [priority, setPriority] = useState("normal");
  const [due, setDue] = useState("");
  const [title, setTitle] = useState(recordTitle);
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filesQuery = useQuery({
    queryKey: ["record-files", projectId, recordType, recordId],
    queryFn: () => loadRecordFiles(client, projectId, recordType, recordId),
    enabled: ["finding", "action", "hse", "inspection", "register_entry"].includes(recordType),
  });
  const actions = audience === "client" ? clientActions : contractorActions;
  const party = eligible.find((item) => item.id === partyId) ? partyId : eligible[0]?.id ?? "";

  const submit = async () => {
    if (!party) { setError(text("Choose an organisation.", "Kies een organisatie.")); return; }
    if (title.trim().length < 2) { setError(text("Add a title.", "Voeg een titel toe.")); return; }
    setBusy(true);
    setError("");
    try {
      await shareToPortal(client, {
        projectId, audience, partyId: party, recordType, recordId, title: title.trim(), summary,
        requestedAction: requested, priority, dueAt: due ? new Date(`${due}T17:00:00-03:00`).toISOString() : null,
        fileIds: [...selected, ...(fixedFileIds ?? [])],
      });
      done();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("Not shared.", "Niet gedeeld."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal-share-form">
      <div className="form-grid form-grid-2">
        <label className="form-field"><span>{text("Portal", "Portaal")}</span>
          <select value={audience} disabled={recordType === "publication"} onChange={(event) => { const next = event.target.value as PortalAudience; setAudience(next); setRequested(next === "client" ? "information" : "acknowledge"); setPartyId(""); }}>
            <option value="contractor">{text("Contractor portal", "Aannemersportaal")}</option>
            <option value="client">{text("Client portal", "Opdrachtgeversportaal")}</option>
          </select>
        </label>
        <label className="form-field"><span>{audience === "client" ? text("Client organisation", "Opdrachtgever") : text("Contractor organisation", "Aannemer")}</span>
          <select value={party} onChange={(event) => setPartyId(event.target.value)}>
            {eligible.length ? null : <option value="">{text("No organisation of this type on the project", "Geen organisatie van dit type in het project")}</option>}
            {eligible.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="form-field"><span>{text("Requested action", "Gevraagde actie")}</span>
          <select value={requested} onChange={(event) => setRequested(event.target.value)}>
            {actions.map((id) => <option key={id} value={id}>{label(requestedActionLabels, id, language)}</option>)}
          </select>
        </label>
        <label className="form-field"><span>{text("Response due", "Reactie uiterlijk")}</span>
          <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </label>
        <label className="form-field"><span>{text("Priority", "Prioriteit")}</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="low">{text("Low", "Laag")}</option>
            <option value="normal">{text("Normal", "Normaal")}</option>
            <option value="high">{text("High", "Hoog")}</option>
            <option value="critical">{text("Critical", "Kritiek")}</option>
          </select>
        </label>
        <label className="form-field"><span>{text("Title they see", "Titel die zij zien")}</span>
          <input value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} />
        </label>
      </div>
      <label className="form-field"><span>{text("What they see (internal notes stay out)", "Wat zij zien (interne notities blijven buiten)")}</span>
        <textarea rows={3} maxLength={4000} value={summary} onChange={(event) => setSummary(event.target.value)} />
      </label>
      {filesQuery.data?.length ? (
        <fieldset className="portal-file-choice">
          <legend>{text("Files they may open", "Bestanden die zij mogen openen")}</legend>
          {filesQuery.data.map((file) => (
            <label key={file.id} className="portal-check">
              <input type="checkbox" checked={selected.includes(file.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, file.id] : current.filter((id) => id !== file.id))} />
              <span>{file.original_name}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {audience === "contractor" && requested === "propose" ? <p className="portal-note">{text("A contractor proposal is not authorisation to proceed.", "Een voorstel van de aannemer is geen opdracht om uit te voeren.")}</p> : null}
      {error ? <p className="field-warning" role="alert">{error}</p> : null}
      <div className="portal-response-actions">
        <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
        <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !party} onClick={() => void submit()}>{busy ? <Loader2 className="spin" size={15} /> : <Send size={15} />} {audience === "client" ? text("Route to client", "Naar opdrachtgever sturen") : text("Assign to contractor", "Aan aannemer toewijzen")}</button>
      </div>
    </div>
  );
}

function documentStatusLabel(status: string, language: string) {
  const meta = documentStatusMeta(status);
  return language === "nl" ? meta.nl : meta.en;
}

type InternalRevision = { id: string; revision: string; review_status: string; superseded_at: string | null; uploaded_at: string };

/**
 * F15: which revisions of a shared document this organisation can read. Uploading a revision never
 * shares it; an authorised user releases an approved revision here and can withdraw it with a reason.
 */
function DocumentReleases({ client, share, snapshot, canRelease, changed }: {
  client: SupabaseClient; share: PortalShare; snapshot: PortalSnapshot; canRelease: boolean; changed: () => void;
}) {
  const { language, locale, text } = useLanguage();
  const [choice, setChoice] = useState("");
  const [withdrawing, setWithdrawing] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const released = snapshot.revisions.filter((revision) => revision.share_id === share.id);
  const revisionsQuery = useQuery({
    queryKey: ["document-revisions-internal", share.record_id],
    queryFn: async () => {
      const result = await client.from("project_document_revisions").select("id,revision,review_status,superseded_at,uploaded_at").eq("document_id", share.record_id).order("uploaded_at", { ascending: false });
      if (result.error) throw result.error;
      return (result.data ?? []) as InternalRevision[];
    },
    enabled: canRelease,
  });
  const candidates = (revisionsQuery.data ?? []).filter((revision) => revisionReleasable(revision) && !released.some((item) => item.id === revision.id));
  const selected = candidates.find((item) => item.id === choice)?.id ?? candidates[0]?.id ?? "";
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      setWithdrawing(""); setReason(""); setChoice("");
      void revisionsQuery.refetch();
      changed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("Not saved.", "Niet opgeslagen."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="portal-detail-section" aria-label={text("Released revisions", "Vrijgegeven revisies")}>
      <h4>{text("Released revisions", "Vrijgegeven revisies")}</h4>
      {released.length ? (
        <ul className="portal-files">
          {released.map((revision) => (
            <li key={revision.release_id}>
              <span>{text("Revision", "Revisie")} {revision.revision} · {documentStatusLabel(revision.review_status, language)} · {formatDate(revision.released_at, locale)}</span>
              {canRelease && withdrawing !== revision.release_id ? <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => { setWithdrawing(revision.release_id); setReason(""); }}>{text("Withdraw", "Intrekken")}</button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="record-list-empty">{text("No revision is released to this organisation.", "Er is geen revisie vrijgegeven aan deze organisatie.")}</p>}
      {withdrawing ? (
        <div className="portal-response-form">
          <label className="form-field"><span>{text("Reason for withdrawal", "Reden van intrekken")}</span><textarea value={reason} rows={2} onChange={(event) => setReason(event.target.value)} /></label>
          <div className="portal-response-actions">
            <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy} onClick={() => setWithdrawing("")}>{text("Cancel", "Annuleren")}</button>
            <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || reason.trim().length < 3} onClick={() => void run(() => withdrawDocumentRelease(client, { releaseId: withdrawing, reason }))}>{busy ? <Loader2 className="spin" size={15} /> : null} {text("Withdraw release", "Vrijgave intrekken")}</button>
          </div>
        </div>
      ) : null}
      {canRelease && !withdrawing ? (
        candidates.length ? (
          <div className="portal-response-form">
            <label className="form-field"><span>{text("Approved revision to release", "Goedgekeurde revisie om vrij te geven")}</span>
              <select value={selected} onChange={(event) => setChoice(event.target.value)}>
                {candidates.map((revision) => <option key={revision.id} value={revision.id}>{revision.revision} · {documentStatusLabel(revision.review_status, language)}</option>)}
              </select>
            </label>
            <div className="portal-response-actions">
              <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || !selected} onClick={() => void run(() => releaseDocumentRevision(client, { shareId: share.id, revisionId: selected }))}>{busy ? <Loader2 className="spin" size={15} /> : <Send size={15} />} {text("Release revision", "Revisie vrijgeven")}</button>
            </div>
          </div>
        ) : revisionsQuery.isSuccess ? <p className="portal-note">{text("Only an approved, current revision can be released. Revisions in review stay internal.", "Alleen een goedgekeurde, actuele revisie kan worden vrijgegeven. Revisies in beoordeling blijven intern.")}</p> : null
      ) : null}
      {error ? <p className="field-warning" role="alert">{error}</p> : null}
    </section>
  );
}

function ShareReview({ client, share, snapshot, partyName, canReview, changed }: {
  client: SupabaseClient; share: PortalShare; snapshot: PortalSnapshot; partyName: string; canReview: boolean; changed: () => void;
}) {
  const { language, locale, text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rounds = eventsByRound(snapshot.events.filter((event) => event.share_id === share.id)) as Array<{ round: number; events: PortalEvent[] }>;
  const files = snapshot.shareFiles.filter((item) => item.share_id === share.id);
  const steps = (canReview ? reviewStepsFor(share) : []).filter((id: string) => id !== "add_files") as string[];
  const needsComment = ["return", "withdraw", "reopen", "comment"].includes(step);
  const stepLabel = (id: string) => ({
    accept: text("Accept", "Accepteren"), return: text("Return for correction", "Terugsturen"), verify: text("Verify", "Verifiëren"),
    close: text("Close", "Sluiten"), withdraw: text("Withdraw", "Intrekken"), reopen: text("Reopen", "Heropenen"), comment: text("Comment", "Opmerking"),
  } as Record<string, string>)[id] ?? id;

  const submit = async () => {
    if (needsComment && !comment.trim()) { setError(text("A reason is required.", "Een reden is verplicht.")); return; }
    setBusy(true);
    setError("");
    try {
      await reviewPortalShare(client, { shareId: share.id, action: step, comment });
      setStep(""); setComment("");
      changed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("Not saved.", "Niet opgeslagen."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="portal-share-item">
      <button className="portal-share-summary" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>
          <strong>{partyName || text("Organisation", "Organisatie")}</strong>
          <small>
            {share.audience === "client" ? text("Client portal", "Opdrachtgeversportaal") : text("Contractor portal", "Aannemersportaal")}
            {" · "}{label(requestedActionLabels, share.requested_action, language)}
            {share.due_at ? ` · ${text("due", "uiterlijk")} ${formatDate(share.due_at, locale)}` : ""}
            {share.round > 1 ? ` · ${text("round", "ronde")} ${share.round}` : ""}
          </small>
        </span>
        <span className="portal-row-side">
          {isOverdueShare(share) ? <span className="ui-status-badge ui-status-badge--red"><AlertTriangle size={12} /> {text("Overdue", "Over tijd")}</span> : null}
          <ShareStatusBadge status={share.status} language={language} />
        </span>
      </button>
      {open ? (
        <div className="portal-share-body">
          {share.visible_summary ? <p className="portal-summary">{share.visible_summary}</p> : null}
          {share.record_type === "document" ? <DocumentReleases client={client} share={share} snapshot={snapshot} canRelease={canReview} changed={changed} /> : null}
          {files.length ? (
            <ul className="portal-files">
              {files.map((item) => {
                const file = snapshot.files.get(item.file_id);
                return (
                  <li key={item.file_id}>
                    <span>{file?.original_name ?? item.file_id} · {item.source === "response" ? partyName : "CODECO"}</span>
                    <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => void downloadProjectFile(client, item.file_id, file?.original_name ?? "file").catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))}><Download size={14} /> {text("Download", "Downloaden")}</button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {rounds.map(({ round, events }) => (
            <div key={round} className="portal-round">
              {rounds.length > 1 ? <span className="portal-round-label">{text("Round", "Ronde")} {round}</span> : null}
              <ol className="portal-timeline">
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{label(eventLabels, event.action, language)}</strong>
                    <small>{event.actor_name ?? ""} · {event.actor_side === "codeco" ? "CODECO" : partyName}{event.actor_roles ? ` (${event.actor_roles})` : ""} · {formatDate(event.created_at, locale)}
                      {event.previous_status && event.resulting_status && event.previous_status !== event.resulting_status ? ` · ${label(shareStatusLabels, event.previous_status, language)} → ${label(shareStatusLabels, event.resulting_status, language)}` : ""}</small>
                    {event.comment ? <p>{event.comment}</p> : null}
                    {Object.entries(event.payload ?? {}).filter(([key]) => !["requested_action", "due_at", "priority", "publication_version"].includes(key)).length ? (
                      <dl className="portal-payload">
                        {Object.entries(event.payload).filter(([key]) => !["requested_action", "due_at", "priority", "publication_version"].includes(key)).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {steps.length ? (
            <div className="portal-steps" role="group" aria-label={text("Review", "Beoordelen")}>
              {steps.map((id) => <button key={id} type="button" className={`ui-button ui-button--sm ${step === id ? "ui-button--primary" : "ui-button--secondary"}`} aria-pressed={step === id} onClick={() => { setStep(id); setError(""); }}>{stepLabel(id)}</button>)}
            </div>
          ) : null}
          {step ? (
            <div className="portal-response-form">
              <label className="form-field"><span>{needsComment ? text("Reason / comment (required, visible to the organisation)", "Reden / opmerking (verplicht, zichtbaar voor de organisatie)") : text("Comment (visible to the organisation)", "Opmerking (zichtbaar voor de organisatie)")}</span>
                <textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} />
              </label>
              <div className="portal-response-actions">
                <button className="ui-button ui-button--quiet ui-button--sm" type="button" onClick={() => setStep("")}><X size={14} /> {text("Cancel", "Annuleren")}</button>
                <button className="ui-button ui-button--primary ui-button--sm" type="button" disabled={busy} onClick={() => void submit()}>{busy ? <Loader2 className="spin" size={14} /> : null} {stepLabel(step)}</button>
              </div>
            </div>
          ) : null}
          {error ? <p className="field-warning" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

/** Every portal item of the project, for CODECO: what waits on whom, overdue, by organisation. */
export function PortalRegister({ client, projectId, parties }: { client: SupabaseClient; projectId: string; parties: Party[] }) {
  const { language, locale, text } = useLanguage();
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState("");
  const [party, setParty] = useState("");
  const [state, setState] = useState("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["portal-register", projectId], queryFn: () => loadPortalSnapshot(client, projectId), refetchInterval: 120_000 });
  const shares = (query.data?.shares ?? []).filter((share) => (!audience || share.audience === audience) && (!party || share.party_id === party)
    && (state === "all" || (state === "open" && !isClosedShare(share)) || (state === "overdue" && isOverdueShare(share))
      || (state === "waiting" && ["responded", "submitted_for_verification", "approved", "rejected", "clarification_requested"].includes(share.status))));
  const partyName = (id: string) => parties.find((item) => item.id === id)?.name ?? "";
  const openShare = query.data?.shares.find((share) => share.id === openId);
  return (
    <section className="ui-panel portal-register">
      <div className="ui-panel__heading"><h2>{text("Portal register", "Portaalregister")}</h2></div>
      <div className="portal-filters">
        <label className="form-field"><span>{text("Portal", "Portaal")}</span>
          <select value={audience} onChange={(event) => setAudience(event.target.value)}>
            <option value="">{text("Both", "Beide")}</option>
            <option value="contractor">{text("Contractor", "Aannemer")}</option>
            <option value="client">{text("Client", "Opdrachtgever")}</option>
          </select>
        </label>
        <label className="form-field"><span>{text("Organisation", "Organisatie")}</span>
          <select value={party} onChange={(event) => setParty(event.target.value)}>
            <option value="">{text("All", "Alle")}</option>
            {parties.filter((item) => partyType(item) !== "supervisor").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="form-field"><span>{text("Show", "Tonen")}</span>
          <select value={state} onChange={(event) => setState(event.target.value)}>
            <option value="open">{text("Open", "Open")}</option>
            <option value="waiting">{text("Waiting on CODECO", "Wacht op CODECO")}</option>
            <option value="overdue">{text("Overdue at the organisation", "Over tijd bij de organisatie")}</option>
            <option value="all">{text("All", "Alle")}</option>
          </select>
        </label>
      </div>
      {query.isLoading ? <p className="portal-loading"><Loader2 className="spin" size={14} /> {text("Loading…", "Laden…")}</p> : shares.length ? (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>{text("Record", "Record")}</th><th>{text("Organisation", "Organisatie")}</th><th>{text("Requested", "Gevraagd")}</th><th>{text("Due", "Uiterlijk")}</th><th>{text("Status", "Status")}</th></tr></thead>
            <tbody>
              {shares.map((share) => (
                <tr key={share.id}>
                  <td><button className="portal-link" type="button" onClick={() => setOpenId(share.id)}>{share.record_code ? `${share.record_code} · ` : ""}{share.title}</button><small className="portal-cell-meta">{label(recordTypeLabels, share.record_type, language)}{share.publication_type ? ` · ${publicationTypes.find((item) => item.id === share.publication_type)?.[language] ?? ""}` : ""}</small></td>
                  <td>{partyName(share.party_id)}<small className="portal-cell-meta">{share.audience === "client" ? text("Client", "Opdrachtgever") : text("Contractor", "Aannemer")}</small></td>
                  <td>{label(requestedActionLabels, share.requested_action, language)}</td>
                  <td>{share.due_at ? formatDate(share.due_at, locale) : "–"}{isOverdueShare(share) ? <small className="portal-cell-meta portal-overdue">{text("Overdue", "Over tijd")}</small> : null}</td>
                  <td><ShareStatusBadge status={share.status} language={language} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="record-list-empty">{text("No portal items for this selection.", "Geen portaalitems voor deze selectie.")}</p>}
      {openShare && query.data ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpenId(null)}>
          <aside className="modal portal-detail" role="dialog" aria-modal="true" aria-label={openShare.title}>
            <div className="portal-detail-head">
              <div><span className="record-number">{openShare.record_code ?? ""}</span><h2>{openShare.title}</h2></div>
              <button className="icon-button" type="button" aria-label={text("Close", "Sluiten")} onClick={() => setOpenId(null)}><X size={18} /></button>
            </div>
            <ShareReview client={client} share={openShare} snapshot={query.data} partyName={partyName(openShare.party_id)} canReview changed={() => void queryClient.invalidateQueries({ queryKey: ["portal-register", projectId] })} />
          </aside>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Management: which organisation each portal user acts for (6.4). A portal user without an
 * organisation sees nothing; the link is the boundary every portal read is scoped by.
 */
export function PortalMembers({ client, projectId, parties }: { client: SupabaseClient; projectId: string; parties: Party[] }) {
  const { text } = useLanguage();
  const queryClient = useQueryClient();
  const [busyUser, setBusyUser] = useState("");
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["portal-members", projectId],
    queryFn: async () => {
      const [people, memberships] = await Promise.all([
        client.rpc("list_project_people", { p_project_id: projectId }),
        client.from("project_memberships").select("user_id,portal_party_id,status").eq("project_id", projectId).limit(1000),
      ]);
      if (people.error) throw people.error;
      const links = new Map(((memberships.data ?? []) as Array<{ user_id: string; portal_party_id: string | null; status: string }>).map((row) => [row.user_id, row]));
      return ((people.data ?? []) as Array<{ user_id: string; display_name: string; role_name: string | null; company_staff: boolean }>)
        .filter((person) => !person.company_staff && links.has(person.user_id))
        .map((person) => ({ ...person, partyId: links.get(person.user_id)?.portal_party_id ?? "" }));
    },
  });
  const eligible = parties.filter((party) => partyType(party) !== "supervisor");
  const save = async (userId: string, partyId: string) => {
    setBusyUser(userId);
    setError("");
    try {
      await setMemberPortalParty(client, projectId, userId, partyId || null);
      await queryClient.invalidateQueries({ queryKey: ["portal-members", projectId] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyUser("");
    }
  };
  return (
    <section className="ui-panel portal-register">
      <div className="ui-panel__heading"><h2>{text("Portal users and their organisation", "Portaalgebruikers en hun organisatie")}</h2></div>
      <p className="portal-note">{text("Give a contractor or client user a portal role under Manage team, then link the user to their organisation here.", "Geef een aannemer of opdrachtgever een portaalrol onder Team beheren en koppel de gebruiker hier aan zijn organisatie.")}</p>
      {query.isLoading ? <p className="portal-loading"><Loader2 className="spin" size={14} /> {text("Loading…", "Laden…")}</p> : (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>{text("User", "Gebruiker")}</th><th>{text("Role", "Rol")}</th><th>{text("Organisation", "Organisatie")}</th></tr></thead>
            <tbody>
              {(query.data ?? []).map((person) => (
                <tr key={person.user_id}>
                  <td>{person.display_name}</td>
                  <td>{person.role_name ?? ""}</td>
                  <td>
                    <label className="sr-only" htmlFor={`portal-party-${person.user_id}`}>{text("Organisation of", "Organisatie van")} {person.display_name}</label>
                    <select id={`portal-party-${person.user_id}`} value={person.partyId} disabled={busyUser === person.user_id} onChange={(event) => void save(person.user_id, event.target.value)}>
                      <option value="">{text("Not linked (CODECO staff)", "Niet gekoppeld (CODECO)")}</option>
                      {eligible.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error ? <p className="field-warning" role="alert">{error}</p> : null}
    </section>
  );
}

/**
 * Publish a generated report to the client portal (21.2). Only a published issue is visible to
 * the client; drafts and internal notes never leave the workspace. Publishing the same report
 * type and period again issues a new version and marks the earlier one superseded.
 */
export function PublishToClient({
  client,
  projectId,
  buildingId,
  title,
  periodStart,
  periodEnd,
  defaultType = "weekly",
  disabled = false,
  buildPdf,
}: {
  client: SupabaseClient;
  projectId: string;
  buildingId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  defaultType?: string;
  disabled?: boolean;
  buildPdf: () => Promise<File>;
}) {
  const { language, text } = useLanguage();
  const permissions = useProjectPermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(defaultType);
  const [partyId, setPartyId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const partiesQuery = useQuery({
    queryKey: ["portal-parties", projectId],
    queryFn: async () => {
      const result = await client.from("parties").select("id,name,party_type").eq("project_id", projectId).eq("active", true).order("name");
      if (result.error) throw result.error;
      return (result.data ?? []) as Party[];
    },
    enabled: permissions.can("portal.share"),
    staleTime: 5 * 60_000,
  });
  if (!permissions.can("portal.share")) return null;
  const clients = (partiesQuery.data ?? []).filter((party) => partyType(party) === "client");
  const party = clients.find((item) => item.id === partyId) ? partyId : clients[0]?.id ?? "";

  const publish = async () => {
    if (!party) { setError(text("Add the client organisation as a project party first.", "Voeg de opdrachtgever eerst als projectpartij toe.")); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const file = await buildPdf();
      const uploaded = await uploadProjectFile(client, { projectId, buildingId, category: "report", file });
      await shareToPortal(client, {
        projectId, audience: "client", partyId: party, recordType: "publication", recordId: uploaded.fileId, title,
        summary: note, requestedAction: "information", publicationType: type, periodStart, periodEnd,
      });
      setMessage(text("Published to the client portal.", "Gepubliceerd in het opdrachtgeversportaal."));
      setOpen(false); setNote("");
      void queryClient.invalidateQueries({ queryKey: ["portal-register", projectId] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("Not published.", "Niet gepubliceerd."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal-publish">
      {!open ? (
        <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={disabled} onClick={() => setOpen(true)}><Share2 size={15} /> {text("Publish to client portal", "Publiceren voor opdrachtgever")}</button>
      ) : (
        <div className="portal-share-form">
          <div className="form-grid form-grid-2">
            <label className="form-field"><span>{text("Report type", "Rapporttype")}</span>
              <select value={type} onChange={(event) => setType(event.target.value)}>{publicationTypes.map((item) => <option key={item.id} value={item.id}>{item[language]}</option>)}</select>
            </label>
            <label className="form-field"><span>{text("Client organisation", "Opdrachtgever")}</span>
              <select value={party} onChange={(event) => setPartyId(event.target.value)}>
                {clients.length ? null : <option value="">{text("No client party on the project", "Geen opdrachtgever in het project")}</option>}
                {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>
          <label className="form-field"><span>{text("Note for the client", "Notitie voor de opdrachtgever")}</span><textarea rows={2} maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <p className="portal-note">{text("The client sees this PDF only. Publishing the same type and period again issues a new version.", "De opdrachtgever ziet alleen deze PDF. Opnieuw publiceren voor hetzelfde type en dezelfde periode geeft een nieuwe versie.")}</p>
          <div className="portal-response-actions">
            <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setOpen(false)}>{text("Cancel", "Annuleren")}</button>
            <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !party} onClick={() => void publish()}>{busy ? <Loader2 className="spin" size={15} /> : <Send size={15} />} {text("Publish", "Publiceren")}</button>
          </div>
        </div>
      )}
      {message ? <p className="portal-note" role="status">{message}</p> : null}
      {error ? <p className="field-warning" role="alert">{error}</p> : null}
    </div>
  );
}
