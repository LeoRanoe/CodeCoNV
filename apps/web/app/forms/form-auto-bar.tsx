"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

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
