"use client";

import { useLanguage } from "@/lib/i18n";

/**
 * An agreement is what two parties said to each other, and both can sign for it. The
 * client asked for that on the register form; the field notepad writes the same record
 * type, so both use these fields and store them the same way.
 */
export type AgreementSignatureState = {
  partyA: string;
  partyB: string;
  signedByA: string;
  signedAtA: string;
  signedByB: string;
  signedAtB: string;
};

export const emptyAgreementSignature: AgreementSignatureState = {
  partyA: "", partyB: "", signedByA: "", signedAtA: "", signedByB: "", signedAtB: "",
};

/** What lands on the register item, so the register and the reports can show it. */
export function agreementSignatureDetails(state: AgreementSignatureState) {
  return {
    agreed_between: [state.partyA, state.partyB].filter(Boolean),
    signed_by_first: state.signedByA || null,
    signed_at_first: state.signedAtA || null,
    signed_by_second: state.signedByB || null,
    signed_at_second: state.signedAtB || null,
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
  const { locale, text } = useLanguage();
  const moment = (stamp: string) => stamp
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(stamp))
    : "";

  return (
    <>
      <div className="form-grid-2">
        <label className="form-field">
          <span>{text("Agreement between", "Afspraak tussen")}</span>
          <select value={value.partyA} onChange={(event) => onChange({ ...value, partyA: event.target.value, signedByA: "", signedAtA: "" })}>
            <option value="">{text("Choose party", "Kies partij")}</option>
            {options.map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>{text("and", "en")}</span>
          <select value={value.partyB} onChange={(event) => onChange({ ...value, partyB: event.target.value, signedByB: "", signedAtB: "" })}>
            <option value="">{text("Choose party", "Kies partij")}</option>
            {options.map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="agreement-signatures">
        {([["partyA", "signedByA", "signedAtA"], ["partyB", "signedByB", "signedAtB"]] as const).map(([partyKey, signedKey, signedAtKey]) => {
          const partyName = value[partyKey];
          return (
            <label className="check-field controlled-document-signature" key={partyKey}>
              <input
                type="checkbox"
                disabled={!partyName}
                checked={Boolean(value[signedKey])}
                onChange={(event) => onChange({
                  ...value,
                  [signedKey]: event.target.checked ? partyName : "",
                  [signedAtKey]: event.target.checked ? new Date().toISOString() : "",
                })}
              />
              <span>
                <strong>{partyName ? text(`Signed for ${partyName}`, `Ondertekend namens ${partyName}`) : text("Choose a party first", "Kies eerst een partij")}</strong>
                <small>{value[signedKey]
                  ? moment(value[signedAtKey])
                  : text("The name and the moment of signing are stored with the agreement.", "De naam en het moment van ondertekenen worden bij de afspraak opgeslagen.")}</small>
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
}
