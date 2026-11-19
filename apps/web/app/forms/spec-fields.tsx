"use client";

import { useId } from "react";
import {
  activityGuide,
  fieldOptions,
  isOtherOption,
  isRequired,
  isVisible,
  needsOtherExplanation,
  otherKey,
  setSpecValue,
  specForms,
  type SpecField,
  type SpecFormKey,
  type SpecValues,
  withInitial,
} from "@/lib/forms/spec-forms";

type Text = (en: string, nl: string) => string;

/**
 * The fields of the client's developer specification for one form, in the workbook's order.
 * Every list is the workbook's own; a category list only shows the categories of the chosen
 * type, and changing the type clears a category that no longer belongs to it.
 */
export function SpecFields({
  form,
  values: rawValues,
  onChange,
  text,
  language,
  heading,
  only,
  skip,
  disabled,
}: {
  form: SpecFormKey;
  values: SpecValues;
  onChange: (next: SpecValues) => void;
  text: Text;
  language: "en" | "nl";
  heading?: string;
  /** Render only these keys (for a form that places some fields elsewhere). */
  only?: readonly string[];
  skip?: readonly string[];
  disabled?: boolean;
}) {
  const idBase = useId();
  const values = withInitial(form, rawValues);
  const fields = specForms[form].filter((field) => (!only || only.includes(field.key)) && !skip?.includes(field.key) && isVisible(field, values));
  if (!fields.length) return null;
  const set = (key: string, value: string | string[]) => onChange(setSpecValue(form, values, key, value));
  const short = fields.filter((field) => field.kind !== "textarea" && field.kind !== "multi" && field.kind !== "completion");
  const long = fields.filter((field) => !short.includes(field));
  const render = (field: SpecField) => (
    <SpecInput key={field.key} id={`${idBase}-${field.key}`} field={field} values={values} set={set} text={text} language={language} disabled={disabled} />
  );
  return (
    <section className="record-section spec-section" aria-label={heading ?? text("Specification details", "Specificatiegegevens")} data-spec-form={form}>
      {heading ? <h3>{heading}</h3> : null}
      {short.length ? <div className="form-grid form-grid-2">{short.map(render)}</div> : null}
      {long.map(render)}
    </section>
  );
}

function SpecInput({ id, field, values, set, text, language, disabled }: {
  id: string;
  field: SpecField;
  values: SpecValues;
  set: (key: string, value: string | string[]) => void;
  text: Text;
  language: "en" | "nl";
  disabled?: boolean;
}) {
  const required = isRequired(field, values);
  const label = field.label[language];
  const raw = values[field.key];
  const single = typeof raw === "string" ? raw : "";
  const many = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const options = fieldOptions(field, values);
  const chosen = options.find((option) => option.value === single);
  const guide = field.kind === "activity" ? activityGuide(String(values.discipline ?? ""), single) : undefined;
  const hint = field.hint?.[language];
  const other = needsOtherExplanation(field, values) ? (
    <label className="form-field spec-other" htmlFor={`${id}-other`}>
      <span>{text(`${label} · explain Other`, `${label} · licht Overig toe`)} <em className="record-section-required">*</em></span>
      <input id={`${id}-other`} value={String(values[otherKey(field)] ?? "")} maxLength={240} disabled={disabled} required onChange={(event) => set(otherKey(field), event.target.value)} />
    </label>
  ) : null;
  const caption = (
    <span>
      {label} {required ? <em className="record-section-required">*</em> : null}
    </span>
  );

  if (field.kind === "multi" || field.kind === "completion") {
    return (
      <fieldset className="form-field spec-choices" disabled={disabled} data-spec-field={field.key}>
        <legend>{caption}</legend>
        {hint ? <p className="form-helper">{hint}</p> : null}
        <div className="spec-choice-list">
          {options.map((option) => (
            <label key={option.value} className="spec-choice">
              <input
                type="checkbox"
                checked={many.includes(option.value)}
                onChange={(event) => set(field.key, event.target.checked ? [...many, option.value] : many.filter((item) => item !== option.value))}
              />
              <span>{option.value}</span>
            </label>
          ))}
        </div>
        {other}
      </fieldset>
    );
  }

  let control;
  if (field.kind === "select" || field.kind === "dependent" || field.kind === "activity") {
    control = (
      <select id={id} value={single} required={required} disabled={disabled} onChange={(event) => set(field.key, event.target.value)}>
        <option value="">{text("Choose…", "Kies…")}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
        {single && !options.some((option) => option.value === single) ? <option value={single}>{single}</option> : null}
      </select>
    );
  } else if (field.kind === "textarea") {
    control = <textarea id={id} value={single} required={required} disabled={disabled} rows={3} maxLength={4000} onChange={(event) => set(field.key, event.target.value)} />;
  } else {
    const type = field.kind === "datetime" ? "datetime-local" : field.kind === "text" ? "text" : field.kind;
    control = (
      <input
        id={id}
        type={type}
        inputMode={field.kind === "number" ? "decimal" : undefined}
        step={field.kind === "number" ? "any" : undefined}
        min={field.min}
        max={field.max}
        value={single}
        required={required}
        disabled={disabled}
        maxLength={field.kind === "text" ? 240 : undefined}
        onChange={(event) => set(field.key, event.target.value)}
      />
    );
  }

  const prompts = field.key === "activity_details" ? activityGuide(String(values.discipline ?? ""), String(values.activity ?? ""))?.prompts ?? [] : [];
  return (
    <div className={`form-field spec-field${field.kind === "textarea" ? " spec-field-long" : ""}`} data-spec-field={field.key}>
      <label htmlFor={id}>{caption}</label>
      {control}
      {chosen?.description ? <p className="form-helper">{chosen.description}</p> : null}
      {guide?.description ? <p className="form-helper">{guide.description}</p> : null}
      {prompts.length ? (
        <ul className="spec-prompts" aria-label={text("What to record for this activity", "Wat vast te leggen bij deze activiteit")}>
          {prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
        </ul>
      ) : null}
      {hint && !chosen?.description ? <p className="form-helper">{hint}</p> : null}
      {isOtherOption(single) ? other : null}
    </div>
  );
}
