"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { useLanguage } from "@/lib/i18n";
import { issueDecisionMinimum, issueDecisionReady, type IssueDecision } from "@/lib/forms/issue-decision";
import { ModalLayer } from "@/app/forms/modal-layer";

/**
 * The Verify / Return dialog of an Issue card (developer package v5, Word 3.1 and 10). Verify asks for the closure note;
 * Return asks for what still has to be corrected and who acts next. The note is stored in the sign-off log.
 */
export function IssueDecisionDialog({ action, issueNumber, title, defaultNextActor, onCancel, onConfirm }: {
  action: "verify" | "return";
  issueNumber: string;
  title: string;
  defaultNextActor: string;
  onCancel: () => void;
  onConfirm: (decision: IssueDecision) => Promise<boolean>;
}) {
  const { text } = useLanguage();
  const heading = useId();
  const [note, setNote] = useState("");
  const [nextActor, setNextActor] = useState(defaultNextActor);
  const [saving, setSaving] = useState(false);
  const submitted = useRef(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const decision: IssueDecision = { action, note, nextActor };
  const ready = issueDecisionReady(decision);
  const verify = action === "verify";

  useEffect(() => {
    noteRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !submitted.current) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const confirm = async () => {
    // One press is one decision: a second tap while the first is saving does nothing.
    if (!ready || submitted.current) return;
    submitted.current = true;
    setSaving(true);
    const okay = await onConfirm(decision).catch(() => false);
    if (!okay) { submitted.current = false; setSaving(false); }
  };

  const missing = [
    note.trim().length < issueDecisionMinimum[action] ? (verify ? text("closure note", "afsluitnotitie") : text("what still has to be corrected", "wat er nog gecorrigeerd moet worden")) : "",
    !verify && nextActor.trim().length < 2 ? text("who acts next", "wie hierna handelt") : "",
  ].filter(Boolean);

  return (
    <ModalLayer>
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onCancel()}>
      <section className="modal issue-decision-modal" role="dialog" aria-modal="true" aria-labelledby={heading}>
        <header className="modal-header">
          <div>
            <h2 id={heading}>{verify ? text("Verify issue", "Issue verifiëren") : text("Return issue for correction", "Issue terugsturen voor correctie")}</h2>
            <p>{issueNumber} · {title}</p>
          </div>
          <button className="modal-close" type="button" onClick={onCancel} disabled={saving} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>
        <div className="modal-body">
          <label className="form-field">
            <span>{verify ? text("Resolution / closure note *", "Oplossing / afsluitnotitie *") : text("What still has to be corrected *", "Wat er nog gecorrigeerd moet worden *")}</span>
            <textarea ref={noteRef} rows={3} maxLength={verify ? 4000 : 1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder={verify ? text("What was checked and why this issue can be closed.", "Wat is gecontroleerd en waarom deze issue gesloten kan worden.") : text("The contractor reads this and sees the issue open again.", "De aannemer leest dit en ziet de issue weer open.")} />
            <DictateButton onText={(transcript) => setNote((current) => appendDictation(current, transcript))} />
          </label>
          {verify ? null : (
            <label className="form-field">
              <span>{text("Next responsible *", "Volgende verantwoordelijke *")}</span>
              <input value={nextActor} maxLength={120} onChange={(event) => setNextActor(event.target.value)} />
            </label>
          )}
          <p className="form-hint">{verify
            ? text("Recorded in the sign-off log with your name and the time. The issue is closed.", "Wordt met je naam en tijdstip in het ondertekeningslog vastgelegd. De issue wordt gesloten.")
            : text("Recorded in the sign-off log. The issue is open again for the contractor.", "Wordt in het ondertekeningslog vastgelegd. De issue staat weer open voor de aannemer.")}</p>
          {missing.length ? <small className="confirm-needs">{text("Still needed", "Nog nodig")}: {missing.join(" · ")}</small> : null}
        </div>
        <div className="modal-actions">
          <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={onCancel} disabled={saving}>{text("Cancel", "Annuleren")}</button>
          <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={!ready || saving} onClick={() => void confirm()}>
            {saving ? <Loader2 className="spin" size={16} /> : null} {verify ? text("Confirm verification", "Verificatie bevestigen") : text("Send back for correction", "Stuur terug voor correctie")}
          </button>
        </div>
      </section>
    </div>
    </ModalLayer>
  );
}
