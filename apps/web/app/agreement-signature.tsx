"use client";

import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { useLanguage } from "@/lib/i18n";
import { signatureFromDetails } from "@/lib/signatures/handwritten-signature.mjs";

/**
 * An agreement is what two parties said to each other, and both can sign for it. The
 * client asked for that on the register form; the field notepad writes the same record
 * type, so both use these fields and store them the same way.
 *
 * Signing is the signature itself, written at that moment. A tick in a box only recorded
 * that somebody clicked; what the client hands to a contractor has to carry the hand of
 * the person who agreed.
 */
export type AgreementSignatureState = {
  partyA: string;
  partyB: string;
  /** The job the signer holds, as the client's own confirmation box asks for it. */
  positionA: string;
  positionB: string;
  signedByA: string;
  signedAtA: string;
  signatureA: string;
  signedByB: string;
  signedAtB: string;
  signatureB: string;
};

export const emptyAgreementSignature: AgreementSignatureState = {
  partyA: "", partyB: "",
  positionA: "", positionB: "",
  signedByA: "", signedAtA: "", signatureA: "",
  signedByB: "", signedAtB: "", signatureB: "",
};

/**
 * The rest of the client's own "Agreements Made" form: what was agreed is only half of it.
 * Who owns the action, how urgent it is, where it stands, and — once it is done — the date
 * it was actually completed, with the picture that proves it.
 */
export type AgreementRecordState = {
  priority: "low" | "normal" | "high" | "critical";
  responsiblePerson: string;
  status: "open" | "in_progress" | "completed";
  remarks: string;
  actualCompletionDate: string;
  completionStatus: "" | "completed" | "partially_completed" | "not_completed";
  completionRemarks: string;
};

export const emptyAgreementRecord: AgreementRecordState = {
  priority: "normal",
  responsiblePerson: "",
  status: "open",
  remarks: "",
  actualCompletionDate: "",
  completionStatus: "",
  completionRemarks: "",
};

/** The agreement's own fields, as the register and the reports read them back. */
export function agreementRecordDetails(state: AgreementRecordState) {
  return {
    agreement_priority: state.priority,
    responsible_person: state.responsiblePerson.trim() || null,
    agreement_status: state.status,
    agreement_remarks: state.remarks.trim() || null,
    actual_completion_date: state.actualCompletionDate || null,
    completion_status: state.completionStatus || null,
    completion_remarks: state.completionRemarks.trim() || null,
  };
}

/** What lands on the register item, so the register and the reports can show it. */
export function agreementSignatureDetails(state: AgreementSignatureState) {
  return {
    agreed_between: [state.partyA, state.partyB].filter(Boolean),
    signed_by_first: state.signedByA || null,
    signed_at_first: state.signedAtA || null,
    signature_first_image: state.signatureA || null,
    position_first: state.positionA.trim() || null,
    signed_by_second: state.signedByB || null,
    signed_at_second: state.signedAtB || null,
    signature_second_image: state.signatureB || null,
    position_second: state.positionB.trim() || null,
  };
}

/**
 * The one line a register list needs: who agreed with whom, whether it is signed and,
 * once the work is done, that it is done. Without it an agreement looks the same signed
 * and unsigned, open and completed.
 */
export function agreementSummaryLine(
  details: Record<string, unknown> | undefined,
  text: (english: string, dutch: string) => string,
) {
  const parties = Array.isArray(details?.agreed_between)
    ? (details.agreed_between as unknown[]).map((party) => String(party)).filter(Boolean)
    : [];
  const first = details?.signed_by_first ? String(details.signed_by_first) : "";
  const second = details?.signed_by_second ? String(details.signed_by_second) : "";
  const signed = [first, second].filter(Boolean);
  const between = parties.length ? `${text("between", "tussen")} ${parties.join(` ${text("and", "en")} `)}` : "";
  const signature = !signed.length
    ? text("not signed", "niet ondertekend")
    : parties.length && signed.length >= parties.length
      ? text("signed by both parties", "door beide partijen ondertekend")
      : `${text("signed by", "ondertekend door")} ${signed.join(", ")}`;
  const completionLabels: Record<string, string> = {
    completed: text("completed", "afgerond"),
    partially_completed: text("partially completed", "deels afgerond"),
    not_completed: text("not completed", "niet afgerond"),
  };
  const completion = details?.completion_status ? completionLabels[String(details.completion_status)] ?? "" : "";
  const completedOn = details?.actual_completion_date ? String(details.actual_completion_date) : "";
  const closing = [completion, completedOn].filter(Boolean).join(" ");
  return [between, signature, closing].filter(Boolean).join(" · ");
}

