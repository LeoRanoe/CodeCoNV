"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { useSpecDirectory } from "@/app/forms/spec-directory";
import { uploadProjectFile } from "@/lib/storage/gateway";
import {
  authorityActions,
  availableActions,
  commentRequired,
  effectiveProfile,
  loadSignoffEvents,
  outcomeDetails,
  outcomeFields,
  outcomeLabels,
  outcomeReady,
  recordSignoffAction,
  signoffActionLabels,
  signoffProfiles,
  signoffState,
  type SignoffAction,
  type SignoffEvent,
  type SignoffRecordKind,
} from "@/lib/forms/signoff";

type Text = (en: string, nl: string) => string;


/**
 * "Sign-off / review workflow" and "Workflow status" of every form in the client's
 * specification: the current state, who acts next, and the full chronological history of
 * submissions, acknowledgements, reviews, returns and approvals. Nothing here is edited or
 * removed; each action is a new event, written and checked by the database.
 */
export function SignoffPanel({
  client,
  projectId,
  recordKind,
  recordId,
  profile: profileCode,
  text,
  language,
  canReview,
  partyNames = [],
  onChanged,
}: {
  client: SupabaseClient;
  projectId: string;
  recordKind: SignoffRecordKind;
  recordId: string;
  profile: string;
  text: Text;
  language: "en" | "nl";
  /** Whether this user may approve, accept, reject, verify, close or reopen. */
  canReview: boolean;
  partyNames?: string[];
  onChanged?: (events: SignoffEvent[]) => void;
}) {
  const directory = useSpecDirectory();
  const workflowConfig = directory.config?.workflows?.[profileCode] ?? null;
  const baseProfile = signoffProfiles[profileCode];
  const profile = useMemo(() => (baseProfile ? effectiveProfile(baseProfile, workflowConfig) : undefined), [baseProfile, workflowConfig]);
  const [events, setEvents] = useState<SignoffEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<SignoffAction | "">("");
  const [role, setRole] = useState("");
  const [attestation, setAttestation] = useState<"account" | "external_representative" | "signed_document">("account");
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [nextActorUserId, setNextActorUserId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [externalOrganization, setExternalOrganization] = useState("");
  const [signature, setSignature] = useState<HandwrittenSignature | null>(null);
  const [comments, setComments] = useState("");
  const [nextActor, setNextActor] = useState("");
  const [dueAt, setDueAt] = useState("");
  /** The Close / Verify / Approve fields of the chosen action (closure note, verification result, approved amount and days). */
  const [outcome, setOutcome] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const next = await loadSignoffEvents(client, recordKind, recordId);
      setEvents(next);
      onChanged?.(next);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoaded(true);
    }
  }, [client, recordKind, recordId, onChanged]);

  useEffect(() => {
    let cancelled = false;
    loadSignoffEvents(client, recordKind, recordId)
      .then((next) => { if (!cancelled) { setEvents(next); setLoaded(true); } })
      .catch((caught) => { if (!cancelled) { setError(caught instanceof Error ? caught.message : String(caught)); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [client, recordKind, recordId]);

  const state = useMemo(() => (profile ? signoffState(profile, events) : null), [profile, events]);
  const offered = useMemo(() => (profile ? availableActions(profile, events) : []).filter((item) => canReview || !authorityActions.includes(item.action)), [profile, events, canReview]);
  const editedAfterSubmission = events.at(-1)?.action === "reopen" && events.at(-1)?.actor_role === "Editor";
  if (!profile || !state) return null;

  const chosen = offered.find((item) => item.action === action);
  const stageOf = (number: number) => profile.stages.find((stage) => stage.number === number);
  const needsComment = action ? commentRequired(action) : false;
  const outcomeFieldList = outcomeFields(profile.code, action);
  const external = attestation !== "account";
  const signedDocument = attestation === "signed_document";
  const ready = Boolean(chosen)
    && (!needsComment || comments.trim().length >= 3)
    && outcomeReady(outcomeFieldList, outcome)
    && (action !== "return" || nextActor.trim().length >= 2 || Boolean(nextActorUserId))
    && (!external || externalName.trim().length >= 2)
    && (attestation !== "external_representative" || Boolean(signature?.image))
    && (!signedDocument || Boolean(signedFile));
  const stageConfig = chosen ? workflowConfig?.stages?.[String(chosen.stage)] : undefined;
  const word = (value: { en: string; nl: string }) => value[language];
  const when = (value: string) => new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  const submit = async () => {
    if (!chosen || !ready) return;
    setBusy(true);
    setError("");
    try {
      // A signed document or photo of a signed page is uploaded as project evidence first.
      const evidence = signedDocument && signedFile
        ? await uploadProjectFile(client, { projectId, buildingId: "", category: "evidence", file: signedFile })
        : null;
      await recordSignoffAction(client, {
        projectId,
        recordKind,
        recordId,
        profile: profile.code,
        stage: chosen.stage,
        action: chosen.action,
        actorRole: role.trim() || word(stageOf(chosen.stage)?.role ?? { en: "Participant", nl: "Deelnemer" }),
        attestation,
        evidenceFileId: evidence?.fileId ?? null,
        actorName: external ? externalName.trim() : undefined,
        actorOrganization: externalOrganization.trim() || undefined,
        signatureImage: attestation === "external_representative" ? signature?.image ?? null : null,
        comments: comments.trim() || undefined,
        returnReason: action === "return" ? comments.trim().slice(0, 400) : undefined,
        nextActor: nextActor.trim() || undefined,
        nextActorUserId: nextActorUserId || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        details: outcomeDetails(outcomeFieldList, outcome),
      });
      setAction("");
      setComments("");
      setNextActor("");
      setNextActorUserId("");
      setSignedFile(null);
      setDueAt("");
      setOutcome({});
      setSignature(null);
      setExternalName("");
      setExternalOrganization("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="record-section signoff-panel" aria-label={text("Sign-off and review", "Ondertekening en beoordeling")} data-workflow-profile={profile.code}>
      <h3>{text("Sign-off and review", "Ondertekening en beoordeling")} · {word(profile.label)}</h3>
      <dl className="signoff-state">
        <div><dt>{text("Workflow status", "Workflowstatus")}</dt><dd data-signoff-status>{state.status}</dd></div>
        <div><dt>{text("Round", "Ronde")}</dt><dd>{state.round}</dd></div>
        <div><dt>{text("Current stage", "Huidige stap")}</dt><dd>{state.stage ? `${state.stage.number} · ${word(state.stage.label)}` : text("Complete", "Afgerond")}</dd></div>
        <div><dt>{text("Waiting for", "Wacht op")}</dt><dd>{state.closed ? "—" : typeof state.pending === "string" ? state.pending : state.pending ? word(state.pending) : "—"}</dd></div>
        {state.dueAt ? <div><dt>{text("Due", "Uiterlijk")}</dt><dd>{when(state.dueAt)}</dd></div> : null}
      </dl>
      <p className="form-helper">{word(profile.rule)}</p>
      {editedAfterSubmission ? <p className="field-warning" role="status">{text("This record was edited after it was submitted. Resubmit the new version; the approvals are required again.", "Deze registratie is na het indienen gewijzigd. Dien de nieuwe versie opnieuw in; de goedkeuringen zijn opnieuw nodig.")}</p> : null}

      {loaded && events.length ? (
        <ol className="signoff-history" aria-label={text("Sign-off history", "Ondertekeningsgeschiedenis")}>
          {events.map((event) => (
            <li key={event.id}>
              <strong>{word(signoffActionLabels[event.action])}</strong>
              <span> · {event.actor_name}{event.actor_organization ? ` (${event.actor_organization})` : ""} · {event.actor_role}{event.stage_role && event.stage_role !== event.actor_role && event.attestation_method === "account" ? ` · ${text("as", "als")} ${event.stage_role}` : ""}</span>
              <span className="signoff-meta"> · {text("round", "ronde")} {event.round_number} · {when(event.created_at)} · {event.previous_status ?? "—"} → {event.new_status}</span>
              {event.attestation_method === "external_representative" ? <span className="signoff-meta"> · {text("signed on this device by an external representative", "op dit apparaat getekend door een externe vertegenwoordiger")}</span> : null}
              {event.attestation_method === "signed_document" ? <span className="signoff-meta"> · {text("signed document uploaded", "ondertekend document geüpload")}</span> : null}
              {event.action === "reopen" && event.actor_role === "Editor" ? <span className="signoff-meta"> · {text("new version: edited after submission", "nieuwe versie: gewijzigd na indienen")}</span> : null}
              {event.details && Object.keys(event.details).length ? (
                <dl className="signoff-outcome-log">
                  {(["closure_note", "verification_result", "verified_by", "verified_on", "approved_amount", "approved_days"] as const).filter((key) => event.details?.[key]).map((key) => (
                    <div key={key}><dt>{outcomeLabels[key][language]}</dt><dd>{event.details?.[key]}</dd></div>
                  ))}
                </dl>
              ) : null}
              {event.comments ? <p>{event.comments}</p> : null}
              {event.next_actor ? <p className="signoff-meta">{text("Next", "Volgende")}: {event.next_actor}{event.due_at ? ` · ${when(event.due_at)}` : ""}</p> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {event.signature_image ? <img className="signoff-signature" src={event.signature_image} alt={text(`Signature of ${event.actor_name}`, `Handtekening van ${event.actor_name}`)} /> : null}
            </li>
          ))}
        </ol>
      ) : loaded ? <p className="form-helper">{text("No sign-off actions yet.", "Nog geen ondertekeningsacties.")}</p> : null}

      {offered.length ? (
        <div className="signoff-action">
          <div className="form-grid form-grid-2">
            <label className="form-field">
              <span>{text("Action", "Actie")}</span>
              <select value={action} onChange={(event) => { setAction(event.target.value as SignoffAction | ""); setOutcome({}); }}>
                <option value="">{text("Choose an action…", "Kies een actie…")}</option>
                {offered.map((item) => <option key={item.action} value={item.action}>{word(signoffActionLabels[item.action])}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>{text("Your role in this step", "Jouw rol in deze stap")}</span>
              <input value={role} maxLength={120} placeholder={chosen ? word(stageOf(chosen.stage)?.role ?? { en: "", nl: "" }) : ""} onChange={(event) => setRole(event.target.value)} />
            </label>
            <label className="form-field">
              <span>{text("Signed by", "Getekend door")}</span>
              <select value={attestation} onChange={(event) => setAttestation(event.target.value as "account" | "external_representative" | "signed_document")}>
                <option value="account">{text("Me, with my account", "Ik, met mijn account")}</option>
                <option value="external_representative">{text("A representative without an account, on this device", "Een vertegenwoordiger zonder account, op dit apparaat")}</option>
                <option value="signed_document">{text("A representative, with an uploaded signed document or photo", "Een vertegenwoordiger, met een geüpload ondertekend document of foto")}</option>
              </select>
            </label>
            <label className="form-field">
              <span>{action === "return" ? <>{text("Who acts next", "Wie is nu aan zet")} <em className="record-section-required">*</em></> : text("Who acts next (optional)", "Wie is nu aan zet (optioneel)")}</span>
              <select value={nextActorUserId || (nextActor ? "other" : "")} onChange={(event) => {
                const person = directory.people.find((item) => item.id === event.target.value);
                setNextActorUserId(person?.id ?? "");
                setNextActor(person ? person.name : event.target.value === "other" ? " " : "");
              }}>
                <option value="">{text("Choose…", "Kies…")}</option>
                {directory.people.length ? (
                  <optgroup label={text("People on this project (notified)", "Mensen op dit project (krijgen een melding)")}>
                    {directory.people.map((person) => <option key={person.id} value={person.id}>{person.name}{person.role ? ` · ${person.role}` : ""}</option>)}
                  </optgroup>
                ) : null}
                <option value="other">{text("A party or person without an account", "Een partij of persoon zonder account")}</option>
              </select>
              {!nextActorUserId && nextActor ? (
                <input aria-label={text("Name or party", "Naam of partij")} value={nextActor.trimStart()} maxLength={160} list={partyNames.length ? "signoff-next-actors" : undefined} onChange={(event) => setNextActor(event.target.value || " ")} />
              ) : null}
              {partyNames.length ? <datalist id="signoff-next-actors">{partyNames.map((name) => <option key={name} value={name} />)}</datalist> : null}
            </label>
            <label className="form-field">
              <span>{text("Due date (optional)", "Uiterste datum (optioneel)")}</span>
              <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
            {external ? (
              <>
                <label className="form-field">
                  <span>{text("Representative name", "Naam vertegenwoordiger")} <em className="record-section-required">*</em></span>
                  <input value={externalName} maxLength={120} list={partyNames.length ? "signoff-party-names" : undefined} onChange={(event) => setExternalName(event.target.value)} />
                  {partyNames.length ? <datalist id="signoff-party-names">{partyNames.map((name) => <option key={name} value={name} />)}</datalist> : null}
                </label>
                <label className="form-field">
                  <span>{text("Organisation", "Organisatie")}</span>
                  <input value={externalOrganization} maxLength={160} onChange={(event) => setExternalOrganization(event.target.value)} />
                </label>
              </>
            ) : null}
            {signedDocument ? (
              <label className="form-field">
                <span>{text("Signed document or photo", "Ondertekend document of foto")} <em className="record-section-required">*</em></span>
                <input type="file" accept="application/pdf,image/*" onChange={(event) => setSignedFile(event.target.files?.[0] ?? null)} />
              </label>
            ) : null}
          </div>
          {stageConfig?.required_approvals && stageConfig.required_approvals > 1 ? (
            <p className="form-helper">{text(`This step needs ${stageConfig.required_approvals} approvals before the record moves on.`, `Deze stap vraagt ${stageConfig.required_approvals} goedkeuringen voordat de registratie verder gaat.`)}</p>
          ) : null}
          {outcomeFieldList.length ? (
            <div className="signoff-outcome" role="group" aria-label={chosen ? word(signoffActionLabels[chosen.action]) : undefined}>
              <div className="form-grid form-grid-2">
                {outcomeFieldList.map((field) => (
                  <label className={`form-field${field.kind === "textarea" ? " signoff-outcome-wide" : ""}`} key={field.key}>
                    <span>{word(field.label)} {field.required ? <em className="record-section-required">*</em> : null}</span>
                    {field.kind === "textarea" ? (
                      <textarea rows={3} maxLength={field.max} value={outcome[field.key] ?? ""} onChange={(event) => setOutcome({ ...outcome, [field.key]: event.target.value })} />
                    ) : field.kind === "select" ? (
                      <select value={outcome[field.key] ?? ""} onChange={(event) => setOutcome({ ...outcome, [field.key]: event.target.value })}>
                        <option value="">{text("Choose…", "Kies…")}</option>
                        {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input type="text" inputMode={field.kind === "number" ? "decimal" : undefined} maxLength={field.max} value={outcome[field.key] ?? ""} onChange={(event) => setOutcome({ ...outcome, [field.key]: event.target.value })} />
                    )}
                    {field.hint ? <small className="form-helper">{word(field.hint)}</small> : null}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <label className="form-field">
            <span>{text("Comments", "Opmerkingen")} {needsComment ? <em className="record-section-required">*</em> : null}</span>
            <textarea rows={3} maxLength={4000} value={comments} onChange={(event) => setComments(event.target.value)} />
          </label>
          {attestation === "external_representative" ? (
            <SignatureField
              label={text("Signature of the representative", "Handtekening vertegenwoordiger")}
              declaration={action === "acknowledge"
                ? text("Confirms receipt only. It is not acceptance of quality, cost, time or liability.", "Bevestigt alleen ontvangst. Het is geen acceptatie van kwaliteit, kosten, tijd of aansprakelijkheid.")
                : text("Signed on this device by the named representative.", "Op dit apparaat getekend door de genoemde vertegenwoordiger.")}
              nameSuggestion={externalName}
              disabled={!externalName.trim()}
              disabledHint={text("Fill in the representative's name first.", "Vul eerst de naam van de vertegenwoordiger in.")}
              value={signature}
              onChange={setSignature}
            />
          ) : null}
          {action === "acknowledge" && !external ? <p className="form-helper">{text("Acknowledging confirms receipt only; it is not acceptance of quality, cost, time or liability.", "Bevestigen is alleen ontvangst; het is geen acceptatie van kwaliteit, kosten, tijd of aansprakelijkheid.")}</p> : null}
          <div className="record-form-actions">
            <button type="button" className="ui-button ui-button--primary ui-button--md" disabled={!ready || busy} onClick={submit}>
              {chosen ? word(signoffActionLabels[chosen.action]) : text("Record action", "Actie vastleggen")}
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  );
}
