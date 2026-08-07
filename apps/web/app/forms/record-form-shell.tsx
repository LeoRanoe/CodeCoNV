"use client";

import { Loader2, Save, X } from "lucide-react";
import type { ReactNode } from "react";
import { BuildingMultiPicker, type BuildingOption } from "@/app/building-picker";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { useLanguage } from "@/lib/i18n";

export function RecordFormShell({
  code,
  title,
  status,
  children,
  validation = [],
  busy = false,
  canSave = true,
  saveLabel,
  cancelLabel,
  onSave,
  onCancel,
  className = "",
  headerAside,
}: {
  code: string;
  title: string;
  status?: string;
  children: ReactNode;
  validation?: string[];
  busy?: boolean;
  canSave?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
  headerAside?: ReactNode;
}) {
  const { text } = useLanguage();
  return (
    <div className={`operation-form record-form-shell ${className}`.trim()} aria-busy={busy || undefined}>
      <div className="operation-form-heading record-form-heading">
        <div>
          <span className="record-number">{code}</span>
          <h2>{title}</h2>
        </div>
        <div className="record-form-heading-aside">
          {headerAside}
          {status ? <span className="task-status">{status}</span> : null}
        </div>
      </div>
      {validation.length ? (
        <div className="record-form-validation" role="alert">
          <strong>{text("Check before saving", "Controleer voor opslaan")}</strong>
          <ul>{validation.map((message) => <li key={message}>{message}</li>)}</ul>
        </div>
      ) : null}
      <div className="record-form-sections">{children}</div>
      {onSave || onCancel ? (
        <div className="record-form-footer">
          {onCancel ? (
            <button className="ghost-button" type="button" disabled={busy} onClick={onCancel}>
              <X size={15} /> {cancelLabel ?? text("Cancel", "Annuleren")}
            </button>
          ) : null}
          {onSave ? (
            <button className="primary-button" type="button" disabled={busy || !canSave} onClick={onSave}>
              {busy ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
              {saveLabel ?? text("Save record", "Registratie opslaan")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RecordFormSection({
  number,
  title,
  description,
  aside,
  children,
  className = "",
}: {
  number?: number | string;
  title: string;
  description?: string;
  /** Sits at the right of the heading: a running total, a badge, a small button. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`record-form-section ${className}`.trim()}>
      <header className="record-form-section-heading">
        {number !== undefined ? <span className="record-form-section-number">{number}</span> : null}
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {aside !== undefined && aside !== null ? <div className="record-form-section-aside">{aside}</div> : null}
      </header>
      <div className="record-form-section-body">{children}</div>
    </section>
  );
}

export function RecordFieldBlock({
  kind,
  label,
  hint,
  children,
}: {
  kind: "buildings" | "location" | "photos" | "responsible" | "dates" | "signature" | "notes";
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`record-form-field-block record-form-field-${kind}`}>
      <div className="record-form-field-copy">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="record-form-field-control">{children}</div>
    </div>
  );
}

export function RecordBuildingsField({
  id,
  buildings,
  value,
  onChange,
  hint,
}: {
  id: string;
  buildings: BuildingOption[];
  value: string[];
  onChange: (buildingIds: string[]) => void;
  hint?: string;
}) {
  const { text } = useLanguage();
  return (
    <RecordFieldBlock kind="buildings" label={text("Buildings", "Gebouwen")} hint={hint}>
      <BuildingMultiPicker id={id} buildings={buildings} value={value} onChange={onChange} />
    </RecordFieldBlock>
  );
}

export function RecordSignatureField({
  value,
  onChange,
  nameSuggestion,
  nameOptions,
  declaration = "",
  hint,
  required = false,
  disabled = false,
  disabledHint,
}: {
  value: HandwrittenSignature | null;
  onChange: (value: HandwrittenSignature | null) => void;
  nameSuggestion?: string;
  nameOptions?: string[];
  declaration?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const { text } = useLanguage();
  return (
    <RecordFieldBlock
      kind="signature"
      label={required ? text("Signature *", "Handtekening *") : text("Signature", "Handtekening")}
      hint={required
        ? text("This record cannot be submitted without the responsible person's signature.", "Deze registratie kan niet worden ingediend zonder de handtekening van de verantwoordelijke.")
        : text("Optional for drafts and existing records.", "Optioneel voor concepten en bestaande registraties.")}
    >
      <SignatureField
        label={text("Write signature", "Plaats handtekening")}
        declaration={declaration}
        hint={hint}
        nameSuggestion={nameSuggestion}
        nameOptions={nameOptions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        disabledHint={disabledHint}
      />
    </RecordFieldBlock>
  );
}
