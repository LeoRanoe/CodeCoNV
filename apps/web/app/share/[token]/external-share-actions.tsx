"use client";

import { AlertTriangle, Camera, CheckCircle2, ImageOff, Loader2, PenLine, Send, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { LanguageProvider } from "@/lib/i18n";
import { compressFieldPhoto } from "@/lib/offline/upload-queue";

type ResponseType = "ready_for_verification" | "issue" | "proposed_correction";

export function ExternalSourceImage({ token, sourceNumber }: { token: string; sourceNumber: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="external-source-image-error" role="status"><ImageOff size={22} /><span><strong>Bronfoto tijdelijk niet beschikbaar</strong><small>De taakgegevens hieronder blijven geldig. Meld het aan CODECO als de foto nodig is.</small></span></div>;
  }
  // This same-origin route validates the narrow, expiring share token before
  // streaming the private source image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="external-source-image" src={`/api/external-share/${token}/evidence`} alt={`Bronfoto voor ${sourceNumber}`} onError={() => setFailed(true)} />;
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? `De server gaf status ${response.status}.`;
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function uploadEvidence(token: string, selected: File) {
  const prepared = await compressFieldPhoto(selected, true);
  const file = new File([prepared.blob], prepared.fileName, { type: prepared.mimeType, lastModified: selected.lastModified });
  const fileId = crypto.randomUUID();
  const sha256 = await sha256Hex(file);
  const initiation = await fetch(`/api/external-share/${token}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileId,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      sha256,
    }),
  });
  if (!initiation.ok) throw new Error(await responseError(initiation));
  const upload = await initiation.json() as { fileId: string; pathname: string; presignedUrl: string };
  const stored = await fetch(upload.presignedUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!stored.ok) throw new Error("De verbinding werd onderbroken tijdens het uploaden van de foto.");
  const completion = await fetch(`/api/external-share/${token}/upload/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileId: upload.fileId, pathname: upload.pathname, sha256 }),
  });
  if (!completion.ok) throw new Error(await responseError(completion));
  return upload.fileId;
}

