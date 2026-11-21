"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  activityGuide,
  canChooseDecision,
  fieldOptions,
  isOtherOption,
  isRequired,
  isVisible,
  matrixRating,
  needsOtherExplanation,
  isSheetRow,
  isSheetSlot,
  otherKey,
  sheetLayouts,
  refKey,
  refsKey,
  rowsFor,
  setSpecValue,
  specForms,
  type SpecColumn,
  type SpecField,
  type SpecFormKey,
  type SpecRow,
  type SpecValue,
  type SpecValues,
  withInitial,
} from "@/lib/forms/spec-forms";
import { ChoiceIcon } from "@/lib/forms/choice-icons";
import { recordMatchesKinds, useSpecDirectory, type SpecDirectoryValue } from "@/app/forms/spec-directory";
import { revisionRefId, revisionReferenceText, revisionStanding, statusMeta } from "@/lib/documents/document-register.mjs";

type Text = (en: string, nl: string) => string;

/** Lists up to this long are pictured tiles; longer lists stay a dropdown. */
const maxTiles = 6;

/**
 * The fields of the client's developer specification for one form, in the workbook's order.
 * Every list is the workbook's own; a category list only shows the categories of the chosen
 * type, and changing the type clears a category that no longer belongs to it. People, records
 * and locations are chosen from the project's live registers (SpecDirectoryProvider).
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
  slots,
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
  /**
   * The whole form in the order of its workbook sheet: every field of the sheet, with the
   * screen's own controls (title, description, location, photos …) in their rows.
   */
  slots?: Partial<Record<string, ReactNode>>;
}) {
  const idBase = useId();
  const directory = useSpecDirectory();
  const values = withInitial(form, rawValues);
  const fields = specForms[form].filter((field) => (!only || only.includes(field.key)) && !skip?.includes(field.key) && isVisible(field, values)
    && (!field.sensitive || directory.canSeeSensitive || !values.__stored));
  const currentUser = directory.currentUser;
  const autoUserKey = fields.find((field) => field.defaultsToCurrentUser && !values[field.key])?.key;
  useEffect(() => {
    if (!autoUserKey || !currentUser || disabled) return;
    onChange({ ...setSpecValue(form, values, autoUserKey, currentUser.name), [refKey(autoUserKey)]: `user:${currentUser.id}` });
    // Only when the field is still empty; the user can change it afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUserKey, currentUser?.id]);
  // "Date default" rows start with today or now; the user may correct them.
  const nowKeys = fields.filter((field) => field.defaultsToNow && !values[field.key]).map((field) => field.key).join(",");
  useEffect(() => {
    if (!nowKeys || disabled) return;
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    let next = values;
    for (const key of nowKeys.split(",")) {
      const field = specForms[form].find((item) => item.key === key);
      next = setSpecValue(form, next, key, field?.kind === "datetime" ? `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}` : field?.kind === "time" ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : date);
    }
    onChange(next);
    // Only for fields that are still empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowKeys]);
  const layout = slots ? sheetLayouts[form] : undefined;
  if (!fields.length && !layout) return null;
  const set = (key: string, value: SpecValue) => onChange(setSpecValue(form, values, key, value));
  const setMany = (patch: Record<string, SpecValue>) => {
    let next = values;
    for (const [key, value] of Object.entries(patch)) next = setSpecValue(form, next, key, value);
    onChange(next);
  };
  const wide = (field: SpecField) => ["textarea", "multi", "completion", "rows", "people", "record"].includes(field.kind);
  const short = fields.filter((field) => !wide(field));
  const long = fields.filter(wide);
  const render = (field: SpecField) => (
    <SpecInput key={field.key} id={`${idBase}-${field.key}`} form={form} field={field} values={values} set={set} setMany={setMany} text={text} language={language} disabled={disabled} directory={directory} />
  );
  if (layout && slots) {
    // One row per line of the sheet, in the sheet's order.
    return (
      <section className="record-section spec-section sheet-form" aria-label={heading ?? text("Form", "Formulier")} data-spec-form={form} data-sheet-form={form}>
        {heading ? <h3>{heading}</h3> : null}
        {layout.map((item) => {
          if (isSheetRow(item)) {
            // One sheet row, several controls: they stand together under the sheet's label. A
            // row without its own label is headed by its first control's label (the sheet's);
            // that control then does not repeat it (it keeps it as its accessible name).
            const first = typeof item.items[0] === "string" ? specForms[form].find((candidate) => candidate.key === item.items[0]) : undefined;
            const rowLabel = item.label ?? first?.label;
            const parts = item.items.map((part) => {
              if (typeof part === "string") {
                const field = fields.find((candidate) => candidate.key === part);
                if (!field) return null;
                return !item.label && field === first ? <div className="sheet-row-main" key={`main-${field.key}`}>{render(field)}</div> : render(field);
              }
              const node = slots[part.slot];
              if (node === undefined || node === null || node === false) return null;
              return <div className="sheet-row-part" data-sheet-slot={part.slot} key={`slot-${part.slot}`}>{node}</div>;
            }).filter(Boolean);
            if (!parts.length) return null;
            return (
              <div className="form-field sheet-row" data-sheet-row={item.row} key={`row-${item.row}`}>
                {rowLabel ? <span className="sheet-slot-label">{rowLabel[language]} {item.required || (first && fields.includes(first) && isRequired(first, values)) ? <em className="record-section-required">*</em> : null}</span> : null}
                {parts}
              </div>
            );
          }
          if (isSheetSlot(item)) {
            const node = slots[item.slot];
            if (node === undefined || node === null || node === false) return null;
            return (
              <div className="form-field sheet-slot" data-sheet-slot={item.slot} key={`slot-${item.slot}`}>
                <span className="sheet-slot-label">{item.label[language]} {item.required ? <em className="record-section-required">*</em> : null}</span>
                {item.hint ? <p className="form-helper">{item.hint[language]}</p> : null}
                {node}
              </div>
            );
          }
          const field = fields.find((candidate) => candidate.key === item);
          return field ? render(field) : null;
        })}
      </section>
    );
  }
  return (
    <section className="record-section spec-section" aria-label={heading ?? text("Specification details", "Specificatiegegevens")} data-spec-form={form}>
      {heading ? <h3>{heading}</h3> : null}
      {short.length ? <div className="form-grid form-grid-2">{short.map(render)}</div> : null}
      {long.map(render)}
    </section>
  );
}

function SpecInput({ id, form, field, values, set, setMany, text, language, disabled, directory }: {
  id: string;
  form: SpecFormKey;
  field: SpecField;
  values: SpecValues;
  set: (key: string, value: SpecValue) => void;
  setMany: (patch: Record<string, SpecValue>) => void;
  text: Text;
  language: "en" | "nl";
  disabled?: boolean;
  directory: SpecDirectoryValue;
}) {
  const required = isRequired(field, values);
  const label = field.label[language];
  const raw = values[field.key];
  const single = typeof raw === "string" ? raw : "";
  const many = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : single ? [single] : [];
  const options = fieldOptions(field, values, directory.config);
  const chosen = options.find((option) => option.value === single);
  const guide = field.kind === "activity" ? activityGuide(String(values.discipline ?? ""), single) : undefined;
  const hint = field.hint?.[language];
  const show = directory.translate;
  const canDecide = directory.canDecide(form);
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

  // The workbook Status and the decisions the database records are shown, never typed.
  if (field.derived || field.auto) {
    const shown = field.derived ? show(single || "Open") : single;
    return (
      <div className="form-field spec-field spec-readonly" data-spec-readonly={field.key}>
        <span>{label}</span>
        <strong>{shown || "—"}</strong>
        {hint ? <p className="form-helper">{hint}</p> : field.auto ? <p className="form-helper">{text("Recorded automatically with the reviewer's decision.", "Automatisch vastgelegd bij het besluit van de beoordelaar.")}</p> : null}
      </div>
    );
  }

  if (field.kind === "multi" || field.kind === "completion") {
    return (
      <fieldset className="form-field spec-choices" disabled={disabled} data-spec-field={field.key}>
        <legend>{caption}</legend>
        {hint ? <p className="form-helper">{hint}</p> : null}
        <div className="choice-tiles" role="group" aria-label={label}>
          {options.map((option) => {
            const checked = many.includes(option.value);
            return (
              <label key={option.value} className={`choice-tile choice-tile-multi${checked ? " is-chosen" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => set(field.key, event.target.checked ? [...many, option.value] : many.filter((item) => item !== option.value))}
                />
                {checked ? <Check className="choice-tile-tick" size={14} aria-hidden="true" /> : null}
                <ChoiceIcon fieldKey={field.key} value={option.value} choices={options.map((item) => item.value)} />
                <span>{show(option.value)}</span>
              </label>
            );
          })}
        </div>
        {other}
      </fieldset>
    );
  }

  if (field.kind === "toggle") {
    return (
      <label className="form-field spec-field spec-toggle" data-spec-field={field.key}>
        <span className="spec-choice">
          <input type="checkbox" checked={single === "yes"} disabled={disabled} onChange={(event) => set(field.key, event.target.checked ? "yes" : "")} />
          <span>{label}</span>
        </span>
        {hint ? <p className="form-helper">{hint}</p> : null}
      </label>
    );
  }

  if (field.kind === "rows") {
    return <SpecRows id={id} field={field} values={values} set={set} text={text} language={language} disabled={disabled} directory={directory} />;
  }

  if (field.kind === "people") {
    return (
      <PeoplePicker id={id} field={field} label={caption} hint={hint} names={many} refs={(values[refsKey(field)] as string[] | undefined) ?? []}
        onChange={(names, refs) => setMany({ [field.key]: names, [refsKey(field)]: refs })} text={text} disabled={disabled} directory={directory} />
    );
  }

  if (field.kind === "person") {
    return (
      <div className="form-field spec-field" data-spec-field={field.key}>
        <label htmlFor={id}>{caption}</label>
        <PersonSelect id={id} field={field} name={single} reference={String(values[refKey(field)] ?? "")} required={required} disabled={disabled}
          onChange={(name, reference) => setMany({ [field.key]: name, [refKey(field)]: reference })} text={text} directory={directory} />
        {hint ? <p className="form-helper">{hint}</p> : null}
      </div>
    );
  }

  if (field.kind === "document") {
    return (
      <DocumentRevisionPicker id={id} field={field} label={caption} hint={hint} reference={single} revisionRef={String(values[refKey(field)] ?? "")}
        onChange={(reference, revisionRef) => setMany({ [field.key]: reference, [refKey(field)]: revisionRef })} text={text} disabled={disabled} directory={directory} />
    );
  }

  if (field.kind === "record") {
    return (
      <RecordPicker id={id} field={field} label={caption} hint={hint} number={single} reference={String(values[refKey(field)] ?? "")}
        onChange={(number, reference) => setMany({ [field.key]: number, [refKey(field)]: reference })} text={text} disabled={disabled} directory={directory} />
    );
  }

  // A short list is shown as pictured tiles, so each choice is told apart at a glance (client, 20-11-2026).
  const shortList = !field.dropdown && (field.kind === "select" || field.kind === "dependent" || field.kind === "rating") && options.length > 0 && options.length <= maxTiles
    && (field.kind !== "rating" || !matrixRating(values, directory.config));
  if (shortList) {
    const choices = options.map((option) => option.value);
    const decisionNote = field.decision && !canDecide
      ? text("Only a reviewer can choose the decision values; the database records who and when.", "Alleen een beoordelaar kiest de besluitwaarden; de database legt vast wie en wanneer.")
      : "";
    return (
      <fieldset className="form-field spec-field spec-tiles" disabled={disabled} data-spec-field={field.key} id={id}>
        <legend>{caption}</legend>
        {hint ? <p className="form-helper">{hint}</p> : null}
        <div className="choice-tiles" role="radiogroup" aria-label={label} aria-required={required || undefined}>
          {options.map((option) => {
            const allowed = canChooseDecision(field, option.value, canDecide) || option.value === single;
            return (
              <label key={option.value} className={`choice-tile${option.value === single ? " is-chosen" : ""}`} title={allowed ? undefined : text("Reviewer only", "Alleen beoordelaar")}>
                <input type="radio" name={id} value={option.value} checked={option.value === single} required={required} disabled={!allowed}
                  onChange={() => set(field.key, option.value)}
                  // A second tap on the chosen tile clears an optional choice.
                  onClick={() => { if (!required && option.value === single) set(field.key, ""); }} />
                <ChoiceIcon fieldKey={field.key} value={option.value} choices={choices} />
                <span>{show(option.value)}</span>
              </label>
            );
          })}
        </div>
        {chosen?.description ? <p className="form-helper">{chosen.description}</p> : null}
        {decisionNote ? <p className="form-helper">{decisionNote}</p> : null}
        {isOtherOption(single) ? other : null}
      </fieldset>
    );
  }

  let control;
  if (field.kind === "rating") {
    const computed = matrixRating(values, directory.config);
    if (computed) {
      return (
        <div className="form-field spec-field spec-readonly" data-spec-readonly={field.key}>
          <span>{label}</span>
          <strong>{show(computed)}</strong>
          <p className="form-helper">{text("From the project's approved risk matrix.", "Uit de goedgekeurde risicomatrix van het project.")}</p>
        </div>
      );
    }
    control = (
      <select id={id} value={single} required={required} disabled={disabled} onChange={(event) => set(field.key, event.target.value)}>
        <option value="">{text("Choose…", "Kies…")}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{show(option.value)}</option>)}
      </select>
    );
  } else if (field.kind === "location") {
    control = (
      <select id={id} value={String(values[refKey(field)] ?? "")} required={required} disabled={disabled} onChange={(event) => {
        const location = directory.locations.find((item) => item.id === event.target.value);
        setMany({ [field.key]: location?.label ?? "", [refKey(field)]: location?.id ?? "" });
      }}>
        <option value="">{single && !values[refKey(field)] ? single : text("Choose a location…", "Kies een locatie…")}</option>
        {directory.locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
      </select>
    );
  } else if (field.kind === "select" || field.kind === "dependent" || field.kind === "activity") {
    control = (
      <select id={id} value={single} required={required} disabled={disabled} onChange={(event) => set(field.key, event.target.value)}>
        <option value="">{text("Choose…", "Kies…")}</option>
        {options.map((option) => {
          const allowed = canChooseDecision(field, option.value, canDecide) || option.value === single;
          return <option key={option.value} value={option.value} disabled={!allowed}>{show(option.value)}{allowed ? "" : text(" · reviewer only", " · alleen beoordelaar")}</option>;
        })}
        {single && !options.some((option) => option.value === single) ? <option value={single}>{show(single)}</option> : null}
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
  const decisionNote = field.decision && !canDecide
    ? text("Only a reviewer can choose the decision values; the database records who and when.", "Alleen een beoordelaar kiest de besluitwaarden; de database legt vast wie en wanneer.")
    : "";
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
      {decisionNote ? <p className="form-helper">{decisionNote}</p> : null}
      {isOtherOption(single) ? other : null}
    </div>
  );
}

type PersonChoice = { value: string; name: string; group: "people" | "companies" | "list" };

function personChoices(field: SpecField | SpecColumn, directory: SpecDirectoryValue): PersonChoice[] {
  const scope = "people" in field && field.people ? field.people : { users: true, partyTypes: undefined as string[] | undefined, listKey: undefined };
  const choices: PersonChoice[] = [];
  if (scope.users !== false) {
    for (const person of directory.people) choices.push({ value: `user:${person.id}`, name: person.name, group: "people" });
  }
  for (const party of directory.parties) {
    if (scope.partyTypes && !scope.partyTypes.includes(party.type)) continue;
    choices.push({ value: `party:${party.id}`, name: party.name, group: "companies" });
  }
  if ("people" in field && field.people?.listKey) {
    for (const item of directory.config?.lists?.[field.people.listKey]?.added ?? []) {
      if (!(directory.config?.lists?.[field.people.listKey]?.retired ?? []).includes(item)) choices.push({ value: `list:${item}`, name: item, group: "list" });
    }
  }
  return choices;
}

/**
 * One person or company from the project's registers. "Other / not in the list" keeps a short
 * typed name; an older record whose name is not in the register shows it the same way.
 */
function PersonSelect({ id, field, name, reference, required, disabled, onChange, text, directory, compact }: {
  id: string;
  field: SpecField | SpecColumn;
  name: string;
  reference: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (name: string, reference: string) => void;
  text: Text;
  directory: SpecDirectoryValue;
  compact?: boolean;
}) {
  const choices = useMemo(() => personChoices(field, directory), [field, directory]);
  const known = choices.find((choice) => choice.value === reference) ?? (!reference ? choices.find((choice) => choice.name === name) : undefined);
  const [typing, setTyping] = useState(false);
  const isOther = typing || reference === "other" || Boolean(name && !known);
  const selectValue = known ? known.value : isOther ? "other" : "";
  const groups: Array<[PersonChoice["group"], string]> = [["people", text("People on this project", "Mensen op dit project")], ["companies", text("Companies", "Bedrijven")], ["list", text("Project list", "Projectlijst")]];
  return (
    <div className={`spec-person${compact ? " spec-person--compact" : ""}`}>
      <select id={id} value={selectValue} required={required && !isOther} disabled={disabled} onChange={(event) => {
        const value = event.target.value;
        if (value === "other") { setTyping(true); onChange(known ? "" : name, "other"); return; }
        setTyping(false);
        const choice = choices.find((item) => item.value === value);
        onChange(choice?.name ?? "", choice?.value ?? "");
      }}>
        <option value="">{text("Choose…", "Kies…")}</option>
        {groups.map(([group, caption]) => {
          const items = choices.filter((choice) => choice.group === group);
          return items.length ? <optgroup key={group} label={caption}>{items.map((choice) => <option key={choice.value} value={choice.value}>{choice.name}</option>)}</optgroup> : null;
        })}
        <option value="other">{text("Other / not in the list", "Anders / niet in de lijst")}</option>
      </select>
      {isOther ? (
        <input aria-label={text("Name", "Naam")} value={name} maxLength={120} required={required} disabled={disabled} placeholder={text("Name", "Naam")} className="spec-other-name" onChange={(event) => onChange(event.target.value, "other")} />
      ) : null}
    </div>
  );
}

function PeoplePicker({ id, field, label, hint, names, refs, onChange, text, disabled, directory }: {
  id: string;
  field: SpecField;
  label: React.ReactNode;
  hint?: string;
  names: string[];
  refs: string[];
  onChange: (names: string[], refs: string[]) => void;
  text: Text;
  disabled?: boolean;
  directory: SpecDirectoryValue;
}) {
  const choices = useMemo(() => personChoices(field, directory), [field, directory]);
  const [typed, setTyped] = useState("");
  const add = (name: string, reference: string) => {
    if (!name.trim() || names.includes(name.trim())) return;
    onChange([...names, name.trim()], [...names.map((_, index) => refs[index] ?? "other"), reference]);
  };
  const remove = (index: number) => onChange(names.filter((_, item) => item !== index), names.map((_, item) => refs[item] ?? "other").filter((_, item) => item !== index));
  return (
    <fieldset className="form-field spec-people" disabled={disabled} data-spec-field={field.key}>
      <legend>{label}</legend>
      {names.length ? (
        <ul className="spec-chips" aria-label={field.label.en}>
          {names.map((name, index) => (
            <li key={`${name}-${index}`}><span>{name}</span><button type="button" className="spec-chip-remove" aria-label={text(`Remove ${name}`, `${name} verwijderen`)} onClick={() => remove(index)}><X size={14} aria-hidden="true" /></button></li>
          ))}
        </ul>
      ) : null}
      <div className="spec-people-add">
        <select id={id} value="" aria-label={text("Add from the register", "Toevoegen uit het register")} onChange={(event) => {
          const choice = choices.find((item) => item.value === event.target.value);
          if (choice) add(choice.name, choice.value);
        }}>
          <option value="">{text("Add from the register…", "Toevoegen uit het register…")}</option>
          {choices.filter((choice) => !names.includes(choice.name)).map((choice) => <option key={choice.value} value={choice.value}>{choice.name}</option>)}
        </select>
        <input value={typed} maxLength={120} aria-label={text("Other / not in the list", "Anders / niet in de lijst")} placeholder={text("Other / not in the list", "Anders / niet in de lijst")} className="spec-people-other" onChange={(event) => setTyped(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(typed, "other"); setTyped(""); } }} />
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={!typed.trim()} onClick={() => { add(typed, "other"); setTyped(""); }}><Plus size={14} aria-hidden="true" /> {text("Add", "Toevoegen")}</button>
      </div>
      {hint ? <p className="form-helper">{hint}</p> : null}
    </fieldset>
  );
}

/**
 * A searchable selector over the project's own records. It stores the record's number in the
 * field and its id beside it; the link can be left empty and added later.
 */
function RecordPicker({ id, field, label, hint, number, reference, onChange, text, disabled, directory }: {
  id: string;
  field: SpecField;
  label: React.ReactNode;
  hint?: string;
  number: string;
  reference: string;
  onChange: (number: string, reference: string) => void;
  text: Text;
  disabled?: boolean;
  directory: SpecDirectoryValue;
}) {
  const [query, setQuery] = useState("");
  const candidates = useMemo(() => {
    const bare = query.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const words = query.trim().toLowerCase();
    return directory.records
      .filter((record) => record.code && recordMatchesKinds(record, field.recordKinds))
      .filter((record) => !words || record.code.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(bare) || record.title.toLowerCase().includes(words))
      .slice(0, 60);
  }, [directory.records, field.recordKinds, query]);
  const linked = directory.records.find((record) => `${record.kind}:${record.id}` === reference);
  return (
    <div className="form-field spec-field spec-record" data-spec-field={field.key}>
      <label htmlFor={id}>{label}</label>
      {number ? (
        <div className="spec-chips">
          <span className="spec-record-chip">
            <strong>{number}</strong>{linked?.title ? <span> · {linked.title}</span> : null}
            <button type="button" className="spec-chip-remove" disabled={disabled} aria-label={text(`Remove the link to ${number}`, `Koppeling met ${number} verwijderen`)} onClick={() => onChange("", "")}><X size={14} aria-hidden="true" /></button>
          </span>
        </div>
      ) : (
        <div className="spec-record-search">
          <input type="search" value={query} disabled={disabled} aria-label={text("Search by number or title", "Zoek op nummer of titel")} placeholder={text("Search by number or title", "Zoek op nummer of titel")} onChange={(event) => setQuery(event.target.value)} />
          <select id={id} value="" disabled={disabled} onChange={(event) => {
            const record = candidates.find((item) => `${item.kind}:${item.id}` === event.target.value);
            if (record) { onChange(record.code, `${record.kind}:${record.id}`); setQuery(""); }
          }}>
            <option value="">{candidates.length ? text(`Choose (${candidates.length})…`, `Kies (${candidates.length})…`) : text("No matching records", "Geen passende registraties")}</option>
            {candidates.map((record) => <option key={`${record.kind}:${record.id}`} value={`${record.kind}:${record.id}`}>{record.code} · {record.title}</option>)}
          </select>
        </div>
      )}
      {hint ? <p className="form-helper">{hint}</p> : null}
    </div>
  );
}

/**
 * F11: an exact revision of the Project Documents register. The record stores "<number> rev <mark>"
 * and `revision:<id>`; a reference typed by hand (document not in the register) is kept as text.
 */
function DocumentRevisionPicker({ id, field, label, hint, reference, revisionRef, onChange, text, disabled, directory }: {
  id: string;
  field: SpecField;
  label: React.ReactNode;
  hint?: string;
  reference: string;
  revisionRef: string;
  onChange: (reference: string, revisionRef: string) => void;
  text: Text;
  disabled?: boolean;
  directory: SpecDirectoryValue;
}) {
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  // The register may have changed since the form opened (a revision registered or approved meanwhile).
  const refreshDocuments = directory.refreshDocuments;
  useEffect(() => { refreshDocuments?.(); }, [refreshDocuments]);
  const documents = useMemo(() => new Map(directory.documents.map((document) => [document.id, document])), [directory.documents]);
  const candidates = useMemo(() => {
    const words = query.trim().toLowerCase();
    return directory.revisions
      .filter((revision) => !["withdrawn", "superseded"].includes(revision.review_status))
      .map((revision) => ({ revision, document: documents.get(revision.document_id) }))
      .filter(({ document }) => document)
      .filter(({ revision, document }) => !words || `${document!.document_number ?? ""} ${document!.title} rev ${revision.revision}`.toLowerCase().includes(words))
      .sort((a, b) => `${a.document!.document_number ?? a.document!.title}`.localeCompare(`${b.document!.document_number ?? b.document!.title}`) || b.revision.uploaded_at.localeCompare(a.revision.uploaded_at))
      .slice(0, 80);
  }, [directory.revisions, documents, query]);
  const standing = revisionRefId(revisionRef) ? revisionStanding(revisionRefId(revisionRef), directory.documents, directory.revisions) : null;
  return (
    <div className="form-field spec-field spec-record" data-spec-field={field.key}>
      <label htmlFor={id}>{label}</label>
      {reference && !typing ? (
        <div className="spec-chips">
          <span className="spec-record-chip">
            <strong>{reference}</strong>{standing?.document?.title ? <span> · {standing.document.title}</span> : null}
            <button type="button" className="spec-chip-remove" disabled={disabled} aria-label={text(`Remove the reference ${reference}`, `Referentie ${reference} verwijderen`)} onClick={() => onChange("", "")}><X size={14} aria-hidden="true" /></button>
          </span>
          <RevisionStanding standing={standing} text={text} />
        </div>
      ) : typing ? (
        <input id={id} value={reference} maxLength={240} disabled={disabled} aria-label={text("Reference not in the register", "Referentie buiten het register")}
          onChange={(event) => onChange(event.target.value, "")} onBlur={() => setTyping(false)} />
      ) : (
        <div className="spec-record-search">
          <input type="search" value={query} disabled={disabled} aria-label={text("Search documents by number or title", "Zoek documenten op nummer of titel")} placeholder={text("Search by number or title", "Zoek op nummer of titel")} onChange={(event) => setQuery(event.target.value)} />
          <select id={id} value="" disabled={disabled} onChange={(event) => {
            const chosen = candidates.find(({ revision }) => revision.id === event.target.value);
            if (chosen) { onChange(revisionReferenceText(chosen.document, chosen.revision), `revision:${chosen.revision.id}`); setQuery(""); }
          }}>
            <option value="">{candidates.length ? text(`Choose a revision (${candidates.length})…`, `Kies een revisie (${candidates.length})…`) : text("No matching documents", "Geen passende documenten")}</option>
            {candidates.map(({ revision, document }) => (
              <option key={revision.id} value={revision.id}>{revisionReferenceText(document, revision)} · {document!.title} · {text(statusMeta(revision.review_status).en, statusMeta(revision.review_status).nl)}</option>
            ))}
          </select>
          <button type="button" className="ui-button ui-button--quiet ui-button--sm" disabled={disabled} onClick={() => setTyping(true)}>{text("Not in the register", "Niet in het register")}</button>
        </div>
      )}
      {hint ? <p className="form-helper">{hint}</p> : null}
    </div>
  );
}

/** A stale revision reference: the stored reference stays, the newer approved revision is named. */
export function RevisionStanding({ standing, text }: { standing: ReturnType<typeof revisionStanding>; text: Text }) {
  if (!standing?.stale) return null;
  const message = standing.newerApproved
    ? text(`Rev ${standing.newerApproved.revision} is approved; this record refers to rev ${standing.pinned.revision}.`, `Rev ${standing.newerApproved.revision} is goedgekeurd; deze registratie verwijst naar rev ${standing.pinned.revision}.`)
    : text(`Rev ${standing.pinned.revision} is no longer valid (${standing.pinned.review_status.replace(/_/g, " ")}).`, `Rev ${standing.pinned.revision} is niet meer geldig (${standing.pinned.review_status.replace(/_/g, " ")}).`);
  return <p className="form-helper spec-revision-stale" role="status" data-revision-stale="true">{message}</p>;
}

/** Repeatable rows: corrective actions with owner and due date, notifications, containment steps. */
/** A follow-up row keeps one identity from first entry through offline replay (F08). */
function newRowId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function SpecRows({ id, field, values, set, text, language, disabled, directory }: {
  id: string;
  field: SpecField;
  values: SpecValues;
  set: (key: string, value: SpecValue) => void;
  text: Text;
  language: "en" | "nl";
  disabled?: boolean;
  directory: SpecDirectoryValue;
}) {
  const rows = rowsFor(field, values);
  const shown: SpecRow[] = rows.length || field.rowsFrom ? rows : [{}];
  const required = isRequired(field, values);
  const write = (next: SpecRow[]) => set(field.key, next);
  const update = (index: number, patch: SpecRow) => write(shown.map((row, item) => (item === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="form-field spec-rows" disabled={disabled} data-spec-rows={field.key}>
      <legend>{field.label[language]} {required ? <em className="record-section-required">*</em> : null}</legend>
      {field.hint ? <p className="form-helper">{field.hint[language]}</p> : null}
      <ol className="spec-row-list">
        {shown.map((row, index) => (
          <li key={field.rowsFrom ? row.step : index} className="spec-row">
            {row.step ? <strong className="spec-row-step">{directory.translate(row.step)}</strong> : null}
            <div className="spec-row-grid">
              {(field.columns ?? []).map((column) => {
                const cellId = `${id}-${index}-${column.key}`;
                const cellLabel = <span>{column.label[language]} {column.required ? <em className="record-section-required">*</em> : null}</span>;
                if (column.kind === "person") {
                  return (
                    <div key={column.key} className="form-field" data-spec-field={`${field.key}.${index}.${column.key}`}>
                      <label htmlFor={cellId}>{cellLabel}</label>
                      <PersonSelect id={cellId} field={column} compact name={row[column.key] ?? ""} reference={row[`${column.key}_ref`] ?? ""} required={column.required} disabled={disabled}
                        onChange={(name, reference) => update(index, { [column.key]: name, [`${column.key}_ref`]: reference })} text={text} directory={directory} />
                    </div>
                  );
                }
                return (
                  <label key={column.key} className="form-field" htmlFor={cellId} data-spec-field={`${field.key}.${index}.${column.key}`}>
                    {cellLabel}
                    <input id={cellId} type={column.kind === "datetime" ? "datetime-local" : column.kind} value={row[column.key] ?? ""} maxLength={column.kind === "text" ? 400 : undefined} disabled={disabled}
                      onChange={(event) => update(index, { [column.key]: event.target.value })} />
                  </label>
                );
              })}
            </div>
            {row.action_id ? <p className="form-helper">{text("Action record created.", "Actie aangemaakt.")}</p> : null}
            {!field.rowsFrom && shown.length > 1 && !row.action_id ? (
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => write(shown.filter((_, item) => item !== index))}><X size={14} aria-hidden="true" /> {text("Remove", "Verwijderen")}</button>
            ) : null}
          </li>
        ))}
      </ol>
      {!field.rowsFrom ? (
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => write([...shown, field.followUp ? { row_id: newRowId() } : {}])}><Plus size={14} aria-hidden="true" /> {text("Add a row", "Regel toevoegen")}</button>
      ) : null}
    </fieldset>
  );
}

/** Linked records of a record, as chips that open them (record viewer). */
export function SpecLinkChips({ links, text }: { links: Array<{ label: string; number: string; ref: string }>; text: Text }) {
  const directory = useSpecDirectory();
  if (!links.length) return null;
  const standingOf = (ref: string) => (revisionRefId(ref) ? revisionStanding(revisionRefId(ref), directory.documents, directory.revisions) : null);
  return (
    <div className="spec-link-chips" aria-label={text("Linked records", "Gekoppelde registraties")}>
      {links.map((link) => (
        <span key={`${link.label}-${link.number}`} className="spec-link-chip">
          <small>{link.label}</small>
          {link.ref && directory.openRecord && !revisionRefId(link.ref) ? (
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => directory.openRecord?.(link.ref)}>{link.number}</button>
          ) : <strong>{link.number}</strong>}
          <RevisionStanding standing={standingOf(link.ref)} text={text} />
        </span>
      ))}
    </div>
  );
}
