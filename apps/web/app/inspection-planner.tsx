"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import type { Inspection } from "@/lib/supabase/operations";

/**
 * Planning an inspection for a colleague (Word 14, WD-192). The checklist, building and location
 * come from the Start inspection form around it; this part adds who carries it out and when. The
 * colleague is notified by the database when the inspection is planned or later moved, never the
 * person making the change, and never twice for the same time.
 *
 * Times are entered and shown in the project's time zone (America/Paramaribo, UTC-3, no daylight
 * saving), like every other date on these screens.
 */
export type Executor = { id: string; name: string };

const offset = 3 * 60 * 60 * 1000;
export const toProjectInput = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() - offset).toISOString().slice(0, 16) : "");
export const fromProjectInput = (value: string) => new Date(`${value}:00-03:00`).toISOString();

export function InspectionPlanForm({ executors, busy, ready, onPlan }: {
  executors: Executor[];
  busy: boolean;
  /** The checklist and location above are complete. */
  ready: boolean;
  onPlan: (executorId: string, plannedAt: string) => void | Promise<unknown>;
}) {
  const { text } = useLanguage();
  const [executor, setExecutor] = useState("");
  const [when, setWhen] = useState("");
  if (!executors.length) return null;
  return (
    <details className="inspection-plan-details" data-inspection-plan>
      <summary>{text("Plan it for a colleague or for later · optional", "Plan het voor een collega of voor later · optioneel")}</summary>
      <div className="form-grid-2">
        <label className="form-field"><span>{text("Carried out by", "Uit te voeren door")}</span>
          <select value={executor} onChange={(event) => setExecutor(event.target.value)}>
            <option value="">{text("Choose a colleague…", "Kies een collega…")}</option>
            {executors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label className="form-field"><span>{text("Planned for", "Gepland op")}</span><input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></label>
      </div>
      <p className="form-helper">{text("The colleague gets a notification. The inspection stays planned until they open its checklist.", "De collega krijgt een melding. De inspectie blijft gepland tot hij of zij de checklist opent.")}</p>
      <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || !ready || !executor || !when} onClick={() => void onPlan(executor, fromProjectInput(when))}>
        {busy ? <Loader2 className="spin" size={15} /> : <CalendarClock size={15} />} {text("Plan inspection", "Inspectie plannen")}
      </button>
    </details>
  );
}

export function PlannedInspections({ inspections, executors, busy, nameOf, onReschedule }: {
  inspections: Inspection[];
  executors: Executor[];
  busy: boolean;
  nameOf: (userId: string | null | undefined) => string;
  onReschedule: (inspectionId: string, plannedAt: string, executorId: string) => void | Promise<unknown>;
}) {
  const { text, locale } = useLanguage();
  const [edits, setEdits] = useState<Record<string, { when: string; executor: string }>>({});
  if (!inspections.length) return null;
  return (
    <section className="operation-form planned-inspections" aria-label={text("Planned inspections", "Geplande inspecties")} data-planned-inspections>
      <div className="operation-form-heading"><div><h2>{text("Planned inspections", "Geplande inspecties")}</h2></div><span>{inspections.length}</span></div>
      <ul className="planned-inspection-list">
        {inspections.map((inspection) => {
          const edit = edits[inspection.id] ?? { when: toProjectInput(inspection.planned_at), executor: inspection.executed_by ?? "" };
          const changed = edit.when !== toProjectInput(inspection.planned_at) || edit.executor !== (inspection.executed_by ?? "");
          return (
            <li key={inspection.id} data-planned-inspection={inspection.inspection_number}>
              <div>
                <strong>{inspection.title}</strong>
                <small>{inspection.inspection_number} · {inspection.planned_at ? new Date(inspection.planned_at).toLocaleString(locale, { timeZone: "America/Paramaribo", dateStyle: "medium", timeStyle: "short" }) : text("No time set", "Geen tijd")} · {nameOf(inspection.executed_by)}</small>
              </div>
              <div className="form-grid-2">
                <label className="form-field"><span>{text("Planned for", "Gepland op")}</span><input type="datetime-local" aria-label={`${text("Planned for", "Gepland op")} ${inspection.inspection_number}`} value={edit.when} onChange={(event) => setEdits({ ...edits, [inspection.id]: { ...edit, when: event.target.value } })} /></label>
                <label className="form-field"><span>{text("Carried out by", "Uit te voeren door")}</span>
                  <select aria-label={`${text("Carried out by", "Uit te voeren door")} ${inspection.inspection_number}`} value={edit.executor} onChange={(event) => setEdits({ ...edits, [inspection.id]: { ...edit, executor: event.target.value } })}>
                    {edit.executor && !executors.some((person) => person.id === edit.executor) ? <option value={edit.executor}>{nameOf(edit.executor)}</option> : null}
                    {executors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
              </div>
              <button className="ui-button ui-button--secondary ui-button--sm" type="button" disabled={busy || !changed || !edit.when || !edit.executor} aria-label={`${text("Reschedule", "Verplaatsen")} ${inspection.inspection_number}`} onClick={() => void onReschedule(inspection.id, fromProjectInput(edit.when), edit.executor)}>{text("Reschedule", "Verplaatsen")}</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