export function ExternalShareActions({ token, sourceType, status, recordKind = null }: { token: string; sourceType: string; status: string | null; recordKind?: string | null }) {
  // An NCR asks the contractor for the corrective action first; that is the box on the
  // client's own form, and it is what this link is sent for.
  //
  // The link answers only while the record is the contractor's to answer. Once CODECO has it
  // for verification a new proposal would replace what was signed; once it is finished nothing
  // can be added. The database refuses both as well; this keeps the form from inviting it.
  const finished = sourceType === "finding" && ["closed", "cancelled", "rejected"].includes(status ?? "");
  const waitingForVerification = sourceType === "finding" && status === "ready_for_verification";
  const correctionAllowed = sourceType === "finding" && recordKind === "ncr" && !finished && !waitingForVerification;
  const completionAllowed = sourceType === "finding" && !finished && !waitingForVerification;
  const [responseType, setResponseType] = useState<ResponseType>(correctionAllowed ? "proposed_correction" : completionAllowed ? "ready_for_verification" : "issue");
  const [note, setNote] = useState("");
  const [contactName, setContactName] = useState("");
  /** The job the signer holds; the client's own form prints it under the name. */
  const [contactPosition, setContactPosition] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  /** The signature the contractor writes under the corrective action. */
  const [signature, setSignature] = useState<HandwrittenSignature | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const router = useRouter();
  const submittingRef = useRef(false);
  const attemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const uploadedRef = useRef<{ photo: File; fileId: string } | null>(null);
  const choices = useMemo(() => responseType === "proposed_correction"
    ? [
      "Wij verwijderen en herstellen het aangegeven werk volgens de instructie.",
      "Wij voeren het werk opnieuw uit volgens de goedgekeurde tekening.",
      "Wij stellen een alternatieve oplossing voor ter goedkeuring.",
    ]
    : responseType === "ready_for_verification"
    ? [
      "Werk is volledig uitgevoerd en gereed voor controle.",
      "Herstel is uitgevoerd volgens de instructie.",
      "Werk is gereed; bewijsfoto is toegevoegd.",
    ]
    : [
      "Werk kan niet volledig worden uitgevoerd.",
      "Materiaal of informatie ontbreekt.",
      "De locatie of opdracht klopt niet.",
      "Er is een nieuw veiligheidsrisico.",
    ], [responseType]);

  const chooseType = (next: ResponseType) => {
    setResponseType(next);
    setNote("");
    setDone("");
    setError("");
  };

  // The name under a corrective action is the signature on the client's NCR form, so it
  // is not optional there.
  const signatureRequired = responseType === "proposed_correction";
  const submit = async () => {
    if (note.trim().length < 3 || (signatureRequired && (contactName.trim().length < 2 || !signature))) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify({ responseType, note: note.trim(), contactName: contactName.trim(), contactPosition: contactPosition.trim(), signature: signature?.image, photo: photo && [photo.name, photo.size, photo.lastModified] });
      if (attemptRef.current?.fingerprint !== fingerprint) attemptRef.current = { fingerprint, key: `external:${crypto.randomUUID()}` };
      let evidenceFileId: string | null = null;
      if (photo) {
        if (uploadedRef.current?.photo !== photo) uploadedRef.current = { photo, fileId: await uploadEvidence(token, photo) };
        evidenceFileId = uploadedRef.current.fileId;
      }
      const response = await fetch(`/api/external-share/${token}/response`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          responseType,
          note: note.trim(),
          contactName: contactName.trim(),
          contactPosition: contactPosition.trim(),
          signatureImage: signature?.image ?? null,
          evidenceFileId,
          idempotencyKey: attemptRef.current.key,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setDone(responseType === "ready_for_verification"
        ? "Gereedmelding ontvangen. CODECO controleert het werk voordat het definitief wordt gesloten."
        : responseType === "proposed_correction"
        ? "Voorgestelde correctieve actie ontvangen. CODECO beoordeelt het voorstel; de NCR blijft open tot het werk is gecontroleerd."
        : "Probleem ontvangen. De verantwoordelijke CODECO-gebruiker krijgt direct een melding.");
      setPhoto(null);
      setSignature(null);
      // The status badge above reads the record again, so it shows the new state without a reload.
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "De reactie kon niet worden verzonden.");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  if (done) {
    return <section className="external-response-success" role="status"><CheckCircle2 size={28} /><h2>Bedankt</h2><p>{done}</p></section>;
  }
  if (finished) {
    return <section className="external-response-note" role="status"><p>Dit punt is afgesloten. Neem contact op met CODECO als er nog iets niet klopt.</p></section>;
  }

  return (
    <section className="external-response-panel">
      <div className="external-response-tabs ui-tabs" role="tablist" aria-label="Reactie op werkpunt">
        {correctionAllowed ? <button className={responseType === "proposed_correction" ? "active" : ""} type="button" onClick={() => chooseType("proposed_correction")}><PenLine size={16} /> Correctie invullen</button> : null}
        {completionAllowed ? <button className={responseType === "ready_for_verification" ? "active" : ""} type="button" onClick={() => chooseType("ready_for_verification")}><CheckCircle2 size={16} /> Gereedmelden</button> : null}
        <button className={responseType === "issue" ? "active issue" : ""} type="button" onClick={() => chooseType("issue")}><AlertTriangle size={16} /> Probleem melden</button>
      </div>
      {waitingForVerification ? <p className="external-response-note">Dit werkpunt is gereedgemeld en wacht op controle door CODECO. Je kunt nog wel een probleem terugmelden.</p> : null}
      {responseType === "proposed_correction" ? <p className="external-response-note">Vul in wat u gaat doen om de afwijking op te lossen en stuur het terug. CODECO controleert het werk daarna op locatie.</p> : null}
      <div className="external-choice-grid">
        {choices.map((choice) => <button className={note === choice ? "active" : ""} type="button" onClick={() => setNote(choice)} key={choice}>{choice}</button>)}
      </div>
      <label className="form-field"><span>{responseType === "proposed_correction" ? "Voorgestelde correctieve actie" : "Toelichting"}</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Kies hierboven een optie; aanpassen mag." /></label>
      <label className="external-photo-input">
        <Camera size={20} />
        <span><strong>{photo ? photo.name : "Bewijsfoto toevoegen (optioneel)"}</strong></span>
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
      </label>
      <label className="form-field"><span>{signatureRequired ? "Naam van de ondertekenaar" : "Naam (optioneel)"}</span><input value={contactName} onChange={(event) => setContactName(event.target.value)} autoComplete="name" required={signatureRequired} /></label>
      {/* Name and position stand under every signature line on the client's own NCR form:
          who signed says less than in what capacity they signed. */}
      {signatureRequired ? (
        <label className="form-field"><span>Functie / titel</span><input value={contactPosition} onChange={(event) => setContactPosition(event.target.value)} autoComplete="organization-title" placeholder="Site Manager - Contractor" /></label>
      ) : null}
      {/* The client's NCR form has a signature line under the contractor's box, so the
          contractor writes the signature here instead of only typing a name. */}
      {signatureRequired ? (
        <LanguageProvider fixed="nl">
          <SignatureField
            label="Onderteken de correctieve actie"
            declaration="Met je handtekening bevestig je de correctieve actie die je hierboven hebt ingevuld."
            hint="De handtekening komt op het non-conformance report van CODECO te staan."
            nameSuggestion={contactName}
            value={signature}
            onChange={(written) => { setSignature(written); if (written?.name) setContactName(written.name); }}
          />
        </LanguageProvider>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <button className={`external-submit ${responseType === "issue" ? "issue" : ""}`} type="button" disabled={busy || note.trim().length < 3 || (signatureRequired && (contactName.trim().length < 2 || !signature)) || (responseType === "ready_for_verification" && !completionAllowed)} onClick={() => void submit()}>
        {busy ? <Loader2 className="spin" size={17} /> : photo ? <Upload size={17} /> : <Send size={17} />}
        {busy ? "Veilig verzenden…" : responseType === "proposed_correction" ? "Verstuur correctieve actie" : responseType === "ready_for_verification" ? "Markeer gereed voor controle" : "Verstuur probleem"}
      </button>
    </section>
  );
}