export function AgreementSignatureFields({
  options,
  value,
  onChange,
  roleLabels,
}: {
  /** The parties that can make an agreement: the own company, the user and the project parties. */
  options: string[];
  value: AgreementSignatureState;
  onChange: (state: AgreementSignatureState) => void;
  /**
   * The client's own Agreement Confirmation box names the two who sign: the contractor's
   * representative and supervision. It struck the developer's column off, so there are
   * two, not three. Left out — as the field notepad leaves it out — the two sides are
   * whichever parties made the agreement, and are picked by name.
   */
  roleLabels?: [string, string];
}) {
  const { text } = useLanguage();

  const sides = [
    { partyKey: "partyA", positionKey: "positionA", signedKey: "signedByA", signedAtKey: "signedAtA", imageKey: "signatureA" },
    { partyKey: "partyB", positionKey: "positionB", signedKey: "signedByB", signedAtKey: "signedAtB", imageKey: "signatureB" },
  ] as const;

  return (
    <>
      {roleLabels ? null : (
        <div className="form-grid-2">
          <label className="form-field">
            <span>{text("Agreement between", "Afspraak tussen")}</span>
            <select value={value.partyA} onChange={(event) => onChange({ ...value, partyA: event.target.value, signedByA: "", signedAtA: "", signatureA: "" })}>
              <option value="">{text("Choose party", "Kies partij")}</option>
              {options.map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>{text("and", "en")}</span>
            <select value={value.partyB} onChange={(event) => onChange({ ...value, partyB: event.target.value, signedByB: "", signedAtB: "", signatureB: "" })}>
              <option value="">{text("Choose party", "Kies partij")}</option>
              {options.map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="agreement-signatures">
        {sides.map(({ partyKey, positionKey, signedKey, signedAtKey, imageKey }, index) => {
          const partyName = value[partyKey];
          const role = roleLabels?.[index] ?? "";
          const signed = signatureFromDetails(value[signedKey], value[signedAtKey], value[imageKey]) as HandwrittenSignature | null;
          return (
            <div className="agreement-signature-column" key={partyKey}>
              {role ? (
                <>
                  <strong className="agreement-signature-role">{role}</strong>
                  <label className="form-field">
                    <span>{text("Name", "Naam")}</span>
                    <input
                      list={`agreement-party-${partyKey}`}
                      value={partyName}
                      onChange={(event) => onChange({ ...value, [partyKey]: event.target.value })}
                      placeholder={text("Enter name", "Voer naam in")}
                    />
                    <datalist id={`agreement-party-${partyKey}`}>{options.map((name) => <option value={name} key={name} />)}</datalist>
                  </label>
                  <label className="form-field">
                    <span>{text("Position / title", "Functie / titel")}</span>
                    <input
                      value={value[positionKey]}
                      onChange={(event) => onChange({ ...value, [positionKey]: event.target.value })}
                      placeholder={text("Enter position / title", "Voer functie / titel in")}
                    />
                  </label>
                </>
              ) : null}
              <SignatureField
                label={role
                  ? text(`Signature · ${role}`, `Handtekening · ${role}`)
                  : partyName
                  ? text(`Signature for ${partyName}`, `Handtekening namens ${partyName}`)
                  : text("Choose a party first", "Kies eerst een partij")}
                declaration={text(
                  "By signing you confirm this agreement as it is written above.",
                  "Met je handtekening bevestig je deze afspraak zoals die hierboven staat.",
                )}
                hint={text("Signature, name and date are stored with the agreement.", "Handtekening, naam en datum worden bij de afspraak bewaard.")}
                nameSuggestion={partyName}
                nameOptions={options}
                disabled={!role && !partyName}
                disabledHint={text("Choose the party that signs here.", "Kies eerst de partij die hier tekent.")}
                value={signed}
                onChange={(signature) => onChange({
                  ...value,
                  [signedKey]: signature?.name ?? "",
                  [signedAtKey]: signature?.signedAt ?? "",
                  [imageKey]: signature?.image ?? "",
                })}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
