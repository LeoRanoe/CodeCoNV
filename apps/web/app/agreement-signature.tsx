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
  signedByA: string;
  signedAtA: string;
  signatureA: string;
  signedByB: string;
  signedAtB: string;
  signatureB: string;
};

export const emptyAgreementSignature: AgreementSignatureState = {
  partyA: "", partyB: "",
  signedByA: "", signedAtA: "", signatureA: "",
  signedByB: "", signedAtB: "", signatureB: "",
};

/** What lands on the register item, so the register and the reports can show it. */
export function agreementSignatureDetails(state: AgreementSignatureState) {
  return {
    agreed_between: [state.partyA, state.partyB].filter(Boolean),
    signed_by_first: state.signedByA || null,
    signed_at_first: state.signedAtA || null,
    signature_first_image: state.signatureA || null,
    signed_by_second: state.signedByB || null,
    signed_at_second: state.signedAtB || null,
    signature_second_image: state.signatureB || null,
  };
}

/**
 * The one line a register list needs: who agreed with whom, and whether it is signed.
 * Without it an agreement looks the same signed and unsigned.
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
  return [between, signature].filter(Boolean).join(" · ");
}

export function AgreementSignatureFields({
  options,
  value,
  onChange,
}: {
  /** The parties that can make an agreement: the own company, the user and the project parties. */
  options: string[];
  value: AgreementSignatureState;
  onChange: (state: AgreementSignatureState) => void;
}) {
  const { text } = useLanguage();

  const sides = [
    { partyKey: "partyA", signedKey: "signedByA", signedAtKey: "signedAtA", imageKey: "signatureA" },
    { partyKey: "partyB", signedKey: "signedByB", signedAtKey: "signedAtB", imageKey: "signatureB" },
  ] as const;

  return (
    <>
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
      <div className="agreement-signatures">
        {sides.map(({ partyKey, signedKey, signedAtKey, imageKey }) => {
          const partyName = value[partyKey];
          const signed = signatureFromDetails(value[signedKey], value[signedAtKey], value[imageKey]) as HandwrittenSignature | null;
          return (
            <SignatureField
              label={partyName
                ? text(`Signature for ${partyName}`, `Handtekening namens ${partyName}`)
                : text("Choose a party first", "Kies eerst een partij")}
              declaration={text(
                "By signing you confirm this agreement as it is written above.",
                "Met je handtekening bevestig je deze afspraak zoals die hierboven staat.",
              )}
              hint={text("The signature, the name and the moment are stored with the agreement.", "De handtekening, de naam en het moment worden bij de afspraak opgeslagen.")}
              nameSuggestion={partyName}
              nameOptions={options}
              disabled={!partyName}
              disabledHint={text("Choose the party that signs here.", "Kies eerst de partij die hier tekent.")}
              value={signed}
              onChange={(signature) => onChange({
                ...value,
                [signedKey]: signature?.name ?? "",
                [signedAtKey]: signature?.signedAt ?? "",
                [imageKey]: signature?.image ?? "",
              })}
              key={partyKey}
            />
          );
        })}
      </div>
    </>
  );
}
