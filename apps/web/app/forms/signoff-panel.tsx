"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import {
  authorityActions,
  availableActions,
  commentRequired,
  loadSignoffEvents,
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
  const profile = signoffProfiles[profileCode];
  const [events, setEvents] = useState<SignoffEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<SignoffAction | "">("");
  const [role, setRole] = useState("");
  const [attestation, setAttestation] = useState<"account" | "external_representative">("account");
  const [externalName, setExternalName] = useState("");
  const [externalOrganization, setExternalOrganization] = useState("");
  const [signature, setSignature] = useState<HandwrittenSignature | null>(null);
  const [comments, setComments] = useState("");
  const [nextActor, setNextActor] = useState("");
  const [dueAt, setDueAt] = useState("");

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
  if (!profile || !state) return null;

  const chosen = offered.find((item) => item.action === action);
  const stageOf = (number: number) => profile.stages.find((stage) => stage.number === number);
  const needsComment = action ? commentRequired(action) : false;
  const external = attestation === "external_representative";
  const ready = Boolean(chosen)
    && (!needsComment || comments.trim().length >= 3)
    && (action !== "return" || nextActor.trim().length >= 2)
    && (!external || (externalName.trim().length >= 2 && Boolean(signature?.image)));
  const word = (value: { en: string; nl: string }) => value[language];
  const when = (value: string) => new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  const submit = async () => {
    if (!chosen || !ready) return;
    setBusy(true);
    setError("");
    try {
      await recordSignoffAction(client, {
        projectId,
        recordKind,
        recordId,
        profile: profile.code,
        stage: chosen.stage,
        action: chosen.action,
        actorRole: role.trim() || word(stageOf(chosen.stage)?.role ?? { en: "Participant", nl: "Deelnemer" }),
        attestation: external ? "external_representative" : "account",
        actorName: external ? externalName.trim() : undefined,
        actorOrganization: externalOrganization.trim() || undefined,
        signatureImage: signature?.image ?? null,
        comments: comments.trim() || undefined,
        returnReason: action === "return" ? comments.trim().slice(0, 400) : undefined,
        nextActor: nextActor.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
      setAction("");
      setComments("");
      setNextActor("");
      setDueAt("");
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

      {loaded && events.length ? (
        <ol className="signoff-history" aria-label={text("Sign-off history", "Ondertekeningsgeschiedenis")}>
          {events.map((event) => (
            <li key={event.id}>
              <strong>{word(signoffActionLabels[event.action])}</strong>
              <span> · {event.actor_name}{event.actor_organization ? ` (${event.actor_organization})` : ""} · {event.actor_role}</span>
              <span className="signoff-meta"> · {text("round", "ronde")} {event.round_number} · {when(event.created_at)} · {event.previous_status ?? "—"} → {event.new_status}</span>
              {event.attestation_method !== "account" ? <span className="signoff-meta"> · {text("recorded for an external representative", "vastgelegd voor een externe vertegenwoordiger")}</span> : null}
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
              <select value={action} onChange={(event) => setAction(event.target.value as SignoffAction | "")}>
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
              <select value={attestation} onChange={(event) => setAttestation(event.target.value as "account" | "external_representative")}>
                <option value="account">{text("Me, with my account", "Ik, met mijn account")}</option>
                <option value="external_representative">{text("A representative without an account, on this device", "Een vertegenwoordiger zonder account, op dit apparaat")}</option>
              </select>
            </label>
            {action === "return" ? (
              <label className="form-field">
                <span>{text("Who acts next", "Wie is nu aan zet")} <em className="record-section-required">*</em></span>
                <input value={nextActor} maxLength={160} list={partyNames.length ? "signoff-next-actors" : undefined} onChange={(event) => setNextActor(event.target.value)} />
                {partyNames.length ? <datalist id="signoff-next-actors">{partyNames.map((name) => <option key={name} value={name} />)}</datalist> : null}
              </label>
            ) : (
              <label className="form-field">
                <span>{text("Next responsible (optional)", "Volgende verantwoordelijke (optioneel)")}</span>
                <input value={nextActor} maxLength={160} onChange={(event) => setNextActor(event.target.value)} />
              </label>
            )}
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
          </div>
          <label className="form-field">
            <span>{text("Comments", "Opmerkingen")} {needsComment ? <em className="record-section-required">*</em> : null}</span>
            <textarea rows={3} maxLength={4000} value={comments} onChange={(event) => setComments(event.target.value)} />
          </label>
          {external ? (
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
