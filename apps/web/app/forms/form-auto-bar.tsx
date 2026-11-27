"use client";

import { useEffect, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";
import { autoBarDateKey, projectNowLocal, setSpecValue, specForms, type SpecFormKey, type SpecValues } from "@/lib/forms/spec-forms";

export type AutoBarItem = {
  key: string;
  label: string;
  value: ReactNode;
  /** Shown after the value in the quiet tone, e.g. "by workflow". */
  note?: string;
};

/**
 * The auto bar at the top of every form (developer specification v5.0, START HERE "Record
 * header"): Record ID, event date/time, the "… by" user and Status. Everything in it is filled by
 * the system, so it is read-only; the project is not repeated here (it is in the header).
 * The Title field stands directly below it.
 */
export function FormAutoBar({ items, label }: { items: AutoBarItem[]; label?: string }) {
  const { text } = useLanguage();
  return (
    <section className="form-auto-bar" aria-label={label ?? text("Record details filled in by the system", "Registratiegegevens door het systeem ingevuld")} data-form-auto-bar>
      {items.map((item) => (
        <div className="form-auto-bar-item" key={item.key} data-auto-bar-item={item.key}>
          <small>{item.label}<span className="form-auto-tag">{text("Auto", "Auto")}</span></small>
          <strong>{item.value}{item.note ? <span className="form-auto-note"> · {item.note}</span> : null}</strong>
        </div>
      ))}
    </section>
  );
}

/** The four auto-bar cells every form shows, in the order of the mockups. */
export function autoBarItems({
  idLabel,
  idValue,
  idNote,
  dateLabel,
  dateValue,
  byLabel,
  byValue,
  statusValue,
  statusNote,
  text,
}: {
  idLabel: string;
  idValue: ReactNode;
  /** A provisional number says so, e.g. "Provisional · fixed on submit". */
  idNote?: string;
  dateLabel: string;
  dateValue: ReactNode;
  byLabel: string;
  byValue: ReactNode;
  statusValue: ReactNode;
  statusNote?: string;
  text: (en: string, nl: string) => string;
}): AutoBarItem[] {
  return [
    { key: "record-id", label: idLabel, value: idValue, note: idNote },
    { key: "event-at", label: dateLabel, value: dateValue },
    { key: "by", label: byLabel, value: byValue },
    { key: "status", label: text("Status", "Status"), value: statusValue, note: statusNote ?? text("by workflow", "door workflow") },
  ];
}

/**
 * The record's date in the auto bar (Excel v5.0 column I, "tap to correct"; mockups 01-15): filled with now, corrected
 * here when the record is written later. It is the form's own date field (`autoBarDateKey`), which the form then does
 * not repeat. Without such a field the fallback text is shown.
 */
export function AutoBarDate({ form, values, onChange, fallback }: { form: SpecFormKey | null; values: SpecValues; onChange: (next: SpecValues) => void; fallback: ReactNode }) {
  const { language } = useLanguage();
  const key = form ? autoBarDateKey[form] : undefined;
  const field = key && form ? specForms[form].find((item) => item.key === key) : undefined;
  const value = field ? String(values[field.key] ?? "") : "";
  // "AUTO": an empty date starts at now, as the auto bar shows it; the user corrects it when the record is written later.
  useEffect(() => {
    if (!form || !field || value) return;
    const moment = projectNowLocal();
    onChange(setSpecValue(form, values, field.key, field.kind === "datetime" ? moment : moment.slice(0, 10)));
    // Only while it is empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, field?.key, value]);
  if (!form || !field) return <>{fallback}</>;
  const now = projectNowLocal();
  return (
    <input
      className="form-auto-bar-input"
      type={field.kind === "datetime" ? "datetime-local" : "date"}
      aria-label={field.label[language]}
      data-spec-field={field.key}
      value={value}
      max={field.kind === "datetime" ? now : now.slice(0, 10)}
      required
      onChange={(event) => onChange(setSpecValue(form, values, field.key, event.target.value))}
    />
  );
}
