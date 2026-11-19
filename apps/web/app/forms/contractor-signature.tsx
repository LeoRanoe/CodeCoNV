"use client";

import type { ReactNode } from "react";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { useLanguage } from "@/lib/i18n";
import { signatureFromDetails } from "@/lib/signatures/handwritten-signature.mjs";

/** The contractor's side of a record: who signed for the contractor, their job, and the ink. */
export type ContractorSignatureValue = {
  name: string;
  position: string;
  signedAt: string;
  image: string;
};

export const emptyContractorSignature: ContractorSignatureValue = { name: "", position: "", signedAt: "", image: "" };

/** The keys the contractor's signature is stored under, in a record's details or issue box. */
export function contractorSignatureDetails(value: ContractorSignatureValue) {
  return {
    contractor_signed_by: value.image && value.signedAt ? value.name.trim() : "",
    contractor_signed_at: value.image && value.signedAt ? value.signedAt : null,
    contractor_signature_image: value.image && value.signedAt ? value.image : null,
    contractor_signed_position: value.position.trim(),
  };
}

/** Reads the contractor's signature back from the same keys, for editing a stored record. */
export function contractorSignatureFrom(details: Record<string, unknown> | null | undefined): ContractorSignatureValue {
  const read = (key: string) => typeof details?.[key] === "string" ? String(details[key]) : "";
  return {
    name: read("contractor_signed_by") || read("contractor_representative"),
    position: read("contractor_signed_position") || read("contractor_position"),
    signedAt: read("contractor_signed_at"),
    image: read("contractor_signature_image"),
  };
}

/**
 * "Contractor ook tekenen": the contractor's representative signs on the same device, at
 * the end of the form, next to the supervisor. Signing here records receipt of the record;
 * it is not an acceptance of fault, cost or time (Sign-off Workflow sheet). It stays
 * optional: a contractor who is not on site must never block the supervisor from saving.
 */
export function ContractorSignatureField({
  value,
  onChange,
  partyNames = [],
  declaration,
  locked = false,
  idPrefix,
}: {
  value: ContractorSignatureValue;
  onChange: (value: ContractorSignatureValue) => void;
  partyNames?: string[];
  declaration?: string;
  locked?: boolean;
  idPrefix: string;
}) {
  const { text } = useLanguage();
  const signature: HandwrittenSignature | null = signatureFromDetails(value.name, value.signedAt, value.image);
  const listId = `${idPrefix}-contractor-names`;
  return (
    <div className="contractor-signature-field">
      <div className="form-grid-2">
        <label className="form-field">
          <span>{text("Contractor representative", "Vertegenwoordiger aannemer")}</span>
          <input
            list={partyNames.length ? listId : undefined}
            value={value.name}
            disabled={locked || Boolean(signature)}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            placeholder={text("Name", "Naam")}
          />
          {partyNames.length ? <datalist id={listId}>{partyNames.map((name) => <option value={name} key={name} />)}</datalist> : null}
        </label>
        <label className="form-field">
          <span>{text("Position (optional)", "Functie (optioneel)")}</span>
          <input value={value.position} disabled={locked} onChange={(event) => onChange({ ...value, position: event.target.value })} placeholder={text("For example: site foreman", "Bijvoorbeeld: uitvoerder")} />
        </label>
      </div>
      <SignatureField
        label={text("Signature · contractor", "Handtekening · aannemer")}
        declaration={declaration ?? text(
          "By signing, the contractor confirms receipt of this record. It is not an acceptance of fault, cost or time.",
          "Met deze handtekening bevestigt de aannemer de ontvangst van deze registratie. Het is geen erkenning van schuld, kosten of tijd.",
        )}
        hint={text("Optional. Signed on this device by the contractor's representative.", "Optioneel. Op dit apparaat getekend door de vertegenwoordiger van de aannemer.")}
        nameSuggestion={value.name}
        locked={locked}
        disabled={!value.name.trim()}
        disabledHint={text("Fill in the contractor representative first.", "Vul eerst de vertegenwoordiger van de aannemer in.")}
        value={signature}
        onChange={(next) => onChange({
          ...value,
          name: next?.name || value.name,
          signedAt: next?.signedAt ?? "",
          image: next?.image ?? "",
        })}
      />
    </div>
  );
}

/**
 * "Overal aan het eind plaatsen": the signatures close every form, after everything that
 * was filled in, in the same place and the same order — supervision first, contractor second.
 */
export function RecordSignatures({ children }: { children: ReactNode }) {
  const { text } = useLanguage();
  return (
    <section className="record-signatures" aria-label={text("Signatures", "Handtekeningen")}>
      <h3>{text("Signatures", "Handtekeningen")}</h3>
      <div className="record-signatures-grid">{children}</div>
    </section>
  );
}
